import React, { useMemo, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import Sidebar from '../components/Sidebar'
import ProjectSideMenu from '../components/ProjectSideMenu'
import { API_BASE } from '../config/api'

const hrMenuItems = [
  { label: '岗位需求', route: '/recruitment-assistant' },
  { label: '简历筛选', route: '/candidate-list' },
]

const jobRows = [
  {
    id: 'jd-platform-backend',
    department: '技术平台部',
    jobTitle: '高级后端开发工程师',
    jobLevel: 'P6-P7',
    location: '上海 / 混合办公',
    owner: 'Cindy',
    status: '进行中',
    updatedAt: '2026-06-08 16:20',
    jdSummary: '负责高并发交易链路、服务治理与核心模块开发，要求 Java、Spring Cloud、MySQL、Redis 与分布式系统经验。',
    jdOverview: {
      department: '技术平台部',
      summary: '负责公司核心交易系统与平台基础能力建设，围绕高并发、稳定性、性能优化和服务治理目标，支撑订单、支付、履约等关键业务链路持续迭代。',
      responsibilities: [
        '负责核心后端服务的架构设计、模块开发与性能优化，保障交易链路稳定运行；',
        '参与订单、支付、履约等复杂业务系统建设，推动关键技术方案落地；',
        '负责服务治理、接口规范、链路监控、故障定位与容量规划；',
        '与产品、测试、运维及业务团队协作，提升系统交付质量和问题响应效率；',
        '沉淀技术文档与工程最佳实践，指导中初级工程师完成复杂模块开发。',
      ],
      requirements: [
        '本科及以上学历，计算机、软件工程等相关专业优先；',
        '5 年以上 Java 后端开发经验，有核心业务系统或高并发系统建设经验；',
        '熟悉 Spring Cloud、MySQL、Redis、消息队列和常见分布式系统设计模式；',
        '具备良好的系统抽象、问题排查、性能调优和工程质量意识；',
        '具备跨团队沟通能力，能推动复杂技术方案在业务场景中落地。',
      ],
      bonus: '有交易、支付、电商、履约、金融科技等业务系统经验者优先；有大型系统稳定性治理或技术团队带教经验者优先。',
      coreCompetencies: '系统设计、工程质量、问题定位、性能优化、跨团队协作、结果导向。',
    },
    resumesTotal: 86,
    screenedCount: 42,
    writtenPassedCount: 18,
    interviewPassedCount: 7,
    onboardConfirmedCount: 2,
    testAgent: '笔试生成 Agent',
    testStatus: '已生成',
    testQuestions: [
      '请设计一个订单状态流转服务，说明状态机、幂等处理和异常补偿方案。',
      '给定一段慢 SQL，分析可能原因并提出索引和查询改写建议。',
      '说明 Redis 缓存穿透、击穿、雪崩的区别及工程治理方案。',
    ],
  },
  {
    id: 'jd-data-analyst',
    department: '数据智能部',
    jobTitle: '商业数据分析师',
    jobLevel: 'P5-P6',
    location: '北京',
    owner: 'Cindy',
    status: '已确认',
    updatedAt: '2026-06-07 11:10',
    jdSummary: '面向经营分析、指标体系和专题洞察，要求 SQL、BI 看板、业务拆解与跨团队沟通能力。',
    jdOverview: {
      department: '数据智能部',
      summary: '负责公司经营分析、指标体系建设和业务专题洞察，基于数据发现业务问题、识别增长机会，并推动业务团队形成数据驱动的决策机制。',
      responsibilities: [
        '负责核心业务指标体系搭建、口径治理和数据看板设计；',
        '围绕用户增长、转化、留存、收入等主题开展专题分析；',
        '与产品、运营、销售等团队协作，识别业务异常并提出优化建议；',
        '沉淀分析方法、报表模板和复盘机制，提升业务自助分析效率；',
        '跟踪关键策略上线后的效果，输出阶段性复盘和后续行动建议。',
      ],
      requirements: [
        '本科及以上学历，统计学、数学、计算机、信息管理等相关专业优先；',
        '3 年以上数据分析或商业分析经验，有经营分析或产品分析经验优先；',
        '熟练使用 SQL，熟悉至少一种 BI 工具或数据可视化工具；',
        '具备较强的业务拆解能力，能从指标变化定位原因并提出建议；',
        '具备清晰的结构化表达能力，能面向业务团队输出可理解的分析结论。',
      ],
      bonus: '有 SaaS、企业服务、互联网增长、销售运营或数据产品经验者优先；熟悉 Python 或数据建模者优先。',
      coreCompetencies: '指标思维、业务洞察、数据分析、逻辑表达、跨团队协作、行动导向。',
    },
    resumesTotal: 64,
    screenedCount: 31,
    writtenPassedCount: 14,
    interviewPassedCount: 5,
    onboardConfirmedCount: 1,
    testAgent: '笔试生成 Agent',
    testStatus: '已生成',
    testQuestions: [
      '请基于 DAU 下跌 12% 的现象，拆解可能原因并设计验证路径。',
      '给出一张订单表和用户表，写 SQL 计算近 30 日复购率。',
      '请设计一个销售漏斗看板，说明核心指标、维度和异常预警规则。',
    ],
  },
  {
    id: 'jd-hrbp',
    department: '人力资源部',
    jobTitle: 'HRBP',
    jobLevel: 'M1',
    location: '深圳',
    owner: 'Cindy',
    status: '已关闭',
    updatedAt: '2026-06-06 09:45',
    jdSummary: '支持业务团队组织诊断、绩效协同、人才盘点与招聘推进，要求业务理解、沟通影响和项目推动能力。',
    jdOverview: {
      department: '人力资源部',
      summary: '负责支持重点业务团队的人力资源工作，围绕组织效能、人才发展、绩效协同和招聘推进，帮助业务团队提升组织健康度与人才供给效率。',
      responsibilities: [
        '深入理解业务目标和团队现状，识别组织、人才和协作中的关键问题；',
        '支持岗位画像梳理、招聘需求澄清、候选人推进和用人经理协同；',
        '参与绩效沟通、人才盘点、员工访谈和团队氛围建设；',
        '协助业务负责人制定人才发展和组织优化方案，并跟踪落地效果；',
        '沉淀 HRBP 工作方法和人力数据分析口径，提升组织管理效率。',
      ],
      requirements: [
        '本科及以上学历，人力资源、心理学、管理学等相关专业优先；',
        '3 年以上 HRBP、招聘或组织发展相关经验，有业务支持经验优先；',
        '理解招聘、绩效、人才发展和员工关系等人力资源关键模块；',
        '具备优秀的沟通协调、问题诊断和项目推动能力；',
        '具备较强的同理心、边界感和保密意识。',
      ],
      bonus: '有互联网、SaaS、AI 或快速成长型组织 HRBP 经验者优先；有组织诊断或人才盘点项目经验者优先。',
      coreCompetencies: '业务理解、组织诊断、沟通影响、项目推进、人才判断、责任意识。',
    },
    resumesTotal: 39,
    screenedCount: 17,
    writtenPassedCount: 8,
    interviewPassedCount: 3,
    onboardConfirmedCount: 0,
    testAgent: '笔试生成 Agent',
    testStatus: '待确认',
    testQuestions: [
      '业务负责人认为团队协作效率低，请设计一次组织诊断访谈方案。',
      '请说明如何判断一个岗位画像是否过宽，并给出收敛建议。',
      '面对候选人 offer 犹豫，请设计 HRBP 与招聘协同推进策略。',
    ],
  },
  {
    id: 'jd-product-manager',
    department: '产品部',
    jobTitle: '高级产品经理',
    jobLevel: 'P6',
    location: '杭州 / 远程友好',
    owner: 'Cindy',
    status: '已确认',
    updatedAt: '2026-06-05 18:30',
    jdSummary: '负责公司核心产品线的整体规划、设计与落地执行，基于用户需求、市场趋势及业务目标推动产品持续优化与增长。',
    jdOverview: {
      department: '产品部',
      summary: '负责公司核心产品线的整体规划、设计与落地执行，基于用户需求、市场趋势及业务目标，制定产品发展策略并推动产品持续优化与增长。',
      responsibilities: [
        '负责产品战略规划与路线图制定，明确产品定位与发展方向；',
        '主导需求调研、用户分析、竞品研究及数据分析，识别产品机会点；',
        '负责产品方案设计、PRD 文档撰写及跨部门项目推进；',
        '协调研发、设计、运营、市场等团队，确保产品按计划高质量上线；',
        '跟踪产品核心指标，持续优化用户体验与业务表现；',
        '指导中初级产品经理，提升团队整体产品能力。',
      ],
      requirements: [
        '本科及以上学历，计算机、信息管理、市场营销等相关专业优先；',
        '5 年以上产品经理经验，具备独立负责核心产品或复杂系统的经验；',
        '熟悉产品全生命周期管理，具备扎实的需求分析与产品设计能力；',
        '具备良好的数据分析能力与商业洞察力，能以数据驱动决策；',
        '具备优秀的沟通协调与项目管理能力，能高效推动跨团队协作；',
        '具备较强的逻辑思维与结构化表达能力。',
      ],
      bonus: '有 SaaS、AI 产品、平台型产品或企业服务经验者优先；具备一定的技术背景或研发协作经验者优先。',
      coreCompetencies: '战略思维、用户洞察、数据分析、跨部门协作、结果导向、创新意识。',
    },
    resumesTotal: 52,
    screenedCount: 26,
    writtenPassedCount: 10,
    interviewPassedCount: 4,
    onboardConfirmedCount: 1,
    testAgent: '笔试生成 Agent',
    testStatus: '已生成',
    testQuestions: [
      '请为招聘助手设计 POC 阶段最小闭环，并说明验收指标。',
      '如何判断一个 Agent 流程适合用工作流编排而不是单轮对话？',
      '请拆解一个简历筛选工作台的信息架构和关键交互。',
    ],
  },
]

const statusClassMap = {
  已确认: 'text-emerald-700',
  待复核: 'text-amber-700',
  进行中: 'text-blue-700',
  已关闭: 'text-gray-600',
}

const testAnswerMap = {
  'jd-platform-backend': [
    '应说明订单状态的完整流转关系，如待支付、已支付、履约中、已完成、已取消、退款中等；状态变更需要通过状态机约束，避免非法跳转。幂等处理可通过业务唯一键、去重表、乐观锁或分布式锁实现；异常补偿需要结合消息重试、补偿任务、事务日志和人工兜底。优秀答案应能覆盖一致性、可观测性、失败恢复和灰度发布策略。',
    '应先从执行计划、索引命中、扫描行数、回表次数、排序与临时表等角度定位慢 SQL 原因。优化建议包括建立联合索引、调整字段顺序、避免函数或隐式转换、减少 select 字段、拆分复杂查询、控制分页深度，并结合业务读写频率评估索引成本。',
    '缓存穿透是查询不存在的数据直接打到数据库，可用空值缓存、布隆过滤器和参数校验治理；缓存击穿是热点 key 失效瞬间大量请求打到数据库，可用互斥锁、逻辑过期和热点预热治理；缓存雪崩是大量 key 同时失效或缓存集群异常，可用过期时间随机化、多级缓存、限流降级和集群高可用治理。',
  ],
  'jd-data-analyst': [
    '应先拆解 DAU 为新增、留存、召回和活跃频次等组成部分，再按渠道、版本、地区、用户分层、入口流量和关键行为漏斗定位变化来源。验证路径包括对比同期趋势、排查埋点和口径、查看发布变更、分析 cohort 留存，并输出优先级明确的行动建议。',
    '答案应能说明复购率口径，例如近 30 日内有两次及以上有效订单的用户数除以近 30 日下单用户数。SQL 需要正确处理订单状态、时间窗口、用户去重和聚合条件，并说明是否排除退款、取消订单等异常数据。',
    '应覆盖销售线索、商机、报价、成交、回款等核心阶段，指标包括转化率、阶段停留时长、流失原因、客单价、销售负责人和来源渠道。异常预警可基于环比/同比波动、阶段转化阈值、超期未推进和高价值商机流失等规则设计。',
  ],
  'jd-hrbp': [
    '应包含访谈目标、对象分层、问题提纲、信息保密机制和输出方式。访谈对象应覆盖业务负责人、核心员工、新员工和协作团队；问题需围绕目标清晰度、协作机制、角色分工、绩效反馈和人才风险展开，最终形成问题归因和行动建议。',
    '可从职责范围过宽、能力要求过多、职级薪资不匹配、必备项和加分项混淆、目标场景不清晰等方面判断岗位画像是否过宽。收敛建议包括明确岗位核心产出、拆分必备与可培养要求、对齐业务阶段和预算，并与用人经理确认取舍。',
    '应先识别候选人犹豫原因，如薪酬、发展、团队稳定性、通勤、家庭因素或竞品 offer。HRBP 需要协同招聘、用人经理和业务负责人提供有针对性的沟通材料，明确岗位价值、成长路径和决策时间线，同时避免过度承诺。',
  ],
  'jd-product-manager': [
    'POC 最小闭环应覆盖岗位 JD 确认、候选人接入、简历解析、匹配评分、人工确认邀约和结果回流。验收指标可包括 JD 首稿采纳率、平均澄清轮次、简历解析成功率、推荐准确率、人工筛选节省时长和候选人推进转化率。',
    '当流程涉及明确节点、条件分支、人工确认、工具调用、状态追踪和审计要求时，更适合工作流编排；如果只是一次性问答或内容生成，则单轮对话即可。优秀答案应能说明可控性、可解释性、失败恢复和业务责任边界。',
    '信息架构应包含岗位筛选区、候选人列表区、详情抽屉和数字员工辅助分析入口。关键交互包括排序筛选、批量勾选、状态变更、查看推荐原因、候选人对比、重新评分、确认邀约和淘汰原因记录。',
  ],
}

const defaultJdEmployeeOptions = [
  {
    id: 'aria',
    name: 'Cindy',
    role_title: '岗位 JD 生成数字员工',
    persona_prompt: '负责岗位 JD 生成、优化、合规检查与发布前审阅。',
  },
]

const buildJdMarkdown = (job) => {
  const overview = job.jdOverview

  return `## 所属部门
${overview.department}

## 岗位概述
${overview.summary}

## 岗位职责
${overview.responsibilities.map((item, index) => `${index + 1}. ${item}`).join('\n')}

## 任职要求
${overview.requirements.map((item, index) => `${index + 1}. ${item}`).join('\n')}

## 加分项
${overview.bonus}

## 核心能力
${overview.coreCompetencies}`
}

const buildTestMarkdown = (job, answersByJob = testAnswerMap) => {
  const answers = answersByJob[job.id] || []

  return job.testQuestions.map((question, index) => `## 题目 ${index + 1}
${question}

### 标准答案
${answers[index] || '请补充该题的标准答案、评分要点和通过标准。'}`).join('\n\n')
}

const markdownComponents = {
  h2: ({ children }) => <h2 className="mb-3 mt-6 text-lg font-semibold text-gray-900 first:mt-0">{children}</h2>,
  p: ({ children }) => <p className="mb-4 text-sm leading-7 text-gray-800">{children}</p>,
  ol: ({ children }) => <ol className="mb-5 list-decimal space-y-2 pl-5 text-sm leading-7 text-gray-800">{children}</ol>,
  ul: ({ children }) => <ul className="mb-5 list-disc space-y-2 pl-5 text-sm leading-7 text-gray-800">{children}</ul>,
  li: ({ children }) => <li>{children}</li>,
  strong: ({ children }) => <strong className="font-semibold text-gray-900">{children}</strong>,
}

const RecruitmentAssistant = () => {
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = useState('')
  const [departmentFilter, setDepartmentFilter] = useState('全部部门')
  const [jobsState, setJobsState] = useState(jobRows)
  const [testAnswerDrafts, setTestAnswerDrafts] = useState(testAnswerMap)
  const [selectedJob, setSelectedJob] = useState(null)
  const [overviewJob, setOverviewJob] = useState(null)
  const [jdMarkdownDrafts, setJdMarkdownDrafts] = useState({})
  const [testMarkdownDrafts, setTestMarkdownDrafts] = useState({})
  const [jdFormDraft, setJdFormDraft] = useState(null)
  const [testFormDraft, setTestFormDraft] = useState([])
  const [isRegenerateModalOpen, setIsRegenerateModalOpen] = useState(false)
  const [regenerateSource, setRegenerateSource] = useState('jd')
  const [employeeOptions, setEmployeeOptions] = useState(defaultJdEmployeeOptions)
  const [employeeLoading, setEmployeeLoading] = useState(false)
  const [employeeError, setEmployeeError] = useState('')

  const departments = useMemo(() => (
    ['全部部门', ...Array.from(new Set(jobsState.map((job) => job.department)))]
  ), [jobsState])

  const filteredJobs = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase()

    return jobsState.filter((job) => {
      const matchesDepartment = departmentFilter === '全部部门' || job.department === departmentFilter
      const searchable = [job.department, job.jobTitle, job.jobLevel, job.location, job.jdSummary].join(' ').toLowerCase()
      return matchesDepartment && (!normalizedQuery || searchable.includes(normalizedQuery))
    })
  }, [departmentFilter, jobsState, searchQuery])

  const openOverview = (job) => {
    setOverviewJob(job)
    setJdFormDraft({
      department: job.department,
      jobTitle: job.jobTitle,
      jobLevel: job.jobLevel,
      location: job.location,
      summary: job.jdOverview.summary,
      responsibilities: job.jdOverview.responsibilities.join('\n'),
      requirements: job.jdOverview.requirements.join('\n'),
      bonus: job.jdOverview.bonus,
      coreCompetencies: job.jdOverview.coreCompetencies,
    })
    setJdMarkdownDrafts((currentDrafts) => (
      currentDrafts[job.id]
        ? currentDrafts
        : { ...currentDrafts, [job.id]: buildJdMarkdown(job) }
    ))
  }

  const openTestQuestions = (job) => {
    setSelectedJob(job)
    setTestFormDraft(job.testQuestions.map((question, index) => ({
      question,
      answer: (testAnswerDrafts[job.id] || [])[index] || '请补充该题的标准答案、评分要点和通过标准。',
    })))
    setTestMarkdownDrafts((currentDrafts) => (
      currentDrafts[job.id]
        ? currentDrafts
        : { ...currentDrafts, [job.id]: buildTestMarkdown(job, testAnswerDrafts) }
    ))
  }

  const overviewMarkdown = overviewJob
    ? jdMarkdownDrafts[overviewJob.id] || buildJdMarkdown(overviewJob)
    : ''

  const testMarkdown = selectedJob
    ? testMarkdownDrafts[selectedJob.id] || buildTestMarkdown(selectedJob, testAnswerDrafts)
    : ''

  const handleSaveOverview = () => {
    if (!overviewJob || !jdFormDraft) return

    const updatedJob = {
      ...overviewJob,
      department: jdFormDraft.department.trim(),
      jobTitle: jdFormDraft.jobTitle.trim(),
      jobLevel: jdFormDraft.jobLevel.trim(),
      location: jdFormDraft.location.trim(),
      jdOverview: {
        ...overviewJob.jdOverview,
        department: jdFormDraft.department.trim(),
        summary: jdFormDraft.summary.trim(),
        responsibilities: jdFormDraft.responsibilities.split('\n').map((item) => item.replace(/^\d+\.\s*/, '').trim()).filter(Boolean),
        requirements: jdFormDraft.requirements.split('\n').map((item) => item.replace(/^\d+\.\s*/, '').trim()).filter(Boolean),
        bonus: jdFormDraft.bonus.trim(),
        coreCompetencies: jdFormDraft.coreCompetencies.trim(),
      },
    }

    setJobsState((current) => current.map((job) => (job.id === updatedJob.id ? updatedJob : job)))
    setOverviewJob(updatedJob)
    setJdMarkdownDrafts((current) => ({ ...current, [updatedJob.id]: buildJdMarkdown(updatedJob) }))
  }

  const handleSaveTestQuestions = () => {
    if (!selectedJob) return

    const updatedJob = {
      ...selectedJob,
      testQuestions: testFormDraft.map((item) => item.question.trim()),
    }
    const updatedAnswers = testFormDraft.map((item) => item.answer.trim())

    setJobsState((current) => current.map((job) => (job.id === updatedJob.id ? updatedJob : job)))
    setSelectedJob(updatedJob)
    setTestAnswerDrafts((current) => ({ ...current, [updatedJob.id]: updatedAnswers }))
    setTestMarkdownDrafts((current) => ({ ...current, [updatedJob.id]: buildTestMarkdown(updatedJob, { ...testAnswerDrafts, [updatedJob.id]: updatedAnswers }) }))
  }

  const openRegenerateModal = async (source = 'jd') => {
    setRegenerateSource(source)
    setIsRegenerateModalOpen(true)
    setEmployeeError('')
    setEmployeeLoading(true)

    try {
      const response = await axios.get(`${API_BASE}/ai-employees/`)
      const employees = Array.isArray(response.data) ? response.data : []
      setEmployeeOptions(employees.length > 0 ? employees : defaultJdEmployeeOptions)
    } catch (error) {
      setEmployeeOptions(defaultJdEmployeeOptions)
      setEmployeeError('暂时无法获取数字员工列表，已提供默认 JD 生成数字员工。')
    } finally {
      setEmployeeLoading(false)
    }
  }

  const handleRegenerateWithEmployee = (employee) => {
    const targetJob = regenerateSource === 'test' ? selectedJob : overviewJob
    if (!targetJob) return

    const message = regenerateSource === 'test'
      ? `请基于以下岗位 JD 和当前笔试题，重新生成一版笔试题及标准答案。要求题目能验证岗位核心能力，标准答案包含评分要点和通过标准。\n\n岗位：${targetJob.jobTitle}\n部门：${targetJob.department}\n职级：${targetJob.jobLevel}\n地点：${targetJob.location}\n\n岗位 JD：\n${buildJdMarkdown(targetJob)}\n\n当前笔试题与标准答案：\n${testMarkdown}`
      : `请基于以下岗位 JD 重新生成一版可发布的 JD，并重点优化岗位描述、职责边界、任职要求分层、加分项和合规表达。\n\n岗位：${targetJob.jobTitle}\n部门：${targetJob.department}\n职级：${targetJob.jobLevel}\n地点：${targetJob.location}\n\n当前 JD：\n${overviewMarkdown}`

    navigate('/chat-workspace', {
      state: {
        activeMember: employee.id,
        message,
      },
    })
  }

  return (
    <div className="flex h-screen bg-white">
      <Sidebar compact />
      <ProjectSideMenu title="人资招聘" subtitle="招聘全流程" items={hrMenuItems} />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-[#f7f7f9]">
        <header className="border-b border-gray-200 bg-white px-8 py-5">
          <div className="flex items-start gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">招聘助手</h1>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-8">
          <section className="mb-5 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-3">
              <select
                value={departmentFilter}
                onChange={(event) => setDepartmentFilter(event.target.value)}
                className="h-10 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 outline-none transition focus:border-[#f0bbb6] focus:ring-4 focus:ring-[#fff1ef]"
              >
                {departments.map((department) => (
                  <option key={department} value={department}>{department}</option>
                ))}
              </select>
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="搜索部门、岗位、地点或 JD 摘要"
                className="h-10 w-[320px] rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 outline-none transition placeholder:text-gray-400 focus:border-[#f0bbb6] focus:ring-4 focus:ring-[#fff1ef]"
              />
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            <table className="w-full min-w-[1080px]">
              <thead className="border-b border-gray-200 bg-gray-50">
                <tr>
                  <th className="px-6 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">部门 / 岗位</th>
                  <th className="px-6 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">JD 概览</th>
                  <th className="px-6 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">笔试题</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredJobs.length === 0 ? (
                  <tr>
                    <td colSpan="3" className="px-6 py-12 text-center text-sm text-gray-500">
                      当前筛选条件下没有岗位 JD
                    </td>
                  </tr>
                ) : (
                  filteredJobs.map((job) => (
                    <tr key={job.id} className="transition-colors hover:bg-gray-50">
                      <td className="px-6 py-4 align-top">
                        <div className="text-sm font-semibold text-gray-900">{job.jobTitle}</div>
                        <div className={`mt-2 text-xs font-semibold ${statusClassMap[job.status] || 'text-gray-600'}`}>
                          {job.status}
                        </div>
                      </td>
                      <td className="px-6 py-4 align-top">
                        <button
                          type="button"
                          onClick={() => openOverview(job)}
                          className="max-w-[360px] text-left text-sm leading-6 text-gray-700 transition hover:text-[#d90808]"
                        >
                          <span className="line-clamp-2">{job.jdSummary}</span>
                          <span className="mt-1 inline-flex text-xs font-medium text-[#d90808]">查看完整概览</span>
                        </button>
                      </td>
                      <td className="px-6 py-4 align-middle">
                        <button
                          type="button"
                          onClick={() => openTestQuestions(job)}
                          className="mt-2 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:border-[#f0bbb6] hover:bg-[#fff7f7] hover:text-[#d90808]"
                        >
                          查看笔试题
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </section>
        </main>
      </div>

      {selectedJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/25 px-6" onClick={() => setSelectedJob(null)}>
          <div className="w-full max-w-[1120px] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4 border-b border-gray-200 px-6 py-5">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">笔试题</h2>
                <p className="mt-1 text-sm text-gray-500">{selectedJob.department} · {selectedJob.jobTitle}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSaveTestQuestions}
                  className="rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:border-[#f0bbb6] hover:bg-[#fff7f7] hover:text-[#d90808]"
                >
                  保存
                </button>
                <button
                  type="button"
                  onClick={() => openRegenerateModal('test')}
                  className="rounded-full bg-[#f40b0b] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#de1010]"
                >
                  重新生成
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedJob(null)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition hover:bg-gray-50"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="max-h-[74vh] overflow-y-auto bg-[#f8fafc] px-6 py-6">
              <div className="space-y-5">
                {testFormDraft.map((item, index) => (
                  <section key={`question-${index}`} className="rounded-2xl border border-gray-200 bg-white p-5">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <h3 className="text-sm font-semibold text-gray-900">笔试题 {index + 1}</h3>
                    </div>
                    <label className="block">
                      <span className="text-xs font-semibold tracking-wide text-gray-500">题目内容</span>
                      <textarea
                        value={item.question}
                        onChange={(event) => setTestFormDraft((current) => current.map((draftItem, draftIndex) => (draftIndex === index ? { ...draftItem, question: event.target.value } : draftItem)))}
                        className="mt-2 min-h-[96px] w-full resize-none rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm leading-6 text-gray-700 outline-none transition focus:border-[#f0bbb6] focus:ring-4 focus:ring-[#fff1ef]"
                      />
                    </label>
                    <label className="mt-4 block">
                      <span className="text-xs font-semibold tracking-wide text-gray-500">标准答案 / 评分要点</span>
                      <textarea
                        value={item.answer}
                        onChange={(event) => setTestFormDraft((current) => current.map((draftItem, draftIndex) => (draftIndex === index ? { ...draftItem, answer: event.target.value } : draftItem)))}
                        className="mt-2 min-h-[132px] w-full resize-none rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm leading-6 text-gray-700 outline-none transition focus:border-[#f0bbb6] focus:ring-4 focus:ring-[#fff1ef]"
                      />
                    </label>
                  </section>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {overviewJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/25 px-6" onClick={() => setOverviewJob(null)}>
          <div className="w-full max-w-[1120px] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4 border-b border-gray-200 px-6 py-5">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">JD 完整概览</h2>
                <p className="mt-1 text-sm text-gray-500">{overviewJob.department} · {overviewJob.jobTitle} · {overviewJob.jobLevel}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSaveOverview}
                  className="rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:border-[#f0bbb6] hover:bg-[#fff7f7] hover:text-[#d90808]"
                >
                  保存
                </button>
                <button
                  type="button"
                  onClick={() => openRegenerateModal('jd')}
                  className="rounded-full bg-[#f40b0b] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#de1010]"
                >
                  重新生成
                </button>
                <button
                  type="button"
                  onClick={() => setOverviewJob(null)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition hover:bg-gray-50"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="max-h-[74vh] overflow-y-auto bg-[#f8fafc] px-6 py-6">
              <div className="space-y-5">
                <section className="rounded-2xl border border-gray-200 bg-white p-5">
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <label className="block">
                      <span className="text-xs font-semibold tracking-wide text-gray-500">部门</span>
                      <input value={jdFormDraft?.department || ''} onChange={(event) => setJdFormDraft((current) => ({ ...current, department: event.target.value }))} className="mt-2 h-11 w-full rounded-xl border border-gray-200 bg-white px-4 text-sm text-gray-700 outline-none transition focus:border-[#f0bbb6] focus:ring-4 focus:ring-[#fff1ef]" />
                    </label>
                    <label className="block">
                      <span className="text-xs font-semibold tracking-wide text-gray-500">岗位</span>
                      <input value={jdFormDraft?.jobTitle || ''} onChange={(event) => setJdFormDraft((current) => ({ ...current, jobTitle: event.target.value }))} className="mt-2 h-11 w-full rounded-xl border border-gray-200 bg-white px-4 text-sm text-gray-700 outline-none transition focus:border-[#f0bbb6] focus:ring-4 focus:ring-[#fff1ef]" />
                    </label>
                    <label className="block">
                      <span className="text-xs font-semibold tracking-wide text-gray-500">职级</span>
                      <input value={jdFormDraft?.jobLevel || ''} onChange={(event) => setJdFormDraft((current) => ({ ...current, jobLevel: event.target.value }))} className="mt-2 h-11 w-full rounded-xl border border-gray-200 bg-white px-4 text-sm text-gray-700 outline-none transition focus:border-[#f0bbb6] focus:ring-4 focus:ring-[#fff1ef]" />
                    </label>
                    <label className="block">
                      <span className="text-xs font-semibold tracking-wide text-gray-500">地点</span>
                      <input value={jdFormDraft?.location || ''} onChange={(event) => setJdFormDraft((current) => ({ ...current, location: event.target.value }))} className="mt-2 h-11 w-full rounded-xl border border-gray-200 bg-white px-4 text-sm text-gray-700 outline-none transition focus:border-[#f0bbb6] focus:ring-4 focus:ring-[#fff1ef]" />
                    </label>
                  </div>
                </section>

                <section className="rounded-2xl border border-gray-200 bg-white p-5">
                  <label className="block">
                    <span className="text-xs font-semibold tracking-wide text-gray-500">岗位概述</span>
                    <textarea value={jdFormDraft?.summary || ''} onChange={(event) => setJdFormDraft((current) => ({ ...current, summary: event.target.value }))} className="mt-2 min-h-[120px] w-full resize-none rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm leading-6 text-gray-700 outline-none transition focus:border-[#f0bbb6] focus:ring-4 focus:ring-[#fff1ef]" />
                  </label>
                </section>

                <section className="rounded-2xl border border-gray-200 bg-white p-5">
                  <span className="text-xs font-semibold tracking-wide text-gray-500">岗位职责</span>
                  <textarea
                    value={jdFormDraft?.responsibilities || ''}
                    onChange={(event) => setJdFormDraft((current) => ({ ...current, responsibilities: event.target.value }))}
                    className="mt-3 min-h-[220px] w-full resize-none rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm leading-7 text-gray-700 outline-none transition focus:border-[#f0bbb6] focus:ring-4 focus:ring-[#fff1ef]"
                  />
                </section>

                <section className="rounded-2xl border border-gray-200 bg-white p-5">
                  <span className="text-xs font-semibold tracking-wide text-gray-500">任职要求</span>
                  <textarea
                    value={jdFormDraft?.requirements || ''}
                    onChange={(event) => setJdFormDraft((current) => ({ ...current, requirements: event.target.value }))}
                    className="mt-3 min-h-[220px] w-full resize-none rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm leading-7 text-gray-700 outline-none transition focus:border-[#f0bbb6] focus:ring-4 focus:ring-[#fff1ef]"
                  />
                </section>

                <section className="rounded-2xl border border-gray-200 bg-white p-5">
                  <label className="block">
                    <span className="text-xs font-semibold tracking-wide text-gray-500">加分项</span>
                    <textarea value={jdFormDraft?.bonus || ''} onChange={(event) => setJdFormDraft((current) => ({ ...current, bonus: event.target.value }))} className="mt-2 min-h-[110px] w-full resize-none rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm leading-6 text-gray-700 outline-none transition focus:border-[#f0bbb6] focus:ring-4 focus:ring-[#fff1ef]" />
                  </label>
                  <label className="mt-4 block">
                    <span className="text-xs font-semibold tracking-wide text-gray-500">核心能力</span>
                    <textarea value={jdFormDraft?.coreCompetencies || ''} onChange={(event) => setJdFormDraft((current) => ({ ...current, coreCompetencies: event.target.value }))} className="mt-2 min-h-[96px] w-full resize-none rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm leading-6 text-gray-700 outline-none transition focus:border-[#f0bbb6] focus:ring-4 focus:ring-[#fff1ef]" />
                  </label>
                </section>
              </div>
            </div>
          </div>
        </div>
      )}

      {isRegenerateModalOpen && (overviewJob || selectedJob) && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/30 px-6" onClick={() => setIsRegenerateModalOpen(false)}>
          <div className="w-full max-w-[560px] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4 border-b border-gray-200 px-6 py-5">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">选择数字员工</h2>
                <p className="mt-1 text-sm text-gray-500">
                  将当前{regenerateSource === 'test' ? '笔试题' : 'JD'}发送给指定数字员工重新生成，进入工作区后仍可切换员工。
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsRegenerateModalOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition hover:bg-gray-50"
              >
                ×
              </button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto px-6 py-5">
              {employeeError && (
                <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-700">
                  {employeeError}
                </div>
              )}

              {employeeLoading ? (
                <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
                  正在加载数字员工...
                </div>
              ) : (
                <div className="space-y-3">
                  {employeeOptions.map((employee) => (
                    <button
                      key={employee.id}
                      type="button"
                      onClick={() => handleRegenerateWithEmployee(employee)}
                      className="w-full rounded-xl border border-gray-200 bg-white px-4 py-4 text-left transition hover:border-[#f0bbb6] hover:bg-[#fff7f7]"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-gray-900">{employee.name || '未命名数字员工'}</div>
                          <div className="mt-1 text-xs text-gray-500">{employee.role_title || '数字员工'}</div>
                        </div>
                        <span className="shrink-0 text-xs font-medium text-[#d90808]">选择并跳转</span>
                      </div>
                      {employee.persona_prompt && (
                        <div className="mt-2 line-clamp-2 text-xs leading-5 text-gray-500">{employee.persona_prompt}</div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default RecruitmentAssistant