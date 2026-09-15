import json
import socket
import time
from typing import Any, Dict
from urllib import error as urllib_error
from urllib import parse as urllib_parse
from urllib import request as urllib_request

from app.config import DEFAULT_AZURE_API_VERSION


OPENAI_PROVIDER = "Open AI Compatible"
AZURE_OPENAI_PROVIDER = "Azure OpenAI Compatible"


def test_model_connection(provider_type: str, model_name: str, api_endpoint: str, api_key: str) -> Dict[str, Any]:
    normalized_provider = (provider_type or "").strip()
    normalized_model = (model_name or "").strip()
    normalized_endpoint = (api_endpoint or "").strip()
    normalized_key = (api_key or "").strip()

    if not normalized_provider:
        return _field_failure("providerType", "Provider Type", "INVALID_CONFIGURATION", "Provider type is required.", "Please select a provider type.")
    if not normalized_endpoint:
        return _field_failure("apiEndpoint", "API Endpoint", "INVALID_CONFIGURATION", "API endpoint is required.", "Please provide the API endpoint and try again.")
    if not normalized_key:
        return _field_failure("apiKey", "API Key", "AUTH_INVALID", "API Key is required.", "Please provide a valid API Key and try again.")

    provider_validation = _validate_provider_configuration(normalized_provider, normalized_model, normalized_endpoint)
    if provider_validation is not None:
        return provider_validation

    try:
        if normalized_provider == OPENAI_PROVIDER:
            if not normalized_model:
                return _field_failure(
                    "modelName",
                    "Model Name",
                    "INVALID_CONFIGURATION",
                    "Model name is required for OpenAI compatible connections.",
                    "Please enter the model name and try again.",
                )
            return _test_openai_compatible(normalized_model, normalized_endpoint, normalized_key)

        if normalized_provider == AZURE_OPENAI_PROVIDER:
            return _test_azure_openai_compatible(normalized_model, normalized_endpoint, normalized_key)

        return _failure(
            "INVALID_CONFIGURATION",
            f"Unsupported provider type: {normalized_provider}",
            "Please choose a supported provider type and try again.",
            details={"field": "providerType", "fieldLabel": "Provider Type", "reason": f"Unsupported provider type: {normalized_provider}"},
        )
    except socket.timeout:
        return _field_failure("apiEndpoint", "API Endpoint", "NETWORK_TIMEOUT", "Connection test timed out.", "Please retry or check the endpoint and network connectivity.")
    except urllib_error.URLError as exc:
        return _field_failure(
            "apiEndpoint",
            "API Endpoint",
            "ENDPOINT_UNREACHABLE",
            "Unable to reach the model endpoint.",
            "Please check the endpoint address and network connectivity.",
            details={"reason": str(getattr(exc, "reason", exc))},
        )
    except Exception as exc:
        return _failure(
            "TEST_FAILED",
            "Connection test failed.",
            "Please review the configuration and try again.",
            details={"error": str(exc)},
        )


def _validate_provider_configuration(provider_type: str, model_name: str, api_endpoint: str) -> Dict[str, Any] | None:
    parsed = urllib_parse.urlparse(api_endpoint)
    if not parsed.scheme or not parsed.netloc:
        return _field_failure(
            "apiEndpoint",
            "API Endpoint",
            "INVALID_CONFIGURATION",
            "API endpoint is not a valid URL.",
            "Please enter a complete URL, including https://.",
            details={"reason": "The endpoint must include a valid protocol and hostname."},
        )

    lowered_host = parsed.netloc.lower()
    lowered_path = parsed.path.lower()

    if provider_type == OPENAI_PROVIDER and ("openai.azure.com" in lowered_host or "/deployments/" in lowered_path):
        return _field_failure(
            "providerType",
            "Provider Type",
            "PROVIDER_MISMATCH",
            "Provider type does not match the endpoint format.",
            "This endpoint looks like Azure OpenAI. Please switch Provider Type to Azure OpenAI Compatible.",
            details={"reason": "The endpoint contains an Azure host or deployment path."},
        )

    if provider_type == AZURE_OPENAI_PROVIDER:
        if "openai.azure.com" not in lowered_host:
            return _field_failure(
                "apiEndpoint",
                "API Endpoint",
                "INVALID_CONFIGURATION",
                "Azure endpoint host is invalid.",
                "Please use an Azure OpenAI endpoint such as https://{resource}.openai.azure.com/openai/deployments/{deployment}.",
                details={"reason": "Azure OpenAI endpoints should use an *.openai.azure.com host."},
            )
        if "/openai/deployments/" not in lowered_path:
            return _field_failure(
                "apiEndpoint",
                "API Endpoint",
                "INVALID_CONFIGURATION",
                "Azure deployment path is missing from the endpoint.",
                "Please include /openai/deployments/{deployment-name} in the endpoint.",
                details={"reason": "The endpoint must point to a specific Azure OpenAI deployment."},
            )

    if provider_type == OPENAI_PROVIDER and not model_name:
        return _field_failure(
            "modelName",
            "Model Name",
            "INVALID_CONFIGURATION",
            "Model name is required for OpenAI compatible connections.",
            "Please enter the upstream model name and try again.",
        )

    return None


def _test_openai_compatible(model_name: str, api_endpoint: str, api_key: str) -> Dict[str, Any]:
    endpoint = _normalize_openai_base_url(api_endpoint)
    url = f"{endpoint}/chat/completions"
    payload = {
        "model": model_name,
        "messages": [{"role": "user", "content": "ping"}],
        "max_tokens": 1,
    }
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}",
    }
    return _perform_request(url, headers, payload, provider_type=OPENAI_PROVIDER)


def _test_azure_openai_compatible(model_name: str, api_endpoint: str, api_key: str) -> Dict[str, Any]:
    endpoint = _normalize_azure_chat_url(api_endpoint)
    payload = {
        "messages": [{"role": "user", "content": "ping"}],
        "max_tokens": 1,
    }
    if model_name:
        payload["model"] = model_name
    headers = {
        "Content-Type": "application/json",
        "api-key": api_key,
    }
    return _perform_request(endpoint, headers, payload, provider_type=AZURE_OPENAI_PROVIDER)


def _perform_request(url: str, headers: Dict[str, str], payload: Dict[str, Any], provider_type: str) -> Dict[str, Any]:
    start = time.perf_counter()
    request = urllib_request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers=headers,
        method="POST",
    )

    try:
        with urllib_request.urlopen(request, timeout=10) as response:
            latency_ms = int((time.perf_counter() - start) * 1000)
            body = response.read().decode("utf-8") if response.length != 0 else ""
            parsed = json.loads(body) if body else {}
            if not _looks_like_success(parsed):
                return _failure(
                    "INVALID_RESPONSE",
                    "Model endpoint returned an unexpected response.",
                    "Please verify the endpoint configuration and try again.",
                    latency_ms=latency_ms,
                    details={"response": parsed},
                )
            return {
                "ok": True,
                "message": "Connection successful. The model responded normally.",
                "latency_ms": latency_ms,
                "checked_at": _timestamp(),
                "suggestion": None,
                "error_code": None,
                "details": {
                    "provider_type": provider_type,
                    "request_id": _extract_request_id(dict(response.headers)),
                },
            }
    except urllib_error.HTTPError as exc:
        latency_ms = int((time.perf_counter() - start) * 1000)
        body = exc.read().decode("utf-8", errors="replace") if exc.fp is not None else ""
        parsed = _safe_json_loads(body)
        return _map_http_error(exc.code, parsed, latency_ms, provider_type)


def _looks_like_success(payload: Dict[str, Any]) -> bool:
    if isinstance(payload.get("choices"), list):
        return True
    return False


def _normalize_openai_base_url(api_endpoint: str) -> str:
    endpoint = api_endpoint.strip().rstrip("/")
    if endpoint.endswith("/chat/completions"):
        endpoint = endpoint[: -len("/chat/completions")]
    return endpoint


def _normalize_azure_chat_url(api_endpoint: str) -> str:
    endpoint = api_endpoint.strip()
    parsed = urllib_parse.urlparse(endpoint)
    if not parsed.scheme or not parsed.netloc:
        raise ValueError("Azure endpoint must be a valid URL.")

    path = parsed.path.rstrip("/")
    if not path:
        raise ValueError("Azure endpoint must include the deployment path.")
    if not path.endswith("/chat/completions"):
        path = f"{path}/chat/completions"

    query = urllib_parse.parse_qs(parsed.query, keep_blank_values=True)
    if "api-version" not in query:
        query["api-version"] = [DEFAULT_AZURE_API_VERSION]

    return urllib_parse.urlunparse((
        parsed.scheme,
        parsed.netloc,
        path,
        parsed.params,
        urllib_parse.urlencode(query, doseq=True),
        parsed.fragment,
    ))


def _map_http_error(status_code: int, payload: Dict[str, Any], latency_ms: int, provider_type: str) -> Dict[str, Any]:
    message_text = _extract_error_message(payload)
    lowered = message_text.lower()

    if status_code in {401, 403}:
        return _field_failure("apiKey", "API Key", "AUTH_INVALID", "API Key is invalid or does not have access.", "Please check the API Key permissions and try again.", latency_ms, {"provider_type": provider_type, "reason": message_text})
    if status_code == 404:
        if provider_type == AZURE_OPENAI_PROVIDER or "deploymentnotfound" in lowered or "deployment" in lowered:
            return _field_failure("apiEndpoint", "API Endpoint", "DEPLOYMENT_NOT_FOUND", "Model deployment was not found.", "Please verify the Azure deployment name in the endpoint and try again.", latency_ms, {"provider_type": provider_type, "reason": message_text})
        return _field_failure("modelName", "Model Name", "MODEL_NOT_FOUND", "Model was not found.", "Please verify the model name and try again.", latency_ms, {"provider_type": provider_type, "reason": message_text})
    if status_code == 429:
        return _failure("QUOTA_EXCEEDED", "Request was rate limited or quota was exceeded.", "Please check quota limits or retry later.", latency_ms, {"provider_type": provider_type, "error": message_text})
    if status_code >= 500:
        return _failure("UPSTREAM_UNAVAILABLE", "Model service is temporarily unavailable.", "Please retry later. If the issue persists, contact the administrator.", latency_ms, {"provider_type": provider_type, "error": message_text})
    if "timeout" in lowered:
        return _failure("NETWORK_TIMEOUT", "Connection test timed out.", "Please retry or check the endpoint and network connectivity.", latency_ms, {"provider_type": provider_type, "error": message_text})
    return _failure("TEST_FAILED", "Connection test failed.", "Please review the configuration and try again.", latency_ms, {"provider_type": provider_type, "error": message_text, "status_code": status_code})


def _extract_error_message(payload: Dict[str, Any]) -> str:
    error_value = payload.get("error")
    if isinstance(error_value, dict):
        return str(error_value.get("message") or error_value.get("code") or error_value)
    if isinstance(error_value, str):
        return error_value
    detail = payload.get("detail")
    if isinstance(detail, str):
        return detail
    return "Unknown upstream error"


def _extract_request_id(headers: Dict[str, str]) -> str | None:
    for key in ("x-request-id", "request-id", "apim-request-id"):
        value = headers.get(key) or headers.get(key.title())
        if value:
            return value
    return None


def _safe_json_loads(value: str) -> Dict[str, Any]:
    try:
        loaded = json.loads(value) if value else {}
        return loaded if isinstance(loaded, dict) else {"raw": loaded}
    except json.JSONDecodeError:
        return {"raw": value}


def _failure(
    error_code: str,
    message: str,
    suggestion: str,
    latency_ms: int | None = None,
    details: Dict[str, Any] | None = None,
) -> Dict[str, Any]:
    return {
        "ok": False,
        "message": message,
        "latency_ms": latency_ms,
        "checked_at": _timestamp(),
        "suggestion": suggestion,
        "error_code": error_code,
        "details": details,
    }


def _field_failure(
    field: str,
    field_label: str,
    error_code: str,
    message: str,
    suggestion: str,
    latency_ms: int | None = None,
    details: Dict[str, Any] | None = None,
) -> Dict[str, Any]:
    next_details = {
        "field": field,
        "fieldLabel": field_label,
    }
    if details:
        next_details.update(details)
    return _failure(error_code, message, suggestion, latency_ms, next_details)


def _timestamp() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())