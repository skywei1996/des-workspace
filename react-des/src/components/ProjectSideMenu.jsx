import React from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

const ProjectSideMenu = ({ title, subtitle, items }) => {
  const navigate = useNavigate()
  const location = useLocation()

  return (
    <aside className="flex h-screen w-[184px] flex-shrink-0 flex-col border-r border-[#e8eaee] bg-white">
      <div className="border-b border-[#f1f2f4] px-5 py-5">
        <div className="text-base font-bold text-[#111827]">{title}</div>
        {subtitle && <div className="mt-1 text-xs leading-5 text-[#94a3b8]">{subtitle}</div>}
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {items.map((item) => {
          const active = location.pathname === item.route
          return (
            <button
              key={item.route}
              type="button"
              onClick={() => navigate(item.route)}
              className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm transition ${
                active
                  ? 'bg-[#f7f7f8] font-semibold text-[#111827]'
                  : 'font-medium text-[#64748b] hover:bg-[#f7f7f8] hover:text-[#111827]'
              }`}
            >
              <span>{item.label}</span>
              {active && <span className="h-1.5 w-1.5 rounded-full bg-[#f40b0b]" />}
            </button>
          )
        })}
      </nav>
    </aside>
  )
}

export default ProjectSideMenu