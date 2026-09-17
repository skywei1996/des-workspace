from sqlalchemy import Column, Integer, String, Text, DateTime, JSON, ForeignKey, Index, UniqueConstraint, LargeBinary
from sqlalchemy.orm import relationship
from datetime import datetime
from .database import Base


class KnowledgeBase(Base):
    __tablename__ = "knowledge_bases"

    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False, index=True)
    description = Column(Text, default="")
    date = Column(String)
    enabled = Column(Integer, default=1)
    status = Column(Integer, default=1)
    type = Column(String, default="text")
    teams = Column(JSON)
    remote_provider = Column(String, default="volcengine")
    remote_resource_id = Column(String, nullable=True, index=True)
    local_display_name = Column(String, nullable=True)
    remote_host = Column(String, nullable=True)
    remote_project = Column(String, nullable=True)
    remote_collection_name = Column(String, nullable=True)
    sync_status = Column(String, default="pending")
    sync_error = Column(Text, nullable=True)
    sync_info = Column(JSON)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    documents = relationship(
        "KnowledgeDocument",
        back_populates="knowledge_base",
        cascade="all, delete-orphan",
        order_by="KnowledgeDocument.updated_at.desc()",
    )


class KnowledgeDocument(Base):
    __tablename__ = "knowledge_documents"

    id = Column(String, primary_key=True, index=True)
    knowledge_base_id = Column(String, ForeignKey("knowledge_bases.id"), nullable=False, index=True)
    remote_doc_id = Column(String, nullable=True, index=True)
    name = Column(String, nullable=False)
    file_type = Column(String, default="TXT")
    updated_at_display = Column(String, nullable=True)
    status = Column(String, default="pending")
    summary = Column(Text, default="")
    chunks = Column(JSON)
    source_url = Column(String, nullable=True)
    size_bytes = Column(Integer, default=0)
    remote_meta = Column(JSON)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    knowledge_base = relationship("KnowledgeBase", back_populates="documents")

class AIEmployee(Base):
    __tablename__ = "ai_employees"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    status = Column(String, default="active")
    role_title = Column(String)
    model = Column(String)
    avatar_url = Column(String)
    description = Column(Text)
    persona_prompt = Column(Text)
    tags = Column(JSON)
    access_scope = Column(String, default="org")
    access_teams = Column(JSON)
    version_group = Column(String, index=True)
    source_employee_id = Column(Integer, ForeignKey("ai_employees.id"), nullable=True)
    knowledge_ids = Column(JSON)
    database_ids = Column(JSON)
    tool_ids = Column(JSON)
    workflow_ids = Column(JSON)
    action_guide = Column(JSON)
    source_type = Column(String, default="native")
    dify_url = Column(String, nullable=True)
    dify_api_key = Column(String, nullable=True)
    dify_app_type = Column(String, nullable=True)
    dify_metadata = Column(JSON)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)


class ModelConfiguration(Base):
    __tablename__ = "model_configurations"

    id = Column(String, primary_key=True, index=True)
    model_name = Column(String, nullable=False, unique=True, index=True)
    provider_type = Column(String, nullable=False)
    api_endpoint = Column(String, nullable=False)
    api_key = Column(String, nullable=False)
    is_public = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)


class CarbonWorker(Base):
    __tablename__ = "carbon_workers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, index=True)
    role = Column(String, nullable=False)
    email = Column(String, nullable=False, unique=True, index=True)
    phone = Column(String)
    status = Column(String, default="active")
    teams = Column(JSON)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)


class Group(Base):
    __tablename__ = "groups"

    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False, index=True)
    description = Column(Text)
    mode = Column(String, default="manual")
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    members = relationship("GroupMember", back_populates="group", cascade="all, delete-orphan", order_by="GroupMember.id")


class GroupMember(Base):
    __tablename__ = "group_members"

    id = Column(Integer, primary_key=True, index=True)
    group_id = Column(String, ForeignKey("groups.id"), index=True, nullable=False)
    employee_id = Column(Integer, ForeignKey("ai_employees.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.now)

    group = relationship("Group", back_populates="members")
    employee = relationship("AIEmployee")


class ContractRuleGroup(Base):
    __tablename__ = "contract_rule_groups"

    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False, unique=True, index=True)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    rules = relationship(
        "ContractReviewRule",
        back_populates="group",
        cascade="all, delete-orphan",
        order_by="ContractReviewRule.created_at.desc()",
    )


class ContractReviewRule(Base):
    __tablename__ = "contract_review_rules"

    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False, index=True)
    risk = Column(String, nullable=False, default="高风险")
    description = Column(Text, nullable=False, default="")
    source = Column(String, default="智能")
    group_id = Column(String, ForeignKey("contract_rule_groups.id"), nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    group = relationship("ContractRuleGroup", back_populates="rules")
    analyses = relationship(
        "ContractRuleAnalysis",
        back_populates="rule",
        cascade="all, delete-orphan",
        order_by="ContractRuleAnalysis.created_at.desc()",
    )


class ContractRuleAnalysis(Base):
    __tablename__ = "contract_rule_analyses"

    id = Column(String, primary_key=True, index=True)
    rule_id = Column(String, ForeignKey("contract_review_rules.id"), nullable=False, index=True)
    contract_name = Column(String, nullable=False)
    issue_comment = Column(Text, nullable=False, default="")
    adjustment_suggestion = Column(Text, nullable=False, default="")
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    rule = relationship("ContractReviewRule", back_populates="analyses")


class DebateSession(Base):
    __tablename__ = "debate_sessions"

    id = Column(String, primary_key=True, index=True)
    chat_id = Column(Integer, index=True, nullable=False)
    group_id = Column(String, ForeignKey("groups.id"), index=True, nullable=True)
    topic = Column(Text, nullable=False)
    status = Column(String, default="running")
    round_count = Column(Integer, default=2)
    max_participants = Column(Integer, default=3)
    participant_ids = Column(JSON)
    mentioned_member_ids = Column(JSON)
    result_summary = Column(Text)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    group = relationship("Group")


class MCPServer(Base):
    __tablename__ = "mcp_servers"

    id = Column(Integer, primary_key=True, index=True)
    server_key = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    version = Column(String, nullable=False, default="1.0.0")
    description = Column(Text)
    source_type = Column(String, nullable=False, default="mcp")
    transport = Column(String, nullable=False, default="stdio")
    domain = Column(String, nullable=False, default="search")
    core_toolset = Column(Integer, default=0)
    icon_url = Column(String)
    config_json = Column(JSON)
    command = Column(String)
    args = Column(JSON)
    env = Column(JSON)
    url = Column(String)
    headers = Column(JSON)
    timeout_seconds = Column(Integer, default=30)
    enabled = Column(Integer, default=1)
    source = Column(String, default="custom")
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)


class OntologyDefinition(Base):
    __tablename__ = "ontology_definitions"

    id = Column(String, primary_key=True, index=True)
    kind = Column(String, nullable=False, index=True)
    name = Column(String, nullable=False, index=True)
    enabled = Column(Integer, default=1)
    definition_json = Column(JSON, nullable=False, default=dict)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)


class Dataset(Base):
    __tablename__ = "datasets"

    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False, index=True)
    size = Column(Integer, nullable=False)
    content_type = Column(String, nullable=False, default="application/octet-stream")
    extension = Column(String, nullable=False, default="")
    content = Column(LargeBinary, nullable=False)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)


class OntologyDesignCollection(Base):
    __tablename__ = "ontology_design_collections"

    key = Column(String, primary_key=True, index=True)
    items_json = Column(JSON, nullable=False, default=list)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)


class OntologyModelingProject(Base):
    __tablename__ = "ontology_modeling_projects"

    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False, index=True)
    domain = Column(String, nullable=False, index=True)
    goal = Column(Text, nullable=False)
    owner = Column(String, nullable=False)
    terminology_owner = Column(String, nullable=False)
    datasource_ids = Column(JSON, nullable=False, default=list)
    modeling_mode = Column(String, nullable=False, default="blank")
    description = Column(Text, default="")
    status = Column(String, nullable=False, default="draft")
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)


class OntologyModelingObject(Base):
    __tablename__ = "ontology_modeling_objects"
    __table_args__ = (
        UniqueConstraint("project_id", "object_key", name="uq_ontology_modeling_object_key"),
    )

    id = Column(String, primary_key=True, index=True)
    project_id = Column(String, ForeignKey("ontology_modeling_projects.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String, nullable=False, index=True)
    definition = Column(Text, nullable=False)
    object_key = Column(String, nullable=False)
    owner = Column(String, nullable=False)
    lifecycle = Column(String, nullable=False, default="长期存在")
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)


class OntologyModelingProperty(Base):
    __tablename__ = "ontology_modeling_project_properties"

    id = Column(String, primary_key=True, index=True)
    project_id = Column(String, ForeignKey("ontology_modeling_projects.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String, nullable=False)
    api_name = Column(String, nullable=False, default="")
    object_ids = Column(JSON, nullable=False, default=list)
    data_type = Column(String, nullable=False, default="文本")
    description = Column(Text, default="")
    source = Column(String, default="")
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)


class OntologyModelingMapping(Base):
    __tablename__ = "ontology_modeling_mappings"
    __table_args__ = (
        UniqueConstraint("project_id", "object_id", name="uq_ontology_modeling_mapping_object"),
    )

    id = Column(String, primary_key=True, index=True)
    project_id = Column(String, ForeignKey("ontology_modeling_projects.id", ondelete="CASCADE"), nullable=False, index=True)
    object_id = Column(String, ForeignKey("ontology_modeling_objects.id", ondelete="CASCADE"), nullable=False, index=True)
    dataset_id = Column(String, nullable=False, default="")
    dataset_name = Column(String, nullable=False, default="")
    dataset_version = Column(String, nullable=False, default="")
    sheet_name = Column(String, nullable=False, default="")
    primary_key_property_ids = Column(JSON, nullable=False, default=list)
    field_mappings = Column(JSON, nullable=False, default=list)
    validation_json = Column(JSON, nullable=False, default=dict)
    status = Column(String, nullable=False, default="draft")
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)


class ReplenishmentInventoryAdjustment(Base):
    __tablename__ = "replenishment_inventory_adjustments"
    __table_args__ = (
        UniqueConstraint("request_id", "store_id", "sku_id", name="uq_replenishment_adjustment_request_item"),
    )

    id = Column(String, primary_key=True, index=True)
    request_id = Column(String, nullable=False, index=True)
    project_id = Column(String, nullable=False, index=True)
    store_id = Column(String, nullable=False, index=True)
    sku_id = Column(String, nullable=False, index=True)
    direction = Column(String, nullable=False)
    quantity = Column(Integer, nullable=False)
    quantity_delta = Column(Integer, nullable=False)
    approval_required = Column(Integer, nullable=False, default=0)
    approval_status = Column(String, nullable=False, default="not_required")
    initiated_by = Column(String, nullable=False, default="")
    approved_by = Column(String, nullable=False, default="")
    created_at = Column(DateTime, default=datetime.now)


class SkillRegistryEntry(Base):
    __tablename__ = "skill_registry_entries"

    id = Column(Integer, primary_key=True, index=True)
    skill_key = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    description = Column(Text)
    icon = Column(String, default="tool")
    source = Column(String, default="custom")
    skill_type = Column(String, default="prompt")
    instructions = Column(Text)
    imported_from_package = Column(Integer, default=0)
    config_json = Column(JSON)
    assets_manifest = Column(JSON)
    capabilities = Column(JSON)
    workflow_steps = Column(JSON)
    mcp_server_id = Column(Integer, ForeignKey("mcp_servers.id"), nullable=True)
    mcp_server_ids = Column(JSON)
    enabled = Column(Integer, default=1)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    mcp_server = relationship("MCPServer")


class WorkflowRun(Base):
    __tablename__ = "workflow_runs"

    id = Column(Integer, primary_key=True, index=True)
    chat_id = Column(Integer, index=True)
    employee_id = Column(Integer, ForeignKey("ai_employees.id"), nullable=True)
    workflow_skill_key = Column(String, index=True, nullable=False)
    status = Column(String, default="pending")
    current_step_id = Column(String)
    current_step_index = Column(Integer, default=0)
    pause_reason = Column(String)
    context_data = Column(JSON)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)


class WorkflowStepRun(Base):
    __tablename__ = "workflow_step_runs"

    id = Column(Integer, primary_key=True, index=True)
    workflow_run_id = Column(Integer, ForeignKey("workflow_runs.id"), nullable=False)
    step_id = Column(String, nullable=False)
    step_index = Column(Integer, default=0)
    step_name = Column(String)
    step_type = Column(String, default="auto_step")
    status = Column(String, default="pending")
    input_data = Column(JSON)
    output_data = Column(JSON)
    pause_payload = Column(JSON)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)


class OntologyObjectInstance(Base):
    __tablename__ = "ontology_object_instances"
    __table_args__ = (
        UniqueConstraint("object_type_id", "primary_key", name="uq_ontology_object_identity"),
        Index("ix_ontology_object_type_display", "object_type_id", "display_name"),
    )

    id = Column(String, primary_key=True, index=True)
    object_type_id = Column(String, nullable=False, index=True)
    primary_key = Column(String, nullable=False)
    display_name = Column(String, nullable=False, index=True)
    properties = Column(JSON, default=dict)
    source = Column(String, default="manual")
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)


class OntologyLinkInstance(Base):
    __tablename__ = "ontology_link_instances"
    __table_args__ = (
        UniqueConstraint(
            "link_type_id",
            "source_instance_id",
            "target_instance_id",
            name="uq_ontology_link_identity",
        ),
        Index("ix_ontology_link_source_type", "source_instance_id", "link_type_id"),
        Index("ix_ontology_link_target_type", "target_instance_id", "link_type_id"),
    )

    id = Column(String, primary_key=True, index=True)
    link_type_id = Column(String, nullable=False, index=True)
    source_instance_id = Column(
        String,
        ForeignKey("ontology_object_instances.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    target_instance_id = Column(
        String,
        ForeignKey("ontology_object_instances.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    properties = Column(JSON, default=dict)
    source = Column(String, default="manual")
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

class TaskProgress(Base):
    __tablename__ = "task_progress"
    id = Column(Integer, primary_key=True, index=True)
    task_name = Column(String)
    employee_id = Column(Integer, ForeignKey("ai_employees.id"))
    employee_name = Column(String)
    status = Column(String) # pending, in-progress, completed, abnormal
    start_time = Column(DateTime)
    end_time = Column(DateTime)
    chat_id = Column(Integer)
    total_steps = Column(Integer, default=0)
    completed_steps = Column(Integer, default=0)

class ChatMessage(Base):
    __tablename__ = "chat_messages"
    id = Column(Integer, primary_key=True, index=True)
    chat_id = Column(Integer, index=True)
    sender_role = Column(String) # user, assistant
    employee_id = Column(Integer, ForeignKey("ai_employees.id"), nullable=True)
    content = Column(Text)
    message_type = Column(String, default="text")
    meta_data = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.now)


class ChatSession(Base):
    __tablename__ = "chat_sessions"

    chat_id = Column(Integer, primary_key=True, index=True)
    session_type = Column(String, nullable=False, default="member")
    title = Column(String, nullable=False, default="Aria")
    summary = Column(Text, nullable=False, default="打开了会话")
    active_member = Column(String, nullable=True, index=True)
    group_id = Column(String, nullable=True, index=True)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now, index=True)


class Todo(Base):
    __tablename__ = "todos"
    id = Column(Integer, primary_key=True, index=True)
    chat_id = Column(Integer, index=True)
    title = Column(String)
    status = Column(String, default="pending")
    step_index = Column(Integer)
    created_at = Column(DateTime, default=datetime.now)

class Task(Base):
    __tablename__ = "tasks"

    task_id = Column(String, primary_key=True, index=True)
    task_name = Column(String, nullable=False)
    task_type = Column(String, nullable=False)
    user_id = Column(String, index=True)
    task_content = Column(Text, nullable=False)
    employee_id = Column(String, nullable=False)
    employee_source = Column(String)
    execute_rule = Column(String)
    start_time = Column(DateTime, nullable=True)
    end_time = Column(DateTime, nullable=True)
    next_execute_time = Column(DateTime, nullable=True)
    task_status = Column(String, default="启用")
    executor_role = Column(String, default="digital_employee")
    last_execute_result = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)


class TaskExecution(Base):
    __tablename__ = "task_executions"

    execution_id = Column(String, primary_key=True, index=True)
    task_id = Column(String, index=True)
    task_type = Column(String)
    user_id = Column(String, index=True)
    employee_id = Column(String)
    employee_source = Column(String)
    planned_execute_time = Column(DateTime)
    start_time = Column(DateTime, nullable=True)
    end_time = Column(DateTime, nullable=True)
    execute_status = Column(String)
    retry_count = Column(Integer, default=0)
    trigger_type = Column(String)
    executor_role = Column(String, default="digital_employee")
    result_summary = Column(Text, nullable=True)
    error_message = Column(Text, nullable=True)
    result_is_read = Column(Integer, default=1)
    created_at = Column(DateTime, default=datetime.now)
