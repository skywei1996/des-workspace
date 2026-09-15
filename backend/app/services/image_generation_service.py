import base64
import json
import os
from dataclasses import dataclass
from typing import Optional
from urllib import error, request


@dataclass
class GeneratedImageResult:
    provider: str
    model: str
    prompt: str
    mime_type: str
    image_base64: str
    finish_reason: str
    seed: int
    width: int
    height: int

    @property
    def image_data_url(self) -> str:
        return f"data:{self.mime_type};base64,{self.image_base64}"


class ImageGenerationConfigurationError(RuntimeError):
    pass


class ImageGenerationServiceError(RuntimeError):
    pass


class NvidiaImageGenerationService:
    def __init__(self) -> None:
        self.api_key = (os.getenv("NVIDIA_IMAGE_API_KEY") or os.getenv("NVIDIA_API_KEY") or "").strip()
        self.invoke_url = (
            os.getenv("NVIDIA_IMAGE_API_URL")
            or "https://ai.api.nvidia.com/v1/genai/stabilityai/stable-diffusion-3-medium"
        ).strip()
        self.model_name = (os.getenv("NVIDIA_IMAGE_MODEL") or "stable-diffusion-3-medium").strip()

    def _ensure_configured(self) -> None:
        if not self.invoke_url:
            raise ImageGenerationConfigurationError(
                "Missing NVIDIA_IMAGE_API_URL. Configure the exact NVIDIA image endpoint URL before generating images."
            )

        if self.invoke_url.startswith("https://") and not self.api_key:
            raise ImageGenerationConfigurationError(
                "Missing NVIDIA_IMAGE_API_KEY or NVIDIA_API_KEY for hosted NVIDIA image generation."
            )

    def generate_image(
        self,
        prompt: str,
        *,
        width: int = 1024,
        height: int = 1024,
        cfg_scale: float = 5.0,
        mode: str = "text-to-image",
        image: Optional[str] = None,
        negative_prompt: Optional[str] = None,
        output_format: str = "jpeg",
        seed: int = 0,
        steps: int = 30,
        samples: int = 1,
    ) -> GeneratedImageResult:
        self._ensure_configured()

        aspect_ratio = self._resolve_aspect_ratio(width, height)

        payload = {
            "prompt": prompt,
            "aspect_ratio": aspect_ratio,
            "cfg_scale": cfg_scale,
            "mode": mode,
            "model": "sd3",
            "negative_prompt": negative_prompt,
            "output_format": output_format,
            "seed": seed,
            "steps": steps,
        }
        payload = {key: value for key, value in payload.items() if value is not None}

        headers = {
            "Accept": "application/json",
            "Content-Type": "application/json",
        }
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"

        req = request.Request(
            self.invoke_url,
            data=json.dumps(payload).encode("utf-8"),
            headers=headers,
            method="POST",
        )

        try:
            with request.urlopen(req, timeout=180) as response:
                raw_body = response.read()
                content_type = (response.headers.get("Content-Type") or "").lower()
        except error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="ignore")
            raise ImageGenerationServiceError(f"Image generation failed with status {exc.code}: {detail}") from exc
        except error.URLError as exc:
            raise ImageGenerationServiceError(f"Image generation request failed: {exc.reason}") from exc

        if content_type.startswith("image/"):
            image_base64 = base64.b64encode(raw_body).decode("utf-8")
            return GeneratedImageResult(
                provider="nvidia",
                model=self.model_name,
                prompt=prompt,
                mime_type=content_type.split(";", 1)[0],
                image_base64=image_base64,
                finish_reason="SUCCESS",
                seed=seed,
                width=width,
                height=height,
            )

        body = raw_body.decode("utf-8")

        try:
            data = json.loads(body)
        except json.JSONDecodeError as exc:
            raise ImageGenerationServiceError("Image generation returned a non-JSON response.") from exc

        image_base64 = self._extract_image_base64(data)
        if not image_base64:
            raise ImageGenerationServiceError("Image generation response did not include image data.")

        try:
            base64.b64decode(image_base64, validate=True)
        except Exception as exc:
            raise ImageGenerationServiceError("Image generation response contained invalid base64 image data.") from exc

        return GeneratedImageResult(
            provider="nvidia",
            model=self.model_name,
            prompt=prompt,
            mime_type=f"image/{output_format}",
            image_base64=image_base64,
            finish_reason=self._extract_finish_reason(data),
            seed=self._extract_seed(data, seed),
            width=width,
            height=height,
        )

    @staticmethod
    def _resolve_aspect_ratio(width: int, height: int) -> str:
        known_ratios = {
            (1024, 1024): "1:1",
            (1344, 768): "16:9",
            (768, 1344): "9:16",
            (1152, 896): "5:4",
            (896, 1152): "4:5",
            (1216, 832): "3:2",
            (832, 1216): "2:3",
        }
        return known_ratios.get((width, height), "1:1")

    @staticmethod
    def _extract_image_base64(data: dict) -> str:
        artifacts = data.get("artifacts") or []
        if artifacts:
            return (artifacts[0].get("base64") or "").strip()

        candidates = [
            data.get("image"),
            data.get("image_base64"),
            data.get("b64_json"),
            data.get("base64"),
        ]
        for candidate in candidates:
            if isinstance(candidate, str) and candidate.strip():
                return candidate.strip()

        images = data.get("data") or data.get("images") or []
        if isinstance(images, list):
            for item in images:
                if isinstance(item, str) and item.strip():
                    return item.strip()
                if isinstance(item, dict):
                    for key in ("image", "b64_json", "base64", "image_base64"):
                        value = item.get(key)
                        if isinstance(value, str) and value.strip():
                            return value.strip()

        return ""

    @staticmethod
    def _extract_finish_reason(data: dict) -> str:
        artifacts = data.get("artifacts") or []
        if artifacts and artifacts[0].get("finishReason"):
            return artifacts[0]["finishReason"]
        if isinstance(data.get("finish_reason"), str):
            return data["finish_reason"]
        return "SUCCESS"

    @staticmethod
    def _extract_seed(data: dict, fallback_seed: int) -> int:
        artifacts = data.get("artifacts") or []
        if artifacts and artifacts[0].get("seed") is not None:
            return int(artifacts[0]["seed"])
        if data.get("seed") is not None:
            return int(data["seed"])
        return int(fallback_seed)