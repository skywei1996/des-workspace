import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLanguage } from '../i18n'
import {
  AUTOMATION_RESULTS_READ_EVENT,
  DEFAULT_AUTOMATION_USER_ID,
  EXECUTION_STATUS_META,
  getAutomationTaskResultSummary,
  listAutomationTasks,
  listAutomationTaskExecutions,
  markAutomationTaskResultsRead,
  getExecutionDuration,
} from '../utils/automationTasks'

const STATUS_ICON = {
  成功: { emoji: '●', color: 'text-emerald-500' },
  失败: { emoji: '!', color: 'text-rose-500' },
  执行中: { emoji: '⏳', color: 'text-sky-500' },
  重试中: { emoji: '↻', color: 'text-amber-500' },
}

const ReadStateIcon = ({ unread }) => {
  if (unread > 0) {
    return (
      <span
        className="mt-0.5 inline-flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border border-[#f59e0b] bg-[#fef3c7]"
        aria-label="未读"
        title="未读"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-[#d97706]" />
      </span>
    )
  }

  return (
    <span className="mt-0.5 inline-flex h-4 w-4 flex-shrink-0 items-center justify-center text-[#16a34a]" aria-label="已读" title="已读">
      <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
      </svg>
    </span>
  )
}

const pad2 = (n) => String(n).padStart(2, '0')

// 只显示时间点，如 "今天 09:00" / "昨天 18:00" / "07/30 09:00"
const formatTimePoint = (value, isZh) => {
  if (!value) return ''
  const date = new Date(value)
  if (isNaN(date.getTime())) return ''

  const now = new Date()
  // 比较同一天（用 YYYY-MM-DD 比较）
  const dateDay = `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
  const todayDay = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayDay = `${yesterday.getFullYear()}-${pad2(yesterday.getMonth() + 1)}-${pad2(yesterday.getDate())}`

  const timeStr = `${pad2(date.getHours())}:${pad2(date.getMinutes())}`

  if (dateDay === todayDay) return isZh ? `今天 ${timeStr}` : `Today ${timeStr}`
  if (dateDay === yesterdayDay) return isZh ? `昨天 ${timeStr}` : `Yesterday ${timeStr}`
  // 超过昨天，显示 MM/DD HH:mm
  return `${pad2(date.getMonth() + 1)}/${pad2(date.getDate())} ${timeStr}`
}

// 下次执行时间：显示时间点 + 未来标记
const formatNextRunTime = (value, isZh) => {
  if (!value) return ''
  const date = new Date(value)
  if (isNaN(date.getTime())) return ''

  const now = new Date()
  const dateDay = `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
  const todayDay = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowDay = `${tomorrow.getFullYear()}-${pad2(tomorrow.getMonth() + 1)}-${pad2(tomorrow.getDate())}`

  const timeStr = `${pad2(date.getHours())}:${pad2(date.getMinutes())}`

  if (dateDay === todayDay) return isZh ? `今天 ${timeStr}` : `Today ${timeStr}`
  if (dateDay === tomorrowDay) return isZh ? `明天 ${timeStr}` : `Tomorrow ${timeStr}`
  // 更远的未来
  return `${pad2(date.getMonth() + 1)}/${pad2(date.getDate())} ${timeStr}`
}

const buildAutomationTaskChatId = (employeeId, taskId) => {
  const normalizedEmployeeId = String(employeeId || '').trim()
  const normalizedTaskId = String(taskId || '').trim()

  if (!normalizedEmployeeId || !normalizedTaskId) {
    return Date.now() + Math.floor(Math.random() * 1000)
  }

  let stableHash = 0
  const seed = `automation-task-chat:${normalizedTaskId}:${normalizedEmployeeId}`
  for (let index = 0; index < seed.length; index += 1) {
    stableHash = ((stableHash << 5) - stableHash + seed.charCodeAt(index)) >>> 0
  }
  return (stableHash % 2_000_000_000) + 1
}

export default function TaskResultsPanel({ isOpen, onClose, employeeId, employeeName }) {
  const { t, isZh } = useLanguage()
  const navigate = useNavigate()
  const [taskItems, setTaskItems] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)

  const openTaskResultInNewSession = (item) => {
    if (!employeeId) {
      return
    }

    const taskId = item?.taskId || item?.id || ''
    const targetChatId = buildAutomationTaskChatId(String(employeeId), taskId)
    const payload = {
      activeMember: String(employeeId),
      requestedChatId: targetChatId,
      targetExecutionId: item?.latestExecutionId || null,
      targetExecutionStatus: item?.status || null,
      targetTaskName: item?.name || '',
      taskId,
    }

    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem('des-force-open-task-session', JSON.stringify(payload))
    }

    window.dispatchEvent(new CustomEvent('automation-open-result-session', { detail: payload }))
    navigate('/chat-workspace', {
      state: payload,
      replace: false,
    })
  }

  useEffect(() => {
    if (!isOpen || !employeeId) return
    let cancelled = false
    setLoading(true)
    Promise.all([
      listAutomationTasks({ employee_id: employeeId, task_status: '启用' }),
      listAutomationTaskExecutions({ employee_id: employeeId, limit: 50 }),
      getAutomationTaskResultSummary({
        user_id: DEFAULT_AUTOMATION_USER_ID,
        employee_id: employeeId,
        unread_only: true,
        limit: 1,
      }),
    ])
      .then(([tasks, executions, resultSummary]) => {
        if (cancelled) return

        const execMap = {}
        for (const ex of executions) {
          const tid = ex.task_id
          if (!execMap[tid] || new Date(ex.created_at) > new Date(execMap[tid].created_at)) {
            execMap[tid] = ex
          }
        }

        const items = tasks.map((task) => {
          const latestExec = execMap[task.task_id] || null

          // 状态：只有有执行记录时才有
          const status = latestExec?.execute_status || null
          const statusLabel = status ? (EXECUTION_STATUS_META[status]?.label || status) : null
          const statusColor = status ? (EXECUTION_STATUS_META[status]?.text || 'text-gray-400') : 'text-gray-400'
          const iconMeta = status ? (STATUS_ICON[status] || { emoji: '', color: 'text-slate-400' }) : { emoji: '', color: 'text-slate-400' }

          // 本次执行时间点：有执行记录时才显示
          let execTimeText = ''
          let description = ''
          if (latestExec) {
            execTimeText = formatTimePoint(latestExec.created_at, isZh)
            description = latestExec.result_summary || latestExec.last_execute_result || ''
          }

          // 下次执行时间：有 next_execute_time 时才显示
          let nextTimeText = ''
          if (task.next_execute_time) {
            nextTimeText = formatNextRunTime(task.next_execute_time, isZh)
          }

          const unread = latestExec?.result_is_read === false ? 1 : 0
          const isFailed = status ? String(status).includes('失败') : false

          return {
            id: task.task_id,
            taskId: task.task_id,
            latestExecutionId: latestExec?.execution_id || null,
            name: task.task_name || task.task_content?.slice(0, 30) || '未命名任务',
            status,
            statusLabel,
            statusColor,
            iconEmoji: iconMeta.emoji,
            iconColor: iconMeta.color,
            execTimeText,
            nextTimeText,
            description,
            unread,
            isFailed,
            isRunning: status === '执行中',
            runningDuration: status === '执行中' && latestExec?.start_time
              ? getExecutionDuration(latestExec)
              : null,
          }
        })

        setTaskItems(items)
        setUnreadCount(resultSummary.unreadCount)
      })
      .catch((err) => {
        if (cancelled) return
        console.error('Failed to load task results:', err)
        setTaskItems([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [isOpen, employeeId, isZh])

  const handleMarkAllRead = async () => {
    try {
      if (unreadCount === 0) return
      const result = await markAutomationTaskResultsRead({
        user_id: DEFAULT_AUTOMATION_USER_ID,
        employee_id: employeeId,
      })
      setUnreadCount(result.unreadCount)
      setTaskItems((prev) => prev.map((i) => ({ ...i, unread: 0 })))
      window.dispatchEvent(new CustomEvent(AUTOMATION_RESULTS_READ_EVENT, {
        detail: { employeeId: String(employeeId), unreadCount: result.unreadCount },
      }))
    } catch (err) {
      console.error('Failed to mark read:', err)
    }
  }

  if (!isOpen) return null

  return (
    <div
      className="h-full min-w-0 border-l border-gray-200 bg-white shadow-xl transition-all duration-300 z-50 flex flex-col"
      style={{ width: 'clamp(360px, 38vw, 520px)' }}
    >
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-5 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-[#fef3f2]">
            <svg className="w-4 h-4 text-[#d94841]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" strokeWidth="2" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6l4 2" />
            </svg>
          </span>
          <h3 className="text-sm font-semibold text-black">
            {t('taskResults.title', '定时任务结果')}
          </h3>
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="px-2.5 py-1 rounded-lg text-[11px] text-gray-500 hover:text-[#d94841] hover:bg-gray-50 transition-colors cursor-pointer border-none bg-transparent"
            >
              {t('taskResults.markAllRead', '全部标为已读')}
            </button>
          )}
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-gray-100 text-black transition-all flex items-center justify-center"
            title={t('chat.workspace.close', '关闭')}
          >
            <span className="text-xl leading-none">×</span>
          </button>
        </div>
      </div>

      {/* List */}
      <div className="px-5 pb-4 overflow-y-auto flex-1 mt-3">
        {loading ? (
          <div className="text-center py-12 text-gray-400">
            <div className="animate-pulse text-[28px] mb-2">⏳</div>
            <p className="text-sm">{t('taskResults.loading', '加载中...')}</p>
          </div>
        ) : taskItems.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <div className="text-[36px] mb-3">📋</div>
            <p className="text-sm">{t('taskResults.empty', '暂无定时任务')}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {taskItems.map((item) => (
              <div
                key={item.id}
                role="button"
                tabIndex={0}
                onClick={() => openTaskResultInNewSession(item)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    openTaskResultInNewSession(item)
                  }
                }}
                className="group cursor-pointer rounded-xl bg-white px-4 py-3 transition-all duration-200 hover:bg-slate-50 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-[#fca5a5]"
              >
                <div className="flex items-start gap-2.5">
                  <ReadStateIcon unread={item.unread} />
                  {item.iconEmoji ? (
                    <span className={`flex-shrink-0 text-[13px] font-bold leading-[1.4] ${item.iconColor}`}>
                      {item.iconEmoji}
                    </span>
                  ) : null}
                  <div className="flex-1 min-w-0">
                    {/* 第一行：任务名 + 执行时间点 */}
                    <div className="flex items-center gap-1.5">
                      <span className="text-[13px] font-semibold text-gray-900 truncate">
                        {item.name}
                      </span>
                      {item.execTimeText && (
                        <span className="text-[11px] text-gray-400 ml-auto flex-shrink-0">
                          {item.execTimeText}
                        </span>
                      )}
                    </div>

                    {/* 第二行：下次执行时间 */}
                    {item.nextTimeText && (
                      <div className="text-[11px] text-gray-400 mt-0.5">
                        {isZh ? '下次执行时间' : 'Next run'}: {item.nextTimeText}
                      </div>
                    )}

                    {/* 执行中：显示运行时长 */}
                    {item.isRunning && item.runningDuration && (
                      <div className="text-[11px] text-sky-600 flex items-center gap-1 mt-0.5">
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-sky-500 animate-pulse" />
                        {isZh ? `已运行 ${item.runningDuration}` : `Running for ${item.runningDuration}`}
                      </div>
                    )}

                    {/* 结果摘要（非执行中） */}
                    {!item.isRunning && item.description && (
                      <div className="text-[11px] text-gray-500 leading-[1.5] line-clamp-2 mt-0.5">
                        {item.description}
                      </div>
                    )}

                    {/* 未读徽标 */}
                    {item.unread > 0 && (
                      <div className="mt-1 flex items-center gap-1.5">
                        <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700 ring-1 ring-inset ring-amber-200">
                          {isZh ? `${item.unread} 条未读` : `${item.unread} unread`}
                        </span>
                      </div>
                    )}

                    {/* 失败且无未读：需要处理 */}
                    {item.isFailed && !item.unread && (
                      <div className="mt-0.5 text-[10px] text-rose-500 font-medium">
                        {isZh ? '需要处理' : 'Needs attention'}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
