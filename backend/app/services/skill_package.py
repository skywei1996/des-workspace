import json
import mimetypes
import tempfile
import zipfile
from pathlib import Path
from typing import Any, Optional

import frontmatter

from app.services.skill_storage import build_file_entry, stage_package_tree


SUPPORTED_TEXT_EXTENSIONS = {".md", ".markdown", ".txt"}
CONFIG_FILE_EXTENSIONS = {".json", ".yaml", ".yml", ".toml", ".ini", ".env", ".ts", ".js"}
PACKAGE_METADATA_FILES = {"package.json", "package-lock.json", "tsconfig.json", "_meta.json"}


def _find_skill_file(search_root: Path) -> Optional[Path]:
    preferred = []
    fallback = []

    for file_path in search_root.rglob("*"):
        if not file_path.is_file():
            continue
        if file_path.suffix.lower() not in SUPPORTED_TEXT_EXTENSIONS:
            continue
        if file_path.name.lower() == "skill.md":
            preferred.append(file_path)
        else:
            fallback.append(file_path)

    if preferred:
        return sorted(preferred, key=lambda path: (len(path.relative_to(search_root).parts), path.relative_to(search_root).as_posix().lower()))[0]
    if fallback:
        return sorted(fallback, key=lambda path: (len(path.relative_to(search_root).parts), path.relative_to(search_root).as_posix().lower()))[0]
    return None


def _read_frontmatter_file(file_path: Path) -> tuple[dict[str, Any], str]:
    with file_path.open("r", encoding="utf-8") as file_handle:
        post = frontmatter.load(file_handle)
    return dict(post.metadata or {}), post.content or ""


def _load_config_json(skill_root: Path, package_root: Optional[Path] = None) -> Any:
    effective_package_root = package_root or skill_root
    config_candidates = [
        skill_root / "config.json",
        effective_package_root / "config.json",
        skill_root.parent / "config.json",
    ]

    parsed_config: Any = {}
    for config_path in config_candidates:
        if not config_path.exists() or not config_path.is_file():
            continue
        with config_path.open("r", encoding="utf-8") as file_handle:
            parsed_config = json.load(file_handle)
        break

    config_dir = effective_package_root / "config"
    if not config_dir.exists() or not config_dir.is_dir():
        return parsed_config if parsed_config is not None else {}

    config_files = []
    for file_path in sorted(path for path in config_dir.rglob("*") if path.is_file()):
        if file_path.suffix.lower() not in CONFIG_FILE_EXTENSIONS:
            continue
        config_files.append(build_file_entry(file_path, effective_package_root))

    if not config_files:
        return parsed_config if parsed_config is not None else {}

    if isinstance(parsed_config, dict):
        return {
            **parsed_config,
            "package_config_files": config_files,
        }

    return {
        "config_value": parsed_config,
        "package_config_files": config_files,
    }


def _is_asset_candidate(file_path: Path, package_root: Path) -> bool:
    relative_path = file_path.relative_to(package_root).as_posix()
    relative_parts = Path(relative_path).parts

    if file_path.name.lower() == "skill.md":
        return False
    if relative_parts and relative_parts[0].lower() == "config":
        return False
    if len(relative_parts) == 1 and file_path.name.lower() in PACKAGE_METADATA_FILES:
        return False
    return True


def _build_assets_manifest(skill_root: Path, package_root: Optional[Path] = None) -> list[dict[str, Any]]:
    effective_package_root = package_root or skill_root
    assets_root = skill_root / "assets"

    if assets_root.exists() and assets_root.is_dir():
        manifest = []
        for asset_path in sorted(path for path in assets_root.rglob("*") if path.is_file()):
            manifest.append(build_file_entry(asset_path, skill_root))
        return manifest

    manifest = []
    for asset_path in sorted(path for path in effective_package_root.rglob("*") if path.is_file()):
        if not _is_asset_candidate(asset_path, effective_package_root):
            continue
        manifest.append(build_file_entry(asset_path, effective_package_root))

    return manifest


def _build_package_file_list(package_root: Path) -> list[dict[str, Any]]:
    if not package_root.exists() or not package_root.is_dir():
        return []

    package_files = []
    for file_path in sorted(path for path in package_root.rglob("*") if path.is_file()):
        package_files.append(build_file_entry(file_path, package_root))

    return package_files


def parse_skill_directory(skill_root: Path, skill_file: Optional[Path] = None, package_root: Optional[Path] = None) -> dict[str, Any]:
    resolved_skill_file = skill_file or _find_skill_file(skill_root)
    if resolved_skill_file is None or not resolved_skill_file.exists():
        raise ValueError("No SKILL.md file was found in the uploaded package")

    metadata, content = _read_frontmatter_file(resolved_skill_file)

    skill_name = metadata.get("name") or resolved_skill_file.parent.name or "Imported Skill"
    skill_key = metadata.get("skill_key") or metadata.get("id") or metadata.get("key") or ""
    description = metadata.get("description") or ""
    skill_type = str(metadata.get("skill_type") or "prompt").strip().lower() or "prompt"
    workflow_steps = metadata.get("workflow_steps") or []

    return {
        "skill_key": str(skill_key or "").strip(),
        "name": skill_name,
        "description": description,
        "skill_type": skill_type,
        "instructions": content,
        "imported_from_package": True,
        "config_json": _load_config_json(skill_root, package_root=package_root or skill_root),
        "assets_manifest": _build_assets_manifest(skill_root, package_root=package_root or skill_root),
        "package_files": _build_package_file_list(package_root or skill_root),
        "workflow_steps": workflow_steps if isinstance(workflow_steps, list) else [],
    }


def parse_uploaded_skill_package(uploaded_bytes: bytes, original_filename: str) -> dict[str, Any]:
    suffix = Path(original_filename or "").suffix.lower()

    with tempfile.TemporaryDirectory(prefix="skill_pkg_") as temp_dir:
        temp_root = Path(temp_dir)

        if suffix == ".zip":
            archive_path = temp_root / "package.zip"
            archive_path.write_bytes(uploaded_bytes)
            with zipfile.ZipFile(archive_path, "r") as archive:
                archive.extractall(temp_root / "package")
            extract_root = temp_root / "package"
            skill_file = _find_skill_file(extract_root)
            if skill_file is None:
                raise ValueError("The uploaded zip package does not contain a SKILL.md file")
            parsed = parse_skill_directory(skill_file.parent, skill_file=skill_file, package_root=extract_root)
            parsed["package_session_id"] = stage_package_tree(extract_root)
            return parsed

        if suffix not in SUPPORTED_TEXT_EXTENSIONS:
            raise ValueError("Unsupported package format. Upload SKILL.md, .txt, or .zip")

        skill_file = temp_root / (Path(original_filename or "SKILL.md").name or "SKILL.md")
        skill_file.write_bytes(uploaded_bytes)
        parsed = parse_skill_directory(temp_root, skill_file=skill_file, package_root=temp_root)
        parsed["package_session_id"] = stage_package_tree(temp_root)
        return parsed