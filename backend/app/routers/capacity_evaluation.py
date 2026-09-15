from fastapi import APIRouter
from pydantic import BaseModel, Field


router = APIRouter(prefix="/functions/capacity", tags=["ontology-functions"])


class EquipmentFaultCapacityRequest(BaseModel):
    equipment_capacity_per_hour: float = Field(ge=0)
    downtime_hours: float = Field(ge=0)
    planned_load: float = Field(ge=0)
    replacement_capacity: float = Field(default=0, ge=0)


class EquipmentFaultCapacityResult(BaseModel):
    lost_capacity: float
    available_capacity: float
    capacity_gap: float
    impact_rate: float
    risk_level: str


class EquipmentFaultDeliveryRiskRequest(BaseModel):
    affected_order_count: int = Field(ge=0)
    urgent_order_count: int = Field(ge=0)
    downtime_hours: float = Field(ge=0)
    schedule_buffer_hours: float = Field(default=0, ge=0)


class EquipmentFaultDeliveryRiskResult(BaseModel):
    exposed_order_count: int
    urgent_order_count: int
    max_delay_days: float
    delivery_risk_score: float
    risk_level: str


class EquipmentFaultRecoveryRequest(BaseModel):
    lost_capacity: float = Field(ge=0)
    replacement_capacity: float = Field(default=0, ge=0)
    overtime_capacity: float = Field(default=0, ge=0)


class EquipmentFaultRecoveryResult(BaseModel):
    recoverable_capacity: float
    remaining_capacity_gap: float
    replacement_coverage_rate: float
    can_local_recover: bool


@router.post("/equipment-fault-impact", response_model=EquipmentFaultCapacityResult)
def evaluate_equipment_fault_capacity(
    request: EquipmentFaultCapacityRequest,
) -> EquipmentFaultCapacityResult:
    gross_lost_capacity = request.equipment_capacity_per_hour * request.downtime_hours
    lost_capacity = max(gross_lost_capacity - request.replacement_capacity, 0)
    available_capacity = max(request.planned_load - lost_capacity, 0)
    capacity_gap = max(request.planned_load - available_capacity, 0)
    impact_rate = capacity_gap / request.planned_load if request.planned_load else 0

    if impact_rate >= 0.3:
        risk_level = "high"
    elif impact_rate >= 0.1:
        risk_level = "medium"
    else:
        risk_level = "low"

    return EquipmentFaultCapacityResult(
        lost_capacity=round(lost_capacity, 2),
        available_capacity=round(available_capacity, 2),
        capacity_gap=round(capacity_gap, 2),
        impact_rate=round(impact_rate, 4),
        risk_level=risk_level,
    )


@router.post("/equipment-fault-delivery-risk", response_model=EquipmentFaultDeliveryRiskResult)
def evaluate_equipment_fault_delivery_risk(
    request: EquipmentFaultDeliveryRiskRequest,
) -> EquipmentFaultDeliveryRiskResult:
    exposed_hours = max(request.downtime_hours - request.schedule_buffer_hours, 0)
    max_delay_days = exposed_hours / 24
    order_factor = min(request.affected_order_count / 10, 1)
    urgent_factor = min(request.urgent_order_count / 3, 1)
    delay_factor = min(max_delay_days / 3, 1)
    delivery_risk_score = 0.3 * order_factor + 0.4 * urgent_factor + 0.3 * delay_factor

    if delivery_risk_score >= 0.7:
        risk_level = "high"
    elif delivery_risk_score >= 0.35:
        risk_level = "medium"
    else:
        risk_level = "low"

    return EquipmentFaultDeliveryRiskResult(
        exposed_order_count=request.affected_order_count,
        urgent_order_count=request.urgent_order_count,
        max_delay_days=round(max_delay_days, 2),
        delivery_risk_score=round(delivery_risk_score, 4),
        risk_level=risk_level,
    )


@router.post("/equipment-fault-recovery", response_model=EquipmentFaultRecoveryResult)
def evaluate_equipment_fault_recovery(
    request: EquipmentFaultRecoveryRequest,
) -> EquipmentFaultRecoveryResult:
    recoverable_capacity = request.replacement_capacity + request.overtime_capacity
    remaining_capacity_gap = max(request.lost_capacity - recoverable_capacity, 0)
    coverage_rate = min(recoverable_capacity / request.lost_capacity, 1) if request.lost_capacity else 1

    return EquipmentFaultRecoveryResult(
        recoverable_capacity=round(recoverable_capacity, 2),
        remaining_capacity_gap=round(remaining_capacity_gap, 2),
        replacement_coverage_rate=round(coverage_rate, 4),
        can_local_recover=coverage_rate >= 0.8,
    )