import sys
import tempfile
import unittest
from datetime import datetime
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker


BACKEND_DIR = Path(__file__).resolve().parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))


from app import models, schemas
from app.database import Base
from app.routers.tasks import (
    mark_automation_task_results_read,
    read_automation_task_executions,
    read_automation_task_result_summary,
    read_automation_tasks,
)


class AutomationTaskResultIsolationTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        db_path = Path(self.temp_dir.name) / "test_automation_task_result_isolation.db"
        self.engine = create_engine(
            f"sqlite:///{db_path.as_posix()}",
            connect_args={"check_same_thread": False},
        )
        self.SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=self.engine)
        Base.metadata.create_all(bind=self.engine)
        self.db = self.SessionLocal()

        now = datetime.now()
        for employee_id in ("1", "2"):
            task_id = f"TSK_{employee_id}"
            self.db.add(
                models.Task(
                    task_id=task_id,
                    task_name=f"员工 {employee_id} 的任务",
                    task_type="单次",
                    user_id="U10023",
                    task_content="测试任务",
                    employee_id=employee_id,
                    execute_rule="立即执行",
                    task_status="启用",
                )
            )
            self.db.add(
                models.TaskExecution(
                    execution_id=f"EXE_{employee_id}",
                    task_id=task_id,
                    task_type="单次",
                    user_id="U10023",
                    employee_id=employee_id,
                    planned_execute_time=now,
                    execute_status="成功",
                    trigger_type="计划触发",
                    result_summary=f"员工 {employee_id} 的结果",
                    result_is_read=0,
                )
            )
        self.db.commit()

    def tearDown(self):
        self.db.close()
        self.engine.dispose()
        self.temp_dir.cleanup()

    def test_lists_and_summary_only_return_selected_employee(self):
        tasks = read_automation_tasks(employee_id="1", db=self.db)
        executions = read_automation_task_executions(employee_id="1", db=self.db)
        summary = read_automation_task_result_summary(user_id="U10023", employee_id="1", db=self.db)

        self.assertEqual([task.task_id for task in tasks], ["TSK_1"])
        self.assertEqual([execution.execution_id for execution in executions], ["EXE_1"])
        self.assertEqual(summary.unread_count, 1)
        self.assertEqual([notice.execution_id for notice in summary.notices], ["EXE_1"])

    def test_mark_read_does_not_update_another_employee(self):
        summary = mark_automation_task_results_read(
            schemas.AutomationTaskResultReadRequest(user_id="U10023", employee_id="1"),
            db=self.db,
        )

        employee_one = self.db.query(models.TaskExecution).filter_by(execution_id="EXE_1").one()
        employee_two = self.db.query(models.TaskExecution).filter_by(execution_id="EXE_2").one()
        self.assertEqual(employee_one.result_is_read, 1)
        self.assertEqual(employee_two.result_is_read, 0)
        self.assertEqual(summary.unread_count, 0)


if __name__ == "__main__":
    unittest.main()