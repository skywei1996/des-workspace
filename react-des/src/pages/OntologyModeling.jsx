import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import { useLanguage } from '../i18n'
import { listLocalDatasets } from '../utils/datasetStorage'
import { createModelingProject, deleteModelingProject, listModelingProjects, updateModelingProject } from '../utils/ontologyModelingApi'

const emptyForm = { name: '', domain: '', goal: '', owner: '', terminologyOwner: '', datasourceIds: [], modelingMode: 'blank', description: '' }

const ProjectIcon = ({ name }) => name === 'edit'
  ? <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current" strokeWidth="1.8"><path d="M4 20h4l11-11a2.8 2.8 0 0 0-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4"/></svg>
  : <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current" strokeWidth="1.8"><path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v5m4-5v5"/></svg>

function OntologyModeling() {
  const { language } = useLanguage()
  const isZh = language === 'zh'
  const navigate = useNavigate()
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editingProjectId, setEditingProjectId] = useState(null)
  const [deletingProject, setDeletingProject] = useState(null)
  const [datasets, setDatasets] = useState([])
  const [projects, setProjects] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [form, setForm] = useState(emptyForm)

  useEffect(() => {
    if (!isCreateOpen) return
    listLocalDatasets().then(setDatasets).catch(() => setDatasets([]))
  }, [isCreateOpen])

  useEffect(() => {
    let active = true
    listModelingProjects()
      .then((items) => { if (active) setProjects(items) })
      .catch(() => { if (active) setProjects([]) })
      .finally(() => { if (active) setIsLoading(false) })
    return () => { active = false }
  }, [])

  const updateForm = (field, value) => setForm((current) => ({ ...current, [field]: value }))
  const openCreate = () => {
    setEditingProjectId(null)
    setForm(emptyForm)
    setIsCreateOpen(true)
  }
  const openEdit = (project) => {
    setEditingProjectId(project.id)
    setForm({ ...emptyForm, ...project, datasourceIds: project.datasourceIds || [] })
    setIsCreateOpen(true)
  }
  const toggleDatasource = (id) => {
    setForm((current) => ({
      ...current,
      datasourceIds: current.datasourceIds.includes(id)
        ? current.datasourceIds.filter((item) => item !== id)
        : [...current.datasourceIds, id],
    }))
  }
  const submitProject = async (event) => {
    event.preventDefault()
    if (!form.name.trim() || !form.domain || !form.goal.trim() || !form.owner.trim() || !form.terminologyOwner.trim()) return
    if (form.modelingMode === 'datasource' && form.datasourceIds.length === 0) return
    setIsSaving(true)
    try {
      const payload = { ...form, name: form.name.trim(), goal: form.goal.trim(), owner: form.owner.trim(), terminologyOwner: form.terminologyOwner.trim() }
      const savedProject = editingProjectId ? await updateModelingProject(editingProjectId, payload) : await createModelingProject(payload)
      setProjects((current) => editingProjectId ? current.map((item) => item.id === savedProject.id ? savedProject : item) : [savedProject, ...current.filter((item) => item.id !== savedProject.id)])
      setForm(emptyForm)
      setEditingProjectId(null)
      setIsCreateOpen(false)
    } finally {
      setIsSaving(false)
    }
  }

  const confirmDelete = async () => {
    if (!deletingProject || isSaving) return
    setIsSaving(true)
    try {
      await deleteModelingProject(deletingProject.id)
      setProjects((current) => current.filter((item) => item.id !== deletingProject.id))
      setDeletingProject(null)
    } finally {
      setIsSaving(false)
    }
  }

  const requiresDatasource = form.modelingMode === 'datasource'
  return (
    <div className="flex h-screen overflow-hidden bg-[#f7f8fa]">
      <Sidebar activeTab="objects" />
      <main className="min-w-0 flex-1 overflow-y-auto">
        <header className="border-b border-[#e4e7eb] bg-white px-8 py-6">
          <div className="mx-auto flex max-w-[1280px] items-start justify-between gap-6">
            <div>
              <p className="text-xs font-semibold text-[#d94338]">ONTOLOGY PROJECTS</p>
              <h1 className="mt-2 text-2xl font-semibold text-[#20242b]">
                {isZh ? '项目' : 'Projects'}
              </h1>
              <p className="mt-1.5 text-sm text-[#717985]">
                {isZh
                  ? '按项目组织本体结构、业务逻辑和数据连接。'
                  : 'Organize ontology structure, business logic, and data connections by project.'}
              </p>
            </div>
            <button
              type="button"
              onClick={openCreate}
              className="h-10 rounded-md bg-[#e3473c] px-4 text-sm font-medium text-white transition hover:bg-[#cf3e34]"
            >
              {isZh ? '新建建模项目' : 'New modeling project'}
            </button>
          </div>
        </header>

        <section className="mx-auto max-w-[1280px] px-8 py-8">
          {isLoading ? <p className="text-sm text-[#858d98]">{isZh ? '正在加载项目...' : 'Loading projects...'}</p> : projects.length ? <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{projects.map((item) => <article key={item.id} className="flex min-h-[220px] flex-col rounded-[8px] border border-[#e6e9ed] bg-white p-5 shadow-[0_14px_30px_rgba(31,41,55,0.05)]"><div className="flex items-start justify-between gap-4"><div className="flex h-12 w-12 items-center justify-center rounded-[8px] bg-[#fff0ed] text-2xl text-[#e3473c]">♧</div><div className="flex gap-1"><button type="button" onClick={() => openEdit(item)} title={isZh ? '编辑项目' : 'Edit project'} aria-label={isZh ? `编辑项目 ${item.name}` : `Edit project ${item.name}`} className="flex h-8 w-8 items-center justify-center rounded-md text-[#69727e] transition hover:bg-[#f1f3f5] hover:text-[#303741]"><ProjectIcon name="edit" /></button><button type="button" onClick={() => setDeletingProject(item)} title={isZh ? '删除项目' : 'Delete project'} aria-label={isZh ? `删除项目 ${item.name}` : `Delete project ${item.name}`} className="flex h-8 w-8 items-center justify-center rounded-md text-[#69727e] transition hover:bg-[#fff0ed] hover:text-[#d94338]"><ProjectIcon name="delete" /></button></div></div><h2 className="mt-5 text-lg font-semibold text-[#20242b]">{item.name}</h2><p className="mt-2 min-h-[40px] text-sm leading-5 text-[#717985]">{item.description || item.goal || (isZh ? '暂未填写项目说明' : 'No project description')}</p><div className="mt-auto flex items-end justify-between gap-4 border-t border-[#edf0f2] pt-4"><p className="text-xs text-[#858d98]">{item.domain || (isZh ? '未分类' : 'Uncategorized')} · {item.owner || (isZh ? '未指定负责人' : 'No owner')}</p><button type="button" onClick={() => navigate(`/ontology-modeling/projects/${item.id}`)} className="shrink-0 text-sm font-medium text-[#e3473c] hover:text-[#cf3e34]">{isZh ? '进入项目 →' : 'Open project →'}</button></div></article>)}</div> : <div className="border border-dashed border-[#cfd5dc] bg-white px-6 py-16 text-center text-sm text-[#858d98]">{isZh ? '还没有建模项目，点击右上角新建建模项目开始。' : 'No modeling projects yet. Create one to get started.'}</div>}
        </section>
      </main>
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#17191f]/35 px-4 py-6" onMouseDown={() => setIsCreateOpen(false)}>
          <form className="max-h-[92vh] w-full max-w-[760px] overflow-y-auto rounded-lg bg-white shadow-[0_24px_70px_rgba(15,23,42,0.2)]" onSubmit={submitProject} onMouseDown={(event) => event.stopPropagation()}>
            <div className="border-b border-[#eceef1] px-7 py-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold text-[#d94338]">{editingProjectId ? 'EDIT MODELING PROJECT' : 'NEW MODELING PROJECT'}</p>
                  <h2 className="mt-1 text-xl font-semibold text-[#20242b]">{editingProjectId ? (isZh ? '编辑建模项目' : 'Edit modeling project') : (isZh ? '新建建模项目' : 'New modeling project')}</h2>
                  <p className="mt-1 text-sm text-[#717985]">{editingProjectId ? (isZh ? '更新项目范围、责任人与建模方式。' : 'Update the project scope, owners, and modeling method.') : (isZh ? '先定义建模范围和责任人，项目创建后从草稿开始。' : 'Define the scope and owners before starting from a draft.')}</p>
                </div>
                <button type="button" onClick={() => setIsCreateOpen(false)} className="h-8 w-8 text-xl text-[#7b828c]" aria-label={isZh ? '关闭' : 'Close'}>×</button>
              </div>
            </div>
            <div className="space-y-6 px-7 py-6">
              <div className="grid gap-5 md:grid-cols-2">
                <label className="block text-sm md:col-span-2"><span className="mb-2 block font-semibold text-[#353c46]">{isZh ? '项目名称' : 'Project name'} *</span><input autoFocus value={form.name} onChange={(event) => updateForm('name', event.target.value)} placeholder={isZh ? '例如：采购成本域本体建模' : 'For example: Procurement cost ontology'} className="h-10 w-full rounded-md border border-[#cfd5dc] px-3 outline-none focus:border-[#e3473c]" /></label>
                <label className="block text-sm"><span className="mb-2 block font-semibold text-[#353c46]">{isZh ? '业务域' : 'Business domain'} *</span><select value={form.domain} onChange={(event) => updateForm('domain', event.target.value)} className="h-10 w-full rounded-md border border-[#cfd5dc] px-3"><option value="">{isZh ? '请选择业务域' : 'Select a domain'}</option>{['采购', '生产', '销售', '人力', '财务', '其他'].map((item) => <option key={item} value={item}>{isZh ? item : item}</option>)}</select></label>
                <label className="block text-sm"><span className="mb-2 block font-semibold text-[#353c46]">{isZh ? '项目负责人' : 'Project owner'} *</span><input value={form.owner} onChange={(event) => updateForm('owner', event.target.value)} placeholder={isZh ? '例如：张三' : 'For example: Alex Zhang'} className="h-10 w-full rounded-md border border-[#cfd5dc] px-3" /></label>
                <label className="block text-sm"><span className="mb-2 block font-semibold text-[#353c46]">{isZh ? '业务口径 Owner' : 'Terminology owner'} *</span><input value={form.terminologyOwner} onChange={(event) => updateForm('terminologyOwner', event.target.value)} placeholder={isZh ? '负责概念和指标口径的人' : 'Owner of business definitions'} className="h-10 w-full rounded-md border border-[#cfd5dc] px-3" /></label>
                <label className="block text-sm md:col-span-2"><span className="mb-2 block font-semibold text-[#353c46]">{isZh ? '建模目标' : 'Modeling goal'} *</span><textarea value={form.goal} onChange={(event) => updateForm('goal', event.target.value)} rows={3} placeholder={isZh ? '例如：支持采购价格异常识别、历史比价和订单完整性检查。' : 'For example: Detect price anomalies and validate purchase order completeness.'} className="w-full resize-none rounded-md border border-[#cfd5dc] px-3 py-2" /></label>
              </div>
              <fieldset><legend className="mb-3 text-sm font-semibold text-[#353c46]">{isZh ? '建模方式' : 'Modeling method'} *</legend><div className="grid gap-3 md:grid-cols-2">{[['blank', '空白项目', '从业务概念开始搭建对象模型。'], ['datasource', '基于数据源', '先检查字段质量，再从数据字段开始建模。'], ['description', '基于业务描述', '根据文字描述识别候选对象和属性。'], ['existing', '导入已有对象', '将现有对象作为本项目的建模起点。']].map(([value, title, description]) => <label key={value} className={`cursor-pointer border p-4 transition ${form.modelingMode === value ? 'border-[#e3473c] bg-[#fff8f6] ring-1 ring-[#e3473c]' : 'border-[#dfe3e8] hover:border-[#bcc4ce]'}`}><input type="radio" name="modeling-mode" value={value} checked={form.modelingMode === value} onChange={(event) => updateForm('modelingMode', event.target.value)} className="sr-only" /><span className="block text-sm font-semibold text-[#303741]">{isZh ? title : title}</span><span className="mt-1 block text-xs leading-5 text-[#717985]">{isZh ? description : description}</span></label>)}</div></fieldset>
              <fieldset className={`border p-4 ${requiresDatasource ? 'border-[#e3473c] bg-[#fffaf9]' : 'border-[#dfe3e8] bg-[#fafbfc]'}`}><legend className="px-1 text-sm font-semibold text-[#353c46]">{isZh ? '项目数据源' : 'Project datasources'} <span className="font-normal text-[#858d98]">({requiresDatasource ? (isZh ? '基于数据源时必选' : 'required for this method') : (isZh ? '可稍后补充' : 'can be added later')})</span></legend><p className="mb-3 mt-1 text-xs leading-5 text-[#717985]">{requiresDatasource ? (isZh ? '用于字段审计和对象候选识别。对象正式绑定将在数据清洗后的数据映射阶段完成。' : 'Used for field auditing and object discovery. Formal object binding happens after cleansing.') : (isZh ? '当前建模方式可以先创建项目，后续在数据映射阶段补充清洗后的数据源。' : 'This method can start without a datasource. Add the cleansed backing dataset during mapping later.')}</p><div className="max-h-36 overflow-y-auto border border-[#dfe3e8] bg-white">{datasets.length ? datasets.map((dataset) => <label key={dataset.id} className={`flex items-center gap-3 border-b border-[#edf0f2] px-4 py-3 last:border-0 ${requiresDatasource ? 'cursor-pointer hover:bg-[#fff8f6]' : 'cursor-pointer hover:bg-[#f7f9fb]'}`}><input type="checkbox" checked={form.datasourceIds.includes(dataset.id)} onChange={() => toggleDatasource(dataset.id)} className="h-4 w-4 accent-[#e3473c]" /><span className="min-w-0"><span className="block truncate text-sm text-[#303741]">{dataset.name}</span><span className="text-xs text-[#858d98]">{(dataset.extension || dataset.type || 'FILE').toUpperCase()}</span></span></label>) : <p className="px-4 py-4 text-xs text-[#858d98]">{isZh ? '暂无可用数据集，可在资源模块导入后再补充。' : 'No datasets available. You can add them later from Resources.'}</p>}</div>{requiresDatasource && form.datasourceIds.length === 0 && <p className="mt-2 text-xs text-[#d94338]">{isZh ? '请选择至少一个数据集后创建项目。' : 'Select at least one dataset to create this project.'}</p>}</fieldset>
              <label className="block text-sm"><span className="mb-2 block font-semibold text-[#353c46]">{isZh ? '项目说明' : 'Project description'}</span><textarea value={form.description} onChange={(event) => updateForm('description', event.target.value)} rows={3} placeholder={isZh ? '说明建模范围、暂不纳入的内容和限制条件。' : 'Describe scope, exclusions, and constraints.'} className="w-full resize-none rounded-md border border-[#cfd5dc] px-3 py-2" /></label>
            </div>
            <div className="flex items-center justify-between gap-4 border-t border-[#eceef1] bg-[#fcfcfd] px-7 py-4"><span className="text-xs text-[#858d98]">{requiresDatasource ? (isZh ? '将从所选数据源开始字段审计。' : 'The project will start with field auditing.') : editingProjectId ? (isZh ? '保存后项目配置立即生效。' : 'Project settings take effect after saving.') : (isZh ? '项目创建后从草稿开始，不会立即绑定对象实例。' : 'The project starts as a draft and does not bind object instances yet.')}</span><div className="flex shrink-0 gap-3"><button type="button" onClick={() => setIsCreateOpen(false)} className="h-10 rounded-md border border-[#cfd5dc] px-5 text-sm font-medium text-[#4c5561]">{isZh ? '取消' : 'Cancel'}</button><button type="submit" disabled={isSaving || !form.name.trim() || !form.domain || !form.goal.trim() || !form.owner.trim() || !form.terminologyOwner.trim() || (requiresDatasource && form.datasourceIds.length === 0)} className="h-10 rounded-md bg-[#e3473c] px-5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-[#e7a6a0]">{isSaving ? (isZh ? '保存中...' : 'Saving...') : editingProjectId ? (isZh ? '保存修改' : 'Save changes') : (isZh ? '创建项目' : 'Create project')}</button></div></div>
          </form>
        </div>
      )}
      {deletingProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#17191f]/35 px-4" onMouseDown={() => !isSaving && setDeletingProject(null)}>
          <div role="dialog" aria-modal="true" aria-labelledby="delete-project-title" className="w-full max-w-[440px] rounded-lg bg-white p-6 shadow-[0_24px_70px_rgba(15,23,42,0.2)]" onMouseDown={(event) => event.stopPropagation()}>
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[#fff0ed] text-[#d94338]"><ProjectIcon name="delete" /></div>
            <h2 id="delete-project-title" className="mt-4 text-lg font-semibold text-[#20242b]">{isZh ? '删除项目？' : 'Delete project?'}</h2>
            <p className="mt-2 text-sm leading-6 text-[#69727e]">{isZh ? `“${deletingProject.name}”及其对象、属性、动作和函数将被永久删除，此操作无法撤销。` : `“${deletingProject.name}” and its objects, properties, actions, and functions will be permanently deleted. This cannot be undone.`}</p>
            <div className="mt-6 flex justify-end gap-3"><button type="button" disabled={isSaving} onClick={() => setDeletingProject(null)} className="h-10 rounded-md border border-[#cfd5dc] px-5 text-sm font-medium text-[#4c5561] disabled:opacity-50">{isZh ? '取消' : 'Cancel'}</button><button type="button" disabled={isSaving} onClick={confirmDelete} className="h-10 rounded-md bg-[#d94338] px-5 text-sm font-medium text-white hover:bg-[#c13930] disabled:opacity-50">{isSaving ? (isZh ? '删除中...' : 'Deleting...') : (isZh ? '删除项目' : 'Delete project')}</button></div>
          </div>
        </div>
      )}
    </div>
  )
}

export default OntologyModeling