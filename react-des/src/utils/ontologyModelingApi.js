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

export const listModelingProperties = async (projectId) =>
  readLocalCollection(`ontology-modeling-properties:${projectId}`)

export const listModelingMappings = async (projectId) =>
  readLocalCollection(`ontology-modeling-mappings:${projectId}`)

export const saveModelingMapping = async (projectId, objectId, mapping) => {
  const storageKey = `ontology-modeling-mappings:${projectId}`
  const mappings = await listModelingMappings(projectId)
  const savedMapping = { ...mapping, id: mapping.id || `mapping-${objectId}`, objectId, projectId }
  window.localStorage.setItem(storageKey, JSON.stringify([
    ...mappings.filter((item) => item.objectId !== objectId),
    savedMapping,
  ]))
  return savedMapping
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