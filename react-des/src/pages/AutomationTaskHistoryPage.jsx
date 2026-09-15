import React, { useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import { useLocation, useNavigate } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import { buildApiUrl } from '../config/api'
import {
  AUTOMATION_RESULTS_READ_EVENT,
  EXECUTION_STATUS_META,
  formatDateTime,
  getAutomationTaskResultSummary,
  getExecutionDuration,
  listAutomationTaskExecutions,
  listAutomationTasks,
  markAutomationTaskResultsRead,
  toEmployeeOption,
} from '../utils/automationTasks'

const Icon = ({ name, className = 'w-4 h-4' }) => {
  const icons = {
    search: <circle cx="11" cy="11" r="8"></circle>,
    history: <path d="M3 3v5h5"></path>,
    x: <g><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></g>,
    arrowLeft: <path d="M19 12H5"></path>,
    fileText: <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>,
    messageSquare: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>,
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
      {icons[name] || icons.fileText}
      {name === 'search' && <line x1="21" y1="21" x2="16.65" y2="16.65"></line>}
      {name === 'history' && <path d="M3.05 11A9 9 0 1 1 6 17.3L3 14"></path>}
      {name === 'arrowLeft' && <path d="m12 19-7-7 7-7"></path>}
      {name === 'fileText' && <polyline points="14 2 14 8 20 8"></polyline>}
      {name === 'alert' && <line x1="12" y1="9" x2="12" y2="13"></line>}
      {name === 'alert' && <line x1="12" y1="17" x2="12.01" y2="17"></line>}
    </svg>
  )
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

const EMPTY_EXECUTION_RESULT_TEXT = '本次执行未产出结果'

const createFreshExecutionChatSessionId = () => Date.now() + Math.floor(Math.random() * 1000)

const buildAutomationTaskChatId = (employeeId, taskId) => {
  const normalizedEmployeeId = String(employeeId || '').trim()
  const normalizedTaskId = String(taskId || '').trim()
  if (!normalizedEmployeeId || !normalizedTaskId) {
    return createFreshExecutionChatSessionId()
  }

  let stableHash = 0
  const seed = `automation-task-chat:${normalizedTaskId}:${normalizedEmployeeId}`
  for (let index = 0; index < seed.length; index += 1) {
    stableHash = ((stableHash << 5) - stableHash + seed.charCodeAt(index)) >>> 0
  }
  return (stableHash % 2_000_000_000) + 1
}

const getExecutionResultText = (record) => {
  const normalizedResult = String(record?.result_summary || '').trim()
  if (normalizedResult) {
    return normalizedResult
  }

  return EMPTY_EXECUTION_RESULT_TEXT
}

const hasExecutionResult = (record) => Boolean(String(record?.result_summary || '').trim())

const AutomationTaskHistoryPage = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const [taskKeyword, setTaskKeyword] = useState(() => location.state?.taskName || '')
  const [taskTypeFilter, setTaskTypeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [records, setRecords] = useState([])
  const [tasks, setTasks] = useState([])
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedRecord, setSelectedRecord] = useState(null)
  const [resultSummary, setResultSummary] = useState({ unreadCount: 0, notices: [] })
  const [navigationToast, setNavigationToast] = useState(null)

  const employeeOptions = useMemo(
    () => employees.map((employee) => toEmployeeOption(employee)),
    [employees]
  )

  const employeeMap = useMemo(
    () => Object.fromEntries(employeeOptions.map((employee) => [employee.id, employee])),
    [employeeOptions]
  )

  const taskMap = useMemo(
    () => Object.fromEntries(tasks.map((task) => [task.task_id, task])),
    [tasks]
  )

  const openExecutionChatRecord = (record) => {
    if (!record?.employee_id || !record?.execution_id) {
      setNavigationToast({ id: Date.now(), message: '当前执行记录缺少可跳转的数字员工信息，暂时无法定位。' })
      return
    }

    if (['失败', '重试中', '已跳过'].includes(String(record.execute_status || '').trim())) {
      const taskName = taskMap[record.task_id]?.task_name || '该任务'
      setNavigationToast({ id: Date.now(), message: `《${taskName}》本次执行失败或未完成，不支持跳转到数字员工对话。` })
      return
    }

    const taskId = record.task_id
    const stableChatId = buildAutomationTaskChatId(String(record.employee_id), taskId)
    navigate('/chat-workspace', {
      state: {
        activeMember: String(record.employee_id),
        requestedChatId: stableChatId,
        targetExecutionId: record.execution_id,
        targetExecutionStatus: record.execute_status,
        targetTaskName: taskMap[record.task_id]?.task_name || '',
        taskId,
      },
    })
  }

  useEffect(() => {
    if (location.state?.taskName) {
      setTaskKeyword(location.state.taskName)
    }
  }, [location.state])

  useEffect(() => {
    const loadReferenceData = async () => {
      try {
        const [taskData, employeeResponse] = await Promise.all([
          listAutomationTasks({ user_id: 'U10023', include_deleted: true, limit: 500 }),
          axios.get(buildApiUrl('/ai-employees/')),
        ])
        setTasks(taskData)
        setEmployees(Array.isArray(employeeResponse.data) ? employeeResponse.data : [])
      } catch (requestError) {
        console.error('Failed to load automation history reference data:', requestError)
      }
    }

    loadReferenceData()
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
    const loadExecutionRecords = async () => {
      setLoading(true)
      setError('')
      try {
        const executionData = await listAutomationTaskExecutions({
          user_id: 'U10023',
          task_type: taskTypeFilter === 'all' ? undefined : taskTypeFilter,
          execute_status: statusFilter === 'all' ? undefined : statusFilter,
          start_after: startDate ? `${startDate}T00:00:00` : undefined,
          start_before: endDate ? `${endDate}T23:59:59` : undefined,
          limit: 500,
        })
        setRecords(executionData)
      } catch (requestError) {
        console.error('Failed to load automation task executions:', requestError)
        setError('执行历史加载失败，请稍后重试。')
      } finally {
        setLoading(false)
      }
    }

    loadExecutionRecords()
  }, [endDate, startDate, statusFilter, taskTypeFilter])

  useEffect(() => {
    if (!navigationToast) {
      return undefined
    }

    const timer = window.setTimeout(() => {
      setNavigationToast((current) => (current?.id === navigationToast.id ? null : current))
    }, 3200)

    return () => window.clearTimeout(timer)
  }, [navigationToast])

  const filteredRecords = useMemo(() => {
    return records
      .filter((record) => {
      const task = taskMap[record.task_id]
      const employee = employeeMap[String(record.employee_id)]
      const taskName = task?.task_name || record.task_id
      const employeeName = employee?.name || String(record.employee_id || '-')

      const matchesKeyword =
        !taskKeyword.trim() ||
        [taskName, record.task_type, employeeName, record.result_summary, record.error_message]
          .join(' ')
          .toLowerCase()
          .includes(taskKeyword.trim().toLowerCase())

      return matchesKeyword
    })
      .sort((left, right) => String(right.start_time || right.planned_execute_time || '').localeCompare(String(left.start_time || left.planned_execute_time || '')))
  }, [employeeMap, records, taskKeyword, taskMap])

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
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => navigate('/automation-tasks')}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition hover:bg-gray-50"
                >
                  <Icon name="arrowLeft" className="h-4 w-4" />
                </button>
                <div>
                  <h1 className="text-2xl font-semibold text-gray-900">任务执行历史</h1>
                </div>
              </div>
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
            <div className="flex items-center gap-3">
              <div className="relative h-10">
                <Icon name="search" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={taskKeyword}
                  onChange={(event) => setTaskKeyword(event.target.value)}
                  placeholder="搜索任务名称、数字员工"
                  className="h-10 w-80 rounded-lg border border-gray-200 pl-9 pr-4 text-sm text-gray-700 focus:border-[#6266EA] focus:outline-none focus:ring-2 focus:ring-[#6266EA]/20"
                />
              </div>

              <select
                value={taskTypeFilter}
                onChange={(event) => setTaskTypeFilter(event.target.value)}
                className="h-10 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:border-[#6266EA] focus:outline-none focus:ring-2 focus:ring-[#6266EA]/20"
              >
                <option value="all">全部任务类型</option>
                <option value="单次">单次</option>
                <option value="每日">每日</option>
                <option value="每周">每周</option>
                <option value="每月">每月</option>
              </select>

              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="h-10 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:border-[#6266EA] focus:outline-none focus:ring-2 focus:ring-[#6266EA]/20"
              >
                <option value="all">全部状态</option>
                <option value="成功">成功</option>
                <option value="失败">失败</option>
              </select>

              <input
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
                className="h-10 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:border-[#6266EA] focus:outline-none focus:ring-2 focus:ring-[#6266EA]/20"
              />

              <input
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
                className="h-10 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:border-[#6266EA] focus:outline-none focus:ring-2 focus:ring-[#6266EA]/20"
              />
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            <table className="w-full">
              <thead className="border-b border-gray-200 bg-gray-50">
                <tr>
                  <th className="px-6 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">任务名称</th>
                  <th className="px-6 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 whitespace-nowrap">任务类型</th>
                  <th className="px-6 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 whitespace-nowrap">执行时间</th>
                  <th className="px-6 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 whitespace-nowrap">完成时间</th>
                  <th className="px-6 py-3.5 text-center text-xs font-semibold uppercase tracking-wider text-gray-500">执行状态</th>
                  <th className="px-6 py-3.5 text-center text-xs font-semibold uppercase tracking-wider text-gray-500 whitespace-nowrap">执行耗时</th>
                  <th className="px-6 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">执行结果</th>
                  <th className="px-6 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 whitespace-nowrap">数字员工</th>
                  <th className="w-[100px] px-4 py-3.5 text-center text-xs font-semibold uppercase tracking-wider text-gray-500">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan="9" className="px-6 py-12 text-center text-sm text-gray-500">
                      正在加载执行历史...
                    </td>
                  </tr>
                ) : filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="px-6 py-12 text-center text-sm text-gray-500">
                      当前筛选条件下没有执行记录
                    </td>
                  </tr>
                ) : (
                  filteredRecords.map((record) => {
                    const meta = EXECUTION_STATUS_META[record.execute_status] || EXECUTION_STATUS_META.待执行
                    const task = taskMap[record.task_id]
                    const employee = employeeMap[String(record.employee_id)]
                    const executionResultText = getExecutionResultText(record)
                    const executionResultClass = hasExecutionResult(record)
                      ? record.execute_status === '失败'
                        ? 'text-rose-700'
                        : 'text-gray-700'
                      : 'text-gray-400'
                    return (
                      <tr key={record.execution_id} className="transition-colors hover:bg-gray-50">
                        <td className="px-6 py-3.5 text-left align-top">
                          <div className="text-sm font-medium text-gray-900">{task?.task_name || record.task_id}</div>
                        </td>
                        <td className="px-6 py-3.5 text-left align-middle text-xs text-gray-600 whitespace-nowrap">{record.task_type}</td>
                        <td className="px-6 py-3.5 text-left align-middle text-xs text-gray-600 whitespace-nowrap">{formatDateTime(record.start_time || record.planned_execute_time)}</td>
                        <td className="px-6 py-3.5 text-left align-middle text-xs text-gray-600 whitespace-nowrap">{formatDateTime(record.end_time)}</td>
                        <td className="px-6 py-3.5 text-center align-middle">
                          <span className={`text-xs font-medium ${meta.text}`}>{meta.label}</span>
                        </td>
                        <td className="px-6 py-3.5 text-center align-middle text-xs text-gray-600">{getExecutionDuration(record)}</td>
                        <td className="px-6 py-3.5 text-left align-middle">
                          <div className={`max-w-[280px] text-xs leading-5 ${executionResultClass}`} style={THREE_LINE_CLAMP_STYLE}>
                            {buildExecutionPreview(executionResultText)}
                          </div>
                        </td>
                        <td className="px-6 py-3.5 text-left align-middle text-xs text-gray-700">{employee?.name || String(record.employee_id || '-')}</td>
                        <td className="w-[100px] px-4 py-3.5 text-center align-middle">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              type="button"
                              onClick={() => openExecutionChatRecord(record)}
                              className="rounded-md border border-gray-200 p-1.5 text-gray-600 transition hover:bg-gray-50"
                              title="定位到聊天记录"
                            >
                              <Icon name="messageSquare" className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setSelectedRecord(record)}
                              className="rounded-md border border-gray-200 p-1.5 text-gray-600 transition hover:bg-gray-50"
                              title="查看详情"
                            >
                              <Icon name="fileText" className="h-3.5 w-3.5" />
                            </button>
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

      {selectedRecord && (
        <>
          <div className="fixed inset-0 z-40 bg-slate-900/20" onClick={() => setSelectedRecord(null)} />
          <aside className="fixed right-0 top-0 z-50 flex h-full w-full max-w-[460px] flex-col border-l border-gray-200 bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-gray-200 px-6 py-5">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">执行详情</h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRecord(null)}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition hover:bg-gray-50"
              >
                <Icon name="x" className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6">
              <section className="space-y-3">
                <div className="text-sm font-semibold text-gray-900">基础信息</div>
                <div className="grid grid-cols-2 gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4 text-xs">
                  <div>
                    <div className="text-gray-400">任务名称</div>
                    <div className="mt-1 text-gray-800">{taskMap[selectedRecord.task_id]?.task_name || selectedRecord.task_id}</div>
                  </div>
                  <div>
                    <div className="text-gray-400">数字员工</div>
                    <div className="mt-1 text-gray-800">{employeeMap[String(selectedRecord.employee_id)]?.name || String(selectedRecord.employee_id || '-')}</div>
                  </div>
                  <div>
                    <div className="text-gray-400">执行状态</div>
                    <div className={`mt-1 ${(EXECUTION_STATUS_META[selectedRecord.execute_status] || EXECUTION_STATUS_META.待执行).text}`}>
                      {(EXECUTION_STATUS_META[selectedRecord.execute_status] || EXECUTION_STATUS_META.待执行).label}
                    </div>
                  </div>
                </div>
              </section>

              <section className="space-y-2">
                <div className="text-sm font-semibold text-gray-900">任务内容</div>
                <div className="rounded-xl border border-gray-200 px-4 py-3 text-xs leading-6 text-gray-700">
                  {taskMap[selectedRecord.task_id]?.task_content || '当前任务未返回输入内容'}
                </div>
              </section>


            </div>
          </aside>
        </>
      )}

      {navigationToast && (
        <div className="pointer-events-none fixed bottom-6 left-1/2 z-[80] -translate-x-1/2 rounded-full bg-slate-900 px-5 py-3 text-sm font-medium text-white shadow-lg">
          {navigationToast.message}
        </div>
      )}
    </div>
  )
}

export default AutomationTaskHistoryPage