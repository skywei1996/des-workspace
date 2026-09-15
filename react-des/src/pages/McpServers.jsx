import React, { useEffect, useMemo, useState } from 'react'
import Sidebar from '../components/Sidebar'
import DeleteConfirmModal from '../components/DeleteConfirmModal'
import { API_BASE } from '../config/api'

const TRANSPORT_OPTIONS = [
  { value: 'stdio', label: 'STDIO' },
  { value: 'http', label: 'HTTP' },
  { value: 'streamable-http', label: 'Streamable HTTP' },
]

const DOMAIN_OPTIONS = [
  { value: 'search', label: 'Search' },
  { value: 'web_crawl', label: 'Web Crawl' },
  { value: 'image_generation', label: 'Image Generation' },
  { value: 'code', label: 'Code' },
  { value: 'file_operations', label: 'File Operations' },
  { value: 'database', label: 'Database' },
  { value: 'tool_orchestration', label: 'Tool Orchestration' },
  { value: 'api_integration', label: 'API Integration' },
  { value: 'data_analysis', label: 'Data Analysis' },
  { value: 'communication', label: 'Communication' },
]

const emptyForm = {
  server_key: '',
  name: '',
  version: '1.0.0',
  description: '',
  source_type: 'mcp',
  transport: '',
  domain: 'search',
  icon_url: '',
  config_json: '',
  enabled: true,
}

const defaultConfigByTransport = {
  stdio: {
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem', '.'],
    env: {},
    timeout_seconds: 30,
  },
  http: {
    url: 'https://example.com/mcp',
    headers: {},
    timeout_seconds: 30,
  },
  'streamable-http': {
    url: 'https://example.com/mcp',
    headers: {
      Accept: 'application/json, text/event-stream',
      'MCP-Protocol-Version': '2024-11-05',
    },
    timeout_seconds: 60,
  },
}

const baseInputClassName = 'w-full rounded-xl border border-[#e5e7eb] bg-white px-3 py-2.5 text-sm text-[#2d323b] outline-none transition focus:border-[#f0bbb6] focus:ring-4 focus:ring-[#fff1ef]'
const disabledInputClassName = 'disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500 disabled:focus:border-gray-200'

const createDingTalkStdioConfig = () => ({
  command: 'npx',
  args: ['-y', 'dingtalk-mcp@latest'],
  env: {
    DINGTALK_Client_ID: 'your dingtalk client id',
    DINGTALK_Client_Secret: 'your dingtalk client secret',
    ACTIVE_PROFILES: 'dingtalk-contacts,dingtalk-calendar',
  },
  timeout_seconds: 60,
})

const formatJson = (value, fallback = {}) => JSON.stringify(value ?? fallback, null, 2)

const parseJsonField = (value, fallback = {}) => {
  if (!value.trim()) return fallback
  return JSON.parse(value)
}

const toTitle = (value) => value.split('_').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ')

const formatImpactNames = (items = [], emptyLabel = 'None') => {
  if (!items.length) return emptyLabel
  if (items.length <= 5) return items.join('、')
  return `${items.slice(0, 5).join('、')} 等 ${items.length} 项`
}

const looksLikeDingTalkToolset = (form) => {
  const text = [form?.name, form?.server_key, form?.description].filter(Boolean).join(' ').toLowerCase()
  return text.includes('dingtalk') || text.includes('钉钉')
}

const getDefaultConfigForForm = (transport, form) => {
  if (transport === 'stdio' && looksLikeDingTalkToolset(form)) {
    return createDingTalkStdioConfig()
  }
  return defaultConfigByTransport[transport] || {}
}

const buildConfigFromServer = (server) => {
  if (server?.config_json && typeof server.config_json === 'object') {
    return server.config_json
  }

  if ((server?.transport || '').toLowerCase() === 'stdio') {
    return {
      command: server?.command || '',
      args: server?.args || [],
      env: server?.env || {},
      timeout_seconds: server?.timeout_seconds || 30,
    }
  }

  return {
    url: server?.url || '',
    headers: server?.headers || {},
    timeout_seconds: server?.timeout_seconds || 30,
  }
}

const mapServerToForm = (server) => ({
  server_key: server?.server_key || '',
  name: server?.name || '',
  version: server?.version || '1.0.0',
  description: server?.description || '',
  source_type: server?.source_type || 'mcp',
  transport: server?.transport || '',
  domain: server?.domain || 'search',
  icon_url: server?.icon_url || '',
  config_json: formatJson(buildConfigFromServer(server), {}),
  enabled: server ? Boolean(server.enabled) : true,
})

const buildPayload = (form) => {
  const transport = form.transport || 'stdio'
  const config = parseJsonField(form.config_json, defaultConfigByTransport[transport] || {})
  const payload = {
    server_key: form.server_key || undefined,
    name: form.name.trim(),
    version: form.version.trim() || '1.0.0',
    description: form.description.trim(),
    source_type: form.source_type,
    transport,
    domain: form.domain,
    icon_url: form.icon_url.trim() || null,
    config_json: config,
    enabled: form.enabled,
    source: form.source_type === 'builtin' ? 'builtin' : 'custom',
  }

  if (transport === 'stdio') {
    if (Array.isArray(config.command)) {
      payload.command = config.command[0] || null
      payload.args = [...config.command.slice(1), ...(Array.isArray(config.args) ? config.args : [])]
    } else {
      payload.command = config.command || null
      payload.args = Array.isArray(config.args) ? config.args : []
    }
    payload.env = config.env && typeof config.env === 'object' ? config.env : {}
    payload.url = null
    payload.headers = {}
    payload.timeout_seconds = Number(config.timeout_seconds || 30)
  } else {
    payload.url = config.url || null
    payload.headers = config.headers && typeof config.headers === 'object' ? config.headers : {}
    payload.command = null
    payload.args = []
    payload.env = {}
    payload.timeout_seconds = Number(config.timeout_seconds || 30)
  }

  return payload
}

const Badge = ({ children, tone = 'default' }) => {
  const toneClassName = {
    default: 'bg-gray-100 text-gray-700',
    success: 'bg-emerald-100 text-emerald-700',
    accent: 'bg-[#fff4f2] text-[#d54d3f]',
    warning: 'bg-amber-100 text-amber-700',
  }[tone]

  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${toneClassName}`}>{children}</span>
}

const EmptyState = ({ title, description }) => (
  <div className="rounded-2xl border border-dashed border-[#f0c9c4] bg-white px-6 py-14 text-center shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#fff1ee] text-[#e3473c]">
      <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 6v12m6-6H6" />
      </svg>
    </div>
    <h3 className="mt-4 text-lg font-semibold text-gray-900">{title}</h3>
    <p className="mt-2 text-sm text-gray-500">{description}</p>
  </div>
)

const ToolsetIcon = ({ transport }) => {
  const isNetwork = transport === 'http' || transport === 'streamable-http'
  return (
    <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${isNetwork ? 'bg-[#fff1ee] text-[#e3473c]' : 'bg-[#fff4f2] text-[#d54d3f]'}`}>
      {isNetwork ? (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 12h8m-8 0a4 4 0 1 0 0-8m8 8a4 4 0 1 1 0 8M8 12a4 4 0 1 1 0 8m8-8a4 4 0 1 0 0-8" />
        </svg>
      ) : (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 3h6v6H9zM4 15h6v6H4zM14 15h6v6h-6zM12 9v3m0 0H7m5 0h5" />
        </svg>
      )}
    </div>
  )
}

const ToolsetCard = ({ server, selected, onOpen, onToggleEnabled, onDelete, busy }) => (
  <div
    role="button"
    tabIndex={0}
    onClick={() => onOpen(server)}
    onKeyDown={(event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        onOpen(server)
      }
    }}
    className={`group relative flex h-full cursor-pointer flex-col rounded-[18px] border bg-white p-5 text-left shadow-[0_8px_24px_rgba(15,23,42,0.04)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_16px_40px_rgba(15,23,42,0.08)] ${selected ? 'border-[#e3473c] ring-2 ring-[#fff1ee]' : 'border-[#ececef] hover:border-[#dddfe4]'}`}
  >
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1 pr-3">
        <div className="flex items-center gap-2">
          <h3 className="truncate text-lg font-bold text-gray-900">{server.name}</h3>
          {server.enabled && <span className="inline-flex h-2.5 w-2.5 rounded-full bg-green-500" />}
        </div>
        <p className="mt-2 line-clamp-2 min-h-[40px] text-sm leading-5 text-gray-500">
          {server.description || 'No description provided yet.'}
        </p>
      </div>

      <ToolsetIcon transport={server.transport} />
    </div>

    <div className="mt-5 flex items-center justify-between gap-3 text-xs text-gray-400">
      <span className="rounded-full border border-[#ffd8d2] bg-[#fff4f2] px-2.5 py-1 font-medium text-[#d54d3f]">{toTitle(server.domain || 'search')}</span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={(event) => {
            event.stopPropagation()
            onToggleEnabled(server)
          }}
          className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {server.enabled ? 'Disable' : 'Enable'}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={(event) => {
            event.stopPropagation()
            onDelete(server)
          }}
          className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Delete
        </button>
      </div>
    </div>
  </div>
)

const McpServers = () => {
  const [servers, setServers] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [isEditorOpen, setIsEditorOpen] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testResult, setTestResult] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [deleteDialog, setDeleteDialog] = useState({ open: false, server: null, sections: [] })

  const selectedServer = servers.find((server) => server.id === selectedId) || null
  const isCreateMode = selectedId === null
  const isViewMode = !isCreateMode && !isEditing

  const filteredServers = useMemo(() => {
    return servers.filter((server) => {
      const target = (server.name || '').toLowerCase()
      return target.includes(searchQuery.toLowerCase())
    })
  }, [searchQuery, servers])

  const loadServers = async (preferredId = selectedId) => {
    setLoading(true)
    try {
      const response = await fetch(`${API_BASE}/mcp-servers/`)
      const payload = await response.json()
      const list = Array.isArray(payload) ? payload : []
      setServers(list)

      if (preferredId === null) {
        setForm(emptyForm)
        return
      }

      const nextSelected = list.find((server) => server.id === preferredId)?.id ?? list[0]?.id ?? null
      setSelectedId(nextSelected)
      const current = list.find((server) => server.id === nextSelected) || null
      setForm(current ? mapServerToForm(current) : emptyForm)
    } catch (error) {
      console.error('Failed to load MCP toolsets:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadServers()
  }, [])

  useEffect(() => {
    if (!selectedServer) return
    setForm(mapServerToForm(selectedServer))
    setTestResult(null)
  }, [selectedServer])

  const handleCreateNew = () => {
    setSelectedId(null)
    setForm(emptyForm)
    setTestResult(null)
    setIsEditing(true)
    setIsEditorOpen(true)
  }

  const handleSelectServer = (server) => {
    setSelectedId(server.id)
    setForm(mapServerToForm(server))
    setTestResult(null)
    setIsEditing(false)
    setIsEditorOpen(true)
  }

  const handleStartEditing = () => {
    if (!selectedServer) return
    setForm(mapServerToForm(selectedServer))
    setTestResult(null)
    setIsEditing(true)
  }

  const handleCancel = () => {
    if (selectedServer && isEditing) {
      setForm(mapServerToForm(selectedServer))
      setTestResult(null)
      setIsEditing(false)
      return
    }
    if (selectedServer) {
      setForm(mapServerToForm(selectedServer))
      setTestResult(null)
      setIsEditing(false)
      setIsEditorOpen(false)
      return
    }
    setForm(emptyForm)
    setTestResult(null)
    setIsEditing(false)
    setIsEditorOpen(false)
  }

  const handleTransportChange = (transport) => {
    setForm((current) => ({
      ...current,
      transport,
      config_json: formatJson(getDefaultConfigForForm(transport, current), {}),
    }))
  }

  const handleSave = async () => {
    if (!form.name.trim()) {
      alert('Name is required.')
      return
    }
    if (!form.description.trim()) {
      alert('Description is required.')
      return
    }
    if (!form.transport) {
      alert('Transport is required.')
      return
    }

    setSaving(true)
    try {
      const payload = buildPayload(form)
      const url = selectedServer ? `${API_BASE}/mcp-servers/${selectedServer.id}` : `${API_BASE}/mcp-servers/`
      const method = selectedServer ? 'PUT' : 'POST'
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const responsePayload = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(responsePayload?.detail || 'Failed to save toolset')
      }
      const nextSelectedId = responsePayload?.id ?? null
      setSelectedId(nextSelectedId)
      setIsEditing(false)
      setIsEditorOpen(true)
      await loadServers(nextSelectedId)
      setTestResult(null)
    } catch (error) {
      alert(error.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!selectedServer) return
    await handleDeleteServer(selectedServer)
  }

  const handleDeleteServer = async (server) => {
    if (!server) return

    let impactedSkills = []
    let impactedEmployees = []
    try {
      const [skillsResponse, employeesResponse] = await Promise.all([
        fetch(`${API_BASE}/skills/`),
        fetch(`${API_BASE}/ai-employees/`),
      ])

      const skillsPayload = await skillsResponse.json().catch(() => ({}))
      const employeesPayload = await employeesResponse.json().catch(() => [])
      const skills = skillsPayload?.data?.skills || []
      const employees = Array.isArray(employeesPayload) ? employeesPayload : []

      impactedSkills = skills.filter((skill) => {
        if (skill?.mcp_server_id === server.id) return true
        return Array.isArray(skill?.mcp_server_ids) && skill.mcp_server_ids.includes(server.id)
      })

      const impactedSkillKeys = new Set(impactedSkills.map((skill) => skill.skill_key))
      impactedEmployees = employees.filter((employee) => {
        const toolIds = Array.isArray(employee?.tool_ids) ? employee.tool_ids : []
        return toolIds.some((toolId) => impactedSkillKeys.has(toolId))
      })
    } catch (error) {
      console.error('Failed to load MCP impact range:', error)
    }

    setDeleteDialog({
      open: true,
      server,
      sections: [
        { label: '影响 Skill', value: formatImpactNames(impactedSkills.map((skill) => skill.name || skill.skill_key)) },
        { label: '影响数字员工', value: formatImpactNames(impactedEmployees.map((employee) => employee.name || `Employee ${employee.id}`)) },
      ],
    })
  }

  const handleConfirmDelete = async () => {
    const server = deleteDialog.server
    if (!server) return

    setSaving(true)
    try {
      const response = await fetch(`${API_BASE}/mcp-servers/${server.id}`, { method: 'DELETE' })
      if (!response.ok) {
        const detail = await response.text()
        throw new Error(detail || 'Failed to delete toolset')
      }
      const wasSelected = selectedId === server.id
      if (wasSelected) {
        setSelectedId(null)
        setForm(emptyForm)
        setTestResult(null)
        setIsEditing(false)
        setIsEditorOpen(false)
        await loadServers(null)
      } else {
        await loadServers(selectedId)
      }
    } catch (error) {
      alert(error.message)
    } finally {
      setSaving(false)
      setDeleteDialog({ open: false, server: null, sections: [] })
    }
  }

  const handleToggleEnabled = async (server) => {
    if (!server) return

    setSaving(true)
    try {
      const nextForm = {
        ...mapServerToForm(server),
        enabled: !server.enabled,
      }
      const payload = buildPayload(nextForm)
      const response = await fetch(`${API_BASE}/mcp-servers/${server.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const responsePayload = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(responsePayload?.detail || 'Failed to update toolset status')
      }

      if (selectedId === server.id) {
        setForm(nextForm)
      }

      await loadServers(selectedId)
    } catch (error) {
      alert(error.message)
    } finally {
      setSaving(false)
    }
  }

  const handleTest = async () => {
    if (!selectedServer) return
    setSaving(true)
    try {
      const response = await fetch(`${API_BASE}/mcp-servers/${selectedServer.id}/test`, { method: 'POST' })
      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload?.detail || 'Failed to test MCP toolset')
      }
      setTestResult(payload)
    } catch (error) {
      setTestResult({ ok: false, message: error.message })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex min-h-screen bg-[#f6f6f8] text-gray-900">
      <Sidebar />
      <DeleteConfirmModal
        isOpen={deleteDialog.open}
        onClose={() => setDeleteDialog({ open: false, server: null, sections: [] })}
        onConfirm={handleConfirmDelete}
        title={deleteDialog.server ? `删除 Toolset ${deleteDialog.server.name}？` : '删除 Toolset'}
        description="删除后，该 Toolset 会从系统中移除，关联 Skill 将无法再调用其中的 MCP 工具；依赖这些 Skill 的数字员工也将无法继续使用对应能力。"
        descriptionTone="danger"
        sections={deleteDialog.sections}
        confirmLabel="确认删除"
        isSubmitting={saving}
      />

      <div className="flex-1 overflow-hidden">
        <div className="flex h-screen flex-col">
          <header className="border-b border-[#ececef] bg-white px-8 py-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-semibold text-gray-900">MCP Toolsets</h1>
                <p className="mt-1 text-sm text-gray-500">Create and manage MCP service connections that can be bound to Skills.</p>
              </div>
              <button onClick={handleCreateNew} className="rounded-full bg-[#f40b0b] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-[#de1010]">
                New Toolset
              </button>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto px-10 py-6">
            <section className="mb-8">
              <div className="relative max-w-md">
                <svg className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="m21 21-4.35-4.35M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z" />
                </svg>
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search toolsets by name"
                  className="w-full rounded-xl border border-[#e5e7eb] bg-[#fbfbfc] py-2.5 pl-10 pr-4 text-sm text-[#434854] outline-none transition focus:border-[#f0bbb6] focus:bg-white focus:ring-4 focus:ring-[#fff1ef]"
                />
              </div>
            </section>

            <section>
              {loading ? (
                <div className="grid gap-6 md:grid-cols-2 2xl:grid-cols-3">
                  {[1, 2, 3, 4, 5, 6].map((item) => (
                    <div key={item} className="h-52 animate-pulse rounded-[18px] border border-[#ececef] bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
                      <div className="h-5 w-32 rounded bg-gray-200" />
                      <div className="mt-4 h-4 w-full rounded bg-gray-100" />
                      <div className="mt-2 h-4 w-3/4 rounded bg-gray-100" />
                      <div className="mt-8 flex gap-2">
                        <div className="h-7 w-20 rounded-full bg-gray-100" />
                        <div className="h-7 w-20 rounded-full bg-gray-100" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : filteredServers.length === 0 ? (
                <EmptyState title="No toolsets matched" description="Adjust the search or create a new MCP toolset to populate the registry." />
              ) : (
                <div className="grid gap-6 md:grid-cols-2 2xl:grid-cols-3">
                  {filteredServers.map((server) => (
                    <ToolsetCard
                      key={server.id}
                      server={server}
                      selected={selectedId === server.id}
                      onOpen={handleSelectServer}
                      onToggleEnabled={handleToggleEnabled}
                      onDelete={handleDeleteServer}
                      busy={saving}
                    />
                  ))}
                </div>
              )}
            </section>

          </main>
        </div>
      </div>

      {isEditorOpen && (
        <div className="fixed inset-0 z-40 flex justify-end bg-slate-900/20 backdrop-blur-[1px]">
          <button type="button" aria-label="Close toolset editor" className="flex-1 cursor-default" onClick={handleCancel} />

          <aside className="relative flex h-full w-full max-w-[1040px] flex-col border-l border-[#ececef] bg-white shadow-2xl">
            <div className="border-b border-[#ececef] px-8 py-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-semibold text-gray-900">{isCreateMode ? 'Create Toolset' : form.name || 'Toolset Details'}</h2>
                </div>

                <div className="flex items-center gap-3">
                  {isViewMode && (
                    <button onClick={handleStartEditing} disabled={saving} className="rounded-full bg-[#f40b0b] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-[#de1010] disabled:opacity-60">
                      Edit
                    </button>
                  )}
                  <button onClick={handleCancel} className="rounded-full border border-gray-200 bg-white px-5 py-2.5 text-sm font-medium text-gray-700">
                    Close
                  </button>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-8 py-6">
              <div className="grid gap-6 lg:grid-cols-2">
                <section className="space-y-5 rounded-2xl border border-[#ececef] bg-[#fbfbfc] p-5">
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="text-sm text-gray-700 md:col-span-2">
                      <div className="mb-1 font-medium">Name</div>
                      <input
                        disabled={isViewMode}
                        value={form.name}
                        onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                        className={`${baseInputClassName} ${disabledInputClassName}`}
                        placeholder="Toolset name"
                      />
                    </label>

                    <label className="text-sm text-gray-700">
                      <div className="mb-1 font-medium">Version</div>
                      <input
                        disabled={isViewMode}
                        value={form.version}
                        onChange={(event) => setForm((current) => ({ ...current, version: event.target.value }))}
                        className={`${baseInputClassName} ${disabledInputClassName}`}
                        placeholder="1.0.0"
                      />
                    </label>
                  </div>

                  <div>
                    <div className="mb-1 text-sm font-medium text-gray-700">Description</div>
                    <textarea
                      disabled={isViewMode}
                      value={form.description}
                      onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                      rows={4}
                      className={`${baseInputClassName} ${disabledInputClassName}`}
                      placeholder="Describe what this MCP toolset is for"
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="text-sm text-gray-700">
                      <div className="mb-1 font-medium">Transport</div>
                      <select
                        disabled={isViewMode}
                        value={form.transport}
                        onChange={(event) => handleTransportChange(event.target.value)}
                        className={`${baseInputClassName} ${disabledInputClassName}`}
                      >
                        <option value="">Select transport</option>
                        {TRANSPORT_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </label>

                    <label className="text-sm text-gray-700">
                      <div className="mb-1 font-medium">Domain</div>
                      <select
                        disabled={isViewMode}
                        value={form.domain}
                        onChange={(event) => setForm((current) => ({ ...current, domain: event.target.value }))}
                        className={`${baseInputClassName} ${disabledInputClassName}`}
                      >
                        {DOMAIN_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </label>

                    <label className="text-sm text-gray-700">
                      <div className="mb-1 font-medium">Status</div>
                      <select
                        disabled={isViewMode}
                        value={String(form.enabled)}
                        onChange={(event) => setForm((current) => ({ ...current, enabled: event.target.value === 'true' }))}
                        className={`${baseInputClassName} ${disabledInputClassName}`}
                      >
                        <option value="true">Enabled</option>
                        <option value="false">Disabled</option>
                      </select>
                    </label>
                  </div>

                </section>

                <section className="space-y-5 rounded-2xl border border-[#ececef] bg-[#fbfbfc] p-5">
                  <div>
                    <div className="mb-1 text-sm font-medium text-gray-700">Config JSON</div>
                    <textarea
                      disabled={isViewMode}
                      value={form.config_json}
                      onChange={(event) => setForm((current) => ({ ...current, config_json: event.target.value }))}
                      rows={16}
                      className={`${baseInputClassName} ${disabledInputClassName} font-mono text-sm`}
                      placeholder={'{\n  "key": "value"\n}'}
                    />
                  </div>

                  {testResult && (
                    <div className={`rounded-2xl border px-4 py-3 text-sm ${testResult.ok ? 'border-[#bbf7d0] bg-[#f0fdf4] text-[#166534]' : 'border-[#ffd8d2] bg-[#fff4f2] text-[#d54d3f]'}`}>
                      <div className="font-medium">{testResult.message}</div>
                      {testResult.details && <pre className="mt-3 overflow-x-auto whitespace-pre-wrap text-xs">{JSON.stringify(testResult.details, null, 2)}</pre>}
                    </div>
                  )}
                </section>
              </div>
            </div>

            <div className="border-t border-[#ececef] px-8 py-4">
              <div className="flex items-center justify-end gap-3">
                {selectedServer && (
                  <button onClick={handleTest} disabled={saving} className="rounded-full border border-gray-200 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 disabled:opacity-60">
                    Test Connection
                  </button>
                )}
                {selectedServer && (
                  <button onClick={handleDelete} disabled={saving} className="rounded-full border border-red-200 px-5 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-60">
                    Delete
                  </button>
                )}
                {!isViewMode && (
                  <>
                    <button onClick={handleCancel} disabled={saving} className="rounded-full border border-gray-200 bg-white px-5 py-2.5 text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-60">
                      Cancel
                    </button>
                    <button onClick={handleSave} disabled={saving} className="rounded-full bg-[#f40b0b] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-[#de1010] disabled:opacity-60">
                      {saving ? 'Saving...' : isCreateMode ? 'Create Toolset' : 'Save Changes'}
                    </button>
                  </>
                )}
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  )
}

export default McpServers
