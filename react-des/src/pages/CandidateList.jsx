import React, { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import ProjectSideMenu from '../components/ProjectSideMenu'

const hrMenuItems = [
  { label: '岗位需求', route: '/recruitment-assistant' },
  { label: '简历筛选', route: '/candidate-list' },
]

const candidateRows = [
  {
    id: 'candidate-lin-chen',
    name: '林辰',
    department: '技术平台部',
    jobTitle: '高级后端开发工程师',
    currentCompany: '云澜科技',
    currentRole: '后端开发专家',
    years: '6 年',
    education: '本科 / 上海交通大学',
    phone: '138 0186 2031',
    email: 'linchen@example.com',
    resumeStatus: '通过',
    resumeScore: 91,
    conclusion: '优先推荐',
    processStatus: '待确认邀约',
    jdSummary: '负责高并发交易链路、服务治理与核心模块开发，要求 Java、Spring Cloud、MySQL、Redis 与分布式系统经验。',
    resumePreview: '最近两段经历均围绕交易、订单和支付链路建设，主导过 Spring Cloud 微服务拆分、Redis 缓存治理和 MySQL 慢查询优化。项目结果描述清晰，稳定性治理经验与岗位高度匹配。',
    passReasons: ['Java / Spring Cloud 匹配', '高并发交易系统经验', 'Redis 与 MySQL 深度使用', '项目成果量化清晰'],
    risks: ['需验证支付资金链路深度', '管理经验偏弱'],
    interviewQuestions: [
      '请结合最近一次交易系统项目，说明订单状态流转、幂等处理和异常补偿方案。',
      '如果支付回调在高峰期出现延迟和重复通知，你会如何设计监控、重试和一致性保障？',
      '请说明 Redis 缓存穿透、击穿、雪崩的区别，并结合你的项目讲一个真实治理案例。',
    ],
    writtenTest: {
      status: '已完成',
      totalScore: 86,
      submittedAt: '2026-06-09 10:36',
      qa: [
        {
          question: '请设计一个订单状态流转服务，说明状态机、幂等处理和异常补偿方案。',
          answer: '候选人使用待支付、已支付、履约中、已完成、已取消、退款中等状态建模，通过状态机限制非法流转；用业务唯一键和去重表做幂等，异常通过事务日志、补偿任务和消息重试恢复。',
          score: 31,
          maxScore: 35,
          rationale: '覆盖了状态机、幂等和补偿任务，能说明核心工程手段；一致性边界和灰度策略展开不足。',
        },
        {
          question: '给定一段慢 SQL，分析可能原因并提出索引和查询改写建议。',
          answer: '先看执行计划、扫描行数、索引命中和回表情况，再根据 where 条件建立联合索引，避免函数计算和隐式转换，必要时拆分查询。',
          score: 27,
          maxScore: 30,
          rationale: '定位路径清晰，索引和查询改写建议有效；对分页深度和统计信息更新提及较少。',
        },
        {
          question: '说明 Redis 缓存穿透、击穿、雪崩的区别及工程治理方案。',
          answer: '穿透用空值缓存和布隆过滤器，击穿用互斥锁、逻辑过期，雪崩用过期时间随机化、多级缓存和限流降级。',
          score: 28,
          maxScore: 35,
          rationale: '概念区分准确，治理手段完整；缺少结合业务场景的容量评估和监控指标。',
        },
      ],
    },
    phoneCall: {
      status: '已接通',
      calledAt: '2026-06-09 14:20',
      duration: '12 分 36 秒',
      recording: '电话沟通_林辰_20260609_1420.mp3',
      transcript: [
        { speaker: 'HR', text: '你好，想和你确认一下后端岗位的意向、到岗时间和当前面试进展。' },
        { speaker: '候选人', text: '岗位方向比较匹配，我目前更关注交易链路复杂度和团队技术氛围，最快 3 周左右可以到岗。' },
        { speaker: 'HR', text: '你最近主要负责订单和支付链路，是否愿意继续做高并发交易系统方向？' },
        { speaker: '候选人', text: '愿意，这也是我最近两年主要做的方向，希望能接触更完整的稳定性治理和架构设计。' },
      ],
    },
    interview: {
      status: '已面试',
      round: '一面',
      interviewedAt: '2026-06-09 16:30',
      score: 88,
      report: '候选人在交易系统设计、幂等处理和缓存治理方面表现较强，能结合真实项目说明方案取舍。对团队管理经验表达较少，建议二面重点验证跨团队推动和复杂故障复盘能力。',
      scoringAgent: '面试评分 Agent',
      dimensions: [
        { name: '岗位匹配度', score: 90, rationale: '核心交易、订单、支付经验与 JD 高度匹配。' },
        { name: '技术深度', score: 87, rationale: '能说明状态机、缓存治理和 SQL 优化，但一致性边界可继续追问。' },
        { name: '表达结构', score: 86, rationale: '表达清楚，能按背景、动作、结果展开。' },
      ],
    },
    recordings: [],
  },
  {
    id: 'candidate-wang-yue',
    name: '王悦',
    department: '数据智能部',
    jobTitle: '商业数据分析师',
    currentCompany: '星河 SaaS',
    currentRole: '数据分析师',
    years: '4 年',
    education: '硕士 / 中国人民大学',
    phone: '139 1028 6625',
    email: 'wangyue@example.com',
    resumeStatus: '通过',
    resumeScore: 86,
    conclusion: '优先推荐',
    processStatus: '待确认邀约',
    jdSummary: '面向经营分析、指标体系和专题洞察，要求 SQL、BI 看板、业务拆解与跨团队沟通能力。',
    resumePreview: '具备销售漏斗、留存分析和经营看板建设经验，SQL 与指标拆解能力稳定，曾独立支持销售运营团队完成季度转化率提升专题。',
    passReasons: ['SQL 能力强', '经营分析经验匹配', '看板搭建经验完整', '跨团队沟通案例明确'],
    risks: ['需要验证复杂业务归因能力'],
    interviewQuestions: [
      '如果 DAU 连续两周下跌 12%，请拆解你会如何定位问题。',
      '请说明你会如何设计销售漏斗看板，并定义异常预警规则。',
      '给定订单表和用户表，请描述近 30 日复购率的计算口径和 SQL 思路。',
    ],
    writtenTest: {
      status: '已完成',
      totalScore: 82,
      submittedAt: '2026-06-08 18:12',
      qa: [
        {
          question: '请基于 DAU 下跌 12% 的现象，拆解可能原因并设计验证路径。',
          answer: '先拆新增、留存、召回和活跃频次，再按渠道、版本、地区和用户分层定位差异，结合发布变更与埋点口径排查。',
          score: 29,
          maxScore: 35,
          rationale: '拆解框架完整，验证路径合理；对行动优先级和业务 owner 分工略弱。',
        },
        {
          question: '写 SQL 计算近 30 日复购率，并说明口径。',
          answer: '近 30 日内有效订单用户中，下单次数大于等于 2 的用户占比；SQL 先过滤有效订单，再按 user_id 聚合。',
          score: 25,
          maxScore: 30,
          rationale: '口径清楚，聚合逻辑正确；异常订单、退款订单处理说明不够完整。',
        },
        {
          question: '请设计一个销售漏斗看板，说明核心指标、维度和异常预警规则。',
          answer: '看板覆盖线索、商机、报价、成交和回款，指标包括转化率、停留时长、流失原因和负责人维度，异常用环比波动和超期未推进预警。',
          score: 28,
          maxScore: 35,
          rationale: '指标和维度覆盖较好；对高价值商机流失和预警阈值的量化说明还可加强。',
        },
      ],
    },
    phoneCall: {
      status: '未接通',
      calledAt: '2026-06-09 11:12',
      duration: '0 秒',
      recording: null,
      transcript: [],
    },
    interview: {
      status: '已确认面试',
      round: '一面',
      scheduledAt: '2026-06-10 15:00',
      scoringAgent: '面试评分 Agent',
      dimensions: [],
    },
    recordings: ['电话沟通_王悦_20260608_1420.mp3'],
  },
  {
    id: 'candidate-zhao-min',
    name: '赵敏',
    department: '产品部',
    jobTitle: '高级产品经理',
    currentCompany: '北辰智能',
    currentRole: '产品经理',
    years: '5 年',
    education: '本科 / 浙江大学',
    phone: '136 7782 1904',
    email: 'zhaomin@example.com',
    resumeStatus: '待复核',
    resumeScore: 74,
    conclusion: '待人工复核',
    processStatus: '待复核',
    jdSummary: '负责核心产品线规划、需求分析、跨团队推进和指标复盘，要求 SaaS 或 AI 产品经验。',
    resumePreview: '具备 B 端产品经验和项目推进经验，但 AI 产品深度不足，部分项目成果描述偏泛，需要通过沟通确认业务拆解和指标闭环能力。',
    passReasons: ['B 端产品经验', '跨团队推进经验', 'PRD 与项目管理经验完整'],
    risks: ['AI 产品经验不足', '成果指标描述不够具体'],
    interviewQuestions: [
      '请拆解一个你负责过的 B 端产品从需求发现到上线复盘的完整过程。',
      '如果要设计一个 AI 招聘助手的候选人筛选工作台，你会如何定义最小闭环？',
      '请说明你如何判断一个功能需求是否应该进入当前版本。',
    ],
    writtenTest: null,
    phoneCall: {
      status: '已打电话',
      calledAt: '2026-06-09 09:50',
      duration: '32 秒',
      recording: '电话沟通_赵敏_20260609_0950.mp3',
      transcript: [],
    },
    interview: {
      status: '待确认',
      round: '一面',
      scoringAgent: '面试评分 Agent',
      dimensions: [],
    },
    recordings: [],
  },
  {
    id: 'candidate-liu-yang',
    name: '刘洋',
    department: '技术平台部',
    jobTitle: '高级后端开发工程师',
    currentCompany: '青舟电商',
    currentRole: 'Java 工程师',
    years: '3 年',
    education: '本科 / 南京邮电大学',
    phone: '137 2281 0546',
    email: 'liuyang@example.com',
    resumeStatus: '未通过',
    resumeScore: 58,
    conclusion: '不建议推进',
    processStatus: '暂不推进',
    jdSummary: '负责高并发交易链路、服务治理与核心模块开发，要求 Java、Spring Cloud、MySQL、Redis 与分布式系统经验。',
    resumePreview: 'Java 基础开发经验符合，但年限不足，复杂交易系统和服务治理经验较弱，项目多为业务 CRUD 和接口联调。',
    passReasons: ['Java 基础匹配', '有电商业务接触'],
    risks: ['年限不足', '高并发经验不足', '服务治理经验弱'],
    interviewQuestions: [
      '请说明你参与过的订单模块中最复杂的问题是什么，以及你如何定位。',
      '你如何理解接口幂等，实际项目中用过哪些方案？',
      '请描述一次 MySQL 慢查询优化经历。',
    ],
    writtenTest: null,
    phoneCall: {
      status: '未接通',
      calledAt: '2026-06-09 10:05',
      duration: '0 秒',
      recording: null,
      transcript: [],
    },
    interview: {
      status: '未邀约',
      round: '一面',
      scoringAgent: '面试评分 Agent',
      dimensions: [],
    },
    recordings: [],
  },
  {
    id: 'candidate-chen-xi',
    name: '陈熙',
    department: '数据智能部',
    jobTitle: '商业数据分析师',
    currentCompany: '曜石增长',
    currentRole: '高级数据分析师',
    years: '5 年',
    education: '本科 / 华东师范大学',
    phone: '135 6601 2488',
    email: 'chenxi@example.com',
    resumeStatus: '通过',
    resumeScore: 84,
    conclusion: '优先推荐',
    processStatus: '待确认邀约',
    jdSummary: '面向经营分析、指标体系和专题洞察，要求 SQL、BI 看板、业务拆解与跨团队沟通能力。',
    resumePreview: '有经营分析与销售转化专题经验，擅长看板搭建和异常归因，分析表达较清晰。',
    passReasons: ['经营分析经验匹配', 'SQL 与看板能力稳定', '跨团队协作经验明确'],
    risks: ['需验证复杂归因方法', '行业迁移成本待确认'],
    interviewQuestions: [
      '请拆解一次核心经营指标异常波动的分析路径。',
      '如果需要重构管理层看板，你会如何取舍指标层级？',
      '如何判断一项专题分析真正推动了业务决策？',
    ],
    writtenTest: null,
    phoneCall: null,
    interview: {
      status: '未邀约',
      round: '一面',
      scoringAgent: '面试评分 Agent',
      dimensions: [],
    },
    recordings: [],
  },
  {
    id: 'candidate-he-jing',
    name: '何静',
    department: '产品部',
    jobTitle: '高级产品经理',
    currentCompany: '云岚协同',
    currentRole: 'B 端产品负责人',
    years: '6 年',
    education: '硕士 / 中山大学',
    phone: '139 8854 3077',
    email: 'hejing@example.com',
    resumeStatus: '通过',
    resumeScore: 81,
    conclusion: '优先推荐',
    processStatus: '已邀约笔试',
    jdSummary: '负责核心产品线规划、需求分析、跨团队推进和指标复盘，要求 SaaS 或 AI 产品经验。',
    resumePreview: '长期负责中后台与协同类产品，具备复杂流程设计和跨团队推动经验。',
    passReasons: ['复杂流程产品经验', 'B 端项目管理成熟', '跨团队推动案例丰富'],
    risks: ['AI 场景经验一般', '技术深度需通过笔试验证'],
    interviewQuestions: [
      '请说明你如何定义一个复杂流程产品的关键成功指标。',
      '如果研发资源受限，你会如何收敛版本范围？',
      '请分享一次需求争议下的推进案例。',
    ],
    writtenTest: {
      status: '已邀约',
      totalScore: null,
      submittedAt: null,
      qa: [],
    },
    phoneCall: null,
    interview: {
      status: '未邀约',
      round: '一面',
      scoringAgent: '面试评分 Agent',
      dimensions: [],
    },
    recordings: [],
  },
  {
    id: 'candidate-sun-hao',
    name: '孙浩',
    department: '技术平台部',
    jobTitle: '高级后端开发工程师',
    currentCompany: '极简支付',
    currentRole: '服务端工程师',
    years: '5 年',
    education: '本科 / 北京邮电大学',
    phone: '136 0092 4781',
    email: 'sunhao@example.com',
    resumeStatus: '通过',
    resumeScore: 79,
    conclusion: '优先推荐',
    processStatus: '待电话沟通',
    jdSummary: '负责高并发交易链路、服务治理与核心模块开发，要求 Java、Spring Cloud、MySQL、Redis 与分布式系统经验。',
    resumePreview: '有支付链路与缓存治理经验，工程基础较稳，适合通过电话沟通先确认复杂场景经历。',
    passReasons: ['支付链路经验', 'Java 与 Redis 匹配', '性能优化案例明确'],
    risks: ['分布式事务经验待确认', '稳定性治理深度需验证'],
    interviewQuestions: [
      '请说明一次线上故障排查与恢复过程。',
      '你如何设计订单服务的幂等机制？',
      '缓存与数据库不一致时你如何处理？',
    ],
    writtenTest: {
      status: '已完成',
      totalScore: 76,
      submittedAt: '2026-06-09 13:10',
      qa: [
        {
          question: '请说明分布式事务常见处理方案。',
          answer: '可以用本地消息表、TCC 和最终一致性方案处理，根据业务场景选择。',
          score: 24,
          maxScore: 35,
          rationale: '回答覆盖常见方案，但缺少具体取舍和失败恢复细节。',
        },
        {
          question: '请分析一次典型慢 SQL 排查过程。',
          answer: '先看执行计划和索引命中，再结合扫描行数、排序和回表情况优化。',
          score: 26,
          maxScore: 30,
          rationale: '排查思路正确，细节较完整。',
        },
        {
          question: '请说明缓存雪崩与击穿的处理方式。',
          answer: '通过随机过期、热点预热和限流降级避免雪崩，击穿可用互斥锁和逻辑过期。',
          score: 26,
          maxScore: 35,
          rationale: '概念和方法基本准确，但缺少业务场景展开。',
        },
      ],
    },
    phoneCall: {
      status: '待电话沟通',
      calledAt: null,
      duration: null,
      recording: null,
      transcript: [],
    },
    interview: {
      status: '未邀约',
      round: '一面',
      scoringAgent: '面试评分 Agent',
      dimensions: [],
    },
    recordings: [],
  },
  {
    id: 'candidate-guo-jia',
    name: '郭佳',
    department: '人力资源部',
    jobTitle: 'HRBP',
    currentCompany: '知行科技',
    currentRole: '招聘 HRBP',
    years: '4 年',
    education: '本科 / 华南师范大学',
    phone: '138 7720 6619',
    email: 'guojia@example.com',
    resumeStatus: '通过',
    resumeScore: 77,
    conclusion: '待人工复核',
    processStatus: '待电话沟通',
    jdSummary: '支持业务团队组织诊断、绩效协同、人才盘点与招聘推进，要求业务理解、沟通影响和项目推动能力。',
    resumePreview: '有招聘和 HRBP 双重经验，能够推进用人经理协同，但组织诊断深度略弱。',
    passReasons: ['招聘推进经验完整', '用人经理协同经验明确', '项目推进能力较强'],
    risks: ['组织诊断经验有限', '人才盘点经验待确认'],
    interviewQuestions: [
      '请设计一次用人经理协同效率提升方案。',
      '如何判断岗位画像是否需要重新收敛？',
      '请分享一次 offer 沟通中的疑难案例。',
    ],
    writtenTest: {
      status: '已完成',
      totalScore: 73,
      submittedAt: '2026-06-09 12:20',
      qa: [
        {
          question: '请设计组织诊断访谈方案。',
          answer: '从业务负责人、核心员工和协作团队多角色访谈，提炼组织问题与改进建议。',
          score: 25,
          maxScore: 35,
          rationale: '框架完整，但诊断维度较宽泛。',
        },
        {
          question: '如何收敛岗位画像？',
          answer: '先明确核心产出，再区分必备项和加分项，对齐预算和业务阶段。',
          score: 24,
          maxScore: 30,
          rationale: '回答较贴合业务，但案例支撑不足。',
        },
        {
          question: '请说明候选人犹豫 offer 的推进策略。',
          answer: '先识别犹豫原因，再联合招聘和业务负责人提供针对性沟通材料。',
          score: 24,
          maxScore: 35,
          rationale: '基本思路正确，可再补充风险控制。',
        },
      ],
    },
    phoneCall: {
      status: '待电话沟通',
      calledAt: null,
      duration: null,
      recording: null,
      transcript: [],
    },
    interview: {
      status: '未邀约',
      round: '一面',
      scoringAgent: '面试评分 Agent',
      dimensions: [],
    },
    recordings: [],
  },
  {
    id: 'candidate-tan-yu',
    name: '谭宇',
    department: '产品部',
    jobTitle: '高级产品经理',
    currentCompany: '深图云协作',
    currentRole: '产品负责人',
    years: '7 年',
    education: '本科 / 武汉大学',
    phone: '137 6614 8205',
    email: 'tanyu@example.com',
    resumeStatus: '通过',
    resumeScore: 83,
    conclusion: '优先推荐',
    processStatus: '待确认面试',
    jdSummary: '负责核心产品线规划、需求分析、跨团队推进和指标复盘，要求 SaaS 或 AI 产品经验。',
    resumePreview: '有中后台协同产品和复杂工作流产品经验，电话沟通反馈岗位匹配度较高，适合进入面试邀约阶段。',
    passReasons: ['复杂流程产品经验', '跨团队协作成熟', '业务沟通表达清晰'],
    risks: ['AI 产品经验需要面试继续确认', '增长类指标闭环案例需追问'],
    interviewQuestions: [],
    writtenTest: {
      status: '已完成',
      totalScore: 80,
      submittedAt: '2026-06-09 11:45',
      qa: [
        {
          question: '请说明你如何判断一个复杂流程功能是否应该进入当前版本。',
          answer: '会先看目标用户、业务收益和依赖成本，再评估不做的风险和上线后的验证方式。',
          score: 27,
          maxScore: 35,
          rationale: '有版本取舍意识，但优先级框架还可以更结构化。',
        },
        {
          question: '请描述一次跨团队推进受阻时的处理过程。',
          answer: '先统一目标和边界，再拆分责任人与时间点，通过节奏同步减少反复沟通。',
          score: 26,
          maxScore: 30,
          rationale: '推进思路清楚，缺少更具体的冲突处理细节。',
        },
        {
          question: '如果核心漏斗转化下降，你会如何拆解问题。',
          answer: '先按环节和人群拆转化率，再结合版本、渠道和埋点核对定位主要影响因素。',
          score: 27,
          maxScore: 35,
          rationale: '分析框架完整，验证优先级还能更清晰。',
        },
      ],
    },
    phoneCall: {
      status: '已接通',
      calledAt: '2026-06-09 15:10',
      duration: '8 分 14 秒',
      recording: '电话沟通_谭宇_20260609_1510.mp3',
      transcript: [
        { speaker: 'HR', text: '这边想进一步确认你的岗位意向和近期看机会的重点。' },
        { speaker: '候选人', text: '我主要关注复杂协同产品和更完整的业务闭环，希望进入下一轮详细聊。' },
      ],
    },
    interview: {
      status: '未邀约',
      round: '一面',
      scoringAgent: '面试评分 Agent',
      dimensions: [],
    },
    recordings: ['电话沟通_谭宇_20260609_1510.mp3'],
  },
]

const statusClassMap = {
  通过: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  待复核: 'bg-amber-50 text-amber-700 border-amber-200',
  未通过: 'bg-gray-50 text-gray-600 border-gray-200',
}

const conclusionClassMap = {
  优先推荐: 'text-emerald-700',
  待人工复核: 'text-amber-700',
  不建议推进: 'text-gray-500',
}

const inviteTypeOptions = [
  { key: 'written', label: '笔试', confirmLabel: '确认发送笔试邀约', status: '已邀约笔试', path: 'written-test' },
  { key: 'phone', label: '电话', confirmLabel: '确认发送电话沟通邀约', status: '已邀约电话沟通', path: 'phone-call' },
  { key: 'video', label: '视频', confirmLabel: '确认发送视频面试邀约', status: '已邀约视频面试', path: 'video-interview' },
]

const scoreClassName = (score) => {
  if (score >= 85) return 'text-emerald-700'
  if (score >= 70) return 'text-amber-700'
  return 'text-gray-500'
}

const formatFileSize = (size = 0) => {
  if (size >= 1024 * 1024) {
    return `${(size / (1024 * 1024)).toFixed(1)} MB`
  }

  if (size >= 1024) {
    return `${Math.round(size / 1024)} KB`
  }

  return `${size} B`
}

const getFileType = (fileName = '') => {
  const extension = fileName.split('.').pop()?.toUpperCase()
  return extension || 'FILE'
}

const smartInviteAgentOptions = {
  written: [
    { value: 'written-test-agent', label: '笔试邀约数字员工' },
    { value: 'assessment-coordinator-agent', label: '测评协调数字员工' },
  ],
  phone: [
    { value: 'phone-screening-agent', label: '电话沟通数字员工' },
    { value: 'candidate-outreach-agent', label: '候选人外呼数字员工' },
  ],
  video: [
    { value: 'interview-question-agent', label: '视频面试数字员工' },
    { value: 'interview-scheduler-agent', label: '面试安排数字员工' },
  ],
}

const PhoneActionIcon = () => (
  <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="h-3.5 w-3.5">
    <path d="M6.3 2.9h2.1c.4 0 .8.3.9.7l.6 2.4a1 1 0 0 1-.3.98l-1.2 1.04a11.2 11.2 0 0 0 3.54 3.54l1.04-1.2a1 1 0 0 1 .98-.3l2.4.6c.4.1.7.5.7.9v2.1c0 .53-.42.96-.95 1A13.8 13.8 0 0 1 3.35 3.85c.04-.53.47-.95 1-.95Z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)

const buildInterviewQuestionsByJd = (jobTitle) => ([
  `请结合你过往经历，说明你为什么适合 ${jobTitle} 这个岗位。`,
  `如果入职后负责 ${jobTitle} 的核心工作，你会如何在前 30 天快速建立认知和推进计划？`,
  `请举一个与你应聘岗位最相关的项目案例，说明你的具体职责、结果和复盘。`,
])

const buildCandidateFromResumeUpload = (file, jdOption, index) => {
  const rawName = file.name.replace(/\.[^.]+$/, '').trim()
  const candidateName = rawName.replace(/简历$/u, '').trim() || `候选人${index + 1}`
  const timestamp = Date.now() + index

  return {
    id: `uploaded-${timestamp}`,
    name: candidateName,
    department: jdOption.department,
    jobTitle: jdOption.jobTitle,
    currentCompany: '待识别',
    currentRole: '待识别',
    years: '待识别',
    education: '待识别',
    phone: '待补充',
    email: '待补充',
    resumeStatus: '待复核',
    resumeScore: 72,
    conclusion: '待人工复核',
    processStatus: '待确认邀约',
    jdSummary: jdOption.jdSummary,
    resumePreview: `已上传 ${jdOption.jobTitle} 对应简历文件《${file.name}》，待 AI 完成结构化解析与岗位匹配评估。`,
    passReasons: ['已上传原始简历', '已关联目标 JD', '待结构化解析'],
    risks: ['待识别候选人联系方式', '待校验核心项目经历'],
    interviewQuestions: buildInterviewQuestionsByJd(jdOption.jobTitle),
    writtenTest: null,
    phoneCall: {
      status: '待电话沟通',
      calledAt: '-',
      duration: '-',
      recording: null,
      transcript: [],
    },
    interview: {
      status: '未邀约',
      round: '一面',
      scoringAgent: '面试评分 Agent',
      dimensions: [],
    },
    recordings: [],
  }
}

const buildStructuredResume = (candidate) => ({
  target: `${candidate.department} / ${candidate.jobTitle}`,
  summary: candidate.resumePreview,
  skills: candidate.passReasons,
  workExperience: [
    {
      company: candidate.currentCompany,
      role: candidate.currentRole,
      period: `近 ${candidate.years}`,
      details: [
        candidate.resumePreview,
        `与目标岗位匹配项：${candidate.passReasons.join('、')}。`,
      ],
    },
  ],
  projects: candidate.interviewQuestions.slice(0, 2).map((question, index) => ({
    name: index === 0 ? '核心岗位相关项目' : '能力验证项目',
    description: question.replace('请', '').replace('？', '。'),
  })),
})

const buildInviteLink = (candidate, type) => {
  const inviteType = inviteTypeOptions.find((option) => option.key === type) || inviteTypeOptions[0]
  return `https://workmate.example.com/recruitment/${inviteType.path}/${candidate.id}`
}

const getProcessStatus = (candidate) => {
  if (candidate.conclusion === '不建议推进' || candidate.resumeStatus === '未通过') {
    return '暂不推进'
  }

  if (candidate.interview?.status === '已面试') {
    return '已完成面试'
  }

  if (candidate.interview?.status === '已确认面试') {
    return '待面试'
  }

  if (candidate.interview?.status === '待确认') {
    return '待确认面试'
  }

  if (candidate.phoneCall?.status === '已接通') {
    return '电话沟通完成'
  }

  if (candidate.phoneCall?.status === '已打电话') {
    return '电话初筛中'
  }

  if (candidate.phoneCall?.status === '待电话沟通') {
    return '待电话沟通'
  }

  if (candidate.writtenTest?.status === '已完成') {
    return '笔试完成'
  }

  if (candidate.writtenTest?.status === '已邀约') {
    return '已邀约笔试'
  }

  if (candidate.conclusion === '待人工复核' || candidate.resumeStatus === '待复核') {
    return '待复核'
  }

  return '待确认邀约'
}

const buildCandidateSearchText = (candidate) => ([
  candidate.name,
  candidate.department,
  candidate.jobTitle,
  candidate.currentCompany,
  candidate.currentRole,
  candidate.conclusion,
  candidate.resumeStatus,
  getProcessStatus(candidate),
].join(' ').toLowerCase())

const selectionStopWords = ['选择', '筛选', '候选人', '候选', '帮我', '一下', '的', '并且', '以及', '还有', '里', '中', '给我']

const parseSelectionTokens = (query) => (
  query
    .toLowerCase()
    .split(/[\s,，。；;、]+/)
    .map((token) => token.trim())
    .filter(Boolean)
    .filter((token) => !selectionStopWords.includes(token))
)

const getPrimaryProgressAction = (candidate) => {
  if (candidate.conclusion === '不建议推进' || candidate.resumeStatus === '未通过') {
    return {
      summary: '流程已暂停',
      actionLabel: '暂不推进',
      actionTone: 'muted',
      actionKey: null,
    }
  }

  if (candidate.interview?.status === '已面试') {
    return {
      summary: '流程已完成',
      actionLabel: '查看结果',
      actionTone: 'success',
      actionKey: 'viewInterviewReport',
    }
  }

  if (candidate.interview?.status === '已确认面试') {
    return {
      summary: '下一步：进行面试',
      actionLabel: '即将面试',
      actionTone: 'primary',
      actionKey: 'viewInterviewQuestions',
    }
  }

  if (candidate.phoneCall?.status === '已接通') {
    return {
      summary: '下一步：安排面试',
      actionLabel: '邀约面试',
      actionTone: 'default',
      actionKey: 'inviteInterview',
    }
  }

  if (candidate.phoneCall?.status === '已打电话' || candidate.phoneCall?.status === '未接通') {
    return {
      summary: `当前：${candidate.phoneCall.status}`,
      actionLabel: '继续拨打',
      actionTone: candidate.phoneCall.status === '未接通' ? 'warning' : 'primary',
      actionKey: 'startPhoneCall',
    }
  }

  if (candidate.phoneCall?.status === '待电话沟通' || candidate.writtenTest?.status === '已完成') {
    return {
      summary: '下一步：电话沟通',
      actionLabel: '电话沟通',
      actionTone: 'default',
      actionKey: 'startPhoneCall',
    }
  }

  if (candidate.writtenTest?.status === '已邀约') {
    return {
      summary: '当前：等待笔试完成',
      actionLabel: '待完成',
      actionTone: 'muted',
      actionKey: null,
    }
  }

  return {
    summary: '下一步：发送笔试',
    actionLabel: '邀约笔试',
    actionTone: 'default',
    actionKey: 'inviteWrittenTest',
  }
}

const hasCandidateResults = (candidate) => (
  candidate.writtenTest?.status === '已完成'
  || (candidate.phoneCall?.status && candidate.phoneCall.status !== '待电话沟通')
  || candidate.interview?.status === '已面试'
)

const getCandidateResultTabs = (candidate) => {
  const tabs = []

  if (candidate?.writtenTest?.status === '已完成') {
    tabs.push({ key: 'written', label: '笔试' })
  }

  if (candidate?.phoneCall?.status && candidate.phoneCall.status !== '待电话沟通') {
    tabs.push({ key: 'phone', label: '电话' })
  }

  if (candidate?.interview?.status === '已面试') {
    tabs.push({ key: 'interview', label: '面试' })
  }

  return tabs
}

const CandidateList = () => {
  const navigate = useNavigate()
  const [departmentFilter, setDepartmentFilter] = useState('全部部门')
  const [jobFilter, setJobFilter] = useState('全部岗位')
  const [statusFilter, setStatusFilter] = useState('全部状态')
  const [selectionQuery, setSelectionQuery] = useState('')
  const [smartFilterQuery, setSmartFilterQuery] = useState('')
  const [selectionFeedback, setSelectionFeedback] = useState('')
  const [selectedCandidate, setSelectedCandidate] = useState(null)
  const [resultCandidate, setResultCandidate] = useState(null)
  const [activeResultTab, setActiveResultTab] = useState('written')
  const [inviteModal, setInviteModal] = useState(null)
  const [smartInviteOpen, setSmartInviteOpen] = useState(false)
  const [callModalCandidate, setCallModalCandidate] = useState(null)
  const [questionCandidate, setQuestionCandidate] = useState(null)
  const [questionDrafts, setQuestionDrafts] = useState([])
  const [candidateState, setCandidateState] = useState(candidateRows)
  const [createResumeOpen, setCreateResumeOpen] = useState(false)
  const [resumeUploadForm, setResumeUploadForm] = useState({
    jdKey: '',
    files: [],
  })
  const [smartInviteConfig, setSmartInviteConfig] = useState({
    written: true,
    phone: true,
    video: true,
    writtenAgent: 'written-test-agent',
    phoneAgent: 'phone-screening-agent',
    videoAgent: 'interview-question-agent',
    strategy: '优先推荐候选人自动进入视频面试，待复核候选人先电话沟通。',
    tone: '正式、简洁，说明岗位、邀约方式、候选人需确认的时间窗口。',
  })

  const currentInviteOption = inviteModal
    ? (inviteTypeOptions.find((option) => option.key === inviteModal.type) || inviteTypeOptions[0])
    : inviteTypeOptions[0]

  const departments = useMemo(() => (
    ['全部部门', ...Array.from(new Set(candidateState.map((candidate) => candidate.department)))]
  ), [candidateState])

  const jobs = useMemo(() => (
    ['全部岗位', ...Array.from(new Set(candidateState.map((candidate) => candidate.jobTitle)))]
  ), [candidateState])

  const processStatuses = useMemo(() => (
    ['全部状态', ...Array.from(new Set(candidateState.map((candidate) => getProcessStatus(candidate))))]
  ), [candidateState])

  const jdOptions = useMemo(() => (
    Array.from(new Map(candidateState.map((candidate) => {
      const key = `${candidate.department}__${candidate.jobTitle}`
      return [key, {
        key,
        department: candidate.department,
        jobTitle: candidate.jobTitle,
        jdSummary: candidate.jdSummary,
      }]
    })).values())
  ), [candidateState])

  const baseFilteredCandidates = useMemo(() => {
    return candidateState.filter((candidate) => {
      const matchesDepartment = departmentFilter === '全部部门' || candidate.department === departmentFilter
      const matchesJob = jobFilter === '全部岗位' || candidate.jobTitle === jobFilter
      const matchesStatus = statusFilter === '全部状态' || getProcessStatus(candidate) === statusFilter

      return matchesDepartment && matchesJob && matchesStatus
    })
  }, [candidateState, departmentFilter, jobFilter, statusFilter])

  const filteredCandidates = useMemo(() => {
    if (!smartFilterQuery) return baseFilteredCandidates

    const tokens = parseSelectionTokens(smartFilterQuery)
    if (tokens.length === 0) return baseFilteredCandidates

    return baseFilteredCandidates.filter((candidate) => {
      const searchable = buildCandidateSearchText(candidate)
      return tokens.every((token) => searchable.includes(token))
    })
  }, [baseFilteredCandidates, smartFilterQuery])

  const handleInvite = (type, candidates) => {
    if (candidates.length === 0) return
    const candidateIds = candidates.map((candidate) => candidate.id)
    setCandidateState((currentRows) => currentRows.map((candidate) => {
      if (!candidateIds.includes(candidate.id)) return candidate

      if (type === 'written') {
        return candidate.writtenTest?.status === '已完成'
          ? candidate
          : {
            ...candidate,
            writtenTest: {
              ...(candidate.writtenTest || {}),
              status: '已邀约',
            },
          }
      }

      if (type === 'phone') {
        return candidate.phoneCall?.status === '已接通'
          ? candidate
          : {
            ...candidate,
            phoneCall: {
              ...(candidate.phoneCall || {}),
              status: '待电话沟通',
            },
          }
      }

      if (type === 'video') {
        return candidate.interview?.status === '已确认面试' || candidate.interview?.status === '已面试'
          ? candidate
          : {
            ...candidate,
            interview: {
              ...(candidate.interview || {}),
              status: '待确认',
            },
          }
      }

      return candidate
    }))
    setInviteModal(null)
  }

  const startPhoneCall = (candidate) => {
    const recordingName = `电话沟通_${candidate.name}_20260609_1530.mp3`
    const updatedCandidate = {
      ...candidate,
      phoneCall: {
        ...(candidate.phoneCall || {}),
        status: '已接通',
        calledAt: '2026-06-09 15:30',
        duration: '9 分 18 秒',
        recording: recordingName,
      },
      recordings: Array.from(new Set([...candidate.recordings, recordingName])),
    }

    setCandidateState((currentRows) => currentRows.map((item) => (
      item.id === candidate.id
        ? {
          ...item,
          phoneCall: {
            ...(item.phoneCall || {}),
            status: '已接通',
            calledAt: '2026-06-09 15:30',
            duration: '9 分 18 秒',
            recording: recordingName,
          },
          recordings: Array.from(new Set([...item.recordings, recordingName])),
        }
        : item
    )))
    setCallModalCandidate(null)
      openResultModal(updatedCandidate, 'phone')
  }

  const sendInterviewScoringToAgent = (candidate) => {
    const message = `请作为面试评分 Agent，基于以下面试记录输出结构化打分和面试报告。要求包含总分、分维度评分、评分依据、风险点、是否进入下一轮建议。\n\n部门：${candidate.department}\n岗位：${candidate.jobTitle}\n候选人：${candidate.name}\n面试轮次：${candidate.interview.round}\n当前报告：${candidate.interview.report || '暂无'}\n\n简历摘要：\n${candidate.resumePreview}\n\n面试题：\n${candidate.interviewQuestions.join('\n')}`

    navigate('/chat-workspace', {
      state: {
        activeMember: 'interview-scoring-agent',
        message,
      },
    })
  }

  const selectedJdOption = jdOptions.find((option) => option.key === resumeUploadForm.jdKey) || null

  const closeCreateResumeModal = () => {
    setCreateResumeOpen(false)
    setResumeUploadForm({ jdKey: '', files: [] })
  }

  const handleResumeFilesSelected = (fileList) => {
    const nextFiles = Array.from(fileList || []).map((file, index) => ({
      id: `${file.name}-${file.lastModified}-${index}`,
      file,
      name: file.name,
      sizeLabel: formatFileSize(file.size),
      fileType: getFileType(file.name),
    }))

    setResumeUploadForm((current) => ({
      ...current,
      files: [...current.files, ...nextFiles].slice(0, 10),
    }))
  }

  const handleRemoveResumeFile = (fileId) => {
    setResumeUploadForm((current) => ({
      ...current,
      files: current.files.filter((file) => file.id !== fileId),
    }))
  }

  const handleCreateResume = () => {
    if (!selectedJdOption || resumeUploadForm.files.length === 0) return

    const newCandidates = resumeUploadForm.files.map((item, index) => buildCandidateFromResumeUpload(item.file, selectedJdOption, index))
    setCandidateState((currentRows) => [...newCandidates, ...currentRows])
    closeCreateResumeModal()
  }

  const handleNaturalLanguageSelection = () => {
    const normalizedQuery = selectionQuery.trim().toLowerCase()

    if (!normalizedQuery || normalizedQuery.includes('全部') || normalizedQuery.includes('所有')) {
      setSmartFilterQuery('')
      setSelectionFeedback(`已恢复展示当前筛选条件下的 ${baseFilteredCandidates.length} 位候选人。`)
      return
    }

    const tokens = parseSelectionTokens(normalizedQuery)
    const matchedCount = baseFilteredCandidates.filter((candidate) => {
      const searchable = buildCandidateSearchText(candidate)
      return tokens.every((token) => searchable.includes(token))
    }).length

    setSmartFilterQuery(normalizedQuery)
    setSelectionFeedback(matchedCount > 0 ? `已智能筛选出 ${matchedCount} 位候选人。` : '没有匹配到符合条件的候选人。')
  }

  const clearNaturalLanguageSelection = () => {
    setSelectionQuery('')
    setSmartFilterQuery('')
    setSelectionFeedback(`已恢复展示当前筛选条件下的 ${baseFilteredCandidates.length} 位候选人。`)
  }

  const openResultModal = (candidate, preferredTab) => {
    const tabs = getCandidateResultTabs(candidate)

    if (tabs.length === 0) return

    const nextTab = preferredTab && tabs.some((tab) => tab.key === preferredTab)
      ? preferredTab
      : tabs[0].key

    setActiveResultTab(nextTab)
    setResultCandidate(candidate)
  }

  const openQuestionModal = (candidate) => {
    setQuestionCandidate(candidate)
    setQuestionDrafts(candidate.interviewQuestions || [])
  }

  const handleSaveInterviewQuestions = () => {
    if (!questionCandidate) return

    const nextQuestions = questionDrafts.map((question) => question.trim()).filter(Boolean)
    const updatedCandidate = {
      ...questionCandidate,
      interviewQuestions: nextQuestions,
    }

    setCandidateState((currentRows) => currentRows.map((candidate) => (
      candidate.id === updatedCandidate.id
        ? { ...candidate, interviewQuestions: nextQuestions }
        : candidate
    )))
    setQuestionCandidate(updatedCandidate)
    setQuestionDrafts(nextQuestions)
  }

  const handlePrimaryProgressAction = (candidate) => {
    const action = getPrimaryProgressAction(candidate)

    switch (action.actionKey) {
      case 'viewInterviewReport':
        openResultModal(candidate, 'interview')
        break
      case 'viewInterviewQuestions':
        openQuestionModal(candidate)
        break
      case 'inviteInterview':
        setInviteModal({ type: 'video', candidates: [candidate] })
        break
      case 'startPhoneCall':
        setCallModalCandidate(candidate)
        break
      case 'inviteWrittenTest':
        setInviteModal({ type: 'written', candidates: [candidate] })
        break
      default:
        break
    }
  }

  return (
    <div className="flex h-screen bg-white">
      <Sidebar compact />
      <ProjectSideMenu title="人资招聘" subtitle="招聘全流程" items={hrMenuItems} />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-[#f7f7f9]">
        <header className="border-b border-gray-200 bg-white px-8 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">候选人列表</h1>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-8">
          <section className="mb-5 grid gap-3 lg:grid-cols-[1fr_auto]">
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={departmentFilter}
                onChange={(event) => setDepartmentFilter(event.target.value)}
                className="h-10 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 outline-none transition focus:border-[#f0bbb6] focus:ring-4 focus:ring-[#fff1ef]"
              >
                {departments.map((department) => (
                  <option key={department} value={department}>{department}</option>
                ))}
              </select>
              <select
                value={jobFilter}
                onChange={(event) => setJobFilter(event.target.value)}
                className="h-10 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 outline-none transition focus:border-[#f0bbb6] focus:ring-4 focus:ring-[#fff1ef]"
              >
                {jobs.map((job) => (
                  <option key={job} value={job}>{job}</option>
                ))}
              </select>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="h-10 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 outline-none transition focus:border-[#f0bbb6] focus:ring-4 focus:ring-[#fff1ef]"
              >
                {processStatuses.map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center justify-end text-sm text-gray-500">
              当前 {filteredCandidates.length} 位候选人
            </div>
          </section>

          <section className="mb-5 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <input
                value={selectionQuery}
                onChange={(event) => setSelectionQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    handleNaturalLanguageSelection()
                  }
                }}
                placeholder="智能选择候选人，例如：产品部待确认面试的候选人"
                className="h-11 flex-1 rounded-xl border border-gray-200 bg-white px-4 text-sm text-gray-700 outline-none transition placeholder:text-gray-400 focus:border-[#f0bbb6] focus:ring-4 focus:ring-[#fff1ef]"
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleNaturalLanguageSelection}
                  className="h-11 rounded-xl bg-[#f40b0b] px-5 text-sm font-medium text-white transition hover:bg-[#de1010]"
                >
                  智能筛选
                </button>
                {smartFilterQuery && (
                  <button
                    type="button"
                    onClick={clearNaturalLanguageSelection}
                    className="h-11 rounded-xl border border-gray-200 bg-white px-4 text-sm font-medium text-gray-600 transition hover:border-gray-300 hover:bg-gray-50"
                  >
                    清空
                  </button>
                )}
              </div>
            </div>
            {selectionFeedback && (
              <div className="mt-2 text-sm text-gray-500">{selectionFeedback}</div>
            )}
          </section>

          <section className="overflow-x-auto rounded-3xl border border-gray-100 bg-white shadow-xl/50 shadow-sm">
            <table className="w-full min-w-[1120px]">
              <thead className="bg-[#fcfcfd] border-b border-gray-100">
                <tr>
                  <th className="px-6 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-400">部门 / 岗位 / 候选人</th>
                  <th className="px-6 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-400">推荐结论</th>
                  <th className="px-6 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-400">当前流程状态</th>
                  <th className="px-6 py-3.5 text-center text-xs font-semibold uppercase tracking-wider text-gray-400">推进进度</th>
                  <th className="px-6 py-3.5 text-center text-xs font-semibold uppercase tracking-wider text-gray-400">简历</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredCandidates.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="px-6 py-16 text-center text-sm text-gray-400 font-medium">
                      当前筛选条件下没有候选人
                    </td>
                  </tr>
                ) : (
                  filteredCandidates.map((candidate) => (
                    <tr key={candidate.id} className="transition-all duration-200 hover:bg-indigo-50/10 hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)]">
                      <td className="px-6 py-5 align-top">
                        <div className="text-[15px] font-bold text-gray-900 flex items-center gap-1.5">{candidate.name}</div>
                        <div className="mt-1 text-xs font-medium text-gray-500">{candidate.department} · {candidate.jobTitle}</div>
                      </td>
                      <td className="px-6 py-5 align-middle">
                        <span className={`inline-flex items-center text-xs font-bold ${candidate.conclusion === '优先推荐' ? 'text-emerald-700' : candidate.conclusion === '待人工复核' ? 'text-amber-700' : 'text-gray-600'}`}>
                          {candidate.conclusion}
                        </span>
                        <div className="mt-2 text-[11px] text-gray-400 max-w-[210px] leading-relaxed italic">
                          {candidate.risks.slice(0, 2).map((item) => `⚠ ${item}`).join('、') || '暂无明显风险'}
                        </div>
                      </td>
                      <td className="px-6 py-5 align-middle text-sm font-semibold text-gray-700">{getProcessStatus(candidate)}</td>
                      <td className="px-6 py-5 align-middle">
                        {(() => {
                          const action = getPrimaryProgressAction(candidate)
                          const showResultEntry = hasCandidateResults(candidate)
                          const actionClassName = action.actionTone === 'success'
                            ? 'text-emerald-700 hover:text-emerald-800'
                            : action.actionTone === 'primary'
                              ? 'text-blue-700 hover:text-blue-800'
                              : action.actionTone === 'warning'
                                ? 'text-amber-700 hover:text-amber-800'
                                : action.actionTone === 'muted'
                                  ? 'cursor-default text-gray-400'
                                  : 'text-gray-700 hover:text-indigo-600'

                          return (
                            <div className="flex min-h-[56px] flex-col items-center justify-center gap-1.5 text-center">
                              <div className="text-[11px] font-medium text-gray-400">{action.summary}</div>
                              {action.actionKey ? (
                                <button
                                  type="button"
                                  onClick={() => handlePrimaryProgressAction(candidate)}
                                  className={`text-sm font-bold transition-colors ${actionClassName}`}
                                >
                                  {action.actionLabel}
                                </button>
                              ) : (
                                <div className={`text-sm font-bold ${actionClassName}`}>{action.actionLabel}</div>
                              )}
                              {showResultEntry && action.actionLabel !== '查看结果' && (
                                <button
                                  type="button"
                                  onClick={() => openResultModal(candidate)}
                                  className="text-xs font-medium text-gray-500 transition hover:text-gray-700"
                                >
                                  查看结果
                                </button>
                              )}
                            </div>
                          )
                        })()}
                      </td>
                      <td className="px-6 py-5 align-top text-center">
                        <button
                          type="button"
                          onClick={() => setSelectedCandidate(candidate)}
                          className="inline-flex items-center rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-600 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600"
                        >
                          查看
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

      {createResumeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 px-6" onClick={closeCreateResumeModal}>
          <div className="w-full max-w-[760px] overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4 border-b border-gray-200 px-6 py-5">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">创建简历</h2>
                <p className="mt-1 text-sm text-gray-500">先选择对应 JD，再上传候选人简历文件，系统会将其加入候选人列表等待后续解析与推进。</p>
              </div>
              <button type="button" onClick={closeCreateResumeModal} className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition hover:bg-gray-50">×</button>
            </div>

            <div className="max-h-[76vh] overflow-y-auto px-6 py-6">
              <div className="rounded-2xl border border-gray-200 bg-[#fbfbfc] p-5">
                <div>
                  <div className="text-sm font-semibold text-gray-900">1. 选择对应 JD</div>
                  <select
                    value={resumeUploadForm.jdKey}
                    onChange={(event) => setResumeUploadForm((current) => ({ ...current, jdKey: event.target.value }))}
                    className="mt-3 h-11 w-full rounded-xl border border-gray-200 bg-white px-4 text-sm text-gray-700 outline-none transition focus:border-[#f0bbb6] focus:ring-4 focus:ring-[#fff1ef]"
                  >
                    <option value="">请选择岗位 JD</option>
                    {jdOptions.map((option) => (
                      <option key={option.key} value={option.key}>{option.department} / {option.jobTitle}</option>
                    ))}
                  </select>
                  {selectedJdOption && (
                    <div className="mt-3 rounded-xl border border-[#fee2e2] bg-[#fff8f7] px-4 py-3 text-sm leading-6 text-gray-600">
                      <div className="font-semibold text-gray-900">已选 JD</div>
                      <div className="mt-1">{selectedJdOption.department} / {selectedJdOption.jobTitle}</div>
                      <div className="mt-2 text-xs text-gray-500">{selectedJdOption.jdSummary}</div>
                    </div>
                  )}
                </div>

                <div className="mt-6">
                  <div className="text-sm font-semibold text-gray-900">2. 上传简历文件</div>
                  <label className={`mt-3 block rounded-2xl border border-dashed px-6 py-12 text-center transition ${selectedJdOption ? 'cursor-pointer border-gray-300 bg-white hover:border-[#f0bbb6] hover:bg-[#fffaf9]' : 'cursor-not-allowed border-gray-200 bg-gray-50 text-gray-400'}`}>
                    <input
                      type="file"
                      multiple
                      accept=".pdf,.doc,.docx,.txt"
                      disabled={!selectedJdOption}
                      onChange={(event) => {
                        handleResumeFilesSelected(event.target.files)
                        event.target.value = ''
                      }}
                      className="hidden"
                    />
                    <div className="text-base font-medium text-gray-900">点击上传或拖入简历文件</div>
                    <div className="mt-2 text-sm text-gray-500">支持 PDF、DOC、DOCX、TXT，最多 10 个文件。</div>
                    {!selectedJdOption && (
                      <div className="mt-3 text-xs font-medium text-[#d90808]">请先选择对应的 JD。</div>
                    )}
                  </label>
                </div>

                <div className="mt-6">
                  <div className="mb-3 text-sm font-semibold text-gray-900">已上传文件</div>
                  <div className="space-y-3">
                    {resumeUploadForm.files.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-gray-200 bg-white px-4 py-8 text-center text-sm text-gray-400">
                        还没有上传简历文件。
                      </div>
                    ) : resumeUploadForm.files.map((item) => (
                      <div key={item.id} className="grid grid-cols-[56px_minmax(0,1fr)_72px_24px] items-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#fff3f2] text-xs font-bold text-[#d90808]">
                          {item.fileType}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-gray-900">{item.name}</div>
                          <div className="mt-1 text-xs text-gray-400">{item.sizeLabel}</div>
                        </div>
                        <div className="text-right text-xs font-semibold text-emerald-600">已加入</div>
                        <button type="button" onClick={() => handleRemoveResumeFile(item.id)} className="text-sm text-gray-400 transition hover:text-gray-700">×</button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-4">
              <button type="button" onClick={closeCreateResumeModal} className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-50">取消</button>
              <button
                type="button"
                onClick={handleCreateResume}
                disabled={!selectedJdOption || resumeUploadForm.files.length === 0}
                className="rounded-lg bg-[#f40b0b] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#de1010] disabled:cursor-not-allowed disabled:bg-[#f5b5b5]"
              >
                创建并加入列表
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedCandidate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/25 px-6" onClick={() => setSelectedCandidate(null)}>
          <div className="w-full max-w-[1100px] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4 border-b border-gray-200 px-6 py-5">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">{selectedCandidate.name}简历</h2>
                <p className="mt-1 text-sm text-gray-500">{selectedCandidate.department} · {selectedCandidate.jobTitle} · {selectedCandidate.name}</p>
              </div>
              <button type="button" onClick={() => setSelectedCandidate(null)} className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition hover:bg-gray-50">×</button>
            </div>

            <div className="max-h-[78vh] overflow-y-auto bg-gray-100 px-6 py-6">
              <div className="mx-auto min-h-[1120px] w-full max-w-[794px] bg-white px-12 py-10 shadow-xl ring-1 ring-gray-200">
                <div className="border-b border-gray-200 pb-6">
                  <div className="flex items-start justify-between gap-6">
                    <div>
                      <h3 className="text-3xl font-semibold text-gray-900">{selectedCandidate.name}</h3>
                      <p className="mt-2 text-sm text-gray-500">{selectedCandidate.currentRole} · {selectedCandidate.years} 工作经验</p>
                    </div>
                    <div className="text-right text-sm leading-6 text-gray-600">
                      <div>{selectedCandidate.phone}</div>
                      <div>{selectedCandidate.email}</div>
                      <div>{selectedCandidate.education}</div>
                    </div>
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-[1fr_180px] gap-8">
                  <main className="space-y-7">
                    <section>
                      <h4 className="border-l-4 border-[#f40b0b] pl-3 text-base font-semibold text-gray-900">求职意向</h4>
                      <p className="mt-3 text-sm leading-7 text-gray-700">{buildStructuredResume(selectedCandidate).target}</p>
                    </section>

                    <section>
                      <h4 className="border-l-4 border-[#f40b0b] pl-3 text-base font-semibold text-gray-900">个人摘要</h4>
                      <p className="mt-3 text-sm leading-7 text-gray-700">{buildStructuredResume(selectedCandidate).summary}</p>
                    </section>

                    <section>
                      <h4 className="border-l-4 border-[#f40b0b] pl-3 text-base font-semibold text-gray-900">工作经历</h4>
                      {buildStructuredResume(selectedCandidate).workExperience.map((experience) => (
                        <div key={experience.company} className="mt-4">
                          <div className="flex items-center justify-between gap-4">
                            <div className="text-sm font-semibold text-gray-900">{experience.company} · {experience.role}</div>
                            <div className="text-xs text-gray-500">{experience.period}</div>
                          </div>
                          <ul className="mt-3 space-y-2 text-sm leading-7 text-gray-700">
                            {experience.details.map((detail) => <li key={detail}>• {detail}</li>)}
                          </ul>
                        </div>
                      ))}
                    </section>

                    <section>
                      <h4 className="border-l-4 border-[#f40b0b] pl-3 text-base font-semibold text-gray-900">项目经历</h4>
                      <div className="mt-4 space-y-4">
                        {buildStructuredResume(selectedCandidate).projects.map((project) => (
                          <div key={project.name}>
                            <div className="text-sm font-semibold text-gray-900">{project.name}</div>
                            <p className="mt-2 text-sm leading-7 text-gray-700">{project.description}</p>
                          </div>
                        ))}
                      </div>
                    </section>
                  </main>

                  <aside className="space-y-6 border-l border-gray-200 pl-6">
                    <section>
                      <h4 className="text-sm font-semibold text-gray-900">技能标签</h4>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {buildStructuredResume(selectedCandidate).skills.map((skill) => (
                          <span key={skill} className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700">{skill}</span>
                        ))}
                      </div>
                    </section>

                    <section>
                      <h4 className="text-sm font-semibold text-gray-900">教育经历</h4>
                      <p className="mt-3 text-sm leading-6 text-gray-700">{selectedCandidate.education}</p>
                    </section>

                    <section>
                      <h4 className="text-sm font-semibold text-gray-900">风险提示</h4>
                      <ul className="mt-3 space-y-2 text-sm leading-6 text-gray-700">
                        {selectedCandidate.risks.map((risk) => <li key={risk}>• {risk}</li>)}
                      </ul>
                    </section>
                  </aside>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {resultCandidate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/25 px-6" onClick={() => setResultCandidate(null)}>
          <div className="w-full max-w-[980px] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4 border-b border-gray-200 px-6 py-5">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">候选人结果汇总</h2>
                <p className="mt-1 text-sm text-gray-500">{resultCandidate.department} · {resultCandidate.jobTitle} · {resultCandidate.name}</p>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setResultCandidate(null)} className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition hover:bg-gray-50">×</button>
              </div>
            </div>

            <div className="border-b border-gray-200 px-6 py-3">
              <div className="flex flex-wrap items-center gap-2">
                {getCandidateResultTabs(resultCandidate).map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveResultTab(tab.key)}
                    className={`rounded-full px-4 py-2 text-sm font-medium transition ${activeResultTab === tab.key ? 'bg-[#f40b0b] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="max-h-[78vh] overflow-y-auto px-6 py-5">
              {activeResultTab === 'written' && resultCandidate.writtenTest?.status === '已完成' && (
                <section className="rounded-2xl border border-gray-200 bg-white px-5 py-4">
                  <div className="flex items-center justify-between gap-4">
                    <h3 className="text-base font-semibold text-gray-900">笔试结果</h3>
                    <div className="text-sm font-semibold text-emerald-700">{resultCandidate.writtenTest.status}</div>
                  </div>
                  <div className="mt-4 grid gap-4 sm:grid-cols-3">
                    <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
                      <div className="text-xs font-medium text-gray-500">总分</div>
                      <div className="mt-1 text-2xl font-semibold text-gray-900">{resultCandidate.writtenTest.totalScore}</div>
                    </div>
                    <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 sm:col-span-2">
                      <div className="text-xs font-medium text-gray-500">提交时间</div>
                      <div className="mt-1 text-sm font-semibold text-gray-900">{resultCandidate.writtenTest.submittedAt}</div>
                    </div>
                  </div>
                  <div className="mt-4 space-y-4">
                    {resultCandidate.writtenTest.qa.map((item, index) => (
                      <section key={item.question} className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-4">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <div className="text-xs font-semibold text-[#d90808]">题目 {index + 1}</div>
                            <h4 className="mt-2 text-sm font-semibold leading-6 text-gray-900">{item.question}</h4>
                          </div>
                          <div className="shrink-0 rounded-lg bg-white px-3 py-2 text-center">
                            <div className="text-lg font-semibold text-[#d90808]">{item.score}</div>
                            <div className="text-xs text-gray-500">/ {item.maxScore}</div>
                          </div>
                        </div>
                        <div className="mt-4 grid gap-3 lg:grid-cols-2">
                          <div className="rounded-lg border border-gray-200 bg-white px-4 py-3">
                            <div className="text-xs font-semibold text-gray-500">候选人回答</div>
                            <p className="mt-2 text-sm leading-6 text-gray-700">{item.answer}</p>
                          </div>
                          <div className="rounded-lg border border-gray-200 bg-white px-4 py-3">
                            <div className="text-xs font-semibold text-gray-500">评分依据</div>
                            <p className="mt-2 text-sm leading-6 text-gray-700">{item.rationale}</p>
                          </div>
                        </div>
                      </section>
                    ))}
                  </div>
                </section>
              )}

              {activeResultTab === 'phone' && resultCandidate.phoneCall?.status && resultCandidate.phoneCall.status !== '待电话沟通' && (
                <section className="rounded-2xl border border-gray-200 bg-white px-5 py-4">
                  <div className="flex items-center justify-between gap-4">
                    <h3 className="text-base font-semibold text-gray-900">电话结果</h3>
                    <div className="text-sm font-semibold text-gray-900">{resultCandidate.phoneCall.status}</div>
                  </div>
                  <div className="mt-4 grid gap-4 sm:grid-cols-3">
                    <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
                      <div className="text-xs font-medium text-gray-500">拨打时间</div>
                      <div className="mt-1 text-sm font-semibold text-gray-900">{resultCandidate.phoneCall.calledAt || '暂无'}</div>
                    </div>
                    <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
                      <div className="text-xs font-medium text-gray-500">通话时长</div>
                      <div className="mt-1 text-sm font-semibold text-gray-900">{resultCandidate.phoneCall.duration || '暂无'}</div>
                    </div>
                    <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
                      <div className="text-xs font-medium text-gray-500">录音文件</div>
                      <div className="mt-1 text-sm font-semibold text-gray-900">{resultCandidate.phoneCall.recording || '暂无'}</div>
                    </div>
                  </div>
                  {resultCandidate.phoneCall.status === '已接通' ? (
                    <div className="mt-4 space-y-3">
                      {resultCandidate.phoneCall.transcript.map((item, index) => (
                        <div key={`${item.speaker}-${index}`} className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
                          <div className="text-xs font-semibold text-gray-500">{item.speaker}</div>
                          <p className="mt-2 text-sm leading-6 text-gray-800">{item.text}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-4 rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
                      当前电话状态为{resultCandidate.phoneCall.status}，暂无完整对话内容。
                    </div>
                  )}
                </section>
              )}

              {activeResultTab === 'interview' && resultCandidate.interview?.status === '已面试' && (
                <section className="rounded-2xl border border-gray-200 bg-white px-5 py-4">
                  <div className="flex items-center justify-between gap-4">
                    <h3 className="text-base font-semibold text-gray-900">面试结果</h3>
                    <div className="text-sm font-semibold text-emerald-700">{resultCandidate.interview.status}</div>
                  </div>
                  <div className="mt-4 grid gap-4 sm:grid-cols-3">
                    <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
                      <div className="text-xs font-medium text-gray-500">面试轮次</div>
                      <div className="mt-1 text-sm font-semibold text-gray-900">{resultCandidate.interview.round}</div>
                    </div>
                    <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 sm:col-span-2">
                      <div className="text-xs font-medium text-gray-500">面试总分</div>
                      <div className="mt-1 text-2xl font-semibold text-gray-900">{resultCandidate.interview.score}</div>
                    </div>
                  </div>
                  <section className="mt-4 rounded-xl border border-gray-200 bg-gray-50 px-4 py-4">
                    <h4 className="text-sm font-semibold text-gray-900">面试报告</h4>
                    <p className="mt-3 text-sm leading-7 text-gray-700">{resultCandidate.interview.report}</p>
                  </section>
                  <div className="mt-4 grid gap-3 lg:grid-cols-3">
                    {resultCandidate.interview.dimensions.map((dimension) => (
                      <section key={dimension.name} className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <h4 className="text-sm font-semibold text-gray-900">{dimension.name}</h4>
                          <span className="text-lg font-semibold text-[#d90808]">{dimension.score}</span>
                        </div>
                        <p className="mt-2 text-xs leading-5 text-gray-600">{dimension.rationale}</p>
                      </section>
                    ))}
                  </div>
                </section>
              )}
            </div>
          </div>
        </div>
      )}

      {inviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/25 px-6" onClick={() => setInviteModal(null)}>
          <div className="w-full max-w-[760px] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="border-b border-gray-200 px-6 py-5">
              <h2 className="text-xl font-semibold text-gray-900">生成邀约链接</h2>
              <p className="mt-1 text-sm text-gray-500">先生成对应邀约链接，由 HR 确认后再发送给 {inviteModal.candidates.length} 位候选人。</p>
            </div>
            <div className="px-6 py-5">
              <div className="max-h-[360px] overflow-y-auto rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
                {inviteModal.candidates.map((candidate) => (
                  <div key={candidate.id} className="border-b border-gray-200 py-3 last:border-b-0">
                    <div className="flex items-center justify-between gap-4 text-sm">
                      <span className="font-medium text-gray-900">{candidate.name}</span>
                      <span className="text-gray-500">{candidate.department} · {candidate.jobTitle}</span>
                    </div>
                    <div className="mt-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-600">
                      {buildInviteLink(candidate, inviteModal.type)}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-5 flex justify-end gap-2">
                <button type="button" onClick={() => setInviteModal(null)} className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-50">取消</button>
                <button type="button" onClick={() => handleInvite(inviteModal.type, inviteModal.candidates)} className="rounded-lg bg-[#f40b0b] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#de1010]">
                  {currentInviteOption.confirmLabel}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {smartInviteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/25 px-6" onClick={() => setSmartInviteOpen(false)}>
          <div className="w-full max-w-[720px] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4 border-b border-gray-200 px-6 py-5">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">智能邀约设置</h2>
                <p className="mt-1 text-sm text-gray-500">配置批量邀约策略，系统按简历通过情况、评分和岗位要求推荐邀约方式。</p>
              </div>
              <button type="button" onClick={() => setSmartInviteOpen(false)} className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition hover:bg-gray-50">×</button>
            </div>
            <div className="space-y-5 px-6 py-5">
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  ['written', '自动邀约笔试'],
                  ['phone', '自动电话沟通'],
                  ['video', '自动视频面试'],
                ].map(([key, label]) => (
                  <div key={key} className="rounded-xl border border-gray-200 bg-white px-4 py-3">
                    <label className="flex items-center gap-3 text-sm font-medium text-gray-700">
                      <input type="checkbox" checked={smartInviteConfig[key]} onChange={(event) => setSmartInviteConfig((current) => ({ ...current, [key]: event.target.checked }))} className="h-4 w-4 rounded border-gray-300 text-[#d90808] focus:ring-[#f0bbb6]" />
                      {label}
                    </label>
                    <div className="mt-3">
                      <div className="mb-1 text-xs font-medium text-gray-500">绑定数字员工</div>
                      <select
                        value={smartInviteConfig[`${key}Agent`]}
                        disabled={!smartInviteConfig[key]}
                        onChange={(event) => setSmartInviteConfig((current) => ({ ...current, [`${key}Agent`]: event.target.value }))}
                        className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 outline-none transition focus:border-[#f0bbb6] focus:ring-4 focus:ring-[#fff1ef] disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400"
                      >
                        {smartInviteAgentOptions[key].map((agent) => (
                          <option key={agent.value} value={agent.value}>{agent.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))}
              </div>
              <label className="block">
                <span className="text-sm font-semibold text-gray-900">邀约策略</span>
                <textarea value={smartInviteConfig.strategy} onChange={(event) => setSmartInviteConfig((current) => ({ ...current, strategy: event.target.value }))} className="mt-2 h-24 w-full resize-none rounded-xl border border-gray-200 px-4 py-3 text-sm leading-6 text-gray-700 outline-none transition focus:border-[#f0bbb6] focus:ring-4 focus:ring-[#fff1ef]" />
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-gray-900">邀约话术风格</span>
                <textarea value={smartInviteConfig.tone} onChange={(event) => setSmartInviteConfig((current) => ({ ...current, tone: event.target.value }))} className="mt-2 h-20 w-full resize-none rounded-xl border border-gray-200 px-4 py-3 text-sm leading-6 text-gray-700 outline-none transition focus:border-[#f0bbb6] focus:ring-4 focus:ring-[#fff1ef]" />
              </label>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setSmartInviteOpen(false)} className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-50">取消</button>
                <button type="button" onClick={() => setSmartInviteOpen(false)} className="rounded-lg bg-[#f40b0b] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#de1010]">保存设置</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {callModalCandidate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/25 px-6" onClick={() => setCallModalCandidate(null)}>
          <div className="w-full max-w-[560px] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="border-b border-gray-200 px-6 py-5">
              <h2 className="text-xl font-semibold text-gray-900">确认拨打电话</h2>
              <p className="mt-1 text-sm text-gray-500">{callModalCandidate.name} · {callModalCandidate.phone}</p>
            </div>
            <div className="px-6 py-5">
              <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-4 text-sm leading-6 text-gray-700">
                确认现在拨打 {callModalCandidate.name} 的电话 {callModalCandidate.phone}。拨打后，系统会记录通话过程，并在结束后自动生成录音文件回写到候选人沟通记录。
              </div>
              <div className="mt-4 space-y-2">
                {callModalCandidate.recordings.length === 0 ? (
                  <div className="text-sm text-gray-500">暂无录音文件</div>
                ) : callModalCandidate.recordings.map((recording) => (
                  <div key={recording} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700">{recording}</div>
                ))}
              </div>
              <div className="mt-5 flex justify-end gap-2">
                <button type="button" onClick={() => setCallModalCandidate(null)} className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-50">关闭</button>
                <button type="button" onClick={() => startPhoneCall(callModalCandidate)} className="rounded-lg bg-[#f40b0b] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#de1010]">确认拨打</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {questionCandidate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/25 px-6" onClick={() => setQuestionCandidate(null)}>
          <div className="w-full max-w-[860px] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4 border-b border-gray-200 px-6 py-5">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">面试题</h2>
                <p className="mt-1 text-sm text-gray-500">即将面试时查看的题目内容，由智能面试题生成数字员工基于 JD 和候选人简历生成。</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSaveInterviewQuestions}
                  className="rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:border-[#f0bbb6] hover:bg-[#fff7f7] hover:text-[#d90808]"
                >
                  保存
                </button>
                <button type="button" onClick={() => setQuestionCandidate(null)} className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition hover:bg-gray-50">×</button>
              </div>
            </div>
            <div className="max-h-[72vh] overflow-y-auto p-6">
                <section className="rounded-2xl border border-gray-200 bg-gray-50 px-5 py-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h3 className="text-base font-semibold text-gray-900">邀约面试</h3>
                      <p className="mt-1 text-sm text-gray-500">确认面试时间后，可将下面的面试邀约链接发送给候选人。</p>
                    </div>
                    <div className="rounded-full bg-[#fff7f7] px-3 py-1 text-xs font-semibold text-[#d90808]">
                      {questionCandidate.interview?.status || '待确认面试'}
                    </div>
                  </div>
                  <div className="mt-4 grid gap-4 sm:grid-cols-3">
                    <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
                      <div className="text-xs font-medium text-gray-500">面试轮次</div>
                      <div className="mt-1 text-sm font-semibold text-gray-900">{questionCandidate.interview?.round || '一面'}</div>
                    </div>
                    <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 sm:col-span-2">
                      <div className="text-xs font-medium text-gray-500">面试时间</div>
                      <div className="mt-1 text-sm font-semibold text-gray-900">{questionCandidate.interview?.scheduledAt || '待确认'}</div>
                    </div>
                  </div>
                  <div className="mt-4 rounded-xl border border-gray-200 bg-white px-4 py-3">
                    <div className="text-xs font-medium text-gray-500">面试邀约链接</div>
                    <div className="mt-2 break-all text-sm leading-6 text-gray-700">{buildInviteLink(questionCandidate, 'video')}</div>
                  </div>
                </section>

                <section className="mt-5 space-y-3">
                  <div>
                    <h3 className="text-base font-semibold text-gray-900">面试题目</h3>
                    <p className="mt-1 text-sm text-gray-500">即将面试时查看的题目内容，由智能面试题生成数字员工基于 JD 和候选人简历生成。</p>
                  </div>
              <section className="space-y-3">
                {questionDrafts.map((question, index) => (
                  <div key={`interview-question-${index}`} className="rounded-xl border border-gray-200 bg-white px-4 py-4">
                    <div className="text-xs font-semibold text-[#d90808]">题目 {index + 1}</div>
                    <textarea
                      value={question}
                      onChange={(event) => setQuestionDrafts((current) => current.map((item, itemIndex) => (itemIndex === index ? event.target.value : item)))}
                      className="mt-2 min-h-[96px] w-full resize-none rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm leading-6 text-gray-800 outline-none transition focus:border-[#f0bbb6] focus:ring-4 focus:ring-[#fff1ef]"
                    />
                    <div className="mt-3 text-xs leading-5 text-gray-500">考察维度：岗位核心经验、问题拆解、风险识别、表达结构化。</div>
                  </div>
                ))}
                </section>
              </section>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default CandidateList
