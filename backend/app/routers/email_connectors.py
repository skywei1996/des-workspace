from fastapi import APIRouter, HTTPException

from app import schemas
from app.services.email_connector_service import (
    EmailConnectorError,
    complete_qq_mail_packaged_auth,
    connect_qq_mail,
    disconnect_qq_mail,
    get_qq_mail_connection,
    start_qq_mail_packaged_auth,
    test_qq_mail_connection,
)


router = APIRouter(prefix="/connectors/email", tags=["email-connectors"])


@router.get("/qq-mail", response_model=schemas.EmailConnectionStatus)
def read_qq_mail_connection():
    return schemas.EmailConnectionStatus(**get_qq_mail_connection())


@router.post("/qq-mail/auth/start", response_model=schemas.EmailAuthStartResponse)
def start_qq_mail_auth(payload: schemas.EmailAuthStartRequest):
    return schemas.EmailAuthStartResponse(**start_qq_mail_packaged_auth(return_url=payload.returnUrl or "/connectors"))


@router.post("/qq-mail/auth/complete", response_model=schemas.EmailConnectionStatus)
def complete_qq_mail_auth(payload: schemas.EmailAuthCompleteRequest):
    try:
        result = complete_qq_mail_packaged_auth(session_id=payload.sessionId, email=payload.email)
        return schemas.EmailConnectionStatus(**result)
    except EmailConnectorError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@router.post("/qq-mail/test", response_model=schemas.EmailConnectionTestResult)
def test_qq_mail(payload: schemas.QQMailConnectRequest):
    try:
        result = test_qq_mail_connection(
            email=payload.email,
            auth_code=payload.authCode,
            imap_host=payload.imapHost,
            imap_port=payload.imapPort,
        )
        return schemas.EmailConnectionTestResult(**result)
    except EmailConnectorError as error:
        return schemas.EmailConnectionTestResult(ok=False, message=str(error))


@router.post("/qq-mail/connect", response_model=schemas.EmailConnectionStatus)
def connect_qq_mail_account(payload: schemas.QQMailConnectRequest):
    try:
        result = connect_qq_mail(
            email=payload.email,
            auth_code=payload.authCode,
            imap_host=payload.imapHost,
            imap_port=payload.imapPort,
        )
        return schemas.EmailConnectionStatus(**result)
    except EmailConnectorError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@router.delete("/qq-mail", response_model=schemas.EmailConnectionStatus)
def delete_qq_mail_connection():
    return schemas.EmailConnectionStatus(**disconnect_qq_mail())