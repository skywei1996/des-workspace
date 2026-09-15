import json
import os
import sys
import unittest
from io import StringIO
from pathlib import Path
from unittest.mock import patch


BACKEND_DIR = Path(__file__).resolve().parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))


from app.runtime.codex_runtime import CodexRuntime
from app.services.artifact_service import build_artifact_metadata_from_file_path, is_valid_native_pptx
from app.services.runtime_run_service import build_public_runtime_event


class CodexRuntimeArtifactTests(unittest.TestCase):
    def test_workspace_write_harness_returns_generated_pdf(self):
        runtime = CodexRuntime(executable="codex")

        def fake_run(command, **kwargs):
            self.assertEqual(command[command.index("--sandbox") + 1], "workspace-write")
            self.assertEqual(kwargs["timeout"], CodexRuntime.DEFAULT_TIMEOUT_SECONDS)
            artifact_dir = Path(kwargs["env"]["DES_ARTIFACT_DIR"])
            artifact_dir.joinpath("report.pdf").write_bytes(b"%PDF-1.4\n%%EOF")
            event = {
                "type": "item.completed",
                "item": {"type": "agent_message", "text": "PDF 已生成。"},
            }
            return type("Completed", (), {
                "returncode": 0,
                "stdout": json.dumps(event, ensure_ascii=False),
                "stderr": "",
            })()

        with patch("app.runtime.codex_runtime.subprocess.run", side_effect=fake_run):
            result = runtime.run(
                prompt="生成 PDF",
                model_config={"wire_api": "responses"},
            )

        self.assertEqual(result.text, "PDF 已生成。")
        self.assertEqual(len(result.generated_files), 1)
        self.assertTrue(result.generated_files[0].endswith("report.pdf"))
        self.assertTrue(Path(result.generated_files[0]).is_file())
        artifact = build_artifact_metadata_from_file_path(result.generated_files[0])
        self.assertIsNotNone(artifact)
        self.assertEqual(artifact["format"], "pdf")
        self.assertTrue(artifact["relative_path"].startswith("workspace/generated/codex_"))

    def test_harness_requires_native_pptx_generation(self):
        runtime = CodexRuntime(executable="codex")

        def fake_run(command, **kwargs):
            harness_prompt = command[-1]
            self.assertIn("full workspace-write access", harness_prompt)
            self.assertIn("python-pptx", harness_prompt)
            self.assertIn("native .pptx file", harness_prompt)
            event = {
                "type": "item.completed",
                "item": {"type": "agent_message", "text": "PPTX 已生成。"},
            }
            return type("Completed", (), {
                "returncode": 0,
                "stdout": json.dumps(event, ensure_ascii=False),
                "stderr": "",
            })()

        with patch("app.runtime.codex_runtime.subprocess.run", side_effect=fake_run):
            runtime.run(prompt="生成 PPTX", model_config={"wire_api": "responses"})

    def test_invalid_pptx_is_rejected(self):
        with patch("app.services.artifact_service.Path.exists", return_value=True), \
             patch("app.services.artifact_service.Path.is_file", return_value=True):
            self.assertFalse(is_valid_native_pptx("broken.pptx"))

    def test_runtime_timeout_can_be_configured_from_environment(self):
        with patch.dict(os.environ, {"CODEX_RUNTIME_TIMEOUT_SECONDS": "900"}):
            runtime = CodexRuntime(executable="codex")

        self.assertEqual(runtime.timeout_seconds, 900)

    def test_invalid_runtime_timeout_uses_default(self):
        with patch.dict(os.environ, {"CODEX_RUNTIME_TIMEOUT_SECONDS": "invalid"}):
            runtime = CodexRuntime(executable="codex")

        self.assertEqual(runtime.timeout_seconds, CodexRuntime.DEFAULT_TIMEOUT_SECONDS)

    def test_public_runtime_event_does_not_expose_reasoning_text(self):
        event = {
            "type": "item.started",
            "item": {"type": "reasoning", "text": "private reasoning"},
        }

        public_event = build_public_runtime_event(event, [r"C:\temp\report.html"])

        self.assertEqual(public_event["label"], "正在分析并推进任务")
        self.assertNotIn("private reasoning", str(public_event))
        self.assertEqual(public_event["generated_files"], ["report.html"])

    def test_public_runtime_event_explains_approval_request(self):
        public_event = build_public_runtime_event({
            "type": "item/commandExecution/requestApproval",
            "params": {
                "command": "python generate_report.py",
                "reason": "需要读取上传的 Excel 并生成报告",
            },
        }, [])

        self.assertEqual(public_event["label"], "请求审批：Codex 准备执行文件或命令操作")
        self.assertEqual(public_event["action"], "执行命令")
        self.assertEqual(public_event["target"], "python generate_report.py")
        self.assertEqual(public_event["reason"], "需要读取上传的 Excel 并生成报告")
        self.assertTrue(public_event["approval_required"])

    def test_public_runtime_event_recognizes_flattened_codex_command_stage(self):
        public_event = build_public_runtime_event({
            "type": "item/commandExecution/started",
            "item": {"type": "commandExecution", "command": "python generate_report.py"},
        }, [])

        self.assertEqual(public_event["label"], "正在执行任务命令")
        self.assertEqual(public_event["action"], "执行命令")
        self.assertEqual(public_event["target"], "python generate_report.py")

    def test_streaming_runtime_emits_events_before_returning_result(self):
        runtime = CodexRuntime(executable="codex")
        emitted = []
        output = "\n".join([
            json.dumps({"type": "turn.started"}),
            json.dumps({
                "type": "item.completed",
                "item": {"type": "agent_message", "text": "已完成。"},
            }, ensure_ascii=False),
        ])

        class FakeProcess:
            def __init__(self, *args, **kwargs):
                self.stdout = StringIO(output)
                self.stderr = StringIO("")

            def wait(self):
                return 0

        with patch("app.runtime.codex_runtime.subprocess.Popen", FakeProcess):
            result = runtime.run_streaming(
                prompt="执行任务",
                model_config={"wire_api": "responses"},
                on_event=lambda event, files: emitted.append(event["type"]),
            )

        self.assertEqual(emitted, ["turn.started", "item.completed"])
        self.assertEqual(result.text, "已完成。")

    def test_app_server_forwards_codex_approval_decision(self):
        runtime = CodexRuntime(executable="codex")
        events = []
        sent = []
        message = {
            "id": "approval-42",
            "method": "item/commandExecution/requestApproval",
            "params": {
                "itemId": "item-1",
                "threadId": "thread-1",
                "turnId": "turn-1",
                "reason": "需要执行写入命令",
            },
        }

        completed = runtime._handle_app_server_message(
            message,
            events,
            None,
            lambda request_id, method, params: "accept",
            sent.append,
        )

        self.assertFalse(completed)
        self.assertEqual(sent, [{"id": "approval-42", "result": {"decision": "accept"}}])
        self.assertEqual(events, [])

    def test_app_server_turn_completed_stops_runtime_loop(self):
        runtime = CodexRuntime(executable="codex")
        events = []

        completed = runtime._handle_app_server_message(
            {"method": "turn/completed", "params": {"turn": {"status": "completed"}}},
            events,
            None,
            None,
            lambda payload: None,
        )

        self.assertTrue(completed)
        self.assertEqual(events[0]["type"], "turn/completed")

    def test_app_server_extracts_completed_agent_message(self):
        text = CodexRuntime._extract_final_text([{
            "type": "item/completed",
            "item": {"type": "agentMessage", "text": "Excel 已生成。"},
        }])

        self.assertEqual(text, "Excel 已生成。")


if __name__ == "__main__":
    unittest.main()