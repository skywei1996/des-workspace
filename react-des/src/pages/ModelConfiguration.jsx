import React, { useEffect, useState } from 'react'
import Sidebar from '../components/Sidebar'
import DeleteConfirmModal from '../components/DeleteConfirmModal'
import { API_BASE } from '../config/api'

const STORAGE_KEY = 'des-model-configurations'

const PROVIDER_OPTIONS = [
  'Open AI Compatible',
  'Azure OpenAI Compatible',
]

const createTimestamp = () => new Date().toISOString()

const createModelForm = (overrides = {}) => ({
  id: `model-${Math.random().toString(36).slice(2, 10)}`,
  providerType: 'Open AI Compatible',
  modelName: '',
  apiEndpoint: 'https://api.example.com/v1',
  apiKey: '',
  isPublic: false,
  publicConfirmed: false,
  createdAt: createTimestamp(),
  updatedAt: createTimestamp(),
  ...overrides,
})

const getDefaultModels = () => ([
  createModelForm({
    modelName: 'gpt-4o-mini',
    apiEndpoint: 'https://api.openai.com/v1',
    createdAt: '2026-03-13T09:00:00.000Z',
    updatedAt: '2026-03-13T09:00:00.000Z',
  }),
  createModelForm({
    modelName: 'gpt-4.1',
    providerType: 'Azure OpenAI Compatible',
    apiEndpoint: 'https://example-resource.openai.azure.com/openai/deployments/gpt-4.1',
    createdAt: '2026-03-14T10:30:00.000Z',
    updatedAt: '2026-03-14T10:30:00.000Z',
  }),
])

const loadStoredModels = () => {
  if (typeof window === 'undefined') return getDefaultModels()

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return getDefaultModels()
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed) || parsed.length === 0) return getDefaultModels()

    const normalized = parsed.map((item, index) => createModelForm({
      ...item,
      providerType: PROVIDER_OPTIONS.includes(item?.providerType) ? item.providerType : 'Open AI Compatible',
      id: item?.id || `model-${index + 1}`,
      createdAt: item?.createdAt || createTimestamp(),
      updatedAt: item?.updatedAt || item?.createdAt || createTimestamp(),
      isPublic: Boolean(item?.isPublic),
      publicConfirmed: Boolean(item?.isPublic),
    }))
    return normalized
  } catch (error) {
    console.error('Failed to load stored models:', error)
    return getDefaultModels()
  }
}

const formatDate = (value) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleDateString('en-US')
}

const maskApiKey = (value) => {
  if (!value) return 'Not set'
  if (value.length <= 8) return value
  return `${value.slice(0, 4)}••••${value.slice(-4)}`
}

const formatImpactNames = (items = [], emptyLabel = 'None') => {
  if (!items.length) return emptyLabel
  if (items.length <= 5) return items.join('、')
  return `${items.slice(0, 5).join('、')} 等 ${items.length} 项`
}

const getTestFieldHint = (result) => {
  const fieldLabel = result?.details?.fieldLabel
  const reason = result?.details?.reason || result?.details?.error
  const statusCode = result?.details?.status_code
  const errorCode = result?.error_code
  const details = [
    fieldLabel ? `${fieldLabel}:` : '',
    reason || '',
    statusCode ? `(HTTP ${statusCode})` : '',
    errorCode ? `[${errorCode}]` : '',
  ].filter(Boolean)
  return details.join(' ')
}

function ModelConfiguration() {
  const [models, setModels] = useState(() => loadStoredModels())
  const [selectedId, setSelectedId] = useState(null)
  const [isEditorOpen, setIsEditorOpen] = useState(false)
  const [form, setForm] = useState(createModelForm())
  const [isCreateMode, setIsCreateMode] = useState(true)
  const [saveMessage, setSaveMessage] = useState('')
  const [testResult, setTestResult] = useState(null)
  const [isTesting, setIsTesting] = useState(false)
  const [visibleApiKey, setVisibleApiKey] = useState(false)
  const [deleteDialog, setDeleteDialog] = useState({ open: false, modelId: null, title: '', sections: [] })

  useEffect(() => {
    let cancelled = false
    fetch(`${API_BASE}/model-configurations/`)
      .then((response) => response.ok ? response.json() : [])
      .then((items) => {
        if (cancelled) return
        if (Array.isArray(items) && items.length > 0) {
          setModels(items)
          return
        }
        const legacyModels = loadStoredModels().filter((item) => item.modelName && item.apiKey)
        Promise.all(legacyModels.map((item) => fetch(`${API_BASE}/model-configurations/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            modelName: item.modelName,
            providerType: item.providerType,
            apiEndpoint: item.apiEndpoint,
            apiKey: item.apiKey,
            isPublic: Boolean(item.isPublic),
          }),
        }).then((response) => response.ok ? response.json() : null)))
          .then((migrated) => {
            const validModels = migrated.filter(Boolean)
            if (!cancelled && validModels.length > 0) setModels(validModels)
          })
      })
      .catch((error) => console.error('Failed to load model configurations:', error))
    return () => { cancelled = true }
  }, [])

  const openCreateDrawer = () => {
    setIsCreateMode(true)
    setSelectedId(null)
    setForm(createModelForm())
    setVisibleApiKey(false)
    setSaveMessage('')
    setTestResult(null)
    setIsEditorOpen(true)
  }

  const openEditDrawer = (model) => {
    setIsCreateMode(false)
    setSelectedId(model.id)
    setForm({ ...model })
    setVisibleApiKey(false)
    setSaveMessage('')
    setTestResult(null)
    setIsEditorOpen(true)
  }

  const handleCloseDrawer = () => {
    setIsEditorOpen(false)
    setVisibleApiKey(false)
    setSaveMessage('')
    setTestResult(null)
  }

  const handleChange = (field, value) => {
    setForm((current) => {
      if (field === 'isPublic' && !value) {
        return { ...current, isPublic: false, publicConfirmed: false }
      }
      return { ...current, [field]: value }
    })
    if (saveMessage) setSaveMessage('')
    if (testResult) setTestResult(null)
  }

  const handleTestConnection = async () => {
    if (!form.apiEndpoint.trim()) {
      alert('Model API endpoint is required.')
      return
    }

    if (!form.apiKey.trim()) {
      alert('API key is required to test the connection.')
      return
    }

    if (form.providerType === 'Open AI Compatible' && !form.modelName.trim()) {
      alert('Model name is required to test an OpenAI compatible connection.')
      return
    }

    setIsTesting(true)
    setTestResult(null)

    try {
      const response = await fetch(`${API_BASE}/model-configurations/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          providerType: form.providerType,
          modelName: form.modelName.trim(),
          apiEndpoint: form.apiEndpoint.trim(),
          apiKey: form.apiKey.trim(),
        }),
      })
      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(payload?.detail || payload?.message || 'Failed to test model connection')
      }

      setTestResult(payload)
    } catch (error) {
      setTestResult({
        ok: false,
        message: error.message || 'Connection test failed.',
        suggestion: 'Please review the configuration and try again.',
      })
    } finally {
      setIsTesting(false)
    }
  }

  const handleSubmit = () => {
    if (!form.modelName.trim()) {
      alert('Model name is required.')
      return
    }

    if (!form.apiEndpoint.trim()) {
      alert('Model API endpoint is required.')
      return
    }

    if (form.isPublic && !form.publicConfirmed) {
      alert('Please confirm the public access warning before saving.')
      return
    }

    const request = {
      modelName: form.modelName.trim(),
      providerType: form.providerType,
      apiEndpoint: form.apiEndpoint.trim(),
      isPublic: Boolean(form.isPublic),
    }
    if (form.apiKey.trim()) request.apiKey = form.apiKey.trim()
    const url = isCreateMode
      ? `${API_BASE}/model-configurations/`
      : `${API_BASE}/model-configurations/${form.id}`
    fetch(url, {
      method: isCreateMode ? 'POST' : 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    })
      .then(async (response) => {
        const payload = await response.json().catch(() => null)
        if (!response.ok) throw new Error(payload?.detail || 'Failed to save model configuration')
        setModels((current) => isCreateMode ? [...current, payload] : current.map((item) => item.id === payload.id ? payload : item))
        setSaveMessage(isCreateMode ? 'Model created.' : 'Model updated.')
        setIsCreateMode(false)
        setSelectedId(payload.id)
        setForm(payload)
      })
      .catch((error) => setSaveMessage(error.message || 'Failed to save model configuration'))
  }

  const handleDelete = async (modelId) => {
    const target = models.find((model) => model.id === modelId)
    if (!target) return

    let impactedEmployees = []
    try {
      const response = await fetch(`${API_BASE}/ai-employees/`)
      const employees = await response.json().catch(() => [])
      if (response.ok && Array.isArray(employees)) {
        impactedEmployees = employees
          .filter((employee) => employee?.model === target.modelName)
          .map((employee) => employee.name || `Employee ${employee.id}`)
      }
    } catch (error) {
      console.error('Failed to load model impact range:', error)
    }

    setDeleteDialog({
      open: true,
      modelId,
      title: `删除模型 ${target.modelName}？`,
      sections: [
        { label: '影响范围', value: `受影响数字员工：${formatImpactNames(impactedEmployees)}` },
      ],
    })
  }

  const handleConfirmDelete = () => {
    if (!deleteDialog.modelId) return
    fetch(`${API_BASE}/model-configurations/${deleteDialog.modelId}`, { method: 'DELETE' })
      .then(async (response) => {
        const payload = await response.json().catch(() => null)
        if (!response.ok) throw new Error(payload?.detail || 'Failed to delete model configuration')
        setModels((current) => current.filter((model) => model.id !== deleteDialog.modelId))
        if (selectedId === deleteDialog.modelId) handleCloseDrawer()
        setDeleteDialog({ open: false, modelId: null, title: '', sections: [] })
      })
      .catch((error) => setSaveMessage(error.message || 'Failed to delete model configuration'))
  }

  return (
    <div className="flex min-h-screen bg-[#f6f7fb] text-gray-900">
      <Sidebar />
      <DeleteConfirmModal
        isOpen={deleteDialog.open}
        onClose={() => setDeleteDialog({ open: false, modelId: null, title: '', sections: [] })}
        onConfirm={handleConfirmDelete}
        title={deleteDialog.title}
        description="删除后，该模型会从模型列表移除；使用该模型的数字员工将无法继续按当前配置调用该模型，需要重新选择并保存其他模型。"
        descriptionTone="danger"
        sections={deleteDialog.sections}
        confirmLabel="确认删除"
      />

      <div className="flex-1 overflow-hidden">
        <div className="flex h-screen flex-col">
          <header className="border-b border-gray-200 bg-white px-8 py-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-semibold text-gray-900">Model Configuration</h1>
              </div>
              <button
                type="button"
                onClick={openCreateDrawer}
                className="rounded-2xl bg-red-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-red-600"
              >
                Add Model
              </button>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto px-10 py-6">
            <section className="rounded-[28px] border border-gray-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-white">
                    <tr className="text-left text-gray-500">
                      <th className="px-8 py-5 font-semibold">Name</th>
                      <th className="px-6 py-5 font-semibold">Provider</th>
                      <th className="px-6 py-5 font-semibold">Endpoint</th>
                      <th className="px-6 py-5 font-semibold">Public</th>
                      <th className="px-6 py-5 font-semibold">Updated</th>
                      <th className="px-6 py-5 font-semibold">Actions</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-gray-100 bg-white text-gray-800">
                    {models.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-8 py-16 text-center text-sm text-gray-500">
                          No models yet.
                        </td>
                      </tr>
                    ) : (
                      models.map((model) => (
                        <tr key={model.id} className="hover:bg-gray-50/80">
                          <td className="px-8 py-5 align-middle">
                            <div className="flex items-center gap-2">
                              <div className="font-semibold text-gray-900">{model.modelName}</div>
                              {model.isPublic && (
                                <span className="inline-flex rounded-full bg-sky-100 px-2.5 py-1 text-[11px] font-semibold text-sky-700">Public</span>
                              )}
                            </div>
                            <div className="mt-1 text-xs text-gray-500">{maskApiKey(model.apiKey)}</div>
                          </td>
                          <td className="px-6 py-5 align-middle">{model.providerType}</td>
                          <td className="px-6 py-5 align-middle text-gray-500">{model.apiEndpoint}</td>
                          <td className="px-6 py-5 align-middle">
                            <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${model.isPublic ? 'bg-sky-100 text-sky-700' : 'bg-gray-100 text-gray-600'}`}>
                              {model.isPublic ? 'Public' : 'Private'}
                            </span>
                          </td>
                          <td className="px-6 py-5 align-middle text-gray-500">{formatDate(model.updatedAt)}</td>
                          <td className="px-6 py-5 align-middle">
                            <div className="flex items-center gap-3">
                              <button
                                type="button"
                                onClick={() => openEditDrawer(model)}
                                className="text-sm font-medium text-[#6266EA] transition hover:text-[#4d51cf]"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDelete(model.id)}
                                className="text-sm font-medium text-red-500 transition hover:text-red-600"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between border-t border-gray-200 px-8 py-5 text-sm text-gray-500">
                <span>Total {models.length} models</span>
                <span>Selectable by silicon workers after save</span>
              </div>
            </section>
          </main>
        </div>
      </div>

      {isEditorOpen && (
        <div className="fixed inset-0 z-40 flex justify-end bg-slate-900/20 backdrop-blur-[1px]">
          <button type="button" aria-label="Close model editor" className="flex-1 cursor-default" onClick={handleCloseDrawer} />

          <aside className="relative flex h-full w-full max-w-[720px] flex-col border-l border-gray-200 bg-white shadow-2xl">
            <div className="border-b border-gray-200 px-8 py-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-semibold text-gray-900">{isCreateMode ? 'Create Model' : 'Edit Model'}</h2>
                  <p className="mt-1 text-sm text-gray-500">Configure provider, endpoint and credentials for this model connection.</p>
                </div>
                <button
                  type="button"
                  onClick={handleCloseDrawer}
                  className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700"
                >
                  Close
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-8 py-6">
              <div className="space-y-5 rounded-2xl border border-gray-200 bg-[#fbfbfe] p-6">
                <label className="block text-sm text-gray-700">
                  <div className="mb-2 font-medium">Model Name</div>
                  <input
                    value={form.modelName}
                    onChange={(event) => handleChange('modelName', event.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 outline-none transition focus:border-[#6266EA]"
                    placeholder="Enter model name"
                  />
                </label>

                <label className="block text-sm text-gray-700">
                  <div className="mb-2 font-medium">Provider Type</div>
                  <select
                    value={form.providerType}
                    onChange={(event) => handleChange('providerType', event.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 outline-none transition focus:border-[#6266EA]"
                  >
                    {PROVIDER_OPTIONS.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </label>

                <label className="block text-sm text-gray-700">
                  <div className="mb-2 font-medium">API Endpoint</div>
                  <input
                    value={form.apiEndpoint}
                    onChange={(event) => handleChange('apiEndpoint', event.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 outline-none transition focus:border-[#6266EA]"
                    placeholder="https://api.example.com/v1"
                  />
                </label>

                <label className="block text-sm text-gray-700">
                  <div className="mb-2 font-medium">API Key</div>
                  <div className="relative">
                    <input
                      type={visibleApiKey ? 'text' : 'password'}
                      value={form.apiKey}
                      onChange={(event) => handleChange('apiKey', event.target.value)}
                      className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 pr-20 outline-none transition focus:border-[#6266EA]"
                      placeholder="Enter API key"
                    />
                    <button
                      type="button"
                      onClick={() => setVisibleApiKey((current) => !current)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600 transition hover:bg-gray-200"
                    >
                      {visibleApiKey ? 'Hide' : 'Show'}
                    </button>
                  </div>
                </label>

                <section className="rounded-2xl border border-gray-200 bg-white px-5 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-sm font-medium text-gray-900">Public</div>
                      <p className="mt-1 text-sm text-gray-500">If enabled, everyone in this organization can use this model.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleChange('isPublic', !form.isPublic)}
                      className={`relative inline-flex h-7 w-12 items-center rounded-full transition ${form.isPublic ? 'bg-[#6266EA]' : 'bg-gray-200'}`}
                      aria-pressed={form.isPublic}
                    >
                      <span
                        className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${form.isPublic ? 'translate-x-6' : 'translate-x-1'}`}
                      />
                    </button>
                  </div>

                  {form.isPublic && (
                    <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4">
                      <div className="text-sm font-medium text-amber-900">Confirmation required</div>
                      <p className="mt-1 text-sm text-amber-800">This model will become available to all members in the current organization.</p>
                      <label className="mt-3 flex items-start gap-3 text-sm text-amber-900">
                        <input
                          type="checkbox"
                          checked={form.publicConfirmed}
                          onChange={(event) => handleChange('publicConfirmed', event.target.checked)}
                          className="mt-0.5 h-4 w-4 rounded border-amber-300 text-[#6266EA] focus:ring-[#6266EA]"
                        />
                        <span>I understand that this model will be shared with everyone in the organization.</span>
                      </label>
                    </div>
                  )}
                </section>

                {testResult && (
                  <section className={`rounded-2xl border px-5 py-4 ${testResult.ok ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'}`}>
                    <div className={`text-sm font-semibold ${testResult.ok ? 'text-emerald-800' : 'text-red-800'}`}>
                      {testResult.ok ? 'Connection successful' : 'Connection failed'}
                    </div>
                    <p className={`mt-1 text-sm ${testResult.ok ? 'text-emerald-700' : 'text-red-700'}`}>{testResult.message}</p>
                    {!testResult.ok && getTestFieldHint(testResult) && (
                      <p className="mt-2 text-xs font-medium text-red-800">{getTestFieldHint(testResult)}</p>
                    )}
                    {typeof testResult.latency_ms === 'number' && testResult.latency_ms >= 0 && (
                      <p className={`mt-2 text-xs ${testResult.ok ? 'text-emerald-700/90' : 'text-red-700/90'}`}>
                        Response time: {testResult.latency_ms} ms
                      </p>
                    )}
                    {!testResult.ok && testResult.suggestion && (
                      <p className="mt-2 text-xs text-red-700/90">{testResult.suggestion}</p>
                    )}
                  </section>
                )}

              </div>
            </div>

            <div className="flex items-center justify-between border-t border-gray-200 px-8 py-5">
              <div className="text-sm text-gray-500">{saveMessage}</div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={isTesting}
                  className="rounded-xl border border-[#6266EA] bg-white px-4 py-2.5 text-sm font-medium text-[#6266EA] transition hover:bg-[#f5f5ff] disabled:cursor-not-allowed disabled:border-gray-200 disabled:text-gray-400"
                >
                  {isTesting ? 'Testing...' : 'Test Connection'}
                </button>
                <button
                  type="button"
                  onClick={handleCloseDrawer}
                  className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  className="rounded-xl bg-[#6266EA] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#5256d0]"
                >
                  {isCreateMode ? 'Create Model' : 'Save Changes'}
                </button>
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  )
}

export default ModelConfiguration