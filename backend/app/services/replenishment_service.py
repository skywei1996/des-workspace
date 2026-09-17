import csv
import io
import math
from collections import defaultdict
from datetime import date, datetime, timedelta
from typing import Iterable
from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy.orm import Session

from .. import models


DEFAULT_PROJECT_ID = "0b1a25a9-f6b7-4f38-8007-38d4182e3e4a"


def _number(value, default: float = 0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _parse_date(value) -> date:
    try:
        return date.fromisoformat(str(value or "")[:10])
    except ValueError as error:
        raise HTTPException(status_code=422, detail=f"Invalid dataset date: {value}") from error


def _mapping_context(db: Session, project_id: str, object_name: str) -> tuple[models.Dataset, dict[str, str]]:
    object_definition = db.query(models.OntologyModelingObject).filter(
        models.OntologyModelingObject.project_id == project_id,
        models.OntologyModelingObject.name == object_name,
    ).first()
    if object_definition is None:
        raise HTTPException(status_code=404, detail=f"Ontology object not found: {object_name}")
    mapping = db.query(models.OntologyModelingMapping).filter(
        models.OntologyModelingMapping.project_id == project_id,
        models.OntologyModelingMapping.object_id == object_definition.id,
    ).first()
    if mapping is None or not mapping.dataset_id:
        raise HTTPException(status_code=409, detail=f"Dataset mapping is not configured for {object_name}")
    dataset = db.query(models.Dataset).filter(models.Dataset.id == mapping.dataset_id).first()
    if dataset is None:
        raise HTTPException(status_code=404, detail=f"Mapped dataset not found for {object_name}")
    properties = {
        item.id: item.api_name
        for item in db.query(models.OntologyModelingProperty).filter(
            models.OntologyModelingProperty.project_id == project_id
        ).all()
    }
    columns = {
        properties.get(item.get("propertyId"), ""): str(item.get("sourceColumn") or "")
        for item in (mapping.field_mappings or [])
        if properties.get(item.get("propertyId")) and item.get("sourceColumn")
    }
    return dataset, columns


def _rows(dataset: models.Dataset) -> Iterable[dict[str, str]]:
    try:
        text = dataset.content.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = dataset.content.decode("gb18030")
    return csv.DictReader(io.StringIO(text))


def _column(columns: dict[str, str], api_name: str) -> str:
    value = columns.get(api_name)
    if not value:
        raise HTTPException(status_code=409, detail=f"Required property is not mapped: {api_name}")
    return value


def calculate_sales(
    db: Session,
    project_id: str,
    store_ids: set[str] | None = None,
    as_of: date | None = None,
) -> list[dict]:
    dataset, columns = _mapping_context(db, project_id, "销售明细")
    sale_date = _column(columns, "sale_date")
    store_id = _column(columns, "store_id")
    sku_id = _column(columns, "sku_id")
    quantity = _column(columns, "qty")
    cutoff = as_of or datetime.now().date()
    start_14d = cutoff - timedelta(days=13)
    start_7d = cutoff - timedelta(days=6)
    totals: dict[tuple[str, str], dict[str, float]] = defaultdict(lambda: {"sales_14d": 0, "sales_7d": 0})
    for row in _rows(dataset):
        row_store_id = row.get(store_id, "")
        if store_ids and row_store_id not in store_ids:
            continue
        row_date = _parse_date(row.get(sale_date))
        if row_date < start_14d or row_date > cutoff:
            continue
        key = (row_store_id, row.get(sku_id, ""))
        row_quantity = _number(row.get(quantity))
        totals[key]["sales_14d"] += row_quantity
        if row_date >= start_7d:
            totals[key]["sales_7d"] += row_quantity
    return [
        {
            "store_id": key[0],
            "sku_id": key[1],
            "sales_14d": values["sales_14d"],
            "sales_7d": values["sales_7d"],
            "has_sale_14d": values["sales_14d"] > 0,
            "average_weekly_sales": values["sales_14d"] / 2,
            "as_of_date": cutoff.isoformat(),
        }
        for key, values in sorted(totals.items())
        if key[0] and key[1]
    ]


def load_inventory(
    db: Session,
    project_id: str,
    store_ids: set[str] | None = None,
) -> list[dict]:
    dataset, columns = _mapping_context(db, project_id, "库存快照")
    snapshot_date = _column(columns, "snapshot_date")
    store_id = _column(columns, "store_id")
    sku_id = _column(columns, "sku_id")
    quantity_fields = {
        name: _column(columns, name)
        for name in ("qty_on_hand", "qty_available", "qty_locked", "qty_in_transit")
    }
    latest: dict[tuple[str, str], tuple[date, dict]] = {}
    for row in _rows(dataset):
        row_store_id = row.get(store_id, "")
        if store_ids and row_store_id not in store_ids:
            continue
        key = (row_store_id, row.get(sku_id, ""))
        row_date = _parse_date(row.get(snapshot_date))
        if key not in latest or row_date > latest[key][0]:
            latest[key] = (
                row_date,
                {
                    "store_id": key[0],
                    "sku_id": key[1],
                    "snapshot_date": row_date.isoformat(),
                    **{name: _number(row.get(column)) for name, column in quantity_fields.items()},
                },
            )
    adjustment_query = db.query(
        models.ReplenishmentInventoryAdjustment.store_id,
        models.ReplenishmentInventoryAdjustment.sku_id,
        models.ReplenishmentInventoryAdjustment.quantity_delta,
    ).filter(models.ReplenishmentInventoryAdjustment.project_id == project_id)
    if store_ids:
        adjustment_query = adjustment_query.filter(models.ReplenishmentInventoryAdjustment.store_id.in_(store_ids))
    adjustments: dict[tuple[str, str], int] = defaultdict(int)
    for row_store_id, row_sku_id, delta in adjustment_query.all():
        adjustments[(row_store_id, row_sku_id)] += delta
    items = []
    for key, (_, item) in sorted(latest.items()):
        delta = adjustments[key]
        item["qty_on_hand"] += delta
        item["qty_available"] += delta
        item["adjustment_quantity"] = delta
        items.append(item)
    return items


def calculate_weeks_of_supply(sales_items: list[dict], inventory_items: list[dict]) -> list[dict]:
    sales = {(item["store_id"], item["sku_id"]): item for item in sales_items}
    inventory = {(item["store_id"], item["sku_id"]): item for item in inventory_items}
    items = []
    for key in sorted(set(sales) | set(inventory)):
        sale = sales.get(key, {})
        stock = inventory.get(key, {})
        average_weekly_sales = _number(sale.get("average_weekly_sales"))
        available_inventory = _number(stock.get("qty_available"))
        weeks_of_supply = available_inventory / average_weekly_sales if average_weekly_sales > 0 else None
        items.append({
            **stock,
            **sale,
            "store_id": key[0],
            "sku_id": key[1],
            "available_inventory": available_inventory,
            "weeks_of_supply": weeks_of_supply,
        })
    return items


def decide_transfers(items: list[dict]) -> list[dict]:
    decided = []
    for item in items:
        sales_7d = _number(item.get("sales_7d"))
        sales_14d = _number(item.get("sales_14d"))
        weeks = item.get("weeks_of_supply")
        if sales_7d > 0 and weeks is not None and weeks < 1:
            decision, reason = "inbound", "近7天有销量且可销售周小于1"
        elif sales_14d == 0 and (weeks is None or weeks > 2):
            decision, reason = "outbound", "近14天无销量且可销售周大于2"
        else:
            decision, reason = "undetermined", "不满足自动调入或自动调出规则"
        decided.append({**item, "decision": decision, "decision_reason": reason})
    return decided


def calculate_transfer_quantities(items: list[dict]) -> list[dict]:
    store_totals: dict[str, int] = defaultdict(int)
    calculated = []
    for item in items:
        required = 0
        inbound_quantity = 0
        if item.get("decision") == "inbound":
            target_inventory = 1.2 * _number(item.get("average_weekly_sales"))
            required = max(math.ceil(target_inventory - _number(item.get("available_inventory"))), 0)
            inbound_quantity = min(required, 2)
        output = {
            **item,
            "target_weeks_of_supply": 1.2,
            "required_quantity_to_target": required,
            "inbound_quantity": inbound_quantity,
        }
        store_totals[item["store_id"]] += inbound_quantity
        calculated.append(output)
    return [
        {
            **item,
            "store_total_inbound_quantity": store_totals[item["store_id"]],
            "approval_required": item.get("decision") == "undetermined" or store_totals[item["store_id"]] > 50,
        }
        for item in calculated
    ]


def write_inventory_adjustments(
    db: Session,
    project_id: str,
    request_id: str,
    items: list[dict],
    approval_required: bool,
    approval_status: str,
    initiated_by: str,
    approved_by: str,
) -> list[dict]:
    if approval_required and approval_status != "approved":
        raise HTTPException(status_code=409, detail="Inventory writeback requires approved status")
    current_inventory = {
        (item["store_id"], item["sku_id"]): item
        for item in load_inventory(db, project_id, {str(item.get("store_id")) for item in items})
    }
    results = []
    for item in items:
        store_id = str(item.get("store_id") or "")
        sku_id = str(item.get("sku_id") or "")
        direction = str(item.get("direction") or item.get("decision") or "")
        quantity = int(_number(item.get("quantity", item.get("inbound_quantity", 0))))
        if not store_id or not sku_id or direction not in {"inbound", "outbound"} or quantity <= 0:
            raise HTTPException(status_code=422, detail="Each writeback item requires store_id, sku_id, inbound/outbound direction, and positive quantity")
        existing = db.query(models.ReplenishmentInventoryAdjustment).filter(
            models.ReplenishmentInventoryAdjustment.request_id == request_id,
            models.ReplenishmentInventoryAdjustment.store_id == store_id,
            models.ReplenishmentInventoryAdjustment.sku_id == sku_id,
        ).first()
        if existing:
            results.append({"store_id": store_id, "sku_id": sku_id, "status": "already_applied", "quantity_delta": existing.quantity_delta})
            continue
        current = current_inventory.get((store_id, sku_id))
        if current is None:
            raise HTTPException(status_code=404, detail=f"Inventory not found for {store_id}/{sku_id}")
        delta = quantity if direction == "inbound" else -quantity
        if _number(current.get("qty_available")) + delta < 0:
            raise HTTPException(status_code=409, detail=f"Insufficient inventory for {store_id}/{sku_id}")
        adjustment = models.ReplenishmentInventoryAdjustment(
            id=str(uuid4()),
            request_id=request_id,
            project_id=project_id,
            store_id=store_id,
            sku_id=sku_id,
            direction=direction,
            quantity=quantity,
            quantity_delta=delta,
            approval_required=1 if approval_required else 0,
            approval_status=approval_status if approval_required else "not_required",
            initiated_by=initiated_by,
            approved_by=approved_by,
        )
        db.add(adjustment)
        results.append({
            "store_id": store_id,
            "sku_id": sku_id,
            "status": "applied",
            "quantity_delta": delta,
            "qty_available_before": current["qty_available"],
            "qty_available_after": current["qty_available"] + delta,
        })
    db.commit()
    return results