from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import List, Any, Optional
import json
import os
import re
from pathlib import Path
from uuid import uuid4
from datetime import datetime
from sqlalchemy.orm import Session
from .config import get_employee_llm_config
from . import database, models, schemas
from .services.message_context import build_effective_user_request
from .services.employee_knowledge_service import format_knowledge_context_for_prompt, search_employee_knowledge
from .services.artifact_service import aggregate_step_results_for_final, build_artifact_metadata_from_file_path, build_step_context_summary_for_prompt, create_artifact_from_content, create_artifacts_for_response, create_step_result_md_artifact, detect_requested_output_formats, extract_embedded_artifact_content, format_summary_for_display, is_valid_native_pdf, is_valid_native_pptx, is_valid_native_xlsx, render_requested_deliverables, should_create_step_artifacts, _extract_summary_content
from .services.skill_registry import get_skill
from .services.workflow_service import start_workflow_run
from .services.workflow_service import resume_workflow_run
from .runtime.codex_runtime import CodexRuntime, CodexRuntimeResult

router = APIRouter()
codex_runtime = CodexRuntime()

IGNORED_AGENT_NAMES = {"UserProxy"}
PREFERRED_RESULT_AGENT_NAMES = {"ExecutionAgent", "Assistant"}
LOW_INFORMATION_COMPLETION_PATTERNS = (
    "已为您整理完毕",
    "以上即为",
    "如需深入了解",
    "如需更详细",
    "随时告诉我",
    "请随时告诉我",
)
DELIVERY_VERB_HINTS = (
    "交付",
    "输出",
    "提交",
    "完成",
    "撰写",
    "提供",
    "回答",
)
PRE_PLAN_CLARIFICATION_PATTERNS = (
    "brainstorm",
    "clarifying question",
    "clarifying questions",
    "wait for approval",
    "before writing any code",
)
GREETING_PATTERNS = (
    "你好",
    "您好",
    "hello",
    "hi",
    "hey",
    "在吗",
    "在么",
)

ACTION_VERB_KEYWORDS = (
    "创建",
    "新建",
    "更新",
    "修改",
    "提交",
    "发送",
    "写入",
    "同步",
    "删除",
    "添加",
    "安排",
    "预约",
    "邀请",
)

ACTION_TARGET_HINTS = (
    "日程",
    "会议",
    "日志",
    "待办",
    "calendar",
    "event",
    "schedule",
    "report",
    "todo",
)

REDUNDANT_TAIL_STEP_PATTERNS = (
    "确认创建结果",
    "确认执行结果",
    "检查工具返回结果",
    "确认是否创建成功",
    "确认日程是否创建成功",
    "交付最终结果",
    "基于前序步骤产出",
    "直接完成用户请求",
)

ARTIFACT_FORMAT_LABELS = {
    "html": "HTML 文件",
    "md": "Markdown 文件",
    "pdf": "PDF 文件",
    "pptx": "PPT/PPTX 文件",
}
ARTIFACT_RENDERER_SKILL_KEY = "artifact_renderer"


def _clean_agent_content(content: str) -> str:
    cleaned = (content or "").replace("\r\n", "\n").strip()
    cleaned = re.sub(r"\bTERMINATE\b", "", cleaned)
    cleaned = re.sub(r"[ \t]+\n", "\n", cleaned)
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
    return cleaned


def _strip_markdown_formatting(content: str) -> str:
    cleaned = _clean_agent_content(content)
    if not cleaned:
        return cleaned

    cleaned = re.sub(r"^#{1,6}\s*", "", cleaned, flags=re.MULTILINE)
    cleaned = re.sub(r"^\s*[-*]\s+", "", cleaned, flags=re.MULTILINE)
    cleaned = re.sub(r"\*\*(.*?)\*\*", r"\1", cleaned)
    cleaned = re.sub(r"__(.*?)__", r"\1", cleaned)
    cleaned = re.sub(r"`([^`]*)`", r"\1", cleaned)
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
    return cleaned.strip()


def _looks_like_raw_tool_payload(content: str) -> bool:
    normalized = _clean_agent_content(content)
    if not normalized:
        return True

    lowered = normalized.lower()
    if lowered in {"none", "null", "proceed.", "proceed"}:
        return True

    if normalized.startswith("{") and any(token in normalized for token in [
        "'ok':",
        '"ok":',
        "'result':",
        '"result":',
        "'content':",
        '"content":',
        "'list':",
        '"list":',
        "'data_list':",
        '"data_list":',
    ]):
        return True

    if "\\n" in normalized and any(token in normalized for token in ["'result':", '"result":', "'content':", '"content":']):
        return True

    if normalized.startswith("[") and any(token in normalized for token in ["'type':", '"type":', "'text':", '"text":']):
        return True

    return False


def _is_user_facing_message(name: str, content: str) -> bool:
    cleaned = _clean_agent_content(content)
    if name in IGNORED_AGENT_NAMES:
        return False
    if not cleaned:
        return False
    if _looks_like_raw_tool_payload(cleaned):
        return False
    if "TERMINATE" in cleaned and len(cleaned) < 40:
        return False
    if "CONTEXT: You are executing a multi-step plan" in cleaned:
        return False
    if "Please execute this plan step by step" in cleaned:
        return False
    if "The user has provided feedback on the previous result" in cleaned:
        return False
    if "Original User Request:" in cleaned:
        return False
    if "Approved Plan:" in cleaned:
        return False
    if "task has already been completed" in cleaned:
        return False
    return True


def _format_execution_result(messages: list[dict], fallback_title: str) -> str:
    user_facing_messages = []
    for msg in messages:
        content = msg.get("content", "")
        name = msg.get("name", "Unknown Agent")
        if _is_user_facing_message(name, content):
            user_facing_messages.append({
                "name": name,
                "content": _clean_agent_content(content),
            })

    if not user_facing_messages:
        return f"执行失败：{fallback_title}未返回可展示的内容，请重试或检查已配置的工具连接。"

    preferred_messages = [
        msg for msg in user_facing_messages
        if any(
            msg["name"] == preferred_name or msg["name"].startswith(f"{preferred_name}_")
            for preferred_name in PREFERRED_RESULT_AGENT_NAMES
        )
    ]
    if preferred_messages:
        substantive_messages = [
            msg for msg in preferred_messages
            if len(msg["content"].strip()) >= 120
            and not sum(hint in msg["content"] for hint in LOW_INFORMATION_COMPLETION_PATTERNS) >= 2
        ]
        selected_message = max(
            substantive_messages or preferred_messages,
            key=lambda msg: len(msg["content"].strip()),
        )
        return _strip_markdown_formatting(selected_message["content"])

    return _strip_markdown_formatting(user_facing_messages[-1]["content"])


USER_INPUT_REQUIRED_HINTS = [
    "无法继续",
    "无法直接继续",
    "尚未提供",
    "信息不足",
    "缺少",
    "需补充",
    "请补充",
    "请提供",
    "请确认",
    "确认后我再执行",
    "补充后我再",
    "提供后我再",
]


def _execution_result_requires_user_input(result_text: str) -> bool:
    normalized = re.sub(r"\s+", " ", (result_text or "").strip().lower())
    if not normalized:
        return False

    if "下一步：" not in normalized and "执行结果：" not in normalized:
        return False

    return any(hint in normalized for hint in USER_INPUT_REQUIRED_HINTS)


def _skill_requires_pre_plan_clarification(skill: dict) -> bool:
    skill_key = str(skill.get("skill_key") or "").strip().lower()
    if skill_key == "brainstorming":
        return True

    searchable_text = "\n".join([
        str(skill.get("name") or ""),
        str(skill.get("description") or ""),
        str(skill.get("instructions") or ""),
    ]).lower()

    if "brainstorm" in searchable_text:
        return True

    matched_hints = sum(1 for hint in PRE_PLAN_CLARIFICATION_PATTERNS if hint in searchable_text)
    return matched_hints >= 2


def _allows_pre_plan_clarification(available_skills: list[dict]) -> bool:
    return any(_skill_requires_pre_plan_clarification(skill) for skill in available_skills)


def _build_default_direct_plan_steps(user_message: str) -> list["PlanStep"]:
    request_text = (user_message or "").strip()
    return [
        PlanStep(
            id="step_1",
            title="直接处理用户请求",
            description=request_text or "结合当前上下文直接处理用户请求。",
            status="pending",
        ),
    ]


def _looks_like_direct_chat(user_message: str) -> bool:
    normalized = re.sub(r"\s+", " ", (user_message or "").strip().lower())
    if not normalized:
        return False

    if normalized in GREETING_PATTERNS:
        return True

    if len(normalized) <= 12 and any(pattern in normalized for pattern in GREETING_PATTERNS):
        return True

    return False


def classify_request_route(user_message: str) -> str:
    """Classify a request before selecting knowledge sources or model tools."""
    if _looks_like_direct_chat(user_message):
        return "greeting"
    if _request_explicitly_needs_search(user_message):
        return "realtime_search"
    return "knowledge_qa"


def _build_step_match_text(step: "PlanStep") -> str:
    return re.sub(r"\s+", " ", f"{step.title} {step.description}".strip()).lower()


def _is_action_oriented_step(step: "PlanStep") -> bool:
    step_text = _build_step_match_text(step)
    return any(keyword in step_text for keyword in ACTION_VERB_KEYWORDS) and any(
        hint in step_text for hint in ACTION_TARGET_HINTS
    )


def _score_skill_for_step(step: "PlanStep", skill: dict) -> int:
    step_text = _build_step_match_text(step)
    searchable_text = "\n".join([
        str(skill.get("skill_key") or ""),
        str(skill.get("name") or ""),
        str(skill.get("description") or ""),
        str(skill.get("instructions") or ""),
    ]).lower()

    score = 0
    for token in ACTION_TARGET_HINTS:
        if token in step_text and token in searchable_text:
            score += 3

    for token in ACTION_VERB_KEYWORDS:
        if token in step_text and token in searchable_text:
            score += 2

    selected_skill_type = str(skill.get("skill_type") or "").lower()
    if _is_action_oriented_step(step) and selected_skill_type in {"mcp", "workflow"}:
        score += 4

    if "dingtalk" in searchable_text or "钉钉" in searchable_text:
        if any(token in step_text for token in ["日程", "会议", "日志"]):
            score += 5

    if any(token in step_text for token in ["搜索", "检索", "调研", "查找", "网页", "网络", "资料", "信息"]):
        if any(token in searchable_text for token in ["tavily", "search", "web", "crawl", "research"]):
            score += 8

    if "tavily" in step_text and "tavily" in searchable_text:
        score += 12

    return score


def _normalize_skill_reference(skill_ref: Any, available_skills: list[dict]) -> Optional[str]:
    normalized = str(skill_ref or "").strip()
    if not normalized:
        return None

    skill_map = {str(skill.get("skill_key") or "").strip(): skill for skill in available_skills}
    if normalized in skill_map:
        return normalized

    normalized_lower = normalized.lower()
    for skill in available_skills:
        skill_name = str(skill.get("name") or "").strip()
        if skill_name and skill_name.lower() == normalized_lower:
            return str(skill.get("skill_key") or "").strip() or None

    return None


def _assign_skills_by_scene(plan_steps: list["PlanStep"], available_skills: list[dict]) -> list["PlanStep"]:
    if not plan_steps or not available_skills:
        return plan_steps

    skill_map = {skill["skill_key"]: skill for skill in available_skills}
    executable_skill_types = {"mcp", "workflow"}
    normalized_steps: list[PlanStep] = []

    for step in plan_steps:
        if step.selected_skill_key in skill_map:
            normalized_steps.append(step)
            continue

        ranked_skills = sorted(
            available_skills,
            key=lambda skill: _score_skill_for_step(step, skill),
            reverse=True,
        )
        best_skill = ranked_skills[0] if ranked_skills and _score_skill_for_step(step, ranked_skills[0]) > 0 else None

        if best_skill is None:
            normalized_steps.append(step)
            continue

        best_skill_key = best_skill.get("skill_key")
        best_skill_type = best_skill.get("skill_type")
        candidate_skill_keys = list(dict.fromkeys([best_skill_key, *step.candidate_skill_keys]))

        if _is_action_oriented_step(step) and best_skill_type not in executable_skill_types:
            normalized_steps.append(step.model_copy(update={
                "candidate_skill_keys": candidate_skill_keys,
            }))
            continue

        normalized_steps.append(step.model_copy(update={
            "selected_skill_key": best_skill_key,
            "selected_skill_type": best_skill_type,
            "candidate_skill_keys": candidate_skill_keys,
        }))

    return normalized_steps


def _infer_execution_mode(
    parsed_output: dict,
    plan_steps: list["PlanStep"],
    clarifying_question: Optional[str],
    user_message: str,
) -> str:
    if clarifying_question:
        return "clarify"

    if _looks_like_direct_chat(user_message):
        return "direct"

    requested_mode = str(parsed_output.get("execution_mode") or "").strip().lower()
    if requested_mode in {"direct", "plan"}:
        return requested_mode

    if len(plan_steps) <= 1 and not any(step.selected_skill_type == "workflow" for step in plan_steps):
        return "direct"

    return "plan"

class DirectAnswerRequest(BaseModel):
    chat_id: int
    user_message: str
    employee_id: Optional[int] = None
    automation_setup: bool = False
    upload_ids: List[str] = Field(default_factory=list)
    full_access: bool = False


class DebateParticipant(BaseModel):
    id: int
    name: str
    role_title: Optional[str] = None
    avatar_url: Optional[str] = None
    persona_prompt: Optional[str] = None


class GroupDebateRequest(BaseModel):
    chat_id: int
    user_message: str
    group_id: str
    group_name: Optional[str] = None
    participants: List[DebateParticipant] = Field(default_factory=list)
    mentioned_member_ids: List[int] = Field(default_factory=list)
    max_participants: int = 3
    round_count: int = 2


class GroupDebateMessage(BaseModel):
    sender_role: str
    employee_id: Optional[int] = None
    sender_name: str
    content: str
    message_type: str
    meta_data: dict = Field(default_factory=dict)
    created_at: datetime


class GroupDebateResponse(BaseModel):
    status: str
    result: str
    debate_id: str
    messages: List[GroupDebateMessage] = Field(default_factory=list)


class GroupCollaborationRequest(BaseModel):
    chat_id: int
    user_message: str
    group_id: str
    group_name: Optional[str] = None
    participants: List[DebateParticipant] = Field(default_factory=list)
    mentioned_member_ids: List[int] = Field(default_factory=list)
    max_participants: int = 3


class GroupCollaborationResponse(BaseModel):
    status: str
    result: str
    collaboration_id: str
    messages: List[GroupDebateMessage] = Field(default_factory=list)
    participant_ids: List[int] = Field(default_factory=list)


class DebateSessionListResponse(BaseModel):
    items: List[schemas.DebateSessionSummary] = Field(default_factory=list)


class DebateSessionDetailResponse(BaseModel):
    item: schemas.DebateSessionDetail

class ExecuteResponse(BaseModel):
    status: str
    result: Any
    workflow_run: Optional[dict] = None
    knowledge_hits: List[schemas.KnowledgeSearchHit] = Field(default_factory=list)
    artifacts: List[schemas.ArtifactFile] = Field(default_factory=list)


class RuntimeRunResponse(BaseModel):
    id: str
    chat_id: int
    status: str
    events: List[dict] = Field(default_factory=list)
    result: Optional[ExecuteResponse] = None
    error: Optional[str] = None
    created_at: str
    updated_at: str


class RuntimeRunApprovalRequest(BaseModel):
    approved: bool


def _persist_chat_message(
    db: Session,
    *,
    chat_id: int,
    sender_role: str,
    content: str,
    employee_id: Optional[int] = None,
    message_type: str = "text",
    meta_data: Optional[dict] = None,
) -> models.ChatMessage:
    db_message = models.ChatMessage(
        chat_id=chat_id,
        sender_role=sender_role,
        employee_id=employee_id,
        content=content,
        message_type=message_type,
        meta_data=meta_data,
    )
    db.add(db_message)
    db.commit()
    db.refresh(db_message)
    return db_message


def _make_group_response_message(db_message: models.ChatMessage, sender_name: str) -> GroupDebateMessage:
    return GroupDebateMessage(
        sender_role=db_message.sender_role,
        employee_id=db_message.employee_id,
        sender_name=sender_name,
        content=db_message.content,
        message_type=db_message.message_type,
        meta_data=db_message.meta_data or {},
        created_at=db_message.created_at,
    )


def _build_direct_response_prompt(
    employee_context: str,
    latest_user_message: str,
    effective_user_request: str,
    knowledge_context: str = "",
    allow_structured_deliverable: bool = False,
    automation_prompt: str = "",
    uploaded_files: Optional[list[dict]] = None,
) -> str:
    output_rule = "- Return only the final user-facing answer. Do not include internal reasoning, routing metadata, or workflow metadata."
    format_rules = """
- Do NOT use Markdown markers such as #, ##, ###, ####, **, -, *, or code fences in the final user-facing answer.
"""
    if allow_structured_deliverable:
        output_rule = "- Return only the required structured user-facing deliverable. Do not include internal reasoning, routing metadata, or workflow metadata."
        format_rules = """
- The employee persona explicitly requires a structured deliverable. In this case, follow the persona's output format even when it requires JSON or Markdown.
- For JD generation, output this exact user-facing structure:
  1. A line containing `结构化表单字段：`
  2. A valid JSON object with Chinese field names for the JD form. Use string values, not arrays, for long sections such as 岗位职责、任职要求、加分项、合规提示.
    3. A Markdown attachment source block fenced as ```markdown ... ```, containing only the final JD document.
- Keep the JSON object parseable. Do not wrap the JSON in a code fence.
- For JD Markdown attachments, put `附件内容：` outside the fence only. Inside the markdown fence, start directly with `# 岗位名称JD` and include only JD sections/content. Do not include JSON, `结构化表单字段：`, `附件内容：`, implementation notes, sync-to-library questions, or any explanation inside the Markdown attachment.
- In JD Markdown attachments, use normal Markdown sections such as `## 岗位职责` and numbered list items such as `1. ...`; do not use `###` headings as bullet points.
"""

    automation_section = f"\n{automation_prompt}\n" if automation_prompt else ""
    uploaded_files_section = ""
    if uploaded_files:
        uploaded_files_section = "\n已保存的用户上传文件（请读取真实文件）：\n" + "\n".join(
            f"- {item.get('name')}: {item.get('path')} ({item.get('format')})"
            for item in uploaded_files
        ) + "\n"

    return f"""
{employee_context}

{automation_section}{knowledge_context}{uploaded_files_section}

Latest User Message: {latest_user_message}

Effective User Request:
{effective_user_request}

USER REQUEST:
{latest_user_message}

Please answer the user's request directly in Chinese.

INSTRUCTIONS:
{output_rule}
- Give the user the final answer itself.
- If the knowledge base context contains relevant evidence, prioritize it and keep your answer consistent with that evidence.
- If the knowledge base context explicitly says retrieval failed, say retrieval failed or no usable evidence was returned. Do NOT claim that the system has no connected knowledge base unless the context explicitly says there is no effective knowledge base.
- If the knowledge base context explicitly says no relevant content was retrieved, say that clearly instead of inventing support.
- If the user is asking for a concrete deliverable such as a chapter draft, scene text, outline, worldbuilding document, role list, or another requested artifact, produce that deliverable in this turn.
- Do NOT reply with placeholder acknowledgements such as "收到", "我来写", "我先整理", "稍后给你", or promises to provide the real answer later.
- Do NOT describe what you are about to do when the user has already asked you to do it; just do it.
- If the request is a simple self-introduction or capability question, answer naturally and concretely based on the assistant's actual capabilities in this system.
- If tools are genuinely needed to answer correctly, use them and then return only the final user-facing answer.
- Do NOT expose raw tool payloads, Python dictionaries, JSON blobs, internal coordination logs, or placeholders such as None to the user.
{format_rules.strip()}
- Match the depth and length of the answer to the user's actual request. Simple questions can be answered briefly, but complex requests should be answered fully.
"""


def _run_direct_agent_with_result(
    prompt: str,
    chat_id: int,
    tool_ids: Optional[list] = None,
    db: Session = None,
    allow_structured_deliverable: bool = False,
    automation_setup: bool = False,
    automation_employee_id: Optional[int] = None,
    llm_config=None,
    uploaded_files: Optional[list[dict]] = None,
    full_access: bool = False,
) -> CodexRuntimeResult:
    format_instruction = (
        "如果用户明确要求结构化交付、JSON 或 Markdown 附件源文档，请严格遵循该格式。"
        if allow_structured_deliverable
        else "不要输出计划、JSON、内部推理或工作流元数据。"
    )
    runtime_prompt = (
        "你是当前数字员工，请直接处理用户请求并输出最终中文答案。"
        "如需使用当前请求允许的 MCP 工具，请自行调用并在拿到结果后完成回答。"
        "不要介绍系统身份，不要输出 Agent、runtime、TERMINATE 或其他内部执行信息。"
        "不要输出工具原始 JSON、内部事件、协调过程或占位确认。"
        f"{format_instruction}"
        "如果已经获得足够信息，只输出一次完整最终答案。\n\n"
        f"{prompt}"
    )
    if uploaded_files:
        runtime_prompt += "\n\nINPUT FILES AVAILABLE TO CODEX:\n" + "\n".join(
            f"- {item.get('name')}: {item.get('path')} ({item.get('format')})"
            for item in uploaded_files
        )
    model_config = None
    if llm_config:
        config_list = llm_config.get("config_list") or []
        if config_list:
            model_config = dict(config_list[0])
            model_config["provider"] = model_config.get("provider") or "des_employee"
            if model_config.get("api_type") == "azure":
                model_config["wire_api"] = "responses"

    from .services.runtime_run_service import get_runtime_event_callback

    event_callback = get_runtime_event_callback()
    from .services.runtime_run_service import get_runtime_approval_callback

    approval_callback = get_runtime_approval_callback()
    runtime_method = (
        codex_runtime.run_app_server
        if approval_callback
        else codex_runtime.run_streaming if event_callback else codex_runtime.run
    )
    return runtime_method(
        prompt=runtime_prompt,
        model_config=model_config,
        db=db,
        tool_ids=tool_ids,
        **({"on_event": event_callback} if event_callback else {}),
        **({"on_approval": approval_callback} if approval_callback else {}),
        full_access=full_access,
    )


def _run_direct_agent(
    prompt: str,
    chat_id: int,
    tool_ids: Optional[list] = None,
    db: Session = None,
    allow_structured_deliverable: bool = False,
    automation_setup: bool = False,
    automation_employee_id: Optional[int] = None,
    llm_config=None,
    uploaded_files: Optional[list[dict]] = None,
    full_access: bool = False,
) -> str:
    return _run_direct_agent_with_result(
        prompt,
        chat_id,
        tool_ids=tool_ids,
        db=db,
        allow_structured_deliverable=allow_structured_deliverable,
        automation_setup=automation_setup,
        automation_employee_id=automation_employee_id,
        llm_config=llm_config,
        uploaded_files=uploaded_files,
        full_access=full_access,
    ).text


def _employee_requires_structured_deliverable(employee: Optional[models.AIEmployee]) -> bool:
    if employee is None:
        return False

    text = "\n".join(
        str(part or "")
        for part in [employee.name, employee.role_title, employee.description, employee.persona_prompt]
    ).lower()
    return (
        ("json" in text and ("结构化表单" in text or "表单" in text))
        or ("markdown" in text and "附件" in text)
        or ("md" in text and "附件" in text)
    )


def _hydrate_debate_participants(participants: List[DebateParticipant], db: Session) -> List[dict]:
    if not participants:
        return []

    employee_ids = [participant.id for participant in participants]
    employees = db.query(models.AIEmployee).filter(models.AIEmployee.id.in_(employee_ids)).all()
    employee_map = {employee.id: employee for employee in employees}

    hydrated = []
    for participant in participants:
        employee = employee_map.get(participant.id)
        hydrated.append({
            "id": participant.id,
            "name": employee.name if employee else participant.name,
            "role_title": (employee.role_title if employee else participant.role_title) or "",
            "avatar_url": (employee.avatar_url if employee else participant.avatar_url) or None,
            "persona_prompt": (employee.persona_prompt if employee else participant.persona_prompt) or "",
        })

    return hydrated


def _hydrate_group_participants(participants: List[DebateParticipant], db: Session) -> List[dict]:
    return _hydrate_debate_participants(participants, db)


def _load_group_participants(group_id: str, db: Session) -> List[dict]:
    group = (
        db.query(models.Group)
        .filter(models.Group.id == group_id)
        .first()
    )
    if group is None:
        return []

    group_members = (
        db.query(models.GroupMember)
        .filter(models.GroupMember.group_id == group_id)
        .all()
    )
    employee_ids = [group_member.employee_id for group_member in group_members]
    if not employee_ids:
        return []

    employees = db.query(models.AIEmployee).filter(models.AIEmployee.id.in_(employee_ids)).all()
    employee_map = {employee.id: employee for employee in employees}
    participants = []
    for group_member in group_members:
        employee = employee_map.get(group_member.employee_id)
        if employee is None:
            continue
        participants.append({
            "id": employee.id,
            "name": employee.name,
            "role_title": employee.role_title or "",
            "avatar_url": employee.avatar_url or None,
            "persona_prompt": employee.persona_prompt or "",
            "description": employee.description or "",
            "tool_ids": employee.tool_ids or [],
        })
    return participants


def _enrich_participant_payload(participants: List[dict], db: Session) -> List[dict]:
    if not participants:
        return []

    participant_ids = [participant["id"] for participant in participants]
    employees = db.query(models.AIEmployee).filter(models.AIEmployee.id.in_(participant_ids)).all()
    employee_map = {employee.id: employee for employee in employees}

    enriched = []
    for participant in participants:
      employee = employee_map.get(participant["id"])
      enriched.append({
          **participant,
          "description": (employee.description if employee else participant.get("description")) or "",
          "tool_ids": list((employee.tool_ids if employee else participant.get("tool_ids")) or []),
      })
    return enriched


def _select_collaboration_participants(participants: List[dict], user_message: str, mentioned_member_ids: List[int], max_participants: int) -> List[dict]:
    if len(participants) <= 2:
        return participants

    limit = max(2, min(max_participants or 3, len(participants), 4))
    selected = []
    for participant in participants:
        if participant["id"] in mentioned_member_ids and all(existing["id"] != participant["id"] for existing in selected):
            selected.append(participant)

    ranked = sorted(
        participants,
        key=lambda participant: _score_debate_participant(participant, user_message),
        reverse=True,
    )

    for participant in ranked:
        if len(selected) >= limit:
            break
        if all(existing["id"] != participant["id"] for existing in selected):
            selected.append(participant)

    return selected[:limit]


def _build_collaboration_responsibility(participant: dict, step_index: int, total_steps: int) -> str:
    role_title = str(participant.get("role_title") or "").strip()
    if total_steps <= 1:
        return f"从{role_title or '当前角色'}视角直接完成任务并给出最终交付"

    if step_index == 0:
        return f"从{role_title or '当前角色'}视角先拆解任务，提炼关键事实、约束与执行框架"

    if step_index == total_steps - 1:
        return f"基于前序结果，从{role_title or '当前角色'}视角整合内容并输出最终交付"

    return f"基于上一位成员的结果，从{role_title or '当前角色'}视角继续分析、修正并推进任务"


def _summarize_handoff_text(text: str, limit: int = 120) -> str:
    normalized = re.sub(r"\s+", " ", str(text or "")).strip()
    if len(normalized) <= limit:
        return normalized
    return normalized[:limit].rstrip() + "..."


def _build_group_history_context(chat_id: int, group_id: str, db: Session, limit: int = 12) -> str:
    messages = (
        db.query(models.ChatMessage)
        .filter(models.ChatMessage.chat_id == chat_id)
        .order_by(models.ChatMessage.created_at.desc(), models.ChatMessage.id.desc())
        .limit(limit * 3)
        .all()
    )

    relevant = []
    for message in reversed(messages):
        meta_data = message.meta_data or {}
        if str(meta_data.get("group_id") or "") != str(group_id):
            continue
        sender_name = meta_data.get("sender_name") or ("用户" if message.sender_role == "user" else "数字员工")
        content = (message.content or "").strip()
        if not content:
            continue
        relevant.append(f"{sender_name}：{content}")

    if not relevant:
        return ""

    return "最近群聊上下文：\n" + "\n".join(relevant[-limit:])


def _format_participant_name_with_role(participant: dict) -> str:
    role_suffix = f"（{participant['role_title']}）" if participant.get("role_title") else ""
    return f"{participant['name']}{role_suffix}"


def _build_collaboration_step_prompt(
    group_name: str,
    participant: dict,
    participants: List[dict],
    user_message: str,
    history_context: str,
    responsibility: str,
    step_index: int,
    total_steps: int,
    previous_output: str = "",
    previous_participant: Optional[dict] = None,
) -> str:
    teammates = [
        _format_participant_name_with_role(candidate)
        for candidate in participants
        if candidate["id"] != participant["id"]
    ]
    teammate_text = "、".join(teammates)
    stage_text = "你是这条合作链路的第一位成员。"
    if step_index == total_steps - 1:
        stage_text = "你是这条合作链路的最后一位成员。"
    elif step_index > 0:
        stage_text = "你是这条合作链路中的中间成员。"

    upstream_text = ""
    if previous_output:
        source_name = previous_participant["name"] if previous_participant else "上一位成员"
        upstream_text = f"上一位成员 {source_name} 的结果如下：\n{previous_output}\n\n"

    output_instruction = "请直接输出给用户的最终可用结果。" if step_index == total_steps - 1 else "请输出可以直接交接给下一位成员继续执行的具体结果，不要只写原则。"

    return (
        f"你正在群聊“{group_name}”中参加一次合作式任务接力。"
        f"你的身份是 {_format_participant_name_with_role(participant)}。"
        f"{f'同组其他成员有：{teammate_text}。' if teammate_text else ''}\n"
        f"{history_context}\n"
        f"用户任务：{user_message}\n\n"
        f"{stage_text}\n"
        f"{upstream_text}"
        f"你这一棒的职责是：{responsibility}。"
        "你可以调用你已被授权的 MCP、Skill 和 Knowledge 完成当前任务。"
        "请只代表你自己发言，不要替其他成员下结论，不要输出 Markdown，不要写标题，不要使用客服式过渡话术。"
        f"{output_instruction}"
    )


def _build_collaboration_assignment_copy(participants: List[dict]) -> str:
    chain = " → ".join([
        f"{index + 1}. {participant['name']}"
        for index, participant in enumerate(participants)
    ])
    return f"合作模式已开启，系统已自动分配协作链路：{chain}。"


def _build_group_collaboration_plan_steps(participants: List[dict], user_message: str) -> List[dict]:
    plan_steps = []
    total_steps = len(participants)
    for index, participant in enumerate(participants):
        responsibility = _build_collaboration_responsibility(participant, index, total_steps)
        title = f"{participant['name']} 负责第 {index + 1} 棒"
        description = responsibility
        if index == total_steps - 1:
            description = f"{responsibility}，并基于前序步骤直接完成用户请求：{str(user_message or '').strip()}"
        plan_steps.append({
            "id": f"group_step_{index + 1}",
            "title": title,
            "description": description,
            "selected_skill_key": None,
            "selected_skill_type": None,
            "candidate_skill_keys": list(participant.get("tool_ids") or []),
            "status": "pending",
            "assigned_employee_id": participant["id"],
            "assigned_employee_name": participant["name"],
            "assigned_role_title": participant.get("role_title") or "",
            "depends_on_step_index": None if index == 0 else index - 1,
            "handoff_requirements": "输出可直接交接给下一位成员的结果" if index < total_steps - 1 else "直接输出最终交付",
        })
    return plan_steps


def _format_group_collaboration_plan_text(plan_steps: List[dict]) -> str:
    if not plan_steps:
        return "未生成明确计划。"

    lines = []
    for index, step in enumerate(plan_steps):
        assignee = step.get("assigned_employee_name") or "未指定员工"
        description = str(step.get("description") or "").strip()
        lines.append(f"{index + 1}. [{assignee}] {step.get('title') or f'步骤 {index + 1}'}{f'：{description}' if description else ''}")
    return "\n".join(lines)


def _coerce_group_collaboration_plan_steps(plan_steps: List[dict], participants: List[dict], user_message: str) -> List[dict]:
    participant_map = {participant["id"]: participant for participant in participants}
    normalized_steps = []
    for index, step in enumerate(plan_steps or [], start=1):
        if not isinstance(step, dict):
            continue

        assigned_employee_id = step.get("assigned_employee_id")
        if assigned_employee_id not in participant_map:
            fallback_participant = participants[min(index - 1, len(participants) - 1)] if participants else None
            assigned_employee_id = fallback_participant["id"] if fallback_participant else None

        participant = participant_map.get(assigned_employee_id) if assigned_employee_id is not None else None
        title = str(step.get("title") or f"步骤 {index}").strip() or f"步骤 {index}"
        description = str(step.get("description") or "").strip()
        normalized_steps.append({
            "id": str(step.get("id") or f"group_step_{index}"),
            "title": title,
            "description": description,
            "selected_skill_key": step.get("selected_skill_key"),
            "selected_skill_type": step.get("selected_skill_type"),
            "candidate_skill_keys": [str(item) for item in (step.get("candidate_skill_keys") or [])],
            "status": str(step.get("status") or "pending"),
            "assigned_employee_id": assigned_employee_id,
            "assigned_employee_name": step.get("assigned_employee_name") or (participant["name"] if participant else "未指定员工"),
            "assigned_role_title": step.get("assigned_role_title") or (participant.get("role_title") if participant else ""),
            "depends_on_step_index": step.get("depends_on_step_index"),
            "handoff_requirements": step.get("handoff_requirements") or ("直接输出最终交付" if index == len(plan_steps) else "输出可直接交接给下一位成员的结果"),
        })

    if len(normalized_steps) < 2:
        return _build_group_collaboration_plan_steps(participants, user_message)

    return normalized_steps


def _score_debate_participant(participant: dict, user_message: str) -> int:
    normalized_message = re.sub(r"\s+", " ", (user_message or "").strip().lower())
    searchable = " ".join([
        str(participant.get("name") or ""),
        str(participant.get("role_title") or ""),
        str(participant.get("persona_prompt") or ""),
    ]).lower()

    keyword_groups = [
        (["hr", "招聘", "人事", "入职", "面试"], 10),
        (["数据", "分析", "报表", "洞察", "sql"], 10),
        (["运营", "增长", "投放", "活动", "小红书", "内容"], 10),
        (["销售", "客户", "商机", "转化", "跟进"], 10),
        (["产品", "需求", "roadmap", "原型", "规划"], 10),
        (["设计", "视觉", "界面", "海报", "ui"], 10),
        (["开发", "代码", "接口", "后端", "前端", "bug"], 10),
    ]

    score = 0
    for keywords, weight in keyword_groups:
        if any(keyword in normalized_message for keyword in keywords) and any(keyword in searchable for keyword in keywords):
            score += weight

    participant_name = str(participant.get("name") or "").lower()
    if participant_name and participant_name in normalized_message:
        score += 12

    if searchable and normalized_message[:4] and normalized_message[:4] in searchable:
        score += 4

    return score


def _select_debate_participants(participants: List[dict], user_message: str, mentioned_member_ids: List[int], max_participants: int) -> List[dict]:
    if len(participants) <= 2:
        return participants

    limit = max(2, min(max_participants or 3, 4))
    selected = []
    for participant in participants:
        if participant["id"] in mentioned_member_ids and all(existing["id"] != participant["id"] for existing in selected):
            selected.append(participant)

    ranked = sorted(
        participants,
        key=lambda participant: _score_debate_participant(participant, user_message),
        reverse=True,
    )

    for participant in ranked:
        if len(selected) >= limit:
            break
        if all(existing["id"] != participant["id"] for existing in selected):
            selected.append(participant)

    return selected[:limit]


def _build_debate_history_context(chat_id: int, group_id: str, db: Session, limit: int = 12) -> str:
    messages = (
        db.query(models.ChatMessage)
        .filter(models.ChatMessage.chat_id == chat_id)
        .order_by(models.ChatMessage.created_at.desc(), models.ChatMessage.id.desc())
        .limit(limit * 3)
        .all()
    )

    relevant = []
    for message in reversed(messages):
        meta_data = message.meta_data or {}
        if str(meta_data.get("group_id") or "") != str(group_id):
            continue
        sender_name = meta_data.get("sender_name") or ("用户" if message.sender_role == "user" else "数字员工")
        content = (message.content or "").strip()
        if not content:
            continue
        relevant.append(f"{sender_name}：{content}")

    if not relevant:
        return ""

    return "最近群聊上下文：\n" + "\n".join(relevant[-limit:])


def _build_debate_opening_prompt(group_name: str, participant: dict, participants: List[dict], user_message: str, history_context: str) -> str:
    teammates = [
        _format_participant_name_with_role(candidate)
        for candidate in participants
        if candidate["id"] != participant["id"]
    ]
    teammate_text = "、".join(teammates)

    return (
        f"你正在群聊“{group_name}”参加一场围绕用户需求的内部辩论。"
        f"你的身份是 {_format_participant_name_with_role(participant)}。"
        f"{f'同场参与者有：{teammate_text}。' if teammate_text else ''}\n"
        f"{history_context}\n"
        f"用户需求：{user_message}\n\n"
        f"{_build_debate_opening_instruction(user_message)}"
        "请像真实辩手开场一样发言：先亮出立场，再给核心论据。只代表你自己的专业立场，不要替其他成员下结论，不要输出 Markdown，不要写标题，不要使用客服式过渡话术。一般控制在 3 到 5 句话。"
    )


def _build_debate_rebuttal_prompt(group_name: str, participant: dict, user_message: str, opening_statements: List[dict]) -> str:
    peer_viewpoints = "\n".join([
        f"{entry['participant']['name']}：{entry['content']}"
        for entry in opening_statements
        if entry["participant"]["id"] != participant["id"]
    ]) or "暂无其他成员观点。"

    return (
        f"你正在群聊“{group_name}”中进行第二轮辩论。"
        f"你的身份是 {_format_participant_name_with_role(participant)}。\n"
        f"用户需求：{user_message}\n"
        f"第一轮其他成员的观点如下：\n{peer_viewpoints}\n\n"
        f"{_build_debate_rebuttal_instruction(user_message)}"
        "请像真实辩论攻防一样发言：直接回应对方论点，抓漏洞、拆前提、换标准、举反例都可以，但要回到你自己的立场。不要输出 Markdown，不要写标题，不要使用“我担心”“我想补充一点”这种生硬模板句。一般控制在 3 到 5 句话。"
    )


def _build_debate_round_notice(round_index: int) -> str:
    if round_index == 2:
        return "进入第二轮：开始正面交锋，请直接回应对方最核心的论点。"
    return f"进入第 {round_index} 轮：请继续推进攻防，不要重复上一轮原话。"


def _serialize_debate_session(session: models.DebateSession) -> schemas.DebateSessionSummary:
    return schemas.DebateSessionSummary(
        id=session.id,
        chat_id=session.chat_id,
        group_id=session.group_id,
        group_name=session.group.name if getattr(session, 'group', None) is not None else None,
        topic=session.topic,
        status=session.status,
        round_count=session.round_count or 2,
        max_participants=session.max_participants or 3,
        participant_ids=session.participant_ids or [],
        mentioned_member_ids=session.mentioned_member_ids or [],
        result_summary=session.result_summary,
        created_at=session.created_at,
        updated_at=session.updated_at,
    )


def _load_debate_messages(session: models.DebateSession, db: Session) -> List[schemas.ChatMessage]:
    messages = (
        db.query(models.ChatMessage)
        .filter(models.ChatMessage.chat_id == session.chat_id)
        .order_by(models.ChatMessage.created_at, models.ChatMessage.id)
        .all()
    )

    filtered = []
    for message in messages:
        meta_data = message.meta_data or {}
        if meta_data.get("debate_id") != session.id:
            continue
        filtered.append(schemas.ChatMessage.from_orm(message))

    return filtered


def _build_debate_summary_prompt(group_name: str, user_message: str, transcript: str) -> str:
    return (
        f"你正在为群聊“{group_name}”完成一次辩论总结。\n"
        f"用户需求：{user_message}\n"
        f"辩论记录：\n{transcript}\n\n"
        f"{_build_debate_summary_instruction(user_message)}"
        "你的语气要像主持人或裁判收束辩论：先下判断，再说明胜负依据，必要时指出结论成立的前提。直接输出中文结论，不要使用 Markdown，不要写标题，不要写空泛套话。一般控制在 4 到 6 句话。"
    )


def _is_comparison_debate_request(user_message: str) -> bool:
    text = str(user_message or "")
    comparison_patterns = [
        "谁更",
        "谁厉害",
        "哪个更",
        "哪一个更",
        "二选一",
        "选谁",
        "选哪个",
        "更适合",
        "更强",
        "哪个好",
        "比较",
        "PK",
        "pk",
    ]
    return any(pattern in text for pattern in comparison_patterns)


def _build_debate_opening_instruction(user_message: str) -> str:
    if _is_comparison_debate_request(user_message):
        return "请先直接表明你的判断：你支持哪一方、谁更强或谁更适合；不要绕弯，先给结论，再讲你采用的评判标准和最核心的论据。"
    return "请先给出你的核心主张：你主张什么、为什么成立、你的判断标准是什么。"


def _build_debate_rebuttal_instruction(user_message: str) -> str:
    if _is_comparison_debate_request(user_message):
        return "请围绕这道比较题继续推进：直接指出对方论证里最关键的漏洞，或说明对方忽略了哪个决定性标准，然后回到你支持的对象为什么更占优。"
    return "请直接挑出对方观点里一个最值得打的点来回应。你可以质疑它的前提、标准、因果链、例子或结论跳跃，然后给出你自己的更强版本论证。"


def _build_debate_summary_instruction(user_message: str) -> str:
    if _is_comparison_debate_request(user_message):
        return "请给出最终综合结论：直接判定哪一方更占优、为什么胜出、胜负是建立在哪个标准之上；如果不同标准会导向不同答案，也要明确点出来。"
    return "请给出最终综合结论：明确哪一方论证更完整、哪一点最有说服力、哪一点仍然没有被充分回答。"


def _build_participant_employee_context(participant: dict) -> str:
    parts = []
    if participant.get("role_title"):
        parts.append(f"Role Title: {participant['role_title']}")
    if participant.get("persona_prompt"):
        parts.append(f"Persona: {participant['persona_prompt']}")
    return "\n".join(parts)


def _make_group_debate_response_message(db_message: models.ChatMessage, sender_name: str) -> GroupDebateMessage:
    return _make_group_response_message(db_message, sender_name)


def _answer_direct_for_employee(chat_id: int, user_message: str, employee_id: Optional[int], db: Session, automation_setup: bool = False, employee_id_for_automation: Optional[int] = None, uploaded_files: Optional[list[dict]] = None, full_access: bool = False) -> tuple[str, list[schemas.KnowledgeSearchHit], list[str]]:
    resolved_employee_id = employee_id or _resolve_employee_id_for_chat(chat_id, db)
    employee = db.query(models.AIEmployee).filter(models.AIEmployee.id == resolved_employee_id).first() if resolved_employee_id else None
    employee_skills = _get_employee_skills(employee, db, user_message=user_message)
    workflow_skills = [skill for skill in employee_skills if skill.get("skill_type") == "workflow"]
    effective_tool_ids = list(dict.fromkeys(
        [str(skill.get("skill_key") or "").strip() for skill in employee_skills if skill.get("skill_key")]
    ))
    employee_context = _build_employee_context(employee, employee_skills, workflow_skills)
    effective_user_request = build_effective_user_request(chat_id, user_message, db)
    knowledge_result = search_employee_knowledge(employee, effective_user_request or user_message, db)
    knowledge_context = format_knowledge_context_for_prompt(knowledge_result)
    allow_structured_deliverable = _employee_requires_structured_deliverable(employee)

    # Inject automation setup prompt when in automation_setup mode
    automation_prompt = ""
    automation_employee_id = None
    if automation_setup:
        from .services.automation_prompt_service import build_automation_setup_prompt
        automation_prompt = build_automation_setup_prompt()
        automation_employee_id = employee_id_for_automation or resolved_employee_id

    prompt = _build_direct_response_prompt(
        employee_context,
        user_message,
        effective_user_request,
        knowledge_context,
        allow_structured_deliverable=allow_structured_deliverable,
        automation_prompt=automation_prompt,
        uploaded_files=uploaded_files,
    )
    runtime_result = _run_direct_agent_with_result(
        prompt,
        chat_id,
        tool_ids=effective_tool_ids,
        db=db,
        allow_structured_deliverable=allow_structured_deliverable,
        automation_setup=automation_setup,
        automation_employee_id=automation_employee_id,
        llm_config=get_employee_llm_config(employee, db) if employee else None,
        uploaded_files=uploaded_files,
        full_access=full_access,
    )
    return runtime_result.text, knowledge_result.hits, runtime_result.generated_files


def _resolve_employee_id_for_chat(chat_id: int, db: Session) -> Optional[int]:
    task_progress = (
        db.query(models.TaskProgress)
        .filter(models.TaskProgress.chat_id == chat_id)
        .order_by(models.TaskProgress.id.desc())
        .first()
    )
    if task_progress and task_progress.employee_id:
        return task_progress.employee_id

    chat_message = (
        db.query(models.ChatMessage)
        .filter(
            models.ChatMessage.chat_id == chat_id,
            models.ChatMessage.employee_id.isnot(None),
        )
        .order_by(models.ChatMessage.created_at.desc(), models.ChatMessage.id.desc())
        .first()
    )
    return chat_message.employee_id if chat_message else None


def _request_explicitly_needs_search(user_message: str) -> bool:
    normalized = str(user_message or "").lower()
    return any(token in normalized for token in ["tavily", "搜索", "检索", "调研", "资料", "最新", "联网", "web", "search"])


def _get_employee_skills(employee: Optional[models.AIEmployee], db: Session, user_message: str = "") -> list[dict]:
    if employee is None:
        return []

    skill_keys = list(employee.tool_ids or [])
    preferences = _extract_employee_preferences(employee)
    if _request_explicitly_needs_search(user_message) and "tavily_search" not in skill_keys:
        skill_keys.append("tavily_search")

    if not skill_keys:
        return []

    skills = []
    for skill_key in skill_keys:
        skill = get_skill(skill_key, db)
        if skill is not None:
            skills.append(skill)
    return skills


def _extract_employee_preferences(employee: Optional[models.AIEmployee]) -> dict:
    default_preferences = {
        "search": False,
        "browser": False,
    }
    if employee is None or not isinstance(employee.action_guide, dict):
        return default_preferences

    preferences = employee.action_guide.get("preferences")
    if not isinstance(preferences, dict):
        return default_preferences

    core_skills = preferences.get("core_skills")
    if not isinstance(core_skills, dict):
        core_skills = {}

    def _resolve_bool(primary_key: str, fallback_key: str, default: bool) -> bool:
        primary_value = preferences.get(primary_key)
        fallback_value = core_skills.get(fallback_key)
        if primary_value is not None:
            return bool(primary_value)
        if fallback_value is not None:
            return bool(fallback_value)
        return default

    return {
        "search": _resolve_bool("search_enabled", "search", False),
        "browser": _resolve_bool("browser_enabled", "browser", False),
    }


def _extract_action_guide_content(action_guide: Any) -> Any:
    if not isinstance(action_guide, dict):
        return action_guide

    for key in ("instructions", "steps", "content", "text"):
        value = action_guide.get(key)
        if value not in (None, "", []):
            return value

    return None


def _build_employee_context(
    employee: Optional[models.AIEmployee],
    employee_skills: list[dict],
    workflow_skills: list[dict],
) -> str:
    if employee is None:
        return ""

    employee_context = ""

    if employee.persona_prompt:
        employee_context += f"Role/Persona: {employee.persona_prompt}\n\n"

    if employee_skills:
        skills_prompt = "\n".join(
            f"- {skill.get('name') or skill.get('skill_key')}: {skill.get('description') or ''}"
            for skill in employee_skills
        )
        if skills_prompt:
            employee_context += f"Assigned Skills Constraints:\n{skills_prompt}\n\n"

    action_guide_content = _extract_action_guide_content(employee.action_guide)
    if action_guide_content:
        employee_context += "Action Guide (Standard Operating Procedures):\n"
        if isinstance(action_guide_content, list):
            for idx, step in enumerate(action_guide_content, 1):
                if isinstance(step, dict):
                    content = step.get("text", step.get("content", str(step)))
                    employee_context += f"{idx}. {content}\n"
                else:
                    employee_context += f"{idx}. {step}\n"
        else:
            employee_context += str(action_guide_content)
        employee_context += "\n"

    if employee_skills:
        employee_context += "Loaded Skills For This Employee:\n"
        for skill in employee_skills:
            employee_context += f"- {skill.get('skill_key')}: {skill.get('name')} ({skill.get('skill_type')}) - {skill.get('description') or '无'}\n"
        employee_context += "\n"

    if workflow_skills:
        employee_context += "Workflow Skill Candidates:\n"
        for workflow in workflow_skills:
            employee_context += f"- {workflow.get('skill_key')}: {workflow.get('name')} - {workflow.get('description') or '无'}\n"
        employee_context += "\n"

    return employee_context


def _build_llm_http_exception(error: Exception) -> HTTPException:
    message = str(error)
    if "DeploymentNotFound" in message:
        deployment_name = os.getenv("AZURE_OPENAI_DEPLOYMENT") or os.getenv("LLM_MODEL") or "<unknown>"
        detail = (
            f"Azure OpenAI deployment not found: '{deployment_name}'. "
            "This backend sends the configured value as the Azure deployment name. "
            "If the model family itself is available but the deployment alias is different, set AZURE_OPENAI_DEPLOYMENT to the real deployed name and restart the backend."
        )
        return HTTPException(status_code=502, detail=detail)
    return HTTPException(status_code=500, detail=message)


@router.post("/answer_direct", response_model=ExecuteResponse)
async def answer_direct(request: DirectAnswerRequest, db: Session = Depends(database.get_db)):
    """
    Generates a final user-facing answer for direct-mode requests without exposing planner reasoning.
    """
    from .services.dispatcher_service import DispatcherService

    return await DispatcherService(db).answer_direct_response(
        chat_id=request.chat_id,
        user_message=request.user_message,
        employee_id=request.employee_id,
        automation_setup=request.automation_setup,
        upload_ids=request.upload_ids,
        full_access=request.full_access,
    )


@router.post("/answer_direct/runs", response_model=RuntimeRunResponse)
async def start_answer_direct_run(request: DirectAnswerRequest):
    import asyncio
    from starlette.concurrency import run_in_threadpool
    from .database import SessionLocal
    from .services.dispatcher_service import DispatcherService
    from .services.runtime_run_service import runtime_run_store
    from .services.runtime_run_service import (
        build_public_runtime_event,
        clear_runtime_event_callback,
        clear_runtime_approval_callback,
        runtime_run_store,
        set_runtime_approval_callback,
        set_runtime_event_callback,
    )

    run_id = runtime_run_store.create(
        request.chat_id,
        request_data=request.model_dump(),
    )

    def execute_run():
        runtime_run_store.update(
            run_id,
            status="running",
            event={"type": "run.started", "label": "开始执行 Codex", "created_at": datetime.now().isoformat()},
        )

        def on_event(event: dict, generated_files: list[str]):
            runtime_run_store.update(run_id, event=build_public_runtime_event(event, generated_files))

        def on_approval(request_id: str, method: str, params: dict):
            if request.full_access:
                runtime_run_store.update(run_id, status="running", event={
                    "type": "run.approval_resolved",
                    "label": "全部访问已自动批准，继续执行",
                    "approval_decision": "accept",
                    "created_at": datetime.now().isoformat(),
                })
                return "accept"
            runtime_run_store.register_approval(run_id, request_id, params)
            approval_event = build_public_runtime_event(
                {"type": method, "params": params}, []
            )
            approval_event.update({"request_id": request_id, "details": params})
            runtime_run_store.update(run_id, status="awaiting_approval", event=approval_event)
            approved = runtime_run_store.wait_for_approval(run_id, request_id, timeout=900)
            if approved is None:
                return "cancel"
            runtime_run_store.update(run_id, status="running", event={
                "type": "run.approval_resolved",
                "label": "审批结果：已批准，继续执行" if approved else "审批结果：已拒绝，取消执行",
                "approval_decision": "accept" if approved else "cancel",
                "created_at": datetime.now().isoformat(),
            })
            return "accept" if approved else "cancel"

        set_runtime_event_callback(on_event)
        set_runtime_approval_callback(on_approval)
        try:
            with SessionLocal() as run_db:
                result = DispatcherService(run_db)._answer_direct_response_sync(
                    request.chat_id,
                    request.user_message,
                    request.employee_id,
                    request.automation_setup,
                    request.upload_ids,
                    request.full_access,
                )
            runtime_run_store.update(
                run_id,
                status="completed",
                event={
                    "type": "run.completed",
                    "label": "已完成并整理结果",
                    "artifacts": [
                        {
                            "name": artifact.get("name") if isinstance(artifact, dict) else getattr(artifact, "name", None),
                            "format": artifact.get("format") if isinstance(artifact, dict) else getattr(artifact, "format", None),
                            "size_bytes": artifact.get("size_bytes") if isinstance(artifact, dict) else getattr(artifact, "size_bytes", None),
                            "relative_path": artifact.get("relative_path") if isinstance(artifact, dict) else getattr(artifact, "relative_path", None),
                        }
                        for artifact in result.artifacts or []
                    ],
                    "created_at": datetime.now().isoformat(),
                },
                result=result.model_dump(),
            )
        except Exception as error:
            runtime_run_store.update(
                run_id,
                status="failed",
                event={"type": "run.failed", "label": "执行失败", "created_at": datetime.now().isoformat()},
                error=str(error),
            )
        finally:
            clear_runtime_event_callback()
            clear_runtime_approval_callback()

    asyncio.create_task(run_in_threadpool(execute_run))

    return runtime_run_store.get(run_id)


@router.post("/answer_direct/runs/{run_id}/approval", response_model=RuntimeRunResponse)
async def approve_answer_direct_run(run_id: str, request: RuntimeRunApprovalRequest):
    from .services.runtime_run_service import runtime_run_store

    run = runtime_run_store.get(run_id)
    if run is None:
        raise HTTPException(status_code=404, detail="Runtime run not found")
    approval_events = [event for event in run.get("events", []) if event.get("request_id")]
    if not approval_events:
        raise HTTPException(status_code=409, detail="No Codex approval request is pending")
    request_id = approval_events[-1]["request_id"]
    if not runtime_run_store.resolve_approval(run_id, request_id, request.approved):
        raise HTTPException(status_code=409, detail="Codex approval request is no longer pending")
    return runtime_run_store.get(run_id)


@router.get("/answer_direct/runs/{run_id}", response_model=RuntimeRunResponse)
async def get_answer_direct_run(run_id: str):
    from .services.runtime_run_service import runtime_run_store

    run = runtime_run_store.get(run_id)
    if run is None:
        raise HTTPException(status_code=404, detail="Runtime run not found")
    return run


@router.post("/group_debate", response_model=GroupDebateResponse)
async def group_debate(request: GroupDebateRequest, db: Session = Depends(database.get_db)):
    try:
        debate_id = str(uuid4())
        hydrated_participants = _hydrate_debate_participants(request.participants, db) if request.participants else _load_group_participants(request.group_id, db)
        group = db.query(models.Group).filter(models.Group.id == request.group_id).first() if request.group_id else None
        group_name = request.group_name or (group.name if group is not None else None) or "未命名小组"
        round_count = max(1, min(request.round_count or 2, 5))

        if not hydrated_participants:
            raise HTTPException(status_code=400, detail="No available debate participants")

        selected_participants = _select_debate_participants(
            hydrated_participants,
            request.user_message,
            request.mentioned_member_ids,
            request.max_participants,
        )

        if len(selected_participants) < 2:
            selected_participants = hydrated_participants[: max(1, min(len(hydrated_participants), 2))]

        persisted_messages: List[GroupDebateMessage] = []
        debate_session = models.DebateSession(
            id=debate_id,
            chat_id=request.chat_id,
            group_id=request.group_id,
            topic=request.user_message,
            status="running",
            round_count=round_count,
            max_participants=request.max_participants,
            participant_ids=[participant["id"] for participant in selected_participants],
            mentioned_member_ids=request.mentioned_member_ids,
            result_summary=None,
        )
        db.add(debate_session)
        db.commit()
        db.refresh(debate_session)

        common_meta = {
            "is_group_chat": True,
            "group_id": request.group_id,
            "group_name": group_name,
            "conversation_mode": "debate",
            "debate_id": debate_id,
        }

        user_message = _persist_chat_message(
            db,
            chat_id=request.chat_id,
            sender_role="user",
            content=request.user_message,
            employee_id=None,
            message_type="text",
            meta_data={
                **common_meta,
                "participant_ids": [participant["id"] for participant in selected_participants],
                "mentioned_member_ids": request.mentioned_member_ids,
                "routing_mode": "mention" if request.mentioned_member_ids else "debate_auto",
                "sender_name": "你",
                "round_count": round_count,
            },
        )
        persisted_messages.append(_make_group_debate_response_message(user_message, "你"))

        selected_names = "、".join(participant["name"] for participant in selected_participants)
        router_message = _persist_chat_message(
            db,
            chat_id=request.chat_id,
            sender_role="assistant",
            content=f"已开启群内辩论模式，{selected_names} 将先陈述观点，再交叉补充，最后输出综合结论。",
            employee_id=None,
            message_type="group_router",
            meta_data={
                **common_meta,
                "sender_name": "系统",
                "debate_stage": "start",
            },
        )
        persisted_messages.append(_make_group_debate_response_message(router_message, "系统"))

        history_context = _build_debate_history_context(request.chat_id, request.group_id, db)
        all_round_statements = []
        previous_round_statements = []

        for round_index in range(1, round_count + 1):
            if round_index > 1:
                round_notice = _persist_chat_message(
                    db,
                    chat_id=request.chat_id,
                    sender_role="assistant",
                    content=_build_debate_round_notice(round_index),
                    employee_id=None,
                    message_type="group_router",
                    meta_data={
                        **common_meta,
                        "sender_name": "系统",
                        "debate_stage": f"round_{round_index}_notice",
                    },
                )
                persisted_messages.append(_make_group_debate_response_message(round_notice, "系统"))

            current_round_statements = []
            for participant in selected_participants:
                if round_index == 1:
                    participant_prompt = _build_debate_opening_prompt(
                        group_name,
                        participant,
                        selected_participants,
                        request.user_message,
                        history_context,
                    )
                    debate_stage = "opening"
                else:
                    participant_prompt = _build_debate_rebuttal_prompt(
                        group_name,
                        participant,
                        request.user_message,
                        previous_round_statements,
                    )
                    debate_stage = f"round_{round_index}"

                reply_text = _run_direct_agent(
                    _build_direct_response_prompt(
                        _build_participant_employee_context(participant),
                        participant_prompt,
                        participant_prompt,
                    ),
                    request.chat_id,
                )
                db_message = _persist_chat_message(
                    db,
                    chat_id=request.chat_id,
                    sender_role="assistant",
                    content=reply_text,
                    employee_id=participant["id"],
                    message_type="group_debate_round",
                    meta_data={
                        **common_meta,
                        "sender_name": participant["name"],
                        "debate_stage": debate_stage,
                        "round_index": round_index,
                    },
                )
                persisted_messages.append(_make_group_debate_response_message(db_message, participant["name"]))
                current_round_statements.append({"participant": participant, "content": reply_text})

            all_round_statements.extend(current_round_statements)
            previous_round_statements = current_round_statements

        facilitator = max(
            selected_participants,
            key=lambda participant: _score_debate_participant(participant, request.user_message),
        )
        transcript = "\n".join(
            [f"{entry['participant']['name']}：{entry['content']}" for entry in all_round_statements]
        )
        summary_prompt = _build_debate_summary_prompt(group_name, request.user_message, transcript)
        summary_text = _run_direct_agent(
            _build_direct_response_prompt(
                _build_participant_employee_context(facilitator),
                summary_prompt,
                summary_prompt,
            ),
            request.chat_id,
        )
        summary_message = _persist_chat_message(
            db,
            chat_id=request.chat_id,
            sender_role="assistant",
            content=summary_text,
            employee_id=None,
            message_type="group_debate_summary",
            meta_data={
                **common_meta,
                "sender_name": "主持总结",
                "debate_stage": "summary",
                "facilitator_id": facilitator["id"],
            },
        )
        persisted_messages.append(_make_group_debate_response_message(summary_message, "主持总结"))

        debate_session.status = "completed"
        debate_session.result_summary = summary_text
        debate_session.round_count = round_count
        debate_session.updated_at = datetime.now()
        db.add(debate_session)
        db.commit()

        return GroupDebateResponse(
            status="completed",
            result=summary_text,
            debate_id=debate_id,
            messages=persisted_messages,
        )
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise _build_llm_http_exception(e)


def _resolve_group_collaboration_participants(
    group_id: str,
    participants: List[DebateParticipant],
    mentioned_member_ids: List[int],
    user_message: str,
    max_participants: int,
    db: Session,
) -> List[dict]:
    hydrated_participants = _hydrate_group_participants(participants, db) if participants else _load_group_participants(group_id, db)
    hydrated_participants = _enrich_participant_payload(hydrated_participants, db)
    if not hydrated_participants:
        return []

    selected_participants = _select_collaboration_participants(
        hydrated_participants,
        user_message,
        mentioned_member_ids,
        max_participants,
    )
    if len(selected_participants) < 2:
        fallback_limit = max(1, min(len(hydrated_participants), 2))
        selected_participants = hydrated_participants[:fallback_limit]
    return selected_participants


def _execute_group_collaboration(
    *,
    chat_id: int,
    group_id: str,
    group_name: str,
    user_message: str,
    plan_steps: List[dict],
    participants: List[dict],
    collaboration_id: str,
    db: Session,
    include_user_message: bool = False,
) -> GroupCollaborationResponse:
    persisted_messages: List[GroupDebateMessage] = []
    common_meta = {
        "is_group_chat": True,
        "group_id": group_id,
        "group_name": group_name,
        "conversation_mode": "collaboration",
        "collaboration_id": collaboration_id,
    }

    if include_user_message:
        user_db_message = _persist_chat_message(
            db,
            chat_id=chat_id,
            sender_role="user",
            content=user_message,
            employee_id=None,
            message_type="text",
            meta_data={
                **common_meta,
                "participant_ids": [participant["id"] for participant in participants],
                "sender_name": "你",
            },
        )
        persisted_messages.append(_make_group_response_message(user_db_message, "你"))

    execution_notice = _persist_chat_message(
        db,
        chat_id=chat_id,
        sender_role="assistant",
        content="合作计划已批准，开始按顺序执行各成员步骤。",
        employee_id=None,
        message_type="group_router",
        meta_data={
            **common_meta,
            "sender_name": "系统",
            "collaboration_stage": "execution_started",
            "participant_ids": [participant["id"] for participant in participants],
        },
    )
    persisted_messages.append(_make_group_response_message(execution_notice, "系统"))

    history_context = _build_group_history_context(chat_id, group_id, db)
    participant_map = {participant["id"]: participant for participant in participants}
    previous_output = ""
    previous_participant: Optional[dict] = None
    final_result = ""

    for step_index, step in enumerate(plan_steps):
        participant = participant_map.get(step.get("assigned_employee_id"))
        if participant is None:
            raise HTTPException(status_code=400, detail=f"Plan step {step_index + 1} missing valid assigned employee")

        responsibility = str(step.get("description") or _build_collaboration_responsibility(participant, step_index, len(plan_steps))).strip()

        if step_index > 0 and previous_participant is not None:
            handoff_message = _persist_chat_message(
                db,
                chat_id=chat_id,
                sender_role="assistant",
                content=f"已将 {previous_participant['name']} 的结果交接给 {participant['name']}，继续第 {step_index + 1} 棒协作。",
                employee_id=None,
                message_type="group_router",
                meta_data={
                    **common_meta,
                    "sender_name": "系统",
                    "collaboration_stage": "handoff",
                    "source_member_id": previous_participant["id"],
                    "target_member_id": participant["id"],
                    "collaboration_step_index": step_index,
                    "collaboration_step_total": len(plan_steps),
                },
            )
            persisted_messages.append(_make_group_response_message(handoff_message, "系统"))

        collaboration_prompt = _build_collaboration_step_prompt(
            group_name,
            participant,
            participants,
            user_message,
            history_context,
            responsibility,
            step_index,
            len(plan_steps),
            previous_output,
            previous_participant,
        )
        reply_text, _knowledge_hits, _generated_files = _answer_direct_for_employee(chat_id, collaboration_prompt, participant["id"], db)
        stage = "final" if step_index == len(plan_steps) - 1 else "handoff"
        db_message = _persist_chat_message(
            db,
            chat_id=chat_id,
            sender_role="assistant",
            content=reply_text,
            employee_id=participant["id"],
            message_type="group_collaboration_summary" if stage == "final" else "group_collaboration_step",
            meta_data={
                **common_meta,
                "sender_name": participant["name"],
                "collaboration_stage": stage,
                "collaboration_step_index": step_index,
                "collaboration_step_total": len(plan_steps),
                "collaboration_responsibility": responsibility,
                "source_member_id": previous_participant["id"] if previous_participant else None,
                "source_member_name": previous_participant["name"] if previous_participant else None,
                "handoff_summary": _summarize_handoff_text(reply_text),
                "plan_step_id": step.get("id"),
                "plan_step_title": step.get("title"),
            },
        )
        persisted_messages.append(_make_group_response_message(db_message, participant["name"]))
        previous_output = reply_text
        previous_participant = participant
        final_result = reply_text

    return GroupCollaborationResponse(
        status="completed",
        result=final_result,
        collaboration_id=collaboration_id,
        messages=persisted_messages,
        participant_ids=[participant["id"] for participant in participants],
    )


@router.post("/group_collaboration", response_model=GroupCollaborationResponse)
async def group_collaboration(request: GroupCollaborationRequest, db: Session = Depends(database.get_db)):
    try:
        collaboration_id = str(uuid4())
        group = db.query(models.Group).filter(models.Group.id == request.group_id).first() if request.group_id else None
        group_name = request.group_name or (group.name if group is not None else None) or "未命名小组"
        selected_participants = _resolve_group_collaboration_participants(
            request.group_id,
            request.participants,
            request.mentioned_member_ids,
            request.user_message,
            request.max_participants,
            db,
        )
        if len(selected_participants) < 2:
            raise HTTPException(status_code=400, detail="Collaboration mode requires at least two participants")
        plan_steps = _build_group_collaboration_plan_steps(selected_participants, request.user_message)
        return _execute_group_collaboration(
            chat_id=request.chat_id,
            group_id=request.group_id,
            group_name=group_name,
            user_message=request.user_message,
            plan_steps=plan_steps,
            participants=selected_participants,
            collaboration_id=collaboration_id,
            db=db,
            include_user_message=True,
        )
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise _build_llm_http_exception(e)


@router.get("/debates", response_model=DebateSessionListResponse)
async def list_debate_sessions(group_id: Optional[str] = None, chat_id: Optional[int] = None, db: Session = Depends(database.get_db)):
    query = db.query(models.DebateSession).outerjoin(models.Group, models.DebateSession.group_id == models.Group.id)
    if group_id:
        query = query.filter(models.DebateSession.group_id == group_id)
    if chat_id is not None:
        query = query.filter(models.DebateSession.chat_id == chat_id)

    items = query.order_by(models.DebateSession.updated_at.desc(), models.DebateSession.created_at.desc()).all()
    return DebateSessionListResponse(items=[_serialize_debate_session(item) for item in items])


@router.get("/debates/{debate_id}", response_model=DebateSessionDetailResponse)
async def get_debate_session(debate_id: str, db: Session = Depends(database.get_db)):
    session = (
        db.query(models.DebateSession)
        .outerjoin(models.Group, models.DebateSession.group_id == models.Group.id)
        .filter(models.DebateSession.id == debate_id)
        .first()
    )
    if session is None:
        raise HTTPException(status_code=404, detail="Debate session not found")

    summary = _serialize_debate_session(session)
    detail = schemas.DebateSessionDetail(
        **summary.dict(),
        messages=_load_debate_messages(session, db),
    )
    return DebateSessionDetailResponse(item=detail)

class StepExecutionRequest(BaseModel):
    chat_id: int
    step_content: str
    user_feedback: str = ""
    step_index: Optional[int] = None
    plan_step: Optional[dict] = None
    plan_context: Optional[dict] = None
    full_access: bool = False


def _resolve_selected_skill(plan_step: Optional[dict], db: Session) -> Optional[dict]:
    if not isinstance(plan_step, dict):
        return None

    selected_skill_key = plan_step.get("selected_skill_key") or plan_step.get("skill_key")
    if not selected_skill_key:
        return None
    if str(selected_skill_key).strip() == ARTIFACT_RENDERER_SKILL_KEY:
        return None

    return get_skill(selected_skill_key, db)


def _is_render_delivery_step(plan_step: Optional[dict]) -> bool:
    if not isinstance(plan_step, dict):
        return False

    selected_skill_key = str(plan_step.get("selected_skill_key") or plan_step.get("skill_key") or "").strip().lower()
    selected_skill_type = str(plan_step.get("selected_skill_type") or "").strip().lower()
    return selected_skill_key == ARTIFACT_RENDERER_SKILL_KEY or selected_skill_type == "renderer"


def _build_render_step_result(artifacts: list[dict], user_request: str) -> str:
    if not artifacts:
        return "未生成交付文件，请检查前序步骤是否已产出可复用内容。"

    return _build_user_facing_result_text("", artifacts)


def _step_requires_real_action(plan_step: Optional[dict], step_content: str) -> bool:
    if isinstance(plan_step, dict):
        selected_skill_type = str(plan_step.get("selected_skill_type") or "").lower()
        if selected_skill_type == "workflow":
            return False

        raw_text = re.sub(
            r"\s+",
            " ",
            f"{plan_step.get('title') or ''} {plan_step.get('description') or ''} {step_content or ''}".strip(),
        ).lower()
    else:
        raw_text = (step_content or "").lower()

    return any(keyword in raw_text for keyword in ACTION_VERB_KEYWORDS) and any(
        hint in raw_text for hint in ACTION_TARGET_HINTS
    )


def _is_final_plan_step(step_index: Optional[int], plan_context: Optional[dict]) -> bool:
    if not isinstance(plan_context, dict):
        return False

    plan_steps = plan_context.get("plan_steps")
    if not isinstance(plan_steps, list) or not plan_steps:
        return False

    if step_index is None:
        return False

    total_steps = len(plan_steps)
    return step_index == total_steps


def _format_selected_skill_prompt(selected_skill: Optional[dict]) -> str:
    if not selected_skill:
        return ""

    parts = [
        "SELECTED SKILL FOR THIS STEP:",
        f"- skill_key: {selected_skill.get('skill_key')}",
        f"- name: {selected_skill.get('name')}",
        f"- type: {selected_skill.get('skill_type')}",
    ]

    description = (selected_skill.get("description") or "").strip()
    instructions = (selected_skill.get("instructions") or "").strip()
    if description:
        parts.append(f"- description: {description}")
    if instructions:
        parts.append("- instructions:")
        parts.append(instructions)

    return "\n".join(parts)


def _format_selected_skill_execution_rules(selected_skill: Optional[dict]) -> str:
    if not selected_skill:
        return ""

    skill_key = str(selected_skill.get("skill_key") or "").strip().lower()
    if skill_key != "tavily_search":
        return ""

    return (
        "TAVILY SEARCH EXECUTION RULES:\n"
        "- You MUST call the Tavily search tool before answering.\n"
        "- If the Tavily response contains any non-empty results, do NOT say '未检索到' or imply there were no search results.\n"
        "- Distinguish between '没有搜索结果' and '搜索到了结果，但权威性有限/尚未被官方确认'.\n"
        "- Summarize what the returned URLs actually say, and mention at least 2 concrete source domains or titles when results exist.\n"
        "- If the returned results are mostly community posts, blogs, videos, or secondary analysis, say that explicitly instead of collapsing to '没有结果'.\n"
        "- Only state that no reliable evidence exists if you searched and the available results are low-confidence or unverified; do not convert that into '未检索到'.\n"
    )


def _determine_execution_focus(selected_skill: Optional[dict], step_content: str) -> Optional[str]:
    return None


def _requires_substantive_step_output(*texts: str) -> bool:
    keywords = (
        "研究", "调研", "分析", "报告", "总结", "梳理", "市场", "行业", "策略", "洞察", "评估", "对比", "方案", "提纲",
        "research", "analysis", "report", "summary", "outline", "insight", "market", "strategy",
    )
    haystack = "\n".join(str(text or "") for text in texts).lower()
    return any(keyword.lower() in haystack for keyword in keywords)


def _format_substantive_step_output_rules(*texts: str) -> str:
    if not _requires_substantive_step_output(*texts):
        return ""

    return """
- This step must produce substantive reusable content, not just a brief execution receipt.
- Include enough detailed findings, evidence, comparisons, and intermediate conclusions so later steps can directly build on this output.
- For research or analysis steps, include concrete data points, source names, assumptions, and implications when available.
- For outline, draft, or report steps, provide a real working draft with clear sections and sufficient detail for final assembly.
- Do NOT compress the answer to 1-2 sentences if the task is analytical, research-heavy, or report-oriented.
"""


def _format_plan_context_prompt(plan_context: Optional[dict], user_request: str = "") -> str:
    if not isinstance(plan_context, dict):
        return ""

    step_outputs = plan_context.get("step_outputs") or {}
    if not step_outputs:
        return ""

    serialized = build_step_context_summary_for_prompt(step_outputs)
    if not serialized:
        return ""

    request_text = (user_request or plan_context.get("user_message") or "").strip()
    renderer_note = ""
    if detect_requested_output_formats(request_text):
        renderer_note = (
            "\nNote: The full step outputs and intermediate artifacts are still preserved in system state "
            "for the final file renderer. Only the concise reusable summaries are shown here to avoid context overflow.\n"
        )

    return f"PREVIOUS STEP OUTPUTS:\n{serialized}\n{renderer_note}"


def _format_runtime_datetime_prompt() -> str:
    now = datetime.now()
    return (
        "CURRENT LOCAL DATETIME CONTEXT:\n"
        f"- current_date: {now.strftime('%Y-%m-%d')}\n"
        f"- current_time: {now.strftime('%H:%M:%S')}\n"
        "- timezone: Asia/Shanghai (+08:00)\n"
    )


def _serialize_step_artifact_content(value) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value.replace("TERMINATE", "").strip()
    try:
        return json.dumps(value, ensure_ascii=False, indent=2).strip()
    except TypeError:
        return str(value).strip()


def _build_step_artifact_detail_text(step_name: str, result_text: str, messages: list[dict]) -> str:
    cleaned_result = _extract_summary_content(result_text or "")
    return cleaned_result or step_name


def _looks_like_raw_deliverable_content(text: str) -> bool:
    normalized = (text or "").strip()
    if not normalized:
        return False

    lowered = normalized.lower()
    if any(token in lowered for token in ["<!doctype html", "<html", "<body", "<section", "<header", "<footer"]):
        return True

    if normalized.count("\n## ") >= 2 and len(normalized) > 800:
        return True

    return False


def _build_user_facing_result_text(result_text: str, artifacts: list[dict]) -> str:
    cleaned_result = format_summary_for_display(result_text or "")
    if not artifacts:
        return cleaned_result

    artifact_formats: list[str] = []
    for artifact in artifacts:
        if hasattr(artifact, "format"):
            artifact_format = str(getattr(artifact, "format") or "").strip().lower()
        elif isinstance(artifact, dict):
            artifact_format = str(artifact.get("format") or "").strip().lower()
        else:
            artifact_format = ""
        if artifact_format:
            artifact_formats.append(artifact_format)

    should_collapse_to_notice = _looks_like_raw_deliverable_content(result_text or "") or any(
        artifact_format in {"html", "pdf", "ppt", "pptx"}
        for artifact_format in artifact_formats
    )

    if not should_collapse_to_notice:
        return cleaned_result

    artifact_names: list[str] = []
    for artifact in artifacts:
        if hasattr(artifact, "name"):
            name = str(getattr(artifact, "name") or "").strip()
        elif isinstance(artifact, dict):
            name = str(artifact.get("name") or artifact.get("title") or "").strip()
        else:
            name = ""
        if name:
            artifact_names.append(name)

    unique_names = list(dict.fromkeys(artifact_names))
    if len(unique_names) == 1:
        return f"已生成文件《{unique_names[0]}》，请在 Workspace 查看。"
    if len(unique_names) > 1:
        return f"已生成 {len(unique_names)} 个文件，请在 Workspace 查看。"
    return "已生成交付文件，请在 Workspace 查看。"


def _extract_tool_written_artifacts(messages: list[dict], user_request: str) -> list[dict]:
    artifact_map: dict[str, dict] = {}

    for message in messages or []:
        tool_calls = message.get("tool_calls") or []
        for tool_call in tool_calls:
            function_payload = tool_call.get("function") or {}
            if function_payload.get("name") != "write_file":
                continue

            arguments = function_payload.get("arguments")
            try:
                parsed_arguments = json.loads(arguments) if isinstance(arguments, str) else (arguments or {})
            except json.JSONDecodeError:
                parsed_arguments = {}

            file_path = parsed_arguments.get("file_path")
            content = parsed_arguments.get("content") or ""
            artifact = build_artifact_metadata_from_file_path(file_path, preview_text=content)
            if artifact:
                artifact_map[artifact["relative_path"]] = artifact

        content = message.get("content")
        if isinstance(content, str):
            match = re.search(r"Successfully wrote to\s+(.+)$", content.strip())
            if match:
                file_path = match.group(1).strip()
                artifact = build_artifact_metadata_from_file_path(file_path)
                if artifact:
                    artifact_map[artifact["relative_path"]] = artifact

    return list(artifact_map.values())


def _build_runtime_generated_artifacts(generated_files: list[str], user_request: str) -> list[dict]:
    requested_formats = set(detect_requested_output_formats(user_request))
    artifact_map: dict[str, dict] = {}
    for file_path in generated_files or []:
        suffix = Path(file_path).suffix.lower()
        if suffix.lstrip(".") not in {"html", "md", "markdown", "txt", "json", "csv", "pdf", "pptx", "xlsx", "jpg", "jpeg"}:
            continue
        if suffix == ".pptx" and not is_valid_native_pptx(file_path):
            continue
        if suffix == ".xlsx" and not is_valid_native_xlsx(file_path):
            continue
        if suffix == ".pdf" and not is_valid_native_pdf(file_path):
            continue
        artifact = build_artifact_metadata_from_file_path(file_path)
        if not artifact:
            continue
        artifact_format = str(artifact.get("format") or "").lower()
        if requested_formats and artifact_format not in requested_formats:
            continue
        artifact_map[artifact["relative_path"]] = artifact
    return list(artifact_map.values())


def _collect_prior_plan_artifacts(plan_context: Optional[dict], user_request: str) -> list[dict]:
    if not isinstance(plan_context, dict):
        return []

    requested_formats = set(detect_requested_output_formats(user_request))
    step_outputs = plan_context.get("step_outputs") or {}
    artifact_map: dict[str, dict] = {}
    for entry in step_outputs.values():
        if not isinstance(entry, dict):
            continue
        for artifact in entry.get("artifacts") or []:
            relative_path = str(artifact.get("relative_path") or "").strip()
            artifact_format = str(artifact.get("format") or "").lower()
            if not relative_path:
                continue
            if requested_formats and artifact_format and artifact_format not in requested_formats:
                continue
            artifact_map[relative_path] = artifact

    if artifact_map:
        return list(artifact_map.values())

    for entry in reversed(list(step_outputs.values())):
        if not isinstance(entry, dict):
            continue

        source_text = str(entry.get("result") or entry.get("summary") or "").strip()
        if not source_text:
            continue

        for artifact_format in requested_formats:
            embedded_content = extract_embedded_artifact_content(source_text, artifact_format)
            if not embedded_content:
                continue

            artifact = create_artifact_from_content(
                artifact_format=artifact_format,
                content=embedded_content,
                user_request=user_request,
            )
            if artifact:
                artifact_map[artifact["relative_path"]] = artifact

        if artifact_map:
            break

    return list(artifact_map.values())

@router.post("/execute_step", response_model=ExecuteResponse)
async def execute_step(request: StepExecutionRequest, db: Session = Depends(database.get_db)):
    """
    Executes a single step of the plan.
    """
    try:
        original_user_request = (request.plan_context or {}).get("user_message") or request.step_content
        if _is_render_delivery_step(request.plan_step):
            step_outputs = (request.plan_context or {}).get("step_outputs") or {}
            artifacts = render_requested_deliverables(
                step_outputs=step_outputs,
                current_step_result="",
                user_request=original_user_request,
            )
            return ExecuteResponse(
                status="completed",
                result=_build_render_step_result(artifacts, original_user_request),
                workflow_run=None,
                artifacts=artifacts,
            )

        employee_id = _resolve_employee_id_for_chat(request.chat_id, db)
        selected_skill = _resolve_selected_skill(request.plan_step, db)

        if _step_requires_real_action(request.plan_step, request.step_content):
            if not selected_skill or str(selected_skill.get("skill_type") or "").lower() not in {"mcp", "workflow"}:
                return ExecuteResponse(
                    status="action_required",
                    result="执行结果：当前步骤属于需要真实外部执行的动作，但当前场景未匹配到可执行的技能，因此尚未实际执行。\n\n关键信息：\n1. 该步骤需要调用具备真实写入能力的技能，例如钉钉相关 MCP 技能\n2. 当前计划未为此步骤选中可执行技能\n\n下一步：\n请重新规划该步骤并明确选择合适的技能后再执行。",
                    workflow_run=None,
                )

        if selected_skill and selected_skill.get("skill_type") == "workflow":
            workflow_run = start_workflow_run(
                chat_id=request.chat_id,
                employee_id=employee_id,
                workflow_skill_key=selected_skill["skill_key"],
                user_message=request.step_content,
                db=db,
                initial_context_data={
                    "parent_plan_step_index": request.step_index,
                    "parent_plan_step": request.plan_step,
                    "parent_step_content": request.step_content,
                    "parent_plan_context": request.plan_context or {},
                },
            )

            workflow_name = workflow_run.get("workflow_name") or selected_skill.get("name") or selected_skill["skill_key"]
            if workflow_run.get("status") == "paused":
                return ExecuteResponse(
                    status="workflow_paused",
                    result=f"步骤已切换到工作流“{workflow_name}”，当前在暂停点等待处理。",
                    workflow_run=workflow_run,
                    artifacts=[],
                )

            summary = ""
            outputs = ((workflow_run.get("context_data") or {}).get("step_outputs") or {}).values()
            for entry in reversed(list(outputs)):
                if isinstance(entry, dict) and isinstance(entry.get("result"), str) and entry.get("result").strip():
                    summary = entry["result"].strip()
                    break
                if isinstance(entry, dict) and isinstance(entry.get("summary"), str) and entry.get("summary").strip():
                    summary = entry["summary"].strip()
                    break

            return ExecuteResponse(
                status="workflow_completed",
                result=summary or f"步骤已通过工作流“{workflow_name}”执行完成。",
                workflow_run=workflow_run,
                artifacts=[],
            )

        tool_ids = []
        employee = None
        if employee_id:
            employee = db.query(models.AIEmployee).filter(models.AIEmployee.id == employee_id).first()
            if employee and employee.tool_ids:
                tool_ids = employee.tool_ids

        if isinstance(request.plan_step, dict):
            selected_skill_key = str(request.plan_step.get("selected_skill_key") or "").strip()
            if selected_skill_key and selected_skill_key not in tool_ids:
                tool_ids.append(selected_skill_key)

            for candidate_skill_key in (request.plan_step.get("candidate_skill_keys") or []):
                normalized_candidate_skill_key = str(candidate_skill_key or "").strip()
                if normalized_candidate_skill_key and normalized_candidate_skill_key not in tool_ids:
                    tool_ids.append(normalized_candidate_skill_key)

        # Construct the prompt for the single Codex runtime turn.
        if request.user_feedback:
            prompt = f"""
The user has provided feedback on the previous result:
"{request.user_feedback}"

Please adjust the execution of the current step based on this feedback.
Step: {request.step_content}

{_format_selected_skill_prompt(selected_skill)}

{_format_plan_context_prompt(request.plan_context, original_user_request)}

{ _format_runtime_datetime_prompt() }

{_format_selected_skill_execution_rules(selected_skill)}

{_format_substantive_step_output_rules(request.step_content, original_user_request, str(request.plan_step or ""))}

"""
        else:
            prompt = f"""
CONTEXT: You are executing a multi-step plan.
PREVIOUS STEPS: Use the structured previous step outputs provided below.
CURRENT STEP: {request.step_content}

{_format_selected_skill_prompt(selected_skill)}

{_format_plan_context_prompt(request.plan_context, original_user_request)}

{_format_runtime_datetime_prompt()}

{_format_substantive_step_output_rules(request.step_content, original_user_request, str(request.plan_step or ""))}

INSTRUCTIONS:
- Use the information, files, or structures created in previous steps.
- This is an execution step, not a fresh planning round.
- Do NOT redesign the report framework or decompose new task lists unless the current step explicitly asks for that.
- Execute directly with the runtime execution agent and the available real tools/workflows.
- If a selected skill is provided and it is a tool-execution step, call the relevant tool path first and then provide the final answer.
- Only use a DingTalk `userid` after `searchUser` has returned it explicitly in the tool result. Do not assume a login name, nickname, employee code, or display name is a valid DingTalk internal userId.
- Do NOT call `getUserIdByUnionId` or `getUserIdByMobile` on a value returned by `searchUser`. The unique `searchUser` result is already the usable `userid`.
- IMPORTANT: For `createEvent` (calendar) API, never call the tool until `searchUser` has successfully resolved each attendee to a real DingTalk internal userId. Do not pass a display name, login ID, employee code, phone label, or guessed identifier such as `manager7295`.
- For relative scheduling expressions such as `今天`、`明天`、`后天`、`本周五`、`下周一下午2点`, use the CURRENT LOCAL DATETIME CONTEXT above as the source of truth. Do NOT call DingTalk `currentDateTime` unless the user explicitly asks for DingTalk server time.
- For relative time expressions such as `近3天` or `近7天`, use the `get_time_range_in_ms` tool instead of calculating Unix timestamps manually.
- Do NOT expose raw tool payloads, Python dictionaries, JSON blobs, internal coordination logs, or placeholders such as None to the user.
- Before finishing, provide one final clean Chinese summary in plain text.
- Do NOT use Markdown markers such as #, ##, ###, ####, **, -, *, or code fences in the final user-facing answer.
- Prefer this plain text structure when applicable:
    执行结果：
    先概括本步骤完成了什么，再给出足够支撑后续步骤的详细内容

    关键信息：
    1. 第一条关键信息
    2. 第二条关键信息

    下一步：
    如果后续步骤需要依赖本结果，说明接下来做什么
"""

        runtime_result = codex_runtime.run(
            prompt=prompt,
            model_config=(
                (get_employee_llm_config(employee, db).get("config_list") or [{}])[0]
                if employee else None
            ),
            db=db,
            tool_ids=tool_ids,
            full_access=request.full_access,
        )
        result_text = runtime_result.text
        new_messages = [{"name": "ExecutionAgent", "content": result_text}]
        if not request.user_feedback and _execution_result_requires_user_input(result_text):
            return ExecuteResponse(
                status="action_required",
                result=result_text,
                workflow_run=None,
                artifacts=[],
            )

        artifacts = _build_runtime_generated_artifacts(runtime_result.generated_files, original_user_request)
        requested_formats = set(detect_requested_output_formats(original_user_request))
        returned_formats = {str(artifact.get("format") or "").lower() for artifact in artifacts}
        if "pptx" in requested_formats and "pptx" not in returned_formats:
            raise RuntimeError(
                "Codex did not create a valid native PPTX in DES_ARTIFACT_DIR. "
                "Workflow execution will not replace it with an HTML or text-based fallback."
            )
        # 1. Check for MCP tool-written artifacts when the harness did not write one directly.
        if not artifacts:
            tool_written_artifacts = _extract_tool_written_artifacts(new_messages, original_user_request)
            if tool_written_artifacts:
                artifacts = tool_written_artifacts

        # 2. Multi-step plan: intermediate steps → .md, final step → aggregated file
        is_multi_step_plan = (
            isinstance(request.plan_context, dict)
            and isinstance(request.plan_context.get("plan_steps"), list)
            and len(request.plan_context["plan_steps"]) > 1
        )

        if is_multi_step_plan and not artifacts:
            is_final = _is_final_plan_step(request.step_index, request.plan_context)
            if is_final:
                step_outputs = (request.plan_context or {}).get("step_outputs") or {}
                artifacts = aggregate_step_results_for_final(
                    step_outputs=step_outputs,
                    current_step_result=result_text,
                    user_request=original_user_request,
                )
            else:
                detailed_step_text = _build_step_artifact_detail_text(
                    request.step_content,
                    result_text,
                    new_messages,
                )
                step_md = create_step_result_md_artifact(
                    step_index=request.step_index or 0,
                    step_name=request.step_content,
                    result_text=result_text,
                    detailed_text=detailed_step_text,
                    user_request=original_user_request,
                )
                if step_md:
                    artifacts = [step_md]

        # 3. Single-step / non-plan fallback
        if not is_multi_step_plan and not artifacts:
            allow_step_artifacts = should_create_step_artifacts(
                user_request=original_user_request,
                step_content=request.step_content,
            )
            if allow_step_artifacts:
                artifact_request = (
                    request.step_content
                    if detect_requested_output_formats(request.step_content)
                    else original_user_request
                )
                artifacts = create_artifacts_for_response(
                    user_request=artifact_request,
                    response_text=result_text,
                )

        return ExecuteResponse(
            status="completed", 
            result=_build_user_facing_result_text(result_text, artifacts),
            workflow_run=None,
            artifacts=artifacts,
        )

    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/confirm_step")
async def confirm_step(step_index: int, chat_id: int, approved: bool, db: Session = Depends(database.get_db)):
    paused_run = (
        db.query(models.WorkflowRun)
        .filter(
            models.WorkflowRun.chat_id == chat_id,
            models.WorkflowRun.status == "paused",
            models.WorkflowRun.pause_reason == "awaiting_feedback",
            models.WorkflowRun.current_step_index == step_index,
        )
        .order_by(models.WorkflowRun.updated_at.desc(), models.WorkflowRun.id.desc())
        .first()
    )

    if paused_run is None:
        raise HTTPException(status_code=404, detail="No paused workflow step found for this chat and step index")

    try:
        workflow_run = resume_workflow_run(
            run_id=paused_run.id,
            user_input="",
            approved=approved,
            feedback="",
            db=db,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise _build_llm_http_exception(exc)

    current_step = workflow_run.get("current_step") or {}
    return {
        "status": "confirmed" if approved else "rejected",
        "workflow_run": workflow_run,
        "workflow_run_id": workflow_run.get("id"),
        "workflow_status": workflow_run.get("status"),
        "current_step_index": current_step.get("step_index") or workflow_run.get("current_step_index"),
    }
