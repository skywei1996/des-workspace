import { buildApiUrl } from '../config/api'
import {
  createCarbonWorkerId,
  loadCarbonWorkers,
  normalizeCarbonWorker,
  saveCarbonWorkers,
  toCarbonWorkerStatusValue,
} from './carbonWorkerStorage'

const CARBON_WORKERS_PATH = '/carbon-workers/'

const mergeById = (workers) => {
  const deduped = new Map()
  workers.forEach((worker, index) => {
    const normalized = normalizeCarbonWorker(worker, index)
    deduped.set(normalized.id, normalized)
  })
  return Array.from(deduped.values())
}

const toApiPayload = (worker) => ({
  name: String(worker?.name || '').trim(),
  role: String(worker?.role || '').trim(),
  email: String(worker?.email || '').trim().toLowerCase(),
  phone: String(worker?.phone || '').trim(),
  status: toCarbonWorkerStatusValue(worker?.status),
  teams: Array.isArray(worker?.teams) ? worker.teams.map((team) => String(team).trim()).filter(Boolean) : [],
})

export const fetchCarbonWorkers = async () => {
  const fallbackWorkers = loadCarbonWorkers()

  try {
    const response = await fetch(buildApiUrl(CARBON_WORKERS_PATH))
    if (!response.ok) {
      throw new Error(`Failed to fetch carbon workers: ${response.status}`)
    }

    const workers = mergeById(await response.json())
    saveCarbonWorkers(workers)
    return workers
  } catch (error) {
    console.error('Failed to fetch carbon workers from API:', error)
    return fallbackWorkers
  }
}

export const createCarbonWorker = async (worker) => {
  const payload = toApiPayload(worker)

  try {
    const response = await fetch(buildApiUrl(CARBON_WORKERS_PATH), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!response.ok) {
      throw new Error(`Failed to create carbon worker: ${response.status}`)
    }

    const createdWorker = normalizeCarbonWorker(await response.json())
    saveCarbonWorkers(mergeById([createdWorker, ...loadCarbonWorkers()]))
    return createdWorker
  } catch (error) {
    console.error('Failed to create carbon worker via API:', error)
    const fallbackWorker = normalizeCarbonWorker({ ...payload, id: createCarbonWorkerId() })
    saveCarbonWorkers(mergeById([fallbackWorker, ...loadCarbonWorkers()]))
    return fallbackWorker
  }
}

export const deleteCarbonWorker = async (workerId) => {
  try {
    const response = await fetch(buildApiUrl(`${CARBON_WORKERS_PATH}${workerId}`), {
      method: 'DELETE',
    })
    if (!response.ok) {
      throw new Error(`Failed to delete carbon worker: ${response.status}`)
    }
  } catch (error) {
    console.error('Failed to delete carbon worker via API:', error)
  }

  const nextWorkers = loadCarbonWorkers().filter((worker) => worker.id !== workerId)
  saveCarbonWorkers(nextWorkers)
  return nextWorkers
}