import re
from typing import Any, Optional

from sqlalchemy.orm import Session

from app import models
from app.services.artifact_service import build_step_context_summary_for_prompt, normalize_artifacts
from app.services.skill_registry import get_skill
from app.runtime.codex_runtime import CodexRuntime


codex_runtime = CodexRuntime()
IGNORED_AGENT_NAMES = {"UserProxy"}
PREFERRED_RESULT_AGENT_NAMES = {"ExecutionAgent", "Assistant"}
AGENT_PLAN_WORKFLOW_KEY = "__agent_plan__"
AGENT_PLAN_WORKFLOW_NAME = "Agent Plan"
SUBSTANTIVE_OUTPUT_KEYWORDS = (
    "研究",
    "调研",
    "分析",
    "报告",
    "总结",
    "梳理",
    "市场",
    "行业",
    "策略",
    "洞察",
    "评估",
    "对比",
    "方案",
    "提纲",
    "draft",
    "report",
    "research",
    "analysis",
    "summary",
    "outline",
    "insight",
    "market",
    "strategy",
)


def _clean_agent_content(content: str) -> str:
    cleaned = (content or "").replace("\r\n", "\n").strip()
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
        return f"执行结果：\n{fallback_title}已完成。"

    preferred_messages = [msg for msg in user_facing_messages if msg["name"] in PREFERRED_RESULT_AGENT_NAMES]
    if preferred_messages:
        return _strip_markdown_formatting(preferred_messages[-1]["content"])

    return _strip_markdown_formatting(user_facing_messages[-1]["content"])


def _requires_substantive_output(*texts: str) -> bool:
    haystack = "\n".join(str(text or "") for text in texts).lower()
    return any(keyword.lower() in haystack for keyword in SUBSTANTIVE_OUTPUT_KEYWORDS)


def _build_substantive_output_guidance(*texts: str) -> list[str]:
    if not _requires_substantive_output(*texts):
        return []

    return [
        "- This step must produce substantive reusable content, not just a short completion receipt.",
        "- Include enough factual detail, intermediate conclusions, and structured findings so downstream steps can directly reuse this output.",
        "- For research or analysis steps, include concrete data points, comparisons, drivers, assumptions, and source names when available.",
        "- For outline, drafting, or report-writing steps, provide a working draft with clear sections and sufficient detail for final assembly.",
        "- Do not compress the answer to 1-2 sentences if the step is analytical or report-oriented.",
    ]


def _build_feedback_step_prompt(step_name: str, rerun: bool = False) -> str:
    if rerun:
        return f"步骤“{step_name}”已根据你的反馈完成调整。请确认是否继续下一步；如果还有调整建议，也可以继续补充。"
    return f"步骤“{step_name}”已完成。请确认是否继续下一步；如果有调整建议，也可以直接补充。"


def _resolve_employee_id(chat_id: int, employee_id: Optional[int], db: Session) -> Optional[int]:
    if employee_id:
        return employee_id

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


def _get_tool_ids_for_employee(employee_id: Optional[int], db: Session) -> list[str]:
    if not employee_id:
        return []
    employee = db.query(models.AIEmployee).filter(models.AIEmployee.id == employee_id).first()
    if not employee or not employee.tool_ids:
        return []
    return employee.tool_ids


def _append_chat_event(chat_id: int, employee_id: Optional[int], content: str, message_type: str, meta_data: Optional[dict], db: Session) -> None:
    db.add(models.ChatMessage(
        chat_id=chat_id,
        sender_role="assistant",
        employee_id=employee_id,
        content=content,
        message_type=message_type,
        meta_data=meta_data or {},
    ))


def _append_step_result_event(
    run: models.WorkflowRun,
    workflow_skill: dict,
    step_run: models.WorkflowStepRun,
    summary: str,
    db: Session,
    *,
    awaiting_confirmation: bool = False,
    artifacts: Optional[list[dict]] = None,
) -> None:
    cleaned_summary = _clean_agent_content(summary)
    if not cleaned_summary:
        return

    _append_chat_event(
        run.chat_id,
        run.employee_id,
        cleaned_summary,
        "workflow_step_result",
        {
            "workflow_run_id": run.id,
            "workflow_skill_key": run.workflow_skill_key,
            "workflow_name": workflow_skill.get("name") or run.workflow_skill_key,
            "step_id": step_run.step_id,
            "step_name": step_run.step_name,
            "step_index": step_run.step_index,
            "step_type": step_run.step_type,
            "awaiting_confirmation": awaiting_confirmation,
            "artifacts": normalize_artifacts(artifacts),
        },
        db,
    )


def _sync_task_progress(run: models.WorkflowRun, workflow_skill: dict, step_runs: list[models.WorkflowStepRun], db: Session) -> None:
    completed_steps = sum(1 for step_run in step_runs if step_run.status == "completed")
    task = (
        db.query(models.TaskProgress)
        .filter(models.TaskProgress.chat_id == run.chat_id, models.TaskProgress.task_name == workflow_skill.get("name"))
        .order_by(models.TaskProgress.id.desc())
        .first()
    )

    if task is None:
        task = models.TaskProgress(
            task_name=workflow_skill.get("name") or run.workflow_skill_key,
            employee_id=run.employee_id,
            employee_name="Workflow Runner",
            status=run.status,
            chat_id=run.chat_id,
            total_steps=len(step_runs),
            completed_steps=completed_steps,
        )
        db.add(task)
    else:
        task.status = run.status
        task.employee_id = run.employee_id
        task.total_steps = len(step_runs)
        task.completed_steps = completed_steps


def _serialize_step_run(step_run: models.WorkflowStepRun) -> dict:
    return {
        "id": step_run.id,
        "workflow_run_id": step_run.workflow_run_id,
        "step_id": step_run.step_id,
        "step_index": step_run.step_index,
        "step_name": step_run.step_name,
        "step_type": step_run.step_type,
        "status": step_run.status,
        "input_data": step_run.input_data,
        "output_data": step_run.output_data,
        "pause_payload": step_run.pause_payload,
        "created_at": step_run.created_at.isoformat() if step_run.created_at else None,
        "updated_at": step_run.updated_at.isoformat() if step_run.updated_at else None,
    }


def _serialize_workflow_run(run: models.WorkflowRun, workflow_skill: dict, step_runs: list[models.WorkflowStepRun]) -> dict:
    current_step = next((step for step in step_runs if step.step_id == run.current_step_id), None)
    return {
        "id": run.id,
        "chat_id": run.chat_id,
        "employee_id": run.employee_id,
        "workflow_skill_key": run.workflow_skill_key,
        "workflow_name": workflow_skill.get("name") or run.workflow_skill_key,
        "status": run.status,
        "current_step_id": run.current_step_id,
        "current_step_index": run.current_step_index,
        "pause_reason": run.pause_reason,
        "context_data": run.context_data or {},
        "current_step": _serialize_step_run(current_step) if current_step else None,
        "steps": [_serialize_step_run(step_run) for step_run in step_runs],
        "created_at": run.created_at.isoformat() if run.created_at else None,
        "updated_at": run.updated_at.isoformat() if run.updated_at else None,
    }


def _is_agent_plan_run(run: models.WorkflowRun) -> bool:
    context_data = run.context_data or {}
    return run.workflow_skill_key == AGENT_PLAN_WORKFLOW_KEY or context_data.get("run_kind") == "agent_plan"


def _serialize_agent_plan_run(run: models.WorkflowRun, step_runs: list[models.WorkflowStepRun]) -> dict:
    current_step = next((step for step in step_runs if step.step_id == run.current_step_id), None)
    context_data = run.context_data or {}
    return {
        "id": run.id,
        "chat_id": run.chat_id,
        "employee_id": run.employee_id,
        "workflow_skill_key": run.workflow_skill_key,
        "workflow_name": context_data.get("workflow_name") or AGENT_PLAN_WORKFLOW_NAME,
        "status": run.status,
        "current_step_id": run.current_step_id,
        "current_step_index": run.current_step_index,
        "pause_reason": run.pause_reason,
        "context_data": context_data,
        "current_step": _serialize_step_run(current_step) if current_step else None,
        "steps": [_serialize_step_run(step_run) for step_run in step_runs],
        "created_at": run.created_at.isoformat() if run.created_at else None,
        "updated_at": run.updated_at.isoformat() if run.updated_at else None,
    }


def _build_agent_plan_step_content(step_run: models.WorkflowStepRun) -> str:
    payload = step_run.input_data or {}
    title = str(payload.get("title") or step_run.step_name or f"步骤 {step_run.step_index}").strip()
    description = str(payload.get("description") or "").strip()
    if title and description:
        return f"{title}：{description}"
    return title or description or f"步骤 {step_run.step_index}"


def _set_agent_plan_output(run: models.WorkflowRun, step_run: models.WorkflowStepRun, output_payload: dict) -> None:
    context_data = dict(run.context_data or {})
    step_outputs = dict(context_data.get("step_outputs") or {})
    step_outputs[step_run.step_id] = output_payload
    context_data["step_outputs"] = step_outputs
    run.context_data = context_data


def _collect_agent_plan_artifacts(run: models.WorkflowRun) -> list[dict]:
    context_data = run.context_data or {}
    step_outputs = context_data.get("step_outputs") or {}
    ordered_entries = sorted(
        ((step_id, entry) for step_id, entry in step_outputs.items() if isinstance(entry, dict)),
        key=lambda item: int(re.search(r"(\d+)", str(item[0])).group(1)) if re.search(r"(\d+)", str(item[0])) else 0,
    )

    for _, entry in reversed(ordered_entries):
        artifacts = normalize_artifacts(entry.get("artifacts") or [])
        if artifacts:
            return artifacts

    artifact_map: dict[str, dict] = {}
    for _, entry in ordered_entries:
        for artifact in normalize_artifacts(entry.get("artifacts") or []):
            relative_path = str(artifact.get("relative_path") or "").strip()
            if relative_path:
                artifact_map[relative_path] = artifact

    return list(artifact_map.values())


def _load_step_runs_for_run(run: models.WorkflowRun, db: Session) -> list[models.WorkflowStepRun]:
    return (
        db.query(models.WorkflowStepRun)
        .filter(models.WorkflowStepRun.workflow_run_id == run.id)
        .order_by(models.WorkflowStepRun.step_index.asc())
        .all()
    )


def _summarize_workflow_run_result(workflow_run: dict) -> str:
    outputs = ((workflow_run.get("context_data") or {}).get("step_outputs") or {}).values()
    for entry in reversed(list(outputs)):
        if isinstance(entry, dict):
            if isinstance(entry.get("result"), str) and entry.get("result").strip():
                return entry["result"].strip()
            if isinstance(entry.get("summary"), str) and entry.get("summary").strip():
                return entry["summary"].strip()

    workflow_name = workflow_run.get("workflow_name") or workflow_run.get("workflow_skill_key") or "工作流"
    status = workflow_run.get("status") or "completed"
    return f"{workflow_name} 当前状态：{status}"


def _ensure_workflow_skill(workflow_skill_key: str, db: Session) -> dict:
    workflow_skill = get_skill(workflow_skill_key, db)
    if workflow_skill is None:
        raise ValueError(f"Workflow skill '{workflow_skill_key}' was not found")
    if workflow_skill.get("skill_type") != "workflow":
        raise ValueError(f"Skill '{workflow_skill_key}' is not a workflow skill")
    return workflow_skill


def _build_step_prompt(step: dict, workflow_skill: dict, context_data: dict, user_feedback: str = "") -> str:
    upstream_outputs = context_data.get("step_outputs") or {}
    summarized_context = build_step_context_summary_for_prompt(upstream_outputs)
    parts = [
        f"Workflow Name: {workflow_skill.get('name') or workflow_skill.get('skill_key')}",
        f"Workflow Description: {workflow_skill.get('description') or '无'}",
        f"Original User Request: {context_data.get('user_message') or ''}",
        f"Current Step: {step.get('name')}",
        f"Step Type: {step.get('step_type')}",
        f"Referenced Tool: {step.get('skill_key') or 'None'}",
        f"Step Guidance: {step.get('instructions') or '无'}",
        f"Declared Input Keys: {', '.join(step.get('input_keys') or []) or 'None'}",
        "Available Previous Outputs:",
        summarized_context or "None",
    ]
    if user_feedback:
        parts.extend([
            "User Feedback For This Step:",
            user_feedback,
        ])

    if summarized_context and context_data.get("step_outputs"):
        parts.append(
            "Note: Full upstream outputs remain stored in workflow state for later steps and final deliverable rendering; only concise reusable summaries are shown here to control prompt size."
        )

    parts.extend([
        "Instructions:",
        "- Complete this workflow step using the available context and tools.",
        "- Reuse previous outputs when possible.",
        "- Do NOT expose raw JSON, tool payloads, or internal coordination logs.",
        "- Before finishing, provide one final clean Chinese summary in plain text.",
    ])
    parts.extend(_build_substantive_output_guidance(
        step.get("name"),
        step.get("instructions"),
        workflow_skill.get("name"),
        workflow_skill.get("description"),
        context_data.get("user_message"),
    ))
    return "\n".join(parts)


def _execute_agent_step(run: models.WorkflowRun, workflow_skill: dict, step: dict, db: Session, user_feedback: str = "") -> dict:
    tool_ids = _get_tool_ids_for_employee(run.employee_id, db)
    employee = db.query(models.AIEmployee).filter(models.AIEmployee.id == run.employee_id).first()
    model_config = None
    if employee is not None:
        config_list = get_employee_llm_config(employee, db).get("config_list") or []
        model_config = config_list[0] if config_list else None
    runtime_result = codex_runtime.run(
        prompt=_build_step_prompt(step, workflow_skill, run.context_data or {}, user_feedback=user_feedback),
        model_config=model_config,
        db=db,
        tool_ids=tool_ids,
    )
    new_messages = [{"name": "ExecutionAgent", "content": runtime_result.text}]
    result = runtime_result.text
    return {
        "summary": result,
        "result": result,
        "messages": new_messages,
    }


def _set_context_output(run: models.WorkflowRun, step: dict, payload: Any) -> None:
    context_data = dict(run.context_data or {})
    step_outputs = dict(context_data.get("step_outputs") or {})
    key = step.get("output_key") or step.get("id")
    step_outputs[key] = payload
    context_data["step_outputs"] = step_outputs
    run.context_data = context_data


def _pause_run(run: models.WorkflowRun, step_run: models.WorkflowStepRun, step: dict, pause_payload: dict, db: Session) -> None:
    run.status = "paused"
    run.current_step_id = step_run.step_id
    run.current_step_index = step_run.step_index
    run.pause_reason = "awaiting_feedback"
    step_run.status = "paused"
    step_run.pause_payload = pause_payload
    _append_chat_event(
        run.chat_id,
        run.employee_id,
        pause_payload.get("prompt") or f"流程在步骤“{step_run.step_name}”暂停，等待用户操作。",
        "workflow_paused",
        {
            "workflow_run_id": run.id,
            "step_id": step_run.step_id,
            "pause_reason": run.pause_reason,
        },
        db,
    )


def _complete_step(run: models.WorkflowRun, step_run: models.WorkflowStepRun, step: dict, output_payload: Any) -> None:
    step_run.status = "completed"
    step_run.output_data = output_payload
    step_run.pause_payload = None
    _set_context_output(run, step, output_payload)
    run.current_step_id = step_run.step_id
    run.current_step_index = step_run.step_index
    run.pause_reason = None


def _advance_workflow(run: models.WorkflowRun, workflow_skill: dict, db: Session) -> dict:
    steps = workflow_skill.get("workflow_steps") or []
    step_runs = (
        db.query(models.WorkflowStepRun)
        .filter(models.WorkflowStepRun.workflow_run_id == run.id)
        .order_by(models.WorkflowStepRun.step_index.asc())
        .all()
    )

    for step_run in step_runs:
        if step_run.status in {"completed", "skipped"}:
            continue

        step = next((item for item in steps if item.get("id") == step_run.step_id), None)
        if step is None or not step.get("enabled", True):
            step_run.status = "skipped"
            continue

        step_run.status = "running"
        run.status = "running"
        run.current_step_id = step_run.step_id
        run.current_step_index = step_run.step_index
        db.flush()

        if step_run.step_type == "auto_step":
            execution_result = _execute_agent_step(run, workflow_skill, step, db)
            step_result = execution_result.get("result") or execution_result["summary"]
            _append_step_result_event(run, workflow_skill, step_run, step_result, db)
            _complete_step(run, step_run, step, {
                "summary": execution_result["summary"],
                "result": step_result,
            })
            continue

        if step_run.step_type == "feedback_step":
            execution_result = _execute_agent_step(run, workflow_skill, step, db)
            step_result = execution_result.get("result") or execution_result["summary"]
            step_run.output_data = {"summary": execution_result["summary"], "result": step_result}
            _append_step_result_event(
                run,
                workflow_skill,
                step_run,
                step_result,
                db,
                awaiting_confirmation=True,
            )
            pause_payload = {
                "prompt": _build_feedback_step_prompt(step_run.step_name),
                "draft": step_result,
                "latest_outputs": (run.context_data or {}).get("step_outputs") or {},
            }
            _pause_run(run, step_run, step, pause_payload, db)
            db.commit()
            _sync_task_progress(run, workflow_skill, step_runs, db)
            db.commit()
            return _serialize_workflow_run(run, workflow_skill, step_runs)

    run.status = "completed"
    run.pause_reason = None
    _append_chat_event(
        run.chat_id,
        run.employee_id,
        f"工作流“{workflow_skill.get('name') or run.workflow_skill_key}”已执行完成。",
        "workflow_completed",
        {"workflow_run_id": run.id},
        db,
    )
    db.commit()
    _sync_task_progress(run, workflow_skill, step_runs, db)
    db.commit()
    return _serialize_workflow_run(run, workflow_skill, step_runs)


def start_workflow_run(
    chat_id: int,
    employee_id: Optional[int],
    workflow_skill_key: str,
    user_message: str,
    db: Session,
    initial_context_data: Optional[dict] = None,
) -> dict:
    workflow_skill = _ensure_workflow_skill(workflow_skill_key, db)
    resolved_employee_id = _resolve_employee_id(chat_id, employee_id, db)

    run = models.WorkflowRun(
        chat_id=chat_id,
        employee_id=resolved_employee_id,
        workflow_skill_key=workflow_skill_key,
        status="pending",
        current_step_index=0,
        context_data={
            "user_message": user_message,
            "step_outputs": {},
            **(initial_context_data or {}),
        },
    )
    db.add(run)
    db.flush()

    for index, step in enumerate(workflow_skill.get("workflow_steps") or [], start=1):
        db.add(models.WorkflowStepRun(
            workflow_run_id=run.id,
            step_id=step.get("id") or f"step_{index}",
            step_index=index,
            step_name=step.get("name") or f"Step {index}",
            step_type=step.get("step_type") or "auto_step",
            status="pending",
        ))

    _append_chat_event(
        chat_id,
        resolved_employee_id,
        f"工作流“{workflow_skill.get('name') or workflow_skill_key}”已启动。",
        "workflow_started",
        {"workflow_run_id": run.id, "workflow_skill_key": workflow_skill_key},
        db,
    )
    db.commit()
    db.refresh(run)
    return _advance_workflow(run, workflow_skill, db)


def start_agent_plan_run(
    chat_id: int,
    employee_id: Optional[int],
    user_message: str,
    plan_steps: list[dict],
    db: Session,
    initial_context_data: Optional[dict] = None,
) -> dict:
    resolved_employee_id = _resolve_employee_id(chat_id, employee_id, db)
    normalized_steps = []
    for index, step in enumerate(plan_steps or [], start=1):
        normalized_steps.append({
            "id": step.get("id") or f"step_{index}",
            "title": step.get("title") or f"步骤 {index}",
            "description": step.get("description") or "",
            "selected_skill_key": step.get("selected_skill_key"),
            "selected_skill_type": step.get("selected_skill_type"),
            "candidate_skill_keys": list(step.get("candidate_skill_keys") or []),
            "status": step.get("status") or "pending",
        })

    run = models.WorkflowRun(
        chat_id=chat_id,
        employee_id=resolved_employee_id,
        workflow_skill_key=AGENT_PLAN_WORKFLOW_KEY,
        status="planned",
        current_step_id=normalized_steps[0]["id"] if normalized_steps else None,
        current_step_index=1 if normalized_steps else 0,
        pause_reason=None,
        context_data={
            "run_kind": "agent_plan",
            "workflow_name": AGENT_PLAN_WORKFLOW_NAME,
            "user_message": user_message,
            "step_outputs": {},
            "plan_steps": normalized_steps,
            **(initial_context_data or {}),
        },
    )
    db.add(run)
    db.flush()

    for index, step in enumerate(normalized_steps, start=1):
        db.add(models.WorkflowStepRun(
            workflow_run_id=run.id,
            step_id=step["id"],
            step_index=index,
            step_name=step["title"],
            step_type=step.get("selected_skill_type") or "auto_step",
            status=step.get("status") or "pending",
            input_data=step,
        ))

    _append_chat_event(
        chat_id,
        resolved_employee_id,
        f"任务计划已创建，共 {len(normalized_steps)} 个步骤。",
        "workflow_started",
        {
            "workflow_run_id": run.id,
            "workflow_skill_key": AGENT_PLAN_WORKFLOW_KEY,
            "run_kind": "agent_plan",
        },
        db,
    )
    db.commit()
    db.refresh(run)

    step_runs = (
        db.query(models.WorkflowStepRun)
        .filter(models.WorkflowStepRun.workflow_run_id == run.id)
        .order_by(models.WorkflowStepRun.step_index.asc())
        .all()
    )
    _sync_task_progress(
        run,
        {"name": AGENT_PLAN_WORKFLOW_NAME, "skill_key": AGENT_PLAN_WORKFLOW_KEY},
        step_runs,
        db,
    )
    db.commit()
    return _serialize_agent_plan_run(run, step_runs)


async def execute_agent_plan_run(run_id: int, db: Session) -> dict:
    run = db.query(models.WorkflowRun).filter(models.WorkflowRun.id == run_id).first()
    if run is None:
        raise ValueError("Workflow run not found")
    if not _is_agent_plan_run(run):
        raise ValueError("Workflow run is not an agent plan run")
    if run.status == "cancelled":
        raise ValueError("Workflow run has been cancelled")
    if run.status == "paused":
        return get_workflow_run(run_id, db)
    if run.status == "completed":
        return get_workflow_run(run_id, db)

    step_runs = _load_step_runs_for_run(run, db)

    import app.mcp_server as mcp_server

    def _move_to_next_pending_step() -> None:
        next_pending = next((item for item in step_runs if item.status not in {"completed", "skipped"}), None)
        if next_pending is not None:
            run.current_step_id = next_pending.step_id
            run.current_step_index = next_pending.step_index
        else:
            run.current_step_id = None
            run.current_step_index = len(step_runs)

    for step_run in step_runs:
        if step_run.status in {"completed", "skipped"}:
            continue

        plan_step = dict(step_run.input_data or {})
        step_content = _build_agent_plan_step_content(step_run)
        run.status = "running"
        run.current_step_id = step_run.step_id
        run.current_step_index = step_run.step_index
        step_run.status = "running"
        db.commit()

        execution_response = await mcp_server.execute_step(
            mcp_server.StepExecutionRequest(
                chat_id=run.chat_id,
                step_content=step_content,
                user_feedback="",
                step_index=step_run.step_index,
                plan_step=plan_step,
                plan_context=run.context_data or {},
            ),
            db,
        )

        output_payload = {
            "summary": execution_response.result,
            "result": execution_response.result,
            "status": execution_response.status,
            "workflow_run": execution_response.workflow_run,
            "artifacts": normalize_artifacts(execution_response.artifacts),
        }

        if execution_response.status in {"action_required", "workflow_paused"}:
            step_run.status = "paused"
            step_run.output_data = output_payload
            run.status = "paused"
            run.pause_reason = execution_response.status
            _set_agent_plan_output(run, step_run, output_payload)
            _append_chat_event(
                run.chat_id,
                run.employee_id,
                str(execution_response.result or f"步骤“{step_run.step_name}”等待处理。"),
                "workflow_paused",
                {
                    "workflow_run_id": run.id,
                    "run_kind": "agent_plan",
                    "step_id": step_run.step_id,
                    "step_index": step_run.step_index,
                    "artifacts": normalize_artifacts(execution_response.artifacts),
                },
                db,
            )
            db.commit()
            _sync_task_progress(
                run,
                {"name": AGENT_PLAN_WORKFLOW_NAME, "skill_key": AGENT_PLAN_WORKFLOW_KEY},
                step_runs,
                db,
            )
            db.commit()
            return _serialize_agent_plan_run(run, step_runs)

        step_run.status = "completed"
        step_run.output_data = output_payload
        _set_agent_plan_output(run, step_run, output_payload)
        _append_chat_event(
            run.chat_id,
            run.employee_id,
            str(execution_response.result or f"步骤“{step_run.step_name}”已完成。"),
            "workflow_step_result",
            {
                "workflow_run_id": run.id,
                "run_kind": "agent_plan",
                "step_id": step_run.step_id,
                "step_index": step_run.step_index,
                "artifacts": normalize_artifacts(execution_response.artifacts),
            },
            db,
        )
        run.status = "running"
        run.pause_reason = None
        _move_to_next_pending_step()
        db.commit()
        _sync_task_progress(
            run,
            {"name": AGENT_PLAN_WORKFLOW_NAME, "skill_key": AGENT_PLAN_WORKFLOW_KEY},
            step_runs,
            db,
        )
        db.commit()

        if any(item.status not in {"completed", "skipped"} for item in step_runs):
            return _serialize_agent_plan_run(run, step_runs)

        break

    run.status = "completed"
    run.pause_reason = None
    run.current_step_id = None
    run.current_step_index = len(step_runs)
    completion_artifacts = _collect_agent_plan_artifacts(run)
    _append_chat_event(
        run.chat_id,
        run.employee_id,
        "任务计划已执行完成。",
        "workflow_completed",
        {
            "workflow_run_id": run.id,
            "run_kind": "agent_plan",
            "artifacts": completion_artifacts,
        },
        db,
    )
    db.commit()
    _sync_task_progress(
        run,
        {"name": AGENT_PLAN_WORKFLOW_NAME, "skill_key": AGENT_PLAN_WORKFLOW_KEY},
        step_runs,
        db,
    )
    db.commit()
    return _serialize_agent_plan_run(run, step_runs)


async def continue_agent_plan_run(
    run_id: int,
    user_input: str,
    approved: Optional[bool],
    feedback: str,
    db: Session,
) -> dict:
    run = db.query(models.WorkflowRun).filter(models.WorkflowRun.id == run_id).first()
    if run is None:
        raise ValueError("Workflow run not found")
    if not _is_agent_plan_run(run):
        raise ValueError("Workflow run is not an agent plan run")
    if run.status != "paused":
        raise ValueError("Agent plan run is not paused")

    step_runs = _load_step_runs_for_run(run, db)
    current_step_run = next((step_run for step_run in step_runs if step_run.step_id == run.current_step_id), None)
    if current_step_run is None:
        raise ValueError("Paused agent plan step was not found")

    def _move_to_next_pending_step() -> None:
        next_pending = next((item for item in step_runs if item.status not in {"completed", "skipped"}), None)
        if next_pending is not None:
            run.current_step_id = next_pending.step_id
            run.current_step_index = next_pending.step_index
        else:
            run.current_step_id = None
            run.current_step_index = len(step_runs)

    current_output = current_step_run.output_data or {}
    response_text = (feedback or user_input or "").strip()

    if run.pause_reason == "workflow_paused":
        nested_workflow_run = current_output.get("workflow_run") if isinstance(current_output, dict) else None
        nested_workflow_run_id = nested_workflow_run.get("id") if isinstance(nested_workflow_run, dict) else None
        if not nested_workflow_run_id:
            raise ValueError("Paused agent plan step is missing nested workflow run context")

        nested_result = resume_workflow_run(
            run_id=nested_workflow_run_id,
            user_input=user_input,
            approved=approved,
            feedback=feedback,
            db=db,
        )
        output_payload = {
            "summary": _summarize_workflow_run_result(nested_result),
            "result": _summarize_workflow_run_result(nested_result),
            "status": "workflow_paused" if nested_result.get("status") == "paused" else "workflow_completed",
            "workflow_run": nested_result,
            "artifacts": normalize_artifacts(current_output.get("artifacts") if isinstance(current_output, dict) else []),
        }

        if nested_result.get("status") == "paused":
            current_step_run.status = "paused"
            current_step_run.output_data = output_payload
            run.pause_reason = "workflow_paused"
            _set_agent_plan_output(run, current_step_run, output_payload)
            db.commit()
            return _serialize_agent_plan_run(run, step_runs)

        current_step_run.status = "completed"
        current_step_run.output_data = output_payload
        _set_agent_plan_output(run, current_step_run, output_payload)
        run.status = "running"
        run.pause_reason = None
        _move_to_next_pending_step()
        _append_chat_event(
            run.chat_id,
            run.employee_id,
            output_payload["result"],
            "workflow_step_result",
            {
                "workflow_run_id": run.id,
                "run_kind": "agent_plan",
                "step_id": current_step_run.step_id,
                "step_index": current_step_run.step_index,
                "artifacts": output_payload["artifacts"],
            },
            db,
        )
        db.commit()
        _sync_task_progress(
            run,
            {"name": AGENT_PLAN_WORKFLOW_NAME, "skill_key": AGENT_PLAN_WORKFLOW_KEY},
            step_runs,
            db,
        )
        db.commit()
        if not any(item.status not in {"completed", "skipped"} for item in step_runs):
            return await execute_agent_plan_run(run.id, db)
        return _serialize_agent_plan_run(run, step_runs)

    if run.pause_reason != "action_required":
        raise ValueError("Agent plan run is paused for an unsupported reason")

    if not response_text and approved is not True:
        raise ValueError("Paused agent plan step requires feedback or approval to continue")

    import app.mcp_server as mcp_server

    plan_step = dict(current_step_run.input_data or {})
    step_content = _build_agent_plan_step_content(current_step_run)
    run.status = "running"
    run.pause_reason = None
    current_step_run.status = "running"
    db.commit()

    execution_response = await mcp_server.execute_step(
        mcp_server.StepExecutionRequest(
            chat_id=run.chat_id,
            step_content=step_content,
            user_feedback=response_text,
            step_index=current_step_run.step_index,
            plan_step=plan_step,
            plan_context=run.context_data or {},
        ),
        db,
    )

    output_payload = {
        "summary": execution_response.result,
        "result": execution_response.result,
        "status": execution_response.status,
        "workflow_run": execution_response.workflow_run,
        "artifacts": normalize_artifacts(execution_response.artifacts),
    }

    if execution_response.status in {"action_required", "workflow_paused"}:
        current_step_run.status = "paused"
        current_step_run.output_data = output_payload
        run.status = "paused"
        run.pause_reason = execution_response.status
        _set_agent_plan_output(run, current_step_run, output_payload)
        db.commit()
        return _serialize_agent_plan_run(run, step_runs)

    current_step_run.status = "completed"
    current_step_run.output_data = output_payload
    _set_agent_plan_output(run, current_step_run, output_payload)
    run.status = "running"
    run.pause_reason = None
    _move_to_next_pending_step()
    _append_chat_event(
        run.chat_id,
        run.employee_id,
        str(execution_response.result or f"步骤“{current_step_run.step_name}”已完成。"),
        "workflow_step_result",
        {
            "workflow_run_id": run.id,
            "run_kind": "agent_plan",
            "step_id": current_step_run.step_id,
            "step_index": current_step_run.step_index,
            "artifacts": normalize_artifacts(execution_response.artifacts),
        },
        db,
    )
    db.commit()
    _sync_task_progress(
        run,
        {"name": AGENT_PLAN_WORKFLOW_NAME, "skill_key": AGENT_PLAN_WORKFLOW_KEY},
        step_runs,
        db,
    )
    db.commit()
    if not any(item.status not in {"completed", "skipped"} for item in step_runs):
        return await execute_agent_plan_run(run.id, db)
    return _serialize_agent_plan_run(run, step_runs)


def get_workflow_run(run_id: int, db: Session) -> dict:
    run = db.query(models.WorkflowRun).filter(models.WorkflowRun.id == run_id).first()
    if run is None:
        raise ValueError("Workflow run not found")

    step_runs = _load_step_runs_for_run(run, db)

    if _is_agent_plan_run(run):
        return _serialize_agent_plan_run(run, step_runs)

    workflow_skill = _ensure_workflow_skill(run.workflow_skill_key, db)
    return _serialize_workflow_run(run, workflow_skill, step_runs)


def resume_workflow_run(run_id: int, user_input: str, approved: Optional[bool], feedback: str, db: Session) -> dict:
    run = db.query(models.WorkflowRun).filter(models.WorkflowRun.id == run_id).first()
    if run is None:
        raise ValueError("Workflow run not found")
    if _is_agent_plan_run(run):
        raise ValueError("Agent plan runs do not support workflow resume")
    if run.status != "paused":
        raise ValueError("Workflow run is not paused")

    workflow_skill = _ensure_workflow_skill(run.workflow_skill_key, db)
    step_runs = (
        db.query(models.WorkflowStepRun)
        .filter(models.WorkflowStepRun.workflow_run_id == run.id)
        .order_by(models.WorkflowStepRun.step_index.asc())
        .all()
    )
    current_step_run = next((step_run for step_run in step_runs if step_run.step_id == run.current_step_id), None)
    if current_step_run is None:
        raise ValueError("Paused workflow step was not found")

    step = next((item for item in (workflow_skill.get("workflow_steps") or []) if item.get("id") == current_step_run.step_id), None)
    if step is None:
        raise ValueError("Workflow step definition is missing")

    response_text = (feedback or user_input or "").strip()

    if current_step_run.step_type == "feedback_step":
        if approved is True:
            _complete_step(run, current_step_run, step, current_step_run.output_data or {"approved": True})
        elif response_text:
            execution_result = _execute_agent_step(run, workflow_skill, step, db, user_feedback=response_text)
            step_result = execution_result.get("result") or execution_result["summary"]
            current_step_run.output_data = {"summary": execution_result["summary"], "result": step_result, "feedback": response_text}
            _append_step_result_event(
                run,
                workflow_skill,
                current_step_run,
                step_result,
                db,
                awaiting_confirmation=True,
            )
            current_step_run.pause_payload = {
                "prompt": _build_feedback_step_prompt(current_step_run.step_name, rerun=True),
                "draft": step_result,
            }
            _append_chat_event(
                run.chat_id,
                run.employee_id,
                f"步骤“{current_step_run.step_name}”已根据反馈重新生成，等待再次确认。",
                "workflow_paused",
                {"workflow_run_id": run.id, "step_id": current_step_run.step_id, "pause_reason": run.pause_reason},
                db,
            )
            db.commit()
            _sync_task_progress(run, workflow_skill, step_runs, db)
            db.commit()
            return _serialize_workflow_run(run, workflow_skill, step_runs)
        else:
            raise ValueError("Feedback step requires either approval=true or feedback text")
    else:
        raise ValueError("Current workflow step does not support resume")

    run.status = "running"
    _append_chat_event(
        run.chat_id,
        run.employee_id,
        f"工作流“{workflow_skill.get('name') or run.workflow_skill_key}”已继续执行。",
        "workflow_resumed",
        {"workflow_run_id": run.id, "step_id": current_step_run.step_id},
        db,
    )
    db.commit()
    db.refresh(run)
    return _advance_workflow(run, workflow_skill, db)


def cancel_workflow_run(run_id: int, db: Session) -> dict:
    run = db.query(models.WorkflowRun).filter(models.WorkflowRun.id == run_id).first()
    if run is None:
        raise ValueError("Workflow run not found")

    step_runs = (
        db.query(models.WorkflowStepRun)
        .filter(models.WorkflowStepRun.workflow_run_id == run.id)
        .order_by(models.WorkflowStepRun.step_index.asc())
        .all()
    )

    if _is_agent_plan_run(run):
        run.status = "cancelled"
        run.pause_reason = None
        for step_run in step_runs:
            if step_run.status in {"pending", "paused", "running", "planned"}:
                step_run.status = "skipped"

        _append_chat_event(
            run.chat_id,
            run.employee_id,
            "任务计划已取消。",
            "workflow_cancelled",
            {"workflow_run_id": run.id, "run_kind": "agent_plan"},
            db,
        )
        db.commit()
        _sync_task_progress(
            run,
            {"name": AGENT_PLAN_WORKFLOW_NAME, "skill_key": AGENT_PLAN_WORKFLOW_KEY},
            step_runs,
            db,
        )
        db.commit()
        return _serialize_agent_plan_run(run, step_runs)

    workflow_skill = _ensure_workflow_skill(run.workflow_skill_key, db)

    run.status = "cancelled"
    run.pause_reason = None
    for step_run in step_runs:
        if step_run.status in {"pending", "paused", "running"}:
            step_run.status = "skipped"

    _append_chat_event(
        run.chat_id,
        run.employee_id,
        f"工作流“{workflow_skill.get('name') or run.workflow_skill_key}”已取消。",
        "workflow_cancelled",
        {"workflow_run_id": run.id},
        db,
    )
    db.commit()
    _sync_task_progress(run, workflow_skill, step_runs, db)
    db.commit()
    return _serialize_workflow_run(run, workflow_skill, step_runs)