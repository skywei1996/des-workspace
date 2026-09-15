import { buildApiUrl } from '../config/api'

const PATH = '/api/ontology-design/'
const saveQueues = new Map()

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))

const parseResponse = async (response) => {
  const data = await response.json().catch(() => null)
  if (response.ok) return data
  if (response.status === 404) return null
  throw new Error(typeof data?.detail === 'string' ? data.detail : `Ontology design request failed: ${response.status}`)
}

export const loadOntologyDesignCollection = async (key) => {
  const response = await fetch(buildApiUrl(`${PATH}${encodeURIComponent(key)}`), { cache: 'no-store' })
  const data = await parseResponse(response)
  return data?.items || null
}

const saveWithRetry = async (key, items) => {
  let lastError
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(buildApiUrl(`${PATH}${encodeURIComponent(key)}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
        keepalive: true,
      })
      const data = await parseResponse(response)
      return data.items
    } catch (error) {
      lastError = error
      if (attempt < 2) await wait(250 * (attempt + 1))
    }
  }
  throw lastError
}

export const saveOntologyDesignCollection = (key, items) => {
  const previousSave = saveQueues.get(key) || Promise.resolve()
  const nextSave = previousSave.catch(() => {}).then(() => saveWithRetry(key, items))
  saveQueues.set(key, nextSave)
  nextSave.finally(() => {
    if (saveQueues.get(key) === nextSave) saveQueues.delete(key)
  }).catch(() => {})
  return nextSave
}