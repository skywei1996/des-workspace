import React, { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import OntologyObjectResourceDrawer from '../components/OntologyObjectResourceDrawer'
import { createModelingObject, getModelingProject, listModelingObjects, listModelingProperties, listModelingRelations } from '../utils/ontologyModelingApi'

const navigationGroups = [
  { title: '', items: [{ key: 'overview', label: '项目概览', path: '' }] },
  { title: '本体结构', items: [{ key: 'objects', label: '对象', path: '' }, { key: 'properties', label: '属性', path: '/properties' }] },
  { title: '业务逻辑', items: [{ key: 'actions', label: '动作', path: '/actions' }, { key: 'functions', label: '函数' }] },
  { title: '数据管理', items: [{ key: 'mapping', label: '数据映射', path: '/mapping' }] },
  { title: '发布管理', items: [{ key: 'validation', label: '版本发布', path: '/validation' }] },
]

function OntologyProjectWorkspacePage({ activeSection = 'objects' }) {
  const navigate = useNavigate()
  const { projectId } = useParams()
  const [searchParams] = useSearchParams()
  const [project, setProject] = useState(null)
  const [objects, setObjects] = useState([])
  const [properties, setProperties] = useState([])
  const [relations, setRelations] = useState([])
  const [resourceDrawer, setResourceDrawer] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [createForm, setCreateForm] = useState({ name: '', definition: '', key: '', owner: '', dataType: '文本', description: '', source: '' })

  useEffect(() => {
    let active = true
    Promise.all([getModelingProject(projectId), listModelingObjects(projectId), listModelingProperties(projectId), listModelingRelations(projectId)])
      .then(([savedProject, savedObjects, savedProperties, savedRelations]) => {
        if (!active) return
        setProject(savedProject)
        setObjects(savedObjects)
        setProperties(savedProperties)
        setRelations(savedRelations)
      })
      .catch(() => { if (active) setProject(null) })
      .finally(() => { if (active) setIsLoading(false) })
    return () => { active = false }
  }, [projectId])

  useEffect(() => {
    const createType = searchParams.get('create')
    setIsCreateOpen(createType === 'object' || createType === 'property')
  }, [searchParams])

  useEffect(() => {
    const handleObjectResourceClick = (event) => {
      const button = event.target.closest('button')
      if (!button || !['属性', '关联'].includes(button.textContent.trim()) || activeSection !== 'objects') return
      const row = button.closest('div.border-b')
      const object = objects.find((item) => row?.textContent.includes(item.name))
      if (!object) return
      event.preventDefault()
      event.stopPropagation()
      setResourceDrawer({ mode: button.textContent.trim() === '属性' ? 'property' : 'link', object })
    }
    document.addEventListener('click', handleObjectResourceClick, true)
    return () => document.removeEventListener('click', handleObjectResourceClick, true)
  }, [activeSection, objects])

  if (isLoading) return <div className="flex h-screen items-center justify-center bg-[#f7f8fa] text-sm text-[#717985]">正在加载项目...</div>
  if (!project) return <div className="flex h-screen items-center justify-center bg-[#f7f8fa] text-sm text-[#717985]">项目上下文已失效</div>

  const goTo = (path) => navigate(`/ontology-modeling/projects/${project.id}${path}`, { state: { project, objects } })
  const isProperties = activeSection === 'properties'
  const createType = searchParams.get('create')
  const closeCreate = () => {
    setIsCreateOpen(false)
    navigate(`/ontology-modeling/projects/${project.id}${isProperties ? '/properties' : ''}`, { replace: true, state: { project, objects } })
  }
  const updateCreateForm = (field, value) => setCreateForm((current) => ({ ...current, [field]: value }))
  const saveBindings = (nextProperties, nextRelations) => {
    window.localStorage.setItem(`ontology-modeling-properties:${project.id}`, JSON.stringify(nextProperties))
    window.localStorage.setItem(`ontology-modeling-relations:${project.id}`, JSON.stringify(nextRelations))
    setProperties(nextProperties)
    setRelations(nextRelations)
  }
  const bindResource = (resource) => {
    if (!resourceDrawer || !resource) return
    if (resourceDrawer.mode === 'property') {
      const selectedIds = Array.isArray(resource) ? resource : [resource.id]
      const nextProperties = properties.map((item) => selectedIds.includes(item.id) ? { ...item, objectIds: Array.from(new Set([...(item.objectIds || []), resourceDrawer.object.id])) } : item)
      saveBindings(nextProperties, relations)
    } else {
      const nextRelations = [...relations, { id: `relation-${Date.now()}`, projectId: project.id, ...resource }]
      saveBindings(properties, nextRelations)
    }
  }
  const unbindResource = (resource) => {
    if (!resourceDrawer) return
    if (resourceDrawer.mode === 'property') {
      const nextProperties = properties.map((item) => item.id === resource.id ? { ...item, objectIds: (item.objectIds || []).filter((id) => id !== resourceDrawer.object.id), objectId: item.objectId === resourceDrawer.object.id ? '' : item.objectId } : item)
      saveBindings(nextProperties, relations)
    } else {
      const nextRelations = relations.filter((item) => item.id !== resource.id)
      saveBindings(properties, nextRelations)
    }
  }
  const submitCreate = async (event) => {
    event.preventDefault()
    if (isSaving || !createForm.name.trim()) return
    setIsSaving(true)
    try {
      if (createType === 'object') {
        const savedObject = await createModelingObject(project.id, { name: createForm.name.trim(), definition: createForm.definition.trim(), key: createForm.key.trim(), owner: createForm.owner.trim(), lifecycle: '长期存在' })
        setObjects((current) => [...current, savedObject])
      } else {
        const savedProperty = { id: `property-${Date.now()}`, projectId: project.id, name: createForm.name.trim(), objectIds: [], dataType: createForm.dataType, description: createForm.description.trim(), source: createForm.source.trim() }
        const storageKey = `ontology-modeling-properties:${project.id}`
        const nextProperties = [...properties, savedProperty]
        window.localStorage.setItem(storageKey, JSON.stringify(nextProperties))
        setProperties(nextProperties)
      }
      setCreateForm({ name: '', definition: '', key: '', owner: '', dataType: '文本', description: '', source: '' })
      closeCreate()
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#f7f8fa] text-[#252a32]">
      <Sidebar activeTab="objects" />
      <main className="min-w-0 flex-1 overflow-y-auto">
        <header className="border-b border-[#e4e7eb] bg-white px-7 py-4">
          <div className="flex items-center justify-between gap-6">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm text-[#7b8490]"><button type="button" onClick={() => navigate('/ontology-modeling')} className="hover:text-[#d94338]">项目列表</button><span>/</span><span className="font-medium text-[#303741]">{project.name}</span><span className="rounded-full bg-[#eaf7ef] px-2.5 py-1 text-xs font-medium text-[#2f8f61]">已发布</span></div>
              <p className="mt-2 text-xs text-[#858d98]">{project.domain} · 负责人：{project.owner} · 业务口径：{project.terminologyOwner}</p>
            </div>
            <button type="button" onClick={() => navigate('/ontology-modeling')} className="h-9 shrink-0 rounded-md border border-[#cfd5dc] bg-white px-4 text-sm font-medium text-[#4c5561] hover:border-[#e3473c] hover:text-[#d94338]">编辑项目</button>
          </div>
        </header>
        <div className="flex min-h-[calc(100vh-81px)]">
          <aside className="w-[208px] shrink-0 border-r border-[#e0e3e7] bg-white px-3 py-4">
            <nav>{navigationGroups.map((group, index) => <div key={group.title || 'overview'} className={index ? 'mt-4' : ''}>{group.title && <div className="px-3 pb-1.5 text-[11px] font-semibold text-[#9299a3]">{group.title}</div>}<div className="space-y-0.5">{group.items.map((item) => <button key={item.key} type="button" onClick={() => item.path !== undefined && goTo(item.path)} className={`relative flex h-9 w-full items-center px-3 text-left text-sm ${item.key === activeSection ? 'bg-[#fff1ee] font-semibold text-[#d94338] before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:bg-[#e3473c]' : 'font-medium text-[#596270] hover:bg-[#f7f8fa]'}`}>{item.label}</button>)}</div></div>)}</nav>
          </aside>
          <section className="min-w-0 flex-1 p-6"><div className="border border-[#e0e3e7] bg-white p-6"><div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#eceef1] pb-5"><div><h1 className="text-xl font-semibold text-[#20242b]">{isProperties ? '属性' : '对象'}</h1><p className="mt-1.5 text-sm text-[#717985]">{isProperties ? '维护项目中对象的属性定义、数据类型和业务口径。' : '维护项目中的业务对象、业务标识和责任归属。'}</p></div><button type="button" onClick={() => navigate(`/ontology-modeling/projects/${project.id}${isProperties ? '/properties?create=property' : '?create=object'}`)} className="h-10 rounded-md bg-[#e3473c] px-4 text-sm font-medium text-white hover:bg-[#cf3e34]">+ 新建{isProperties ? '属性' : '对象'}</button></div>{isProperties ? <><div className="mt-5 flex items-center justify-between gap-4 text-sm"><span className="font-medium text-[#353c46]">属性清单</span><span className="text-xs text-[#858d98]">已定义 {properties.length} 个属性</span></div><div className="mt-4 overflow-x-auto border border-[#e0e3e7]"><div className="grid min-w-[820px] grid-cols-[1.1fr_1fr_120px_1.6fr_1fr] border-b border-[#e0e3e7] bg-[#fafbfc] px-4 py-3 text-xs font-semibold text-[#747d88]"><span>属性名称</span><span>已绑定对象</span><span>类型</span><span>业务说明</span><span>来源</span></div>{properties.map((property) => <div key={property.id} className="grid min-w-[820px] grid-cols-[1.1fr_1fr_120px_1.6fr_1fr] items-center border-b border-[#edf0f2] px-4 py-4 text-sm last:border-0"><span className="font-semibold text-[#303741]">{property.name}</span><span className="text-[#68717d]">{(property.objectIds || []).map((id) => objects.find((object) => object.id === id)?.name).filter(Boolean).join('、') || '未绑定'}</span><span className="text-[#68717d]">{property.dataType || '文本'}</span><span className="text-[#68717d]">{property.description || '暂无说明'}</span><span className="text-[#68717d]">{property.source || '待映射'}</span></div>)}</div>{properties.length === 0 && <div className="mt-4 border border-dashed border-[#cfd5dc] bg-[#fafbfc] px-6 py-12 text-center text-sm text-[#858d98]">当前项目还没有定义属性</div>}</> : <><div className="mt-5 flex items-center justify-between gap-4 text-sm"><span className="font-medium text-[#353c46]">对象清单</span><span className="text-xs text-[#858d98]">已定义 {objects.length} 个对象</span></div><div className="mt-4 overflow-x-auto border border-[#e0e3e7]"><div className="grid min-w-[900px] grid-cols-[1.1fr_1fr_1.6fr_1fr_150px] border-b border-[#e0e3e7] bg-[#fafbfc] px-4 py-3 text-xs font-semibold text-[#747d88]"><span>对象名称</span><span>业务标识</span><span>业务定义</span><span>负责人</span><span>操作</span></div>{objects.map((object) => <div key={object.id} className="grid min-w-[900px] grid-cols-[1.1fr_1fr_1.6fr_1fr_150px] items-center border-b border-[#edf0f2] px-4 py-4 text-sm last:border-0"><span className="font-semibold text-[#303741]">{object.name}</span><code className="text-xs text-[#68717d]">{object.key || object.object_key}</code><span className="text-[#68717d]">{object.definition}</span><span className="text-[#68717d]">{object.owner}</span><span className="flex gap-4 text-sm font-medium text-[#d94338]"><button type="button" onClick={() => goTo('/properties')}>属性</button><button type="button" onClick={() => goTo('/relations')}>关联</button></span></div>)}</div></>}</div></section>
        </div>
      </main>
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 bg-[#17191f]/35" onMouseDown={closeCreate}>
          <form onSubmit={submitCreate} onMouseDown={(event) => event.stopPropagation()} className="ml-auto h-full w-full max-w-[620px] overflow-y-auto bg-white shadow-[-20px_0_70px_rgba(15,23,42,0.2)]">
            <div className="border-b border-[#eceef1] px-7 py-5"><p className="text-xs font-semibold text-[#d94338]">{createType === 'property' ? 'DEFINE PROPERTY' : 'DEFINE OBJECT'}</p><h2 className="mt-1 text-xl font-semibold text-[#20242b]">新建{createType === 'property' ? '属性' : '对象'}</h2><p className="mt-1 text-sm text-[#717985]">在当前项目中创建定义，保存后仍停留在当前工作台。</p></div>
            <div className="space-y-5 px-7 py-6">
              <label className="block text-sm"><span className="mb-2 block font-semibold text-[#353c46]">{createType === 'property' ? '属性名称' : '对象名称'} *</span><input autoFocus value={createForm.name} onChange={(event) => updateCreateForm('name', event.target.value)} className="h-10 w-full rounded-md border border-[#cfd5dc] px-3 outline-none focus:border-[#e3473c]" /></label>
              {createType === 'property' ? <><div className="grid gap-5 md:grid-cols-2"><label className="block text-sm"><span className="mb-2 block font-semibold text-[#353c46]">数据类型</span><select value={createForm.dataType} onChange={(event) => updateCreateForm('dataType', event.target.value)} className="h-10 w-full rounded-md border border-[#cfd5dc] px-3"><option>文本</option><option>数字</option><option>日期</option><option>布尔值</option></select></label><label className="block text-sm"><span className="mb-2 block font-semibold text-[#353c46]">来源</span><input value={createForm.source} onChange={(event) => updateCreateForm('source', event.target.value)} className="h-10 w-full rounded-md border border-[#cfd5dc] px-3" /></label></div><label className="block text-sm"><span className="mb-2 block font-semibold text-[#353c46]">业务说明</span><textarea value={createForm.description} onChange={(event) => updateCreateForm('description', event.target.value)} rows={3} className="w-full resize-none rounded-md border border-[#cfd5dc] px-3 py-2" /></label></> : <><label className="block text-sm"><span className="mb-2 block font-semibold text-[#353c46]">业务定义 *</span><textarea value={createForm.definition} onChange={(event) => updateCreateForm('definition', event.target.value)} rows={3} className="w-full resize-none rounded-md border border-[#cfd5dc] px-3 py-2" /></label><div className="grid gap-5 md:grid-cols-2"><label className="block text-sm"><span className="mb-2 block font-semibold text-[#353c46]">唯一标识 *</span><input value={createForm.key} onChange={(event) => updateCreateForm('key', event.target.value)} className="h-10 w-full rounded-md border border-[#cfd5dc] px-3" /></label><label className="block text-sm"><span className="mb-2 block font-semibold text-[#353c46]">业务 Owner *</span><input value={createForm.owner} onChange={(event) => updateCreateForm('owner', event.target.value)} className="h-10 w-full rounded-md border border-[#cfd5dc] px-3" /></label></div></>}
            </div>
            <div className="flex justify-end gap-3 border-t border-[#eceef1] bg-[#fcfcfd] px-7 py-4"><button type="button" onClick={closeCreate} className="h-10 rounded-md border border-[#cfd5dc] px-5 text-sm font-medium text-[#4c5561]">取消</button><button type="submit" disabled={isSaving || !createForm.name.trim() || (createType === 'object' && (!createForm.definition.trim() || !createForm.key.trim() || !createForm.owner.trim()))} className="h-10 rounded-md bg-[#e3473c] px-5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-[#e7a6a0]">{isSaving ? '保存中...' : '保存'}</button></div>
          </form>
        </div>
      )}
      {resourceDrawer && <OntologyObjectResourceDrawer mode={resourceDrawer.mode} object={resourceDrawer.object} objects={objects} properties={properties} relations={relations} onClose={() => setResourceDrawer(null)} onBind={bindResource} onUnbind={unbindResource} />}
    </div>
  )
}

export default OntologyProjectWorkspacePage


