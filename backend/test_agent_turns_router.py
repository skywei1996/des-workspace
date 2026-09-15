import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, patch

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker


BACKEND_DIR = Path(__file__).resolve().parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))


from app import models
from app.database import Base, get_db
from app.mcp_server import ExecuteResponse, PlanResponse, PlanStep
from app.routers.agent_turns import router
from app.routers.workflow_runs import router as workflow_runs_router


class AgentTurnsRouterTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        db_path = Path(self.temp_dir.name) / "test_agent_turns_router.db"
        self.engine = create_engine(
            f"sqlite:///{db_path.as_posix()}",
            connect_args={"check_same_thread": False},
        )
        self.SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=self.engine)
        Base.metadata.create_all(bind=self.engine)

        seed_db = self.SessionLocal()
        seed_db.add(models.AIEmployee(id=1, name="Agent Router Tester", status="active", tool_ids=[]))
        seed_db.commit()
        seed_db.close()

        app = FastAPI()
        app.include_router(router)
        app.include_router(workflow_runs_router)

        def override_get_db():
            db = self.SessionLocal()
            try:
                yield db
            finally:
                db.close()

        app.dependency_overrides[get_db] = override_get_db
        self.client = TestClient(app)

    def tearDown(self):
        self.engine.dispose()
        self.temp_dir.cleanup()

    def _post_turn(self):
        return self.client.post(
            "/agent/turns",
            json={
                "chat_id": 1001,
                "employee_id": 1,
                "user_message": "请处理这个请求",
                "auto_execute_direct": True,
            },
        )

    def test_turn_returns_clarify_mode(self):
        plan_response = PlanResponse(
            execution_mode="plan",
            selected_skills=["brainstorming"],
            plan_steps=[],
            plan=[],
            reasoning="需要先澄清范围。",
            clarifying_question="你更关注技术分析还是商业分析？",
        )

        with patch("app.services.dispatcher_service.DispatcherService.generate_plan_response", new=AsyncMock(return_value=plan_response)):
            response = self._post_turn()

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["mode"], "clarify")
        self.assertEqual(payload["clarifying_questions"], ["你更关注技术分析还是商业分析？"])
        self.assertTrue(payload["requires_user_input"])
        self.assertIsNone(payload["result"])

    def test_turn_auto_executes_direct_answer_mode(self):
        plan_response = PlanResponse(
            execution_mode="direct",
            selected_skills=[],
            plan_steps=[],
            plan=[],
            reasoning="这是轻量直接问答。",
            clarifying_question=None,
        )
        direct_response = ExecuteResponse(status="completed", result="直接答复内容", workflow_run=None)

        with patch("app.services.dispatcher_service.DispatcherService.generate_plan_response", new=AsyncMock(return_value=plan_response)), patch(
            "app.services.dispatcher_service.DispatcherService.answer_direct_response",
            new=AsyncMock(return_value=direct_response),
        ):
            response = self._post_turn()

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["mode"], "direct_answer")
        self.assertEqual(payload["result"], "直接答复内容")

    def test_turn_auto_executes_direct_skill_mode(self):
        plan_response = PlanResponse(
            execution_mode="direct",
            selected_skills=["search_tool"],
            plan_steps=[
                PlanStep(
                    id="step_1",
                    title="检索信息",
                    description="调用搜索技能直接完成请求",
                    selected_skill_key="search_tool",
                    selected_skill_type="prompt",
                    candidate_skill_keys=["search_tool"],
                    status="pending",
                )
            ],
            plan=["检索信息"],
            reasoning="单步技能调用即可完成。",
            clarifying_question=None,
        )
        execute_response = ExecuteResponse(
            status="completed",
            result={"summary": "技能已执行完成"},
            workflow_run=None,
        )

        with patch("app.services.dispatcher_service.DispatcherService.generate_plan_response", new=AsyncMock(return_value=plan_response)), patch(
            "app.services.dispatcher_service.mcp_server.execute_plan",
            new=AsyncMock(return_value=execute_response),
        ):
            response = self._post_turn()

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["mode"], "direct_skill")
        self.assertEqual(payload["result"]["summary"], "技能已执行完成")
        self.assertEqual(payload["selected_skill_key"], "search_tool")

    def test_turn_returns_plan_mode_without_auto_execution(self):
        plan_response = PlanResponse(
            execution_mode="plan",
            selected_skills=["skill_a"],
            plan_steps=[
                PlanStep(id="step_1", title="先收集信息", status="pending"),
                PlanStep(id="step_2", title="再输出结果", status="pending"),
            ],
            plan=["先收集信息", "再输出结果"],
            reasoning="这是多步任务，需要展示计划。",
            clarifying_question=None,
        )

        with patch("app.services.dispatcher_service.DispatcherService.generate_plan_response", new=AsyncMock(return_value=plan_response)):
            response = self.client.post(
                "/agent/turns",
                json={
                    "chat_id": 1001,
                    "employee_id": 1,
                    "user_message": "请处理这个复杂请求",
                    "auto_execute_direct": False,
                },
            )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["mode"], "plan")
        self.assertEqual(len(payload["plan_steps"]), 2)
        self.assertIsNotNone(payload["workflow_run_id"])
        self.assertEqual(payload["workflow_run"]["status"], "planned")
        self.assertEqual(payload["workflow_run"]["workflow_skill_key"], "__agent_plan__")
        self.assertEqual(len(payload["workflow_run"]["steps"]), 2)
        self.assertIsNone(payload["result"])

        verify_db = self.SessionLocal()
        try:
            run = verify_db.query(models.WorkflowRun).filter(models.WorkflowRun.id == payload["workflow_run_id"]).first()
            self.assertIsNotNone(run)
            self.assertEqual(run.status, "planned")
            self.assertEqual(run.workflow_skill_key, "__agent_plan__")
            self.assertEqual((run.context_data or {}).get("run_kind"), "agent_plan")
        finally:
            verify_db.close()

    def test_execute_agent_plan_run_completes_persisted_steps(self):
        plan_response = PlanResponse(
            execution_mode="plan",
            selected_skills=["skill_a"],
            plan_steps=[
                PlanStep(id="step_1", title="先收集信息", description="收集背景", status="pending"),
                PlanStep(id="step_2", title="再输出结果", description="整理结论", status="pending"),
            ],
            plan=["先收集信息", "再输出结果"],
            reasoning="这是多步任务，需要展示计划。",
            clarifying_question=None,
        )

        with patch("app.services.dispatcher_service.DispatcherService.generate_plan_response", new=AsyncMock(return_value=plan_response)):
            response = self.client.post(
                "/agent/turns",
                json={
                    "chat_id": 1002,
                    "employee_id": 1,
                    "user_message": "请处理这个复杂请求",
                    "auto_execute_direct": False,
                },
            )

        self.assertEqual(response.status_code, 200)
        run_id = response.json()["workflow_run_id"]

        async def fake_execute_step(request, db):
            return ExecuteResponse(
                status="completed",
                result=f"已完成: {request.step_content}",
                workflow_run=None,
            )

        with patch("app.mcp_server.execute_step", new=AsyncMock(side_effect=fake_execute_step)):
            execute_response = self.client.post(f"/workflow-runs/{run_id}/execute")

        self.assertEqual(execute_response.status_code, 200)
        payload = execute_response.json()
        self.assertEqual(payload["status"], "running")
        self.assertEqual(payload["current_step_index"], 2)
        self.assertEqual(payload["steps"][0]["status"], "completed")
        self.assertEqual(payload["steps"][1]["status"], "pending")
        self.assertEqual(payload["context_data"]["step_outputs"]["step_1"]["result"], "已完成: 先收集信息：收集背景")

        with patch("app.mcp_server.execute_step", new=AsyncMock(side_effect=fake_execute_step)):
            second_execute_response = self.client.post(f"/workflow-runs/{run_id}/execute")

        self.assertEqual(second_execute_response.status_code, 200)
        second_payload = second_execute_response.json()
        self.assertEqual(second_payload["status"], "completed")
        self.assertEqual(second_payload["current_step_index"], 2)
        self.assertEqual(second_payload["steps"][0]["status"], "completed")
        self.assertEqual(second_payload["steps"][1]["status"], "completed")
        self.assertEqual(second_payload["context_data"]["step_outputs"]["step_1"]["result"], "已完成: 先收集信息：收集背景")

    def test_continue_agent_plan_run_resumes_paused_action_required_step(self):
        plan_response = PlanResponse(
            execution_mode="plan",
            selected_skills=["skill_a"],
            plan_steps=[
                PlanStep(id="step_1", title="补充信息", description="等待用户补充范围", status="pending"),
                PlanStep(id="step_2", title="输出结果", description="生成最终结果", status="pending"),
            ],
            plan=["补充信息", "输出结果"],
            reasoning="这是多步任务，需要展示计划。",
            clarifying_question=None,
        )

        with patch("app.services.dispatcher_service.DispatcherService.generate_plan_response", new=AsyncMock(return_value=plan_response)):
            response = self.client.post(
                "/agent/turns",
                json={
                    "chat_id": 1003,
                    "employee_id": 1,
                    "user_message": "请处理这个需要补充信息的请求",
                    "auto_execute_direct": False,
                },
            )

        self.assertEqual(response.status_code, 200)
        run_id = response.json()["workflow_run_id"]

        async def fake_pause_execute_step(request, db):
            return ExecuteResponse(
                status="action_required",
                result="请补充目标用户范围",
                workflow_run=None,
            )

        with patch("app.mcp_server.execute_step", new=AsyncMock(side_effect=fake_pause_execute_step)):
            execute_response = self.client.post(f"/workflow-runs/{run_id}/execute")

        self.assertEqual(execute_response.status_code, 200)
        paused_payload = execute_response.json()
        self.assertEqual(paused_payload["status"], "paused")
        self.assertEqual(paused_payload["pause_reason"], "action_required")
        self.assertEqual(paused_payload["steps"][0]["status"], "paused")

        async def fake_continue_execute_step(request, db):
            if request.user_feedback:
                return ExecuteResponse(
                    status="completed",
                    result=f"已补充并完成: {request.step_content}",
                    workflow_run=None,
                )
            return ExecuteResponse(
                status="completed",
                result=f"已完成: {request.step_content}",
                workflow_run=None,
            )

        with patch("app.mcp_server.execute_step", new=AsyncMock(side_effect=fake_continue_execute_step)):
            continue_response = self.client.post(
                f"/workflow-runs/{run_id}/continue",
                json={
                    "user_input": "",
                    "approved": None,
                    "feedback": "目标用户是大型制造企业采购负责人",
                },
            )

        self.assertEqual(continue_response.status_code, 200)
        continued_payload = continue_response.json()
        self.assertEqual(continued_payload["status"], "running")
        self.assertEqual(continued_payload["steps"][0]["status"], "completed")
        self.assertEqual(continued_payload["steps"][1]["status"], "pending")
        self.assertEqual(
            continued_payload["context_data"]["step_outputs"]["step_1"]["result"],
            "已补充并完成: 补充信息：等待用户补充范围",
        )

        with patch("app.mcp_server.execute_step", new=AsyncMock(side_effect=fake_continue_execute_step)):
            final_execute_response = self.client.post(f"/workflow-runs/{run_id}/execute")

        self.assertEqual(final_execute_response.status_code, 200)
        final_payload = final_execute_response.json()
        self.assertEqual(final_payload["status"], "completed")
        self.assertEqual(final_payload["steps"][0]["status"], "completed")
        self.assertEqual(final_payload["steps"][1]["status"], "completed")

    def test_plan_approval_executes_workflow_run_when_reply_is_approval(self):
        workflow_run = {
            "id": 321,
            "status": "completed",
            "workflow_name": "Agent Plan Run",
            "workflow_skill_key": "__agent_plan__",
            "steps": [
                {"step_index": 0, "status": "completed", "title": "先收集信息"},
                {"step_index": 1, "status": "completed", "title": "再输出结果"},
            ],
            "context_data": {
                "run_kind": "agent_plan",
                "step_outputs": {
                    "step_1": {"result": "第一步完成"},
                    "step_2": {"result": "第二步完成"},
                },
            },
        }

        with patch(
            "app.services.dispatcher_service.execute_agent_plan_run",
            new=AsyncMock(return_value=workflow_run),
        ):
            response = self.client.post(
                "/agent/plan-approval",
                json={
                    "chat_id": 1004,
                    "employee_id": 1,
                    "user_message": "就按这个执行吧",
                    "workflow_run_id": 321,
                },
            )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["decision"], "approved")
        self.assertEqual(payload["workflow_run_id"], 321)
        self.assertEqual(payload["workflow_run"]["status"], "completed")
        self.assertEqual(payload["result"]["step_1"]["result"], "第一步完成")

    def test_plan_approval_treats_feedback_as_revision(self):
        with patch(
            "app.services.dispatcher_service.execute_agent_plan_run",
            new=AsyncMock(),
        ) as mocked_execute:
            response = self.client.post(
                "/agent/plan-approval",
                json={
                    "chat_id": 1005,
                    "employee_id": 1,
                    "user_message": "先调整一下第二步，再重新给我计划",
                    "workflow_run_id": 654,
                },
            )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["decision"], "revise")
        self.assertEqual(payload["workflow_run_id"], 654)
        self.assertIsNone(payload["workflow_run"])
        self.assertIsNone(payload["result"])
        mocked_execute.assert_not_awaited()


if __name__ == "__main__":
    unittest.main()