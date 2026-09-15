import sys
import unittest
from pathlib import Path


BACKEND_DIR = Path(__file__).resolve().parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))


from app.mcp_server import _allows_pre_plan_clarification, _normalize_plan_response


class PrePlanClarificationPolicyTests(unittest.TestCase):
    def test_allows_pre_plan_clarification_for_brainstorming_skill(self):
        skills = [
            {
                "skill_key": "brainstorming",
                "name": "brainstorming",
                "description": "Use this skill to ask clarifying questions before planning.",
                "instructions": "Ask clarifying questions before writing any code and wait for approval.",
                "skill_type": "prompt",
            }
        ]

        self.assertTrue(_allows_pre_plan_clarification(skills))

    def test_disallows_pre_plan_clarification_without_brainstorming_like_skill(self):
        skills = [
            {
                "skill_key": "report_writer",
                "name": "报告撰写",
                "description": "Generate structured reports.",
                "instructions": "Produce a report directly based on the request.",
                "skill_type": "prompt",
            }
        ]

        self.assertFalse(_allows_pre_plan_clarification(skills))

    def test_ignores_clarifying_question_and_builds_direct_plan_when_not_allowed(self):
        response = _normalize_plan_response(
            {
                "selected_skills": [],
                "plan_steps": [],
                "reasoning": "信息不足，想先追问。",
                "clarifying_question": "请先告诉我报告主题。",
                "plan": [],
            },
            available_skills=[],
            user_message="生成 OpenClaw 分析报告",
            allow_pre_plan_clarification=False,
        )

        self.assertIsNone(response.clarifying_question)
        self.assertEqual(len(response.plan_steps), 1)
        self.assertEqual(response.plan_steps[0].title, "直接处理用户请求")

    def test_preserves_clarifying_question_when_allowed(self):
        response = _normalize_plan_response(
            {
                "selected_skills": ["brainstorming"],
                "plan_steps": [],
                "reasoning": "需要先澄清范围。",
                "clarifying_question": "你更关注技术分析还是商业分析？",
                "plan": [],
            },
            available_skills=[
                {
                    "skill_key": "brainstorming",
                    "name": "brainstorming",
                    "description": "Use this skill to ask clarifying questions before planning.",
                    "instructions": "Ask clarifying questions before writing any code and wait for approval.",
                    "skill_type": "prompt",
                }
            ],
            user_message="生成 OpenClaw 分析报告",
            allow_pre_plan_clarification=True,
        )

        self.assertEqual(response.clarifying_question, "你更关注技术分析还是商业分析？")
        self.assertEqual(response.plan_steps, [])

    def test_collapses_workflow_internal_nodes_into_parent_plan_step(self):
        response = _normalize_plan_response(
            {
                "selected_skills": ["skill_2"],
                "plan_steps": [
                    {
                        "id": "step_1",
                        "title": "收集报告需求",
                        "description": "确认主题、目标读者、篇幅要求",
                        "selected_skill_key": "skill_2",
                        "candidate_skill_keys": ["skill_2"],
                        "status": "pending",
                    },
                    {
                        "id": "step_2",
                        "title": "生成报告提纲",
                        "description": "输出提纲草案",
                        "selected_skill_key": "skill_2",
                        "candidate_skill_keys": ["skill_2"],
                        "status": "pending",
                    },
                    {
                        "id": "step_3",
                        "title": "撰写正式报告",
                        "description": "根据确认的提纲写完整报告",
                        "selected_skill_key": None,
                        "candidate_skill_keys": [],
                        "status": "pending",
                    },
                ],
                "reasoning": "先调用工作流生成提纲。",
                "clarifying_question": None,
                "plan": [],
            },
            available_skills=[
                {
                    "skill_key": "skill_2",
                    "name": "报告框架输出",
                    "description": "用于需求收集和提纲生成。",
                    "instructions": "用于提纲确认",
                    "skill_type": "workflow",
                    "workflow_steps": [
                        {"id": "step_1", "name": "收集报告需求", "step_type": "feedback_step"},
                        {"id": "step_2", "name": "生成报告提纲", "step_type": "feedback_step"},
                    ],
                }
            ],
            user_message="写一篇 openclaw 报告",
            allow_pre_plan_clarification=False,
        )

        self.assertEqual(len(response.plan_steps), 2)
        self.assertEqual(response.plan_steps[0].title, "报告框架输出")
        self.assertEqual(response.plan_steps[0].selected_skill_key, "skill_2")
        self.assertEqual(response.plan_steps[1].title, "撰写正式报告")
        self.assertNotIn("收集报告需求", [step.title for step in response.plan_steps])
        self.assertNotIn("生成报告提纲", [step.title for step in response.plan_steps])


if __name__ == "__main__":
    unittest.main()