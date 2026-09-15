import { buildApiUrl } from "../config/api";

const PATH = "/ontology-definitions/";

const parseResponse = async (response) => {
  const data = await response.json().catch(() => null);
  if (response.ok) return data;
  throw new Error(typeof data?.detail === "string" ? data.detail : `Ontology definition request failed: ${response.status}`);
};

const fromRecord = (record) => ({
  ...(record?.definition_json || {}),
  id: record.id,
  name: record.name,
  enabled: record.enabled !== false,
  createdAt: record.created_at,
  updatedAt: record.updated_at,
});

const toPayload = (kind, item) => {
  const { id, name, enabled, createdAt, updatedAt, created_at, updated_at, ...definition } = item;
  return {
    id,
    kind,
    name: String(name || "").trim(),
    enabled: enabled !== false,
    definition_json: definition,
  };
};

export const fetchOntologyDefinitions = async (kind) => {
  const response = await fetch(buildApiUrl(`${PATH}?kind=${encodeURIComponent(kind)}`));
  return (await parseResponse(response)).map(fromRecord);
};

export const createOntologyDefinition = async (kind, item) => {
  const response = await fetch(buildApiUrl(PATH), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(toPayload(kind, item)),
  });
  return fromRecord(await parseResponse(response));
};

export const updateOntologyDefinition = async (item) => {
  const payload = toPayload("", item);
  const response = await fetch(buildApiUrl(`${PATH}${encodeURIComponent(item.id)}`), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: payload.name,
      enabled: payload.enabled,
      definition_json: payload.definition_json,
    }),
  });
  return fromRecord(await parseResponse(response));
};

export const saveOntologyDefinition = (kind, item, exists) => exists
  ? updateOntologyDefinition(item)
  : createOntologyDefinition(kind, item);

export const deleteOntologyDefinition = async (definitionId) => {
  const response = await fetch(buildApiUrl(`${PATH}${encodeURIComponent(definitionId)}`), { method: "DELETE" });
  return parseResponse(response);
};

export const migrateOntologyDefinitions = async (kind, items) => {
  const existingItems = await fetchOntologyDefinitions(kind);
  const existingIds = new Set(existingItems.map((item) => item.id));
  const migrated = [];
  for (const item of items) {
    if (!existingIds.has(item.id)) migrated.push(await createOntologyDefinition(kind, item));
  }
  return migrated;
};