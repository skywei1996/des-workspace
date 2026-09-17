import React, { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import { OntologyProjectHeader, OntologyProjectNav } from '../components/OntologyProjectWorkspace'
import { createModelingRelation, getModelingProject, listModelingObjects, listModelingRelations } from '../utils/ontologyModelingApi'

const emptyRelation = {
  sourceObjectId: '', targetObjectId: '', name: '', apiName: '', cardinality: '1:N',
  sourceKey: '', targetKey: '', description: '', validationStatus: '待校验',
}

function OntologyModelingRelations() {
  const navigate = useNavigate()
  const location = useLocation()
  const { projectId } = useParams()
  const [searchParams] = useSearchParams()
  const [project, setProject] = useState(location.state?.project || null)
  const [objects, setObjects] = useState(location.state?.objects || [])
  const [relations, setRelations] = useState([])
  const [isLoading, setIsLoading] = useState(Boolean(projectId && !location.state?.project))
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [form, setForm] = useState(emptyRelation)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  useEffect(() => {
    if (!projectId) return
    let active = true
    Promise.all([getModelingProject(projectId), listModelingObjects(projectId), listModelingRelations(projectId)])
      .then(([savedProject, savedObjects, savedRelations]) => {
        if (!active) return
        setProject(savedProject)
        setObjects(savedObjects)
        setRelations(savedRelations)
      })
      .catch(() => { if (active) setProject(null) })
      .finally(() => { if (active) setIsLoading(false) })
    return () => { active = false }
  }, [projectId])

  useEffect(() => {
    if (searchParams.get('create') === 'relation' && objects.length >= 2) openCreate()
  }, [searchParams, objects.length])

  const objectName = (objectId) => objects.find((object) => object.id === objectId)?.name || '未知对象'
  const updateForm = (field, value) => setForm((current) => ({ ...current, [field]: value }))
  const canSubmit = form.sourceObjectId && form.targetObjectId && form.sourceObjectId !== form.targetObjectId && form.name.trim() && form.apiName.trim() && form.sourceKey.trim() && form.targetKey.trim() && form.description.trim()
  const openCreate = () => {
    setForm({ ...emptyRelation, sourceObjectId: objects[0]?.id || '', targetObjectId: objects[1]?.id || '' })
    setSaveError('')
    setIsCreateOpen(true)
  }
  const submitRelation = async (event) => {
    event.preventDefault()
    if (!canSubmit || isSaving) return
    setIsSaving(true)
    setSaveError('')
    try {
      const savedRelation = await createModelingRelation(project.id, { ...form, name: form.name.trim(), apiName: form.apiName.trim(), sourceKey: form.sourceKey.trim(), targetKey: form.targetKey.trim(), description: form.description.trim() })
      setRelations((current) => [...current, savedRelation])
      setIsCreateOpen(false)
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : '关系保存失败，请稍后重试。')
    } finally { setIsSaving(false) }
  }
  const goToStage = (route) => navigate(route.replace('/blank', `/${project.id}`), { state: { project, objects } })

  if (isLoading) return <div className="flex h-screen items-center justify-center bg-[#f7f8fa] text-sm text-[#717985]">正在加载建模项目...</div>
  if (!project) return <div className="flex h-screen items-center justify-center bg-[#f7f8fa]"><div className="text-center"><h1 className="text-xl font-semibold text-[#20242b]">项目上下文已失效</h1><button type="button" onClick={() => navigate('/ontology-modeling')} className="mt-5 h-10 rounded-md bg-[#e3473c] px-4 text-sm font-medium text-white">返回对象建模</button></div></div>

  return <div className="flex h-screen overflow-hidden bg-[#f7f8fa]"><Sidebar compact collapseStateKey="ontology-project" /><main className="min-w-0 flex-1 overflow-y-auto">
    <OntologyProjectHeader project={project} actions={<button type="button" onClick={() => navigate('/ontology-modeling')} className="h-9 rounded-md border border-[#cfd5dc] px-4 text-sm font-medium text-[#4c5561]">编辑项目</button>} />
    <div className="flex min-h-0 flex-1"><OntologyProjectNav projectId={project.id} project={project} activeItem="relations" />
      <section className="min-w-0 flex-1 overflow-y-auto p-6"><div className="mx-auto max-w-[1180px] border border-[#e0e3e7] bg-white p-6"><div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#eceef1] pb-5"><div><h2 className="text-xl font-semibold text-[#20242b]">关系</h2><p className="mt-1.5 max-w-2xl text-sm leading-6 text-[#717985]">维护对象之间可校验、可下钻的业务关联。</p></div><button type="button" onClick={openCreate} disabled={objects.length < 2} className="h-10 rounded-md bg-[#e3473c] px-4 text-sm font-medium text-white hover:bg-[#cf3e34] disabled:cursor-not-allowed disabled:bg-[#e7a6a0]">+ 新建关系</button></div>
        <div className="mt-5 flex items-center justify-between gap-4 text-sm"><span className="font-medium text-[#353c46]">关系清单</span><span className="text-xs text-[#858d98]">已定义 {relations.length} 条关系</span></div>
        {objects.length < 2 ? <div className="mt-4 border border-dashed border-[#cfd5dc] bg-[#fafbfc] px-6 py-12 text-center"><h3 className="text-base font-semibold text-[#303741]">至少需要两个对象</h3><p className="mt-2 text-sm text-[#858d98]">对象关系需要明确来源对象和目标对象，请先完成对象定义。</p></div> : relations.length === 0 ? <div className="mt-4 border border-dashed border-[#cfd5dc] bg-[#fafbfc] px-6 py-12 text-center"><h3 className="text-base font-semibold text-[#303741]">还没有对象关系</h3><p className="mx-auto mt-1.5 max-w-md text-sm leading-6 text-[#858d98]">例如：生产计划包含计划明细，使用主键和外键进行关联。</p><button type="button" onClick={openCreate} className="mt-4 text-sm font-medium text-[#d94338]">新建第一条关系</button></div> : <div className="mt-4 overflow-x-auto border border-[#e0e3e7]"><div className="min-w-[900px] grid grid-cols-[1.3fr_100px_1.3fr_1fr_90px_90px] gap-3 border-b border-[#edf0f2] bg-[#fafbfc] px-4 py-3 text-xs font-semibold text-[#747d88]"><span>关系</span><span>基数</span><span>关联对象</span><span>关联键</span><span>校验</span><span>状态</span></div>{relations.map((relation) => <div key={relation.id} className="min-w-[900px] grid grid-cols-[1.3fr_100px_1.3fr_1fr_90px_90px] gap-3 border-b border-[#edf0f2] px-4 py-4 last:border-0 text-sm"><div><p className="font-semibold text-[#303741]">{relation.name}</p><p className="mt-1 font-mono text-xs text-[#858d98]">{relation.apiName}</p></div><span className="text-[#4c5561]">{relation.cardinality}</span><span className="text-[#4c5561]">{objectName(relation.sourceObjectId)} → {objectName(relation.targetObjectId)}</span><span className="font-mono text-xs text-[#68717d]">{relation.sourceKey} → {relation.targetKey}</span><span className="text-xs text-[#2f8f61]">同项目</span><span className="text-xs text-[#858d98]">{relation.validationStatus}</span></div>)}</div>}
      </div></section></div>
    {isCreateOpen && <div className="fixed inset-0 z-50 bg-[#17191f]/35" onMouseDown={() => { if (!isSaving) setIsCreateOpen(false) }}><form onSubmit={submitRelation} onMouseDown={(event) => event.stopPropagation()} className="ml-auto h-full w-full max-w-[680px] overflow-y-auto bg-white shadow-[-20px_0_70px_rgba(15,23,42,0.2)]"><div className="border-b border-[#eceef1] px-7 py-5"><p className="text-xs font-semibold text-[#d94338]">DEFINE RELATION</p><h2 className="mt-1 text-xl font-semibold text-[#20242b]">新建对象关系</h2><p className="mt-1 text-sm text-[#71717d]">关系必须使用真实存在的主键、外键或业务键。</p></div><div className="space-y-5 px-7 py-6"><div className="grid gap-5 md:grid-cols-2"><label className="block text-sm"><span className="mb-2 block font-semibold text-[#353c46]">来源对象 *</span><select value={form.sourceObjectId} onChange={(event) => updateForm('sourceObjectId', event.target.value)} className="h-10 w-full border border-[#cfd5dc] bg-white px-3">{objects.map((object) => <option key={object.id} value={object.id}>{object.name} · {object.key}</option>)}</select></label><label className="block text-sm"><span className="mb-2 block font-semibold text-[#353c46]">目标对象 *</span><select value={form.targetObjectId} onChange={(event) => updateForm('targetObjectId', event.target.value)} className="h-10 w-full border border-[#cfd5dc] bg-white px-3">{objects.map((object) => <option key={object.id} value={object.id}>{object.name} · {object.key}</option>)}</select></label></div><div className="grid gap-5 md:grid-cols-2"><label className="block text-sm"><span className="mb-2 block font-semibold text-[#353c46]">关系名称 *</span><input value={form.name} onChange={(event) => updateForm('name', event.target.value)} placeholder="例如：包含明细" className="h-10 w-full border border-[#cfd5dc] px-3 outline-none focus:border-[#e3473c]" /></label><label className="block text-sm"><span className="mb-2 block font-semibold text-[#353c46]">API 名称 *</span><input value={form.apiName} onChange={(event) => updateForm('apiName', event.target.value)} placeholder="例如：contains_items" className="h-10 w-full border border-[#cfd5dc] px-3 outline-none focus:border-[#e3473c]" /></label></div><div className="grid gap-5 md:grid-cols-3"><label className="block text-sm"><span className="mb-2 block font-semibold text-[#353c46]">基数 *</span><select value={form.cardinality} onChange={(event) => updateForm('cardinality', event.target.value)} className="h-10 w-full border border-[#cfd5dc] bg-white px-3"><option>1:N</option><option>N:1</option><option>1:1</option><option>N:N</option></select></label><label className="block text-sm"><span className="mb-2 block font-semibold text-[#353c46]">来源键 *</span><input value={form.sourceKey} onChange={(event) => updateForm('sourceKey', event.target.value)} placeholder="例如：plan_id" className="h-10 w-full border border-[#cfd5dc] px-3 outline-none focus:border-[#e3473c]" /></label><label className="block text-sm"><span className="mb-2 block font-semibold text-[#353c46]">目标键 *</span><input value={form.targetKey} onChange={(event) => updateForm('targetKey', event.target.value)} placeholder="例如：plan_id" className="h-10 w-full border border-[#cfd5dc] px-3 outline-none focus:border-[#e3473c]" /></label></div><label className="block text-sm"><span className="mb-2 block font-semibold text-[#353c46]">关系说明 *</span><textarea value={form.description} onChange={(event) => updateForm('description', event.target.value)} rows={3} placeholder="说明关系的业务含义、关联口径和校验要求。" className="w-full resize-none border border-[#cfd5dc] px-3 py-2 outline-none focus:border-[#e3473c]" /></label>{saveError && <p className="text-sm text-[#d94338]">{saveError}</p>}</div><div className="flex justify-end gap-3 border-t border-[#eceef1] bg-[#fcfcfd] px-7 py-4"><button type="button" onClick={() => setIsCreateOpen(false)} disabled={isSaving} className="h-10 rounded-md border border-[#cfd5dc] px-5 text-sm font-medium text-[#4c5561]">取消</button><button type="submit" disabled={!canSubmit || isSaving} className="h-10 rounded-md bg-[#e3473c] px-5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-[#e7a6a0]">{isSaving ? '保存中...' : '保存关系'}</button></div></form></div>}
  </main></div>
}

export default OntologyModelingRelations