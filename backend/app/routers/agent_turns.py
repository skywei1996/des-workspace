from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from .. import database, schemas
from ..services.dispatcher_service import DispatcherService


router = APIRouter(
    prefix="/agent",
    tags=["agent"],
)


@router.post("/turns", response_model=schemas.AgentTurnResponse)
async def handle_turn(request: schemas.AgentTurnRequest, db: Session = Depends(database.get_db)):
    return await DispatcherService(db).handle_turn(request)