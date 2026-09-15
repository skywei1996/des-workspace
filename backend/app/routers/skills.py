import os
import re
import unicodedata
import mimetypes

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy.orm import Session

from app import database, models, schemas
from app.services.skill_generator import generate_prompt_skill_draft, generate_skill_instructions, generate_workflow_skill_draft
from app.services.skill_package import parse_uploaded_skill_package
from app.services.skill_registry import get_skill, list_skills, validate_skill_payload
from app.services.skill_storage import build_skill_package_zip, finalize_package_session, resolve_skill_asset_file, stage_asset_upload

router = APIRouter(prefix="/skills", tags=["skills"])


def _slugify_skill_name(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value or "")
    ascii_value = normalized.encode("ascii", "ignore").decode("ascii").lower()
    slug = re.sub(r"[^a-z0-9]+", "_", ascii_value).strip("_")
    return slug


def _generate_skill_key(name: str, db: Session) -> str:
    base = _slugify_skill_name(name)
    if not base:
        base = "skill"

    candidate = base
    suffix = 2
    while db.query(models.SkillRegistryEntry).filter(models.SkillRegistryEntry.skill_key == candidate).first():
        candidate = f"{base}_{suffix}"
        suffix += 1
    return candidate


def _resolve_requested_skill_key(payload: schemas.SkillRegistryCreate, db: Session) -> str:
    requested_key = (payload.skill_key or "").strip()
    if requested_key:
        return requested_key
    if payload.overwrite_existing:
        return _slugify_skill_name(payload.name) or "skill"
    return _generate_skill_key(payload.name, db)

@router.get("/")
def get_skills(db: Session = Depends(database.get_db)):
    """
    Retrieve all available skills from both builtin skill files and database entries.
    """
    skills = list_skills(db)

    return {
        "status": "success",
        "data": {
            "skills": skills
        }
    }


@router.post("/generate-draft", response_model=schemas.SkillDraftGenerateResponse)
def generate_skill_draft(payload: schemas.SkillDraftGenerateRequest, db: Session = Depends(database.get_db)):
    skill_type = (payload.skill_type or "workflow").strip().lower()
    user_description = (payload.user_description or payload.workflow_description or "").strip()
    if len(user_description) < 10:
        raise HTTPException(status_code=400, detail="Please provide a more detailed skill description")
    if skill_type not in {"prompt", "workflow"}:
        raise HTTPException(status_code=400, detail="Only prompt and workflow draft generation are supported")

    reusable_skills = [
        skill for skill in list_skills(db)
        if skill.get("skill_type") != "workflow" and skill.get("enabled", True)
    ]

    try:
        if skill_type == "workflow":
            generated = generate_workflow_skill_draft(user_description, reusable_skills)
            normalized = validate_skill_payload({
                "name": generated.get("name") or "AI Generated Workflow",
                "description": generated.get("description") or "",
                "icon": "tool",
                "source": "custom",
                "skill_type": "workflow",
                "instructions": generated.get("instructions") or "",
                "imported_from_package": False,
                "workflow_steps": generated.get("workflow_steps") or [],
                "capabilities": [],
                "mcp_server_id": None,
                "mcp_server_ids": [],
                "enabled": True,
            }, db)
        else:
            generated = generate_prompt_skill_draft(user_description, reusable_skills)
            normalized = validate_skill_payload({
                "name": generated.get("name") or "AI Generated Skill",
                "description": generated.get("description") or "",
                "icon": "tool",
                "source": "custom",
                "skill_type": "prompt",
                "instructions": generated.get("instructions") or "",
                "imported_from_package": False,
                "workflow_steps": [],
                "capabilities": [],
                "mcp_server_id": None,
                "mcp_server_ids": [],
                "enabled": True,
            }, db)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    except Exception as error:
        raise HTTPException(status_code=500, detail=f"Failed to generate {skill_type} skill draft: {error}") from error

    return schemas.SkillDraftGenerateResponse(
        name=normalized["name"],
        description=normalized.get("description") or "",
        skill_type=skill_type,
        instructions=normalized.get("instructions") or "",
        workflow_steps=normalized.get("workflow_steps") or [],
    )


@router.post("/generate-instructions", response_model=schemas.SkillInstructionsGenerateResponse)
def generate_skill_instruction_text(payload: schemas.SkillInstructionsGenerateRequest, db: Session = Depends(database.get_db)):
    user_description = (payload.user_description or "").strip()
    if len(user_description) < 10:
        raise HTTPException(status_code=400, detail="Please provide a more detailed instruction request")

    reusable_skills = [
        skill for skill in list_skills(db)
        if skill.get("skill_type") != "workflow" and skill.get("enabled", True)
    ]

    try:
        generated = generate_skill_instructions(
            user_description=user_description,
            skill_type=(payload.skill_type or "prompt").strip().lower(),
            skill_name=(payload.skill_name or "").strip(),
            skill_description=(payload.skill_description or "").strip(),
            existing_instructions=(payload.existing_instructions or "").strip(),
            available_skills=reusable_skills,
        )
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    except Exception as error:
        raise HTTPException(status_code=500, detail=f"Failed to generate skill instructions: {error}") from error

    return schemas.SkillInstructionsGenerateResponse(
        instructions=(generated.get("instructions") or "").strip(),
    )


@router.post("/import-package", response_model=schemas.SkillPackageImportResponse)
async def import_skill_package(file: UploadFile = File(...)):
    filename = file.filename or "skill-package"

    try:
        parsed = parse_uploaded_skill_package(await file.read(), filename)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    except Exception as error:
        raise HTTPException(status_code=500, detail=f"Failed to parse skill package: {error}") from error

    return schemas.SkillPackageImportResponse(**parsed)


@router.post("/assets/upload", response_model=schemas.SkillAssetUploadResponse)
async def upload_skill_assets(
    files: list[UploadFile] = File(...),
    session_id: str | None = Form(default=None),
):
    if not files:
        raise HTTPException(status_code=400, detail="Please upload at least one asset file")

    uploaded_assets = []
    active_session_id = session_id
    try:
        for file in files:
            current_session_id, asset_entry = stage_asset_upload(await file.read(), file.filename or "asset.bin", active_session_id)
            active_session_id = current_session_id
            uploaded_assets.append(asset_entry)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    except Exception as error:
        raise HTTPException(status_code=500, detail=f"Failed to upload asset files: {error}") from error

    return schemas.SkillAssetUploadResponse(package_session_id=active_session_id, assets_manifest=uploaded_assets)


@router.get("/{skill_key}/assets/{asset_path:path}")
def read_skill_asset(skill_key: str, asset_path: str):
    try:
        file_path = resolve_skill_asset_file(skill_key, asset_path)
    except FileNotFoundError as error:
        raise HTTPException(status_code=404, detail="Asset file not found") from error
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error

    media_type, _ = mimetypes.guess_type(file_path.name)
    return FileResponse(file_path, media_type=media_type or "application/octet-stream", filename=file_path.name)


@router.get("/{skill_key}/download")
def download_skill_package(skill_key: str, db: Session = Depends(database.get_db)):
    skill = get_skill(skill_key, db)
    if skill is None:
        raise HTTPException(status_code=404, detail="Skill not found")

    try:
        package_bytes = build_skill_package_zip(skill_key)
    except FileNotFoundError as error:
        raise HTTPException(status_code=404, detail="Skill package files not found") from error

    safe_name = re.sub(r"[^A-Za-z0-9._-]+", "_", skill_key).strip("_") or "skill"
    return StreamingResponse(
        iter([package_bytes]),
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{safe_name}.zip"'},
    )


@router.get("/{skill_key}")
def read_skill(skill_key: str, db: Session = Depends(database.get_db)):
    skill = get_skill(skill_key, db)
    if skill is None:
        raise HTTPException(status_code=404, detail="Skill not found")
    return {"status": "success", "data": skill}


@router.post("/", response_model=schemas.SkillRegistry)
def create_skill(payload: schemas.SkillRegistryCreate, db: Session = Depends(database.get_db)):
    skill_key = _resolve_requested_skill_key(payload, db)
    existing = db.query(models.SkillRegistryEntry).filter(models.SkillRegistryEntry.skill_key == skill_key).first()
    if existing and not payload.overwrite_existing:
        raise HTTPException(status_code=400, detail="Skill key already exists")

    package_session_id = payload.package_session_id

    try:
        normalized_payload = validate_skill_payload(payload.dict(exclude={"skill_key", "package_session_id", "overwrite_existing"}), db, current_skill_key=skill_key)
        normalized_payload["assets_manifest"], normalized_payload["config_json"] = finalize_package_session(
            skill_key,
            package_session_id,
            normalized_payload.get("assets_manifest") or [],
            normalized_payload.get("config_json") or {},
        )
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error

    entry = existing or models.SkillRegistryEntry(skill_key=skill_key)
    for key, value in normalized_payload.items():
        setattr(entry, key, value)
    entry.enabled = 1 if payload.enabled else 0
    if existing is None:
        db.add(entry)
    db.commit()
    db.refresh(entry)
    return get_skill(skill_key, db)


@router.put("/{skill_key}", response_model=schemas.SkillRegistry)
def update_skill(skill_key: str, payload: schemas.SkillRegistryUpdate, db: Session = Depends(database.get_db)):
    entry = db.query(models.SkillRegistryEntry).filter(models.SkillRegistryEntry.skill_key == skill_key).first()
    if entry is None:
        raise HTTPException(status_code=404, detail="Only custom database skills can be updated")

    updates = payload.dict(exclude_unset=True)
    package_session_id = updates.pop("package_session_id", None)
    try:
        updates = validate_skill_payload({
            "name": entry.name,
            "description": entry.description,
            "icon": entry.icon,
            "source": entry.source,
            "skill_type": entry.skill_type,
            "instructions": entry.instructions,
            "imported_from_package": bool(getattr(entry, "imported_from_package", 0)),
            "config_json": entry.config_json,
            "assets_manifest": entry.assets_manifest,
            "capabilities": entry.capabilities,
            "workflow_steps": entry.workflow_steps,
            "mcp_server_id": entry.mcp_server_id,
            "mcp_server_ids": entry.mcp_server_ids,
            "enabled": bool(entry.enabled),
            **updates,
        }, db, current_skill_key=skill_key)
        updates["assets_manifest"], updates["config_json"] = finalize_package_session(
            skill_key,
            package_session_id,
            updates.get("assets_manifest") or [],
            updates.get("config_json") or {},
        )
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error

    if "enabled" in updates:
        updates["enabled"] = 1 if updates["enabled"] else 0
    for key, value in updates.items():
        setattr(entry, key, value)
    db.commit()
    db.refresh(entry)
    return get_skill(skill_key, db)


@router.delete("/{skill_key}")
def delete_skill(skill_key: str, db: Session = Depends(database.get_db)):
    entry = db.query(models.SkillRegistryEntry).filter(models.SkillRegistryEntry.skill_key == skill_key).first()
    if entry is None:
        raise HTTPException(status_code=404, detail="Only custom database skills can be deleted")

    employees = db.query(models.AIEmployee).all()
    for employee in employees:
        tool_ids = list(employee.tool_ids or [])
        if skill_key not in tool_ids:
            continue
        employee.tool_ids = [tool_id for tool_id in tool_ids if tool_id != skill_key]

    db.delete(entry)
    db.commit()
    return {"status": "success"}
