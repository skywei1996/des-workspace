import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import axios from 'axios'
import Sidebar from '../components/Sidebar'
import { useLanguage } from '../i18n'
import { API_BASE } from '../config/api'

const ArrowLeftIcon = ({ className = 'w-4 h-4' }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
  </svg>
)

const EyeIcon = ({ className = 'w-4 h-4' }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
    />
  </svg>
)

const EyeOffIcon = ({ className = 'w-4 h-4' }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.542 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
    />
  </svg>
)

const CheckIcon = ({ className = 'w-4 h-4' }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
)

const AlertIcon = ({ className = 'w-4 h-4' }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
    />
  </svg>
)

const SparkIcon = ({ className = 'w-4 h-4' }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M5 3v4M3 5h4M6 17v4M4 19h4M13 3l2.5 6L22 11l-6.5 2L13 19l-2.5-6L4 11l6.5-2L13 3z"
    />
  </svg>
)

const DifyLogo = ({ className = 'w-5 h-5' }) => (
  <svg className={className} viewBox="0 0 32 32" fill="none">
    <rect x="2" y="2" width="28" height="28" rx="6" fill="url(#dify-g-c)" />
    <path
      d="M10.5 20.5c1.8 0 2.7-1 2.7-2.5 0-1.1-.5-2-1.7-2.4l-1-.33c-.8-.27-1.3-.73-1.3-1.34 0-.66.55-1.18 1.35-1.18.78 0 1.33.44 1.52 1.1h2.18c-.19-1.56-1.38-2.7-3.7-2.7-2.18 0-3.6 1.25-3.6 2.93 0 1.2.54 2.1 1.75 2.53l1 .33c.9.3 1.35.77 1.35 1.4 0 .75-.65 1.27-1.6 1.27-1.13 0-1.8-.6-2-1.5H7.3c.22 1.83 1.57 3 3.2 3Zm12.85-4.8h-4.47v-.97h4.47V14h-4.47v-1.7h-2.3v6.4h2.3v-2.47h4.47v-.97h-4.47v-.66h4.47V15.7Z"
      fill="white"
    />
    <defs>
      <linearGradient id="dify-g-c" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
        <stop stopColor="#1A1D29" />
        <stop offset="1" stopColor="#3A3F54" />
      </linearGradient>
    </defs>
  </svg>
)

const LockedIcon = ({ className = 'w-3.5 h-3.5' }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
    />
  </svg>
)

const DEFAULT_AVATAR_OPTIONS = [
  '/Pic/2.JPG',
  '/Pic/3.JPG',
  '/Pic/4.JPG',
  '/Pic/5.JPG',
  '/Pic/6.jpg',
  '/Pic/7.jpg',
]

const getAvatarInitial = (value = '') => {
  const normalized = String(value || '').trim()
  return normalized ? normalized.slice(0, 1).toUpperCase() : 'S'
}

const CATEGORY_OPTIONS = [
  'HR', 'Engineering', 'Product', 'Design', 'Sales', 'Marketing',
  'Finance', 'Operations', 'Customer Support', 'Legal', 'IT',
  'Workflow Automation', 'Knowledge Base', 'Custom Tools', 'General AI',
]

const AvatarSelectionModal = ({ isOpen, onClose, onSave, currentAvatar }) => {
  const [selectedAvatar, setSelectedAvatar] = useState(currentAvatar || DEFAULT_AVATAR_OPTIONS[0])

  useEffect(() => {
    if (isOpen) {
      setSelectedAvatar(currentAvatar || DEFAULT_AVATAR_OPTIONS[0])
    }
  }, [isOpen, currentAvatar])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-[560px] max-w-[92vw] rounded-2xl border border-gray-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">
            选择头像
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-2 text-sm font-medium text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900"
          >
            取消
          </button>
        </div>
        <div className="grid grid-cols-3 gap-4 px-6 py-6 sm:grid-cols-4">
          {DEFAULT_AVATAR_OPTIONS.map((option, index) => {
            const isSelected = selectedAvatar === option
            return (
              <button
                key={option}
                type="button"
                onClick={() => setSelectedAvatar(option)}
                className={`group overflow-hidden rounded-2xl border-2 bg-gray-50 transition-all ${isSelected ? 'border-blue-600 shadow-lg shadow-blue-100' : 'border-transparent hover:border-gray-300'}`}
              >
                <div className="aspect-square w-full overflow-hidden bg-gradient-to-br from-blue-50 via-white to-slate-100">
                  <img src={option} alt={`Avatar ${index + 1}`} className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105" />
                </div>
              </button>
            )
          })}
        </div>
        <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900"
          >
            关闭
          </button>
          <button
            type="button"
            onClick={() => {
              onSave(selectedAvatar)
              onClose()
            }}
            className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  )
}

const CHANNELS = [
  {
    key: 'dify',
    name: 'Dify',
    subtitle: 'Chatflow / Workflow / Agent',
    supported: true,
    description: '接入 Dify 自建或云端应用',
    brandClass: 'from-[#1A1D29] to-[#3A3F54]',
    logo: DifyLogo,
  },
  {
    key: 'google-adk',
    name: 'Google ADK',
    subtitle: 'Agent Development Kit',
    supported: false,
    description: '即将支持',
    brandClass: 'from-[#4285F4] to-[#34A853]',
    logo: SparkIcon,
  },
]

const DifyFormSection = ({
  difyUrl,
  setDifyUrl,
  difyAppType,
  setDifyAppType,
  difyApiKey,
  setDifyApiKey,
  showKey,
  setShowKey,
  testing,
  onTest,
  testResult,
  error,
  isZh,
}) => (
  <section className="bg-white rounded-2xl border border-gray-200 p-6 space-y-5">
    <div className="text-sm font-semibold text-gray-900 mb-2">
      {isZh ? 'Dify 连接配置 *' : 'Dify connection *'}
    </div>

    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {isZh ? 'Dify 服务地址 (URL) *' : 'Dify base URL *'}
      </label>
      <input
        type="text"
        value={difyUrl}
        onChange={(e) => setDifyUrl(e.target.value)}
        placeholder="https://udify.app  或  http://your-dify-host:5001"
        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6266EA]/30 focus:border-[#6266EA] font-mono text-sm"
      />

    </div>

    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {isZh ? 'Dify 应用类型 *' : 'Dify App type *'}
      </label>
      <div className="inline-flex gap-2">
        {[
          { key: 'chatflow', label: 'Chatflow' },
          { key: 'workflow', label: 'Workflow' },
        ].map((opt) => (
          <button
            key={opt.key}
            type="button"
            onClick={() => setDifyAppType(opt.key)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
              difyAppType === opt.key
                ? 'bg-[#6266EA] text-white shadow-sm'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>

    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="block text-sm font-medium text-gray-700">
          {isZh ? 'API Key *' : 'API Key *'}
        </label>
        <button
          type="button"
          onClick={() => setShowKey((v) => !v)}
          className="text-xs text-gray-500 hover:text-gray-800 flex items-center gap-1"
        >
          {showKey ? <EyeOffIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
          <span>{showKey ? (isZh ? '隐藏' : 'Hide') : (isZh ? '显示' : 'Show')}</span>
        </button>
      </div>
      <div className="relative">
        <input
          type={showKey ? 'text' : 'password'}
          value={difyApiKey}
          onChange={(e) => setDifyApiKey(e.target.value)}
          placeholder="app-xxxxxxxxxxxxxxxxxxxxxxxx"
          autoComplete="off"
          className="w-full px-3 py-2 pr-24 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6266EA]/30 focus:border-[#6266EA] font-mono text-sm"
        />
        <button
          type="button"
          onClick={onTest}
          disabled={testing}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 px-3 py-1.5 text-xs font-medium rounded-md bg-gray-100 hover:bg-gray-200 text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {testing ? (isZh ? '测试中...' : 'Testing...') : (isZh ? '测试连接' : 'Test')}
        </button>
      </div>

    </div>

    {testResult && (
      <div
        className={`rounded-xl p-4 text-sm flex items-start gap-3 ${
          testResult.ok
            ? 'bg-emerald-50 text-emerald-800 border border-emerald-100'
            : 'bg-rose-50 text-rose-800 border border-rose-100'
        }`}
      >
        <div
          className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
            testResult.ok ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'
          }`}
        >
          {testResult.ok ? <CheckIcon className="w-3.5 h-3.5" /> : <AlertIcon className="w-3.5 h-3.5" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-medium">
            {testResult.ok ? (isZh ? '连接成功' : 'Connected') : (isZh ? '连接失败' : 'Failed')}
          </div>
          {testResult.message && (
            <div className="text-xs mt-0.5 opacity-80 break-words">{testResult.message}</div>
          )}
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs mt-1 opacity-80">
            {testResult.latencyMs != null && (
              <span>
                {isZh ? '延迟：' : 'Latency: '}
                <span className="font-mono">{testResult.latencyMs} ms</span>
              </span>
            )}
            {testResult.inputsSchema && Array.isArray(testResult.inputsSchema) && (
              <span>
                {isZh ? '输入变量：' : 'Inputs: '}
                <span className="font-mono">{testResult.inputsSchema.length}</span>
              </span>
            )}
          </div>
        </div>
      </div>
    )}

    {error && !testResult && (
      <div className="rounded-xl p-4 text-sm bg-rose-50 text-rose-800 border border-rose-100 flex items-start gap-3">
        <AlertIcon className="w-5 h-5 flex-shrink-0 mt-0.5" />
        <span>{error}</span>
      </div>
    )}
  </section>
)

const UnsupportedChannelPlaceholder = ({ channel, isZh }) => (
  <section className="bg-white rounded-2xl border border-dashed border-gray-300 p-12 flex flex-col items-center justify-center text-center">
    <div
      className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${channel.brandClass} flex items-center justify-center text-white mb-5 opacity-90`}
    >
      <channel.logo className="w-7 h-7" />
    </div>
    <h3 className="text-base font-semibold text-gray-900 mb-1">
      {channel.name} {isZh ? '连接配置' : ' configuration'}
    </h3>
    <p className="text-sm text-gray-500 max-w-md">
      {isZh
        ? '该渠道的接入能力正在开发中，稍后即可通过对应 API Key / OAuth 方式接入，敬请期待。'
        : 'Integration for this channel is coming soon. Stay tuned!'}
    </p>
    <div className="mt-6 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-50 text-amber-700 text-xs font-medium border border-amber-100">
      <SparkIcon className="w-3.5 h-3.5" />
      <span>{isZh ? '即将支持' : 'Coming soon'}</span>
    </div>
  </section>
)

const DifyParamsForm = ({ inputsSchema, presetInputs, onChangePreset, isZh }) => {
  const list = Array.isArray(inputsSchema) ? inputsSchema : []
  if (list.length === 0) return null
  const values = presetInputs && typeof presetInputs === 'object' ? presetInputs : {}
  return (
    <section className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <div className="text-sm font-semibold text-gray-900">
            {isZh ? '输入变量（自动检测，可预设默认值）' : 'Input variables (auto-detected, preset defaults)'}
            <span className="ml-2 text-xs font-normal text-gray-400">· {list.length}</span>
          </div>
          <p className="text-[11px] text-gray-400 mt-1">
            {isZh
              ? '这些变量来自 Dify Flow「开始运行」节点的 user_input_form，可在此处预设默认值，后续实际调用 Dify 时会一起带上。'
              : 'These variables come from Dify Flow start node user_input_form. Fill preset defaults here; they will be sent together when invoking Dify later.'}
          </p>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {list.map((item, idx) => {
          const label = item?.label || item?.variable || item?.key || `var_${idx}`
          const variable = item?.variable || item?.key || label
          const type = (item?.type || item?.component || 'text-input').toString().toLowerCase()
          const required = item?.required === true || item?.required === 'required'
          const placeholder =
            item?.placeholder ||
            (typeof item?.default === 'string' ? item.default : '') ||
            (isZh ? `请输入 ${label}` : `Enter ${label}`)
          const isTextarea =
            type.includes('paragraph') ||
            type.includes('textarea') ||
            type === 'text-area' ||
            type === 'paragraph-text'
          const isNumber =
            type === 'number' || type.includes('number') || type === 'number-input'
          const isSelect =
            type === 'select' ||
            type === 'dropdown' ||
            type.includes('select') ||
            (Array.isArray(item?.options) && item.options.length > 0)
          const options = Array.isArray(item?.options)
            ? item.options
            : Array.isArray(item?.enum)
            ? item.enum
            : []
          const rawVal = values[variable]
          const currentVal = rawVal == null ? '' : rawVal
          const handleChange = (nextVal) => {
            const merged = { ...values, [variable]: nextVal }
            onChangePreset(merged)
          }
          return (
            <div key={`${variable}-${idx}`} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-gray-700">
                  {label}
                  {required && <span className="ml-0.5 text-rose-500">*</span>}
                </label>
                <span className="text-[10px] font-mono text-gray-400 truncate max-w-[45%]">{variable}</span>
              </div>
              {isTextarea ? (
                <textarea
                  rows={3}
                  value={currentVal}
                  placeholder={placeholder}
                  onChange={(e) => handleChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6266EA]/30 focus:border-[#6266EA] text-sm resize-y"
                />
              ) : isNumber ? (
                <input
                  type="number"
                  value={currentVal}
                  placeholder={placeholder}
                  onChange={(e) => {
                    const v = e.target.value
                    if (v === '' || v === '-') return handleChange(v)
                    handleChange(Number.isNaN(Number(v)) ? v : Number(v))
                  }}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6266EA]/30 focus:border-[#6266EA] text-sm font-mono"
                />
              ) : isSelect ? (
                <select
                  value={currentVal}
                  onChange={(e) => handleChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6266EA]/30 focus:border-[#6266EA] text-sm bg-white"
                >
                  <option value="">{isZh ? '请选择' : 'Please select'}</option>
                  {options.map((opt, oi) => {
                    const ov = typeof opt === 'string' ? opt : opt?.value ?? opt?.label ?? `${oi}`
                    const ol = typeof opt === 'string' ? opt : opt?.label ?? ov
                    return (
                      <option key={`${ov}-${oi}`} value={ov}>
                        {ol}
                      </option>
                    )
                  })}
                </select>
              ) : (
                <input
                  type="text"
                  value={currentVal}
                  placeholder={placeholder}
                  onChange={(e) => handleChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6266EA]/30 focus:border-[#6266EA] text-sm"
                />
              )}
              {item?.hint && (
                <p className="text-[11px] text-gray-400">{item.hint}</p>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}

const ConnectSiliconWorker = () => {
  const navigate = useNavigate()
  const { isZh } = useLanguage()
  const location = useLocation()
  const editId = location.state?.editId || null
  const [selectedChannel, setSelectedChannel] = useState('dify')

  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [tags, setTags] = useState([])
  const [tagInput, setTagInput] = useState('')
  const [description, setDescription] = useState('')
  const [avatarUrl, setAvatarUrl] = useState(DEFAULT_AVATAR_OPTIONS[0])
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false)

  const [difyUrl, setDifyUrl] = useState('')
  const [difyApiKey, setDifyApiKey] = useState('')
  const [difyAppType, setDifyAppType] = useState('chatflow')
  const [showKey, setShowKey] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')
  const [presetInputs, setPresetInputs] = useState({})
  const [connectionState, setConnectionState] = useState('untested') // 'untested' | 'ok' | 'fail'
  const [warnToast, setWarnToast] = useState(null) // { type: 'untested' | 'fail' }
  const testTimerRef = useRef(null)
  const warnToastTimerRef = useRef(null)
  const [loading, setLoading] = useState(false)

  const activeChannel = useMemo(
    () => CHANNELS.find((c) => c.key === selectedChannel) || CHANNELS[0],
    [selectedChannel],
  )

  const activeInputsSchema = useMemo(() => {
    if (testResult?.ok && Array.isArray(testResult.inputsSchema)) return testResult.inputsSchema
    return null
  }, [testResult])

  useEffect(() => {
    return () => {
      if (testTimerRef.current) clearTimeout(testTimerRef.current)
    }
  }, [])

  // 凭据变化时重置连接验证状态
  useEffect(() => {
    setConnectionState('untested')
    setTestResult(null)
  }, [difyUrl, difyApiKey, difyAppType])

  // 编辑模式：加载已有员工连接配置并预填
  useEffect(() => {
    if (!editId) return
    let cancelled = false
    setLoading(true)
    axios
      .get(`${API_BASE}/ai-employees/${editId}`)
      .then((res) => {
        if (cancelled) return
        const d = res.data || {}
        setName(d.name || '')
        setCategory(d.role_title || '')
        setTags(Array.isArray(d.tags) ? d.tags : [])
        setDescription(d.description || '')
        setAvatarUrl(d.avatar_url || DEFAULT_AVATAR_OPTIONS[0])
        setDifyUrl(d.dify_url || '')
        setDifyApiKey(d.dify_api_key || '')
        setDifyAppType(d.dify_app_type || 'chatflow')
        setPresetInputs(d.preset_inputs && typeof d.preset_inputs === 'object' ? d.preset_inputs : {})
        if (d.dify_url) setSelectedChannel('dify')
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [editId])

  const canSubmit = activeChannel.supported && activeChannel.key === 'dify'

  const handleTestConnection = async () => {
    setFormError('')
    setTestResult(null)
    setConnectionState('untested')
    if (selectedChannel !== 'dify') return
    if (!difyUrl.trim() || !difyApiKey.trim()) {
      setFormError(isZh ? '请先填写 Dify 服务地址和 API Key' : 'Please enter Dify URL and API Key first')
      return
    }
    setTesting(true)
    let isOk = false
    try {
      const res = await axios.post(`${API_BASE}/ai-employees/dify/test-connection`, {
        dify_url: difyUrl.trim(),
        dify_api_key: difyApiKey.trim(),
        dify_app_type: difyAppType,
      })
      const payload = {
        ok: !!res.data?.ok,
        message: res.data?.message || '',
        appName: res.data?.app_name || '',
        appType: res.data?.app_type || '',
        latencyMs: res.data?.latency_ms || null,
        inputsSchema: res.data?.inputs_schema || null,
      }
      isOk = payload.ok
      setTestResult(payload)
      setConnectionState(payload.ok ? 'ok' : 'fail')
      if (payload.ok && payload.appName && !name.trim()) {
        setName(payload.appName)
      }
    } catch (err) {
      const msg =
        (err?.response?.data?.detail) ||
        (err?.response?.data?.message) ||
        err?.message ||
        (isZh ? '测试失败，请检查连接' : 'Test failed')
      setTestResult({ ok: false, message: msg, appName: '', appType: '', latencyMs: null, inputsSchema: null })
      setConnectionState('fail')
    } finally {
      setTesting(false)
      if (testTimerRef.current) clearTimeout(testTimerRef.current)
      // 仅成功时自动收起结果，失败时常驻直到用户修改凭据或重新测试
      if (isOk) {
        testTimerRef.current = setTimeout(() => setTestResult(null), 15000)
      }
    }
  }

  const doSave = async () => {
    setFormError('')
    if (!canSubmit) {
      setFormError(isZh ? '该渠道暂未开放接入，请先选择已支持的渠道' : 'This channel is not available yet')
      return
    }
    if (!name.trim()) {
      setFormError(isZh ? '请填写员工名称' : 'Name is required')
      return
    }
    if (!difyUrl.trim() || !difyApiKey.trim()) {
      setFormError(isZh ? '请填写 Dify 服务地址和 API Key' : 'Dify URL and API Key are required')
      return
    }

    // 软拦截：未测试 / 测试失败时弹出 toast 提示，但仍允许保存
    if (connectionState === 'untested' || connectionState === 'fail') {
      setWarnToast({ type: connectionState })
      if (warnToastTimerRef.current) clearTimeout(warnToastTimerRef.current)
      warnToastTimerRef.current = setTimeout(() => setWarnToast(null), 3500)
    }

    setSubmitting(true)
    try {
      let res
      if (editId) {
        res = await axios.put(`${API_BASE}/ai-employees/${editId}/dify`, {
          name: name.trim(),
          role_title: category.trim() || undefined,
          tags: tags.length ? tags : undefined,
          description: description.trim() || undefined,
          avatar_url: avatarUrl,
          dify_url: difyUrl.trim(),
          dify_api_key: difyApiKey.trim(),
          dify_app_type: difyAppType,
          preset_inputs: presetInputs && Object.keys(presetInputs).length ? presetInputs : undefined,
        })
      } else {
        res = await axios.post(`${API_BASE}/ai-employees/dify/connect`, {
          name: name.trim(),
          role_title: category.trim() || undefined,
          tags: tags.length ? tags : undefined,
          description: description.trim() || undefined,
          avatar_url: avatarUrl,
          dify_url: difyUrl.trim(),
          dify_api_key: difyApiKey.trim(),
          dify_app_type: difyAppType,
          preset_inputs: presetInputs && Object.keys(presetInputs).length ? presetInputs : undefined,
        })
      }
      navigate('/silicon-workmate', { state: { createdId: res.data?.id } })
    } catch (err) {
      const msg =
        (err?.response?.data?.detail) ||
        (Array.isArray(err?.response?.data?.detail)
          ? err.response.data.detail.map((d) => d?.msg || '').filter(Boolean).join('；')
          : '') ||
        err?.message ||
        (isZh ? '创建失败，请重试' : 'Failed to create worker')
      setFormError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    doSave()
  }

  return (
    <div className="flex h-screen bg-[#f7f8fc]">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-gray-200 flex-none">
          <div className="px-8 py-5">
            <button
              onClick={() => navigate('/silicon-workmate')}
              className="text-sm text-gray-500 hover:text-gray-800 flex items-center gap-1 mb-4 transition-colors"
            >
              <ArrowLeftIcon className="w-4 h-4" />
              <span>{isZh ? '返回我的数字员工' : 'Back to workers'}</span>
            </button>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#6266EA] to-[#8C5EFF] flex items-center justify-center text-white">
                  <SparkIcon className="w-5 h-5" />
                </div>
                <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  {editId ? (isZh ? '编辑数字员工' : 'Edit Worker') : (isZh ? '连接外部数字员工' : 'Connect External Worker')}
                </h1>
                <p className="text-sm text-gray-500 mt-1">
                  {editId
                    ? (isZh ? '修改该数字员工的连接配置与基础信息' : "Update this worker's connection and basic info")
                    : (isZh ? '选择接入渠道，将外部平台已有的 Agent / 工作流作为数字员工引入本系统' : 'Pick a provider to import an external Agent or workflow')}
                </p>
                </div>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="max-w-5xl mx-auto px-8 py-8">
            {loading ? (
              <div className="flex items-center justify-center py-32 text-gray-400 text-sm">
                <span className="w-5 h-5 border-2 border-gray-300 border-t-transparent rounded-full animate-spin mr-2" />
                {isZh ? '加载中...' : 'Loading...'}
              </div>
            ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <section className="bg-white rounded-2xl border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                  <div className="text-sm font-semibold text-gray-900">
                    {isZh ? '选择接入渠道 *' : 'Choose a provider *'}
                  </div>

                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {CHANNELS.map((channel) => {
                    const selected = selectedChannel === channel.key
                    return (
                      <button
                        key={channel.key}
                        type="button"
                        onClick={() => channel.supported && setSelectedChannel(channel.key)}
                        disabled={!channel.supported}
                        className={`relative text-left p-4 rounded-xl border transition-all overflow-hidden ${
                          selected
                            ? 'border-[#6266EA] bg-[#6266EA]/5 ring-1 ring-[#6266EA]/30'
                            : channel.supported
                            ? 'border-gray-200 bg-white hover:border-gray-300'
                            : 'border-gray-200 bg-gray-50/70 opacity-80 cursor-not-allowed'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className={`w-9 h-9 rounded-lg flex-shrink-0 bg-gradient-to-br ${channel.brandClass} flex items-center justify-center text-white ${
                              !channel.supported ? 'grayscale' : ''
                            }`}
                          >
                            <channel.logo className="w-4.5 h-4.5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <div className="text-sm font-semibold text-gray-900 truncate">
                                {channel.name}
                              </div>
                              {!channel.supported && (
                                <LockedIcon className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                              )}
                            </div>
                            <div className="text-[11px] text-gray-500 mt-0.5 truncate">
                              {channel.subtitle}
                            </div>
                            <div className="mt-2">
                              {channel.supported ? (
                                <span
                                  className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                    selected
                                      ? 'bg-[#6266EA] text-white'
                                      : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                  }`}
                                >
                                  {selected ? (isZh ? '已选中' : 'Selected') : (isZh ? '可用' : 'Available')}
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-500 border border-gray-200">
                                  <LockedIcon className="w-3 h-3" />
                                  <span>{channel.description}</span>
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </section>

              <section className="bg-white rounded-2xl border border-gray-200 p-6 space-y-5">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="text-sm font-semibold text-gray-900">
                    {isZh ? '基础信息' : 'Basic Info'}
                  </div>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-gray-50 text-gray-600 text-[11px] font-medium border border-gray-200">
                    <SparkIcon className="w-3 h-3 mr-1" />
                    {activeChannel.name} · {activeChannel.description}
                  </span>
                </div>

                {/* Avatar selection */}
                <div className="flex items-center gap-4">
                  <div
                    className="relative w-16 h-16 rounded-xl overflow-hidden bg-gradient-to-br from-blue-50 via-white to-slate-100 border-2 border-gray-200 cursor-pointer group/avatar hover:border-[#6266EA] transition-colors"
                    onClick={() => setIsAvatarModalOpen(true)}
                    title={isZh ? '点击更换头像' : 'Click to change avatar'}
                  >
                    <img
                      src={avatarUrl}
                      alt="Avatar"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none'
                      }}
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover/avatar:opacity-100 transition-opacity">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsAvatarModalOpen(true)}
                    className="text-sm text-gray-500 hover:text-[#6266EA] transition-colors"
                  >
                    {isZh ? '点击更换头像' : 'Click to change avatar'}
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {isZh ? '员工名称 *' : 'Worker name *'}
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={isZh ? '例如：简历筛选助手' : 'e.g. Resume Screener'}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6266EA]/30 focus:border-[#6266EA]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {isZh ? '分类' : 'Category'}
                    </label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6266EA]/30 focus:border-[#6266EA] bg-white"
                    >
                      <option value="">{isZh ? '请选择分类' : 'Select category'}</option>
                      {CATEGORY_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {isZh ? '标签' : 'Tags'}
                  </label>
                  <div className="flex flex-wrap items-center gap-2 p-2 border border-gray-200 rounded-lg focus-within:ring-2 focus-within:ring-[#6266EA]/30 focus-within:border-[#6266EA]">
                    {tags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-[#6266EA]/10 text-[#6266EA] text-xs font-medium"
                      >
                        {tag}
                        <button
                          type="button"
                          onClick={() => setTags(tags.filter((t) => t !== tag))}
                          className="hover:text-rose-500"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                    <input
                      type="text"
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          const v = tagInput.trim()
                          if (v && !tags.includes(v)) setTags([...tags, v])
                          setTagInput('')
                        }
                      }}
                      onBlur={() => {
                        const v = tagInput.trim()
                        if (v && !tags.includes(v)) setTags([...tags, v])
                        setTagInput('')
                      }}
                      placeholder={isZh ? '输入后回车添加标签' : 'Type and press Enter'}
                      className="flex-1 min-w-[120px] px-1 py-1 outline-none text-sm bg-transparent"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {isZh ? '角色描述' : 'Description'}
                  </label>
                  <textarea
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder={
                      isZh ? '一句话描述这个数字员工的职责和能力（可选）' : 'Optional. Describe this worker'
                    }
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6266EA]/30 focus:border-[#6266EA] resize-y"
                  />
                </div>
              </section>

              {selectedChannel === 'dify' ? (
                <DifyFormSection
                  difyUrl={difyUrl}
                  setDifyUrl={setDifyUrl}
                  difyAppType={difyAppType}
                  setDifyAppType={setDifyAppType}
                  difyApiKey={difyApiKey}
                  setDifyApiKey={setDifyApiKey}
                  showKey={showKey}
                  setShowKey={setShowKey}
                  testing={testing}
                  onTest={handleTestConnection}
                  testResult={testResult}
                  error={formError}
                  isZh={isZh}
                />
              ) : (
                <UnsupportedChannelPlaceholder channel={activeChannel} isZh={isZh} />
              )}

              {selectedChannel === 'dify' && activeInputsSchema && (
                <DifyParamsForm
                  inputsSchema={activeInputsSchema}
                  presetInputs={presetInputs}
                  onChangePreset={setPresetInputs}
                  isZh={isZh}
                />
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => navigate('/silicon-workmate')}
                  className="px-5 py-2.5 rounded-lg text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
                >
                  {isZh ? '取消' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={submitting || !canSubmit}
                  className="px-5 py-2.5 rounded-lg text-sm font-medium text-white bg-[#6266EA] hover:bg-[#5558d4] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                >
                  {submitting ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>{isZh ? '保存中...' : 'Saving...'}</span>
                    </>
                  ) : canSubmit ? (
                    <span>{editId ? (isZh ? '保存修改' : 'Save Changes') : (isZh ? '保存并添加' : 'Save & Add')}</span>
                  ) : (
                    <span>{isZh ? '暂不可用' : 'Unavailable'}</span>
                  )}
                </button>
              </div>
            </form>
            )}
          </div>
        </main>
      </div>

      <AvatarSelectionModal
        isOpen={isAvatarModalOpen}
        onClose={() => setIsAvatarModalOpen(false)}
        onSave={(url) => setAvatarUrl(url)}
        currentAvatar={avatarUrl}
      />

      {/* 连接状态提示 Toast（点击保存后弹出，仍允许保存） */}
      {warnToast && (
        <div className={`fixed top-4 left-1/2 transform -translate-x-1/2 ${warnToast.type === 'fail' ? 'bg-rose-600' : 'bg-amber-600'} text-white px-6 py-3 rounded-lg shadow-lg z-[60] flex items-center gap-2 animate-fadeIn`}>
          <AlertIcon className="w-5 h-5 flex-shrink-0" />
          <span>
            {warnToast.type === 'fail'
              ? (isZh ? '连接测试失败，已为你保存，但该员工可能无法正常对话' : 'Connection test failed. Saved anyway, but this worker may not work properly.')
              : (isZh ? '尚未测试连接，已为你保存，但该员工可能无法正常对话' : 'Connection not tested. Saved anyway, but this worker may not work properly.')}
          </span>
        </div>
      )}
    </div>
  )
}

export default ConnectSiliconWorker
