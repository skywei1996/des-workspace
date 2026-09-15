import sys
import unittest
from pathlib import Path


BACKEND_DIR = Path(__file__).resolve().parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))


from app import models
from app.routers.employees import _build_recommendation_reason, _score_employee_recommendation


class EmployeeRecommendationTests(unittest.TestCase):
    def test_english_learning_task_matches_english_coach_semantically(self):
        employee = models.AIEmployee(
            name="Eli-英语教练",
            status="active",
            role_title="英语口语与写作教练",
            description="帮助中国用户提升英语听说读写能力，提供语法纠正、表达优化和文化背景解释。",
            tool_ids=["tavily_search", "skill_3"],
            workflow_ids=[],
            knowledge_ids=[],
        )

        score, matched_terms = _score_employee_recommendation(
            employee,
            "每天推荐 5 个实用英语单词，优先选取生活和职场中常见词汇。输出词义、音标、例句，以及一条便于记忆的小提示。",
        )

        self.assertGreaterEqual(score, 5)
        self.assertTrue(any(term in matched_terms for term in ["英语", "英语学习", "词汇", "单词", "音标", "例句"]))

    def test_unrelated_employee_without_domain_match_stays_below_capability_threshold(self):
        employee = models.AIEmployee(
            name="LunaDesign",
            status="active",
            role_title="视觉设计师",
            description="专注于企业级视觉内容创作，适合海报、社交媒体素材和演示封面。",
            tool_ids=["canvas_design", "brainstorming"],
            workflow_ids=[],
            knowledge_ids=[],
        )

        score, matched_terms = _score_employee_recommendation(
            employee,
            "每天推荐 5 个实用英语单词，优先选取生活和职场中常见词汇。输出词义、音标、例句，以及一条便于记忆的小提示。",
        )

        self.assertLess(score, 5)
        self.assertEqual(matched_terms, [])

    def test_recommendation_reason_uses_employee_capability_labels(self):
        employee = models.AIEmployee(
            name="Eli-英语教练",
            status="active",
            role_title="英语口语与写作教练",
            description="帮助中国用户提升英语听说读写能力，提供语法纠正、表达优化和文化背景解释。",
            tool_ids=["tavily_search", "skill_3"],
            workflow_ids=[],
            knowledge_ids=[],
        )

        reason = _build_recommendation_reason(employee, ["英语学习"])

        self.assertIn("擅长领域", reason)
        self.assertIn("英语学习", reason)
        self.assertNotIn("匹配关键词", reason)


if __name__ == "__main__":
    unittest.main()