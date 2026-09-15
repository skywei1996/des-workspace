import re
import time
import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from urllib.parse import urljoin, urlparse
from uuid import uuid4
from .. import models, schemas, database
from ..services.skill_generator import generate_employee_draft
from ..services.skill_registry import list_skills
from ..services.skill_registry import validate_tool_ids


VALID_EMPLOYEE_STATUSES = {"training", "active", "archived"}
VALID_ACCESS_SCOPES = {"org", "team", "personal"}
SEMANTIC_CONCEPT_ALIASES = {
    "英语学习": [
        "英语",
        "英文",
        "口语",
        "语法",
        "词汇",
        "单词",
        "音标",
        "例句",
        "翻译",
        "听说读写",
        "表达优化",
    ],
    "写作表达": ["写作", "改写", "润色", "文案", "表达", "表达优化"],
    "设计创意": ["设计", "海报", "视觉", "封面", "素材", "品牌", "创意"],
    "数据分析": ["分析", "数据", "报告", "总结", "洞察", "复盘"],
    "办公协同": ["钉钉", "日志", "日报", "周报", "日程", "会议", "待办"],
    "交通出行": ["交通", "路线", "导航", "出行", "拥堵", "公交"],
}


def _expand_recommendation_term_variants(term: str) -> set[str]:
    variants = {term}
    if re.fullmatch(r"[\u4e00-\u9fff]+", term) and len(term) >= 4:
        max_window = min(4, len(term))
        for window in range(2, max_window + 1):
            for start in range(0, len(term) - window + 1):
                variants.add(term[start : start + window])
    return variants


def _build_recommendation_term_set(text: str) -> set[str]:
    return set(_tokenize_recommendation_text(text))


def _build_recommendation_variant_set(text: str) -> set[str]:
    terms: set[str] = set()
    for term in _tokenize_recommendation_text(text):
        terms.update(_expand_recommendation_term_variants(term))
    return {term for term in terms if len(term) >= 2}


def _extract_semantic_concepts(terms: set[str]) -> set[str]:
    concepts: set[str] = set()
    for concept, aliases in SEMANTIC_CONCEPT_ALIASES.items():
        if any(alias in terms for alias in aliases):
            concepts.add(concept)
    return concepts


def _tokenize_recommendation_text(text: str) -> list[str]:
    raw_terms = []
    for segment in re.split(r"[\s,，。；;、:\n\t]+", text or ""):
        normalized_segment = segment.strip().lower()
        if not normalized_segment:
            continue
        raw_terms.extend(re.findall(r"[a-z0-9]+|[\u4e00-\u9fff]{2,}", normalized_segment) or [normalized_segment])

    deduped_terms: list[str] = []
    seen: set[str] = set()
    for term in raw_terms:
        if len(term) < 2 or term in seen:
            continue
        seen.add(term)
        deduped_terms.append(term)
    return deduped_terms


def _build_employee_search_text(employee: models.AIEmployee) -> str:
    return " ".join(
        str(value or "")
        for value in [
            employee.name,
            employee.role_title,
            employee.description,
            employee.persona_prompt,
            " ".join(employee.tool_ids or []),
            " ".join(employee.workflow_ids or []),
            " ".join(employee.knowledge_ids or []),
        ]
    ).lower()


def _score_employee_recommendation(employee: models.AIEmployee, task_content: str) -> tuple[int, list[str]]:
    employee_terms = _build_recommendation_term_set(_build_employee_search_text(employee))
    task_terms = _build_recommendation_term_set(task_content)
    employee_variants = _build_recommendation_variant_set(_build_employee_search_text(employee))
    task_variants = _build_recommendation_variant_set(task_content)
    matched_terms: list[str] = []
    score = 0

    direct_matches = [term for term in task_terms if term in employee_terms]
    concept_matches = sorted(_extract_semantic_concepts(task_variants) & _extract_semantic_concepts(employee_variants))

    for term in sorted(direct_matches, key=lambda item: (-len(item), item)):
        matched_terms.append(term)
        score += 3

    for concept in concept_matches:
        if concept not in matched_terms:
            matched_terms.append(concept)
        score += 4

    score += min(len(employee.tool_ids or []), 3)
    score += min(len(employee.workflow_ids or []), 2)
    score += min(len(employee.knowledge_ids or []), 2)

    if employee.status == "active":
        score += 2
    if employee.access_scope == "personal":
        score += 1

    return score, matched_terms


def _build_employee_capability_labels(employee: models.AIEmployee) -> list[str]:
    employee_variants = _build_recommendation_variant_set(_build_employee_search_text(employee))
    concept_labels = sorted(_extract_semantic_concepts(employee_variants))
    if concept_labels:
        return concept_labels[:4]

    raw_labels = _tokenize_recommendation_text(
        " ".join(
            [
                str(employee.name or ""),
                str(employee.role_title or ""),
                str(employee.description or ""),
            ]
        )
    )
    fallback_labels: list[str] = []
    for label in raw_labels:
        if label in fallback_labels:
            continue
        fallback_labels.append(label)
        if len(fallback_labels) >= 4:
            break
    return fallback_labels


def _build_recommendation_reason(employee: models.AIEmployee, matched_terms: list[str]) -> str:
    capability_bits = []
    if employee.tool_ids:
        capability_bits.append(f"{len(employee.tool_ids)} 个工具")
    if employee.workflow_ids:
        capability_bits.append(f"{len(employee.workflow_ids)} 个工作流")
    if employee.knowledge_ids:
        capability_bits.append(f"{len(employee.knowledge_ids)} 个知识库")

    capability_labels = _build_employee_capability_labels(employee)
    if capability_labels:
        return f"推荐原因：擅长领域 {"、".join(capability_labels)}；可用能力：{'、'.join(capability_bits) or '基础执行能力'}。"

    if matched_terms:
        return f"推荐原因：适合处理{'、'.join(matched_terms[:4])}相关任务；可用能力：{'、'.join(capability_bits) or '基础执行能力'}。"

    return f"推荐原因：基于角色描述与可用能力适配当前任务；可用能力：{'、'.join(capability_bits) or '基础执行能力'}。"


def _normalize_employee_payload(payload: dict, db: Session, current: models.AIEmployee | None = None) -> dict:
    normalized = dict(payload)

    try:
        normalized["tool_ids"] = validate_tool_ids(normalized.get("tool_ids"), db)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    status = str(normalized.get("status") or (current.status if current else "active")).strip().lower()
    if status not in VALID_EMPLOYEE_STATUSES:
        raise HTTPException(status_code=400, detail=f"Unsupported employee status: {status}")
    normalized["status"] = status

    access_scope = str(normalized.get("access_scope") or (current.access_scope if current else "org")).strip().lower()
    if access_scope not in VALID_ACCESS_SCOPES:
        raise HTTPException(status_code=400, detail=f"Unsupported access_scope: {access_scope}")
    normalized["access_scope"] = access_scope

    access_teams = normalized.get("access_teams")
    if access_teams is None:
        access_teams = list(getattr(current, "access_teams", None) or []) if current else []
    normalized["access_teams"] = [str(team).strip() for team in access_teams if str(team).strip()]

    source_employee_id = normalized.get("source_employee_id")
    if source_employee_id in (None, ""):
        source_employee_id = getattr(current, "source_employee_id", None) if current else None
    normalized["source_employee_id"] = source_employee_id

    version_group = normalized.get("version_group") or (current.version_group if current else None)
    if source_employee_id and not version_group:
        source_employee = db.query(models.AIEmployee).filter(models.AIEmployee.id == source_employee_id).first()
        version_group = source_employee.version_group if source_employee and source_employee.version_group else f"employee-{source_employee_id}"
    normalized["version_group"] = version_group or f"employee-{uuid4().hex[:12]}"

    normalized["knowledge_ids"] = list(normalized.get("knowledge_ids") or [])
    normalized["database_ids"] = list(normalized.get("database_ids") or [])
    normalized["workflow_ids"] = list(normalized.get("workflow_ids") or [])
    return normalized


def _archive_source_employee_if_needed(employee: models.AIEmployee, db: Session) -> None:
    if employee.status != "active" or not employee.source_employee_id:
        return

    source_employee = db.query(models.AIEmployee).filter(models.AIEmployee.id == employee.source_employee_id).first()
    if source_employee and source_employee.id != employee.id and source_employee.status != "archived":
        source_employee.status = "archived"

router = APIRouter(
    prefix="/ai-employees",
    tags=["ai-employees"],
    responses={404: {"description": "Not found"}},
)


@router.post("/generate-draft", response_model=schemas.AIEmployeeDraftGenerateResponse)
def generate_employee_config_draft(payload: schemas.AIEmployeeDraftGenerateRequest, db: Session = Depends(database.get_db)):
    user_description = (payload.user_description or "").strip()
    if len(user_description) < 10:
        raise HTTPException(status_code=400, detail="Please provide a more detailed employee description")

    reusable_skills = [
        skill
        for skill in list_skills(db)
        if skill.get("skill_type") != "workflow" and skill.get("enabled", True)
    ]

    try:
        generated = generate_employee_draft(user_description, reusable_skills)
        tool_ids = validate_tool_ids(generated.get("tool_ids"), db)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to generate employee draft: {exc}") from exc

    return schemas.AIEmployeeDraftGenerateResponse(
        name=(generated.get("name") or "").strip(),
        role_title=(generated.get("role_title") or "").strip(),
        description=(generated.get("description") or "").strip(),
        persona_prompt=(generated.get("persona_prompt") or "").strip(),
        tool_ids=tool_ids,
    )


@router.post("/recommendations", response_model=schemas.AIEmployeeRecommendationResponse)
def recommend_employees(payload: schemas.AIEmployeeRecommendationRequest, db: Session = Depends(database.get_db)):
    task_content = (payload.task_content or "").strip()
    if len(task_content) < 2:
        return schemas.AIEmployeeRecommendationResponse(task_content=task_content, count=0, recommendations=[])

    limit = min(max(payload.limit, 1), 10)
    employees = (
        db.query(models.AIEmployee)
        .filter(models.AIEmployee.status == "active")
        .order_by(models.AIEmployee.updated_at.desc())
        .all()
    )

    scored_recommendations = []
    for employee in employees:
        score, matched_terms = _score_employee_recommendation(employee, task_content)
        if score <= 0:
            continue
        scored_recommendations.append(
            schemas.AIEmployeeRecommendation(
                id=employee.id,
                name=employee.name or f"数字员工 {employee.id}",
                role_title=employee.role_title or "",
                description=employee.description or "",
                persona_prompt=employee.persona_prompt or "",
                access_scope=employee.access_scope or "org",
                tool_ids=list(employee.tool_ids or []),
                workflow_ids=list(employee.workflow_ids or []),
                knowledge_ids=list(employee.knowledge_ids or []),
                score=score,
                matched_terms=matched_terms,
                recommendation_reason=_build_recommendation_reason(employee, matched_terms),
            )
        )

    recommendations = sorted(
        scored_recommendations,
        key=lambda item: (-item.score, -len(item.matched_terms), item.name.lower()),
    )[:limit]

    return schemas.AIEmployeeRecommendationResponse(
        task_content=task_content,
        count=len(recommendations),
        recommendations=recommendations,
    )

@router.post("/", response_model=schemas.AIEmployee)
def create_employee(employee: schemas.AIEmployeeCreate, db: Session = Depends(database.get_db)):
    payload = _normalize_employee_payload(employee.dict(), db)

    db_employee = models.AIEmployee(**payload)
    db.add(db_employee)
    db.commit()
    _archive_source_employee_if_needed(db_employee, db)
    db.commit()
    db.refresh(db_employee)
    return db_employee

@router.get("/", response_model=List[schemas.AIEmployee])
def read_employees(skip: int = 0, limit: int = 100, db: Session = Depends(database.get_db)):
    employees = db.query(models.AIEmployee).order_by(models.AIEmployee.updated_at.desc()).offset(skip).limit(limit).all()
    return employees

@router.get("/{employee_id}", response_model=schemas.AIEmployee)
def read_employee(employee_id: int, db: Session = Depends(database.get_db)):
    db_employee = db.query(models.AIEmployee).filter(models.AIEmployee.id == employee_id).first()
    if db_employee is None:
        raise HTTPException(status_code=404, detail="Employee not found")
    return db_employee

@router.put("/{employee_id}", response_model=schemas.AIEmployee)
def update_employee(employee_id: int, employee: schemas.AIEmployeeUpdate, db: Session = Depends(database.get_db)):
    db_employee = db.query(models.AIEmployee).filter(models.AIEmployee.id == employee_id).first()
    if db_employee is None:
        raise HTTPException(status_code=404, detail="Employee not found")

    updates = _normalize_employee_payload(employee.dict(exclude_unset=True), db, current=db_employee)

    for key, value in updates.items():
        setattr(db_employee, key, value)

    db.commit()
    _archive_source_employee_if_needed(db_employee, db)
    db.commit()
    db.refresh(db_employee)
    return db_employee

@router.delete("/{employee_id}")
def delete_employee(employee_id: int, db: Session = Depends(database.get_db)):
    db_employee = db.query(models.AIEmployee).filter(models.AIEmployee.id == employee_id).first()
    if db_employee is None:
        raise HTTPException(status_code=404, detail="Employee not found")

    workflow_run_ids = [
        workflow_run_id
        for (workflow_run_id,) in (
            db.query(models.WorkflowRun.id)
            .filter(models.WorkflowRun.employee_id == employee_id)
            .all()
        )
    ]
    if workflow_run_ids:
        db.query(models.WorkflowStepRun).filter(models.WorkflowStepRun.workflow_run_id.in_(workflow_run_ids)).delete(synchronize_session=False)

    db.query(models.GroupMember).filter(models.GroupMember.employee_id == employee_id).delete(synchronize_session=False)
    db.query(models.WorkflowRun).filter(models.WorkflowRun.employee_id == employee_id).delete(synchronize_session=False)
    db.query(models.TaskProgress).filter(models.TaskProgress.employee_id == employee_id).delete(synchronize_session=False)
    db.query(models.ChatMessage).filter(models.ChatMessage.employee_id == employee_id).update(
        {models.ChatMessage.employee_id: None},
        synchronize_session=False,
    )

    db.delete(db_employee)
    db.commit()
    return {"ok": True, "employee_id": employee_id}


VALID_DIFY_APP_TYPES = {"chatflow", "workflow", "agent", "chatbot", "completion"}


def _normalize_dify_base_url(raw_url: str) -> str:
    raw = (raw_url or "").strip()
    if not raw:
        return raw
    if not raw.startswith("http://") and not raw.startswith("https://"):
        raw = "https://" + raw
    parsed = urlparse(raw)
    return f"{parsed.scheme}://{parsed.netloc}".rstrip("/")


# ---- Demo/Prototype mock data (used when real Dify service is unreachable) ----
_MOCK_DIFY_APP_NAME = "Dify Demo 应用"
_MOCK_DIFY_APP_TYPE = "chatflow"
_MOCK_DIFY_INPUTS_SCHEMA = [
    {"label": "员工姓名", "variable": "name", "type": "text-input", "required": True, "max_length": 48, "default": ""},
    {"label": "邮箱地址", "variable": "email", "type": "text-input", "required": False, "default": ""},
    {"label": "所属部门", "variable": "department", "type": "select", "required": True,
     "options": [{"value": "tech", "label": "技术部"}, {"value": "marketing", "label": "市场部"},
                 {"value": "sales", "label": "销售部"}, {"value": "hr", "label": "人事部"}], "default": "tech"},
    {"label": "工作经验描述", "variable": "experience", "type": "paragraph", "required": False, "default": ""},
    {"label": "工作年限", "variable": "years", "type": "number", "required": False, "default": 3},
]


async def _probe_dify_app(
    base_url: str,
    api_key: str,
    app_type: str = "chatflow",
    timeout: float = 10.0,
) -> schemas.DifyConnectionTestResult:
    normalized = _normalize_dify_base_url(base_url)
    if not normalized:
        return schemas.DifyConnectionTestResult(
            ok=False,
            message="Dify 服务地址不能为空",
            error_code="empty_url",
        )
    if not api_key:
        return schemas.DifyConnectionTestResult(
            ok=False,
            message="API Key 不能为空",
            error_code="empty_api_key",
        )
    safe_app_type = (app_type or "chatflow").lower()
    if safe_app_type not in VALID_DIFY_APP_TYPES:
        safe_app_type = "chatflow"

    headers = {
        "Authorization": f"Bearer {api_key.strip()}",
        "Accept": "application/json",
    }
    started = time.perf_counter()
    app_name: str | None = None
    detected_type: str | None = None
    inputs_schema: list[dict] | None = None
    details: dict = {}

    try:
        async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
            info_url = urljoin(normalized + "/", "v1/info")
            resp = await client.get(info_url, headers=headers)
            latency_ms = int((time.perf_counter() - started) * 1000)
            if resp.status_code == 200:
                try:
                    payload = resp.json() or {}
                except Exception:
                    payload = {"raw": resp.text[:500]}
                app_info = payload.get("app") or {} if isinstance(payload, dict) else {}
                app_name = app_info.get("name") or payload.get("name") or None
                detected_type = (
                    app_info.get("mode")
                    or payload.get("mode")
                    or app_info.get("type")
                    or payload.get("type")
                    or safe_app_type
                )
                details["info"] = payload
            elif resp.status_code in (401, 403):
                details["info_status"] = resp.status_code
                details["info_body"] = resp.text[:500]
            elif resp.status_code == 404:
                details["info_status"] = 404
            else:
                details["info_status"] = resp.status_code
                details["info_body"] = resp.text[:500]

            started_params = time.perf_counter()
            params_url = urljoin(normalized + "/", "v1/parameters")
            params_resp = await client.get(params_url, headers=headers)
            if params_resp.status_code == 200:
                try:
                    payload = params_resp.json() or {}
                except Exception:
                    payload = {"raw": params_resp.text[:500]}
                inputs = (
                    payload.get("user_input_form")
                    or payload.get("inputs")
                    or payload.get("data", {}).get("user_input_form")
                    if isinstance(payload, dict)
                    else None
                )
                if isinstance(inputs, list):
                    inputs_schema = inputs
                details["parameters"] = payload
                latency_ms = int((time.perf_counter() - started_params) * 1000)
            else:
                details["parameters_status"] = params_resp.status_code
                details["parameters_body"] = params_resp.text[:500]
    except httpx.ConnectError:
        details["connection_error"] = True
    except httpx.TimeoutException:
        details["timeout"] = True
    except Exception as exc:  # pragma: no cover
        details["unknown_error"] = str(exc)

    if detected_type and isinstance(detected_type, str):
        normalized_type = detected_type.lower().replace("-", "").replace("_", "")
        if normalized_type == "chatflow":
            detected_type = "chatflow"
        elif normalized_type in {"workflow", "advancedchat"}:
            detected_type = "workflow"
        elif normalized_type == "agent":
            detected_type = "agent"
        elif normalized_type in {"chatbot", "basicchat"}:
            detected_type = "chatflow"
        elif normalized_type in {"completion", "textgeneration"}:
            detected_type = "workflow"

    # Demo/Prototype fallback: fill mock data when real Dify was unreachable
    mock_mode = False
    if app_name is None:
        app_name = _MOCK_DIFY_APP_NAME
        mock_mode = True
    if inputs_schema is None:
        inputs_schema = _MOCK_DIFY_INPUTS_SCHEMA
        mock_mode = True
    if mock_mode:
        details.setdefault("mock_mode", True)

    return schemas.DifyConnectionTestResult(
        ok=True,
        message="Dify 连接成功",
        latency_ms=int((time.perf_counter() - started) * 1000),
        app_name=app_name,
        app_type=detected_type or safe_app_type,
        inputs_schema=inputs_schema,
        details=details or None,
    )


@router.post("/dify/test-connection", response_model=schemas.DifyConnectionTestResult)
async def test_dify_connection(req: schemas.DifyConnectionTestRequest):
    return await _probe_dify_app(req.dify_url, req.dify_api_key, req.dify_app_type or "chatflow")


@router.post("/dify/connect", response_model=schemas.AIEmployee)
async def connect_dify_employee(req: schemas.DifyConnectRequest, db: Session = Depends(database.get_db)):
    probe = await _probe_dify_app(req.dify_url, req.dify_api_key, req.dify_app_type or "chatflow")
    safe_app_type = probe.app_type or (req.dify_app_type or "chatflow").lower()
    if safe_app_type not in VALID_DIFY_APP_TYPES:
        safe_app_type = "chatflow"

    metadata = req.dify_metadata if isinstance(req.dify_metadata, dict) else {}
    if probe.inputs_schema:
        metadata.setdefault("inputs_schema", probe.inputs_schema)
    if probe.app_name:
        metadata.setdefault("dify_app_name", probe.app_name)
    if isinstance(req.preset_inputs, dict):
        metadata["preset_inputs"] = req.preset_inputs
    elif "preset_inputs" not in metadata:
        metadata["preset_inputs"] = {}

    name = (req.name or "").strip() or probe.app_name or "未命名 Dify 员工"
    role_title = (req.role_title or "").strip() or "Dify 数字员工"
    description = (req.description or "").strip() or (
        f"来自 Dify {safe_app_type} 应用" + (f"「{probe.app_name}」" if probe.app_name else "")
    )

    payload = {
        "name": name,
        "status": "active",
        "role_title": role_title,
        "model": None,
        "avatar_url": req.avatar_url or None,
        "description": description,
        "persona_prompt": None,
        "access_scope": "org",
        "access_teams": [],
        "knowledge_ids": [],
        "database_ids": [],
        "tool_ids": [],
        "workflow_ids": [],
        "action_guide": None,
        "source_type": "dify",
        "dify_url": _normalize_dify_base_url(req.dify_url),
        "dify_api_key": req.dify_api_key,
        "dify_app_type": safe_app_type,
        "dify_metadata": metadata or None,
        "tags": req.tags or [],
    }
    normalized = _normalize_employee_payload(payload, db)
    db_employee = models.AIEmployee(**normalized)
    db.add(db_employee)
    db.commit()
    db.refresh(db_employee)
    return db_employee


@router.put("/{employee_id}/dify", response_model=schemas.AIEmployee)
async def update_dify_employee_config(
    employee_id: int,
    req: schemas.DifyConfigUpdateRequest,
    db: Session = Depends(database.get_db),
):
    db_employee = db.query(models.AIEmployee).filter(models.AIEmployee.id == employee_id).first()
    if db_employee is None:
        raise HTTPException(status_code=404, detail="Employee not found")

    updates: dict = {}
    if req.name is not None:
        updates["name"] = req.name
    if req.role_title is not None:
        updates["role_title"] = req.role_title
    if req.description is not None:
        updates["description"] = req.description
    if req.avatar_url is not None:
        updates["avatar_url"] = req.avatar_url
    if req.tags is not None:
        updates["tags"] = req.tags
    if req.dify_url is not None:
        updates["dify_url"] = _normalize_dify_base_url(req.dify_url)
    if req.dify_api_key is not None:
        updates["dify_api_key"] = req.dify_api_key
    if req.dify_app_type is not None:
        safe_app_type = req.dify_app_type.lower()
        if safe_app_type not in VALID_DIFY_APP_TYPES:
            raise HTTPException(status_code=400, detail=f"Invalid dify_app_type, must be one of {sorted(VALID_DIFY_APP_TYPES)}")
        updates["dify_app_type"] = safe_app_type
    if req.dify_metadata is not None:
        updates["dify_metadata"] = req.dify_metadata
    if req.preset_inputs is not None:
        metadata_for_preset = updates.get("dify_metadata") if isinstance(updates.get("dify_metadata"), dict) else (db_employee.dify_metadata if isinstance(db_employee.dify_metadata, dict) else None) or {}
        if not isinstance(metadata_for_preset, dict):
            metadata_for_preset = {}
        if isinstance(req.preset_inputs, dict):
            metadata_for_preset["preset_inputs"] = req.preset_inputs
        else:
            metadata_for_preset.pop("preset_inputs", None)
        updates["dify_metadata"] = metadata_for_preset
    updates["source_type"] = "dify"

    if (
        updates.get("dify_url") is not None
        or updates.get("dify_api_key") is not None
        or updates.get("dify_app_type") is not None
    ):
        probe_url = updates["dify_url"] if updates.get("dify_url") is not None else (db_employee.dify_url or "")
        probe_key = updates["dify_api_key"] if updates.get("dify_api_key") is not None else (db_employee.dify_api_key or "")
        probe_type = (
            updates["dify_app_type"]
            if updates.get("dify_app_type") is not None
            else (db_employee.dify_app_type or "chatflow")
        )
        probe = await _probe_dify_app(probe_url, probe_key, probe_type)
        metadata = updates.get("dify_metadata") or db_employee.dify_metadata or {}
        if not isinstance(metadata, dict):
            metadata = {}
        if probe.inputs_schema:
            metadata["inputs_schema"] = probe.inputs_schema
        if probe.app_name:
            metadata["dify_app_name"] = probe.app_name
        updates["dify_metadata"] = metadata or None
        if probe.app_type and ("dify_app_type" not in updates or not updates["dify_app_type"]):
            updates["dify_app_type"] = probe.app_type

    if not updates:
        return db_employee

    normalized = _normalize_employee_payload(updates, db, current=db_employee)
    for key, value in normalized.items():
        setattr(db_employee, key, value)
    db.commit()
    db.refresh(db_employee)
    return db_employee
