import { buildApiUrl } from '../config/api'
import { loadKnowledgeBases, normalizeKnowledgeBase, normalizeKnowledgeBases, saveKnowledgeBases } from './knowledgeBaseStorage'

const KNOWLEDGE_BASES_PATH = '/knowledge-bases/'

const toPayload = (knowledgeBase = {}) => ({
  name: String(knowledgeBase?.name || '').trim(),
  description: String(knowledgeBase?.description || '').trim(),
  type: String(knowledgeBase?.type || 'text').trim() || 'text',
  teams: Array.isArray(knowledgeBase?.teams) ? knowledgeBase.teams.map((team) => String(team).trim()).filter(Boolean) : [],
  auto_create_remote: knowledgeBase?.auto_create_remote === true,
  enabled: typeof knowledgeBase?.enabled === 'boolean' ? knowledgeBase.enabled : undefined,
  status: typeof knowledgeBase?.status === 'boolean' ? knowledgeBase.status : undefined,
  remote_resource_id: knowledgeBase?.remote_resource_id ? String(knowledgeBase.remote_resource_id).trim() : null,
  local_display_name: knowledgeBase?.local_display_name ? String(knowledgeBase.local_display_name).trim() : null,
  remote_host: knowledgeBase?.remote_host ? String(knowledgeBase.remote_host).trim() : null,
  remote_project: knowledgeBase?.remote_project ? String(knowledgeBase.remote_project).trim() : null,
  remote_collection_name: knowledgeBase?.remote_collection_name ? String(knowledgeBase.remote_collection_name).trim() : null,
})

const parseResponse = async (response) => {
  const data = await response.json().catch(() => null)
  if (response.ok) {
    return data
  }

  const detail = data?.detail
  if (typeof detail === 'string' && detail.trim()) {
    throw new Error(detail)
  }
  throw new Error(`Knowledge base request failed: ${response.status}`)
}

const mergeById = (knowledgeBases) => {
  const deduped = new Map()
  normalizeKnowledgeBases(knowledgeBases).forEach((knowledgeBase) => {
    deduped.set(knowledgeBase.id, knowledgeBase)
  })
  return Array.from(deduped.values())
}

export const fetchKnowledgeBases = async () => {
  const fallbackKnowledgeBases = loadKnowledgeBases()

  try {
    const response = await fetch(buildApiUrl(KNOWLEDGE_BASES_PATH))
    const knowledgeBases = normalizeKnowledgeBases(await parseResponse(response))
    saveKnowledgeBases(knowledgeBases)
    return knowledgeBases
  } catch (error) {
    console.error('Failed to fetch knowledge bases from API:', error)
    return fallbackKnowledgeBases
  }
}

export const createKnowledgeBase = async (knowledgeBase) => {
  const response = await fetch(buildApiUrl(KNOWLEDGE_BASES_PATH), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(toPayload(knowledgeBase)),
  })
  const createdKnowledgeBase = normalizeKnowledgeBase(await parseResponse(response))
  saveKnowledgeBases(mergeById([createdKnowledgeBase, ...loadKnowledgeBases()]))
  return createdKnowledgeBase
}

export const fetchKnowledgeBase = async (knowledgeBaseId) => {
  const response = await fetch(buildApiUrl(`${KNOWLEDGE_BASES_PATH}${knowledgeBaseId}`))
  return normalizeKnowledgeBase(await parseResponse(response))
}

export const updateKnowledgeBase = async (knowledgeBaseId, knowledgeBase) => {
  const response = await fetch(buildApiUrl(`${KNOWLEDGE_BASES_PATH}${knowledgeBaseId}`), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(toPayload(knowledgeBase)),
  })
  const updatedKnowledgeBase = normalizeKnowledgeBase(await parseResponse(response))
  saveKnowledgeBases(mergeById([updatedKnowledgeBase, ...loadKnowledgeBases().filter((item) => item.id !== knowledgeBaseId)]))
  return updatedKnowledgeBase
}

export const deleteKnowledgeBase = async (knowledgeBaseId) => {
  const response = await fetch(buildApiUrl(`${KNOWLEDGE_BASES_PATH}${knowledgeBaseId}`), {
    method: 'DELETE',
  })
  await parseResponse(response)
  const nextKnowledgeBases = loadKnowledgeBases().filter((knowledgeBase) => knowledgeBase.id !== knowledgeBaseId)
  saveKnowledgeBases(nextKnowledgeBases)
  return nextKnowledgeBases
}

export const syncKnowledgeBaseDocuments = async (knowledgeBaseId) => {
  const response = await fetch(buildApiUrl(`${KNOWLEDGE_BASES_PATH}${knowledgeBaseId}/documents/sync`), {
    method: 'POST',
  })
  const knowledgeBase = normalizeKnowledgeBase(await parseResponse(response))
  saveKnowledgeBases(mergeById([knowledgeBase, ...loadKnowledgeBases().filter((item) => item.id !== knowledgeBaseId)]))
  return knowledgeBase
}

export const uploadKnowledgeBaseDocument = async (knowledgeBaseId, file, options = {}) => {
  const formData = new FormData()
  formData.append('file', file)
  if (options.doc_id) formData.append('doc_id', options.doc_id)
  if (options.doc_name) formData.append('doc_name', options.doc_name)
  if (options.doc_type) formData.append('doc_type', options.doc_type)
  if (options.description) formData.append('description', options.description)

  const response = await fetch(buildApiUrl(`${KNOWLEDGE_BASES_PATH}${knowledgeBaseId}/documents/upload`), {
    method: 'POST',
    body: formData,
  })
  return parseResponse(response)
}

export const deleteKnowledgeBaseDocument = async (knowledgeBaseId, documentId) => {
  const response = await fetch(buildApiUrl(`${KNOWLEDGE_BASES_PATH}${knowledgeBaseId}/documents/${documentId}`), {
    method: 'DELETE',
  })
  const knowledgeBase = normalizeKnowledgeBase(await parseResponse(response))
  saveKnowledgeBases(mergeById([knowledgeBase, ...loadKnowledgeBases().filter((item) => item.id !== knowledgeBaseId)]))
  return knowledgeBase
}

export const buildKnowledgeBaseDocumentPreviewRawUrl = (knowledgeBaseId, documentId) => {
  return buildApiUrl(`${KNOWLEDGE_BASES_PATH}${knowledgeBaseId}/documents/${documentId}/preview/raw`)
}

export const fetchKnowledgeBaseDocumentPreviewText = async (knowledgeBaseId, documentId) => {
  const response = await fetch(buildApiUrl(`${KNOWLEDGE_BASES_PATH}${knowledgeBaseId}/documents/${documentId}/preview/text`))
  return parseResponse(response)
}