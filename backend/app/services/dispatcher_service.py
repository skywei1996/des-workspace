import re
from typing import Optional

from fastapi import HTTPException
from sqlalchemy.orm import Session
from starlette.concurrency import run_in_threadpool

from .. import models, schemas
from .. import mcp_server
from ..services.artifact_service import create_artifacts_for_response, detect_requested_output_formats
from ..services.message_context import build_effective_user_request
from ..services.chat_upload_storage import resolve_chat_uploads


def _strip_embedded_markdown_attachment_source(text: str) -> str:
    cleaned = text or ""
    cleaned = re.sub(
        r"(?is)\n*附件(?:内容|正文|源文档)?[：:]?\s*```(?:markdown|md)\s*[\s\S]*?```\s*$",
        "",
        cleaned,
    )
    cleaned = re.sub(
        r"(?is)\n*```(?:markdown|md)\s*[\s\S]*?```\s*$",
        "",
        cleaned,
    )
    cleaned = re.sub(
        r"(?is)\n*附件(?:内容|正文|源文档)?[：:]\s*(?:markdown|md)?\s*[\s\S]*$",
        "",
        cleaned,
    )
    return cleaned.strip()


class DispatcherService:
    def __init__(self, db: Session):
        self.db = db

    def resolve_employee_id(self, chat_id: int, employee_id: Optional[int]) -> int:
        if employee_id:
            return employee_id

        resolved_employee_id = mcp_server._resolve_employee_id_for_chat(chat_id, self.db)
        if resolved_employee_id:
            return resolved_employee_id

        fallback_employee = (
            self.db.query(models.AIEmployee)
            .filter(models.AIEmployee.status == "active")
            .order_by(models.AIEmployee.id.asc())
            .first()
        )
        if fallback_employee is not None:
            return fallback_employee.id

        raise HTTPException(status_code=400, detail="No available AI employee for this turn")

    async def answer_direct_response(
        self,
        *,
        chat_id: int,
        user_message: str,
        employee_id: Optional[int],
        automation_setup: bool = False,
        upload_ids: Optional[list[str]] = None,
        full_access: bool = False,
    ) -> mcp_server.ExecuteResponse:
        try:
            return await run_in_threadpool(
                self._answer_direct_response_sync,
                chat_id,
                user_message,
                employee_id,
                automation_setup,
                upload_ids,
                full_access,
            )
        except HTTPException:
            raise
        except Exception as error:
            raise mcp_server._build_llm_http_exception(error)

    def _answer_direct_response_sync(
        self,
        chat_id: int,
        user_message: str,
        employee_id: Optional[int],
        automation_setup: bool = False,
        upload_ids: Optional[list[str]] = None,
        full_access: bool = False,
    ) -> mcp_server.ExecuteResponse:
        # Codex and MCP clients are synchronous; keep them off the event loop.
        from ..database import SessionLocal

        with SessionLocal() as db:
            resolved_employee_id = self.resolve_employee_id(chat_id, employee_id)
            employee = (
                db.query(models.AIEmployee)
                .filter(models.AIEmployee.id == resolved_employee_id)
                .first()
            )
            result_text, knowledge_hits, generated_files = mcp_server._answer_direct_for_employee(
                chat_id,
                user_message,
                resolved_employee_id,
                db,
                automation_setup=automation_setup,
                employee_id_for_automation=resolved_employee_id if automation_setup else None,
                uploaded_files=resolve_chat_uploads(chat_id, upload_ids or []),
                full_access=full_access,
            )
            artifact_request = user_message
            if mcp_server._employee_requires_structured_deliverable(employee):
                artifact_request = f"{user_message}\n请生成 Markdown/MD 附件"
            artifacts = mcp_server._build_runtime_generated_artifacts(generated_files, artifact_request)
            requested_formats = set(detect_requested_output_formats(artifact_request))
            returned_formats = {
                str(
                    artifact.get("format")
                    if isinstance(artifact, dict)
                    else getattr(artifact, "format", "")
                    or ""
                ).lower()
                for artifact in artifacts
            }
            if "pptx" in requested_formats and "pptx" not in returned_formats:
                raise RuntimeError(
                    "Codex did not create a valid native PPTX in DES_ARTIFACT_DIR. "
                    "The request was not replaced with an HTML or text-based fallback."
                )
            for native_format in ("xlsx", "pdf"):
                if native_format in requested_formats and native_format not in returned_formats:
                    raise RuntimeError(
                        f"Codex did not create a valid native {native_format.upper()} in DES_ARTIFACT_DIR. "
                        "The request was not replaced with a text-based fallback."
                    )
            if not artifacts:
                artifacts = create_artifacts_for_response(user_request=artifact_request, response_text=result_text)
            display_text = _strip_embedded_markdown_attachment_source(result_text) if artifacts else result_text
            return mcp_server.ExecuteResponse(
                status="completed",
                result=display_text,
                workflow_run=None,
                knowledge_hits=knowledge_hits,
                artifacts=artifacts,
            )

    async def handle_turn(self, request: schemas.AgentTurnRequest) -> schemas.AgentTurnResponse:
        resolved_employee_id = self.resolve_employee_id(request.chat_id, request.employee_id)
        effective_user_request = build_effective_user_request(
            request.chat_id,
            request.user_message,
            self.db,
        )
        direct_response = await self.answer_direct_response(
            chat_id=request.chat_id,
            user_message=request.user_message,
            employee_id=resolved_employee_id,
        )

        return schemas.AgentTurnResponse(
            status="completed",
            mode="direct_answer",
            reasoning="Handled directly by the execution agent.",
            employee_id=resolved_employee_id,
            effective_user_request=effective_user_request,
            result=direct_response.result,
            knowledge_hits=list(direct_response.knowledge_hits or []),
            artifacts=direct_response.artifacts,
        )