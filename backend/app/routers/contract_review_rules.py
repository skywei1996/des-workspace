from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from .. import database, models, schemas


router = APIRouter(
    prefix="/contract-review-rules",
    tags=["contract-review-rules"],
    responses={404: {"description": "Not found"}},
)


def _serialize_group(group: models.ContractRuleGroup) -> schemas.ContractRuleGroup:
    return schemas.ContractRuleGroup(
        id=group.id,
        name=group.name,
        created_at=group.created_at,
        updated_at=group.updated_at,
    )


def _serialize_rule(rule: models.ContractReviewRule) -> schemas.ContractReviewRule:
    return schemas.ContractReviewRule(
        id=rule.id,
        name=rule.name,
        risk=rule.risk,
        description=rule.description,
        group=rule.group.name if rule.group else "",
        group_id=rule.group_id,
        source=rule.source or "智能",
        created_at=rule.created_at,
        updated_at=rule.updated_at,
    )


def _serialize_analysis(analysis: models.ContractRuleAnalysis) -> schemas.ContractRuleAnalysis:
    return schemas.ContractRuleAnalysis(
        id=analysis.id,
        rule_id=analysis.rule_id,
        contract_name=analysis.contract_name,
        issue_comment=analysis.issue_comment,
        adjustment_suggestion=analysis.adjustment_suggestion,
        created_at=analysis.created_at,
        updated_at=analysis.updated_at,
    )


@router.get("/groups", response_model=list[schemas.ContractRuleGroup])
def list_rule_groups(db: Session = Depends(database.get_db)):
    groups = db.query(models.ContractRuleGroup).order_by(models.ContractRuleGroup.created_at.desc()).all()
    return [_serialize_group(group) for group in groups]


@router.post("/groups", response_model=schemas.ContractRuleGroup)
def create_rule_group(payload: schemas.ContractRuleGroupCreate, db: Session = Depends(database.get_db)):
    group_name = payload.name.strip()
    if not group_name:
        raise HTTPException(status_code=400, detail="name is required")

    existing_group = db.query(models.ContractRuleGroup).filter(models.ContractRuleGroup.name == group_name).first()
    if existing_group is not None:
        return _serialize_group(existing_group)

    group = models.ContractRuleGroup(id=str(uuid4()), name=group_name)
    db.add(group)
    db.commit()
    db.refresh(group)
    return _serialize_group(group)


@router.get("/rules", response_model=list[schemas.ContractReviewRule])
def list_rules(group_name: str | None = None, db: Session = Depends(database.get_db)):
    query = db.query(models.ContractReviewRule).options(joinedload(models.ContractReviewRule.group))
    if group_name:
        query = query.join(models.ContractRuleGroup).filter(models.ContractRuleGroup.name == group_name)
    rules = query.order_by(models.ContractReviewRule.created_at.desc()).all()
    return [_serialize_rule(rule) for rule in rules]


@router.post("/rules", response_model=schemas.ContractReviewRule)
def create_rule(payload: schemas.ContractReviewRuleCreate, db: Session = Depends(database.get_db)):
    rule_name = payload.name.strip()
    rule_description = payload.description.strip()
    group_name = payload.group_name.strip()
    if not rule_name:
        raise HTTPException(status_code=400, detail="name is required")
    if not rule_description:
        raise HTTPException(status_code=400, detail="description is required")
    if not group_name:
        raise HTTPException(status_code=400, detail="group_name is required")

    group = db.query(models.ContractRuleGroup).filter(models.ContractRuleGroup.name == group_name).first()
    if group is None:
        group = models.ContractRuleGroup(id=str(uuid4()), name=group_name)
        db.add(group)
        db.flush()

    rule = models.ContractReviewRule(
        id=str(uuid4()),
        name=rule_name,
        risk=payload.risk or "高风险",
        description=rule_description,
        group_id=group.id,
        source="智能",
    )
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return _serialize_rule(
        db.query(models.ContractReviewRule)
        .options(joinedload(models.ContractReviewRule.group))
        .filter(models.ContractReviewRule.id == rule.id)
        .first()
    )


@router.get("/rules/{rule_id}/analyses", response_model=list[schemas.ContractRuleAnalysis])
def list_rule_analyses(rule_id: str, db: Session = Depends(database.get_db)):
    rule = db.query(models.ContractReviewRule).filter(models.ContractReviewRule.id == rule_id).first()
    if rule is None:
        raise HTTPException(status_code=404, detail="rule not found")

    analyses = (
        db.query(models.ContractRuleAnalysis)
        .filter(models.ContractRuleAnalysis.rule_id == rule_id)
        .order_by(models.ContractRuleAnalysis.created_at.desc())
        .all()
    )
    return [_serialize_analysis(analysis) for analysis in analyses]


@router.post("/rules/{rule_id}/analyses", response_model=list[schemas.ContractRuleAnalysis])
def create_rule_analyses(rule_id: str, payload: schemas.ContractRuleAnalysisCreate, db: Session = Depends(database.get_db)):
    rule = db.query(models.ContractReviewRule).filter(models.ContractReviewRule.id == rule_id).first()
    if rule is None:
        raise HTTPException(status_code=404, detail="rule not found")

    created_analyses = []
    for contract in payload.contracts:
        contract_name = contract.contract_name.strip()
        if not contract_name:
            continue
        analysis = models.ContractRuleAnalysis(
            id=str(uuid4()),
            rule_id=rule_id,
            contract_name=contract_name,
            issue_comment=contract.issue_comment.strip(),
            adjustment_suggestion=contract.adjustment_suggestion.strip(),
        )
        db.add(analysis)
        created_analyses.append(analysis)

    if not created_analyses:
        raise HTTPException(status_code=400, detail="contracts are required")

    db.commit()
    for analysis in created_analyses:
        db.refresh(analysis)
    return [_serialize_analysis(analysis) for analysis in created_analyses]
