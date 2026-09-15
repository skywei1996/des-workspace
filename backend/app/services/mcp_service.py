import os
import re
import shutil
import subprocess
import urllib.error
import urllib.request
from pathlib import Path
from typing import Dict

import frontmatter
from sqlalchemy import inspect, text
from sqlalchemy.orm import Session

from app import models, schemas
from app.services.mcp_client import MCPHTTPClient


MCP_SERVER_COLUMN_MIGRATIONS = {
    "version": "ALTER TABLE mcp_servers ADD COLUMN version VARCHAR DEFAULT '1.0.0' NOT NULL",
    "source_type": "ALTER TABLE mcp_servers ADD COLUMN source_type VARCHAR DEFAULT 'mcp' NOT NULL",
    "domain": "ALTER TABLE mcp_servers ADD COLUMN domain VARCHAR DEFAULT 'search' NOT NULL",
    "core_toolset": "ALTER TABLE mcp_servers ADD COLUMN core_toolset INTEGER DEFAULT 0 NOT NULL",
    "icon_url": "ALTER TABLE mcp_servers ADD COLUMN icon_url VARCHAR",
    "config_json": "ALTER TABLE mcp_servers ADD COLUMN config_json JSON",
}

BASE_DIR = Path(__file__).resolve().parents[2]
TAVILY_MCP_SERVER_KEY = "tavily_mcp"
TAVILY_MCP_SKILL_KEY = "tavily_search"


def ensure_mcp_server_schema(engine) -> None:
    inspector = inspect(engine)
    if "mcp_servers" not in inspector.get_table_names():
        return

    existing_columns = {column["name"] for column in inspector.get_columns("mcp_servers")}
    with engine.begin() as connection:
        for column_name, ddl in MCP_SERVER_COLUMN_MIGRATIONS.items():
            if column_name not in existing_columns:
                connection.execute(text(ddl))

        connection.execute(text("UPDATE mcp_servers SET version = COALESCE(version, '1.0.0')"))
        connection.execute(text("UPDATE mcp_servers SET source_type = COALESCE(source_type, 'mcp')"))
        connection.execute(text("UPDATE mcp_servers SET domain = COALESCE(domain, 'search')"))
        connection.execute(text("UPDATE mcp_servers SET core_toolset = COALESCE(core_toolset, 0)"))


def _load_builtin_skill_seed(skill_key: str) -> dict | None:
    skill_file = BASE_DIR / "skills" / skill_key / "SKILL.md"
    if not skill_file.exists():
        return None

    with skill_file.open("r", encoding="utf-8") as handle:
        post = frontmatter.load(handle)

    return {
        "name": post.metadata.get("name") or skill_key,
        "description": post.metadata.get("description") or "",
        "icon": post.metadata.get("icon") or "tool",
        "instructions": post.content.strip(),
        "config_json": {},
        "assets_manifest": [],
        "capabilities": post.metadata.get("capabilities") or [
            {
                "id": skill_key,
                "name": "Core Instructions",
                "description": "Includes the core instructions for this skill in the system prompt.",
            }
        ],
    }


def ensure_builtin_tavily_setup(db: Session) -> None:
    tavily_api_key = os.getenv("TAVILY_API_KEY", "").strip()
    existing_server = (
        db.query(models.MCPServer)
        .filter(models.MCPServer.server_key == TAVILY_MCP_SERVER_KEY)
        .first()
    )

    server_payload = {
        "server_key": TAVILY_MCP_SERVER_KEY,
        "name": "Tavily MCP",
        "version": "0.2.18",
        "description": "Built-in Tavily remote MCP toolset for web search, extraction, mapping, and crawling.",
        "source_type": "builtin",
        "transport": "streamable-http",
        "domain": "search",
        "core_toolset": True,
        "icon_url": None,
        "config_json": {
            "url": "https://mcp.tavily.com/mcp",
            "headers": {"Authorization": f"Bearer {tavily_api_key}"} if tavily_api_key else {},
            "timeout_seconds": 60,
        },
        "url": "https://mcp.tavily.com/mcp",
        "headers": {"Authorization": f"Bearer {tavily_api_key}"} if tavily_api_key else {},
        "timeout_seconds": 60,
        "enabled": bool(tavily_api_key),
        "source": "builtin",
    }

    if existing_server is None:
        existing_server = models.MCPServer(**_normalize_mcp_payload(server_payload, db))
        db.add(existing_server)
        db.commit()
        db.refresh(existing_server)
    elif existing_server.source == "builtin" or existing_server.source_type == "builtin":
        normalized_server_payload = _normalize_mcp_payload(server_payload, db, current=existing_server)
        for key, value in normalized_server_payload.items():
            setattr(existing_server, key, value)
        db.commit()
        db.refresh(existing_server)

    skill_seed = _load_builtin_skill_seed(TAVILY_MCP_SKILL_KEY)
    if not skill_seed:
        return

    existing_skill = (
        db.query(models.SkillRegistryEntry)
        .filter(models.SkillRegistryEntry.skill_key == TAVILY_MCP_SKILL_KEY)
        .first()
    )

    skill_payload = {
        "name": skill_seed["name"],
        "description": skill_seed["description"],
        "icon": skill_seed["icon"],
        "source": "builtin",
        "skill_type": "mcp",
        "instructions": skill_seed["instructions"],
        "imported_from_package": 0,
        "config_json": skill_seed["config_json"],
        "assets_manifest": skill_seed["assets_manifest"],
        "capabilities": skill_seed["capabilities"],
        "workflow_steps": [],
        "mcp_server_id": existing_server.id,
        "mcp_server_ids": [existing_server.id],
        "enabled": 1 if tavily_api_key else 0,
    }

    if existing_skill is None:
        db.add(models.SkillRegistryEntry(skill_key=TAVILY_MCP_SKILL_KEY, **skill_payload))
        db.commit()
        return

    if existing_skill.source == "builtin":
        for key, value in skill_payload.items():
            setattr(existing_skill, key, value)
        db.commit()


def _slugify_server_key(value: str) -> str:
    normalized = re.sub(r"[^a-z0-9]+", "_", (value or "").strip().lower()).strip("_")
    return normalized or "toolset"


def _ensure_unique_server_key(db: Session, candidate: str, ignore_id: int | None = None) -> str:
    server_key = candidate
    suffix = 2
    while True:
        query = db.query(models.MCPServer).filter(models.MCPServer.server_key == server_key)
        if ignore_id is not None:
            query = query.filter(models.MCPServer.id != ignore_id)
        if query.first() is None:
            return server_key
        server_key = f"{candidate}_{suffix}"
        suffix += 1


def _normalize_source_type(value: str | None) -> str:
    return "builtin" if str(value or "mcp").strip().lower() == "builtin" else "mcp"


def _normalize_transport(value: str | None) -> str:
    normalized = str(value or "stdio").strip().lower().replace("_", "-")
    if normalized in {"streamable-http", "streamablehttp"}:
        return "streamable-http"
    if normalized == "http":
        return "http"
    return "stdio"


def _normalize_domain(value: str | None) -> str:
    normalized = re.sub(r"[^a-z0-9]+", "_", str(value or "search").strip().lower()).strip("_")
    return normalized or "search"


def _build_config_json(data: dict, transport: str) -> dict:
    base = data.get("config_json") if isinstance(data.get("config_json"), dict) else {}
    config = dict(base)
    if transport == "stdio":
        if data.get("command"):
            config["command"] = data["command"]
        if data.get("args") is not None:
            config["args"] = data.get("args") or []
        if data.get("env") is not None:
            config["env"] = data.get("env") or {}
    else:
        if data.get("url"):
            config["url"] = data["url"]
        if data.get("headers") is not None:
            config["headers"] = data.get("headers") or {}

    if data.get("timeout_seconds") is not None:
        config["timeout_seconds"] = int(data.get("timeout_seconds") or 30)
    return config


def _normalize_stdio_command(config: dict, current: models.MCPServer | None = None) -> tuple[str | None, list[str]]:
    command_value = config.get("command")
    args_value = config.get("args")

    if isinstance(command_value, list):
        flattened = [str(item) for item in command_value if str(item).strip()]
        if not flattened:
            return None, []
        extra_args = [str(item) for item in args_value] if isinstance(args_value, list) else []
        return flattened[0], flattened[1:] + extra_args

    normalized_command = str(command_value).strip() if command_value not in {None, ""} else None
    normalized_args = [str(item) for item in args_value] if isinstance(args_value, list) else []

    if normalized_command is None and current is not None:
        current_command = getattr(current, "command", None)
        normalized_command = str(current_command).strip() if current_command else None

    return normalized_command, normalized_args


def _normalize_mcp_payload(data: dict, db: Session, current: models.MCPServer | None = None) -> dict:
    normalized = dict(data)
    normalized["name"] = str(normalized.get("name") or (current.name if current else "")).strip()
    normalized["version"] = str(normalized.get("version") or (current.version if current else "1.0.0") or "1.0.0").strip() or "1.0.0"
    normalized["source_type"] = _normalize_source_type(normalized.get("source_type") or (current.source_type if current else None))
    normalized["transport"] = _normalize_transport(normalized.get("transport") or (current.transport if current else None))
    normalized["domain"] = _normalize_domain(normalized.get("domain") or (current.domain if current else None))

    base_key = normalized.get("server_key") or (current.server_key if current else None) or _slugify_server_key(normalized.get("name") or "toolset")
    normalized["server_key"] = _ensure_unique_server_key(db, _slugify_server_key(base_key), current.id if current else None)

    normalized["source"] = normalized.get("source") or ("builtin" if normalized["source_type"] == "builtin" else "custom")
    normalized["core_toolset"] = 1 if bool(normalized.get("core_toolset", current.core_toolset if current else False)) else 0
    normalized["enabled"] = 1 if bool(normalized.get("enabled", current.enabled if current else True)) else 0

    config = _build_config_json(normalized, normalized["transport"])
    normalized["config_json"] = config or None
    normalized["timeout_seconds"] = int(normalized.get("timeout_seconds") or config.get("timeout_seconds") or (current.timeout_seconds if current else 30) or 30)

    if normalized["transport"] == "stdio":
        command_value, args_value = _normalize_stdio_command(config, current=current)
        normalized["command"] = normalized.get("command") or command_value
        if isinstance(normalized.get("command"), list):
            normalized["command"], normalized["args"] = _normalize_stdio_command(
                {"command": normalized.get("command"), "args": normalized.get("args")},
                current=current,
            )
        else:
            existing_args = normalized.get("args")
            normalized["args"] = existing_args if existing_args not in (None, []) else args_value
        normalized["env"] = normalized.get("env") if normalized.get("env") is not None else config.get("env")
        normalized["url"] = None
        normalized["headers"] = {}
    else:
        normalized["url"] = normalized.get("url") or config.get("url") or (current.url if current else None)
        normalized["headers"] = normalized.get("headers") if normalized.get("headers") is not None else config.get("headers")
        normalized["command"] = None
        normalized["args"] = []
        normalized["env"] = {}

    normalized["args"] = normalized.get("args") or []
    normalized["env"] = normalized.get("env") or {}
    normalized["headers"] = normalized.get("headers") or {}
    normalized["description"] = normalized.get("description") or None
    normalized["icon_url"] = normalized.get("icon_url") or None
    return normalized


def list_mcp_servers(db: Session):
    return db.query(models.MCPServer).order_by(models.MCPServer.created_at.desc()).all()


def get_mcp_server(server_id: int, db: Session):
    return db.query(models.MCPServer).filter(models.MCPServer.id == server_id).first()


def create_mcp_server(payload: schemas.MCPServerCreate, db: Session):
    server = models.MCPServer(**_normalize_mcp_payload(payload.dict(), db))
    db.add(server)
    db.commit()
    db.refresh(server)
    return server


def update_mcp_server(server: models.MCPServer, payload: schemas.MCPServerUpdate, db: Session):
    updates = _normalize_mcp_payload(payload.dict(exclude_unset=True), db, current=server)
    for key, value in updates.items():
        setattr(server, key, value)
    db.commit()
    db.refresh(server)
    return server


def delete_mcp_server(server: models.MCPServer, db: Session):
    skills = db.query(models.SkillRegistryEntry).all()
    for skill in skills:
        changed = False
        if getattr(skill, "mcp_server_id", None) == server.id:
            skill.mcp_server_id = None
            changed = True

        server_ids = list(getattr(skill, "mcp_server_ids", None) or [])
        filtered_server_ids = [server_id for server_id in server_ids if server_id != server.id]
        if filtered_server_ids != server_ids:
            skill.mcp_server_ids = filtered_server_ids
            changed = True

        if changed:
            skill.updated_at = skill.updated_at

    db.delete(server)
    db.commit()


def test_mcp_server_connection(server: models.MCPServer) -> Dict:
    if getattr(server, "source_type", "mcp") == "builtin":
        return {
            "ok": True,
            "message": "Builtin toolset does not require MCP connectivity testing.",
            "details": {
                "source_type": "builtin",
                "server_key": server.server_key,
            },
        }

    if server.transport == "stdio":
        if not server.command:
            return {"ok": False, "message": "stdio transport requires a command.", "details": {"transport": server.transport}}

        executable = shutil.which(server.command)
        if not executable and os.path.isabs(server.command) and os.path.exists(server.command):
            executable = server.command
        if not executable and server.command.lower() in {"cmd", "powershell", "pwsh", "node", "npx"}:
            executable = server.command
        if not executable:
            return {
                "ok": False,
                "message": f"Command not found: {server.command}",
                "details": {"transport": server.transport, "command": server.command},
            }

        command = [executable or server.command] + (server.args or [])
        try:
            completed = subprocess.run(
                command,
                capture_output=True,
                text=True,
                timeout=min(max(server.timeout_seconds or 5, 1), 10),
                env={**os.environ, **(server.env or {})},
            )
            return {
                "ok": True,
                "message": "Command launched successfully.",
                "details": {
                    "transport": server.transport,
                    "command": command,
                    "returncode": completed.returncode,
                    "stdout": completed.stdout[:500],
                    "stderr": completed.stderr[:500],
                },
            }
        except subprocess.TimeoutExpired:
            return {
                "ok": True,
                "message": "Command started and is still running; treating as reachable.",
                "details": {"transport": server.transport, "command": command},
            }
        except Exception as exc:
            return {
                "ok": False,
                "message": str(exc),
                "details": {"transport": server.transport, "command": command},
            }

    if not server.url:
        return {"ok": False, "message": "HTTP transport requires a URL.", "details": {"transport": server.transport}}

    try:
        if server.transport in {"http", "streamable-http", "streamable_http"}:
            client = MCPHTTPClient(server)
            tools = client.list_tools()
            return {
                "ok": True,
                "message": f"MCP handshake succeeded. Discovered {len(tools)} tools.",
                "details": {
                    "transport": server.transport,
                    "url": server.url,
                    "tools_count": len(tools),
                    "tools": [tool.name for tool in tools[:20]],
                },
            }

        request = urllib.request.Request(server.url, headers=server.headers or {}, method="GET")
        with urllib.request.urlopen(request, timeout=server.timeout_seconds or 5) as response:
            return {
                "ok": True,
                "message": f"HTTP endpoint responded with status {response.status}.",
                "details": {"transport": server.transport, "status": response.status, "url": server.url},
            }
    except urllib.error.HTTPError as exc:
        response_body = ""
        try:
            response_body = exc.read().decode("utf-8", errors="replace")
        except Exception:
            response_body = ""
        if server.transport in {"http", "streamable-http", "streamable_http"}:
            return {
                "ok": False,
                "message": f"HTTP error {exc.code} while probing MCP endpoint.",
                "details": {
                    "transport": server.transport,
                    "status": exc.code,
                    "url": server.url,
                    "response": response_body[:1000],
                },
            }
        return {
            "ok": True,
            "message": f"HTTP endpoint responded with status {exc.code}.",
            "details": {"transport": server.transport, "status": exc.code, "url": server.url},
        }
    except Exception as exc:
        return {
            "ok": False,
            "message": str(exc),
            "details": {"transport": server.transport, "url": server.url},
        }