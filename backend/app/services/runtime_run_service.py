from __future__ import annotations

import threading
from datetime import datetime
from typing import Any, Optional
from uuid import uuid4


class RuntimeRunStore:
    def __init__(self):
        self._runs: dict[str, dict[str, Any]] = {}
        self._approvals: dict[tuple[str, str], dict[str, Any]] = {}
        self._lock = threading.Lock()

    def create(self, chat_id: int, request_data: Optional[dict[str, Any]] = None) -> str:
        run_id = uuid4().hex
        with self._lock:
            self._runs[run_id] = {
                "id": run_id,
                "chat_id": chat_id,
                "status": "queued",
                "events": [],
                "result": None,
                "error": None,
                "created_at": datetime.now().isoformat(),
                "updated_at": datetime.now().isoformat(),
                "request_data": request_data,
            }
        return run_id

    def update(
        self,
        run_id: str,
        *,
        status: Optional[str] = None,
        event: Optional[dict] = None,
        result: Any = None,
        error: Optional[str] = None,
    ) -> None:
        with self._lock:
            run = self._runs.get(run_id)
            if run is None:
                return
            if status:
                run["status"] = status
            if event:
                run["events"].append(event)
            if result is not None:
                run["result"] = result
            if error is not None:
                run["error"] = error
            run["updated_at"] = datetime.now().isoformat()

    def get(self, run_id: str) -> Optional[dict]:
        with self._lock:
            run = self._runs.get(run_id)
            return {**run, "events": list(run["events"])} if run else None

    def get_request(self, run_id: str) -> Optional[dict[str, Any]]:
        with self._lock:
            run = self._runs.get(run_id)
            return dict(run.get("request_data") or {}) if run else None

    def register_approval(self, run_id: str, request_id: str, details: dict[str, Any]) -> threading.Event:
        event = threading.Event()
        with self._lock:
            self._approvals[(run_id, request_id)] = {
                "event": event,
                "approved": None,
                "details": details,
            }
        return event

    def resolve_approval(self, run_id: str, request_id: str, approved: bool) -> bool:
        with self._lock:
            approval = self._approvals.get((run_id, request_id))
            if approval is None:
                return False
            approval["approved"] = approved
            approval["event"].set()
            return True

    def wait_for_approval(self, run_id: str, request_id: str, timeout: Optional[float] = None) -> Optional[bool]:
        with self._lock:
            approval = self._approvals.get((run_id, request_id))
        if approval is None:
            return None
        approval["event"].wait(timeout)
        with self._lock:
            current = self._approvals.pop((run_id, request_id), None)
            return current.get("approved") if current else None


runtime_run_store = RuntimeRunStore()

_runtime_context = threading.local()


def set_runtime_event_callback(callback) -> None:
    _runtime_context.event_callback = callback


def clear_runtime_event_callback() -> None:
    _runtime_context.event_callback = None


def get_runtime_event_callback():
    return getattr(_runtime_context, "event_callback", None)


def set_runtime_approval_callback(callback) -> None:
    _runtime_context.approval_callback = callback


def clear_runtime_approval_callback() -> None:
    _runtime_context.approval_callback = None


def get_runtime_approval_callback():
    return getattr(_runtime_context, "approval_callback", None)


def build_public_runtime_event(event: dict, generated_files: list[str]) -> dict:
    event_type = str(event.get("type") or "runtime.event")
    params = event.get("params") or {}
    item = event.get("item") or event.get("output_item") or params.get("item") or {}
    item_type = str(item.get("type") or "")
    command = event.get("command") or params.get("command") or item.get("command") or ""
    reason = event.get("reason") or params.get("reason") or item.get("reason") or ""
    labels = {
        "thread.started": "已连接 Codex",
        "turn.started": "正在分析请求",
        "turn.completed": "正在整理最终答案",
        "response.started": "正在分析请求",
        "response.completed": "正在整理最终答案",
    }
    if event_type in {"item/commandExecution/requestApproval", "item/fileChange/requestApproval"}:
        label = "请求审批：Codex 准备执行文件或命令操作"
    elif event_type == "run.approval_resolved":
        label = "审批结果：已批准，继续执行"
    elif event_type in {"item/commandExecution/started", "item/commandExecution/progress"}:
        label = "正在执行任务命令"
    elif event_type == "item/commandExecution/completed":
        label = "任务命令执行完成"
    elif event_type in {"item/fileChange/started", "item/fileChange/progress"}:
        label = "正在写入文件"
    elif event_type == "item/fileChange/completed":
        label = "文件写入完成"
    elif event_type in {"item/mcpToolCall/started", "item/mcpToolCall/progress"}:
        label = "正在调用工具"
    elif event_type == "item/mcpToolCall/completed":
        label = "工具调用完成"
    elif event_type in {"item/agentMessage/delta", "item/agentMessage/started"}:
        label = "正在整理最终答案"
    elif event_type == "item/agentMessage/completed":
        label = "最终答案已生成"
    elif event_type in {"item/started", "item/reasoning/started", "item/reasoning/textDelta"}:
        label = "正在分析当前任务"
    elif item_type in {"command_execution", "commandExecution", "shell_command"}:
        label = "正在执行任务命令" if "completed" not in event_type else "任务命令执行完成"
    elif item_type in {"mcp_tool_call", "mcpToolCall", "tool_call", "function_call"}:
        tool_name = item.get("name") or item.get("server") or "工具"
        label = f"正在调用 {tool_name}" if "completed" not in event_type else f"{tool_name} 调用完成"
    elif item_type in {"agent_message", "agentMessage", "message"}:
        label = "正在整理最终答案"
    elif item_type in {"reasoning", "analysis"}:
        label = "正在分析并推进任务"
    else:
        label = labels.get(event_type, "正在推进任务")
    public_event = {
        "type": event_type,
        "label": label,
        "generated_files": [path.replace("\\", "/").split("/")[-1] for path in generated_files],
        "created_at": datetime.now().isoformat(),
    }
    if command:
        public_event["action"] = "执行命令"
        public_event["target"] = command
    if reason:
        public_event["reason"] = reason
    if event_type in {"item/commandExecution/requestApproval", "item/fileChange/requestApproval"}:
        public_event["approval_required"] = True
    return public_event