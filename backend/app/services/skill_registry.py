import os
import re
from typing import Dict, List, Optional
from pathlib import Path

from sqlalchemy import inspect, text
from sqlalchemy.orm import Session

from app import models
from app.services.skill_loader import load_skills


WORKSPACE_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
BUILTIN_SKILL_DIRS = [
    os.path.join(WORKSPACE_ROOT, "skills"),
    os.path.join(WORKSPACE_ROOT, "backend", "skills"),
]

SKILL_REGISTRY_COLUMN_MIGRATIONS = {
    "workflow_steps": "ALTER TABLE skill_registry_entries ADD COLUMN workflow_steps JSON",
    "mcp_server_ids": "ALTER TABLE skill_registry_entries ADD COLUMN mcp_server_ids JSON",
    "imported_from_package": "ALTER TABLE skill_registry_entries ADD COLUMN imported_from_package INTEGER DEFAULT 0",
    "config_json": "ALTER TABLE skill_registry_entries ADD COLUMN config_json JSON",
    "assets_manifest": "ALTER TABLE skill_registry_entries ADD COLUMN assets_manifest JSON",
}

SUPPORTED_SKILL_TYPES = {"prompt", "mcp", "workflow"}
SUPPORTED_WORKFLOW_STEP_TYPES = {"auto_step", "feedback_step"}

LEGACY_WORKFLOW_STEP_TYPE_MAP = {
    "input_step": "feedback_step",
    "approval_step": "feedback_step",
    "revision_step": "feedback_step",
}


def ensure_skill_registry_schema(engine) -> None:
    inspector = inspect(engine)
    if "skill_registry_entries" not in inspector.get_table_names():
        return

    existing_columns = {column["name"] for column in inspector.get_columns("skill_registry_entries")}
    with engine.begin() as connection:
        for column_name, ddl in SKILL_REGISTRY_COLUMN_MIGRATIONS.items():
            if column_name not in existing_columns:
                connection.execute(text(ddl))

        connection.execute(text("UPDATE skill_registry_entries SET workflow_steps = '[]' WHERE workflow_steps IS NULL"))
        connection.execute(text("UPDATE skill_registry_entries SET mcp_server_ids = '[]' WHERE mcp_server_ids IS NULL"))
        connection.execute(text("UPDATE skill_registry_entries SET imported_from_package = 0 WHERE imported_from_package IS NULL"))
        connection.execute(text("UPDATE skill_registry_entries SET config_json = '{}' WHERE config_json IS NULL"))
        connection.execute(text("UPDATE skill_registry_entries SET assets_manifest = '[]' WHERE assets_manifest IS NULL"))
        connection.execute(text("UPDATE skill_registry_entries SET mcp_server_ids = '[' || mcp_server_id || ']' WHERE mcp_server_id IS NOT NULL AND (mcp_server_ids IS NULL OR mcp_server_ids = '[]' OR mcp_server_ids = '')"))


def _normalize_mcp_server_ids(raw_ids: Optional[List[int]], legacy_id: Optional[int] = None) -> List[int]:
    values = raw_ids if raw_ids is not None else ([legacy_id] if legacy_id else [])
    normalized_ids: List[int] = []
    for value in values:
        if value in (None, ""):
            continue
        try:
            server_id = int(value)
        except (TypeError, ValueError):
            continue
        if server_id not in normalized_ids:
            normalized_ids.append(server_id)
    return normalized_ids


def _validate_mcp_server_ids(server_ids: List[int], db: Session) -> List[int]:
    if not server_ids:
        return []

    found_ids = {
        server.id
        for server in db.query(models.MCPServer.id).filter(models.MCPServer.id.in_(server_ids)).all()
    }
    missing_ids = [str(server_id) for server_id in server_ids if server_id not in found_ids]
    if missing_ids:
        raise ValueError(f"Unknown MCP toolset ids: {', '.join(missing_ids)}")
    return server_ids


def _slugify_step_id(value: str) -> str:
    normalized = re.sub(r"[^a-z0-9]+", "_", (value or "").strip().lower()).strip("_")
    return normalized or "step"


def _normalize_capabilities(skill_key: str, capabilities: Optional[List[dict]]) -> List[dict]:
    if capabilities:
        return capabilities
    return [
        {
            "id": skill_key,
            "name": "Core Instructions",
            "description": "Includes the core instructions for this skill in the system prompt.",
        }
    ]


def _normalize_assets_manifest(assets_manifest: Optional[List[dict]]) -> List[dict]:
    normalized_assets = []
    for index, asset in enumerate(assets_manifest or [], start=1):
        if not isinstance(asset, dict):
            continue

        relative_path = str(asset.get("relative_path") or asset.get("path") or "").strip()
        file_name = str(asset.get("file_name") or asset.get("name") or Path(relative_path).name or f"asset_{index}").strip()
        media_type = str(asset.get("media_type") or asset.get("type") or "application/octet-stream").strip()
        size_bytes = asset.get("size_bytes")

        try:
            normalized_size = int(size_bytes) if size_bytes not in (None, "") else 0
        except (TypeError, ValueError):
            normalized_size = 0

        extra_fields = {
            key: value
            for key, value in asset.items()
            if key not in {"file_name", "name", "relative_path", "path", "media_type", "type", "size_bytes"}
        }

        normalized_assets.append({
            "file_name": file_name,
            "relative_path": relative_path or file_name,
            "media_type": media_type or "application/octet-stream",
            "size_bytes": normalized_size,
            **extra_fields,
        })

    return normalized_assets


def _normalize_workflow_step_type(step_type: Optional[str]) -> str:
    normalized_type = str(step_type or "auto_step").strip().lower()
    normalized_type = LEGACY_WORKFLOW_STEP_TYPE_MAP.get(normalized_type, normalized_type)
    if normalized_type not in SUPPORTED_WORKFLOW_STEP_TYPES:
        return "auto_step"
    return normalized_type


def _normalize_workflow_steps(workflow_steps: Optional[List[dict]]) -> List[dict]:
    normalized_steps = []
    seen_ids = set()

    for index, raw_step in enumerate(workflow_steps or [], start=1):
        if not isinstance(raw_step, dict):
            continue

        step_name = str(raw_step.get("name") or f"Step {index}").strip()
        step_id = _slugify_step_id(raw_step.get("id") or step_name or f"step_{index}")
        suffix = 2
        base_id = step_id
        while step_id in seen_ids:
            step_id = f"{base_id}_{suffix}"
            suffix += 1
        seen_ids.add(step_id)

        step_type = _normalize_workflow_step_type(raw_step.get("step_type"))

        normalized_steps.append({
            "id": step_id,
            "name": step_name,
            "step_type": step_type,
            "skill_key": str(raw_step.get("skill_key") or "").strip() or None,
            "instructions": str(raw_step.get("instructions") or "").strip(),
            "input_keys": [str(item).strip() for item in (raw_step.get("input_keys") or []) if str(item).strip()],
            "output_key": str(raw_step.get("output_key") or "").strip() or None,
            "enabled": bool(raw_step.get("enabled", True)),
        })

    return normalized_steps


def _count_pause_steps(workflow_steps: Optional[List[dict]]) -> int:
    return sum(1 for step in (workflow_steps or []) if step.get("step_type") == "feedback_step")


def validate_skill_payload(payload: dict, db: Session, current_skill_key: Optional[str] = None) -> dict:
    normalized = dict(payload)
    skill_type = str(normalized.get("skill_type") or "prompt").strip().lower()
    if skill_type not in SUPPORTED_SKILL_TYPES:
        raise ValueError(f"Unsupported skill_type: {skill_type}")

    normalized["skill_type"] = skill_type
    normalized["instructions"] = str(normalized.get("instructions") or "")
    normalized["imported_from_package"] = bool(normalized.get("imported_from_package", False))
    normalized["config_json"] = normalized.get("config_json") if normalized.get("config_json") is not None else {}
    normalized["assets_manifest"] = _normalize_assets_manifest(normalized.get("assets_manifest"))
    normalized["capabilities"] = normalized.get("capabilities") or []
    normalized["workflow_steps"] = _normalize_workflow_steps(normalized.get("workflow_steps"))
    normalized["mcp_server_ids"] = _validate_mcp_server_ids(
        _normalize_mcp_server_ids(normalized.get("mcp_server_ids"), normalized.get("mcp_server_id")),
        db,
    )
    normalized["mcp_server_id"] = normalized["mcp_server_ids"][0] if normalized["mcp_server_ids"] else None

    if skill_type == "workflow":
        if not normalized["workflow_steps"]:
            raise ValueError("Workflow skills must include at least one step")
        normalized["mcp_server_id"] = None
        normalized["mcp_server_ids"] = []
        _validate_workflow_steps(normalized["workflow_steps"], db, current_skill_key=current_skill_key)
    else:
        normalized["workflow_steps"] = []
        if skill_type != "mcp":
            normalized["mcp_server_id"] = None
            normalized["mcp_server_ids"] = []

    return normalized


def _validate_workflow_steps(workflow_steps: List[dict], db: Session, current_skill_key: Optional[str] = None) -> None:
    step_ids = [step["id"] for step in workflow_steps]
    existing_skill_keys = get_skill_keys(db)
    output_keys = set()

    for step in workflow_steps:
        if not step.get("enabled", True):
            continue

        if step["step_type"] == "auto_step" and not step.get("skill_key") and not step.get("instructions"):
            raise ValueError(f"Workflow step '{step['name']}' must reference a tool or include instructions")

        if step["step_type"] == "feedback_step" and not step.get("skill_key") and not step.get("instructions"):
            raise ValueError(f"Feedback step '{step['name']}' must reference a tool or include instructions")

        skill_key = step.get("skill_key")
        if skill_key:
            if skill_key == current_skill_key:
                raise ValueError(f"Workflow step '{step['name']}' cannot reference the workflow tool itself")
            if skill_key not in existing_skill_keys:
                raise ValueError(f"Workflow step '{step['name']}' references unknown tool '{skill_key}'")
            referenced_skill = get_skill(skill_key, db)
            if referenced_skill and referenced_skill.get("skill_type") == "workflow":
                raise ValueError(f"Workflow step '{step['name']}' cannot reference another workflow tool in the first version")

        output_key = step.get("output_key")
        if output_key:
            if output_key in output_keys:
                raise ValueError(f"Duplicate workflow output_key '{output_key}'")
            output_keys.add(output_key)


def _entry_to_dict(entry: models.SkillRegistryEntry, mcp_server_map: Optional[Dict[int, models.MCPServer]] = None) -> dict:
    workflow_steps = _normalize_workflow_steps(entry.workflow_steps)
    mcp_server_ids = _normalize_mcp_server_ids(entry.mcp_server_ids, entry.mcp_server_id)
    mcp_servers = [mcp_server_map[server_id] for server_id in mcp_server_ids if mcp_server_map and server_id in mcp_server_map]
    primary_server = mcp_servers[0] if mcp_servers else entry.mcp_server
    return {
        "id": entry.id,
        "skill_key": entry.skill_key,
        "name": entry.name,
        "description": entry.description or "",
        "icon": entry.icon or "tool",
        "source": entry.source or "custom",
        "skill_type": entry.skill_type or "prompt",
        "instructions": entry.instructions or "",
        "imported_from_package": bool(getattr(entry, "imported_from_package", 0)),
        "config_json": entry.config_json or {},
        "assets_manifest": _normalize_assets_manifest(entry.assets_manifest),
        "capabilities": _normalize_capabilities(entry.skill_key, entry.capabilities),
        "workflow_steps": workflow_steps,
        "pause_count": _count_pause_steps(workflow_steps),
        "mcp_server_id": entry.mcp_server_id,
        "mcp_server_ids": mcp_server_ids,
        "enabled": bool(entry.enabled),
        "readonly": (entry.source or "custom") != "custom",
        "status": "Available" if entry.enabled else "Disabled",
        "created_at": entry.created_at,
        "updated_at": entry.updated_at,
        "mcp_server": {
            "id": primary_server.id,
            "server_key": primary_server.server_key,
            "name": primary_server.name,
            "transport": primary_server.transport,
            "enabled": bool(primary_server.enabled),
            "created_at": primary_server.created_at,
            "updated_at": primary_server.updated_at,
        } if primary_server else None,
        "mcp_servers": [
            {
                "id": server.id,
                "server_key": server.server_key,
                "name": server.name,
                "transport": server.transport,
                "enabled": bool(server.enabled),
                "created_at": server.created_at,
                "updated_at": server.updated_at,
            }
            for server in mcp_servers
        ],
    }


def load_builtin_skills() -> List[dict]:
    skills = []
    for skill_dir in BUILTIN_SKILL_DIRS:
        if os.path.isdir(skill_dir):
            skills.extend(load_skills(skill_dir))
    deduped: Dict[str, dict] = {}
    for skill in skills:
        skill_key = skill.get("skill_key") or skill.get("id")
        if not skill_key:
            continue
        deduped[skill_key] = {
            **skill,
            "skill_key": skill_key,
            "id": skill_key,
            "readonly": True,
            "source": skill.get("source", "builtin"),
            "skill_type": skill.get("skill_type", "prompt"),
            "imported_from_package": bool(skill.get("imported_from_package", False)),
            "config_json": skill.get("config_json") or {},
            "assets_manifest": _normalize_assets_manifest(skill.get("assets_manifest")),
            "enabled": True,
            "status": "Available",
            "mcp_server_id": skill.get("mcp_server_id"),
            "mcp_server_ids": _normalize_mcp_server_ids(skill.get("mcp_server_ids"), skill.get("mcp_server_id")),
            "mcp_server": skill.get("mcp_server"),
            "mcp_servers": skill.get("mcp_servers") or ([skill.get("mcp_server")] if skill.get("mcp_server") else []),
            "workflow_steps": _normalize_workflow_steps(skill.get("workflow_steps")),
            "pause_count": _count_pause_steps(skill.get("workflow_steps")),
            "capabilities": _normalize_capabilities(skill_key, skill.get("capabilities")),
        }
    return list(deduped.values())


def load_db_skills(db: Session) -> List[dict]:
    entries = (
        db.query(models.SkillRegistryEntry)
        .filter(models.SkillRegistryEntry.enabled == 1)
        .order_by(models.SkillRegistryEntry.created_at.desc())
        .all()
    )
    server_ids = []
    for entry in entries:
        for server_id in _normalize_mcp_server_ids(entry.mcp_server_ids, entry.mcp_server_id):
            if server_id not in server_ids:
                server_ids.append(server_id)

    mcp_server_map = {}
    if server_ids:
        servers = db.query(models.MCPServer).filter(models.MCPServer.id.in_(server_ids)).all()
        mcp_server_map = {server.id: server for server in servers}

    return [_entry_to_dict(entry, mcp_server_map) for entry in entries]


def list_skills(db: Session) -> List[dict]:
    combined: Dict[str, dict] = {}
    for skill in load_builtin_skills():
        combined[skill["skill_key"]] = skill
    for skill in load_db_skills(db):
        combined[skill["skill_key"]] = skill
    return sorted(combined.values(), key=lambda item: (item["source"], item["name"].lower()))


def get_skill(skill_key: str, db: Session) -> Optional[dict]:
    for skill in list_skills(db):
        if skill["skill_key"] == skill_key:
            return skill
    return None


def get_skill_keys(db: Session) -> set:
    return {skill["skill_key"] for skill in list_skills(db)}


def validate_tool_ids(tool_ids: Optional[List[str]], db: Session) -> List[str]:
    normalized_ids = list(dict.fromkeys(tool_ids or []))
    available_skill_keys = get_skill_keys(db)
    invalid_ids = [skill_id for skill_id in normalized_ids if skill_id not in available_skill_keys]
    if invalid_ids:
        raise ValueError(f"Unknown skill ids: {', '.join(invalid_ids)}")
    return normalized_ids


def build_skills_prompt(skills: List[dict]) -> str:
    if not skills:
        return ""

    prompt = "\n\nYou have access to the following skills:\n"
    for skill in skills:
        prompt += f"- {skill['name']}: {skill['description']}\n"

    prompt += "\nBefore answering, check if any skill applies. If applying a skill, follow its instructions carefully:\n"

    for skill in skills:
        if skill.get("skill_type") == "workflow":
            prompt += f"\n--- Workflow Skill: {skill['name']} ---\n"
            prompt += f"适用说明：{skill.get('description', '') or '无'}\n"
            for index, step in enumerate(skill.get("workflow_steps") or [], start=1):
                pause_note = " [暂停点]" if step.get("step_type") == "feedback_step" else ""
                prompt += f"{index}. {step.get('name')} ({step.get('step_type')}){pause_note}\n"
                if step.get("instructions"):
                    prompt += f"   Step Guidance: {step['instructions']}\n"
            continue

        instructions = skill.get("instructions", "")
        if instructions:
            prompt += f"\n--- Skill: {skill['name']} ---\n{instructions}\n"

    return prompt