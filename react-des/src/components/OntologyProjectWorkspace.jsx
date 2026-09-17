import React from 'react'
import { useNavigate } from 'react-router-dom'
import Sidebar from './Sidebar'

const navigationGroups = [
  { title: '', items: [{ key: 'overview', label: '项目概览', path: '' }] },
  { title: '本体结构', items: [{ key: 'objects', label: '对象', path: '' }, { key: 'properties', label: '属性', path: '/properties' }] },
  { title: '业务逻辑', items: [{ key: 'actions', label: '动作', path: '/actions' }, { key: 'functions', label: '函数', path: '/functions' }] },
  { title: '数据管理', items: [{ key: 'mapping', label: '数据映射', path: '/mapping' }] },
  { title: '发布管理', items: [{ key: 'validation', label: '版本发布', path: '/validation' }] },
]

export function OntologyProjectHeader({ project, actions }) {
  const navigate = useNavigate()
  return (
      <header className="shrink-0 border-b border-[#e4e7eb] bg-white px-7 py-4">
        <div className="flex items-center justify-between gap-6">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm text-[#7b8490]">
              <button type="button" onClick={() => navigate('/ontology-modeling')} className="hover:text-[#d94338]">项目列表</button>
              <span>/</span>
              <span className="truncate font-medium text-[#303741]">{project.name}</span>
              <span className={`ml-1 rounded-full px-2.5 py-1 text-xs font-medium ${project.status === 'published' ? 'bg-[#eaf7ef] text-[#2f8f61]' : 'bg-[#fff0ed] text-[#d94338]'}`}>{project.status === 'published' ? '已发布' : '草稿 v0.1'}</span>
            </div>
            <p className="mt-2 truncate text-xs text-[#858d98]">{project.domain} · 负责人：{project.owner} · 业务口径：{project.terminologyOwner}</p>
          </div>
          <div className="flex shrink-0 items-center gap-3">{actions}</div>
        </div>
      </header>
  )
}

export function OntologyProjectNav({ projectId, project, activeItem }) {
  const navigate = useNavigate()
  const projectPath = `/ontology-modeling/projects/${projectId}`
  return (
    <aside className="w-[208px] shrink-0 overflow-y-auto border-r border-[#e0e3e7] bg-white px-3 py-4">
      <nav>
        {navigationGroups.map((group, groupIndex) => (
          <div key={group.title || 'overview'} className={groupIndex ? 'mt-4' : ''}>
            {group.title && <div className="px-3 pb-1.5 text-[11px] font-semibold text-[#9299a3]">{group.title}</div>}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const selected = item.key === activeItem
                const disabled = !item.path && item.key !== 'objects' && item.key !== 'overview'
                return <button key={item.key} type="button" disabled={disabled} title={disabled ? '功能建设中' : undefined} onClick={() => item.path !== undefined && navigate(`${projectPath}${item.path}`, { state: { project } })} className={`relative flex h-9 w-full items-center px-3 text-left text-sm transition ${selected ? 'bg-[#fff1ee] font-semibold text-[#d94338] before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:bg-[#e3473c]' : disabled ? 'cursor-default text-[#a5abb3]' : 'font-medium text-[#596270] hover:bg-[#f7f8fa] hover:text-[#20242b]'}`}>{item.label}</button>
              })}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  )
}

function OntologyProjectWorkspace({ project, activeItem, actions, children }) {
  return (
    <div className="flex h-screen overflow-hidden bg-[#f7f8fa]">
      <Sidebar compact collapseStateKey="ontology-project" />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <OntologyProjectHeader project={project} actions={actions} />

        <div className="flex min-h-0 flex-1">
          <OntologyProjectNav projectId={project.id} project={project} activeItem={activeItem} />
          <main className="min-w-0 flex-1 overflow-y-auto p-6">{children}</main>
        </div>
      </div>
    </div>
  )
}

export default OntologyProjectWorkspace