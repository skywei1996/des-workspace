import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker


BACKEND_DIR = Path(__file__).resolve().parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))


from app import models, schemas
from app.database import Base
from app.services.automation_chat_service import _parse_automation_task_request, handle_automation_task_chat_turn, has_pending_automation_task_context


class AutomationChatServiceTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        db_path = Path(self.temp_dir.name) / "test_automation_chat_service.db"
        self.engine = create_engine(
            f"sqlite:///{db_path.as_posix()}",
            connect_args={"check_same_thread": False},
        )
        self.SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=self.engine)
        Base.metadata.create_all(bind=self.engine)
        self.db = self.SessionLocal()

    def tearDown(self):
        self.db.close()
        self.engine.dispose()
        self.temp_dir.cleanup()

    def test_relative_day_with_zaoshang_is_parsed_as_once_task(self):
        parsed = _parse_automation_task_request("明天早上10点提醒我要开会")

        self.assertEqual(parsed["task_type"], "单次")
        self.assertRegex(parsed["execute_rule"], r"^\d{4}-\d{2}-\d{2} 10:00$")
        self.assertEqual(parsed["clarification"], None)
        self.assertEqual(parsed["task_content"], "我要开会")

    def test_daily_with_zaoshang_is_parsed(self):
        parsed = _parse_automation_task_request("每天早上8点提醒我背单词")

        self.assertEqual(parsed["task_type"], "每日")
        self.assertEqual(parsed["execute_rule"], "08:00")
        self.assertEqual(parsed["clarification"], None)
        self.assertEqual(parsed["task_content"], "我背单词")

    def test_follow_up_task_content_reuses_previous_schedule_then_waits_for_confirmation(self):
        self.db.add(
            models.ChatMessage(
                chat_id=9101,
                sender_role="user",
                employee_id=1,
                content="每周五15:00",
                message_type="text",
            )
        )
        self.db.add(
            models.AIEmployee(
                id=1,
                name="AI 观察员",
                status="active",
                access_scope="personal",
                description="负责 AI 行业动态收集与总结",
                persona_prompt="每周跟踪 AI 行业动态并输出摘要",
                tool_ids=["web-search"],
            )
        )
        self.db.commit()

        response = handle_automation_task_chat_turn(
            db=self.db,
            request=schemas.AgentTurnRequest(chat_id=9101, user_message="定时给我推送每周AI有什么动态", employee_id=1),
        )

        self.assertEqual(response.mode, "clarify")
        self.assertIn("请你确认", response.text)
        self.assertIsNotNone(response.automation_draft)
        self.assertEqual(response.automation_draft["task_type"], "每周")
        self.assertEqual(response.automation_draft["execute_rule"], "FRI 15:00")
        self.assertEqual(response.automation_draft["task_content"], "每周AI有什么动态")
        self.assertTrue(response.automation_draft["awaiting_confirmation"])
        created_task = self.db.query(models.Task).filter(models.Task.user_id == "U10023").first()
        self.assertIsNone(created_task)

    def test_follow_up_time_reuses_previous_task_content_then_waits_for_confirmation(self):
        self.db.add(
            models.ChatMessage(
                chat_id=9102,
                sender_role="user",
                employee_id=1,
                content="定时给我推送每周AI有什么动态",
                message_type="text",
            )
        )
        self.db.add(
            models.AIEmployee(
                id=1,
                name="AI 观察员",
                status="active",
                access_scope="personal",
                description="负责 AI 行业动态收集与总结",
                persona_prompt="每周跟踪 AI 行业动态并输出摘要",
                tool_ids=["web-search"],
            )
        )
        self.db.commit()

        response = handle_automation_task_chat_turn(
            db=self.db,
            request=schemas.AgentTurnRequest(chat_id=9102, user_message="每周五15:00", employee_id=1),
        )

        self.assertEqual(response.mode, "clarify")
        self.assertIn("请你确认", response.text)
        self.assertIsNotNone(response.automation_draft)
        self.assertEqual(response.automation_draft["task_type"], "每周")
        self.assertEqual(response.automation_draft["execute_rule"], "FRI 15:00")
        self.assertEqual(response.automation_draft["task_content"], "每周AI有什么动态")
        self.assertTrue(response.automation_draft["awaiting_confirmation"])
        created_task = self.db.query(models.Task).filter(models.Task.user_id == "U10023").first()
        self.assertIsNone(created_task)

    def test_meta_creation_command_does_not_become_task_content(self):
        self.db.add(
            models.ChatMessage(
                chat_id=9105,
                sender_role="assistant",
                employee_id=1,
                content="已取消这次定时任务创建。需要时你可以重新告诉我任务内容和执行时间。",
                message_type="text",
                meta_data={
                    "automation_draft": {
                        "active": False,
                        "stage": "cancelled",
                        "awaiting_confirmation": False,
                        "awaiting_employee_selection": False,
                    }
                },
            )
        )
        self.db.commit()

        response = handle_automation_task_chat_turn(
            db=self.db,
            request=schemas.AgentTurnRequest(chat_id=9105, user_message="帮我再生成一个定时任务", employee_id=None),
        )

        self.assertEqual(response.mode, "clarify")
        self.assertIn("确认任务内容", response.text)
        self.assertIsNone(response.automation_draft["task_content"])
        self.assertEqual(response.automation_draft["stage"], "collecting_content")

    def test_fresh_creation_command_does_not_inherit_historical_task_content(self):
        self.db.add(
            models.ChatMessage(
                chat_id=9108,
                sender_role="user",
                employee_id=1,
                content="每周五 15:00 生成 OpenClaw 竞品分析",
                message_type="text",
            )
        )
        self.db.commit()

        response = handle_automation_task_chat_turn(
            db=self.db,
            request=schemas.AgentTurnRequest(chat_id=9108, user_message="帮我创建一个定时任务", employee_id=None),
        )

        self.assertEqual(response.mode, "clarify")
        self.assertIn("确认任务内容", response.text)
        self.assertIsNone(response.automation_draft["task_content"])
        self.assertIsNone(response.automation_draft["execute_rule"])
        self.assertEqual(response.automation_draft["stage"], "collecting_content")

    def test_confirmation_stage_task_content_edit_updates_single_field(self):
        self.db.add(
            models.ChatMessage(
                chat_id=9106,
                sender_role="assistant",
                employee_id=11,
                content="我已经整理好这条定时任务，请你确认。",
                message_type="text",
                meta_data={
                    "automation_draft": {
                        "active": True,
                        "stage": "awaiting_confirmation",
                        "user_id": "U10023",
                        "task_type": "每日",
                        "execute_rule": "09:00",
                        "task_content": "生成产品经理岗位的 JD",
                        "employee_id": 11,
                        "employee_name": "测试员工",
                        "employee_source": "platform",
                        "awaiting_confirmation": True,
                        "awaiting_employee_selection": False,
                        "pending_field": "confirmation",
                        "candidate_employees": [],
                    }
                },
            )
        )
        self.db.add(
            models.AIEmployee(
                id=11,
                name="测试员工",
                status="active",
                access_scope="personal",
                description="测试员工",
                persona_prompt="测试员工",
                tool_ids=["web-search"],
            )
        )
        self.db.commit()

        response = handle_automation_task_chat_turn(
            db=self.db,
            request=schemas.AgentTurnRequest(chat_id=9106, user_message="任务内容改成 生产产品经理的 JD", employee_id=11),
        )

        self.assertEqual(response.mode, "clarify")
        self.assertIn("任务内容：生产产品经理的 JD", response.text)
        self.assertEqual(response.automation_draft["task_content"], "生产产品经理的 JD")
        self.assertEqual(response.automation_draft["execute_rule"], "09:00")
        self.assertTrue(response.automation_draft["awaiting_confirmation"])

    def test_confirmation_stage_time_edit_updates_schedule_only(self):
        self.db.add(
            models.ChatMessage(
                chat_id=9107,
                sender_role="assistant",
                employee_id=11,
                content="我已经整理好这条定时任务，请你确认。",
                message_type="text",
                meta_data={
                    "automation_draft": {
                        "active": True,
                        "stage": "awaiting_confirmation",
                        "user_id": "U10023",
                        "task_type": "每日",
                        "execute_rule": "09:00",
                        "task_content": "生成产品经理岗位的 JD",
                        "employee_id": 11,
                        "employee_name": "测试员工",
                        "employee_source": "platform",
                        "awaiting_confirmation": True,
                        "awaiting_employee_selection": False,
                        "pending_field": "confirmation",
                        "candidate_employees": [],
                    }
                },
            )
        )
        self.db.add(
            models.AIEmployee(
                id=11,
                name="测试员工",
                status="active",
                access_scope="personal",
                description="测试员工",
                persona_prompt="测试员工",
                tool_ids=["web-search"],
            )
        )
        self.db.commit()

        response = handle_automation_task_chat_turn(
            db=self.db,
            request=schemas.AgentTurnRequest(chat_id=9107, user_message="时间改成每天下午3点", employee_id=11),
        )

        self.assertEqual(response.mode, "clarify")
        self.assertIn("执行规则：每日 / 15:00", response.text)
        self.assertEqual(response.automation_draft["task_content"], "生成产品经理岗位的 JD")
        self.assertEqual(response.automation_draft["execute_rule"], "15:00")
        self.assertTrue(response.automation_draft["awaiting_confirmation"])

    def test_llm_slot_extractor_can_fill_missing_task_content(self):
        self.db.add(
            models.AIEmployee(
                id=1,
                name="AI 观察员",
                status="active",
                access_scope="personal",
                description="负责 AI 行业动态收集与总结",
                persona_prompt="每周跟踪 AI 行业动态并输出摘要",
                tool_ids=["web-search"],
            )
        )
        self.db.add(
            models.ChatMessage(
                chat_id=9109,
                sender_role="assistant",
                employee_id=1,
                content="我们先确认任务内容。请直接告诉我你希望数字员工定时帮你做什么。",
                message_type="text",
                meta_data={
                    "automation_draft": {
                        "active": True,
                        "stage": "collecting_content",
                        "user_id": "U10023",
                        "task_type": None,
                        "execute_rule": None,
                        "task_content": None,
                        "awaiting_confirmation": False,
                        "awaiting_employee_selection": False,
                        "last_missing_field": "task_content",
                        "candidate_employees": [],
                    }
                },
            )
        )
        self.db.commit()

        with patch(
            "app.services.automation_chat_service._extract_state_update_via_llm",
            return_value={
                "intent": "fill_field",
                "updates": {"task_content": "生成 OpenClaw 研究报告"},
                "clarification": None,
            },
        ):
            response = handle_automation_task_chat_turn(
                db=self.db,
                request=schemas.AgentTurnRequest(chat_id=9109, user_message="这个就写 OpenClaw 那个", employee_id=1),
            )

        self.assertEqual(response.mode, "clarify")
        self.assertEqual(response.automation_draft["task_content"], "生成 OpenClaw 研究报告")
        self.assertIn("接下来请告诉我执行时间", response.text)

    def test_confirm_after_draft_confirmation_prompt_creates_task(self):
        self.db.add(
            models.ChatMessage(
                chat_id=9104,
                sender_role="assistant",
                employee_id=1,
                content="我已经整理好这条定时任务，请你确认。",
                message_type="text",
                meta_data={
                    "automation_draft": {
                        "active": True,
                        "user_id": "U10023",
                        "task_type": "每周",
                        "execute_rule": "FRI 15:00",
                        "task_content": "每周AI有什么动态",
                        "employee_id": 1,
                        "employee_name": "AI 观察员",
                        "employee_source": "personal_created",
                        "awaiting_confirmation": True,
                        "awaiting_employee_selection": False,
                        "pending_field": "confirmation",
                        "candidate_employees": [],
                    }
                },
            )
        )
        self.db.add(
            models.AIEmployee(
                id=1,
                name="AI 观察员",
                status="active",
                access_scope="personal",
                description="负责 AI 行业动态收集与总结",
                persona_prompt="每周跟踪 AI 行业动态并输出摘要",
                tool_ids=["web-search"],
            )
        )
        self.db.commit()

        response = handle_automation_task_chat_turn(
            db=self.db,
            request=schemas.AgentTurnRequest(chat_id=9104, user_message="确认创建", employee_id=1),
        )

        self.assertEqual(response.mode, "direct_answer")
        self.assertIn("自动化任务已创建成功", response.text)
        self.assertIsNotNone(response.automation_draft)
        self.assertFalse(response.automation_draft["active"])
        created_task = self.db.query(models.Task).filter(models.Task.user_id == "U10023").first()
        self.assertIsNotNone(created_task)
        self.assertEqual(created_task.task_type, "每周")
        self.assertEqual(created_task.execute_rule, "FRI 15:00")

    def test_clarification_message_marks_pending_automation_context(self):
        self.db.add(
            models.ChatMessage(
                chat_id=9103,
                sender_role="assistant",
                employee_id=1,
                content="我可以帮你创建自动化任务，但还缺少明确的任务内容。请告诉我需要在什么时间做什么。",
                message_type="text",
            )
        )
        self.db.commit()

        self.assertTrue(has_pending_automation_task_context(db=self.db, chat_id=9103))

    def test_chat_delete_task_requires_text_confirmation_then_marks_task_deleted(self):
        self.db.add(
            models.Task(
                task_id="TSKDELETE001",
                task_name="每日 5 个英语单词",
                task_type="每日",
                user_id="U10023",
                task_content="背 5 个英语单词",
                employee_id="1",
                employee_source="admin_created",
                execute_rule="08:00",
                task_status="启用",
                executor_role="digital_employee",
            )
        )
        self.db.commit()

        first_response = handle_automation_task_chat_turn(
            db=self.db,
            request=schemas.AgentTurnRequest(chat_id=9001, user_message="删除任务 每日 5 个英语单词", employee_id=1),
        )

        self.assertEqual(first_response.mode, "clarify")
        self.assertIn("是否确认删除自动化任务《每日 5 个英语单词》", first_response.text)

        self.db.add(
            models.ChatMessage(
                chat_id=9001,
                sender_role="assistant",
                employee_id=1,
                content=first_response.text,
                message_type="text",
            )
        )
        self.db.commit()

        confirm_response = handle_automation_task_chat_turn(
            db=self.db,
            request=schemas.AgentTurnRequest(chat_id=9001, user_message="确认删除", employee_id=1),
        )

        self.assertEqual(confirm_response.mode, "direct_answer")
        self.assertIn("已删除", confirm_response.text)

        db_task = self.db.query(models.Task).filter(models.Task.task_id == "TSKDELETE001").first()
        self.assertEqual(db_task.task_status, "已删除")
        self.assertIsNone(db_task.next_execute_time)


if __name__ == "__main__":
    unittest.main()