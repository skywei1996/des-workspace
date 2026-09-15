import sys
import unittest
from pathlib import Path


BACKEND_DIR = Path(__file__).resolve().parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))


from app.mcp_server import ARTIFACT_RENDERER_SKILL_KEY, PlanStep, _ensure_plan_aligns_with_user_goal, _ensure_plan_delivers_requested_artifacts


class PlanGoalAlignmentTests(unittest.TestCase):
    def test_appends_final_delivery_step_when_plan_ends_with_intermediate_output(self):
        plan_steps = [
            PlanStep(id="step_1", title="收集资料", description="整理相关背景信息"),
            PlanStep(id="step_2", title="生成提纲", description="形成报告结构"),
        ]

        repaired = _ensure_plan_aligns_with_user_goal(plan_steps, "请写一份 OpenClaw 技术研究报告")

        self.assertEqual(len(repaired), 3)
        self.assertEqual(repaired[-1].title, "交付最终结果")
        self.assertIn("请写一份 OpenClaw 技术研究报告", repaired[-1].description)

    def test_keeps_plan_when_last_step_already_delivers_user_goal(self):
        plan_steps = [
            PlanStep(id="step_1", title="收集资料", description="整理相关背景信息"),
            PlanStep(id="step_2", title="输出完整对比报告", description="直接回答用户关于 C# 和 Python 异同的问题"),
        ]

        repaired = _ensure_plan_aligns_with_user_goal(plan_steps, "介绍一下C#和python的异同")

        self.assertEqual(len(repaired), 2)
        self.assertEqual(repaired[-1].title, "输出完整对比报告")

    def test_does_not_append_final_delivery_after_action_step(self):
        plan_steps = [
            PlanStep(id="step_1", title="查询用户本人 userId", description="查询当前用户的钉钉 userid"),
            PlanStep(id="step_2", title="创建钉钉日程", description="调用 createEvent 创建明天下午2点的线上会议"),
        ]

        repaired = _ensure_plan_aligns_with_user_goal(plan_steps, "帮我制定个日程，明天下午2点魏巍，线上会议，参加人就自己")

        self.assertEqual(len(repaired), 2)
        self.assertEqual(repaired[-1].title, "创建钉钉日程")

    def test_trims_redundant_tail_steps_after_action_step(self):
        plan_steps = [
            PlanStep(id="step_1", title="查询用户本人 userId", description="查询当前用户的钉钉 userid"),
            PlanStep(id="step_2", title="创建钉钉日程", description="调用 createEvent 创建日程"),
            PlanStep(id="step_3", title="确认创建结果", description="检查工具返回结果，确认日程是否创建成功"),
            PlanStep(id="step_4", title="交付最终结果", description="基于前序步骤产出，直接完成用户请求"),
        ]

        repaired = _ensure_plan_aligns_with_user_goal(plan_steps, "帮我制定个日程，明天下午2点魏巍，线上会议，参加人就自己")

        self.assertEqual(len(repaired), 2)
        self.assertEqual([step.title for step in repaired], ["查询用户本人 userId", "创建钉钉日程"])

    def test_appends_renderer_delivery_step_for_requested_html_artifact(self):
        plan_steps = [
            PlanStep(id="step_1", title="收集资料", description="整理宠物市场背景信息"),
            PlanStep(id="step_2", title="撰写结论", description="形成报告正文"),
        ]

        repaired = _ensure_plan_delivers_requested_artifacts(plan_steps, "请生成宠物市场分析 HTML 文件")

        self.assertEqual(len(repaired), 3)
        self.assertEqual(repaired[-1].selected_skill_key, ARTIFACT_RENDERER_SKILL_KEY)
        self.assertEqual(repaired[-1].selected_skill_type, "renderer")
        self.assertIn("HTML", repaired[-1].title)


if __name__ == "__main__":
    unittest.main()