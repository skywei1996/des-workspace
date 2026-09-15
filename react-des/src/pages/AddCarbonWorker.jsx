import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import { createCarbonWorker } from '../utils/carbonWorkerApi'

// Simple Icons
const Icon = ({ name, className = "w-4 h-4" }) => {
  const icons = {
    arrowLeft: <path d="M19 12H5M12 19l-7-7 7-7"></path>,
    check: <polyline points="20 6 9 17 4 12"></polyline>,
    chevronDown: <path d="M6 9l6 6 6-6"></path>,
    chevronRight: <polyline points="9 18 15 12 9 6"></polyline>
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

// Tree Node Component
const TeamTreeNode = ({ node, selectedIds, onToggle }) => {
  const [isExpanded, setIsExpanded] = useState(true)
  const isSelected = selectedIds.includes(node.id)
  
  const handleCheck = (e) => {
    onToggle(node.id, e.target.checked)
  }

  return (
    <div className="select-none">
       <div className="flex items-center gap-1 py-1 hover:bg-gray-50 rounded px-1">
          <div 
            className="w-5 h-5 flex items-center justify-center cursor-pointer text-gray-400 hover:text-gray-600"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {node.children && node.children.length > 0 && (
               <Icon name={isExpanded ? 'chevronDown' : 'chevronRight'} className="w-3.5 h-3.5" />
            )}
          </div>
          <label className="flex items-center gap-2 cursor-pointer flex-1">
            <input 
              type="checkbox" 
              checked={isSelected} 
              onChange={handleCheck}
              className="rounded border-gray-300 text-[#6266EA] focus:ring-[#6266EA] w-4 h-4"
            />
            <span className="text-sm text-gray-700">{node.name}</span>
          </label>
       </div>
       {isExpanded && node.children && node.children.length > 0 && (
          <div className="ml-5 border-l border-gray-100 pl-1">
            {node.children.map(child => (
                <TeamTreeNode key={child.id} node={child} selectedIds={selectedIds} onToggle={onToggle} />
            ))}
          </div>
       )}
    </div>
  )
}

const AddCarbonWorker = () => {
  const navigate = useNavigate()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [formData, setFormData] = useState({
    name: '',
    role: '',
    teams: [],
    email: '',
    phone: '',
    status: 'Active'
  })
  
  // Mock Teams (Hierarchical)
  const teams = [
    { id: 't1', name: 'Engineering', level: 0 },
    { id: 't1-1', name: 'Frontend', level: 1, parentId: 't1' },
    { id: 't1-2', name: 'Backend', level: 1, parentId: 't1' },
    { id: 't2', name: 'Product', level: 0 },
    { id: 't2-1', name: 'Design', level: 1, parentId: 't2' },
    { id: 't3', name: 'Marketing', level: 0 },
  ]

  const buildTeamTree = (items) => {
    const itemMap = {};
    const tree = [];
    
    items.forEach(item => {
      itemMap[item.id] = { ...item, children: [] };
    });
    
    items.forEach(item => {
      if (item.parentId) {
        if (itemMap[item.parentId]) {
          itemMap[item.parentId].children.push(itemMap[item.id]);
        }
      } else {
        tree.push(itemMap[item.id]);
      }
    });
    
    return tree;
  };

  const teamTree = buildTeamTree(teams);

  const handleTeamToggle = (teamId, isChecked) => {
    // Helper to get all descendant IDs
    const getDescendantIds = (id) => {
      const children = teams.filter(t => t.parentId === id)
      let ids = children.map(c => c.id)
      children.forEach(c => {
        ids = [...ids, ...getDescendantIds(c.id)]
      })
      return ids
    }

    const descendants = getDescendantIds(teamId)
    const allIdsToToggle = [teamId, ...descendants]

    setFormData(prev => {
      const currentTeams = prev.teams || []
      let newTeams
      
      if (isChecked) {
        // Add all if not present
        newTeams = [...currentTeams]
        allIdsToToggle.forEach(id => {
          if (!newTeams.includes(id)) newTeams.push(id)
        })
      } else {
        // Remove all
        newTeams = currentTeams.filter(id => !allIdsToToggle.includes(id))
      }
      
      return { ...prev, teams: newTeams }
    })
  }

  const roles = [
    'Tenant Admin',
    'Project Admin',
    'Agent Manager',
    'Agent User'
  ]

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsSubmitting(true)
    setSubmitError('')

    const selectedTeams = teams
      .filter((team) => formData.teams.includes(team.id))
      .map((team) => team.name)

    try {
      await createCarbonWorker({
        ...formData,
        teams: selectedTeams,
      })
      navigate('/workforce-management')
    } catch (error) {
      console.error('Failed to create carbon worker:', error)
      setSubmitError('Failed to create carbon worker. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-8 py-5 flex items-center gap-4">
          <button 
            onClick={() => navigate('/workforce-management')}
            className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors"
          >
            <Icon name="arrowLeft" className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">New Carbon Worker</h1>
            <p className="text-sm text-gray-500 mt-1">Create a new carbon worker account</p>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-8">
          <div className="max-w-2xl mx-auto">
            <form onSubmit={handleSubmit} className="space-y-8">
              
              <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                <h2 className="text-lg font-medium text-gray-900 mb-4">Carbon Worker Information</h2>
                {submitError && (
                  <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                    {submitError}
                  </div>
                )}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                    <input 
                      type="text" 
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6266EA]/20 focus:border-[#6266EA]"
                      placeholder="e.g. Alice Chen"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                    <select 
                      name="role"
                      value={formData.role}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6266EA]/20 focus:border-[#6266EA]"
                      required
                    >
                      <option value="">Select a role...</option>
                      {roles.map(role => (
                        <option key={role} value={role}>{role}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Teams</label>
                    <div className="border border-gray-200 rounded-lg p-2 max-h-60 overflow-y-auto bg-white">
                      {teamTree.map(node => (
                        <TeamTreeNode 
                          key={node.id} 
                          node={node} 
                          selectedIds={formData.teams} 
                          onToggle={handleTeamToggle} 
                        />
                      ))}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {formData.teams.map(teamId => {
                        const team = teams.find(t => t.id === teamId)
                        return team ? (
                          <span key={teamId} className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded border border-blue-100">{team.name}</span>
                        ) : null
                      })}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                      <input 
                        type="email" 
                        name="email"
                        value={formData.email}
                        onChange={handleInputChange}
                        className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6266EA]/20 focus:border-[#6266EA]"
                        placeholder="alice@company.com"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                      <input 
                        type="tel" 
                        name="phone"
                        value={formData.phone}
                        onChange={handleInputChange}
                        className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6266EA]/20 focus:border-[#6266EA]"
                        placeholder="e.g. 13800138000"
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
                      <option value="On Leave">On Leave</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-4 pt-4">
                <button 
                  type="button"
                  onClick={() => navigate('/workforce-management')}
                  className="px-6 py-2.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 font-medium transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 bg-[#6266EA] hover:bg-[#5256d0] text-white rounded-lg font-medium shadow-sm transition-colors"
                >
                  {isSubmitting ? 'Creating...' : 'Create Carbon Worker'}
                </button>
              </div>

            </form>
          </div>
        </main>
      </div>
    </div>
  )
}

export default AddCarbonWorker
