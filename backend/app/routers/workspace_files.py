from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from .. import schemas
from ..services import artifact_service


router = APIRouter(
    prefix="/workspace/files",
    tags=["workspace-files"],
)


@router.get("/content", response_model=schemas.WorkspaceFileContentResponse)
async def get_workspace_file_content(path: str):
    if not artifact_service.is_text_previewable(path):
        raise HTTPException(status_code=400, detail="This file type does not support text preview")
    return schemas.WorkspaceFileContentResponse(**artifact_service.read_workspace_text_file(path))


@router.get("/download")
async def download_workspace_file(path: str, download: bool = False):
    file_path = artifact_service.resolve_workspace_file_path(path)
    if not file_path.exists() or not file_path.is_file():
        raise HTTPException(status_code=404, detail="Workspace file not found")
    return FileResponse(
        path=file_path,
        filename=file_path.name,
        media_type=artifact_service.guess_mime_type(file_path),
        content_disposition_type="attachment" if download else "inline",
    )