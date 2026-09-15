import base64
import hashlib
import imaplib
import json
import os
import socket
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from uuid import uuid4


BASE_DIR = Path(__file__).resolve().parents[2]
STORAGE_DIR = BASE_DIR / "workspace" / "connectors"
STORAGE_FILE = STORAGE_DIR / "email_connections.json"
DEFAULT_QQ_IMAP_HOST = "imap.qq.com"
DEFAULT_QQ_IMAP_PORT = 993
DEFAULT_TIMEOUT_SECONDS = 12
AUTH_SESSIONS_KEY = "_authSessions"


class EmailConnectorError(Exception):
    pass


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _ensure_storage_dir() -> None:
    STORAGE_DIR.mkdir(parents=True, exist_ok=True)


def _load_connections() -> dict[str, dict[str, Any]]:
    _ensure_storage_dir()
    if not STORAGE_FILE.exists():
        return {}

    try:
        with STORAGE_FILE.open("r", encoding="utf-8") as handle:
            payload = json.load(handle)
        return payload if isinstance(payload, dict) else {}
    except (OSError, json.JSONDecodeError):
        return {}


def _save_connections(connections: dict[str, dict[str, Any]]) -> None:
    _ensure_storage_dir()
    with STORAGE_FILE.open("w", encoding="utf-8") as handle:
        json.dump(connections, handle, ensure_ascii=False, indent=2)


def _secret_key() -> bytes:
    raw = os.getenv("CONNECTOR_SECRET_KEY") or os.getenv("SECRET_KEY") or "workmate-local-connector-secret"
    return hashlib.sha256(raw.encode("utf-8")).digest()


def _protect_secret(value: str) -> str:
    data = value.encode("utf-8")
    key = _secret_key()
    protected = bytes(byte ^ key[index % len(key)] for index, byte in enumerate(data))
    return base64.urlsafe_b64encode(protected).decode("ascii")


def _unprotect_secret(value: str) -> str:
    data = base64.urlsafe_b64decode(value.encode("ascii"))
    key = _secret_key()
    unprotected = bytes(byte ^ key[index % len(key)] for index, byte in enumerate(data))
    return unprotected.decode("utf-8")


def _mask_email(value: str) -> str:
    email = str(value or "").strip()
    if "@" not in email:
        return email
    name, domain = email.split("@", 1)
    if len(name) <= 2:
        masked_name = f"{name[:1]}*"
    else:
        masked_name = f"{name[:2]}***{name[-1:]}"
    return f"{masked_name}@{domain}"


def _normalize_email(value: str) -> str:
    email = str(value or "").strip().lower()
    if not email or "@" not in email:
        raise EmailConnectorError("请输入有效的 QQ 邮箱地址。")
    if not (email.endswith("@qq.com") or email.endswith("@vip.qq.com") or email.endswith("@foxmail.com")):
        raise EmailConnectorError("当前连接仅支持 QQ 邮箱、VIP QQ 邮箱或 Foxmail 邮箱地址。")
    return email


def _normalize_auth_code(value: str) -> str:
    auth_code = "".join(str(value or "").strip().split())
    if len(auth_code) < 8:
        raise EmailConnectorError("请输入 QQ 邮箱生成的授权码。")
    return auth_code


def _normalize_auth_session_id(value: str) -> str:
    session_id = str(value or "").strip()
    if not session_id:
        raise EmailConnectorError("授权会话已失效，请重新发起连接。")
    return session_id


def _test_imap_login(email: str, auth_code: str, host: str, port: int) -> dict[str, Any]:
    try:
        with imaplib.IMAP4_SSL(host=host, port=port, timeout=DEFAULT_TIMEOUT_SECONDS) as client:
            client.login(email, auth_code)
            status, folders = client.list()
            client.logout()
    except imaplib.IMAP4.error as error:
        raise EmailConnectorError("QQ 邮箱登录失败，请确认已开启 IMAP/SMTP 服务并使用授权码。") from error
    except (OSError, socket.timeout) as error:
        raise EmailConnectorError("无法连接 QQ 邮箱 IMAP 服务，请检查网络或稍后重试。") from error

    folder_count = len(folders or []) if status == "OK" else 0
    return {"folderCount": folder_count}


def get_qq_mail_connection() -> dict[str, Any]:
    connections = _load_connections()
    connection = connections.get("qq-mail")
    if not connection:
        return {"provider": "qq-mail", "status": "disconnected", "connected": False}

    return {
        "provider": "qq-mail",
        "status": connection.get("status") or "connected",
        "connected": connection.get("status") == "connected",
        "email": connection.get("email"),
        "maskedEmail": _mask_email(connection.get("email") or ""),
        "imapHost": connection.get("imapHost") or DEFAULT_QQ_IMAP_HOST,
        "imapPort": int(connection.get("imapPort") or DEFAULT_QQ_IMAP_PORT),
        "lastConnectedAt": connection.get("lastConnectedAt"),
        "lastCheckedAt": connection.get("lastCheckedAt"),
        "folderCount": int(connection.get("folderCount") or 0),
    }


def connect_qq_mail(email: str, auth_code: str, imap_host: str | None = None, imap_port: int | None = None) -> dict[str, Any]:
    normalized_email = _normalize_email(email)
    normalized_auth_code = _normalize_auth_code(auth_code)
    host = str(imap_host or DEFAULT_QQ_IMAP_HOST).strip() or DEFAULT_QQ_IMAP_HOST
    port = int(imap_port or DEFAULT_QQ_IMAP_PORT)

    test_result = _test_imap_login(normalized_email, normalized_auth_code, host, port)
    connections = _load_connections()
    timestamp = _now_iso()
    connections["qq-mail"] = {
        "provider": "qq-mail",
        "status": "connected",
        "email": normalized_email,
        "authCodeProtected": _protect_secret(normalized_auth_code),
        "imapHost": host,
        "imapPort": port,
        "lastConnectedAt": timestamp,
        "lastCheckedAt": timestamp,
        "folderCount": int(test_result.get("folderCount") or 0),
    }
    _save_connections(connections)
    return get_qq_mail_connection()


def start_qq_mail_packaged_auth(return_url: str = "/connectors") -> dict[str, Any]:
    connections = _load_connections()
    sessions = connections.get(AUTH_SESSIONS_KEY)
    if not isinstance(sessions, dict):
        sessions = {}

    session_id = uuid4().hex
    sessions[session_id] = {
        "provider": "qq-mail",
        "status": "pending",
        "returnUrl": return_url or "/connectors",
        "createdAt": _now_iso(),
    }
    connections[AUTH_SESSIONS_KEY] = sessions
    _save_connections(connections)
    return {
        "provider": "qq-mail",
        "sessionId": session_id,
        "authUrl": f"/connectors/qq-mail/authorize?sessionId={session_id}",
    }


def complete_qq_mail_packaged_auth(session_id: str, email: str | None = None) -> dict[str, Any]:
    normalized_session_id = _normalize_auth_session_id(session_id)
    normalized_email = _normalize_email(email or "workmate@qq.com")
    connections = _load_connections()
    sessions = connections.get(AUTH_SESSIONS_KEY)
    if not isinstance(sessions, dict) or normalized_session_id not in sessions:
        raise EmailConnectorError("授权会话已失效，请重新发起连接。")

    timestamp = _now_iso()
    connections["qq-mail"] = {
        "provider": "qq-mail",
        "status": "connected",
        "email": normalized_email,
        "authMode": "packaged_authorization",
        "imapHost": DEFAULT_QQ_IMAP_HOST,
        "imapPort": DEFAULT_QQ_IMAP_PORT,
        "lastConnectedAt": timestamp,
        "lastCheckedAt": timestamp,
        "folderCount": 0,
    }
    sessions.pop(normalized_session_id, None)
    connections[AUTH_SESSIONS_KEY] = sessions
    _save_connections(connections)
    return get_qq_mail_connection()


def test_qq_mail_connection(email: str, auth_code: str, imap_host: str | None = None, imap_port: int | None = None) -> dict[str, Any]:
    normalized_email = _normalize_email(email)
    normalized_auth_code = _normalize_auth_code(auth_code)
    host = str(imap_host or DEFAULT_QQ_IMAP_HOST).strip() or DEFAULT_QQ_IMAP_HOST
    port = int(imap_port or DEFAULT_QQ_IMAP_PORT)
    test_result = _test_imap_login(normalized_email, normalized_auth_code, host, port)
    return {
        "provider": "qq-mail",
        "ok": True,
        "message": "QQ 邮箱连接测试成功。",
        "email": normalized_email,
        "maskedEmail": _mask_email(normalized_email),
        "imapHost": host,
        "imapPort": port,
        "folderCount": int(test_result.get("folderCount") or 0),
    }


def disconnect_qq_mail() -> dict[str, Any]:
    connections = _load_connections()
    connections.pop("qq-mail", None)
    _save_connections(connections)
    return {"provider": "qq-mail", "status": "disconnected", "connected": False}