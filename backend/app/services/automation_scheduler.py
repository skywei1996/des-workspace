import asyncio
import logging
from datetime import datetime, timedelta
from typing import Optional

from sqlalchemy.orm import Session

from .. import database, models
from ..routers.tasks import _compute_next_execute_time
from .dispatcher_service import DispatcherService


logger = logging.getLogger(__name__)

POLL_INTERVAL_SECONDS = 15
MAX_AUTOMATION_RETRIES = 3
RETRY_INTERVAL_MINUTES = 10


class AutomationTaskScheduler:
    def __init__(self) -> None:
        self._runner: Optional[asyncio.Task] = None
        self._stop_event: Optional[asyncio.Event] = None
        self._run_lock = asyncio.Lock()

    def start(self) -> None:
        if self._runner and not self._runner.done():
            return

        self._stop_event = asyncio.Event()
        self._runner = asyncio.create_task(self._run_loop())
        logger.info("Automation task scheduler started")

    async def stop(self) -> None:
        if not self._runner:
            return

        if self._stop_event:
            self._stop_event.set()

        try:
            await self._runner
        finally:
            self._runner = None
            self._stop_event = None
            logger.info("Automation task scheduler stopped")

    async def _run_loop(self) -> None:
        while self._stop_event and not self._stop_event.is_set():
            try:
                await self.run_due_tasks_once()
            except Exception:
                logger.exception("Automation task scheduler tick failed")

            try:
                await asyncio.wait_for(self._stop_event.wait(), timeout=POLL_INTERVAL_SECONDS)
            except asyncio.TimeoutError:
                continue

    async def run_due_tasks_once(self) -> None:
        async with self._run_lock:
            due_execution_ids = self._list_due_execution_ids()
            for execution_id in due_execution_ids:
                await self._execute_pending_execution(execution_id)

            due_task_ids = self._list_due_task_ids()
            for task_id in due_task_ids:
                await self._enqueue_and_execute_task(task_id)

    def _list_due_execution_ids(self) -> list[str]:
        db = database.SessionLocal()
        try:
            now = datetime.now()
            rows = (
                db.query(models.TaskExecution.execution_id)
                .filter(models.TaskExecution.start_time.is_(None))
                .filter(models.TaskExecution.planned_execute_time <= now)
                .filter(models.TaskExecution.execute_status.in_(["待执行", "重试中"]))
                .order_by(models.TaskExecution.planned_execute_time.asc(), models.TaskExecution.created_at.asc())
                .all()
            )
            return [execution_id for (execution_id,) in rows]
        finally:
            db.close()

    def _list_due_task_ids(self) -> list[str]:
        db = database.SessionLocal()
        try:
            now = datetime.now()
            due_tasks = (
                db.query(models.Task)
                .filter(models.Task.task_status == "启用")
                .filter(models.Task.next_execute_time.isnot(None))
                .filter(models.Task.next_execute_time <= now)
                .order_by(models.Task.next_execute_time.asc(), models.Task.created_at.asc())
                .all()
            )

            pending_task_ids = {
                task_id
                for (task_id,) in db.query(models.TaskExecution.task_id)
                .filter(models.TaskExecution.start_time.is_(None))
                .filter(models.TaskExecution.execute_status.in_(["待执行", "重试中"]))
                .all()
            }

            return [task.task_id for task in due_tasks if task.task_id not in pending_task_ids]
        finally:
            db.close()

    async def _enqueue_and_execute_task(self, task_id: str) -> None:
        db = database.SessionLocal()
        try:
            task = db.query(models.Task).filter(models.Task.task_id == task_id).first()
            if task is None or task.task_status != "启用" or task.next_execute_time is None:
                return

            execution = models.TaskExecution(
                execution_id=self._generate_prefixed_id("EXE"),
                task_id=task.task_id,
                task_type=task.task_type,
                user_id=task.user_id,
                employee_id=task.employee_id,
                employee_source=task.employee_source,
                planned_execute_time=task.next_execute_time,
                execute_status="待执行",
                retry_count=0,
                trigger_type="计划触发",
                executor_role=task.executor_role,
            )
            db.add(execution)
            db.commit()
            execution_id = execution.execution_id
        finally:
            db.close()

        await self._execute_pending_execution(execution_id)

    async def _execute_pending_execution(self, execution_id: str) -> None:
        db = database.SessionLocal()
        try:
            execution = db.query(models.TaskExecution).filter(models.TaskExecution.execution_id == execution_id).first()
            if execution is None or execution.start_time is not None:
                return

            task = db.query(models.Task).filter(models.Task.task_id == execution.task_id).first()
            if task is None:
                execution.execute_status = "已跳过"
                execution.error_message = "关联任务不存在"
                execution.start_time = datetime.now()
                execution.end_time = execution.start_time
                db.commit()
                return

            if task.task_status != "启用":
                execution.execute_status = "已跳过"
                execution.error_message = f"任务当前状态为{task.task_status}，本次执行跳过"
                execution.start_time = datetime.now()
                execution.end_time = execution.start_time
                db.commit()
                return

            employee = self._resolve_employee(db, task.employee_id)
            if employee is None or employee.status != "active":
                now = datetime.now()
                execution.execute_status = "失败"
                execution.error_message = "数字员工已失效或当前不可用"
                execution.start_time = now
                execution.end_time = now
                task.task_status = "暂停"
                task.next_execute_time = None
                task.last_execute_result = execution.error_message
                db.commit()
                return

            execution.execute_status = "执行中"
            execution.start_time = datetime.now()
            execution.end_time = None
            execution.employee_id = str(employee.id)
            task.employee_id = str(employee.id)
            db.commit()

            try:
                response = await DispatcherService(db).answer_direct_response(
                    chat_id=self._build_scheduler_chat_id(task, execution),
                    user_message=task.task_content,
                    employee_id=employee.id,
                )
            except Exception as exc:
                self._handle_execution_failure(db, task, execution, str(exc))
                db.commit()
                return

            execution.end_time = datetime.now()
            execution.execute_status = "成功"
            execution.result_summary = self._trim_text(response.result)
            execution.error_message = None
            execution.result_is_read = 0
            task.last_execute_result = execution.result_summary
            self._append_task_result_chat_message(
                db,
                task=task,
                execution=execution,
                employee=employee,
                status="成功",
                result_text=execution.result_summary,
            )
            self._advance_task_schedule(db, task, execution)
            db.commit()
        finally:
            db.close()

    def _handle_execution_failure(
        self,
        db: Session,
        task: models.Task,
        execution: models.TaskExecution,
        error_message: str,
    ) -> None:
        execution.end_time = datetime.now()
        execution.execute_status = "失败"
        execution.result_summary = None
        execution.error_message = self._trim_text(error_message)
        execution.result_is_read = 0
        task.last_execute_result = execution.error_message
        employee = self._resolve_employee(db, task.employee_id)
        self._append_task_result_chat_message(
            db,
            task=task,
            execution=execution,
            employee=employee,
            status="失败",
            result_text=execution.error_message,
        )

        if execution.retry_count < MAX_AUTOMATION_RETRIES:
            retry_time = execution.end_time + timedelta(minutes=RETRY_INTERVAL_MINUTES)
            retry_execution = models.TaskExecution(
                execution_id=self._generate_prefixed_id("EXE"),
                task_id=task.task_id,
                task_type=task.task_type,
                user_id=task.user_id,
                employee_id=task.employee_id,
                employee_source=task.employee_source,
                planned_execute_time=retry_time,
                execute_status="重试中",
                retry_count=execution.retry_count + 1,
                trigger_type="自动重试",
                executor_role=task.executor_role,
                error_message=execution.error_message,
            )
            db.add(retry_execution)
            task.next_execute_time = retry_time
            return

        self._advance_task_schedule(db, task, execution)

    def _advance_task_schedule(
        self,
        db: Session,
        task: models.Task,
        execution: models.TaskExecution,
    ) -> None:
        if task.task_type == "单次":
            task.task_status = "已结束"
            task.next_execute_time = None
            return

        reference_time = self._resolve_next_schedule_reference(db, execution)
        next_execute_time = _compute_next_execute_time(
            task.task_type,
            task.execute_rule,
            reference_time + timedelta(seconds=1),
        )
        if task.end_time and next_execute_time > task.end_time:
            task.task_status = "已结束"
            task.next_execute_time = None
            return

        task.next_execute_time = next_execute_time

    def _resolve_next_schedule_reference(self, db: Session, execution: models.TaskExecution) -> datetime:
        if execution.trigger_type == "计划触发":
            return execution.planned_execute_time

        latest_planned_execution = (
            db.query(models.TaskExecution)
            .filter(models.TaskExecution.task_id == execution.task_id)
            .filter(models.TaskExecution.trigger_type == "计划触发")
            .filter(models.TaskExecution.created_at <= execution.created_at)
            .order_by(models.TaskExecution.planned_execute_time.desc(), models.TaskExecution.created_at.desc())
            .first()
        )
        if latest_planned_execution is not None:
            return latest_planned_execution.planned_execute_time
        return execution.planned_execute_time

    def _resolve_employee(self, db: Session, employee_id: Optional[str]) -> Optional[models.AIEmployee]:
        normalized = str(employee_id or "").strip()
        if not normalized:
            return None
        try:
            employee_pk = int(normalized)
        except ValueError:
            return None
        return db.query(models.AIEmployee).filter(models.AIEmployee.id == employee_pk).first()

    def _append_task_result_chat_message(
        self,
        db: Session,
        *,
        task: models.Task,
        execution: models.TaskExecution,
        employee: Optional[models.AIEmployee],
        status: str,
        result_text: Optional[str],
    ) -> None:
        chat_id = self._build_scheduler_chat_id(task, execution)
        if chat_id is None:
            return

        summary_text = self._trim_text(result_text, limit=1500) or ("任务已执行完成" if status == "成功" else "任务执行失败")
        header = f"自动化任务《{task.task_name}》{status}。"
        content = f"{header}\n\n任务内容：{task.task_content}\n\n{'执行结果' if status == '成功' else '失败原因'}：{summary_text}"
        db.add(models.ChatMessage(
            chat_id=chat_id,
            sender_role="assistant",
            employee_id=employee.id if employee else None,
            content=content,
            message_type="text",
            meta_data={
                "source": "automation_task",
                "task_id": task.task_id,
                "execution_id": execution.execution_id,
                "task_name": task.task_name,
                "task_status": status,
                "planned_execute_time": execution.planned_execute_time.isoformat() if execution.planned_execute_time else None,
            },
        ))

    def _resolve_employee_chat_id(self, task: models.Task, employee: Optional[models.AIEmployee]) -> Optional[int]:
        if not task or not task.task_id:
            return None

        employee_id = getattr(employee, 'id', None)
        if employee_id is None:
            normalized_employee_id = str(task.employee_id or "").strip()
            if not normalized_employee_id:
                return None
            try:
                employee_id = int(normalized_employee_id)
            except ValueError:
                return None

        return self._build_task_result_chat_id(task.task_id, employee_id)

    def _build_task_result_chat_id(self, task_id: str, employee_id: Optional[int | str]) -> int:
        normalized_employee_id = str(employee_id or "").strip()
        if not normalized_employee_id:
            return 0
        seed = f"automation-task-chat:{task_id}:{normalized_employee_id}"
        stable_hash = 0
        for char in seed:
            stable_hash = ((stable_hash << 5) - stable_hash + ord(char)) & 0xFFFFFFFF
        return stable_hash % 2_000_000_000 + 1

    def _build_scheduler_chat_id(self, task: models.Task, execution: models.TaskExecution) -> int:
        employee_id = execution.employee_id or task.employee_id
        return self._build_task_result_chat_id(task.task_id, employee_id)

    def _generate_prefixed_id(self, prefix: str) -> str:
        return f"{prefix}{datetime.now().strftime('%Y%m%d%H%M%S%f')}"

    def _trim_text(self, value: Optional[str], limit: int = 1000) -> Optional[str]:
        if value is None:
            return None
        text = str(value).strip()
        if len(text) <= limit:
            return text
        return f"{text[: limit - 3]}..."


automation_task_scheduler = AutomationTaskScheduler()