import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker


BACKEND_DIR = Path(__file__).resolve().parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))


from app import models
from app.database import Base
from app.mcp_server import router
from app.database import get_db
from app.services.workflow_service import start_workflow_run


class ConfirmStepFlowTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        db_path = Path(self.temp_dir.name) / "test_confirm_step_flow.db"
        self.engine = create_engine(
            f"sqlite:///{db_path.as_posix()}",
            connect_args={"check_same_thread": False},
        )
        self.SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=self.engine)
        Base.metadata.create_all(bind=self.engine)
        self.db = self.SessionLocal()

        self.db.add(models.AIEmployee(
            id=1,
            name="Workflow Tester",
            tool_ids=[],
        ))
        self.db.add(models.SkillRegistryEntry(
            skill_key="report_workflow",
            name="Report Workflow",
            description="Collect feedback before continuing",
            skill_type="workflow",
            workflow_steps=[
                {
                    "id": "draft_outline",
                    "name": "生成提纲",
                    "step_type": "feedback_step",
                    "instructions": "先给出报告提纲草案",
                    "output_key": "outline",
                },
                {
                    "id": "write_report",
                    "name": "撰写报告",
                    "step_type": "auto_step",
                    "instructions": "根据确认后的提纲撰写完整报告",
                    "output_key": "report",
                },
            ],
            enabled=1,
        ))
        self.db.commit()

        app = FastAPI()
        app.include_router(router, prefix="/mcp")

        def override_get_db():
            db = self.SessionLocal()
            try:
                yield db
            finally:
                db.close()

        app.dependency_overrides[get_db] = override_get_db
        self.client = TestClient(app)

    def tearDown(self):
        self.db.close()
        self.engine.dispose()
        self.temp_dir.cleanup()

    def test_confirm_step_approves_paused_workflow_step(self):
        summaries = iter([
            {"summary": "提纲草案 v1"},
            {"summary": "完整报告 v1"},
        ])

        with patch("app.services.workflow_service._execute_agent_step", side_effect=lambda *args, **kwargs: next(summaries)):
            workflow_run = start_workflow_run(
                chat_id=801,
                employee_id=1,
                workflow_skill_key="report_workflow",
                user_message="请生成行业分析报告",
                db=self.db,
            )

            self.assertEqual(workflow_run["status"], "paused")
            self.assertEqual(workflow_run["current_step"]["step_index"], 1)

            response = self.client.post(
                "/mcp/confirm_step",
                params={
                    "chat_id": 801,
                    "step_index": 1,
                    "approved": True,
                },
            )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["status"], "confirmed")
        self.assertEqual(payload["workflow_status"], "completed")
        self.assertEqual(payload["workflow_run"]["context_data"]["step_outputs"]["outline"]["summary"], "提纲草案 v1")
        self.assertEqual(payload["workflow_run"]["context_data"]["step_outputs"]["outline"]["result"], "提纲草案 v1")
        self.assertEqual(payload["workflow_run"]["context_data"]["step_outputs"]["report"]["summary"], "完整报告 v1")
        self.assertEqual(payload["workflow_run"]["context_data"]["step_outputs"]["report"]["result"], "完整报告 v1")

    def test_confirm_step_returns_404_when_no_paused_step_matches(self):
        response = self.client.post(
            "/mcp/confirm_step",
            params={
                "chat_id": 999,
                "step_index": 3,
                "approved": True,
            },
        )

        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json()["detail"], "No paused workflow step found for this chat and step index")


if __name__ == "__main__":
    unittest.main()