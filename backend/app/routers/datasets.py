from datetime import datetime
from typing import List
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, Response, UploadFile
from pydantic import BaseModel
from sqlalchemy.orm import Session

from .. import database, models


router = APIRouter(prefix="/api/datasets", tags=["datasets"])


class DatasetMetadata(BaseModel):
    id: str
    name: str
    size: int
    type: str
    extension: str
    createdAt: datetime


def _metadata(dataset: models.Dataset) -> dict:
    return {
        "id": dataset.id,
        "name": dataset.name,
        "size": dataset.size,
        "type": dataset.content_type,
        "extension": dataset.extension,
        "createdAt": dataset.created_at,
    }


@router.get("/", response_model=List[DatasetMetadata])
def list_datasets(db: Session = Depends(database.get_db)):
    datasets = db.query(models.Dataset).order_by(models.Dataset.created_at.desc()).all()
    return [_metadata(dataset) for dataset in datasets]


@router.post("/", response_model=DatasetMetadata)
async def upload_dataset(file: UploadFile = File(...), db: Session = Depends(database.get_db)):
    content = await file.read()
    name = file.filename or "dataset"
    dataset = models.Dataset(
        id=str(uuid4()),
        name=name,
        size=len(content),
        content_type=file.content_type or "application/octet-stream",
        extension=name.rsplit(".", 1)[-1].lower() if "." in name else "",
        content=content,
    )
    db.add(dataset)
    db.commit()
    db.refresh(dataset)
    return _metadata(dataset)


@router.get("/{dataset_id}/content")
def get_dataset_content(dataset_id: str, db: Session = Depends(database.get_db)):
    dataset = db.query(models.Dataset).filter(models.Dataset.id == dataset_id).first()
    if dataset is None:
        raise HTTPException(status_code=404, detail="Dataset not found")
    return Response(
        content=dataset.content,
        media_type=dataset.content_type,
        headers={"Content-Disposition": f'inline; filename="{dataset.name}"'},
    )


@router.delete("/{dataset_id}")
def delete_dataset(dataset_id: str, db: Session = Depends(database.get_db)):
    dataset = db.query(models.Dataset).filter(models.Dataset.id == dataset_id).first()
    if dataset is None:
        raise HTTPException(status_code=404, detail="Dataset not found")
    db.delete(dataset)
    db.commit()
    return {"ok": True, "dataset_id": dataset_id}


@router.delete("/")
def clear_datasets(db: Session = Depends(database.get_db)):
    deleted = db.query(models.Dataset).delete()
    db.commit()
    return {"ok": True, "deleted": deleted}