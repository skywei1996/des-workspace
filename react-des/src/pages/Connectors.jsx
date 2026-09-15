import React, { useEffect, useMemo, useState } from 'react'
import Sidebar from '../components/Sidebar'
import { buildApiUrl } from '../config/api'

const CONNECTOR_STORAGE_KEY = 'des-connector-state'

const CONNECTORS = [
  {
    id: 'feishu',
    name: '飞书',
    category: '协同办公',
    accent: '#3370ff',
    initials: '飞',
    description: '连接飞书通讯录、日历、文档与审批，让数字员工可以读取协作上下文并触发工作流。',
    capabilities: ['通讯录同步', '日历读取', '文档协作'],
    enterpriseConfig: '企业应用 / Tunnel 服务',
    personalScope: '我的日历、文档和消息身份',
    agentName: 'office_agent',
    serviceName: 'feishu-workspace',
    localAddress: 'http://feishu-mcp.internal:9000/mcp',
    recommendedMcpServiceId: 'feishu-workspace',
    defaultConnectionMethod: 'sdk',
  },
  {
    id: 'dingtalk',
    name: '钉钉',
    category: '组织协作',
    accent: '#1683ff',
    initials: '钉',
    description: '接入钉钉组织、消息、待办与审批能力，用于企业内部通知、流程推进和任务分发。',
    capabilities: ['组织架构', '消息通知', '审批流'],
    enterpriseConfig: '企业应用 / 组织权限',
    personalScope: '我的待办、日程和消息身份',
    agentName: 'office_agent',
    serviceName: 'dingtalk-workflow',
    localAddress: 'http://dingtalk-mcp.internal:9000/mcp',
    recommendedMcpServiceId: 'dingtalk-workflow',
    defaultConnectionMethod: 'sdk',
  },
]

const MCP_SERVICES = [
  {
    id: 'qq-mailbox',
    name: 'qq-mailbox',
    displayName: 'QQ 邮箱服务',
    protocol: 'imap',
    agentName: 'mail_agent',
    endpoint: 'imap.qq.com:993',
    status: 'offline',
    toolCount: 4,
    updatedAt: '待连接',
  },
  {
    id: 'feishu-workspace',
    name: 'feishu-workspace',
    displayName: '飞书协同服务',
    protocol: 'mcp',
    agentName: 'office_agent',
    endpoint: 'http://feishu-mcp.internal:9000/mcp',
    status: 'online',
    toolCount: 12,
    updatedAt: '今天 10:24',
  },
  {
    id: 'dingtalk-workflow',
    name: 'dingtalk-workflow',
    displayName: '钉钉流程服务',
    protocol: 'mcp',
    agentName: 'office_agent',
    endpoint: 'http://dingtalk-mcp.internal:9000/mcp',
    status: 'online',
    toolCount: 9,
    updatedAt: '今天 09:48',
  },
  {
    id: 'foxmail-mailbox',
    name: 'foxmail-mailbox',
    displayName: 'Foxmail 邮箱服务',
    protocol: 'mcp',
    agentName: 'mail_agent',
    endpoint: 'http://mail-mcp.internal:9000/mcp',
    status: 'warning',
    toolCount: 5,
    updatedAt: '昨天 18:12',
  },
  {
    id: 'gmail-mailbox',
    name: 'gmail-mailbox',
    displayName: 'Gmail 邮箱服务',
    protocol: 'oauth',
    agentName: 'mail_agent',
    endpoint: 'https://gmail.googleapis.com',
    status: 'online',
    toolCount: 6,
    updatedAt: '今天 11:02',
  },
]

const CONNECTION_METHODS = [
  { id: 'sdk', name: 'SDK', description: '使用厂商 SDK 接入，适合飞书、钉钉等官方能力较完整的平台。' },
  { id: 'mcp', name: 'MCP', description: '复用已接入的 MCP 服务，适合让数字员工直接调用工具能力。' },
  { id: 'rest', name: 'RESTful API', description: '通过 HTTP API 接入，适合已有开放接口或内部系统。' },
]

const ENTERPRISE_PERMISSIONS = [
  { id: 'contacts', label: '通讯录' },
  { id: 'calendar', label: '日历' },
  { id: 'documents', label: '文档' },
  { id: 'messages', label: '消息' },
  { id: 'approvals', label: '审批' },
  { id: 'logs', label: '日志' },
]

const DIGITAL_EMPLOYEES = [
  { id: 'office_assistant', name: '办公助理' },
  { id: 'hr_assistant', name: '人事助理' },
  { id: 'ops_assistant', name: '运营助理' },
  { id: 'data_assistant', name: '数据助理' },
]

const CATEGORIES = ['全部', '协同办公', '组织协作']

const AUTH_CONNECTORS = {
  qqmail: {
    name: 'QQ邮箱',
    accent: '#12b7f5',
    initials: 'Q',
    qrHint: '请使用 QQ 邮箱授权码完成连接',
    seed: 'qqmail-ai-workmate-mail-auth',
  },
  feishu: {
    name: '飞书',
    accent: '#3370ff',
    initials: '飞',
    qrHint: '请使用飞书移动端扫码确认授权',
    seed: 'feishu-ai-workmate-oauth',
  },
  dingtalk: {
    name: '钉钉',
    accent: '#1683ff',
    initials: '钉',
    qrHint: '请使用钉钉移动端扫码确认授权',
    seed: 'dingtalk-ai-workmate-sns',
  },
  foxmail: {
    name: 'Foxmail',
    accent: '#ff8a00',
    initials: 'Fx',
    qrHint: '请使用企业邮箱或 Foxmail 授权入口扫码确认',
    seed: 'foxmail-ai-workmate-mail-auth',
  },
  gmail: {
    name: 'Gmail',
    accent: '#ea4335',
    initials: 'G',
    qrHint: '请使用 Google 账号扫码确认授权',
    seed: 'gmail-ai-workmate-oauth',
  },
}

const QR_SIZE = 17

const shouldFillQrCell = (row, col, seed) => {
  const inTopLeftFinder = row < 5 && col < 5
  const inTopRightFinder = row < 5 && col >= QR_SIZE - 5
  const inBottomLeftFinder = row >= QR_SIZE - 5 && col < 5

  if (inTopLeftFinder || inTopRightFinder || inBottomLeftFinder) {
    const localRow = row < 5 ? row : row - (QR_SIZE - 5)
    const localCol = col < 5 ? col : col - (QR_SIZE - 5)
    return localRow === 0 || localRow === 4 || localCol === 0 || localCol === 4 || (localRow === 2 && localCol === 2)
  }

  const charCode = seed.charCodeAt((row * 3 + col * 5) % seed.length)
  return ((row * 7 + col * 11 + charCode) % 5) < 2
}

const ProviderQrCode = ({ connector, onClick }) => (
  <button type="button" onClick={onClick} className="rounded-[24px] border border-gray-200 bg-white p-5 text-left shadow-sm transition hover:shadow-md" aria-label={`扫描${connector.name}二维码授权`}>
    <div className="mx-auto grid h-[232px] w-[232px] grid-cols-[repeat(17,minmax(0,1fr))] gap-1 rounded-2xl bg-white p-4 shadow-[inset_0_0_0_1px_rgba(229,231,235,1)]">
      {Array.from({ length: QR_SIZE * QR_SIZE }).map((_, index) => {
        const row = Math.floor(index / QR_SIZE)
        const col = index % QR_SIZE
        const filled = shouldFillQrCell(row, col, connector.seed)

        return <div key={`${row}-${col}`} className={`rounded-[2px] ${filled ? 'bg-gray-950' : 'bg-transparent'}`} />
      })}
    </div>
    <div className="mx-auto -mt-[138px] mb-[82px] flex h-11 w-11 items-center justify-center rounded-xl border-4 border-white text-sm font-bold text-white shadow-sm" style={{ backgroundColor: connector.accent }}>{connector.initials}</div>
  </button>
)

const DEFAULT_CONNECTOR_STATE = {
  enterpriseConnectedIds: ['feishu'],
  personalAuthorizedIds: [],
  enabledConnectorIds: ['feishu', 'dingtalk'],
  adminAuthorizedIds: ['feishu'],
  configs: {
    qqmail: { connectionMethod: 'rest', mcpServiceId: 'qq-mailbox', agentName: 'mail_agent' },
    feishu: { connectionMethod: 'sdk', sdkPackage: '@larksuiteoapi/node-sdk', appId: '', appSecret: '', mcpServiceId: 'feishu-workspace', agentName: 'office_agent', permissions: ['contacts', 'calendar', 'documents'], employeeIds: ['office_assistant'] },
    foxmail: { connectionMethod: 'rest', apiBaseUrl: 'https://mail.example.com/api', authHeaderName: 'Authorization', authHeaderValue: '', mcpServiceId: 'foxmail-mailbox', agentName: 'mail_agent' },
    gmail: { connectionMethod: 'rest', apiBaseUrl: 'https://gmail.googleapis.com', authHeaderName: 'Authorization', authHeaderValue: '', mcpServiceId: 'gmail-mailbox', agentName: 'mail_agent' },
  },
}

const normalizeConnectionMethod = (method, fallback = 'sdk') => {
  if (['sdk', 'mcp', 'rest'].includes(method)) return method
  if (method === 'oauth') return 'sdk'
  if (method === 'mail') return 'rest'
  return fallback
}

const normalizeConnectorConfigs = (configs = {}) => {
  if (!configs || typeof configs !== 'object' || Array.isArray(configs)) return {}

  return Object.fromEntries(Object.entries(configs).map(([connectorId, config]) => {
    if (!config || typeof config !== 'object' || Array.isArray(config)) return [connectorId, config]
    const connector = CONNECTORS.find((item) => item.id === connectorId)
    const fallback = normalizeConnectionMethod(connector?.defaultConnectionMethod, 'sdk')
    return [connectorId, { ...config, connectionMethod: normalizeConnectionMethod(config.connectionMethod, fallback) }]
  }))
}

const loadConnectorState = () => {
  if (typeof window === 'undefined') return DEFAULT_CONNECTOR_STATE

  try {
    const raw = window.localStorage.getItem(CONNECTOR_STORAGE_KEY)
    if (!raw) return DEFAULT_CONNECTOR_STATE

    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return DEFAULT_CONNECTOR_STATE

    return {
      enterpriseConnectedIds: Array.isArray(parsed.enterpriseConnectedIds) ? parsed.enterpriseConnectedIds : [],
      personalAuthorizedIds: Array.isArray(parsed.personalAuthorizedIds) ? parsed.personalAuthorizedIds : [],
      enabledConnectorIds: Array.isArray(parsed.enabledConnectorIds) ? parsed.enabledConnectorIds : [],
      adminAuthorizedIds: Array.isArray(parsed.adminAuthorizedIds) ? parsed.adminAuthorizedIds : [],
      configs: normalizeConnectorConfigs(parsed.configs),
    }
  } catch (error) {
    console.error('Failed to load connector status:', error)
    return DEFAULT_CONNECTOR_STATE
  }
}

function Connectors() {
  const [connectorState, setConnectorState] = useState(() => loadConnectorState())
  const [activeCategory, setActiveCategory] = useState('全部')
  const [query, setQuery] = useState('')
  const [enterpriseDrawerId, setEnterpriseDrawerId] = useState(null)
  const [personalAuthId, setPersonalAuthId] = useState(null)
  const [enterpriseSettingsPage, setEnterpriseSettingsPage] = useState('permissions')
  const [mailForm, setMailForm] = useState({ email: '', authCode: '' })
  const [mailMessage, setMailMessage] = useState('')
  const [isMailConnecting, setIsMailConnecting] = useState(false)
  const [connectionResults, setConnectionResults] = useState({})
  const [connectionResponseFields, setConnectionResponseFields] = useState({})

  const enterpriseConnectedIds = connectorState.enterpriseConnectedIds
  const personalAuthorizedIds = connectorState.personalAuthorizedIds
  const enabledConnectorIds = connectorState.enabledConnectorIds || []
  const adminAuthorizedIds = connectorState.adminAuthorizedIds || []
  const visibleConnectorIds = CONNECTORS.map((connector) => connector.id)
  const enterpriseConnectedCount = enterpriseConnectedIds.filter((id) => visibleConnectorIds.includes(id)).length
  const personalAuthorizedCount = personalAuthorizedIds.filter((id) => visibleConnectorIds.includes(id) && enterpriseConnectedIds.includes(id)).length
  const enterpriseDrawerConnector = CONNECTORS.find((connector) => connector.id === enterpriseDrawerId)
  const personalAuthConnector = personalAuthId ? AUTH_CONNECTORS[personalAuthId] : null
  const enterpriseDrawerConfig = enterpriseDrawerConnector
    ? {
        mcpServiceId: enterpriseDrawerConnector.recommendedMcpServiceId,
        connectionMethod: ['sdk', 'mcp', 'rest'].includes(enterpriseDrawerConnector.defaultConnectionMethod) ? enterpriseDrawerConnector.defaultConnectionMethod : 'sdk',
        agentName: enterpriseDrawerConnector.agentName,
        ...(connectorState.configs?.[enterpriseDrawerConnector.id] || {}),
      }
    : null

  const filteredConnectors = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    return CONNECTORS.filter((connector) => {
      const matchesCategory = activeCategory === '全部' || connector.category === activeCategory
      const searchable = [connector.name, connector.category, connector.description, ...connector.capabilities]
        .join(' ')
        .toLowerCase()
      const matchesQuery = !normalizedQuery || searchable.includes(normalizedQuery)

      return matchesCategory && matchesQuery
    })
  }, [activeCategory, query])

  useEffect(() => {
    let cancelled = false

    const loadQQMailStatus = async () => {
      try {
        const response = await fetch(buildApiUrl('/connectors/email/qq-mail'))
        const payload = await response.json().catch(() => null)
        if (!response.ok || !payload || cancelled) return

        if (payload.connected) {
          setConnectorState((current) => ({
            ...current,
            enterpriseConnectedIds: Array.from(new Set([...(current.enterpriseConnectedIds || []), 'qqmail'])),
            personalAuthorizedIds: Array.from(new Set([...(current.personalAuthorizedIds || []), 'qqmail'])),
            configs: {
              ...(current.configs || {}),
              qqmail: {
                ...(current.configs?.qqmail || {}),
                connectionMethod: 'mail',
                connectedEmail: payload.email,
              },
            },
          }))
        }
      } catch (error) {
        console.error('Failed to load QQ mail connector status:', error)
      }
    }

    loadQQMailStatus()
    return () => {
      cancelled = true
    }
  }, [])

  const updateConnectorState = (nextState) => {
    setConnectorState(nextState)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(CONNECTOR_STORAGE_KEY, JSON.stringify(nextState))
    }
  }

  const setEnterpriseConnection = (connectorId, shouldConnect) => {
    const nextEnterpriseIds = shouldConnect
      ? Array.from(new Set([...enterpriseConnectedIds, connectorId]))
      : enterpriseConnectedIds.filter((id) => id !== connectorId)
    const nextPersonalIds = shouldConnect
      ? personalAuthorizedIds
      : personalAuthorizedIds.filter((id) => id !== connectorId)

    updateConnectorState({
      ...connectorState,
      enterpriseConnectedIds: nextEnterpriseIds,
      personalAuthorizedIds: nextPersonalIds,
    })

    if (!shouldConnect) {
      setConnectionResults((current) => {
        const nextResults = { ...current }
        delete nextResults[connectorId]
        return nextResults
      })
    }
  }

  const toggleConnectorEnabled = (connectorId) => {
    const enabled = enabledConnectorIds.includes(connectorId)
    updateConnectorState({
      ...connectorState,
      enabledConnectorIds: enabled
        ? enabledConnectorIds.filter((id) => id !== connectorId)
        : Array.from(new Set([...enabledConnectorIds, connectorId])),
      enterpriseConnectedIds: enabled ? enterpriseConnectedIds.filter((id) => id !== connectorId) : enterpriseConnectedIds,
      personalAuthorizedIds: enabled ? personalAuthorizedIds.filter((id) => id !== connectorId) : personalAuthorizedIds,
      adminAuthorizedIds: enabled ? adminAuthorizedIds.filter((id) => id !== connectorId) : adminAuthorizedIds,
    })
  }

  const authorizeAdmin = (connectorId) => {
    updateConnectorState({
      ...connectorState,
      adminAuthorizedIds: Array.from(new Set([...adminAuthorizedIds, connectorId])),
      enterpriseConnectedIds: Array.from(new Set([...enterpriseConnectedIds, connectorId])),
    })
  }

  const saveEnterpriseBinding = (connectorId) => {
    const connector = CONNECTORS.find((item) => item.id === connectorId)
    const existingConfig = connectorState.configs?.[connectorId]
    const mcpServiceId = existingConfig?.mcpServiceId || connector?.recommendedMcpServiceId || MCP_SERVICES[0]?.id
    const service = MCP_SERVICES.find((item) => item.id === mcpServiceId)

    updateConnectorState({
      ...connectorState,
      enterpriseConnectedIds: Array.from(new Set([...enterpriseConnectedIds, connectorId])),
      personalAuthorizedIds,
      configs: {
        ...(connectorState.configs || {}),
        [connectorId]: {
          ...(existingConfig || {}),
          connectionMethod: existingConfig?.connectionMethod || (['sdk', 'mcp', 'rest'].includes(connector?.defaultConnectionMethod) ? connector.defaultConnectionMethod : 'sdk'),
          mcpServiceId,
          agentName: existingConfig?.agentName || service?.agentName || connector?.agentName,
        },
      },
    })

    setConnectionResults((current) => ({
      ...current,
      [connectorId]: {
        ok: true,
        message: `${connector?.name || '连接器'} 连接成功，配置已保存。`,
      },
    }))
  }

  const togglePersonalAuthorization = (connectorId) => {
    if (!enterpriseConnectedIds.includes(connectorId)) return

    const nextPersonalIds = personalAuthorizedIds.includes(connectorId)
      ? personalAuthorizedIds.filter((id) => id !== connectorId)
      : [...personalAuthorizedIds, connectorId]

    updateConnectorState({
      ...connectorState,
      enterpriseConnectedIds,
      personalAuthorizedIds: nextPersonalIds,
    })
  }

  const completePersonalAuthorization = (connectorId) => {
    updateConnectorState({
      ...connectorState,
      enterpriseConnectedIds,
      personalAuthorizedIds: Array.from(new Set([...personalAuthorizedIds, connectorId])),
    })
    setPersonalAuthId(null)
  }

  const handleConnectionClick = (connector) => {
    if (connector.id === 'qqmail') {
      if (enterpriseConnectedIds.includes(connector.id)) {
        setEnterpriseDrawerId(connector.id)
        return
      }

      handleQQMailPackagedAuthStart()
      return
    }

    if (connector.id === 'gmail') {
      window.location.href = `/connectors/oauth/${connector.id}`
      return
    }

    setEnterpriseSettingsPage('permissions')
    setEnterpriseDrawerId(connector.id)
  }

  const handleQQMailPackagedAuthStart = async () => {
    setIsMailConnecting(true)
    setMailMessage('')

    try {
      const response = await fetch(buildApiUrl('/connectors/email/qq-mail/auth/start'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ returnUrl: '/connectors' }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(payload?.detail || '无法发起 QQ 邮箱授权。')
      }
      window.location.href = payload.authUrl
    } catch (error) {
      const fallbackSessionId = `local-${Date.now()}`
      window.location.href = `/connectors/qq-mail/authorize?sessionId=${fallbackSessionId}`
    } finally {
      setIsMailConnecting(false)
    }
  }

  const handleQQMailConnect = async () => {
    setIsMailConnecting(true)
    setMailMessage('')

    try {
      const response = await fetch(buildApiUrl('/connectors/email/qq-mail/connect'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: mailForm.email,
          authCode: mailForm.authCode,
          imapHost: 'imap.qq.com',
          imapPort: 993,
        }),
      })
      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(payload?.detail || 'QQ 邮箱连接失败。')
      }

      updateConnectorState({
        ...connectorState,
        enterpriseConnectedIds: Array.from(new Set([...enterpriseConnectedIds, 'qqmail'])),
        personalAuthorizedIds: Array.from(new Set([...personalAuthorizedIds, 'qqmail'])),
        configs: {
          ...(connectorState.configs || {}),
          qqmail: {
            ...(connectorState.configs?.qqmail || {}),
            connectionMethod: 'mail',
            connectedEmail: payload.email,
          },
        },
      })
      setConnectionResults((current) => ({
        ...current,
        qqmail: {
          ok: true,
          message: 'QQ 邮箱连接成功。',
        },
      }))
      setConnectionResponseFields((current) => ({
        ...current,
        qqmail: {
          email: payload.email || mailForm.email,
          authCode: mailForm.authCode,
          inboxFolder: 'INBOX',
        },
      }))
      setMailForm({ email: '', authCode: '' })
    } catch (error) {
      const message = error.message || 'QQ 邮箱连接失败。'
      setMailMessage(message)
      setConnectionResults((current) => ({
        ...current,
        qqmail: {
          ok: false,
          message,
        },
      }))
    } finally {
      setIsMailConnecting(false)
    }
  }

  const updateEnterpriseConfig = (field, value) => {
    if (!enterpriseDrawerConnector) return

    updateConnectorState({
      ...connectorState,
      configs: {
        ...(connectorState.configs || {}),
        [enterpriseDrawerConnector.id]: {
          ...(connectorState.configs?.[enterpriseDrawerConnector.id] || {}),
          [field]: value,
        },
      },
    })
  }

  const toggleConfigListValue = (field, value) => {
    const currentValues = Array.isArray(enterpriseDrawerConfig?.[field]) ? enterpriseDrawerConfig[field] : []
    const nextValues = currentValues.includes(value)
      ? currentValues.filter((item) => item !== value)
      : [...currentValues, value]
    updateEnterpriseConfig(field, nextValues)
  }

  return (
    <div className="flex min-h-screen bg-[#f6f7fb] text-gray-900">
      <Sidebar />

      <div className="flex-1 overflow-hidden">
        <div className="flex h-screen flex-col">
          <header className="border-b border-gray-200 bg-white px-8 py-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-semibold text-gray-900">连接器</h1>
                <p className="mt-1 text-sm text-gray-500">连接工具和服务，扩展数字员工可调用的企业系统能力。</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <div className="rounded-2xl border border-gray-200 bg-[#fafafa] px-5 py-3 text-sm text-gray-600">
                  企业已接入 <span className="font-semibold text-gray-950">{enterpriseConnectedCount}</span> / {CONNECTORS.length}
                </div>
                <div className="rounded-2xl border border-gray-200 bg-[#fafafa] px-5 py-3 text-sm text-gray-600">
                  我的授权 <span className="font-semibold text-gray-950">{personalAuthorizedCount}</span> / {enterpriseConnectedCount || 0}
                </div>
              </div>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto px-10 py-6">
            <section className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((category) => (
                  <button
                    key={category}
                    type="button"
                    onClick={() => setActiveCategory(category)}
                    className={`rounded-full border px-4 py-2 text-sm font-medium transition ${activeCategory === category ? 'border-gray-950 bg-gray-950 text-white' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:text-gray-950'}`}
                  >
                    {category}
                  </button>
                ))}
              </div>

              <label className="relative min-w-[260px] flex-1 sm:max-w-[360px]">
                <span className="sr-only">搜索连接器</span>
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className="w-full rounded-full border border-gray-200 bg-white px-5 py-2.5 text-sm outline-none transition placeholder:text-gray-400 focus:border-gray-400"
                  placeholder="搜索连接器"
                />
              </label>
            </section>

            <section className="grid gap-4 lg:grid-cols-3">
              {filteredConnectors.map((connector) => {
                const enterpriseConnected = enterpriseConnectedIds.includes(connector.id)
                const personalAuthorized = personalAuthorizedIds.includes(connector.id)
                const connectorEnabled = enabledConnectorIds.includes(connector.id)
                const adminAuthorized = adminAuthorizedIds.includes(connector.id)

                return (
                  <article key={connector.id} className={`flex h-full flex-col rounded-[22px] border border-gray-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${connectorEnabled ? '' : 'opacity-70'}`}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div
                          className="flex h-11 w-11 items-center justify-center rounded-2xl text-sm font-bold text-white shadow-sm"
                          style={{ backgroundColor: connector.accent }}
                        >
                          {connector.initials}
                        </div>
                        <div>
                          <h2 className="text-base font-semibold text-gray-950">{connector.name}</h2>
                          <div className="mt-1 text-xs text-gray-500">{connector.category}</div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleConnectorEnabled(connector.id)}
                        className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition ${connectorEnabled ? 'bg-[#111827]' : 'bg-gray-200'}`}
                        aria-pressed={connectorEnabled}
                        title={connectorEnabled ? '已启用' : '已禁用'}
                      >
                        <span className={`inline-block h-5 w-5 rounded-full bg-white transition ${connectorEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                      </button>
                    </div>

                    <p className="mt-4 min-h-[66px] text-sm leading-6 text-gray-500">{connector.description}</p>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {connector.capabilities.map((capability) => (
                        <span key={capability} className="rounded-full bg-[#f5f6f8] px-3 py-1 text-xs font-medium text-gray-600">
                          {capability}
                        </span>
                      ))}
                    </div>
                    {connectionResults[connector.id] && (
                      <div className={`mt-4 rounded-2xl border px-3 py-2 text-sm ${connectionResults[connector.id].ok ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-800'}`}>
                        <div className="font-medium">{connectionResults[connector.id].ok ? '连接成功' : '连接失败'}</div>
                        <div className="mt-1 text-xs opacity-90 break-words">{connectionResults[connector.id].message}</div>
                      </div>
                    )}

                    <div className={`mt-auto pt-5 ${connectorEnabled && adminAuthorized ? 'grid grid-cols-2 gap-2' : 'grid gap-2'}`}>
                      {connectorEnabled && !adminAuthorized && (
                        <button
                          type="button"
                          onClick={() => { window.location.href = `/connectors/admin-authorize/${connector.id}` }}
                          className="min-h-[44px] w-full rounded-xl border border-[#d7dbe2] bg-[#eef0f3] px-3 py-2.5 text-sm font-semibold text-[#2f343d] transition hover:bg-[#e4e7ec]"
                        >
                          管理员授权
                        </button>
                      )}
                      {connectorEnabled && adminAuthorized && (
                        <button
                          type="button"
                          onClick={() => handleConnectionClick(connector)}
                          className="min-h-[44px] w-full rounded-xl border border-[#d7dbe2] bg-[#eef0f3] px-3 py-2.5 text-sm font-semibold text-[#2f343d] transition hover:bg-[#e4e7ec]"
                        >
                          管理配置
                        </button>
                      )}
                      {connectorEnabled && adminAuthorized && (
                        <button
                          type="button"
                          onClick={() => (personalAuthorized ? togglePersonalAuthorization(connector.id) : setPersonalAuthId(connector.id))}
                          className="min-h-[44px] w-full rounded-xl border border-[#d7dbe2] bg-white px-3 py-2.5 text-sm font-semibold text-[#2f343d] transition hover:bg-[#f3f4f6]"
                        >
                          {personalAuthorized ? '取消授权' : '授权账号'}
                        </button>
                      )}
                    </div>
                  </article>
                )
              })}
            </section>

            {filteredConnectors.length === 0 && (
              <div className="rounded-[22px] border border-dashed border-gray-200 bg-white px-8 py-16 text-center text-sm text-gray-500">
                没有匹配的连接器
              </div>
            )}
          </main>
        </div>
      </div>

      {enterpriseDrawerConnector && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/30 px-4 backdrop-blur-[1px]">
          <div className="w-full max-w-[520px] rounded-[24px] border border-gray-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs font-semibold text-gray-500">{enterpriseDrawerConnector.id === 'qqmail' ? '邮箱账号授权' : '管理配置'}</div>
                <h2 className="mt-1 text-xl font-semibold text-gray-950">{enterpriseDrawerConnector.id === 'qqmail' ? '授权 QQ 邮箱账号' : `配置 ${enterpriseDrawerConnector.name}`}</h2>
              </div>
              <button
                type="button"
                onClick={() => setEnterpriseDrawerId(null)}
                className="rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
              >
                关闭
              </button>
            </div>
            {connectionResults[enterpriseDrawerConnector.id] && enterpriseDrawerConnector.id === 'qqmail' && (
              <div className="mt-4 rounded-2xl border border-gray-200 bg-[#f8fafc] p-4 text-sm">
                <div className="font-medium text-gray-900">连接结果字段（原型，可编辑）</div>
                <div className="mt-3 space-y-3">
                  {Object.entries(connectionResponseFields.qqmail || { email: mailForm.email || '', authCode: mailForm.authCode || '', inboxFolder: 'INBOX' }).map(([field, value]) => (
                    <label key={field} className="block text-sm text-gray-700">
                      <div className="mb-1.5 flex items-center justify-between gap-3 text-sm font-medium">
                        <span>{field}</span>
                        <span className="text-xs text-gray-400">可编辑</span>
                      </div>
                      <input
                        value={value}
                        onChange={(event) => setConnectionResponseFields((current) => ({
                          ...current,
                          qqmail: {
                            ...(current.qqmail || {}),
                            [field]: event.target.value,
                          },
                        }))}
                        className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 outline-none transition focus:border-gray-400"
                      />
                    </label>
                  ))}
                </div>
              </div>
            )}

            {connectionResults[enterpriseDrawerConnector.id] && (
              <div className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${connectionResults[enterpriseDrawerConnector.id].ok ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-800'}`}>
                <div className="font-medium">{connectionResults[enterpriseDrawerConnector.id].ok ? '连接成功' : '连接失败'}</div>
                <div className="mt-1 text-xs opacity-90 break-words">{connectionResults[enterpriseDrawerConnector.id].message}</div>
              </div>
            )}

            {enterpriseDrawerConnector.id === 'qqmail' ? (
              <div className="mt-6 space-y-4">
                {enterpriseConnectedIds.includes('qqmail') ? (
                  <div className="rounded-2xl border border-gray-100 bg-[#fafbfc] px-4 py-4">
                    <div className="text-sm font-semibold text-gray-950">QQ 邮箱已连接</div>
                    <div className="mt-2 text-sm text-gray-500">{connectorState.configs?.qqmail?.connectedEmail || '已授权账号'}</div>
                  </div>
                ) : (
                <>
                <div className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-[#fafbfc] px-4 py-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#12b7f5] text-sm font-bold text-white">Q</div>
                  <div>
                    <div className="text-sm font-semibold text-gray-950">连接 QQ 邮箱</div>
                    <div className="mt-0.5 text-xs text-gray-500">使用 QQ 邮箱账号授权 WorkMate 读取邮件。</div>
                  </div>
                </div>

                <label className="block text-sm text-gray-700">
                  <div className="mb-1.5 font-medium">QQ 邮箱账号</div>
                  <input
                    value={mailForm.email}
                    onChange={(event) => setMailForm((current) => ({ ...current, email: event.target.value }))}
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 outline-none transition focus:border-gray-400"
                    placeholder="name@qq.com"
                  />
                </label>

                <label className="block text-sm text-gray-700">
                  <div className="mb-1.5 font-medium">授权码</div>
                  <input
                    type="password"
                    value={mailForm.authCode}
                    onChange={(event) => setMailForm((current) => ({ ...current, authCode: event.target.value }))}
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 outline-none transition focus:border-gray-400"
                    placeholder="粘贴 QQ 邮箱生成的授权码"
                  />
                </label>

                <div className="rounded-2xl bg-[#f7f8fa] px-4 py-3 text-xs leading-5 text-gray-500">
                  不知道授权码？打开 QQ 邮箱网页版，在设置里开启 IMAP/SMTP 服务并生成授权码。
                </div>
                </>
                )}
                {mailMessage && <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{mailMessage}</div>}
              </div>
            ) : (
            <>
            {!adminAuthorizedIds.includes(enterpriseDrawerConnector.id) ? (
              <section className="mt-4 rounded-2xl border border-gray-100 bg-[#fafbfc] p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-sm font-semibold text-gray-950">管理员企业授权</div>
                    <p className="mt-1 text-xs leading-5 text-gray-500">启用后由企业管理员登录 {enterpriseDrawerConnector.name} 账号，授权 WorkMate 使用企业能力。</p>
                  </div>
                  <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-500">待授权</span>
                </div>
                <button
                  type="button"
                  onClick={() => { window.location.href = `/connectors/admin-authorize/${enterpriseDrawerConnector.id}` }}
                  className="mt-4 w-full rounded-xl border border-[#d7dbe2] bg-white px-4 py-2.5 text-sm font-semibold text-[#2f343d] transition hover:bg-[#f3f4f6]"
                >
                  使用管理员账号授权
                </button>
              </section>
            ) : (
              <section className="mt-4 rounded-2xl border border-gray-100 bg-[#fafbfc] p-4">
                <div className="flex rounded-xl bg-white p-1 shadow-[inset_0_0_0_1px_rgba(229,231,235,1)]">
                  {[
                    { id: 'permissions', label: '权限管理' },
                    { id: 'employees', label: '授权数字员工' },
                  ].map((page) => (
                    <button
                      key={page.id}
                      type="button"
                      onClick={() => setEnterpriseSettingsPage(page.id)}
                      className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition ${enterpriseSettingsPage === page.id ? 'bg-[#111827] text-white' : 'text-gray-500 hover:text-gray-950'}`}
                    >
                      {page.label}
                    </button>
                  ))}
                </div>

                {enterpriseSettingsPage === 'permissions' && (
                  <div className="mt-4">
                    <div className="text-sm font-semibold text-gray-950">可授权权限</div>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      {ENTERPRISE_PERMISSIONS.map((permission) => (
                        <label key={permission.id} className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700">
                          <input
                            type="checkbox"
                            checked={(enterpriseDrawerConfig.permissions || []).includes(permission.id)}
                            onChange={() => toggleConfigListValue('permissions', permission.id)}
                            className="h-4 w-4 rounded border-gray-300 text-gray-950 focus:ring-gray-950"
                          />
                          <span>{permission.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {enterpriseSettingsPage === 'employees' && (
                  <div className="mt-4">
                    <div className="text-sm font-semibold text-gray-950">授权数字员工</div>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      {DIGITAL_EMPLOYEES.map((employee) => (
                        <label key={employee.id} className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700">
                          <input
                            type="checkbox"
                            checked={(enterpriseDrawerConfig.employeeIds || []).includes(employee.id)}
                            onChange={() => toggleConfigListValue('employeeIds', employee.id)}
                            className="h-4 w-4 rounded border-gray-300 text-gray-950 focus:ring-gray-950"
                          />
                          <span>{employee.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </section>
            )}

            </>
            )}

            <div className="mt-6 flex items-center justify-between gap-3">
              {enterpriseConnectedIds.includes(enterpriseDrawerConnector.id) ? (
                <button
                  type="button"
                  onClick={() => setEnterpriseConnection(enterpriseDrawerConnector.id, false)}
                  className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                >
                  解除绑定
                </button>
              ) : <span />}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setEnterpriseDrawerId(null)}
                  className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (enterpriseDrawerConnector.id === 'qqmail') {
                      if (enterpriseConnectedIds.includes('qqmail')) {
                        setEnterpriseDrawerId(null)
                        return
                      }

                      handleQQMailConnect()
                      return
                    }
                    saveEnterpriseBinding(enterpriseDrawerConnector.id)
                    setEnterpriseDrawerId(null)
                  }}
                  disabled={isMailConnecting}
                  className="rounded-xl border border-[#d7dbe2] bg-[#eef0f3] px-4 py-2.5 text-sm font-semibold text-[#2f343d] transition hover:bg-[#e4e7ec]"
                >
                  {isMailConnecting ? '授权中...' : enterpriseDrawerConnector.id === 'qqmail' ? enterpriseConnectedIds.includes('qqmail') ? '完成' : '完成授权' : '保存配置'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {personalAuthConnector && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/30 px-4 backdrop-blur-[1px]">
          <div className="w-full max-w-[420px] rounded-[28px] border border-gray-200 bg-white p-6 text-center shadow-2xl">
            <div className="flex items-center justify-between gap-4 text-left">
              <div className="flex items-center gap-3 text-sm font-medium text-gray-700">
                <div className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white" style={{ backgroundColor: personalAuthConnector.accent }}>{personalAuthConnector.initials}</div>
                <span>使用 {personalAuthConnector.name} 账号登录</span>
              </div>
              <button
                type="button"
                onClick={() => setPersonalAuthId(null)}
                className="rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
              >
                关闭
              </button>
            </div>

            <h2 className="mt-8 text-2xl font-semibold tracking-tight text-gray-950">扫码授权</h2>
            <p className="mt-2 text-sm text-gray-500">{personalAuthConnector.qrHint}</p>
            <div className="mt-7 flex justify-center">
              <ProviderQrCode connector={personalAuthConnector} onClick={() => completePersonalAuthorization(personalAuthId)} />
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

export default Connectors