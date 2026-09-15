from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import database, schemas
from app.services.workflow_service import (
    cancel_workflow_run,
    continue_agent_plan_run,
    execute_agent_plan_run,
    get_workflow_run,
    resume_workflow_run,
    start_workflow_run,
)


router = APIRouter(prefix="/workflow-runs", tags=["workflow-runs"])


@router.post("/start", response_model=schemas.WorkflowRunResponse)
def start_workflow(request: schemas.WorkflowRunStartRequest, db: Session = Depends(database.get_db)):
    try:
        return start_workflow_run(
            chat_id=request.chat_id,
            employee_id=request.employee_id,
            workflow_skill_key=request.workflow_skill_key,
            user_message=request.user_message,
            db=db,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to start workflow run: {exc}") from exc


@router.get("/{run_id}", response_model=schemas.WorkflowRunResponse)
def get_workflow(run_id: int, db: Session = Depends(database.get_db)):
    try:
        return get_workflow_run(run_id, db)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to load workflow run: {exc}") from exc


@router.post("/{run_id}/resume", response_model=schemas.WorkflowRunResponse)
def resume_workflow(run_id: int, request: schemas.WorkflowRunResumeRequest, db: Session = Depends(database.get_db)):
    try:
        return resume_workflow_run(
            run_id=run_id,
            user_input=request.user_input,
            approved=request.approved,
            feedback=request.feedback,
            db=db,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to resume workflow run: {exc}") from exc


@router.post("/{run_id}/execute", response_model=schemas.WorkflowRunResponse)
async def execute_workflow(run_id: int, db: Session = Depends(database.get_db)):
    try:
        return await execute_agent_plan_run(run_id, db)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to execute workflow run: {exc}") from exc


@router.post("/{run_id}/continue", response_model=schemas.WorkflowRunResponse)
async def continue_workflow(run_id: int, request: schemas.WorkflowRunResumeRequest, db: Session = Depends(database.get_db)):
    try:
        return await continue_agent_plan_run(
            run_id=run_id,
            user_input=request.user_input,
            approved=request.approved,
            feedback=request.feedback,
            db=db,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to continue workflow run: {exc}") from exc


@router.post("/{run_id}/cancel", response_model=schemas.WorkflowRunResponse)
def cancel_workflow(run_id: int, db: Session = Depends(database.get_db)):
    try:
        return cancel_workflow_run(run_id, db)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to cancel workflow run: {exc}") from exc