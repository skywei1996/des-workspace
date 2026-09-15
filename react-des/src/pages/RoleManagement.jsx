import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Sidebar from '../components/Sidebar'

// Simple Icons
const Icon = ({ name, className = "w-4 h-4" }) => {
  const icons = {
    plus: <path d="M12 5v14M5 12h14"></path>,
    search: <circle cx="11" cy="11" r="8"></circle>,
    shield: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>,
    users: <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>,
    bot: <g><rect x="3" y="11" width="18" height="10" rx="2"></rect><circle cx="12" cy="5" r="2"></circle><path d="M12 7v4"></path><line x1="8" y1="16" x2="8" y2="16"></line><line x1="16" y1="16" x2="16" y2="16"></line></g>,
    edit: <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>,
    trash: <polyline points="3 6 5 6 21 6"></polyline>,
    check: <polyline points="20 6 9 17 4 12"></polyline>,
    x: <line x1="18" y1="6" x2="6" y2="18"></line>,
    chevronDown: <path d="M6 9l6 6 6-6"></path>,
    lock: <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
  }
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width="24" height="24" viewBox="0 0 24 24" 
      fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" 
      className={className}
    >
      {icons[name]}
      {name === 'lock' && <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>}
    </svg>
  )
}

const RoleManagement = () => {
  const navigate = useNavigate()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingRole, setEditingRole] = useState(null)

  // Mock Data - Permissions
  const carbonPermissionsList = [
    { id: 'view_digital_workforce', label: 'Digital Workforce', category: 'Digital Workforce' },
    { id: 'view_task_management', label: 'Task Progress', category: 'Task Management' },
    { id: 'view_resources_tools', label: 'Tools', category: 'Resources' },
    { id: 'view_resources_knowledge', label: 'Knowledge Base', category: 'Resources' },
    { id: 'view_resources_database', label: 'Database', category: 'Resources' },
    { id: 'view_settings_project', label: 'Project Management', category: 'Settings' },
    { id: 'view_settings_workforce', label: 'Workforce Management', category: 'Settings' },
    { id: 'view_settings_role', label: 'Role Management', category: 'Settings' },
  ]

  // Mock Data - Roles
  const [carbonRoles, setCarbonRoles] = useState([
    { id: 1, name: 'Tenant Admin', description: 'Full access to all system features', permissions: ['view_digital_workforce', 'view_task_management', 'view_resources_tools', 'view_resources_knowledge', 'view_resources_database', 'view_settings_project', 'view_settings_workforce', 'view_settings_role'] },
    { id: 2, name: 'Project Admin', description: 'Can manage projects and view reports', permissions: ['view_digital_workforce', 'view_task_management', 'view_settings_project'] },
    { id: 3, name: 'Agent Manager', description: 'Can manage agents and workforce', permissions: ['view_digital_workforce', 'view_settings_workforce'] },
    { id: 4, name: 'Agent User', description: 'Basic access to chat and tasks', permissions: ['view_digital_workforce', 'view_task_management'] },
  ])

  const handleAddRole = () => {
    setEditingRole({
      id: null,
      name: '',
      description: '',
      permissions: []
    })
    setIsModalOpen(true)
  }

  const handleEditRole = (role) => {
    setEditingRole({ ...role })
    setIsModalOpen(true)
  }

  const handleDeleteRole = (id) => {
    setCarbonRoles(prev => prev.filter(r => r.id !== id))
  }

  const handleSaveRole = () => {
    if (editingRole.id) {
      setCarbonRoles(prev => prev.map(r => r.id === editingRole.id ? editingRole : r))
    } else {
      setCarbonRoles(prev => [...prev, { ...editingRole, id: Date.now() }])
    }
    setIsModalOpen(false)
    setEditingRole(null)
  }

  const togglePermission = (permId) => {
    setEditingRole(prev => {
      const currentPerms = prev.permissions || []
      if (currentPerms.includes(permId)) {
        return { ...prev, permissions: currentPerms.filter(p => p !== permId) }
      } else {
        return { ...prev, permissions: [...currentPerms, permId] }
      }
    })
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-8 py-5 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Role Management</h1>
            <p className="text-sm text-gray-500 mt-1">Configure roles and permissions for your workforce</p>
          </div>
          <button 
            onClick={handleAddRole}
            className="bg-[#6266EA] hover:bg-[#5256d0] text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors shadow-sm"
          >
            <Icon name="plus" className="w-4 h-4" />
            Add Role
          </button>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-8">
          
          {/* Table Content */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider w-1/4">Role Name</th>
                  <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider w-1/3">Description</th>
                  <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Permissions</th>
                  <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right w-24">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {carbonRoles.map((role) => (
                  <tr key={role.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center bg-blue-100 text-blue-600">
                          <Icon name="users" className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="font-medium text-gray-900 block">{role.name}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {role.description}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-2">
                        {role.permissions.slice(0, 3).map(p => (
                            <span key={p} className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-md border border-gray-200">
                              {carbonPermissionsList.find(cp => cp.id === p)?.label || p}
                            </span>
                          ))
                        }
                        {role.permissions.length > 3 && (
                          <span className="px-2 py-1 bg-gray-50 text-gray-500 text-xs rounded-md border border-gray-200">
                            +{ role.permissions.length - 3 } more
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => handleEditRole(role)}
                          className="p-1.5 hover:bg-gray-100 rounded text-gray-400 hover:text-[#6266EA] transition-colors"
                          title="Edit"
                        >
                          <Icon name="edit" className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDeleteRole(role.id)}
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
            
            {/* Empty State */}
            {carbonRoles.length === 0 && (
              <div className="p-12 text-center text-gray-500">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Icon name="shield" className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-medium text-gray-900">No roles found</h3>
                <p className="text-gray-500 mt-1">Get started by creating a new role.</p>
              </div>
            )}
          </div>
        </main>

        {/* Edit/Add Modal */}
        {isModalOpen && editingRole && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-lg w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
              <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">
                  {editingRole.id ? 'Edit Role' : 'Create New Role'}
                </h3>
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="text-gray-400 hover:text-gray-500"
                >
                  <Icon name="x" className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-6 overflow-y-auto flex-1">
                <div className="space-y-4 mb-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Role Name</label>
                    <input 
                      type="text" 
                      value={editingRole.name}
                      onChange={(e) => setEditingRole({...editingRole, name: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6266EA]/20 focus:border-[#6266EA]"
                      placeholder="e.g. Senior Analyst"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                    <textarea 
                      value={editingRole.description}
                      onChange={(e) => setEditingRole({...editingRole, description: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6266EA]/20 focus:border-[#6266EA]"
                      rows="2"
                      placeholder="Describe the role's responsibilities..."
                    />
                  </div>
                </div>

                <div className="border-t border-gray-100 pt-6">
                  <h4 className="text-sm font-semibold text-gray-900 mb-4">Permissions Configuration</h4>
                  
                  <div className="space-y-6">
                    {Object.entries(
                      carbonPermissionsList.reduce((acc, perm) => {
                        if (!acc[perm.category]) acc[perm.category] = []
                        acc[perm.category].push(perm)
                        return acc
                      }, {})
                    ).map(([category, perms]) => (
                      <div key={category}>
                        <h5 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">{category}</h5>
                        <div className="grid grid-cols-2 gap-4">
                          {perms.map(perm => (
                            <label key={perm.id} className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                              <div className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 mt-0.5 ${
                                editingRole.permissions.includes(perm.id) 
                                  ? 'bg-[#6266EA] border-[#6266EA] text-white' 
                                  : 'border-gray-300 bg-white'
                              }`}>
                                {editingRole.permissions.includes(perm.id) && <Icon name="check" className="w-3 h-3" />}
                              </div>
                              <input 
                                type="checkbox" 
                                className="hidden"
                                checked={editingRole.permissions.includes(perm.id)}
                                onChange={() => togglePermission(perm.id)}
                              />
                              <div>
                                <div className="text-sm font-medium text-gray-900">{perm.label}</div>
                              </div>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="px-6 py-4 bg-gray-50 flex justify-end gap-3 border-t border-gray-200">
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleSaveRole}
                  className="px-4 py-2 text-sm font-medium text-white bg-[#6266EA] hover:bg-[#5256d0] rounded-lg transition-colors"
                >
                  Save Role
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default RoleManagement
