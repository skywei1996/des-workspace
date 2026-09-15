from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import database, schemas
from app.services import mcp_service


router = APIRouter(prefix="/mcp-servers", tags=["mcp-servers"])


@router.get("/", response_model=list[schemas.MCPServer])
def read_mcp_servers(db: Session = Depends(database.get_db)):
    return mcp_service.list_mcp_servers(db)


@router.post("/", response_model=schemas.MCPServer)
def create_mcp_server(payload: schemas.MCPServerCreate, db: Session = Depends(database.get_db)):
    return mcp_service.create_mcp_server(payload, db)


@router.get("/{server_id}", response_model=schemas.MCPServer)
def read_mcp_server(server_id: int, db: Session = Depends(database.get_db)):
    server = mcp_service.get_mcp_server(server_id, db)
    if server is None:
        raise HTTPException(status_code=404, detail="MCP server not found")
    return server


@router.put("/{server_id}", response_model=schemas.MCPServer)
def update_mcp_server(server_id: int, payload: schemas.MCPServerUpdate, db: Session = Depends(database.get_db)):
    server = mcp_service.get_mcp_server(server_id, db)
    if server is None:
        raise HTTPException(status_code=404, detail="MCP server not found")
    return mcp_service.update_mcp_server(server, payload, db)


@router.delete("/{server_id}")
def delete_mcp_server(server_id: int, db: Session = Depends(database.get_db)):
    server = mcp_service.get_mcp_server(server_id, db)
    if server is None:
        raise HTTPException(status_code=404, detail="MCP server not found")
    mcp_service.delete_mcp_server(server, db)
    return {"status": "success"}


@router.post("/{server_id}/test", response_model=schemas.MCPServerTestResult)
def test_mcp_server(server_id: int, db: Session = Depends(database.get_db)):
    server = mcp_service.get_mcp_server(server_id, db)
    if server is None:
        raise HTTPException(status_code=404, detail="MCP server not found")
    result = mcp_service.test_mcp_server_connection(server)
    return schemas.MCPServerTestResult(**result)