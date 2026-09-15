from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from .. import database, models, schemas


VALID_CARBON_WORKER_STATUSES = {"active", "inactive", "on_leave"}


def _normalize_carbon_worker_payload(payload: dict, current: models.CarbonWorker | None = None) -> dict:
    normalized = dict(payload)

    if "name" in normalized or current is None:
        normalized["name"] = str(normalized.get("name") or getattr(current, "name", "")).strip()
        if not normalized["name"]:
            raise HTTPException(status_code=400, detail="Carbon worker name is required")

    if "role" in normalized or current is None:
        normalized["role"] = str(normalized.get("role") or getattr(current, "role", "")).strip()
        if not normalized["role"]:
            raise HTTPException(status_code=400, detail="Carbon worker role is required")

    if "email" in normalized or current is None:
        normalized["email"] = str(normalized.get("email") or getattr(current, "email", "")).strip().lower()
        if not normalized["email"]:
            raise HTTPException(status_code=400, detail="Carbon worker email is required")

    if "phone" in normalized or current is None:
        normalized["phone"] = str(normalized.get("phone") or getattr(current, "phone", "")).strip() or None

    status = str(normalized.get("status") or getattr(current, "status", "active")).strip().lower()
    if status not in VALID_CARBON_WORKER_STATUSES:
        raise HTTPException(status_code=400, detail=f"Unsupported carbon worker status: {status}")
    normalized["status"] = status

    teams = normalized.get("teams")
    if teams is None:
        teams = list(getattr(current, "teams", None) or []) if current else []
    normalized["teams"] = [str(team).strip() for team in teams if str(team).strip()]

    return normalized


def _ensure_unique_email(db: Session, email: str, current_id: int | None = None) -> None:
    existing = db.query(models.CarbonWorker).filter(models.CarbonWorker.email == email).first()
    if existing and existing.id != current_id:
        raise HTTPException(status_code=400, detail="A carbon worker with this email already exists")


router = APIRouter(prefix="/carbon-workers", tags=["carbon-workers"])


@router.post("/", response_model=schemas.CarbonWorker)
def create_carbon_worker(worker: schemas.CarbonWorkerCreate, db: Session = Depends(database.get_db)):
    payload = _normalize_carbon_worker_payload(worker.dict())
    _ensure_unique_email(db, payload["email"])

    db_worker = models.CarbonWorker(**payload)
    db.add(db_worker)
    db.commit()
    db.refresh(db_worker)
    return db_worker


@router.get("/", response_model=List[schemas.CarbonWorker])
def read_carbon_workers(skip: int = 0, limit: int = 200, db: Session = Depends(database.get_db)):
    return (
        db.query(models.CarbonWorker)
        .order_by(models.CarbonWorker.updated_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )


@router.get("/{worker_id}", response_model=schemas.CarbonWorker)
def read_carbon_worker(worker_id: int, db: Session = Depends(database.get_db)):
    db_worker = db.query(models.CarbonWorker).filter(models.CarbonWorker.id == worker_id).first()
    if db_worker is None:
        raise HTTPException(status_code=404, detail="Carbon worker not found")
    return db_worker


@router.put("/{worker_id}", response_model=schemas.CarbonWorker)
def update_carbon_worker(worker_id: int, worker: schemas.CarbonWorkerUpdate, db: Session = Depends(database.get_db)):
    db_worker = db.query(models.CarbonWorker).filter(models.CarbonWorker.id == worker_id).first()
    if db_worker is None:
        raise HTTPException(status_code=404, detail="Carbon worker not found")

    updates = _normalize_carbon_worker_payload(worker.dict(exclude_unset=True), current=db_worker)
    if "email" in updates:
        _ensure_unique_email(db, updates["email"], current_id=db_worker.id)

    for key, value in updates.items():
        setattr(db_worker, key, value)

    db.commit()
    db.refresh(db_worker)
    return db_worker


@router.delete("/{worker_id}")
def delete_carbon_worker(worker_id: int, db: Session = Depends(database.get_db)):
    db_worker = db.query(models.CarbonWorker).filter(models.CarbonWorker.id == worker_id).first()
    if db_worker is None:
        raise HTTPException(status_code=404, detail="Carbon worker not found")

    db.delete(db_worker)
    db.commit()
    return {"ok": True, "worker_id": worker_id}