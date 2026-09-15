from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from .. import models, schemas, database

router = APIRouter(
    prefix="/chats",
    tags=["chats"],
    responses={404: {"description": "Not found"}},
)

@router.post("/messages/", response_model=schemas.ChatMessage)
def create_message(message: schemas.ChatMessageCreate, db: Session = Depends(database.get_db)):
    db_message = models.ChatMessage(**message.dict())
    db.add(db_message)
    db.commit()
    db.refresh(db_message)
    return db_message

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
