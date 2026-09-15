import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Sidebar from '../components/Sidebar'

// Simple Icons
const Icon = ({ name, className = "w-4 h-4" }) => {
  const icons = {
    arrowLeft: <path d="M19 12H5M12 19l-7-7 7-7"></path>,
    check: <polyline points="20 6 9 17 4 12"></polyline>,
    plus: <path d="M12 5v14M5 12h14"></path>,
    x: <g><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></g>,
    user: <g><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></g>,
    bot: <g><rect x="3" y="11" width="18" height="10" rx="2"></rect><circle cx="12" cy="5" r="2"></circle><path d="M12 7v4"></path><line x1="8" y1="16" x2="8" y2="16"></line><line x1="16" y1="16" x2="16" y2="16"></line></g>
  }
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width="24" height="24" viewBox="0 0 24 24" 
      fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" 
      className={className}
    >
      {icons[name]}
    </svg>
  )
}

const CreateProject = () => {
  const navigate = useNavigate()
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    organization: '',
    tags: [],
    admin: '',
    adminEmail: '',
    status: 'Active'
  })

  // Mock Data for Selection
  const availableOrganizations = [
    'Engineering',
    'Product',
    'Design',
    'Marketing',
    'Sales',
    'Operations',
    'HR',
    'Finance'
  ]

  const availableTags = [
    'HR',
    'Finance',
    'Legal',
    'Marketing',
    'Engineering',
    'Design',
    'Operations',
    'Sales',
    'Internal',
    'External'
  ]

  const availableUsers = [
    { id: 'u1', name: 'Alice', role: 'Product Manager', email: 'alice@company.com' },
    { id: 'u2', name: 'Bob', role: 'Developer', email: 'bob@company.com' },
    { id: 'u3', name: 'Charlie', role: 'Designer', email: 'charlie@company.com' },
    { id: 'u4', name: 'David', role: 'QA', email: 'david@company.com' },
    { id: 'u5', name: 'Eve', role: 'Marketing', email: 'eve@company.com' },
  ]

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleAdminChange = (e) => {
    const selectedAdminName = e.target.value
    const selectedUser = availableUsers.find(u => u.name === selectedAdminName)
    setFormData(prev => ({
      ...prev,
      admin: selectedAdminName,
      adminEmail: selectedUser ? selectedUser.email : ''
    }))
  }

  const handleTagToggle = (tag) => {
    setFormData(prev => {
      const newTags = prev.tags.includes(tag)
        ? prev.tags.filter(t => t !== tag)
        : [...prev.tags, tag]
      return { ...prev, tags: newTags }
    })
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    // Here you would typically call an API to create the project
    console.log('Creating project:', formData)
    navigate('/project-management')
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-8 py-5 flex items-center gap-4">
          <button 
            onClick={() => navigate('/project-management')}
            className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors"
          >
            <Icon name="arrowLeft" className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Create New Team</h1>
            <p className="text-sm text-gray-500 mt-1">Set up a new workspace for your team and agents</p>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-8">
          <div className="max-w-3xl mx-auto">
            <form onSubmit={handleSubmit} className="space-y-8">
              
              {/* Basic Info */}
              <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                <h2 className="text-lg font-medium text-gray-900 mb-4">Team Details</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Team Name</label>
                    <input 
                      type="text" 
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6266EA]/20 focus:border-[#6266EA]"
                      placeholder="e.g. Marketing Team"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                    <textarea 
                      name="description"
                      value={formData.description}
                      onChange={handleInputChange}
                      rows="3"
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6266EA]/20 focus:border-[#6266EA]"
                      placeholder="Describe the team goals and scope..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Tags</label>
                    <div className="flex flex-wrap gap-2">
                      {availableTags.map(tag => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => handleTagToggle(tag)}
                          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                            formData.tags.includes(tag)
                              ? 'bg-[#6266EA] text-white'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Belong to</label>
                    <select 
                      name="organization"
                      value={formData.organization}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6266EA]/20 focus:border-[#6266EA]"
                      required
                    >
                      <option value="">Select a parent team...</option>
                      {availableOrganizations.map(org => (
                        <option key={org} value={org}>{org}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Team Admin</label>
                      <select 
                        name="admin"
                        value={formData.admin}
                        onChange={handleAdminChange}
                        className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6266EA]/20 focus:border-[#6266EA]"
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
                        name="adminEmail"
                        value={formData.adminEmail}
                        onChange={handleInputChange}
                        className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6266EA]/20 focus:border-[#6266EA] bg-gray-50"
                        placeholder="admin@company.com"
                        readOnly
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                    <select 
                      name="status"
                      value={formData.status}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6266EA]/20 focus:border-[#6266EA]"
                    >
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-4 pt-4">
                <button 
                  type="button"
                  onClick={() => navigate('/project-management')}
                  className="px-6 py-2.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 font-medium transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="px-6 py-2.5 bg-[#6266EA] hover:bg-[#5256d0] text-white rounded-lg font-medium shadow-sm transition-colors"
                >
                  Create Team
                </button>
              </div>

            </form>
          </div>
        </main>
      </div>
    </div>
  )
}

export default CreateProject
