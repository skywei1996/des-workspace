import json
import importlib
import os
import re
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime
from typing import Any, Optional

from .. import config as _config  # Ensure backend/.env is loaded before reading Volcengine credentials.

DEFAULT_HOST = "api-knowledgebase.mlp.cn-beijing.volces.com"
DEFAULT_PROJECT = "default"
DEFAULT_REGION = "cn-north-1"
DEFAULT_SERVICE = "air"
SEARCH_PATH = "/api/knowledge/collection/search_knowledge"
CREATE_PATH = "/api/knowledge/collection/create"
DOC_ADD_PATH = "/api/knowledge/doc/v2/add"
DOC_LIST_PATH = "/api/knowledge/doc/list"
DOC_INFO_PATH = "/api/knowledge/doc/info"
DOC_DELETE_PATH = "/api/knowledge/doc/delete"
POINT_LIST_PATH = "/api/knowledge/point/list"
COLLECTION_DELETE_PATH = "/api/knowledge/collection/delete"


def format_timestamp(value: Optional[datetime]) -> str:
	if value is None:
		value = datetime.now()
	return value.strftime("%Y/%m/%d %H:%M:%S")


def _clean_host(value: Optional[str]) -> str:
	host = str(value or os.getenv("VOLCENGINE_KB_HOST") or DEFAULT_HOST).strip()
	return host.replace("https://", "").replace("http://", "").strip("/")


def _clean_project(value: Optional[str]) -> str:
	return str(value or os.getenv("VOLCENGINE_KB_PROJECT") or DEFAULT_PROJECT).strip() or DEFAULT_PROJECT


def _normalize_collection_name(value: Optional[str]) -> str:
	raw = str(value or "knowledge_base").strip()
	cleaned = re.sub(r"[^A-Za-z0-9_]", "_", raw)
	cleaned = re.sub(r"_+", "_", cleaned).strip("_")
	if not cleaned:
		cleaned = "knowledge_base"
	if not cleaned[0].isalpha():
		cleaned = f"kb_{cleaned}"
	return cleaned[:64]


def _normalize_doc_id(value: Optional[str]) -> str:
	raw = str(value or "doc").strip()
	cleaned = re.sub(r"[^A-Za-z0-9_]", "_", raw)
	cleaned = re.sub(r"_+", "_", cleaned).strip("_")
	if not cleaned:
		cleaned = "doc"
	if not (cleaned[0].isalpha() or cleaned[0] == "_"):
		cleaned = f"doc_{cleaned}"
	return cleaned[:128]


def infer_doc_type(*, doc_name: Optional[str] = None, uri: Optional[str] = None) -> Optional[str]:
	source = str(doc_name or uri or "").strip().lower()
	if not source:
		return None
	parsed = urllib.parse.urlparse(source)
	path = parsed.path or source
	if "." not in path:
		return None
	extension = path.rsplit(".", 1)[-1]
	alias_map = {
		"md": "markdown",
		"markdown": "markdown",
		"jpg": "jpeg",
		"jpeg": "jpeg",
	}
	return alias_map.get(extension, extension)


def _serialize_payload(payload: Optional[dict[str, Any]]) -> str:
	return json.dumps(payload or {}, ensure_ascii=False)


def _build_signed_headers(
	*,
	method: str,
	path: str,
	host: str,
	params: Optional[dict[str, Any]] = None,
	data: Optional[dict[str, Any]] = None,
) -> tuple[dict[str, str], bytes]:
	direct_authorization = (os.getenv("VOLCENGINE_KB_AUTHORIZATION") or "").strip()
	body_text = _serialize_payload(data)
	base_headers = {
		"Accept": "application/json",
		"Content-Type": "application/json",
		"Host": host,
	}

	if direct_authorization:
		headers = dict(base_headers)
		headers["Authorization"] = direct_authorization
		return headers, body_text.encode("utf-8")

	ak = (os.getenv("VOLCENGINE_ACCESS_KEY") or os.getenv("VOLCENGINE_AK") or "").strip()
	sk = (os.getenv("VOLCENGINE_SECRET_KEY") or os.getenv("VOLCENGINE_SK") or "").strip()
	if not ak or not sk:
		raise RuntimeError(
			"Missing Volcengine knowledge base credentials. Configure VOLCENGINE_KB_AUTHORIZATION or VOLCENGINE_ACCESS_KEY and VOLCENGINE_SECRET_KEY."
		)

	try:
		signer_v4_module = importlib.import_module("volcengine.auth.SignerV4")
		request_module = importlib.import_module("volcengine.base.Request")
		credentials_module = importlib.import_module("volcengine.Credentials")
	except ImportError as exc:
		raise RuntimeError(
			"The optional 'volcengine' Python package is required for AK/SK signing. Install it or provide VOLCENGINE_KB_AUTHORIZATION directly."
		) from exc

	SignerV4 = getattr(signer_v4_module, "SignerV4")
	Request = getattr(request_module, "Request")
	Credentials = getattr(credentials_module, "Credentials")

	request = Request()
	request.set_shema("https")
	request.set_method(method.upper())
	request.set_connection_timeout(10)
	request.set_socket_timeout(30)
	request.set_headers(base_headers)
	if params:
		normalized_params: dict[str, Any] = {}
		for key, value in params.items():
			if value is None:
				continue
			if isinstance(value, list):
				normalized_params[key] = ",".join(str(item) for item in value)
			elif isinstance(value, (int, float, bool)):
				normalized_params[key] = str(value)
			else:
				normalized_params[key] = value
		if normalized_params:
			request.set_query(normalized_params)
	request.set_host(host)
	request.set_path(path)
	request.set_body(body_text)

	credentials = Credentials(ak, sk, DEFAULT_SERVICE, os.getenv("VOLCENGINE_KB_REGION", DEFAULT_REGION))
	SignerV4.sign(request, credentials)
	return dict(request.headers), body_text.encode("utf-8")


def _request_json(
	*,
	method: str,
	path: str,
	data: Optional[dict[str, Any]] = None,
	params: Optional[dict[str, Any]] = None,
	host: Optional[str] = None,
	timeout: Optional[int] = None,
) -> dict[str, Any]:
	resolved_host = _clean_host(host)
	headers, body = _build_signed_headers(method=method, path=path, host=resolved_host, params=params, data=data)
	query_string = ""
	if params:
		query_string = urllib.parse.urlencode({key: value for key, value in params.items() if value is not None})
	url = f"https://{resolved_host}{path}"
	if query_string:
		url = f"{url}?{query_string}"

	request = urllib.request.Request(url, data=body, headers=headers, method=method.upper())
	try:
		with urllib.request.urlopen(request, timeout=timeout or int(os.getenv("VOLCENGINE_KB_TIMEOUT_SECONDS") or 30)) as response:
			content = response.read().decode("utf-8")
	except urllib.error.HTTPError as exc:
		detail = exc.read().decode("utf-8", errors="ignore")
		raise RuntimeError(f"Volcengine knowledge base request failed with HTTP {exc.code}: {detail}") from exc
	except urllib.error.URLError as exc:
		raise RuntimeError(f"Volcengine knowledge base request failed: {exc.reason}") from exc

	try:
		payload = json.loads(content)
	except json.JSONDecodeError as exc:
		raise RuntimeError(f"Volcengine knowledge base returned non-JSON content: {content[:500]}") from exc

	if payload.get("code") not in (0, "0", None):
		raise RuntimeError(payload.get("message") or f"Unexpected Volcengine response: {payload}")
	return payload


def create_remote_collection(
	*,
	name: str,
	description: str = "",
	project: Optional[str] = None,
	host: Optional[str] = None,
) -> dict[str, Any]:
	collection_name = _normalize_collection_name(name)
	request_data = {
		"name": collection_name,
		"project": _clean_project(project),
		"description": description or "",
		"data_type": "unstructured_data",
		"preprocessing": {
			"chunking_strategy": os.getenv("VOLCENGINE_KB_CHUNKING_STRATEGY", "custom_balance"),
			"multi_modal": ["image_ocr"],
		},
		"index": {
			"cpu_quota": int(os.getenv("VOLCENGINE_KB_CPU_QUOTA") or 1),
			"embedding_model": os.getenv("VOLCENGINE_KB_EMBEDDING_MODEL", "doubao-embedding-and-m3"),
			"embedding_dimension": int(os.getenv("VOLCENGINE_KB_EMBEDDING_DIMENSION") or 2048),
			"quant": os.getenv("VOLCENGINE_KB_QUANT", "int8"),
			"index_type": os.getenv("VOLCENGINE_KB_INDEX_TYPE", "hnsw_hybrid"),
		},
	}
	payload = _request_json(method="POST", path=CREATE_PATH, data=request_data, host=host)
	data = payload.get("data") or {}
	return {
		"request_id": payload.get("request_id"),
		"resource_id": data.get("resource_id") or data.get("id") or "",
		"collection_name": data.get("collection_name") or data.get("name") or collection_name,
		"project": data.get("project") or _clean_project(project),
		"host": _clean_host(host),
		"status": data.get("status") or "synced",
		"raw": payload,
	}


def add_document_by_uri(
	*,
	resource_id: Optional[str] = None,
	collection_name: Optional[str] = None,
	project: Optional[str] = None,
	host: Optional[str] = None,
	doc_id: str,
	doc_name: Optional[str],
	doc_type: Optional[str],
	uri: str,
	description: str = "",
	tag_list: Optional[list[dict[str, Any]]] = None,
) -> dict[str, Any]:
	request_data: dict[str, Any] = {
		"project": _clean_project(project),
		"doc_id": _normalize_doc_id(doc_id),
		"uri": str(uri or "").strip(),
	}
	if resource_id:
		request_data["resource_id"] = resource_id
	elif collection_name:
		request_data["collection_name"] = collection_name
	else:
		raise RuntimeError("Either resource_id or collection_name is required when importing a document.")

	clean_name = str(doc_name or "").strip()
	if clean_name:
		request_data["doc_name"] = clean_name
	resolved_type = str(doc_type or infer_doc_type(doc_name=doc_name, uri=uri) or "").strip().lower()
	if resolved_type:
		request_data["doc_type"] = resolved_type
	clean_description = str(description or "").strip()
	if clean_description:
		request_data["description"] = clean_description
	if tag_list:
		request_data["tag_list"] = tag_list

	payload = _request_json(method="POST", path=DOC_ADD_PATH, data=request_data, host=host)
	data = payload.get("data") or {}
	return {
		"request_id": payload.get("request_id"),
		"collection_name": data.get("collection_name") or collection_name or "",
		"resource_id": data.get("resource_id") or resource_id or "",
		"project": data.get("project") or _clean_project(project),
		"doc_id": data.get("doc_id") or request_data["doc_id"],
		"doc_name": clean_name or None,
		"doc_type": resolved_type or None,
		"uri": request_data["uri"],
		"raw": payload,
	}


def list_documents(
	*,
	resource_id: Optional[str] = None,
	collection_name: Optional[str] = None,
	project: Optional[str] = None,
	host: Optional[str] = None,
) -> dict[str, Any]:
	request_data: dict[str, Any] = {
		"project": _clean_project(project),
	}
	if resource_id:
		request_data["resource_id"] = resource_id
	elif collection_name:
		request_data["collection_name"] = collection_name
	else:
		raise RuntimeError("Either resource_id or collection_name is required when listing documents.")

	payload = _request_json(method="POST", path=DOC_LIST_PATH, data=request_data, host=host)
	data = payload.get("data") or {}
	return {
		"request_id": payload.get("request_id"),
		"collection_name": data.get("collection_name") or collection_name or "",
		"total_num": int(data.get("total_num") or 0),
		"count": int(data.get("count") or 0),
		"doc_list": data.get("doc_list") or [],
		"raw": payload,
	}


def get_document_info(
	*,
	doc_id: str,
	resource_id: Optional[str] = None,
	collection_name: Optional[str] = None,
	project: Optional[str] = None,
	host: Optional[str] = None,
) -> dict[str, Any]:
	request_data: dict[str, Any] = {
		"project": _clean_project(project),
		"doc_id": _normalize_doc_id(doc_id),
	}
	if resource_id:
		request_data["resource_id"] = resource_id
	elif collection_name:
		request_data["collection_name"] = collection_name
	else:
		raise RuntimeError("Either resource_id or collection_name is required when querying document info.")

	payload = _request_json(method="POST", path=DOC_INFO_PATH, data=request_data, host=host)
	return {
		"request_id": payload.get("request_id"),
		"data": payload.get("data") or {},
		"raw": payload,
	}


def delete_document(
	*,
	doc_id: str,
	resource_id: Optional[str] = None,
	collection_name: Optional[str] = None,
	project: Optional[str] = None,
	host: Optional[str] = None,
	pipeline_name: Optional[str] = None,
) -> dict[str, Any]:
	request_data: dict[str, Any] = {
		"project": _clean_project(project),
		"doc_id": _normalize_doc_id(doc_id),
	}
	if resource_id:
		request_data["resource_id"] = resource_id
	elif collection_name:
		request_data["collection_name"] = collection_name
	else:
		raise RuntimeError("Either resource_id or collection_name is required when deleting a document.")
	if pipeline_name:
		request_data["pipeline_name"] = str(pipeline_name).strip()

	payload = _request_json(method="POST", path=DOC_DELETE_PATH, data=request_data, host=host)
	return {
		"request_id": payload.get("request_id"),
		"raw": payload,
	}


def delete_remote_collection(
	*,
	resource_id: Optional[str] = None,
	collection_name: Optional[str] = None,
	project: Optional[str] = None,
	host: Optional[str] = None,
) -> dict[str, Any]:
	request_data: dict[str, Any] = {
		"project": _clean_project(project),
	}
	if resource_id:
		request_data["resource_id"] = resource_id
	elif collection_name:
		request_data["name"] = collection_name
	else:
		raise RuntimeError("Either resource_id or collection_name is required when deleting a knowledge base.")

	payload = _request_json(method="POST", path=COLLECTION_DELETE_PATH, data=request_data, host=host)
	return {
		"request_id": payload.get("request_id"),
		"raw": payload,
	}


def list_document_points(
	*,
	resource_id: Optional[str] = None,
	collection_name: Optional[str] = None,
	project: Optional[str] = None,
	host: Optional[str] = None,
	doc_ids: Optional[list[str]] = None,
	get_attachment_link: bool = False,
	limit: int = 100,
) -> dict[str, Any]:
	request_base: dict[str, Any] = {
		"project": _clean_project(project),
		"limit": max(1, min(int(limit or 100), 100)),
	}
	if get_attachment_link:
		request_base["get_attachment_link"] = True
	if resource_id:
		request_base["resource_id"] = resource_id
	elif collection_name:
		request_base["collection_name"] = collection_name
	else:
		raise RuntimeError("Either resource_id or collection_name is required when listing document points.")

	filtered_doc_ids = [
		_normalize_doc_id(doc_id)
		for doc_id in (doc_ids or [])
		if str(doc_id or "").strip()
	]
	if filtered_doc_ids:
		request_base["doc_ids"] = filtered_doc_ids

	offset = 0
	total_num = 0
	point_list: list[dict[str, Any]] = []
	request_id = None
	raw_payloads: list[dict[str, Any]] = []

	while True:
		request_data = dict(request_base)
		request_data["offset"] = offset
		payload = _request_json(method="POST", path=POINT_LIST_PATH, data=request_data, host=host)
		raw_payloads.append(payload)
		request_id = payload.get("request_id") or request_id
		data = payload.get("data") or {}
		page_points = data.get("point_list") or []
		total_num = int(data.get("total_num") or total_num or 0)
		point_list.extend(page_points)
		count = int(data.get("count") or len(page_points))
		if count <= 0 or len(page_points) < request_base["limit"]:
			break
		offset += count
		if total_num and offset >= total_num:
			break

	return {
		"request_id": request_id,
		"collection_name": collection_name or "",
		"total_num": total_num or len(point_list),
		"count": len(point_list),
		"point_list": point_list,
		"raw": raw_payloads,
	}


def search_knowledge(
	*,
	query: str,
	resource_id: Optional[str] = None,
	name: Optional[str] = None,
	project: Optional[str] = None,
	host: Optional[str] = None,
	messages: Optional[list[dict[str, str]]] = None,
	limit: int = 4,
	rewrite: bool = True,
	rerank_switch: bool = True,
	chunk_group: bool = True,
	retrieve_count: int = 10,
) -> dict[str, Any]:
	request_data: dict[str, Any] = {
		"project": _clean_project(project),
		"query": (query or "").strip(),
		"limit": max(1, min(int(limit or 4), 20)),
		"pre_processing": {
			"rewrite": bool(rewrite and messages and len(messages) >= 2),
			"messages": messages or [],
			"return_token_usage": True,
		},
		"post_processing": {
			"rerank_switch": bool(rerank_switch),
			"retrieve_count": max(int(retrieve_count or 10), int(limit or 4)),
			"rerank_model": os.getenv("VOLCENGINE_KB_RERANK_MODEL", "base-multilingual-rerank"),
			"chunk_group": bool(chunk_group),
		},
	}
	if resource_id:
		request_data["resource_id"] = resource_id
	else:
		request_data["name"] = name

	return _request_json(method="POST", path=SEARCH_PATH, data=request_data, host=host)


def format_search_hits(*, knowledge_base_id: str, knowledge_base_name: str, search_payload: dict[str, Any]) -> tuple[list[dict[str, Any]], dict[str, Any]]:
	data = search_payload.get("data") or {}
	result_list = []
	for item in data.get("result_list") or []:
		doc_info = item.get("doc_info") or {}
		result_list.append(
			{
				"knowledge_base_id": knowledge_base_id,
				"knowledge_base_name": knowledge_base_name,
				"document_id": doc_info.get("doc_id"),
				"document_name": doc_info.get("doc_name") or doc_info.get("title"),
				"chunk_id": item.get("chunk_id"),
				"chunk_title": item.get("chunk_title"),
				"content": str(item.get("content") or "").strip(),
				"score": item.get("score"),
				"rerank_score": item.get("rerank_score"),
				"recall_position": item.get("recall_position"),
				"rerank_position": item.get("rerank_position"),
				"chunk_type": item.get("chunk_type"),
				"original_coordinate": item.get("original_coordinate"),
			}
		)

	meta = {
		"rewrite_query": data.get("rewrite_query"),
		"request_id": search_payload.get("request_id"),
		"token_usage": data.get("token_usage"),
		"count": data.get("count") or len(result_list),
	}
	return result_list, meta
