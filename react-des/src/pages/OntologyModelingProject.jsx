import React, { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import { createModelingObject, getModelingProject, listModelingObjects } from '../utils/ontologyModelingApi'

const stages = [
  { number: '01', title: '对象定义', status: 'current' },
  { number: '02', title: '属性字典', status: 'next' },
  { number: '03', title: '对象关系', status: 'next' },
  { number: '04', title: '数据映射', status: 'next' },
  { number: '05', title: '校验与发布', status: 'next' },
]

const emptyObject = {
  name: '',
  definition: '',
  key: '',
  owner: '',
  lifecycle: '长期存在',
}

function OntologyModelingProject() {
  const navigate = useNavigate()
  const location = useLocation()
  const { projectId } = useParams()
  const [project, setProject] = useState(location.state?.project || null)
  const [objects, setObjects] = useState(location.state?.objects || [])
  const [isLoading, setIsLoading] = useState(Boolean(projectId))
  const [isSaving, setIsSaving] = useState(false)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [form, setForm] = useState(emptyObject)

  useEffect(() => {
    if (!projectId) return
    let active = true
    Promise.all([getModelingProject(projectId), listModelingObjects(projectId)])
      .then(([savedProject, savedObjects]) => {
        if (!active) return
        setProject(savedProject)
        setObjects(savedObjects)
      })
      .catch(() => {
        if (active) setProject(null)
      })
      .finally(() => {
        if (active) setIsLoading(false)
      })
    return () => { active = false }
  }, [projectId])

  const updateForm = (field, value) => setForm((current) => ({ ...current, [field]: value }))
  const canSubmit = form.name.trim() && form.definition.trim() && form.key.trim() && form.owner.trim()

  const submitObject = async (event) => {
    event.preventDefault()
    if (!canSubmit || !project?.id) return
    setIsSaving(true)
    try {
      const savedObject = await createModelingObject(project.id, { ...form, name: form.name.trim(), definition: form.definition.trim(), key: form.key.trim(), owner: form.owner.trim() })
      setObjects((current) => [...current, savedObject])
      setForm(emptyObject)
      setIsCreateOpen(false)
    } finally {
      setIsSaving(false)
    }
  }

  const goToProperties = () => navigate(`/ontology-modeling/projects/${project.id}/properties`, { state: { project, objects } })

  if (isLoading) {
    return <div className="flex h-screen items-center justify-center bg-[#f7f8fa] text-sm text-[#717985]">正在加载建模项目...</div>
  }

  if (!project) {
    return (
      <div className="flex h-screen overflow-hidden bg-[#f7f8fa]">
        <Sidebar activeTab="objects" />
        <main className="flex min-w-0 flex-1 items-center justify-center px-8">
          <div className="max-w-md text-center">
            <h1 className="text-xl font-semibold text-[#20242b]">项目上下文已失效</h1>
            <p className="mt-2 text-sm leading-6 text-[#717985]">请从对象建模页面选择一个项目进入工作台。</p>
            <button type="button" onClick={() => navigate('/ontology-modeling')} className="mt-5 h-10 rounded-md bg-[#e3473c] px-4 text-sm font-medium text-white">返回对象建模</button>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#f7f8fa]">
      <Sidebar activeTab="objects" />
      <main className="min-w-0 flex-1 overflow-y-auto">
        <header className="border-b border-[#e4e7eb] bg-white px-8 py-5">
          <div className="mx-auto flex max-w-[1280px] items-start justify-between gap-6">
            <div>
              <button type="button" onClick={() => navigate('/ontology-modeling')} className="mb-3 text-sm font-medium text-[#717985] hover:text-[#d94338]">← 返回项目总览</button>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-semibold text-[#20242b]">{project.name}</h1>
                <span className="rounded-full bg-[#fff0ed] px-2.5 py-1 text-xs font-medium text-[#d94338]">草稿 v0.1</span>
              </div>
              <p className="mt-1.5 text-sm text-[#717985]">{project.domain} · 项目负责人：{project.owner} · 业务口径 Owner：{project.terminologyOwner}</p>
            </div>
            <button type="button" onClick={() => navigate('/ontology-modeling')} className="h-9 rounded-md border border-[#cfd5dc] px-4 text-sm font-medium text-[#4c5561]">编辑项目</button>
          </div>
        </header>

        <div className="mx-auto flex max-w-[1280px] gap-6 px-8 py-7">
          <aside className="w-56 shrink-0 border border-[#e0e3e7] bg-white p-3">
            <div className="px-3 pb-3 pt-2 text-xs font-semibold uppercase tracking-[0.08em] text-[#858d98]">项目阶段</div>
            <nav className="space-y-1">
              {stages.map((stage) => (
                <button key={stage.number} type="button" onClick={stage.number === '02' ? goToProperties : undefined} disabled={stage.status !== 'current' && !(stage.number === '02' && objects.length > 0)} className={`flex w-full items-center gap-3 px-3 py-3 text-left ${stage.status === 'current' ? 'bg-[#fff3f0] text-[#d94338]' : stage.number === '02' && objects.length > 0 ? 'text-[#68717d] hover:bg-[#f7f8fa]' : 'cursor-not-allowed text-[#a1a8b1]'}`}>
                  <span className="text-xs font-semibold">{stage.number}</span>
                  <span className="text-sm font-medium">{stage.title}</span>
                  {stage.status === 'current' && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[#e3473c]" />}
                </button>
              ))}
            </nav>
          </aside>

          <section className="min-w-0 flex-1">
            <div className="border border-[#e0e3e7] bg-white p-6">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#eceef1] pb-5">
                <div>
                  <p className="text-xs font-semibold text-[#d94338]">STEP 01</p>
                  <h2 className="mt-1 text-xl font-semibold text-[#20242b]">对象定义</h2>
                  <p className="mt-1.5 max-w-2xl text-sm leading-6 text-[#717985]">先识别业务中需要被管理和追踪的实体，明确对象定义、唯一标识和责任人。属性和数据来源将在下一阶段继续补充。</p>
                </div>
                <button type="button" onClick={() => setIsCreateOpen(true)} className="h-10 rounded-md bg-[#e3473c] px-4 text-sm font-medium text-white hover:bg-[#cf3e34]">+ 新建对象</button>
              </div>

              <div className="mt-5 flex items-center justify-between gap-4 text-sm">
                <span className="font-medium text-[#353c46]">对象清单</span>
                <span className="text-xs text-[#858d98]">已定义 {objects.length} 个对象</span>
              </div>
              {objects.length === 0 ? (
                <div className="mt-4 border border-dashed border-[#cfd5dc] bg-[#fafbfc] px-6 py-12 text-center">
                  <div className="mx-auto flex h-11 w-11 items-center justify-center border border-[#e7a6a0] bg-[#fff3f0] text-xl text-[#d94338]">○</div>
                  <h3 className="mt-4 text-base font-semibold text-[#303741]">还没有对象</h3>
                  <p className="mx-auto mt-1.5 max-w-md text-sm leading-6 text-[#858d98]">从业务实体开始，例如生产主计划、生产订单、物料或生产资源。创建对象后，再为它补充属性。</p>
                  <button type="button" onClick={() => setIsCreateOpen(true)} className="mt-4 text-sm font-medium text-[#d94338]">新建第一个对象</button>
                </div>
              ) : (
                <div className="mt-4 divide-y divide-[#edf0f2] border border-[#e0e3e7]">
                  {objects.map((object, index) => (
                    <div key={`${object.key}-${index}`} className="flex flex-wrap items-start justify-between gap-4 px-4 py-4">
                      <div>
                        <h3 className="text-sm font-semibold text-[#303741]">{object.name}</h3>
                        <p className="mt-1 text-sm text-[#717985]">{object.definition}</p>
                        <p className="mt-2 text-xs text-[#858d98]">唯一标识：{object.key} · Owner：{object.owner} · 生命周期：{object.lifecycle}</p>
                      </div>
                      <button type="button" onClick={goToProperties} className="rounded-full bg-[#f1f2f4] px-2.5 py-1 text-xs text-[#68717d] hover:bg-[#fff0ed] hover:text-[#d94338]">待补充属性</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      </main>

      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#17191f]/35 px-4 py-6" onMouseDown={() => setIsCreateOpen(false)}>
          <form onSubmit={submitObject} onMouseDown={(event) => event.stopPropagation()} className="max-h-[92vh] w-full max-w-[620px] overflow-y-auto rounded-lg bg-white shadow-[0_24px_70px_rgba(15,23,42,0.2)]">
            <div className="border-b border-[#eceef1] px-7 py-5">
              <p className="text-xs font-semibold text-[#d94338]">DEFINE OBJECT</p>
              <h2 className="mt-1 text-xl font-semibold text-[#20242b]">新建对象</h2>
              <p className="mt-1 text-sm text-[#717985]">先定义业务实体本身，属性和数据映射可以稍后补充。</p>
            </div>
            <div className="space-y-5 px-7 py-6">
              <label className="block text-sm"><span className="mb-2 block font-semibold text-[#353c46]">对象名称 *</span><input autoFocus value={form.name} onChange={(event) => updateForm('name', event.target.value)} placeholder="例如：生产主计划" className="h-10 w-full rounded-md border border-[#cfd5dc] px-3 outline-none focus:border-[#e3473c]" /></label>
              <label className="block text-sm"><span className="mb-2 block font-semibold text-[#353c46]">业务定义 *</span><textarea value={form.definition} onChange={(event) => updateForm('definition', event.target.value)} rows={3} placeholder="描述这个对象代表什么，以及它在业务中的边界。" className="w-full resize-none rounded-md border border-[#cfd5dc] px-3 py-2 outline-none focus:border-[#e3473c]" /></label>
              <div className="grid gap-5 md:grid-cols-2">
                <label className="block text-sm"><span className="mb-2 block font-semibold text-[#353c46]">唯一标识 *</span><input value={form.key} onChange={(event) => updateForm('key', event.target.value)} placeholder="例如：plan_id" className="h-10 w-full rounded-md border border-[#cfd5dc] px-3 outline-none focus:border-[#e3473c]" /></label>
                <label className="block text-sm"><span className="mb-2 block font-semibold text-[#353c46]">业务 Owner *</span><input value={form.owner} onChange={(event) => updateForm('owner', event.target.value)} placeholder="例如：张三" className="h-10 w-full rounded-md border border-[#cfd5dc] px-3 outline-none focus:border-[#e3473c]" /></label>
              </div>
              <label className="block text-sm"><span className="mb-2 block font-semibold text-[#353c46]">生命周期</span><select value={form.lifecycle} onChange={(event) => updateForm('lifecycle', event.target.value)} className="h-10 w-full rounded-md border border-[#cfd5dc] px-3"><option>长期存在</option><option>阶段性存在</option><option>事件触发产生</option></select></label>
            </div>
            <div className="flex justify-end gap-3 border-t border-[#eceef1] bg-[#fcfcfd] px-7 py-4"><button type="button" onClick={() => setIsCreateOpen(false)} className="h-10 rounded-md border border-[#cfd5dc] px-5 text-sm font-medium text-[#4c5561]">取消</button><button type="submit" disabled={!canSubmit} className="h-10 rounded-md bg-[#e3473c] px-5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-[#e7a6a0]">创建对象</button></div>
          </form>
        </div>
      )}
    </div>
  )
}

export default OntologyModelingProject
