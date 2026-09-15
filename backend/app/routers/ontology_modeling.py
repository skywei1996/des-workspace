from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import database, models, schemas


router = APIRouter(prefix="/api/ontology-modeling", tags=["ontology-modeling"])


def _required(value: str, field: str) -> str:
    normalized = str(value or "").strip()
    if not normalized:
        raise HTTPException(status_code=422, detail=f"{field} is required")
    return normalized


@router.get("/projects", response_model=list[schemas.OntologyModelingProject])
def list_projects(db: Session = Depends(database.get_db)):
    return db.query(models.OntologyModelingProject).order_by(models.OntologyModelingProject.updated_at.desc()).all()


@router.post("/projects", response_model=schemas.OntologyModelingProject, status_code=201)
def create_project(payload: schemas.OntologyModelingProjectCreate, db: Session = Depends(database.get_db)):
    project = models.OntologyModelingProject(
        id=str(uuid4()),
        name=_required(payload.name, "name"),
        domain=_required(payload.domain, "domain"),
        goal=_required(payload.goal, "goal"),
        owner=_required(payload.owner, "owner"),
        terminology_owner=_required(payload.terminology_owner, "terminology_owner"),
        datasource_ids=list(payload.datasource_ids or []),
        modeling_mode=payload.modeling_mode,
        description=str(payload.description or "").strip(),
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


@router.get("/projects/{project_id}", response_model=schemas.OntologyModelingProject)
def get_project(project_id: str, db: Session = Depends(database.get_db)):
    project = db.query(models.OntologyModelingProject).filter(models.OntologyModelingProject.id == project_id).first()
    if project is None:
        raise HTTPException(status_code=404, detail="Modeling project not found")
    return project


@router.get("/projects/{project_id}/objects", response_model=list[schemas.OntologyModelingObject])
def list_objects(project_id: str, db: Session = Depends(database.get_db)):
    return db.query(models.OntologyModelingObject).filter(
        models.OntologyModelingObject.project_id == project_id
    ).order_by(models.OntologyModelingObject.created_at.asc()).all()


@router.post("/projects/{project_id}/objects", response_model=schemas.OntologyModelingObject, status_code=201)
def create_object(project_id: str, payload: schemas.OntologyModelingObjectCreate, db: Session = Depends(database.get_db)):
    project_exists = db.query(models.OntologyModelingProject.id).filter(models.OntologyModelingProject.id == project_id).first()
    if project_exists is None:
        raise HTTPException(status_code=404, detail="Modeling project not found")
    object_key = _required(payload.object_key, "object_key")
    duplicate = db.query(models.OntologyModelingObject.id).filter(
        models.OntologyModelingObject.project_id == project_id,
        models.OntologyModelingObject.object_key == object_key,
    ).first()
    if duplicate:
        raise HTTPException(status_code=409, detail="An object with this unique key already exists in the project")
    object_definition = models.OntologyModelingObject(
        id=str(uuid4()),
        project_id=project_id,
        name=_required(payload.name, "name"),
        definition=_required(payload.definition, "definition"),
        object_key=object_key,
        owner=_required(payload.owner, "owner"),
        lifecycle=payload.lifecycle,
    )
    db.add(object_definition)
    db.commit()
    db.refresh(object_definition)
    return object_definition