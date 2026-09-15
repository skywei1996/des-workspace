import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import Sidebar from '../components/Sidebar'
import { loadCarbonWorkers } from '../utils/carbonWorkerStorage'
import { deleteCarbonWorker, fetchCarbonWorkers } from '../utils/carbonWorkerApi'

const API_BASE = (typeof process !== 'undefined' && process.env && process.env.REACT_APP_API_BASE) || 'http://localhost:8000'

// Simple Icons
const Icon = ({ name, className = "w-4 h-4" }) => {
  const icons = {
    plus: <path d="M12 5v14M5 12h14"></path>,
    search: <circle cx="11" cy="11" r="8"></circle>,
    more: <circle cx="12" cy="12" r="1"></circle>,
    settings: <path d="M12.22 2h-.44a2 2 0 0 1-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path>,
    users: <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>,
    archive: <polyline points="21 8 21 21 3 21 3 8"></polyline>,
    activity: <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>,
    shield: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>,
    filter: <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>,
    bot: <g><rect x="3" y="11" width="18" height="10" rx="2"></rect><circle cx="12" cy="5" r="2"></circle><path d="M12 7v4"></path><line x1="8" y1="16" x2="8" y2="16"></line><line x1="16" y1="16" x2="16" y2="16"></line></g>,
    mail: <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>,
    cpu: <rect x="4" y="4" width="16" height="16" rx="2" ry="2"></rect>,
    edit: <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>,
    trash: <polyline points="3 6 5 6 21 6"></polyline>,
    power: <path d="M18.36 6.64a9 9 0 1 1-12.73 0"></path>,
    check: <polyline points="20 6 9 17 4 12"></polyline>,
    chevronDown: <path d="M6 9l6 6 6-6"></path>,
    x: <line x1="18" y1="6" x2="6" y2="18"></line>,
    structure: <path d="M2 20h20M12 4v16M6 12h12"></path> // Simplified structure icon
  }
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width="24" height="24" viewBox="0 0 24 24" 
      fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" 
      className={className}
    >
      {icons[name] || icons.more}
      {name === 'x' && <line x1="6" y1="6" x2="18" y2="18"></line>}
      {name === 'mail' && <polyline points="22,6 12,13 2,6"></polyline>}
      {name === 'cpu' && <rect x="9" y="9" width="6" height="6"></rect>}
      {name === 'cpu' && <line x1="9" y1="1" x2="9" y2="4"></line>}
      {name === 'cpu' && <line x1="15" y1="1" x2="15" y2="4"></line>}
      {name === 'cpu' && <line x1="9" y1="20" x2="9" y2="23"></line>}
      {name === 'cpu' && <line x1="15" y1="20" x2="15" y2="23"></line>}
      {name === 'cpu' && <line x1="20" y1="9" x2="23" y2="9"></line>}
      {name === 'cpu' && <line x1="20" y1="14" x2="23" y2="14"></line>}
      {name === 'cpu' && <line x1="1" y1="9" x2="4" y2="9"></line>}
      {name === 'cpu' && <line x1="1" y1="14" x2="4" y2="14"></line>}
      {name === 'edit' && <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>}
      {name === 'trash' && <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>}
      {name === 'power' && <line x1="12" y1="2" x2="12" y2="12"></line>}
      {name === 'structure' && <rect x="9" y="3" width="6" height="6"></rect>}
      {name === 'structure' && <rect x="2" y="15" width="6" height="6"></rect>}
      {name === 'structure' && <rect x="16" y="15" width="6" height="6"></rect>}
      {name === 'structure' && <line x1="12" y1="9" x2="12" y2="12"></line>}
      {name === 'structure' && <path d="M5 15v-3h14v3"></path>}
    </svg>
  )
}

const OrgChart = ({ teams, carbonWorkers, siliconWorkers }) => {
  const containerRef = useRef(null)
  const [isDragging, setIsDragging] = useState(false)
  const [coords, setCoords] = useState({ startX: 0, startY: 0, scrollLeft: 0, scrollTop: 0 })

  const handleMouseDown = (e) => {
    setIsDragging(true)
    setCoords({
      startX: e.pageX - containerRef.current.offsetLeft,
      startY: e.pageY - containerRef.current.offsetTop,
      scrollLeft: containerRef.current.scrollLeft,
      scrollTop: containerRef.current.scrollTop
    })
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  const handleMouseMove = (e) => {
    if (!isDragging) return
    e.preventDefault()
    const x = e.pageX - containerRef.current.offsetLeft
    const y = e.pageY - containerRef.current.offsetTop
    const walkX = (x - coords.startX) * 1.5
    const walkY = (y - coords.startY) * 1.5
    containerRef.current.scrollLeft = coords.scrollLeft - walkX
    containerRef.current.scrollTop = coords.scrollTop - walkY
  }

  // Build tree data
  const treeData = {
    name: 'Organization',
    type: 'root',
    children: teams.map(team => ({
      name: team,
      type: 'team',
      children: [
        ...carbonWorkers
          .filter(w => Array.isArray(w.teams) && w.teams.includes(team))
          .map(w => ({ ...w, type: 'carbon' })),
        ...siliconWorkers
          .filter(w => Array.isArray(w.teams) && w.teams.includes(team))
          .map(w => ({ ...w, type: 'silicon' }))
      ]
    }))
  }

  const renderNode = (node) => (
    <li key={node.name + Math.random()}>
      <div className={`
        inline-flex flex-col items-center p-3 rounded-xl border bg-white shadow-sm min-w-[120px] relative z-10 select-none
        ${node.type === 'team' ? 'border-blue-200 bg-blue-50/30' : ''}
        ${node.type === 'silicon' ? 'border-purple-200 bg-purple-50/30' : ''}
        ${node.type === 'carbon' ? 'border-green-200 bg-green-50/30' : ''}
        ${node.type === 'root' ? 'border-gray-200 bg-gray-50' : ''}
      `}>
        <div className={`
          w-10 h-10 rounded-full flex items-center justify-center mb-2 shadow-sm
          ${node.type === 'team' ? 'bg-blue-100 text-blue-600' : ''}
          ${node.type === 'silicon' ? 'bg-purple-100 text-purple-600' : ''}
          ${node.type === 'carbon' ? 'bg-green-100 text-green-600' : ''}
          ${node.type === 'root' ? 'bg-gray-800 text-white' : ''}
        `}>
          <Icon 
            name={
              node.type === 'team' ? 'clipboard' : 
              node.type === 'silicon' ? 'bot' : 
              node.type === 'carbon' ? 'users' : 'shield'
            } 
            className="w-5 h-5" 
          />
        </div>
        <span className="text-sm font-semibold text-gray-900">{node.name}</span>
        {node.role && <span className="text-xs text-gray-500 mt-0.5">{node.role}</span>}
        {node.type === 'silicon' && (
          <span className="absolute -top-2 -right-2 bg-purple-600 text-white text-[10px] px-1.5 py-0.5 rounded-full">AI</span>
        )}
      </div>
      {node.children && node.children.length > 0 && (
        <ul>
          {node.children.map(child => renderNode(child))}
        </ul>
      )}
    </li>
  )

  return (
    <div 
      ref={containerRef}
      className="overflow-auto p-8 h-full cursor-grab active:cursor-grabbing select-none relative bg-gray-50/50"
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onMouseMove={handleMouseMove}
    >
      <style>{`
        .tree ul {
          padding-top: 20px; position: relative;
          transition: all 0.5s;
          display: flex;
          justify-content: center;
        }
        .tree li {
          float: left; text-align: center;
          list-style-type: none;
          position: relative;
          padding: 20px 10px 0 10px;
          transition: all 0.5s;
        }
        .tree li::before, .tree li::after {
          content: '';
          position: absolute; top: 0; right: 50%;
          border-top: 1px solid #ccc;
          width: 50%; height: 20px;
        }
        .tree li::after {
          right: auto; left: 50%;
          border-left: 1px solid #ccc;
        }
        .tree li:only-child::after, .tree li:only-child::before {
          display: none;
        }
        .tree li:only-child { padding-top: 0; }
        .tree li:first-child::before, .tree li:last-child::after {
          border: 0 none;
        }
        .tree li:last-child::before{
          border-right: 1px solid #ccc;
          border-radius: 0 5px 0 0;
        }
        .tree li:first-child::after{
          border-radius: 5px 0 0 0;
        }
        .tree ul ul::before{
          content: '';
          position: absolute; top: 0; left: 50%;
          border-left: 1px solid #ccc;
          width: 0; height: 20px;
        }
      `}</style>
      <div className="tree min-w-max mx-auto">
        <ul>
          {renderNode(treeData)}
        </ul>
      </div>
    </div>
  )
}

const WorkforceManagement = () => {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('carbon') // 'carbon', 'silicon', 'structure'
  const [searchQuery, setSearchQuery] = useState('')
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editingWorker, setEditingWorker] = useState(null)
  const [isTeamDropdownOpen, setIsTeamDropdownOpen] = useState(false)

  const siliconRoles = [
    'Code Assistant',
    'Data Analyst',
    'Customer Support',
    'System Architect'
  ]
  
  // Mock Data - Carbon Workers (Humans)
  const [carbonWorkers, setCarbonWorkers] = useState(() => loadCarbonWorkers())

  // Real data for Silicon Workers, fetched from the digital-employee database (created + connected)
  const [siliconWorkers, setSiliconWorkers] = useState([])
  const [siliconWorkersLoading, setSiliconWorkersLoading] = useState(false)

  // Delete confirmation + toast for digital employees (and carbon workers)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [toast, setToast] = useState(null)
  const toastTimerRef = useRef(null)

  const handleEditClick = (worker) => {
    setEditingWorker({
      ...worker,
      teams: Array.isArray(worker.teams) ? worker.teams : []
    })
    setIsEditModalOpen(true)
  }

  const availableTeams = useMemo(() => {
    const teamSet = new Set()

    carbonWorkers.forEach((worker) => {
      ;(worker.teams || []).forEach((team) => teamSet.add(team))
    })

    siliconWorkers.forEach((worker) => {
      ;(worker.teams || []).forEach((team) => teamSet.add(team))
    })

    return Array.from(teamSet)
  }, [carbonWorkers, siliconWorkers])

  useEffect(() => {
    let isMounted = true

    const syncCarbonWorkers = async () => {
      const workers = await fetchCarbonWorkers()
      if (isMounted) {
        setCarbonWorkers(workers)
      }
    }

    setCarbonWorkers(loadCarbonWorkers())
    syncCarbonWorkers()

    window.addEventListener('storage', syncCarbonWorkers)
    window.addEventListener('des:carbon-workers-updated', syncCarbonWorkers)
    return () => {
      isMounted = false
      window.removeEventListener('storage', syncCarbonWorkers)
      window.removeEventListener('des:carbon-workers-updated', syncCarbonWorkers)
    }
  }, [])

  // Fetch real digital employees (created + connected) from the DB for the Silicon Workers / Structure views
  useEffect(() => {
    if (activeTab !== 'silicon' && activeTab !== 'structure') return
    let isMounted = true
    setSiliconWorkersLoading(true)
    axios.get(`${API_BASE}/ai-employees/`)
      .then((res) => {
        const list = (res.data || []).map((e) => {
          const isDify = e.source_type === 'dify'
          return {
            id: e.id,
            name: e.name,
            role: e.role_title || '',
            model: isDify ? (e.dify_app_type || 'dify') : (e.model || 'Native'),
            status: e.status,
            teams: e.access_teams || [],
            sourceType: e.source_type,
          }
        })
        if (isMounted) setSiliconWorkers(list)
      })
      .catch(() => { if (isMounted) setSiliconWorkers([]) })
      .finally(() => { if (isMounted) setSiliconWorkersLoading(false) })
    return () => { isMounted = false }
  }, [activeTab])

  const handleDeleteCarbon = async (workerId) => {
    const nextWorkers = await deleteCarbonWorker(workerId)
    setCarbonWorkers(nextWorkers)
  }

  const handleDeleteClick = (worker) => {
    setDeleteTarget({ ...worker, type: activeTab })
  }

  const showToast = (type, message) => {
    setToast({ type, message })
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    toastTimerRef.current = setTimeout(() => setToast(null), 3500)
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      if (deleteTarget.type === 'carbon') {
        const nextWorkers = await deleteCarbonWorker(deleteTarget.id)
        setCarbonWorkers(nextWorkers)
      } else {
        await axios.delete(`${API_BASE}/ai-employees/${deleteTarget.id}`)
        setSiliconWorkers((prev) => prev.filter((w) => w.id !== deleteTarget.id))
      }
      showToast('success', `「${deleteTarget.name}」已删除`)
    } catch (e) {
      showToast('error', `删除失败：${deleteTarget.name}`)
    } finally {
      setDeleting(false)
      setDeleteTarget(null)
    }
  }

  const handleSaveEdit = () => {
    setSiliconWorkers(prev => prev.map(w => w.id === editingWorker.id ? editingWorker : w))
    setIsEditModalOpen(false)
    setEditingWorker(null)
  }

  const toggleTeam = (team) => {
    setEditingWorker(prev => {
      const currentTeams = prev.teams || []
      if (currentTeams.includes(team)) {
        return { ...prev, teams: currentTeams.filter(t => t !== team) }
      } else {
        return { ...prev, teams: [...currentTeams, team] }
      }
    })
  }

  const filteredCarbon = carbonWorkers.filter(w => 
    w.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    w.role.toLowerCase().includes(searchQuery.toLowerCase()) ||
    w.email.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const filteredSilicon = siliconWorkers.filter(w => 
    w.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    w.role.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-8 py-5 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Workforce Management</h1>
            <p className="text-sm text-gray-500 mt-1">Manage your human and digital workforce resources</p>
          </div>
          <button 
            onClick={() => navigate(activeTab === 'carbon' ? '/add-carbon-worker' : '/add-silicon-worker')} 
            className="bg-[#6266EA] hover:bg-[#5256d0] text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors"
          >
            <Icon name="plus" className="w-4 h-4" />
            Add {activeTab === 'carbon' ? 'Carbon Worker' : 'Silicon Worker'}
          </button>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-8">
          
          {/* Tabs & Search */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg">
              <button
                onClick={() => setActiveTab('carbon')}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${
                  activeTab === 'carbon' 
                    ? 'bg-white text-gray-900 shadow-sm' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Icon name="users" className="w-4 h-4" />
                Carbon Workers
              </button>
              <button
                onClick={() => setActiveTab('silicon')}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${
                  activeTab === 'silicon' 
                    ? 'bg-white text-gray-900 shadow-sm' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Icon name="bot" className="w-4 h-4" />
                Silicon Workers
              </button>
              <button
                onClick={() => setActiveTab('structure')}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${
                  activeTab === 'structure' 
                    ? 'bg-white text-gray-900 shadow-sm' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Icon name="structure" className="w-4 h-4" />
                Structure
              </button>
            </div>

            <div className="flex items-center gap-3">
              <div className="relative">
                <Icon name="search" className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input 
                  type="text" 
                  placeholder={`Search ${activeTab === 'carbon' ? 'carbon workers' : activeTab === 'silicon' ? 'silicon workers' : 'structure'}...`}
                  className="pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6266EA]/20 focus:border-[#6266EA] w-64"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <button className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600">
                <Icon name="filter" className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Content */}
          {activeTab === 'structure' ? (
            <OrgChart 
              teams={availableTeams} 
              carbonWorkers={carbonWorkers} 
              siliconWorkers={siliconWorkers} 
            />
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Name</th>
                    <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Role</th>
                    {activeTab === 'carbon' && (
                      <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Email</th>
                    )}
                    {activeTab === 'carbon' && (
                      <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Phone</th>
                    )}
                    {activeTab === 'silicon' && (
                      <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Model</th>
                    )}
                    {activeTab === 'silicon' && (
                      <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Source</th>
                    )}
                    <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Active Teams</th>
                    <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {(activeTab === 'carbon' ? filteredCarbon : filteredSilicon).map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${activeTab === 'carbon' ? 'bg-blue-100 text-blue-600' : 'bg-purple-100 text-purple-600'}`}>
                            <Icon name={activeTab === 'carbon' ? 'users' : 'bot'} className="w-4 h-4" />
                          </div>
                          <span className="font-medium text-gray-900">{item.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{item.role}</td>
                      {activeTab === 'carbon' && (
                        <td className="px-6 py-4 text-sm text-gray-500">{item.email}</td>
                      )}
                      {activeTab === 'carbon' && (
                        <td className="px-6 py-4 text-sm text-gray-500">{item.phone}</td>
                      )}
                      {activeTab === 'silicon' && (
                        <td className="px-6 py-4 text-sm text-gray-500">
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-gray-100 text-xs font-medium text-gray-600">
                            <Icon name="cpu" className="w-3 h-3" />
                            {item.model}
                          </span>
                        </td>
                      )}
                      {activeTab === 'silicon' && (
                        <td className="px-6 py-4 text-sm">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            item.sourceType === 'dify'
                              ? 'bg-sky-100 text-sky-700'
                              : 'bg-violet-100 text-violet-700'
                          }`}>
                            {item.sourceType === 'dify' ? 'Connected' : 'Created'}
                          </span>
                        </td>
                      )}
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          item.status === 'active' || item.status === 'Active' ? 'bg-green-100 text-green-800' :
                          item.status === 'training' ? 'bg-amber-100 text-amber-800' :
                          item.status === 'archived' ? 'bg-rose-100 text-rose-800' :
                          item.status === 'On Leave' ? 'bg-amber-100 text-amber-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {item.status === 'active' ? 'Active' :
                           item.status === 'training' ? 'Training' :
                           item.status === 'archived' ? 'Archived' :
                           item.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {Array.isArray(item.teams) && item.teams.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {item.teams.map((team, idx) => (
                              <span key={idx} className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${
                                activeTab === 'carbon' 
                                  ? 'bg-blue-50 text-blue-700 border-blue-100' 
                                  : 'bg-purple-50 text-purple-700 border-purple-100'
                              }`}>
                                {team}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200">
                            Personal
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button 
                            onClick={() => activeTab === 'silicon' ? handleEditClick(item) : null}
                            className="p-1.5 hover:bg-gray-100 rounded text-gray-400 hover:text-[#6266EA] transition-colors"
                            title="Edit"
                          >
                            <Icon name="edit" className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleDeleteClick(item)}
                            className="p-1.5 hover:bg-red-50 rounded text-gray-400 hover:text-red-500 transition-colors"
                            title="Delete"
                          >
                            <Icon name="trash" className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
              {/* Loading State (silicon) */}
              {activeTab === 'silicon' && siliconWorkersLoading && (
                <div className="p-8 text-center text-gray-500 flex items-center justify-center gap-2">
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z"></path>
                  </svg>
                  Loading digital employees…
                </div>
              )}

              {/* Empty State */}
              {!siliconWorkersLoading && (activeTab === 'carbon' ? filteredCarbon : filteredSilicon).length === 0 && (
                <div className="p-8 text-center text-gray-500">
                  {activeTab === 'silicon' && !searchQuery
                    ? 'No digital employees yet. Create or connect one in "My Digital Employees".'
                    : `No ${activeTab === 'carbon' ? 'carbon workers' : 'silicon workers'} found${searchQuery ? ' matching your search' : ''}.`}
                </div>
              )}
            </div>
          )}
        </main>

        {/* Delete Confirmation Modal */}
        {deleteTarget && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-lg w-full max-w-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">确认删除</h3>
                <button
                  onClick={() => setDeleteTarget(null)}
                  disabled={deleting}
                  className="text-gray-400 hover:text-gray-500 disabled:opacity-50"
                >
                  <Icon name="x" className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6">
                <p className="text-sm text-gray-600">
                  确定要删除「{deleteTarget.name}」吗？此操作不可撤销，相关的对话与任务记录也会被一并清除。
                </p>
              </div>
              <div className="px-6 py-4 bg-gray-50 flex items-center justify-end gap-3">
                <button
                  onClick={() => setDeleteTarget(null)}
                  disabled={deleting}
                  className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
                >
                  取消
                </button>
                <button
                  onClick={confirmDelete}
                  disabled={deleting}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-70"
                >
                  {deleting && (
                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z"></path>
                    </svg>
                  )}
                  {deleting ? '删除中…' : '确认删除'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Modal */}
        {isEditModalOpen && editingWorker && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-lg w-full max-w-md overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Edit Silicon Worker</h3>
                <button 
                  onClick={() => setIsEditModalOpen(false)}
                  className="text-gray-400 hover:text-gray-500"
                >
                  <Icon name="x" className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                  <select 
                    value={editingWorker.role}
                    onChange={(e) => setEditingWorker({...editingWorker, role: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6266EA]/20 focus:border-[#6266EA]"
                  >
                    {siliconRoles.map(role => (
                      <option key={role} value={role}>{role}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Teams</label>
                  <div className="relative">
                    <div 
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus-within:ring-2 focus-within:ring-[#6266EA]/20 focus-within:border-[#6266EA] min-h-[42px] flex flex-wrap gap-2 cursor-pointer bg-white"
                      onClick={() => setIsTeamDropdownOpen(!isTeamDropdownOpen)}
                    >
                      {editingWorker.teams.length === 0 && (
                        <span className="text-gray-400 text-sm">Select teams...</span>
                      )}
                      {editingWorker.teams.map(team => (
                        <span key={team} className="bg-[#f0f2f5] text-gray-700 px-2 py-0.5 rounded text-xs flex items-center gap-1">
                          {team}
                          <button 
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              toggleTeam(team)
                            }}
                            className="hover:text-red-500"
                          >
                            <Icon name="x" className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                      <div className="ml-auto flex items-center text-gray-400">
                        <Icon name="chevronDown" className="w-4 h-4" />
                      </div>
                    </div>

                    {isTeamDropdownOpen && (
                      <>
                        <div 
                          className="fixed inset-0 z-10" 
                          onClick={() => setIsTeamDropdownOpen(false)}
                        />
                        <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-auto">
                          {availableTeams.map(team => (
                            <div 
                              key={team}
                              className="px-4 py-2 hover:bg-gray-50 cursor-pointer flex items-center justify-between"
                              onClick={() => toggleTeam(team)}
                            >
                              <span className="text-sm text-gray-700">{team}</span>
                              {editingWorker.teams.includes(team) && (
                                <span className="text-[#6266EA]">
                                  <Icon name="check" className="w-4 h-4" />
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select 
                    value={editingWorker.status}
                    onChange={(e) => setEditingWorker({...editingWorker, status: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6266EA]/20 focus:border-[#6266EA]"
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div className="px-6 py-4 bg-gray-50 flex justify-end gap-3">
                <button 
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleSaveEdit}
                  className="px-4 py-2 text-sm font-medium text-white bg-[#6266EA] hover:bg-[#5256d0] rounded-lg transition-colors"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Toast */}
        {toast && (
          <div className={`fixed top-4 left-1/2 transform -translate-x-1/2 ${toast.type === 'error' ? 'bg-rose-600' : 'bg-emerald-600'} text-white px-6 py-3 rounded-lg shadow-lg z-[60] flex items-center gap-2 animate-fadeIn`}>
            <Icon name={toast.type === 'error' ? 'x' : 'check'} className="w-5 h-5 flex-shrink-0" />
            <span>{toast.message}</span>
          </div>
        )}
      </div>
    </div>
  )
}

export default WorkforceManagement
