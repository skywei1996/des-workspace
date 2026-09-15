from fastapi import APIRouter, HTTPException

from app import schemas
from app.services.object_type_analyzer import analyze_document_for_object_type, analyze_table_for_object_type, analyze_text_for_object_type, infer_object_relationships


router = APIRouter(prefix="/object-type-analysis", tags=["object-type-analysis"])


@router.post("/document", response_model=schemas.ObjectTypeDocumentAnalysisResponse)
def analyze_document(payload: schemas.ObjectTypeDocumentAnalysisRequest):
    try:
        result = analyze_document_for_object_type(payload.document_name, payload.text)
        return schemas.ObjectTypeDocumentAnalysisResponse(**result)
    except Exception as error:
        raise HTTPException(status_code=502, detail=str(error)) from error


@router.post("/table", response_model=schemas.ObjectTypeDocumentAnalysisResponse)
def analyze_table(payload: schemas.ObjectTypeTableAnalysisRequest):
    try:
        result = analyze_table_for_object_type(payload.dataset_name, payload.sheet_name, payload.columns)
        return schemas.ObjectTypeDocumentAnalysisResponse(**result)
    except Exception as error:
        raise HTTPException(status_code=502, detail=str(error)) from error


@router.post("/text", response_model=schemas.ObjectTypeDocumentAnalysisResponse)
def analyze_text(payload: schemas.ObjectTypeTextAnalysisRequest):
    try:
        result = analyze_text_for_object_type(payload.text)
        return schemas.ObjectTypeDocumentAnalysisResponse(**result)
    except Exception as error:
        raise HTTPException(status_code=502, detail=str(error)) from error


@router.post("/relationships", response_model=schemas.ObjectRelationshipInferenceResponse)
def analyze_relationships(payload: schemas.ObjectRelationshipInferenceRequest):
    try:
        result = infer_object_relationships(
            payload.objectTypes,
            payload.properties,
            payload.existingLinks,
            payload.currentObjectTypeId,
        )
        return schemas.ObjectRelationshipInferenceResponse(**result)
    except Exception as error:
        raise HTTPException(status_code=502, detail=str(error)) from error