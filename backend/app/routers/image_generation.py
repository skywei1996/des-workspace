from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from ..services.image_generation_service import (
    ImageGenerationConfigurationError,
    ImageGenerationServiceError,
    NvidiaImageGenerationService,
)


router = APIRouter(
    prefix="/images",
    tags=["images"],
)

image_generation_service = NvidiaImageGenerationService()


class ImageGenerationRequest(BaseModel):
    prompt: str = Field(..., min_length=1, max_length=10000)
    width: int = Field(default=1024)
    height: int = Field(default=1024)
    cfg_scale: float = Field(default=5.0, gt=1.0, le=9.0)
    mode: str = Field(default="text-to-image")
    image: Optional[str] = None
    negative_prompt: Optional[str] = Field(default=None, max_length=10000)
    output_format: str = Field(default="jpeg")
    samples: int = Field(default=1, ge=1, le=1)
    seed: int = Field(default=0, ge=0)
    steps: int = Field(default=30, ge=5, le=100)


class ImageGenerationResponse(BaseModel):
    status: str = "success"
    provider: str
    model: str
    prompt: str
    mime_type: str
    image_base64: str
    image_data_url: str
    finish_reason: str
    seed: int
    width: int
    height: int


@router.post("/generate", response_model=ImageGenerationResponse)
def generate_image(request: ImageGenerationRequest):
    try:
        result = image_generation_service.generate_image(
            request.prompt,
            width=request.width,
            height=request.height,
            cfg_scale=request.cfg_scale,
            mode=request.mode,
            image=request.image,
            negative_prompt=request.negative_prompt,
            output_format=request.output_format,
            seed=request.seed,
            steps=request.steps,
            samples=request.samples,
        )
    except ImageGenerationConfigurationError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except ImageGenerationServiceError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    return ImageGenerationResponse(
        provider=result.provider,
        model=result.model,
        prompt=result.prompt,
        mime_type=result.mime_type,
        image_base64=result.image_base64,
        image_data_url=result.image_data_url,
        finish_reason=result.finish_reason,
        seed=result.seed,
        width=result.width,
        height=result.height,
    )