import React, { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import { getModelingProject } from '../utils/ontologyModelingApi'
import { listLocalDatasets } from '../utils/datasetStorage'

const stages = [
  { id: 'terminology', number: 'P0', title: '口径对齐', description: '统一业务词汇、指标公式、范围和口径 Owner。', action: '整理项目目标、Owner 和业务范围。' },
  { id: 'audit', number: 'P1', title: '数据接入与审计', description: '检查数据集的字段、格式、缺失、重复和异常。', action: '确认 raw 数据集已接入，并记录审计结论。' },
  { id: 'cleaning', number: 'P2', title: '清洗与标准化', description: '把异常处置和标准化规则固化为 cleaned 数据管道。', action: '登记清洗规则和 cleaned 数据集版本。' },
  { id: 'permissions', number: 'P7', title: '权限与角色', description: '配置 Markings、属性例外、GAP 和角色授权。', action: '确认最小权限、行级过滤和审计要求。' },
]

const storageKey = (projectId) => `ontology-modeling-governance:${projectId}`

function OntologyModelingGovernance() {
  const navigate = useNavigate()
  const location = useLocation()
  const { projectId, stageId = 'terminology' } = useParams()
  const [project, setProject] = useState(location.state?.project || null)
  const [datasets, setDatasets] = useState([])
  const [completed, setCompleted] = useState(() => {
    try { return JSON.parse(localStorage.getItem(storageKey(projectId)) || '{}') } catch { return {} }
  })
  const [note, setNote] = useState('')
  const [isLoading, setIsLoading] = useState(Boolean(projectId))
  const [error, setError] = useState('')
  const activeStage = stages.find((stage) => stage.id === stageId) || stages[0]

  useEffect(() => {
    if (!projectId) return
    let active = true
    Promise.all([getModelingProject(projectId), listLocalDatasets()])
      .then(([savedProject, savedDatasets]) => { if (active) { setProject(savedProject); setDatasets(savedDatasets) } })
      .catch((loadError) => { if (active) setError(loadError.message || '流程准备页加载失败。') })
      .finally(() => { if (active) setIsLoading(false) })
    return () => { active = false }
  }, [projectId])

  const stageState = useMemo(() => ({
    terminology: { status: Boolean(project?.terminologyOwner && project?.goal), detail: project?.terminologyOwner ? `口径 Owner：${project.terminologyOwner}` : '尚未登记业务口径 Owner。' },
    audit: { status: datasets.length > 0, detail: datasets.length ? `已接入 ${datasets.length} 个数据集，待记录字段级审计结论。` : '暂无可审计的数据集。' },
    cleaning: { status: Boolean(completed.cleaning), detail: completed.cleaning ? '已登记清洗规则草稿。' : '尚未登记清洗规则和 cleaned 版本。' },
    permissions: { status: Boolean(completed.permissions), detail: completed.permissions ? '已登记权限与角色评审结论。' : 'Markings、GAP 和角色授权尚未接入。' },
  }), [completed, datasets.length, project])

  const markComplete = () => {
    const next = { ...completed, [activeStage.id]: true }
    setCompleted(next)
    localStorage.setItem(storageKey(projectId), JSON.stringify(next))
    setNote(`${activeStage.title}已标记为完成，仍可重新打开修改。`)
  }

  const goToModelingStage = (path) => navigate(`/ontology-modeling/projects/${project.id}/${path}`, { state: { project } })

  if (isLoading) return <div className="flex h-screen items-center justify-center bg-[#f7f8fa] text-sm text-[#717985]">正在加载流程准备...</div>
  if (!project) return <div className="flex h-screen items-center justify-center bg-[#f7f8fa]"><div className="text-center"><h1 className="text-xl font-semibold text-[#20242b]">项目上下文已失效</h1><button type="button" onClick={() => navigate('/ontology-modeling')} className="mt-5 h-10 rounded-md bg-[#e3473c] px-4 text-sm font-medium text-white">返回对象建模</button></div></div>

  return <div className="flex h-screen overflow-hidden bg-[#f7f8fa]"><Sidebar activeTab="objects" /><main className="min-w-0 flex-1 overflow-y-auto"><header className="border-b border-[#e4e7eb] bg-white px-8 py-5"><div className="mx-auto flex max-w-[1280px] items-start justify-between gap-6"><div><button type="button" onClick={() => navigate(`/ontology-modeling/projects/${project.id}`)} className="mb-3 text-sm font-medium text-[#717985] hover:text-[#d94338]">← 返回对象定义</button><div className="flex flex-wrap items-center gap-3"><h1 className="text-2xl font-semibold text-[#20242b]">{project.name}</h1><span className="rounded-full bg-[#f1f2f4] px-2.5 py-1 text-xs font-medium text-[#68717d]">流程准备</span></div><p className="mt-1.5 text-sm text-[#717985]">P0-P2、P7 · 建模前的数据治理与发布后的权限准备</p></div></div></header><div className="mx-auto max-w-[1280px] px-8 py-7"><div className="flex gap-6"><aside className="w-64 shrink-0 border border-[#e0e3e7] bg-white p-3"><div className="px-3 pb-3 pt-2 text-xs font-semibold uppercase tracking-[0.08em] text-[#858d98]">文档阶段</div><nav className="space-y-1">{stages.map((stage) => { const state = stageState[stage.id]; return <button key={stage.id} type="button" onClick={() => navigate(`/ontology-modeling/projects/${project.id}/governance/${stage.id}`)} className={`flex w-full items-start gap-3 px-3 py-3 text-left ${stage.id === activeStage.id ? 'bg-[#fff3f0] text-[#d94338]' : 'text-[#68717d] hover:bg-[#f7f8fa]'}`}><span className="pt-0.5 text-xs font-semibold">{stage.number}</span><span className="min-w-0 flex-1"><span className="block text-sm font-medium">{stage.title}</span><span className={`mt-1 block text-xs ${state.status || completed[stage.id] ? 'text-[#2f8f61]' : 'text-[#858d98]'}`}>{completed[stage.id] || state.status ? '已准备' : '待准备'}</span></span></button> })}</nav></aside><section className="min-w-0 flex-1"><div className="border border-[#e0e3e7] bg-white p-6"><div className="border-b border-[#eceef1] pb-5"><p className="text-xs font-semibold text-[#d94338]">{activeStage.number}</p><h2 className="mt-1 text-xl font-semibold text-[#20242b]">{activeStage.title}</h2><p className="mt-1.5 max-w-3xl text-sm leading-6 text-[#717985]">{activeStage.description}</p></div>{error && <div className="mt-5 border border-[#f2c3bd] bg-[#fff5f3] px-4 py-3 text-sm text-[#b83b31]">{error}</div>}{note && <div className="mt-5 border border-[#b9dec7] bg-[#f0faf3] px-4 py-3 text-sm text-[#2f7f55]">{note}</div>}<div className="mt-6 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]"><div className="border border-[#e0e3e7] p-5"><h3 className="text-base font-semibold text-[#303741]">本阶段动作</h3><p className="mt-2 text-sm leading-6 text-[#717985]">{activeStage.action}</p>{activeStage.id === 'terminology' && <div className="mt-5 space-y-3 text-sm"><div className="flex justify-between border-b border-[#edf0f2] pb-3"><span className="text-[#858d98]">业务域</span><span className="font-medium text-[#303741]">{project.domain}</span></div><div className="flex justify-between border-b border-[#edf0f2] pb-3"><span className="text-[#858d98]">项目负责人</span><span className="font-medium text-[#303741]">{project.owner}</span></div><div className="flex justify-between"><span className="text-[#858d98]">口径 Owner</span><span className="font-medium text-[#303741]">{project.terminologyOwner || '待补充'}</span></div></div>}{activeStage.id === 'audit' && <div className="mt-5 space-y-2">{datasets.length ? datasets.map((dataset) => <div key={dataset.id} className="flex items-center justify-between border-b border-[#edf0f2] py-3 text-sm"><span className="truncate text-[#303741]">{dataset.name}</span><span className="text-xs text-[#858d98]">{(dataset.extension || 'FILE').toUpperCase()} · {dataset.size || 0} bytes</span></div>) : <p className="mt-5 text-sm text-[#858d98]">暂无数据集，请先到资源模块上传 raw 数据。</p>}</div>}{activeStage.id === 'cleaning' && <div className="mt-5 border border-dashed border-[#cfd5dc] bg-[#fafbfc] px-4 py-5 text-sm text-[#717985]">当前版本先登记清洗规则草稿。cleaned 数据集的实际管道接入将在数据处理能力接入后启用。</div>}{activeStage.id === 'permissions' && <div className="mt-5 border border-dashed border-[#cfd5dc] bg-[#fafbfc] px-4 py-5 text-sm text-[#717985]">当前版本先登记权限评审结论。Markings、GAP、角色授权和审计日志尚未接入运行时。</div>}<button type="button" onClick={markComplete} className="mt-6 h-10 rounded-md bg-[#e3473c] px-4 text-sm font-medium text-white hover:bg-[#cf3e34]">{completed[activeStage.id] ? '重新确认本阶段' : '标记本阶段已准备'}</button></div><div className="border border-[#e0e3e7] bg-[#fafbfc] p-5"><h3 className="text-base font-semibold text-[#303741]">阶段状态</h3><div className="mt-4 flex items-center gap-3"><span className={`h-3 w-3 rounded-full ${stageState[activeStage.id].status || completed[activeStage.id] ? 'bg-[#2f8f61]' : 'bg-[#c58b2b]'}`} /><span className="text-sm font-medium text-[#303741]">{stageState[activeStage.id].status || completed[activeStage.id] ? '已具备基础条件' : '待补充'}</span></div><p className="mt-3 text-sm leading-6 text-[#717985]">{stageState[activeStage.id].detail}</p>{activeStage.id === 'terminology' && <button type="button" onClick={() => goToModelingStage('')} className="mt-5 text-sm font-medium text-[#d94338]">进入对象定义 →</button>}{activeStage.id === 'audit' && <button type="button" onClick={() => navigate('/datasets')} className="mt-5 text-sm font-medium text-[#d94338]">管理数据集 →</button>}</div></div><div className="mt-6 flex flex-wrap gap-3 border-t border-[#eceef1] pt-5"><button type="button" onClick={() => navigate(`/ontology-modeling/projects/${project.id}`)} className="h-9 rounded-md border border-[#cfd5dc] px-4 text-sm font-medium text-[#4c5561]">对象定义</button><button type="button" onClick={() => goToModelingStage('properties')} className="h-9 rounded-md border border-[#cfd5dc] px-4 text-sm font-medium text-[#4c5561]">属性字典</button><button type="button" onClick={() => goToModelingStage('relations')} className="h-9 rounded-md border border-[#cfd5dc] px-4 text-sm font-medium text-[#4c5561]">对象关系</button><button type="button" onClick={() => goToModelingStage('mapping')} className="h-9 rounded-md border border-[#cfd5dc] px-4 text-sm font-medium text-[#4c5561]">数据映射</button><button type="button" onClick={() => navigate(`/ontology-modeling/projects/${project.id}/validation`)} className="h-9 rounded-md bg-[#303741] px-4 text-sm font-medium text-white">校验与发布</button></div></div></section></div></div></main></div>
}

export default OntologyModelingGovernance
