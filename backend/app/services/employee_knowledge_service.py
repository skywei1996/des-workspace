from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from sqlalchemy.orm import Session

from .. import models, schemas
from .volcengine_knowledge_base import format_search_hits, search_knowledge


DEFAULT_DIRECT_KNOWLEDGE_LIMIT = 6
DEFAULT_DIRECT_RETRIEVE_COUNT = 8


@dataclass
class EmployeeKnowledgeSearchResult:
    hits: list[schemas.KnowledgeSearchHit]
    effective_knowledge_base_ids: list[str]
    ignored_knowledge_base_ids: list[str]
    errors: list[str]


def _has_processed_document(item: models.KnowledgeBase) -> bool:
    return any(str(document.status or "").lower() == "processed" for document in (item.documents or []))


def is_effective_knowledge_base(item: Optional[models.KnowledgeBase]) -> bool:
    if item is None:
        return False
    if not str(item.remote_resource_id or "").strip():
        return False
    return _has_processed_document(item)


def resolve_employee_knowledge_bases(employee: Optional[models.AIEmployee], db: Session) -> tuple[list[models.KnowledgeBase], list[str]]:
    knowledge_ids = [str(knowledge_id).strip() for knowledge_id in (getattr(employee, "knowledge_ids", None) or []) if str(knowledge_id).strip()]
    if not knowledge_ids:
        return [], []

    items = (
        db.query(models.KnowledgeBase)
        .filter(models.KnowledgeBase.id.in_(knowledge_ids))
        .all()
    )
    item_map = {item.id: item for item in items}

    effective_items: list[models.KnowledgeBase] = []
    ignored_ids: list[str] = []
    for knowledge_id in knowledge_ids:
        item = item_map.get(knowledge_id)
        if is_effective_knowledge_base(item):
            effective_items.append(item)
        else:
            ignored_ids.append(knowledge_id)

    return effective_items, ignored_ids


def _hit_sort_key(hit: schemas.KnowledgeSearchHit) -> tuple[float, float]:
    rerank_score = float(hit.rerank_score or 0)
    score = float(hit.score or 0)
    return rerank_score, score


def search_employee_knowledge(
    employee: Optional[models.AIEmployee],
    query: str,
    db: Session,
    *,
    limit: int = DEFAULT_DIRECT_KNOWLEDGE_LIMIT,
    retrieve_count: int = DEFAULT_DIRECT_RETRIEVE_COUNT,
) -> EmployeeKnowledgeSearchResult:
    effective_items, ignored_ids = resolve_employee_knowledge_bases(employee, db)
    if not effective_items:
        return EmployeeKnowledgeSearchResult(
            hits=[],
            effective_knowledge_base_ids=[],
            ignored_knowledge_base_ids=ignored_ids,
            errors=[],
        )

    hits: list[schemas.KnowledgeSearchHit] = []
    errors: list[str] = []
    for item in effective_items:
        try:
            payload = search_knowledge(
                query=query,
                resource_id=item.remote_resource_id,
                name=item.remote_collection_name,
                project=item.remote_project,
                host=item.remote_host,
                messages=[],
                limit=limit,
                rewrite=False,
                rerank_switch=True,
                chunk_group=True,
                retrieve_count=max(retrieve_count, limit),
            )
            formatted_hits, _meta = format_search_hits(
                knowledge_base_id=item.id,
                knowledge_base_name=item.local_display_name or item.name,
                search_payload=payload,
            )
            hits.extend(schemas.KnowledgeSearchHit(**hit) for hit in formatted_hits)
        except Exception as exc:
            errors.append(f"{item.id}: {exc}")

    hits.sort(key=_hit_sort_key, reverse=True)
    if limit > 0:
        hits = hits[:limit]

    return EmployeeKnowledgeSearchResult(
        hits=hits,
        effective_knowledge_base_ids=[item.id for item in effective_items],
        ignored_knowledge_base_ids=ignored_ids,
        errors=errors,
    )


def format_knowledge_context_for_prompt(search_result: EmployeeKnowledgeSearchResult) -> str:
    configured_count = len(search_result.effective_knowledge_base_ids) + len(search_result.ignored_knowledge_base_ids)

    if not search_result.hits:
        lines = [
            "Knowledge Base Context:",
            f"- configured_knowledge_base_count: {configured_count}",
            f"- effective_knowledge_base_count: {len(search_result.effective_knowledge_base_ids)}",
            f"- ignored_knowledge_base_count: {len(search_result.ignored_knowledge_base_ids)}",
        ]
        if search_result.errors:
            lines.append("- retrieval_status: retrieval_failed")
            lines.append("- guidance: The employee does have configured knowledge bases, but retrieval failed in this turn. Do not say that no knowledge base is connected. State that knowledge retrieval failed or returned no usable evidence.")
            lines.append("Knowledge Base Warnings:")
            for error in search_result.errors:
                lines.append(f"- {error}")
            return "\n".join(lines)

        if search_result.effective_knowledge_base_ids:
            lines.append("- retrieval_status: no_hits")
            lines.append("- guidance: The employee does have configured knowledge bases, but this query did not retrieve relevant chunks. Do not say that no knowledge base is connected. Say that this turn did not retrieve relevant knowledge evidence.")
            return "\n".join(lines)

        lines.append("- retrieval_status: no_effective_knowledge_base")
        lines.append("- guidance: No effective knowledge base was available for retrieval in this turn.")
        return "\n".join(lines)

    lines = ["Knowledge Base Context:"]
    for index, hit in enumerate(search_result.hits, start=1):
        score_value = hit.rerank_score if hit.rerank_score is not None else hit.score
        score_text = f"{float(score_value):.4f}" if score_value is not None else "n/a"
        chunk_text = hit.content.strip()
        lines.append(
            f"{index}. [知识库: {hit.knowledge_base_name}][文档: {hit.document_name or hit.document_id or '未知文档'}][切片: {hit.chunk_id if hit.chunk_id is not None else '未知'}][分数: {score_text}]"
        )
        lines.append(f"   内容: {chunk_text}")

    if search_result.errors:
        lines.append("")
        lines.append("Knowledge Base Warnings:")
        for error in search_result.errors:
            lines.append(f"- {error}")

    return "\n".join(lines)