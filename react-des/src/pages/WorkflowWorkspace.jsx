import React, { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import { API_BASE } from '../config/api'
import { availableSkills as mockAvailableSkills } from '../data/mockSkills'
import { loadKnowledgeBases } from '../utils/knowledgeBaseStorage'

const STORAGE_KEY = 'des-workflows'

const Icon = ({ name, className = 'h-5 w-5' }) => {
  const paths = {
    arrowLeft: <><path d="m15 18-6-6 6-6" /><path d="M9 12h11" /></>,
    send: <><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></>,
    plus: <><path d="M12 5v14" /><path d="M5 12h14" /></>,
    more: <><circle cx="12" cy="5" r="1" fill="currentColor" /><circle cx="12" cy="12" r="1" fill="currentColor" /><circle cx="12" cy="19" r="1" fill="currentColor" /></>,
    paperclip: <><path d="m21.4 11.6-8.9 8.9a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.7 5.7l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.5-8.5" /></>,
    close: <><path d="m6 6 12 12" /><path d="m18 6-12 12" /></>,
  }
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">{paths[name]}</svg>
}

const getWorkflow = (workflowId) => {
  try {
    const workflows = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]')
    return workflows.find((workflow) => workflow.id === workflowId) || workflows[0]
  } catch {
    return null
  }
}

const resourceTypes = [
  { id: 'mcp', label: 'MCP', description: '添加外部工具和服务' },
  { id: 'skill', label: 'Skill', description: '添加可复用的工作能力' },
  { id: 'knowledge', label: 'Knowledge', description: '添加知识库和参考资料' },
]

const ResourcePicker = ({ type, items, selectedIds, onToggle, onClose, onConfirm }) => {
  if (!type) return null
  const config = resourceTypes.find((item) => item.id === type)
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[#17202b]/30 px-4" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="flex max-h-[620px] w-full max-w-[560px] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-5"><div><h2 className="text-base font-semibold">添加 {config.label}</h2><p className="mt-1 text-xs text-gray-500">{config.description}</p></div><button type="button" onClick={onClose} className="rounded-xl p-2 text-gray-400 hover:bg-[#fff1ef] hover:text-[#d94841]"><Icon name="close" /></button></div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">{items.length === 0 ? <div className="py-14 text-center text-sm text-gray-400">暂无可添加的{config.label}</div> : items.map((item) => { const id = String(item.id || item.skill_key); const checked = selectedIds.includes(id); return <button type="button" key={id} onClick={() => onToggle(id)} className={`mb-2 flex w-full items-center gap-3 rounded-xl border p-4 text-left transition ${checked ? 'border-[#f3b4ac] bg-[#fff6f4]' : 'border-gray-200 hover:border-[#f3b4ac]'}`}><span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${checked ? 'border-[#d94841] bg-[#d94841] text-white' : 'border-gray-300'}`}>{checked ? '✓' : ''}</span><span className="min-w-0"><span className="block truncate text-sm font-medium text-gray-800">{item.name || item.title || item.skill_key}</span><span className="mt-1 block truncate text-xs text-gray-400">{item.description || item.url || '已配置资源'}</span></span></button> })}</div>
        <div className="flex justify-end gap-3 border-t border-gray-100 px-6 py-4"><button type="button" onClick={onClose} className="rounded-full border border-gray-200 px-5 py-2 text-sm text-gray-600">取消</button><button type="button" onClick={onConfirm} className="rounded-full bg-[#f40b0b] px-5 py-2 text-sm font-medium text-white hover:bg-[#de1010]">确认添加</button></div>
      </div>
    </div>
  )
}

const WorkflowWorkspace = () => {
  const { workflowId } = useParams()
  const navigate = useNavigate()
  const workflow = getWorkflow(workflowId) || { name: '未命名工作流', description: '暂无工作流描述', status: 'unpublished' }
  const [workflowStatus, setWorkflowStatus] = useState(workflow.status || 'unpublished')
  const [message, setMessage] = useState('')
  const [messages, setMessages] = useState([])
  const [publishAction, setPublishAction] = useState(null)
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false)
  const [pickerType, setPickerType] = useState(null)
  const [pickerSelectedIds, setPickerSelectedIds] = useState([])
  const [attachedResources, setAttachedResources] = useState([])
  const [resourceCatalog, setResourceCatalog] = useState({ mcp: [], skill: [], knowledge: loadKnowledgeBases() })
  const nodes = [
    { type: 'trigger', title: '开始工作流', subtitle: '接收输入' },
    { type: 'ai', title: '理解用户需求', subtitle: 'AI 分析' },
    { type: 'tool', title: '执行工作流步骤', subtitle: '智能体处理' },
    { type: 'result', title: '输出结果', subtitle: '返回消息' },
  ]

  const sendMessage = (event) => {
    event.preventDefault()
    const content = message.trim()
    if (!content) return
    setMessages((current) => [...current, content])
    setMessage('')
  }

  const confirmPublishAction = () => {
    const nextStatus = publishAction === 'publish' ? 'published' : 'unpublished'
    const workflows = (() => {
      try {
        return JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]')
      } catch {
        return []
      }
    })()
    const updatedWorkflows = workflows.map((item) => item.id === workflowId ? { ...item, status: nextStatus, updatedAt: new Date().toISOString() } : item)
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedWorkflows))
    setWorkflowStatus(nextStatus)
    setPublishAction(null)
  }

  const openResourcePicker = async (type) => {
    setIsAddMenuOpen(false)
    setPickerType(type)
    const selected = attachedResources.filter((resource) => resource.type === type).map((resource) => resource.id)
    setPickerSelectedIds(selected)
    if (type === 'knowledge') return
    try {
      const endpoint = type === 'mcp' ? `${API_BASE}/mcp-servers/` : `${API_BASE}/skills/`
      const response = await fetch(endpoint)
      const payload = await response.json()
      const items = type === 'skill' ? (payload?.data?.skills || mockAvailableSkills) : (Array.isArray(payload) ? payload : [])
      setResourceCatalog((current) => ({ ...current, [type]: items }))
    } catch {
      if (type === 'skill') setResourceCatalog((current) => ({ ...current, skill: mockAvailableSkills }))
    }
  }

  const confirmResources = () => {
    const resources = resourceCatalog[pickerType]
      .filter((item) => pickerSelectedIds.includes(String(item.id || item.skill_key)))
      .map((item) => ({ type: pickerType, id: String(item.id || item.skill_key), name: item.name || item.title || item.skill_key }))
    setAttachedResources((current) => [...current.filter((resource) => resource.type !== pickerType), ...resources])
    setPickerType(null)
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#f8f9fb] text-gray-900">
      <Sidebar />
      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-[72px] shrink-0 items-center justify-between border-b border-gray-200 bg-white px-7">
          <div className="flex min-w-0 items-center gap-4">
            <button type="button" onClick={() => navigate('/workflows')} title="返回工作流列表" className="flex h-9 w-9 items-center justify-center rounded-xl text-gray-500 hover:bg-[#fff1ef] hover:text-[#d94841]"><Icon name="arrowLeft" /></button>
            <div className="min-w-0"><h1 className="truncate text-lg font-semibold">{workflow.name}</h1><p className="truncate text-xs text-gray-500">工作流编辑与预览</p></div>
          </div>
          <div className="flex items-center gap-3"><span className={`rounded-full border px-3 py-1 text-xs ${workflowStatus === 'published' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-gray-200 bg-gray-50 text-gray-500'}`}>{workflowStatus === 'published' ? '已发布' : '未发布'}</span><button type="button" title="更多操作" className="flex h-9 w-8 items-center justify-center rounded-xl text-gray-500 hover:bg-gray-100"><Icon name="more" /></button></div>
        </header>
        <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(360px,0.9fr)_minmax(520px,1.1fr)]">
          <section className="flex min-h-0 flex-col border-r border-gray-200 bg-white">
            <div className="border-b border-gray-100 px-6 py-5"><h2 className="text-base font-semibold">对话区</h2><p className="mt-1 text-xs text-gray-500">通过对话调整工作流内容和执行逻辑</p></div>
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">{messages.length === 0 && <div className="mt-12 rounded-2xl border border-dashed border-[#f0bbb6] bg-[#fffafa] p-6 text-center text-sm text-gray-500">你好，我可以协助你完善这个工作流。<br />请描述你希望调整的内容。</div>}{messages.map((item, index) => <div key={`${item}-${index}`} className="ml-auto max-w-[86%] rounded-2xl rounded-br-md bg-[#fff1ef] px-4 py-3 text-sm leading-6">{item}</div>)}</div>
            <form onSubmit={sendMessage} className="border-t border-gray-100 p-5"><div className="relative rounded-2xl border border-gray-200 bg-[#fbfcfd] p-3 focus-within:border-[#f0bbb6] focus-within:ring-4 focus-within:ring-[#fff1ef]"><textarea value={message} onChange={(event) => setMessage(event.target.value)} rows={3} placeholder="输入你想调整的内容..." className="w-full resize-none border-0 bg-transparent text-sm outline-none placeholder:text-gray-400" />{attachedResources.length > 0 && <div className="mb-2 flex flex-wrap gap-2">{attachedResources.map((resource) => <span key={`${resource.type}-${resource.id}`} className="inline-flex items-center gap-1 rounded-full border border-[#f3b4ac] bg-[#fff6f4] px-2.5 py-1 text-xs text-[#d94841]">{resource.name}<button type="button" onClick={() => setAttachedResources((current) => current.filter((item) => item.id !== resource.id || item.type !== resource.type))} aria-label={`移除${resource.name}`}><Icon name="close" className="h-3 w-3" /></button></span>)}</div>}<div className="flex items-center justify-between"><div className="relative"><button type="button" onClick={() => setIsAddMenuOpen((current) => !current)} title="添加资源" className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 hover:border-[#f0bbb6] hover:text-[#d94841]"><Icon name="plus" className="h-5 w-5" /></button>{isAddMenuOpen && <div className="absolute bottom-12 left-0 z-30 w-56 overflow-hidden rounded-2xl border border-gray-200 bg-white py-2 shadow-xl"><button type="button" onClick={() => openResourcePicker('mcp')} className="flex w-full items-center justify-between px-4 py-3 text-left text-sm hover:bg-[#fff6f4]"><span><b className="block font-medium">MCP</b><span className="text-xs text-gray-400">添加外部工具和服务</span></span><span className="text-gray-400">›</span></button><button type="button" onClick={() => openResourcePicker('skill')} className="flex w-full items-center justify-between px-4 py-3 text-left text-sm hover:bg-[#fff6f4]"><span><b className="block font-medium">Skill</b><span className="text-xs text-gray-400">添加可复用技能</span></span><span className="text-gray-400">›</span></button><button type="button" onClick={() => openResourcePicker('knowledge')} className="flex w-full items-center justify-between px-4 py-3 text-left text-sm hover:bg-[#fff6f4]"><span><b className="block font-medium">Knowledge</b><span className="text-xs text-gray-400">添加知识库</span></span><span className="text-gray-400">›</span></button></div>}</div><button type="submit" title="发送" className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f40b0b] text-white hover:bg-[#de1010]"><Icon name="send" className="h-4 w-4" /></button></div></div></form>
          </section>
          <section className="relative min-h-0 overflow-hidden bg-[#fbfcfd]">
            <div className="absolute inset-0 opacity-60" style={{ backgroundImage: 'radial-gradient(#d5d9df 1px, transparent 1px)', backgroundSize: '16px 16px' }} />
            <div className="relative flex h-full min-w-0 flex-col">
              <div className="flex h-16 shrink-0 items-center justify-between border-b border-gray-200 bg-white/95 px-6">
                <div><h2 className="text-base font-semibold">工作流预览</h2><p className="mt-1 text-xs text-gray-500">节点通过左侧对话生成</p></div>
                <button type="button" title={workflowStatus === 'published' ? '取消发布工作流' : '发布工作流'} onClick={() => setPublishAction(workflowStatus === 'published' ? 'unpublish' : 'publish')} className={`rounded-full px-5 py-2 text-xs font-medium text-white ${workflowStatus === 'published' ? 'bg-gray-500 hover:bg-gray-600' : 'bg-[#f40b0b] hover:bg-[#de1010]'}`}>{workflowStatus === 'published' ? '取消发布' : '发布'}</button>
              </div>
              <div className="relative min-h-0 flex-1 overflow-x-auto overflow-y-hidden">
                <div className="flex h-full min-w-[980px] items-center px-10">
                  {nodes.map((node, index) => (
                    <React.Fragment key={node.title}>
                      <div className={`relative w-[180px] shrink-0 rounded-xl border-2 bg-white shadow-[0_5px_18px_rgba(40,48,60,0.08)] ${node.type === 'trigger' ? 'border-[#22b8bd]' : node.type === 'ai' ? 'border-[#7b42ff]' : node.type === 'tool' ? 'border-[#3fc17a]' : 'border-[#7b42ff]'}`}>
                        <div className="flex items-center gap-3 px-4 py-4"><div className={`flex h-9 w-9 items-center justify-center rounded-lg text-sm font-bold ${node.type === 'trigger' ? 'bg-[#e5fbfb] text-[#0b9ca2]' : node.type === 'ai' ? 'bg-[#f0e8ff] text-[#7134ed]' : node.type === 'tool' ? 'bg-[#e8fbf0] text-[#1ba45c]' : 'bg-[#f0e8ff] text-[#7134ed]'}`}>{index === 0 ? '▶' : index === nodes.length - 1 ? '✓' : index}</div><div className="min-w-0"><div className="truncate text-sm font-semibold text-gray-800">{index === 0 ? workflow.name : node.title}</div><div className="mt-1 text-[11px] text-gray-400">{node.subtitle}</div></div></div>
                        {index < nodes.length - 1 && <span className="absolute -right-[9px] top-1/2 z-10 h-4 w-4 -translate-y-1/2 rounded-full border border-gray-300 bg-white" />}
                      </div>
                      {index < nodes.length - 1 && <div className="relative h-0 w-16 shrink-0 border-t-2 border-[#9e78f5]"><span className="absolute -right-1.5 -top-[5px] border-y-[4px] border-l-[6px] border-y-transparent border-l-[#9e78f5]" /><span className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] text-gray-400">1 item</span></div>}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>
      <ResourcePicker type={pickerType} items={pickerType ? resourceCatalog[pickerType] : []} selectedIds={pickerSelectedIds} onToggle={(id) => setPickerSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])} onClose={() => setPickerType(null)} onConfirm={confirmResources} />
      {publishAction && <div className="fixed inset-0 z-[90] flex items-center justify-center bg-[#18212b]/30 px-4" onMouseDown={(event) => event.target === event.currentTarget && setPublishAction(null)}><div className="w-full max-w-[420px] rounded-xl bg-white p-7 shadow-2xl"><h2 className="text-xl font-semibold">{publishAction === 'publish' ? '发布工作流？' : '取消发布工作流？'}</h2><p className="mt-3 text-sm leading-6 text-[#707983]">{publishAction === 'publish' ? `确定要发布“${workflow.name}”吗？发布后该工作流将进入可用状态。` : `确定要取消发布“${workflow.name}”吗？取消后该工作流将暂时不可用。`}</p><div className="mt-7 flex justify-end gap-3"><button type="button" onClick={() => setPublishAction(null)} className="h-10 rounded-md border border-[#dfe1e4] px-5 text-sm">取消</button><button type="button" onClick={confirmPublishAction} className={`h-10 rounded-md px-5 text-sm font-semibold text-white ${publishAction === 'publish' ? 'bg-[#d94235] hover:bg-[#c53229]' : 'bg-gray-600 hover:bg-gray-700'}`}>{publishAction === 'publish' ? '确认发布' : '确认取消发布'}</button></div></div></div>}
    </div>
  )
}

export default WorkflowWorkspace