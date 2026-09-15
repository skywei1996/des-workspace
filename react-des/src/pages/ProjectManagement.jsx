import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Sidebar from '../components/Sidebar'

// Simple Icons
const Icon = ({ name, className = "w-4 h-4" }) => {
  const icons = {
    plus: <path d="M12 5v14M5 12h14"></path>,
    search: <circle cx="11" cy="11" r="8"></circle>,
    more: <circle cx="12" cy="12" r="1"></circle>,
    settings: <path d="M12.22 2h-.44a2 2 0 0 1-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.1a2 2 0 0 1-1-1.72v-.51a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path>,
    users: <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>,
    archive: <polyline points="21 8 21 21 3 21 3 8"></polyline>,
    activity: <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>,
    shield: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>,
    filter: <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>,
    bot: <g><rect x="3" y="11" width="18" height="10" rx="2"></rect><circle cx="12" cy="5" r="2"></circle><path d="M12 7v4"></path><line x1="8" y1="16" x2="8" y2="16"></line><line x1="16" y1="16" x2="16" y2="16"></line></g>,
    edit: <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>,
    edit2: <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>,
    trash: <polyline points="3 6 5 6 21 6"></polyline>,
    trash2: <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>,
    x: <g><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></g>
  }
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width="24" height="24" viewBox="0 0 24 24" 
      fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" 
      className={className}
    >
      {icons[name] || icons.more}
      {name === 'search' && <line x1="21" y1="21" x2="16.65" y2="16.65"></line>}
      {name === 'archive' && <rect x="1" y="3" width="22" height="5"></rect>}
      {name === 'archive' && <line x1="10" y1="12" x2="14" y2="12"></line>}
      {name === 'edit' && icons.edit2}
      {name === 'trash' && icons.trash2}
    </svg>
  )
}

const ProjectManagement = () => {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedOrg, setSelectedOrg] = useState('all')
  
  // Modal States
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [selectedProject, setSelectedProject] = useState(null)
  const [editFormData, setEditFormData] = useState(null)

  // Mock Data
  const [projects, setProjects] = useState([
    { 
      id: 1, 
      name: 'Marketing Campaign Q1', 
      description: 'Q1 Marketing activities and agents coordination', 
      organization: 'Marketing',
      tags: ['Marketing', 'Internal'],
      admin: 'Alice', 
      adminEmail: 'alice@company.com',
      status: 'Active', 
      members: 12, 
      agents: 5, 
      createdAt: '2025-01-10',
      usage: 'High'
    },
    { 
      id: 2, 
      name: 'Product Launch - Alpha', 
      description: 'Alpha product launch coordination and tracking', 
      organization: 'Product',
      tags: ['Product', 'Engineering'],
      admin: 'Bob', 
      adminEmail: 'bob@company.com',
      status: 'Active', 
      members: 8, 
      agents: 3, 
      createdAt: '2025-02-15',
      usage: 'Medium'
    },
    { 
      id: 3, 
      name: 'Legacy System Migration', 
      description: 'Migration tasks and planning for legacy DB', 
      organization: 'Engineering',
      tags: ['Engineering', 'Operations'],
      admin: 'Charlie', 
      adminEmail: 'charlie@company.com',
      status: 'Inactive', 
      members: 5, 
      agents: 2, 
      createdAt: '2024-11-20',
      usage: 'Low'
    },
    { 
      id: 4, 
      name: 'Customer Support Bot', 
      description: 'Automated customer support agent development', 
      organization: 'Operations',
      tags: ['Operations', 'HR'],
      admin: 'David', 
      adminEmail: 'david@company.com',
      status: 'Active', 
      members: 15, 
      agents: 8, 
      createdAt: '2025-03-01',
      usage: 'High'
    },
  ])

  // Constants for Edit Modal
  const availableTags = [
    'HR', 'Finance', 'Legal', 'Marketing', 'Engineering', 
    'Design', 'Operations', 'Sales', 'Internal', 'External'
  ]

  const availableUsers = [
    { id: 'u1', name: 'Alice', role: 'Product Manager', email: 'alice@company.com' },
    { id: 'u2', name: 'Bob', role: 'Developer', email: 'bob@company.com' },
    { id: 'u3', name: 'Charlie', role: 'Designer', email: 'charlie@company.com' },
    { id: 'u4', name: 'David', role: 'QA', email: 'david@company.com' },
    { id: 'u5', name: 'Eve', role: 'Marketing', email: 'eve@company.com' },
  ]

  // Get unique organizations for filter
  const organizations = ['all', ...new Set(projects.map(p => p.organization).filter(Boolean))]

  const handleEditClick = (project) => {
    setSelectedProject(project)
    setEditFormData({ 
      ...project,
      tags: project.tags || [], // Ensure tags is an array
      adminEmail: project.adminEmail || '' // Ensure email exists
    })
    setIsEditModalOpen(true)
  }

  const handleDeleteClick = (project) => {
    setSelectedProject(project)
    setIsDeleteModalOpen(true)
  }

  const handleEditTagToggle = (tag) => {
    setEditFormData(prev => {
      const newTags = prev.tags.includes(tag)
        ? prev.tags.filter(t => t !== tag)
        : [...prev.tags, tag]
      return { ...prev, tags: newTags }
    })
  }

  const handleEditAdminChange = (e) => {
    const selectedAdminName = e.target.value
    const selectedUser = availableUsers.find(u => u.name === selectedAdminName)
    setEditFormData(prev => ({
      ...prev,
      admin: selectedAdminName,
      adminEmail: selectedUser ? selectedUser.email : ''
    }))
  }

  const handleSaveEdit = (e) => {
    e.preventDefault()
    setProjects(prev => prev.map(p => p.id === selectedProject.id ? editFormData : p))
    setIsEditModalOpen(false)
    setSelectedProject(null)
    setEditFormData(null)
  }

  const handleConfirmDelete = () => {
    setProjects(prev => prev.filter(p => p.id !== selectedProject.id))
    setIsDeleteModalOpen(false)
    setSelectedProject(null)
  }

  const filteredProjects = projects.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.description.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesOrg = selectedOrg === 'all' || p.organization === selectedOrg

    if (activeTab === 'all') return matchesSearch && matchesOrg
    if (activeTab === 'active') return matchesSearch && p.status === 'Active' && matchesOrg
    if (activeTab === 'inactive') return matchesSearch && p.status === 'Inactive' && matchesOrg
    return matchesSearch && matchesOrg
  })

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-8 py-5 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Teams Management</h1>
            <p className="text-sm text-gray-500 mt-1">Manage your teams, members, and resource allocations</p>
          </div>
          <button 
            onClick={() => navigate('/create-project')}
            className="bg-[#6266EA] hover:bg-[#5256d0] text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors"
          >
            <Icon name="plus" className="w-4 h-4" />
            Create Team
          </button>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-8">
          
          {/* Filters & Search */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg">
              {['all', 'active', 'inactive'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-1.5 rounded-md text-sm font-medium capitalize transition-all ${
                    activeTab === tab 
                      ? 'bg-white text-gray-900 shadow-sm' 
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3">
              <select
                value={selectedOrg}
                onChange={(e) => setSelectedOrg(e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6266EA]/20 focus:border-[#6266EA] bg-white"
              >
                <option value="all">All Parent Teams</option>
                {organizations.filter(o => o !== 'all').map(org => (
                  <option key={org} value={org}>{org}</option>
                ))}
              </select>

              <div className="relative">
                <Icon name="search" className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input 
                  type="text" 
                  placeholder="Search teams..." 
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

          {/* Projects Table */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Team Name</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Tags</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Belong to</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Admin</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Carbon Workers</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Silicon Workers</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Created At</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredProjects.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="px-6 py-8 text-center text-gray-500">
                      No teams found
                    </td>
                  </tr>
                ) : (
                  filteredProjects.map((project) => (
                    <tr key={project.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{project.name}</div>
                          <div className="text-xs text-gray-500 mt-0.5 line-clamp-1">{project.description}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1">
                          {project.tags && project.tags.map((tag, index) => (
                            <span key={index} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                              {tag}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
                          {project.organization}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-[#6266EA]/10 text-[#6266EA] flex items-center justify-center text-xs font-medium">
                            {project.admin.charAt(0)}
                          </div>
                          <span className="text-sm text-gray-700">{project.admin}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          project.status === 'Active' 
                            ? 'bg-green-50 text-green-700 border border-green-100' 
                            : 'bg-gray-100 text-gray-600 border border-gray-200'
                        }`}>
                          {project.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1 text-sm text-gray-600">
                          <Icon name="users" className="w-4 h-4 text-gray-400" />
                          {project.members}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1 text-sm text-gray-600">
                          <Icon name="bot" className="w-4 h-4 text-gray-400" />
                          {project.agents}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-500">{project.createdAt}</span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button 
                            onClick={() => handleEditClick(project)}
                            className="p-1.5 hover:bg-gray-100 rounded text-gray-400 hover:text-[#6266EA] transition-colors" 
                            title="Edit Team"
                          >
                            <Icon name="edit" className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleDeleteClick(project)}
                            className="p-1.5 hover:bg-red-50 rounded text-gray-400 hover:text-red-600 transition-colors" 
                            title="Delete Team"
                          >
                            <Icon name="trash" className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </main>

        {/* Edit Modal */}
        {isEditModalOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
                <h3 className="text-lg font-semibold text-gray-900">Edit Team</h3>
                <button onClick={() => setIsEditModalOpen(false)} className="text-gray-400 hover:text-gray-500">
                  <Icon name="x" className="w-5 h-5" />
                </button>
              </div>
              
              <form onSubmit={handleSaveEdit} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Team Name</label>
                  <input 
                    type="text" 
                    value={editFormData.name}
                    onChange={(e) => setEditFormData({...editFormData, name: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6266EA]/20 focus:border-[#6266EA]"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea 
                    value={editFormData.description}
                    onChange={(e) => setEditFormData({...editFormData, description: e.target.value})}
                    rows="3"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6266EA]/20 focus:border-[#6266EA]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Tags</label>
                  <div className="flex flex-wrap gap-2">
                    {availableTags.map(tag => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => handleEditTagToggle(tag)}
                        className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                          editFormData.tags.includes(tag)
                            ? 'bg-[#6266EA] text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Belong to</label>
                    <select 
                      value={editFormData.organization}
                      onChange={(e) => setEditFormData({...editFormData, organization: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6266EA]/20 focus:border-[#6266EA]"
                    >
                      <option value="">Select Parent Team...</option>
                      {['Engineering', 'Product', 'Design', 'Marketing', 'Sales', 'Operations', 'HR', 'Finance'].map(org => (
                        <option key={org} value={org}>{org}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                    <select 
                      value={editFormData.status}
                      onChange={(e) => setEditFormData({...editFormData, status: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6266EA]/20 focus:border-[#6266EA]"
                    >
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Team Admin</label>
                    <select 
                      value={editFormData.admin}
                      onChange={handleEditAdminChange}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6266EA]/20 focus:border-[#6266EA]"
                      required
                    >
                      <option value="">Select an admin...</option>
                      {availableUsers.map(user => (
                        <option key={user.id} value={user.name}>{user.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Admin Email</label>
                    <input 
                      type="email" 
                      value={editFormData.adminEmail}
                      readOnly
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6266EA]/20 focus:border-[#6266EA] bg-gray-50"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4">
                  <button 
                    type="button"
                    onClick={() => setIsEditModalOpen(false)}
                    className="px-4 py-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 font-medium transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="px-4 py-2 bg-[#6266EA] hover:bg-[#5256d0] text-white rounded-lg font-medium shadow-sm transition-colors"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Delete Modal */}
        {isDeleteModalOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
              <div className="p-6 text-center">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 text-red-600">
                  <Icon name="trash" className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Team</h3>
                <p className="text-gray-500 mb-6">
                  Are you sure you want to delete <span className="font-medium text-gray-900">{selectedProject?.name}</span>? This action cannot be undone.
                </p>
                <div className="flex items-center justify-center gap-3">
                  <button 
                    onClick={() => setIsDeleteModalOpen(false)}
                    className="px-4 py-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 font-medium transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleConfirmDelete}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium shadow-sm transition-colors"
                  >
                    Delete Team
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default ProjectManagement
