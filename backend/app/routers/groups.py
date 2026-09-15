from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from .. import database, models, schemas


router = APIRouter(
    prefix="/groups",
    tags=["groups"],
    responses={404: {"description": "Not found"}},
)


def _load_group(db: Session, group_id: str):
    return (
        db.query(models.Group)
        .options(joinedload(models.Group.members).joinedload(models.GroupMember.employee))
        .filter(models.Group.id == group_id)
        .first()
    )


def _serialize_group(group: models.Group) -> schemas.Group:
    members = [
        schemas.AIEmployee(
            id=group_member.employee.id,
            name=group_member.employee.name,
            role_title=group_member.employee.role_title,
            avatar_url=group_member.employee.avatar_url,
            description=group_member.employee.description,
            persona_prompt=group_member.employee.persona_prompt,
            knowledge_ids=group_member.employee.knowledge_ids or [],
            database_ids=group_member.employee.database_ids or [],
            tool_ids=group_member.employee.tool_ids or [],
            workflow_ids=group_member.employee.workflow_ids or [],
            action_guide=group_member.employee.action_guide,
            created_at=group_member.employee.created_at,
            updated_at=group_member.employee.updated_at,
        )
        for group_member in group.members
        if group_member.employee is not None
    ]
    return schemas.Group(
        id=group.id,
        name=group.name,
        description=group.description,
        mode=group.mode or "manual",
        created_at=group.created_at,
        updated_at=group.updated_at,
        members=members,
    )


def _validate_member_ids(member_ids: list[int], db: Session) -> list[int]:
    normalized_ids = list(dict.fromkeys(member_ids or []))
    if not normalized_ids:
        raise HTTPException(status_code=400, detail="member_ids is required")

    employees = db.query(models.AIEmployee.id).filter(models.AIEmployee.id.in_(normalized_ids)).all()
    existing_ids = {employee_id for (employee_id,) in employees}
    missing_ids = [employee_id for employee_id in normalized_ids if employee_id not in existing_ids]
    if missing_ids:
        raise HTTPException(status_code=400, detail=f"Unknown employee ids: {missing_ids}")

    return normalized_ids


@router.get("/", response_model=list[schemas.Group])
def list_groups(db: Session = Depends(database.get_db)):
    groups = (
        db.query(models.Group)
        .options(joinedload(models.Group.members).joinedload(models.GroupMember.employee))
        .order_by(models.Group.created_at.desc())
        .all()
    )
    return [_serialize_group(group) for group in groups]


@router.get("/{group_id}", response_model=schemas.Group)
def get_group(group_id: str, db: Session = Depends(database.get_db)):
    group = _load_group(db, group_id)
    if group is None:
        raise HTTPException(status_code=404, detail="Group not found")
    return _serialize_group(group)


@router.post("/", response_model=schemas.Group)
def create_group(payload: schemas.GroupCreate, db: Session = Depends(database.get_db)):
    member_ids = _validate_member_ids(payload.member_ids, db)
    group = models.Group(
        id=str(uuid4()),
        name=payload.name,
        description=payload.description,
        mode=payload.mode or "manual",
    )
    db.add(group)
    db.flush()

    for employee_id in member_ids:
        db.add(models.GroupMember(group_id=group.id, employee_id=employee_id))

    db.commit()
    db.refresh(group)
    return _serialize_group(_load_group(db, group.id))


@router.patch("/{group_id}", response_model=schemas.Group)
def update_group(group_id: str, payload: schemas.GroupUpdate, db: Session = Depends(database.get_db)):
    group = _load_group(db, group_id)
    if group is None:
        raise HTTPException(status_code=404, detail="Group not found")

    if payload.name is not None:
        group.name = payload.name
    if payload.description is not None:
        group.description = payload.description
    if payload.mode is not None:
        group.mode = payload.mode

    if payload.member_ids is not None:
        member_ids = _validate_member_ids(payload.member_ids, db)
        db.query(models.GroupMember).filter(models.GroupMember.group_id == group_id).delete(synchronize_session=False)
        for employee_id in member_ids:
            db.add(models.GroupMember(group_id=group_id, employee_id=employee_id))

    db.commit()
    return _serialize_group(_load_group(db, group_id))


@router.delete("/{group_id}")
def delete_group(group_id: str, db: Session = Depends(database.get_db)):
    group = db.query(models.Group).filter(models.Group.id == group_id).first()
    if group is None:
        raise HTTPException(status_code=404, detail="Group not found")

    db.delete(group)
    db.commit()
    return {"ok": True, "group_id": group_id}