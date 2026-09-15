import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'

const LANGUAGE_STORAGE_KEY = 'des-ui-language'

const translations = {
  zh: {
    'language.zh': '中文',
    'language.en': 'English',
    'sidebar.profileSettings': '用户资料与设置',
    'sidebar.nav.mate': '员工',
    'sidebar.nav.object': '本体对象',
    'object.sidebar.title': '对象管理',
    'object.menu.chat': '场景',
    'object.menu.objectTypes': '对象',
    'object.menu.linkTypes': '关系类型',
    'object.menu.actionTypes': '流程类型',
    'object.menu.objectActions': '动作',
    'object.menu.eventTypes': '事件类型',
    'object.menu.sharedProperties': '共享属性',
    'object.menu.interfaces': '接口',
    'object.menu.functions': '函数',
    'object.menu.rules': '规则',
    'object.menu.graph': '图谱',
    'object.menu.modeling': '对象建模',
    'object.empty': '暂无内容',
    'sidebar.nav.agent': '智能体',
    'sidebar.nav.tasks': '任务',
    'sidebar.nav.resources': '资源',
    'sidebar.nav.settings': '设置',
    'sidebar.createTooltip': '创建员工或小组',
    'sidebar.recentWorkers': '最近使用员工',
    'sidebar.loading': '加载中...',
    'sidebar.noWorkers': '暂无数字员工',
    'chat.history': '聊天记录',
    'chat.clear': '清空对话',
    'chat.clearing': '清空中...',
    'chat.workspace': '工作区',
    'chat.send': '发送',
    'chat.processing': '处理中...',
    'chat.addFiles': '添加图片和文件',
    'chat.mentionAll': '@所有人',
    'chat.groupMembers': '群成员',
    'chat.noMatchedMembers': '没有匹配的成员',
    'chat.placeholder.default': '告诉我你想做什么...',
    'chat.placeholder.feedback': '请输入反馈，或回复 confirm 继续...',
    'chat.placeholder.paused': '当前步骤已暂停。回复“继续/确认”，或输入修改建议。',
    'chat.welcome.single.title': '你好，我是 {name}！',
    'chat.welcome.single.descriptionFallback': '很高兴认识你，我可以帮你处理各种工作任务。',
    'chat.welcome.single.prompt': '告诉我你想做什么，我会为你创建任务并跟踪进度。',
    'chat.welcome.group.title': '已进入 {name} 群聊',
    'chat.welcome.group.descriptionFallback': '这是一个由多个数字员工协作的群聊。',
    'chat.viewMembers': '查看成员',
    'chat.addMembers': '添加成员',
    'chat.groupLabel': '组',
    'chat.digitalWorker': '数字员工',
    'chat.role.currentResponsibility': '当前职责：',
    'chat.role.fromPrevious': '上一步来自 {name}',
    'chat.imageResult': '图片结果',
    'chat.generatedImage': '生成图片',
    'chat.seed': '种子 {value}',
    'chat.waitingConfirmation': '等待确认中...（回复 confirm 继续，或直接输入反馈）',
    'chat.workflowResult': '工作流结果',
    'chat.waitingFeedback': '等待确认或补充反馈',
    'chat.rounds': '轮数',
    'chat.mode.normal': '普通',
    'chat.mode.normalTitle': '按意图分发或 @ 点名回复',
    'chat.mode.debate': '辩论',
    'chat.mode.debateTitle': '成员先辩论，再汇总结论',
    'chat.mode.collaboration': '协作',
    'chat.mode.collaborationTitle': '自动分配成员并接力执行',
    'chat.workspace.title': '{name} 的工作区',
    'chat.workspace.restore': '还原',
    'chat.workspace.maximize': '最大化',
    'chat.workspace.close': '关闭',
    'chat.workspace.fileStorage': '文件区',
    'chat.workspace.expandFiles': '展开文件列表',
    'chat.workspace.collapseFiles': '折叠文件列表',
    'chat.workspace.emptyArtifacts': '当前对话还没有生成可查看文件。',
    'chat.workspace.selectFile': '选择一个文件查看内容',
    'chat.workspace.download': '下载',
    'chat.workspace.previewNotice': '当前文件类型无法在浏览器中原样渲染，下面展示保存的预览文本。你也可以直接下载原始文件。',
    'chat.workspace.noPreview': '暂无预览内容。',
    'chat.workspace.loadingContent': '文件内容加载中...',
    'chat.workspace.noContent': '暂无内容。',
    'chat.history.clearThis': '清空当前对话',
    'chat.history.empty': '暂无历史记录',
    'todos.title': '待办',
    'todos.empty': '暂无任务',
    'todos.workflow': '工作流',
    'todos.currentTasks': '当前任务',
    'todos.done': '已完成',
    'workmate.title': 'Silicon WorkMate',
    'workmate.newWorker': '新建数字员工',
    'workmate.myWorkers': '我的数字员工',
    'workmate.talents': '我的数字员工',
    'market.search': '搜索 Silicon Talents...',
    'market.chat': '聊天',
    'taskResults.title': '定时任务结果',
    'taskResults.markAllRead': '全部标为已读',
    'taskResults.searchLabel': '搜索任务',
    'taskResults.loading': '加载中...',
    'taskResults.empty': '暂无定时任务',
    'taskResults.scheduledTasks': '定时任务',
  },
  en: {
    'language.zh': '中文',
    'language.en': 'English',
    'sidebar.profileSettings': 'User Profile & Settings',
    'sidebar.nav.mate': 'Mate',
    'sidebar.nav.object': 'Ontology Objects',
    'object.sidebar.title': 'Object Management',
    'object.menu.chat': 'Scenarios',
    'object.menu.objectTypes': 'Objects',
    'object.menu.linkTypes': 'Link Types',
    'object.menu.actionTypes': 'Action Types',
    'object.menu.objectActions': 'Actions',
    'object.menu.eventTypes': 'Event Types',
    'object.menu.sharedProperties': 'Shared Properties',
    'object.menu.interfaces': 'Interfaces',
    'object.menu.functions': 'Functions',
    'object.menu.rules': 'Rules',
    'object.menu.graph': 'Graph',
    'object.empty': 'No content yet',
    'sidebar.nav.agent': 'Agent',
    'sidebar.nav.tasks': 'Tasks',
    'sidebar.nav.resources': 'Resources',
    'sidebar.nav.settings': 'Settings',
    'sidebar.createTooltip': 'Create employee or group',
    'sidebar.recentWorkers': 'Recently Workers',
    'sidebar.loading': 'Loading...',
    'sidebar.noWorkers': 'No Silicon Workers',
    'chat.history': 'Chat History',
    'chat.clear': 'Clear Chat',
    'chat.clearing': 'Clearing...',
    'chat.workspace': 'Workspace',
    'chat.send': 'Send',
    'chat.processing': 'Processing...',
    'chat.addFiles': 'Add Photos & Files',
    'chat.mentionAll': 'Mention All',
    'chat.groupMembers': 'Group Members',
    'chat.noMatchedMembers': 'No matching members',
    'chat.placeholder.default': 'Tell me what you want to do...',
    'chat.placeholder.feedback': "Please enter feedback, or reply 'confirm' to continue...",
    'chat.placeholder.paused': 'This step is paused. Reply "continue/confirm", or enter revision feedback.',
    'chat.welcome.single.title': 'Hi, I am {name}! 👋',
    'chat.welcome.single.descriptionFallback': 'Nice to meet you! I can help you with various work tasks.',
    'chat.welcome.single.prompt': 'Tell me what you want to do, I will create tasks for you and track progress.',
    'chat.welcome.group.title': 'Entered {name} group chat',
    'chat.welcome.group.descriptionFallback': 'This is a collaborative group chat for multiple digital workers.',
    'chat.viewMembers': 'View Members',
    'chat.addMembers': 'Add Members',
    'chat.groupLabel': 'Group',
    'chat.digitalWorker': 'Digital Worker',
    'chat.role.currentResponsibility': 'Current responsibility:',
    'chat.role.fromPrevious': 'Previous step from {name}',
    'chat.imageResult': 'Image Result',
    'chat.generatedImage': 'Generated image',
    'chat.seed': 'seed {value}',
    'chat.waitingConfirmation': "Waiting for confirmation... (Reply 'confirm' to continue, or enter feedback directly)",
    'chat.workflowResult': 'Workflow Result',
    'chat.waitingFeedback': 'Waiting for confirmation or additional feedback',
    'chat.rounds': 'Rounds',
    'chat.mode.normal': 'Normal',
    'chat.mode.normalTitle': 'Route by intent or reply after @ mention',
    'chat.mode.debate': 'Debate',
    'chat.mode.debateTitle': 'Members debate first, then synthesize a conclusion',
    'chat.mode.collaboration': 'Collab',
    'chat.mode.collaborationTitle': 'Auto-assign members and execute in relay',
    'chat.workspace.title': "{name}'s workspace",
    'chat.workspace.restore': 'Restore',
    'chat.workspace.maximize': 'Maximize',
    'chat.workspace.close': 'Close',
    'chat.workspace.fileStorage': 'File Storage',
    'chat.workspace.expandFiles': 'Expand file list',
    'chat.workspace.collapseFiles': 'Collapse file list',
    'chat.workspace.emptyArtifacts': 'No viewable files have been generated in this conversation yet.',
    'chat.workspace.selectFile': 'Select a file to view content',
    'chat.workspace.download': 'Download',
    'chat.workspace.previewNotice': 'This file type cannot be rendered exactly in the browser. Showing the saved preview text below. You can also download the original file directly.',
    'chat.workspace.noPreview': 'No preview available.',
    'chat.workspace.loadingContent': 'Loading file content...',
    'chat.workspace.noContent': 'No content available.',
    'chat.history.clearThis': 'Clear This Chat',
    'chat.history.empty': 'No history yet',
    'todos.title': 'To-dos',
    'todos.empty': 'No tasks yet',
    'todos.workflow': 'Workflow',
    'todos.currentTasks': 'Current Tasks',
    'todos.done': 'Done',
    'workmate.title': 'Silicon WorkMate',
    'workmate.newWorker': 'New Silicon Worker',
    'workmate.myWorkers': 'My Silicon Workers',
    'workmate.talents': 'Silicon Talents',
    'market.search': 'Search Silicon Talents...',
    'market.chat': 'Chat',
    'taskResults.title': 'Scheduled Task Results',
    'taskResults.markAllRead': 'Mark all read',
    'taskResults.searchLabel': 'Search tasks',
    'taskResults.loading': 'Loading...',
    'taskResults.empty': 'No scheduled tasks',
    'taskResults.scheduledTasks': 'Scheduled Tasks',
  },
}

const TranslationContext = createContext(null)

const replaceParams = (template, params) => {
  if (!params) {
    return template
  }

  return Object.entries(params).reduce(
    (result, [key, value]) => result.replaceAll(`{${key}}`, String(value ?? '')),
    template,
  )
}

export const LanguageProvider = ({ children }) => {
  const [language, setLanguage] = useState(() => {
    if (typeof window === 'undefined') {
      return 'zh'
    }

    const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY)
    return stored === 'en' ? 'en' : 'zh'
  })

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language)
      document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en'
    }
  }, [language])

  const value = useMemo(() => ({
    language,
    isZh: language === 'zh',
    setLanguage,
    t: (key, fallback = key, params) => {
      const value = translations[language]?.[key] || translations.en?.[key] || fallback
      return replaceParams(value, params)
    },
  }), [language])

  return <TranslationContext.Provider value={value}>{children}</TranslationContext.Provider>
}

export const useLanguage = () => {
  const context = useContext(TranslationContext)

  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider')
  }

  return context
}