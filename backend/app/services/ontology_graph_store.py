import json
import os
import re
from copy import deepcopy
from datetime import datetime, timezone
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from uuid import uuid4


DGRAPH_SCHEMA = """
ontology.id: string @index(exact) @upsert .
ontology.identity: string @index(exact) @upsert .
ontology.object_type_id: string @index(exact) .
ontology.primary_key: string @index(exact) .
ontology.display_name: string @index(term, trigram) .
ontology.properties: string .
ontology.property_exact: [string] @index(exact) .
ontology.search_text: string @index(trigram) .
ontology.source: string .
ontology.updated_at: datetime @index(hour) .
link.id: string @index(exact) @upsert .
link.identity: string @index(exact) @upsert .
link.type_id: string @index(exact) .
link.source: uid @reverse .
link.target: uid @reverse .
link.properties: string .
link.origin: string .
link.updated_at: datetime @index(hour) .
type OntologyObject {
  ontology.id
  ontology.identity
  ontology.object_type_id
  ontology.primary_key
  ontology.display_name
  ontology.properties
  ontology.property_exact
  ontology.search_text
  ontology.source
  ontology.updated_at
}
type OntologyLink {
  link.id
  link.identity
  link.type_id
  link.source
  link.target
  link.properties
  link.origin
  link.updated_at
}
""".strip()


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _property_token(name: str, value) -> str:
    return json.dumps([name, str(value)], ensure_ascii=False, separators=(",", ":"))


def _object_identity(object_type_id: str, primary_key: str) -> str:
    return f"{object_type_id}\u0000{primary_key}"


def _link_identity(link_type_id: str, source_id: str, target_id: str) -> str:
    return f"{link_type_id}\u0000{source_id}\u0000{target_id}"


def _dql_values(values: list[str]) -> str:
    return "[" + ", ".join(json.dumps(value, ensure_ascii=False) for value in values) + "]"


def _serialize_object(item: dict, depth: int | None = None) -> dict:
    payload = {
        "id": item["id"],
        "objectTypeId": item["objectTypeId"],
        "primaryKey": item["primaryKey"],
        "displayName": item["displayName"],
        "properties": deepcopy(item.get("properties") or {}),
        "source": item.get("source", "manual"),
        "updatedAt": item.get("updatedAt"),
    }
    if depth is not None:
        payload["depth"] = depth
    return payload


def _serialize_link(item: dict) -> dict:
    return {
        "id": item["id"],
        "linkTypeId": item["linkTypeId"],
        "sourceInstanceId": item["sourceInstanceId"],
        "targetInstanceId": item["targetInstanceId"],
        "properties": deepcopy(item.get("properties") or {}),
        "source": item.get("source", "manual"),
        "updatedAt": item.get("updatedAt"),
    }


class OntologyGraphStoreError(RuntimeError):
    pass


class InMemoryOntologyGraphStore:
    def __init__(self):
        self.objects: dict[str, dict] = {}
        self.links: dict[str, dict] = {}

    def ensure_schema(self):
        return None

    def upsert_objects(self, objects: list[dict]) -> list[dict]:
        results = []
        for item in objects:
            existing = next(
                (
                    value
                    for value in self.objects.values()
                    if value["objectTypeId"] == item["objectTypeId"]
                    and value["primaryKey"] == item["primaryKey"]
                ),
                None,
            )
            object_id = existing["id"] if existing else item.get("id") or str(uuid4())
            value = {
                "id": object_id,
                "objectTypeId": item["objectTypeId"],
                "primaryKey": item["primaryKey"],
                "displayName": item["displayName"],
                "properties": deepcopy(item.get("properties") or {}),
                "source": item.get("source", "manual"),
                "updatedAt": _now(),
            }
            self.objects[object_id] = value
            results.append(_serialize_object(value))
        return results

    def upsert_links(self, links: list[dict]) -> list[dict]:
        results = []
        for item in links:
            if item["sourceInstanceId"] not in self.objects or item["targetInstanceId"] not in self.objects:
                raise ValueError("sourceInstanceId and targetInstanceId must reference existing objects")
            existing = next(
                (
                    value
                    for value in self.links.values()
                    if value["linkTypeId"] == item["linkTypeId"]
                    and value["sourceInstanceId"] == item["sourceInstanceId"]
                    and value["targetInstanceId"] == item["targetInstanceId"]
                ),
                None,
            )
            link_id = existing["id"] if existing else item.get("id") or str(uuid4())
            value = {
                "id": link_id,
                "linkTypeId": item["linkTypeId"],
                "sourceInstanceId": item["sourceInstanceId"],
                "targetInstanceId": item["targetInstanceId"],
                "properties": deepcopy(item.get("properties") or {}),
                "source": item.get("source", "manual"),
                "updatedAt": _now(),
            }
            self.links[link_id] = value
            results.append(_serialize_link(value))
        return results

    def search_objects(self, query="", object_type_id=None, property_name=None, property_value=None, limit=50):
        normalized_query = query.strip().lower()
        matches = []
        for item in self.objects.values():
            if object_type_id and item["objectTypeId"] != object_type_id:
                continue
            if property_name and property_value is not None:
                if str(item.get("properties", {}).get(property_name)) != property_value:
                    continue
            if normalized_query:
                searchable = [item["displayName"], item["primaryKey"]]
                searchable.extend(str(value) for value in item.get("properties", {}).values())
                if not any(normalized_query in value.lower() for value in searchable):
                    continue
            matches.append(item)
        matches.sort(key=lambda item: item.get("updatedAt") or "", reverse=True)
        return [_serialize_object(item) for item in matches[:limit]]

    def traverse(self, start_instance_ids, max_hops, direction, link_type_ids, limit):
        missing = set(start_instance_ids) - self.objects.keys()
        if missing:
            raise KeyError("one or more start instances were not found")
        depths = {instance_id: 0 for instance_id in start_instance_ids}
        frontier = set(start_instance_ids)
        traversed_links = {}
        truncated = False
        for depth in range(1, max_hops + 1):
            next_frontier = set()
            for link in self.links.values():
                if link_type_ids and link["linkTypeId"] not in link_type_ids:
                    continue
                candidates = []
                if direction in {"out", "both"} and link["sourceInstanceId"] in frontier:
                    candidates.append(link["targetInstanceId"])
                if direction in {"in", "both"} and link["targetInstanceId"] in frontier:
                    candidates.append(link["sourceInstanceId"])
                for instance_id in candidates:
                    traversed_links[link["id"]] = link
                    if instance_id not in depths:
                        if len(depths) >= limit:
                            truncated = True
                            break
                        depths[instance_id] = depth
                        next_frontier.add(instance_id)
                if truncated:
                    break
            frontier = next_frontier
            if truncated or not frontier:
                break
        nodes = sorted(
            (_serialize_object(self.objects[instance_id], depth) for instance_id, depth in depths.items()),
            key=lambda item: (item["depth"], item["displayName"]),
        )
        return {
            "nodes": nodes,
            "links": [_serialize_link(link) for link in traversed_links.values()],
            "maxDepthReached": max(depths.values(), default=0),
            "truncated": truncated,
        }


class DgraphOntologyGraphStore:
    def __init__(self, base_url: str | None = None, timeout: float = 15):
        self.base_url = (base_url or os.getenv("DGRAPH_URL", "http://127.0.0.1:8080")).rstrip("/")
        self.timeout = timeout
        self._schema_ready = False

    def _request(self, path: str, body: str, content_type: str) -> dict:
        request = Request(
            f"{self.base_url}{path}",
            data=body.encode("utf-8"),
            headers={"Content-Type": content_type},
            method="POST",
        )
        try:
            with urlopen(request, timeout=self.timeout) as response:
                payload = response.read().decode("utf-8")
        except (HTTPError, URLError, TimeoutError) as error:
            raise OntologyGraphStoreError(f"Dgraph request failed: {error}") from error
        return json.loads(payload) if payload else {}

    def ensure_schema(self):
        self._request("/alter", DGRAPH_SCHEMA, "application/dql")
        self._schema_ready = True

    def _ensure_schema(self):
        if not self._schema_ready:
            self.ensure_schema()

    def _query(self, query: str, variables: dict | None = None) -> dict:
        path = "/query"
        if variables:
            path += "?" + urlencode(variables)
        payload = self._request(path, query, "application/dql")
        return payload.get("data", payload)

    def _mutate(self, items: list[dict], deletes: list[dict] | None = None):
        mutation = {"set": items}
        if deletes:
            mutation["delete"] = deletes
        body = json.dumps(mutation, ensure_ascii=False)
        self._request("/mutate?commitNow=true", body, "application/json")

    def _object_from_dgraph(self, item: dict, depth: int | None = None) -> dict:
        return _serialize_object(
            {
                "id": item["ontology.id"],
                "objectTypeId": item["ontology.object_type_id"],
                "primaryKey": item["ontology.primary_key"],
                "displayName": item["ontology.display_name"],
                "properties": json.loads(item.get("ontology.properties") or "{}"),
                "source": item.get("ontology.source", "manual"),
                "updatedAt": item.get("ontology.updated_at"),
            },
            depth,
        )

    def _link_from_dgraph(self, item: dict) -> dict:
        return _serialize_link(
            {
                "id": item["link.id"],
                "linkTypeId": item["link.type_id"],
                "sourceInstanceId": item["link.source"]["ontology.id"],
                "targetInstanceId": item["link.target"]["ontology.id"],
                "properties": json.loads(item.get("link.properties") or "{}"),
                "source": item.get("link.origin", "manual"),
                "updatedAt": item.get("link.updated_at"),
            }
        )

    def _objects_by_ids(self, object_ids: list[str]) -> dict[str, dict]:
        if not object_ids:
            return {}
        values = _dql_values(object_ids)
        query = (
            "{ objects(func: eq(ontology.id, "
            + values
            + ")) { uid ontology.id ontology.object_type_id ontology.primary_key "
            "ontology.display_name ontology.properties ontology.source ontology.updated_at } }"
        )
        data = self._query(query)
        return {item["ontology.id"]: item for item in data.get("objects", [])}

    def upsert_objects(self, objects: list[dict]) -> list[dict]:
        if not objects:
            return []
        self._ensure_schema()
        identities = [_object_identity(item["objectTypeId"], item["primaryKey"]) for item in objects]
        query = f"""
        {{
          objects(func: eq(ontology.identity, {_dql_values(identities)})) {{
            uid ontology.id ontology.identity ontology.object_type_id ontology.primary_key
                    }}
                }}
        """
        data = self._query(query)
        existing = {item["ontology.identity"]: item for item in data.get("objects", [])}
        mutations = []
        deletes = []
        results = []
        timestamp = _now()
        for index, item in enumerate(objects):
            identity = _object_identity(item["objectTypeId"], item["primaryKey"])
            current = existing.get(identity)
            object_id = current["ontology.id"] if current else item.get("id") or str(uuid4())
            properties = item.get("properties") or {}
            exact_values = [_property_token(name, value) for name, value in properties.items()]
            if current:
                deletes.append({"uid": current["uid"], "ontology.property_exact": None})
            mutations.append(
                {
                    "uid": current["uid"] if current else f"_:object{index}",
                    "dgraph.type": "OntologyObject",
                    "ontology.id": object_id,
                    "ontology.identity": identity,
                    "ontology.object_type_id": item["objectTypeId"],
                    "ontology.primary_key": item["primaryKey"],
                    "ontology.display_name": item["displayName"],
                    "ontology.properties": json.dumps(properties, ensure_ascii=False),
                    "ontology.property_exact": exact_values,
                    "ontology.search_text": " ".join(
                        [item["displayName"], item["primaryKey"], *(str(value) for value in properties.values())]
                    ),
                    "ontology.source": item.get("source", "manual"),
                    "ontology.updated_at": timestamp,
                }
            )
            results.append(_serialize_object({**item, "id": object_id, "updatedAt": timestamp}))
        self._mutate(mutations, deletes)
        return results

    def upsert_links(self, links: list[dict]) -> list[dict]:
        if not links:
            return []
        self._ensure_schema()
        object_ids = sorted(
            {instance_id for item in links for instance_id in (item["sourceInstanceId"], item["targetInstanceId"])}
        )
        objects = self._objects_by_ids(object_ids)
        if len(objects) != len(object_ids):
            raise ValueError("sourceInstanceId and targetInstanceId must reference existing objects")
        identities = [
            _link_identity(item["linkTypeId"], item["sourceInstanceId"], item["targetInstanceId"])
            for item in links
        ]
        query = f"{{ links(func: eq(link.identity, {_dql_values(identities)})) {{ uid link.id link.identity }} }}"
        data = self._query(query)
        existing = {item["link.identity"]: item for item in data.get("links", [])}
        timestamp = _now()
        mutations = []
        results = []
        for index, item in enumerate(links):
            identity = _link_identity(item["linkTypeId"], item["sourceInstanceId"], item["targetInstanceId"])
            current = existing.get(identity)
            link_id = current["link.id"] if current else item.get("id") or str(uuid4())
            mutations.append(
                {
                    "uid": current["uid"] if current else f"_:link{index}",
                    "dgraph.type": "OntologyLink",
                    "link.id": link_id,
                    "link.identity": identity,
                    "link.type_id": item["linkTypeId"],
                    "link.source": {"uid": objects[item["sourceInstanceId"]]["uid"]},
                    "link.target": {"uid": objects[item["targetInstanceId"]]["uid"]},
                    "link.properties": json.dumps(item.get("properties") or {}, ensure_ascii=False),
                    "link.origin": item.get("source", "manual"),
                    "link.updated_at": timestamp,
                }
            )
            results.append(_serialize_link({**item, "id": link_id, "updatedAt": timestamp}))
        self._mutate(mutations)
        return results

    def search_objects(self, query="", object_type_id=None, property_name=None, property_value=None, limit=50):
        self._ensure_schema()
        filters = ["type(OntologyObject)"]
        if object_type_id:
            filters.append(f'eq(ontology.object_type_id, {json.dumps(object_type_id, ensure_ascii=False)})')
        if property_name and property_value is not None:
            token = _property_token(property_name, property_value)
            filters.append(f'eq(ontology.property_exact, {json.dumps(token, ensure_ascii=False)})')
        root = "has(ontology.id)"
        if query.strip():
            escaped = re.escape(query.strip()).replace("/", "\\/")
            root = f"regexp(ontology.search_text, /{escaped}/i)"
        dql = f"""
        {{
          objects(func: {root}, orderdesc: ontology.updated_at, first: {limit})
            @filter({' AND '.join(filters)}) {{
            uid ontology.id ontology.object_type_id ontology.primary_key
            ontology.display_name ontology.properties ontology.source ontology.updated_at
          }}
        }}
        """
        data = self._query(dql)
        return [self._object_from_dgraph(item) for item in data.get("objects", [])]

    def _links_for_frontier(self, frontier: set[str], direction: str, link_type_ids: list[str]) -> list[dict]:
        objects = self._objects_by_ids(list(frontier))
        uids = [item["uid"] for item in objects.values()]
        direction_filters = []
        if direction in {"out", "both"}:
            direction_filters.append(f"uid(link.source, {', '.join(uids)})")
        if direction in {"in", "both"}:
            direction_filters.append(f"uid(link.target, {', '.join(uids)})")
        filters = [f"({' OR '.join(direction_filters)})"]
        if link_type_ids:
            values = ", ".join(json.dumps(value, ensure_ascii=False) for value in link_type_ids)
            filters.append(f"eq(link.type_id, [{values}])")
        dql = f"""
        {{
          links(func: type(OntologyLink)) @filter({' AND '.join(filters)}) {{
            uid link.id link.type_id link.properties link.origin link.updated_at
            link.source {{ uid ontology.id }}
            link.target {{ uid ontology.id }}
          }}
        }}
        """
        return [self._link_from_dgraph(item) for item in self._query(dql).get("links", [])]

    def traverse(self, start_instance_ids, max_hops, direction, link_type_ids, limit):
        self._ensure_schema()
        start_objects = self._objects_by_ids(start_instance_ids)
        if len(start_objects) != len(set(start_instance_ids)):
            raise KeyError("one or more start instances were not found")
        depths = {instance_id: 0 for instance_id in start_instance_ids}
        frontier = set(start_instance_ids)
        traversed_links = {}
        truncated = False
        for depth in range(1, max_hops + 1):
            next_frontier = set()
            for link in self._links_for_frontier(frontier, direction, link_type_ids):
                candidates = []
                if direction in {"out", "both"} and link["sourceInstanceId"] in frontier:
                    candidates.append(link["targetInstanceId"])
                if direction in {"in", "both"} and link["targetInstanceId"] in frontier:
                    candidates.append(link["sourceInstanceId"])
                for instance_id in candidates:
                    traversed_links[link["id"]] = link
                    if instance_id not in depths:
                        if len(depths) >= limit:
                            truncated = True
                            break
                        depths[instance_id] = depth
                        next_frontier.add(instance_id)
                if truncated:
                    break
            frontier = next_frontier
            if truncated or not frontier:
                break
        objects = self._objects_by_ids(list(depths))
        nodes = [self._object_from_dgraph(objects[object_id], depth) for object_id, depth in depths.items()]
        nodes.sort(key=lambda item: (item["depth"], item["displayName"]))
        return {
            "nodes": nodes,
            "links": list(traversed_links.values()),
            "maxDepthReached": max(depths.values(), default=0),
            "truncated": truncated,
        }


_store = None


def get_ontology_store():
    global _store
    if _store is None:
        backend = os.getenv("ONTOLOGY_GRAPH_BACKEND", "dgraph").lower()
        _store = InMemoryOntologyGraphStore() if backend == "memory" else DgraphOntologyGraphStore()
    return _store