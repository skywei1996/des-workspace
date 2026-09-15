import React, { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate, useLocation } from 'react-router-dom'
import axios from 'axios'
import { API_BASE } from '../config/api'
import { CREATED_GROUPS_UPDATED_EVENT, createCreatedGroup, fetchCreatedGroups, readCreatedGroups } from '../utils/groupStorage'
import { AUTOMATION_RESULTS_READ_EVENT, DEFAULT_AUTOMATION_USER_ID } from '../utils/automationTasks'
import { useLanguage } from '../i18n'

// Simple SVG Icon component
const Icon = ({ name, className = "w-4 h-4" }) => {
  const icons = {
    dashboard: <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>,
    users: <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>,
    usersGroup: <g><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></g>,
    plus: <path d="M12 5v14M5 12h14"></path>,
    chevronRight: <path d="M9 18l6-6-6-6"></path>,
    barChart: <path d="M12 20V10M18 20V4M6 20v-6"></path>,
    tool: <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>,
    book: <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>,
    database: <g><ellipse cx="12" cy="5" rx="9" ry="3"></ellipse><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path></g>,
    clipboard: <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>,
    shield: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>,
    robot: <path d="M12 8V4H8"></path>, // Simplified robot
    bot: <g><rect x="3" y="11" width="18" height="10" rx="2"></rect><circle cx="12" cy="5" r="2"></circle><path d="M12 7v4"></path><line x1="8" y1="16" x2="8" y2="16"></line><line x1="16" y1="16" x2="16" y2="16"></line></g>,
    shoppingBag: <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0"></path>,
    zap: <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>,
    x: <path d="M18 6 6 18M6 6l12 12"></path>,
    sparkles: <g><path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6L12 3z"></path><path d="M19 14l.8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8L19 14z"></path><path d="M5 14l.8 2.2L8 17l-2.2.8L5 20l-.8-2.2L2 17l2.2-.8L5 14z"></path></g>,
    check: <path d="M20 6L9 17l-5-5"></path>,
    network: <g><circle cx="12" cy="5" r="3"></circle><circle cx="5" cy="18" r="3"></circle><circle cx="19" cy="18" r="3"></circle><path d="M10.5 7.6 6.5 15M13.5 7.6l4 7.4M8 18h8"></path></g>,
    message: <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"></path>,
  }

  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width="24" 
      height="24" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      {icons[name] || <circle cx="12" cy="12" r="10"></circle>}
    </svg>
  )
}

const MerakLogo = ({ className }) => (
  <img src="/workmate-logo.png" alt="Work Mate" className={className} />
)

const menuGroupExpansionState = {}
const sidebarCollapseState = {}

const getSidebarModuleKey = (pathname) => {
  if (pathname.includes('object-management') || pathname.includes('ontology-modeling')) return 'objects'
  if (pathname.includes('agent-apps') || pathname.includes('evaluation-agent') || pathname.includes('watermark-audit-agent') || pathname.includes('contract-review-agent') || pathname.includes('recruitment-assistant') || pathname.includes('candidate-list')) return 'agents'
  if (pathname.includes('/workflows')) return 'workflows'
  if (pathname.includes('/automation-tasks')) return 'automation'
  if (pathname.includes('task')) return 'tasks'
  if (['/tools', '/knowledge-base', '/datasets', '/database', '/mcp-server-management'].some((path) => pathname.includes(path))) return 'resources'
  if (['/project', '/workforce', '/role', '/model-configuration', '/connectors'].some((path) => pathname.includes(path))) return 'settings'
  return 'workforce'
}

const MenuGroup = ({ title, children, defaultExpanded = true, action, stateKey }) => {
  const [isExpanded, setIsExpanded] = useState(() => {
    if (stateKey && Object.prototype.hasOwnProperty.call(menuGroupExpansionState, stateKey)) {
      return menuGroupExpansionState[stateKey]
    }

    return defaultExpanded
  })

  const toggleExpanded = () => {
    setIsExpanded((prev) => {
      const next = !prev
      if (stateKey) {
        menuGroupExpansionState[stateKey] = next
      }
      return next
    })
  }

  return (
    <div className="mb-2 mt-4">
      {title && (
        <div 
          className="px-6 py-2 text-xs text-gray-400 flex items-center justify-between group select-none"
        >
          <div 
            className="flex items-center gap-2 cursor-pointer hover:text-gray-600 transition-colors flex-1"
            onClick={toggleExpanded}
          >
            <span className="font-semibold tracking-wide">{title}</span>
            <Icon 
              name="chevronRight" 
              className={`w-3 h-3 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''} text-gray-400 group-hover:text-gray-600`} 
            />
          </div>
          {action && (
            <div className="flex items-center">
              {action}
            </div>
          )}
        </div>
      )}
      <div className={`transition-all duration-300 ease-in-out overflow-hidden ${isExpanded ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}>
        {children}
      </div>
    </div>
  )
}

const formatGroupMemberLabel = (count) => {
  if (count <= 0) return '待配置成员'
  return `${count} 位成员`
}

const getEmployeeAvatarFallback = (name) => {
  const normalized = String(name || '').trim()
  return normalized ? normalized.slice(0, 1).toUpperCase() : '智'
}

const inferGroupSuggestions = (employees, brief) => {
  if (!Array.isArray(employees) || employees.length === 0) {
    return []
  }

  const normalizedBrief = String(brief || '').toLowerCase()
  const keywordGroups = [
    { tokens: ['hr', '招聘', '人事', '组织', '入职'], matches: ['hr', '招聘', '人事', '组织'] },
    { tokens: ['数据', '分析', '报表', '洞察'], matches: ['数据', '分析', '报表', '洞察'] },
    { tokens: ['运营', '增长', '投放', '活动'], matches: ['运营', '增长', '投放', '活动'] },
    { tokens: ['销售', '客户', '商机', '转化'], matches: ['销售', '客户', '商机', '转化'] },
    { tokens: ['产品', '需求', '规划', '路线图'], matches: ['产品', '需求', '规划'] },
  ]

  const scored = employees.map((employee, index) => {
    const searchable = [employee.name, employee.role_title, employee.persona_prompt]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()

    let score = employees.length - index
    keywordGroups.forEach((group) => {
      if (group.tokens.some((token) => normalizedBrief.includes(token)) && group.matches.some((token) => searchable.includes(token))) {
        score += 10
      }
    })

    if (normalizedBrief && searchable.includes(normalizedBrief.slice(0, 4))) {
      score += 4
    }

    return { employee, score }
  })

  return scored
    .sort((left, right) => right.score - left.score)
    .slice(0, Math.min(4, employees.length))
    .map(({ employee }) => employee)
}

const GroupCreationModal = ({
  isOpen,
  mode,
  onClose,
  employees,
  memberSearchTerm,
  onMemberSearchChange,
  groupName,
  onGroupNameChange,
  groupDescription,
  onGroupDescriptionChange,
  groupBrief,
  onGroupBriefChange,
  selectedMemberIds,
  onToggleMember,
  onCreate,
  suggestions,
  onApplySuggestions,
}) => {
  const { isZh } = useLanguage()

  if (!isOpen) {
    return null
  }

  const selectedCount = selectedMemberIds.length
  const hasEmployees = employees.length > 0

  const modalContent = (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-[#10131a]/28 px-6 py-10 backdrop-blur-[2px]">
      <div className="w-full max-w-[780px] overflow-hidden rounded-[28px] border border-[#e5e8ee] bg-white shadow-[0_24px_80px_rgba(17,24,39,0.16)]">
        <div className="border-b border-[#eef1f5] bg-[linear-gradient(135deg,#f8fafc_0%,#eef2f7_100%)] px-8 py-6">
          <div className="flex items-start justify-between gap-6">
            <div>
              <h3 className="text-[26px] font-semibold tracking-tight text-[#1c2430]">{isZh ? '创建小组' : 'Create Group'}</h3>
              <p className="mt-2 text-sm leading-6 text-[#667080]">
                {mode === 'ai'
                  ? (isZh ? '输入目标后生成推荐成员组合，再决定是否创建小组。' : 'Describe the goal first, then review the suggested members before creating the group.')
                  : (isZh ? '直接勾选成员并补充说明，即可创建协作小组。' : 'Pick members directly and add context to create a collaboration group.')}
              </p>
            </div>
            <button
              type="button"
              className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#e2e7ef] bg-white text-[#6f7783] transition hover:border-[#d3dae5] hover:text-[#202733]"
              onClick={onClose}
            >
              <Icon name="x" className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="grid gap-0 lg:grid-cols-[1.1fr,0.9fr]">
          <div className="border-b border-[#eef1f5] px-8 py-7 lg:border-b-0 lg:border-r">
            <div className="space-y-5">
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[#8a93a3]">{isZh ? '小组名称' : 'Group Name'}</label>
                <input
                  value={groupName}
                  onChange={(event) => onGroupNameChange(event.target.value)}
                  placeholder={mode === 'ai' ? (isZh ? '例如：客户交付突击组' : 'Example: Client Delivery Pod') : (isZh ? '例如：招聘协同组' : 'Example: Hiring Collaboration Squad')}
                  className="w-full rounded-2xl border border-[#dfe5ec] bg-[#fbfcfd] px-4 py-3 text-sm text-[#1e2632] outline-none transition placeholder:text-[#a0a8b6] focus:border-[#bfc8d6] focus:bg-white"
                />
              </div>

              {mode === 'manual' ? (
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[#8a93a3]">{isZh ? '协作说明' : 'Collaboration Notes'}</label>
                  <textarea
                    value={groupDescription}
                    onChange={(event) => onGroupDescriptionChange(event.target.value)}
                    placeholder={isZh ? '补充这个小组的职责边界、协作节奏，或者适合处理哪类任务。' : 'Describe the scope, collaboration rhythm, or the types of tasks this group should handle.'}
                    rows={4}
                    className="w-full resize-none rounded-2xl border border-[#dfe5ec] bg-[#fbfcfd] px-4 py-3 text-sm leading-6 text-[#1e2632] outline-none transition placeholder:text-[#a0a8b6] focus:border-[#bfc8d6] focus:bg-white"
                  />
                </div>
              ) : (
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[#8a93a3]">{isZh ? '编组目标' : 'Grouping Goal'}</label>
                  <textarea
                    value={groupBrief}
                    onChange={(event) => onGroupBriefChange(event.target.value)}
                    placeholder={isZh ? '描述你希望 AI 自动组织的小组目标，例如：做一个客户需求澄清 + 方案生成 + 风险把控的多智能体小组。' : 'Describe the group AI should assemble, for example: a multi-agent team for discovery, proposal generation, and risk control.'}
                    rows={5}
                    className="w-full resize-none rounded-2xl border border-[#dfe5ec] bg-[#fbfcfd] px-4 py-3 text-sm leading-6 text-[#1e2632] outline-none transition placeholder:text-[#a0a8b6] focus:border-[#bfc8d6] focus:bg-white"
                  />
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={onApplySuggestions}
                      className="inline-flex items-center gap-2 rounded-full bg-[#1f2937] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#111827]"
                    >
                      <Icon name="sparkles" className="h-4 w-4" />
                      {isZh ? '生成推荐组合' : 'Generate Suggestions'}
                    </button>
                    <span className="text-xs leading-5 text-[#7a8492]">{isZh ? 'AI 会优先按 brief 中的职责关键词，从已创建员工里组织一个 multi-agent 小组。' : 'AI prioritizes responsibility keywords from the brief and assembles a multi-agent group from created workers.'}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="px-8 py-7">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8a93a3]">{isZh ? '候选成员' : 'Candidates'}</div>
                <div className="mt-1 text-sm text-[#606978]">{hasEmployees ? (isZh ? `已选择 ${selectedCount} 位数字员工` : `${selectedCount} digital workers selected`) : (isZh ? '还没有可选的数字员工' : 'No digital workers available yet')}</div>
              </div>
              <div className="rounded-full border border-[#e2e7ef] bg-[#f7f9fb] px-3 py-1 text-xs font-medium text-[#5f6977]">
                {formatGroupMemberLabel(selectedCount)}
              </div>
            </div>

            <div className="mb-4 space-y-3">
              <div className="relative">
                <input
                  type="text"
                  value={memberSearchTerm}
                  onChange={(event) => onMemberSearchChange(event.target.value)}
                  placeholder={isZh ? '搜索数字员工名称、角色或描述' : 'Search worker name, role, or description'}
                  className="w-full rounded-2xl border border-[#dfe5ec] bg-[#fbfcfd] py-3 pl-10 pr-4 text-sm text-[#1e2632] outline-none transition placeholder:text-[#a0a8b6] focus:border-[#bfc8d6] focus:bg-white"
                />
                <svg width="18" height="18" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#95a0ad]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-4.35-4.35m1.85-5.15a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>

            {!hasEmployees ? (
              <div className="rounded-3xl border border-dashed border-[#d8dee7] bg-[#fafbfc] px-5 py-8 text-center text-sm leading-6 text-[#7d8694]">
                {isZh ? '目前还没有已创建好的数字员工。' : 'No digital workers have been created yet.'}
                <div className="mt-2">{isZh ? '先创建数字员工后，这里就可以手动选人或让 AI 自动编组。' : 'Create digital workers first, then select members manually or let AI assemble a group.'}</div>
              </div>
            ) : (
              <div className="max-h-[360px] space-y-3 overflow-y-auto pr-1">
                {employees.length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-[#d8dee7] bg-[#fafbfc] px-5 py-8 text-center text-sm leading-6 text-[#7d8694]">
                    {isZh ? '没有匹配到符合搜索条件的数字员工。' : 'No digital workers match the current search.'}
                  </div>
                ) : employees.map((employee, index) => {
                  const isSelected = selectedMemberIds.includes(employee.id)
                  const isSuggested = suggestions.some((candidate) => candidate.id === employee.id)
                  const accentLabel = mode === 'ai' && isSelected ? (index === 0 ? 'Coordinator' : 'Specialist') : null

                  return (
                    <button
                      type="button"
                      key={employee.id}
                      onClick={() => onToggleMember(employee.id)}
                      className={`w-full rounded-3xl border px-4 py-4 text-left transition ${isSelected ? 'border-[#1f2937] bg-[#f5f7fa] shadow-[inset_0_0_0_1px_rgba(31,41,55,0.04)]' : 'border-[#e5e9ef] bg-white hover:border-[#d5dce6] hover:bg-[#fafbfd]'}`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="relative flex h-11 w-11 flex-shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[#edf0f4] bg-[#f3f5f8]">
                          {employee.avatar_url ? (
                            <img src={employee.avatar_url} alt={employee.name} className="h-full w-full object-cover" />
                          ) : (
                            <span className="text-sm font-semibold text-[#96a0ad]">{getEmployeeAvatarFallback(employee.name)}</span>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="truncate text-sm font-semibold text-[#1d2430]">{employee.name}</span>
                            {isSuggested && (
                              <span className="rounded-full bg-[#eef2ff] px-2.5 py-1 text-[11px] font-medium text-[#5261c7]">{isZh ? 'AI 推荐' : 'AI Suggested'}</span>
                            )}
                            {accentLabel && (
                              <span className="rounded-full bg-[#111827] px-2.5 py-1 text-[11px] font-medium text-white">{accentLabel}</span>
                            )}
                          </div>
                          <div className="mt-1 text-sm text-[#707a89]">{employee.role_title || (isZh ? '未设置角色' : 'No role assigned')}</div>
                          {employee.persona_prompt && (
                            <div className="mt-2 line-clamp-2 text-xs leading-5 text-[#98a1ae]">{employee.persona_prompt}</div>
                          )}
                        </div>
                        <div className={`mt-1 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border ${isSelected ? 'border-[#111827] bg-[#111827] text-white' : 'border-[#d8dee7] bg-white text-transparent'}`}>
                          <Icon name="plus" className={`h-3.5 w-3.5 transition ${isSelected ? 'rotate-45' : ''}`} />
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-[#eef1f5] bg-[#fbfcfd] px-8 py-5">
          <div className="text-xs leading-5 text-[#808a98]">
            {mode === 'ai'
              ? (isZh ? 'AI 自动编组会先基于 brief 推荐一个多智能体小组，你仍然可以手动调整成员。' : 'AI first recommends a multi-agent group from the brief, and you can still adjust members manually.')
              : (isZh ? '手动勾选适合的小组成员，创建后可用于后续协作入口。' : 'Select members manually. After creation, the group becomes available in collaboration flows.')}
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="rounded-full border border-[#dde3eb] bg-white px-4 py-2 text-sm font-medium text-[#5f6977] transition hover:border-[#cfd7e2] hover:text-[#1f2937]"
              onClick={onClose}
            >
              {isZh ? '取消' : 'Cancel'}
            </button>
            <button
              type="button"
              className="rounded-full bg-[#111827] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-[#0b1220]"
              onClick={onCreate}
            >
              {isZh ? '创建小组' : 'Create Group'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )

  if (typeof document === 'undefined') {
    return modalContent
  }

  return createPortal(modalContent, document.body)
}

const Sidebar = ({ 
  onSelectMember, 
  onSelectGroup,
  activeMember = 'aria',
  activeGroupId = null,
  onAddEmployee,
  onViewAllEmployees,
  compact = false 
}) => {
  const { language, setLanguage, isZh, t } = useLanguage()
  const navigate = useNavigate()
  const location = useLocation()
  const sidebarModuleKey = getSidebarModuleKey(location.pathname)
  const [customEmployees, setCustomEmployees] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('workforce')
  const [isCollapsed, setIsCollapsed] = useState(() => sidebarCollapseState[sidebarModuleKey] ?? compact)
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false)
  const [groupCreationMode, setGroupCreationMode] = useState('manual')
  const [groupName, setGroupName] = useState('')
  const [groupDescription, setGroupDescription] = useState('')
  const [groupBrief, setGroupBrief] = useState('')
  const [selectedGroupMemberIds, setSelectedGroupMemberIds] = useState([])
  const [groupMemberSearchTerm, setGroupMemberSearchTerm] = useState('')
  const [createdGroups, setCreatedGroups] = useState(() => readCreatedGroups())
  const [groupSuggestions, setGroupSuggestions] = useState([])
  const [creationNotice, setCreationNotice] = useState('')
  const [automationUnreadCount, setAutomationUnreadCount] = useState(0)

  const groupMembers = useMemo(
    () => customEmployees.filter((employee) => selectedGroupMemberIds.includes(employee.id)),
    [customEmployees, selectedGroupMemberIds]
  )

  const filteredGroupCandidates = useMemo(() => {
    const keyword = groupMemberSearchTerm.trim().toLowerCase()
    if (!keyword) {
      return customEmployees
    }

    return customEmployees.filter((employee) => {
      const haystack = [employee.name, employee.role_title, employee.persona_prompt]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      return haystack.includes(keyword)
    })
  }, [customEmployees, groupMemberSearchTerm])

  const copy = useMemo(() => ({
    workmate: 'Silicon WorkMate',
    createEmployee: isZh ? '创建员工' : 'Create Employee',
    createEmployeeDesc: isZh ? '新建角色与技能配置' : 'Create a new role and skill profile',
    createGroup: isZh ? '创建小组' : 'Create Group',
    createGroupDesc: isZh ? '手动选择成员' : 'Select members manually',
    aiGrouping: isZh ? 'AI 编组' : 'AI Grouping',
    aiGroupingDesc: isZh ? '自动推荐协作成员' : 'Auto-recommend collaborators',
    recentWorkers: isZh ? '最近使用员工' : 'Recently Workers',
    agentList: isZh ? '智能体列表' : 'Agent List',
    appCenter: isZh ? '智能体中心' : 'Agent Center',
    workflowList: isZh ? 'Workflow 列表' : 'Workflow List',
    hrRecruitment: isZh ? '人资招聘' : 'HR Recruitment',
    legalReview: isZh ? '法务审查' : 'Legal Review',
    contentReview: isZh ? '内容审核' : 'Content Review',
    platformTools: isZh ? '平台工具' : 'Platform Tools',
    recruitmentAssistant: isZh ? '岗位需求' : 'Position Requirements',
    candidateList: isZh ? '候选人列表' : 'Candidate List',
    evaluationAgent: isZh ? '天璇AI测评平台' : 'Tianxuan AI Evaluation Platform',
    watermarkAuditAgent: isZh ? '水印审核智能体' : 'Watermark Audit Agent',
    contractReviewAgent: isZh ? '合同审查' : 'Contract Review',
    taskManagement: isZh ? '任务管理' : 'Task Management',
    taskProgress: isZh ? '任务进度' : 'Task Progress',
    automationManagement: isZh ? '定时任务' : 'Automation Tasks',
    automationTasks: isZh ? '定时任务' : 'Automation Tasks',
    automationTaskList: isZh ? '任务列表' : 'Task List',
    automationTaskCreate: isZh ? '添加任务' : 'Add Task',
    automationTaskHistory: isZh ? '任务执行历史' : 'Task History',
    resources: isZh ? '资源' : 'Resources',
    skills: isZh ? '技能' : 'Skills',
    knowledgeBase: isZh ? '知识库' : 'Knowledge Base',
    datasets: isZh ? '数据集' : 'Datasets',
    mcpToolsets: isZh ? 'MCP 工具集' : 'MCP Toolsets',
    database: isZh ? '数据库' : 'Database',
    settings: isZh ? '设置' : 'Settings',
    modelConfiguration: isZh ? '模型配置' : 'Model Configuration',
    connectors: isZh ? '连接器' : 'Connectors',
    teamManagement: isZh ? '团队管理' : 'Teams Management',
    workforceManagement: isZh ? '员工管理' : 'Workforce Management',
    roleManagement: isZh ? '角色管理' : 'Role Management',
    languageLabel: isZh ? '语言' : 'Language',
    createGroupNoticeAi: isZh ? 'AI 已完成一组 multi-agent 小组编排。' : 'AI finished assembling a multi-agent group.',
    createGroupNoticeManual: isZh ? '新的数字员工小组已创建。' : 'A new digital-worker group has been created.',
    createGroupNeedMember: isZh ? '请至少选择一位数字员工后再创建小组。' : 'Select at least one digital worker before creating a group.',
    createGroupFailed: isZh ? '创建小组失败，请稍后重试。' : 'Failed to create the group. Please try again later.',
  }), [isZh])

  useEffect(() => {
    loadCustomEmployees()
  }, [])

  useEffect(() => {
    if (!creationNotice) {
      return undefined
    }

    const timer = window.setTimeout(() => setCreationNotice(''), 2600)
    return () => window.clearTimeout(timer)
  }, [creationNotice])

  useEffect(() => {
    const path = location.pathname
    if (path.includes('silicon') || path === '/' || path.includes('add-silicon-worker')) {
      setActiveTab('workforce')
    } else if (path.includes('object-management') || path.includes('ontology-modeling')) {
      setActiveTab('objects')
    } else if (path.includes('agent-apps') || path.includes('evaluation-agent') || path.includes('watermark-audit-agent') || path.includes('contract-review-agent') || path.includes('recruitment-assistant') || path.includes('candidate-list')) {
      setActiveTab('agents')
    } else if (path.includes('/workflows')) {
      setActiveTab('workflows')
    } else if (path.includes('/automation-tasks')) {
      setActiveTab('automation')
    } else if (path.includes('task')) {
      setActiveTab('tasks')
    } else if (['/tools', '/knowledge-base', '/datasets', '/database', '/mcp-server-management'].some(p => path.includes(p))) {
      setActiveTab('resources')
    } else if (['/project', '/workforce', '/role', '/model-configuration', '/connectors'].some(p => path.includes(p))) {
      setActiveTab('settings')
    }
  }, [location.pathname])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined
    }

    const syncCreatedGroups = async () => {
      try {
        const groups = await fetchCreatedGroups()
        setCreatedGroups(groups)
      } catch (error) {
        setCreatedGroups(readCreatedGroups())
      }
    }

    syncCreatedGroups()
    window.addEventListener(CREATED_GROUPS_UPDATED_EVENT, syncCreatedGroups)
    window.addEventListener('focus', syncCreatedGroups)

    return () => {
      window.removeEventListener(CREATED_GROUPS_UPDATED_EVENT, syncCreatedGroups)
      window.removeEventListener('focus', syncCreatedGroups)
    }
  }, [])

  const loadCustomEmployees = async () => {
    if (isLoading) return
    setIsLoading(true)
    try {
      const response = await axios.get(`${API_BASE}/ai-employees/`)
      if (Array.isArray(response.data)) {
        setCustomEmployees(response.data)
      } else {
        console.error('Sidebar: Expected array but got:', typeof response.data)
      }
    } catch (error) {
      console.error('Failed to load employees:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleInlineAddClick = (e) => {
    e && e.stopPropagation()
    if (onAddEmployee) return onAddEmployee()
    navigate('/add-silicon-worker')
  }

  const resetGroupBuilder = () => {
    setGroupCreationMode('manual')
    setGroupName('')
    setGroupDescription('')
    setGroupBrief('')
    setSelectedGroupMemberIds([])
    setGroupMemberSearchTerm('')
    setGroupSuggestions([])
  }

  const openGroupBuilder = (mode = 'manual') => {
    setIsGroupModalOpen(true)
    setGroupCreationMode(mode)
    setGroupSuggestions([])
    if (mode === 'manual') {
      setGroupBrief('')
    }
  }

  const closeGroupBuilder = () => {
    setIsGroupModalOpen(false)
    resetGroupBuilder()
  }

  const toggleGroupMember = (memberId) => {
    setSelectedGroupMemberIds((prev) => (
      prev.includes(memberId)
        ? prev.filter((id) => id !== memberId)
        : [...prev, memberId]
    ))
  }

  const applyAiSuggestions = () => {
    const suggestions = inferGroupSuggestions(customEmployees, groupBrief)
    setGroupSuggestions(suggestions)
    setSelectedGroupMemberIds(suggestions.map((employee) => employee.id))
    if (!groupName.trim()) {
      setGroupName('AI 协作小组')
    }
    if (!groupDescription.trim() && groupBrief.trim()) {
      setGroupDescription(groupBrief.trim())
    }
  }

  const handleCreateGroup = async () => {
    if (groupMembers.length === 0) {
      setCreationNotice(copy.createGroupNeedMember)
      return
    }

    try {
      const nextGroup = await createCreatedGroup({
        name: groupName.trim() || (groupCreationMode === 'ai' ? 'AI 自动编组' : '新建协作小组'),
        description: (groupCreationMode === 'ai' ? groupBrief : groupDescription).trim() || '用于多角色协作执行复杂任务。',
        mode: groupCreationMode,
        member_ids: groupMembers.map((member) => member.id),
      })
      setCreatedGroups((prev) => [nextGroup, ...prev.filter((group) => group.id !== nextGroup.id)])
      setCreationNotice(groupCreationMode === 'ai' ? copy.createGroupNoticeAi : copy.createGroupNoticeManual)
      closeGroupBuilder()
    } catch (error) {
      const detail = error?.response?.data?.detail || copy.createGroupFailed
      setCreationNotice(detail)
    }
  }

  const handleMemberClick = (memberId) => {
    if (onSelectMember) {
      onSelectMember(memberId)
    } else {
      navigate('/chat-workspace', { state: { activeMember: memberId } })
    }
  }

  const handleGroupClick = (group) => {
    if (onSelectGroup) {
      onSelectGroup(group)
      return
    }

    navigate('/chat-workspace', { state: { activeGroup: group } })
  }

  useEffect(() => {
    let cancelled = false

    const loadAutomationUnreadCount = async () => {
      try {
        const response = await axios.get(`${API_BASE}/tasks/automation/result-summary`, {
          params: {
            user_id: DEFAULT_AUTOMATION_USER_ID,
            unread_only: true,
            limit: 1,
          },
        })
        if (!cancelled) {
          setAutomationUnreadCount(Number(response.data?.unread_count || 0))
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to load automation unread count:', error)
        }
      }
    }

    loadAutomationUnreadCount()
    const timer = window.setInterval(loadAutomationUnreadCount, 30000)
    const handleReadEvent = (event) => {
      if (event?.detail?.employeeId) {
        return
      }
      setAutomationUnreadCount(Number(event?.detail?.unreadCount || 0))
    }
    window.addEventListener(AUTOMATION_RESULTS_READ_EVENT, handleReadEvent)

    return () => {
      cancelled = true
      window.clearInterval(timer)
      window.removeEventListener(AUTOMATION_RESULTS_READ_EVENT, handleReadEvent)
    }
  }, [])

  const MenuItem = ({ label, onClick, active, iconName, badgeCount = 0 }) => (
    <div 
      className={`mx-2 my-1 flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors duration-200 ${
        active 
          ? 'bg-[#f7f7f8] text-[#17191f]' 
          : 'text-[#656b75] hover:bg-[#f7f7f8] hover:text-[#e3473c]'
      }`}
      onClick={onClick}
    >
      {iconName && <Icon name={iconName} className={`h-4 w-4 ${active ? 'text-[#2f343d]' : ''}`} />}
      <span className={`${active ? 'font-semibold' : 'font-medium'}`}>{label}</span>
      {badgeCount > 0 && (
        <span className="ml-auto inline-flex min-w-[20px] items-center justify-center rounded-full bg-[#f40b0b] px-1.5 py-0.5 text-[10px] font-semibold text-white">
          {badgeCount > 99 ? '99+' : badgeCount}
        </span>
      )}
    </div>
  )

  const NavRailItem = ({ id, icon, label, active, badgeCount = 0, onClick }) => (
    <div 
      className={`relative flex h-16 w-full cursor-pointer flex-col items-center justify-center transition-all duration-200 ${
        active ? 'bg-white text-[#e3473c]' : 'text-[#5f6670] hover:bg-[#f7f7f8] hover:text-[#2f343d]'
      }`}
      onClick={() => {
        setActiveTab(id)
        if (onClick) {
          onClick()
        }
      }}
    >
      {active && <div className="absolute left-0 top-1/2 h-8 w-1 -translate-y-1/2 rounded-r-full bg-[#f40b0b]" />}
      {badgeCount > 0 && <div className="absolute right-3 top-3 h-2.5 w-2.5 rounded-full bg-[#f40b0b]" />}
      <Icon name={icon} className={`mb-1 h-6 w-6 ${active ? 'text-[#f40b0b]' : ''}`} />
      <span className="text-[10px] font-medium">{label}</span>
    </div>
  )

  return (
    <div className={`relative z-[5] flex h-screen border-r border-[#e8eaee] bg-white ${isCollapsed ? 'w-[64px]' : 'w-[256px]'}`}>
      {/* Left Navigation Rail */}
      <div className="flex w-[64px] flex-shrink-0 flex-col items-center border-r border-[#eef0f3] bg-[#fbfbfc]">
        {/* User Avatar */}
        <div 
          className="flex h-16 w-full cursor-pointer items-center justify-center border-b border-[#eef0f3] transition-colors hover:bg-[#f3f4f6]"
          title={t('sidebar.profileSettings')}
        >
           <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[#f06a5e] to-[#f40b0b] text-sm font-bold text-white shadow-sm">
             A
           </div>
        </div>
        
        <div className="flex w-full flex-col items-center py-2">
          <NavRailItem id="workforce" icon="usersGroup" label={t('sidebar.nav.mate')} active={activeTab === 'workforce'} onClick={() => navigate('/silicon-workmate')} />
          <NavRailItem id="objects" icon="network" label={t('sidebar.nav.object')} active={activeTab === 'objects'} onClick={() => navigate('/object-management/object-types')} />
          <NavRailItem id="agents" icon="zap" label={t('sidebar.nav.agent')} active={activeTab === 'agents'} onClick={() => navigate('/agent-apps')} />
          <NavRailItem id="workflows" icon="network" label={isZh ? '工作流' : 'Workflow'} active={activeTab === 'workflows'} onClick={() => navigate('/workflows')} />
          <NavRailItem id="automation" icon="barChart" label={copy.automationTasks} active={activeTab === 'automation'} badgeCount={automationUnreadCount} onClick={() => navigate('/automation-tasks')} />
          <NavRailItem id="resources" icon="database" label={t('sidebar.nav.resources')} active={activeTab === 'resources'} onClick={() => navigate('/tools')} />
          <NavRailItem id="settings" icon="shield" label={t('sidebar.nav.settings')} active={activeTab === 'settings'} onClick={() => navigate('/model-configuration')} />
        </div>

        <div className="mt-auto w-full border-t border-[#eef0f3] px-2 py-2">
          <button
            type="button"
            onClick={() => setIsCollapsed((current) => {
              const next = !current
              sidebarCollapseState[sidebarModuleKey] = next
              return next
            })}
            className="mb-1 flex h-9 w-full items-center justify-center rounded-xl text-[#5f6670] transition hover:bg-[#f7f7f8] hover:text-[#2f343d]"
            title={isCollapsed ? (isZh ? '展开导航' : 'Expand navigation') : (isZh ? '收起导航' : 'Collapse navigation')}
            aria-label={isCollapsed ? (isZh ? '展开导航' : 'Expand navigation') : (isZh ? '收起导航' : 'Collapse navigation')}
          >
            <Icon name={isCollapsed ? 'chevronRight' : 'chevronLeft'} className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setLanguage(language === 'zh' ? 'en' : 'zh')}
            className="flex w-full flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 text-[#5f6670] transition hover:bg-[#f7f7f8] hover:text-[#2f343d]"
            title={`${copy.languageLabel}: ${language === 'zh' ? t('language.zh') : t('language.en')}`}
          >
            <span className="text-[11px] font-semibold tracking-[0.18em]">{language === 'zh' ? 'EN' : '中'}</span>
            <span className="text-[10px]">{copy.languageLabel}</span>
          </button>
        </div>
      </div>

      {/* Right Content Panel */}
      {!isCollapsed && (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white">
        {/* Header */}
        <div className="flex h-16 flex-shrink-0 items-center border-b border-[#f1f2f4] px-4">
          <MerakLogo className="h-10 w-full object-contain object-left" />
        </div>

        {/* Content Area */}
        <div className="min-h-0 flex-1 overflow-y-auto py-2">
          {activeTab === 'workforce' && (
            <div className="animate-fadeIn">
              <div className="space-y-2 px-3 py-3">
                <div className="relative flex items-center gap-2">
                  <div
                    className="group flex h-11 min-w-0 flex-1 cursor-pointer items-center rounded-xl px-3.5 text-[#5f6670] transition-colors hover:bg-[#eef0f3]"
                    onClick={() => navigate('/silicon-workmate')}
                  >
                    <div className="flex min-w-0 items-center text-inherit">
                      <span className="truncate text-[15px] font-medium tracking-tight">{copy.workmate}</span>
                    </div>
                  </div>

                </div>

                {creationNotice && (
                  <div className="rounded-2xl border border-[#e7ecf3] bg-[#f7f9fc] px-4 py-3 text-xs leading-5 text-[#6b7482]">
                    {creationNotice}
                  </div>
                )}
              </div>
              
              <div className="px-4 pb-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                {copy.recentWorkers}
              </div>
              
              <div className="space-y-1">
                {createdGroups.map((group) => (
                  <div
                    key={group.id}
                    className={`mx-2 cursor-pointer rounded-2xl border px-3 py-3.5 text-[#1f2732] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.4)] transition ${activeGroupId === group.id ? 'border-[#cfd8e6] bg-[#f4f7fb]' : 'border-[#e6eaf0] bg-[#fafbfd] hover:border-[#d6deea] hover:bg-white'}`}
                    onClick={() => handleGroupClick(group)}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl ${group.mode === 'ai' ? 'bg-[#111827] text-white' : 'bg-[#f1f4f8] text-[#637083]'}`}>
                        <Icon name={group.mode === 'ai' ? 'sparkles' : 'usersGroup'} className="h-4.5 w-4.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-semibold">{group.name}</span>
                          {group.mode === 'ai' && (
                            <span className="rounded-full bg-[#eef2ff] px-2 py-0.5 text-[10px] font-medium text-[#5666c9]">
                              {copy.aiGrouping}
                            </span>
                          )}
                        </div>
                        <div className="mt-2 text-[11px] text-[#9098a6]">
                          {group.members.map((member) => member.name).join(' · ')}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                {isLoading ? (
                  <div className="text-xs text-gray-400 py-2 px-6">{t('sidebar.loading')}</div>
                ) : customEmployees.length > 0 ? (
                  customEmployees.map((emp) => (
                    <div 
                      key={emp.id}
                      className={`mx-2 flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-200 ${
                        activeMember === emp.id
                          ? 'bg-[#f7f7f8] text-[#17191f] shadow-[inset_0_0_0_1px_rgba(228,231,235,0.9)]' 
                          : 'text-[#656b75] hover:bg-[#f7f7f8] hover:text-[#e3473c]'
                      }`}
                      onClick={() => handleMemberClick(emp.id)}
                    >
                      <div className="w-9 h-9 rounded-full bg-gray-100 flex-shrink-0 overflow-hidden border border-gray-100">
                        {emp.avatar_url ? (
                          <img src={emp.avatar_url} alt={emp.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-sm font-semibold text-gray-400">
                             {getEmployeeAvatarFallback(emp.name)}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col overflow-hidden min-w-0">
                        <span className="text-sm font-medium truncate text-gray-900">{emp.name}</span>
                        {emp.role_title && (
                          <span className="text-xs text-gray-500 truncate">{emp.role_title}</span>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-xs text-gray-400 py-2 px-6">{t('sidebar.noWorkers')}</div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'objects' && (
            <div className="animate-fadeIn">
              <div className="mb-2 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
                {t('object.sidebar.title')}
              </div>
              <MenuItem
                label={isZh ? '项目' : 'Projects'}
                iconName="network"
                active={location.pathname.startsWith('/ontology-modeling')}
                onClick={() => navigate('/ontology-modeling')}
              />
              <MenuItem
                label={isZh ? '对象' : 'Objects'}
                iconName="database"
                active={location.pathname === '/object-management/object-types'}
                onClick={() => navigate('/object-management/object-types')}
              />
              <MenuItem
                label={isZh ? '属性' : 'Properties'}
                iconName="clipboard"
                active={location.pathname === '/object-management/shared-properties'}
                onClick={() => navigate('/object-management/shared-properties')}
              />
              <MenuItem
                label={isZh ? '图谱' : 'Graph'}
                iconName="network"
                active={location.pathname === '/object-management/graph'}
                onClick={() => navigate('/object-management/graph')}
              />
            </div>
          )}

          {activeTab === 'agents' && (
            <div className="animate-fadeIn">
              {location.pathname === '/agent-apps' && (
                <>
                  <div className="px-4 py-2 mb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">{copy.agentList}</div>
                  <MenuItem 
                    label={copy.appCenter} 
                    iconName="dashboard"
                    active={location.pathname === '/agent-apps'}
                    onClick={() => navigate('/agent-apps')} 
                  />
                </>
              )}
            </div>
          )}

          {activeTab === 'workflows' && (
            <div className="animate-fadeIn">
              <div className="px-4 py-2 mb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">{isZh ? '工作流' : 'Workflow'}</div>
              <MenuItem
                label={copy.workflowList}
                iconName="network"
                active={location.pathname === '/workflows'}
                onClick={() => navigate('/workflows')}
              />
            </div>
          )}

          {activeTab === 'tasks' && (
            <div className="animate-fadeIn">
              <div className="px-4 py-2 mb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">{copy.taskManagement}</div>
              <MenuItem 
                label={copy.taskProgress} 
                iconName="barChart"
                active={location.pathname === '/task-progress'}
                onClick={() => navigate('/task-progress')} 
              />
            </div>
          )}

          {activeTab === 'automation' && (
            <div className="animate-fadeIn">
              <div className="px-4 py-2 mb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">{copy.automationManagement}</div>
              <MenuItem
                label={copy.automationTaskList}
                iconName="clipboard"
                active={location.pathname === '/automation-tasks'}
                badgeCount={automationUnreadCount}
                onClick={() => navigate('/automation-tasks')}
              />
              <MenuItem
                label={copy.automationTaskHistory}
                iconName="barChart"
                active={location.pathname === '/automation-tasks/history'}
                onClick={() => navigate('/automation-tasks/history')}
              />
            </div>
          )}

          {activeTab === 'resources' && (
            <div className="animate-fadeIn">
              <div className="px-4 py-2 mb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">{copy.resources}</div>
              <MenuItem 
                label={copy.skills} 
                iconName="tool" 
                active={location.pathname === '/tools'}
                onClick={() => navigate('/tools')}
              />
              <MenuItem 
                label={copy.knowledgeBase} 
                iconName="book" 
                active={location.pathname === '/knowledge-base'}
                onClick={() => navigate('/knowledge-base')}
              />
              <MenuItem
                label={copy.datasets}
                iconName="database"
                active={location.pathname === '/datasets'}
                onClick={() => navigate('/datasets')}
              />
              <MenuItem 
                label={copy.mcpToolsets} 
                iconName="database" 
                active={location.pathname === '/mcp-server-management'}
                onClick={() => navigate('/mcp-server-management')}
              />
              <MenuItem 
                label={copy.database} 
                iconName="database" 
                active={location.pathname === '/database'}
                onClick={() => navigate('/database')}
              />
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="animate-fadeIn">
              <div className="px-4 py-2 mb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">{copy.settings}</div>
              <MenuItem 
                label={copy.modelConfiguration} 
                iconName="bot" 
                active={location.pathname === '/model-configuration'}
                onClick={() => navigate('/model-configuration')}
              />
              <MenuItem 
                label={copy.connectors} 
                iconName="tool" 
                active={location.pathname === '/connectors'}
                onClick={() => navigate('/connectors')}
              />
              <MenuItem 
                label={copy.teamManagement} 
                iconName="clipboard" 
                active={location.pathname === '/project-management'}
                onClick={() => navigate('/project-management')}
              />
              <MenuItem 
                label={copy.workforceManagement} 
                iconName="users" 
                active={location.pathname === '/workforce-management'}
                onClick={() => navigate('/workforce-management')}
              />
              <MenuItem 
                label={copy.roleManagement} 
                iconName="shield" 
                active={location.pathname === '/role-management'}
                onClick={() => navigate('/role-management')}
              />
            </div>
          )}
        </div>
      </div>
      )}

      <GroupCreationModal
        isOpen={isGroupModalOpen}
        mode={groupCreationMode}
        onClose={closeGroupBuilder}
        employees={filteredGroupCandidates}
        memberSearchTerm={groupMemberSearchTerm}
        onMemberSearchChange={setGroupMemberSearchTerm}
        groupName={groupName}
        onGroupNameChange={setGroupName}
        groupDescription={groupDescription}
        onGroupDescriptionChange={setGroupDescription}
        groupBrief={groupBrief}
        onGroupBriefChange={setGroupBrief}
        selectedMemberIds={selectedGroupMemberIds}
        onToggleMember={toggleGroupMember}
        onCreate={handleCreateGroup}
        suggestions={groupSuggestions}
        onApplySuggestions={applyAiSuggestions}
      />
    </div>
  )
}


export default Sidebar
