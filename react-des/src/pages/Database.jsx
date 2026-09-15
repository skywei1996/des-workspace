import React, { useState } from 'react'
import Sidebar from '../components/Sidebar'

// Simple Icons
const Icon = ({ name, className = "w-4 h-4" }) => {
  const icons = {
    plus: <path d="M12 5v14M5 12h14"></path>,
    search: <circle cx="11" cy="11" r="8"></circle>,
    filter: <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>,
    file: <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>,
    folder: <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>,
    folderOpen: <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>, // Simplified
    database: <g><ellipse cx="12" cy="5" rx="9" ry="3"></ellipse><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path></g>,
    table: <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>,
    more: <circle cx="12" cy="12" r="1"></circle>,
    chevronRight: <polyline points="9 18 15 12 9 6"></polyline>,
    chevronDown: <polyline points="6 9 12 15 18 9"></polyline>,
    lock: <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>,
    unlock: <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>, // Simplified
    eye: <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>,
    edit: <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>,
    refresh: <polyline points="23 4 23 10 17 10"></polyline>,
    settings: <circle cx="12" cy="12" r="3"></circle>,
    check: <polyline points="20 6 9 17 4 12"></polyline>,
    x: <line x1="18" y1="6" x2="6" y2="18"></line>,
    upload: <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>,
    server: <rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect>
  }
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width="24" height="24" viewBox="0 0 24 24" 
      fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" 
      className={className}
    >
      {icons[name] || <circle cx="12" cy="12" r="10"></circle>}
      {name === 'lock' && <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>}
      {name === 'refresh' && <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>}
      {name === 'eye' && <circle cx="12" cy="12" r="3"></circle>}
      {name === 'upload' && <polyline points="17 8 12 3 7 8"></polyline>}
      {name === 'upload' && <line x1="12" y1="3" x2="12" y2="15"></line>}
      {name === 'server' && <line x1="2" y1="14" x2="22" y2="14"></line>}
      {name === 'server' && <line x1="6" y1="6" x2="6.01" y2="6"></line>}
      {name === 'server' && <line x1="6" y1="18" x2="6.01" y2="18"></line>}
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

const Database = () => {
  const [view, setView] = useState('list') // 'list' | 'detail'
  const [selectedDataset, setSelectedDataset] = useState(null)
  const [isConnectDbModalOpen, setIsConnectDbModalOpen] = useState(false)
  const [isSqlDatasetModalOpen, setIsSqlDatasetModalOpen] = useState(false)
  const [isEditSqlModalOpen, setIsEditSqlModalOpen] = useState(false)
  const [isPermissionsModalOpen, setIsPermissionsModalOpen] = useState(false)
  const [isOfflineModalOpen, setIsOfflineModalOpen] = useState(false)
  const [selectedDBType, setSelectedDBType] = useState('MySQL')
  const [selectedTeams, setSelectedTeams] = useState(['t1'])
  
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

    if (isChecked) {
      // Add all if not present
      setSelectedTeams(prev => {
        const newSelected = [...prev]
        allIdsToToggle.forEach(id => {
          if (!newSelected.includes(id)) newSelected.push(id)
        })
        return newSelected
      })
    } else {
      // Remove all
      setSelectedTeams(prev => prev.filter(id => !allIdsToToggle.includes(id)))
    }
  }
  
  // Connections State
  const [connections, setConnections] = useState([
    { id: 'conn1', name: 'Production DB', type: 'MySQL', host: '192.168.1.100', port: '3306', database: 'prod_db' }
  ])

  // SQL Dataset Form State
  const [sqlForm, setSqlForm] = useState({
    connectionId: '',
    name: '',
    sql: 'SELECT * FROM ',
    teams: []
  })
  
  // New Data Connection State
  const [connectionForm, setConnectionForm] = useState({
    name: '',
    driver: 'Default', // Default | Custom
    host: 'localhost',
    port: '3306',
    username: '',
    password: '',
    database: '',
    encoding: 'UTF-8', // Auto | UTF-8 | GBK
    schema: '',
    // Advanced
    maxActive: 50,
    initialSize: 0,
    maxWait: 10000,
    validationQuery: 'select 1',
    ssh: false,
    ssl: false,
    url: ''
  })
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false)
  const [showTestSuccess, setShowTestSuccess] = useState(false)

  // Auto-generate URL
  React.useEffect(() => {
    if (selectedDBType === 'MySQL') {
      const { host, port, database, encoding } = connectionForm
      let url = `jdbc:mysql://${host}:${port}/${database}`
      const params = []
      if (encoding !== 'Auto') params.push(`useUnicode=true&characterEncoding=${encoding}`)
      params.push('useSSL=false')
      if (params.length > 0) url += `?${params.join('&')}`
      setConnectionForm(prev => ({ ...prev, url }))
    }
  }, [connectionForm.host, connectionForm.port, connectionForm.database, connectionForm.encoding, selectedDBType])

  const handleFormChange = (field, value) => {
    setConnectionForm(prev => ({ ...prev, [field]: value }))
  }

  const handleTestConnection = () => {
    // Mock connection test
    setTimeout(() => {
      setShowTestSuccess(true)
      setTimeout(() => setShowTestSuccess(false), 2000)
    }, 500)
  }

  const handleSaveConnection = () => {
    const newConnection = {
      id: `conn${Date.now()}`,
      name: connectionForm.name || 'New Connection',
      type: selectedDBType,
      host: connectionForm.host,
      port: connectionForm.port,
      database: connectionForm.database
    }
    setConnections([...connections, newConnection])
    setIsConnectDbModalOpen(false)
    // Reset form
    setConnectionForm({
      name: '',
      driver: 'Default',
      host: 'localhost',
      port: '3306',
      username: '',
      password: '',
      database: '',
      encoding: 'UTF-8',
      schema: '',
      maxActive: 50,
      initialSize: 0,
      maxWait: 10000,
      validationQuery: 'select 1',
      ssh: false,
      ssl: false,
      url: ''
    })
  }

  const handleSaveSqlDataset = () => {
    // Mock saving SQL dataset
    alert(`Saved dataset "${sqlForm.name}" with SQL: ${sqlForm.sql} and teams: ${selectedTeams.join(', ')}`)
    setIsSqlDatasetModalOpen(false)
    // In real app, add to datasetList
  }
  
  // Mock Data
  const datasetList = [
    { id: 'ds1', name: 'clothing_company_seasonal_purchase', type: 'dataset', hasPermission: true },
    { id: 'ds2', name: 'Analysis', type: 'dataset', hasPermission: true },
    { id: 'ds3', name: 'Test Result', type: 'dataset', hasPermission: false },
    { id: 'ds4', name: 'Production-Data', type: 'dataset', hasPermission: true },
    { id: 'ds5', name: 'New Version - Test', type: 'dataset', hasPermission: true },
  ]

  const datasets = [
    { 
      id: 'ds1', 
      name: 'clothing_company_seasonal_purchase', 
      type: 'Excel Dataset', 
      creator: 'SKY1996', 
      label: 'None', 
      description: 'Seasonal purchase data for clothing company analysis', 
      fields: 'Month, Category, Amount, Region',
      updated: '2025-07-18 10:31:47',
      hasPermission: true,
      rows: [
        { id: 1, month: 'Jan', category: 'Shirts', amount: 5000, region: 'North' },
        { id: 2, month: 'Jan', category: 'Pants', amount: 3000, region: 'North' },
        { id: 3, month: 'Feb', category: 'Shirts', amount: 5500, region: 'South' },
        { id: 4, month: 'Feb', category: 'Shoes', amount: 2000, region: 'East' },
      ]
    },
    { 
      id: 'ds3', 
      name: 'Test Result', 
      type: 'Excel Dataset', 
      creator: 'SKY1996', 
      label: 'Confidential', 
      description: 'Internal test results', 
      fields: 'TestID, Score, Date',
      updated: '2025-08-01 09:00:00',
      hasPermission: false,
      rows: [] // No data access
    }
  ]

  const handleDatasetClick = (datasetId) => {
    const dataset = datasets.find(d => d.id === datasetId) || { 
      id: datasetId, 
      name: 'Unknown Dataset', 
      type: 'Unknown', 
      creator: 'Unknown', 
      hasPermission: false 
    }
    setSelectedDataset(dataset)
    setView('detail')
  }

  const handleApplyPermission = () => {
    // Mock permission application
    alert('Permission application sent to administrator.')
    // In a real app, this would update state or send a request
    const updatedDataset = { ...selectedDataset, hasPermission: true, rows: [{ id: 1, testId: 'T001', score: 98, date: '2025-08-01' }] }
    setSelectedDataset(updatedDataset)
  }

  return (
    <div className="flex h-screen bg-white">
      <Sidebar />
      
      {/* Left Sidebar: Data Directory */}
      <div className="w-64 border-r border-gray-200 flex flex-col bg-gray-50">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Data Management</h2>
            <Icon name="settings" className="text-gray-400 w-4 h-4 cursor-pointer" />
          </div>
          <div className="flex flex-col gap-2">
            <button 
              onClick={() => setIsConnectDbModalOpen(true)}
              className="flex items-center justify-center gap-2 bg-white border border-gray-200 rounded-md py-1.5 text-sm text-[#6266EA] hover:bg-gray-50 transition-colors"
            >
              <Icon name="plus" className="w-4 h-4" />
              Connect Database
            </button>
            <button 
              onClick={() => {
                setSqlForm(prev => ({ ...prev, connectionId: connections[0]?.id || '' }))
                setIsSqlDatasetModalOpen(true)
              }}
              className="flex items-center justify-center gap-2 bg-[#6266EA] border border-[#6266EA] rounded-md py-1.5 text-sm text-white hover:bg-[#5256d0] transition-colors"
            >
              <Icon name="table" className="w-4 h-4" />
              Create SQL Dataset
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto py-2">
          {/* Connections Section */}
          <div className="px-3 py-2">
            <div className="text-xs font-semibold text-gray-500 uppercase mb-2 px-2">Connections</div>
            {connections.map(conn => (
              <div key={conn.id} className="flex items-center gap-2 px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded cursor-pointer">
                <Icon name="database" className="w-4 h-4 text-gray-400" />
                <span className="truncate">{conn.name}</span>
                <span className="text-xs text-gray-400 ml-auto">{conn.type}</span>
              </div>
            ))}
          </div>
          
          <div className="border-t border-gray-200 my-2"></div>
          
          {/* Datasets List */}
          <div className="px-3 py-2">
            <div className="text-xs font-semibold text-gray-500 uppercase mb-2 px-2">Datasets</div>
            {datasetList.map(dataset => (
              <div 
                key={dataset.id} 
                className={`flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-gray-100 text-sm rounded ${selectedDataset?.id === dataset.id ? 'bg-blue-50 text-[#6266EA]' : 'text-gray-700'}`}
                onClick={() => handleDatasetClick(dataset.id)}
              >
                <div className="text-green-600">
                  <Icon name="table" className="w-4 h-4" />
                </div>
                <span className="truncate">{dataset.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#f8f9fa]">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-500">All Data</span>
            <span className="text-gray-300">/</span>
            <span className="text-gray-900 font-medium">
              {view === 'list' ? 'All Datasets' : selectedDataset?.name}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input 
                type="text"
                placeholder="Search Asset Name..."
                className="pl-9 pr-4 py-1.5 bg-white border border-gray-200 rounded-md text-sm focus:outline-none focus:border-[#6266EA] w-64"
              />
            </div>
            <button className="px-4 py-1.5 bg-[#6266EA] text-white rounded-md text-sm hover:bg-[#5256d0]">
              Search
            </button>
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto p-6">
          {view === 'list' ? (
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm">


              {/* List */}
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Name</th>
                    <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Type</th>
                    <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Creator</th>
                    <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Label</th>
                    <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Description</th>
                    <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {datasetList.map(item => (
                    <tr key={item.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => handleDatasetClick(item.id)}>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-green-100 rounded flex items-center justify-center text-green-600">
                            <Icon name="table" className="w-4 h-4" />
                          </div>
                          <span className="text-sm font-medium text-gray-900">{item.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">Excel Dataset</td>
                      <td className="px-6 py-4 text-sm text-gray-500">SKY1996</td>
                      <td className="px-6 py-4 text-sm text-gray-500">None</td>
                      <td className="px-6 py-4 text-sm text-gray-500">--</td>
                      <td className="px-6 py-4">
                        <button className="text-gray-400 hover:text-[#6266EA]">
                          <Icon name="more" className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            // Detail View
            <div className="flex flex-col h-full gap-4">
              {/* Detail Header */}
              <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
                <div className="flex items-start justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center text-green-600">
                      <Icon name="table" className="w-6 h-6" />
                    </div>
                    <div>
                      <h1 className="text-xl font-bold text-gray-900 mb-1">{selectedDataset?.name}</h1>
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span>Last Updated: {selectedDataset?.updated || '2025-07-18 10:31:47'}</span>
                        <span>Last Edited: {selectedDataset?.updated || '2025-07-18 10:31:34'}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setIsEditSqlModalOpen(true)}
                      className="px-3 py-1.5 border border-gray-200 rounded-md text-sm text-gray-600 hover:bg-gray-50"
                    >
                      Edit SQL
                    </button>
                    <button 
                      onClick={() => setIsPermissionsModalOpen(true)}
                      className="px-3 py-1.5 border border-gray-200 rounded-md text-sm text-gray-600 hover:bg-gray-50"
                    >
                      Manage Permissions
                    </button>
                    <button 
                      onClick={() => setIsOfflineModalOpen(true)}
                      className="px-3 py-1.5 border border-red-200 text-red-600 rounded-md text-sm hover:bg-red-50"
                    >
                      Offline
                    </button>
                  </div>
                </div>
                
                <div className="flex gap-6 border-b border-gray-100">
                  <div className="pb-3 text-sm font-medium cursor-pointer text-[#6266EA] border-b-2 border-[#6266EA]">
                    Data Preview
                  </div>
                </div>
              </div>

              <div className="flex gap-4 flex-1 min-h-0">
                {/* Data Table */}
                <div className="flex-1 bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden flex flex-col">
                  <div className="p-3 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                    <span className="text-sm font-medium text-gray-700">
                      {selectedDataset?.hasPermission ? 'Data Preview (Top 50 rows)' : 'Permission Required'}
                    </span>
                    {selectedDataset?.hasPermission && (
                      <button className="text-xs text-[#6266EA] border border-[#6266EA] px-2 py-1 rounded hover:bg-[#6266EA]/5">Field Group</button>
                    )}
                  </div>
                  
                  {selectedDataset?.hasPermission ? (
                    <div className="overflow-auto flex-1">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-gray-50">
                            {selectedDataset?.rows?.[0] && Object.keys(selectedDataset.rows[0]).map(key => (
                              <th key={key} className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase border-b border-r border-gray-200 whitespace-nowrap">
                                {key}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {selectedDataset?.rows?.map((row, i) => (
                            <tr key={i} className="hover:bg-gray-50">
                              {Object.values(row).map((val, j) => (
                                <td key={j} className="px-4 py-2 text-sm text-gray-600 border-b border-r border-gray-100 whitespace-nowrap">
                                  {val}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4 text-gray-400">
                        <Icon name="lock" className="w-8 h-8" />
                      </div>
                      <h3 className="text-lg font-medium text-gray-900 mb-2">Access Denied</h3>
                      <p className="text-sm text-gray-500 mb-6 max-w-md">
                        You do not have permission to view the data in this dataset. Please apply for permission to access the fields and content.
                      </p>
                      <button 
                        onClick={handleApplyPermission}
                        className="px-6 py-2 bg-[#6266EA] text-white rounded-lg hover:bg-[#5256d0] transition-colors font-medium"
                      >
                        Apply for Permission
                      </button>
                    </div>
                  )}
                </div>

                {/* Right Sidebar: Data Details */}
                <div className="w-72 bg-white rounded-lg border border-gray-200 shadow-sm p-4 overflow-y-auto">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-gray-900">Data Details</h3>
                    <Icon name="edit" className="w-4 h-4 text-gray-400 cursor-pointer" />
                  </div>
                  
                  <div className="space-y-6">
                    <div>
                      <label className="text-xs font-medium text-gray-500 block mb-1">Type</label>
                      <div className="text-sm text-gray-900">{selectedDataset?.type}</div>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500 block mb-1">Label</label>
                      <div className="text-sm text-gray-900">{selectedDataset?.label || 'None'}</div>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500 block mb-1">Data Description</label>
                      <div className="text-sm text-gray-500 italic">{selectedDataset?.description || 'No description'}</div>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500 block mb-1">Authorized Teams</label>
                      <div className="flex flex-wrap gap-1">
                        {selectedTeams.map(teamId => {
                          const team = teams.find(t => t.id === teamId)
                          return team ? (
                            <span key={teamId} className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded border border-blue-100">{team.name}</span>
                          ) : null
                        })}
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500 block mb-1">Configured SQL</label>
                      <div className="text-xs font-mono bg-gray-50 p-2 rounded border border-gray-200 text-gray-600 break-all">
                        SELECT * FROM sales_data WHERE year = 2024 LIMIT 100
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500 block mb-1">Creator</label>
                      <div className="text-sm text-gray-900">{selectedDataset?.creator}</div>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500 block mb-1">Creation Time</label>
                      <div className="text-sm text-gray-900">2025-07-18 10:31:34</div>
                    </div>
                    
                    {!selectedDataset?.hasPermission && (
                      <div className="p-3 bg-yellow-50 border border-yellow-100 rounded-md">
                        <div className="flex items-start gap-2">
                          <Icon name="lock" className="w-4 h-4 text-yellow-600 mt-0.5" />
                          <div>
                            <div className="text-xs font-medium text-yellow-800">Restricted Access</div>
                            <div className="text-xs text-yellow-600 mt-1">Field details are hidden until permission is granted.</div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Connect Database Modal */}
      {isConnectDbModalOpen && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-200 max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
              <h3 className="text-lg font-semibold text-gray-900">Connect Database</h3>
              <button onClick={() => setIsConnectDbModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <Icon name="x" className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-6 overflow-y-auto flex-1">
              {/* Database Type Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Database Type</label>
                <div className="grid grid-cols-4 gap-3">
                  {['MySQL', 'PostgreSQL', 'Oracle', 'SQL Server'].map(db => (
                    <div 
                      key={db}
                      onClick={() => setSelectedDBType(db)}
                      className={`cursor-pointer border rounded-md py-2 px-3 text-center text-sm transition-all ${
                        selectedDBType === db 
                          ? 'border-[#6266EA] bg-[#6266EA]/5 text-[#6266EA] font-medium' 
                          : 'border-gray-200 hover:border-gray-300 text-gray-600'
                      }`}
                    >
                      {db}
                    </div>
                  ))}
                </div>
              </div>

              {selectedDBType && (
                <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                  {/* Basic Configuration */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-gray-500 mb-1">Connection Name</label>
                      <input 
                        type="text" 
                        value={connectionForm.name}
                        onChange={(e) => handleFormChange('name', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#6266EA]" 
                        placeholder="e.g. Production DB" 
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Driver</label>
                      <select 
                        value={connectionForm.driver}
                        onChange={(e) => handleFormChange('driver', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#6266EA]"
                      >
                        <option value="Default">Default</option>
                        <option value="Custom">Custom</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Encoding</label>
                      <select 
                        value={connectionForm.encoding}
                        onChange={(e) => handleFormChange('encoding', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#6266EA]"
                      >
                        <option value="Auto">Auto</option>
                        <option value="UTF-8">UTF-8</option>
                        <option value="GBK">GBK</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Host</label>
                      <input 
                        type="text" 
                        value={connectionForm.host}
                        onChange={(e) => handleFormChange('host', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#6266EA]" 
                        placeholder="localhost" 
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Port</label>
                      <input 
                        type="text" 
                        value={connectionForm.port}
                        onChange={(e) => handleFormChange('port', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#6266EA]" 
                        placeholder="3306" 
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Username</label>
                      <input 
                        type="text" 
                        value={connectionForm.username}
                        onChange={(e) => handleFormChange('username', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#6266EA]" 
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Password</label>
                      <input 
                        type="password" 
                        value={connectionForm.password}
                        onChange={(e) => handleFormChange('password', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#6266EA]" 
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-gray-500 mb-1">Database Name</label>
                      <input 
                        type="text" 
                        value={connectionForm.database}
                        onChange={(e) => handleFormChange('database', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#6266EA]" 
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-gray-500 mb-1">URL (Auto-generated)</label>
                      <input 
                        type="text" 
                        value={connectionForm.url}
                        readOnly
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-500" 
                      />
                    </div>
                  </div>

                  {/* Advanced Settings */}
                  <div className="pt-2 border-t border-gray-100">
                    <button 
                      onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
                      className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-[#6266EA]"
                    >
                      <Icon name={isAdvancedOpen ? 'chevronDown' : 'chevronRight'} className="w-4 h-4" />
                      Advanced Settings
                    </button>
                    
                    {isAdvancedOpen && (
                      <div className="mt-4 space-y-4 pl-4 border-l-2 border-gray-100">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Max Active Connections</label>
                            <input 
                              type="number" 
                              value={connectionForm.maxActive}
                              onChange={(e) => handleFormChange('maxActive', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#6266EA]" 
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Max Wait (ms)</label>
                            <input 
                              type="number" 
                              value={connectionForm.maxWait}
                              onChange={(e) => handleFormChange('maxWait', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#6266EA]" 
                            />
                          </div>
                          <div className="col-span-2">
                            <label className="block text-xs font-medium text-gray-500 mb-1">Validation Query</label>
                            <input 
                              type="text" 
                              value={connectionForm.validationQuery}
                              onChange={(e) => handleFormChange('validationQuery', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#6266EA]" 
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <input 
                              type="checkbox" 
                              checked={connectionForm.ssh}
                              onChange={(e) => handleFormChange('ssh', e.target.checked)}
                              className="rounded border-gray-300 text-[#6266EA] focus:ring-[#6266EA]"
                            />
                            <label className="text-sm text-gray-700">Use SSH Tunnel</label>
                          </div>
                          <div className="flex items-center gap-2">
                            <input 
                              type="checkbox" 
                              checked={connectionForm.ssl}
                              onChange={(e) => handleFormChange('ssl', e.target.checked)}
                              className="rounded border-gray-300 text-[#6266EA] focus:ring-[#6266EA]"
                            />
                            <label className="text-sm text-gray-700">Use SSL</label>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 py-4 bg-gray-50 flex justify-end gap-3 border-t border-gray-200 flex-shrink-0">
              <button 
                onClick={() => setIsConnectDbModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleTestConnection}
                className="px-4 py-2 text-sm font-medium text-[#6266EA] border border-[#6266EA] hover:bg-[#6266EA]/5 rounded-lg transition-colors"
              >
                Test Connection
              </button>
              <button 
                onClick={handleSaveConnection}
                className="px-4 py-2 text-sm font-medium text-white bg-[#6266EA] hover:bg-[#5256d0] rounded-lg transition-colors"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create SQL Dataset Modal */}
      {isSqlDatasetModalOpen && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl overflow-hidden animate-in fade-in zoom-in duration-200 max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
              <h3 className="text-lg font-semibold text-gray-900">Create SQL Dataset</h3>
              <button onClick={() => setIsSqlDatasetModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <Icon name="x" className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-6 overflow-y-auto flex-1 flex flex-col">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Select Connection</label>
                  <select 
                    value={sqlForm.connectionId}
                    onChange={(e) => setSqlForm(prev => ({ ...prev, connectionId: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#6266EA]"
                  >
                    <option value="">Select a connection...</option>
                    {connections.map(conn => (
                      <option key={conn.id} value={conn.id}>{conn.name} ({conn.type})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Dataset Name</label>
                  <input 
                    type="text" 
                    value={sqlForm.name}
                    onChange={(e) => setSqlForm(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#6266EA]" 
                    placeholder="e.g. Monthly Sales Report" 
                  />
                </div>
              </div>

              <div className="flex-1 flex flex-col min-h-[300px]">
                <label className="block text-sm font-medium text-gray-700 mb-2">SQL Query</label>
                <textarea 
                  value={sqlForm.sql}
                  onChange={(e) => setSqlForm(prev => ({ ...prev, sql: e.target.value }))}
                  className="flex-1 w-full px-4 py-3 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:border-[#6266EA] bg-gray-50"
                  placeholder="SELECT * FROM table_name WHERE ..."
                />
              </div>

              {/* Permission Association */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Permission Association (Authorized Teams)</label>
                <div className="border border-gray-200 rounded-lg p-2 max-h-48 overflow-y-auto bg-white">
                  {teamTree.map(node => (
                    <TeamTreeNode 
                      key={node.id} 
                      node={node} 
                      selectedIds={selectedTeams} 
                      onToggle={handleTeamToggle} 
                    />
                  ))}
                </div>
                <p className="mt-1 text-xs text-gray-500">The dataset will be available to these teams.</p>
              </div>
            </div>

            <div className="px-6 py-4 bg-gray-50 flex justify-end gap-3 border-t border-gray-200 flex-shrink-0">
              <button 
                onClick={() => setIsSqlDatasetModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button 
                className="px-4 py-2 text-sm font-medium text-[#6266EA] border border-[#6266EA] hover:bg-[#6266EA]/5 rounded-lg transition-colors"
              >
                Preview Data
              </button>
              <button 
                onClick={handleSaveSqlDataset}
                className="px-4 py-2 text-sm font-medium text-white bg-[#6266EA] hover:bg-[#5256d0] rounded-lg transition-colors"
              >
                Save Dataset
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit SQL Modal */}
      {isEditSqlModalOpen && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl overflow-hidden animate-in fade-in zoom-in duration-200 max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
              <h3 className="text-lg font-semibold text-gray-900">Edit SQL</h3>
              <button onClick={() => setIsEditSqlModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <Icon name="x" className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 flex-1 flex flex-col min-h-[400px]">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">SQL Query</label>
                <div className="text-xs text-gray-500 mb-2">Current Connection: Production DB (MySQL)</div>
              </div>
              <textarea 
                defaultValue="SELECT * FROM sales_data WHERE year = 2024 LIMIT 100"
                className="flex-1 w-full px-4 py-3 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:border-[#6266EA] bg-gray-50"
                placeholder="SELECT * FROM table_name WHERE ..."
              />
            </div>

            <div className="px-6 py-4 bg-gray-50 flex justify-end gap-3 border-t border-gray-200 flex-shrink-0">
              <button 
                onClick={() => setIsEditSqlModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button 
                className="px-4 py-2 text-sm font-medium text-[#6266EA] border border-[#6266EA] hover:bg-[#6266EA]/5 rounded-lg transition-colors"
              >
                Preview Data
              </button>
              <button 
                onClick={() => {
                  setIsEditSqlModalOpen(false)
                  alert('SQL updated successfully')
                }}
                className="px-4 py-2 text-sm font-medium text-white bg-[#6266EA] hover:bg-[#5256d0] rounded-lg transition-colors"
              >
                Update SQL
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manage Permissions Modal */}
      {isPermissionsModalOpen && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Manage Permissions</h3>
              <button onClick={() => setIsPermissionsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <Icon name="x" className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6">
              <p className="text-sm text-gray-500 mb-4">Select the teams that are authorized to access this dataset.</p>
              <div className="border border-gray-200 rounded-lg p-2 max-h-60 overflow-y-auto">
                {teamTree.map(node => (
                  <TeamTreeNode 
                    key={node.id} 
                    node={node} 
                    selectedIds={selectedTeams} 
                    onToggle={handleTeamToggle} 
                  />
                ))}
              </div>
            </div>

            <div className="px-6 py-4 bg-gray-50 flex justify-end gap-3 border-t border-gray-200">
              <button 
                onClick={() => setIsPermissionsModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                  setIsPermissionsModalOpen(false)
                  alert('Permissions updated successfully')
                }}
                className="px-4 py-2 text-sm font-medium text-white bg-[#6266EA] hover:bg-[#5256d0] rounded-lg transition-colors"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Offline Confirmation Modal */}
      {isOfflineModalOpen && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 text-center">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center text-red-600 mx-auto mb-4">
                <Icon name="lock" className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Take Dataset Offline?</h3>
              <p className="text-sm text-gray-500 mb-6">
                This will make the dataset inaccessible to all projects. Existing reports using this data may break. Are you sure you want to continue?
              </p>
              
              <div className="flex justify-center gap-3">
                <button 
                  onClick={() => setIsOfflineModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => {
                    setIsOfflineModalOpen(false)
                    alert('Dataset is now offline')
                  }}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
                >
                  Confirm Offline
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Test Connection Success Popup */}
      {showTestSuccess && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center pointer-events-none">
          <div className="bg-white rounded-lg shadow-2xl p-6 flex flex-col items-center gap-3 animate-in fade-in zoom-in duration-200 border border-gray-100">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center text-green-500">
              <Icon name="check" className="w-6 h-6" />
            </div>
            <span className="text-gray-900 font-medium">Test Connection Successful</span>
          </div>
        </div>
      )}
    </div>
  )
}

export default Database