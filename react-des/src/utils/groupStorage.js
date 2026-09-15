import axios from 'axios'
import { API_BASE } from '../config/api'

export const CREATED_GROUPS_UPDATED_EVENT = 'silicon-workmate-created-groups-updated'
const LEGACY_CREATED_GROUPS_STORAGE_KEY = 'silicon-workmate-created-groups'

let createdGroupsCache = []

const emitGroupsUpdated = () => {
  if (typeof window === 'undefined') {
    return
  }

  window.dispatchEvent(new CustomEvent(CREATED_GROUPS_UPDATED_EVENT))
}

const normalizeGroups = (groups) => (Array.isArray(groups) ? groups : [])

const readLegacyCreatedGroups = () => {
  if (typeof window === 'undefined') {
    return []
  }

  const raw = window.sessionStorage.getItem(LEGACY_CREATED_GROUPS_STORAGE_KEY)
  if (!raw) {
    return []
  }

  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch (error) {
    console.error('Failed to parse legacy groups:', error)
    return []
  }
}

const clearLegacyCreatedGroups = () => {
  if (typeof window === 'undefined') {
    return
  }

  window.sessionStorage.removeItem(LEGACY_CREATED_GROUPS_STORAGE_KEY)
}

const migrateLegacyGroups = async () => {
  const legacyGroups = readLegacyCreatedGroups()
  if (legacyGroups.length === 0) {
    return []
  }

  const migratedGroups = []
  for (const legacyGroup of legacyGroups) {
    const memberIds = Array.isArray(legacyGroup.members)
      ? legacyGroup.members.map((member) => member?.id).filter(Boolean)
      : []

    if (memberIds.length === 0) {
      continue
    }

    try {
      const response = await axios.post(`${API_BASE}/groups/`, {
        name: legacyGroup.name || '迁移小组',
        description: legacyGroup.description || '从历史本地小组迁移而来。',
        mode: legacyGroup.mode || 'manual',
        member_ids: memberIds,
      })
      migratedGroups.push(response.data)
    } catch (error) {
      console.error('Failed to migrate legacy group:', legacyGroup?.name, error)
    }
  }

  clearLegacyCreatedGroups()
  return migratedGroups
}

export const readCreatedGroups = () => {
  return createdGroupsCache
}

export const writeCreatedGroups = (groups) => {
  createdGroupsCache = normalizeGroups(groups)
  emitGroupsUpdated()
}

export const findCreatedGroupById = (groupId) => {
  if (!groupId) {
    return null
  }

  return readCreatedGroups().find((group) => group.id === groupId) || null
}

export const fetchCreatedGroups = async () => {
  try {
    const response = await axios.get(`${API_BASE}/groups/`)
    const fetchedGroups = normalizeGroups(response.data)
    if (fetchedGroups.length === 0) {
      const migratedGroups = await migrateLegacyGroups()
      createdGroupsCache = migratedGroups.length > 0 ? migratedGroups : fetchedGroups
      return createdGroupsCache
    }

    createdGroupsCache = fetchedGroups
    return createdGroupsCache
  } catch (error) {
    console.error('Failed to fetch created groups:', error)
    throw error
  }
}

export const fetchCreatedGroupById = async (groupId) => {
  if (!groupId) {
    return null
  }

  const cachedGroup = findCreatedGroupById(groupId)
  if (cachedGroup) {
    return cachedGroup
  }

  try {
    const response = await axios.get(`${API_BASE}/groups/${groupId}`)
    const nextGroup = response.data
    createdGroupsCache = [nextGroup, ...createdGroupsCache.filter((group) => group.id !== nextGroup.id)]
    return nextGroup
  } catch (error) {
    console.error(`Failed to fetch group ${groupId}:`, error)
    throw error
  }
}

export const createCreatedGroup = async (payload) => {
  try {
    const response = await axios.post(`${API_BASE}/groups/`, payload)
    const nextGroup = response.data
    createdGroupsCache = [nextGroup, ...createdGroupsCache.filter((group) => group.id !== nextGroup.id)]
    emitGroupsUpdated()
    return nextGroup
  } catch (error) {
    console.error('Failed to create group:', error)
    throw error
  }
}

export const updateCreatedGroup = async (groupId, payload) => {
  if (!groupId) {
    throw new Error('groupId is required')
  }

  try {
    const response = await axios.patch(`${API_BASE}/groups/${groupId}`, payload)
    const nextGroup = response.data
    createdGroupsCache = [nextGroup, ...createdGroupsCache.filter((group) => group.id !== nextGroup.id)]
    emitGroupsUpdated()
    return nextGroup
  } catch (error) {
    console.error(`Failed to update group ${groupId}:`, error)
    throw error
  }
}

export const deleteCreatedGroup = async (groupId) => {
  if (!groupId) {
    return
  }

  try {
    await axios.delete(`${API_BASE}/groups/${groupId}`)
    createdGroupsCache = createdGroupsCache.filter((group) => group.id !== groupId)
    emitGroupsUpdated()
  } catch (error) {
    console.error(`Failed to delete group ${groupId}:`, error)
    throw error
  }
}

export const buildGroupChatId = (groupId) => {
  const raw = String(groupId || '')
  let hash = 0

  for (let index = 0; index < raw.length; index += 1) {
    hash = ((hash * 31) + raw.charCodeAt(index)) % 1000000007
  }

  return 900000000 + (hash % 99999999)
}