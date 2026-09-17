from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from .. import models, schemas, database

router = APIRouter(
    prefix="/chats",
    tags=["chats"],
    responses={404: {"description": "Not found"}},
)


def _touch_session_for_message(message: models.ChatMessage, db: Session) -> None:
    session = db.query(models.ChatSession).filter(models.ChatSession.chat_id == message.chat_id).first()
    if session is not None:
        session.updated_at = message.created_at or datetime.now()


@router.post("/messages/", response_model=schemas.ChatMessage)
def create_message(message: schemas.ChatMessageCreate, db: Session = Depends(database.get_db)):
    db_message = models.ChatMessage(**message.dict())
    db.add(db_message)
    db.flush()
    _touch_session_for_message(db_message, db)
    db.commit()
    db.refresh(db_message)
    return db_message


@router.get("/sessions/", response_model=List[schemas.ChatSession])
def list_chat_sessions(db: Session = Depends(database.get_db)):
    known_chat_ids = {chat_id for (chat_id,) in db.query(models.ChatSession.chat_id).all()}
    legacy_chat_ids = [
        chat_id
        for (chat_id,) in db.query(models.ChatMessage.chat_id).distinct().all()
        if chat_id is not None and chat_id not in known_chat_ids
    ]
    for chat_id in legacy_chat_ids:
        latest_message = (
            db.query(models.ChatMessage)
            .filter(models.ChatMessage.chat_id == chat_id)
            .order_by(models.ChatMessage.created_at.desc(), models.ChatMessage.id.desc())
            .first()
        )
        latest_employee_message = (
            db.query(models.ChatMessage)
            .filter(
                models.ChatMessage.chat_id == chat_id,
                models.ChatMessage.employee_id.isnot(None),
            )
            .order_by(models.ChatMessage.created_at.desc(), models.ChatMessage.id.desc())
            .first()
        )
        db.add(models.ChatSession(
            chat_id=chat_id,
            title="Aria",
            summary=(latest_message.content if latest_message else "继续上次会话")[:500],
            active_member=str(latest_employee_message.employee_id) if latest_employee_message else "aria",
            created_at=latest_message.created_at if latest_message else datetime.now(),
            updated_at=latest_message.created_at if latest_message else datetime.now(),
        ))
    if legacy_chat_ids:
        db.commit()

    return (
        db.query(models.ChatSession)
        .order_by(models.ChatSession.updated_at.desc(), models.ChatSession.chat_id.desc())
        .all()
    )


@router.put("/sessions/{chat_id}", response_model=schemas.ChatSession)
def upsert_chat_session(
    chat_id: int,
    session: schemas.ChatSessionUpsert,
    db: Session = Depends(database.get_db),
):
    if session.chat_id != chat_id:
        raise HTTPException(status_code=400, detail="chat_id must match the request path")
    values = session.dict()
    existing = db.query(models.ChatSession).filter(models.ChatSession.chat_id == chat_id).first()
    if existing is None:
        existing = models.ChatSession(**values)
        db.add(existing)
    else:
        for key, value in values.items():
            setattr(existing, key, value)
        existing.updated_at = datetime.now()
    db.commit()
    db.refresh(existing)
    return existing


@router.delete("/sessions/{chat_id}")
def delete_chat_session(chat_id: int, db: Session = Depends(database.get_db)):
    db.query(models.ChatSession).filter(models.ChatSession.chat_id == chat_id).delete()
    db.commit()
    return {"ok": True, "chat_id": chat_id}

@router.get("/{chat_id}/messages/", response_model=List[schemas.ChatMessage])
def read_messages(chat_id: int, skip: int = 0, limit: int = 100, db: Session = Depends(database.get_db)):
    messages = (
        db.query(models.ChatMessage)
        .filter(models.ChatMessage.chat_id == chat_id)
        .order_by(models.ChatMessage.created_at.asc(), models.ChatMessage.id.asc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    return messages


@router.delete("/{chat_id}/messages/")
def clear_chat_history(chat_id: int, db: Session = Depends(database.get_db)):
    workflow_run_ids = [
        run_id
        for (run_id,) in db.query(models.WorkflowRun.id)
        .filter(models.WorkflowRun.chat_id == chat_id)
        .all()
    ]

    deleted_workflow_step_runs = 0
    if workflow_run_ids:
        deleted_workflow_step_runs = (
            db.query(models.WorkflowStepRun)
            .filter(models.WorkflowStepRun.workflow_run_id.in_(workflow_run_ids))
            .delete(synchronize_session=False)
        )

    deleted_workflow_runs = (
        db.query(models.WorkflowRun)
        .filter(models.WorkflowRun.chat_id == chat_id)
        .delete(synchronize_session=False)
    )
    deleted_task_progress = (
        db.query(models.TaskProgress)
        .filter(models.TaskProgress.chat_id == chat_id)
        .delete(synchronize_session=False)
    )
    deleted_todos = (
        db.query(models.Todo)
        .filter(models.Todo.chat_id == chat_id)
        .delete(synchronize_session=False)
    )
    deleted_messages = (
        db.query(models.ChatMessage)
        .filter(models.ChatMessage.chat_id == chat_id)
        .delete(synchronize_session=False)
    )
    db.query(models.ChatSession).filter(models.ChatSession.chat_id == chat_id).delete(synchronize_session=False)

    db.commit()

    return {
        "ok": True,
        "chat_id": chat_id,
        "deleted_messages": deleted_messages,
        "deleted_todos": deleted_todos,
        "deleted_task_progress": deleted_task_progress,
        "deleted_workflow_runs": deleted_workflow_runs,
        "deleted_workflow_step_runs": deleted_workflow_step_runs,
    }
