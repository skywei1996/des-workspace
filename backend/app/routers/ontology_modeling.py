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


@router.put("/projects/{project_id}", response_model=schemas.OntologyModelingProject)
def update_project(project_id: str, payload: schemas.OntologyModelingProjectCreate, db: Session = Depends(database.get_db)):
    project = db.query(models.OntologyModelingProject).filter(models.OntologyModelingProject.id == project_id).first()
    if project is None:
        raise HTTPException(status_code=404, detail="Modeling project not found")
    project.name = _required(payload.name, "name")
    project.domain = _required(payload.domain, "domain")
    project.goal = _required(payload.goal, "goal")
    project.owner = _required(payload.owner, "owner")
    project.terminology_owner = _required(payload.terminology_owner, "terminology_owner")
    project.datasource_ids = list(payload.datasource_ids or [])
    project.modeling_mode = payload.modeling_mode
    project.description = str(payload.description or "").strip()
    db.commit()
    db.refresh(project)
    return project


@router.delete("/projects/{project_id}")
def delete_project(project_id: str, db: Session = Depends(database.get_db)):
    project = db.query(models.OntologyModelingProject).filter(models.OntologyModelingProject.id == project_id).first()
    if project is None:
        raise HTTPException(status_code=404, detail="Modeling project not found")
    definitions = db.query(models.OntologyDefinition).all()
    for definition in definitions:
        if (definition.definition_json or {}).get("projectId") == project_id:
            db.delete(definition)
    db.query(models.OntologyModelingMapping).filter(models.OntologyModelingMapping.project_id == project_id).delete(synchronize_session=False)
    db.query(models.OntologyModelingProperty).filter(models.OntologyModelingProperty.project_id == project_id).delete(synchronize_session=False)
    db.query(models.OntologyModelingObject).filter(models.OntologyModelingObject.project_id == project_id).delete(synchronize_session=False)
    db.delete(project)
    db.commit()
    return {"ok": True, "project_id": project_id}


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


@router.put("/projects/{project_id}/objects/{object_id}", response_model=schemas.OntologyModelingObject)
def update_object(project_id: str, object_id: str, payload: schemas.OntologyModelingObjectCreate, db: Session = Depends(database.get_db)):
    object_definition = db.query(models.OntologyModelingObject).filter(
        models.OntologyModelingObject.project_id == project_id,
        models.OntologyModelingObject.id == object_id,
    ).first()
    if object_definition is None:
        raise HTTPException(status_code=404, detail="Modeling object not found")
    object_key = _required(payload.object_key, "object_key")
    duplicate = db.query(models.OntologyModelingObject.id).filter(
        models.OntologyModelingObject.project_id == project_id,
        models.OntologyModelingObject.object_key == object_key,
        models.OntologyModelingObject.id != object_id,
    ).first()
    if duplicate:
        raise HTTPException(status_code=409, detail="An object with this unique key already exists in the project")
    object_definition.name = _required(payload.name, "name")
    object_definition.definition = _required(payload.definition, "definition")
    object_definition.object_key = object_key
    object_definition.owner = _required(payload.owner, "owner")
    object_definition.lifecycle = payload.lifecycle
    db.commit()
    db.refresh(object_definition)
    return object_definition


@router.delete("/projects/{project_id}/objects/{object_id}")
def delete_object(project_id: str, object_id: str, db: Session = Depends(database.get_db)):
    object_definition = db.query(models.OntologyModelingObject).filter(
        models.OntologyModelingObject.project_id == project_id,
        models.OntologyModelingObject.id == object_id,
    ).first()
    if object_definition is None:
        raise HTTPException(status_code=404, detail="Modeling object not found")
    properties = db.query(models.OntologyModelingProperty).filter(
        models.OntologyModelingProperty.project_id == project_id
    ).all()
    for property_definition in properties:
        if object_id in (property_definition.object_ids or []):
            property_definition.object_ids = [item for item in property_definition.object_ids if item != object_id]
    db.query(models.OntologyModelingMapping).filter(
        models.OntologyModelingMapping.project_id == project_id,
        models.OntologyModelingMapping.object_id == object_id,
    ).delete(synchronize_session=False)
    db.delete(object_definition)
    db.commit()
    return {"ok": True, "object_id": object_id}


@router.get("/projects/{project_id}/properties", response_model=list[schemas.OntologyModelingProperty])
def list_properties(project_id: str, db: Session = Depends(database.get_db)):
    return db.query(models.OntologyModelingProperty).filter(
        models.OntologyModelingProperty.project_id == project_id
    ).order_by(models.OntologyModelingProperty.created_at.asc()).all()


@router.post("/projects/{project_id}/properties", response_model=schemas.OntologyModelingProperty, status_code=201)
def create_property(project_id: str, payload: schemas.OntologyModelingPropertyCreate, db: Session = Depends(database.get_db)):
    project_exists = db.query(models.OntologyModelingProject.id).filter(models.OntologyModelingProject.id == project_id).first()
    if project_exists is None:
        raise HTTPException(status_code=404, detail="Modeling project not found")
    property_definition = models.OntologyModelingProperty(
        id=str(uuid4()),
        project_id=project_id,
        name=_required(payload.name, "name"),
        api_name=str(payload.api_name or "").strip(),
        object_ids=list(payload.object_ids or []),
        data_type=payload.data_type,
        description=str(payload.description or "").strip(),
        source=str(payload.source or "").strip(),
    )
    db.add(property_definition)
    db.commit()
    db.refresh(property_definition)
    return property_definition


@router.put("/projects/{project_id}/properties/{property_id}", response_model=schemas.OntologyModelingProperty)
def update_property(project_id: str, property_id: str, payload: schemas.OntologyModelingPropertyCreate, db: Session = Depends(database.get_db)):
    property_definition = db.query(models.OntologyModelingProperty).filter(
        models.OntologyModelingProperty.project_id == project_id,
        models.OntologyModelingProperty.id == property_id,
    ).first()
    if property_definition is None:
        raise HTTPException(status_code=404, detail="Modeling property not found")
    property_definition.name = _required(payload.name, "name")
    property_definition.api_name = str(payload.api_name or "").strip()
    property_definition.object_ids = list(payload.object_ids or [])
    property_definition.data_type = payload.data_type
    property_definition.description = str(payload.description or "").strip()
    property_definition.source = str(payload.source or "").strip()
    db.commit()
    db.refresh(property_definition)
    return property_definition


@router.delete("/projects/{project_id}/properties/{property_id}")
def delete_property(project_id: str, property_id: str, db: Session = Depends(database.get_db)):
    property_definition = db.query(models.OntologyModelingProperty).filter(
        models.OntologyModelingProperty.project_id == project_id,
        models.OntologyModelingProperty.id == property_id,
    ).first()
    if property_definition is None:
        raise HTTPException(status_code=404, detail="Modeling property not found")
    mappings = db.query(models.OntologyModelingMapping).filter(
        models.OntologyModelingMapping.project_id == project_id
    ).all()
    for mapping in mappings:
        mapping.primary_key_property_ids = [
            item for item in (mapping.primary_key_property_ids or []) if item != property_id
        ]
        mapping.field_mappings = [
            item for item in (mapping.field_mappings or []) if item.get("propertyId") != property_id
        ]
        validation = dict(mapping.validation_json or {})
        validation["mappedCount"] = len({
            item.get("propertyId")
            for item in mapping.field_mappings
            if not item.get("mappingType") and item.get("propertyId")
        })
        validation["propertyCount"] = max(int(validation.get("propertyCount") or 0) - 1, 0)
        mapping.validation_json = validation
    db.delete(property_definition)
    db.commit()
    return {"ok": True, "property_id": property_id}


@router.get("/projects/{project_id}/mappings", response_model=list[dict])
def list_mappings(project_id: str, db: Session = Depends(database.get_db)):
    mappings = db.query(models.OntologyModelingMapping).filter(
        models.OntologyModelingMapping.project_id == project_id
    ).order_by(models.OntologyModelingMapping.created_at.asc()).all()
    return [
        {
            "id": f"mapping-{mapping.object_id}",
            "projectId": mapping.project_id,
            "objectId": mapping.object_id,
            "datasetId": mapping.dataset_id,
            "datasetName": mapping.dataset_name,
            "datasetVersion": mapping.dataset_version,
            "sheetName": mapping.sheet_name,
            "primaryKeyPropertyIds": mapping.primary_key_property_ids or [],
            "fieldMappings": mapping.field_mappings or [],
            "validation": mapping.validation_json or {},
            "status": mapping.status,
        }
        for mapping in mappings
    ]


@router.put("/projects/{project_id}/objects/{object_id}/mapping", response_model=dict)
def save_mapping(
    project_id: str,
    object_id: str,
    payload: schemas.OntologyModelingMappingPayload,
    db: Session = Depends(database.get_db),
):
    object_exists = db.query(models.OntologyModelingObject.id).filter(
        models.OntologyModelingObject.project_id == project_id,
        models.OntologyModelingObject.id == object_id,
    ).first()
    if object_exists is None:
        raise HTTPException(status_code=404, detail="Modeling object not found")
    saved_mapping = {
        **payload.mapping,
        "id": payload.mapping.get("id") or f"mapping-{object_id}",
        "projectId": project_id,
        "objectId": object_id,
    }
    mapping = db.query(models.OntologyModelingMapping).filter(
        models.OntologyModelingMapping.project_id == project_id,
        models.OntologyModelingMapping.object_id == object_id,
    ).first()
    if mapping is None:
        mapping = models.OntologyModelingMapping(
            id=str(uuid4()),
            project_id=project_id,
            object_id=object_id,
        )
        db.add(mapping)
    mapping.dataset_id = str(saved_mapping.get("datasetId") or "")
    mapping.dataset_name = str(saved_mapping.get("datasetName") or "")
    mapping.dataset_version = str(saved_mapping.get("datasetVersion") or "")
    mapping.sheet_name = str(saved_mapping.get("sheetName") or "")
    mapping.primary_key_property_ids = list(saved_mapping.get("primaryKeyPropertyIds") or [])
    mapping.field_mappings = list(saved_mapping.get("fieldMappings") or [])
    mapping.validation_json = dict(saved_mapping.get("validation") or {})
    mapping.status = str(saved_mapping.get("status") or "draft")
    db.commit()
    return saved_mapping