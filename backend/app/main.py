from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app import config as _config  # Ensure backend/.env is loaded during app startup.
from app.mcp_server import router as mcp_router
from app.routers import carbon_workers, employees, tasks, chats, chat_uploads, todos, watermark, skills, mcp_servers, workflow_runs, groups, image_generation, agent_turns, workspace_files, knowledge_bases, contract_review_rules, model_configurations, email_connectors, object_type_analysis, ontology_instances, ontology_definitions, ontology_modeling, datasets, ontology_design, capacity_evaluation, simple_chat
from app import models, database
from app.services.automation_schema import ensure_automation_schema
from app.services.automation_scheduler import automation_task_scheduler
from app.services.employee_schema import ensure_ai_employee_schema
from app.services.mcp_service import ensure_builtin_tavily_setup, ensure_mcp_server_schema
from app.services.skill_registry import ensure_skill_registry_schema

# Create database tables
models.Base.metadata.create_all(bind=database.engine)
ensure_ai_employee_schema(database.engine)
ensure_mcp_server_schema(database.engine)
ensure_skill_registry_schema(database.engine)
ensure_automation_schema(database.engine)

db = database.SessionLocal()
try:
    ensure_builtin_tavily_setup(db)
finally:
    db.close()

app = FastAPI(title="DES Codex Runtime Server")

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with specific frontend origin
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register Routers
app.include_router(mcp_router, prefix="/mcp", tags=["mcp"])
app.include_router(carbon_workers.router)
app.include_router(employees.router)
app.include_router(tasks.router)
app.include_router(chats.router)
app.include_router(chat_uploads.router)
app.include_router(todos.router)
app.include_router(groups.router)
app.include_router(image_generation.router)
app.include_router(watermark.router, prefix="/watermark", tags=["watermark"])
app.include_router(skills.router)
app.include_router(mcp_servers.router)
app.include_router(workflow_runs.router)
app.include_router(agent_turns.router)
app.include_router(workspace_files.router)
app.include_router(knowledge_bases.router)
app.include_router(contract_review_rules.router)
app.include_router(model_configurations.router)
app.include_router(email_connectors.router)
app.include_router(object_type_analysis.router)
app.include_router(ontology_instances.router)
app.include_router(ontology_definitions.router)
app.include_router(ontology_modeling.router)
app.include_router(datasets.router)
app.include_router(ontology_design.router)
app.include_router(capacity_evaluation.router)
app.include_router(simple_chat.router)


@app.on_event("startup")
async def start_automation_task_scheduler():
    automation_task_scheduler.start()


@app.on_event("shutdown")
async def stop_automation_task_scheduler():
    await automation_task_scheduler.stop()

@app.get("/health")
async def health_check():
    return {"status": "ok"}
