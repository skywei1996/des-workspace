from fastapi import APIRouter, File, HTTPException, UploadFile

from ..services.chat_upload_storage import store_chat_upload


router = APIRouter(prefix="/chats", tags=["chat-uploads"])


@router.post("/{chat_id}/uploads")
async def upload_chat_file(chat_id: int, file: UploadFile = File(...)):
    try:
        metadata = store_chat_upload(chat_id, file.filename or "upload", await file.read(), file.content_type)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    return metadata