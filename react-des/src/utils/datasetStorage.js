import { buildApiUrl } from '../config/api'

const PATH = '/api/datasets/'
const LEGACY_DATABASE_NAME = 'des-local-resources'
const LEGACY_STORE_NAME = 'datasets'

const parseResponse = async (response) => {
  if (response.ok) return response.status === 204 ? null : response.json()
  const data = await response.json().catch(() => null)
  throw new Error(typeof data?.detail === 'string' ? data.detail : `Dataset request failed: ${response.status}`)
}

const withBlob = async (dataset) => {
  const response = await fetch(buildApiUrl(`${PATH}${encodeURIComponent(dataset.id)}/content`), { cache: 'no-store' })
  if (!response.ok) throw new Error(`Dataset content request failed: ${response.status}`)
  return { ...dataset, blob: await response.blob() }
}

const listLegacyDatasets = () => new Promise((resolve) => {
  if (!window.indexedDB) return resolve([])
  const request = window.indexedDB.open(LEGACY_DATABASE_NAME)
  request.onerror = () => resolve([])
  request.onsuccess = () => {
    const database = request.result
    if (!database.objectStoreNames.contains(LEGACY_STORE_NAME)) {
      database.close()
      resolve([])
      return
    }
    const transaction = database.transaction(LEGACY_STORE_NAME, 'readonly')
    const getAllRequest = transaction.objectStore(LEGACY_STORE_NAME).getAll()
    getAllRequest.onerror = () => resolve([])
    getAllRequest.onsuccess = () => resolve(getAllRequest.result || [])
    transaction.oncomplete = () => database.close()
  }
})

const clearLegacyDatasets = () => new Promise((resolve) => {
  const request = window.indexedDB.open(LEGACY_DATABASE_NAME)
  request.onerror = () => resolve()
  request.onsuccess = () => {
    const database = request.result
    if (!database.objectStoreNames.contains(LEGACY_STORE_NAME)) {
      database.close()
      resolve()
      return
    }
    const transaction = database.transaction(LEGACY_STORE_NAME, 'readwrite')
    transaction.objectStore(LEGACY_STORE_NAME).clear()
    transaction.oncomplete = () => {
      database.close()
      resolve()
    }
    transaction.onerror = () => resolve()
  }
})

const uploadLegacyDataset = async (dataset) => {
  const file = new File([dataset.blob], dataset.name, {
    type: dataset.type || dataset.blob?.type || 'application/octet-stream',
  })
  const formData = new FormData()
  formData.append('file', file)
  const response = await fetch(buildApiUrl(PATH), { method: 'POST', body: formData })
  return parseResponse(response)
}

export const listLocalDatasets = async () => {
  const response = await fetch(buildApiUrl(PATH), { cache: 'no-store' })
  let datasets = await parseResponse(response)
  if (!datasets.length) {
    const legacyDatasets = await listLegacyDatasets()
    if (legacyDatasets.length) {
      await Promise.all(legacyDatasets.map(uploadLegacyDataset))
      await clearLegacyDatasets()
      const migratedResponse = await fetch(buildApiUrl(PATH), { cache: 'no-store' })
      datasets = await parseResponse(migratedResponse)
    }
  }
  return Promise.all(datasets.map(withBlob))
}

export const saveLocalDataset = async (file) => {
  const formData = new FormData()
  formData.append('file', file)
  const response = await fetch(buildApiUrl(PATH), { method: 'POST', body: formData })
  return withBlob(await parseResponse(response))
}

export const deleteLocalDataset = async (id) => {
  const response = await fetch(buildApiUrl(`${PATH}${encodeURIComponent(id)}`), { method: 'DELETE' })
  return parseResponse(response)
}

export const clearLocalDatasets = async () => {
  const response = await fetch(buildApiUrl(PATH), { method: 'DELETE' })
  return parseResponse(response)
}