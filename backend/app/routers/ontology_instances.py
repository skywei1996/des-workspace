from fastapi import APIRouter, Depends, HTTPException, Query

from .. import schemas
from ..services.ontology_graph_store import OntologyGraphStoreError, get_ontology_store


router = APIRouter(prefix="/ontology", tags=["ontology"])


def _validated_objects(payload: schemas.OntologyObjectInstanceBatchUpsert) -> list[dict]:
    objects = []
    for item in payload.objects:
        value = item.model_dump()
        value["objectTypeId"] = item.objectTypeId.strip()
        value["primaryKey"] = item.primaryKey.strip()
        value["displayName"] = item.displayName.strip()
        if not value["objectTypeId"] or not value["primaryKey"] or not value["displayName"]:
            raise HTTPException(
                status_code=400,
                detail="objectTypeId, primaryKey and displayName are required",
            )
        objects.append(value)
    return objects


def _service_unavailable(error: OntologyGraphStoreError):
    raise HTTPException(status_code=503, detail=str(error)) from error


@router.post("/instances/batch-upsert")
def upsert_object_instances(
    payload: schemas.OntologyObjectInstanceBatchUpsert,
    store=Depends(get_ontology_store),
):
    try:
        return {"objects": store.upsert_objects(_validated_objects(payload))}
    except OntologyGraphStoreError as error:
        _service_unavailable(error)


@router.post("/links/batch-upsert")
def upsert_link_instances(
    payload: schemas.OntologyLinkInstanceBatchUpsert,
    store=Depends(get_ontology_store),
):
    try:
        return {"links": store.upsert_links([item.model_dump() for item in payload.links])}
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    except OntologyGraphStoreError as error:
        _service_unavailable(error)


@router.get("/instances")
def search_object_instances(
    query: str = "",
    object_type_id: str | None = None,
    property_name: str | None = None,
    property_value: str | None = None,
    limit: int = Query(default=50, ge=1, le=500),
    store=Depends(get_ontology_store),
):
    try:
        return {
            "objects": store.search_objects(
                query=query,
                object_type_id=object_type_id,
                property_name=property_name,
                property_value=property_value,
                limit=limit,
            )
        }
    except OntologyGraphStoreError as error:
        _service_unavailable(error)


@router.post("/traverse", response_model=schemas.OntologyTraversalResponse)
def traverse_ontology(
    payload: schemas.OntologyTraversalRequest,
    store=Depends(get_ontology_store),
):
    if payload.direction not in {"out", "in", "both"}:
        raise HTTPException(status_code=400, detail="direction must be out, in or both")
    try:
        return store.traverse(
            start_instance_ids=payload.startInstanceIds,
            max_hops=payload.maxHops,
            direction=payload.direction,
            link_type_ids=payload.linkTypeIds,
            limit=payload.limit,
        )
    except KeyError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except OntologyGraphStoreError as error:
        _service_unavailable(error)
