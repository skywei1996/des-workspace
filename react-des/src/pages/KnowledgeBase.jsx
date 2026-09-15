import React, { useEffect, useMemo, useRef, useState } from 'react'
import Sidebar from '../components/Sidebar'
import {
  loadKnowledgeBases,
  saveKnowledgeBases,
} from '../utils/knowledgeBaseStorage'
import {
  buildKnowledgeBaseDocumentPreviewRawUrl,
  createKnowledgeBase,
  deleteKnowledgeBase,
  deleteKnowledgeBaseDocument,
  fetchKnowledgeBase,
  fetchKnowledgeBaseDocumentPreviewText,
  fetchKnowledgeBases,
  syncKnowledgeBaseDocuments,
  uploadKnowledgeBaseDocument,
  updateKnowledgeBase,
} from '../utils/knowledgeBaseApi'

const PAGE_SIZE = 10

const STATUS_META = {
  pending: { label: 'Pending', badgeClass: 'bg-[#f3f4f6] text-[#6b7280]', dotClass: 'bg-[#9ca3af]' },
  waiting: { label: 'Waiting', badgeClass: 'bg-[#eff6ff] text-[#2563eb]', dotClass: 'bg-[#3b82f6]' },
  processing: { label: 'Processing', badgeClass: 'bg-[#fff2e8] text-[#f08a24]', dotClass: 'bg-[#f08a24]' },
  processed: { label: 'Processed', badgeClass: 'bg-[#e9fff1] text-[#16a34a]', dotClass: 'bg-[#22c55e]' },
  failed: { label: 'Failed', badgeClass: 'bg-[#fff1f2] text-[#ef4444]', dotClass: 'bg-[#ef4444]' },
}

const EMPTY_FORM = {
  name: '',
  description: '',
  connectVolcengine: false,
  useExistingRemote: false,
  remoteResourceId: '',
  remoteHost: 'api-knowledgebase.mlp.cn-beijing.volces.com',
  remoteProject: 'default',
}

const pad = (value) => String(value).padStart(2, '0')

const formatNow = () => {
  const now = new Date()
  return `${now.getFullYear()}/${pad(now.getMonth() + 1)}/${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
}

const extensionToFileType = (name = '') => {
  const parts = String(name).split('.')
  return parts.length > 1 ? parts.pop().toUpperCase() : 'TXT'
}

const formatFileSize = (bytes = 0) => {
  if (!bytes) return '7.7KB'
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
  }
  return `${(bytes / 1024).toFixed(1)}KB`
}

const isConnectedKnowledgeBase = (knowledgeBase) => {
  return Boolean(knowledgeBase?.remote_provider === 'volcengine' && knowledgeBase?.remote_resource_id)
}

const getChunkContent = (chunk) => {
  if (typeof chunk === 'string') return chunk
  return String(chunk?.content || '').trim()
}

const getChunkPointId = (chunk) => {
  if (!chunk || typeof chunk !== 'object') return null
  return chunk.pointId || chunk.point_id || chunk.id || null
}

const getChunkType = (chunk) => {
  if (!chunk || typeof chunk !== 'object') return null
  return String(chunk.chunkType || chunk.chunk_type || '').toLowerCase() || null
}

const getChunkAttachmentLink = (chunk) => {
  if (!chunk || typeof chunk !== 'object') return null
  return chunk.attachmentLink || chunk.attachment_link || null
}

const getChunkPageNumbers = (chunk) => {
  if (!chunk || typeof chunk !== 'object') return []
  const raw = Array.isArray(chunk.pageNumbers) ? chunk.pageNumbers : Array.isArray(chunk.page_numbers) ? chunk.page_numbers : []
  return raw.map((value) => Number(value)).filter((value) => Number.isFinite(value))
}

const buildChunks = (document) => {
  const title = document.name.replace(/\.[^.]+$/, '')
  const summary = document.summary || `${title} imported into the knowledge base.`

  return [
    `During the detailed analysis of ${title}, we extracted the core context for retrieval and decision support. ${summary}`,
    `This slice preserves the primary facts, key terminology, and reusable phrasing from ${title}, making the document available for downstream prompts and retrieval tasks.`,
    `${title} has been segmented into structured chunks so teams can quickly reuse original evidence and referenceable passages without reading the full file each time.`,
  ]
}

const buildOriginalSections = (document) => {
  const title = document.name.replace(/\.[^.]+$/, '')
  const summary = document.summary || `${title} imported into the knowledge base.`

  return [
    {
      heading: 'Overview',
      paragraphs: [
        `${title} is stored as the source document inside this knowledge base. ${summary}`,
        `The original document content is preserved in a readable structure so users can inspect the source wording before reviewing slices or retrieval fragments.`,
      ],
    },
    {
      heading: 'Key Content',
      paragraphs: [
        `This document contains the main narrative, supporting details, and reusable source language that downstream workflows can reference directly.`,
        `When retrieval is executed, the system indexes these sections into smaller slices, but the original document view keeps the content grouped in its more natural reading order.`,
      ],
    },
    {
      heading: 'Reference Notes',
      paragraphs: [
        `Use this page when you need the full source context, want to validate whether a slice reflects the original meaning, or need to inspect the structure of the uploaded material.`,
      ],
    },
  ]
}

const createQueueItem = (file, index = 0) => ({
  id: `upload_${Date.now()}_${index}`,
  file,
  name: file.name,
  fileType: extensionToFileType(file.name),
  sizeLabel: formatFileSize(file.size),
  status: 'pending',
  progress: index === 0 ? 8 : Math.min(24, 8 + index * 4),
})

const normalizeDocumentName = (value = '') => String(value).trim().toLowerCase()

const IconButton = ({ children, onClick, className = '', title }) => (
  <button
    type="button"
    title={title}
    onClick={onClick}
    className={`inline-flex items-center justify-center text-[#6b7280] transition hover:text-[#111827] ${className}`}
  >
    {children}
  </button>
)

const SearchIcon = ({ className = 'h-4 w-4' }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="11" cy="11" r="7" />
    <path d="M20 20L17 17" />
  </svg>
)

const PlusIcon = ({ className = 'h-4 w-4' }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M12 5V19" />
    <path d="M5 12H19" />
  </svg>
)

const DotsIcon = ({ className = 'h-4 w-4' }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <circle cx="12" cy="5" r="1.8" />
    <circle cx="12" cy="12" r="1.8" />
    <circle cx="12" cy="19" r="1.8" />
  </svg>
)

const CloseIcon = ({ className = 'h-4 w-4' }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M18 6L6 18" />
    <path d="M6 6L18 18" />
  </svg>
)

const EyeIcon = ({ className = 'h-4 w-4' }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M2 12C4.8 7.7 8 5.5 12 5.5C16 5.5 19.2 7.7 22 12C19.2 16.3 16 18.5 12 18.5C8 18.5 4.8 16.3 2 12Z" />
    <circle cx="12" cy="12" r="2.6" />
  </svg>
)

const TrashIcon = ({ className = 'h-4 w-4' }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M3 6H21" />
    <path d="M8 6V4H16V6" />
    <path d="M19 6V20H5V6" />
    <path d="M10 10V16" />
    <path d="M14 10V16" />
  </svg>
)

const SettingsIcon = ({ className = 'h-4 w-4' }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M4 21V14" />
    <path d="M4 10V3" />
    <path d="M12 21V12" />
    <path d="M12 8V3" />
    <path d="M20 21V16" />
    <path d="M20 12V3" />
    <path d="M2 14H6" />
    <path d="M10 8H14" />
    <path d="M18 16H22" />
  </svg>
)

const UploadIcon = ({ className = 'h-5 w-5' }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M12 16V4" />
    <path d="M8 8L12 4L16 8" />
    <path d="M4 20H20" />
  </svg>
)

const DocPanelIcon = ({ className = 'h-5 w-5' }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect x="4" y="3.5" width="16" height="17" rx="2.5" />
    <path d="M9 7.5H15" />
    <path d="M9 11.5H15" />
    <path d="M9 15.5H13" />
  </svg>
)

const KnowledgeBaseStackIcon = ({ className = 'h-10 w-10' }) => (
  <svg viewBox="0 0 48 48" fill="none" className={className}>
    <path d="M10 13.5L24 8L38 13.5L24 19L10 13.5Z" fill="#F7A8AD" />
    <path d="M10 21L24 15.5L38 21L24 26.5L10 21Z" fill="#F38C92" />
    <path d="M10 28.5L24 23L38 28.5L24 34L10 28.5Z" fill="#EF4444" />
    <path d="M12.8 14.4L24 18.6L35.2 14.4" stroke="#FCA5A5" strokeWidth="1.2" strokeLinecap="round" />
    <path d="M12.8 21.9L24 26.1L35.2 21.9" stroke="#FCA5A5" strokeWidth="1.2" strokeLinecap="round" />
    <path d="M12.8 29.4L24 33.6L35.2 29.4" stroke="#FCA5A5" strokeWidth="1.2" strokeLinecap="round" />
  </svg>
)

const FileTypeIcon = ({ fileType, className = 'h-9 w-9' }) => {
  const toneMap = {
    TXT: { bg: '#e8f0ff', fg: '#4f77ff', label: 'TXT' },
    DOCX: { bg: '#e8f0ff', fg: '#4f77ff', label: 'DOCX' },
    DOC: { bg: '#e8f0ff', fg: '#4f77ff', label: 'DOC' },
    PDF: { bg: '#fff1f2', fg: '#ef4444', label: 'PDF' },
    PNG: { bg: '#eef9ff', fg: '#0284c7', label: 'PNG' },
    JPG: { bg: '#eef9ff', fg: '#0284c7', label: 'JPG' },
    JPEG: { bg: '#eef9ff', fg: '#0284c7', label: 'JPG' },
    PPT: { bg: '#fff7ed', fg: '#f97316', label: 'PPT' },
    PPTX: { bg: '#fff7ed', fg: '#f97316', label: 'PPT' },
  }

  const tone = toneMap[fileType] || { bg: '#f3f4f6', fg: '#6b7280', label: fileType || 'FILE' }

  return (
    <svg viewBox="0 0 36 44" className={className}>
      <path d="M8 1.5H22L30 9.5V40C30 41.38 28.88 42.5 27.5 42.5H8C6.62 42.5 5.5 41.38 5.5 40V4C5.5 2.62 6.62 1.5 8 1.5Z" fill={tone.bg} stroke="rgba(17,24,39,0.08)" />
      <path d="M22 1.5V9.5H30" fill="white" fillOpacity="0.72" />
      <path d="M22 1.5V9.5H30" stroke="rgba(17,24,39,0.08)" />
      <rect x="7.5" y="28" width="20.5" height="10" rx="2.5" fill={tone.fg} />
      <text x="17.75" y="35" textAnchor="middle" fontSize="6.5" fontWeight="700" fill="white">{tone.label}</text>
      <path d="M11 13.5H23" stroke={tone.fg} strokeWidth="1.6" strokeLinecap="round" opacity="0.7" />
      <path d="M11 17.5H25" stroke={tone.fg} strokeWidth="1.6" strokeLinecap="round" opacity="0.45" />
      <path d="M11 21.5H21" stroke={tone.fg} strokeWidth="1.6" strokeLinecap="round" opacity="0.45" />
    </svg>
  )
}

const ToggleSwitch = ({ checked, onChange }) => (
  <button
    type="button"
    onClick={onChange}
    className={`relative inline-flex h-5 w-9 items-center rounded-full transition ${checked ? 'bg-[#22c55e]' : 'bg-[#d1d5db]'}`}
  >
    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${checked ? 'translate-x-[18px]' : 'translate-x-[2px]'}`} />
  </button>
)

function KnowledgeBase() {
  const [knowledgeBases, setKnowledgeBases] = useState(() => loadKnowledgeBases())
  const [selectedId, setSelectedId] = useState(() => loadKnowledgeBases()[0]?.id || null)
  const [isLoadingKnowledgeBases, setIsLoadingKnowledgeBases] = useState(() => loadKnowledgeBases().length === 0)
  const [isSavingKnowledgeBase, setIsSavingKnowledgeBase] = useState(false)
  const [isUploadingDocuments, setIsUploadingDocuments] = useState(false)
  const [viewMode, setViewMode] = useState('list')
  const [listSearchQuery, setListSearchQuery] = useState('')
  const [detailSearchQuery, setDetailSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState('docs')
  const [currentPage, setCurrentPage] = useState(1)
  const [activeMenuId, setActiveMenuId] = useState(null)
  const [modalMode, setModalMode] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [importTargetId, setImportTargetId] = useState(null)
  const [uploadQueue, setUploadQueue] = useState([])
  const [duplicateResolution, setDuplicateResolution] = useState({
    isOpen: false,
    pendingFiles: [],
    acceptedFiles: [],
    existingNames: [],
    currentFile: null,
  })
  const [highlightedDocumentId, setHighlightedDocumentId] = useState(null)
  const [previewDocument, setPreviewDocument] = useState(null)
  const [previewState, setPreviewState] = useState({ loading: false, type: null, url: '', markdown: '', error: '' })
  const [selectedDocumentId, setSelectedDocumentId] = useState(null)
  const pollingRef = useRef(null)
  const menuContainerRef = useRef(null)

  useEffect(() => {
    let isActive = true

    const hydrateKnowledgeBases = async () => {
      setIsLoadingKnowledgeBases(true)
      const nextKnowledgeBases = await fetchKnowledgeBases()
      if (!isActive) return
      setKnowledgeBases(nextKnowledgeBases)
      setSelectedId((current) => (current && nextKnowledgeBases.some((knowledgeBase) => knowledgeBase.id === current)
        ? current
        : nextKnowledgeBases[0]?.id || null))
      setIsLoadingKnowledgeBases(false)
    }

    hydrateKnowledgeBases()

    return () => {
      isActive = false
    }
  }, [])

  useEffect(() => {
    const syncKnowledgeBases = () => {
      const nextKnowledgeBases = loadKnowledgeBases()
      setKnowledgeBases(nextKnowledgeBases)
      setSelectedId((current) => current || nextKnowledgeBases[0]?.id || null)
    }

    window.addEventListener('storage', syncKnowledgeBases)
    window.addEventListener('des:knowledge-bases-updated', syncKnowledgeBases)
    return () => {
      window.removeEventListener('storage', syncKnowledgeBases)
      window.removeEventListener('des:knowledge-bases-updated', syncKnowledgeBases)
    }
  }, [])

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (menuContainerRef.current && !menuContainerRef.current.contains(event.target)) {
        setActiveMenuId(null)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [])

  const persistKnowledgeBases = (nextKnowledgeBases) => {
    setKnowledgeBases(nextKnowledgeBases)
    saveKnowledgeBases(nextKnowledgeBases)
  }

  const replaceKnowledgeBase = (knowledgeBase) => {
    if (!knowledgeBase) return
    const nextKnowledgeBases = [knowledgeBase, ...knowledgeBases.filter((item) => item.id !== knowledgeBase.id)]
    persistKnowledgeBases(nextKnowledgeBases)
  }

  const filteredKnowledgeBases = useMemo(() => {
    const keyword = listSearchQuery.trim().toLowerCase()
    return knowledgeBases.filter((knowledgeBase) => {
      if (!keyword) return true
      return `${knowledgeBase.name} ${knowledgeBase.description}`.toLowerCase().includes(keyword)
    })
  }, [knowledgeBases, listSearchQuery])

  const selectedKnowledgeBase = useMemo(
    () => knowledgeBases.find((knowledgeBase) => knowledgeBase.id === selectedId) || null,
    [knowledgeBases, selectedId],
  )

  const selectedDocument = useMemo(() => {
    if (!selectedKnowledgeBase || !selectedDocumentId) return null
    return (selectedKnowledgeBase.documents || []).find((document) => document.id === selectedDocumentId) || null
  }, [selectedDocumentId, selectedKnowledgeBase])

  const inlinePreviewDocument = activeTab === 'docs' ? selectedDocument : null
  const currentPreviewDocument = previewDocument || inlinePreviewDocument
  const importTargetKnowledgeBase = useMemo(
    () => knowledgeBases.find((knowledgeBase) => knowledgeBase.id === importTargetId) || null,
    [knowledgeBases, importTargetId],
  )

  useEffect(() => {
    if (!selectedKnowledgeBase && knowledgeBases[0]) {
      setSelectedId(knowledgeBases[0].id)
    }
    if (!selectedKnowledgeBase && viewMode === 'detail') {
      setViewMode('list')
    }
  }, [knowledgeBases, selectedKnowledgeBase, viewMode])

  useEffect(() => {
    let objectUrl = null
    let isActive = true

    const loadPreview = async () => {
      if (!currentPreviewDocument?.id || !selectedKnowledgeBase?.id) {
        setPreviewState({ loading: false, type: null, url: '', markdown: '', error: '' })
        return
      }

      const fileType = String(currentPreviewDocument.fileType || '').toLowerCase()
      const imageTypes = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp'])
      const textTypes = new Set(['doc', 'docx', 'txt', 'md', 'markdown'])

      setPreviewState({ loading: true, type: null, url: '', markdown: '', error: '' })

      try {
        if (imageTypes.has(fileType) || fileType === 'pdf') {
          const response = await fetch(buildKnowledgeBaseDocumentPreviewRawUrl(selectedKnowledgeBase.id, currentPreviewDocument.id))
          if (!response.ok) {
            const data = await response.json().catch(() => null)
            throw new Error(data?.detail || `Preview request failed: ${response.status}`)
          }
          const blob = await response.blob()
          objectUrl = URL.createObjectURL(blob)
          if (!isActive) return
          setPreviewState({ loading: false, type: fileType === 'pdf' ? 'pdf' : 'image', url: objectUrl, markdown: '', error: '' })
          return
        }

        if (textTypes.has(fileType)) {
          const payload = await fetchKnowledgeBaseDocumentPreviewText(selectedKnowledgeBase.id, currentPreviewDocument.id)
          if (!isActive) return
          setPreviewState({ loading: false, type: 'markdown', url: '', markdown: payload?.markdown || '', error: '' })
          return
        }

        setPreviewState({ loading: false, type: 'unsupported', url: '', markdown: '', error: 'This file type does not support inline preview yet.' })
      } catch (error) {
        if (!isActive) return
        setPreviewState({ loading: false, type: 'error', url: '', markdown: '', error: error?.message || 'Failed to load preview.' })
      }
    }

    loadPreview()

    return () => {
      isActive = false
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl)
      }
    }
  }, [activeTab, currentPreviewDocument, selectedKnowledgeBase?.id])

  useEffect(() => {
    if (!selectedKnowledgeBase) {
      setSelectedDocumentId(null)
      return
    }

    const hasSelectedDocument = (selectedKnowledgeBase.documents || []).some((document) => document.id === selectedDocumentId)
    if (!hasSelectedDocument) {
      setSelectedDocumentId(null)
    }
  }, [selectedDocumentId, selectedKnowledgeBase])

  useEffect(() => {
    if (pollingRef.current) {
      window.clearInterval(pollingRef.current)
      pollingRef.current = null
    }

    const hasActiveDocuments = Boolean((selectedKnowledgeBase?.documents || []).some((document) => (
      ['pending', 'waiting', 'processing'].includes(String(document.status || '').toLowerCase())
    )))

    if (!selectedKnowledgeBase?.id || !isConnectedKnowledgeBase(selectedKnowledgeBase) || !hasActiveDocuments) {
      return undefined
    }

    const pollStatuses = async () => {
      try {
        const syncedKnowledgeBase = await syncKnowledgeBaseDocuments(selectedKnowledgeBase.id)
        setKnowledgeBases((current) => [syncedKnowledgeBase, ...current.filter((item) => item.id !== syncedKnowledgeBase.id)])
      } catch (error) {
        console.error('Failed to sync knowledge base documents:', error)
      }
    }

    pollStatuses()
    pollingRef.current = window.setInterval(pollStatuses, 5000)

    return () => {
      if (pollingRef.current) {
        window.clearInterval(pollingRef.current)
        pollingRef.current = null
      }
    }
  }, [selectedKnowledgeBase])

  const filteredDocuments = useMemo(() => {
    const documents = selectedKnowledgeBase?.documents || []
    const keyword = detailSearchQuery.trim().toLowerCase()
    if (!keyword) return documents

    return documents.filter((document) => `${document.name} ${document.summary} ${document.fileType}`.toLowerCase().includes(keyword))
  }, [detailSearchQuery, selectedKnowledgeBase])

  const totalPages = Math.max(1, Math.ceil(filteredDocuments.length / PAGE_SIZE))

  useEffect(() => {
    setCurrentPage(1)
  }, [detailSearchQuery, activeTab, selectedId])

  const pagedDocuments = useMemo(() => {
    const startIndex = (currentPage - 1) * PAGE_SIZE
    return filteredDocuments.slice(startIndex, startIndex + PAGE_SIZE)
  }, [currentPage, filteredDocuments])

  const flattenedChunks = useMemo(() => {
    const keyword = detailSearchQuery.trim().toLowerCase()
    const processedDocuments = (selectedKnowledgeBase?.documents || []).filter((document) => document.status === 'processed')

    return processedDocuments.flatMap((document) => {
      const chunks = Array.isArray(document.chunks) && document.chunks.length > 0 ? document.chunks : buildChunks(document)

      return chunks
        .filter((chunk) => {
          const chunkContent = getChunkContent(chunk)
          const pointId = getChunkPointId(chunk) || ''
          if (!keyword) return true
          return `${document.name} ${chunkContent} ${pointId}`.toLowerCase().includes(keyword)
        })
        .map((chunk, index) => ({
          id: typeof chunk === 'string' ? `${document.id}_chunk_${index + 1}` : (getChunkPointId(chunk) || `${document.id}_chunk_${index + 1}`),
          documentId: document.id,
          documentName: document.name,
          content: getChunkContent(chunk),
          pointId: getChunkPointId(chunk),
          chunkType: getChunkType(chunk),
          attachmentLink: getChunkAttachmentLink(chunk),
          pageNumbers: getChunkPageNumbers(chunk),
        }))
    })
  }, [detailSearchQuery, selectedKnowledgeBase])

  const filteredOriginalSections = useMemo(() => {
    if (!selectedDocument) return []

    const keyword = detailSearchQuery.trim().toLowerCase()
    const sections = Array.isArray(selectedDocument.originalSections) && selectedDocument.originalSections.length > 0
      ? selectedDocument.originalSections
      : buildOriginalSections(selectedDocument)

    if (!keyword) return sections

    return sections
      .map((section) => ({
        ...section,
        paragraphs: (section.paragraphs || []).filter((paragraph) => paragraph.toLowerCase().includes(keyword) || section.heading.toLowerCase().includes(keyword)),
      }))
      .filter((section) => section.paragraphs.length > 0 || section.heading.toLowerCase().includes(keyword))
  }, [detailSearchQuery, selectedDocument])

  const openCreateModal = () => {
    setForm(EMPTY_FORM)
    setModalMode('create')
  }

  const openEditModal = (knowledgeBase) => {
    setForm({
      name: knowledgeBase.name,
      description: knowledgeBase.description || '',
      connectVolcengine: isConnectedKnowledgeBase(knowledgeBase),
      useExistingRemote: Boolean(knowledgeBase.remote_resource_id),
      remoteResourceId: knowledgeBase.remote_resource_id || '',
      remoteHost: knowledgeBase.remote_host || 'api-knowledgebase.mlp.cn-beijing.volces.com',
      remoteProject: knowledgeBase.remote_project || 'default',
    })
    setSelectedId(knowledgeBase.id)
    setModalMode('edit')
    setActiveMenuId(null)
  }

  const closeModal = () => {
    setModalMode(null)
    setForm(EMPTY_FORM)
  }

  const saveKnowledgeBase = async ({ openImport = false } = {}) => {
    const name = form.name.trim()
    const description = form.description.trim()
    const connectVolcengine = Boolean(form.connectVolcengine)
    const useExistingRemote = Boolean(form.useExistingRemote)
    const remoteResourceId = form.remoteResourceId.trim()
    const remoteHost = form.remoteHost.trim()
    const remoteProject = form.remoteProject.trim()

    if (!name) {
      alert('Name is required.')
      return
    }

    if (connectVolcengine && useExistingRemote && !remoteResourceId) {
      alert('Remote Resource ID is required when connecting to an existing Volcengine knowledge base.')
      return
    }

    setIsSavingKnowledgeBase(true)

    const payload = {
      name,
      description,
      type: 'text',
      teams: selectedKnowledgeBase?.teams || [],
      auto_create_remote: Boolean(connectVolcengine && !useExistingRemote && modalMode !== 'edit'),
      remote_resource_id: connectVolcengine && useExistingRemote ? remoteResourceId : null,
      remote_host: connectVolcengine ? (remoteHost || 'api-knowledgebase.mlp.cn-beijing.volces.com') : null,
      remote_project: connectVolcengine ? (remoteProject || 'default') : null,
      remote_collection_name: connectVolcengine ? name : null,
    }

    try {
      let targetKnowledgeBase = null

      if (modalMode === 'edit' && selectedKnowledgeBase) {
        const updatedKnowledgeBase = await updateKnowledgeBase(selectedKnowledgeBase.id, payload)
        const nextKnowledgeBases = knowledgeBases.map((knowledgeBase) => (
          knowledgeBase.id === selectedKnowledgeBase.id ? updatedKnowledgeBase : knowledgeBase
        ))
        persistKnowledgeBases(nextKnowledgeBases)
        targetKnowledgeBase = updatedKnowledgeBase
      } else {
        const createdKnowledgeBase = await createKnowledgeBase(payload)
        const nextKnowledgeBases = [createdKnowledgeBase, ...knowledgeBases.filter((knowledgeBase) => knowledgeBase.id !== createdKnowledgeBase.id)]
        persistKnowledgeBases(nextKnowledgeBases)
        targetKnowledgeBase = createdKnowledgeBase
      }

      const targetId = targetKnowledgeBase?.id || selectedId
      setSelectedId(targetId)
      closeModal()
      setViewMode('detail')

      if (openImport && targetId) {
        setImportTargetId(targetId)
        setUploadQueue([])
      }
    } catch (error) {
      console.error('Failed to save knowledge base:', error)
      alert(error?.message || 'Failed to save knowledge base.')
    } finally {
      setIsSavingKnowledgeBase(false)
    }
  }

  const handleDeleteKnowledgeBase = async (knowledgeBaseId) => {
    const target = knowledgeBases.find((knowledgeBase) => knowledgeBase.id === knowledgeBaseId)
    if (!target) return

    const confirmed = window.confirm(`Delete knowledge base "${target.name}"?`)
    if (!confirmed) return

    try {
      const nextKnowledgeBases = await deleteKnowledgeBase(knowledgeBaseId)
      persistKnowledgeBases(nextKnowledgeBases)
      if (selectedId === knowledgeBaseId) {
        setSelectedId(nextKnowledgeBases[0]?.id || null)
        setViewMode('list')
      }
      setActiveMenuId(null)
    } catch (error) {
      console.error('Failed to delete knowledge base:', error)
      alert(error?.message || 'Failed to delete knowledge base.')
    }
  }

  const handleToggleKnowledgeBase = async (knowledgeBaseId) => {
    const targetKnowledgeBase = knowledgeBases.find((knowledgeBase) => knowledgeBase.id === knowledgeBaseId)
    if (!targetKnowledgeBase) return

    try {
      const updatedKnowledgeBase = await updateKnowledgeBase(knowledgeBaseId, {
        ...targetKnowledgeBase,
        enabled: !targetKnowledgeBase.enabled,
        status: !targetKnowledgeBase.enabled,
      })
      const nextKnowledgeBases = knowledgeBases.map((knowledgeBase) => (
        knowledgeBase.id === knowledgeBaseId ? updatedKnowledgeBase : knowledgeBase
      ))
      persistKnowledgeBases(nextKnowledgeBases)
    } catch (error) {
      console.error('Failed to toggle knowledge base:', error)
      alert(error?.message || 'Failed to update knowledge base status.')
    }
  }

  const openDetailView = (knowledgeBaseId) => {
    setSelectedId(knowledgeBaseId)
    setViewMode('detail')
    setDetailSearchQuery('')
    setActiveTab('docs')
    setSelectedDocumentId(null)
    setHighlightedDocumentId(null)
    setActiveMenuId(null)
  }

  const handleQueueFiles = (files) => {
    const nextFiles = Array.from(files || []).slice(0, 10)
    if (nextFiles.length === 0) return

    const existingNames = [
      ...(importTargetKnowledgeBase?.documents || []).map((document) => normalizeDocumentName(document.name)),
      ...uploadQueue.map((item) => normalizeDocumentName(item.name)),
    ]

    const acceptedFiles = []
    const duplicateFiles = []
    const seenNames = new Set(existingNames)

    nextFiles.forEach((file) => {
      const normalizedName = normalizeDocumentName(file.name)
      if (seenNames.has(normalizedName)) {
        duplicateFiles.push(file)
        return
      }
      acceptedFiles.push(file)
      seenNames.add(normalizedName)
    })

    if (acceptedFiles.length > 0) {
      setUploadQueue((current) => [
        ...current,
        ...acceptedFiles.map((file, index) => createQueueItem(file, current.length + index)),
      ])
    }

    if (duplicateFiles.length > 0) {
      setDuplicateResolution({
        isOpen: true,
        pendingFiles: duplicateFiles.slice(1),
        acceptedFiles: [],
        existingNames: Array.from(seenNames),
        currentFile: duplicateFiles[0],
      })
    }
  }

  const closeDuplicateResolution = () => {
    setDuplicateResolution({
      isOpen: false,
      pendingFiles: [],
      acceptedFiles: [],
      existingNames: [],
      currentFile: null,
    })
  }

  const finalizeDuplicateResolution = (acceptedFiles) => {
    if (acceptedFiles.length > 0) {
      setUploadQueue((current) => [
        ...current,
        ...acceptedFiles.map((file, index) => createQueueItem(file, current.length + index)),
      ])
    }
    closeDuplicateResolution()
  }

  const advanceDuplicateResolution = ({ acceptCurrent }) => {
    setDuplicateResolution((current) => {
      if (!current.currentFile) {
        return current
      }

      const nextAcceptedFiles = acceptCurrent ? [...current.acceptedFiles, current.currentFile] : current.acceptedFiles
      const nextExistingNames = acceptCurrent
        ? [...current.existingNames, normalizeDocumentName(current.currentFile.name)]
        : current.existingNames

      let nextCurrentFile = null
      let remainingFiles = current.pendingFiles
      while (remainingFiles.length > 0) {
        const [candidate, ...rest] = remainingFiles
        remainingFiles = rest
        const candidateName = normalizeDocumentName(candidate.name)
        if (nextExistingNames.includes(candidateName)) {
          nextCurrentFile = candidate
          break
        }
        nextAcceptedFiles.push(candidate)
        nextExistingNames.push(candidateName)
      }

      if (!nextCurrentFile) {
        setTimeout(() => finalizeDuplicateResolution(nextAcceptedFiles), 0)
        return {
          isOpen: false,
          pendingFiles: [],
          acceptedFiles: [],
          existingNames: [],
          currentFile: null,
        }
      }

      return {
        isOpen: true,
        pendingFiles: remainingFiles,
        acceptedFiles: nextAcceptedFiles,
        existingNames: nextExistingNames,
        currentFile: nextCurrentFile,
      }
    })
  }

  const handleRemoveQueuedFile = (queueId) => {
    setUploadQueue((current) => current.filter((item) => item.id !== queueId))
  }

  const handleSaveImportedDocuments = async () => {
    if (!importTargetId || uploadQueue.length === 0) {
      alert('Please add at least one file.')
      return
    }

    setIsUploadingDocuments(true)
    try {
      for (const item of uploadQueue) {
        setUploadQueue((current) => current.map((entry) => (
          entry.id === item.id ? { ...entry, status: 'processing', progress: 60 } : entry
        )))

        const uploadResult = await uploadKnowledgeBaseDocument(importTargetId, item.file, {
          doc_name: item.name,
          doc_type: item.fileType.toLowerCase(),
        })

        const remoteStatus = String(uploadResult?.document?.status || '').toLowerCase() || 'waiting'

        setUploadQueue((current) => current.map((entry) => (
          entry.id === item.id ? { ...entry, status: remoteStatus, progress: 100 } : entry
        )))
      }

      const syncedKnowledgeBase = await syncKnowledgeBaseDocuments(importTargetId).catch(async () => fetchKnowledgeBase(importTargetId))
      replaceKnowledgeBase(syncedKnowledgeBase)
      setSelectedId(importTargetId)
      setImportTargetId(null)
      setUploadQueue([])
      setViewMode('detail')
      setSelectedDocumentId(null)
      setActiveTab('docs')
    } catch (error) {
      console.error('Failed to upload knowledge base documents:', error)
      alert(error?.message || 'Failed to upload documents.')
    } finally {
      setIsUploadingDocuments(false)
    }
  }

  const handleDeleteDocument = async (documentId) => {
    if (!selectedKnowledgeBase?.id) return

    const targetDocument = (selectedKnowledgeBase.documents || []).find((document) => document.id === documentId)
    const confirmed = window.confirm(`Delete document "${targetDocument?.name || 'this document'}"? This will also remove it from Volcengine knowledge base.`)
    if (!confirmed) return

    try {
      const updatedKnowledgeBase = await deleteKnowledgeBaseDocument(selectedKnowledgeBase.id, documentId)
      replaceKnowledgeBase(updatedKnowledgeBase)
      if (selectedDocumentId === documentId) {
        setSelectedDocumentId(null)
      }
      if (highlightedDocumentId === documentId) {
        setHighlightedDocumentId(null)
      }
      if (previewDocument?.id === documentId) {
        setPreviewDocument(null)
      }
    } catch (error) {
      console.error('Failed to delete document:', error)
      alert(error?.message || 'Failed to delete document.')
    }
  }

  const handleViewOriginalFromChunk = (documentId) => {
    setSelectedDocumentId(documentId)
    setActiveTab('docs')
    setHighlightedDocumentId(documentId)
  }

  const openDocumentDetail = (documentId) => {
    setSelectedDocumentId(documentId)
    setActiveTab('docs')
    setHighlightedDocumentId(documentId)
  }

  const renderListView = () => (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-6 border-b border-[#eceef3] px-6 py-4">
        <h1 className="text-[20px] font-semibold tracking-tight text-[#111827]">Knowledge Base</h1>
        <div className="flex items-center gap-4">
          <div className="relative w-[230px]">
            <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9ca3af]" />
            <input
              value={listSearchQuery}
              onChange={(event) => setListSearchQuery(event.target.value)}
              placeholder="Search Knowledge Base"
              className="h-9 w-full rounded-[10px] border border-[#e5e7eb] bg-white pl-9 pr-3 text-sm text-[#111827] outline-none transition placeholder:text-[#b3b7bf] focus:border-[#d1d5db]"
            />
          </div>
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex h-8 items-center gap-2 rounded-full bg-[#f40d12] px-4 text-sm font-medium text-white transition hover:bg-[#df0d12]"
          >
            <PlusIcon className="h-4 w-4" />
            New Knowledge Base
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
              <path d="M9 6L15 12L9 18" />
            </svg>
          </button>
        </div>
      </div>

      <div ref={menuContainerRef} className="flex-1 overflow-auto px-6 py-5">
        {isLoadingKnowledgeBases && knowledgeBases.length === 0 ? (
          <div className="rounded-[14px] border border-dashed border-[#e5e7eb] px-4 py-10 text-center text-sm text-[#94a3b8]">
            Loading knowledge bases...
          </div>
        ) : null}

        <div className="grid gap-4 xl:grid-cols-3">
          {filteredKnowledgeBases.map((knowledgeBase) => (
            <div
              key={knowledgeBase.id}
              role="button"
              tabIndex={0}
              onClick={() => openDetailView(knowledgeBase.id)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  openDetailView(knowledgeBase.id)
                }
              }}
              className={`relative rounded-[14px] border border-[#eceff4] bg-white px-4 py-4 text-left shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition hover:border-[#dfe4ea] hover:shadow-[0_8px_30px_rgba(15,23,42,0.06)] ${knowledgeBase.enabled === false ? 'opacity-65' : ''}`}
            >
              <div className="flex items-start justify-between gap-4">
                <KnowledgeBaseStackIcon className="h-9 w-9 shrink-0" />
                <div className="flex items-center gap-3">
                  <ToggleSwitch
                    checked={knowledgeBase.enabled !== false}
                    onChange={(event) => {
                      event.stopPropagation()
                      handleToggleKnowledgeBase(knowledgeBase.id)
                    }}
                  />
                  <div className="relative">
                    <IconButton
                      title="More"
                      onClick={(event) => {
                        event.stopPropagation()
                        setActiveMenuId((current) => (current === knowledgeBase.id ? null : knowledgeBase.id))
                      }}
                      className="h-7 w-7 rounded-full hover:bg-[#f3f4f6]"
                    >
                      <DotsIcon className="h-4 w-4" />
                    </IconButton>

                    {activeMenuId === knowledgeBase.id ? (
                      <div className="absolute right-0 top-8 z-20 min-w-[116px] rounded-xl border border-[#e5e7eb] bg-white py-1 shadow-[0_12px_32px_rgba(15,23,42,0.12)]">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation()
                            openEditModal(knowledgeBase)
                          }}
                          className="flex w-full items-center gap-2 px-3 py-2 text-sm text-[#374151] transition hover:bg-[#f9fafb]"
                        >
                          <SettingsIcon className="h-4 w-4" />
                          Settings
                        </button>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation()
                            handleDeleteKnowledgeBase(knowledgeBase.id)
                          }}
                          className="flex w-full items-center gap-2 px-3 py-2 text-sm text-[#374151] transition hover:bg-[#f9fafb]"
                        >
                          <TrashIcon className="h-4 w-4" />
                          Delete
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="mt-6">
                <div className="flex items-center gap-2">
                  <div className="text-[15px] font-semibold text-[#111827]">{knowledgeBase.name}</div>
                  {isConnectedKnowledgeBase(knowledgeBase) ? (
                    <span className="inline-flex items-center rounded-full bg-[#fff3e8] px-2 py-0.5 text-[11px] font-medium text-[#c2410c]">
                      Volcengine
                    </span>
                  ) : null}
                </div>
                <p
                  className="mt-2 text-sm leading-6 text-[#666d78]"
                  style={{
                    display: '-webkit-box',
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {knowledgeBase.description || 'Desc A tool for breaking down complex problems into manageable steps and reasoning through them sequentially.'}
                </p>
                {isConnectedKnowledgeBase(knowledgeBase) ? (
                  <div className="mt-3 space-y-1 text-xs text-[#7c8592]">
                    <div>Remote ID: {knowledgeBase.remote_resource_id}</div>
                    <div>Project: {knowledgeBase.remote_project || 'default'}</div>
                  </div>
                ) : null}
                <div className="mt-3 text-sm text-[#4b5563]">{knowledgeBase.date}</div>
              </div>
            </div>
          ))}
        </div>

        {!isLoadingKnowledgeBases && filteredKnowledgeBases.length === 0 ? (
          <div className="rounded-[14px] border border-dashed border-[#e5e7eb] px-4 py-10 text-center text-sm text-[#94a3b8]">
            No knowledge bases found.
          </div>
        ) : null}
      </div>
    </div>
  )

  const renderDocumentRows = () => {
    const startIndex = filteredDocuments.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1
    const endIndex = Math.min(currentPage * PAGE_SIZE, filteredDocuments.length)

    return (
      <div className="flex-1 overflow-auto px-6 pb-6 pt-4">
        <div className="overflow-hidden rounded-[14px] border border-[#eceef3] bg-white">
          <div className="space-y-2 p-4">
            {pagedDocuments.map((document) => {
              const statusMeta = STATUS_META[document.status] || STATUS_META.pending
              const isHighlighted = highlightedDocumentId === document.id

              return (
                <div
                  key={document.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => openDocumentDetail(document.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      openDocumentDetail(document.id)
                    }
                  }}
                  className={`grid grid-cols-[56px_minmax(0,1fr)_140px_170px_92px] items-center gap-4 rounded-[14px] border px-4 py-3 transition ${isHighlighted ? 'border-[#fecaca] bg-[#fff8f8]' : 'border-[#f0f2f5] bg-white'}`}
                >
                  <div className="flex justify-center">
                    <FileTypeIcon fileType={document.fileType} className="h-11 w-9" />
                  </div>

                  <div className="min-w-0">
                    <div className="truncate text-[15px] font-medium text-[#111827]">{document.name}</div>
                  </div>

                  <div>
                    <span className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium ${statusMeta.badgeClass}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${statusMeta.dotClass}`} />
                      {statusMeta.label}
                    </span>
                  </div>

                  <div className="text-sm text-[#374151]">{document.updatedAt}</div>

                  <div className="flex items-center justify-end gap-4 text-[#6b7280]">
                    <IconButton title="Preview" onClick={(event) => {
                      event.stopPropagation()
                      setPreviewDocument(document)
                    }}>
                      <EyeIcon className="h-4 w-4" />
                    </IconButton>
                    <IconButton title="Delete" onClick={(event) => {
                      event.stopPropagation()
                      handleDeleteDocument(document.id)
                    }}>
                      <TrashIcon className="h-4 w-4" />
                    </IconButton>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="flex items-center justify-between border-t border-[#f1f3f6] px-4 py-4 text-sm text-[#5b6471]">
            <div>Showing {startIndex}-{endIndex} of {filteredDocuments.length} Tasks</div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                className="rounded-full px-3 py-1.5 text-sm text-[#374151] transition hover:bg-[#f7f7f8] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Previous
              </button>

              {Array.from({ length: totalPages }, (_, index) => index + 1).slice(0, 4).map((page) => (
                <button
                  key={page}
                  type="button"
                  onClick={() => setCurrentPage(page)}
                  className={`h-9 min-w-9 rounded-[10px] border px-3 text-sm transition ${page === currentPage ? 'border-[#f87171] text-[#ef4444]' : 'border-transparent text-[#111827] hover:bg-[#f7f7f8]'}`}
                >
                  {page}
                </button>
              ))}

              {totalPages > 4 ? <span className="px-1">...</span> : null}

              {totalPages > 4 ? (
                <button
                  type="button"
                  onClick={() => setCurrentPage(totalPages)}
                  className={`h-9 min-w-9 rounded-[10px] border px-3 text-sm transition ${totalPages === currentPage ? 'border-[#f87171] text-[#ef4444]' : 'border-transparent text-[#111827] hover:bg-[#f7f7f8]'}`}
                >
                  {totalPages}
                </button>
              ) : null}

              <button
                type="button"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                className="rounded-full px-3 py-1.5 text-sm text-[#111827] transition hover:bg-[#f7f7f8] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const renderChunkRows = () => (
    <div className="flex-1 overflow-auto px-6 pb-6 pt-3">
      <div className="overflow-hidden rounded-[14px] border border-[#eceef3] bg-white px-4 py-2">
        {flattenedChunks.map((chunk, index) => (
          <div key={chunk.id} className="grid grid-cols-[32px_minmax(0,1fr)] gap-3">
            <div className="flex flex-col items-center pt-3">
              <div className="text-xs font-semibold text-[#9ca3af]">#{index + 1}</div>
              {index < flattenedChunks.length - 1 ? <div className="mt-2 h-full w-px border-l border-dashed border-[#d8dde6]" /> : null}
            </div>

            <div className="border-b border-[#f3f4f6] py-3 last:border-b-0">
              <div className="text-[15px] font-medium text-[#1f2937]">{chunk.documentName}</div>
              {chunk.pointId ? <div className="mt-2 text-[13px] font-semibold text-[#374151]">ID {chunk.pointId}</div> : null}
              {chunk.pageNumbers.length > 0 ? (
                <div className="mt-1 text-xs text-[#9ca3af]">Page {chunk.pageNumbers.join(', ')}</div>
              ) : null}
              <div className={`mt-3 ${chunk.attachmentLink ? 'grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]' : ''}`}>
                {chunk.attachmentLink ? (
                  <div className="overflow-hidden rounded-[12px] border border-[#e5e7eb] bg-[#f8fafc] p-2">
                    <img src={chunk.attachmentLink} alt={chunk.documentName} className="h-[220px] w-full rounded-[10px] object-contain" />
                  </div>
                ) : null}
                <div>
                  {chunk.chunkType ? (
                    <div className="mb-2 inline-flex items-center rounded-full bg-[#f3f4f6] px-2 py-1 text-[11px] font-medium uppercase tracking-[0.04em] text-[#6b7280]">
                      {chunk.chunkType}
                    </div>
                  ) : null}
                  <p className="text-sm leading-7 whitespace-pre-wrap text-[#626b77]">{chunk.content || 'Empty slice content returned from Volcengine.'}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleViewOriginalFromChunk(chunk.documentId)}
                className="mt-2 inline-flex items-center gap-1 text-sm text-[#6b7280] transition hover:text-[#111827]"
              >
                View Original
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
                  <path d="M9 6L15 12L9 18" />
                </svg>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )

  const renderDetailView = () => (
    <div className="flex h-full flex-col">
      <div className="border-b border-[#eceef3] px-6 py-4">
        <div className="flex items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 text-sm text-[#94a3b8]">
              <button type="button" onClick={() => setViewMode('list')} className="transition hover:text-[#64748b]">
                Knowledge Base
              </button>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
                <path d="M9 6L15 12L9 18" />
              </svg>
              {selectedDocument ? (
                <>
                  <button type="button" onClick={() => setSelectedDocumentId(null)} className="transition hover:text-[#64748b]">
                    {selectedKnowledgeBase?.name}
                  </button>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
                    <path d="M9 6L15 12L9 18" />
                  </svg>
                  <span className="text-[#111827]">{selectedDocument.name}</span>
                </>
              ) : (
                <span className="text-[#111827]">{selectedKnowledgeBase?.name}</span>
              )}
            </div>
            {selectedDocument ? (
              <div className="mt-5 flex items-center gap-7 border-b border-transparent text-sm">
                <button
                  type="button"
                  onClick={() => setActiveTab('docs')}
                  className={`relative pb-3 transition ${activeTab === 'docs' ? 'text-[#f40d12]' : 'text-[#111827]'}`}
                >
                  Original Docs
                  {activeTab === 'docs' ? <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-[#f40d12]" /> : null}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('chunks')}
                  className={`relative pb-3 transition ${activeTab === 'chunks' ? 'text-[#f40d12]' : 'text-[#111827]'}`}
                >
                  Slice Details
                  {activeTab === 'chunks' ? <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-[#f40d12]" /> : null}
                </button>
                <div className="h-6 w-24 rounded bg-[linear-gradient(90deg,rgba(17,24,39,0.10),rgba(17,24,39,0.03))] blur-[0.5px]" />
              </div>
            ) : null}
            {!selectedDocument && isConnectedKnowledgeBase(selectedKnowledgeBase) ? (
              <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-[#6b7280]">
                <span className="rounded-full bg-[#fff3e8] px-2.5 py-1 font-medium text-[#c2410c]">Connected to Volcengine</span>
                <span className="rounded-full bg-[#f3f4f6] px-2.5 py-1">Resource ID: {selectedKnowledgeBase.remote_resource_id}</span>
                <span className="rounded-full bg-[#f3f4f6] px-2.5 py-1">Project: {selectedKnowledgeBase.remote_project || 'default'}</span>
                <span className="rounded-full bg-[#f3f4f6] px-2.5 py-1">Host: {selectedKnowledgeBase.remote_host || 'api-knowledgebase.mlp.cn-beijing.volces.com'}</span>
              </div>
            ) : null}
          </div>

          <div className="self-end pb-2">
            <div className="relative w-[230px]">
              <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9ca3af]" />
              <input
                value={detailSearchQuery}
                onChange={(event) => setDetailSearchQuery(event.target.value)}
                placeholder={selectedDocument ? 'Search Slice Content' : 'Search Document Name'}
                className="h-9 w-full rounded-[10px] border border-[#e5e7eb] bg-white pl-9 pr-3 text-sm text-[#111827] outline-none transition placeholder:text-[#b3b7bf] focus:border-[#d1d5db]"
              />
            </div>
          </div>
        </div>
      </div>

      {!selectedDocument ? (
        <>
          <div className="px-6 pt-3">
            <button
              type="button"
              onClick={() => {
                setImportTargetId(selectedKnowledgeBase?.id || null)
                setUploadQueue([])
              }}
              className="inline-flex h-9 items-center gap-2 rounded-full bg-[#f40d12] px-4 text-sm font-medium text-white transition hover:bg-[#df0d12]"
            >
              <PlusIcon className="h-4 w-4" />
              Import Documents
            </button>
          </div>
          {renderDocumentRows()}
        </>
      ) : activeTab === 'docs' ? (
        <div className="flex-1 overflow-auto px-6 pb-6 pt-4">
          <div className="overflow-hidden rounded-[14px] border border-[#eceef3] bg-white">
            <div className="grid grid-cols-[56px_minmax(0,1fr)_140px_170px_92px] items-center gap-4 border-b border-[#f1f3f6] px-4 py-3">
              <div className="flex justify-center">
                <FileTypeIcon fileType={selectedDocument.fileType} className="h-11 w-9" />
              </div>
              <div className="min-w-0">
                <div className="truncate text-[15px] font-medium text-[#111827]">{selectedDocument.name}</div>
                <div className="mt-1 text-sm text-[#6b7280]">{selectedDocument.summary || 'No summary available.'}</div>
              </div>
              <div>
                <span className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium ${(STATUS_META[selectedDocument.status] || STATUS_META.pending).badgeClass}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${(STATUS_META[selectedDocument.status] || STATUS_META.pending).dotClass}`} />
                  {(STATUS_META[selectedDocument.status] || STATUS_META.pending).label}
                </span>
              </div>
              <div className="text-sm text-[#374151]">{selectedDocument.updatedAt}</div>
              <div className="flex items-center justify-end gap-4 text-[#6b7280]">
                <IconButton title="Preview" onClick={() => setPreviewDocument(selectedDocument)}>
                  <EyeIcon className="h-4 w-4" />
                </IconButton>
                <IconButton title="Delete" onClick={() => handleDeleteDocument(selectedDocument.id)}>
                  <TrashIcon className="h-4 w-4" />
                </IconButton>
              </div>
            </div>
            <div className="px-5 py-5">
              {previewState.loading ? (
                <div className="rounded-[14px] border border-dashed border-[#e5e7eb] px-4 py-8 text-center text-sm text-[#94a3b8]">
                  Loading preview...
                </div>
              ) : previewState.type === 'image' && previewState.url ? (
                <div className="overflow-auto rounded-[14px] border border-[#eceef3] bg-[#f8fafc] p-4">
                  <img src={previewState.url} alt={selectedDocument.name} className="mx-auto h-auto max-w-full rounded-[10px]" />
                </div>
              ) : previewState.type === 'pdf' && previewState.url ? (
                <div className="overflow-hidden rounded-[14px] border border-[#eceef3] bg-[#f8fafc]">
                  <iframe title={selectedDocument.name} src={previewState.url} className="h-[72vh] w-full bg-white" />
                </div>
              ) : previewState.type === 'markdown' ? (
                <div className="max-h-[72vh] overflow-auto rounded-[14px] border border-[#eceef3] bg-[#f8fafc] px-5 py-4">
                  <pre className="whitespace-pre-wrap break-words text-sm leading-7 text-[#4b5563]">{previewState.markdown || 'No preview text available.'}</pre>
                </div>
              ) : (
                <div className="rounded-[14px] border border-dashed border-[#e5e7eb] px-4 py-8 text-center text-sm text-[#94a3b8]">
                  {previewState.error || 'This file type does not support inline preview yet.'}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        renderChunkRows()
      )}
    </div>
  )

  return (
    <div className="flex min-h-screen bg-[#f7f7f8] text-[#111827]">
      <Sidebar />

      <div className="flex-1 overflow-hidden">
        <div className="h-screen overflow-hidden bg-white">
          {viewMode === 'list' ? renderListView() : renderDetailView()}
        </div>
      </div>

      {modalMode ? (
        <div className="fixed inset-0 z-50 bg-white">
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between border-b border-[#eceef3] px-6 py-4">
              <h2 className="text-[20px] font-semibold text-[#111827]">{modalMode === 'edit' ? 'Edit Knowledge Base' : 'Create Knowledge Base'}</h2>
              <button type="button" onClick={closeModal} className="text-[#444] transition hover:text-[#111827]">
                <CloseIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-auto px-6 py-8">
              <div className="mx-auto w-full max-w-[620px] rounded-[18px] border border-[#e5e7eb] bg-[#fbfbfc] p-5 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
                <div className="flex items-center gap-3 border-b border-[#e5e7eb] pb-4">
                  <div className="rounded-md border border-[#3f3f46] p-1 text-[#3f3f46]">
                    <DocPanelIcon className="h-5 w-5" />
                  </div>
                  <div className="text-[17px] font-semibold text-[#111827]">Knowledge Base Details</div>
                </div>

                <div className="space-y-5 pt-4">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-[#111827]">Name*</label>
                    <input
                      value={form.name}
                      onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                      placeholder="Enter dataset name"
                      className="h-11 w-full rounded-[10px] border border-[#e5e7eb] bg-white px-3 text-sm outline-none transition placeholder:text-[#b3b7bf] focus:border-[#d1d5db]"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-[#111827]">Description</label>
                    <textarea
                      rows={3}
                      value={form.description}
                      onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                      placeholder="Enter description of dataset content"
                      className="w-full rounded-[10px] border border-[#e5e7eb] bg-white px-3 py-3 text-sm outline-none transition placeholder:text-[#b3b7bf] focus:border-[#d1d5db]"
                    />
                  </div>

                  <div className="rounded-[14px] border border-[#e5e7eb] bg-white p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="text-sm font-semibold text-[#111827]">Connect Volcengine Knowledge Base</div>
                        <div className="mt-1 text-xs leading-5 text-[#6b7280]">
                          Create a new remote Volcengine knowledge base directly from DES, or switch to connect an existing one.
                        </div>
                      </div>
                      <ToggleSwitch
                        checked={form.connectVolcengine}
                        onChange={() => setForm((current) => ({
                          ...current,
                          connectVolcengine: !current.connectVolcengine,
                        }))}
                      />
                    </div>

                    {form.connectVolcengine ? (
                      <div className="mt-4 grid gap-4 md:grid-cols-2">
                        <div className="md:col-span-2">
                          <div className="mb-2 block text-sm font-medium text-[#111827]">Remote Setup</div>
                          <div className="grid grid-cols-2 gap-2 rounded-[12px] bg-[#f3f4f6] p-1">
                            <button
                              type="button"
                              onClick={() => setForm((current) => ({ ...current, useExistingRemote: false, remoteResourceId: '' }))}
                              className={`rounded-[10px] px-3 py-2 text-sm font-medium transition ${!form.useExistingRemote ? 'bg-white text-[#111827] shadow-[0_1px_2px_rgba(15,23,42,0.06)]' : 'text-[#6b7280]'}`}
                            >
                              Create New Remote KB
                            </button>
                            <button
                              type="button"
                              onClick={() => setForm((current) => ({ ...current, useExistingRemote: true }))}
                              className={`rounded-[10px] px-3 py-2 text-sm font-medium transition ${form.useExistingRemote ? 'bg-white text-[#111827] shadow-[0_1px_2px_rgba(15,23,42,0.06)]' : 'text-[#6b7280]'}`}
                            >
                              Connect Existing Remote KB
                            </button>
                          </div>
                          {!form.useExistingRemote ? (
                            <div className="mt-3 rounded-[10px] border border-[#e5e7eb] bg-[#fafafa] px-3 py-3 text-xs leading-5 text-[#6b7280]">
                              DES will create a new Volcengine knowledge base when you save. You only need to provide the remote knowledge base name, project, and host.
                            </div>
                          ) : null}
                        </div>

                        {form.useExistingRemote ? (
                          <div className="md:col-span-2">
                            <label className="mb-2 block text-sm font-medium text-[#111827]">Remote Resource ID*</label>
                            <input
                              value={form.remoteResourceId}
                              onChange={(event) => setForm((current) => ({ ...current, remoteResourceId: event.target.value }))}
                              placeholder="Enter Volcengine resource_id"
                              className="h-11 w-full rounded-[10px] border border-[#e5e7eb] bg-white px-3 text-sm outline-none transition placeholder:text-[#b3b7bf] focus:border-[#d1d5db]"
                            />
                          </div>
                        ) : null}

                        <div>
                          <label className="mb-2 block text-sm font-medium text-[#111827]">Project</label>
                          <input
                            value={form.remoteProject}
                            onChange={(event) => setForm((current) => ({ ...current, remoteProject: event.target.value }))}
                            placeholder="default"
                            className="h-11 w-full rounded-[10px] border border-[#e5e7eb] bg-white px-3 text-sm outline-none transition placeholder:text-[#b3b7bf] focus:border-[#d1d5db]"
                          />
                        </div>

                        <div>
                          <label className="mb-2 block text-sm font-medium text-[#111827]">Host</label>
                          <input
                            value={form.remoteHost}
                            onChange={(event) => setForm((current) => ({ ...current, remoteHost: event.target.value }))}
                            placeholder="api-knowledgebase.mlp.cn-beijing.volces.com"
                            className="h-11 w-full rounded-[10px] border border-[#e5e7eb] bg-white px-3 text-sm outline-none transition placeholder:text-[#b3b7bf] focus:border-[#d1d5db]"
                          />
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-center gap-4 border-t border-[#eceef3] px-6 py-4 shadow-[0_-8px_30px_rgba(15,23,42,0.04)]">
              <button
                type="button"
                onClick={() => saveKnowledgeBase({ openImport: false })}
                disabled={isSavingKnowledgeBase}
                className="rounded-full border border-[#e5e7eb] bg-white px-5 py-2.5 text-sm font-medium text-[#111827] transition hover:bg-[#fafafa]"
              >
                {isSavingKnowledgeBase ? 'Saving...' : (modalMode === 'edit' ? 'Save Changes' : 'Complete Creation')}
              </button>
              <button
                type="button"
                onClick={() => saveKnowledgeBase({ openImport: true })}
                disabled={isSavingKnowledgeBase}
                className="rounded-full bg-[#f40d12] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-[#df0d12]"
              >
                {isSavingKnowledgeBase ? 'Saving...' : (modalMode === 'edit' ? 'Save and Import' : 'Create and Import')}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {importTargetId ? (
        <div className="fixed inset-0 z-[60] bg-white">
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between border-b border-[#eceef3] px-6 py-4">
              <h2 className="text-[20px] font-semibold text-[#111827]">Import Documents</h2>
              <button type="button" onClick={() => setImportTargetId(null)} className="text-[#444] transition hover:text-[#111827]">
                <CloseIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-auto px-6 py-8">
              <div className="mx-auto w-full max-w-[550px] rounded-[18px] border border-[#e5e7eb] bg-[#fbfbfc] p-5 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
                <div className="flex items-center gap-3 border-b border-transparent pb-2">
                  <div className="text-[#111827]">
                    <UploadIcon className="h-5 w-5" />
                  </div>
                  <div className="text-[17px] font-semibold text-[#111827]">Upload File</div>
                </div>

                <label className="mt-2 block cursor-pointer rounded-[16px] border border-dashed border-[#d8dde6] bg-white px-6 py-14 text-center transition hover:border-[#c7cdd8]">
                  <input
                    type="file"
                    multiple
                    accept=".pdf,.txt,.doc,.docx,.jpg,.jpeg,.png"
                    onChange={(event) => {
                      handleQueueFiles(event.target.files)
                      event.target.value = ''
                    }}
                    className="hidden"
                  />

                  <div className="mx-auto flex w-fit items-center gap-3">
                    <FileTypeIcon fileType="TXT" className="h-11 w-9" />
                    <FileTypeIcon fileType="DOCX" className="h-11 w-9" />
                    <FileTypeIcon fileType="PDF" className="h-11 w-9" />
                    <FileTypeIcon fileType="PNG" className="h-11 w-9" />
                    <FileTypeIcon fileType="JPG" className="h-11 w-9" />
                  </div>
                  <div className="mt-4 text-[15px] text-[#111827]">Click to upload or drag documents here</div>
                  <div className="mt-2 text-xs text-[#8a93a3]">Supports PDF, TXT, DOCX, JPG, PNG. Max 10 files, each file not exceeding 20MB</div>
                  <div className="mt-2 text-xs text-[#8a93a3]">Files are uploaded to your TOS bucket first, then imported into Volcengine knowledge base for indexing.</div>
                </label>

                <div className="mt-5">
                  <div className="mb-3 text-[15px] font-semibold text-[#111827]">Uploaded Files</div>
                  <div className="space-y-3">
                    {uploadQueue.length === 0 ? (
                      <div className="rounded-[14px] border border-dashed border-[#e5e7eb] px-4 py-8 text-center text-sm text-[#94a3b8]">
                        No files uploaded yet.
                      </div>
                    ) : uploadQueue.map((item) => {
                      const statusMeta = STATUS_META[item.status] || STATUS_META.pending
                      return (
                        <div key={item.id} className="grid grid-cols-[44px_minmax(0,1fr)_110px_24px] items-center gap-3 rounded-[14px] border border-[#eceef3] bg-white px-4 py-3">
                          <div className="flex justify-center">
                            <FileTypeIcon fileType={item.fileType} className="h-10 w-8" />
                          </div>
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium text-[#111827]">{item.name}</div>
                            <div className="mt-1 text-xs text-[#8a93a3]">{item.sizeLabel}</div>
                            {item.status === 'processing' ? (
                              <div className="mt-2 h-1.5 rounded-full bg-[#f3f4f6]">
                                <div className="h-1.5 rounded-full bg-[#d1d5db]" style={{ width: `${item.progress}%` }} />
                              </div>
                            ) : null}
                          </div>
                          <div className="flex justify-end">
                            <span className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium ${statusMeta.badgeClass}`}>
                              <span className={`h-1.5 w-1.5 rounded-full ${statusMeta.dotClass}`} />
                              {statusMeta.label}
                            </span>
                          </div>
                          <button type="button" onClick={() => handleRemoveQueuedFile(item.id)} className="text-[#9ca3af] transition hover:text-[#111827]">
                            <CloseIcon className="h-4 w-4" />
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-center border-t border-[#eceef3] px-6 py-4 shadow-[0_-8px_30px_rgba(15,23,42,0.04)]">
              <button
                type="button"
                onClick={handleSaveImportedDocuments}
                disabled={isUploadingDocuments || duplicateResolution.isOpen}
                className="rounded-full bg-[#f40d12] px-6 py-2.5 text-sm font-medium text-white transition hover:bg-[#df0d12]"
              >
                {isUploadingDocuments ? 'Uploading...' : 'Save and Process'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {duplicateResolution.isOpen && duplicateResolution.currentFile ? (
        <div className="fixed inset-0 z-[65] flex items-center justify-center bg-[rgba(15,23,42,0.38)] px-6">
          <div className="w-full max-w-[480px] rounded-[20px] bg-white p-6 shadow-[0_24px_70px_rgba(15,23,42,0.22)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[20px] font-semibold text-[#111827]">Same Document Name Detected</div>
                <div className="mt-2 text-sm leading-6 text-[#6b7280]">
                  The file{' '}
                  <span className="font-medium break-all text-[#111827]">{duplicateResolution.currentFile.name}</span>{' '}
                  already exists in this knowledge base.
                </div>
              </div>
              <button type="button" onClick={closeDuplicateResolution} className="text-[#9ca3af] transition hover:text-[#111827]">
                <CloseIcon className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => advanceDuplicateResolution({ acceptCurrent: false })}
                className="rounded-full border border-[#d1d5db] px-5 py-2.5 text-sm font-medium text-[#374151] transition hover:border-[#9ca3af] hover:text-[#111827]"
              >
                Ignore This File
              </button>
              <button
                type="button"
                onClick={() => advanceDuplicateResolution({ acceptCurrent: true })}
                className="rounded-full bg-[#f40d12] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-[#df0d12]"
              >
                Update Document
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {previewDocument ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/30 px-6">
          <div className="w-full max-w-[720px] rounded-[18px] bg-white shadow-[0_24px_70px_rgba(15,23,42,0.18)]">
            <div className="flex items-center justify-between border-b border-[#eceef3] px-5 py-4">
              <div className="text-[17px] font-semibold text-[#111827]">{previewDocument.name}</div>
              <button type="button" onClick={() => setPreviewDocument(null)} className="text-[#6b7280] transition hover:text-[#111827]">
                <CloseIcon className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-4 px-5 py-5">
              {previewState.loading ? (
                <div className="rounded-[14px] border border-dashed border-[#e5e7eb] px-4 py-10 text-center text-sm text-[#94a3b8]">
                  Loading preview...
                </div>
              ) : previewState.type === 'image' && previewState.url ? (
                <div className="overflow-auto rounded-[14px] border border-[#eceef3] bg-[#f8fafc] p-3">
                  <img src={previewState.url} alt={previewDocument.name} className="mx-auto h-auto max-w-full rounded-[10px]" />
                </div>
              ) : previewState.type === 'pdf' && previewState.url ? (
                <div className="overflow-hidden rounded-[14px] border border-[#eceef3] bg-[#f8fafc]">
                  <iframe title={previewDocument.name} src={previewState.url} className="h-[72vh] w-full bg-white" />
                </div>
              ) : previewState.type === 'markdown' ? (
                <div className="max-h-[72vh] overflow-auto rounded-[14px] border border-[#eceef3] bg-[#f8fafc] px-5 py-4">
                  <pre className="whitespace-pre-wrap break-words text-sm leading-7 text-[#4b5563]">{previewState.markdown || 'No preview text available.'}</pre>
                </div>
              ) : (
                <div className="rounded-[14px] border border-dashed border-[#e5e7eb] px-4 py-10 text-center text-sm text-[#94a3b8]">
                  {previewState.error || 'This file type does not support inline preview yet.'}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default KnowledgeBase