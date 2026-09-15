import sys
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker


BACKEND_DIR = Path(__file__).resolve().parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))


from app import models
from app.database import Base
from app.routers import tasks as task_routes
from app.services.automation_scheduler import AutomationTaskScheduler


class AutomationSchedulerChatSyncTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        db_path = Path(self.temp_dir.name) / "test_automation_scheduler.db"
        self.engine = create_engine(
            f"sqlite:///{db_path.as_posix()}",
            connect_args={"check_same_thread": False},
        )
        self.SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=self.engine)
        Base.metadata.create_all(bind=self.engine)

        self.db = self.SessionLocal()
        employee = models.AIEmployee(
            id=11,
            name="Eli-英语教练",
            status="active",
            role_title="英语口语与写作教练",
            tool_ids=[],
            workflow_ids=[],
            knowledge_ids=[],
        )
        task = models.Task(
            task_id="TSK_TEST_001",
            task_name="每日英语单词",
            task_type="单次",
            user_id="U10023",
            task_content="每天推荐 5 个英语单词，并给出词义和例句。",
            employee_id="11",
            employee_source="admin_created",
            execute_rule="2026-04-29 18:00",
            next_execute_time=None,
            task_status="启用",
        )
        execution = models.TaskExecution(
            execution_id="EXE_TEST_001",
            task_id="TSK_TEST_001",
            task_type="单次",
            user_id="U10023",
            employee_id="11",
            employee_source="admin_created",
            planned_execute_time=None,
            execute_status="待执行",
            retry_count=0,
            trigger_type="计划触发",
            executor_role="digital_employee",
        )
        self.db.add(employee)
        self.db.add(task)
        self.db.add(execution)
        self.db.commit()
        self.db.close()

    async def asyncTearDown(self):
        if hasattr(self, "db"):
            self.db.close()
        self.engine.dispose()
        self.temp_dir.cleanup()

    async def test_execute_pending_execution_persists_result_to_task_chat(self):
        scheduler = AutomationTaskScheduler()

        with patch("app.services.automation_scheduler.database.SessionLocal", self.SessionLocal), patch(
            "app.services.automation_scheduler.DispatcherService.answer_direct_response",
            new=AsyncMock(return_value=SimpleNamespace(result="已整理 5 个英语单词及例句。")),
        ):
            await scheduler._execute_pending_execution("EXE_TEST_001")

        db = self.SessionLocal()
        try:
            task = db.query(models.Task).filter(models.Task.task_id == "TSK_TEST_001").first()
            employee = db.query(models.AIEmployee).filter(models.AIEmployee.id == 11).first()
            expected_chat_id = scheduler._resolve_employee_chat_id(task, employee)
            messages = db.query(models.ChatMessage).filter(models.ChatMessage.chat_id == expected_chat_id).all()
            self.assertEqual(len(messages), 1)
            self.assertEqual(messages[0].sender_role, "assistant")
            self.assertEqual(messages[0].employee_id, 11)
            self.assertIn("自动化任务《每日英语单词》成功", messages[0].content)
            self.assertIn("已整理 5 个英语单词及例句", messages[0].content)
            self.assertEqual((messages[0].meta_data or {}).get("source"), "automation_task")
        finally:
            db.close()

    def test_task_result_uses_task_scoped_chat_id(self):
        scheduler = AutomationTaskScheduler()
        task = self.db.query(models.Task).filter(models.Task.task_id == "TSK_TEST_001").first()
        employee = self.db.query(models.AIEmployee).filter(models.AIEmployee.id == 11).first()

        expected_chat_id = scheduler._resolve_employee_chat_id(task, employee)
        self.assertEqual(scheduler._resolve_employee_chat_id(task, employee), expected_chat_id)
        self.assertEqual(scheduler._build_scheduler_chat_id(task, models.TaskExecution(execution_id="EXE_TEST_002", task_id=task.task_id, employee_id="11")), expected_chat_id)

    def test_start_automation_task_executes_immediately(self):
        db = self.SessionLocal()
        try:
            employee = db.query(models.AIEmployee).filter(models.AIEmployee.id == 11).first()
            if employee is None:
                db.add(models.AIEmployee(
                    id=11,
                    name="Eli-英语教练",
                    status="active",
                    role_title="英语口语与写作教练",
                    tool_ids=[],
                    workflow_ids=[],
                    knowledge_ids=[],
                ))
                db.commit()

            task = db.query(models.Task).filter(models.Task.task_id == "TSK_TEST_001").first()
            task.task_status = "暂停"
            task.next_execute_time = None
            db.commit()

            async_mock = AsyncMock(return_value=None)
            with patch("app.services.automation_scheduler.automation_task_scheduler._execute_pending_execution", async_mock):
                response = task_routes.start_automation_task("TSK_TEST_001", db=db)

            self.assertTrue(response.ok)
            self.assertEqual(response.task_status, "启用")
            self.assertEqual(async_mock.await_count, 1)

            executions = db.query(models.TaskExecution).filter(models.TaskExecution.task_id == "TSK_TEST_001").all()
            self.assertGreaterEqual(len(executions), 2)
            self.assertTrue(any(execution.trigger_type == "手动触发" for execution in executions))
        finally:
            db.close()


if __name__ == "__main__":
    unittest.main()