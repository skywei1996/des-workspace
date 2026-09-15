import React, { useEffect, useMemo, useRef, useState } from 'react'
import axios from 'axios'
import { useLocation, useNavigate } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import { buildApiUrl } from '../config/api'
import {
  AUTOMATION_RESULTS_READ_EVENT,
  buildTaskPayload,
  createAutomationTask,
  createEmptyTaskForm,
  deleteAutomationTask,
  formatDateTime,
  getTaskFormFromTask,
  getAutomationTaskResultSummary,
  listAutomationTasks,
  markAutomationTaskResultsRead,
  pauseAutomationTask,
  MONTH_DAY_OPTIONS,
  recommendAutomationEmployees,
  startAutomationTask,
  TASK_TYPE_OPTIONS,
  toEmployeeOption,
  updateAutomationTask,
  WEEKDAY_OPTIONS,
} from '../utils/automationTasks'

const Icon = ({ name, className = 'w-4 h-4' }) => {
  const icons = {
    plus: <path d="M12 5v14M5 12h14"></path>,
    search: <circle cx="11" cy="11" r="8"></circle>,
    filter: <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>,
    clock: <circle cx="12" cy="12" r="10"></circle>,
    play: <polygon points="5 3 19 12 5 21 5 3"></polygon>,
    pause: <g><line x1="10" y1="4" x2="10" y2="20"></line><line x1="14" y1="4" x2="14" y2="20"></line></g>,
    history: <path d="M3 3v5h5"></path>,
    edit: <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>,
    trash: <polyline points="3 6 5 6 21 6"></polyline>,
    x: <g><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></g>,
    barChart: <path d="M12 20V10M18 20V4M6 20v-6"></path>,
    checkCircle: <path d="M9 12l2 2 4-4"></path>,
    alert: <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>,
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
      {icons[name] || icons.barChart}
      {name === 'search' && <line x1="21" y1="21" x2="16.65" y2="16.65"></line>}
      {name === 'edit' && <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>}
      {name === 'trash' && <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>}
      {name === 'history' && <path d="M3.05 11A9 9 0 1 1 6 17.3L3 14"></path>}
      {name === 'checkCircle' && <circle cx="12" cy="12" r="10"></circle>}
      {name === 'alert' && <line x1="12" y1="9" x2="12" y2="13"></line>}
      {name === 'alert' && <line x1="12" y1="17" x2="12.01" y2="17"></line>}
    </svg>
  )
}

const MultiSelectDropdown = ({ label, options, selectedValues, onChange }) => {
  const [isOpen, setIsOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setIsOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const toggle = (value) => {
    const current = selectedValues || []
    const updated = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value]
    if (updated.length === 0) return
    onChange(updated)
  }

  const displayText = selectedValues?.length > 0
    ? options.filter((o) => selectedValues.includes(o.value)).map((o) => o.label).join('、')
    : '请选择'

  return (
    <div className="block space-y-2" ref={ref}>
      <span className="text-xs font-medium text-gray-700">{label}</span>
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="h-10 w-full rounded-xl border border-gray-200 px-3 text-sm text-gray-800 outline-none transition focus:border-[#f0bbb6] focus:ring-4 focus:ring-[#fff1ef] flex items-center justify-between"
        >
          <span className={selectedValues?.length > 0 ? 'text-gray-800' : 'text-gray-400'}>{displayText}</span>
          <svg className={`h-4 w-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
        </button>
        {isOpen && (
          <div className="absolute z-50 mt-1 w-full rounded-xl border border-gray-200 bg-white shadow-lg max-h-60 overflow-y-auto py-1">
            {options.map((option) => {
              const isSelected = selectedValues?.includes(option.value)
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => toggle(option.value)}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-left hover:bg-gray-50 transition"
                >
                  <span className={`flex h-4 w-4 items-center justify-center rounded border transition ${
                    isSelected ? 'border-[#f3b4ac] bg-[#d94841]' : 'border-gray-300 bg-white'
                  }`}>
                    {isSelected && <svg className="h-3 w-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                  </span>
                  <span className={isSelected ? 'text-gray-900 font-medium' : 'text-gray-600'}>{option.label}</span>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

const CapabilityGroup = ({ label, items }) => (
  <div className="space-y-1.5">
    <div className="text-[11px] font-medium uppercase tracking-wide text-gray-400">{label}</div>
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <span key={item} className="rounded-full bg-white px-2.5 py-1 text-[11px] text-gray-600 ring-1 ring-inset ring-gray-200">
          {item}
        </span>
      ))}
    </div>
  </div>
)

const statusMeta = {
  启用: {
    label: '启用',
    text: 'text-emerald-700',
  },
  暂停: {
    label: '暂停',
    text: 'text-amber-700',
  },
  已结束: {
    label: '已结束',
    text: 'text-slate-500',
  },
  已删除: {
    label: '已删除',
    text: 'text-slate-400',
  },
}

const buildScheduleDescription = (task) => {
  const taskType = task.task_type || ''
  const executeRule = task.execute_rule || ''
  const startTime = task.start_time ? task.start_time.slice(0, 10) : ''
  const endTime = task.end_time ? task.end_time.slice(0, 10) : ''

  const parts = String(executeRule).split(' ')
  const time = parts[1] || '--:--'

  let schedule = ''
  if (taskType === '单次') {
    const dateStr = startTime || (task.next_execute_time ? task.next_execute_time.slice(0, 10) : '')
    schedule = `${dateStr} ${time} 执行一次`
  } else if (taskType === '每日') {
    schedule = `每日 ${time} 执行`
  } else if (taskType === '每周') {
    const weekdayTokens = parts[0] ? parts[0].split(',').map((s) => s.trim().toUpperCase()) : []
    const dayLabels = weekdayTokens.map((v) => WEEKDAY_OPTIONS.find((o) => o.value === v)?.label || v).join('、')
    schedule = `每周${dayLabels} ${time} 执行`
  } else if (taskType === '每月') {
    const dayTokens = parts[0] ? parts[0].split(',').map((s) => s.trim()) : []
    const dayLabels = dayTokens.map((v) => v + '号').join('、')
    schedule = `每月${dayLabels} ${time} 执行`
  }

  if (startTime) schedule += `，从 ${startTime}`
  if (endTime) schedule += ` 到 ${endTime}`

  return schedule
}

const getResultMeta = (task) => {
  if (String(task.last_execute_result || '').includes('失败')) {
    return {
      label: '失败',
      labelText: 'text-rose-700',
    }
  }

  if (task.task_status === '已结束') {
    return {
      label: '已结束',
      labelText: 'text-slate-500',
    }
  }

  if (!task.last_execute_result) {
    return {
      label: '暂无',
      labelText: 'text-gray-400',
    }
  }

  return {
    label: '成功',
    labelText: 'text-emerald-700',
  }
}

const buildExecutionPreview = (value) => {
  const normalized = String(value || '').replace(/\s+/g, ' ').trim()
  if (!normalized) {
    return '暂无执行结果'
  }

  const sentences = normalized
    .split(/(?<=[。！？!?])\s+|(?<=\.)\s+(?=[A-Z])|\s*(?=\d+\.)/)
    .map((item) => item.trim())
    .filter(Boolean)

  if (sentences.length <= 3 && normalized.length <= 180) {
    return normalized
  }

  const previewSentences = []
  let currentLength = 0

  for (const sentence of sentences) {
    previewSentences.push(sentence)
    currentLength += sentence.length
    if (previewSentences.length >= 3 || currentLength >= 180) {
      break
    }
  }

  const preview = previewSentences.join(' ').trim() || normalized.slice(0, 180).trim()
  return preview.length < normalized.length ? `${preview}...` : preview
}

const THREE_LINE_CLAMP_STYLE = {
  display: '-webkit-box',
  WebkitBoxOrient: 'vertical',
  WebkitLineClamp: 3,
  overflow: 'hidden',
}

const AutomationTaskListPage = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const [activeTab, setActiveTab] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [cycleFilter, setCycleFilter] = useState('all')
  const [isTaskPanelOpen, setIsTaskPanelOpen] = useState(false)
  const [editingTaskId, setEditingTaskId] = useState(null)
  const [tasks, setTasks] = useState([])
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showAddDropdown, setShowAddDropdown] = useState(false)
  const [showChatEmployeeDialog, setShowChatEmployeeDialog] = useState(false)
  const [selectedChatEmployeeId, setSelectedChatEmployeeId] = useState('')
  const [chatEmployeeSearchQuery, setChatEmployeeSearchQuery] = useState('')
  const [panelError, setPanelError] = useState('')
  const [recommendationError, setRecommendationError] = useState('')
  const [recommendationLoading, setRecommendationLoading] = useState(false)
  const [recommendedEmployees, setRecommendedEmployees] = useState([])
  const [hasManualEmployeeOverride, setHasManualEmployeeOverride] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [actionTaskId, setActionTaskId] = useState('')
  const [deleteDialogTask, setDeleteDialogTask] = useState(null)
  const [taskForm, setTaskForm] = useState(createEmptyTaskForm())
  const [resultSummary, setResultSummary] = useState({ unreadCount: 0, notices: [] })

  const employeeOptions = useMemo(
    () => employees.map((employee) => toEmployeeOption(employee)),
    [employees]
  )

  const filteredChatEmployeeOptions = useMemo(() => {
    const normalizedQuery = chatEmployeeSearchQuery.trim().toLowerCase()
    if (!normalizedQuery) return employeeOptions

    return employeeOptions.filter((employee) => {
      const name = String(employee.name || '').toLowerCase()
      const sourceLabel = String(employee.sourceLabel || '').toLowerCase()
      return name.includes(normalizedQuery) || sourceLabel.includes(normalizedQuery)
    })
  }, [chatEmployeeSearchQuery, employeeOptions])

  const selectedEmployee = useMemo(
    () => employeeOptions.find((employee) => employee.id === taskForm.employee_id) || employeeOptions[0] || null,
    [employeeOptions, taskForm.employee_id]
  )

  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      setError('')
      try {
        const [taskData, employeeResponse] = await Promise.all([
          listAutomationTasks({ user_id: 'U10023', include_deleted: false, limit: 500 }),
          axios.get(buildApiUrl('/ai-employees/')),
        ])
        setTasks(taskData)
        setEmployees(Array.isArray(employeeResponse.data) ? employeeResponse.data : [])
      } catch (requestError) {
        console.error('Failed to load automation task data:', requestError)
        setError('自动化任务数据加载失败，请稍后重试。')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  useEffect(() => {
    let cancelled = false

    const loadUnreadResults = async () => {
      try {
        const summary = await getAutomationTaskResultSummary({
          user_id: 'U10023',
          unread_only: true,
          limit: 3,
        })
        if (cancelled) {
          return
        }
        setResultSummary(summary)
        if (summary.unreadCount > 0) {
          await markAutomationTaskResultsRead({
            user_id: 'U10023',
            execution_ids: summary.notices.map((item) => item.execution_id),
          })
          window.dispatchEvent(new CustomEvent(AUTOMATION_RESULTS_READ_EVENT, { detail: { unreadCount: 0 } }))
        }
      } catch (requestError) {
        if (!cancelled) {
          console.error('Failed to load automation unread results:', requestError)
        }
      }
    }

    loadUnreadResults()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!taskForm.employee_id && employeeOptions.length > 0) {
      setTaskForm((prev) => ({ ...prev, employee_id: employeeOptions[0].id }))
    }
  }, [employeeOptions, taskForm.employee_id])

  useEffect(() => {
    if (editingTaskId) {
      return
    }
    if (hasManualEmployeeOverride) {
      return
    }
    if (recommendedEmployees.length === 0) {
      return
    }

    const topRecommendedEmployee = recommendedEmployees[0]
    if (topRecommendedEmployee?.id && taskForm.employee_id !== topRecommendedEmployee.id) {
      setTaskForm((prev) => ({ ...prev, employee_id: topRecommendedEmployee.id }))
    }
  }, [editingTaskId, hasManualEmployeeOverride, recommendedEmployees, taskForm.employee_id])

  useEffect(() => {
    const normalizedContent = String(taskForm.task_content || '').trim()
    if (!normalizedContent) {
      setRecommendedEmployees([])
      setRecommendationError('')
      setRecommendationLoading(false)
      return undefined
    }

    const timer = window.setTimeout(async () => {
      setRecommendationLoading(true)
      setRecommendationError('')
      try {
        const recommendations = await recommendAutomationEmployees(normalizedContent, 1)
        setRecommendedEmployees(Array.isArray(recommendations) ? recommendations.slice(0, 1) : [])
      } catch (requestError) {
        console.error('Failed to fetch employee recommendations:', requestError)
        setRecommendationError('数字员工推荐失败，请稍后重试。')
        setRecommendedEmployees([])
      } finally {
        setRecommendationLoading(false)
      }
    }, 250)

    return () => {
      window.clearTimeout(timer)
    }
  }, [taskForm.task_content])

  useEffect(() => {
    if (location.pathname === '/automation-tasks/new') {
      setEditingTaskId(null)
      setPanelError('')
      setTaskForm(createEmptyTaskForm(employeeOptions[0]?.id || ''))
      setIsTaskPanelOpen(true)
    } else if (!editingTaskId) {
      setIsTaskPanelOpen(false)
    }
  }, [employeeOptions, editingTaskId, location.pathname])

  const refreshTasks = async () => {
    const taskData = await listAutomationTasks({ user_id: 'U10023', include_deleted: false, limit: 500 })
    setTasks(taskData)
  }

  const openCreatePanel = () => {
    setEditingTaskId(null)
    setPanelError('')
    setRecommendationError('')
    setRecommendedEmployees([])
    setHasManualEmployeeOverride(false)
    setTaskForm(createEmptyTaskForm(employeeOptions[0]?.id || ''))
    navigate('/automation-tasks/new')
  }

  const openEditPanel = (task) => {
    setEditingTaskId(task.task_id)
    setTaskForm(getTaskFormFromTask(task))
    setPanelError('')
    setRecommendationError('')
    setHasManualEmployeeOverride(true)
    setIsTaskPanelOpen(true)
  }

  const closeTaskPanel = () => {
    setPanelError('')
    setRecommendationError('')
    setEditingTaskId(null)
    setHasManualEmployeeOverride(false)
    if (location.pathname === '/automation-tasks/new') {
      navigate('/automation-tasks')
      return
    }
    setIsTaskPanelOpen(false)
  }

  const updateTaskForm = (field, value) => {
    if (field === 'employee_id') {
      setHasManualEmployeeOverride(true)
    }
    setTaskForm((prev) => ({ ...prev, [field]: value }))
  }

  const resolveEmployeeName = (employeeId) => {
    const matchedEmployee = employeeOptions.find((employee) => employee.id === String(employeeId))
    return matchedEmployee?.name || String(employeeId || '-')
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    setPanelError('')

    try {
      const payload = buildTaskPayload(taskForm, employeeOptions)
      if (editingTaskId) {
        await updateAutomationTask(editingTaskId, payload)
      } else {
        await createAutomationTask(payload)
      }
      await refreshTasks()
      closeTaskPanel()
    } catch (requestError) {
      console.error('Failed to save automation task:', requestError)
      setPanelError(requestError?.response?.data?.detail || requestError.message || '任务保存失败，请稍后重试。')
    } finally {
      setSubmitting(false)
    }
  }

  const handleTaskAction = async (task, action) => {
    const actionLabel = action === 'pause' ? '暂停' : action === 'start' ? '开始' : '删除'
    if (action === 'delete') {
      setDeleteDialogTask(task)
      return
    }

    setActionTaskId(task.task_id)
    setError('')
    try {
      if (action === 'pause') {
        await pauseAutomationTask(task.task_id)
      } else if (action === 'start') {
        await startAutomationTask(task.task_id)
      } else {
        await deleteAutomationTask(task.task_id)
      }
      await refreshTasks()
    } catch (requestError) {
      console.error(`Failed to ${actionLabel} automation task:`, requestError)
      setError(requestError?.response?.data?.detail || `${actionLabel}任务失败，请稍后重试。`)
    } finally {
      setActionTaskId('')
    }
  }

  const handleConfirmDeleteTask = async () => {
    if (!deleteDialogTask) {
      return
    }

    setActionTaskId(deleteDialogTask.task_id)
    setError('')
    try {
      await deleteAutomationTask(deleteDialogTask.task_id)
      await refreshTasks()
      setDeleteDialogTask(null)
    } catch (requestError) {
      console.error('Failed to delete automation task:', requestError)
      setError(requestError?.response?.data?.detail || '删除任务失败，请稍后重试。')
    } finally {
      setActionTaskId('')
    }
  }

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      const matchesTab =
        activeTab === 'all'
          ? true
          : activeTab === 'enabled'
            ? task.task_status === '启用'
            : activeTab === 'paused'
              ? task.task_status === '暂停'
              : task.task_status === '已结束'

      const matchesCycle = cycleFilter === 'all' ? true : task.task_type === cycleFilter

      const keyword = searchQuery.trim().toLowerCase()
      const matchesSearch =
        !keyword ||
        [task.task_name, task.task_content, resolveEmployeeName(task.employee_id), task.last_execute_result]
          .join(' ')
          .toLowerCase()
          .includes(keyword)

      return matchesTab && matchesCycle && matchesSearch
    })
  }, [activeTab, cycleFilter, searchQuery, tasks])

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar
        onSelectMember={(id) => navigate('/chat-workspace', { state: { activeMember: id } })}
        onAddEmployee={() => navigate('/add-silicon-worker')}
      />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="border-b border-gray-200 bg-white px-8 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">任务列表</h1>
            </div>

            <div className="relative">
              <button
                type="button"
                onClick={() => setShowAddDropdown(!showAddDropdown)}
                className="rounded-full bg-[#f40b0b] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-[#de1010] flex items-center gap-1"
              >
                添加任务
                <svg className={`h-4 w-4 transition-transform ${showAddDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </button>
              {showAddDropdown && (
                <div className="absolute right-0 mt-2 w-48 rounded-xl border border-gray-200 bg-white shadow-lg z-50 py-1">
                  <button
                    type="button"
                    onClick={() => { setShowAddDropdown(false); openCreatePanel(); }}
                    className="w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition text-left"
                  >
                    手动任务添加
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowAddDropdown(false); setShowChatEmployeeDialog(true); }}
                    className="w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition text-left"
                  >
                    通过对话添加
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-8">
          {resultSummary.unreadCount > 0 && resultSummary.notices.length > 0 && (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <div className="font-medium">你有 {resultSummary.unreadCount} 条新的任务结果</div>
              <div className="mt-2 space-y-1 text-xs leading-5 text-amber-700">
                {resultSummary.notices.map((notice) => (
                  <div key={notice.execution_id} style={THREE_LINE_CLAMP_STYLE}>
                    {notice.task_name}：{buildExecutionPreview(notice.result_text)}
                  </div>
                ))}
              </div>
            </div>
          )}

          {error && (
            <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          )}

          <div className="mb-6 flex items-center justify-between gap-4">
            <div className="flex h-10 items-center gap-1 rounded-lg bg-gray-100 p-1">
              {[
                { key: 'all', label: '全部' },
                { key: 'enabled', label: '启用中' },
                { key: 'paused', label: '暂停' },
                { key: 'ended', label: '已结束' },
              ].map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`inline-flex h-8 items-center rounded-md px-4 text-sm font-medium transition-all ${
                    activeTab === tab.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3">
              <select
                value={cycleFilter}
                onChange={(event) => setCycleFilter(event.target.value)}
                className="h-10 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:border-[#6266EA] focus:outline-none focus:ring-2 focus:ring-[#6266EA]/20"
              >
                <option value="all">全部周期</option>
                {TASK_TYPE_OPTIONS.map((taskType) => (
                  <option key={taskType} value={taskType}>{taskType}</option>
                ))}
              </select>

              <div className="relative h-10">
                <Icon name="search" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="搜索任务名称、员工或执行结果"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  className="h-10 w-72 rounded-lg border border-gray-200 pl-9 pr-4 text-sm text-gray-700 focus:border-[#6266EA] focus:outline-none focus:ring-2 focus:ring-[#6266EA]/20"
                />
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            <table className="w-full">
              <thead className="border-b border-gray-200 bg-gray-50">
                <tr>
                  <th className="px-6 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">任务名称</th>
                  <th className="px-6 py-3.5 text-center text-xs font-semibold uppercase tracking-wider text-gray-500">状态</th>
                  <th className="px-6 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 whitespace-nowrap">执行周期</th>
                  <th className="px-6 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 whitespace-nowrap">数字员工</th>
                  <th className="px-6 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 whitespace-nowrap">最新执行结果</th>
                  <th className="w-[180px] px-4 py-3.5 text-center text-xs font-semibold uppercase tracking-wider text-gray-500">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-12 text-center text-sm text-gray-500">
                      正在加载自动化任务...
                    </td>
                  </tr>
                ) : filteredTasks.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-12 text-center text-sm text-gray-500">
                      当前筛选条件下没有自动化任务
                    </td>
                  </tr>
                ) : (
                  filteredTasks.map((task) => {
                    const meta = statusMeta[task.task_status] || statusMeta.已结束
                    const resultMeta = getResultMeta(task)
                    return (
                      <tr
                        key={task.task_id}
                        className={`transition-colors hover:bg-gray-50 ${task.task_status === '已结束' ? 'bg-slate-50/50' : ''}`}
                      >
                        <td className="px-6 py-3.5 align-top text-left">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <div className="truncate text-sm font-semibold text-gray-900">{task.task_name}</div>
                            </div>
                            <div className="mt-1 max-w-[320px] text-xs leading-5 text-gray-500">{task.task_content}</div>
                          </div>
                        </td>
                        <td className="px-6 py-3.5 align-middle text-center">
                          <div className={`text-xs font-medium ${meta.text}`}>{meta.label}</div>
                        </td>
                        <td className="px-6 py-3.5 align-middle text-left text-xs text-gray-600">
                          <div className="whitespace-nowrap">{buildScheduleDescription(task)}</div>
                        </td>
                        <td className="px-6 py-3.5 align-middle text-left text-xs leading-5 text-gray-700">{resolveEmployeeName(task.employee_id)}</td>
                        <td className="px-6 py-3.5 align-middle text-left">
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-medium ${getResultMeta(task).labelText}`}>
                              {getResultMeta(task).label}
                            </span>
                          </div>
                        </td>
                        <td className="w-[180px] px-4 py-3.5 align-middle text-center">
                          <div className="flex items-center justify-center whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              {task.task_status === '启用' ? (
                                <button
                                  className="rounded-md border border-amber-200 bg-amber-50 p-1.5 text-amber-600 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                                  title="暂停"
                                  disabled={actionTaskId === task.task_id}
                                  onClick={() => handleTaskAction(task, 'pause')}
                                >
                                  <Icon name="pause" className="h-3.5 w-3.5" />
                                </button>
                              ) : task.task_status === '暂停' ? (
                                <button
                                  className="rounded-md border border-emerald-200 bg-emerald-50 p-1.5 text-emerald-600 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                                  title="开始"
                                  disabled={actionTaskId === task.task_id}
                                  onClick={() => handleTaskAction(task, 'start')}
                                >
                                  <Icon name="play" className="h-3.5 w-3.5" />
                                </button>
                              ) : null}
                              <button
                                className="rounded-md border border-gray-200 p-1.5 text-gray-600 transition hover:bg-gray-50"
                                title="编辑"
                                onClick={() => openEditPanel(task)}
                              >
                                <Icon name="edit" className="h-3.5 w-3.5" />
                              </button>
                              <button
                                className="rounded-md border border-emerald-200 bg-emerald-50 p-1.5 text-emerald-600 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                                title="自动执行"
                                disabled={actionTaskId === task.task_id}
                                onClick={() => handleTaskAction(task, 'start')}
                              >
                                <Icon name="play" className="h-3.5 w-3.5" />
                              </button>
                            </div>
                            <div className="ml-2 pl-2 border-l border-gray-100">
                              <button
                                className="rounded-md border border-gray-200 p-1.5 text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                                title="删除"
                                disabled={actionTaskId === task.task_id}
                                onClick={() => handleTaskAction(task, 'delete')}
                              >
                                <Icon name="trash" className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </main>
      </div>

      {isTaskPanelOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-slate-900/20" onClick={closeTaskPanel} />
          <aside className="fixed right-0 top-0 z-50 flex h-full w-full max-w-[480px] flex-col border-l border-gray-200 bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-gray-200 px-6 py-5">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">{editingTaskId ? '编辑任务' : '添加任务'}</h2>

              </div>
              <button
                type="button"
                onClick={closeTaskPanel}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition hover:bg-gray-50"
              >
                <Icon name="x" className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6">
              <section className="space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">基础信息</h3>

                </div>

                {panelError && (
                  <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs leading-5 text-rose-700">
                    {panelError}
                  </div>
                )}

                <label className="block space-y-2">
                  <span className="text-xs font-medium text-gray-700">任务名称</span>
                  <input
                    type="text"
                    value={taskForm.task_name}
                    onChange={(event) => updateTaskForm('task_name', event.target.value)}
                    placeholder="例如：每周 AI 行业简报"
                    className="h-10 w-full rounded-xl border border-gray-200 px-3 text-sm text-gray-800 outline-none transition focus:border-[#f0bbb6] focus:ring-4 focus:ring-[#fff1ef]"
                  />
                </label>

                <label className="block space-y-2">
                  <span className="text-xs font-medium text-gray-700">任务内容</span>
                  <textarea
                    value={taskForm.task_content}
                    onChange={(event) => updateTaskForm('task_content', event.target.value)}
                    rows={4}
                    placeholder="描述需要数字员工做什么"
                    className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm leading-6 text-gray-800 outline-none transition focus:border-[#f0bbb6] focus:ring-4 focus:ring-[#fff1ef]"
                  />
                </label>

                {/* 推荐数字员工功能已隐藏 */}
                <div className="space-y-2 hidden">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-700">推荐数字员工</span>
                    <span className="text-xs text-gray-400">填写任务内容后自动推荐</span>
                  </div>
                  <div className="space-y-2">
                    {recommendedEmployees.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-3 text-xs leading-5 text-gray-500">
                        {recommendationLoading
                          ? '正在基于任务内容推荐数字员工...'
                          : recommendationError
                            ? recommendationError
                            : employeeOptions.length === 0
                          ? '当前没有可用数字员工，请先创建数字员工。'
                          : '请输入任务内容，系统会自动解析任务意图并推荐合适的数字员工。'}
                      </div>
                    ) : (
                      recommendedEmployees.map((employee) => {
                        const isSelected = employee.id === taskForm.employee_id
                        return (
                          <button
                            key={employee.id}
                            type="button"
                            onClick={() => updateTaskForm('employee_id', employee.id)}
                            className={`w-full rounded-xl border px-4 py-3 text-left transition ${
                              isSelected
                                ? 'border-[#f3b4ac] bg-[#fff6f4] shadow-sm'
                                : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <div className="text-sm font-medium text-gray-900">{employee.name}</div>
                                <div className="mt-1 text-xs text-gray-500">{employee.sourceLabel}</div>
                              </div>
                              {isSelected && <div className="text-xs font-medium text-[#d94841]">已选择</div>}
                            </div>
                            <div className="mt-2 text-xs leading-5 text-gray-500">{employee.recommendationReason || employee.description || employee.roleTitle || '适合处理当前类型的自动化任务。'}</div>
                            <div className="mt-3 space-y-3">
                              <CapabilityGroup label="Tool" items={employee.tools.length > 0 ? employee.tools : ['未配置']} />
                              <CapabilityGroup label="Workflow" items={employee.workflows.length > 0 ? employee.workflows : ['未配置']} />
                              <CapabilityGroup label="Knowledge" items={employee.knowledgeBases.length > 0 ? employee.knowledgeBases : ['未配置']} />
                            </div>
                          </button>
                        )
                      })
                    )}
                  </div>
                </div>

                <label className="block space-y-2">
                  <span className="text-xs font-medium text-gray-700">选择数字员工</span>
                  <select
                    value={taskForm.employee_id}
                    onChange={(event) => updateTaskForm('employee_id', event.target.value)}
                    className="h-10 w-full rounded-xl border border-gray-200 px-3 text-sm text-gray-800 outline-none transition focus:border-[#f0bbb6] focus:ring-4 focus:ring-[#fff1ef]"
                  >
                    {employeeOptions.map((employee) => (
                      <option key={employee.id} value={employee.id}>
                        {employee.name} · {employee.sourceLabel}
                      </option>
                    ))}
                  </select>

                </label>
              </section>

              <section className="space-y-4 border-t border-gray-100 pt-6">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">周期配置</h3>

                </div>

                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block space-y-2">
                      <span className="text-xs font-medium text-gray-700">周期类型</span>
                      <select
                        value={taskForm.task_type}
                        onChange={(event) => updateTaskForm('task_type', event.target.value)}
                        className="h-10 w-full rounded-xl border border-gray-200 px-3 text-sm text-gray-800 outline-none transition focus:border-[#f0bbb6] focus:ring-4 focus:ring-[#fff1ef]"
                      >
                        {TASK_TYPE_OPTIONS.map((taskType) => (
                          <option key={taskType} value={taskType}>{taskType}</option>
                        ))}
                      </select>
                    </label>

                    {taskForm.task_type === '每周' && (
                      <MultiSelectDropdown
                        label="每周执行日"
                        options={WEEKDAY_OPTIONS}
                        selectedValues={taskForm.weekly_days || []}
                        onChange={(values) => updateTaskForm('weekly_days', values)}
                      />
                    )}

                    {taskForm.task_type === '每月' && (
                      <MultiSelectDropdown
                        label="每月执行日"
                        options={MONTH_DAY_OPTIONS}
                        selectedValues={taskForm.monthly_days || []}
                        onChange={(values) => updateTaskForm('monthly_days', values)}
                      />
                    )}

                    {taskForm.task_type !== '每周' && taskForm.task_type !== '每月' && <div />}
                  </div>

                  <label className="block space-y-2">
                    <span className="text-xs font-medium text-gray-700">执行时间</span>
                    <input
                      type="time"
                      value={taskForm.execute_time}
                      onChange={(event) => updateTaskForm('execute_time', event.target.value)}
                      className="h-10 w-full rounded-xl border border-gray-200 px-3 text-sm text-gray-800 outline-none transition focus:border-[#f0bbb6] focus:ring-4 focus:ring-[#fff1ef]"
                    />
                  </label>

                  <div className="grid grid-cols-2 gap-3">
                    <label className="block space-y-2">
                      <span className="text-xs font-medium text-gray-700">开始日期</span>
                      <input
                        type="date"
                        value={taskForm.start_date}
                        onChange={(event) => updateTaskForm('start_date', event.target.value)}
                        className="h-10 w-full rounded-xl border border-gray-200 px-3 text-sm text-gray-800 outline-none transition focus:border-[#f0bbb6] focus:ring-4 focus:ring-[#fff1ef]"
                      />
                    </label>

                    <label className="block space-y-2">
                      <span className="text-xs font-medium text-gray-700">结束日期</span>
                      <input
                        type="date"
                        value={taskForm.end_date}
                        onChange={(event) => updateTaskForm('end_date', event.target.value)}
                        className="h-10 w-full rounded-xl border border-gray-200 px-3 text-sm text-gray-800 outline-none transition focus:border-[#f0bbb6] focus:ring-4 focus:ring-[#fff1ef]"
                      />
                    </label>
                  </div>
                </div>

                <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-3 text-xs leading-5 text-gray-500">
                  {taskForm.task_type === '每日' && `每日 ${taskForm.execute_time || '--:--'} 执行${taskForm.start_date ? `，从 ${taskForm.start_date}` : ''}${taskForm.end_date ? ` 到 ${taskForm.end_date}` : ''}`}
                  {taskForm.task_type === '每周' && `每周${(taskForm.weekly_days || []).map((v) => WEEKDAY_OPTIONS.find((o) => o.value === v)?.label || v).join('、')} ${taskForm.execute_time || '--:--'} 执行${taskForm.start_date ? `，从 ${taskForm.start_date}` : ''}${taskForm.end_date ? ` 到 ${taskForm.end_date}` : ''}`}
                  {taskForm.task_type === '每月' && `每月 ${(taskForm.monthly_days || []).map((v) => v + '号').join('、')} ${taskForm.execute_time || '--:--'} 执行${taskForm.start_date ? `，从 ${taskForm.start_date}` : ''}${taskForm.end_date ? ` 到 ${taskForm.end_date}` : ''}`}
                  {taskForm.task_type === '单次' && `在 ${taskForm.start_date || '未设定'} ${taskForm.execute_time || '--:--'} 执行一次`}
                </div>
              </section>

            </div>

            <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-4">
              <button
                type="button"
                onClick={closeTaskPanel}
                className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting || employeeOptions.length === 0}
                className="rounded-full bg-[#f40b0b] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-[#de1010] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? '保存中...' : editingTaskId ? '保存任务' : '创建任务'}
              </button>
            </div>
          </aside>
        </>
      )}

      {deleteDialogTask && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/30 px-4">
          <div className="w-full max-w-[760px] rounded-[28px] bg-white px-8 pb-8 pt-6 shadow-[0_24px_80px_rgba(15,23,42,0.18)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-[22px] font-semibold text-slate-900">删除 {deleteDialogTask.task_name}?</h2>
                <p className="mt-6 text-[18px] leading-8 text-slate-700">
                  此操作将永久删除该自动化任务并停止所有后续运行。
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDeleteDialogTask(null)}
                className="flex h-10 w-10 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100"
              >
                <Icon name="x" className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-10 flex justify-end gap-4">
              <button
                type="button"
                onClick={() => setDeleteDialogTask(null)}
                className="min-w-[120px] rounded-[18px] border border-slate-300 bg-white px-6 py-3 text-[18px] font-medium text-slate-700 transition hover:bg-slate-50"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteTask}
                disabled={actionTaskId === deleteDialogTask.task_id}
                className="min-w-[240px] rounded-[18px] bg-rose-100 px-8 py-3 text-[18px] font-medium text-rose-500 transition hover:bg-rose-200 disabled:cursor-not-allowed disabled:opacity-60"
              >
                删除自动化任务
              </button>
            </div>
          </div>
        </div>
      )}

      {showChatEmployeeDialog && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/30 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900">选择数字员工</h3>
            <p className="mt-1 text-sm text-gray-500">选择一个数字员工，通过对话方式创建定时任务</p>
            <div className="relative mt-4">
              <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={chatEmployeeSearchQuery}
                onChange={(event) => setChatEmployeeSearchQuery(event.target.value)}
                placeholder="搜索数字员工"
                className="h-11 w-full rounded-xl border border-gray-200 bg-white pl-10 pr-3 text-sm text-gray-800 outline-none transition focus:border-[#f0bbb6] focus:ring-4 focus:ring-[#fff1ef]"
              />
            </div>
            <div className="mt-4 space-y-2 max-h-[320px] overflow-y-auto">
              {filteredChatEmployeeOptions.map((employee) => (
                <button
                  key={employee.id}
                  type="button"
                  onClick={() => setSelectedChatEmployeeId(employee.id)}
                  className={`w-full rounded-xl border px-4 py-3 text-left transition ${
                    selectedChatEmployeeId === employee.id
                      ? 'border-[#f3b4ac] bg-[#fff6f4]'
                      : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="text-sm font-medium text-gray-900">{employee.name}</div>
                  <div className="mt-1 text-xs text-gray-500">{employee.sourceLabel}</div>
                </button>
              ))}
              {filteredChatEmployeeOptions.length === 0 && (
                <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
                  未找到匹配的数字员工
                </div>
              )}
            </div>
            <div className="mt-5 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowChatEmployeeDialog(false)
                  setSelectedChatEmployeeId('')
                  setChatEmployeeSearchQuery('')
                }}
                className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!selectedChatEmployeeId) return
                  setShowChatEmployeeDialog(false)
                  setSelectedChatEmployeeId('')
                  setChatEmployeeSearchQuery('')
                  navigate('/chat-workspace', {
                    state: {
                      activeMember: selectedChatEmployeeId,
                      prefillInput: '让我们一起创建一个定时任务吧。首先，请向我介绍定时任务的功能和使用方法，然后逐步引导我确定需要定时执行的任务内容和执行时间安排。',
                      automationSetup: true,
                    },
                  })
                }}
                disabled={!selectedChatEmployeeId}
                className="rounded-full bg-[#f40b0b] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-[#de1010] disabled:cursor-not-allowed disabled:opacity-60"
              >
                开始对话
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AutomationTaskListPage