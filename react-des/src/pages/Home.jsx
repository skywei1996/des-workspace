import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import { API_BASE } from '../config/api'

const Home = () => {
  const navigate = useNavigate()
  const [activeMember, setActiveMember] = useState('aria')
  const [isFirstMessage, setIsFirstMessage] = useState(true)
  const [chatInput, setChatInput] = useState('')
  const [showHistoryModal, setShowHistoryModal] = useState(false)
  const [showAllEmployeesModal, setShowAllEmployeesModal] = useState(false)
  const [showAddEmployeeModal, setShowAddEmployeeModal] = useState(false)

  const [currentMemberInfo, setCurrentMemberInfo] = useState(null)
  const [editingEmployee, setEditingEmployee] = useState(null)
  const [selectedAvatar, setSelectedAvatar] = useState({ type: 'emoji', value: '🤖' })
  const [selectedResources, setSelectedResources] = useState({
    knowledgeBases: [],
    databases: [],
    tools: []
  })
  const [resourceDescriptions, setResourceDescriptions] = useState({})
  const [workflowStepCount, setWorkflowStepCount] = useState(1)
  const [simulationCompleted, setSimulationCompleted] = useState(false)
  const [lastSimulationSteps, setLastSimulationSteps] = useState([])
  const [simulationTask, setSimulationTask] = useState('')
  const [activeDept, setActiveDept] = useState('all')
  const [orgSearchKeyword, setOrgSearchKeyword] = useState('')
  const [resourceDropdownOpen, setResourceDropdownOpen] = useState({ knowledge: false, database: false, tool: false })
  const [isEditing, setIsEditing] = useState(false)
  
  const chatInputRef = useRef(null)

  const memberInfo = {
    'aria': {
      name: 'Aria',
      fullName: 'Aria - 超级助理',
      role: '超级助理',
      avatar: '👑',
      photo: '👑',
      description: '我是你的超级助理Aria，可以协调团队成员完成各种任务，也可以直接为你提供全方位的帮助！'
    }
  }

  useEffect(() => {
    if (activeMember === 'aria') {
      setCurrentMemberInfo(memberInfo['aria']);
    } else if (memberInfo[activeMember]) {
      setCurrentMemberInfo(memberInfo[activeMember]);
    } else {
      // Try to fetch from backend if it's a custom employee ID
      const fetchEmployee = async () => {
        try {
          const response = await fetch(`${API_BASE}/ai-employees/${activeMember}`);
          if (response.ok) {
            const data = await response.json();
            // Generate a concise summary based on the role and prompt
            let shortDescription = data.persona_prompt;
            if (data.name === 'duoduo' || data.id === 1) {
              shortDescription = "我是专业的PM竞品报告汇报者，擅长深度业务洞察与结构化分析，助你输出高质量策略建议。";
            } else if (data.persona_prompt && data.persona_prompt.length > 50) {
              // Fallback for other employees: try to get the first sentence or truncate
              shortDescription = data.persona_prompt.split(/[。！？\n]/)[0] + '。';
            }

            setCurrentMemberInfo({
              name: data.name,
              fullName: `${data.name} - ${data.role_title}`,
              role: data.role_title,
              avatar: '🤖', // Or use data.avatar_url if available
              photo: '🤖',
              description: shortDescription || '暂无描述',
              avatarUrl: data.avatar_url // Add this to use the image URL
            });
          }
        } catch (error) {
          console.error("Failed to fetch employee details:", error);
        }
      };
      fetchEmployee();
    }
  }, [activeMember])

  const handleSelectMember = (memberType) => {
    // Navigate directly to chat workspace when a member is selected
    navigate('/chat-workspace', { state: { activeMember: memberType } })
  }

  const handleInputChange = (e) => {
    setChatInput(e.target.value)
    if (chatInputRef.current) {
      chatInputRef.current.style.height = 'auto'
      chatInputRef.current.style.height = Math.min(chatInputRef.current.scrollHeight, 120) + 'px'
    }
  }

  const handleSendMessage = () => {
    const message = chatInput.trim()
    
    if (!message) {
      return
    }

    if (isFirstMessage) {
      localStorage.setItem('firstMessage', message)
      localStorage.setItem('switchedToNew', 'true')
      setChatInput('')
      
      // 使用 React Router 跳转到工作区页面，并传递当前选中的员工ID
      navigate('/chat-workspace', { 
        state: { 
          message,
          activeMember 
        } 
      })
      return
    }
    
    setChatInput('')
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const showHistory = () => {
    setShowHistoryModal(true)
  }

  const closeHistory = () => {
    setShowHistoryModal(false)
  }

  const viewAllEmployees = () => {
    setShowAllEmployeesModal(true)
  }

  const closeAllEmployeesModal = () => {
    setShowAllEmployeesModal(false)
    setActiveDept('all')
    setOrgSearchKeyword('')
  }

  const showAddEmployee = () => {
    setShowAddEmployeeModal(true)
    resetSimulation()
  }

  const closeAddEmployeeModal = () => {
    setShowAddEmployeeModal(false)
    setSelectedAvatar({ type: 'emoji', value: '🤖' })
    setSelectedResources({ knowledgeBases: [], databases: [], tools: [] })
    setResourceDescriptions({})
    setWorkflowStepCount(1)
    setSimulationCompleted(false)
    setLastSimulationSteps([])
  }

  const getChatHistory = () => {
    return [
      {
        id: 'chat001',
        title: '产品需求讨论',
        date: '2024-01-15',
        purpose: '与Nova讨论新功能的需求分析和产品规划',
        messages: 23,
        participants: 2,
        status: '已完成'
      },
      {
        id: 'chat002',
        title: 'UI设计评审',
        date: '2024-01-14',
        purpose: '与Luna评审首页改版的设计方案',
        messages: 15,
        participants: 2,
        status: '已完成'
      },
      {
        id: 'chat003',
        title: '技术方案讨论',
        date: '2024-01-13',
        purpose: '与Neo讨论后端架构优化方案',
        messages: 31,
        participants: 3,
        status: '已完成'
      },
      {
        id: 'chat004',
        title: '测试计划制定',
        date: '2024-01-12',
        purpose: '与Atlas制定新版本的测试计划',
        messages: 18,
        participants: 2,
        status: '已完成'
      },
      {
        id: 'chat005',
        title: '营销文案创作',
        date: '2024-01-11',
        purpose: '与Muse创作产品发布的营销文案',
        messages: 27,
        participants: 2,
        status: '已完成'
      }
    ]
  }

  const viewHistoryDetail = (chatId) => {
    alert('功能开发中：查看详细聊天记录 - ' + chatId)
  }

  const getAllEmployees = () => {
    const builtinEmployees = [
      { id: 'aria', type: 'builtin', name: 'Aria', role: '超级助理', avatar: { type: 'emoji', value: '👑' }, department: 'leadership' },
      { id: 'pm', type: 'builtin', name: 'Nova', role: '产品经理', avatar: { type: 'emoji', value: '📋' }, department: 'product' },
      { id: 'ui', type: 'builtin', name: 'Luna', role: '设计师', avatar: { type: 'emoji', value: '🎨' }, department: 'design' },
      { id: 'developer', type: 'builtin', name: 'Neo', role: '开发工程师', avatar: { type: 'emoji', value: '💻' }, department: 'engineering' },
      { id: 'tester', type: 'builtin', name: 'Atlas', role: '测试工程师', avatar: { type: 'emoji', value: '🧪' }, department: 'qa' },
      { id: 'writer', type: 'builtin', name: 'Muse', role: '文案策划', avatar: { type: 'emoji', value: '✍️' }, department: 'content' }
    ]
    
    const customEmployees = JSON.parse(localStorage.getItem('customEmployees') || '[]')
      .map(emp => ({ ...emp, type: 'custom', department: emp.department || 'leadership' }))
    
    return [...builtinEmployees, ...customEmployees]
  }

  const switchOrgDept = (deptKey) => {
    setActiveDept(deptKey)
    setOrgSearchKeyword('')
  }

  const filterOrgEmployees = (keyword) => {
    setOrgSearchKeyword(keyword)
  }

  const selectEmployeeFromModal = (employeeId, type) => {
    closeAllEmployeesModal()
    setTimeout(() => {
      setActiveMember(employeeId)
    }, 300)
  }

  const selectAvatarOption = (type, value) => {
    setSelectedAvatar({ type, value })
  }

  const handleAvatarUpload = (e) => {
    const file = e.target.files[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (event) => {
        setSelectedAvatar({ type: 'image', value: event.target.result })
      }
      reader.readAsDataURL(file)
    }
  }

  const addWorkflowStep = () => {
    setWorkflowStepCount(workflowStepCount + 1)
  }

  const toggleResourceDropdown = (type) => {
    setResourceDropdownOpen(prev => {
      const newState = { knowledge: false, database: false, tool: false }
      newState[type] = !prev[type]
      return newState
    })
  }

  const selectResource = (type, id, name, icon) => {
    let resourceArray
    if (type === 'knowledge') {
      resourceArray = selectedResources.knowledgeBases
    } else if (type === 'database') {
      resourceArray = selectedResources.databases
    } else if (type === 'tool') {
      resourceArray = selectedResources.tools
    }
    
    const index = resourceArray.findIndex(r => r.id === id)
    
    if (index > -1) {
      resourceArray.splice(index, 1)
      const newDescriptions = { ...resourceDescriptions }
      delete newDescriptions[`${type}_${id}`]
      setResourceDescriptions(newDescriptions)
    } else {
      resourceArray.push({ id, name, type, icon })
    }
    
    setSelectedResources({ ...selectedResources })
  }

  const removeResourceTag = (type, id) => {
    let resourceArray
    if (type === 'knowledge') {
      resourceArray = selectedResources.knowledgeBases
    } else if (type === 'database') {
      resourceArray = selectedResources.databases
    } else if (type === 'tool') {
      resourceArray = selectedResources.tools
    }
    
    const index = resourceArray.findIndex(r => r.id === id)
    if (index > -1) {
      resourceArray.splice(index, 1)
      const newDescriptions = { ...resourceDescriptions }
      delete newDescriptions[`${type}_${id}`]
      setResourceDescriptions(newDescriptions)
      setSelectedResources({ ...selectedResources })
    }
  }

  const saveResourceDescription = (key, value) => {
    setResourceDescriptions(prev => ({ ...prev, [key]: value }))
  }

  const startSimulation = () => {
    const task = simulationTask.trim()
    if (!task) {
      alert('请输入要模拟的任务内容。')
      return
    }

    const workflowInputs = document.querySelectorAll('.step-input')
    let workflow = Array.from(workflowInputs)
      .map(input => input.value.trim())
      .filter(step => step !== '')
    
    if (workflow.length === 0) {
      workflow = [
        '接收任务需求',
        '分析任务目标',
        '执行核心操作',
        '输出最终结果'
      ]
    }

    const steps = []

    if (selectedResources.knowledgeBases.length > 0) {
      const kb = selectedResources.knowledgeBases[0]
      steps.push({
        action: `📚 调用知识库：${kb.name}`,
        detail: '检索相关背景知识和上下文信息',
        result: '汇总上下文信息，确保执行方向准确。'
      })
    }

    if (selectedResources.databases.length > 0) {
      const db = selectedResources.databases[0]
      steps.push({
        action: `🗄️ 查询数据库：${db.name}`,
        detail: '提取所需数据并进行预处理',
        result: '得到可直接引用的数据集。'
      })
    }

    const toolPool = selectedResources.tools.length > 0 
      ? selectedResources.tools 
      : [{ id: 'system', name: '自动执行引擎', icon: '🤖' }]

    workflow.forEach((flow, index) => {
      const tool = toolPool[index % toolPool.length]
      steps.push({
        action: `${tool.icon} 使用工具：${tool.name}`,
        detail: flow,
        result: `完成"${flow}"，生成阶段成果。`
      })
    })

    if (steps.length === 0) {
      steps.push({
        action: '🤖 自动执行',
        detail: task,
        result: '任务完成'
      })
    }

    setLastSimulationSteps(steps)
    setSimulationCompleted(true)
  }

  const resetSimulation = () => {
    setSimulationTask('')
    setSimulationCompleted(false)
    setLastSimulationSteps([])
  }

  const confirmCreate = () => {
    if (!simulationCompleted) {
      alert('请先点击"开始模拟"按钮，查看工作流程是否符合预期。')
      return
    }

    const name = document.getElementById('employeeName')?.value.trim()
    const role = document.getElementById('employeeRole')?.value.trim()
    
    if (!name || !role) {
      alert('请填写员工姓名和职位')
      return
    }

    const workflowInputs = document.querySelectorAll('.step-input')
    const workflow = Array.from(workflowInputs)
      .map(input => input.value.trim())
      .filter(step => step !== '')

    const newEmployee = {
      id: 'custom_' + Date.now(),
      name,
      role,
      avatar: selectedAvatar,
      resources: selectedResources,
      resourceDescriptions,
      workflow,
      description: document.getElementById('employeeDesc')?.value || ''
    }

    let employees = JSON.parse(localStorage.getItem('customEmployees') || '[]')
    employees.push(newEmployee)
    localStorage.setItem('customEmployees', JSON.stringify(employees))

    closeAddEmployeeModal()
    alert(`AI员工 ${name} 创建成功！`)
    
    // Reload sidebar
    window.location.reload()
  }

  const handleEditEmployee = () => {
    // If it's a built-in member (exists in memberInfo), do not navigate
    if (memberInfo[activeMember]) {
      return;
    }
    
    navigate(`/add-silicon-worker?mode=edit&id=${activeMember}`);
  }

  const departments = {
    all: { key: 'all', name: '全部' },
    leadership: { key: 'leadership', name: '管理' },
    product: { key: 'product', name: '产品' },
    design: { key: 'design', name: '设计' },
    engineering: { key: 'engineering', name: '工程' },
    qa: { key: 'qa', name: '测试' },
    content: { key: 'content', name: '内容' }
  }

  const getFilteredEmployees = () => {
    let employees = getAllEmployees()
    
    // Filter by department
    if (activeDept !== 'all') {
      employees = employees.filter(emp => emp.department === activeDept)
    }
    
    // Filter by search keyword
    if (orgSearchKeyword.trim()) {
      const keyword = orgSearchKeyword.toLowerCase()
      employees = employees.filter(emp => 
        emp.name.toLowerCase().includes(keyword) || 
        emp.role.toLowerCase().includes(keyword)
      )
    }
    
    return employees
  }

  const getDeptCount = (deptKey) => {
    if (deptKey === 'all') {
      return getAllEmployees().length
    }
    return getAllEmployees().filter(emp => emp.department === deptKey).length
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar 
        onSelectMember={handleSelectMember}
        activeMember={activeMember}
        onViewAllEmployees={viewAllEmployees}
      />

      <div className="flex-1 flex flex-col bg-white h-screen">
        <div className="px-7 py-6 border-b border-border flex items-center gap-4">
          <div 
            className="w-[60px] h-[60px] rounded-[18px] overflow-hidden bg-gradient-to-br from-primary-start to-primary-end flex items-center justify-center cursor-pointer shadow-[0_12px_25px_rgba(102,126,234,0.35)] flex-shrink-0"
            onClick={handleEditEmployee}
            title="点击编辑员工信息"
          >
            {currentMemberInfo?.avatarUrl ? (
              <img src={currentMemberInfo.avatarUrl} alt={currentMemberInfo.name} className="w-full h-full object-cover" />
            ) : (
              <span className="text-3xl">{currentMemberInfo?.photo}</span>
            )}
          </div>
          <div className="ai-info flex-1 min-w-0">
            <h1 className="m-0 text-xl font-bold truncate">{currentMemberInfo?.fullName}</h1>
            <p className="mt-1 mb-0 text-muted text-sm line-clamp-3 leading-relaxed" title={currentMemberInfo?.description}>
              {currentMemberInfo?.description}
            </p>
          </div>
          <div className="ml-auto flex-shrink-0">
            <button 
              className="border border-border rounded-[10px] bg-white px-4 py-2.5 text-sm flex items-center gap-2 cursor-pointer transition-all duration-200 hover:bg-[#f4f4ff] hover:border-[#d9daf4]"
              onClick={showHistory}
            >
              <span>📜</span>
              <span>历史记录</span>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-10 py-[60px] bg-[radial-gradient(circle_at_top,#ffffff_0%,#f3f3fb_60%)] flex items-center justify-center">
          <div className="text-center max-w-[800px] px-8 py-10 bg-transparent border-none rounded-none shadow-none">
            <div className="w-[100px] h-[100px] rounded-full mx-auto mb-6 overflow-hidden shadow-[0_18px_40px_rgba(118,75,162,0.25)] border-4 border-white">
              {currentMemberInfo?.avatarUrl ? (
                <img src={currentMemberInfo.avatarUrl} alt={currentMemberInfo.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-primary-start to-primary-end flex items-center justify-center">
                  <span className="text-5xl">{currentMemberInfo?.photo}</span>
                </div>
              )}
            </div>
            <h2 className="text-3xl font-bold m-0 mb-6 text-gray-900">嗨，我是 {currentMemberInfo?.name}！👋</h2>
            <p className="text-base leading-loose text-gray-600 m-0 mb-8 text-justify">
              {currentMemberInfo?.description}
            </p>
            <p className="text-base text-gray-500 font-medium">
              告诉我你想做什么，我会为你创建任务并跟踪进度～
            </p>
          </div>
        </div>

        <div className="px-8 py-[22px] border-t border-border bg-white">
          <div className="flex gap-4 bg-[#f6f6ff] border border-[#e2e3f8] rounded-[20px] px-3 py-2">
            <textarea
              ref={chatInputRef}
              id="chatInput"
              className="flex-1 border-none bg-transparent resize-none text-[15px] px-1.5 py-2.5 text-text focus:outline-none"
              placeholder="输入你的消息..."
              rows="1"
              value={chatInput}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
            />
            <div className="flex items-center">
              <button 
                id="sendBtn"
                className="border-none px-7 py-3 rounded-2xl bg-gradient-to-br from-primary-start to-primary-end text-white text-[15px] font-semibold cursor-pointer shadow-[0_12px_24px_rgba(102,126,234,0.35)] transition-transform duration-200 hover:-translate-y-0.5 disabled:opacity-60 disabled:cursor-not-allowed disabled:shadow-none"
                onClick={handleSendMessage}
                disabled={!chatInput.trim()}
              >
                发送
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Profile Modal has been removed */}

      {/* History Modal */}
      {showHistoryModal && (
        <div 
          className="fixed inset-0 bg-black/55 flex items-center justify-center opacity-100 visible transition-all duration-300 z-[900]"
          onClick={closeHistory}
        >
          <div className="bg-white w-[92%] max-w-[960px] max-h-[85vh] rounded-[28px] overflow-hidden flex flex-col shadow-[0_30px_70px_rgba(15,23,42,0.35)]" onClick={(e) => e.stopPropagation()}>
            <div className="px-7 py-7 border-b border-border relative">
              <button 
                className="absolute top-5 right-8 border-none bg-black/8 w-10 h-10 rounded-xl text-2xl cursor-pointer"
                onClick={closeHistory}
              >
                ×
              </button>
              <h2 className="text-[22px] font-bold m-0 flex items-center gap-3">
                <span>📜</span>
                <span>历史记录</span>
              </h2>
              <p className="mt-2 mb-0 text-muted text-sm">查看你与AI员工的所有对话记录</p>
            </div>
            <div className="px-7 py-6 pb-8 overflow-y-auto">
              {getChatHistory().length === 0 ? (
                <div className="text-center py-[60px] px-5 text-muted">
                  <div className="text-[40px] mb-3.5">📭</div>
                  <p>还没有历史记录</p>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {getChatHistory().map(chat => (
                    <div 
                      key={chat.id}
                      className="border border-[#e6e7f5] rounded-[18px] px-[22px] py-[18px] cursor-pointer transition-all duration-200 bg-white hover:border-primary-start hover:shadow-[0_16px_32px_rgba(102,126,234,0.15)]"
                      onClick={() => viewHistoryDetail(chat.id)}
                    >
                      <div className="flex justify-between items-center mb-2">
                        <div className="text-base font-semibold">{chat.title}</div>
                        <div className="text-xs text-muted">{chat.date}</div>
                      </div>
                      <div className="text-[13px] text-[#4b5563] leading-[1.6] mb-3">{chat.purpose}</div>
                      <div className="flex gap-4 text-xs text-muted">
                        <div className="history-stat">
                          <span>💬</span>
                          {chat.messages} 条消息
                        </div>
                        <div className="history-stat">
                          <span>👥</span>
                          {chat.participants} 位参与者
                        </div>
                        <div className="history-stat">
                          <span>✅</span>
                          {chat.status}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* All Employees Modal */}
      {showAllEmployeesModal && (
        <div 
          className="fixed inset-0 bg-black/55 flex items-center justify-center opacity-100 visible transition-all duration-300 z-[900]"
          onClick={closeAllEmployeesModal}
        >
          <div className="bg-white w-[92%] max-w-[1200px] max-h-[85vh] rounded-[28px] overflow-hidden flex flex-col shadow-[0_30px_70px_rgba(15,23,42,0.35)]" onClick={(e) => e.stopPropagation()}>
            <div className="px-[26px] py-[26px] border-b border-border">
              <button 
                className="absolute top-5 right-8 border-none bg-black/8 w-10 h-10 rounded-xl text-2xl cursor-pointer"
                onClick={closeAllEmployeesModal}
              >
                ×
              </button>
              <h2 className="m-0 mb-3.5 text-[22px] font-bold">组织架构 - 全部员工</h2>
              <div className="relative">
                <input 
                  type="text" 
                  className="w-full px-3.5 py-3 rounded-[14px] border border-border focus:outline-none focus:border-primary-start"
                  placeholder="搜索员工姓名或职位..."
                  value={orgSearchKeyword}
                  onChange={(e) => filterOrgEmployees(e.target.value)}
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#b0b2c7]">🔍</span>
              </div>
            </div>

            <div className="flex gap-2.5 px-[26px] pt-[18px] border-b border-border">
              {Object.values(departments).map(dept => (
                <div 
                  key={dept.key}
                  className={`px-[18px] py-2.5 rounded-full border cursor-pointer flex items-center gap-1.5 text-[13px] ${
                    activeDept === dept.key 
                      ? 'border-[#dfe1ff] bg-[#f6f6ff] text-primary-start' 
                      : 'border-transparent text-[#6f7293]'
                  }`}
                  onClick={() => switchOrgDept(dept.key)}
                >
                  <span>{dept.name}</span>
                  <span className="text-xs opacity-60">({getDeptCount(dept.key)})</span>
                </div>
              ))}
            </div>

            <div className="px-[26px] py-6 grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-[18px] overflow-y-auto">
              {getFilteredEmployees().length === 0 ? (
                <div className="col-span-full text-center text-muted py-10">
                  未找到符合条件的员工
                </div>
              ) : (
                getFilteredEmployees().map(employee => (
                  <div 
                    key={employee.id}
                    className="border border-[#e6e8f7] rounded-[18px] p-[18px] bg-white cursor-pointer flex flex-col gap-2 transition-shadow duration-200 hover:shadow-[0_16px_32px_rgba(15,23,42,0.1)]"
                    onClick={() => selectEmployeeFromModal(employee.id, employee.type)}
                  >
                    <div className="w-[52px] h-[52px] rounded-2xl overflow-hidden bg-[#f2f2fa] flex items-center justify-center text-2xl">
                      {employee.avatar.type === 'image' ? (
                        <img src={employee.avatar.value} alt={employee.name} className="w-full h-full object-cover" />
                      ) : (
                        <span>{employee.avatar.value}</span>
                      )}
                    </div>
                    <div className="font-semibold">{employee.name}</div>
                    <div className="text-[13px] text-muted">{employee.role}</div>
                    <div className="text-xs text-[#4b5563] leading-[1.5] min-h-[48px]">
                      {employee.description || `专业的${employee.role}，随时为您服务`}
                    </div>
                    <div className="mt-auto">
                      <button className="w-full px-2.5 py-2.5 rounded-xl border-none bg-[#f4f4ff] text-primary-start cursor-pointer">
                        开始对话
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add Employee Modal - Removed as per request to navigate to page directly */}


    </div>
  )
}

export default Home
