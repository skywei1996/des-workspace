from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import ValidationError
from sqlalchemy.orm import Session

from .. import database, models, schemas


VALID_KINDS = {"event", "action", "function", "object_action"}


router = APIRouter(prefix="/ontology-definitions", tags=["ontology-definitions"])


def _validate_kind(kind: str) -> str:
    normalized = str(kind or "").strip().lower()
    if normalized not in VALID_KINDS:
        raise HTTPException(status_code=400, detail=f"Unsupported ontology definition kind: {kind}")
    return normalized


def _normalize_event_definition(definition_json: dict) -> dict:
    normalized = dict(definition_json or {})
    if "subjectObjectTypeId" not in normalized and normalized.get("objectTypeId"):
        normalized["subjectObjectTypeId"] = normalized["objectTypeId"]
    if "triggerSource" not in normalized:
        trigger_type = normalized.get("triggerType")
        normalized["triggerSource"] = "scheduled_check" if trigger_type == "schedule" else "object_change"
        if trigger_type == "created":
            normalized["triggerConfig"] = {"changeType": "created"}
        elif trigger_type == "updated":
            normalized["triggerConfig"] = {"changeType": "field_changed", "propertyId": normalized.get("propertyId", "")}
        elif trigger_type == "schedule":
            normalized["triggerConfig"] = {"intervalMinutes": int(normalized.get("scheduleInterval") or 15)}
    event_fields = {
        "subjectObjectTypeId": normalized.get("subjectObjectTypeId"),
        "triggerSource": normalized.get("triggerSource"),
        "triggerConfig": normalized.get("triggerConfig") or {},
    }
    try:
        return schemas.OntologyEventDefinitionConfig.model_validate(event_fields).model_dump()
    except (ValidationError, TypeError, ValueError) as error:
        raise HTTPException(status_code=422, detail=f"Invalid event definition: {error}") from error


def _normalize_payload(payload: dict, kind: str | None = None) -> dict:
    normalized = dict(payload)
    if "name" in normalized:
        normalized["name"] = str(normalized["name"] or "").strip()
        if not normalized["name"]:
            raise HTTPException(status_code=400, detail="Ontology definition name is required")
    if "enabled" in normalized:
        normalized["enabled"] = 1 if normalized["enabled"] else 0
    if "definition_json" in normalized:
        normalized["definition_json"] = dict(normalized["definition_json"] or {})
        if kind == "event":
            normalized["definition_json"] = _normalize_event_definition(normalized["definition_json"])
    return normalized


@router.get("/", response_model=List[schemas.OntologyDefinition])
def list_ontology_definitions(
    kind: str | None = Query(default=None),
    db: Session = Depends(database.get_db),
):
    query = db.query(models.OntologyDefinition)
    if kind is not None:
        query = query.filter(models.OntologyDefinition.kind == _validate_kind(kind))
    return query.order_by(models.OntologyDefinition.updated_at.desc()).all()


@router.post("/", response_model=schemas.OntologyDefinition)
def create_ontology_definition(
    definition: schemas.OntologyDefinitionCreate,
    db: Session = Depends(database.get_db),
):
    raw_payload = definition.model_dump()
    raw_payload["kind"] = _validate_kind(raw_payload["kind"])
    payload = _normalize_payload(raw_payload, raw_payload["kind"])
    existing = db.query(models.OntologyDefinition).filter(models.OntologyDefinition.id == definition.id).first()
    if existing:
        for key, value in payload.items():
            setattr(existing, key, value)
        db.commit()
        db.refresh(existing)
        return existing
    db_definition = models.OntologyDefinition(**payload)
    db.add(db_definition)
    db.commit()
    db.refresh(db_definition)
    return db_definition


@router.put("/{definition_id}", response_model=schemas.OntologyDefinition)
def update_ontology_definition(
    definition_id: str,
    definition: schemas.OntologyDefinitionUpdate,
    db: Session = Depends(database.get_db),
):
    db_definition = db.query(models.OntologyDefinition).filter(models.OntologyDefinition.id == definition_id).first()
    if db_definition is None:
        raise HTTPException(status_code=404, detail="Ontology definition not found")
    for key, value in _normalize_payload(definition.model_dump(exclude_unset=True), db_definition.kind).items():
        setattr(db_definition, key, value)
    db.commit()
    db.refresh(db_definition)
    return db_definition


@router.delete("/{definition_id}")
def delete_ontology_definition(definition_id: str, db: Session = Depends(database.get_db)):
    db_definition = db.query(models.OntologyDefinition).filter(models.OntologyDefinition.id == definition_id).first()
    if db_definition is None:
        raise HTTPException(status_code=404, detail="Ontology definition not found")
    db.delete(db_definition)
    db.commit()
    return {"ok": True, "definition_id": definition_id}