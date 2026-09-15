import React from 'react'
import { useNavigate } from 'react-router-dom'
import Sidebar from '../components/Sidebar'

const appProjects = [
  {
    key: 'hr',
    title: '人资招聘',
    description: '岗位、候选人与招聘流程',
    icon: 'HR',
    tone: 'bg-[#2f80ed]',
    route: '/candidate-list',
  },
  {
    key: 'legal',
    title: '法务审查',
    description: '合同与法律风险工作台',
    icon: '法',
    tone: 'bg-[#7c3aed]',
    route: '/contract-review-agent',
  },
  {
    key: 'content',
    title: '内容审核',
    description: '图片、素材与内容合规',
    icon: '审',
    tone: 'bg-[#f97316]',
    route: '/watermark-audit-agent',
  },
  {
    key: 'platform',
    title: '平台工具',
    description: '评测、质量与平台运营',
    icon: 'AI',
    tone: 'bg-[#10b981]',
    route: '/evaluation-agent',
  },
]

const AgentApps = () => {
  const navigate = useNavigate()

  return (
    <div className="flex h-screen bg-white">
      <Sidebar
        onSelectMember={(id) => navigate('/chat-workspace', { state: { activeMember: id } })}
        onAddEmployee={() => navigate('/add-silicon-worker')}
      />
      <main className="min-w-0 flex-1 overflow-auto">
        <div className="mx-auto max-w-7xl px-12 py-9">
          <div className="mb-10 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-[#111827]">智能体中心</h1>
              <p className="mt-2 text-sm text-[#64748b]">选择一个智能体入口，直接进入对应业务页面。</p>
            </div>
            <button type="button" className="text-sm font-semibold text-[#64748b]">Settings</button>
          </div>

          <section>
            <h2 className="mb-6 text-lg font-bold text-[#111827]">全部智能体</h2>
            <div className="grid grid-cols-4 gap-x-12 gap-y-10 lg:grid-cols-6 xl:grid-cols-8">
              {appProjects.map((project) => (
                <button
                  key={`all-${project.key}`}
                  type="button"
                  onClick={() => navigate(project.route)}
                  className="group flex flex-col items-center text-center"
                >
                  <div className={`flex h-16 w-16 items-center justify-center rounded-2xl text-lg font-bold text-white shadow-sm transition group-hover:-translate-y-0.5 group-hover:shadow-md ${project.tone}`}>
                    {project.icon}
                  </div>
                  <div className="mt-3 text-sm font-semibold text-[#111827]">{project.title}</div>
                  <div className="mt-1 max-w-[96px] text-xs leading-4 text-[#64748b]">{project.description}</div>
                </button>
              ))}
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}

export default AgentApps
