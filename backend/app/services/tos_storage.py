import os
from datetime import datetime
from typing import Optional
from urllib.parse import urlparse
import mimetypes

import tos


DEFAULT_TOS_REGION = "cn-beijing"


def _get_bucket_name() -> str:
    bucket_name = str(os.getenv("TOS_BUCKET_NAME") or "").strip()
    if not bucket_name:
        raise RuntimeError("Missing TOS_BUCKET_NAME. Configure the target TOS bucket name in backend/.env.")
    return bucket_name


def _get_endpoint() -> str:
    endpoint = str(os.getenv("TOS_ENDPOINT") or "").strip()
    if endpoint:
        return endpoint.replace("https://", "").replace("http://", "").strip("/")
    region = str(os.getenv("TOS_REGION") or DEFAULT_TOS_REGION).strip() or DEFAULT_TOS_REGION
    return f"tos-{region}.volces.com"


def _get_region() -> str:
    return str(os.getenv("TOS_REGION") or DEFAULT_TOS_REGION).strip() or DEFAULT_TOS_REGION


def _get_client() -> tos.TosClientV2:
    ak = (os.getenv("TOS_ACCESS_KEY") or os.getenv("VOLCENGINE_ACCESS_KEY") or os.getenv("VOLCENGINE_AK") or "").strip()
    sk = (os.getenv("TOS_SECRET_KEY") or os.getenv("VOLCENGINE_SECRET_KEY") or os.getenv("VOLCENGINE_SK") or "").strip()
    if not ak or not sk:
        raise RuntimeError("Missing TOS credentials. Configure TOS_ACCESS_KEY/TOS_SECRET_KEY or reuse VOLCENGINE_ACCESS_KEY/VOLCENGINE_SECRET_KEY.")

    return tos.TosClientV2(
        ak=ak,
        sk=sk,
        endpoint=_get_endpoint(),
        region=_get_region(),
    )


def build_object_key(*, knowledge_base_id: str, file_name: str) -> str:
    safe_name = (file_name or "document").replace("\\", "/").split("/")[-1].strip() or "document"
    prefix = str(os.getenv("TOS_OBJECT_PREFIX") or "des-knowledge").strip().strip("/") or "des-knowledge"
    timestamp = datetime.now().strftime("%Y%m%d/%H%M%S")
    return f"{prefix}/{knowledge_base_id}/{timestamp}_{safe_name}"


def upload_bytes_to_tos(*, knowledge_base_id: str, file_name: str, content: bytes, content_type: Optional[str] = None) -> dict:
    bucket_name = _get_bucket_name()
    object_key = build_object_key(knowledge_base_id=knowledge_base_id, file_name=file_name)
    client = _get_client()
    client.put_object(
        bucket=bucket_name,
        key=object_key,
        content=content,
        content_type=content_type or None,
    )
    return {
        "bucket": bucket_name,
        "key": object_key,
        "uri": f"tos://{bucket_name}/{object_key}",
        "endpoint": _get_endpoint(),
        "region": _get_region(),
    }


def parse_tos_uri(uri: str) -> tuple[str, str]:
    parsed = urlparse(str(uri or "").strip())
    if parsed.scheme != "tos":
        raise RuntimeError(f"Unsupported TOS uri: {uri}")
    bucket_name = (parsed.netloc or "").strip()
    object_key = (parsed.path or "").lstrip("/").strip()
    if not bucket_name or not object_key:
        raise RuntimeError(f"Invalid TOS uri: {uri}")
    return bucket_name, object_key


def delete_tos_object(*, bucket_name: str, object_key: str) -> None:
    client = _get_client()
    client.delete_object(bucket=bucket_name, key=object_key)


def delete_tos_object_by_uri(uri: str) -> None:
    bucket_name, object_key = parse_tos_uri(uri)
    delete_tos_object(bucket_name=bucket_name, object_key=object_key)


def get_tos_object_bytes(*, bucket_name: str, object_key: str) -> tuple[bytes, Optional[str]]:
    client = _get_client()
    output = client.get_object(bucket=bucket_name, key=object_key)

    content = b""
    if hasattr(output, "read") and callable(output.read):
        content = output.read()
    elif hasattr(output, "content"):
        content = getattr(output, "content") or b""

    content_type = None
    if hasattr(output, "content_type"):
        content_type = getattr(output, "content_type")
    elif hasattr(output, "headers") and getattr(output, "headers") is not None:
        headers = getattr(output, "headers")
        if isinstance(headers, dict):
            content_type = headers.get("content-type") or headers.get("Content-Type")

    if not content_type:
        content_type = mimetypes.guess_type(object_key)[0]

    return content, content_type


def get_tos_object_bytes_by_uri(uri: str) -> tuple[bytes, Optional[str], str, str]:
    bucket_name, object_key = parse_tos_uri(uri)
    content, content_type = get_tos_object_bytes(bucket_name=bucket_name, object_key=object_key)
    return content, content_type, bucket_name, object_key


def delete_tos_prefix(*, prefix: str, bucket_name: Optional[str] = None) -> int:
    client = _get_client()
    resolved_bucket_name = bucket_name or _get_bucket_name()
    continuation_token = None
    deleted_count = 0

    while True:
        output = client.list_objects_type2(
            bucket=resolved_bucket_name,
            prefix=prefix,
            continuation_token=continuation_token,
            max_keys=1000,
        )
        contents = getattr(output, "contents", None) or []
        for item in contents:
            object_key = getattr(item, "key", None)
            if not object_key:
                continue
            client.delete_object(bucket=resolved_bucket_name, key=object_key)
            deleted_count += 1

        if not getattr(output, "is_truncated", False):
            break

        continuation_token = getattr(output, "next_continuation_token", None)
        if not continuation_token:
            break

    return deleted_count


def build_knowledge_base_prefix(knowledge_base_id: str) -> str:
    prefix = str(os.getenv("TOS_OBJECT_PREFIX") or "des-knowledge").strip().strip("/") or "des-knowledge"
    return f"{prefix}/{knowledge_base_id}/"