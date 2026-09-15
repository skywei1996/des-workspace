const STORAGE_KEY = 'des-carbon-workers'

const DEFAULT_CARBON_WORKERS = [
  { id: 1, name: 'Alice Chen', role: 'Tenant Admin', email: 'alice@company.com', phone: '13800138001', status: 'Active', teams: ['Engineering'] },
  { id: 2, name: 'Bob Smith', role: 'Project Admin', email: 'bob@company.com', phone: '13800138002', status: 'Active', teams: ['Product'] },
  { id: 3, name: 'Charlie Davis', role: 'Agent Manager', email: 'charlie@company.com', phone: '13800138003', status: 'On Leave', teams: ['Marketing'] },
  { id: 4, name: 'David Wilson', role: 'Agent User', email: 'david@company.com', phone: '13800138004', status: 'Active', teams: ['Engineering', 'Product'] },
]

const isBrowser = () => typeof window !== 'undefined'

const STATUS_LABELS = {
  active: 'Active',
  inactive: 'Inactive',
  on_leave: 'On Leave',
}

export const toCarbonWorkerStatusLabel = (status) => {
  const normalized = String(status || '').trim().toLowerCase().replace(/\s+/g, '_')
  return STATUS_LABELS[normalized] || 'Active'
}

export const toCarbonWorkerStatusValue = (status) => {
  const normalized = String(status || '').trim().toLowerCase().replace(/\s+/g, '_')
  return Object.prototype.hasOwnProperty.call(STATUS_LABELS, normalized) ? normalized : 'active'
}

export const normalizeCarbonWorker = (worker, index = 0) => ({
  id: Number(worker?.id || index + 1),
  name: String(worker?.name || ''),
  role: String(worker?.role || ''),
  email: String(worker?.email || '').trim().toLowerCase(),
  phone: String(worker?.phone || ''),
  status: toCarbonWorkerStatusLabel(worker?.status),
  teams: Array.isArray(worker?.teams) ? worker.teams.map((team) => String(team).trim()).filter(Boolean) : [],
})

export const loadCarbonWorkers = () => {
  if (!isBrowser()) return DEFAULT_CARBON_WORKERS.map(normalizeCarbonWorker)

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_CARBON_WORKERS.map(normalizeCarbonWorker)
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_CARBON_WORKERS.map(normalizeCarbonWorker)
    return parsed.map((item, index) => normalizeCarbonWorker(item, index))
  } catch (error) {
    console.error('Failed to load carbon workers:', error)
    return DEFAULT_CARBON_WORKERS.map(normalizeCarbonWorker)
  }
}

export const saveCarbonWorkers = (workers) => {
  if (!isBrowser()) return

  const normalized = Array.isArray(workers) ? workers.map((item, index) => normalizeCarbonWorker(item, index)) : []
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized))
  window.dispatchEvent(new CustomEvent('des:carbon-workers-updated', { detail: normalized }))
}

export const createCarbonWorkerId = () => Date.now()