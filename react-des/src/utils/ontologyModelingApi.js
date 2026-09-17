import { buildApiUrl } from '../config/api'

const PATH = '/api/ontology-modeling'

const parseResponse = async (response) => {
  const data = await response.json().catch(() => null)
  if (response.ok) return data
  throw new Error(typeof data?.detail === 'string' ? data.detail : `Ontology modeling request failed: ${response.status}`)
}

const fromProject = (project) => ({
  ...project,
  terminologyOwner: project.terminology_owner,
  datasourceIds: project.datasource_ids || [],
  modelingMode: project.modeling_mode,
  createdAt: project.created_at,
  updatedAt: project.updated_at,
})

const toProjectPayload = (project) => ({
  name: project.name,
  domain: project.domain,
  goal: project.goal,
  owner: project.owner,
  terminology_owner: project.terminologyOwner,
  datasource_ids: project.datasourceIds || [],
  modeling_mode: project.modelingMode,
  description: project.description || '',
})

const fromObject = (object) => ({
  ...object,
  key: object.object_key,
  projectId: object.project_id,
  createdAt: object.created_at,
  updatedAt: object.updated_at,
})

export const listModelingProjects = async () => {
  const response = await fetch(buildApiUrl(`${PATH}/projects`), { cache: 'no-store' })
  return (await parseResponse(response)).map(fromProject)
}

export const getModelingProject = async (projectId) => {
  const response = await fetch(buildApiUrl(`${PATH}/projects/${encodeURIComponent(projectId)}`), { cache: 'no-store' })
  return fromProject(await parseResponse(response))
}

export const createModelingProject = async (project) => {
  const response = await fetch(buildApiUrl(`${PATH}/projects`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(toProjectPayload(project)),
  })
  return fromProject(await parseResponse(response))
}

export const updateModelingProject = async (projectId, project) => {
  const response = await fetch(buildApiUrl(`${PATH}/projects/${encodeURIComponent(projectId)}`), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(toProjectPayload(project)),
  })
  return fromProject(await parseResponse(response))
}

export const deleteModelingProject = async (projectId) => {
  const response = await fetch(buildApiUrl(`${PATH}/projects/${encodeURIComponent(projectId)}`), { method: 'DELETE' })
  const result = await parseResponse(response)
  ;['relations', 'mappings', 'releases'].forEach((collection) => {
    window.localStorage.removeItem(`ontology-modeling-${collection}:${projectId}`)
  })
  return result
}

export const listModelingObjects = async (projectId) => {
  const response = await fetch(buildApiUrl(`${PATH}/projects/${encodeURIComponent(projectId)}/objects`), { cache: 'no-store' })
  return (await parseResponse(response)).map(fromObject)
}

export const createModelingObject = async (projectId, object) => {
  const response = await fetch(buildApiUrl(`${PATH}/projects/${encodeURIComponent(projectId)}/objects`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: object.name,
      definition: object.definition,
      object_key: object.key,
      owner: object.owner,
      lifecycle: object.lifecycle,
    }),
  })
  return fromObject(await parseResponse(response))
}

export const updateModelingObject = async (projectId, objectId, object) => {
  const response = await fetch(buildApiUrl(`${PATH}/projects/${encodeURIComponent(projectId)}/objects/${encodeURIComponent(objectId)}`), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: object.name,
      definition: object.definition,
      object_key: object.key,
      owner: object.owner,
      lifecycle: object.lifecycle,
    }),
  })
  return fromObject(await parseResponse(response))
}

export const deleteModelingObject = async (projectId, objectId) => {
  const response = await fetch(buildApiUrl(`${PATH}/projects/${encodeURIComponent(projectId)}/objects/${encodeURIComponent(objectId)}`), { method: 'DELETE' })
  const result = await parseResponse(response)
  const relationsKey = `ontology-modeling-relations:${projectId}`
  const mappingsKey = `ontology-modeling-mappings:${projectId}`
  const relations = readLocalCollection(relationsKey).filter((item) => item.sourceObjectId !== objectId && item.targetObjectId !== objectId)
  const mappings = readLocalCollection(mappingsKey).filter((item) => item.objectId !== objectId)
  window.localStorage.setItem(relationsKey, JSON.stringify(relations))
  window.localStorage.setItem(mappingsKey, JSON.stringify(mappings))
  return result
}

const fromProperty = (property) => ({
  ...property,
  projectId: property.project_id,
  apiName: property.api_name,
  objectIds: property.object_ids || [],
  dataType: property.data_type,
  createdAt: property.created_at,
  updatedAt: property.updated_at,
})

export const listModelingProperties = async (projectId) => {
  const response = await fetch(buildApiUrl(`${PATH}/projects/${encodeURIComponent(projectId)}/properties`), { cache: 'no-store' })
  return (await parseResponse(response)).map(fromProperty)
}

export const createModelingProperty = async (projectId, property) => {
  const response = await fetch(buildApiUrl(`${PATH}/projects/${encodeURIComponent(projectId)}/properties`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: property.name,
      api_name: property.apiName || '',
      object_ids: property.objectIds || [],
      data_type: property.dataType || '文本',
      description: property.description || '',
      source: property.source || '',
    }),
  })
  return fromProperty(await parseResponse(response))
}

export const updateModelingProperty = async (projectId, propertyId, property) => {
  const response = await fetch(buildApiUrl(`${PATH}/projects/${encodeURIComponent(projectId)}/properties/${encodeURIComponent(propertyId)}`), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: property.name,
      api_name: property.apiName || '',
      object_ids: property.objectIds || [],
      data_type: property.dataType || '文本',
      description: property.description || '',
      source: property.source || '',
    }),
  })
  return fromProperty(await parseResponse(response))
}

export const deleteModelingProperty = async (projectId, propertyId) => {
  const response = await fetch(buildApiUrl(`${PATH}/projects/${encodeURIComponent(projectId)}/properties/${encodeURIComponent(propertyId)}`), { method: 'DELETE' })
  const result = await parseResponse(response)
  const mappingsKey = `ontology-modeling-mappings:${projectId}`
  const mappings = readLocalCollection(mappingsKey).map((mapping) => ({
    ...mapping,
    primaryKeyPropertyIds: (mapping.primaryKeyPropertyIds || []).filter((id) => id !== propertyId),
    fieldMappings: (mapping.fieldMappings || []).filter((item) => item.propertyId !== propertyId),
  }))
  window.localStorage.setItem(mappingsKey, JSON.stringify(mappings))
  return result
}

export const listModelingRelations = async (projectId) => {
  const storageKey = `ontology-modeling-relations:${projectId}`
  try {
    const stored = window.localStorage.getItem(storageKey)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

export const createModelingRelation = async (projectId, relation) => {
  const storageKey = `ontology-modeling-relations:${projectId}`
  const savedRelation = {
    ...relation,
    id: relation.id || `relation-${Date.now()}`,
    projectId,
    validationStatus: relation.validationStatus || '待校验',
  }
  const relations = await listModelingRelations(projectId)
  window.localStorage.setItem(storageKey, JSON.stringify([...relations, savedRelation]))
  return savedRelation
}

const readLocalCollection = (key) => {
  try {
    const stored = window.localStorage.getItem(key)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

export const listModelingMappings = async (projectId) => {
  const storageKey = `ontology-modeling-mappings:${projectId}`
  const response = await fetch(buildApiUrl(`${PATH}/projects/${encodeURIComponent(projectId)}/mappings`), { cache: 'no-store' })
  const savedMappings = await parseResponse(response)
  if (savedMappings.length) {
    window.localStorage.setItem(storageKey, JSON.stringify(savedMappings))
    return savedMappings
  }
  const localMappings = readLocalCollection(storageKey)
  if (localMappings.length) {
    return Promise.all(localMappings.map((mapping) => saveModelingMapping(projectId, mapping.objectId, mapping)))
  }
  return []
}

export const saveModelingMapping = async (projectId, objectId, mapping) => {
  const storageKey = `ontology-modeling-mappings:${projectId}`
  const savedMapping = { ...mapping, id: mapping.id || `mapping-${objectId}`, objectId, projectId }
  const response = await fetch(buildApiUrl(`${PATH}/projects/${encodeURIComponent(projectId)}/objects/${encodeURIComponent(objectId)}/mapping`), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mapping: savedMapping }),
  })
  const persistedMapping = await parseResponse(response)
  const mappings = readLocalCollection(storageKey)
  window.localStorage.setItem(storageKey, JSON.stringify([
    ...mappings.filter((item) => item.objectId !== objectId),
    persistedMapping,
  ]))
  return persistedMapping
}

export const listModelingReleases = async (projectId) =>
  readLocalCollection(`ontology-modeling-releases:${projectId}`)

export const publishModelingProject = async (projectId) => {
  const project = await getModelingProject(projectId)
  const publishedProject = { ...project, status: 'published', publishedAt: new Date().toISOString() }
  const storageKey = `ontology-modeling-releases:${projectId}`
  const releases = await listModelingReleases(projectId)
  window.localStorage.setItem(storageKey, JSON.stringify([
    ...releases,
    { id: `release-${Date.now()}`, projectId, createdAt: publishedProject.publishedAt, version: releases.length + 1 },
  ]))
  return publishedProject
}