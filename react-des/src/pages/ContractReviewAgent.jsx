import React, { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import JSZip from 'jszip'
import Sidebar from '../components/Sidebar'
import ProjectSideMenu from '../components/ProjectSideMenu'
import {
  createContractRuleAnalyses,
  createContractReviewRule,
  createContractRuleGroup,
  fetchContractRuleAnalyses,
  fetchContractReviewRules,
  fetchContractRuleGroups,
} from '../utils/contractReviewRulesApi'

const legalMenuItems = [
  { label: '合同审查', route: '/contract-review-agent' },
  { label: '审查规则', route: '/contract-review-rules' },
]

const reviewTypes = ['法律文件审查', '对比审查']
const reviewPositions = ['甲方立场', '乙方立场', '中立立场']
const reviewScales = ['强势', '弱势', '均势']

const sampleContractTexts = {
  技术服务协议: `合同编号：【TS-2026-0529】

技术服务协议

甲方委托乙方提供小程序商城开发、接口联调、上线部署及后续运维支持服务。

一、服务内容
乙方应按照双方确认的需求文档完成微信小程序商城首页、商品管理、订单管理、支付接入、会员体系及后台管理功能开发。

二、交付与验收
乙方应在合同生效后 60 个自然日内提交可运行版本。甲方应在收到交付成果后 7 个工作日内完成验收并反馈修改意见。

三、费用及支付
合同总金额为人民币 280000 元。甲方应在合同签署后支付 40%，系统上线验收通过后支付 50%，运维期满后支付 10%。

四、知识产权
项目交付成果的源代码、设计稿和相关文档在甲方付清全部费用后归甲方所有。乙方保留通用组件和既有工具的知识产权。

五、违约责任
任何一方违反本协议约定，应承担由此给对方造成的实际损失。`,
  采购合同: `采购服务合同

甲方向乙方采购企业办公设备、部署服务及一年期售后支持。

一、采购范围
采购内容包括服务器、网络设备、安装调试服务和运行维护支持。

二、交付要求
乙方应在收到预付款后 20 个工作日内完成设备到货，并在到货后 5 个工作日内完成安装调试。

三、付款条款
甲方在合同签订后支付合同金额 30%，设备到货并初验后支付 50%，终验通过后支付 20%。

四、质量保证
乙方承诺所供设备为原厂正品，并提供不少于一年的质量保证和售后服务。`,
  合作协议: `广告投放合作协议

甲乙双方就线上广告投放、数据回传、效果评估和结算事项达成本协议。

一、合作内容
乙方根据甲方投放需求，在指定渠道完成广告投放和素材运营。

二、数据与结算
双方以后台确认的数据作为结算依据。若数据出现异常，双方应在 3 个工作日内完成核对。

三、合规要求
投放素材不得违反广告法、平台规则及相关监管要求。`,
  招投标文件: `招投标文件合规检查

本文件用于项目投标响应，包含供应商资格、报价、技术方案、服务承诺和商务条款。

一、供应商资格
投标人应具备有效营业执照、相关项目经验和履约能力。

二、报价要求
报价应包含软件许可、实施服务、培训服务和售后服务费用。

三、响应偏离
投标人应逐条响应招标文件中的商务和技术要求，并说明正偏离或负偏离情况。`,
}

const inferContractType = (fileName) => {
  if (/采购/.test(fileName)) return '采购合同'
  if (/合作|广告/.test(fileName)) return '合作协议'
  if (/招投标|投标/.test(fileName)) return '招投标文件'
  if (/服务|开发|技术/.test(fileName)) return '技术服务协议'
  if (/pdf$/i.test(fileName)) return 'PDF合同'
  return '合同文件'
}

const splitContractParagraphs = (text) => (
  (text || '').split(/\n{2,}|\r\n{2,}/).map((paragraph) => paragraph.trim()).filter(Boolean)
)

const reviewAnnotationTemplates = [
  { terms: ['解除'], level: '高风险', title: '解除条件需收窄', comment: '建议补充解除触发条件、通知期限和整改期，避免单方解除权过宽。', suggestion: '任何一方要求解除本协议的，应提前 10 个工作日书面通知对方；如对方存在违约情形，应先给予不少于 5 个工作日的整改期，逾期未整改的，守约方有权解除协议并要求违约方承担相应责任。' },
  { terms: ['交付', '验收'], level: '高风险', title: '验收流程需明确', comment: '建议明确交付物清单、验收标准、异议反馈期限和整改复验机制。', suggestion: '乙方应按照双方确认的需求文档提交交付成果。甲方应在收到交付成果后 7 个工作日内完成验收；如验收不通过，应一次性书面列明不符合项，乙方应在 5 个工作日内完成整改并重新提交验收。' },
  { terms: ['知识产权', '源代码', '设计稿'], level: '高风险', title: '知识产权归属需细化', comment: '建议明确交付成果、通用组件和既有工具的权属边界及使用限制。', suggestion: '在甲方付清全部合同款项后，乙方为本项目专门开发形成的源代码、设计稿及项目文档的知识产权归甲方所有；乙方既有工具、通用组件及第三方开源组件不因本协议转让，但乙方应保证甲方可为使用交付成果之目的持续、无偿使用。' },
  { terms: ['违约'], level: '中风险', title: '违约责任缺少量化标准', comment: '建议补充违约金计算方式、赔偿上限、损失范围和责任承担路径。', suggestion: '任何一方违反本协议约定，应在收到守约方书面通知后 5 个工作日内完成整改；逾期未整改的，应按照合同总金额的 10% 向守约方支付违约金。违约金不足以弥补守约方实际损失的，违约方还应赔偿差额部分。' },
  { terms: ['付款', '支付', '费用'], level: '中风险', title: '付款节点需绑定条件', comment: '建议将付款节点与交付验收结果绑定，并补充逾期付款处理规则。', suggestion: '甲方付款义务应以乙方完成对应阶段交付并经甲方书面验收通过为前提。甲方逾期付款超过 10 个工作日的，应按照逾期未付款金额每日万分之三向乙方支付违约金，但因乙方交付成果未通过验收导致的延期付款除外。' },
  { terms: ['数据', '安全', '保密'], level: '高风险', title: '数据安全责任需补充', comment: '建议明确数据使用范围、访问权限、泄露通知和安全责任承担。', suggestion: '乙方仅可为履行本协议之目的处理甲方数据，并应采取不低于行业通常标准的安全保护措施。发生数据泄露、丢失或未经授权访问时，乙方应在 24 小时内通知甲方并承担由此产生的整改、赔偿及监管配合责任。' },
]

const reviewFilters = ['全部', '高风险', '中风险', '低风险', '已处理']
const annotationStatusLabels = {
  pending: '待处理',
  accepted: '已采纳',
  ignored: '已忽略',
  editing: '编辑中',
}

const getRiskHighlightText = (paragraph, terms = []) => {
  const normalizedTerms = terms.map((term) => (term || '').trim()).filter(Boolean)
  if (!paragraph || normalizedTerms.length === 0) return ''
  const chunks = paragraph.match(/[^。；;\n]+[。；;]?|\n/g) || [paragraph]
  const candidates = chunks
    .map((chunk) => chunk.trim())
    .filter((chunk) => normalizedTerms.some((term) => chunk.includes(term)))
    .map((chunk) => ({
      text: chunk,
      hits: normalizedTerms.filter((term) => chunk.includes(term)).length,
    }))

  if (candidates.length === 0) return ''
  return candidates.sort((first, second) => {
    if (second.hits !== first.hits) return second.hits - first.hits
    return second.text.length - first.text.length
  })[0].text
}

const buildReviewAnnotations = (originalText) => {
  const paragraphs = splitContractParagraphs(originalText)
  const usedParagraphIndexes = new Set()
  const annotations = []

  reviewAnnotationTemplates.forEach((template) => {
    const paragraphIndex = paragraphs.findIndex((paragraph, index) => (
      !usedParagraphIndexes.has(index) && template.terms.some((term) => paragraph.includes(term))
    ))
    if (paragraphIndex === -1) return
    usedParagraphIndexes.add(paragraphIndex)
    annotations.push({ ...template, paragraphIndex, highlightText: getRiskHighlightText(paragraphs[paragraphIndex], template.terms) })
  })

  if (annotations.length === 0 && paragraphs.length > 0) {
    annotations.push({
      paragraphIndex: Math.min(1, paragraphs.length - 1),
      level: '中风险',
      title: '建议人工复核关键条款',
      comment: '当前文本未命中内置风险关键词，建议结合审查清单补充人工复核意见。',
      suggestion: '建议法务结合业务背景补充具体权利义务、履约标准、责任承担和争议处理条款。',
      terms: [],
    })
  }

  return annotations.map((annotation, index) => ({
    ...annotation,
    id: `review-annotation-${index}-${annotation.paragraphIndex}`,
  }))
}

const getAnnotationTone = (level) => {
  if (level === '高风险') return {
    paragraph: 'bg-[#ffef6e]',
    badge: 'bg-[#fff1f2] text-[#dc2626]',
    dot: 'bg-[#dc2626]',
  }
  if (level === '中风险') return {
    paragraph: 'bg-[#ffef6e]',
    badge: 'bg-[#fff7ed] text-[#ea580c]',
    dot: 'bg-[#f97316]',
  }
  return {
    paragraph: 'bg-[#ffef6e]',
    badge: 'bg-[#eff6ff] text-[#2563eb]',
    dot: 'bg-[#2563eb]',
  }
}

const riskLevelPriority = {
  高风险: 3,
  中风险: 2,
  低风险: 1,
}

const renderHighlightedContractText = (paragraph, annotations, selectedAnnotationId) => {
  const charMarks = Array.from({ length: paragraph.length }, () => null)

  annotations.forEach((annotation) => {
    const phrases = [annotation.excerpt || annotation.highlightText || getRiskHighlightText(paragraph, annotation.terms)]
      .map((phrase) => (phrase || '').trim())
      .filter(Boolean)

    phrases.forEach((phrase) => {
      let searchFrom = 0
      while (searchFrom < paragraph.length) {
        const start = paragraph.indexOf(phrase, searchFrom)
        if (start === -1) break
        const end = start + phrase.length
        for (let index = start; index < end; index += 1) {
          const currentMark = charMarks[index]
          const isSelected = annotation.id === selectedAnnotationId
          if (!currentMark || isSelected || riskLevelPriority[annotation.level] > riskLevelPriority[currentMark.level]) {
            charMarks[index] = { level: annotation.level, isSelected }
          }
        }
        searchFrom = end
      }
    })
  })

  const nodes = []
  let start = 0
  while (start < paragraph.length) {
    const mark = charMarks[start]
    let end = start + 1
    while (end < paragraph.length && charMarks[end]?.level === mark?.level && charMarks[end]?.isSelected === mark?.isSelected) end += 1
    const text = paragraph.slice(start, end)
    nodes.push(mark ? (
      <mark key={`${start}-${end}`} className={`box-decoration-clone px-0.5 text-inherit ${mark.isSelected ? 'bg-[#ffef6e]' : getAnnotationTone(mark.level).paragraph}`}>{text}</mark>
    ) : text)
    start = end
  }
  return nodes
}

const keyInfoTemplates = [
  { label: '服务内容', terms: ['服务内容', '开发', '接口', '上线部署', '运维支持'], type: '履约范围' },
  { label: '交付与验收', terms: ['交付', '验收', '反馈', '整改'], type: '验收节点' },
  { label: '费用及支付', terms: ['费用', '支付', '付款', '合同总金额', '人民币'], type: '付款条件' },
  { label: '知识产权', terms: ['知识产权', '源代码', '设计稿', '文档'], type: '权属约定' },
  { label: '违约责任', terms: ['违约', '责任', '损失', '赔偿'], type: '责任承担' },
]

const buildKeyInformationItems = (originalText) => {
  const paragraphs = splitContractParagraphs(originalText)
  return keyInfoTemplates.map((template, index) => {
    const paragraphIndex = paragraphs.findIndex((paragraph) => template.terms.some((term) => paragraph.includes(term)))
    const sourceParagraph = paragraphIndex === -1 ? paragraphs[Math.min(index, Math.max(paragraphs.length - 1, 0))] || '' : paragraphs[paragraphIndex]
    const excerpt = getRiskHighlightText(sourceParagraph, template.terms) || sourceParagraph
    return {
      id: `key-info-${index}`,
      ...template,
      paragraphIndex: paragraphIndex === -1 ? Math.min(index, Math.max(paragraphs.length - 1, 0)) : paragraphIndex,
      excerpt,
      value: excerpt,
      note: '请确认该信息是否准确，必要时可直接编辑。',
      level: '低风险',
    }
  }).filter((item) => item.value)
}

const historyItems = [
  { title: '技术服务协议-框架协议(1)', time: '今天 14:32', status: '已完成', type: '技术服务协议', risk: '中风险', owner: '法务审查', pages: 18, originalText: sampleContractTexts.技术服务协议 },
  { title: '采购服务合同风险审查', time: '今天 11:20', status: '已完成', type: '采购合同', risk: '高风险', owner: '采购部', pages: 26, originalText: sampleContractTexts.采购合同 },
  { title: '广告投放合作协议审查', time: '昨天 18:06', status: '已完成', type: '合作协议', risk: '中风险', owner: '市场部', pages: 12, originalText: sampleContractTexts.合作协议 },
  { title: '招投标文件合规检查', time: '06-24 09:18', status: '已完成', type: '招投标文件', risk: '低风险', owner: '商务部', pages: 34, originalText: sampleContractTexts.招投标文件 },
]

const reviewSteps = ['合同概览', '关键信息', '审查清单', '审查结果']

const formatRuleCreatedAt = (value) => {
  if (!value) return ''
  const createdAt = new Date(value)
  if (Number.isNaN(createdAt.getTime())) return ''
  return createdAt.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

const normalizeSavedRule = (rule) => ({
  id: rule.id,
  name: rule.name,
  risk: rule.risk,
  description: rule.description,
  group: rule.group,
  createdAt: formatRuleCreatedAt(rule.created_at),
})

const extractDocxText = async (file) => {
  const zip = await JSZip.loadAsync(file)
  const documentXml = await zip.file('word/document.xml')?.async('string')
  if (!documentXml) return ''
  const xml = new DOMParser().parseFromString(documentXml, 'application/xml')
  const paragraphs = Array.from(xml.getElementsByTagName('w:p'))
  return paragraphs
    .map((paragraph) => Array.from(paragraph.getElementsByTagName('w:t')).map((node) => node.textContent || '').join(''))
    .filter(Boolean)
    .join('\n\n')
}

const extractContractOriginalText = async (file) => {
  const fileName = file.name.toLowerCase()
  if (fileName.endsWith('.docx')) {
    const text = await extractDocxText(file)
    return text || '未能从该 Word 文件中解析出正文，请在右侧基于合同内容手动添加批注。'
  }
  if (file.type.startsWith('text/') || /\.(txt|md|csv|json)$/i.test(file.name)) {
    return file.text()
  }
  return '当前文件格式暂不支持在浏览器内直接预览原文，请在右侧根据合同内容添加批注。'
}

const reviewRules = [
  { text: '在合同提供服务方义务条款中，审查提供服务方的义务', level: 'pass', count: 0 },
  { text: '在合同解除条款中，审查解除条件', level: 'high', count: 1 },
  { text: '在合同承揽方式条款中，明确承揽方式', level: 'pass', count: 0 },
  { text: '在合同项目期限、地点条款中，明确服务期限、地点', level: 'pass', count: 0 },
  { text: '在合同费用及支付条款中，费用支付条款审查', level: 'pass', count: 0 },
  { text: '在合同交付验收条款中，明确成果交付与验收流程', level: 'high', count: 1 },
  { text: '在合同知识产权条款中，知识产权归属', level: 'high', count: 1 },
  { text: '在合同售后维护条款中，明确售后服务细则', level: 'medium', count: 1 },
  { text: '在合同网络与数据安全条款中，审查网络安全事项', level: 'high', count: 1 },
]

const UploadIcon = () => (
  <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 16V4" />
    <path d="m7 9 5-5 5 5" />
    <path d="M20 16.5v2.75A1.75 1.75 0 0 1 18.25 21H5.75A1.75 1.75 0 0 1 4 19.25V16.5" />
  </svg>
)

const ClockIcon = () => (
  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
)

const SearchIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </svg>
)

const defaultAnnotationDraft = {
  issueType: '权责边界不清',
  risk: '中风险',
  issue: '',
  suggestion: '',
  rulePoint: '',
}

const annotationIssueTypes = ['权责边界不清', '付款条件缺失', '验收标准缺失', '违约责任不足', '交付范围不清', '数据安全风险', '知识产权风险', '其它']
const annotationRisks = ['高风险', '中风险', '低风险']
const contractTypes = ['服务合同', '采购合同', '销售合同', '技术开发合同', '劳动合同', '租赁合同', '保密协议', '其它']

const ruleSuggestionTemplates = {
  权责边界不清: {
    issue: '条款未明确双方权利义务、责任边界或触发条件，后续履约时容易产生争议。',
    suggestion: '建议补充双方具体职责、交付边界、配合义务及责任承担方式，并明确触发条件。',
    rule: '合同条款应明确双方权利义务、履约边界、触发条件及责任承担方式，避免仅作原则性约定。',
  },
  付款条件缺失: {
    issue: '付款节点未与验收标准、交付成果或付款前置条件绑定，付款依据不充分。',
    suggestion: '建议将付款条件调整为在对应成果交付并验收通过后支付，同时明确逾期付款责任。',
    rule: '付款条款必须绑定明确的交付成果、验收标准和付款前置条件，并约定逾期付款责任。',
  },
  验收标准缺失: {
    issue: '验收标准、验收周期或验收不通过后的处理机制不明确。',
    suggestion: '建议补充可执行的验收标准、验收期限、异议反馈方式以及整改复验机制。',
    rule: '涉及交付成果的条款应约定验收标准、验收期限、异议反馈和整改复验机制。',
  },
  违约责任不足: {
    issue: '违约责任缺少计算标准、赔偿范围或处理路径，约束力不足。',
    suggestion: '建议补充违约金计算方式、损失赔偿范围、整改期限和解除权触发条件。',
    rule: '违约责任条款应明确违约情形、违约金或赔偿计算标准、整改期限及解除权触发条件。',
  },
  交付范围不清: {
    issue: '服务内容、交付成果、交付时间或交付边界描述不清。',
    suggestion: '建议补充具体服务清单、交付物、交付时间、排除事项和变更确认机制。',
    rule: '服务或项目交付条款应明确交付范围、交付物、交付时间、排除事项及变更确认机制。',
  },
  数据安全风险: {
    issue: '数据处理权限、保密义务、安全措施或数据泄露责任约定不足。',
    suggestion: '建议补充数据使用范围、访问权限、安全保护措施、泄露通知和责任承担方式。',
    rule: '涉及数据处理的条款应明确数据使用范围、访问权限、安全保护措施、泄露通知及责任承担。',
  },
  知识产权风险: {
    issue: '知识产权归属、授权范围、第三方侵权责任或成果使用权约定不清。',
    suggestion: '建议明确交付成果知识产权归属、授权范围、使用限制和第三方侵权责任。',
    rule: '涉及交付成果的条款应明确知识产权归属、授权范围、使用限制及第三方侵权责任。',
  },
  其它: {
    issue: '条款表述不够完整，可能影响后续履约、追责或规则化审查。',
    suggestion: '建议补充清晰、可执行、可验证的条件、标准、责任和处理机制。',
    rule: '合同条款应具备清晰的适用条件、执行标准、责任边界和争议处理机制。',
  },
}

const buildGeneratedAnnotationDraft = ({ issueType, risk, issue, suggestion, selectedText }) => {
  const template = ruleSuggestionTemplates[issueType] || ruleSuggestionTemplates.其它
  const clausePrefix = selectedText ? '针对选中条款，' : ''
  const nextIssue = issue.trim() || `${clausePrefix}${template.issue}`
  const nextSuggestion = suggestion.trim() || template.suggestion
  return {
    issue: nextIssue,
    suggestion: nextSuggestion,
    rulePoint: `${template.rule} 风险等级建议标记为${risk}。`,
  }
}

const ContractReviewAgent = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const fileInputRef = useRef(null)
  const parseFileInputRef = useRef(null)
  const reviewParagraphRefs = useRef({})
  const [activeType, setActiveType] = useState(reviewTypes[0])
  const [activeReviewStep, setActiveReviewStep] = useState(0)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [contractHistoryItems, setContractHistoryItems] = useState(historyItems)
  const [reviewResult, setReviewResult] = useState(null)
  const [reviewPosition, setReviewPosition] = useState(reviewPositions[0])
  const [reviewScale, setReviewScale] = useState(reviewScales[0])
  const [reviewFilter, setReviewFilter] = useState(reviewFilters[0])
  const [selectedReviewAnnotationId, setSelectedReviewAnnotationId] = useState(null)
  const [annotationStatuses, setAnnotationStatuses] = useState({})
  const [annotationSuggestionDrafts, setAnnotationSuggestionDrafts] = useState({})
  const [reviewContextMenu, setReviewContextMenu] = useState(null)
  const [manualReviewAnnotationDraft, setManualReviewAnnotationDraft] = useState(null)
  const [selectedKeyInfoId, setSelectedKeyInfoId] = useState(null)
  const [ruleGroups, setRuleGroups] = useState([])
  const [activeRuleGroup, setActiveRuleGroup] = useState('')
  const [groupName, setGroupName] = useState('')
  const [savedRules, setSavedRules] = useState([])
  const [selectedRuleId, setSelectedRuleId] = useState(null)
  const [ruleForm, setRuleForm] = useState({ name: '', risk: '高风险', description: '' })
  const [ruleAnalyses, setRuleAnalyses] = useState({})
  const [parseContracts, setParseContracts] = useState([])
  const [annotationContractIndex, setAnnotationContractIndex] = useState(null)
  const [selectedOriginalText, setSelectedOriginalText] = useState('')
  const [annotationDraft, setAnnotationDraft] = useState(defaultAnnotationDraft)
  const [annotationFormCollapsed, setAnnotationFormCollapsed] = useState(false)
  const [groupModalOpen, setGroupModalOpen] = useState(false)
  const [ruleModalOpen, setRuleModalOpen] = useState(false)
  const [parseModalOpen, setParseModalOpen] = useState(false)
  const isRuleModule = location.pathname === '/contract-review-rules'
  const visibleRules = activeRuleGroup ? savedRules.filter((rule) => rule.group === activeRuleGroup) : savedRules
  const selectedRule = savedRules.find((rule) => rule.id === selectedRuleId)
  const selectedRuleAnalyses = selectedRuleId ? ruleAnalyses[selectedRuleId] || [] : []
  const annotationContract = annotationContractIndex === null ? null : parseContracts[annotationContractIndex]
  const reviewAnnotations = reviewResult?.reviewAnnotations || []
  const keyInformationItems = reviewResult?.keyInformationItems || []
  const selectedKeyInfo = keyInformationItems.find((item) => item.id === selectedKeyInfoId) || keyInformationItems[0]
  const processedAnnotationCount = reviewAnnotations.filter((annotation) => ['accepted', 'ignored'].includes(annotationStatuses[annotation.id])).length
  const filteredReviewAnnotations = reviewAnnotations.filter((annotation) => {
    const status = annotationStatuses[annotation.id] || 'pending'
    if (reviewFilter === '全部') return true
    if (reviewFilter === '已处理') return ['accepted', 'ignored'].includes(status)
    return annotation.level === reviewFilter
  })
  const selectedReviewAnnotation = filteredReviewAnnotations.find((annotation) => annotation.id === selectedReviewAnnotationId) || filteredReviewAnnotations[0] || reviewAnnotations[0]
  const reviewRiskCounts = reviewAnnotations.reduce((counts, annotation) => ({
    ...counts,
    [annotation.level]: (counts[annotation.level] || 0) + 1,
  }), {})

  useEffect(() => {
    if (!isRuleModule) return

    let ignore = false
    const loadContractReviewRules = async () => {
      try {
        const [groups, rules] = await Promise.all([
          fetchContractRuleGroups(),
          fetchContractReviewRules(),
        ])
        if (ignore) return
        const groupNames = groups.map((group) => group.name)
        const normalizedRules = rules.map(normalizeSavedRule)
        setRuleGroups(groupNames)
        setSavedRules(normalizedRules)
        setActiveRuleGroup((currentGroup) => currentGroup || groupNames[0] || '')
        setSelectedRuleId((currentRuleId) => currentRuleId || normalizedRules[0]?.id || null)
      } catch (error) {
        console.error('Failed to load contract review rules', error)
      }
    }

    loadContractReviewRules()
    return () => {
      ignore = true
    }
  }, [isRuleModule])

  useEffect(() => {
    if (!isRuleModule || !selectedRuleId || ruleAnalyses[selectedRuleId]) return

    let ignore = false
    const loadRuleAnalyses = async () => {
      try {
        const analyses = await fetchContractRuleAnalyses(selectedRuleId)
        if (ignore) return
        setRuleAnalyses((currentAnalyses) => ({ ...currentAnalyses, [selectedRuleId]: analyses }))
      } catch (error) {
        console.error('Failed to load contract rule analyses', error)
      }
    }

    loadRuleAnalyses()
    return () => {
      ignore = true
    }
  }, [isRuleModule, selectedRuleId, ruleAnalyses])

  const handleCloseGroupModal = () => {
    setGroupName('')
    setGroupModalOpen(false)
  }

  const handleCreateRuleGroup = async () => {
    const nextGroupName = groupName.trim()
    if (!nextGroupName) return
    try {
      const createdGroup = await createContractRuleGroup({ name: nextGroupName })
      setRuleGroups((groups) => groups.includes(createdGroup.name) ? groups : [createdGroup.name, ...groups])
      setActiveRuleGroup(createdGroup.name)
      setGroupName('')
      setGroupModalOpen(false)
    } catch (error) {
      console.error('Failed to create contract rule group', error)
    }
  }

  const handleOpenRuleModal = () => {
    if (!activeRuleGroup && ruleGroups.length > 0) {
      setActiveRuleGroup(ruleGroups[0])
    }
    setRuleModalOpen(true)
  }

  const handleCloseRuleModal = () => {
    setRuleForm({ name: '', risk: '高风险', description: '' })
    setRuleModalOpen(false)
  }

  const handleSaveRule = async () => {
    const ruleName = ruleForm.name.trim()
    const ruleDescription = ruleForm.description.trim()
    if (!ruleName || !ruleDescription || !activeRuleGroup) return
    try {
      const createdRule = await createContractReviewRule({
        name: ruleName,
        risk: ruleForm.risk,
        description: ruleDescription,
        groupName: activeRuleGroup,
      })
      const nextRule = normalizeSavedRule(createdRule)
      setSavedRules((rules) => [nextRule, ...rules])
      setSelectedRuleId(nextRule.id)
      handleCloseRuleModal()
    } catch (error) {
      console.error('Failed to create contract review rule', error)
    }
  }

  const handleOpenParseModal = () => {
    if (!selectedRule) return
    setParseContracts([])
    setParseModalOpen(true)
  }

  const handleCloseParseModal = () => {
    setParseContracts([])
    setAnnotationContractIndex(null)
    setSelectedOriginalText('')
    setAnnotationDraft(defaultAnnotationDraft)
    setAnnotationFormCollapsed(false)
    setParseModalOpen(false)
    if (parseFileInputRef.current) {
      parseFileInputRef.current.value = ''
    }
  }

  const handleParseContractFiles = async (event) => {
    const files = Array.from(event.target.files || [])
    if (files.length === 0) return
    const importedContracts = await Promise.all(files.map(async (file) => ({
      contract_name: file.name,
      contract_type: '服务合同',
      original_text: await extractContractOriginalText(file),
      issue_comment: '',
      adjustment_suggestion: '',
      annotations: [],
    })))
    setParseContracts((contracts) => [
      ...contracts,
      ...importedContracts,
    ])
    event.target.value = ''
  }

  const handleUpdateParseContract = (index, field, value) => {
    setParseContracts((contracts) => contracts.map((contract, contractIndex) => (
      contractIndex === index ? { ...contract, [field]: value } : contract
    )))
  }

  const handleRemoveParseContract = (index) => {
    setParseContracts((contracts) => contracts.filter((_, contractIndex) => contractIndex !== index))
  }

  const handleUpdateAnnotationContract = (field, value) => {
    if (annotationContractIndex === null) return
    setParseContracts((contracts) => contracts.map((contract, contractIndex) => (
      contractIndex === annotationContractIndex ? { ...contract, [field]: value } : contract
    )))
  }

  const handleOpenAnnotationPage = (index) => {
    setAnnotationContractIndex(index)
    setSelectedOriginalText('')
    setAnnotationDraft(defaultAnnotationDraft)
    setAnnotationFormCollapsed(false)
  }

  const handleCloseAnnotationPage = () => {
    setAnnotationContractIndex(null)
    setSelectedOriginalText('')
    setAnnotationDraft(defaultAnnotationDraft)
    setAnnotationFormCollapsed(false)
  }

  const handleCaptureOriginalSelection = () => {
    const selectedText = window.getSelection?.().toString().trim()
    if (selectedText) {
      setSelectedOriginalText(selectedText)
    }
  }

  const handleAddAnnotation = () => {
    if (annotationContractIndex === null || (!annotationDraft.issue.trim() && !annotationDraft.suggestion.trim() && !annotationDraft.rulePoint.trim())) return
    const nextAnnotation = {
      excerpt: selectedOriginalText,
      issue_type: annotationDraft.issueType,
      contract_type: annotationContract?.contract_type || '服务合同',
      risk: annotationDraft.risk,
      issue: annotationDraft.issue.trim(),
      suggestion: annotationDraft.suggestion.trim(),
      rule_point: annotationDraft.rulePoint.trim(),
      created_at: new Date().toLocaleString('zh-CN', { hour12: false }),
    }
    setParseContracts((contracts) => contracts.map((contract, contractIndex) => {
      if (contractIndex !== annotationContractIndex) return contract
      const issuePrefix = nextAnnotation.excerpt ? `【原文】${nextAnnotation.excerpt}\n` : ''
      const issueLines = [
        issuePrefix && issuePrefix.trimEnd(),
        `【合同类型】${nextAnnotation.contract_type}`,
        `【问题类型】${nextAnnotation.issue_type}`,
        `【风险等级】${nextAnnotation.risk}`,
        nextAnnotation.issue && `【存在问题】${nextAnnotation.issue}`,
        nextAnnotation.rule_point && `【可沉淀规则】${nextAnnotation.rule_point}`,
      ].filter(Boolean).join('\n')
      const suggestionLines = [
        contract.adjustment_suggestion,
        nextAnnotation.suggestion && `【建议调整为】${nextAnnotation.suggestion}`,
      ].filter(Boolean).join('\n\n')
      const nextIssueComment = [contract.issue_comment, issueLines].filter(Boolean).join('\n\n')
      return {
        ...contract,
        issue_comment: nextIssueComment,
        adjustment_suggestion: suggestionLines,
        annotations: [...(contract.annotations || []), nextAnnotation],
      }
    }))
    setAnnotationDraft(defaultAnnotationDraft)
    setSelectedOriginalText('')
    setAnnotationFormCollapsed(true)
  }

  const handleGenerateRulePoint = () => {
    const generatedDraft = buildGeneratedAnnotationDraft({
      issueType: annotationDraft.issueType,
      risk: annotationDraft.risk,
      issue: annotationDraft.issue,
      suggestion: annotationDraft.suggestion,
      selectedText: selectedOriginalText,
    })
    setAnnotationDraft((draft) => ({
      ...draft,
      issue: generatedDraft.issue,
      suggestion: generatedDraft.suggestion,
      rulePoint: generatedDraft.rulePoint,
    }))
  }

  const handleDeleteAnnotation = (annotationIndex) => {
    if (annotationContractIndex === null) return
    setParseContracts((contracts) => contracts.map((contract, contractIndex) => {
      if (contractIndex !== annotationContractIndex) return contract
      const nextAnnotations = (contract.annotations || []).filter((_, index) => index !== annotationIndex)
      return {
        ...contract,
        annotations: nextAnnotations,
      }
    }))
  }

  const handleSaveParseContracts = async () => {
    if (!selectedRuleId || parseContracts.length === 0) return
    try {
      const createdAnalyses = await createContractRuleAnalyses({ ruleId: selectedRuleId, contracts: parseContracts })
      setRuleAnalyses((currentAnalyses) => ({
        ...currentAnalyses,
        [selectedRuleId]: [...createdAnalyses, ...(currentAnalyses[selectedRuleId] || [])],
      }))
      handleCloseParseModal()
    } catch (error) {
      console.error('Failed to save contract rule analyses', error)
    }
  }

  const buildReviewResult = (contract, isRestart = false) => {
    const contractType = contract.type || inferContractType(contract.title)
    const originalText = contract.originalText || sampleContractTexts[inferContractType(contract.title)] || '暂无可预览的合同原文，请重新上传 docx 或文本格式合同。'
    return {
      fileName: contract.title,
      contractType,
      originalText,
      keyInformationItems: buildKeyInformationItems(originalText),
      reviewAnnotations: buildReviewAnnotations(originalText),
      level: contract.risk || '中风险',
      overview: `系统已读取《${contract.title}》，当前合同类型为${contractType}。建议重点关注付款条件、交付验收、违约责任、知识产权归属和解除条款。`,
      summary: isRestart
        ? '已重新发起智能审查，系统将基于最新审查规则重新识别付款、违约、解除和交付验收风险。'
        : activeType === '对比审查'
          ? '已识别两份文件中的关键条款差异，建议重点复核付款条件、违约责任和终止条款。'
          : '已识别合同中的付款周期、违约责任和单方解除条款风险，建议补充责任边界和争议解决约定。',
      items: ['付款周期缺少逾期处理规则', '违约责任上限约定不清晰', '单方解除触发条件过宽'],
    }
  }

  const resetReviewWorkbench = (nextReviewResult) => {
    setReviewFilter(reviewFilters[0])
    setAnnotationStatuses({})
    setAnnotationSuggestionDrafts({})
    setReviewContextMenu(null)
    setManualReviewAnnotationDraft(null)
    setSelectedKeyInfoId(nextReviewResult?.keyInformationItems?.[0]?.id || null)
    setSelectedReviewAnnotationId(nextReviewResult?.reviewAnnotations?.[0]?.id || null)
  }

  const handleSelectKeyInfo = (item) => {
    setActiveReviewStep(1)
    setSelectedKeyInfoId(item.id)
    window.requestAnimationFrame(() => {
      reviewParagraphRefs.current[item.paragraphIndex]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
  }

  const handleUpdateKeyInfo = (itemId, field, value) => {
    setReviewResult((result) => result ? {
      ...result,
      keyInformationItems: (result.keyInformationItems || []).map((item) => (
        item.id === itemId ? { ...item, [field]: value } : item
      )),
    } : result)
  }

  const handleSelectReviewAnnotation = (annotation) => {
    setActiveReviewStep(3)
    setManualReviewAnnotationDraft(null)
    setSelectedReviewAnnotationId(annotation.id)
    window.requestAnimationFrame(() => {
      reviewParagraphRefs.current[annotation.paragraphIndex]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
  }

  const handleOpenReviewContextMenu = (event, paragraphIndex) => {
    const selectedText = window.getSelection?.().toString().trim()
    if (!selectedText) return
    event.preventDefault()
    setReviewContextMenu({
      x: event.clientX,
      y: event.clientY,
      paragraphIndex,
      selectedText,
    })
  }

  const handleCopyReviewSelection = async () => {
    if (!reviewContextMenu?.selectedText) return
    try {
      await navigator.clipboard?.writeText(reviewContextMenu.selectedText)
    } catch (error) {
      console.error('Failed to copy selected contract text', error)
    }
    setReviewContextMenu(null)
  }

  const handleStartManualReviewAnnotation = () => {
    if (!reviewContextMenu) return
    const selectedText = reviewContextMenu.selectedText
    setManualReviewAnnotationDraft({
      paragraphIndex: reviewContextMenu.paragraphIndex,
      excerpt: selectedText,
      level: '中风险',
      title: '人工标注风险',
      comment: selectedText ? `请复核选中条款：“${selectedText.slice(0, 60)}${selectedText.length > 60 ? '...' : ''}”` : '',
      suggestion: '',
    })
    setSelectedReviewAnnotationId(null)
    setActiveReviewStep(3)
    setReviewContextMenu(null)
  }

  const handleUpdateManualReviewAnnotation = (field, value) => {
    setManualReviewAnnotationDraft((draft) => draft ? { ...draft, [field]: value } : draft)
  }

  const handleSaveManualReviewAnnotation = () => {
    if (!manualReviewAnnotationDraft || !reviewResult) return
    const nextAnnotation = {
      id: `manual-review-${Date.now()}`,
      paragraphIndex: manualReviewAnnotationDraft.paragraphIndex,
      level: manualReviewAnnotationDraft.level,
      title: manualReviewAnnotationDraft.title.trim() || '人工标注风险',
      comment: manualReviewAnnotationDraft.comment.trim() || '人工补充的合同审查意见。',
      suggestion: manualReviewAnnotationDraft.suggestion.trim() || '请结合业务背景补充建议修改文本。',
      excerpt: manualReviewAnnotationDraft.excerpt,
      terms: [],
      source: 'manual',
    }
    setReviewResult((result) => result ? {
      ...result,
      reviewAnnotations: [...(result.reviewAnnotations || []), nextAnnotation],
    } : result)
    setAnnotationStatuses((statuses) => ({ ...statuses, [nextAnnotation.id]: 'pending' }))
    setSelectedReviewAnnotationId(nextAnnotation.id)
    setManualReviewAnnotationDraft(null)
    window.requestAnimationFrame(() => {
      reviewParagraphRefs.current[nextAnnotation.paragraphIndex]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
  }

  const handleUpdateAnnotationStatus = (annotationId, status) => {
    setAnnotationStatuses((statuses) => ({ ...statuses, [annotationId]: status }))
  }

  const handleUpdateSuggestionDraft = (annotationId, value) => {
    setAnnotationSuggestionDrafts((drafts) => ({ ...drafts, [annotationId]: value }))
  }

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0]
    if (file) {
      const originalText = await extractContractOriginalText(file)
      const contractType = inferContractType(file.name)
      const nextContract = {
        title: file.name,
        time: '刚刚',
        status: '待审查',
        type: contractType,
        risk: '待评估',
        owner: '本次上传',
        pages: Math.max(1, Math.ceil(originalText.length / 900)),
        originalText,
      }
      setContractHistoryItems((items) => [nextContract, ...items])
      setReviewResult(null)
      resetReviewWorkbench(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleNewReview = () => {
    setReviewResult(null)
    setActiveReviewStep(0)
    resetReviewWorkbench(null)
  }

  const handleOpenHistoryItem = (item) => {
    const nextReviewResult = buildReviewResult(item)
    setReviewResult(nextReviewResult)
    resetReviewWorkbench(nextReviewResult)
    setActiveReviewStep(item.status === '待审查' ? 0 : 3)
    setHistoryOpen(false)
  }

  const handleRestartReview = (item) => {
    const nextReviewResult = buildReviewResult(item, true)
    setReviewResult(nextReviewResult)
    resetReviewWorkbench(nextReviewResult)
    setActiveReviewStep(0)
    setHistoryOpen(false)
  }

  return (
    <div className="flex h-screen bg-white">
      <Sidebar
        onSelectMember={(id) => navigate('/chat-workspace', { state: { activeMember: id } })}
        onAddEmployee={() => navigate('/add-silicon-worker')}
        compact
      />
      <ProjectSideMenu title="法务审查" subtitle="合同与法律风险" items={legalMenuItems} />
      {historyOpen && (
        <aside className="flex h-screen w-[336px] flex-shrink-0 flex-col border-r border-[#e6eaf2] bg-white">
          <div className="flex items-center justify-between border-b border-[#e6eaf2] px-6 py-5">
            <div className="relative text-sm font-semibold text-[#111827]">
              历史
              <span className="absolute -bottom-5 left-0 h-[3px] w-full rounded-full bg-[#2563eb]" />
            </div>
            <button
              type="button"
              onClick={() => setHistoryOpen(false)}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-[#111827] transition hover:bg-[#f1f5f9]"
              aria-label="关闭历史记录"
            >
              <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-5">
            <div className="flex items-center gap-3">
              <div className="flex flex-1 rounded-xl bg-[#edf1f7] p-1">
                {reviewTypes.map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setActiveType(type)}
                    className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition ${
                      activeType === type
                        ? 'bg-white text-[#2563eb] shadow-sm'
                        : 'text-[#4b5563] hover:text-[#111827]'
                    }`}
                  >
                    {type.replace('法律', '')}
                  </button>
                ))}
              </div>
              <button type="button" className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#e0e6ef] bg-white text-[#111827] transition hover:bg-[#f8fafc]">
                <SearchIcon />
              </button>
            </div>

            <div className="mt-6 space-y-2">
              {historyItems.map((item) => (
                <button key={item.title} type="button" onClick={() => handleOpenHistoryItem(item)} className="w-full rounded-xl px-3 py-3 text-left transition hover:bg-[#f8fafc]">
                  <div className="text-sm font-medium leading-5 text-[#202633]">{item.title}</div>
                  <div className="mt-2 flex items-center gap-2 text-xs text-[#94a3b8]">
                    <ClockIcon />
                    <span>{item.time}</span>
                    <span className="ml-auto rounded-full bg-[#eefbf4] px-2 py-1 font-semibold text-[#067647]">{item.status}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </aside>
      )}
      <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden bg-white">
        <main className="flex-1 overflow-y-auto px-8 py-6">
          {!historyOpen && !isRuleModule && !reviewResult && (
            <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx" onChange={handleFileChange} className="hidden" />
          )}

          {isRuleModule && (
            <section className="-mx-8 -my-6 grid h-full min-h-[720px] grid-cols-[252px_minmax(520px,1fr)_440px] bg-white text-[#111827]">
              <aside className="border-r border-[#e5eaf3] px-7 py-6">
                <div className="flex items-center justify-between">
                  <h1 className="text-xl font-semibold tracking-tight text-gray-900">规则分组</h1>
                  <button type="button" onClick={() => setGroupModalOpen(true)} className="inline-flex items-center gap-1 text-sm font-medium text-[#1769ff] transition hover:text-[#0f56d9]">
                    <span className="text-base leading-none">+</span>
                    新建
                  </button>
                </div>

                {ruleGroups.length > 0 ? (
                  <nav className="mt-6 space-y-3">
                    {ruleGroups.map((group) => (
                      <button
                        key={group}
                        type="button"
                        onClick={() => setActiveRuleGroup(group)}
                        className={`h-11 w-full rounded-lg px-5 text-left text-sm transition ${
                          activeRuleGroup === group
                            ? 'bg-[#edf4ff] font-medium text-[#1769ff]'
                            : 'font-medium text-gray-500 hover:bg-[#f6f8fb] hover:text-gray-900'
                        }`}
                      >
                        {group}
                      </button>
                    ))}
                  </nav>
                ) : (
                  <div className="mt-12 rounded-xl border border-dashed border-[#dfe5ef] bg-[#fbfcff] px-4 py-6 text-center text-sm leading-6 text-gray-500">
                    暂无规则分组<br />点击“新建”创建分组
                  </div>
                )}
              </aside>

              <section className="flex min-w-0 flex-col border-r border-[#e5eaf3] px-8 py-5">
                <div className="flex items-center justify-between gap-4">
                  <h2 className="shrink-0 whitespace-nowrap text-xl font-semibold tracking-tight text-gray-900">审查规则</h2>
                  <div className="flex min-w-0 items-center gap-2">
                    <button type="button" className="inline-flex h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-lg border border-[#dfe6f2] bg-white px-4 text-sm font-medium text-gray-900 transition hover:bg-[#f8fafc] [&_svg]:h-5 [&_svg]:w-5">
                      <UploadIcon />
                      上传规则文档
                    </button>
                    <button type="button" onClick={handleOpenParseModal} disabled={!selectedRule} className={`inline-flex h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-4 text-sm font-medium transition ${selectedRule ? 'border border-[#1769ff] bg-white text-[#1769ff] hover:bg-[#f3f7ff]' : 'cursor-not-allowed border border-[#dfe6f2] bg-[#fbfcff] text-[#aeb7c5]'}`}>
                      解析规则
                    </button>
                    <button type="button" onClick={handleOpenRuleModal} className="inline-flex h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-lg bg-[#1f6feb] px-5 text-sm font-medium text-white shadow-[0_8px_18px_rgba(31,111,235,0.24)] transition hover:bg-[#185dcc]">
                      <span className="text-lg font-light leading-none">+</span>
                      新建规则
                    </button>
                  </div>
                </div>

                <div className="relative mt-6">
                  <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#9aa4b2]"><SearchIcon /></span>
                  <input
                    type="text"
                    placeholder="请输入规则名称或描述关键字以搜索"
                    className="h-10 w-full rounded-lg border border-[#dfe6f2] bg-white pl-12 pr-4 text-sm text-[#111827] outline-none transition placeholder:text-[#a8b1c0] focus:border-[#8bb5ff] focus:ring-4 focus:ring-[#edf4ff]"
                  />
                </div>

                {visibleRules.length > 0 ? (
                  <div className="mt-6 overflow-y-auto pb-6">
                    {visibleRules.map((rule) => (
                      <button
                        key={rule.id}
                        type="button"
                        onClick={() => setSelectedRuleId(rule.id)}
                        className={`flex h-[58px] w-full items-center gap-4 rounded-xl px-5 text-left transition ${
                          selectedRuleId === rule.id
                            ? 'bg-[#eef6ff]'
                            : 'bg-white hover:bg-[#f7fbff]'
                        }`}
                      >
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-[#d8dde6] bg-white" />
                        <span className={`shrink-0 rounded-full border px-3 py-1 text-sm font-medium ${rule.risk === '高风险' ? 'border-[#ff9ca3] bg-[#fff4f4] text-[#f40b0b]' : rule.risk === '中风险' ? 'border-[#ffc08a] bg-[#fff7ed] text-[#f97316]' : 'border-[#86efac] bg-[#f0fdf4] text-[#16a34a]'}`}>{rule.risk}</span>
                        <span className={`min-w-0 flex-1 truncate text-sm ${selectedRuleId === rule.id ? 'text-[#1769ff]' : 'text-gray-900'}`}>{rule.name}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-1 flex-col items-center justify-center pb-20 text-center">
                    <div className="relative h-24 w-28 text-[#d6d8dc]">
                      <div className="absolute left-5 top-8 h-11 w-16 rounded-b-xl rounded-t-sm bg-gradient-to-b from-[#efefef] to-[#d9d9d9] shadow-sm" />
                      <div className="absolute left-3 top-7 h-2 w-20 rounded-t-full bg-[#cfcfcf]" />
                      <div className="absolute left-16 top-10 h-8 w-8 rounded-lg bg-white shadow-sm ring-1 ring-[#e5e7eb]">
                        <span className="absolute left-2 top-1.5 h-1.5 w-1.5 rounded-full bg-[#6fa2ff]" />
                        <span className="absolute left-4 top-1.5 h-1.5 w-3 rounded-full bg-[#6fa2ff]" />
                        <span className="absolute left-2 top-3.5 h-1.5 w-1.5 rounded-full bg-[#6fa2ff]" />
                        <span className="absolute left-4 top-3.5 h-1.5 w-3 rounded-full bg-[#6fa2ff]" />
                        <span className="absolute left-2 top-5.5 h-1.5 w-1.5 rounded-full bg-[#6fa2ff]" />
                        <span className="absolute left-4 top-5.5 h-1.5 w-3 rounded-full bg-[#6fa2ff]" />
                      </div>
                      <span className="absolute left-9 top-1 h-4 w-1.5 -rotate-12 rounded-full bg-[#d0d0d0]" />
                      <span className="absolute left-14 top-0 h-4 w-1.5 rounded-full bg-[#d0d0d0]" />
                      <span className="absolute left-20 top-3 h-4 w-1.5 rotate-45 rounded-full bg-[#d0d0d0]" />
                    </div>
                    <div className="mt-3 text-sm font-semibold text-gray-900">暂无数据</div>
                    <p className="mt-3 text-sm text-gray-600">点击右上方“新建规则”，创建专属文件审查标准</p>
                  </div>
                )}
              </section>

              <aside className="flex min-w-0 flex-col px-10 py-5">
                <div className="flex items-center justify-between gap-4">
                  <h2 className="text-xl font-semibold tracking-tight text-gray-900">规则详情</h2>
                  <div className="flex items-center gap-3">
                    <button type="button" className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#dfe6f2] text-[#a0a9b8] transition hover:bg-[#f8fafc]" aria-label="更多操作">
                      <span className="text-xl leading-none">...</span>
                    </button>
                    <button type="button" disabled className="inline-flex h-10 cursor-not-allowed items-center gap-2 rounded-lg border border-[#dfe6f2] bg-[#fbfcff] px-6 text-sm font-medium text-[#aeb7c5]">
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 20h9" />
                        <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                      </svg>
                      编辑
                    </button>
                  </div>
                </div>

                {selectedRule ? (
                  <div className="mt-8 space-y-6 text-sm">
                    <div>
                      <div className="text-xs font-medium text-gray-400">规则名称</div>
                      <div className="mt-2 font-semibold leading-6 text-gray-900">{selectedRule.name}</div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-xs font-medium text-gray-400">风险等级</div>
                        <span className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${selectedRule.risk === '高风险' ? 'bg-[#fff1f1] text-[#f40b0b]' : selectedRule.risk === '中风险' ? 'bg-[#fff7ed] text-[#ea580c]' : 'bg-[#f0fdf4] text-[#16a34a]'}`}>{selectedRule.risk}</span>
                      </div>
                      <div>
                        <div className="text-xs font-medium text-gray-400">规则分组</div>
                        <div className="mt-2 font-medium text-gray-800">{selectedRule.group}</div>
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-medium text-gray-400">规则描述</div>
                      <p className="mt-2 whitespace-pre-wrap leading-6 text-gray-700">{selectedRule.description}</p>
                    </div>
                    <div>
                      <div className="flex items-center justify-between">
                        <div className="text-xs font-medium text-gray-400">解析记录</div>
                        <button type="button" onClick={handleOpenParseModal} className="text-xs font-medium text-[#1769ff] transition hover:text-[#0f56d9]">新增解析</button>
                      </div>
                      {selectedRuleAnalyses.length > 0 ? (
                        <div className="mt-3 space-y-3">
                          {selectedRuleAnalyses.map((analysis) => (
                            <div key={analysis.id} className="rounded-xl border border-[#e5eaf3] bg-[#fbfcff] p-4">
                              <div className="truncate text-sm font-medium text-gray-900">{analysis.contract_name}</div>
                              <div className="mt-3 space-y-3 text-sm leading-6 text-gray-700">
                                <div>
                                  <div className="text-xs font-medium text-gray-400">存在问题</div>
                                  <p className="mt-1 whitespace-pre-wrap">{analysis.issue_comment || '暂未填写'}</p>
                                </div>
                                <div>
                                  <div className="text-xs font-medium text-gray-400">调整建议</div>
                                  <p className="mt-1 whitespace-pre-wrap">{analysis.adjustment_suggestion || '暂未填写'}</p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="mt-3 rounded-xl border border-dashed border-[#dfe5ef] bg-[#fbfcff] px-4 py-5 text-center text-sm text-gray-500">暂无解析记录</div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-1 items-center justify-center pb-14 text-center">
                    <button type="button" onClick={handleOpenRuleModal} className="text-sm text-gray-600 transition hover:text-[#1769ff]">点击“新建规则”开始创建审查规则</button>
                  </div>
                )}
              </aside>
            </section>
          )}

          {!isRuleModule && !reviewResult && (
          <section className="mx-auto max-w-[1120px]">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-[#111827]">历史上传合同</h1>
                <p className="mt-2 text-sm text-[#64748b]">查看历史合同，或上传新合同开始审查。</p>
              </div>
              <button type="button" onClick={() => fileInputRef.current?.click()} className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#2563eb] px-4 text-sm font-semibold text-white transition hover:bg-[#1d4ed8]">
                <UploadIcon />
                上传合同
              </button>
            </div>

            <div className="mt-6 overflow-hidden rounded-xl border border-[#e2e8f0] bg-white">
              <div className="grid grid-cols-[minmax(260px,1fr)_120px_100px_160px] gap-4 border-b border-[#edf1f7] bg-[#f8fafc] px-5 py-3 text-xs font-semibold text-[#64748b]">
                <div>合同名称</div>
                <div>合同类型</div>
                <div>状态</div>
                <div className="text-right">操作</div>
              </div>

              <div className="divide-y divide-[#edf1f7]">
                {contractHistoryItems.map((item) => (
                  <div key={`${item.title}-${item.time}`} className="grid grid-cols-[minmax(260px,1fr)_120px_100px_160px] gap-4 px-5 py-4 text-sm transition hover:bg-[#fbfcff]">
                    <div className="min-w-0">
                      <div className="truncate font-medium text-[#111827]">{item.title}</div>
                      <div className="mt-1 text-xs text-[#94a3b8]">{item.time}</div>
                    </div>
                    <div className="text-[#475569]">{item.type}</div>
                    <div>
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${item.status === '已完成' ? 'bg-[#eefbf4] text-[#067647]' : 'bg-[#fff7ed] text-[#ea580c]'}`}>{item.status}</span>
                    </div>
                    <div className="flex justify-end gap-2">
                      <button type="button" onClick={() => handleOpenHistoryItem(item)} className="text-sm font-medium text-[#2563eb] transition hover:text-[#1d4ed8]">
                        {item.status === '待审查' ? '开始审查' : '进入审查'}
                      </button>
                      <button type="button" onClick={() => handleRestartReview(item)} className="text-sm font-medium text-[#64748b] transition hover:text-[#111827]">重新审查</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
          )}

          {!isRuleModule && reviewResult && (
            <section className="-mx-8 -my-6 flex h-full min-h-[760px] flex-col bg-[#f6f8fb]">
              {reviewContextMenu && (
                <div className="fixed z-[80] w-40 overflow-hidden rounded-xl border border-[#dfe6f2] bg-white py-1 text-sm shadow-[0_12px_32px_rgba(15,23,42,0.18)]" style={{ left: reviewContextMenu.x, top: reviewContextMenu.y }}>
                  <button type="button" onClick={handleCopyReviewSelection} className="block w-full px-4 py-2 text-left text-[#334155] transition hover:bg-[#f8fafc]">复制选中内容</button>
                  <button type="button" onClick={handleStartManualReviewAnnotation} className="block w-full px-4 py-2 text-left font-semibold text-[#2563eb] transition hover:bg-[#eff6ff]">增加标注</button>
                </div>
              )}
              <header className="flex h-14 flex-shrink-0 items-center justify-between border-b border-[#dfe5ef] bg-white px-6">
                <div className="flex min-w-0 items-center gap-3">
                  <ClockIcon />
                  <div className="truncate text-sm font-semibold text-[#111827]">{reviewResult.fileName}</div>
                </div>
                <button
                  type="button"
                  onClick={handleNewReview}
                  className="inline-flex h-8 items-center gap-2 rounded-lg bg-[#eef6ff] px-4 text-sm font-semibold text-[#2563eb] transition hover:bg-[#e0efff]"
                >
                  <span className="text-lg leading-none">+</span>
                  新审查
                </button>
              </header>

              <div className="grid min-h-0 flex-1 grid-cols-[minmax(520px,1fr)_minmax(420px,48%)]">
                <div className="min-h-0 overflow-y-auto border-r border-[#e5eaf3] bg-[#f7f9fc] px-8 py-6">
                  <div className="mb-4 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <h2 className="text-lg font-semibold text-gray-900">合同原文</h2>
                      <div className="mt-1 truncate text-xs text-gray-500">{reviewResult.fileName}</div>
                    </div>
                    <span className="shrink-0 rounded-full bg-[#e0edff] px-3 py-1 text-xs font-medium text-[#1769ff]">{reviewResult.contractType}</span>
                  </div>
                  <article onMouseDown={() => setReviewContextMenu(null)} className="min-h-full rounded-xl border border-[#dfe6f2] bg-white px-6 py-5 text-sm leading-7 text-gray-800 shadow-sm selection:bg-[#cfe0ff]">
                    <div className="space-y-4">
                      {splitContractParagraphs(reviewResult.originalText).map((paragraph, paragraphIndex) => {
                        const paragraphAnnotations = activeReviewStep === 1
                          ? keyInformationItems.filter((item) => item.paragraphIndex === paragraphIndex).map((item) => ({ ...item, level: '低风险' }))
                          : activeReviewStep === 3
                            ? (reviewResult.reviewAnnotations || []).filter((annotation) => annotation.paragraphIndex === paragraphIndex)
                            : []
                        const selectedHighlightId = activeReviewStep === 1 ? selectedKeyInfoId : selectedReviewAnnotationId
                        return (
                          <div ref={(node) => { if (node) reviewParagraphRefs.current[paragraphIndex] = node }} key={`${paragraph.slice(0, 18)}-${paragraphIndex}`} onContextMenu={(event) => handleOpenReviewContextMenu(event, paragraphIndex)}>
                            <p className="whitespace-pre-wrap">{renderHighlightedContractText(paragraph, paragraphAnnotations, selectedHighlightId)}</p>
                          </div>
                        )
                      })}
                    </div>
                  </article>
                </div>

                <div className="flex min-w-0 flex-col bg-white">
                  <div className="flex h-14 flex-shrink-0 items-center gap-3 border-b border-[#e6eaf2] px-8">
                    {reviewSteps.map((step, index) => (
                      <button key={step} type="button" onClick={() => setActiveReviewStep(index)} className="flex flex-1 items-center gap-2 text-left text-sm">
                        <span className={`flex h-6 w-6 items-center justify-center rounded-full border text-xs font-semibold ${activeReviewStep === index ? 'border-[#2563eb] bg-[#2563eb] text-white' : 'border-[#aab4c5] text-[#64748b]'}`}>{index + 1}</span>
                        <span className={activeReviewStep === index ? 'font-semibold text-[#111827]' : 'text-[#64748b]'}>{step}</span>
                        {index < reviewSteps.length - 1 && <span className="ml-auto h-px flex-1 bg-[#e6eaf2]" />}
                      </button>
                    ))}
                  </div>

                  <div className="min-h-0 flex-1 overflow-auto bg-[#fbfcff] p-6">
                    {activeReviewStep === 0 && (
                      <div className="space-y-5">
                        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-[#edf1f7]">
                          <h3 className="text-base font-semibold text-[#111827]">审查方式</h3>
                          <div className="mt-5 space-y-5 text-sm text-[#111827]">
                            <div>
                              <div className="mb-2 font-semibold">合同类型</div>
                              <div className="rounded-lg bg-[#f3f4f6] px-4 py-3 text-[#64748b]">{reviewResult.contractType}</div>
                            </div>
                            <div>
                              <div className="mb-2 font-semibold">审查立场</div>
                              <div className="flex flex-wrap gap-3">
                                {reviewPositions.map((position) => (
                                  <button
                                    key={position}
                                    type="button"
                                    onClick={() => setReviewPosition(position)}
                                    className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 transition ${reviewPosition === position ? 'bg-[#eff6ff] font-semibold text-[#2563eb]' : 'text-[#334155] hover:bg-[#f1f5f9]'}`}
                                  >
                                    <span>{reviewPosition === position ? '●' : '○'}</span>
                                    {position}
                                  </button>
                                ))}
                              </div>
                            </div>
                            <div>
                              <div className="mb-2 font-semibold">审查尺度</div>
                              <div className="flex flex-wrap gap-3">
                                {reviewScales.map((scale) => (
                                  <button
                                    key={scale}
                                    type="button"
                                    onClick={() => setReviewScale(scale)}
                                    className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 transition ${reviewScale === scale ? 'bg-[#eff6ff] font-semibold text-[#2563eb]' : 'text-[#334155] hover:bg-[#f1f5f9]'}`}
                                  >
                                    <span>{reviewScale === scale ? '●' : '○'}</span>
                                    {scale}
                                  </button>
                                ))}
                              </div>
                            </div>
                            <button type="button" onClick={() => setActiveReviewStep(1)} className="h-10 w-full rounded-lg border border-[#2563eb] text-sm font-semibold text-[#2563eb]">提取关键信息</button>
                          </div>
                        </div>
                      </div>
                    )}

                    {activeReviewStep === 1 && (
                      <div className="flex min-h-full flex-col gap-4 text-sm">
                        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-[#edf1f7]">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <h3 className="text-base font-semibold text-[#111827]">关键信息高亮</h3>
                              <p className="mt-1 text-xs text-[#64748b]">点击信息项可定位左侧原文高亮；右侧字段可直接编辑确认。</p>
                            </div>
                            <button type="button" onClick={() => setActiveReviewStep(2)} className="h-9 rounded-lg bg-[#2563eb] px-4 text-sm font-semibold text-white transition hover:bg-[#1d4ed8]">进入审查清单</button>
                          </div>
                        </div>

                        <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(280px,1.1fr)]">
                          <div className="space-y-3">
                            {keyInformationItems.map((item) => (
                              <button key={item.id} type="button" onClick={() => handleSelectKeyInfo(item)} className={`w-full rounded-xl border bg-white px-4 py-3 text-left shadow-sm transition ${selectedKeyInfo?.id === item.id ? 'border-[#2563eb] ring-2 ring-[#bfdbfe]' : 'border-[#e2e8f0] hover:border-[#bfdbfe]'}`}>
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <div className="text-xs font-semibold text-[#2563eb]">{item.type}</div>
                                    <div className="mt-1 font-semibold text-[#111827]">{item.label}</div>
                                    <div className="mt-1 line-clamp-2 text-xs leading-5 text-[#64748b]">{item.value}</div>
                                  </div>
                                  <span className="shrink-0 rounded-full bg-[#eff6ff] px-2 py-0.5 text-xs font-medium text-[#2563eb]">可编辑</span>
                                </div>
                              </button>
                            ))}
                          </div>

                          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-[#edf1f7]">
                            {selectedKeyInfo ? (
                              <div className="space-y-4">
                                <div className="flex items-center justify-between gap-3">
                                  <div>
                                    <div className="text-xs font-medium text-[#94a3b8]">{selectedKeyInfo.type}</div>
                                    <div className="mt-1 text-base font-semibold text-[#111827]">{selectedKeyInfo.label}</div>
                                  </div>
                                  <button type="button" onClick={() => handleSelectKeyInfo(selectedKeyInfo)} className="text-xs font-semibold text-[#2563eb]">定位原文</button>
                                </div>
                                <label className="block">
                                  <span className="text-xs font-medium text-[#94a3b8]">识别结果</span>
                                  <textarea value={selectedKeyInfo.value} onChange={(event) => handleUpdateKeyInfo(selectedKeyInfo.id, 'value', event.target.value)} className="mt-2 h-36 w-full resize-none rounded-lg border border-[#dfe5ef] bg-white px-3 py-2 text-sm leading-6 text-[#334155] outline-none focus:border-[#8bb5ff] focus:ring-4 focus:ring-[#edf4ff]" />
                                </label>
                                <label className="block">
                                  <span className="text-xs font-medium text-[#94a3b8]">审查备注</span>
                                  <textarea value={selectedKeyInfo.note} onChange={(event) => handleUpdateKeyInfo(selectedKeyInfo.id, 'note', event.target.value)} className="mt-2 h-24 w-full resize-none rounded-lg border border-[#dfe5ef] bg-[#fbfcff] px-3 py-2 text-sm leading-6 text-[#334155] outline-none focus:border-[#8bb5ff] focus:ring-4 focus:ring-[#edf4ff]" />
                                </label>
                                <div className="rounded-lg bg-[#f8fafc] px-3 py-2 text-xs leading-5 text-[#64748b]">左侧高亮保留原文片段，右侧编辑用于修正结构化结果。</div>
                              </div>
                            ) : (
                              <div className="py-10 text-center text-sm text-[#64748b]">暂无可识别的关键信息</div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {activeReviewStep === 2 && (
                      <div className="space-y-4 text-sm">
                        <div className="flex items-center justify-between rounded-lg bg-white px-4 py-3 shadow-sm ring-1 ring-[#edf1f7]"><span className="font-semibold text-[#111827]">审查清单：智能生成</span><button type="button" className="text-[#2563eb]">保存至新清单</button></div>
                        <label className="flex items-center gap-3 rounded-lg bg-[#f7f9fc] px-4 py-3 font-semibold text-[#111827]"><input type="checkbox" checked readOnly />全部规则（18）</label>
                        {reviewRules.concat(reviewRules.slice(0, 5)).map((rule, index) => (
                          <label key={`${rule.text}-${index}`} className="flex items-start gap-3 rounded-lg bg-white px-4 py-2.5 text-[#334155] shadow-sm ring-1 ring-[#edf1f7]"><input type="checkbox" checked readOnly className="mt-1" /><span>{index + 1}. {rule.text}</span></label>
                        ))}
                        <div className="sticky bottom-0 flex gap-4 bg-[#fbfcff] py-3"><button type="button" className="h-10 flex-1 rounded-lg border border-[#dfe6f2] bg-white font-semibold text-[#334155]">自定义审查规则</button><button type="button" onClick={() => setActiveReviewStep(3)} className="h-10 flex-1 rounded-lg bg-[#2563eb] font-semibold text-white">重新发起审查</button></div>
                      </div>
                    )}

                    {activeReviewStep === 3 && (
                      <div className="flex min-h-full flex-col gap-4 text-sm">
                        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-[#edf1f7]">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <h3 className="text-base font-semibold text-[#111827]">审查工作台</h3>
                              <p className="mt-1 text-xs text-[#64748b]">当前策略：{reviewPosition} / {reviewScale}审查。点击风险项可定位左侧原文批注。</p>
                            </div>
                            <button type="button" onClick={() => reviewAnnotations.forEach((annotation) => handleUpdateAnnotationStatus(annotation.id, 'accepted'))} className="h-9 rounded-lg bg-[#2563eb] px-4 text-sm font-semibold text-white transition hover:bg-[#1d4ed8]">一键采纳</button>
                          </div>
                          <div className="mt-4 grid grid-cols-2 gap-2 text-center text-xs sm:grid-cols-5">
                            {[
                              { filter: '全部', count: reviewAnnotations.length, className: 'bg-[#eff6ff] text-[#2563eb]' },
                              { filter: '高风险', count: reviewRiskCounts.高风险 || 0, className: 'bg-[#fff1f2] text-[#dc2626]' },
                              { filter: '中风险', count: reviewRiskCounts.中风险 || 0, className: 'bg-[#fff7ed] text-[#ea580c]' },
                              { filter: '低风险', count: reviewRiskCounts.低风险 || 0, className: 'bg-[#fffbeb] text-[#ca8a04]' },
                              { filter: '已处理', count: processedAnnotationCount, className: 'bg-[#f0fdf4] text-[#16a34a]' },
                            ].map((item) => (
                              <button key={item.filter} type="button" onClick={() => setReviewFilter(item.filter)} className={`rounded-lg py-2 font-semibold transition hover:brightness-[0.98] ${item.className} ${reviewFilter === item.filter ? 'ring-2 ring-[#2563eb] ring-offset-1' : ''}`}>
                                {item.filter} ({item.count})
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className={`grid min-h-0 flex-1 gap-4 ${manualReviewAnnotationDraft ? '' : 'xl:grid-cols-[minmax(0,0.95fr)_minmax(260px,1.05fr)]'}`}>
                          {!manualReviewAnnotationDraft && (
                            <div className="space-y-3">
                              {filteredReviewAnnotations.length > 0 ? filteredReviewAnnotations.map((annotation, index) => {
                                const tone = getAnnotationTone(annotation.level)
                                const status = annotationStatuses[annotation.id] || 'pending'
                                return (
                                  <button key={annotation.id} type="button" onClick={() => handleSelectReviewAnnotation(annotation)} className={`w-full rounded-xl border bg-white px-4 py-3 text-left shadow-sm transition ${selectedReviewAnnotation?.id === annotation.id ? 'border-[#2563eb] ring-2 ring-[#bfdbfe]' : 'border-[#e2e8f0] hover:border-[#bfdbfe]'}`}>
                                    <div className="flex items-start gap-3">
                                      <span className={`mt-1.5 h-2 w-2 rounded-full ${tone.dot}`} />
                                      <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${tone.badge}`}>{annotation.level}</span>
                                          <span className="rounded-full bg-[#f1f5f9] px-2 py-0.5 text-xs font-medium text-[#64748b]">{annotationStatusLabels[status]}</span>
                                        </div>
                                        <div className="mt-2 font-semibold text-[#111827]">{index + 1}. {annotation.title}</div>
                                        <div className="mt-1 line-clamp-2 text-xs leading-5 text-[#64748b]">{annotation.comment}</div>
                                      </div>
                                    </div>
                                  </button>
                                )
                              }) : (
                                <div className="rounded-xl border border-dashed border-[#dfe5ef] bg-white px-5 py-8 text-center text-sm text-[#64748b]">当前筛选下暂无风险项</div>
                              )}
                            </div>
                          )}

                          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-[#edf1f7]">
                            {manualReviewAnnotationDraft ? (
                              <div className="space-y-4">
                                <div className="flex items-center justify-between gap-3">
                                  <div>
                                    <div className="text-base font-semibold text-[#111827]">新增人工标注</div>
                                    <div className="mt-1 text-xs text-[#64748b]">已带入左侧选中的合同原文</div>
                                  </div>
                                  <button type="button" onClick={() => setManualReviewAnnotationDraft(null)} className="text-xs font-semibold text-[#64748b]">取消</button>
                                </div>
                                <div className="rounded-lg bg-[#f8fafc] px-3 py-2 text-xs leading-5 text-[#475569]">{manualReviewAnnotationDraft.excerpt}</div>
                                <div>
                                  <div className="text-xs font-medium text-[#94a3b8]">风险等级</div>
                                  <div className="mt-2 flex gap-2">
                                    {['高风险', '中风险', '低风险'].map((level) => (
                                      <button key={level} type="button" onClick={() => handleUpdateManualReviewAnnotation('level', level)} className={`h-8 rounded-lg px-3 text-xs font-semibold transition ${manualReviewAnnotationDraft.level === level ? getAnnotationTone(level).badge : 'bg-[#f8fafc] text-[#64748b] hover:bg-[#eef2f7]'}`}>{level}</button>
                                    ))}
                                  </div>
                                </div>
                                <label className="block">
                                  <span className="text-xs font-medium text-[#94a3b8]">风险标题</span>
                                  <input value={manualReviewAnnotationDraft.title} onChange={(event) => handleUpdateManualReviewAnnotation('title', event.target.value)} className="mt-2 h-10 w-full rounded-lg border border-[#dfe5ef] bg-white px-3 text-sm text-[#334155] outline-none focus:border-[#8bb5ff] focus:ring-4 focus:ring-[#edf4ff]" />
                                </label>
                                <label className="block">
                                  <span className="text-xs font-medium text-[#94a3b8]">风险说明</span>
                                  <textarea value={manualReviewAnnotationDraft.comment} onChange={(event) => handleUpdateManualReviewAnnotation('comment', event.target.value)} className="mt-2 h-24 w-full resize-none rounded-lg border border-[#dfe5ef] bg-white px-3 py-2 text-sm leading-6 text-[#334155] outline-none focus:border-[#8bb5ff] focus:ring-4 focus:ring-[#edf4ff]" />
                                </label>
                                <label className="block">
                                  <span className="text-xs font-medium text-[#94a3b8]">建议改为</span>
                                  <textarea value={manualReviewAnnotationDraft.suggestion} onChange={(event) => handleUpdateManualReviewAnnotation('suggestion', event.target.value)} placeholder="输入建议修改后的条款文本" className="mt-2 h-32 w-full resize-none rounded-lg border border-[#dfe5ef] bg-white px-3 py-2 text-sm leading-6 text-[#334155] outline-none placeholder:text-[#94a3b8] focus:border-[#8bb5ff] focus:ring-4 focus:ring-[#edf4ff]" />
                                </label>
                                <button type="button" onClick={handleSaveManualReviewAnnotation} className="h-10 w-full rounded-lg bg-[#2563eb] text-sm font-semibold text-white transition hover:bg-[#1d4ed8]">加入标注</button>
                              </div>
                            ) : selectedReviewAnnotation ? (() => {
                              const selectedTone = getAnnotationTone(selectedReviewAnnotation.level)
                              const selectedStatus = annotationStatuses[selectedReviewAnnotation.id] || 'pending'
                              const isEditing = selectedStatus === 'editing'
                              const suggestionText = annotationSuggestionDrafts[selectedReviewAnnotation.id] || selectedReviewAnnotation.suggestion
                              return (
                                <div className="space-y-4">
                                  <div className="flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-2">
                                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${selectedTone.badge}`}>{selectedReviewAnnotation.level}</span>
                                      <span className="rounded-full bg-[#f1f5f9] px-2 py-0.5 text-xs font-medium text-[#64748b]">{annotationStatusLabels[selectedStatus]}</span>
                                    </div>
                                    <button type="button" onClick={() => handleSelectReviewAnnotation(selectedReviewAnnotation)} className="text-xs font-semibold text-[#2563eb]">定位原文</button>
                                  </div>
                                  <div>
                                    <div className="text-xs font-medium text-[#94a3b8]">风险标题</div>
                                    <div className="mt-1 text-base font-semibold text-[#111827]">{selectedReviewAnnotation.title}</div>
                                  </div>
                                  <div>
                                    <div className="text-xs font-medium text-[#94a3b8]">风险说明</div>
                                    <p className="mt-1 leading-6 text-[#475569]">{selectedReviewAnnotation.comment}</p>
                                  </div>
                                  <div>
                                    <div className="text-xs font-medium text-[#94a3b8]">建议改为</div>
                                    {isEditing ? (
                                      <textarea value={suggestionText} onChange={(event) => handleUpdateSuggestionDraft(selectedReviewAnnotation.id, event.target.value)} className="mt-2 h-40 w-full resize-none rounded-lg border border-[#dfe5ef] bg-[#fbfcff] px-3 py-2 text-sm leading-6 text-[#334155] outline-none focus:border-[#8bb5ff] focus:ring-4 focus:ring-[#edf4ff]" />
                                    ) : (
                                      <p className="mt-2 rounded-lg bg-[#f8fafc] px-3 py-2 leading-6 text-[#334155]">{suggestionText}</p>
                                    )}
                                  </div>
                                  <div className="grid grid-cols-3 gap-2">
                                    <button type="button" onClick={() => handleUpdateAnnotationStatus(selectedReviewAnnotation.id, 'accepted')} className="h-9 rounded-lg bg-[#2563eb] text-sm font-semibold text-white transition hover:bg-[#1d4ed8]">采纳</button>
                                    <button type="button" onClick={() => handleUpdateAnnotationStatus(selectedReviewAnnotation.id, isEditing ? 'pending' : 'editing')} className="h-9 rounded-lg border border-[#dfe6f2] bg-white text-sm font-semibold text-[#334155] transition hover:bg-[#f8fafc]">{isEditing ? '保存编辑' : '编辑'}</button>
                                    <button type="button" onClick={() => handleUpdateAnnotationStatus(selectedReviewAnnotation.id, 'ignored')} className="h-9 rounded-lg border border-[#dfe6f2] bg-white text-sm font-semibold text-[#64748b] transition hover:bg-[#f8fafc]">忽略</button>
                                  </div>
                                </div>
                              )
                            })() : (
                              <div className="py-10 text-center text-sm text-[#64748b]">请选择一条风险查看修改建议</div>
                            )}
                          </div>
                        </div>

                        <div className="sticky bottom-0 flex items-center justify-between gap-4 rounded-2xl border border-[#e2e8f0] bg-white px-5 py-3 shadow-sm">
                          <div className="text-sm text-[#64748b]">已处理 <span className="font-semibold text-[#111827]">{processedAnnotationCount}</span> / {reviewAnnotations.length}</div>
                          <div className="flex gap-2">
                            <button type="button" className="h-9 rounded-lg border border-[#dfe6f2] bg-white px-4 text-sm font-semibold text-[#334155] transition hover:bg-[#f8fafc]">导出审查意见</button>
                            <button type="button" className="h-9 rounded-lg bg-[#111827] px-4 text-sm font-semibold text-white transition hover:bg-[#020617]">生成修订版</button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </section>
          )}
        </main>

        {groupModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#111827]/35 px-6">
            <div className="w-full max-w-[520px] rounded-2xl bg-white px-6 pb-6 pt-5 shadow-[0_24px_80px_rgba(15,23,42,0.22)]">
              <div className="flex items-start justify-between gap-6">
                <h2 className="text-xl font-semibold text-gray-900">新建规则分组</h2>
                <button type="button" onClick={handleCloseGroupModal} className="-mr-2 -mt-2 flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 transition hover:bg-gray-100" aria-label="关闭">
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 6 6 18" />
                    <path d="m6 6 12 12" />
                  </svg>
                </button>
              </div>

              <label className="mt-7 block text-sm font-semibold text-gray-900">
                <span className="mr-2 text-[#f40b0b]">*</span>规则分组名称
              </label>
              <div className="relative mt-3">
                <input type="text" value={groupName} maxLength={100} onChange={(event) => setGroupName(event.target.value)} className="h-10 w-full rounded-xl border border-[#dfe5ef] bg-white px-3 pr-20 text-sm text-gray-800 outline-none transition focus:border-[#8bb5ff] focus:ring-4 focus:ring-[#edf4ff]" />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-[#8b93a7]">{groupName.length} / 100</span>
              </div>

              <div className="mt-12 flex justify-end gap-3">
                <button type="button" onClick={handleCloseGroupModal} className="h-10 rounded-xl border border-[#dfe5ef] bg-white px-5 text-sm font-medium text-gray-700 transition hover:bg-gray-50">取消</button>
                <button type="button" onClick={handleCreateRuleGroup} className="h-10 rounded-xl bg-[#1f6feb] px-5 text-sm font-medium text-white shadow-[0_10px_24px_rgba(31,111,235,0.22)] transition hover:bg-[#185dcc]">确定</button>
              </div>
            </div>
          </div>
        )}

        {ruleModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#111827]/35 px-6 py-8">
            <div className="flex h-[86vh] w-full max-w-[1024px] flex-col overflow-hidden rounded-[18px] bg-white shadow-[0_24px_80px_rgba(15,23,42,0.22)]">
              <div className="flex h-14 flex-shrink-0 items-center justify-between border-b border-[#edf0f5] px-6">
                <h2 className="text-xl font-semibold text-gray-900">新建审查规则</h2>
                <button type="button" onClick={handleCloseRuleModal} className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 transition hover:bg-gray-100" aria-label="关闭">
                  <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 6 6 18" />
                    <path d="m6 6 12 12" />
                  </svg>
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-8 pt-6">
                <div className="space-y-7">
                  <div>
                    <label className="mb-3 block text-sm font-semibold text-gray-900"><span className="mr-1 text-[#f40b0b]">*</span>规则名称</label>
                    <div className="relative">
                      <input type="text" value={ruleForm.name} maxLength={300} onChange={(event) => setRuleForm((form) => ({ ...form, name: event.target.value }))} placeholder="请输入规则名称" className="h-10 w-full rounded-lg border border-[#dfe5ef] bg-white px-3 pr-20 text-sm text-gray-800 outline-none transition placeholder:text-[#b7bfcc] focus:border-[#8bb5ff] focus:ring-4 focus:ring-[#edf4ff]" />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-[#8b93a7]">{ruleForm.name.length} / 300</span>
                    </div>
                  </div>

                  <div>
                    <label className="mb-3 block text-sm font-semibold text-gray-900"><span className="mr-1 text-[#f40b0b]">*</span>风险等级</label>
                    <div className="flex gap-3">
                      {['高风险', '中风险', '低风险'].map((risk) => (
                        <button
                          key={risk}
                          type="button"
                          onClick={() => setRuleForm((form) => ({ ...form, risk }))}
                          className={`h-9 w-[150px] rounded-lg text-sm font-medium transition ${
                            ruleForm.risk === risk
                              ? risk === '高风险'
                                ? 'border border-[#ff8f8f] bg-[#fff1f1] text-[#f40b0b]'
                                : risk === '中风险'
                                  ? 'border border-[#ffc078] bg-[#fff7ed] text-[#ea580c]'
                                  : 'border border-[#86efac] bg-[#f0fdf4] text-[#16a34a]'
                              : 'bg-[#edf0f6] text-gray-800 hover:bg-[#e3e8f1]'
                          }`}
                        >
                          {risk}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="mb-3 block text-sm font-semibold text-gray-900"><span className="mr-1 text-[#f40b0b]">*</span>规则描述</label>
                    <div className="relative">
                      <textarea value={ruleForm.description} maxLength={6000} onChange={(event) => setRuleForm((form) => ({ ...form, description: event.target.value }))} placeholder="请输入规则描述" className="h-[332px] w-full resize-none rounded-lg border border-[#dfe5ef] bg-white px-3 py-3 pr-24 text-sm leading-6 text-gray-800 outline-none transition placeholder:text-[#b7bfcc] focus:border-[#8bb5ff] focus:ring-4 focus:ring-[#edf4ff]" />
                      <span className="absolute bottom-3 right-4 text-sm text-[#8b93a7]">{ruleForm.description.length} / 6000</span>
                    </div>
                  </div>

                  <div>
                    <label className="mb-3 block text-sm font-semibold text-gray-900"><span className="mr-1 text-[#f40b0b]">*</span>规则分组</label>
                    <div className="relative">
                      <select value={activeRuleGroup} onChange={(event) => setActiveRuleGroup(event.target.value)} className="h-10 w-full appearance-none rounded-lg border border-[#dfe5ef] bg-white px-3 pr-10 text-sm text-gray-800 outline-none transition focus:border-[#8bb5ff] focus:ring-4 focus:ring-[#edf4ff]">
                        <option value="" disabled>{ruleGroups.length > 0 ? '请选择规则分组' : '暂无分组，请先新建规则分组'}</option>
                        {ruleGroups.map((group) => <option key={group} value={group}>{group}</option>)}
                      </select>
                      <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#a5adba]">
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-[#8b93a7]">通过规则分组实现规则的分类与高效管理。</p>
                  </div>
                </div>
              </div>

              <div className="flex h-16 flex-shrink-0 justify-end gap-3 border-t border-[#edf0f5] px-6 py-3">
                <button type="button" onClick={handleCloseRuleModal} className="rounded-xl border border-gray-200 px-5 text-sm font-medium text-gray-700 transition hover:bg-gray-50">取消</button>
                <button type="button" onClick={handleSaveRule} className="rounded-xl bg-[#1f6feb] px-6 text-sm font-medium text-white shadow-[0_10px_24px_rgba(31,111,235,0.22)] transition hover:bg-[#185dcc]">确定</button>
              </div>
            </div>
          </div>
        )}

        {parseModalOpen && selectedRule && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#111827]/35 px-6 py-8">
            <div className="flex h-[86vh] w-full max-w-[1040px] flex-col overflow-hidden rounded-[18px] bg-white shadow-[0_24px_80px_rgba(15,23,42,0.22)]">
              <div className="flex h-14 flex-shrink-0 items-center justify-between border-b border-[#edf0f5] px-6">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">解析规则</h2>
                  <div className="mt-0.5 text-xs text-gray-500">{selectedRule.name}</div>
                </div>
                <button type="button" onClick={handleCloseParseModal} className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 transition hover:bg-gray-100" aria-label="关闭">
                  <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 6 6 18" />
                    <path d="m6 6 12 12" />
                  </svg>
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
                <input ref={parseFileInputRef} type="file" multiple className="hidden" onChange={handleParseContractFiles} />
                <button type="button" onClick={() => parseFileInputRef.current?.click()} className="flex w-full flex-col items-center justify-center rounded-xl border border-dashed border-[#cfd8e6] bg-[#fbfcff] px-6 py-8 text-center transition hover:border-[#8bb5ff] hover:bg-[#f6f9ff]">
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#edf4ff] text-[#1769ff]"><UploadIcon /></span>
                  <span className="mt-3 text-sm font-medium text-gray-900">导入一篇或多篇合同</span>
                  <span className="mt-1 text-xs text-gray-500">选择合同后，逐份填写法务评论和调整建议</span>
                </button>

                {parseContracts.length > 0 ? (
                  <div className="mt-6 space-y-5">
                    <div className="rounded-lg bg-[#edf4ff] px-4 py-3 text-sm font-medium text-[#1769ff]">已导入 {parseContracts.length} 份合同，请逐份补充法务评论</div>
                    {parseContracts.map((contract, index) => (
                      <div key={`${contract.contract_name}-${index}`} className="rounded-xl border border-[#bfdbfe] bg-[#f8fbff] p-5 shadow-sm">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex min-w-0 items-center gap-3">
                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-[#1769ff] ring-1 ring-[#cfe0ff]">
                              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
                                <path d="M14 2v6h6" />
                                <path d="M8 13h8" />
                                <path d="M8 17h5" />
                              </svg>
                            </span>
                            <div className="min-w-0">
                              <div className="truncate text-sm font-medium text-gray-900">{contract.contract_name}</div>
                              <div className="mt-1 flex flex-wrap items-center gap-2">
                                <span className="rounded-full bg-[#e0edff] px-2.5 py-1 text-xs font-medium text-[#1769ff]">已导入</span>
                                <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${contract.issue_comment || contract.adjustment_suggestion ? 'bg-[#eefbf4] text-[#067647]' : 'bg-[#fff7ed] text-[#ea580c]'}`}>{contract.issue_comment || contract.adjustment_suggestion ? '已填写评论' : '待填写评论'}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center gap-3">
                            <button type="button" onClick={() => handleOpenAnnotationPage(index)} className="h-9 rounded-lg bg-[#1769ff] px-4 text-sm font-medium text-white transition hover:bg-[#0f56d9]">批注</button>
                            <button type="button" onClick={() => handleRemoveParseContract(index)} className="text-sm text-[#f40b0b] transition hover:text-[#d60000]">删除</button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-8 rounded-xl border border-[#edf0f5] bg-white px-5 py-6 text-center text-sm text-gray-500">请先导入合同文件</div>
                )}
              </div>

              <div className="flex h-16 flex-shrink-0 justify-end gap-3 border-t border-[#edf0f5] px-6 py-3">
                <button type="button" onClick={handleCloseParseModal} className="rounded-xl border border-gray-200 px-5 text-sm font-medium text-gray-700 transition hover:bg-gray-50">取消</button>
                <button type="button" onClick={() => handleOpenAnnotationPage(0)} disabled={parseContracts.length === 0} className={`rounded-xl px-6 text-sm font-medium transition ${parseContracts.length === 0 ? 'cursor-not-allowed bg-[#edf0f6] text-gray-400' : 'bg-[#1f6feb] text-white shadow-[0_10px_24px_rgba(31,111,235,0.22)] hover:bg-[#185dcc]'}`}>查看原文并批注</button>
              </div>
            </div>
          </div>
        )}

        {annotationContract && (
          <div className="fixed inset-0 z-[60] flex flex-col bg-white text-[#111827]">
            <div className="flex h-16 shrink-0 items-center justify-between border-b border-[#e5eaf3] px-8">
              <div className="flex min-w-0 items-center gap-4">
                <button type="button" onClick={handleCloseAnnotationPage} className="h-9 rounded-lg border border-[#dfe6f2] bg-white px-4 text-sm font-medium text-gray-700 transition hover:bg-[#f8fafc]">返回</button>
                <div className="min-w-0">
                  <div className="truncate text-base font-semibold text-gray-900">{annotationContract.contract_name}</div>
                  <div className="mt-0.5 text-xs text-gray-500">原文批注工作台</div>
                </div>
              </div>
              <button type="button" onClick={handleCloseAnnotationPage} className="h-9 rounded-lg bg-[#1769ff] px-5 text-sm font-medium text-white transition hover:bg-[#0f56d9]">完成批注</button>
            </div>

            <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_420px] bg-[#f7f9fc]">
              <section className="min-h-0 overflow-y-auto border-r border-[#e5eaf3] px-8 py-6">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900">合同原文</h2>
                  <span className="rounded-full bg-[#e0edff] px-3 py-1 text-xs font-medium text-[#1769ff]">选中文本后可添加批注</span>
                </div>
                <article onMouseUp={handleCaptureOriginalSelection} className="min-h-full whitespace-pre-wrap rounded-xl border border-[#dfe6f2] bg-white px-6 py-5 text-sm leading-7 text-gray-800 shadow-sm selection:bg-[#cfe0ff]">
                  {annotationContract.original_text}
                </article>
              </section>

              <aside className="min-h-0 overflow-y-auto bg-white px-6 py-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900">批注</h2>
                  <button type="button" onClick={() => setAnnotationFormCollapsed(false)} className="text-sm font-medium text-[#1769ff] transition hover:text-[#0f56d9]">新增批注</button>
                </div>
                <label className="mt-5 block rounded-xl border border-[#dfe6f2] bg-[#fbfcff] p-4">
                  <span className="text-sm font-medium text-gray-900">合同类型</span>
                  <select value={annotationContract.contract_type || '服务合同'} onChange={(event) => handleUpdateAnnotationContract('contract_type', event.target.value)} className="mt-2 h-10 w-full rounded-lg border border-[#dfe5ef] bg-white px-3 text-sm text-gray-800 outline-none transition focus:border-[#8bb5ff] focus:ring-4 focus:ring-[#edf4ff]">
                    {contractTypes.map((type) => <option key={type} value={type}>{type}</option>)}
                  </select>
                </label>
                {!annotationFormCollapsed && (
                  <div className="mt-4 rounded-xl border border-[#dfe6f2] bg-[#fbfcff] p-4">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-medium text-gray-900">选中原文</div>
                      <button type="button" onClick={() => setAnnotationFormCollapsed(true)} className="text-sm text-gray-500 transition hover:text-gray-900">收起</button>
                    </div>
                    <div className="mt-2 min-h-[72px] rounded-lg bg-white p-3 text-sm leading-6 text-gray-600 ring-1 ring-[#e5eaf3]">
                      {selectedOriginalText || '在左侧原文中拖选一段文字，系统会自动带入这里。'}
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <label className="block">
                        <span className="text-sm font-medium text-gray-900">问题类型</span>
                        <select value={annotationDraft.issueType} onChange={(event) => setAnnotationDraft((draft) => ({ ...draft, issueType: event.target.value }))} className="mt-2 h-10 w-full rounded-lg border border-[#dfe5ef] bg-white px-3 text-sm text-gray-800 outline-none transition focus:border-[#8bb5ff] focus:ring-4 focus:ring-[#edf4ff]">
                          {annotationIssueTypes.map((type) => <option key={type} value={type}>{type}</option>)}
                        </select>
                      </label>
                      <label className="block">
                        <span className="text-sm font-medium text-gray-900">风险等级</span>
                        <select value={annotationDraft.risk} onChange={(event) => setAnnotationDraft((draft) => ({ ...draft, risk: event.target.value }))} className="mt-2 h-10 w-full rounded-lg border border-[#dfe5ef] bg-white px-3 text-sm text-gray-800 outline-none transition focus:border-[#8bb5ff] focus:ring-4 focus:ring-[#edf4ff]">
                          {annotationRisks.map((risk) => <option key={risk} value={risk}>{risk}</option>)}
                        </select>
                      </label>
                    </div>
                    <label className="mt-4 block">
                      <span className="text-sm font-medium text-gray-900">存在问题</span>
                      <textarea value={annotationDraft.issue} onChange={(event) => setAnnotationDraft((draft) => ({ ...draft, issue: event.target.value }))} placeholder="说明该条款存在的问题、缺失条件或责任边界" className="mt-2 h-24 w-full resize-none rounded-lg border border-[#dfe5ef] bg-white px-3 py-3 text-sm leading-6 text-gray-800 outline-none transition placeholder:text-[#b7bfcc] focus:border-[#8bb5ff] focus:ring-4 focus:ring-[#edf4ff]" />
                    </label>
                    <label className="mt-4 block">
                      <span className="text-sm font-medium text-gray-900">建议调整为</span>
                      <textarea value={annotationDraft.suggestion} onChange={(event) => setAnnotationDraft((draft) => ({ ...draft, suggestion: event.target.value }))} placeholder="输入建议替换或补充的合同表述" className="mt-2 h-24 w-full resize-none rounded-lg border border-[#dfe5ef] bg-white px-3 py-3 text-sm leading-6 text-gray-800 outline-none transition placeholder:text-[#b7bfcc] focus:border-[#8bb5ff] focus:ring-4 focus:ring-[#edf4ff]" />
                    </label>
                    <label className="mt-4 block">
                      <span className="flex items-center justify-between text-sm font-medium text-gray-900">
                        <span>可沉淀规则</span>
                        <button type="button" onClick={handleGenerateRulePoint} className="text-sm font-medium text-[#1769ff] transition hover:text-[#0f56d9]">AI生成</button>
                      </span>
                      <textarea value={annotationDraft.rulePoint} onChange={(event) => setAnnotationDraft((draft) => ({ ...draft, rulePoint: event.target.value }))} placeholder="例如：付款条款必须绑定验收标准，并明确逾期付款责任" className="mt-2 h-20 w-full resize-none rounded-lg border border-[#dfe5ef] bg-white px-3 py-3 text-sm leading-6 text-gray-800 outline-none transition placeholder:text-[#b7bfcc] focus:border-[#8bb5ff] focus:ring-4 focus:ring-[#edf4ff]" />
                    </label>
                    <button type="button" onClick={handleAddAnnotation} disabled={!annotationDraft.issue.trim() && !annotationDraft.suggestion.trim() && !annotationDraft.rulePoint.trim()} className={`mt-4 h-10 w-full rounded-lg text-sm font-medium transition ${annotationDraft.issue.trim() || annotationDraft.suggestion.trim() || annotationDraft.rulePoint.trim() ? 'bg-[#1769ff] text-white hover:bg-[#0f56d9]' : 'cursor-not-allowed bg-[#edf0f6] text-gray-400'}`}>添加批注</button>
                  </div>
                )}

                {(annotationContract.annotations || []).length > 0 && (
                  <div className="mt-6">
                    <div className="text-sm font-semibold text-gray-900">批注列表</div>
                    <div className="mt-3 space-y-3">
                      {annotationContract.annotations.map((annotation, index) => (
                        <div key={`${annotation.created_at}-${index}`} className="rounded-xl border border-[#e5eaf3] bg-[#fbfcff] p-4 text-sm">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex flex-wrap gap-2">
                              <span className="rounded-full bg-[#f1f5f9] px-2.5 py-1 text-xs font-medium text-gray-600">{annotation.contract_type || annotationContract.contract_type || '服务合同'}</span>
                              <span className="rounded-full bg-[#e0edff] px-2.5 py-1 text-xs font-medium text-[#1769ff]">{annotation.issue_type}</span>
                              <span className="rounded-full bg-[#fff7ed] px-2.5 py-1 text-xs font-medium text-[#ea580c]">{annotation.risk}</span>
                            </div>
                            <button type="button" onClick={() => handleDeleteAnnotation(index)} className="text-sm text-[#f40b0b] transition hover:text-[#d60000]">删除</button>
                          </div>
                          {annotation.excerpt && <div className="mt-3 rounded-lg bg-white p-3 leading-6 text-gray-600 ring-1 ring-[#edf0f5]">{annotation.excerpt}</div>}
                          {annotation.issue && <div className="mt-3 whitespace-pre-wrap leading-6 text-gray-900">存在问题：{annotation.issue}</div>}
                          {annotation.suggestion && <div className="mt-2 whitespace-pre-wrap leading-6 text-gray-900">建议调整为：{annotation.suggestion}</div>}
                          {annotation.rule_point && <div className="mt-2 whitespace-pre-wrap leading-6 text-gray-600">可沉淀规则：{annotation.rule_point}</div>}
                          <div className="mt-2 text-xs text-gray-400">{annotation.created_at}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </aside>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

export default ContractReviewAgent