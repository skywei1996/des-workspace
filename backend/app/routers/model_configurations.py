from datetime import datetime
from typing import List
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import database, models, schemas
from app.services.model_connection_service import test_model_connection


router = APIRouter(prefix="/model-configurations", tags=["model-configurations"])


@router.post("/test", response_model=schemas.ModelConnectionTestResult)
def test_model_configuration(payload: schemas.ModelConnectionTestRequest):
    result = test_model_connection(
        provider_type=payload.providerType,
        model_name=payload.modelName,
        api_endpoint=payload.apiEndpoint,
        api_key=payload.apiKey,
    )
    return schemas.ModelConnectionTestResult(**result)


def _to_schema(item: models.ModelConfiguration) -> schemas.ModelConfiguration:
    return schemas.ModelConfiguration(
        id=item.id,
        modelName=item.model_name,
        providerType=item.provider_type,
        apiEndpoint=item.api_endpoint,
        apiKey="",
        isPublic=bool(item.is_public),
        createdAt=item.created_at,
        updatedAt=item.updated_at,
    )


@router.get("/", response_model=List[schemas.ModelConfiguration])
def read_model_configurations(db: Session = Depends(database.get_db)):
    return [_to_schema(item) for item in db.query(models.ModelConfiguration).order_by(models.ModelConfiguration.updated_at.desc()).all()]


@router.post("/", response_model=schemas.ModelConfiguration)
def create_model_configuration(payload: schemas.ModelConfigurationCreate, db: Session = Depends(database.get_db)):
    existing = db.query(models.ModelConfiguration).filter(models.ModelConfiguration.model_name == payload.modelName.strip()).first()
    if existing:
        raise HTTPException(status_code=409, detail="A model configuration with this model name already exists.")
    item = models.ModelConfiguration(
        id=f"model-{uuid4().hex[:10]}",
        model_name=payload.modelName.strip(),
        provider_type=payload.providerType.strip(),
        api_endpoint=payload.apiEndpoint.strip(),
        api_key=payload.apiKey.strip(),
        is_public=int(payload.isPublic),
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return _to_schema(item)


@router.put("/{configuration_id}", response_model=schemas.ModelConfiguration)
def update_model_configuration(configuration_id: str, payload: schemas.ModelConfigurationUpdate, db: Session = Depends(database.get_db)):
    item = db.query(models.ModelConfiguration).filter(models.ModelConfiguration.id == configuration_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Model configuration not found.")
    updates = payload.dict(exclude_unset=True)
    if "modelName" in updates:
        item.model_name = updates["modelName"].strip()
    if "providerType" in updates:
        item.provider_type = updates["providerType"].strip()
    if "apiEndpoint" in updates:
        item.api_endpoint = updates["apiEndpoint"].strip()
    if "apiKey" in updates and updates["apiKey"] and updates["apiKey"].strip():
        item.api_key = updates["apiKey"].strip()
    if "isPublic" in updates:
        item.is_public = int(updates["isPublic"])
    item.updated_at = datetime.now()
    db.commit()
    db.refresh(item)
    return _to_schema(item)


@router.delete("/{configuration_id}")
def delete_model_configuration(configuration_id: str, db: Session = Depends(database.get_db)):
    item = db.query(models.ModelConfiguration).filter(models.ModelConfiguration.id == configuration_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Model configuration not found.")
    db.delete(item)
    db.commit()
    return {"ok": True, "id": configuration_id}