import json
import re
import urllib.error
import urllib.request
import uuid
import logging
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

from app import models


logger = logging.getLogger(__name__)


def _extract_json_from_sse(raw: str) -> Optional[Dict[str, Any]]:
    if not isinstance(raw, str):
        return None

    event_blocks = [block.strip() for block in raw.split("\n\n") if block.strip()]
    for block in reversed(event_blocks):
        data_lines: List[str] = []
        for line in block.splitlines():
            normalized = line.strip()
            if normalized.startswith("data:"):
                data_lines.append(normalized[5:].strip())

        if not data_lines:
            continue

        payload_text = "\n".join(data_lines).strip()
        if not payload_text:
            continue

        try:
            payload = json.loads(payload_text)
        except json.JSONDecodeError:
            continue

        if isinstance(payload, dict):
            return payload

    return None


def _extract_mcp_json_payload(response: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    text = _extract_first_text_content(response)
    if not text.strip():
        return None

    try:
        payload = json.loads(text)
    except json.JSONDecodeError:
        return None

    return payload if isinstance(payload, dict) else None


def _extract_search_user_identifiers(response: Dict[str, Any]) -> List[str]:
    payload = _extract_mcp_json_payload(response)
    if not payload:
        return []

    identifiers: List[str] = []
    for item in payload.get("list") or []:
        if isinstance(item, str):
            normalized = item.strip()
            if normalized and normalized not in identifiers:
                identifiers.append(normalized)
            continue
        if not isinstance(item, dict):
            continue
        for field_name in ("userid", "userId", "unionId"):
            value = str(item.get(field_name) or "").strip()
            if value and value not in identifiers:
                identifiers.append(value)
    return identifiers


def _collect_create_event_user_identifiers(arguments: Dict[str, Any]) -> List[str]:
    identifiers: List[str] = []

    for field_name in ("userId", "userid", "unionId"):
        value = arguments.get(field_name)
        normalized = str(value or "").strip()
        if normalized and normalized not in identifiers:
            identifiers.append(normalized)

    attendees = arguments.get("attendees") or []
    if isinstance(attendees, list):
        for attendee in attendees:
            if not isinstance(attendee, dict):
                continue
            for field_name in ("userId", "userid", "unionId", "id"):
                value = str(attendee.get(field_name) or "").strip()
                if value and value not in identifiers:
                    identifiers.append(value)

    return identifiers


def _extract_user_detail_identifiers(response: Dict[str, Any]) -> Dict[str, str]:
    payload = _extract_mcp_json_payload(response)
    if not payload:
        return {}

    result = payload.get("result") or {}
    if not isinstance(result, dict):
        return {}

    identifiers: Dict[str, str] = {}
    for field_name in ("userid", "unionid"):
        value = str(result.get(field_name) or "").strip()
        if value:
            identifiers[field_name] = value
    return identifiers


def _extract_search_user_total_count(response: Dict[str, Any]) -> Optional[int]:
    result = response.get("result") or {}
    content = result.get("content") or []
    if not content:
        return None

    first_item = content[0] or {}
    text = first_item.get("text")
    if not isinstance(text, str) or not text.strip():
        return None

    try:
        payload = json.loads(text)
    except json.JSONDecodeError:
        return None

    total_count = payload.get("totalCount")
    if isinstance(total_count, int):
        return total_count
    return None


def _extract_first_text_content(response: Dict[str, Any]) -> str:
    result = response.get("result") or {}
    content = result.get("content") or []
    if not content:
        return ""

    first_item = content[0] or {}
    text = first_item.get("text")
    return text if isinstance(text, str) else ""


def _has_invalid_full_match_error(response: Dict[str, Any]) -> bool:
    text = _extract_first_text_content(response)
    return "InvalidfullMatchField" in text or "fullMatchField is not valid" in text


@dataclass
class MCPToolDescriptor:
    name: str
    description: str
    input_schema: Dict[str, Any]


@dataclass
class MCPServerSnapshot:
    id: Optional[int]
    server_key: str
    name: str
    transport: str
    url: Optional[str]
    headers: Dict[str, str]
    timeout_seconds: Optional[int]


def _snapshot_server(server: models.MCPServer) -> MCPServerSnapshot:
    return MCPServerSnapshot(
        id=getattr(server, "id", None),
        server_key=str(getattr(server, "server_key", "") or ""),
        name=str(getattr(server, "name", "") or ""),
        transport=str(getattr(server, "transport", "") or ""),
        url=getattr(server, "url", None),
        headers={str(k): str(v) for k, v in (getattr(server, "headers", None) or {}).items()},
        timeout_seconds=getattr(server, "timeout_seconds", None),
    )


class MCPHTTPClient:
    """Very small JSON-RPC HTTP client for MCP tools/list and tools/call."""

    def __init__(self, server: models.MCPServer):
        self.server = _snapshot_server(server)
        self._request_id = 1
        self._session_id: Optional[str] = None
        self._last_initialize_error: Optional[Exception] = None
        self._resolved_dingtalk_user_identifiers: set[str] = set()
        self._dingtalk_userid_to_unionid: Dict[str, str] = {}

    @property
    def _is_dingtalk_server(self) -> bool:
        server_key = re.sub(r"[\s_]+", "", str(self.server.server_key or "").lower())
        server_name = re.sub(r"[\s_]+", "", str(self.server.name or "").lower())
        return "dingtalk" in server_key or "dingtalk" in server_name or "钉" in server_name

    def _cache_dingtalk_identifiers(self, *identifiers: str) -> None:
        for value in identifiers:
            normalized = str(value or "").strip()
            if normalized:
                self._resolved_dingtalk_user_identifiers.add(normalized)

    def _lookup_unionid_by_userid(self, userid: str) -> Optional[str]:
        normalized_userid = str(userid or "").strip()
        if not normalized_userid:
            return None

        cached_unionid = self._dingtalk_userid_to_unionid.get(normalized_userid)
        if cached_unionid:
            return cached_unionid

        response = self._post(
            "tools/call",
            {
                "name": "getUserDetailByUserId",
                "arguments": {"userid": normalized_userid},
            },
        )
        logger.info(
            "MCP tools/call (normalize) <- server=%s tool=%s response=%s",
            self.server.server_key,
            "getUserDetailByUserId",
            json.dumps(response, ensure_ascii=False),
        )
        identifiers = _extract_user_detail_identifiers(response)
        resolved_userid = identifiers.get("userid")
        resolved_unionid = identifiers.get("unionid")
        if resolved_userid and resolved_unionid:
            self._dingtalk_userid_to_unionid[resolved_userid] = resolved_unionid
            self._cache_dingtalk_identifiers(resolved_userid, resolved_unionid)
            return resolved_unionid

        return None

    def _normalize_dingtalk_create_event_arguments(self, arguments: Dict[str, Any]) -> Dict[str, Any]:
        normalized = dict(arguments or {})

        top_level_identifier = str(
            normalized.get("unionId")
            or normalized.get("userId")
            or normalized.get("userid")
            or ""
        ).strip()
        if top_level_identifier:
            resolved_unionid = self._lookup_unionid_by_userid(top_level_identifier)
            final_unionid = resolved_unionid or top_level_identifier
            normalized["unionId"] = final_unionid
            normalized.pop("userId", None)
            normalized.pop("userid", None)
            self._cache_dingtalk_identifiers(final_unionid)

        raw_unionid = str(normalized.get("unionId") or "").strip()
        if raw_unionid:
            resolved_unionid = self._lookup_unionid_by_userid(raw_unionid)
            if resolved_unionid:
                normalized["unionId"] = resolved_unionid
                raw_unionid = resolved_unionid
            self._cache_dingtalk_identifiers(raw_unionid)

        attendees = normalized.get("attendees") or []
        if isinstance(attendees, list):
            normalized_attendees = []
            for attendee in attendees:
                if not isinstance(attendee, dict):
                    normalized_attendees.append(attendee)
                    continue

                normalized_attendee = dict(attendee)
                attendee_identifier = str(
                    normalized_attendee.get("id")
                    or normalized_attendee.get("userId")
                    or normalized_attendee.get("userid")
                    or normalized_attendee.get("unionId")
                    or ""
                ).strip()
                if attendee_identifier:
                    resolved_unionid = self._lookup_unionid_by_userid(attendee_identifier)
                    final_identifier = resolved_unionid or attendee_identifier
                    normalized_attendee["id"] = final_identifier
                    normalized_attendee.pop("userId", None)
                    normalized_attendee.pop("userid", None)
                    normalized_attendee.pop("unionId", None)
                    self._cache_dingtalk_identifiers(final_identifier)

                normalized_attendees.append(normalized_attendee)

            normalized["attendees"] = normalized_attendees

        return normalized

    @property
    def _is_streamable_http(self) -> bool:
        return (self.server.transport or "").lower() in {"streamable-http", "streamable_http"}

    @property
    def _headers(self) -> Dict[str, str]:
        merged = {"Content-Type": "application/json"}
        if self.server.headers:
            merged.update({str(k): str(v) for k, v in self.server.headers.items()})
        if self._is_streamable_http:
            merged.setdefault("Accept", "application/json, text/event-stream")
            merged.setdefault("MCP-Protocol-Version", "2024-11-05")
            if self._session_id:
                merged.setdefault("MCP-Session-Id", self._session_id)
        return merged

    @property
    def _timeout(self) -> int:
        timeout = self.server.timeout_seconds or 15
        return min(max(int(timeout), 3), 120)

    def _post_payload(self, body: Dict[str, Any]) -> Dict[str, Any]:
        payload = json.dumps(body).encode("utf-8")
        request = urllib.request.Request(
            self.server.url,
            data=payload,
            headers=self._headers,
            method="POST",
        )

        with urllib.request.urlopen(request, timeout=self._timeout) as response:
            session_id = response.headers.get("MCP-Session-Id")
            if session_id:
                self._session_id = session_id
            raw = response.read().decode("utf-8", errors="replace")
            if not raw.strip():
                return {}
            try:
                return json.loads(raw)
            except json.JSONDecodeError as exc:
                sse_payload = _extract_json_from_sse(raw)
                if sse_payload is not None:
                    return sse_payload
                raise ValueError(f"Invalid JSON response from MCP server: {raw[:500]}") from exc

    def _post(self, method: str, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        body = {
            "jsonrpc": "2.0",
            "id": self._request_id,
            "method": method,
        }
        # Some MCP servers reject tools/list with params: {} and require params to be absent.
        if params is not None:
            body["params"] = params
        self._request_id += 1
        return self._post_payload(body)

    def _notify_initialized_if_possible(self) -> None:
        try:
            self._post_payload({
                "jsonrpc": "2.0",
                "method": "notifications/initialized",
            })
        except Exception:
            return

    def _initialize_if_possible(self) -> None:
        # Some hosted MCP servers require initialize first, some don't.
        initialize_payload = {
            "protocolVersion": "2024-11-05",
            "capabilities": {},
            "clientInfo": {"name": "des-workmate", "version": "0.1.0"},
        }
        try:
            response = self._post("initialize", initialize_payload)
            if "error" in response:
                raise ValueError(f"initialize returned error: {response['error']}")
            self._last_initialize_error = None
            self._notify_initialized_if_possible()
        except Exception as exc:
            self._last_initialize_error = exc
            return

    def _refresh_session_if_possible(self) -> None:
        self._session_id = None
        self._initialize_if_possible()
        try:
            self._post("tools/list", None)
        except Exception as exc:
            logger.warning(
                "MCP tools/list refresh failed for server=%s: %s",
                self.server.server_key,
                exc,
            )

    def _call_tool_rpc(self, tool_name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
        return self._post(
            "tools/call",
            {
                "name": tool_name,
                "arguments": arguments,
            },
        )

    def _should_retry_dingtalk_http_error(self, tool_name: str, exc: urllib.error.HTTPError) -> bool:
        if not self._is_dingtalk_server:
            return False
        if exc.code not in {400, 401}:
            return False
        return tool_name in {"searchUser", "getReportList", "getUserDetailByUserId", "createEvent", "currentDateTime"}

    def list_tools(self) -> List[MCPToolDescriptor]:
        self._initialize_if_possible()
        try:
            response = self._post("tools/list", None)
        except Exception as exc:
            if self._last_initialize_error is not None:
                raise ValueError(
                    f"initialize failed: {self._last_initialize_error}; tools/list failed: {exc}"
                ) from exc
            raise
        if "error" in response:
            raise ValueError(f"tools/list returned error: {response['error']}")
        result = response.get("result") or {}
        tool_rows = result.get("tools") or []
        if not isinstance(tool_rows, list):
            raise ValueError(f"tools/list returned invalid tools payload: {result}")

        tools: List[MCPToolDescriptor] = []
        for row in tool_rows:
            name = str(row.get("name", "")).strip()
            if not name:
                continue
            tools.append(
                MCPToolDescriptor(
                    name=name,
                    description=str(row.get("description") or "MCP tool"),
                    input_schema=row.get("inputSchema") or row.get("input_schema") or {},
                )
            )
        return tools

    def call_tool(self, tool_name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
        normalized_arguments = dict(arguments or {})

        if self._is_dingtalk_server and tool_name == "createEvent":
            normalized_arguments = self._normalize_dingtalk_create_event_arguments(normalized_arguments)
            unresolved_identifiers = [
                value for value in _collect_create_event_user_identifiers(normalized_arguments)
                if value not in self._resolved_dingtalk_user_identifiers
            ]
            if unresolved_identifiers:
                return {
                    "ok": False,
                    "error": (
                        "createEvent requires a real DingTalk internal userId resolved by searchUser first. "
                        f"Unresolved identifiers: {', '.join(unresolved_identifiers)}"
                    ),
                }

        logger.info(
            "MCP tools/call -> server=%s tool=%s arguments=%s",
            self.server.server_key,
            tool_name,
            json.dumps(normalized_arguments, ensure_ascii=False),
        )
        try:
            response = self._call_tool_rpc(tool_name, normalized_arguments)
        except urllib.error.HTTPError as exc:
            if not self._should_retry_dingtalk_http_error(tool_name, exc):
                raise
            logger.warning(
                "MCP tools/call transient HTTP error -> server=%s tool=%s status=%s; refreshing session and retrying once",
                self.server.server_key,
                tool_name,
                exc.code,
            )
            self._refresh_session_if_possible()
            response = self._call_tool_rpc(tool_name, normalized_arguments)
        logger.info(
            "MCP tools/call <- server=%s tool=%s response=%s",
            self.server.server_key,
            tool_name,
            json.dumps(response, ensure_ascii=False),
        )

        if (
            self._is_dingtalk_server
            and tool_name == "searchUser"
            and normalized_arguments.get("queryWord")
            and int(normalized_arguments.get("fullMatchField") or 0) == 1
            and (
                _extract_search_user_total_count(response) == 0
                or _has_invalid_full_match_error(response)
            )
        ):
            fallback_arguments = dict(normalized_arguments)
            fallback_arguments["size"] = max(int(fallback_arguments.get("size") or 1), 10)
            fallback_arguments.pop("fullMatchField", None)
            logger.info(
                "MCP tools/call retry -> server=%s tool=%s arguments=%s",
                self.server.server_key,
                tool_name,
                json.dumps(fallback_arguments, ensure_ascii=False),
            )
            response = self._call_tool_rpc(tool_name, fallback_arguments)
            logger.info(
                "MCP tools/call retry <- server=%s tool=%s response=%s",
                self.server.server_key,
                tool_name,
                json.dumps(response, ensure_ascii=False),
            )

        if self._is_dingtalk_server and tool_name == "searchUser":
            self._cache_dingtalk_identifiers(*_extract_search_user_identifiers(response))

        if "error" in response:
            return {"ok": False, "error": response.get("error")}
        return {"ok": True, "result": response.get("result")}


