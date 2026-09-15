import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
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
    key: 'coze',
    name: 'Coze / 扣子',
    subtitle: 'Coze Agent / 工作流',
    supported: false,
    description: '即将支持',
    brandClass: 'from-[#1d4ed8] to-[#6366f1]',
    logo: SparkIcon,
  },
  {
    key: 'fastgpt',
    name: 'FastGPT',
    subtitle: '知识库 / 工作流应用',
    supported: false,
    description: '即将支持',
    brandClass: 'from-[#0ea5e9] to-[#06b6d4]',
    logo: SparkIcon,
  },
  {
    key: 'custom',
    name: '自定义 OpenAPI',
    subtitle: '任意兼容 OpenAI / SSE / Webhook 的 Agent',
    supported: false,
    description: '即将支持',
    brandClass: 'from-slate-600 to-slate-800',
    logo: SparkIcon,
  },
]

const getChannelByKey = (key) => {
  if (!key) return CHANNELS[0]
  return CHANNELS.find((c) => c.key === key) || CHANNELS[0]
}

const DifyConfigSection = ({
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
  isZh,
}) => (
  <section className="bg-white rounded-2xl border border-gray-200 p-6 space-y-5">
    <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
      <div className="text-sm font-semibold text-gray-900">
        {isZh ? 'Dify 连接配置' : 'Dify connection'}
      </div>
      <span className="text-[11px] text-gray-400">
        {isZh ? '若修改了 URL / Key / 类型，建议先点「测试连接」以刷新输入变量' : 'After changing URL/Key/Type, click Test to refresh inputs'}
      </span>
    </div>

    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {isZh ? 'Dify 服务地址 (URL)' : 'Dify base URL'}
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
        {isZh ? 'Dify 应用类型' : 'Dify App type'}
      </label>
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => setDifyAppType('chatflow')}
          className={`relative px-4 py-3 rounded-xl border text-left transition-all ${
            difyAppType === 'chatflow'
              ? 'border-[#6266EA] bg-[#6266EA]/5 ring-1 ring-[#6266EA]/40'
              : 'border-gray-200 hover:border-gray-300 bg-white'
          }`}
        >
          <div className="text-sm font-semibold text-gray-900">Chatflow</div>
          <div className="text-xs text-gray-500 mt-1">
            {isZh ? '流式对话应用 / 聊天助手 / Agent' : 'Conversational apps / Agents'}
          </div>
        </button>
        <button
          type="button"
          onClick={() => setDifyAppType('workflow')}
          className={`relative px-4 py-3 rounded-xl border text-left transition-all ${
            difyAppType === 'workflow'
              ? 'border-[#6266EA] bg-[#6266EA]/5 ring-1 ring-[#6266EA]/40'
              : 'border-gray-200 hover:border-gray-300 bg-white'
          }`}
        >
          <div className="text-sm font-semibold text-gray-900">Workflow</div>
          <div className="text-xs text-gray-500 mt-1">
            {isZh ? '工作流应用（一次性输入 → 输出）' : 'Batch / Workflow apps'}
          </div>
        </button>
      </div>
    </div>

    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="block text-sm font-medium text-gray-700">{isZh ? 'API Key' : 'API Key'}</label>
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
            {testResult.appType && (
              <span>
                {isZh ? '类型：' : 'Type: '}
                <span className="font-mono">{testResult.appType}</span>
              </span>
            )}
            {testResult.appName && (
              <span>
                {isZh ? '应用：' : 'App: '}
                <span className="font-medium">{testResult.appName}</span>
              </span>
            )}
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
  </section>
)

const InputsSection = ({ inputsSchema, difyAppName, presetInputs, onChangePreset, isZh }) => {
  const list = Array.isArray(inputsSchema) ? inputsSchema : []
  const values = presetInputs && typeof presetInputs === 'object' ? presetInputs : {}
  if (list.length === 0) {
    return (
      <section className="bg-white rounded-2xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div>
            <div className="text-sm font-semibold text-gray-900">
              {isZh ? '输入变量（自动检测，可预设默认值）' : 'Input variables (auto-detected, preset defaults)'}
            </div>
            <p className="text-[11px] text-gray-400 mt-1">
              {isZh
                ? '点击上方「测试连接」可从 Dify 拉取 user_input_form 定义，拉取后可在此预设默认值。'
                : 'Click Test above to pull user_input_form definition from Dify; after that you can fill preset defaults here.'}
            </p>
          </div>
          {difyAppName && <span className="text-[11px] text-gray-400 font-mono">{difyAppName}</span>}
        </div>
        <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/60 p-8 text-center text-sm text-gray-500">
          {isZh ? '暂无输入变量' : 'No inputs yet'}
        </div>
      </section>
    )
  }
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
              ? '这些变量来自 Dify Flow「开始运行」节点的 user_input_form，预设默认值会在调用 Dify 时一并传入。'
              : 'Variables come from Dify Flow start node user_input_form. Preset defaults will be sent when invoking Dify.'}
          </p>
        </div>
        {difyAppName && <span className="text-[11px] text-gray-400 font-mono">{difyAppName}</span>}
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
          const isNumber = type === 'number' || type.includes('number') || type === 'number-input'
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
              {item?.hint && <p className="text-[11px] text-gray-400">{item.hint}</p>}
            </div>
          )
        })}
      </div>
    </section>
  )
}

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

const Banner = ({ type, message }) => {
  if (!message) return null
  const isOk = type === 'success'
  return (
    <div
      className={`px-5 py-3 text-sm flex items-start gap-2 rounded-lg ${
        isOk ? 'bg-emerald-50 text-emerald-800 border border-emerald-100' : 'bg-rose-50 text-rose-800 border border-rose-100'
      }`}
    >
      <div
        className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
          isOk ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'
        }`}
      >
        {isOk ? <CheckIcon className="w-3.5 h-3.5" /> : <AlertIcon className="w-3.5 h-3.5" />}
      </div>
      <div className="flex-1 break-words">{message}</div>
    </div>
  )
}

const SiliconWorkerDifyConfig = () => {
  const navigate = useNavigate()
  const { id } = useParams()
  const { isZh } = useLanguage()
  const [selectedChannel, setSelectedChannel] = useState('dify')

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState(null)
  const [banner, setBanner] = useState(null) // { type, message }

  const [name, setName] = useState('')
  const [roleTitle, setRoleTitle] = useState('')
  const [description, setDescription] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')

  const [difyUrl, setDifyUrl] = useState('')
  const [difyApiKey, setDifyApiKey] = useState('')
  const [difyAppType, setDifyAppType] = useState('chatflow')
  const [showKey, setShowKey] = useState(false)
  const [difyMetadata, setDifyMetadata] = useState(null)
  const [presetInputs, setPresetInputs] = useState({})

  const testTimerRef = useRef(null)
  const bannerTimerRef = useRef(null)

  const activeChannel = useMemo(
    () => CHANNELS.find((c) => c.key === selectedChannel) || CHANNELS[0],
    [selectedChannel],
  )
  const isDify = selectedChannel === 'dify'

  useEffect(() => {
    if (!id) return
    let cancel = false
    ;(async () => {
      setLoading(true)
      try {
        const res = await axios.get(`${API_BASE}/ai-employees/${id}`)
        if (cancel) return
        const d = res.data || {}
        setName(d.name || '')
        setRoleTitle(d.role_title || '')
        setDescription(d.description || '')
        setAvatarUrl(d.avatar_url || '')

        const st = d.source_type === 'native' ? 'dify' : d.source_type || 'dify'
        const channel = CHANNELS.find((c) => c.key === st) ? st : 'dify'
        setSelectedChannel(channel)

        setDifyUrl(d.dify_url || '')
        setDifyApiKey(d.dify_api_key || '')
        setDifyAppType(d.dify_app_type || 'chatflow')
        setDifyMetadata(d.dify_metadata || null)
        setPresetInputs(d.dify_metadata?.preset_inputs || {})
      } catch (e) {
        setBanner({ type: 'error', message: isZh ? '加载员工信息失败' : 'Failed to load worker' })
      } finally {
        if (!cancel) setLoading(false)
      }
    })()
    return () => {
      cancel = true
      if (testTimerRef.current) clearTimeout(testTimerRef.current)
      if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  useEffect(() => {
    if (banner) {
      if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current)
      bannerTimerRef.current = setTimeout(() => setBanner(null), 4000)
    }
  }, [banner])

  const inputsSchema = useMemo(() => {
    if (testResult?.ok && testResult.inputsSchema) return testResult.inputsSchema
    return difyMetadata?.inputs_schema || difyMetadata?.user_input_form || null
  }, [testResult, difyMetadata])

  const difyAppName = useMemo(() => {
    if (testResult?.ok && testResult.appName) return testResult.appName
    return difyMetadata?.app_name || ''
  }, [testResult, difyMetadata])

  const handleTestConnection = async () => {
    setTestResult(null)
    if (!isDify) return
    if (!difyUrl.trim() || !difyApiKey.trim()) {
      setBanner({ type: 'error', message: isZh ? '请先填写 Dify 服务地址和 API Key' : 'Please enter Dify URL and API Key first' })
      return
    }
    setTesting(true)
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
      setTestResult(payload)
    } catch (err) {
      const msg =
        (err?.response?.data?.detail) ||
        (err?.response?.data?.message) ||
        err?.message ||
        (isZh ? '测试失败，请检查连接' : 'Test failed')
      setTestResult({ ok: false, message: msg, appName: '', appType: '', latencyMs: null, inputsSchema: null })
    } finally {
      setTesting(false)
      if (testTimerRef.current) clearTimeout(testTimerRef.current)
      testTimerRef.current = setTimeout(() => setTestResult(null), 15000)
    }
  }

  const handleSave = async () => {
    if (!isDify) {
      setBanner({ type: 'error', message: isZh ? '该渠道暂未开放接入' : 'This channel is not available yet' })
      return
    }
    if (!name.trim()) {
      setBanner({ type: 'error', message: isZh ? '请填写员工名称' : 'Name is required' })
      return
    }
    setSaving(true)
    try {
      const updates = {
        name: name.trim(),
        role_title: roleTitle.trim(),
        description: description.trim(),
        avatar_url: avatarUrl.trim(),
        dify_url: difyUrl.trim(),
        dify_api_key: difyApiKey.trim(),
        dify_app_type: difyAppType,
        preset_inputs: Object.keys(presetInputs || {}).length ? presetInputs : undefined,
      }
      await axios.put(`${API_BASE}/ai-employees/${id}/dify`, updates)
      setBanner({ type: 'success', message: isZh ? '保存成功，已刷新输入变量定义' : 'Saved. Inputs definition refreshed if needed.' })
      setTestResult(null)
      if (testTimerRef.current) clearTimeout(testTimerRef.current)
      const refetch = await axios.get(`${API_BASE}/ai-employees/${id}`)
      setDifyMetadata(refetch.data?.dify_metadata || null)
      setPresetInputs(refetch.data?.dify_metadata?.preset_inputs || {})
    } catch (err) {
      const msg =
        (err?.response?.data?.detail) ||
        (Array.isArray(err?.response?.data?.detail)
          ? err.response.data.detail.map((d) => d?.msg || '').filter(Boolean).join('；')
          : '') ||
        err?.message ||
        (isZh ? '保存失败，请重试' : 'Failed to save')
      setBanner({ type: 'error', message: msg })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-screen bg-[#f7f8fc]">
        <Sidebar />
        <div className="flex-1 flex items-center justify-center text-gray-500">
          <div className="flex items-center gap-2">
            <span className="w-4 h-4 border-2 border-[#6266EA] border-t-transparent rounded-full animate-spin" />
            <span>{isZh ? '加载中...' : 'Loading...'}</span>
          </div>
        </div>
      </div>
    )
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
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`w-10 h-10 rounded-xl bg-gradient-to-br ${activeChannel.brandClass} flex items-center justify-center text-white flex-shrink-0`}
                >
                  <activeChannel.logo className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-2xl font-bold text-gray-900 truncate">{name || (isZh ? '未命名数字员工' : 'Unnamed worker')}</h1>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-gray-900 text-white text-[10px] font-medium">
                      <activeChannel.logo className="w-3 h-3" />
                      <span>{activeChannel.name}</span>
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 mt-1 truncate">
                    {difyAppName
                      ? `${activeChannel.name} ${isZh ? '应用' : 'App'} · ${difyAppName}`
                      : isZh
                      ? `${activeChannel.name} 数字员工配置`
                      : `${activeChannel.name} worker configuration`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => navigate('/silicon-workmate')}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
                >
                  {isZh ? '取消' : 'Cancel'}
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || !isDify}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-[#6266EA] hover:bg-[#5558d4] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                >
                  {saving ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>{isZh ? '保存中...' : 'Saving...'}</span>
                    </>
                  ) : isDify ? (
                    <span>{isZh ? '保存修改' : 'Save changes'}</span>
                  ) : (
                    <span>{isZh ? '暂不可用' : 'Unavailable'}</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="max-w-5xl mx-auto px-8 py-8 space-y-6">
            {banner && <Banner type={banner.type} message={banner.message} />}

            <section className="bg-white rounded-2xl border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <div className="text-sm font-semibold text-gray-900">
                  {isZh ? '接入渠道' : 'Provider'}
                </div>
                <span className="text-xs text-gray-400">
                  {isZh ? '当前支持 Dify；其他渠道接入开发中' : 'Dify supported; other channels coming soon.'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
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
              <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                <div className="text-sm font-semibold text-gray-900">
                  {isZh ? '基础信息' : 'Basic Info'}
                </div>
                <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-gray-50 text-gray-600 text-[11px] font-medium border border-gray-200">
                  <SparkIcon className="w-3 h-3 mr-1" />
                  {activeChannel.name} · {activeChannel.description}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {isZh ? '员工名称' : 'Worker name'}
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6266EA]/30 focus:border-[#6266EA]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {isZh ? '职位/角色' : 'Role / Title'}
                  </label>
                  <input
                    type="text"
                    value={roleTitle}
                    onChange={(e) => setRoleTitle(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6266EA]/30 focus:border-[#6266EA]"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {isZh ? '头像 URL' : 'Avatar URL'}
                  </label>
                  <input
                    type="text"
                    value={avatarUrl}
                    onChange={(e) => setAvatarUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6266EA]/30 focus:border-[#6266EA]"
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
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6266EA]/30 focus:border-[#6266EA] resize-y"
                />
              </div>
            </section>

            {isDify ? (
              <DifyConfigSection
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
                isZh={isZh}
              />
            ) : (
              <UnsupportedChannelPlaceholder channel={activeChannel} isZh={isZh} />
            )}

            {isDify && (
              <InputsSection
                inputsSchema={inputsSchema}
                difyAppName={difyAppName}
                presetInputs={presetInputs}
                onChangePreset={setPresetInputs}
                isZh={isZh}
              />
            )}
          </div>
        </main>
      </div>
    </div>
  )
}

export default SiliconWorkerDifyConfig
