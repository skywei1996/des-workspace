import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { useLanguage } from '../i18n'
import { API_BASE } from '../config/api'

const DifyBadgeMini = ({ className = '' }) => (
  <svg className={className} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="2" y="2" width="28" height="28" rx="6" fill="url(#dify-g2)" />
    <path
      d="M10.5 20.5c1.8 0 2.7-1 2.7-2.5 0-1.1-.5-2-1.7-2.4l-1-.33c-.8-.27-1.3-.73-1.3-1.34 0-.66.55-1.18 1.35-1.18.78 0 1.33.44 1.52 1.1h2.18c-.19-1.56-1.38-2.7-3.7-2.7-2.18 0-3.6 1.25-3.6 2.93 0 1.2.54 2.1 1.75 2.53l1 .33c.9.3 1.35.77 1.35 1.4 0 .75-.65 1.27-1.6 1.27-1.13 0-1.8-.6-2-1.5H7.3c.22 1.83 1.57 3 3.2 3Zm12.85-4.8h-4.47v-.97h4.47V14h-4.47v-1.7h-2.3v6.4h2.3v-2.47h4.47v-.97h-4.47v-.66h4.47V15.7Z"
      fill="white"
    />
    <defs>
      <linearGradient id="dify-g2" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
        <stop stopColor="#1A1D29" />
        <stop offset="1" stopColor="#3A3F54" />
      </linearGradient>
    </defs>
  </svg>
)

const SparkIcon = ({ className = 'w-3 h-3' }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M5 3v4M3 5h4M6 17v4M4 19h4M13 3l2.5 6L22 11l-6.5 2L13 19l-2.5-6L4 11l6.5-2L13 3z"
    />
  </svg>
)

const CHANNELS = [
  {
    key: 'dify',
    name: 'Dify',
    supported: true,
    brandClass: 'from-[#1A1D29] to-[#3A3F54]',
    badgeClass: 'bg-slate-900 text-white hover:bg-slate-800',
    avatarRingClass: 'ring-slate-900/10 hover:ring-slate-900/30',
    cardRingClass: 'border-slate-300 ring-1 ring-slate-900/5 hover:ring-slate-900/10',
    Logo: DifyBadgeMini,
  },
  {
    key: 'google-adk',
    name: 'Google ADK',
    supported: false,
    brandClass: 'from-[#4285F4] to-[#34A853]',
    badgeClass: 'bg-blue-600 text-white hover:bg-blue-700',
    avatarRingClass: 'ring-blue-900/10 hover:ring-blue-900/30',
    cardRingClass: 'border-blue-200 ring-1 ring-blue-900/5 hover:ring-blue-900/10',
    Logo: SparkIcon,
  },
]

const getChannelByKey = (key) => {
  if (!key || key === 'native') return null
  return CHANNELS.find((c) => c.key === key) || null
}

const defaultAvatar =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#6266EA"/><stop offset="100%" stop-color="#8C5EFF"/></linearGradient></defs><rect width="48" height="48" rx="10" fill="url(#g)"/><text x="50%" y="55%" text-anchor="middle" fill="white" font-family="system-ui,Segoe UI,sans-serif" font-size="20" font-weight="600">AI</text></svg>`,
  )

const deriveTeam = (roleTitle = '', description = '') => {
  const text = `${roleTitle || ''} ${description || ''}`.trim()
  if (!text) return 'Engineering'
  const lowered = text.toLowerCase()

  if (
    /\bhr\b|人力|人事|招聘|招聘专员|招聘专家|招聘助理|面试官|绩效|薪酬|员工关系|培训|talent|recruit|interview/.test(
      lowered,
    )
  )
    return 'HR'
  if (
    /销售|销冠|客户成功|商务|渠道|线索|商机|销助|销售代表|客户经理|account.?execut|sdr|bdr|lead|deal|sale|客户经营/.test(
      lowered,
    )
  )
    return 'Sales'
  if (
    /设计|设计师|视觉|品牌|ui|ux|graphic|motion|交互|美工|插画|封面|海报|素材|创意/.test(
      lowered,
    )
  )
    return 'Designer'
  if (
    /工程|工程师|开发|开发工程师|前端|后端|全栈|算法|devops|运维|测试|qa|架构|架构师|engineering|engineer|developer|code|coding|程序|程序员|软件|码农/.test(
      lowered,
    )
  )
    return 'Engineering'
  if (
    /市场|营销|运营|增长|增长黑客|社群|用户运营|新媒体|内容营销|内容运营|品牌营销|品牌运营|推广|seo|sem|投放|流量|campaign|marketing|brand|social|growth|文案|策划|公关|pr/.test(
      lowered,
    )
  )
    return 'Marketing'
  return 'Engineering'
}

const normalizeEmployee = (employee) => ({
  id: employee.id,
  name: employee.name || (employee.id ? `数字员工 ${employee.id}` : '未命名员工'),
  role: employee.role_title || '数字员工',
  description: employee.description || employee.persona_prompt || '暂无角色描述。',
  avatar: employee.avatar_url || employee.avatar || defaultAvatar,
  status: employee.status || 'active',
  team: deriveTeam(employee.role_title, employee.description),
  sourceType: employee.source_type || 'native',
  difyUrl: employee.dify_url || '',
  difyApiKey: employee.dify_api_key || '',
  difyAppType: employee.dify_app_type || '',
  difyMetadata:
    employee.dify_metadata && typeof employee.dify_metadata === 'object' ? employee.dify_metadata : null,
})

const GearIcon = ({ className = 'w-3 h-3' }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
    />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
)

const VerifiedIcon = ({ className = 'w-4 h-4' }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 20 20">
    <path
      fillRule="evenodd"
      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
      clipRule="evenodd"
    />
  </svg>
)

const WorkerMarketContent = () => {
  const navigate = useNavigate()
  const { isZh, t } = useLanguage()
  const [activeTab, setActiveTab] = useState('All')
  const [searchQuery, setSearchQuery] = useState('')
  const [workers, setWorkers] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  const categories = ['All', 'HR', 'Sales', 'Designer', 'Engineering', 'Marketing']
  const categoryLabels = isZh
    ? { All: '全部', HR: '人力', Sales: '销售', Designer: '设计', Engineering: '工程', Marketing: '市场' }
    : { All: 'All', HR: 'HR', Sales: 'Sales', Designer: 'Designer', Engineering: 'Engineering', Marketing: 'Marketing' }

  useEffect(() => {
    let cancelled = false

    const loadEmployees = async () => {
      setIsLoading(true)
      try {
        const res = await axios.get(`${API_BASE}/ai-employees/`, { params: { limit: 200 } })
        if (cancelled) return
        const list = Array.isArray(res.data) ? res.data : []
        const normalized = list
          .filter((e) => !e || e.status !== 'archived')
          .map(normalizeEmployee)
        setWorkers(normalized)
      } catch (err) {
        console.error('[WorkerMarketContent] 加载数字员工失败:', err)
        if (!cancelled) setWorkers([])
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    loadEmployees()
    return () => {
      cancelled = true
    }
  }, [])

  const getFilteredWorkers = () => {
    const list = activeTab === 'All' ? workers : workers.filter((w) => w.team === activeTab)
    if (!searchQuery) return list
    const q = searchQuery.toLowerCase()
    return list.filter(
      (w) =>
        (w.name || '').toLowerCase().includes(q) ||
        (w.role || '').toLowerCase().includes(q) ||
        (w.description || '').toLowerCase().includes(q) ||
        (w.team || '').toLowerCase().includes(q),
    )
  }

  const navigateToConfig = (worker) => {
    const channel = getChannelByKey(worker.sourceType)
    if (!channel) {
      navigate(`/silicon-workmate/native/${worker.id}`)
      return
    }
    navigate('/connect-silicon-worker', { state: { editId: worker.id } })
  }

  const visibleWorkers = getFilteredWorkers()

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 p-8 overflow-y-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div className="flex space-x-1 bg-gray-100 p-1 rounded-xl w-fit overflow-x-auto">
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setActiveTab(category)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 whitespace-nowrap ${
                  activeTab === category
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200'
                }`}
              >
                {categoryLabels[category] || category}
              </button>
            ))}
          </div>

          <div className="relative">
            <svg
              className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              placeholder={t('market.search')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 w-full md:w-64"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="py-24 flex flex-col items-center justify-center text-gray-400">
            <div className="w-8 h-8 border-2 border-[#6266EA] border-t-transparent rounded-full animate-spin mb-4" />
            <div className="text-sm">{isZh ? '正在加载数字员工...' : 'Loading workers...'}</div>
          </div>
        ) : visibleWorkers.length === 0 ? (
          <div className="py-24 flex flex-col items-center justify-center text-gray-400 border border-dashed border-gray-200 rounded-2xl bg-white/50">
            <svg
              className="w-12 h-12 text-gray-300 mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.5"
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
            <div className="text-sm font-medium text-gray-500 mb-1">
              {searchQuery
                ? isZh
                  ? '没有匹配的数字员工'
                  : 'No matching workers'
                : isZh
                ? '还没有已创建的数字员工'
                : 'No workers yet'}
            </div>
            <div className="text-xs text-gray-400">
              {searchQuery
                ? isZh
                  ? '换个关键词试试吧'
                  : 'Try a different keyword'
                : isZh
                ? '可以在添加页面中创建你的第一位数字员工'
                : 'Create your first worker from the add page'}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {visibleWorkers.map((worker) => {
              const channel = getChannelByKey(worker.sourceType)
              const isConnected = !!channel
              return (
                <div
                  key={worker.id}
                  className={`bg-white rounded-xl p-5 shadow-sm hover:shadow-md transition-all duration-200 border group relative cursor-pointer ${
                    isConnected
                      ? `${channel?.cardRingClass || ''}`
                      : 'border-gray-200'
                  }`}
                  onClick={() => navigate('/chat-workspace', { state: { activeMember: worker.id } })}
                >
                  {/* Gear icon - visible on hover */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      navigateToConfig(worker)
                    }}
                    className="absolute top-3 right-3 z-10 w-7 h-7 rounded-full flex items-center justify-center bg-gray-100 text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-gray-200 hover:text-gray-700"
                    title={isZh ? '配置' : 'Config'}
                  >
                    <GearIcon className="w-3.5 h-3.5" />
                  </button>

                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1 pr-4">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-base font-bold text-gray-900 truncate">{worker.name}</h3>
                        <VerifiedIcon className="w-4 h-4 text-blue-500 flex-shrink-0" />
                        {isConnected && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 text-slate-700 flex-shrink-0">
                            <channel.Logo className="w-3 h-3" />
                            <span>{channel?.name}</span>
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 line-clamp-2 h-8">{worker.description}</p>
                    </div>
                    <div
                      className="w-12 h-12 rounded-lg overflow-hidden object-cover shadow-sm flex-shrink-0 bg-gray-100"
                    >
                      <img
                        src={worker.avatar}
                        alt={worker.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          if (e.currentTarget.src !== defaultAvatar) e.currentTarget.src = defaultAvatar
                        }}
                      />
                    </div>
                  </div>

                  <div className="mt-3 flex items-center gap-2 min-w-0 flex-1">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 max-w-full truncate">
                      <span className="truncate">{worker.role}</span>
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export default WorkerMarketContent
