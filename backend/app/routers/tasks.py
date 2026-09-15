from calendar import monthrange
from datetime import datetime, timedelta
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import case
from sqlalchemy.orm import Session
from typing import List, Optional
import asyncio

from .. import models, schemas, database
from .employees import _score_employee_recommendation

router = APIRouter(
    prefix="/tasks",
    tags=["tasks"],
    responses={404: {"description": "Not found"}},
)


AUTOMATION_TASK_TYPES = {"单次", "每日", "每周", "每月", "once", "daily", "weekly", "monthly"}
AUTOMATION_TASK_STATUSES = {"启用", "暂停", "已结束", "已删除"}
AUTOMATION_EXECUTION_STATUSES = {"待执行", "执行中", "成功", "失败", "重试中", "已跳过"}
DUPLICATE_SUBMISSION_WINDOW_MINUTES = 5
MIN_EMPLOYEE_CAPABILITY_SCORE = 5
CAPABILITY_REQUIRED_KEYWORDS = {
    "mcp",
    "skill",
    "知识库",
    "数据库",
    "接口",
    "api",
    "联网",
    "搜索",
    "查询",
    "检索",
    "抓取",
    "爬取",
    "实时",
    "最新",
    "web",
}
WEEKDAY_MAP = {
    "MON": 0,
    "TUE": 1,
    "WED": 2,
    "THU": 3,
    "FRI": 4,
    "SAT": 5,
    "SUN": 6,
    "1": 0,
    "2": 1,
    "3": 2,
    "4": 3,
    "5": 4,
    "6": 5,
    "7": 6,
}


def _normalize_task_type(task_type: str) -> str:
    value = (task_type or "").strip().lower()
    mapping = {
        "once": "单次",
        "single": "单次",
        "单次": "单次",
        "daily": "每日",
        "每日": "每日",
        "weekly": "每周",
        "每周": "每周",
        "monthly": "每月",
        "每月": "每月",
    }
    normalized = mapping.get(value)
    if not normalized:
        raise HTTPException(status_code=400, detail=f"Unsupported task_type: {task_type}")
    return normalized


def _parse_clock(value: str) -> tuple[int, int]:
    try:
        hour_text, minute_text = value.strip().split(":", 1)
        hour = int(hour_text)
        minute = int(minute_text)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=f"Invalid time value: {value}") from exc

    if not 0 <= hour <= 23 or not 0 <= minute <= 59:
        raise HTTPException(status_code=400, detail=f"Invalid time value: {value}")
    return hour, minute


def _parse_once_datetime(execute_rule: str) -> datetime:
    rule = (execute_rule or "").strip()
    for fmt in ("%Y-%m-%d %H:%M", "%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M", "%Y-%m-%dT%H:%M:%S"):
        try:
            return datetime.strptime(rule, fmt)
        except ValueError:
            continue

    try:
        return datetime.fromisoformat(rule)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="单次任务 execute_rule 必须是可解析的日期时间") from exc


def _build_next_monthly_run(reference: datetime, day: int, hour: int, minute: int) -> datetime:
    year = reference.year
    month = reference.month

    for _ in range(2):
        last_day = monthrange(year, month)[1]
        candidate = reference.replace(
            year=year,
            month=month,
            day=min(day, last_day),
            hour=hour,
            minute=minute,
            second=0,
            microsecond=0,
        )
        if candidate > reference:
            return candidate

        if month == 12:
            year += 1
            month = 1
        else:
            month += 1

    last_day = monthrange(year, month)[1]
    return reference.replace(
        year=year,
        month=month,
        day=min(day, last_day),
        hour=hour,
        minute=minute,
        second=0,
        microsecond=0,
    )


def _compute_next_execute_time(task_type: str, execute_rule: str, reference: Optional[datetime] = None) -> datetime:
    now = reference or datetime.now()
    normalized_type = _normalize_task_type(task_type)
    rule = (execute_rule or "").strip()

    if normalized_type == "单次":
        candidate = _parse_once_datetime(rule)
        if candidate <= now:
            raise HTTPException(status_code=400, detail="单次任务执行时间必须晚于当前时间，请至少选择下一分钟")
        return candidate

    if normalized_type == "每日":
        hour, minute = _parse_clock(rule)
        candidate = now.replace(hour=hour, minute=minute, second=0, microsecond=0)
        if candidate <= now:
            candidate += timedelta(days=1)
        return candidate

    if normalized_type == "每周":
        parts = rule.split()
        if len(parts) != 2:
            raise HTTPException(status_code=400, detail="每周任务 execute_rule 格式应为 'FRI 15:00' 或 'MON,WED,FRI 15:00'")

        weekday_tokens = [w.strip().upper() for w in parts[0].split(",")]
        weekday_values = []
        for token in weekday_tokens:
            wd = WEEKDAY_MAP.get(token)
            if wd is None:
                raise HTTPException(status_code=400, detail=f"Unsupported weekly weekday: {token}")
            weekday_values.append(wd)
        if not weekday_values:
            raise HTTPException(status_code=400, detail="每周任务至少需要选择一个执行日")

        hour, minute = _parse_clock(parts[1])
        # Find the nearest next execution time from all selected weekdays
        candidates = []
        for weekday_value in weekday_values:
            days_ahead = weekday_value - now.weekday()
            if days_ahead < 0:
                days_ahead += 7
            candidate = (now + timedelta(days=days_ahead)).replace(hour=hour, minute=minute, second=0, microsecond=0)
            if candidate <= now:
                candidate += timedelta(days=7)
            candidates.append(candidate)
        return min(candidates)

    if normalized_type == "每月":
        parts = rule.split()
        if len(parts) != 2:
            raise HTTPException(status_code=400, detail="每月任务 execute_rule 格式应为 '15 15:00' 或 '5,15,25 15:00'")
        day_tokens = [d.strip() for d in parts[0].split(",")]
        day_values = []
        for token in day_tokens:
            try:
                day = int(token)
            except ValueError as exc:
                raise HTTPException(status_code=400, detail=f"Invalid monthly day: {token}") from exc
            if not 1 <= day <= 31:
                raise HTTPException(status_code=400, detail=f"Invalid monthly day: {token}")
            day_values.append(day)
        if not day_values:
            raise HTTPException(status_code=400, detail="每月任务至少需要选择一个执行日")

        hour, minute = _parse_clock(parts[1])
        # Find the nearest next execution time from all selected days
        candidates = [_build_next_monthly_run(now, day, hour, minute) for day in day_values]
        return min(candidates)

    raise HTTPException(status_code=400, detail=f"Unsupported task_type: {task_type}")


def _generate_prefixed_id(prefix: str) -> str:
    return f"{prefix}{datetime.now():%Y%m%d%H%M%S}{uuid4().hex[:4].upper()}"


def _get_automation_task_or_404(db: Session, task_id: str) -> models.Task:
    task = db.query(models.Task).filter(models.Task.task_id == task_id).first()
    if task is None:
        raise HTTPException(status_code=404, detail="Automation task not found")
    return task


def _ensure_task_editable(db: Session, task: models.Task) -> None:
    running_execution = (
        db.query(models.TaskExecution)
        .filter(
            models.TaskExecution.task_id == task.task_id,
            models.TaskExecution.execute_status == "执行中",
        )
        .first()
    )
    if running_execution is not None:
        raise HTTPException(status_code=400, detail="任务执行中，暂不允许编辑")


def _resolve_employee_or_400(db: Session, employee_id: Optional[str]) -> models.AIEmployee:
    normalized_employee_id = str(employee_id or "").strip()
    if not normalized_employee_id:
        raise HTTPException(status_code=400, detail="未选择数字员工")

    try:
        employee_pk = int(normalized_employee_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="数字员工 ID 非法") from exc

    employee = db.query(models.AIEmployee).filter(models.AIEmployee.id == employee_pk).first()
    if employee is None:
        raise HTTPException(status_code=400, detail="所选数字员工不存在")
    if employee.status != "active":
        raise HTTPException(status_code=400, detail="所选数字员工当前不可用")
    return employee


def _validate_employee_capability(db: Session, payload: dict) -> models.AIEmployee:
    employee = _resolve_employee_or_400(db, payload.get("employee_id"))
    task_content = str(payload.get("task_content") or "").strip().lower()
    if not _task_requires_augmented_capabilities(task_content):
        return employee

    score, matched_terms = _score_employee_recommendation(employee, payload.get("task_content") or "")
    capability_count = len(employee.tool_ids or []) + len(employee.workflow_ids or []) + len(employee.knowledge_ids or [])
    if not matched_terms and capability_count == 0:
        raise HTTPException(status_code=400, detail="任务内容超出当前数字员工自动执行能力，请更换数字员工")
    if capability_count == 0 and score < MIN_EMPLOYEE_CAPABILITY_SCORE:
        raise HTTPException(status_code=400, detail="任务内容超出当前数字员工自动执行能力，请更换数字员工")
    return employee


def _task_requires_augmented_capabilities(task_content: str) -> bool:
    normalized = str(task_content or "").strip().lower()
    if not normalized:
        return False

    return any(keyword in normalized for keyword in CAPABILITY_REQUIRED_KEYWORDS)


def _guard_duplicate_submission(db: Session, payload: dict, current_task_id: Optional[str] = None) -> None:
    duplicate_cutoff = datetime.now() - timedelta(minutes=DUPLICATE_SUBMISSION_WINDOW_MINUTES)
    query = (
        db.query(models.Task)
        .filter(models.Task.user_id == payload.get("user_id"))
        .filter(models.Task.task_content == payload.get("task_content"))
        .filter(models.Task.employee_id == str(payload.get("employee_id")))
        .filter(models.Task.created_at >= duplicate_cutoff)
        .filter(models.Task.task_status != "已删除")
    )
    if current_task_id:
        query = query.filter(models.Task.task_id != current_task_id)

    if query.first() is not None:
        raise HTTPException(status_code=409, detail="疑似重复创建：你刚刚已提交过相同任务，请确认是否重复")


def _build_task_payload(payload: dict, current: Optional[models.Task] = None) -> dict:
    normalized = dict(payload)
    task_type = normalized.get("task_type") or (current.task_type if current else None)
    execute_rule = normalized.get("execute_rule") or (current.execute_rule if current else None)
    start_time = normalized.get("start_time") if "start_time" in normalized else (current.start_time if current else None)
    end_time = normalized.get("end_time") if "end_time" in normalized else (current.end_time if current else None)

    if not task_type:
        raise HTTPException(status_code=400, detail="task_type is required")
    if not execute_rule:
        raise HTTPException(status_code=400, detail="execute_rule is required")

    normalized["task_type"] = _normalize_task_type(task_type)
    normalized["execute_rule"] = execute_rule.strip()

    next_reference = start_time if start_time and start_time > datetime.now() else datetime.now()
    next_execute_time = _compute_next_execute_time(normalized["task_type"], normalized["execute_rule"], next_reference)

    if start_time and next_execute_time < start_time:
        next_execute_time = _compute_next_execute_time(normalized["task_type"], normalized["execute_rule"], start_time)

    if end_time and start_time and end_time < start_time:
        raise HTTPException(status_code=400, detail="结束时间不能早于开始时间")
    if end_time and next_execute_time > end_time:
        raise HTTPException(status_code=400, detail="根据当前周期规则，任务已超出结束时间")

    normalized["next_execute_time"] = next_execute_time
    normalized["task_status"] = normalized.get("task_status") or (current.task_status if current else "启用")
    if normalized["task_status"] not in AUTOMATION_TASK_STATUSES:
        raise HTTPException(status_code=400, detail=f"Unsupported task_status: {normalized['task_status']}")

    return normalized


def _sync_task_after_execution(task: models.Task, execution: models.TaskExecution) -> None:
    task.last_execute_result = execution.result_summary or execution.error_message
    if execution.execute_status in {"成功", "失败", "已跳过"}:
        execution.result_is_read = 0

    if execution.execute_status == "成功":
        if task.task_type == "单次":
            task.task_status = "已结束"
            task.next_execute_time = None
            return

        if task.task_status == "启用":
            task.next_execute_time = _compute_next_execute_time(task.task_type, task.execute_rule)
            if task.end_time and task.next_execute_time and task.next_execute_time > task.end_time:
                task.task_status = "已结束"
                task.next_execute_time = None

@router.post("/automation", response_model=schemas.AutomationTask)
def create_automation_task(task: schemas.AutomationTaskCreate, db: Session = Depends(database.get_db)):
    payload = _build_task_payload(task.dict())
    employee = _validate_employee_capability(db, payload)
    _guard_duplicate_submission(db, payload)
    payload["employee_id"] = str(employee.id)
    db_task = models.Task(
        task_id=_generate_prefixed_id("TSK"),
        executor_role="digital_employee",
        **payload,
    )
    db.add(db_task)
    db.commit()
    db.refresh(db_task)
    return db_task


@router.get("/automation", response_model=List[schemas.AutomationTask])
def read_automation_tasks(
    user_id: Optional[str] = None,
    employee_id: Optional[str] = None,
    keyword: Optional[str] = None,
    task_type: Optional[str] = None,
    task_status: Optional[str] = None,
    include_deleted: bool = False,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(database.get_db),
):
    query = db.query(models.Task)
    if user_id:
        query = query.filter(models.Task.user_id == user_id)
    if employee_id:
        query = query.filter(models.Task.employee_id == employee_id)
    if keyword:
        query = query.filter(models.Task.task_name.contains(keyword))
    if task_type:
        query = query.filter(models.Task.task_type == _normalize_task_type(task_type))
    if task_status:
        if task_status not in AUTOMATION_TASK_STATUSES:
            raise HTTPException(status_code=400, detail=f"Unsupported task_status: {task_status}")
        query = query.filter(models.Task.task_status == task_status)
    elif not include_deleted:
        query = query.filter(models.Task.task_status != "已删除")

    status_priority = case(
        (models.Task.task_status == "启用", 0),
        (models.Task.task_status == "暂停", 1),
        (models.Task.task_status == "已结束", 2),
        else_=3,
    )
    enabled_has_no_schedule = case(
        (models.Task.task_status == "启用", case((models.Task.next_execute_time.is_(None), 1), else_=0)),
        else_=0,
    )
    enabled_next_execute_time = case(
        (models.Task.task_status == "启用", models.Task.next_execute_time),
        else_=None,
    )
    non_enabled_updated_at = case(
        (models.Task.task_status != "启用", models.Task.updated_at),
        else_=None,
    )

    return (
        query.order_by(
            status_priority.asc(),
            enabled_has_no_schedule.asc(),
            enabled_next_execute_time.asc(),
            non_enabled_updated_at.desc(),
            models.Task.created_at.desc(),
        )
        .offset(skip)
        .limit(limit)
        .all()
    )


@router.get("/automation/executions", response_model=List[schemas.AutomationTaskExecution])
def read_automation_task_executions(
    task_id: Optional[str] = None,
    user_id: Optional[str] = None,
    employee_id: Optional[str] = None,
    task_type: Optional[str] = None,
    execute_status: Optional[str] = None,
    start_after: Optional[datetime] = None,
    start_before: Optional[datetime] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(database.get_db),
):
    query = db.query(models.TaskExecution)
    if task_id:
        query = query.filter(models.TaskExecution.task_id == task_id)
    if user_id:
        query = query.filter(models.TaskExecution.user_id == user_id)
    if employee_id:
        query = query.filter(models.TaskExecution.employee_id == employee_id)
    if task_type:
        query = query.filter(models.TaskExecution.task_type == _normalize_task_type(task_type))
    if execute_status:
        if execute_status not in AUTOMATION_EXECUTION_STATUSES:
            raise HTTPException(status_code=400, detail=f"Unsupported execute_status: {execute_status}")
        query = query.filter(models.TaskExecution.execute_status == execute_status)
    if start_after:
        query = query.filter(models.TaskExecution.start_time >= start_after)
    if start_before:
        query = query.filter(models.TaskExecution.start_time <= start_before)

    return query.order_by(models.TaskExecution.created_at.desc()).offset(skip).limit(limit).all()


@router.get("/automation/result-summary", response_model=schemas.AutomationTaskResultSummary)
def read_automation_task_result_summary(
    user_id: str,
    employee_id: Optional[str] = None,
    unread_only: bool = False,
    limit: int = 5,
    db: Session = Depends(database.get_db),
):
    base_query = (
        db.query(models.TaskExecution, models.Task)
        .join(models.Task, models.Task.task_id == models.TaskExecution.task_id)
        .filter(models.TaskExecution.user_id == user_id)
        .filter(models.TaskExecution.execute_status.in_(["成功", "失败", "已跳过"]))
    )
    if employee_id:
        base_query = base_query.filter(models.TaskExecution.employee_id == employee_id)
    unread_count = base_query.filter(models.TaskExecution.result_is_read == 0).count()
    if unread_only:
        base_query = base_query.filter(models.TaskExecution.result_is_read == 0)

    rows = base_query.order_by(models.TaskExecution.created_at.desc()).limit(max(1, min(limit, 20))).all()
    notices = [
        schemas.AutomationTaskResultNotice(
            execution_id=execution.execution_id,
            task_id=execution.task_id,
            task_name=task.task_name,
            task_type=execution.task_type,
            execute_status=execution.execute_status,
            result_text=execution.result_summary or execution.error_message or "暂无结果摘要",
            trigger_type=execution.trigger_type,
            start_time=execution.start_time,
            end_time=execution.end_time,
            result_is_read=bool(execution.result_is_read),
        )
        for execution, task in rows
    ]
    return schemas.AutomationTaskResultSummary(unread_count=unread_count, notices=notices)


@router.post("/automation/result-summary/mark-read", response_model=schemas.AutomationTaskResultSummary)
def mark_automation_task_results_read(
    payload: schemas.AutomationTaskResultReadRequest,
    db: Session = Depends(database.get_db),
):
    query = db.query(models.TaskExecution).filter(models.TaskExecution.user_id == payload.user_id)
    if payload.employee_id:
        query = query.filter(models.TaskExecution.employee_id == payload.employee_id)
    if payload.execution_ids:
        query = query.filter(models.TaskExecution.execution_id.in_(payload.execution_ids))
    else:
        query = query.filter(models.TaskExecution.result_is_read == 0)

    query.update({models.TaskExecution.result_is_read: 1}, synchronize_session=False)
    db.commit()
    return read_automation_task_result_summary(
        user_id=payload.user_id,
        employee_id=payload.employee_id,
        unread_only=False,
        limit=5,
        db=db,
    )


@router.get("/automation/executions/{execution_id}", response_model=schemas.AutomationTaskExecution)
def read_automation_task_execution(execution_id: str, db: Session = Depends(database.get_db)):
    execution = db.query(models.TaskExecution).filter(models.TaskExecution.execution_id == execution_id).first()
    if execution is None:
        raise HTTPException(status_code=404, detail="Task execution not found")
    return execution


@router.get("/automation/{task_id}", response_model=schemas.AutomationTask)
def read_automation_task(task_id: str, db: Session = Depends(database.get_db)):
    return _get_automation_task_or_404(db, task_id)


@router.put("/automation/{task_id}", response_model=schemas.AutomationTask)
def update_automation_task(task_id: str, task: schemas.AutomationTaskUpdate, db: Session = Depends(database.get_db)):
    db_task = _get_automation_task_or_404(db, task_id)
    _ensure_task_editable(db, db_task)

    updates = _build_task_payload(task.dict(exclude_unset=True), current=db_task)
    employee = _validate_employee_capability(db, updates)
    _guard_duplicate_submission(db, updates, current_task_id=db_task.task_id)
    updates["employee_id"] = str(employee.id)
    for key, value in updates.items():
        setattr(db_task, key, value)

    db.commit()
    db.refresh(db_task)
    return db_task


@router.post("/automation/{task_id}/start", response_model=schemas.AutomationTaskStatusResponse)
def start_automation_task(task_id: str, db: Session = Depends(database.get_db)):
    db_task = _get_automation_task_or_404(db, task_id)
    if db_task.task_status == "已删除":
        raise HTTPException(status_code=400, detail="已删除任务不能重新开始")

    db_task.task_status = "启用"

    now = datetime.now()
    manual_execution = models.TaskExecution(
        execution_id=_generate_prefixed_id("EXE"),
        task_id=db_task.task_id,
        task_type=db_task.task_type,
        user_id=db_task.user_id,
        employee_id=db_task.employee_id,
        employee_source=db_task.employee_source,
        planned_execute_time=now,
        start_time=None,
        end_time=None,
        execute_status="待执行",
        retry_count=0,
        trigger_type="手动触发",
        executor_role=db_task.executor_role,
        result_is_read=0,
    )
    db.add(manual_execution)
    db.flush()

    if db_task.task_type == "单次":
        if db_task.start_time and db_task.start_time > now:
            db_task.next_execute_time = db_task.start_time
        else:
            db_task.next_execute_time = None
    else:
        db_task.next_execute_time = _compute_next_execute_time(
            db_task.task_type,
            db_task.execute_rule,
            db_task.start_time if db_task.start_time and db_task.start_time > now else now,
        )
        if db_task.end_time and db_task.next_execute_time > db_task.end_time:
            raise HTTPException(status_code=400, detail="任务已超出结束时间，无法开始")

    db.commit()

    from ..services.automation_scheduler import automation_task_scheduler

    try:
        loop = asyncio.get_running_loop()
        loop.create_task(automation_task_scheduler._execute_pending_execution(manual_execution.execution_id))
    except RuntimeError:
        asyncio.run(automation_task_scheduler._execute_pending_execution(manual_execution.execution_id))

    return schemas.AutomationTaskStatusResponse(
        task_id=db_task.task_id,
        task_status=db_task.task_status,
        next_execute_time=db_task.next_execute_time,
    )


@router.post("/automation/{task_id}/pause", response_model=schemas.AutomationTaskStatusResponse)
def pause_automation_task(task_id: str, db: Session = Depends(database.get_db)):
    db_task = _get_automation_task_or_404(db, task_id)
    db_task.task_status = "暂停"
    db.commit()
    return schemas.AutomationTaskStatusResponse(
        task_id=db_task.task_id,
        task_status=db_task.task_status,
        next_execute_time=db_task.next_execute_time,
    )


@router.delete("/automation/{task_id}", response_model=schemas.AutomationTaskStatusResponse)
def delete_automation_task(task_id: str, db: Session = Depends(database.get_db)):
    db_task = _get_automation_task_or_404(db, task_id)
    db_task.task_status = "已删除"
    db_task.next_execute_time = None
    db.commit()
    return schemas.AutomationTaskStatusResponse(
        task_id=db_task.task_id,
        task_status=db_task.task_status,
        next_execute_time=db_task.next_execute_time,
    )


@router.get("/automation/{task_id}/executions", response_model=List[schemas.AutomationTaskExecution])
def read_automation_task_executions_by_task(
    task_id: str,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(database.get_db),
):
    _get_automation_task_or_404(db, task_id)
    return (
        db.query(models.TaskExecution)
        .filter(models.TaskExecution.task_id == task_id)
        .order_by(models.TaskExecution.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )


@router.post("/automation/{task_id}/executions", response_model=schemas.AutomationTaskExecution)
def create_automation_task_execution(
    task_id: str,
    execution: schemas.AutomationTaskExecutionCreate,
    db: Session = Depends(database.get_db),
):
    if execution.execute_status not in AUTOMATION_EXECUTION_STATUSES:
        raise HTTPException(status_code=400, detail=f"Unsupported execute_status: {execution.execute_status}")

    db_task = _get_automation_task_or_404(db, task_id)
    db_execution = models.TaskExecution(
        execution_id=_generate_prefixed_id("EXE"),
        task_id=db_task.task_id,
        task_type=db_task.task_type,
        user_id=db_task.user_id,
        employee_id=execution.employee_id or db_task.employee_id,
        employee_source=execution.employee_source or db_task.employee_source,
        executor_role=db_task.executor_role,
        planned_execute_time=execution.planned_execute_time,
        start_time=execution.start_time,
        end_time=execution.end_time,
        execute_status=execution.execute_status,
        retry_count=execution.retry_count,
        trigger_type=execution.trigger_type,
        result_summary=execution.result_summary,
        error_message=execution.error_message,
        result_is_read=0 if execution.execute_status in {"成功", "失败", "已跳过"} else 1,
    )
    db.add(db_execution)
    _sync_task_after_execution(db_task, db_execution)
    db.commit()
    db.refresh(db_execution)
    return db_execution


@router.post("/", response_model=schemas.TaskProgress)
def create_task(task: schemas.TaskProgressCreate, db: Session = Depends(database.get_db)):
    db_task = models.TaskProgress(**task.dict())
    db.add(db_task)
    db.commit()
    db.refresh(db_task)
    return db_task


@router.get("/", response_model=List[schemas.TaskProgress])
def read_tasks(chat_id: Optional[int] = None, skip: int = 0, limit: int = 100, db: Session = Depends(database.get_db)):
    query = db.query(models.TaskProgress)
    if chat_id:
        query = query.filter(models.TaskProgress.chat_id == chat_id)
    tasks = query.offset(skip).limit(limit).all()
    return tasks


@router.get("/{task_id}", response_model=schemas.TaskProgress)
def read_task(task_id: int, db: Session = Depends(database.get_db)):
    db_task = db.query(models.TaskProgress).filter(models.TaskProgress.id == task_id).first()
    if db_task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    return db_task


@router.put("/{task_id}", response_model=schemas.TaskProgress)
def update_task(task_id: int, task: schemas.TaskProgressCreate, db: Session = Depends(database.get_db)):
    db_task = db.query(models.TaskProgress).filter(models.TaskProgress.id == task_id).first()
    if db_task is None:
        raise HTTPException(status_code=404, detail="Task not found")

    for key, value in task.dict().items():
        setattr(db_task, key, value)

    db.commit()
    db.refresh(db_task)
    return db_task
