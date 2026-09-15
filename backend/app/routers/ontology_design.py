from datetime import datetime
from typing import Any, List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from .. import database, models


VALID_KEYS = {
    "workmate-object-types",
    "workmate-object-properties",
    "workmate-object-links",
    "workmate-ontology-rules",
}
router = APIRouter(prefix="/api/ontology-design", tags=["ontology-design"])


class OntologyDesignCollectionPayload(BaseModel):
    items: List[Any] = Field(default_factory=list)


class OntologyDesignCollectionResponse(OntologyDesignCollectionPayload):
    key: str
    updated_at: datetime


def _validate_key(key: str) -> str:
    if key not in VALID_KEYS:
        raise HTTPException(status_code=400, detail=f"Unsupported ontology design collection: {key}")
    return key


@router.get("/{key}", response_model=OntologyDesignCollectionResponse)
def get_collection(key: str, db: Session = Depends(database.get_db)):
    normalized_key = _validate_key(key)
    collection = db.query(models.OntologyDesignCollection).filter(
        models.OntologyDesignCollection.key == normalized_key
    ).first()
    if collection is None:
        raise HTTPException(status_code=404, detail="Ontology design collection not found")
    return {"key": collection.key, "items": collection.items_json, "updated_at": collection.updated_at}


@router.put("/{key}", response_model=OntologyDesignCollectionResponse)
def save_collection(
    key: str,
    payload: OntologyDesignCollectionPayload,
    db: Session = Depends(database.get_db),
):
    normalized_key = _validate_key(key)
    collection = db.query(models.OntologyDesignCollection).filter(
        models.OntologyDesignCollection.key == normalized_key
    ).first()
    if collection is None:
        collection = models.OntologyDesignCollection(key=normalized_key, items_json=payload.items)
        db.add(collection)
    else:
        collection.items_json = payload.items
        collection.updated_at = datetime.now()
    db.commit()
    db.refresh(collection)
    return {"key": collection.key, "items": collection.items_json, "updated_at": collection.updated_at}