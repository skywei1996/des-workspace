import axios from 'axios'
import { buildApiUrl } from '../config/api'

export const DEFAULT_AUTOMATION_USER_ID = 'U10023'
export const AUTOMATION_RESULTS_READ_EVENT = 'automation-results-read'

export const TASK_TYPE_OPTIONS = ['单次', '每日', '每周', '每月']

export const WEEKDAY_OPTIONS = [
  { value: 'MON', label: '周一' },
  { value: 'TUE', label: '周二' },
  { value: 'WED', label: '周三' },
  { value: 'THU', label: '周四' },
  { value: 'FRI', label: '周五' },
  { value: 'SAT', label: '周六' },
  { value: 'SUN', label: '周日' },
]

export const MONTH_DAY_OPTIONS = Array.from({ length: 31 }, (_, index) => ({
  value: String(index + 1),
  label: `${index + 1} 号`,
}))

export const EXECUTION_STATUS_META = {
  待执行: { label: '待执行', text: 'text-slate-500' },
  执行中: { label: '执行中', text: 'text-sky-700' },
  成功: { label: '成功', text: 'text-emerald-700' },
  失败: { label: '失败', text: 'text-rose-700' },
  重试中: { label: '重试中', text: 'text-amber-700' },
  已跳过: { label: '已跳过', text: 'text-slate-500' },
}

const WEEKDAY_CODES = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

const getDefaultWeekdayCode = (value = new Date()) => WEEKDAY_CODES[safeDate(value)?.getDay() ?? new Date().getDay()]

const getDefaultMonthDay = (value = new Date()) => String(safeDate(value)?.getDate() ?? new Date().getDate())

const pad = (value) => String(value).padStart(2, '0')

const safeDate = (value) => {
  if (!value) {
    return null
  }

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export const formatDateTime = (value) => {
  const date = safeDate(value)
  if (!date) {
    return '-'
  }

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export const formatDateInputValue = (value) => {
  const date = safeDate(value)
  if (!date) {
    return ''
  }

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export const formatTimeInputValue = (value) => {
  const date = safeDate(value)
  if (!date) {
    return ''
  }

  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export const deriveEmployeeSource = (employee) => (
  employee?.access_scope === 'personal' ? 'personal_created' : 'admin_created'
)

export const deriveEmployeeSourceLabel = (employeeSource) => {
  if (employeeSource === 'personal_created') {
    return '个人创建'
  }

  if (employeeSource === 'admin_created') {
    return '管理员创建'
  }

  return '未标记'
}

export const toEmployeeOption = (employee) => ({
  id: String(employee.id),
  name: employee.name || `数字员工 ${employee.id}`,
  roleTitle: employee.role_title || '',
  description: employee.description || employee.persona_prompt || '',
  source: deriveEmployeeSource(employee),
  sourceLabel: deriveEmployeeSourceLabel(deriveEmployeeSource(employee)),
  tools: Array.isArray(employee.tool_ids) ? employee.tool_ids.filter(Boolean) : [],
  workflows: Array.isArray(employee.workflow_ids) ? employee.workflow_ids.filter(Boolean) : [],
  knowledgeBases: Array.isArray(employee.knowledge_ids) ? employee.knowledge_ids.filter(Boolean) : [],
})

export const toRecommendedEmployeeOption = (recommendation) => ({
  id: String(recommendation.id),
  name: recommendation.name || `数字员工 ${recommendation.id}`,
  roleTitle: recommendation.role_title || '',
  description: recommendation.description || recommendation.persona_prompt || '',
  source: deriveEmployeeSource({ access_scope: recommendation.access_scope }),
  sourceLabel: deriveEmployeeSourceLabel(deriveEmployeeSource({ access_scope: recommendation.access_scope })),
  tools: Array.isArray(recommendation.tool_ids) ? recommendation.tool_ids.filter(Boolean) : [],
  workflows: Array.isArray(recommendation.workflow_ids) ? recommendation.workflow_ids.filter(Boolean) : [],
  knowledgeBases: Array.isArray(recommendation.knowledge_ids) ? recommendation.knowledge_ids.filter(Boolean) : [],
  score: recommendation.score || 0,
  matchedTerms: Array.isArray(recommendation.matched_terms) ? recommendation.matched_terms : [],
  recommendationReason: recommendation.recommendation_reason || '',
})

export const createEmptyTaskForm = (defaultEmployeeId = '') => ({
  task_name: '',
  task_content: '',
  employee_id: defaultEmployeeId,
  task_type: '每周',
  execute_time: '09:00',
  start_date: formatDateInputValue(new Date()),
  end_date: '',
  weekly_days: [getDefaultWeekdayCode()],
  monthly_days: [getDefaultMonthDay()],
})

const parseExecuteRule = (taskType, executeRule, nextExecuteTime, startTime) => {
  const referenceDate = safeDate(nextExecuteTime) || safeDate(startTime)

  if (taskType === '单次') {
    const date = safeDate(executeRule)
    return {
      execute_time: formatTimeInputValue(date),
      start_date: formatDateInputValue(date),
      weekly_days: [getDefaultWeekdayCode(date)],
      monthly_days: [getDefaultMonthDay(date)],
    }
  }

  if (taskType === '每日') {
    return {
      execute_time: executeRule || '09:00',
      start_date: formatDateInputValue(referenceDate || new Date()),
      weekly_days: [getDefaultWeekdayCode(referenceDate)],
      monthly_days: [getDefaultMonthDay(referenceDate)],
    }
  }

  if (taskType === '每周') {
    const parts = String(executeRule || '').split(' ')
    const weekdayTokens = parts[0] ? parts[0].split(',').map((s) => s.trim().toUpperCase()) : []
    return {
      execute_time: parts[1] || '09:00',
      start_date: formatDateInputValue(referenceDate || new Date()),
      weekly_days: weekdayTokens.length > 0 ? weekdayTokens : [getDefaultWeekdayCode(referenceDate)],
      monthly_days: [getDefaultMonthDay(referenceDate)],
    }
  }

  if (taskType === '每月') {
    const parts = String(executeRule || '').split(' ')
    const dayTokens = parts[0] ? parts[0].split(',').map((s) => s.trim()) : []
    const baseDate = referenceDate || new Date()
    const dayValues = dayTokens.length > 0 ? dayTokens : [String(baseDate.getDate())]
    const normalizedDate = new Date(baseDate)
    normalizedDate.setDate(Number(dayValues[0]) || baseDate.getDate())

    return {
      execute_time: parts[1] || '09:00',
      start_date: formatDateInputValue(normalizedDate),
      weekly_days: [getDefaultWeekdayCode(normalizedDate)],
      monthly_days: dayValues,
    }
  }

  return {
    execute_time: '09:00',
    start_date: formatDateInputValue(referenceDate || new Date()),
    weekly_days: [getDefaultWeekdayCode(referenceDate)],
    monthly_days: [getDefaultMonthDay(referenceDate)],
  }
}

export const getTaskFormFromTask = (task) => {
  const parsed = parseExecuteRule(task.task_type, task.execute_rule, task.next_execute_time, task.start_time)
  return {
    task_name: task.task_name || '',
    task_content: task.task_content || '',
    employee_id: String(task.employee_id || ''),
    task_type: task.task_type || '每周',
    execute_time: parsed.execute_time,
    start_date: parsed.start_date,
    end_date: formatDateInputValue(task.end_time),
    weekly_days: parsed.weekly_days,
    monthly_days: parsed.monthly_days,
  }
}

export const validateTaskForm = (form) => {
  if (!String(form.task_name || '').trim()) {
    return '请填写任务名称'
  }
  if (!String(form.task_content || '').trim()) {
    return '请填写任务内容'
  }
  if (!String(form.employee_id || '').trim()) {
    return '请选择执行数字员工'
  }
  if (!String(form.execute_time || '').trim()) {
    return '请填写执行时间'
  }
  if (!String(form.start_date || '').trim()) {
    return '请选择开始日期'
  }
  if (form.task_type === '每周' && (!form.weekly_days || form.weekly_days.length === 0)) {
    return '请选择每周执行日'
  }
  if (form.task_type === '每月' && (!form.monthly_days || form.monthly_days.length === 0)) {
    return '请选择每月执行日'
  }


  return ''
}

export const buildTaskPayload = (form, employees) => {
  const validationError = validateTaskForm(form)
  if (validationError) {
    throw new Error(validationError)
  }

  const employee = employees.find((item) => item.id === String(form.employee_id))
  if (!employee) {
    throw new Error('所选数字员工不存在，请刷新页面后重试')
  }

  const startDate = safeDate(`${form.start_date}T00:00:00`)
  const endDate = form.end_date ? safeDate(`${form.end_date}T23:59:59`) : null
  if (!startDate) {
    throw new Error('开始日期格式不正确')
  }
  if (endDate && endDate < startDate) {
    throw new Error('结束日期不能早于开始日期')
  }

  let executeRule = ''
  if (form.task_type === '单次') {
    const selectedDateTime = safeDate(`${form.start_date}T${form.execute_time}:00`)
    if (!selectedDateTime) {
      throw new Error('单次任务执行时间格式不正确')
    }
    if (selectedDateTime.getTime() <= Date.now()) {
      throw new Error(`单次任务执行时间必须晚于当前时间，请至少选择下一分钟（当前时间：${formatDateTime(new Date())}）`)
    }
    executeRule = `${form.start_date} ${form.execute_time}`
  } else if (form.task_type === '每日') {
    executeRule = form.execute_time
  } else if (form.task_type === '每周') {
    executeRule = `${form.weekly_days.join(',')} ${form.execute_time}`
  } else if (form.task_type === '每月') {
    executeRule = `${form.monthly_days.join(',')} ${form.execute_time}`
  } else {
    throw new Error('不支持的任务类型')
  }

  return {
    task_name: form.task_name.trim(),
    task_type: form.task_type,
    user_id: DEFAULT_AUTOMATION_USER_ID,
    task_content: form.task_content.trim(),
    employee_id: employee.id,
    employee_source: employee.source,
    execute_rule: executeRule,
    start_time: form.task_type === '单次' ? `${form.start_date}T${form.execute_time}:00` : `${form.start_date}T00:00:00`,
    end_time: endDate ? `${form.end_date}T23:59:59` : null,
  }
}

export const getExecutionDuration = (record) => {
  const startTime = safeDate(record.start_time)
  const endTime = safeDate(record.end_time)
  if (!startTime || !endTime) {
    return '-'
  }

  const diffMs = Math.max(0, endTime.getTime() - startTime.getTime())
  const seconds = Math.floor(diffMs / 1000)
  if (seconds < 60) {
    return `${seconds}s`
  }

  const minutes = Math.floor(seconds / 60)
  const remainSeconds = seconds % 60
  return remainSeconds ? `${minutes}m ${remainSeconds}s` : `${minutes}m`
}

export const listAutomationTasks = async (params = {}) => {
  const response = await axios.get(buildApiUrl('/tasks/automation'), { params })
  return Array.isArray(response.data) ? response.data : []
}

export const createAutomationTask = async (payload) => {
  const response = await axios.post(buildApiUrl('/tasks/automation'), payload)
  return response.data
}

export const updateAutomationTask = async (taskId, payload) => {
  const response = await axios.put(buildApiUrl(`/tasks/automation/${taskId}`), payload)
  return response.data
}

export const startAutomationTask = async (taskId) => {
  const response = await axios.post(buildApiUrl(`/tasks/automation/${taskId}/start`))
  return response.data
}

export const pauseAutomationTask = async (taskId) => {
  const response = await axios.post(buildApiUrl(`/tasks/automation/${taskId}/pause`))
  return response.data
}

export const deleteAutomationTask = async (taskId) => {
  const response = await axios.delete(buildApiUrl(`/tasks/automation/${taskId}`))
  return response.data
}

export const listAutomationTaskExecutions = async (params = {}) => {
  const response = await axios.get(buildApiUrl('/tasks/automation/executions'), { params })
  return Array.isArray(response.data) ? response.data : []
}

export const recommendAutomationEmployees = async (taskContent, limit = 5) => {
  const normalizedTaskContent = String(taskContent || '').trim()
  if (!normalizedTaskContent) {
    return []
  }

  const response = await axios.post(buildApiUrl('/ai-employees/recommendations'), {
    task_content: normalizedTaskContent,
    limit,
  })

  const recommendations = Array.isArray(response.data?.recommendations) ? response.data.recommendations : []
  return recommendations.map((recommendation) => toRecommendedEmployeeOption(recommendation))
}

export const getAutomationTaskResultSummary = async (params = {}) => {
  const response = await axios.get(buildApiUrl('/tasks/automation/result-summary'), { params })
  return {
    unreadCount: Number(response.data?.unread_count || 0),
    notices: Array.isArray(response.data?.notices) ? response.data.notices : [],
  }
}

export const markAutomationTaskResultsRead = async (payload) => {
  const response = await axios.post(buildApiUrl('/tasks/automation/result-summary/mark-read'), payload)
  return {
    unreadCount: Number(response.data?.unread_count || 0),
    notices: Array.isArray(response.data?.notices) ? response.data.notices : [],
  }
}