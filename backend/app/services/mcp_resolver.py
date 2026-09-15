from dataclasses import dataclass
from typing import List, Optional

from sqlalchemy.orm import Session

from app import models


@dataclass
class ResolvedMCPBinding:
    skill_key: str
    server: models.MCPServer


def resolve_mcp_bindings(tool_ids: Optional[List[str]], db: Session) -> List[ResolvedMCPBinding]:
    """Resolve employee tool_ids to enabled MCP server bindings."""
    if not tool_ids:
        return []

    entries = (
        db.query(models.SkillRegistryEntry)
        .filter(models.SkillRegistryEntry.skill_key.in_(tool_ids))
        .filter(models.SkillRegistryEntry.enabled == 1)
        .filter(models.SkillRegistryEntry.skill_type == "mcp")
        .all()
    )

    skill_to_entry = {entry.skill_key: entry for entry in entries}
    ordered_entries = [skill_to_entry[skill_key] for skill_key in tool_ids if skill_key in skill_to_entry]

    seen_server_ids = set()
    bindings: List[ResolvedMCPBinding] = []
    for entry in ordered_entries:
        server_ids = entry.mcp_server_ids or ([entry.mcp_server_id] if entry.mcp_server_id else [])
        if not server_ids:
            continue
        servers = db.query(models.MCPServer).filter(models.MCPServer.id.in_(server_ids)).all()
        server_map = {server.id: server for server in servers}
        for server_id in server_ids:
            server = server_map.get(server_id)
            if not server or not bool(server.enabled):
                continue
            if server.id in seen_server_ids:
                continue
            seen_server_ids.add(server.id)
            bindings.append(ResolvedMCPBinding(skill_key=entry.skill_key, server=server))

    return bindings
