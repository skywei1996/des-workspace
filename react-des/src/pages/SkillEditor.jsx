import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import DeleteConfirmModal from '../components/DeleteConfirmModal'
import { API_BASE, buildApiUrl } from '../config/api'

const baseInputClassName = 'w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-[#6266EA]'
const disabledInputClassName = 'disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed'

const WORKFLOW_STEP_TYPE_OPTIONS = [
  { value: 'auto_step', label: 'Auto Run' },
  { value: 'feedback_step', label: 'Wait for User Input' },
]

const normalizeWorkflowStepType = (stepType = 'auto_step') => {
  if (['input_step', 'approval_step', 'revision_step', 'feedback_step'].includes(stepType)) {
    return 'feedback_step'
  }
  return 'auto_step'
}

const createWorkflowStep = (index = 1) => ({
  id: `step_${index}`,
  name: `Step ${index}`,
  step_type: 'auto_step',
  skill_key: '',
  instructions: '',
  input_keys: [],
  output_key: '',
  enabled: true,
})

const normalizeWorkflowStep = (step, index) => ({
  id: step?.id || `step_${index + 1}`,
  name: step?.name || `Step ${index + 1}`,
  step_type: normalizeWorkflowStepType(step?.step_type || 'auto_step'),
  skill_key: step?.skill_key || '',
  instructions: step?.instructions || '',
  input_keys: Array.isArray(step?.input_keys) ? step.input_keys : [],
  output_key: step?.output_key || '',
  enabled: step?.enabled ?? true,
})

const normalizeAssetEntry = (asset, index) => ({
  file_name: asset?.file_name || asset?.name || `asset_${index + 1}`,
  relative_path: asset?.relative_path || asset?.path || asset?.file_name || `assets/asset_${index + 1}`,
  media_type: asset?.media_type || asset?.type || 'application/octet-stream',
  size_bytes: Number(asset?.size_bytes || 0) || 0,
  source_type: asset?.source_type || 'uploaded_file',
  stored: Boolean(asset?.stored),
  storage_path: asset?.storage_path || '',
  download_url: asset?.download_url || '',
  knowledge_base_id: asset?.knowledge_base_id || '',
  knowledge_base_name: asset?.knowledge_base_name || asset?.file_name || '',
  knowledge_base_description: asset?.knowledge_base_description || '',
  processed_document_count: Number(asset?.processed_document_count || 0) || 0,
})

const normalizePackageFileEntry = (file, index) => ({
  file_name: file?.file_name || file?.name || `file_${index + 1}`,
  relative_path: file?.relative_path || file?.path || file?.file_name || `file_${index + 1}`,
  media_type: file?.media_type || file?.type || 'application/octet-stream',
  size_bytes: Number(file?.size_bytes || 0) || 0,
  stored: Boolean(file?.stored),
  download_url: file?.download_url || '',
})

const buildPackageFileRows = (files = []) => {
  const rows = []
  const seenFolders = new Set()

  files.forEach((file) => {
    const parts = String(file.relative_path || file.file_name || '').split('/').filter(Boolean)
    const fileName = parts.pop() || file.file_name || 'file'
    let currentPath = ''

    parts.forEach((folderName, folderIndex) => {
      currentPath = currentPath ? `${currentPath}/${folderName}` : folderName
      if (!seenFolders.has(currentPath)) {
        seenFolders.add(currentPath)
        rows.push({
          type: 'folder',
          key: `folder:${currentPath}`,
          name: folderName,
          path: currentPath,
          depth: folderIndex,
        })
      }
    })

    rows.push({
      type: 'file',
      key: `file:${file.relative_path || file.file_name}`,
      name: fileName,
      file,
      depth: parts.length,
    })
  })

  return rows
}

const canPreviewFile = (file) => {
  const mediaType = String(file?.media_type || '').toLowerCase()
  const path = String(file?.relative_path || file?.file_name || '').toLowerCase()
  return mediaType.startsWith('text/') || /\.(md|markdown|txt|json|yaml|yml|toml|ini|env|js|jsx|ts|tsx|py|css|html)$/i.test(path)
}

const PackageFilesSection = ({ files }) => {
  const rows = useMemo(() => buildPackageFileRows(files), [files])
  const fileRows = useMemo(() => rows.filter((row) => row.type === 'file'), [rows])
  const [selectedFileKey, setSelectedFileKey] = useState('')
  const [collapsedFolders, setCollapsedFolders] = useState(() => new Set())
  const [previewState, setPreviewState] = useState({ status: 'idle', content: '', error: '' })

  useEffect(() => {
    if (!fileRows.length) {
      setSelectedFileKey('')
      return
    }
    if (!fileRows.some((row) => row.key === selectedFileKey)) {
      setSelectedFileKey(fileRows[0].key)
    }
  }, [fileRows, selectedFileKey])

  const selectedRow = fileRows.find((row) => row.key === selectedFileKey) || fileRows[0]
  const selectedFile = selectedRow?.file || null
  const selectedFileHref = selectedFile?.download_url ? buildApiUrl(selectedFile.download_url) : ''
  const visibleRows = useMemo(() => {
    const collapsedPaths = Array.from(collapsedFolders)
    return rows.filter((row) => {
      if (row.type === 'folder') {
        return !collapsedPaths.some((folderPath) => row.path.startsWith(`${folderPath}/`))
      }
      const filePath = row.file?.relative_path || ''
      return !collapsedPaths.some((folderPath) => filePath.startsWith(`${folderPath}/`))
    })
  }, [collapsedFolders, rows])

  const toggleFolder = (folderPath) => {
    setCollapsedFolders((current) => {
      const next = new Set(current)
      if (next.has(folderPath)) {
        next.delete(folderPath)
      } else {
        next.add(folderPath)
      }
      return next
    })
  }

  useEffect(() => {
    if (!selectedFile || !selectedFileHref) {
      setPreviewState({ status: 'idle', content: '', error: '' })
      return undefined
    }
    if (!canPreviewFile(selectedFile)) {
      setPreviewState({ status: 'binary', content: '', error: '' })
      return undefined
    }

    const controller = new AbortController()
    setPreviewState({ status: 'loading', content: '', error: '' })
    fetch(selectedFileHref, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error('Failed to load file preview')
        return response.text()
      })
      .then((content) => setPreviewState({ status: 'ready', content, error: '' }))
      .catch((error) => {
        if (error.name === 'AbortError') return
        setPreviewState({ status: 'error', content: '', error: error.message || 'Failed to load file preview' })
      })

    return () => controller.abort()
  }, [selectedFile, selectedFileHref])

  if (!files.length) return null

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-base font-semibold text-gray-900">Package Files</div>
        </div>
      </div>

      <div className="grid h-[560px] overflow-hidden rounded-2xl border border-gray-200 lg:grid-cols-[320px_1fr]">
        <div className="h-full overflow-y-auto border-b border-gray-200 bg-[#fbfbfc] p-2 lg:border-b-0 lg:border-r">
          {visibleRows.map((row) => {
            if (row.type === 'folder') {
              const isCollapsed = collapsedFolders.has(row.path)
              return (
                <button
                  key={row.key}
                  type="button"
                  onClick={() => toggleFolder(row.path)}
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-medium text-gray-700 transition hover:bg-white"
                  style={{ paddingLeft: `${12 + row.depth * 18}px` }}
                >
                  <svg className={`h-3.5 w-3.5 shrink-0 text-gray-400 transition-transform ${isCollapsed ? '' : 'rotate-90'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m9 5 7 7-7 7" />
                  </svg>
                  <svg className="h-4 w-4 shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3.75 6.75A2.25 2.25 0 0 1 6 4.5h4.2l1.8 2.25H18A2.25 2.25 0 0 1 20.25 9v8.25A2.25 2.25 0 0 1 18 19.5H6a2.25 2.25 0 0 1-2.25-2.25V6.75Z" />
                  </svg>
                  <span className="truncate">{row.name}</span>
                </button>
              )
            }

            const isSelected = selectedRow?.key === row.key
            return (
              <button
                key={row.key}
                type="button"
                onClick={() => setSelectedFileKey(row.key)}
                className={`flex w-full items-start gap-2 rounded-xl px-3 py-2 text-left text-sm transition ${isSelected ? 'bg-white text-[#d9291f] shadow-sm ring-1 ring-[#f4cac5]' : 'text-gray-600 hover:bg-white'}`}
                style={{ paddingLeft: `${12 + row.depth * 18}px` }}
              >
                <svg className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M7 3.75h6.75L19 9v11.25H7A2 2 0 0 1 5 18.25V5.75a2 2 0 0 1 2-2Z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13.75 3.75V9H19" />
                </svg>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{row.name}</span>
                </span>
              </button>
            )
          })}
        </div>

        <div className="h-full min-h-0 bg-white">
          {selectedFile ? (
            <div className="flex h-full flex-col">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-gray-900">{selectedFile.relative_path}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                    <span>{selectedFile.kind}</span>
                    <span>{selectedFile.media_type}</span>
                  </div>
                </div>
              </div>
              <div className="min-h-0 flex-1 overflow-auto bg-[#f8fafc] p-5">
                {previewState.status === 'loading' ? (
                  <div className="text-sm text-gray-500">Loading preview...</div>
                ) : previewState.status === 'ready' ? (
                  <pre className="whitespace-pre-wrap break-words font-mono text-sm leading-6 text-gray-700">{previewState.content}</pre>
                ) : previewState.status === 'binary' ? (
                  <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-6 text-sm text-gray-500">This file type cannot be previewed inline.</div>
                ) : previewState.status === 'error' ? (
                  <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">{previewState.error}</div>
                ) : (
                  <div className="text-sm text-gray-500">Select a file on the left to preview it.</div>
                )}
              </div>
            </div>
          ) : (
            <div className="p-6 text-sm text-gray-500">No files available for preview.</div>
          )}
        </div>
      </div>
    </section>
  )
}

const normalizeErrorMessage = (value) => {
  if (!value) return ''
  if (typeof value !== 'string') return String(value)
  try {
    const parsed = JSON.parse(value)
    return parsed?.detail || parsed?.message || value
  } catch (error) {
    return value
  }
}

const slugifySkillName = (value = '') => {
  const slug = String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
  return slug || 'skill'
}

const getImportExceptionDialog = (message, context = 'parse') => {
  const normalizedMessage = normalizeErrorMessage(message)
  const lowerMessage = normalizedMessage.toLowerCase()

  if (lowerMessage.includes('skill key already exists')) {
    return {
      type: 'conflict',
      title: 'Skill Already Exists',
      description: 'A skill with the same target key already exists. Enable overwrite to replace the local version, or cancel this import.',
      detail: normalizedMessage,
      primaryLabel: 'Enable Overwrite',
      secondaryLabel: 'Cancel Import',
    }
  }

  if (lowerMessage.includes('not contain a skill.md') || lowerMessage.includes('no skill.md')) {
    return {
      type: 'file',
      title: 'SKILL.md Not Found',
      description: 'The uploaded package must include a SKILL.md file. Please check the package structure and upload again.',
      detail: normalizedMessage,
      primaryLabel: 'Choose Another File',
      secondaryLabel: 'Cancel Import',
    }
  }

  if (lowerMessage.includes('unsupported package format') || lowerMessage.includes('unsupported')) {
    return {
      type: 'file',
      title: 'Unsupported File Type',
      description: 'Only SKILL.md, .md, .markdown, and .zip files are supported for import.',
      detail: normalizedMessage,
      primaryLabel: 'Choose Another File',
      secondaryLabel: 'Cancel Import',
    }
  }

  if (lowerMessage.includes('yaml') || lowerMessage.includes('frontmatter')) {
    return {
      type: 'file',
      title: 'Invalid Skill Metadata',
      description: 'The Markdown file must include valid YAML frontmatter with the skill name and description.',
      detail: normalizedMessage,
      primaryLabel: 'Choose Another File',
      secondaryLabel: 'Cancel Import',
    }
  }

  if (lowerMessage.includes('zip') || lowerMessage.includes('archive')) {
    return {
      type: 'file',
      title: 'Package Parsing Failed',
      description: 'The zip package could not be parsed. Please make sure the file is complete and not encrypted.',
      detail: normalizedMessage,
      primaryLabel: 'Choose Another File',
      secondaryLabel: 'Cancel Import',
    }
  }

  if (context === 'install') {
    return {
      type: 'install',
      title: 'Install Failed',
      description: 'The skill was not installed. Please review the import settings and try again.',
      detail: normalizedMessage,
      primaryLabel: 'Try Again',
      secondaryLabel: 'Cancel Import',
    }
  }

  return {
    type: 'file',
    title: 'Import Failed',
    description: 'The skill package could not be imported. Please check the file and upload again.',
    detail: normalizedMessage,
    primaryLabel: 'Choose Another File',
    secondaryLabel: 'Cancel Import',
  }
}

const getSkillNameConflictDialog = (existingSkill, importedName) => {
  const canOverwrite = existingSkill && !existingSkill.readonly
  return {
    type: 'conflict',
    title: canOverwrite ? 'Replace Existing Skill?' : 'Skill Name Already Exists',
    description: canOverwrite
      ? `A skill named "${importedName || existingSkill?.name || 'this skill'}" already exists. Replacing it will overwrite the local version with the imported version.`
      : `A built-in or read-only skill named "${importedName || existingSkill?.name || 'this skill'}" already exists and cannot be overwritten. Please rename the imported skill or choose another package.`,
    detail: existingSkill?.skill_key ? `Existing skill: ${existingSkill.name} (${existingSkill.skill_key})` : '',
    primaryLabel: canOverwrite ? 'Replace Skill' : 'Choose Another File',
    secondaryLabel: 'Cancel',
    canOverwrite,
    targetSkillKey: canOverwrite ? existingSkill.skill_key : '',
  }
}

const ImportExceptionModal = ({ dialog, onClose, onPrimary, onCancel }) => {
  if (!dialog) return null

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-[#10131a]/28 px-6 py-10 backdrop-blur-[3px]" onClick={onClose}>
      <div
        className="w-full max-w-[640px] overflow-hidden rounded-[28px] border border-[#f1d1cc] bg-white shadow-[0_28px_90px_rgba(15,23,42,0.18)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-[#f4e3e0] bg-[linear-gradient(180deg,#ffffff_0%,#fff8f6_100%)] px-7 py-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#fff1ee] text-[#f40b0b]">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 9v4m0 4h.01M10.29 3.86 2.82 17a2 2 0 0 0 1.74 3h14.88a2 2 0 0 0 1.74-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
                </svg>
              </div>
              <div>
                <div className="text-[24px] font-semibold tracking-[-0.02em] text-[#101828]">{dialog.title}</div>
                <div className="mt-2 max-w-[520px] text-sm leading-6 text-[#667085]">{dialog.description}</div>
              </div>
            </div>
            <button type="button" onClick={onClose} className="rounded-full p-2 text-[#667085] transition hover:bg-white hover:text-[#101828]" aria-label="Close">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {dialog.detail ? (
          <div className="px-7 py-5">
            <div className="rounded-2xl border border-[#f1d1cc] bg-[#fff8f6] px-4 py-3 text-sm leading-6 text-[#b42318]">
              {dialog.detail}
            </div>
          </div>
        ) : null}

        <div className="flex items-center justify-end gap-3 border-t border-[#f4e3e0] bg-[#fcfcfd] px-7 py-5">
          <button type="button" onClick={onCancel} className="rounded-2xl border border-[#e5e7eb] bg-white px-5 py-2.5 text-sm font-medium text-[#475467] transition hover:bg-[#f8fafc]">
            {dialog.secondaryLabel}
          </button>
          <button type="button" onClick={onPrimary} className="rounded-2xl bg-[#f40b0b] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#de1010]">
            {dialog.primaryLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

const initialDraft = {
  skill_key: '',
  name: '',
  description: '',
  skill_type: 'prompt',
  instructions: '',
  imported_from_package: false,
  package_session_id: null,
  config_json: {},
  assets_manifest: [],
  workflow_steps: [],
  mcp_server_ids: [],
  enabled: true,
  overwrite_existing: false,
}

const getCreateModeFromLocation = (location) => {
  const params = new URLSearchParams(location.search)
  return params.get('mode') === 'import' || location.hash === '#import' ? 'import' : 'conversation'
}

const getCreateSkillTypeFromLocation = (location) => {
  const params = new URLSearchParams(location.search)
  const type = (params.get('type') || '').trim().toLowerCase()

  if (type === 'workflow') return 'workflow'
  if (type === 'mcp') return 'mcp'
  return 'prompt'
}

const createInitialDraft = (location) => ({
  ...initialDraft,
  skill_type: getCreateSkillTypeFromLocation(location),
})

const SkillBadge = ({ children, tone = 'default' }) => {
  const toneClassName = {
    default: 'bg-gray-100 text-gray-700',
    success: 'bg-emerald-100 text-emerald-700',
    accent: 'bg-indigo-100 text-indigo-700',
    warning: 'bg-amber-100 text-amber-700',
  }[tone]

  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${toneClassName}`}>{children}</span>
}

const SkillSectionTitle = ({ children }) => (
  <div className="flex items-center gap-2 text-xl font-semibold text-gray-900">
    <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-[#fff1ee] text-[#f40b0b]">
      <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
        <path d="M4.5 4.5h6.5v6.5H4.5V4.5Zm8.5 0h6.5v6.5H13V4.5ZM4.5 13h6.5v6.5H4.5V13Zm8.5 0h6.5v6.5H13V13Z" />
      </svg>
    </span>
    {children}
  </div>
)

const formatImpactNames = (items = [], emptyLabel = 'None') => {
  if (!items.length) return emptyLabel
  if (items.length <= 5) return items.join(', ')
  return `${items.slice(0, 5).join(', ')} and ${items.length - 5} more`
}

const SkillAIGeneratorModal = ({ isOpen, onClose, value, onChange, onGenerate, generating, errorMessage, title, description, placeholder, actionLabel }) => {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 px-4 backdrop-blur-sm">
      <div className="w-full max-w-3xl rounded-[28px] bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-2xl font-semibold text-gray-900">{title}</div>
            <div className="mt-2 text-sm leading-6 text-gray-500">{description}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-gray-200 px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-50"
          >
            Close
          </button>
        </div>

        <textarea
          rows={10}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="mt-5 w-full rounded-2xl border border-gray-200 bg-[#fbfbfd] px-4 py-3 text-sm leading-6 text-gray-900 outline-none transition focus:border-[#6266EA]"
        />

        {errorMessage ? (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMessage}
          </div>
        ) : null}

        <div className="mt-5 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onGenerate}
            disabled={generating}
            className="rounded-xl bg-[#6266EA] px-5 py-2.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {generating ? 'Generating...' : actionLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

const GeneratedInstructionApplyModal = ({ instructionText, onClose, onReplace, onAppend }) => {
  if (!instructionText) return null

  return (
    <div className="fixed inset-0 z-[85] flex items-center justify-center bg-black/45 px-4 backdrop-blur-sm">
      <div className="w-full max-w-3xl rounded-[28px] bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-2xl font-semibold text-gray-900">Apply AI Instruction</div>
            <div className="mt-2 text-sm leading-6 text-gray-500">Choose whether to replace the current instruction or append the generated content below the existing text.</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-gray-200 px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-50"
          >
            Close
          </button>
        </div>

        <textarea
          rows={12}
          readOnly
          value={instructionText}
          className="mt-5 w-full rounded-2xl border border-gray-200 bg-[#fbfbfd] px-4 py-3 font-mono text-sm leading-6 text-gray-900 outline-none"
        />

        <div className="mt-5 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onAppend}
            className="rounded-xl border border-[#cfd4ff] bg-[#f6f7ff] px-5 py-2.5 text-sm font-medium text-[#4f57d8] hover:border-[#b6bffb] hover:bg-[#eef1ff]"
          >
            Append
          </button>
          <button
            type="button"
            onClick={onReplace}
            className="rounded-xl bg-[#6266EA] px-5 py-2.5 text-sm font-medium text-white"
          >
            Replace
          </button>
        </div>
      </div>
    </div>
  )
}

const GeneratedDraftPreviewModal = ({ generatedDraft, onClose, onBackToAdjust, onApply, onChange }) => {
  if (!generatedDraft) return null

  const isWorkflowDraft = generatedDraft.skill_type === 'workflow'
  const workflowSteps = Array.isArray(generatedDraft.workflow_steps) ? generatedDraft.workflow_steps : []

  const updateField = (field, value) => {
    onChange({
      ...generatedDraft,
      [field]: value,
    })
  }

  const updateWorkflowStepDraft = (index, field, value) => {
    onChange({
      ...generatedDraft,
      workflow_steps: workflowSteps.map((step, stepIndex) => (
        stepIndex === index
          ? { ...step, [field]: value }
          : step
      )),
    })
  }

  return (
    <div className="fixed inset-0 z-[85] flex items-center justify-center bg-black/45 px-4 backdrop-blur-sm">
      <div className="flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-[28px] bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-2xl font-semibold text-gray-900">Preview AI Generated Content</div>
            <div className="mt-2 text-sm leading-6 text-gray-500">Review the generated content before applying it. You can go back, adjust the prompt, and generate again.</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-gray-200 px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-50"
          >
            Close
          </button>
        </div>

        <div className="mt-5 flex-1 space-y-4 overflow-y-auto pr-1">
          <div className="rounded-2xl border border-gray-200 bg-[#fbfbfd] p-4">
            <div className="text-xs font-medium uppercase tracking-[0.18em] text-gray-400">Name</div>
            <input
              value={generatedDraft.name || ''}
              onChange={(event) => updateField('name', event.target.value)}
              placeholder="Untitled Skill"
              className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-base font-semibold text-gray-900 outline-none transition focus:border-[#6266EA]"
            />
          </div>

          <div className="rounded-2xl border border-gray-200 bg-[#fbfbfd] p-4">
            <div className="text-xs font-medium uppercase tracking-[0.18em] text-gray-400">Description</div>
            <textarea
              rows={3}
              value={generatedDraft.description || ''}
              onChange={(event) => updateField('description', event.target.value)}
              placeholder="No description generated."
              className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm leading-6 text-gray-700 outline-none transition focus:border-[#6266EA]"
            />
          </div>

          <div className="rounded-2xl border border-gray-200 bg-[#fbfbfd] p-4">
            <div className="text-xs font-medium uppercase tracking-[0.18em] text-gray-400">{isWorkflowDraft ? 'Workflow Guidance' : 'Instructions'}</div>
            <textarea
              rows={12}
              value={generatedDraft.instructions || ''}
              onChange={(event) => updateField('instructions', event.target.value)}
              placeholder="No instructions generated."
              className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 font-mono text-sm leading-6 text-gray-700 outline-none transition focus:border-[#6266EA]"
            />
          </div>

          {isWorkflowDraft ? (
            <div className="rounded-2xl border border-gray-200 bg-[#fbfbfd] p-4">
              <div className="text-xs font-medium uppercase tracking-[0.18em] text-gray-400">Workflow Steps</div>
              <div className="mt-3 space-y-3">
                {workflowSteps.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-gray-300 px-4 py-4 text-sm text-gray-500">No workflow steps generated.</div>
                ) : workflowSteps.map((step, index) => (
                  <div key={step.id || `${step.name || 'step'}-${index}`} className="rounded-xl border border-gray-200 bg-white p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        value={step.name || ''}
                        onChange={(event) => updateWorkflowStepDraft(index, 'name', event.target.value)}
                        placeholder={`Step ${index + 1}`}
                        className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-900 outline-none transition focus:border-[#6266EA]"
                      />
                      <SkillBadge tone={step.step_type === 'feedback_step' ? 'warning' : 'accent'}>
                        {step.step_type === 'feedback_step' ? 'Wait for User Input' : 'Auto Run'}
                      </SkillBadge>
                    </div>
                    {step.skill_key ? <div className="mt-2 text-xs text-gray-500">Referenced Skill: {step.skill_key}</div> : null}
                    <textarea
                      rows={4}
                      value={step.instructions || ''}
                      onChange={(event) => updateWorkflowStepDraft(index, 'instructions', event.target.value)}
                      placeholder="No step guidance generated."
                      className="mt-2 w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm leading-6 text-gray-700 outline-none transition focus:border-[#6266EA]"
                    />
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div className="mt-5 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onBackToAdjust}
            className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            Back to Edit
          </button>
          <button
            type="button"
            onClick={onApply}
            className="rounded-xl bg-[#6266EA] px-5 py-2.5 text-sm font-medium text-white"
          >
            Apply to Form
          </button>
        </div>
      </div>
    </div>
  )
}

const ChevronIcon = ({ expanded, className = 'h-4 w-4' }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={`${className} transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`}
  >
    <path d="M9 18l6-6-6-6" />
  </svg>
)

const WorkflowStepCard = ({
  step,
  index,
  isEditable,
  availableSkills,
  isExpanded,
  onToggle,
  onChange,
  onRemove,
}) => {
  const pauseEnabled = step.step_type !== 'auto_step'
  const selectedSkill = availableSkills.find((skill) => skill.skill_key === step.skill_key)

  return (
    <div className={`overflow-hidden rounded-2xl border bg-white transition-all ${isExpanded ? 'border-[#6266EA] shadow-sm shadow-indigo-100/60' : 'border-gray-200'}`}>
      <button
        type="button"
        onClick={onToggle}
        className={`flex w-full items-start justify-between gap-4 px-4 py-4 text-left transition-colors ${isExpanded ? 'bg-indigo-50/70' : 'bg-white hover:bg-gray-50'}`}
      >
        <div className="flex min-w-0 items-start gap-3">
          <div className={`mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl text-xs font-semibold ${isExpanded ? 'bg-[#6266EA] text-white' : 'bg-gray-100 text-gray-700'}`}>
            {index + 1}
          </div>
          <div className="min-w-0 space-y-2">
            <div>
              <div className="text-sm font-semibold text-gray-900">{step.name || `Step ${index + 1}`}</div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {selectedSkill ? (
                <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">
                  {`Tool: ${selectedSkill.name}`}
                </span>
              ) : null}
            </div>
          </div>
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          <SkillBadge tone={pauseEnabled ? 'warning' : 'accent'}>{pauseEnabled ? 'Waiting for Input' : 'Auto Run'}</SkillBadge>
          {isEditable && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                onRemove()
              }}
              className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
            >
              Remove
            </button>
          )}
          <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs font-medium text-gray-600">
            <ChevronIcon expanded={isExpanded} className="h-3.5 w-3.5" />
            <span>{isExpanded ? 'Collapse' : 'Expand'}</span>
          </div>
        </div>
      </button>

      {isExpanded && (
        <div className="border-t border-gray-100 p-4">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-sm text-gray-700 md:col-span-2">
              <div className="mb-1 font-medium">Step Name</div>
              <input
                disabled={!isEditable}
                value={step.name}
                onChange={(event) => onChange({ ...step, name: event.target.value })}
                className={`${baseInputClassName} ${disabledInputClassName}`}
              />
            </label>

            <label className="text-sm text-gray-700">
              <div className="mb-1 font-medium">Execution Type</div>
              <select
                disabled={!isEditable}
                value={step.step_type}
                onChange={(event) => onChange({
                  ...step,
                  step_type: normalizeWorkflowStepType(event.target.value),
                })}
                className={`${baseInputClassName} ${disabledInputClassName}`}
              >
                {WORKFLOW_STEP_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>

            <label className="text-sm text-gray-700">
              <div className="mb-1 font-medium">Referenced Tool</div>
              <select
                disabled={!isEditable}
                value={step.skill_key}
                onChange={(event) => onChange({ ...step, skill_key: event.target.value })}
                className={`${baseInputClassName} ${disabledInputClassName}`}
              >
                <option value="">No referenced tool</option>
                {availableSkills.map((skill) => (
                  <option key={skill.skill_key} value={skill.skill_key}>{skill.name}</option>
                ))}
              </select>
            </label>

            <label className="text-sm text-gray-700 md:col-span-2">
              <div className="mb-1 font-medium">Step Guidance</div>
              <textarea
                rows={4}
                disabled={!isEditable}
                value={step.instructions}
                onChange={(event) => onChange({ ...step, instructions: event.target.value })}
                className={`${baseInputClassName} ${disabledInputClassName}`}
                placeholder="Define this step's instructions, business rules, and any user input or confirmation it requires."
              />
            </label>
          </div>
        </div>
      )}
    </div>
  )
}

const SkillEditor = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { skillKey } = useParams()
  const isCreateMode = !skillKey || skillKey === 'new'

  const [servers, setServers] = useState([])
  const [availableSkills, setAvailableSkills] = useState([])
  const [skill, setSkill] = useState(null)
  const [draft, setDraft] = useState(initialDraft)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [expandedStepIds, setExpandedStepIds] = useState([])
  const [isMcpDropdownOpen, setIsMcpDropdownOpen] = useState(false)
  const [mcpSearchQuery, setMcpSearchQuery] = useState('')
  const [isImporting, setIsImporting] = useState(false)
  const [isImportDragActive, setIsImportDragActive] = useState(false)
  const [importFeedback, setImportFeedback] = useState(null)
  const [importExceptionDialog, setImportExceptionDialog] = useState(null)
  const [importConflictSkill, setImportConflictSkill] = useState(null)
  const [importToast, setImportToast] = useState(null)
  const [isGeneratorOpen, setIsGeneratorOpen] = useState(false)
  const [generatorPrompt, setGeneratorPrompt] = useState('')
  const [generatorMode, setGeneratorMode] = useState('draft')
  const [pendingGeneratedDraft, setPendingGeneratedDraft] = useState(null)
  const [pendingGeneratedInstructions, setPendingGeneratedInstructions] = useState('')
  const [isGeneratingDraft, setIsGeneratingDraft] = useState(false)
  const [generateError, setGenerateError] = useState('')
  const [deleteDialog, setDeleteDialog] = useState({ open: false, sections: [] })
  const [createModeSelection, setCreateModeSelection] = useState(() => {
    if (!isCreateMode) return null
    return getCreateModeFromLocation(location)
  })
  const mcpDropdownRef = useRef(null)
  const importInputRef = useRef(null)
  const importSectionRef = useRef(null)

  const currentSkillType = isCreateMode ? draft.skill_type : (skill?.skill_type || draft.skill_type)
  const isWorkflowSkill = currentSkillType === 'workflow'
  const isImportingWorkflowSkill = isCreateMode && createModeSelection === 'import' && getCreateSkillTypeFromLocation(location) === 'workflow'
  const isReadonly = !isCreateMode && Boolean(skill?.readonly)
  const pageTitle = useMemo(() => {
    if (!isCreateMode) return isReadonly ? (skill?.name || 'Skill Details') : 'Update Skill'
    if (createModeSelection === 'import') return isImportingWorkflowSkill ? 'Import Workflow Skill' : 'Import Skill'
    if (currentSkillType === 'workflow') return 'Create Workflow Skill'
    if (currentSkillType === 'mcp') return 'Create MCP Skill'
    return 'Create Skill'
  }, [createModeSelection, currentSkillType, isCreateMode, isImportingWorkflowSkill, isReadonly, skill])
  const boundMcpServers = useMemo(() => {
    if (Array.isArray(skill?.mcp_servers) && skill.mcp_servers.length > 0) {
      return skill.mcp_servers
    }
    return skill?.mcp_server ? [skill.mcp_server] : []
  }, [skill])

  const hasMcpBinding = !isWorkflowSkill && Boolean(draft.mcp_server_ids.length || boundMcpServers.length)
  const instructionsPlaceholder = isWorkflowSkill
    ? "Describe the workflow's overall objective, the rules it must follow, how exceptions should be handled, and the final output it should deliver."
    : hasMcpBinding
      ? 'Describe when this MCP skill should be used, what it should help accomplish, and any rules or limits it must follow.'
      : 'Define how this skill should work, what rules it should follow, and what outcome it should produce.'
  const isEditable = isCreateMode || (!isReadonly && isEditing)
  const shouldHighlightImport = isCreateMode && location.hash === '#import'
  const hasImportedPackageState = Boolean(draft.imported_from_package || draft.package_session_id)
  const shouldShowImportedMinimalEditor = hasImportedPackageState && !isWorkflowSkill
  const shouldShowInstructionsSection = !hasImportedPackageState
  const isBasicInfoEditable = isEditable && !hasImportedPackageState
  const isConversationCreateMode = isCreateMode && createModeSelection === 'conversation'
  const isImportCreateMode = isCreateMode && createModeSelection === 'import'
  const generatorSkillType = isWorkflowSkill ? 'workflow' : 'prompt'
  const effectiveInstructionSkillType = isWorkflowSkill ? 'workflow' : (draft.mcp_server_ids.length > 0 ? 'mcp' : (draft.skill_type || 'prompt'))
  const hasImportedPackageDraft = isImportCreateMode && Boolean(draft.imported_from_package)
  const shouldRenderEditorBody = !isCreateMode || isConversationCreateMode
  const shouldShowFooterActions = !isImportCreateMode && (!isCreateMode || shouldRenderEditorBody)

  const generatorModalContent = useMemo(() => {
    if (generatorMode === 'instructions') {
      return {
        title: isWorkflowSkill ? 'Generate Workflow Guidance by Conversation' : 'Generate Skill Instructions by Conversation',
        description: isWorkflowSkill
          ? 'Describe the workflow goal, constraints, human confirmation points, exception handling, and final output. AI will generate only guidance/instructions text for this form.'
          : effectiveInstructionSkillType === 'mcp'
            ? 'Describe when this MCP skill should call tools, what to check before and after tool use, how to handle failures, and output requirements. AI will generate instruction text only.'
            : 'Describe the skill scenario, inputs, rules, outputs, and limits. AI will generate instruction text only.',
        placeholder: isWorkflowSkill
          ? 'Example: This workflow generates competitor analysis reports. It should validate inputs first, organize research, pause to ask follow-up questions when key details are missing, and produce a structured report with risks and open questions.'
          : effectiveInstructionSkillType === 'mcp'
            ? 'Example: Use MCP only when the user needs to fetch webpages, query external systems, or call enterprise tools. Check request clarity and permissions before calling tools; explain failures and alternatives; preserve key conclusions and sources.'
            : 'Example: This skill writes PRDs. It should organize background, target users, and requirements, call out missing information, and output goals, user stories, functional requirements, boundaries, and acceptance criteria.',
        actionLabel: 'Generate',
      }
    }

    return {
      title: generatorSkillType === 'workflow' ? 'Generate Workflow Skill by Conversation' : 'Generate Skill by Conversation',
      description: generatorSkillType === 'workflow'
        ? 'Describe the workflow goal, key steps, human confirmation points, and desired final output. AI will generate Name, Description, Guidance, and workflow steps.'
        : 'Describe what this skill should solve, when it applies, what it should output, and what rules it should follow. AI will generate Name, Description, and Instructions.',
      placeholder: generatorSkillType === 'workflow'
        ? 'Example: I want a competitor research workflow. The user provides an industry and target products; AI breaks down research dimensions, collects public information, drafts findings, asks follow-up questions if information is missing, and outputs a structured competitor analysis report.'
        : 'Example: I want a PRD writing skill. Given product background, target users, and requirements, AI should output a structured PRD with goals, user stories, functional requirements, boundaries, and acceptance criteria in a clear professional style.',
      actionLabel: 'Generate',
    }
  }, [effectiveInstructionSkillType, generatorMode, generatorSkillType, isWorkflowSkill])

  const selectableSkills = useMemo(() => {
    return availableSkills.filter((item) => item.skill_key !== skillKey && item.skill_type !== 'workflow')
  }, [availableSkills, skillKey])

  const filteredMcpServers = useMemo(() => {
    const normalizedQuery = mcpSearchQuery.trim().toLowerCase()
    if (!normalizedQuery) return servers
    return servers.filter((server) => (server.name || '').toLowerCase().includes(normalizedQuery))
  }, [mcpSearchQuery, servers])

  const selectedMcpServerNames = useMemo(() => {
    return servers
      .filter((server) => draft.mcp_server_ids.includes(String(server.id)))
      .map((server) => server.name)
  }, [draft.mcp_server_ids, servers])

  const mcpDropdownSummary = useMemo(() => {
    if (selectedMcpServerNames.length === 0) return 'Select MCP toolsets'
    if (selectedMcpServerNames.length <= 2) return selectedMcpServerNames.join(', ')
    return `${selectedMcpServerNames.length} MCP toolsets selected`
  }, [selectedMcpServerNames])

  const packageResourceFiles = useMemo(() => {
    const configFiles = Array.isArray(draft.config_json?.package_config_files)
      ? draft.config_json.package_config_files
      : []
    const entries = [
      ...draft.assets_manifest.map((asset, index) => ({ ...normalizeAssetEntry(asset, index), kind: 'Resource' })),
      ...configFiles.map((file, index) => ({ ...normalizePackageFileEntry(file, index), kind: 'Config' })),
    ]
    const deduped = new Map()
    entries.forEach((entry) => {
      const key = entry.relative_path || entry.file_name
      if (!key || deduped.has(key)) return
      deduped.set(key, entry)
    })
    return Array.from(deduped.values()).sort((left, right) => left.relative_path.localeCompare(right.relative_path))
  }, [draft.assets_manifest, draft.config_json])

  const loadPageData = async () => {
    setLoading(true)
    try {
      const requests = [fetch(`${API_BASE}/mcp-servers/`), fetch(`${API_BASE}/skills/`)]
      if (!isCreateMode) {
        requests.unshift(fetch(`${API_BASE}/skills/${skillKey}`))
      }

      const responses = await Promise.all(requests)
      let skillPayload = null
      let serversPayload = null
      let skillsPayload = null

      if (isCreateMode) {
        serversPayload = await responses[0].json()
        skillsPayload = await responses[1].json()
      } else {
        skillPayload = await responses[0].json()
        serversPayload = await responses[1].json()
        skillsPayload = await responses[2].json()
      }

      setServers(Array.isArray(serversPayload) ? serversPayload : [])
      setAvailableSkills(skillsPayload?.data?.skills || [])

      if (!isCreateMode) {
        const nextSkill = skillPayload?.data || null
        setSkill(nextSkill)
        setIsEditing(nextSkill ? !nextSkill.readonly : false)
        if (nextSkill) {
          const normalizedSteps = Array.isArray(nextSkill.workflow_steps) ? nextSkill.workflow_steps.map(normalizeWorkflowStep) : []
          setDraft({
            skill_key: nextSkill.skill_key || '',
            name: nextSkill.name || '',
            description: nextSkill.description || '',
            skill_type: nextSkill.skill_type || 'prompt',
            instructions: nextSkill.instructions || '',
            imported_from_package: Boolean(nextSkill.imported_from_package),
            package_session_id: null,
            config_json: nextSkill.config_json || {},
            assets_manifest: Array.isArray(nextSkill.assets_manifest) ? nextSkill.assets_manifest.map(normalizeAssetEntry) : [],
            workflow_steps: normalizedSteps,
            mcp_server_ids: Array.isArray(nextSkill.mcp_server_ids)
              ? nextSkill.mcp_server_ids.map((serverId) => String(serverId))
              : (nextSkill.mcp_server_id ? [String(nextSkill.mcp_server_id)] : []),
            enabled: nextSkill.enabled ?? true,
            overwrite_existing: false,
          })
          setExpandedStepIds(normalizedSteps.length > 0 ? [normalizedSteps[0].id] : [])
        }
      } else {
        setSkill(null)
        setCreateModeSelection(getCreateModeFromLocation(location))
        setDraft(createInitialDraft(location))
        setIsEditing(true)
        setExpandedStepIds([])
      }
    } catch (error) {
      console.error('Failed to load skill editor data:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPageData()
  }, [location.key, skillKey])

  useEffect(() => {
    if (!isCreateMode) {
      return
    }

    setCreateModeSelection(getCreateModeFromLocation(location))
  }, [isCreateMode, location])

  useEffect(() => {
    if (!shouldHighlightImport || !importSectionRef.current) {
      return
    }

    importSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [shouldHighlightImport])

  useEffect(() => {
    if (draft.skill_type !== 'workflow') {
      if (expandedStepIds.length > 0) {
        setExpandedStepIds([])
      }
      return
    }

    const currentIds = draft.workflow_steps.map((step) => step.id)
    setExpandedStepIds((current) => {
      const next = current.filter((id) => currentIds.includes(id))
      if (next.length === current.length) {
        return current
      }
      return next
    })
  }, [draft.skill_type, draft.workflow_steps, expandedStepIds.length])

  useEffect(() => {
    if (isWorkflowSkill || !isEditable) {
      setIsMcpDropdownOpen(false)
      setMcpSearchQuery('')
    }
  }, [isEditable, isWorkflowSkill])

  useEffect(() => {
    if (!importToast) return undefined

    const timer = window.setTimeout(() => {
      setImportToast((current) => (current?.id === importToast.id ? null : current))
    }, 2600)

    return () => window.clearTimeout(timer)
  }, [importToast])

  const showImportToast = (message) => {
    setImportToast({ id: Date.now(), message })
  }

  useEffect(() => {
    if (!isMcpDropdownOpen) return undefined

    const handlePointerDown = (event) => {
      if (mcpDropdownRef.current && !mcpDropdownRef.current.contains(event.target)) {
        setIsMcpDropdownOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [isMcpDropdownOpen])

  const handleMcpBindingChange = (nextServerId) => {
    setDraft((current) => ({
      ...current,
      mcp_server_ids: current.mcp_server_ids.includes(nextServerId)
        ? current.mcp_server_ids.filter((serverId) => serverId !== nextServerId)
        : [...current.mcp_server_ids, nextServerId],
      skill_type: current.skill_type === 'workflow'
        ? 'workflow'
        : ((current.mcp_server_ids.includes(nextServerId)
            ? current.mcp_server_ids.filter((serverId) => serverId !== nextServerId)
            : [...current.mcp_server_ids, nextServerId]).length > 0 ? 'mcp' : 'prompt'),
    }))
  }

  const handleSelectSkillType = (nextSkillType) => {
    setDraft((current) => ({
      ...current,
      skill_type: nextSkillType,
      mcp_server_ids: nextSkillType === 'mcp' ? current.mcp_server_ids : [],
    }))
  }

  const buildPayload = () => {
    const effectiveSkillType = draft.skill_type === 'workflow' ? 'workflow' : (draft.mcp_server_ids.length > 0 ? 'mcp' : 'prompt')

    return {
      ...draft,
      skill_type: effectiveSkillType,
      skill_key: draft.skill_key || undefined,
      imported_from_package: Boolean(draft.imported_from_package),
      package_session_id: draft.package_session_id || null,
      config_json: draft.config_json ?? {},
      assets_manifest: draft.assets_manifest.map((asset, index) => normalizeAssetEntry(asset, index)),
      mcp_server_ids: effectiveSkillType === 'mcp' ? draft.mcp_server_ids.map((serverId) => Number(serverId)) : [],
      mcp_server_id: effectiveSkillType === 'mcp' && draft.mcp_server_ids.length > 0 ? Number(draft.mcp_server_ids[0]) : null,
      workflow_steps: effectiveSkillType === 'workflow' ? draft.workflow_steps.map((step) => ({
      id: step.id,
      name: step.name,
      step_type: normalizeWorkflowStepType(step.step_type),
      skill_key: step.skill_key || null,
      instructions: step.instructions,
      input_keys: step.input_keys || [],
      output_key: step.output_key || null,
      enabled: step.enabled,
      })) : [],
      capabilities: [],
    }
  }

  const applyGeneratedWorkflowDraft = (generatedDraft) => {
    const normalizedSteps = Array.isArray(generatedDraft?.workflow_steps)
      ? generatedDraft.workflow_steps.map(normalizeWorkflowStep)
      : []

    setDraft((current) => ({
      ...current,
      name: generatedDraft?.name || current.name,
      description: generatedDraft?.description || current.description,
      skill_type: 'workflow',
      instructions: generatedDraft?.instructions || current.instructions,
      imported_from_package: false,
      package_session_id: current.package_session_id,
      config_json: generatedDraft?.config_json || current.config_json,
      assets_manifest: Array.isArray(generatedDraft?.assets_manifest) ? generatedDraft.assets_manifest.map(normalizeAssetEntry) : current.assets_manifest,
      workflow_steps: normalizedSteps,
      mcp_server_ids: [],
      enabled: true,
    }))

    setExpandedStepIds(normalizedSteps.length > 0 ? [normalizedSteps[0].id] : [])
  }

  const applyGeneratedPromptDraft = (generatedDraft) => {
    setDraft((current) => ({
      ...current,
      name: generatedDraft?.name || current.name,
      description: generatedDraft?.description || current.description,
      skill_type: current.skill_type === 'mcp' || current.mcp_server_ids.length > 0 ? 'mcp' : 'prompt',
      instructions: generatedDraft?.instructions || current.instructions,
      imported_from_package: false,
      package_session_id: current.package_session_id,
      workflow_steps: [],
      mcp_server_ids: current.skill_type === 'mcp' || current.mcp_server_ids.length > 0 ? current.mcp_server_ids : [],
      enabled: true,
    }))
    setExpandedStepIds([])
  }

  const openGeneratorForSkillType = (nextSkillType) => {
    handleSelectSkillType(nextSkillType)
    setGeneratorMode('draft')
    setGenerateError('')
    setGeneratorPrompt('')
    setIsGeneratorOpen(true)
  }

  const openInstructionsGenerator = () => {
    setGeneratorMode('instructions')
    setGenerateError('')
    setGeneratorPrompt('')
    setIsGeneratorOpen(true)
  }

  const applyGeneratedInstructions = (mode) => {
    const nextInstructionText = pendingGeneratedInstructions.trim()
    if (!nextInstructionText) {
      setPendingGeneratedInstructions('')
      return
    }

    setDraft((current) => {
      const existingInstructionText = (current.instructions || '').trim()
      const instructions = mode === 'append' && existingInstructionText
        ? `${existingInstructionText}\n\n${nextInstructionText}`
        : nextInstructionText

      return {
        ...current,
        instructions,
      }
    })

    setPendingGeneratedInstructions('')
  }

  const applyGeneratedDraftPreview = () => {
    if (!pendingGeneratedDraft) return

    if (pendingGeneratedDraft.skill_type === 'workflow') {
      applyGeneratedWorkflowDraft(pendingGeneratedDraft)
    } else {
      applyGeneratedPromptDraft(pendingGeneratedDraft)
    }

    setCreateModeSelection('conversation')
    setPendingGeneratedDraft(null)
    setGeneratorPrompt('')
  }

  const handleGenerateSkillDraft = async () => {
    const trimmedPrompt = generatorPrompt.trim()
    if (trimmedPrompt.length < 10) {
      setGenerateError(
        generatorMode === 'instructions'
          ? 'Please describe the goals, rules, or output requirements you want to add to the instructions.'
          : (generatorSkillType === 'workflow' ? 'Please describe a complete workflow goal and key steps.' : 'Please describe a complete skill goal, scenario, and output requirements.')
      )
      return
    }

    setIsGeneratingDraft(true)
    setGenerateError('')
    try {
      const endpoint = generatorMode === 'instructions' ? `${API_BASE}/skills/generate-instructions` : `${API_BASE}/skills/generate-draft`
      const requestBody = generatorMode === 'instructions'
        ? {
            user_description: trimmedPrompt,
            skill_type: effectiveInstructionSkillType,
            skill_name: draft.name,
            skill_description: draft.description,
            existing_instructions: draft.instructions,
          }
        : {
            user_description: trimmedPrompt,
            skill_type: generatorSkillType,
          }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      })

      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(payload?.detail || (generatorMode === 'instructions' ? 'Failed to generate skill instructions' : 'Failed to generate skill draft'))
      }

      if (generatorMode === 'instructions') {
        const nextInstructionText = (payload?.instructions || '').trim()
        if (!nextInstructionText) {
          throw new Error('Generated instruction is empty')
        }
        setPendingGeneratedInstructions(nextInstructionText)
      } else if (generatorSkillType === 'workflow') {
        setPendingGeneratedDraft({
          ...payload,
          skill_type: 'workflow',
        })
      } else {
        setPendingGeneratedDraft({
          ...payload,
          skill_type: currentSkillType === 'mcp' || draft.mcp_server_ids.length > 0 ? 'mcp' : 'prompt',
        })
      }

      setIsGeneratorOpen(false)
    } catch (error) {
      setGenerateError(error.message)
    } finally {
      setIsGeneratingDraft(false)
    }
  }

  const applyImportedSkill = (importedSkill) => {
    const nextSkillType = importedSkill.skill_type === 'workflow' ? 'workflow' : importedSkill.skill_type === 'mcp' ? 'mcp' : 'prompt'
    const normalizedSteps = Array.isArray(importedSkill?.workflow_steps)
      ? importedSkill.workflow_steps.map(normalizeWorkflowStep)
      : []
    const importedName = String(importedSkill.name || '').trim()
    const importedSkillKey = String(importedSkill.skill_key || '').trim()
    const duplicateSkill = availableSkills.find((item) => importedSkillKey && String(item.skill_key || '').trim() === importedSkillKey)
      || (importedName
        ? availableSkills.find((item) => String(item.name || '').trim().toLowerCase() === importedName.toLowerCase())
        : null)

    setDraft((current) => ({
      ...current,
      skill_key: duplicateSkill && !duplicateSkill.readonly ? duplicateSkill.skill_key : (importedSkill.skill_key || current.skill_key || ''),
      name: importedSkill.name || current.name,
      description: importedSkill.description || current.description,
      skill_type: nextSkillType,
      instructions: importedSkill.instructions || current.instructions,
      imported_from_package: true,
      package_session_id: importedSkill.package_session_id || current.package_session_id || null,
      config_json: importedSkill.config_json || {},
      assets_manifest: Array.isArray(importedSkill.assets_manifest) ? importedSkill.assets_manifest.map(normalizeAssetEntry) : [],
      workflow_steps: nextSkillType === 'workflow' ? normalizedSteps : current.workflow_steps,
    }))

    if (nextSkillType === 'workflow') {
      setExpandedStepIds(normalizedSteps.length > 0 ? [normalizedSteps[0].id] : [])
    }

    setImportFeedback({
      tone: 'success',
      fileName: importedSkill.fileName,
    })

    setImportConflictSkill(duplicateSkill || null)
    if (duplicateSkill) {
      setImportExceptionDialog(getSkillNameConflictDialog(duplicateSkill, importedName))
    }
  }

  const handleImportFile = async (file) => {
    if (!file) {
      return
    }

    setIsImporting(true)
    setImportFeedback(null)
    setImportExceptionDialog(null)
    setImportConflictSkill(null)
    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch(`${API_BASE}/skills/import-package`, {
        method: 'POST',
        body: formData,
      })

      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(payload?.detail || 'Failed to import this skill package.')
      }

      applyImportedSkill({
        ...payload,
        fileName: file.name,
      })
    } catch (error) {
      setImportExceptionDialog(getImportExceptionDialog(error instanceof Error ? error.message : 'Failed to import this skill file.', 'parse'))
    } finally {
      setIsImporting(false)
      if (importInputRef.current) {
        importInputRef.current.value = ''
      }
    }
  }

  const handleImportDrop = async (event) => {
    event.preventDefault()
    setIsImportDragActive(false)
    const [file] = Array.from(event.dataTransfer?.files || [])
    await handleImportFile(file)
  }

  const importFeedbackClassName = importFeedback?.tone === 'error'
    ? 'border-red-200 bg-red-50 text-red-700'
    : 'border-emerald-200 bg-emerald-50 text-emerald-700'

  const handleCreate = async () => {
    setSaving(true)
    try {
      const payload = buildPayload()
      if (isImportCreateMode && importConflictSkill && !importConflictSkill.readonly) {
        payload.overwrite_existing = true
        payload.skill_key = importConflictSkill.skill_key
      }

      const response = await fetch(`${API_BASE}/skills/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => null)
        const errorMessage = errorPayload?.detail || errorPayload?.message || 'Failed to create skill'
        if (isImportCreateMode && String(errorMessage).toLowerCase().includes('skill key already exists')) {
          const retryPayload = {
            ...payload,
            overwrite_existing: true,
            skill_key: payload.skill_key || slugifySkillName(payload.name),
          }
          const retryResponse = await fetch(`${API_BASE}/skills/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(retryPayload),
          })
          if (!retryResponse.ok) {
            const retryErrorPayload = await retryResponse.json().catch(() => null)
            throw new Error(retryErrorPayload?.detail || retryErrorPayload?.message || errorMessage)
          }
          const createdSkill = await retryResponse.json()
          navigate(isImportCreateMode ? '/tools' : `/tools/${createdSkill.skill_key}`)
          return
        }
        throw new Error(errorMessage)
      }

      const createdSkill = await response.json()
      navigate(isImportCreateMode ? '/tools' : `/tools/${createdSkill.skill_key}`)
    } catch (error) {
      if (isImportCreateMode) {
        showImportToast(normalizeErrorMessage(error.message) || 'Install failed. Please check the imported skill and try again.')
      } else {
        alert(error.message)
      }
    } finally {
      setSaving(false)
    }
  }

  const handleUpdate = async () => {
    if (!skill || skill.readonly) return

    setSaving(true)
    try {
      const response = await fetch(`${API_BASE}/skills/${skill.skill_key}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload()),
      })

      if (!response.ok) {
        throw new Error(await response.text() || 'Failed to update skill')
      }

      await loadPageData()
      setIsEditing(false)
    } catch (error) {
      alert(error.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!skill || skill.readonly) return

    let impactedEmployees = []
    try {
      const response = await fetch(`${API_BASE}/ai-employees/`)
      const employees = await response.json().catch(() => [])
      if (response.ok && Array.isArray(employees)) {
        impactedEmployees = employees
          .filter((employee) => Array.isArray(employee?.tool_ids) && employee.tool_ids.includes(skill.skill_key))
          .map((employee) => employee.name || `Employee ${employee.id}`)
      }
    } catch (error) {
      console.error('Failed to load skill impact range:', error)
    }

    setDeleteDialog({
      open: true,
      sections: [
        { label: 'Impact', value: `Affected digital employees: ${formatImpactNames(impactedEmployees)}` },
      ],
    })
  }

  const handleConfirmDelete = async () => {
    if (!skill || skill.readonly) return

    setSaving(true)
    try {
      const response = await fetch(`${API_BASE}/skills/${skill.skill_key}`, { method: 'DELETE' })
      if (!response.ok) {
        throw new Error(await response.text() || 'Failed to delete skill')
      }
      navigate('/tools')
    } catch (error) {
      alert(error.message)
    } finally {
      setSaving(false)
      setDeleteDialog({ open: false, sections: [] })
    }
  }

  const updateWorkflowStep = (index, nextStep) => {
    setDraft((current) => ({
      ...current,
      workflow_steps: current.workflow_steps.map((step, currentIndex) => (currentIndex === index ? normalizeWorkflowStep(nextStep, index) : step)),
    }))
  }

  const addWorkflowStep = () => {
    const nextStep = createWorkflowStep(draft.workflow_steps.length + 1)
    setDraft((current) => ({
      ...current,
      workflow_steps: [...current.workflow_steps, nextStep],
    }))
    setExpandedStepIds((current) => Array.from(new Set([...current, nextStep.id])))
  }

  const removeWorkflowStep = (index) => {
    const removedStepId = draft.workflow_steps[index]?.id
    setDraft((current) => ({
      ...current,
      workflow_steps: current.workflow_steps.filter((_, currentIndex) => currentIndex !== index).map(normalizeWorkflowStep),
    }))
    if (removedStepId) {
      setExpandedStepIds((current) => current.filter((id) => id !== removedStepId))
    }
  }

  const toggleWorkflowStepExpansion = (stepId) => {
    setExpandedStepIds((current) => (
      current.includes(stepId)
        ? current.filter((id) => id !== stepId)
        : [...current, stepId]
    ))
  }

  const expandAllWorkflowSteps = () => {
    setExpandedStepIds(draft.workflow_steps.map((step) => step.id))
  }

  const collapseAllWorkflowSteps = () => {
    setExpandedStepIds([])
  }

  const handleImportExceptionPrimary = () => {
    if (!importExceptionDialog) return

    if (importExceptionDialog.type === 'conflict') {
      if (!importExceptionDialog.canOverwrite && importExceptionDialog.canOverwrite !== undefined) {
        setImportExceptionDialog(null)
        importInputRef.current?.click()
        return
      }
      setDraft((current) => ({
        ...current,
        overwrite_existing: true,
        skill_key: importExceptionDialog.targetSkillKey || current.skill_key,
      }))
      setImportConflictSkill(null)
      setImportExceptionDialog(null)
      return
    }

    if (importExceptionDialog.type === 'install') {
      setImportExceptionDialog(null)
      handleCreate()
      return
    }

    setImportExceptionDialog(null)
    importInputRef.current?.click()
  }

  const handleImportExceptionCancel = () => {
    setImportExceptionDialog(null)
    navigate('/tools')
  }

  const packageDownloadHref = !isCreateMode && packageResourceFiles.length > 0
    ? buildApiUrl(`/skills/${draft.skill_key || skillKey}/download`)
    : ''

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <DeleteConfirmModal
        isOpen={deleteDialog.open}
        onClose={() => setDeleteDialog({ open: false, sections: [] })}
        onConfirm={handleConfirmDelete}
        title={skill ? `Delete Skill ${skill.name}?` : 'Delete Skill'}
        description="After deletion, this skill will be removed from the system. The digital employees above will no longer be able to use it, while historical execution records will be preserved."
        descriptionTone="danger"
        sections={deleteDialog.sections}
        confirmLabel="Delete"
        isSubmitting={saving}
      />
      <ImportExceptionModal
        dialog={importExceptionDialog}
        onClose={() => setImportExceptionDialog(null)}
        onPrimary={handleImportExceptionPrimary}
        onCancel={handleImportExceptionCancel}
      />
      {importToast && (
        <div className="pointer-events-none fixed bottom-6 left-1/2 z-[180] -translate-x-1/2 rounded-full bg-slate-900 px-5 py-3 text-sm font-medium text-white shadow-lg">
          {importToast.message}
        </div>
      )}

      <div className="relative flex-1 overflow-hidden">
        <div className="flex h-full flex-col">
          <header className="border-b border-gray-200 bg-white px-8 py-5">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-semibold text-gray-900">{pageTitle}</h1>
                {isCreateMode && (
                  <p className="mt-1 text-sm text-gray-500">
                    {isImportCreateMode
                      ? (isImportingWorkflowSkill ? 'Upload an existing workflow skill package and review its editable fields before saving.' : 'Upload an existing SKILL.md or zip package and review its editable fields before saving.')
                      : isWorkflowSkill
                        ? 'Configure a multi-step workflow skill, or generate an initial draft by conversation.'
                        : currentSkillType === 'mcp'
                          ? 'Create an MCP skill and bind one or more toolsets for controlled tool use.'
                          : 'Create a reusable skill with clear instructions and usable execution boundaries.'}
                  </p>
                )}
                {isReadonly && (
                  <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1.5 text-xs font-medium text-amber-800">
                    <span className="inline-flex h-2 w-2 rounded-full bg-amber-500" />
                    Built-in skills are read-only and can be assigned, but not edited here.
                  </div>
                )}
              </div>
              <div className="flex items-center gap-3">
                {packageDownloadHref ? (
                  <a
                    href={packageDownloadHref}
                    title="Download Skill"
                    aria-label="Download Skill"
                    className="flex h-9 w-9 items-center justify-center rounded-full text-[#f40b0b] transition hover:bg-[#fff1ee]"
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 4v10m0 0 4-4m-4 4-4-4M5 20h14" />
                    </svg>
                  </a>
                ) : null}
                {!isCreateMode && !isReadonly ? (
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={saving}
                    title="Delete Skill"
                    aria-label="Delete Skill"
                    className="flex h-9 w-9 items-center justify-center rounded-full text-[#f40b0b] transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M6 7h12M10 11v6m4-6v6M9 7l.75-2h4.5L15 7m-7 0 .75 12h6.5L16 7" />
                    </svg>
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => navigate('/tools')}
                  title="Close"
                  aria-label="Close"
                  className="flex h-9 w-9 items-center justify-center rounded-full text-gray-500 transition hover:bg-gray-100 hover:text-gray-800"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M6 18 18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto bg-[#f6f7fb] p-8 pb-32">
            {loading ? (
              <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-sm text-gray-500">Loading skill details...</div>
            ) : (
              <div className="mx-auto max-w-6xl space-y-6">
                {isImportCreateMode && (
                  <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                    <div
                      id="import"
                      ref={importSectionRef}
                      role="button"
                      tabIndex={0}
                      onClick={() => importInputRef.current?.click()}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          importInputRef.current?.click()
                        }
                      }}
                      onDragOver={(event) => {
                        event.preventDefault()
                        setIsImportDragActive(true)
                      }}
                      onDragLeave={() => setIsImportDragActive(false)}
                      onDrop={handleImportDrop}
                      className={`cursor-pointer rounded-xl border border-dashed p-4 transition ${isImportDragActive ? 'border-[#f40b0b] bg-[#fff5f2]' : shouldHighlightImport ? 'border-[#efb4ad] bg-[#fff8f6] shadow-[0_0_0_5px_rgba(244,11,11,0.05)]' : 'border-gray-200 bg-[#fbfbfc] hover:border-[#efb4ad]'}`}
                    >
                      <div className="flex flex-wrap items-center gap-4">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#fff1ee] text-[#d54d3f]">
                          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 16V7m0 0-3.5 3.5M12 7l3.5 3.5M5 17.5A2.5 2.5 0 0 0 7.5 20h9a2.5 2.5 0 0 0 2.5-2.5" />
                          </svg>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-base font-semibold tracking-tight text-gray-900">{isImportingWorkflowSkill ? 'Import Workflow Skill' : 'Import Skill'}</div>
                          <div className="mt-1 text-sm text-gray-500">Drop a file here, or choose a local SKILL.md / zip package.</div>
                        </div>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation()
                            importInputRef.current?.click()
                          }}
                          disabled={isImporting}
                          className="rounded-full bg-[#f40b0b] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-[#de1010] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isImporting ? 'Parsing...' : 'Choose File'}
                        </button>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                        <span className="rounded-full bg-white px-3 py-1 ring-1 ring-gray-200">SKILL.md</span>
                        <span className="rounded-full bg-white px-3 py-1 ring-1 ring-gray-200">.zip</span>
                      </div>

                      <input
                        ref={importInputRef}
                        type="file"
                        accept=".md,.markdown,.txt,.zip"
                        onChange={(event) => handleImportFile(event.target.files?.[0])}
                        className="hidden"
                      />

                      {importFeedback && (
                        <div className={`mt-6 rounded-2xl border px-4 py-3 text-left text-sm ${importFeedbackClassName}`}>
                          <div className="font-medium">{importFeedback.fileName}</div>
                          {importFeedback.message ? <div className="mt-1">{importFeedback.message}</div> : null}
                        </div>
                      )}
                    </div>

                    <div className="mt-3 px-1 py-2 text-xs text-gray-500">
                      <div className="font-medium text-gray-500">File requirements</div>
                      <ul className="mt-1.5 list-disc space-y-1 pl-4">
                        <li>A folder or .zip package must include a SKILL.md file.</li>
                        <li>The .md file must include the skill name and description in YAML frontmatter.</li>
                        <li>File size must be within 10 MB.</li>
                      </ul>
                    </div>

                    <div className="mt-5 flex items-center justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => navigate('/tools')}
                        disabled={saving}
                        className="rounded-full border border-gray-200 bg-white px-5 py-2.5 text-sm font-medium text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleCreate}
                        disabled={saving || !hasImportedPackageDraft}
                        className="rounded-full bg-[#f40b0b] px-6 py-2.5 text-sm font-medium text-white transition hover:bg-[#de1010] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {saving ? 'Installing...' : 'Upload and Install'}
                      </button>
                    </div>
                  </section>
                )}

                {shouldRenderEditorBody && (isWorkflowSkill ? (
                  <div className="space-y-6">
                    <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
                      <div className="mb-5">
                        <SkillSectionTitle>Skill Basic Information</SkillSectionTitle>
                      </div>

                      <div className="grid gap-5 md:grid-cols-2">
                          <label className="text-sm text-gray-700 md:col-span-2">
                            <div className="mb-1 font-medium">Name*</div>
                            <input
                              disabled={!isBasicInfoEditable}
                              value={draft.name}
                              onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
                              className={`${baseInputClassName} ${disabledInputClassName}`}
                            />
                          </label>

                          <label className="text-sm text-gray-700 md:col-span-2">
                            <div className="mb-1 font-medium">Description*</div>
                            <textarea
                              rows={4}
                              disabled={!isBasicInfoEditable}
                              value={draft.description}
                              onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
                              className={`${baseInputClassName} ${disabledInputClassName}`}
                              placeholder="Describe what this skill does and when it should be used"
                            />
                          </label>

                          <label className="text-sm text-gray-700 md:col-span-2">
                            <div className="mb-1 font-medium">Instructions*</div>
                            <textarea
                              rows={6}
                              disabled={!isBasicInfoEditable}
                              value={draft.instructions}
                              onChange={(event) => setDraft((current) => ({ ...current, instructions: event.target.value }))}
                              className={`${baseInputClassName} ${disabledInputClassName} font-mono text-sm`}
                              placeholder="Describe the workflow's overall objective, the rules it must follow, how exceptions should be handled, and the final output it should deliver."
                            />
                          </label>

                    </div>
                  </section>

                  <PackageFilesSection files={packageResourceFiles} />

                  <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
                    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="text-base font-semibold text-gray-900">Workflow Steps</div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {draft.workflow_steps.length > 0 && (
                          <>
                            <button onClick={expandAllWorkflowSteps} className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">
                              Expand All
                            </button>
                            <button onClick={collapseAllWorkflowSteps} className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">
                              Collapse All
                            </button>
                          </>
                        )}
                        {isBasicInfoEditable && (
                          <button onClick={addWorkflowStep} className="rounded-lg bg-[#6266EA] px-4 py-2 text-sm font-medium text-white">
                            Add Step
                          </button>
                        )}
                      </div>
                    </div>

                    {draft.workflow_steps.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-gray-300 bg-[#fbfbfe] p-6 text-sm text-gray-500">No workflow steps yet. Add the first step to start designing this workflow.</div>
                    ) : (
                      <div className="space-y-4">
                        {draft.workflow_steps.map((step, index) => (
                          <WorkflowStepCard
                            key={step.id || index}
                            step={step}
                            index={index}
                            isEditable={isBasicInfoEditable}
                            availableSkills={selectableSkills}
                            isExpanded={expandedStepIds.includes(step.id)}
                            onToggle={() => toggleWorkflowStepExpansion(step.id)}
                            onChange={(nextStep) => updateWorkflowStep(index, nextStep)}
                            onRemove={() => removeWorkflowStep(index)}
                          />
                        ))}
                      </div>
                    )}
                  </section>
                </div>
                ) : (
                <div className="space-y-6">
                  <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <SkillSectionTitle>Skill Basic Information</SkillSectionTitle>
                      </div>
                      <div className="flex items-center gap-2">
                        {isEditable && isCreateMode ? (
                          <button
                            type="button"
                            onClick={() => openGeneratorForSkillType(currentSkillType)}
                            className="rounded-xl border border-[#cfd4ff] bg-[#f6f7ff] px-4 py-2 text-sm font-medium text-[#4f57d8] transition hover:border-[#b6bffb] hover:bg-[#eef1ff]"
                          >
                            Generate with AI
                          </button>
                        ) : null}
                      </div>
                    </div>

                    <div className="grid gap-5 md:grid-cols-2">
                      <div>
                        <div className="mb-1 text-sm font-medium text-gray-700">Name*</div>
                        <input
                          disabled={!isBasicInfoEditable}
                          value={draft.name}
                          onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
                          className={`${baseInputClassName} ${disabledInputClassName}`}
                        />
                      </div>

                      <div className="md:col-span-2">
                        <div className="mb-1 text-sm font-medium text-gray-700">Description*</div>
                        <textarea
                          rows={4}
                          disabled={!isBasicInfoEditable}
                          value={draft.description}
                          onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
                          className={`${baseInputClassName} ${disabledInputClassName}`}
                          placeholder="Describe what this skill does and when it should be used"
                        />
                      </div>

                      {!isWorkflowSkill && !hasImportedPackageState && (
                        <div className="md:col-span-2 rounded-2xl border border-gray-200 bg-[#fbfbfe] p-4 text-sm text-gray-700">
                          <div className="font-medium text-gray-900">MCP Toolset Binding</div>
                          <div className="mt-3">
                            {!isBasicInfoEditable ? (
                              <div className="space-y-2">
                                {boundMcpServers.length > 0 ? (
                                  boundMcpServers.map((server) => (
                                    <div key={server.id} className="rounded-xl border border-gray-200 bg-white px-3 py-2">
                                      <div className="font-medium text-gray-900">{server.name}</div>
                                      {server.transport ? <div className="text-gray-500">{server.transport}</div> : null}
                                    </div>
                                  ))
                                ) : (
                                  <div className="font-medium text-gray-900">No MCP toolset</div>
                                )}
                              </div>
                            ) : (
                              <div className="relative" ref={mcpDropdownRef}>
                                <button
                                  type="button"
                                  onClick={() => setIsMcpDropdownOpen((current) => !current)}
                                  className="flex w-full items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 text-left transition hover:border-[#6266EA]"
                                >
                                  <div className="min-w-0 flex-1">
                                    <div className={`truncate text-sm ${selectedMcpServerNames.length > 0 ? 'font-medium text-gray-900' : 'text-gray-500'}`}>
                                      {selectedMcpServerNames.length === 0 ? 'Select MCP toolset' : mcpDropdownSummary}
                                    </div>
                                    {selectedMcpServerNames.length > 0 && (
                                      <div className="mt-1 text-xs text-gray-500">Supports selecting multiple MCP toolsets.</div>
                                    )}
                                  </div>
                                  <svg className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${isMcpDropdownOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m19 9-7 7-7-7" />
                                  </svg>
                                </button>

                                {isMcpDropdownOpen && (
                                  <div className="absolute left-0 right-0 z-20 mt-2 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl">
                                    <div className="border-b border-gray-100 p-3">
                                      <input
                                        value={mcpSearchQuery}
                                        onChange={(event) => setMcpSearchQuery(event.target.value)}
                                        placeholder="Search MCP toolsets by name"
                                        className={baseInputClassName}
                                      />
                                    </div>
                                    <div className="max-h-72 overflow-y-auto p-2">
                                      {filteredMcpServers.length > 0 ? (
                                        <div className="space-y-2">
                                          {filteredMcpServers.map((server) => {
                                            const checked = draft.mcp_server_ids.includes(String(server.id))
                                            return (
                                              <label key={server.id} className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-3 transition ${checked ? 'border-[#6266EA] bg-[#eef0ff]' : 'border-gray-200 bg-white hover:bg-gray-50'}`}>
                                                <input
                                                  type="checkbox"
                                                  checked={checked}
                                                  onChange={() => handleMcpBindingChange(String(server.id))}
                                                  className="mt-1 h-4 w-4 rounded border-gray-300 text-[#6266EA] focus:ring-[#6266EA]"
                                                />
                                                <div className="min-w-0 flex-1">
                                                  <div className="font-medium text-gray-900">{server.name}</div>
                                                  <div className="line-clamp-1 text-gray-500">{server.description || 'No description provided yet.'}</div>
                                                </div>
                                              </label>
                                            )
                                          })}
                                        </div>
                                      ) : (
                                        <div className="px-3 py-6 text-sm text-gray-500">No MCP toolsets matched your search.</div>
                                      )}
                                      {servers.length === 0 && <div className="px-3 py-6 text-sm text-gray-500">No MCP toolsets available.</div>}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </section>

                  {shouldShowInstructionsSection && <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                    <div className="mb-5">
                      <div className="text-base font-semibold text-gray-900">{isWorkflowSkill ? 'Workflow Guidance' : 'Instructions'}</div>
                    </div>

                    <div>
                      <textarea
                        rows={isWorkflowSkill ? 5 : 16}
                        disabled={!isEditable}
                        value={draft.instructions}
                        onChange={(event) => setDraft((current) => ({ ...current, instructions: event.target.value }))}
                        className={`${baseInputClassName} ${disabledInputClassName} font-mono text-sm`}
                        placeholder={instructionsPlaceholder}
                      />
                    </div>

                    {isWorkflowSkill ? (
                      <div className="mt-6 space-y-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-sm font-semibold text-gray-900">Workflow Steps</div>
                            <div className="text-xs text-gray-500">Steps run in sequence. Each step can run automatically or pause for user input.</div>
                          </div>
                          {isEditable && (
                            <button onClick={addWorkflowStep} className="rounded-lg bg-[#6266EA] px-4 py-2 text-sm font-medium text-white">
                              Add Step
                            </button>
                          )}
                        </div>

                        {draft.workflow_steps.length === 0 ? (
                          <div className="rounded-2xl border border-dashed border-gray-300 bg-[#fbfbfe] p-6 text-sm text-gray-500">No workflow steps yet. Add the first step to start designing this workflow.</div>
                        ) : (
                          <div className="space-y-4">
                            {draft.workflow_steps.map((step, index) => (
                              <WorkflowStepCard
                                key={step.id || index}
                                step={step}
                                index={index}
                                isEditable={isEditable}
                                availableSkills={selectableSkills}
                                onChange={(nextStep) => updateWorkflowStep(index, nextStep)}
                                onRemove={() => removeWorkflowStep(index)}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    ) : null}
                  </section>}

                  <PackageFilesSection files={packageResourceFiles} />
                </div>
                ))}

                {shouldShowFooterActions && (isCreateMode || isEditing) && (
                  <div className="absolute bottom-0 left-0 right-0 z-40 border-t border-gray-200 bg-white/95 px-8 py-4 shadow-[0_-10px_30px_rgba(15,23,42,0.08)] backdrop-blur">
                    <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
                      <div />
                      <div className="flex items-center justify-end gap-3">
                    {isEditing && !isCreateMode && !isReadonly ? (
                      <button onClick={() => loadPageData()} className="rounded-lg px-4 py-2 text-sm text-gray-600 hover:bg-gray-100">
                        Cancel
                      </button>
                    ) : (
                      <button onClick={() => navigate('/tools')} className="rounded-lg px-4 py-2 text-sm text-gray-600 hover:bg-gray-100">
                        Cancel
                      </button>
                    )}
                    {isCreateMode ? (
                      <button onClick={handleCreate} disabled={saving} className="rounded-lg bg-[#6266EA] px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
                        {saving ? 'Saving...' : 'Create Skill'}
                      </button>
                    ) : !isReadonly && isEditing ? (
                      <button onClick={handleUpdate} disabled={saving} className="rounded-lg bg-[#f40b0b] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#de1010] disabled:opacity-60">
                        {saving ? 'Saving...' : 'Update Skill'}
                      </button>
                    ) : null}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </main>
        </div>
      </div>

      <SkillAIGeneratorModal
        isOpen={isGeneratorOpen}
        onClose={() => {
          if (isGeneratingDraft) return
          setIsGeneratorOpen(false)
          setGenerateError('')
          setGeneratorPrompt('')
        }}
        value={generatorPrompt}
        onChange={setGeneratorPrompt}
        onGenerate={handleGenerateSkillDraft}
        generating={isGeneratingDraft}
        errorMessage={generateError}
        title={generatorModalContent.title}
        description={generatorModalContent.description}
        placeholder={generatorModalContent.placeholder}
        actionLabel={generatorModalContent.actionLabel}
      />

      <GeneratedInstructionApplyModal
        instructionText={pendingGeneratedInstructions}
        onClose={() => setPendingGeneratedInstructions('')}
        onReplace={() => applyGeneratedInstructions('replace')}
        onAppend={() => applyGeneratedInstructions('append')}
      />

      <GeneratedDraftPreviewModal
        generatedDraft={pendingGeneratedDraft}
        onClose={() => setPendingGeneratedDraft(null)}
        onBackToAdjust={() => {
          setPendingGeneratedDraft(null)
          setIsGeneratorOpen(true)
        }}
        onApply={applyGeneratedDraftPreview}
        onChange={setPendingGeneratedDraft}
      />

    </div>
  )
}

export default SkillEditor