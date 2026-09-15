import React from 'react'
import { useNavigate } from 'react-router-dom'
import Sidebar from '../components/Sidebar'

const AutomationTaskPlaceholderPage = ({ title, description }) => {
  const navigate = useNavigate()

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar
        onSelectMember={(id) => navigate('/chat-workspace', { state: { activeMember: id } })}
        onAddEmployee={() => navigate('/add-silicon-worker')}
      />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="border-b border-gray-200 bg-white px-8 py-5">
          <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
          <p className="mt-1 text-sm text-gray-500">{description}</p>
        </div>

        <div className="flex-1 overflow-auto p-8">
          <div className="flex h-full min-h-[320px] items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-white text-sm text-gray-400">
            页面待实现
          </div>
        </div>
      </div>
    </div>
  )
}

export default AutomationTaskPlaceholderPage