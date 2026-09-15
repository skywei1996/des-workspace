from __future__ import annotations

import json
import os
import queue
import shutil
import subprocess
import tempfile
import threading
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Optional
from uuid import uuid4

from sqlalchemy.orm import Session

from app import models


@dataclass
class CodexRuntimeResult:
    text: str
    events: list[dict[str, Any]]
    model: str
    provider: str
    generated_files: list[str]


class CodexRuntimeError(RuntimeError):
    pass


class CodexRuntime:
    DEFAULT_TIMEOUT_SECONDS = 900

    def __init__(self, executable: Optional[str] = None, timeout_seconds: Optional[int] = None):
        self.executable = executable or self._find_executable()
        self.timeout_seconds = timeout_seconds or self._configured_timeout_seconds()
        if self.timeout_seconds is None:
            self.timeout_seconds = self.DEFAULT_TIMEOUT_SECONDS
        if not self.executable:
            raise CodexRuntimeError("Codex CLI was not found on PATH")

    @staticmethod
    def _configured_timeout_seconds() -> Optional[int]:
        configured_timeout = os.getenv("CODEX_RUNTIME_TIMEOUT_SECONDS")
        if not configured_timeout:
            return None
        try:
            return max(1, int(configured_timeout))
        except (TypeError, ValueError):
            return CodexRuntime.DEFAULT_TIMEOUT_SECONDS

    @staticmethod
    def _find_executable() -> Optional[str]:
        candidates = [
            shutil.which("codex"),
            os.getenv("CODEX_CLI_PATH"),
            str(Path.home() / "AppData" / "Local" / "Programs" / "OpenAI" / "Codex" / "bin" / "codex.exe"),
        ]
        return next((candidate for candidate in candidates if candidate and Path(candidate).exists()), None)

    def run(
        self,
        *,
        prompt: str,
        model_config: Optional[dict[str, Any]] = None,
        db: Optional[Session] = None,
        tool_ids: Optional[list[str]] = None,
        cwd: Optional[str] = None,
        full_access: bool = False,
    ) -> CodexRuntimeResult:
        configuration = self._normalize_model_config(model_config or {})
        if configuration["wire_api"] != "responses":
            raise CodexRuntimeError(
                "Codex runtime requires a Responses API provider; "
                f"the configured provider uses {configuration['wire_api']}. "
                "Configure a Responses-compatible endpoint or enable the DES protocol adapter."
            )
        try:
            env = os.environ.copy()
            if configuration["api_key"]:
                env["OPENAI_API_KEY"] = configuration["api_key"]

            project_root = Path(__file__).resolve().parents[3]
            artifact_dir = project_root / "workspace" / "generated" / f"codex_{uuid4().hex}"
            artifact_dir.mkdir(parents=True, exist_ok=True)
            env["DES_ARTIFACT_DIR"] = str(artifact_dir)
            env["DES_PYTHON_EXECUTABLE"] = str(project_root / ".venv" / "Scripts" / "python.exe")

            harness_prompt = (
                "HARNESS FILE DELIVERY:\n"
                "- You have full workspace-write access. Never claim that the environment is read-only or that files cannot be written.\n"
                "- When the user requests a file, create the actual file instead of returning source code or save instructions.\n"
                "- Write every requested deliverable inside the directory from the DES_ARTIFACT_DIR environment variable.\n"
                "- For PDF output, use the Python interpreter from DES_PYTHON_EXECUTABLE and an installed PDF library such as ReportLab.\n"
                "- For PPT/PPTX output, use DES_PYTHON_EXECUTABLE with python-pptx to create a native .pptx file. Do not substitute HTML, Markdown, or code text for the PPTX.\n"
                "- For XLSX output, use DES_PYTHON_EXECUTABLE with openpyxl to read the provided workbook and write a real .xlsx file inside DES_ARTIFACT_DIR. Do not return source code or claim that shell execution is unavailable.\n"
                "- After creating a PPTX, reopen it with python-pptx and verify that it contains at least one slide before completing.\n"
                "- After creating an XLSX, reopen it with openpyxl and verify that it contains at least one worksheet before completing.\n"
                "- For every requested file, you must execute the required Python command before your final response; a text-only answer is not completion.\n"
                "- Do not merely provide instructions for creating the file; create it and then summarize the result.\n\n"
                f"{prompt}"
            )

            config_args = self._build_config_args(configuration, db, tool_ids)
            command = [
                self.executable,
                "exec",
                "--ephemeral",
                "--skip-git-repo-check",
                "--json",
                "--sandbox",
                "danger-full-access" if full_access else "workspace-write",
                "--approve-for-me",
                *config_args,
                harness_prompt,
            ]
            with tempfile.TemporaryDirectory(prefix="des-codex-home-") as codex_home:
                env["CODEX_HOME"] = codex_home
                Path(codex_home, "auth.json").write_text(
                    json.dumps({"OPENAI_API_KEY": configuration["api_key"]}),
                    encoding="utf-8",
                )
                completed = subprocess.run(
                    command,
                    cwd=cwd or str(project_root),
                    env=env,
                    capture_output=True,
                    text=True,
                    encoding="utf-8",
                    errors="replace",
                    timeout=self.timeout_seconds,
                    check=False,
                )
            events = self._parse_events(completed.stdout)
            if completed.returncode != 0:
                detail = completed.stderr.strip() or completed.stdout.strip() or "unknown Codex runtime error"
                raise CodexRuntimeError(detail[-4000:])
            text = self._extract_final_text(events)
            if not text:
                raise CodexRuntimeError("Codex runtime returned no user-facing answer")
            return CodexRuntimeResult(
                text=text,
                events=events,
                model=configuration["model"],
                provider=configuration["provider"],
                generated_files=[
                    str(file_path)
                    for file_path in artifact_dir.rglob("*")
                    if file_path.is_file()
                ],
            )
        except subprocess.TimeoutExpired as error:
            generated_files = [
                str(file_path)
                for file_path in artifact_dir.rglob("*")
                if file_path.is_file()
            ]
            if generated_files:
                partial_text = self._extract_final_text(self._parse_events(error.stdout or ""))
                return CodexRuntimeResult(
                    text=partial_text or "文件已生成，但 Codex 在完成最终回复前超时。",
                    events=self._parse_events(error.stdout or ""),
                    model=configuration["model"],
                    provider=configuration["provider"],
                    generated_files=generated_files,
                )
            raise CodexRuntimeError(
                f"Codex runtime timed out after {self.timeout_seconds} seconds"
            ) from error

    def run_streaming(
        self,
        *,
        prompt: str,
        model_config: Optional[dict[str, Any]] = None,
        db: Optional[Session] = None,
        tool_ids: Optional[list[str]] = None,
        cwd: Optional[str] = None,
        on_event=None,
        full_access: bool = False,
    ) -> CodexRuntimeResult:
        configuration = self._normalize_model_config(model_config or {})
        if configuration["wire_api"] != "responses":
            raise CodexRuntimeError("Codex runtime requires a Responses API provider")

        project_root = Path(__file__).resolve().parents[3]
        artifact_dir = project_root / "workspace" / "generated" / f"codex_{uuid4().hex}"
        artifact_dir.mkdir(parents=True, exist_ok=True)
        env = os.environ.copy()
        if configuration["api_key"]:
            env["OPENAI_API_KEY"] = configuration["api_key"]
        env["DES_ARTIFACT_DIR"] = str(artifact_dir)
        env["DES_PYTHON_EXECUTABLE"] = str(project_root / ".venv" / "Scripts" / "python.exe")
        harness_prompt = (
            "HARNESS FILE DELIVERY:\n"
            "- You have full workspace-write access. Never claim that the environment is read-only or that files cannot be written.\n"
            "- Create every requested file inside DES_ARTIFACT_DIR instead of returning source code or save instructions.\n"
            "- For PPT/PPTX output, use DES_PYTHON_EXECUTABLE with python-pptx to create a native .pptx file. Do not substitute HTML, Markdown, or code text for the PPTX.\n"
            "- For XLSX output, use DES_PYTHON_EXECUTABLE with openpyxl to read the provided workbook and write a real .xlsx file inside DES_ARTIFACT_DIR. Do not return source code or claim that shell execution is unavailable.\n"
            "- Reopen every generated PPTX with python-pptx and verify that it contains at least one slide before completing.\n"
            "- Reopen every generated XLSX with openpyxl and verify that it contains at least one worksheet before completing.\n"
            "- For every requested file, you must execute the required Python command before your final response; a text-only answer is not completion.\n"
            "- Summarize the result only after the requested files have been written and validated.\n\n"
            f"{prompt}"
        )
        command = [
            self.executable,
            "exec",
            "--ephemeral",
            "--skip-git-repo-check",
            "--json",
            "--sandbox",
            "danger-full-access" if full_access else "workspace-write",
            "--approve-for-me",
            *self._build_config_args(configuration, db, tool_ids),
            harness_prompt,
        ]
        events: list[dict[str, Any]] = []
        with tempfile.TemporaryDirectory(prefix="des-codex-home-") as codex_home:
            env["CODEX_HOME"] = codex_home
            Path(codex_home, "auth.json").write_text(
                json.dumps({"OPENAI_API_KEY": configuration["api_key"]}),
                encoding="utf-8",
            )
            process = subprocess.Popen(
                command,
                cwd=cwd or str(project_root),
                env=env,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                encoding="utf-8",
                errors="replace",
            )
            assert process.stdout is not None
            output_queue: queue.Queue[tuple[str, str | None]] = queue.Queue()

            def read_output(stream, stream_name: str) -> None:
                for line in stream:
                    output_queue.put((stream_name, line))
                output_queue.put((stream_name, None))

            stdout_thread = threading.Thread(
                target=read_output,
                args=(process.stdout, "stdout"),
                daemon=True,
            )
            stderr_thread = threading.Thread(
                target=read_output,
                args=(process.stderr, "stderr"),
                daemon=True,
            )
            stdout_thread.start()
            stderr_thread.start()
            stderr_lines: list[str] = []
            finished_streams: set[str] = set()
            deadline = time.monotonic() + self.timeout_seconds if self.timeout_seconds else None
            while len(finished_streams) < 2:
                remaining = max(0.05, deadline - time.monotonic()) if deadline else None
                if remaining is not None and remaining <= 0:
                    process.kill()
                    stdout_thread.join(timeout=1)
                    stderr_thread.join(timeout=1)
                    raise CodexRuntimeError(
                        f"Codex runtime timed out after {self.timeout_seconds} seconds"
                    )
                try:
                    stream_name, line = output_queue.get(timeout=remaining)
                except queue.Empty as error:
                    process.kill()
                    stdout_thread.join(timeout=1)
                    stderr_thread.join(timeout=1)
                    raise CodexRuntimeError(
                        f"Codex runtime timed out after {self.timeout_seconds} seconds"
                    ) from error
                if line is None:
                    finished_streams.add(stream_name)
                    continue
                if stream_name == "stderr":
                    stderr_lines.append(line)
                    continue
                parsed_events = self._parse_events(line)
                events.extend(parsed_events)
                for event in parsed_events:
                    if on_event:
                        generated_files = [str(path) for path in artifact_dir.rglob("*") if path.is_file()]
                        on_event(event, generated_files)
            return_code = process.wait()
            stderr = "".join(stderr_lines)

        if return_code != 0:
            raise CodexRuntimeError(stderr.strip() or "unknown Codex runtime error")
        text = self._extract_final_text(events)
        if not text:
            raise CodexRuntimeError("Codex runtime returned no user-facing answer")
        return CodexRuntimeResult(
            text=text,
            events=events,
            model=configuration["model"],
            provider=configuration["provider"],
            generated_files=[str(path) for path in artifact_dir.rglob("*") if path.is_file()],
        )

    def run_app_server(
        self,
        *,
        prompt: str,
        model_config: Optional[dict[str, Any]] = None,
        db: Optional[Session] = None,
        tool_ids: Optional[list[str]] = None,
        cwd: Optional[str] = None,
        on_event=None,
        on_approval=None,
        full_access: bool = False,
    ) -> CodexRuntimeResult:
        configuration = self._normalize_model_config(model_config or {})
        if configuration["wire_api"] != "responses":
            raise CodexRuntimeError("Codex runtime requires a Responses API provider")
        project_root = Path(__file__).resolve().parents[3]
        artifact_dir = project_root / "workspace" / "generated" / f"codex_{uuid4().hex}"
        artifact_dir.mkdir(parents=True, exist_ok=True)
        env = os.environ.copy()
        if configuration["api_key"]:
            env["OPENAI_API_KEY"] = configuration["api_key"]
        env["DES_ARTIFACT_DIR"] = str(artifact_dir)
        env["DES_PYTHON_EXECUTABLE"] = str(project_root / ".venv" / "Scripts" / "python.exe")
        harness_prompt = (
            "HARNESS FILE DELIVERY:\n"
            "- You have full workspace-write access. Never claim that the environment is read-only or that files cannot be written.\n"
            "- When the user requests a file, create the actual file instead of returning source code or save instructions.\n"
            f"- Write every requested deliverable inside this exact directory: {artifact_dir}.\n"
            f"- For XLSX output, use this exact Python interpreter: {env['DES_PYTHON_EXECUTABLE']}. Use openpyxl to read the provided workbook and write a real .xlsx file inside the artifact directory. Do not return source code or claim that shell execution is unavailable.\n"
            "- For every requested file, execute the required Python command before your final response; a text-only answer is not completion.\n"
            "- After creating an XLSX, reopen it with openpyxl and verify that it contains at least one worksheet before completing.\n"
            "- Do not merely provide instructions for creating the file; create it and then summarize the result.\n\n"
            f"{prompt}"
        )
        command = [
            self.executable,
            "app-server",
            *self._build_config_args(configuration, db, tool_ids),
            "--stdio",
        ]
        events: list[dict[str, Any]] = []
        with tempfile.TemporaryDirectory(prefix="des-codex-home-") as codex_home:
            env["CODEX_HOME"] = codex_home
            Path(codex_home, "auth.json").write_text(
                json.dumps({"OPENAI_API_KEY": configuration["api_key"]}), encoding="utf-8"
            )
            process = subprocess.Popen(
                command,
                cwd=cwd or str(project_root),
                env=env,
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                encoding="utf-8",
                errors="replace",
                bufsize=1,
            )
            assert process.stdin is not None and process.stdout is not None
            request_counter = 0

            def send(payload: dict[str, Any]) -> None:
                process.stdin.write(json.dumps(payload, ensure_ascii=False) + "\n")
                process.stdin.flush()

            def request(method: str, params: dict[str, Any]) -> dict[str, Any]:
                nonlocal request_counter
                request_counter += 1
                request_id = str(request_counter)
                send({"id": request_id, "method": method, "params": params})
                while True:
                    line = process.stdout.readline()
                    if not line:
                        raise CodexRuntimeError("Codex app-server closed before responding")
                    message = json.loads(line)
                    if "id" in message and str(message["id"]) == request_id:
                        if "error" in message:
                            raise CodexRuntimeError(str(message["error"]))
                        return message.get("result") or {}
                    self._handle_app_server_message(message, events, on_event, on_approval, send)

            request("initialize", {"clientInfo": {"name": "des-workmate", "version": "1.0"}})
            send({"method": "initialized", "params": {}})
            thread = request("thread/start", {
                "model": configuration["model"],
                "modelProvider": configuration["provider"],
                "cwd": cwd or str(project_root),
                "sandbox": "danger-full-access" if full_access else "workspace-write",
                "approvalPolicy": "never" if full_access else "on-request",
                "ephemeral": True,
            }).get("thread") or {}
            request("turn/start", {
                "threadId": thread.get("id"),
                "input": [{"type": "text", "text": harness_prompt}],
            })
            turn_completed = False
            while process.poll() is None and not turn_completed:
                line = process.stdout.readline()
                if not line:
                    break
                message = json.loads(line)
                turn_completed = self._handle_app_server_message(
                    message, events, on_event, on_approval, send
                )
            process.terminate()
            process.wait(timeout=5)
            stderr = process.stderr.read() if process.stderr else ""
        if not turn_completed:
            raise CodexRuntimeError(stderr.strip() or "unknown Codex app-server error")
        text = self._extract_final_text(events)
        if not text:
            raise CodexRuntimeError("Codex runtime returned no user-facing answer")
        return CodexRuntimeResult(
            text=text,
            events=events,
            model=configuration["model"],
            provider=configuration["provider"],
            generated_files=[str(path) for path in artifact_dir.rglob("*") if path.is_file()],
        )

    def _handle_app_server_message(self, message, events, on_event, on_approval, send) -> bool:
        if "method" in message and message["method"] in {
            "item/commandExecution/requestApproval",
            "item/fileChange/requestApproval",
        }:
            if on_approval is None:
                send({"id": message["id"], "result": {"decision": "cancel"}})
            else:
                decision = on_approval(str(message["id"]), message["method"], message.get("params") or {})
                send({"id": message["id"], "result": {"decision": decision}})
            return False
        if "method" in message:
            event = {**(message.get("params") or {}), "type": message["method"]}
            if message["method"] == "item/agentMessage/delta":
                delta = (message.get("params") or {}).get("delta") or (message.get("params") or {}).get("text")
                if isinstance(delta, str) and delta:
                    event["text"] = delta
            events.append(event)
            if on_event:
                on_event(event, [])
            return message["method"] == "turn/completed"
        return False

    def _normalize_model_config(self, model_config: dict[str, Any]) -> dict[str, str]:
        endpoint = str(model_config.get("base_url") or "").rstrip("/")
        if endpoint.endswith("/chat/completions"):
            endpoint = endpoint.removesuffix("/chat/completions")
        return {
            "model": str(model_config.get("model") or os.getenv("LLM_MODEL") or "gpt-5"),
            "provider": str(model_config.get("provider") or "des_employee"),
            "base_url": endpoint,
            "api_key": str(model_config.get("api_key") or ""),
            "wire_api": str(model_config.get("wire_api") or "responses").lower(),
        }

    def _build_config_args(
        self,
        configuration: dict[str, str],
        db: Optional[Session],
        tool_ids: Optional[list[str]],
    ) -> list[str]:
        args = [
            "-c",
            f'model_provider="{configuration["provider"]}"',
            "-c",
            f'model="{configuration["model"]}"',
        ]
        if configuration["base_url"]:
            provider_prefix = f"model_providers.{configuration['provider']}"
            args.extend([
                "-c",
                f'{provider_prefix}.name="{configuration["provider"]}"',
                "-c",
                f'{provider_prefix}.base_url="{configuration["base_url"]}"',
                "-c",
                f'{provider_prefix}.wire_api="{configuration["wire_api"]}"',
                "-c",
                f'{provider_prefix}.requires_openai_auth=true',
            ])
        if db is not None and tool_ids:
            from app.services.mcp_resolver import resolve_mcp_bindings

            bindings = resolve_mcp_bindings(tool_ids, db)
            for binding in bindings:
                server = binding.server
                if not server.url:
                    continue
                server_name = self._sanitize_name(server.server_key)
                args.extend([
                    "-c",
                    f'mcp_servers.{server_name}.url="{server.url}"',
                ])
                if server.headers:
                    for header_name, header_value in server.headers.items():
                        args.extend([
                            "-c",
                            f'mcp_servers.{server_name}.http_headers.{header_name}="{header_value}"',
                        ])
        return args

    @staticmethod
    def _sanitize_name(value: str) -> str:
        return "".join(character if character.isalnum() or character == "_" else "_" for character in value)

    @staticmethod
    def _parse_events(output: str) -> list[dict[str, Any]]:
        events = []
        for line in output.splitlines():
            try:
                event = json.loads(line)
            except json.JSONDecodeError:
                continue
            if isinstance(event, dict):
                events.append(event)
        return events

    @staticmethod
    def _extract_final_text(events: list[dict[str, Any]]) -> str:
        delta_text = ""
        for event in events:
            if event.get("type") == "item/agentMessage/delta":
                text = event.get("text")
                if isinstance(text, str):
                    delta_text += text
        for event in reversed(events):
            if event.get("type") in {"item.completed", "item/completed", "response.output_item.done"}:
                item = event.get("item") or event.get("output_item") or {}
                if item.get("type") in {"agent_message", "agentMessage", "message"}:
                    text = item.get("text") or item.get("content")
                    if isinstance(text, str) and text.strip():
                        return text.strip()
            text = event.get("text")
            if event.get("type") in {"agent_message", "assistant_message", "response.completed"} and isinstance(text, str) and text.strip():
                return text.strip()
        return delta_text.strip()
