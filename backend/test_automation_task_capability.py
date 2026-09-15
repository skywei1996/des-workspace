import sys
import tempfile
import unittest
from pathlib import Path

from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker


BACKEND_DIR = Path(__file__).resolve().parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))


from app import models
from app.database import Base
from app.routers.tasks import _validate_employee_capability


class AutomationTaskCapabilityValidationTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        db_path = Path(self.temp_dir.name) / "test_automation_task_capability.db"
        self.engine = create_engine(
            f"sqlite:///{db_path.as_posix()}",
            connect_args={"check_same_thread": False},
        )
        self.SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=self.engine)
        Base.metadata.create_all(bind=self.engine)
        self.db = self.SessionLocal()

        self.db.add_all(
            [
                models.AIEmployee(
                    id=1,
                    name="通用员工",
                    status="active",
                    role_title="通用助理",
                    tool_ids=[],
                    workflow_ids=[],
                    knowledge_ids=[],
                ),
                models.AIEmployee(
                    id=2,
                    name="增强员工",
                    status="active",
                    role_title="研究助理",
                    tool_ids=["tavily_search"],
                    workflow_ids=[],
                    knowledge_ids=[],
                ),
            ]
        )
        self.db.commit()

    def tearDown(self):
        self.db.close()
        self.engine.dispose()
        self.temp_dir.cleanup()

    def test_general_task_is_allowed_for_employee_without_extra_capabilities(self):
        employee = _validate_employee_capability(
            self.db,
            {
                "employee_id": "1",
                "task_content": "提醒我明天早上10点开会",
            },
        )

        self.assertEqual(employee.id, 1)

    def test_augmented_task_is_rejected_when_employee_has_no_extra_capabilities(self):
        with self.assertRaises(HTTPException) as error_context:
            _validate_employee_capability(
                self.db,
                {
                    "employee_id": "1",
                    "task_content": "请联网搜索今天的 AI 行业新闻并总结",
                },
            )

        self.assertEqual(error_context.exception.status_code, 400)
        self.assertIn("超出当前数字员工自动执行能力", error_context.exception.detail)

    def test_augmented_task_is_allowed_when_employee_has_extra_capabilities(self):
        employee = _validate_employee_capability(
            self.db,
            {
                "employee_id": "2",
                "task_content": "请联网搜索今天的 AI 行业新闻并总结",
            },
        )

        self.assertEqual(employee.id, 2)


if __name__ == "__main__":
    unittest.main()