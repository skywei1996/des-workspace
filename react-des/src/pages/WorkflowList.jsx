import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Sidebar from '../components/Sidebar'

const STORAGE_KEY = 'des-workflows'
const initialWorkflows = [{ id: 'workflow-demo-1', name: '短视频分镜脚本生成', description: '根据主题生成短视频分镜、台词和拍摄建议。', status: 'published', updatedAt: '2026-09-09T10:00:00.000Z', createdAt: '2026-09-09T09:00:00.000Z' }]

const readWorkflows = () => {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    return stored ? JSON.parse(stored) : initialWorkflows
  } catch {
    return initialWorkflows
  }
}

const Icon = ({ name, className = 'h-5 w-5' }) => {
  const paths = {
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
    filter: <><path d="M4 5h16" /><path d="M7 12h10" /><path d="M10 19h4" /></>,
    chevronDown: <path d="m6 9 6 6 6-6" />, chevronLeft: <path d="m15 18-6-6 6-6" />, chevronRight: <path d="m9 18 6-6-6-6" />,
    plus: <><path d="M12 5v14" /><path d="M5 12h14" /></>,
    more: <><circle cx="12" cy="5" r="1" fill="currentColor" /><circle cx="12" cy="12" r="1" fill="currentColor" /><circle cx="12" cy="19" r="1" fill="currentColor" /></>,
    user: <><circle cx="12" cy="8" r="3" /><path d="M5 21a7 7 0 0 1 14 0" /></>,
    edit: <><path d="m4 16 10-10 4 4L8 20H4z" /><path d="m13 7 4 4" /></>,
    trash: <><path d="M4 7h16" /><path d="M10 11v6M14 11v6" /><path d="M6 7l1 14h10l1-14" /><path d="M9 7V4h6v3" /></>,
    close: <><path d="m6 6 12 12" /><path d="m18 6-12 12" /></>,
  }
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">{paths[name]}</svg>
}

const formatDate = (value) => new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric' }).format(new Date(value))
const formatUpdated = (value) => {
  const hours = Math.floor((Date.now() - new Date(value).getTime()) / 3600000)
  return hours < 1 ? '刚刚更新' : hours < 24 ? `${hours} 小时前更新` : `${Math.floor(hours / 24)} 天前更新`
}

const WorkflowList = () => {
  const navigate = useNavigate()
  const [workflows, setWorkflows] = useState(readWorkflows)
  const [activeFilter, setActiveFilter] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [sortBy, setSortBy] = useState('updated')
  const [isSortOpen, setIsSortOpen] = useState(false)
  const [openMenuId, setOpenMenuId] = useState(null)
  const [editingWorkflow, setEditingWorkflow] = useState(null)
  const [form, setForm] = useState({ name: '', description: '' })
  const [deleteTarget, setDeleteTarget] = useState(null)

  useEffect(() => window.localStorage.setItem(STORAGE_KEY, JSON.stringify(workflows)), [workflows])

  const visibleWorkflows = useMemo(() => workflows
    .filter((workflow) => activeFilter === 'all' || workflow.status === activeFilter)
    .filter((workflow) => !searchTerm.trim() || `${workflow.name} ${workflow.description}`.toLowerCase().includes(searchTerm.trim().toLowerCase()))
    .sort((left, right) => sortBy === 'name' ? left.name.localeCompare(right.name, 'zh-CN') : new Date(right.updatedAt) - new Date(left.updatedAt)), [activeFilter, searchTerm, sortBy, workflows])

  useEffect(() => {
    const handleWorkflowCardClick = (event) => {
      if (event.target.closest('button')) return
      const card = event.target.closest('article')
      if (!card) return
      const workflowIndex = Array.from(card.parentElement.children).indexOf(card)
      const selectedWorkflow = visibleWorkflows[workflowIndex]
      if (selectedWorkflow) openEdit(selectedWorkflow)
    }
    const cards = document.querySelectorAll('article')
    cards.forEach((card) => card.addEventListener('click', handleWorkflowCardClick))
    return () => cards.forEach((card) => card.removeEventListener('click', handleWorkflowCardClick))
  }, [visibleWorkflows])

  const openCreate = () => { setEditingWorkflow({ mode: 'create' }); setForm({ name: '', description: '' }); setOpenMenuId(null) }
  const openEdit = (workflow) => { navigate(`/workflows/${workflow.id}`); setOpenMenuId(null) }
  const saveWorkflow = (event) => {
    event.preventDefault()
    if (!form.name.trim()) return
    const now = new Date().toISOString()
    if (editingWorkflow.mode === 'create') setWorkflows((current) => [{ id: `workflow-${Date.now()}`, name: form.name.trim(), description: form.description.trim(), status: 'unpublished', updatedAt: now, createdAt: now }, ...current])
    else setWorkflows((current) => current.map((workflow) => workflow.id === editingWorkflow.id ? { ...workflow, name: form.name.trim(), description: form.description.trim(), updatedAt: now } : workflow))
    setEditingWorkflow(null)
  }
  const togglePublished = (workflow) => { setWorkflows((current) => current.map((item) => item.id === workflow.id ? { ...item, status: item.status === 'published' ? 'unpublished' : 'published', updatedAt: new Date().toISOString() } : item)); setOpenMenuId(null) }

  return (
    <div className="flex h-screen overflow-hidden bg-[#f8f9fb] text-[#20242b]">
      <Sidebar />
      <main className="min-w-0 flex-1 overflow-y-auto"><div className="mx-auto min-h-full max-w-[1500px] px-8 py-8 lg:px-12">
        <header className="flex flex-wrap items-start justify-between gap-5"><div><h1 className="text-2xl font-semibold text-gray-900">工作流列表</h1><p className="mt-1 text-sm text-gray-500">创建、编辑和管理工作流</p></div><button type="button" onClick={openCreate} className="inline-flex items-center gap-2 rounded-full bg-[#f40b0b] px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-[#de1010]"><Icon name="plus" className="h-4 w-4" />新增工作流</button></header>
        <div className="mt-6 border-b border-gray-200"><button type="button" onClick={() => setActiveFilter('all')} className="border-b-2 border-[#f40b0b] px-1 pb-3 text-sm font-semibold text-[#f40b0b]">工作流</button></div>
        <section className="mt-5"><div className="mb-4 flex flex-wrap items-center justify-between gap-4"><div className="text-sm font-semibold text-gray-800">全部工作流 <span className="ml-1 font-normal text-gray-400">{workflows.length}</span></div><div className="flex flex-wrap items-center gap-2"><label className="flex h-10 w-[240px] items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 text-gray-400 shadow-sm focus-within:border-[#f0bbb6]"><Icon name="search" className="h-4 w-4" /><input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="搜索工作流" className="min-w-0 flex-1 bg-transparent text-sm text-gray-800 outline-none placeholder:text-gray-400" /></label><div className="relative"><button type="button" onClick={() => setIsSortOpen((current) => !current)} className="flex h-10 min-w-[170px] items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-700 shadow-sm">{sortBy === 'updated' ? '按最近更新排序' : '按名称排序'}<Icon name="chevronDown" className="h-4 w-4 text-gray-400" /></button>{isSortOpen && <div className="absolute right-0 top-12 z-20 w-full rounded-xl border border-gray-200 bg-white py-1 shadow-lg"><button type="button" onClick={() => { setSortBy('updated'); setIsSortOpen(false) }} className="block w-full px-3 py-2 text-left text-sm hover:bg-[#fff6f4]">按最近更新排序</button><button type="button" onClick={() => { setSortBy('name'); setIsSortOpen(false) }} className="block w-full px-3 py-2 text-left text-sm hover:bg-[#fff6f4]">按名称排序</button></div>}</div><button type="button" onClick={() => setActiveFilter(activeFilter === 'all' ? 'published' : activeFilter === 'published' ? 'unpublished' : 'all')} title="筛选状态" className={`flex h-10 w-10 items-center justify-center rounded-xl border bg-white shadow-sm ${activeFilter === 'all' ? 'border-gray-200 text-gray-500' : 'border-[#f3b4ac] text-[#d94841]'}`}><Icon name="filter" className="h-4 w-4" /></button></div></div>
        <div className="mb-4 flex items-center gap-3 text-xs text-gray-500"><button type="button" onClick={() => setActiveFilter('all')} className={activeFilter === 'all' ? 'font-semibold text-[#d94841]' : ''}>全部</button><span>/</span><button type="button" onClick={() => setActiveFilter('published')} className={activeFilter === 'published' ? 'font-semibold text-[#d94841]' : ''}>已发布</button><span>/</span><button type="button" onClick={() => setActiveFilter('unpublished')} className={activeFilter === 'unpublished' ? 'font-semibold text-[#d94841]' : ''}>未发布</button></div>
        <div className="space-y-3">{visibleWorkflows.map((workflow) => <article key={workflow.id} className="relative flex min-h-[138px] items-center justify-between gap-6 rounded-xl border border-gray-200 bg-white px-6 py-5 shadow-sm hover:border-[#f3b4ac]"><div className="min-w-0"><h2 className="truncate text-base font-semibold text-gray-900">{workflow.name}</h2><p className="mt-2 max-w-3xl truncate text-sm text-gray-500">{workflow.description || '暂无描述'}</p><div className="mt-3 flex items-center gap-3 text-xs text-gray-400"><span>{formatUpdated(workflow.updatedAt)}</span><span className="h-3 w-px bg-gray-300" /><span>创建于 {formatDate(workflow.createdAt)}</span></div></div><div className="flex shrink-0 items-center gap-3"><button type="button" onClick={() => togglePublished(workflow)} className={`inline-flex h-9 items-center gap-2 rounded-full border px-3 text-xs ${workflow.status === 'published' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-gray-200 bg-gray-50 text-gray-500'}`}><span className={`h-2 w-2 rounded-full ${workflow.status === 'published' ? 'bg-emerald-500' : 'bg-gray-400'}`} />{workflow.status === 'published' ? '已发布' : '未发布'}</button><div className="relative"><button type="button" onClick={() => setOpenMenuId(openMenuId === workflow.id ? null : workflow.id)} title="更多操作" className="flex h-9 w-8 items-center justify-center rounded-xl text-gray-500 hover:bg-[#fff6f4] hover:text-[#d94841]"><Icon name="more" className="h-5 w-5" /></button>{openMenuId === workflow.id && <div className="absolute right-0 top-11 z-30 w-36 overflow-hidden rounded-xl border border-gray-200 bg-white py-1 shadow-lg"><button type="button" onClick={() => openEdit(workflow)} className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-[#fff6f4]"><Icon name="edit" className="h-4 w-4" />编辑</button><button type="button" onClick={() => togglePublished(workflow)} className="w-full px-4 py-2 text-left text-sm hover:bg-[#fff6f4]">{workflow.status === 'published' ? '取消发布' : '发布'}</button><button type="button" onClick={() => { setDeleteTarget(workflow); setOpenMenuId(null) }} className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-[#d94841] hover:bg-[#fff1ef]"><Icon name="trash" className="h-4 w-4" />删除</button></div>}</div></div></article>)}</div>
        {visibleWorkflows.length === 0 && <div className="rounded-xl border border-dashed border-[#d9dcdf] bg-white py-20 text-center text-[#8c949d]">暂无符合条件的工作流</div>}<footer className="mt-8 flex items-center justify-end gap-6 text-[16px] text-[#858c95]"><span>共 {visibleWorkflows.length} 条</span><button type="button" disabled className="text-[#b5bbc0]"><Icon name="chevronLeft" className="h-5 w-5" /></button><span className="flex h-10 w-10 items-center justify-center rounded-md bg-[#e5e6e8] text-[#20242b]">1</span><button type="button" disabled className="text-[#b5bbc0]"><Icon name="chevronRight" className="h-5 w-5" /></button><span className="rounded-md border border-[#dfe1e4] bg-white px-4 py-2">50 / 页</span></footer></section>
      </div></main>
      {editingWorkflow && <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#18212b]/30 px-4" onMouseDown={(event) => event.target === event.currentTarget && setEditingWorkflow(null)}><form onSubmit={saveWorkflow} className="w-full max-w-[520px] rounded-xl bg-white p-7 shadow-2xl"><div className="flex items-center justify-between"><h2 className="text-xl font-semibold">{editingWorkflow.mode === 'create' ? '新增工作流' : '编辑工作流'}</h2><button type="button" onClick={() => setEditingWorkflow(null)} className="rounded-md p-1 text-gray-500 hover:bg-[#fff6f4] hover:text-[#d94841]"><Icon name="close" className="h-5 w-5" /></button></div><label className="mt-7 block text-sm font-medium">工作流名称 <span className="text-[#d94841]">*</span><input autoFocus value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="请输入工作流名称" className="mt-2 h-10 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-[#f0bbb6] focus:ring-4 focus:ring-[#fff1ef]" /></label><label className="mt-5 block text-sm font-medium">描述<textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="请输入工作流描述" rows={4} className="mt-2 w-full resize-none rounded-xl border border-gray-200 p-3 text-sm outline-none focus:border-[#f0bbb6] focus:ring-4 focus:ring-[#fff1ef]" /></label><div className="mt-7 flex justify-end gap-3"><button type="button" onClick={() => setEditingWorkflow(null)} className="h-10 rounded-full border border-gray-200 px-5 text-sm text-gray-600">取消</button><button type="submit" className="h-10 rounded-full bg-[#f40b0b] px-5 text-sm font-medium text-white hover:bg-[#de1010]">保存</button></div></form></div>}
      {deleteTarget && <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#18212b]/30 px-4"><div className="w-full max-w-[420px] rounded-xl bg-white p-7 shadow-2xl"><h2 className="text-xl font-semibold">删除工作流？</h2><p className="mt-3 text-sm leading-6 text-[#707983]">确定要删除“{deleteTarget.name}”吗？删除后将无法恢复。</p><div className="mt-7 flex justify-end gap-3"><button type="button" onClick={() => setDeleteTarget(null)} className="h-10 rounded-md border border-[#dfe1e4] px-5 text-sm">取消</button><button type="button" onClick={() => { setWorkflows((current) => current.filter((workflow) => workflow.id !== deleteTarget.id)); setDeleteTarget(null) }} className="h-10 rounded-md bg-[#d94235] px-5 text-sm font-semibold text-white">删除</button></div></div></div>}
    </div>
  )
}

export default WorkflowList
