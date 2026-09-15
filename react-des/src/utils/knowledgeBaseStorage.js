const STORAGE_KEY = 'des-knowledge-bases'

const DEFAULT_KNOWLEDGE_BASES = [
  {
    id: 'kb_product_enablement',
    name: 'Product Enablement',
    description: 'Launch guides, feature explanations, and rollout assets for customer-facing teams.',
    date: '2026/03/01 10:30:00',
    status: true,
    type: 'text',
    teams: [],
    documents: [
      {
        id: 'doc_product_feature_guide',
        name: 'Comprehensive Guide to Product Features',
        fileType: 'PDF',
        updatedAt: '2026-03-01 10:30',
        status: 'processed',
        summary: 'Explains core feature capabilities, product positioning, and recommended customer messaging.',
        chunks: [
          'Product Enablement describes the primary feature set and rollout guidance.',
          'Customer-facing teams should reuse the approved positioning and qualification language.',
        ],
      },
      {
        id: 'doc_product_onboarding',
        name: 'Onboarding Flow for New Users',
        fileType: 'DOCX',
        updatedAt: '2026-03-04 14:00',
        status: 'processing',
        summary: 'Documents the activation journey, adoption checkpoints, and common setup blockers.',
        chunks: [],
      },
    ],
  },
  {
    id: 'kb_marketing_operations',
    name: 'Marketing Operations',
    description: 'Campaign summaries, reporting decks, and market-facing narrative assets.',
    date: '2026/03/06 09:20:00',
    status: true,
    type: 'table',
    teams: [],
    documents: [
      {
        id: 'doc_brand_messaging_playbook',
        name: 'Brand Messaging Playbook',
        fileType: 'PDF',
        updatedAt: '2026-03-06 09:20',
        status: 'processed',
        summary: 'Approved messaging pillars, persona language, and market differentiation guidance.',
        chunks: [
          'Messaging pillars define value by buyer role and funnel stage.',
          'Use consistent differentiation statements in outbound and lifecycle campaigns.',
        ],
      },
      {
        id: 'doc_q1_campaign_report',
        name: 'Q1 2026 Marketing Campaign Report',
        fileType: 'XLSX',
        updatedAt: '2026-03-05 11:45',
        status: 'failed',
        summary: 'Contains channel performance, CAC trends, and campaign retrospective notes.',
        chunks: [],
      },
    ],
  },
  {
    id: 'kb_support_readiness',
    name: 'Support Readiness',
    description: 'Troubleshooting guides, escalation procedures, and customer issue taxonomies.',
    date: '2026/03/09 08:15:00',
    status: true,
    type: 'text',
    teams: [],
    documents: [
      {
        id: 'doc_support_triage_manual',
        name: 'Support Triage Manual',
        fileType: 'DOCX',
        updatedAt: '2026-03-09 08:15',
        status: 'processed',
        summary: 'Step-by-step issue triage rules and escalation ownership by problem class.',
        chunks: [
          'Severity classification decides escalation owner and response SLA.',
          'Known issue handling should cite the latest workaround article and root cause reference.',
        ],
      },
    ],
  },
]

const isBrowser = () => typeof window !== 'undefined'

const pad = (value) => String(value).padStart(2, '0')

const createTimestamp = () => {
  const now = new Date()
  return `${now.getFullYear()}/${pad(now.getMonth() + 1)}/${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
}

const normalizeChunk = (chunk, index = 0) => {
  if (typeof chunk === 'string') {
    const content = String(chunk).trim()
    return content ? content : null
  }

  if (!chunk || typeof chunk !== 'object') {
    return null
  }

  const pageNumbers = Array.isArray(chunk.page_numbers)
    ? chunk.page_numbers.map((value) => Number(value)).filter((value) => Number.isFinite(value))
    : Array.isArray(chunk.pageNumbers)
      ? chunk.pageNumbers.map((value) => Number(value)).filter((value) => Number.isFinite(value))
      : []

  const normalized = {
    id: String(chunk.id || chunk.point_id || chunk.pointId || `chunk_${index + 1}`),
    pointId: chunk.point_id ? String(chunk.point_id) : (chunk.pointId ? String(chunk.pointId) : null),
    chunkId: chunk.chunk_id ?? chunk.chunkId ?? null,
    content: String(chunk.content || '').trim(),
    chunkType: chunk.chunk_type ? String(chunk.chunk_type) : (chunk.chunkType ? String(chunk.chunkType) : null),
    attachmentLink: chunk.attachment_link ? String(chunk.attachment_link) : (chunk.attachmentLink ? String(chunk.attachmentLink) : null),
    pageNumbers,
    originalCoordinate: chunk.original_coordinate ?? chunk.originalCoordinate ?? null,
    docId: chunk.doc_id ? String(chunk.doc_id) : (chunk.docId ? String(chunk.docId) : null),
    docName: chunk.doc_name ? String(chunk.doc_name) : (chunk.docName ? String(chunk.docName) : null),
  }

  if (!normalized.content && !normalized.attachmentLink) {
    return null
  }

  return normalized
}

const normalizeDocument = (document, index = 0) => ({
  id: String(document?.id || `doc_${index + 1}`),
  name: String(document?.name || `Document ${index + 1}`),
  fileType: String(document?.fileType || 'TXT').toUpperCase(),
  updatedAt: String(document?.updatedAt || createTimestamp()),
  status: String(document?.status || 'pending').toLowerCase(),
  summary: String(document?.summary || ''),
  chunks: Array.isArray(document?.chunks) ? document.chunks.map((chunk, chunkIndex) => normalizeChunk(chunk, chunkIndex)).filter(Boolean) : [],
})

export const normalizeKnowledgeBase = (knowledgeBase, index = 0) => ({
  id: String(knowledgeBase?.id || `kb_${index + 1}`),
  name: String(knowledgeBase?.name || `Knowledge Base ${index + 1}`),
  description: String(knowledgeBase?.description || ''),
  date: String(knowledgeBase?.date || createTimestamp()),
  enabled: knowledgeBase?.enabled !== false && knowledgeBase?.status !== false,
  status: knowledgeBase?.status !== false,
  type: knowledgeBase?.type === 'table' ? 'table' : 'text',
  teams: Array.isArray(knowledgeBase?.teams) ? knowledgeBase.teams.map(String) : [],
  remote_provider: knowledgeBase?.remote_provider ? String(knowledgeBase.remote_provider) : null,
  remote_resource_id: knowledgeBase?.remote_resource_id ? String(knowledgeBase.remote_resource_id) : null,
  local_display_name: knowledgeBase?.local_display_name
    ? String(knowledgeBase.local_display_name)
    : (knowledgeBase?.remote_name ? String(knowledgeBase.remote_name) : null),
  remote_host: knowledgeBase?.remote_host ? String(knowledgeBase.remote_host) : null,
  remote_project: knowledgeBase?.remote_project ? String(knowledgeBase.remote_project) : null,
  remote_collection_name: knowledgeBase?.remote_collection_name ? String(knowledgeBase.remote_collection_name) : null,
  sync_status: knowledgeBase?.sync_status ? String(knowledgeBase.sync_status) : null,
  sync_error: knowledgeBase?.sync_error ? String(knowledgeBase.sync_error) : null,
  documents: Array.isArray(knowledgeBase?.documents)
    ? knowledgeBase.documents.map((document, documentIndex) => normalizeDocument(document, documentIndex))
    : [],
})

export const normalizeKnowledgeBases = (knowledgeBases) => (
  Array.isArray(knowledgeBases)
    ? knowledgeBases.map((item, index) => normalizeKnowledgeBase(item, index))
    : []
)

export const getDefaultKnowledgeBases = () => DEFAULT_KNOWLEDGE_BASES.map((item, index) => normalizeKnowledgeBase(item, index))

export const loadKnowledgeBases = () => {
  if (!isBrowser()) return getDefaultKnowledgeBases()

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return getDefaultKnowledgeBases()

    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return getDefaultKnowledgeBases()
    return normalizeKnowledgeBases(parsed)
  } catch (error) {
    console.error('Failed to load knowledge bases:', error)
    return getDefaultKnowledgeBases()
  }
}

export const saveKnowledgeBases = (knowledgeBases) => {
  if (!isBrowser()) return

  const normalized = normalizeKnowledgeBases(knowledgeBases)

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized))
  window.dispatchEvent(new CustomEvent('des:knowledge-bases-updated', { detail: normalized }))
}

export const createKnowledgeBaseId = () => `kb_${Date.now()}`

export const createKnowledgeDocumentId = () => `doc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

export const getKnowledgeBaseStorageKey = () => STORAGE_KEY