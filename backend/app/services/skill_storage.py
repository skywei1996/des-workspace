import mimetypes
import re
import shutil
import uuid
import zipfile
from io import BytesIO
from pathlib import Path, PurePosixPath
from typing import Any, Optional
from urllib.parse import quote


WORKSPACE_ROOT = Path(__file__).resolve().parents[3]
SKILL_STORAGE_ROOT = WORKSPACE_ROOT / "backend" / "workspace" / "skill_packages"
SKILL_STAGING_ROOT = SKILL_STORAGE_ROOT / "_staging"


def ensure_skill_storage_dirs() -> None:
    SKILL_STORAGE_ROOT.mkdir(parents=True, exist_ok=True)
    SKILL_STAGING_ROOT.mkdir(parents=True, exist_ok=True)


ensure_skill_storage_dirs()


_FILE_NAME_SANITIZE_PATTERN = re.compile(r"[^A-Za-z0-9._/-]+")
EXTRA_MIME_TYPES = {
    ".ts": "text/typescript",
    ".tsx": "text/tsx",
    ".js": "text/javascript",
    ".jsx": "text/jsx",
}


def _sanitize_relative_path(relative_path: str, fallback_name: str = "file") -> str:
    raw_value = str(relative_path or "").replace("\\", "/").strip().lstrip("/")
    path = PurePosixPath(raw_value or fallback_name)
    safe_parts = []

    for part in path.parts:
        if part in ("", ".", ".."):
            continue
        safe_part = _FILE_NAME_SANITIZE_PATTERN.sub("_", part).strip("._") or "item"
        safe_parts.append(safe_part)

    if not safe_parts:
        safe_parts = [_FILE_NAME_SANITIZE_PATTERN.sub("_", fallback_name).strip("._") or "file"]

    return PurePosixPath(*safe_parts).as_posix()


def _sanitize_skill_key(skill_key: str) -> str:
    cleaned = re.sub(r"[^a-zA-Z0-9_-]+", "_", str(skill_key or "skill")).strip("_")
    return cleaned or "skill"


def build_file_entry(file_path: Path, root_path: Path) -> dict[str, Any]:
    mime_type = EXTRA_MIME_TYPES.get(file_path.suffix.lower())
    if mime_type is None:
        mime_type, _ = mimetypes.guess_type(file_path.name)
    return {
        "file_name": file_path.name,
        "relative_path": file_path.relative_to(root_path).as_posix(),
        "media_type": mime_type or "application/octet-stream",
        "size_bytes": file_path.stat().st_size,
    }


def create_package_session() -> str:
    ensure_skill_storage_dirs()
    session_id = uuid.uuid4().hex
    (SKILL_STAGING_ROOT / session_id / "package").mkdir(parents=True, exist_ok=True)
    return session_id


def get_staging_package_dir(session_id: str) -> Path:
    safe_session_id = re.sub(r"[^a-zA-Z0-9]+", "", str(session_id or "")).strip()
    if not safe_session_id:
        raise ValueError("Invalid package session id")
    return SKILL_STAGING_ROOT / safe_session_id / "package"


def stage_package_tree(package_root: Path, session_id: Optional[str] = None) -> str:
    ensure_skill_storage_dirs()
    active_session_id = session_id or create_package_session()
    destination = get_staging_package_dir(active_session_id)

    if destination.exists():
        shutil.rmtree(destination)
    destination.mkdir(parents=True, exist_ok=True)

    for source_path in package_root.rglob("*"):
        destination_path = destination / source_path.relative_to(package_root)
        if source_path.is_dir():
            destination_path.mkdir(parents=True, exist_ok=True)
        else:
            destination_path.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source_path, destination_path)

    return active_session_id


def stage_asset_upload(file_bytes: bytes, filename: str, session_id: Optional[str] = None) -> tuple[str, dict[str, Any]]:
    active_session_id = session_id or create_package_session()
    package_root = get_staging_package_dir(active_session_id)
    safe_name = Path(filename or "asset.bin").name or "asset.bin"
    relative_path = _sanitize_relative_path(f"assets/{safe_name}", fallback_name=safe_name)
    destination = package_root / relative_path
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_bytes(file_bytes)
    return active_session_id, build_file_entry(destination, package_root)


def build_download_url(skill_key: str, relative_path: str) -> str:
    safe_skill_key = _sanitize_skill_key(skill_key)
    safe_relative_path = _sanitize_relative_path(relative_path)
    return f"/skills/{safe_skill_key}/assets/{quote(safe_relative_path, safe='/')}"


def _apply_storage_metadata(skill_key: str, entry: dict[str, Any], file_path: Path, storage_root: Path) -> dict[str, Any]:
    enriched = dict(entry)
    enriched["file_name"] = file_path.name
    enriched["relative_path"] = file_path.relative_to(storage_root).as_posix()
    mime_type = EXTRA_MIME_TYPES.get(file_path.suffix.lower())
    if mime_type is None:
        mime_type, _ = mimetypes.guess_type(file_path.name)
    enriched["media_type"] = enriched.get("media_type") or mime_type or "application/octet-stream"
    enriched["size_bytes"] = file_path.stat().st_size
    enriched["stored"] = True
    enriched["storage_path"] = enriched["relative_path"]
    enriched["download_url"] = build_download_url(skill_key, enriched["relative_path"])
    return enriched


def _update_config_storage_metadata(skill_key: str, config_json: Any, storage_root: Path) -> Any:
    if not isinstance(config_json, dict):
        return config_json

    next_config = dict(config_json)
    config_files = next_config.get("package_config_files")
    if not isinstance(config_files, list):
        return next_config

    updated_files = []
    for file_entry in config_files:
        if not isinstance(file_entry, dict):
            continue
        relative_path = _sanitize_relative_path(file_entry.get("relative_path") or file_entry.get("file_name") or "config/item")
        file_path = storage_root / relative_path
        if file_path.exists() and file_path.is_file():
            updated_files.append(_apply_storage_metadata(skill_key, file_entry, file_path, storage_root))
        else:
            updated_files.append(file_entry)

    next_config["package_config_files"] = updated_files
    return next_config


def finalize_package_session(skill_key: str, package_session_id: Optional[str], assets_manifest: list[dict[str, Any]], config_json: Any) -> tuple[list[dict[str, Any]], Any]:
    ensure_skill_storage_dirs()
    safe_skill_key = _sanitize_skill_key(skill_key)
    storage_root = SKILL_STORAGE_ROOT / safe_skill_key
    storage_root.mkdir(parents=True, exist_ok=True)

    if package_session_id:
        staged_root = get_staging_package_dir(package_session_id)
        if staged_root.exists() and staged_root.is_dir():
            for source_path in staged_root.rglob("*"):
                destination_path = storage_root / source_path.relative_to(staged_root)
                if source_path.is_dir():
                    destination_path.mkdir(parents=True, exist_ok=True)
                else:
                    destination_path.parent.mkdir(parents=True, exist_ok=True)
                    shutil.copy2(source_path, destination_path)

    finalized_assets = []
    for asset_entry in assets_manifest or []:
        if not isinstance(asset_entry, dict):
            continue
        relative_path = _sanitize_relative_path(asset_entry.get("relative_path") or asset_entry.get("file_name") or "assets/item")
        file_path = storage_root / relative_path
        if file_path.exists() and file_path.is_file():
            finalized_assets.append(_apply_storage_metadata(safe_skill_key, asset_entry, file_path, storage_root))
        else:
            finalized_assets.append(dict(asset_entry))

    finalized_config = _update_config_storage_metadata(safe_skill_key, config_json, storage_root)
    return finalized_assets, finalized_config


def resolve_skill_asset_file(skill_key: str, asset_path: str) -> Path:
    safe_skill_key = _sanitize_skill_key(skill_key)
    safe_relative_path = _sanitize_relative_path(asset_path)
    resolved_path = SKILL_STORAGE_ROOT / safe_skill_key / safe_relative_path
    if not resolved_path.exists() or not resolved_path.is_file():
        raise FileNotFoundError(safe_relative_path)
    return resolved_path


def build_skill_package_zip(skill_key: str) -> bytes:
    safe_skill_key = _sanitize_skill_key(skill_key)
    storage_root = SKILL_STORAGE_ROOT / safe_skill_key
    if not storage_root.exists() or not storage_root.is_dir():
        raise FileNotFoundError(safe_skill_key)

    buffer = BytesIO()
    with zipfile.ZipFile(buffer, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for file_path in sorted(path for path in storage_root.rglob("*") if path.is_file()):
            archive.write(file_path, file_path.relative_to(storage_root).as_posix())
    buffer.seek(0)
    return buffer.getvalue()
