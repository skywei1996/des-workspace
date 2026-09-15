import os
import json
import re
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any, Optional

from sqlalchemy.orm import Session

from .. import models, schemas
from ..config import get_chat_model_name
from ..routers.employees import _build_recommendation_reason, _score_employee_recommendation
from ..routers.tasks import _build_task_payload, _generate_prefixed_id, _guard_duplicate_submission, _validate_employee_capability
from .skill_generator import _build_llm_client, _extract_json_object


AUTOMATION_TRIGGER_TOKENS = ["提醒", "定时", "自动", "周期", "每周", "每天", "每月", "明天", "后天"]
AUTOMATION_DELETE_TOKENS = ["删除", "删掉", "移除"]
AUTOMATION_DELETE_CONFIRM_PHRASES = {"确认删除", "确认", "删除吧", "删吧", "是", "好的", "好", "可以"}
AUTOMATION_DELETE_CANCEL_PHRASES = {"取消", "不删了", "先不删", "不用了", "算了"}
AUTOMATION_DELETE_CONFIRM_PROMPT_PATTERN = re.compile(r"是否确认删除自动化任务《(?P<task_name>.+?)》？")
TIME_OF_DAY_PATTERN = r"(?:凌晨|早上|上午|中午|下午|傍晚|晚上)?"
CLOCK_PATTERN = r"(\d{1,2})(?:\s*(?::|点|时)\s*(\d{1,2})?)?(?:\s*分)?"
WEEKDAY_TEXT_MAP = {
    "一": "MON",
    "二": "TUE",
    "三": "WED",
    "四": "THU",
    "五": "FRI",
    "六": "SAT",
    "日": "SUN",
    "天": "SUN",
}
AUTOMATION_STAGE_COLLECTING_CONTENT = "collecting_content"
AUTOMATION_STAGE_COLLECTING_SCHEDULE = "collecting_schedule"
AUTOMATION_STAGE_COLLECTING_EMPLOYEE = "collecting_employee"
AUTOMATION_STAGE_AWAITING_CONFIRMATION = "awaiting_confirmation"
AUTOMATION_STAGE_COMPLETED = "completed"
AUTOMATION_STAGE_CANCELLED = "cancelled"


@dataclass
class AutomationChatOutcome:
    mode: str
    text: str
    employee_id: Optional[int] = None
    automation_draft: Optional[dict[str, Any]] = None


def looks_like_automation_task_request(user_message: str) -> bool:
    normalized = str(user_message or "").strip()
    return bool(normalized) and (
        any(token in normalized for token in AUTOMATION_TRIGGER_TOKENS)
        or any(token in normalized for token in AUTOMATION_DELETE_TOKENS)
    )


def has_pending_automation_confirmation(*, db: Session, chat_id: int) -> bool:
    return _get_pending_delete_confirmation_task(db, chat_id) is not None


def has_pending_automation_task_context(*, db: Session, chat_id: int) -> bool:
    last_assistant_message = (
        db.query(models.ChatMessage)
        .filter(models.ChatMessage.chat_id == chat_id, models.ChatMessage.sender_role == "assistant")
        .order_by(models.ChatMessage.created_at.desc(), models.ChatMessage.id.desc())
        .first()
    )
    if last_assistant_message is None:
        return False

    meta_data = last_assistant_message.meta_data or {}
    automation_draft = meta_data.get("automation_draft") if isinstance(meta_data, dict) else None
    if isinstance(automation_draft, dict) and automation_draft.get("active"):
        return True

    content = str(last_assistant_message.content or "")
    pending_prompts = [
        "还缺少明确的周期或执行时间",
        "执行时间还不完整",
        "执行时间表达还不够精确",
        "还缺少明确的任务内容",
    ]
    return any(prompt in content for prompt in pending_prompts)


def handle_automation_task_chat_turn(*, db: Session, request: schemas.AgentTurnRequest) -> AutomationChatOutcome:
    pending_delete_task = _get_pending_delete_confirmation_task(db, request.chat_id)
    if pending_delete_task is not None:
        decision = _parse_delete_confirmation_decision(request.user_message)
        if decision == "confirm":
            pending_delete_task.task_status = "已删除"
            pending_delete_task.next_execute_time = None
            db.commit()
            return AutomationChatOutcome(
                mode="direct_answer",
                text=f"自动化任务《{pending_delete_task.task_name}》已删除，后续将不再继续执行。",
                employee_id=request.employee_id,
            )
        if decision == "cancel":
            return AutomationChatOutcome(
                mode="direct_answer",
                text=f"已取消删除《{pending_delete_task.task_name}》。该自动化任务会继续按原计划执行。",
                employee_id=request.employee_id,
            )
        return AutomationChatOutcome(
            mode="clarify",
            text=f"是否确认删除自动化任务《{pending_delete_task.task_name}》？回复“确认删除”继续，回复“取消”放弃。",
            employee_id=request.employee_id,
        )

    delete_task = _match_delete_target_task(db, request.user_message)
    if delete_task is not None:
        return AutomationChatOutcome(
            mode="clarify",
            text=f"是否确认删除自动化任务《{delete_task.task_name}》？回复“确认删除”继续，回复“取消”放弃。",
            employee_id=request.employee_id,
        )

    draft = _restore_automation_draft(db, request.chat_id)
    if draft is None:
        parsed = _build_initial_automation_parse(db=db, chat_id=request.chat_id, current_message=request.user_message)
        draft = _build_initial_draft(parsed)
    else:
        draft = _normalize_automation_draft(draft)

    if _is_cancel_message(request.user_message):
        return AutomationChatOutcome(
            mode="direct_answer",
            text="已取消这次定时任务创建。需要时你可以重新告诉我任务内容和执行时间。",
            employee_id=request.employee_id,
            automation_draft=_closed_automation_draft(AUTOMATION_STAGE_CANCELLED),
        )

    if request.employee_id:
        selected_employee = db.query(models.AIEmployee).filter(models.AIEmployee.id == request.employee_id).first()
        if selected_employee is None or selected_employee.status != "active":
            return AutomationChatOutcome(mode="direct_answer", text="当前选中的数字员工不可用，请前往自动化任务页面重新选择。")
        _apply_selected_employee(draft, selected_employee)

    if draft.get("awaiting_employee_selection"):
        matched_employee = _match_candidate_employee_selection(draft, request.user_message)
        if matched_employee is not None:
            draft["employee_id"] = matched_employee["id"]
            draft["employee_name"] = matched_employee["name"]
            draft["employee_source"] = matched_employee["employee_source"]
            draft["awaiting_employee_selection"] = False
            draft["last_user_intent"] = "edit_field"
        elif not request.employee_id:
            return AutomationChatOutcome(
                mode="clarify",
                text=_build_employee_selection_prompt(draft),
                employee_id=request.employee_id,
                automation_draft=_finalize_draft(draft),
            )

    state_update = _extract_state_update(request.user_message, draft)
    draft["last_user_intent"] = state_update["intent"]

    if draft.get("awaiting_confirmation") and state_update["intent"] == "confirm":
        return _create_task_from_draft(db=db, draft=draft)

    _apply_state_update_to_draft(draft, state_update)

    if draft.get("awaiting_confirmation") and state_update["intent"] in {"edit_field", "fill_field"}:
        draft["awaiting_confirmation"] = False

    _ensure_employee_selection(db, draft)

    if draft.get("awaiting_employee_selection"):
        draft["stage"] = AUTOMATION_STAGE_COLLECTING_EMPLOYEE
        draft["last_missing_field"] = "employee_id"
        return AutomationChatOutcome(
            mode="clarify",
            text=_build_employee_selection_prompt(draft),
            employee_id=request.employee_id,
            automation_draft=_finalize_draft(draft),
        )

    missing_fields = _get_missing_fields(draft)
    if missing_fields:
        draft["pending_field"] = missing_fields[0]
        draft["last_missing_field"] = missing_fields[0]
        draft["stage"] = _stage_for_missing_field(missing_fields[0])
        return AutomationChatOutcome(
            mode="clarify",
            text=_build_missing_field_prompt(draft, missing_fields[0]),
            employee_id=request.employee_id,
            automation_draft=_finalize_draft(draft),
        )

    draft["awaiting_confirmation"] = True
    draft["pending_field"] = "confirmation"
    draft["last_missing_field"] = None
    draft["stage"] = AUTOMATION_STAGE_AWAITING_CONFIRMATION
    return AutomationChatOutcome(
        mode="clarify",
        text=_build_confirmation_prompt(draft),
        employee_id=int(draft["employee_id"]) if draft.get("employee_id") else request.employee_id,
        automation_draft=_finalize_draft(draft),
    )


def _restore_automation_draft(db: Session, chat_id: int) -> Optional[dict[str, Any]]:
    last_assistant_message = (
        db.query(models.ChatMessage)
        .filter(models.ChatMessage.chat_id == chat_id, models.ChatMessage.sender_role == "assistant")
        .order_by(models.ChatMessage.created_at.desc(), models.ChatMessage.id.desc())
        .first()
    )
    if last_assistant_message is None or not isinstance(last_assistant_message.meta_data, dict):
        return None
    automation_draft = last_assistant_message.meta_data.get("automation_draft")
    if not isinstance(automation_draft, dict) or not automation_draft.get("active"):
        return None
    return automation_draft


def _normalize_automation_draft(draft: dict[str, Any]) -> dict[str, Any]:
    normalized = {
        "active": bool(draft.get("active", True)),
        "stage": draft.get("stage") or AUTOMATION_STAGE_COLLECTING_CONTENT,
        "user_id": draft.get("user_id") or "U10023",
        "task_type": draft.get("task_type"),
        "execute_rule": draft.get("execute_rule"),
        "task_content": draft.get("task_content"),
        "employee_id": draft.get("employee_id"),
        "employee_name": draft.get("employee_name"),
        "employee_source": draft.get("employee_source"),
        "awaiting_confirmation": bool(draft.get("awaiting_confirmation")),
        "awaiting_employee_selection": bool(draft.get("awaiting_employee_selection")),
        "pending_field": draft.get("pending_field"),
        "last_missing_field": draft.get("last_missing_field"),
        "last_user_intent": draft.get("last_user_intent"),
        "candidate_employees": list(draft.get("candidate_employees") or []),
        "clarification": draft.get("clarification"),
    }
    return normalized


def _build_initial_draft(parsed: dict[str, Any]) -> dict[str, Any]:
    draft = _normalize_automation_draft(parsed)
    draft["active"] = True
    draft["candidate_employees"] = []
    draft["awaiting_confirmation"] = False
    draft["awaiting_employee_selection"] = False
    draft["pending_field"] = None
    draft["last_missing_field"] = None
    draft["last_user_intent"] = "enter_mode"
    draft["stage"] = _stage_from_current_fields(draft)
    return draft


def _build_initial_automation_parse(*, db: Session, chat_id: int, current_message: str) -> dict[str, Any]:
    initial_state_update = _extract_state_update(current_message, {})
    parsed = _parse_automation_task_request(current_message)

    # A pure "enter automation mode" utterance should start from empty placeholders
    # instead of inheriting task content or schedule from earlier turns in the chat.
    if initial_state_update.get("intent") == "enter_mode":
        return parsed

    return _merge_recent_automation_context(
        db=db,
        chat_id=chat_id,
        current_message=current_message,
        parsed=parsed,
    )


def _closed_automation_draft(stage: str = AUTOMATION_STAGE_COMPLETED) -> dict[str, Any]:
    return {
        "active": False,
        "stage": stage,
        "awaiting_confirmation": False,
        "awaiting_employee_selection": False,
        "last_missing_field": None,
        "last_user_intent": None,
        "candidate_employees": [],
    }


def _apply_state_update_to_draft(draft: dict[str, Any], state_update: dict[str, Any]) -> None:
    updates = state_update.get("updates") or {}
    for key in ["task_type", "execute_rule", "task_content", "employee_id", "employee_name", "employee_source"]:
        if key in updates and updates[key] not in {None, ""}:
            draft[key] = updates[key]

    clarification = state_update.get("clarification")
    if clarification:
        draft["clarification"] = clarification
    elif draft.get("clarification"):
        draft["clarification"] = None

    draft["stage"] = _stage_from_current_fields(draft)


def _extract_state_update(user_message: str, draft: dict[str, Any]) -> dict[str, Any]:
    normalized = str(user_message or "").strip()
    if not normalized:
        return {"intent": "unknown", "updates": {}, "clarification": None}

    if _is_confirm_message(normalized):
        return {"intent": "confirm", "updates": {}, "clarification": None}

    if _is_cancel_message(normalized):
        return {"intent": "cancel", "updates": {}, "clarification": None}

    explicit_task_content_match = re.match(r"^(?:任务内容|内容)(?:改成|改为|是|为)[:：]?\s*(.+)$", normalized)
    if explicit_task_content_match:
        return {
            "intent": "edit_field",
            "updates": {"task_content": explicit_task_content_match.group(1).strip()},
            "clarification": None,
        }

    explicit_schedule_match = re.match(r"^(?:时间|执行时间|执行规则)(?:改成|改为|是|为)[:：]?\s*(.+)$", normalized)
    if explicit_schedule_match:
        parsed_schedule = _parse_automation_task_request(explicit_schedule_match.group(1).strip())
        return {
            "intent": "edit_field",
            "updates": {
                "task_type": parsed_schedule.get("task_type"),
                "execute_rule": parsed_schedule.get("execute_rule"),
            },
            "clarification": parsed_schedule.get("clarification"),
        }

    if _is_creation_meta_message(normalized):
        return {"intent": "enter_mode", "updates": {}, "clarification": None}

    parsed = _parse_automation_task_request(normalized)
    updates: dict[str, Any] = {}
    if parsed.get("task_type"):
        updates["task_type"] = parsed["task_type"]
    if parsed.get("execute_rule"):
        updates["execute_rule"] = parsed["execute_rule"]
    if parsed.get("task_content") and _should_update_task_content(normalized, parsed["task_content"]):
        updates["task_content"] = parsed["task_content"]

    if _should_try_llm_task_content_fill(draft) and not any(key in updates for key in {"task_type", "execute_rule"}):
        llm_state_update = _extract_state_update_via_llm(normalized, draft)
        if llm_state_update is not None and llm_state_update.get("updates"):
            return llm_state_update

    if updates:
        if draft.get("awaiting_confirmation") and any(key in updates for key in {"task_content", "task_type", "execute_rule"}):
            intent = "edit_field"
        elif draft.get("task_content") or draft.get("execute_rule") or draft.get("task_type"):
            intent = "edit_field"
        else:
            intent = "fill_field"
        return {
            "intent": intent,
            "updates": updates,
            "clarification": parsed.get("clarification"),
        }

    return {"intent": "unknown", "updates": {}, "clarification": parsed.get("clarification")}


def _extract_state_update_via_llm(user_message: str, draft: dict[str, Any]) -> Optional[dict[str, Any]]:
    if not _automation_slot_llm_enabled():
        return None

    try:
        client = _build_llm_client()
        response = client.chat.completions.create(
            model=get_chat_model_name(),
            messages=[
                {
                    "role": "system",
                    "content": (
                        "你是一个定时任务表单槽位提取器。"
                        "只返回 JSON，不要解释。"
                        "JSON 结构必须是："
                        "{\"intent\":\"enter_mode|fill_field|edit_field|confirm|cancel|unknown\","
                        "\"task_content\":string|null,\"task_type\":string|null,\"execute_rule\":string|null,\"clarification\":string|null}。"
                        "规则："
                        "1. 如果用户只是说‘帮我创建一个定时任务’这类进入流程的话，intent=enter_mode，其余字段全为 null。"
                        "2. 只有用户明确提供了任务内容时才填写 task_content。"
                        "3. 只有用户明确提供了时间规则时才填写 task_type 和 execute_rule；task_type 仅可为 单次、每日、每周、每月。"
                        "4. 不要根据历史虚构字段；缺失就返回 null。"
                        "5. 如果用户是在修改已有字段，intent=edit_field。"
                    ),
                },
                {
                    "role": "user",
                    "content": json.dumps(
                        {
                            "user_message": user_message,
                            "current_draft": {
                                "stage": draft.get("stage"),
                                "task_content": draft.get("task_content"),
                                "task_type": draft.get("task_type"),
                                "execute_rule": draft.get("execute_rule"),
                                "awaiting_confirmation": draft.get("awaiting_confirmation"),
                                "last_missing_field": draft.get("last_missing_field"),
                            },
                        },
                        ensure_ascii=False,
                    ),
                },
            ],
            response_format={"type": "json_object"},
        )
        content = response.choices[0].message.content if response.choices else ""
        payload = _extract_json_object(content)
    except Exception:
        return None

    updates: dict[str, Any] = {}
    task_content = _normalize_optional_text(payload.get("task_content"))
    task_type = _normalize_optional_text(payload.get("task_type"))
    execute_rule = _normalize_optional_text(payload.get("execute_rule"))

    if task_content:
        updates["task_content"] = task_content
    if task_type:
        updates["task_type"] = task_type
    if execute_rule:
        updates["execute_rule"] = execute_rule

    intent = _normalize_automation_intent(payload.get("intent"))
    clarification = _normalize_optional_text(payload.get("clarification"))
    return {
        "intent": intent,
        "updates": updates,
        "clarification": clarification,
    }


def _automation_slot_llm_enabled() -> bool:
    azure_api_key = str(os.getenv("AZURE_OPENAI_API_KEY") or "").strip()
    openai_api_key = str(os.getenv("OPENAI_API_KEY") or "").strip()
    if azure_api_key:
        return True
    return bool(openai_api_key and openai_api_key != "sk-placeholder")


def _normalize_optional_text(value: Any) -> Optional[str]:
    text = str(value or "").strip()
    if not text or text.lower() in {"null", "none", "unknown"}:
        return None
    return text


def _normalize_automation_intent(value: Any) -> str:
    normalized = str(value or "").strip().lower()
    if normalized in {"enter_mode", "fill_field", "edit_field", "confirm", "cancel", "unknown"}:
        return normalized
    return "unknown"


def _should_try_llm_task_content_fill(draft: dict[str, Any]) -> bool:
    missing_field = str(draft.get("last_missing_field") or draft.get("pending_field") or "").strip()
    if missing_field == "task_content":
        return True
    return not draft.get("task_content") and not draft.get("awaiting_confirmation")


def _should_update_task_content(raw_message: str, task_content: str) -> bool:
    normalized_message = str(raw_message or "").strip()
    normalized_content = str(task_content or "").strip()
    if not normalized_content:
        return False
    return normalized_message not in {"确认", "确认创建", "好的", "好", "可以", "取消"}


def _get_missing_fields(draft: dict[str, Any]) -> list[str]:
    missing_fields: list[str] = []
    if not draft.get("task_content"):
        missing_fields.append("task_content")
    if not draft.get("task_type") or not draft.get("execute_rule"):
        missing_fields.append("execute_rule")
    if not draft.get("employee_id"):
        missing_fields.append("employee_id")
    return missing_fields


def _build_missing_field_prompt(draft: dict[str, Any], field_name: str) -> str:
    if field_name == "task_content":
        return "我们先确认任务内容。请直接告诉我你希望数字员工定时帮你做什么，例如“生成产品经理岗位的 JD”或“整理本周 AI 行业动态”。"
    if field_name == "execute_rule":
        return "任务内容我记下了。接下来请告诉我执行时间，例如“每周五 15:00”“每天 09:00”或“明天 10:00”。"
    if field_name == "employee_id":
        return "任务内容和执行时间都已记录。接下来请指定执行这个任务的数字员工。"
    return draft.get("clarification") or "请继续补充完成这个定时任务所需的信息。"


def _build_confirmation_prompt(draft: dict[str, Any]) -> str:
    return (
        "我已经整理好这条定时任务，请你确认：\n"
        f"任务内容：{draft['task_content']}\n"
        f"执行规则：{draft['task_type']} / {draft['execute_rule']}\n"
        f"执行员工：{draft['employee_name']}\n"
        "回复“确认创建”我就会正式创建；如果要修改，请使用“任务内容改成… / 时间改成… / 执行员工改成…”。"
    )


def _build_employee_selection_prompt(draft: dict[str, Any]) -> str:
    candidates = draft.get("candidate_employees") or []
    if not candidates:
        return "我暂时没有找到合适的数字员工，请先在页面中选择执行员工后再继续创建。"
    lines = [
        f"{index + 1}. {item['name']}（{item['source_label']}）: {item['reason']}"
        for index, item in enumerate(candidates[:3])
    ]
    return "我已经记录好任务内容和时间。接下来请选择执行员工，回复序号或员工名称即可：\n" + "\n".join(lines)


def _is_confirm_message(user_message: str) -> bool:
    normalized = re.sub(r"\s+", "", str(user_message or "").strip().lower())
    return normalized in {"确认", "确认创建", "创建", "好的", "好", "可以", "ok"}


def _is_cancel_message(user_message: str) -> bool:
    normalized = re.sub(r"\s+", "", str(user_message or "").strip().lower())
    return normalized in {"取消", "不创建了", "先不创建", "算了", "不用了"}


def _ensure_employee_selection(db: Session, draft: dict[str, Any]) -> None:
    if not draft.get("task_content") or draft.get("employee_id"):
        draft["awaiting_employee_selection"] = False
        draft["candidate_employees"] = []
        return

    recommendations = _build_recommendations(db, draft["task_content"])
    if not recommendations:
        draft["awaiting_employee_selection"] = True
        draft["candidate_employees"] = []
        return

    if len(recommendations) == 1:
        _apply_selected_employee(draft, recommendations[0]["employee"])
        draft["awaiting_employee_selection"] = False
        draft["candidate_employees"] = []
        return

    draft["awaiting_employee_selection"] = True
    draft["candidate_employees"] = [
        {
            "id": item["employee"].id,
            "name": item["name"],
            "source_label": item["source_label"],
            "employee_source": _derive_employee_source(item["employee"]),
            "reason": item["reason"],
        }
        for item in recommendations[:3]
    ]


def _apply_selected_employee(draft: dict[str, Any], employee: models.AIEmployee) -> None:
    draft["employee_id"] = employee.id
    draft["employee_name"] = employee.name or f"数字员工 {employee.id}"
    draft["employee_source"] = _derive_employee_source(employee)
    draft["awaiting_employee_selection"] = False
    draft["candidate_employees"] = []
    draft["stage"] = _stage_from_current_fields(draft)


def _match_candidate_employee_selection(draft: dict[str, Any], user_message: str) -> Optional[dict[str, Any]]:
    candidates = draft.get("candidate_employees") or []
    normalized = str(user_message or "").strip()
    if not normalized:
        return None
    if normalized.isdigit():
        index = int(normalized) - 1
        if 0 <= index < len(candidates):
            return candidates[index]
    compact = _compact_match_text(normalized)
    for candidate in candidates:
        if compact == _compact_match_text(candidate["name"]):
            return candidate
    return None


def _create_task_from_draft(*, db: Session, draft: dict[str, Any]) -> AutomationChatOutcome:
    payload = {
        "task_name": _build_task_name(draft["task_content"]),
        "task_type": draft["task_type"],
        "user_id": draft.get("user_id") or "U10023",
        "task_content": draft["task_content"],
        "employee_id": str(draft["employee_id"]),
        "employee_source": draft["employee_source"],
        "execute_rule": draft["execute_rule"],
        "start_time": None,
        "end_time": None,
    }
    normalized_payload = _build_task_payload(payload)
    normalized_payload["employee_id"] = str(draft["employee_id"])
    _validate_employee_capability(db, normalized_payload)
    _guard_duplicate_submission(db, normalized_payload)

    db_task = models.Task(
        task_id=_generate_prefixed_id("TSK"),
        executor_role="digital_employee",
        **normalized_payload,
    )
    db.add(db_task)
    db.commit()
    db.refresh(db_task)
    return AutomationChatOutcome(
        mode="direct_answer",
        employee_id=int(draft["employee_id"]),
        automation_draft=_closed_automation_draft(),
        text=(
            f"自动化任务已创建成功：{db_task.task_name}。\n"
            f"任务类型：{db_task.task_type}；下次执行时间：{db_task.next_execute_time.strftime('%Y-%m-%d %H:%M')}；执行数字员工：{draft['employee_name']}。\n"
            "任务已创建，将按计划由所选数字员工自动执行。"
        ),
    )


def _finalize_draft(draft: dict[str, Any]) -> dict[str, Any]:
    final_draft = dict(draft)
    final_draft["active"] = True
    return final_draft


def _stage_for_missing_field(field_name: str) -> str:
    if field_name == "task_content":
        return AUTOMATION_STAGE_COLLECTING_CONTENT
    if field_name == "execute_rule":
        return AUTOMATION_STAGE_COLLECTING_SCHEDULE
    if field_name == "employee_id":
        return AUTOMATION_STAGE_COLLECTING_EMPLOYEE
    return AUTOMATION_STAGE_COLLECTING_CONTENT


def _stage_from_current_fields(draft: dict[str, Any]) -> str:
    if draft.get("awaiting_confirmation"):
        return AUTOMATION_STAGE_AWAITING_CONFIRMATION
    missing_fields = _get_missing_fields(draft)
    if missing_fields:
        return _stage_for_missing_field(missing_fields[0])
    return AUTOMATION_STAGE_AWAITING_CONFIRMATION


def _merge_recent_automation_context(*, db: Session, chat_id: int, current_message: str, parsed: dict) -> dict:
    merged = dict(parsed)
    if merged.get("task_type") and merged.get("execute_rule") and merged.get("task_content"):
        return merged

    recent_user_messages = (
        db.query(models.ChatMessage)
        .filter(models.ChatMessage.chat_id == chat_id, models.ChatMessage.sender_role == "user")
        .order_by(models.ChatMessage.created_at.desc(), models.ChatMessage.id.desc())
        .limit(6)
        .all()
    )

    seen_contents = {str(current_message or "").strip()}
    for message in recent_user_messages:
        content = str(message.content or "").strip()
        if not content or content in seen_contents:
            continue
        seen_contents.add(content)

        historical = _parse_automation_task_request(content)
        if not merged.get("task_type") and historical.get("task_type"):
            merged["task_type"] = historical["task_type"]
        if not merged.get("execute_rule") and historical.get("execute_rule"):
            merged["execute_rule"] = historical["execute_rule"]
        if not merged.get("task_content") and historical.get("task_content"):
            merged["task_content"] = historical["task_content"]

    if merged.get("task_type") and merged.get("execute_rule"):
        merged["clarification"] = None
    elif not merged.get("clarification") and any(token in str(current_message or "") for token in AUTOMATION_TRIGGER_TOKENS):
        merged["clarification"] = "我识别到了你想创建自动化任务，但还缺少明确的周期或执行时间。请补充例如“每周五 15:00”这样的时间规则，或者前往添加任务页面继续填写。"

    return merged


def _parse_automation_task_request(user_message: str) -> dict:
    now = datetime.now()
    normalized = re.sub(r"\s+", " ", str(user_message or "").strip())
    task_type = None
    execute_rule = None
    clarification = None

    monthly_match = re.search(rf"每月\s*(\d{{1,2}})[日号]?\s*{TIME_OF_DAY_PATTERN}\s*{CLOCK_PATTERN}", normalized)
    weekly_match = re.search(rf"每周([一二三四五六日天])\s*{TIME_OF_DAY_PATTERN}\s*{CLOCK_PATTERN}", normalized)
    daily_match = re.search(rf"每天\s*{TIME_OF_DAY_PATTERN}\s*{CLOCK_PATTERN}", normalized)
    explicit_date_match = re.search(rf"(20\d{{2}}-\d{{1,2}}-\d{{1,2}})\s*{TIME_OF_DAY_PATTERN}\s*{CLOCK_PATTERN}", normalized)
    relative_day_match = re.search(rf"(明天|后天)\s*{TIME_OF_DAY_PATTERN}\s*{CLOCK_PATTERN}", normalized)

    if monthly_match:
        hour, minute = _normalize_clock(monthly_match.group(2), monthly_match.group(3), normalized)
        task_type = "每月"
        execute_rule = f"{int(monthly_match.group(1))} {hour:02d}:{minute:02d}"
    elif weekly_match:
        hour, minute = _normalize_clock(weekly_match.group(2), weekly_match.group(3), normalized)
        task_type = "每周"
        execute_rule = f"{WEEKDAY_TEXT_MAP[weekly_match.group(1)]} {hour:02d}:{minute:02d}"
    elif daily_match:
        hour, minute = _normalize_clock(daily_match.group(1), daily_match.group(2), normalized)
        task_type = "每日"
        execute_rule = f"{hour:02d}:{minute:02d}"
    elif explicit_date_match:
        hour, minute = _normalize_clock(explicit_date_match.group(2), explicit_date_match.group(3), normalized)
        task_type = "单次"
        execute_rule = f"{explicit_date_match.group(1)} {hour:02d}:{minute:02d}"
    elif relative_day_match:
        hour, minute = _normalize_clock(relative_day_match.group(2), relative_day_match.group(3), normalized)
        target = now + timedelta(days=1 if relative_day_match.group(1) == "明天" else 2)
        task_type = "单次"
        execute_rule = f"{target.strftime('%Y-%m-%d')} {hour:02d}:{minute:02d}"
    elif any(token in normalized for token in ["每周", "每天", "每月"]):
        clarification = "我已经识别到你想创建周期任务，但执行时间还不完整。请补充具体时间，例如“每周五 15:00”，或者前往添加任务页面继续填写。"
    elif any(token in normalized for token in ["明天", "后天", "下周", "下个月"]):
        clarification = "我识别到了你想创建自动化任务，但执行时间表达还不够精确。请补充具体日期和时间，或者前往添加任务页面继续填写。"

    task_content = normalized
    for pattern in [
        rf"每月\s*\d{{1,2}}[日号]?\s*{TIME_OF_DAY_PATTERN}\s*{CLOCK_PATTERN}",
        rf"每周[一二三四五六日天]\s*{TIME_OF_DAY_PATTERN}\s*{CLOCK_PATTERN}",
        rf"每天\s*{TIME_OF_DAY_PATTERN}\s*{CLOCK_PATTERN}",
        rf"20\d{{2}}-\d{{1,2}}-\d{{1,2}}\s*{TIME_OF_DAY_PATTERN}\s*{CLOCK_PATTERN}",
        rf"(明天|后天)\s*{TIME_OF_DAY_PATTERN}\s*{CLOCK_PATTERN}",
        r"定时",
        r"自动(地)?",
        r"周期(性)?",
        r"给我推送",
        r"推送给我",
        r"请?提醒",
        r"帮(?=我)",
        r"创建(一个)?自动化任务",
        r"设置(一个)?自动化任务",
    ]:
        task_content = re.sub(pattern, "", task_content)

    task_content = re.sub(r"^[，,。；;:\s]+|[，,。；;:\s]+$", "", task_content).strip()
    task_content = re.sub(r"^(?:任务内容|内容)(?:改成|改为|是|为)?[:：]?\s*", "", task_content).strip()
    task_content = re.sub(r"^(?:请帮我|帮我|请|给我)\s*", "", task_content).strip()
    if _is_creation_meta_message(normalized) or _looks_like_meta_task_content(task_content):
        task_content = ""
    return {
        "task_type": task_type,
        "execute_rule": execute_rule,
        "task_content": task_content or None,
        "clarification": clarification,
        "user_id": "U10023",
    }


def _is_creation_meta_message(user_message: str) -> bool:
    normalized = re.sub(r"\s+", "", str(user_message or "").strip())
    patterns = [
        r"^(?:请)?(?:帮我)?(?:再)?(?:生成|创建|新建|加)(?:一个|条)?(?:定时任务|自动化任务|任务)$",
        r"^(?:请)?(?:帮我)?(?:再)?(?:来|做)(?:一个|条)?(?:定时任务|自动化任务|任务)$",
    ]
    return any(re.match(pattern, normalized) for pattern in patterns)


def _looks_like_meta_task_content(task_content: str) -> bool:
    compact = re.sub(r"\s+", "", str(task_content or "").strip())
    return compact in {
        "我再生成一个任务",
        "再生成一个任务",
        "生成一个任务",
        "创建一个任务",
        "新建一个任务",
        "一个任务",
        "一个定时任务",
    }


def _get_pending_delete_confirmation_task(db: Session, chat_id: int) -> Optional[models.Task]:
    last_assistant_message = (
        db.query(models.ChatMessage)
        .filter(models.ChatMessage.chat_id == chat_id, models.ChatMessage.sender_role == "assistant")
        .order_by(models.ChatMessage.created_at.desc(), models.ChatMessage.id.desc())
        .first()
    )
    if last_assistant_message is None:
        return None

    matched = AUTOMATION_DELETE_CONFIRM_PROMPT_PATTERN.search(str(last_assistant_message.content or ""))
    if not matched:
        return None

    task_name = matched.group("task_name").strip()
    if not task_name:
        return None

    return (
        db.query(models.Task)
        .filter(models.Task.user_id == "U10023", models.Task.task_name == task_name, models.Task.task_status != "已删除")
        .order_by(models.Task.updated_at.desc())
        .first()
    )


def _parse_delete_confirmation_decision(user_message: str) -> Optional[str]:
    normalized = re.sub(r"\s+", "", str(user_message or "").strip().lower())
    if not normalized:
        return None
    if normalized in AUTOMATION_DELETE_CONFIRM_PHRASES:
        return "confirm"
    if normalized in AUTOMATION_DELETE_CANCEL_PHRASES:
        return "cancel"
    return None


def _match_delete_target_task(db: Session, user_message: str) -> Optional[models.Task]:
    normalized = str(user_message or "").strip()
    if not normalized or not any(token in normalized for token in AUTOMATION_DELETE_TOKENS):
        return None

    target_text = _extract_delete_target_text(normalized)
    if not target_text:
        return None

    tasks = (
        db.query(models.Task)
        .filter(models.Task.user_id == "U10023", models.Task.task_status != "已删除")
        .order_by(models.Task.updated_at.desc())
        .all()
    )
    target_compact = _compact_match_text(target_text)
    matched_tasks = []
    for task in tasks:
        task_name = _compact_match_text(task.task_name or "")
        task_content = _compact_match_text(task.task_content or "")
        if not target_compact:
            continue
        if target_compact in task_name or target_compact in task_content or task_name in target_compact:
            matched_tasks.append(task)

    if len(matched_tasks) == 1:
        return matched_tasks[0]
    return None


def _extract_delete_target_text(user_message: str) -> str:
    target_text = re.sub(r"^(请|帮我|麻烦)?\s*(删除|删掉|移除)\s*", "", user_message).strip()
    target_text = re.sub(r"^(自动化)?任务", "", target_text).strip()
    target_text = re.sub(r"^(这个|这个任务|这条|这条任务)", "", target_text).strip()
    target_text = re.sub(r"[？?。！!]+$", "", target_text).strip()
    return target_text


def _compact_match_text(value: str) -> str:
    return re.sub(r"\s+", "", str(value or "").strip().lower())


def _normalize_clock(hour_text: str, minute_text: Optional[str], source_text: str) -> tuple[int, int]:
    hour = int(hour_text)
    minute = int(minute_text or 0)
    if "下午" in source_text or "傍晚" in source_text or "晚上" in source_text:
        if hour < 12:
            hour += 12
    elif "中午" in source_text and hour < 11:
        hour += 12
    return hour, minute


def _build_recommendations(db: Session, task_content: str) -> list[dict]:
    employees = db.query(models.AIEmployee).filter(models.AIEmployee.status == "active").order_by(models.AIEmployee.updated_at.desc()).all()
    recommendations = []
    for employee in employees:
        score, matched_terms = _score_employee_recommendation(employee, task_content)
        if score <= 0:
            continue
        recommendations.append(
            {
                "employee": employee,
                "name": employee.name or f"数字员工 {employee.id}",
                "score": score,
                "reason": _build_recommendation_reason(employee, matched_terms),
                "source_label": "个人创建" if employee.access_scope == "personal" else "管理员创建",
            }
        )
    return sorted(recommendations, key=lambda item: (-item["score"], item["name"].lower()))[:5]


def _derive_employee_source(employee: models.AIEmployee) -> str:
    return "personal_created" if employee.access_scope == "personal" else "admin_created"


def _build_task_name(task_content: str) -> str:
    normalized = str(task_content or "").strip()
    return normalized[:24] if normalized else "自动化任务"