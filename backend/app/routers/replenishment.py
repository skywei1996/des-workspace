from datetime import date
from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from .. import database
from ..services import replenishment_service


router = APIRouter(prefix="/api/replenishment/functions", tags=["replenishment"])


class ScopeRequest(BaseModel):
    project_id: str = replenishment_service.DEFAULT_PROJECT_ID
    store_ids: list[str] = Field(default_factory=list)
    as_of_date: date | None = None
    limit: int = Field(default=5000, ge=1, le=100000)


class ItemsRequest(ScopeRequest):
    items: list[dict[str, Any]] = Field(default_factory=list)
    sales_items: list[dict[str, Any]] = Field(default_factory=list)
    inventory_items: list[dict[str, Any]] = Field(default_factory=list)


class InventoryWritebackRequest(BaseModel):
    project_id: str = replenishment_service.DEFAULT_PROJECT_ID
    request_id: str = Field(min_length=1)
    items: list[dict[str, Any]] = Field(min_length=1)
    approval_required: bool = False
    approval_status: str = "not_required"
    initiated_by: str = "digital_employee"
    approved_by: str = ""


def _response(items: list[dict], limit: int, **summary) -> dict:
    return {
        "total": len(items),
        "returned": min(len(items), limit),
        "truncated": len(items) > limit,
        "summary": summary,
        "items": items[:limit],
    }


@router.post("/sales-14d")
def sales_14d(payload: ScopeRequest, db: Session = Depends(database.get_db)):
    items = replenishment_service.calculate_sales(
        db,
        payload.project_id,
        set(payload.store_ids) or None,
        payload.as_of_date,
    )
    return _response(
        items,
        payload.limit,
        as_of_date=(payload.as_of_date or date.today()).isoformat(),
        stores=len({item["store_id"] for item in items}),
        total_sales_14d=sum(item["sales_14d"] for item in items),
    )


@router.post("/inventory-snapshot")
def inventory_snapshot(payload: ScopeRequest, db: Session = Depends(database.get_db)):
    items = replenishment_service.load_inventory(db, payload.project_id, set(payload.store_ids) or None)
    return _response(
        items,
        payload.limit,
        stores=len({item["store_id"] for item in items}),
        total_available=sum(item["qty_available"] for item in items),
    )


@router.post("/weeks-of-supply")
def weeks_of_supply(payload: ItemsRequest, db: Session = Depends(database.get_db)):
    store_ids = set(payload.store_ids) or None
    sales_items = payload.sales_items or replenishment_service.calculate_sales(
        db, payload.project_id, store_ids, payload.as_of_date
    )
    inventory_items = payload.inventory_items or replenishment_service.load_inventory(
        db, payload.project_id, store_ids
    )
    items = replenishment_service.calculate_weeks_of_supply(sales_items, inventory_items)
    finite = [item["weeks_of_supply"] for item in items if item["weeks_of_supply"] is not None]
    return _response(
        items,
        payload.limit,
        finite_count=len(finite),
        no_sales_count=len(items) - len(finite),
        average_weeks_of_supply=sum(finite) / len(finite) if finite else None,
    )


@router.post("/transfer-decision")
def transfer_decision(payload: ItemsRequest, db: Session = Depends(database.get_db)):
    items = payload.items
    if not items:
        store_ids = set(payload.store_ids) or None
        sales_items = replenishment_service.calculate_sales(db, payload.project_id, store_ids, payload.as_of_date)
        inventory_items = replenishment_service.load_inventory(db, payload.project_id, store_ids)
        items = replenishment_service.calculate_weeks_of_supply(sales_items, inventory_items)
    decided = replenishment_service.decide_transfers(items)
    counts = {decision: sum(item["decision"] == decision for item in decided) for decision in ("inbound", "outbound", "undetermined")}
    return _response(decided, payload.limit, decision_counts=counts)


@router.post("/transfer-quantity")
def transfer_quantity(payload: ItemsRequest, db: Session = Depends(database.get_db)):
    items = payload.items
    if not items:
        store_ids = set(payload.store_ids) or None
        sales_items = replenishment_service.calculate_sales(db, payload.project_id, store_ids, payload.as_of_date)
        inventory_items = replenishment_service.load_inventory(db, payload.project_id, store_ids)
        items = replenishment_service.decide_transfers(
            replenishment_service.calculate_weeks_of_supply(sales_items, inventory_items)
        )
    calculated = replenishment_service.calculate_transfer_quantities(items)
    approval_stores = sorted({item["store_id"] for item in calculated if item["store_total_inbound_quantity"] > 50})
    return _response(
        calculated,
        payload.limit,
        total_inbound_quantity=sum(item["inbound_quantity"] for item in calculated),
        approval_required_count=sum(bool(item["approval_required"]) for item in calculated),
        stores_over_50=approval_stores,
    )


@router.post("/inventory-writeback")
def inventory_writeback(payload: InventoryWritebackRequest, db: Session = Depends(database.get_db)):
    items = replenishment_service.write_inventory_adjustments(
        db,
        payload.project_id,
        payload.request_id,
        payload.items,
        payload.approval_required,
        payload.approval_status,
        payload.initiated_by,
        payload.approved_by,
    )
    return {
        "request_id": payload.request_id,
        "status": "completed",
        "applied": sum(item["status"] == "applied" for item in items),
        "already_applied": sum(item["status"] == "already_applied" for item in items),
        "items": items,
    }