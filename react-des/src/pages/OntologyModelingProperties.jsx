import React, { useState } from 'react'
import { useEffect } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import { getModelingProject, listModelingObjects } from '../utils/ontologyModelingApi'

const stages = [
  { number: '01', title: '对象定义', route: '/ontology-modeling/projects/blank' },
  { number: '02', title: '属性字典', route: '/ontology-modeling/projects/blank/properties' },
  { number: '03', title: '对象关系', route: '/ontology-modeling/projects/blank/relations' },
  { number: '04', title: '数据映射', route: '/ontology-modeling/projects/blank/mapping' },
  { number: '05', title: '校验与发布', route: '/ontology-modeling/projects/blank/validation' },
]

const emptyProperty = {
  name: '',
  apiName: '',
  dataType: '文本',
  description: '',
  required: false,
  primaryKey: false,
  source: '待映射',
}

function OntologyModelingProperties() {
  const navigate = useNavigate()
  const location = useLocation()
  const { projectId } = useParams()
  const [project, setProject] = useState(location.state?.project || null)
  const [objects, setObjects] = useState(location.state?.objects || [])
  const [isLoading, setIsLoading] = useState(Boolean(projectId))
  const [selectedObjectKey, setSelectedObjectKey] = useState(objects[0]?.key || '')
  const [propertiesByObject, setPropertiesByObject] = useState({})
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [form, setForm] = useState(emptyProperty)

  useEffect(() => {
    if (!projectId) return
    let active = true
    Promise.all([getModelingProject(projectId), listModelingObjects(projectId)])
      .then(([savedProject, savedObjects]) => {
        if (!active) return
        setProject(savedProject)
        setObjects(savedObjects)
        setSelectedObjectKey((current) => current || savedObjects[0]?.key || '')
      })
      .catch(() => {
        if (active) setProject(null)
      })
      .finally(() => {
        if (active) setIsLoading(false)
      })
    return () => { active = false }
  }, [projectId])

  const selectedObject = objects.find((object) => object.key === selectedObjectKey)
  const properties = propertiesByObject[selectedObjectKey] || []
  const updateForm = (field, value) => setForm((current) => ({ ...current, [field]: value }))
  const canSubmit = selectedObject && form.name.trim() && form.apiName.trim() && form.description.trim()

  const openCreate = () => {
    setForm(emptyProperty)
    setIsCreateOpen(true)
  }

  const submitProperty = (event) => {
    event.preventDefault()
    if (!canSubmit) return
    setPropertiesByObject((current) => ({
      ...current,
      [selectedObjectKey]: [
        ...(current[selectedObjectKey] || []),
        { ...form, name: form.name.trim(), apiName: form.apiName.trim(), description: form.description.trim() },
      ],
    }))
    setIsCreateOpen(false)
  }

  const goToStage = (route) => navigate(route.replace('/blank', `/${project.id}`), { state: { project, objects, propertiesByObject } })

  if (isLoading) {
    return <div className="flex h-screen items-center justify-center bg-[#f7f8fa] text-sm text-[#717985]">正在加载建模项目...</div>
  }

  if (!project) {
    return (
      <div className="flex h-screen overflow-hidden bg-[#f7f8fa]"><Sidebar activeTab="objects" /><main className="flex min-w-0 flex-1 items-center justify-center px-8"><div className="max-w-md text-center"><h1 className="text-xl font-semibold text-[#20242b]">项目上下文已失效</h1><p className="mt-2 text-sm leading-6 text-[#717985]">请从对象建模页面选择一个项目进入工作台。</p><button type="button" onClick={() => navigate('/ontology-modeling')} className="mt-5 h-10 rounded-md bg-[#e3473c] px-4 text-sm font-medium text-white">返回对象建模</button></div></main></div>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#f7f8fa]">
      <Sidebar activeTab="objects" />
      <main className="min-w-0 flex-1 overflow-y-auto">
        <header className="border-b border-[#e4e7eb] bg-white px-8 py-5">
          <div className="mx-auto flex max-w-[1280px] items-start justify-between gap-6">
            <div><button type="button" onClick={() => navigate('/ontology-modeling')} className="mb-3 text-sm font-medium text-[#717985] hover:text-[#d94338]">← 返回项目总览</button><div className="flex flex-wrap items-center gap-3"><h1 className="text-2xl font-semibold text-[#20242b]">{project.name}</h1><span className="rounded-full bg-[#fff0ed] px-2.5 py-1 text-xs font-medium text-[#d94338]">草稿 v0.1</span></div><p className="mt-1.5 text-sm text-[#717985]">{project.domain} · 项目负责人：{project.owner} · 业务口径 Owner：{project.terminologyOwner}</p></div>
            <button type="button" onClick={() => navigate('/ontology-modeling')} className="h-9 rounded-md border border-[#cfd5dc] px-4 text-sm font-medium text-[#4c5561]">编辑项目</button>
          </div>
        </header>
        <div className="mx-auto flex max-w-[1280px] gap-6 px-8 py-7">
          <aside className="w-56 shrink-0 border border-[#e0e3e7] bg-white p-3"><div className="px-3 pb-3 pt-2 text-xs font-semibold uppercase tracking-[0.08em] text-[#858d98]">项目阶段</div><nav className="space-y-1">{stages.map((stage) => <button key={stage.number} type="button" onClick={() => goToStage(stage.route)} disabled={stage.number !== '01' && stage.number !== '02'} className={`flex w-full items-center gap-3 px-3 py-3 text-left ${stage.number === '02' ? 'bg-[#fff3f0] text-[#d94338]' : stage.number === '01' ? 'text-[#68717d] hover:bg-[#f7f8fa]' : 'cursor-not-allowed text-[#a1a8b1]'}`}><span className="text-xs font-semibold">{stage.number}</span><span className="text-sm font-medium">{stage.title}</span>{stage.number === '02' && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[#e3473c]" />}</button>)}</nav></aside>
          <section className="min-w-0 flex-1"><div className="border border-[#e0e3e7] bg-white p-6"><div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#eceef1] pb-5"><div><p className="text-xs font-semibold text-[#d94338]">STEP 02</p><h2 className="mt-1 text-xl font-semibold text-[#20242b]">属性字典</h2><p className="mt-1.5 max-w-2xl text-sm leading-6 text-[#717985]">为每个对象定义可被理解、校验和映射的属性。先完成业务语义，数据来源可以在后续数据映射阶段补充。</p></div><button type="button" onClick={openCreate} disabled={!selectedObject} className="h-10 rounded-md bg-[#e3473c] px-4 text-sm font-medium text-white hover:bg-[#cf3e34] disabled:cursor-not-allowed disabled:bg-[#e7a6a0]">+ 新建属性</button></div>
            {objects.length === 0 ? <div className="mt-5 border border-dashed border-[#cfd5dc] bg-[#fafbfc] px-6 py-12 text-center"><h3 className="text-base font-semibold text-[#303741]">请先完成对象定义</h3><p className="mt-2 text-sm text-[#858d98]">属性必须归属于一个对象，请返回对象定义阶段创建对象。</p><button type="button" onClick={() => navigate('/ontology-modeling/projects/blank', { state: { project } })} className="mt-4 text-sm font-medium text-[#d94338]">返回对象定义</button></div> : <><div className="mt-5 flex flex-wrap items-end justify-between gap-4"><label className="block min-w-[260px] flex-1 text-sm"><span className="mb-2 block font-semibold text-[#353c46]">当前对象</span><select value={selectedObjectKey} onChange={(event) => setSelectedObjectKey(event.target.value)} className="h-10 w-full border border-[#cfd5dc] bg-white px-3 text-sm">{objects.map((object) => <option key={object.key} value={object.key}>{object.name} · {object.key}</option>)}</select></label><span className="text-xs text-[#858d98]">已定义 {properties.length} 个属性</span></div>{properties.length === 0 ? <div className="mt-4 border border-dashed border-[#cfd5dc] bg-[#fafbfc] px-6 py-12 text-center"><h3 className="text-base font-semibold text-[#303741]">{selectedObject.name} 还没有属性</h3><p className="mx-auto mt-1.5 max-w-md text-sm leading-6 text-[#858d98]">建议至少定义一个唯一标识属性和一个用于展示的标题属性，再继续数据映射。</p><button type="button" onClick={openCreate} className="mt-4 text-sm font-medium text-[#d94338]">新建第一个属性</button></div> : <div className="mt-4 overflow-x-auto border border-[#e0e3e7]"><div className="min-w-[760px]"><div className="grid grid-cols-[1.1fr_1.1fr_100px_1.5fr_100px] gap-3 border-b border-[#edf0f2] bg-[#fafbfc] px-4 py-3 text-xs font-semibold text-[#747d88]"><span>属性名称</span><span>API 名称</span><span>类型</span><span>业务说明</span><span>状态</span></div>{properties.map((property) => <div key={property.apiName} className="grid grid-cols-[1.1fr_1.1fr_100px_1.5fr_100px] gap-3 border-b border-[#edf0f2] px-4 py-4 last:border-0 text-sm"><div className="font-medium text-[#303741]">{property.name}{property.primaryKey && <span className="ml-2 bg-[#fff0ed] px-1.5 py-0.5 text-[11px] text-[#d94338]">主键</span>}</div><div className="text-[#68717d]">{property.apiName}</div><div className="text-[#68717d]">{property.dataType}</div><div className="text-[#68717d]">{property.description}</div><div><span className="bg-[#f1f2f4] px-2 py-1 text-xs text-[#68717d]">{property.source}</span></div></div>)}</div></div>}</>}</div></section>
        </div>
      </main>
      {isCreateOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#17191f]/35 px-4 py-6" onMouseDown={() => setIsCreateOpen(false)}><form onSubmit={submitProperty} onMouseDown={(event) => event.stopPropagation()} className="max-h-[92vh] w-full max-w-[620px] overflow-y-auto rounded-lg bg-white shadow-[0_24px_70px_rgba(15,23,42,0.2)]"><div className="border-b border-[#eceef1] px-7 py-5"><p className="text-xs font-semibold text-[#d94338]">DEFINE PROPERTY</p><h2 className="mt-1 text-xl font-semibold text-[#20242b]">新建属性</h2><p className="mt-1 text-sm text-[#717985]">先补充业务语义，来源字段和清洗规则在数据映射阶段配置。</p></div><div className="space-y-5 px-7 py-6"><div className="grid gap-5 md:grid-cols-2"><label className="block text-sm"><span className="mb-2 block font-semibold text-[#353c46]">属性名称 *</span><input autoFocus value={form.name} onChange={(event) => updateForm('name', event.target.value)} placeholder="例如：计划编号" className="h-10 w-full border border-[#cfd5dc] px-3 outline-none focus:border-[#e3473c]" /></label><label className="block text-sm"><span className="mb-2 block font-semibold text-[#353c46]">API 名称 *</span><input value={form.apiName} onChange={(event) => updateForm('apiName', event.target.value)} placeholder="例如：plan_id" className="h-10 w-full border border-[#cfd5dc] px-3 outline-none focus:border-[#e3473c]" /></label></div><label className="block text-sm"><span className="mb-2 block font-semibold text-[#353c46]">业务说明 *</span><textarea value={form.description} onChange={(event) => updateForm('description', event.target.value)} rows={3} placeholder="说明这个属性的业务含义、口径和使用边界。" className="w-full resize-none border border-[#cfd5dc] px-3 py-2 outline-none focus:border-[#e3473c]" /></label><label className="block text-sm"><span className="mb-2 block font-semibold text-[#353c46]">数据类型</span><select value={form.dataType} onChange={(event) => updateForm('dataType', event.target.value)} className="h-10 w-full border border-[#cfd5dc] bg-white px-3"><option>文本</option><option>数字</option><option>日期</option><option>布尔</option><option>枚举</option></select></label><div className="flex flex-wrap gap-5 text-sm"><label className="flex items-center gap-2"><input type="checkbox" checked={form.required} onChange={(event) => updateForm('required', event.target.checked)} className="h-4 w-4 accent-[#e3473c]" />必填属性</label><label className="flex items-center gap-2"><input type="checkbox" checked={form.primaryKey} onChange={(event) => updateForm('primaryKey', event.target.checked)} className="h-4 w-4 accent-[#e3473c]" />作为主键</label></div></div><div className="flex justify-end gap-3 border-t border-[#eceef1] bg-[#fcfcfd] px-7 py-4"><button type="button" onClick={() => setIsCreateOpen(false)} className="h-10 border border-[#cfd5dc] px-5 text-sm font-medium text-[#4c5561]">取消</button><button type="submit" disabled={!canSubmit} className="h-10 bg-[#e3473c] px-5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-[#e7a6a0]">创建属性</button></div></form></div>}
    </div>
  )
}

export default OntologyModelingProperties
