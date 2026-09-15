from __future__ import annotations

import hashlib
import json
import mimetypes
import re
from pathlib import Path
from typing import Any
from uuid import uuid4

from ..services.artifact_service import PROJECT_ROOT, WORKSPACE_ROOT, resolve_workspace_file_path


ALLOWED_EXTENSIONS = {
    ".doc", ".docx", ".html", ".jpeg", ".jpg", ".pdf", ".png",
    ".ppt", ".pptx", ".txt", ".xls", ".xlsx",
}
MAX_UPLOAD_BYTES = 50 * 1024 * 1024


def _storage_root() -> Path:
    return WORKSPACE_ROOT / "uploads"


def _safe_filename(filename: str) -> str:
    cleaned = re.sub(r"[^\w.\-()\u4e00-\u9fff ]+", "_", Path(filename or "upload").name).strip()
    return cleaned[:180] or "upload"


def store_chat_upload(chat_id: int, filename: str, content: bytes, content_type: str | None = None) -> dict[str, Any]:
    safe_name = _safe_filename(filename)
    extension = Path(safe_name).suffix.lower()
    if extension not in ALLOWED_EXTENSIONS:
        raise ValueError(f"Unsupported chat upload type: {extension or 'unknown'}")
    if not content:
        raise ValueError("Uploaded file is empty")
    if len(content) > MAX_UPLOAD_BYTES:
        raise ValueError("Uploaded file exceeds the 50 MB limit")

    upload_id = f"upload_{uuid4().hex}"
    directory = _storage_root() / f"chat_{chat_id}" / upload_id
    directory.mkdir(parents=True, exist_ok=False)
    file_path = directory / safe_name
    file_path.write_bytes(content)
    metadata = {
        "upload_id": upload_id,
        "chat_id": chat_id,
        "name": safe_name,
        "format": extension.lstrip(".").lower(),
        "mime_type": content_type or mimetypes.guess_type(safe_name)[0] or "application/octet-stream",
        "size_bytes": len(content),
        "sha256": hashlib.sha256(content).hexdigest(),
        "path": file_path.relative_to(PROJECT_ROOT).as_posix(),
        "status": "stored",
    }
    (directory / "metadata.json").write_text(json.dumps(metadata, ensure_ascii=False, indent=2), encoding="utf-8")
    return metadata


def resolve_chat_uploads(chat_id: int, upload_ids: list[str]) -> list[dict[str, Any]]:
    resolved: list[dict[str, Any]] = []
    root = _storage_root() / f"chat_{chat_id}"
    for upload_id in dict.fromkeys(upload_ids):
        if not re.fullmatch(r"upload_[0-9a-f]{32}", str(upload_id)):
            raise ValueError("Invalid upload id")
        metadata_path = root / upload_id / "metadata.json"
        if not metadata_path.is_file():
            raise ValueError(f"Uploaded file was not found: {upload_id}")
        metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
        file_path = resolve_workspace_file_path(str(metadata.get("path") or ""))
        if not file_path.is_file() or root not in file_path.parents:
            raise ValueError(f"Uploaded file is unavailable: {metadata.get('name', upload_id)}")
        resolved.append({**metadata, "path": file_path.relative_to(PROJECT_ROOT).as_posix()})
    return resolved