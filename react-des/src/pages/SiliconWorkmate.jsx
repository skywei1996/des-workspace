import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import WorkerMarketContent from '../components/WorkerMarketContent'
import { useLanguage } from '../i18n'

const PlusIcon = ({ className = 'w-4 h-4' }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
  </svg>
)

const ChevronDownIcon = ({ className = 'w-4 h-4' }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
)

const LinkIcon = ({ className = 'w-4 h-4' }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
    />
  </svg>
)

const SiliconWorkmate = () => {
  const navigate = useNavigate()
  const { isZh, t } = useLanguage()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleCreate = () => {
    setMenuOpen(false)
    navigate('/add-silicon-worker')
  }

  const handleConnect = () => {
    setMenuOpen(false)
    navigate('/connect-silicon-worker')
  }

  return (
    <div className="flex h-screen bg-[#f7f8fc]">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Main Header */}
        <header className="bg-white border-b border-gray-200 flex-none z-10">
          <div className="px-8 pt-6 pb-4">
            <div className="flex items-center justify-between mb-2">
              <h1 className="text-2xl font-bold text-gray-900">{t('workmate.title')}</h1>
              <div className="relative" ref={menuRef}>
                <div className="flex rounded-lg shadow-sm overflow-hidden bg-black hover:bg-gray-800 transition-colors">
                  <button
                    onClick={handleCreate}
                    className="px-4 py-2 text-white text-sm font-medium flex items-center gap-2"
                  >
                    <PlusIcon className="w-4 h-4" />
                    <span>{isZh ? '新增数字员工' : 'New Worker'}</span>
                  </button>
                  <div className="w-px bg-white/10" />
                  <button
                    onClick={() => setMenuOpen((v) => !v)}
                    className="px-2 py-2 text-white hover:bg-white/5 transition-colors"
                    aria-label="More options"
                  >
                    <ChevronDownIcon className={`w-4 h-4 transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
                  </button>
                </div>
                {menuOpen && (
                  <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-lg border border-gray-100 py-2 z-50 overflow-hidden">
                    <button
                      onClick={handleCreate}
                      className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center gap-3 transition-colors"
                    >
                      <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                        <PlusIcon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-gray-900">
                          {isZh ? '新增数字员工' : 'New Worker'}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {isZh ? '自定义创建一个全新的数字员工' : 'Create a brand-new digital worker'}
                        </div>
                      </div>
                    </button>
                    <div className="h-px bg-gray-100 my-1" />
                    <button
                      onClick={handleConnect}
                      className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center gap-3 transition-colors"
                    >
                      <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                        <LinkIcon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-gray-900">
                          {isZh ? '连接数字员工' : 'Connect Worker'}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {isZh ? '接入已有的外部数字员工或模型服务' : 'Connect existing external workers or services'}
                        </div>
                      </div>
                    </button>
                  </div>
                )}
              </div>
            </div>
            <div className="flex gap-8 border-b border-gray-200 -mx-8 px-8">
              <div className="pb-3 text-sm font-semibold text-blue-600 relative">
                {t('workmate.talents')}
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-t-full shadow-[0_-1px_4px_rgba(37,99,235,0.2)]" />
              </div>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 flex flex-col overflow-hidden bg-[#f7f8fc]">
          <WorkerMarketContent />
        </main>
      </div>
    </div>
  )
}

export default SiliconWorkmate
