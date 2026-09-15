from pydantic import BaseModel, Field, model_validator
from typing import List, Literal, Optional, Any
from datetime import datetime


class KnowledgeDocumentChunk(BaseModel):
    id: Optional[str] = None
    point_id: Optional[str] = None
    chunk_id: Optional[int] = None
    content: str = ""
    chunk_type: Optional[str] = None
    attachment_link: Optional[str] = None
    page_numbers: List[int] = Field(default_factory=list)
    original_coordinate: Optional[Any] = None
    doc_id: Optional[str] = None
    doc_name: Optional[str] = None


class KnowledgeDocumentSummary(BaseModel):
    id: str
    name: str
    fileType: str = "TXT"
    updatedAt: str = ""
    status: str = "pending"
    summary: str = ""
    chunks: List[KnowledgeDocumentChunk | str] = Field(default_factory=list)
    remote_doc_id: Optional[str] = None
    source_url: Optional[str] = None
    size_bytes: int = 0
    remote_process_status: Optional[int] = None
    failed_code: Optional[int] = None


class KnowledgeDocumentTag(BaseModel):
    field_name: str
    field_type: str
    field_value: Any


class KnowledgeDocumentImportRequest(BaseModel):
    uri: str
    doc_id: Optional[str] = None
    doc_name: Optional[str] = None
    doc_type: Optional[str] = None
    description: Optional[str] = ""
    tag_list: List[KnowledgeDocumentTag] = Field(default_factory=list)


class KnowledgeDocumentImportResponse(BaseModel):
    knowledge_base_id: str
    request_id: Optional[str] = None
    resource_id: Optional[str] = None
    collection_name: Optional[str] = None
    project: Optional[str] = None
    document: KnowledgeDocumentSummary


class KnowledgeDocumentUploadResponse(BaseModel):
    knowledge_base_id: str
    tos_uri: str
    bucket: str
    key: str
    request_id: Optional[str] = None
    resource_id: Optional[str] = None
    collection_name: Optional[str] = None
    project: Optional[str] = None
    document: KnowledgeDocumentSummary


class KnowledgeBaseDocumentsResponse(BaseModel):
    knowledge_base_id: str
    sync_status: str = "pending"
    sync_error: Optional[str] = None
    documents: List[KnowledgeDocumentSummary] = Field(default_factory=list)


class KnowledgeDocumentPreviewTextResponse(BaseModel):
    knowledge_base_id: str
    document_id: str
    file_type: str
    preview_type: str = "markdown"
    markdown: str = ""


class KnowledgeBaseCreateRequest(BaseModel):
    name: str
    description: Optional[str] = ""
    type: str = "text"
    teams: List[str] = Field(default_factory=list)
    remote_resource_id: Optional[str] = None
    local_display_name: Optional[str] = None
    remote_host: Optional[str] = None
    remote_project: Optional[str] = None
    remote_collection_name: Optional[str] = None
    auto_create_remote: bool = False


class KnowledgeBaseUpdateRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    enabled: Optional[bool] = None
    status: Optional[bool] = None
    type: Optional[str] = None
    teams: Optional[List[str]] = None
    remote_resource_id: Optional[str] = None
    local_display_name: Optional[str] = None
    remote_host: Optional[str] = None
    remote_project: Optional[str] = None
    remote_collection_name: Optional[str] = None
    sync_status: Optional[str] = None
    sync_error: Optional[str] = None


class KnowledgeBaseSyncInfo(BaseModel):
    provider: str = "volcengine"
    status: str
    resource_id: str
    collection_name: str
    host: str
    project: str
    request_id: Optional[str] = None


class KnowledgeBaseCreateResponse(BaseModel):
    id: str
    name: str
    description: str = ""
    date: str
    enabled: bool = True
    status: bool = True
    type: str = "text"
    teams: List[str] = Field(default_factory=list)
    documents: List[KnowledgeDocumentSummary] = Field(default_factory=list)
    remote_provider: str = "volcengine"
    remote_resource_id: Optional[str] = None
    local_display_name: Optional[str] = None
    remote_host: Optional[str] = None
    remote_project: Optional[str] = None
    remote_collection_name: Optional[str] = None
    sync_status: str = "pending"
    sync_error: Optional[str] = None
    sync_info: Optional[KnowledgeBaseSyncInfo] = None


class KnowledgeBaseSearchRequest(BaseModel):
    query: str
    limit: int = 4
    rewrite: bool = True
    rerank_switch: bool = True
    chunk_group: bool = True
    retrieve_count: int = 10
    messages: List[dict] = Field(default_factory=list)


class KnowledgeSearchHit(BaseModel):
    knowledge_base_id: str
    knowledge_base_name: str
    document_id: Optional[str] = None
    document_name: Optional[str] = None
    chunk_id: Optional[int] = None
    chunk_title: Optional[str] = None
    content: str = ""
    score: Optional[float] = None
    rerank_score: Optional[float] = None
    recall_position: Optional[int] = None
    rerank_position: Optional[int] = None
    chunk_type: Optional[str] = None
    original_coordinate: Optional[Any] = None


class KnowledgeBaseSearchResponse(BaseModel):
    query: str
    count: int = 0
    rewrite_query: Optional[str] = None
    request_id: Optional[str] = None
    token_usage: Optional[Any] = None
    result_list: List[KnowledgeSearchHit] = Field(default_factory=list)


class ContractRuleGroupCreate(BaseModel):
    name: str


class ContractRuleGroup(BaseModel):
    id: str
    name: str
    created_at: datetime
    updated_at: datetime


class ContractReviewRuleCreate(BaseModel):
    name: str
    risk: str
    description: str
    group_name: str


class ContractReviewRule(BaseModel):
    id: str
    name: str
    risk: str
    description: str
    group: str
    group_id: str
    source: str = "智能"
    created_at: datetime
    updated_at: datetime


class ContractRuleAnalysisItemCreate(BaseModel):
    contract_name: str
    issue_comment: str = ""
    adjustment_suggestion: str = ""


class ContractRuleAnalysisCreate(BaseModel):
    contracts: List[ContractRuleAnalysisItemCreate]


class ContractRuleAnalysis(BaseModel):
    id: str
    rule_id: str
    contract_name: str
    issue_comment: str
    adjustment_suggestion: str
    created_at: datetime
    updated_at: datetime

class AIEmployeeBase(BaseModel):
    name: str
    status: str = "active"
    role_title: Optional[str] = None
    model: Optional[str] = None
    avatar_url: Optional[str] = None
    description: Optional[str] = None
    persona_prompt: Optional[str] = None
    tags: Optional[List[str]] = []
    access_scope: str = "org"
    access_teams: List[str] = Field(default_factory=list)
    version_group: Optional[str] = None
    source_employee_id: Optional[int] = None
    knowledge_ids: Optional[List[str]] = []
    database_ids: Optional[List[str]] = []
    tool_ids: Optional[List[str]] = []
    workflow_ids: Optional[List[str]] = []
    action_guide: Optional[Any] = None
    source_type: str = "native"
    dify_url: Optional[str] = None
    dify_api_key: Optional[str] = None
    dify_app_type: Optional[str] = None
    dify_metadata: Optional[Any] = None

class AIEmployeeUpdate(BaseModel):
    name: Optional[str] = None
    status: Optional[str] = None
    role_title: Optional[str] = None
    model: Optional[str] = None
    avatar_url: Optional[str] = None
    description: Optional[str] = None
    persona_prompt: Optional[str] = None
    access_scope: Optional[str] = None
    access_teams: Optional[List[str]] = None
    version_group: Optional[str] = None
    source_employee_id: Optional[int] = None
    knowledge_ids: Optional[List[str]] = None
    database_ids: Optional[List[str]] = None
    tool_ids: Optional[List[str]] = None
    workflow_ids: Optional[List[str]] = None
    action_guide: Optional[Any] = None
    source_type: Optional[str] = None
    dify_url: Optional[str] = None
    dify_api_key: Optional[str] = None
    dify_app_type: Optional[str] = None
    dify_metadata: Optional[Any] = None

class AIEmployeeCreate(AIEmployeeBase):
    pass

class AIEmployee(AIEmployeeBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True


class DifyConnectRequest(BaseModel):
    name: str
    role_title: Optional[str] = None
    description: Optional[str] = None
    avatar_url: Optional[str] = None
    tags: Optional[List[str]] = []
    dify_url: str
    dify_api_key: str
    dify_app_type: str = "chatflow"
    dify_metadata: Optional[Any] = None
    preset_inputs: Optional[Any] = None


class DifyConfigUpdateRequest(BaseModel):
    name: Optional[str] = None
    role_title: Optional[str] = None
    description: Optional[str] = None
    avatar_url: Optional[str] = None
    tags: Optional[List[str]] = []
    dify_url: Optional[str] = None
    dify_api_key: Optional[str] = None
    dify_app_type: Optional[str] = None
    dify_metadata: Optional[Any] = None
    preset_inputs: Optional[Any] = None


class DifyConnectionTestRequest(BaseModel):
    dify_url: str
    dify_api_key: str
    dify_app_type: Optional[str] = "chatflow"


class DifyConnectionTestResult(BaseModel):
    ok: bool
    message: str = ""
    latency_ms: Optional[int] = None
    app_name: Optional[str] = None
    app_type: Optional[str] = None
    inputs_schema: Optional[Any] = None
    error_code: Optional[str] = None
    details: Optional[Any] = None


class CarbonWorkerBase(BaseModel):
    name: str
    role: str
    email: str
    phone: Optional[str] = None
    status: str = "active"
    teams: List[str] = Field(default_factory=list)


class CarbonWorkerCreate(CarbonWorkerBase):
    pass


class CarbonWorkerUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    status: Optional[str] = None
    teams: Optional[List[str]] = None


class CarbonWorker(CarbonWorkerBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True


class AIEmployeeDraftGenerateRequest(BaseModel):
    user_description: str = ""


class AIEmployeeDraftGenerateResponse(BaseModel):
    name: str = ""
    role_title: str = ""
    description: str = ""
    persona_prompt: str = ""
    tool_ids: List[str] = Field(default_factory=list)


class AIEmployeeRecommendationRequest(BaseModel):
    task_content: str
    limit: int = 5


class AIEmployeeRecommendation(BaseModel):
    id: int
    name: str
    role_title: str = ""
    description: str = ""
    persona_prompt: str = ""
    access_scope: str = "org"
    tool_ids: List[str] = Field(default_factory=list)
    workflow_ids: List[str] = Field(default_factory=list)
    knowledge_ids: List[str] = Field(default_factory=list)
    score: int = 0
    matched_terms: List[str] = Field(default_factory=list)
    recommendation_reason: str = ""


class AIEmployeeRecommendationResponse(BaseModel):
    task_content: str
    count: int = 0
    recommendations: List[AIEmployeeRecommendation] = Field(default_factory=list)

class TaskProgressBase(BaseModel):
    task_name: str
    employee_id: int
    employee_name: str
    status: str
    chat_id: int
    total_steps: int = 0
    completed_steps: int = 0

class TaskProgressCreate(TaskProgressBase):
    pass

class TaskProgress(TaskProgressBase):
    id: int
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None

    class Config:
        orm_mode = True


class AutomationTaskBase(BaseModel):
    task_name: str
    task_type: str
    user_id: str
    task_content: str
    employee_id: str
    employee_source: Optional[str] = "personal_created"
    execute_rule: str
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None


class AutomationTaskCreate(AutomationTaskBase):
    pass


class AutomationTaskUpdate(BaseModel):
    task_name: Optional[str] = None
    task_type: Optional[str] = None
    user_id: Optional[str] = None
    task_content: Optional[str] = None
    employee_id: Optional[str] = None
    employee_source: Optional[str] = None
    execute_rule: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None


class AutomationTask(AutomationTaskBase):
    task_id: str
    next_execute_time: Optional[datetime] = None
    task_status: str
    executor_role: str
    last_execute_result: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True


class AutomationTaskStatusResponse(BaseModel):
    ok: bool = True
    task_id: str
    task_status: str
    next_execute_time: Optional[datetime] = None


class AutomationTaskExecutionBase(BaseModel):
    planned_execute_time: datetime
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    execute_status: str
    retry_count: int = 0
    trigger_type: str = "计划触发"
    result_summary: Optional[str] = None
    error_message: Optional[str] = None
    employee_id: Optional[str] = None
    employee_source: Optional[str] = None


class AutomationTaskExecutionCreate(AutomationTaskExecutionBase):
    pass


class AutomationTaskExecution(AutomationTaskExecutionBase):
    execution_id: str
    task_id: str
    task_type: str
    user_id: str
    executor_role: str
    result_is_read: bool = True
    created_at: datetime

    class Config:
        orm_mode = True


class AutomationTaskResultNotice(BaseModel):
    execution_id: str
    task_id: str
    task_name: str
    task_type: str
    execute_status: str
    result_text: str
    trigger_type: str
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    result_is_read: bool = True


class AutomationTaskResultSummary(BaseModel):
    unread_count: int = 0
    notices: List[AutomationTaskResultNotice] = Field(default_factory=list)


class AutomationTaskResultReadRequest(BaseModel):
    user_id: str
    employee_id: Optional[str] = None
    execution_ids: List[str] = Field(default_factory=list)

class ChatMessageBase(BaseModel):
    chat_id: int
    sender_role: str
    employee_id: Optional[int] = None
    content: str
    message_type: str = "text"
    meta_data: Optional[Any] = None

class ChatMessageCreate(ChatMessageBase):
    pass

class ChatMessage(ChatMessageBase):
    id: int
    created_at: datetime

    class Config:
        orm_mode = True


class GroupBase(BaseModel):
    name: str
    description: Optional[str] = None
    mode: str = "manual"


class GroupCreate(GroupBase):
    member_ids: List[int] = Field(default_factory=list)


class GroupUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    mode: Optional[str] = None
    member_ids: Optional[List[int]] = None


class Group(GroupBase):
    id: str
    created_at: datetime
    updated_at: datetime
    members: List[AIEmployee] = Field(default_factory=list)

    class Config:
        orm_mode = True

class TodoBase(BaseModel):
    chat_id: int
    title: str
    status: str = "pending"
    step_index: int

class TodoCreate(TodoBase):
    pass

class Todo(TodoBase):
    id: int
    created_at: datetime

    class Config:
        orm_mode = True


class MCPServerBase(BaseModel):
    server_key: Optional[str] = None
    name: str
    version: str = "1.0.0"
    description: Optional[str] = None
    source_type: str = "mcp"
    transport: str = "stdio"
    domain: str = "search"
    core_toolset: bool = False
    icon_url: Optional[str] = None
    config_json: Optional[Any] = None
    command: Optional[str] = None
    args: List[str] = Field(default_factory=list)
    env: dict = Field(default_factory=dict)
    url: Optional[str] = None
    headers: dict = Field(default_factory=dict)
    timeout_seconds: int = 30
    enabled: bool = True
    source: str = "custom"


class MCPServerCreate(MCPServerBase):
    pass


class MCPServerUpdate(BaseModel):
    server_key: Optional[str] = None
    name: Optional[str] = None
    version: Optional[str] = None
    description: Optional[str] = None
    source_type: Optional[str] = None
    transport: Optional[str] = None
    domain: Optional[str] = None
    core_toolset: Optional[bool] = None
    icon_url: Optional[str] = None
    config_json: Optional[Any] = None
    command: Optional[str] = None
    args: Optional[List[str]] = None
    env: Optional[dict] = None
    url: Optional[str] = None
    headers: Optional[dict] = None
    timeout_seconds: Optional[int] = None
    enabled: Optional[bool] = None
    source: Optional[str] = None


class MCPServer(MCPServerBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True


class OntologyDefinitionBase(BaseModel):
    id: str
    kind: str
    name: str
    enabled: bool = True
    definition_json: dict = Field(default_factory=dict)


class OntologyEventDefinitionConfig(BaseModel):
    subjectObjectTypeId: str
    triggerSource: Literal["business_action", "object_change", "external_event", "scheduled_check"]
    triggerConfig: dict = Field(default_factory=dict)

    @model_validator(mode="after")
    def validate_dynamic_config(self):
        config = self.triggerConfig
        if self.triggerSource == "business_action" and not (str(config.get("operation", "")).strip() and config.get("timing") in {"before_execute", "after_success"}):
            raise ValueError("Business action events require operation and timing")
        if self.triggerSource == "object_change":
            if config.get("changeType") not in {"created", "updated", "deleted", "field_changed"}:
                raise ValueError("Object change events require a valid changeType")
            if config.get("changeType") == "field_changed" and not config.get("propertyId"):
                raise ValueError("Field change events require propertyId")
        if self.triggerSource == "external_event" and not (
            str(config.get("sourceSystem", "")).strip()
            and config.get("integrationType") in {"webhook", "message_queue", "api"}
            and str(config.get("externalEventKey", "")).strip()
        ):
            raise ValueError("External events require sourceSystem, integrationType, and externalEventKey")
        if self.triggerSource == "scheduled_check" and int(config.get("intervalMinutes") or 0) <= 0:
            raise ValueError("Scheduled checks require a positive intervalMinutes")
        return self


class OntologyDefinitionCreate(OntologyDefinitionBase):
    pass


class OntologyDefinitionUpdate(BaseModel):
    name: Optional[str] = None
    enabled: Optional[bool] = None
    definition_json: Optional[dict] = None


class OntologyDefinition(OntologyDefinitionBase):
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class OntologyModelingProjectCreate(BaseModel):
    name: str
    domain: str
    goal: str
    owner: str
    terminology_owner: str
    datasource_ids: List[str] = Field(default_factory=list)
    modeling_mode: str = "blank"
    description: str = ""


class OntologyModelingProject(OntologyModelingProjectCreate):
    id: str
    status: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class OntologyModelingObjectCreate(BaseModel):
    name: str
    definition: str
    object_key: str
    owner: str
    lifecycle: str = "长期存在"


class OntologyModelingObject(OntologyModelingObjectCreate):
    id: str
    project_id: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class WorkflowStep(BaseModel):
    id: Optional[str] = None
    name: str
    step_type: str = "auto_step"
    skill_key: Optional[str] = None
    instructions: str = ""
    input_keys: List[str] = Field(default_factory=list)
    output_key: Optional[str] = None
    enabled: bool = True


class PlanStep(BaseModel):
    id: str
    title: str
    description: str = ""
    selected_skill_key: Optional[str] = None
    selected_skill_type: Optional[str] = None
    candidate_skill_keys: List[str] = Field(default_factory=list)
    status: str = "pending"


class ArtifactFile(BaseModel):
    id: str
    name: str
    title: Optional[str] = None
    relative_path: str
    format: str
    mime_type: str
    size_bytes: int = 0
    created_at: Optional[str] = None
    preview_text: str = ""


class WorkspaceFileContentResponse(BaseModel):
    name: str
    relative_path: str
    mime_type: str
    content: str


class AgentTurnRequest(BaseModel):
    chat_id: int
    user_message: str
    employee_id: Optional[int] = None
    group_id: Optional[str] = None
    auto_execute_direct: bool = True
    automation_setup: bool = False


class AgentTurnResponse(BaseModel):
    status: str = "completed"
    mode: str
    reasoning: str = ""
    employee_id: Optional[int] = None
    effective_user_request: str = ""
    selected_skills: List[str] = Field(default_factory=list)
    selected_skill_key: Optional[str] = None
    workflow_skill_key: Optional[str] = None
    workflow_skill_name: Optional[str] = None
    requires_user_input: bool = False
    clarifying_questions: List[str] = Field(default_factory=list)
    plan_steps: List[PlanStep] = Field(default_factory=list)
    plan: List[str] = Field(default_factory=list)
    workflow_run_id: Optional[int] = None
    workflow_run: Optional[dict] = None
    result: Optional[Any] = None
    automation_draft: Optional[Any] = None
    knowledge_hits: List[KnowledgeSearchHit] = Field(default_factory=list)
    artifacts: List[ArtifactFile] = Field(default_factory=list)


class QQMailConnectRequest(BaseModel):
    email: str
    authCode: str
    imapHost: Optional[str] = "imap.qq.com"
    imapPort: int = 993


class EmailAuthStartRequest(BaseModel):
    returnUrl: Optional[str] = "/connectors"


class EmailAuthStartResponse(BaseModel):
    provider: str
    sessionId: str
    authUrl: str


class EmailAuthCompleteRequest(BaseModel):
    sessionId: str
    email: Optional[str] = None


class EmailConnectionStatus(BaseModel):
    provider: str
    status: str = "disconnected"
    connected: bool = False
    email: Optional[str] = None
    maskedEmail: Optional[str] = None
    imapHost: Optional[str] = None
    imapPort: Optional[int] = None
    lastConnectedAt: Optional[str] = None
    lastCheckedAt: Optional[str] = None
    folderCount: int = 0


class EmailConnectionTestResult(BaseModel):
    provider: str = "qq-mail"
    ok: bool
    message: str
    email: Optional[str] = None
    maskedEmail: Optional[str] = None
    imapHost: Optional[str] = None
    imapPort: Optional[int] = None
    folderCount: int = 0


class SkillRegistryBase(BaseModel):
    skill_key: Optional[str] = None
    name: str
    description: Optional[str] = None
    icon: str = "tool"
    source: str = "custom"
    skill_type: str = "prompt"
    instructions: str = ""
    imported_from_package: bool = False
    package_session_id: Optional[str] = None
    config_json: Optional[Any] = Field(default_factory=dict)
    assets_manifest: List[dict] = Field(default_factory=list)
    capabilities: List[dict] = Field(default_factory=list)
    workflow_steps: List[WorkflowStep] = Field(default_factory=list)
    mcp_server_id: Optional[int] = None
    mcp_server_ids: List[int] = Field(default_factory=list)
    enabled: bool = True
    overwrite_existing: bool = False


class SkillRegistryCreate(SkillRegistryBase):
    pass


class SkillDraftGenerateRequest(BaseModel):
    user_description: str = ""
    workflow_description: str = ""
    skill_type: str = "workflow"


class SkillDraftGenerateResponse(BaseModel):
    name: str
    description: str = ""
    skill_type: str = "workflow"
    instructions: str = ""
    workflow_steps: List[WorkflowStep] = Field(default_factory=list)


class SkillInstructionsGenerateRequest(BaseModel):
    user_description: str = ""
    skill_type: str = "prompt"
    skill_name: str = ""
    skill_description: str = ""
    existing_instructions: str = ""


class SkillInstructionsGenerateResponse(BaseModel):
    instructions: str = ""


class SkillPackageImportResponse(BaseModel):
    skill_key: Optional[str] = None
    name: str
    description: str = ""
    skill_type: str = "prompt"
    instructions: str = ""
    imported_from_package: bool = True
    package_session_id: Optional[str] = None
    config_json: Optional[Any] = Field(default_factory=dict)
    assets_manifest: List[dict] = Field(default_factory=list)
    package_files: List[dict] = Field(default_factory=list)
    workflow_steps: List[WorkflowStep] = Field(default_factory=list)


class SkillAssetUploadResponse(BaseModel):
    package_session_id: str
    assets_manifest: List[dict] = Field(default_factory=list)


class SkillRegistryUpdate(BaseModel):
    skill_key: Optional[str] = None
    name: Optional[str] = None
    description: Optional[str] = None
    icon: Optional[str] = None
    source: Optional[str] = None
    skill_type: Optional[str] = None
    instructions: Optional[str] = None
    imported_from_package: Optional[bool] = None
    package_session_id: Optional[str] = None
    config_json: Optional[Any] = None
    assets_manifest: Optional[List[dict]] = None
    capabilities: Optional[List[dict]] = None
    workflow_steps: Optional[List[WorkflowStep]] = None
    mcp_server_id: Optional[int] = None
    mcp_server_ids: Optional[List[int]] = None
    enabled: Optional[bool] = None


class SkillRegistry(SkillRegistryBase):
    id: int
    created_at: datetime
    updated_at: datetime
    mcp_server: Optional[MCPServer] = None
    mcp_servers: List[MCPServer] = Field(default_factory=list)


class DebateSessionSummary(BaseModel):
    id: str
    chat_id: int
    group_id: Optional[str] = None
    group_name: Optional[str] = None
    topic: str
    status: str
    round_count: int = 2
    max_participants: int = 3
    participant_ids: List[int] = Field(default_factory=list)
    mentioned_member_ids: List[int] = Field(default_factory=list)
    result_summary: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class DebateSessionDetail(DebateSessionSummary):
    messages: List[ChatMessage] = Field(default_factory=list)

    class Config:
        orm_mode = True


class MCPServerTestResult(BaseModel):
    ok: bool
    message: str
    details: Optional[dict] = None


class ModelConnectionTestRequest(BaseModel):
    providerType: str
    modelName: str = ""
    apiEndpoint: str
    apiKey: str


class ModelConnectionTestResult(BaseModel):
    ok: bool
    message: str
    latency_ms: Optional[int] = None
    checked_at: datetime
    suggestion: Optional[str] = None
    error_code: Optional[str] = None
    details: Optional[dict] = None


class ModelConfigurationBase(BaseModel):
    modelName: str
    providerType: str
    apiEndpoint: str
    apiKey: str
    isPublic: bool = False


class ModelConfigurationCreate(ModelConfigurationBase):
    pass


class ModelConfigurationUpdate(BaseModel):
    modelName: Optional[str] = None
    providerType: Optional[str] = None
    apiEndpoint: Optional[str] = None
    apiKey: Optional[str] = None
    isPublic: Optional[bool] = None


class ModelConfiguration(ModelConfigurationBase):
    id: str
    createdAt: datetime
    updatedAt: datetime

    class Config:
        orm_mode = True


class ObjectTypeDocumentAnalysisRequest(BaseModel):
    document_name: str
    text: str


class ObjectTypeTextAnalysisRequest(BaseModel):
    text: str


class ObjectTypeTableAnalysisRequest(BaseModel):
    dataset_name: str
    sheet_name: str
    columns: List[dict] = Field(default_factory=list)


class ObjectTypeDocumentAnalysisResponse(BaseModel):
    objectType: dict
    properties: List[dict] = Field(default_factory=list)
    columnSemantics: List[dict] = Field(default_factory=list)
    instanceHints: List[dict] = Field(default_factory=list)
    titleProperty: Optional[str] = None
    confidence: float = 0.0
    evidence: List[str] = Field(default_factory=list)


class ObjectRelationshipInferenceRequest(BaseModel):
    currentObjectTypeId: Optional[str] = None
    objectTypes: List[dict] = Field(default_factory=list)
    properties: List[dict] = Field(default_factory=list)
    existingLinks: List[dict] = Field(default_factory=list)


class ObjectRelationshipInferenceResponse(BaseModel):
    suggestions: List[dict] = Field(default_factory=list)
    generatedBy: str = "ai"
    summary: Optional[str] = None


class OntologyObjectInstanceUpsert(BaseModel):
    id: Optional[str] = None
    objectTypeId: str
    primaryKey: str
    displayName: str
    properties: dict = Field(default_factory=dict)
    source: str = "manual"


class OntologyObjectInstanceBatchUpsert(BaseModel):
    objects: List[OntologyObjectInstanceUpsert] = Field(default_factory=list)


class OntologyLinkInstanceUpsert(BaseModel):
    id: Optional[str] = None
    linkTypeId: str
    sourceInstanceId: str
    targetInstanceId: str
    properties: dict = Field(default_factory=dict)
    source: str = "manual"


class OntologyLinkInstanceBatchUpsert(BaseModel):
    links: List[OntologyLinkInstanceUpsert] = Field(default_factory=list)


class OntologyTraversalRequest(BaseModel):
    startInstanceIds: List[str] = Field(min_length=1)
    maxHops: int = Field(default=1, ge=1, le=6)
    direction: str = "both"
    linkTypeIds: List[str] = Field(default_factory=list)
    limit: int = Field(default=500, ge=1, le=5000)


class OntologyTraversalResponse(BaseModel):
    nodes: List[dict] = Field(default_factory=list)
    links: List[dict] = Field(default_factory=list)
    maxDepthReached: int = 0
    truncated: bool = False


class WorkflowRunBase(BaseModel):
    chat_id: int
    employee_id: Optional[int] = None
    workflow_skill_key: str
    status: str = "pending"
    current_step_id: Optional[str] = None
    current_step_index: int = 0
    pause_reason: Optional[str] = None
    context_data: Optional[Any] = None


class WorkflowRunCreate(WorkflowRunBase):
    pass


class WorkflowRun(WorkflowRunBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True


class WorkflowStepRunBase(BaseModel):
    workflow_run_id: int
    step_id: str
    step_index: int = 0
    step_name: Optional[str] = None
    step_type: str = "auto_step"
    status: str = "pending"
    input_data: Optional[Any] = None
    output_data: Optional[Any] = None
    pause_payload: Optional[Any] = None


class WorkflowStepRunCreate(WorkflowStepRunBase):
    pass


class WorkflowStepRun(WorkflowStepRunBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True


class WorkflowRunStartRequest(BaseModel):
    chat_id: int
    workflow_skill_key: str
    employee_id: Optional[int] = None
    user_message: str = ""


class WorkflowRunResumeRequest(BaseModel):
    user_input: str = ""
    approved: Optional[bool] = None
    feedback: str = ""


class WorkflowRunResponse(BaseModel):
    id: int
    chat_id: int
    employee_id: Optional[int] = None
    workflow_skill_key: str
    workflow_name: str
    status: str
    current_step_id: Optional[str] = None
    current_step_index: Optional[int] = None
    pause_reason: Optional[str] = None
    context_data: dict = Field(default_factory=dict)
    current_step: Optional[dict] = None
    steps: List[dict] = Field(default_factory=list)
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
