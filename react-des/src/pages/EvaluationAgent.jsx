import React, { useState, useMemo, useRef, useEffect } from 'react'
import Sidebar from '../components/Sidebar'
import ProjectSideMenu from '../components/ProjectSideMenu'
import { useLanguage } from '../i18n'

const platformToolMenuItems = [
    { label: '天璇AI测评平台', route: '/evaluation-agent' },
]

// Shared Icon Component
const Icon = ({ name, className = "w-4 h-4" }) => {
  const icons = {
    chevronRight: <polyline points="9 18 15 12 9 6"></polyline>,
    chevronDown: <polyline points="6 9 12 15 18 9"></polyline>,
    search: <circle cx="11" cy="11" r="8"></circle>,
    filter: <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>,
    plus: <path d="M12 5v14M5 12h14"></path>,
    check: <polyline points="20 6 9 17 4 12"></polyline>,
    x: <line x1="18" y1="6" x2="6" y2="18"></line>,
    file: <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>,
    arrowRight: <line x1="5" y1="12" x2="19" y2="12"></line>, // + polyline for arrow head
    refresh: <path d="M23 4v6h-6M1 20v-6h6"></path>,
    barChart: <path d="M12 20V10M18 20V4M6 20v-6"></path>,
    cpu: <rect x="4" y="4" width="16" height="16" rx="2" ry="2"></rect>,
    database: <ellipse cx="12" cy="5" rx="9" ry="3"></ellipse>,
    target: <circle cx="12" cy="12" r="10"></circle>,
    list: <line x1="8" y1="6" x2="21" y2="6"></line>,
    zap: <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>,
    activity: <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>,
    edit: <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>,
    trash: <polyline points="3 6 5 6 21 6"></polyline>,
    thumbsDown: <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"></path>,
    save: <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
  }

  if (name === 'edit') {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
      </svg>
    )
  }

  if (name === 'trash') {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <polyline points="3 6 5 6 21 6"></polyline>
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
      </svg>
    )
  }

  // Handle complex icons that need multiple paths or groups
  if (name === 'arrowRight') {
      return (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <line x1="5" y1="12" x2="19" y2="12"></line>
            <polyline points="12 5 19 12 12 19"></polyline>
        </svg>
      )
  }

  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width="24" height="24" viewBox="0 0 24 24" 
      fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" 
      className={className}
    >
      {icons[name] || <circle cx="12" cy="12" r="10"></circle>}
      {name === 'database' && <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path>}
      {name === 'database' && <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path>}
    </svg>
  )
}

const getEvaluationCopy = (isZh) => ({
    validationReport: {
        title: isZh ? '验证报告' : 'Validation Report',
        question: isZh ? '问题' : 'Question',
        metrics: isZh
            ? ['事实准确性', '答案完整度', '问题清晰度', '多样性与相关性']
            : ['Factual Accuracy', 'Answer Completeness', 'Question Clarity', 'Diversity & Relevance'],
        engine: isZh ? '验证分析引擎' : 'Validation Analysis Engine',
        analysis: isZh
            ? '该问题已经过多维度验证。它具备较高的事实准确性，答案关键点也与源文本保持一致，整体覆盖度较好。'
            : 'The question has been validated across multiple dimensions. It demonstrates high factual accuracy verified against the source text. Answer completeness is sufficient, covering the key aspects of the query.',
        close: isZh ? '关闭报告' : 'Close Report',
        model: isZh ? '模型' : 'Model',
        latency: isZh ? '延迟' : 'Latency',
        worker: isZh ? '并行进程 #3' : 'Parallel Process #3',
    },
    chunkReport: {
        title: isZh ? '分块验证评估' : 'Chunk Validation Assessment',
        subtitle: isZh ? '聚合报告：分块' : 'Aggregated report for Chunk',
        sourcePreview: isZh ? '来源预览' : 'Source Preview',
        generatedQAs: isZh ? '生成问答数' : 'Generated QAs',
        metrics: isZh
            ? ['平均事实准确性', '平均概念密度', '问答多样性']
            : ['Avg Factual Accuracy', 'Avg Concept Density', 'QA Diversity'],
        analysis: isZh ? '生成问题分析' : 'Generated Question Analysis',
        score: isZh ? '得分' : 'Score',
    },
    prompts: {
        qaGen: isZh
            ? `你是一名企业知识内容专家。请基于文档内容，从员工视角生成高质量问答对。

## 1. 核心任务
- 识别文档最重要的知识价值。
- 根据上下文判断适用角色，例如销售、研发、人事。
- 设计贴近真实员工表达的问题，避免机械措辞。

## 2. 问题类型与限制
- 事实型问题优先：规则、流程、数据、操作步骤。
- 概念型问题受限：仅可询问文中明确给出的定义。
- 推理型问题禁止：除非文本直接说明，否则不要问“为什么”“目的”“意义”。

## 3. 质量要求
- 问题范围必须明确。
- 答案必须完全基于原文。
- 优先输出可操作知识，而不是泛泛理论。`
            : `You are an educational content expert. Based on the document content, generate high-quality question-answer pairs mimicking an employee's perspective.

## 1. Core Tasks
- **Theme Recognition**: Identify the document's core educational value.
- **Role Identification**: Determine the appropriate role (e.g., Sales, R&D, HR) based on context.
- **Question Design**: Design human-like questions avoiding mechanical phrasing.

## 2. Question Types & Constraints
- **Factual Questions (Priority)**: Ask about specific rules, processes, data (time, location, person), and operational steps.
- **Conceptual Questions (Restricted)**: Only ask about terms explicitly defined in the text.
- **Inferential Questions (Forbidden)**: Do not ask "Why", "Purpose", or "Significance" unless directly stated.

## 3. Quality Guidelines
- **Specificity**: Questions must have clear scope (e.g., "In the context of X process...").
- **Groundedness**: All answers must be strictly derived from the text.
- **Practicality**: Focus on actionable knowledge rather than general theory.`,
        qaEval: isZh
            ? `请基于给定源文本评估问答对质量。

## 1. 评估维度（0.0-1.0）
- 事实准确性：答案必须被源文本直接支持。
- 完整性：答案需要覆盖问题的全部要点。
- 清晰度：问题必须明确、独立，避免模糊代词。

## 2. 有效性检查
- 仅当全部分数超过阈值 0.7 时，is_valid 才能为 true。
- 如果答案包含原文没有的信息，则标记为无效。
- 问题必须对目标角色有学习价值。

## 3. 反馈要求
- 给出具体扣分原因。
- 为清晰度较低的问题提供明确改进建议。`
            : `Evaluate the question-answer pair based on the provided source text.

## 1. Evaluation Metrics (Score 0.0-1.0)
- **Factual Accuracy**: Answer must be strictly supported by the source text.
- **Completeness**: Answer must address all aspects of the question.
- **Clarity**: Question must be unambiguous and self-contained (no pronouns like "this" or "it" without context).

## 2. Validity Checks
- **Is Valid**: Set to true only if all scores are above threshold (0.7).
- **Hallucinations**: Mark invalid if answer contains info not in source.
- **Relevance**: Question must be educationally valuable for the target role.

## 3. Feedback Requirements
- Provide **specific reasons** for any score deduction.
- Suggest **concrete improvements** for questions with low clarity.`,
        answerGen: isZh
            ? `请从标准答案中提取核心要点，作为自动核验清单。

## 1. 提取目标
- 关键概念：重要术语与定义。
- 可执行步骤：具体流程、规则与动作。
- 核心事实：数字、日期、实体等重要信息。

## 2. 格式要求
- 每条尽量简短。
- 每条都能独立核验。
- 去掉无意义过渡和填充。

## 3. 输出用途
这些要点将用于自动判断回答是否覆盖了必要内容。`
            : `Extract the core key points from the provided model answer to serve as a verification checklist.

## 1. Extraction Goals
- **Key Concepts**: Identify critical terms and definitions.
- **Actionable Steps**: Isolate specific procedures or rules.
- **Essential Facts**: Extract numbers, dates, or specific entities.

## 2. Formatting Rules
- **Conciseness**: Keep each point under 15 words.
- **Independence**: Each point must stand alone as a verifiable fact.
- **No Fillers**: Remove conversational text or transitions.

## 3. Output Usage
These points will be used to automatically verify if a student's response completely covers the necessary ground.`,
        chunkEval: isZh
            ? `请分析文本分块的教学价值，判断其是否适合生成问题。

## 1. 核心评估维度（0.0-1.0）
- 信息密度：有效知识与冗余内容的比率。
- 主题连贯性：是否围绕单一主题展开。
- 复杂度：概念深度与学习价值。

## 2. 低质量信号
- 纯结构性内容：目录、索引、页眉页脚。
- 纯填充内容：版权、免责声明、广告。
- 纯视觉描述：只描述外观，没有功能性知识。

## 3. 应保留内容
- 操作步骤、权限规则、功能说明。
- 混合导航元素与具体定义的内容。
- 能解释“如何工作”或“是什么”的图像说明。

## 4. 输出逻辑
- 若有效，估算可生成问题数量。
- 若低质量，给出具体原因。`
            : `Analyze the text chunk to assess its educational value for question generation.

## 1. Core Assessment Criteria (Score 0.0-1.0)
- **Information Density**: Ratio of useful knowledge to filler text.
- **Topic Coherence**: Logical flow and singular focus.
- **Complexity**: Depth of concepts presented.

## 2. Low Quality Indicators (Mark as Low Quality)
- **Structural only**: Pure table of contents, indices, headers/footers.
- **Empty/Filler**: Copyright notices, disclaimers, ads without useful context.
- **Visual Descriptions**: Purely describing image aesthetics without functional/educational value.

## 3. Retention Standards (Keep these)
- **Functional Info**: Operational steps, user permissions, function descriptions.
- **Hybrid Content**: Navigation elements mixed with concrete definitions or rules.
- **Visual Analysis**: Image descriptions that explain *how* something works or *what* a concept is.

## 4. Output Logic
- If valid, estimate question yield (Factual vs Conceptual).
- If low quality, provide specific reason in \`low_quality_reason\`.`,
    },
    wizard: {
        title: isZh ? '新建评估任务' : 'New Evaluation Task',
        badge: isZh ? '向导' : 'Wizard',
        generationConfiguration: isZh ? '生成配置' : 'Generation Configuration',
        step1Config: isZh ? '步骤 1：分块分析配置' : 'Step 1: Chunk Analysis Configuration',
        step2Config: isZh ? '步骤 2：问答生成配置' : 'Step 2: QA Generation Configuration',
        chunkQualityPrompt: isZh ? '分块质量评估提示词' : 'Chunk Quality Assessment Prompt',
        qaGenerationPrompt: isZh ? '问答生成提示词' : 'QA Generation Prompt',
        answerKeyPrompt: isZh ? '答案关键点提示词' : 'Answer Key Points Prompt',
        qaEvaluationPrompt: isZh ? '问答评估提示词' : 'QA Evaluation Prompt',
        maxQAsPerChunk: isZh ? '每个分块最大问答数' : 'Max QAs per chunk',
        qaDensityHint: isZh ? '控制问题生成密度。数值越高，覆盖面越大，但区分度可能下降。' : 'Controls the density of generated questions. Higher values increase coverage but may reduce distinctiveness.',
        cancel: isZh ? '取消' : 'Cancel',
        saveChanges: isZh ? '保存修改' : 'Save Changes',
        selectSourceDocument: isZh ? '1. 选择源文档' : '1. Select Source Document',
        configuration: isZh ? '配置' : 'Configuration',
        vectorDatabase: isZh ? '向量数据库' : 'Vector Database',
        uploadJson: isZh ? '上传 JSON 文件' : 'Upload JSON File',
        knowledgeBase: isZh ? '知识库' : 'Knowledge Base',
        selectKnowledgeBase: isZh ? '选择知识库...' : 'Select Knowledge Base...',
        resourceCollection: isZh ? '资源（集合）' : 'Resource (Collection)',
        selectResources: isZh ? '选择资源...' : 'Select Resources...',
        availableDocuments: isZh ? '可用文档' : 'Available Documents',
        searchDocuments: isZh ? '搜索文档...' : 'Search documents...',
        loadingDocuments: isZh ? '文档加载中...' : 'Loading documents...',
        noDocumentsFound: isZh ? '没有找到匹配的文档：' : 'No documents found matching',
        clickUploadJson: isZh ? '点击上传 JSON 文件' : 'Click to upload JSON file',
        dragDrop: isZh ? '或拖拽到这里' : 'or drag and drop here',
        startChunkAnalysis: isZh ? '开始分块分析' : 'Start Chunk Analysis',
        totalChunks: isZh ? '分块总数' : 'Total Chunks',
        avgQualityScore: isZh ? '平均质量分' : 'Avg Quality Score',
        chunkAnalysisSelection: isZh ? '2. 分块分析与选择' : '2. Chunk Analysis & Selection',
        sortBy: isZh ? '排序方式：' : 'Sort by:',
        qualityScore: isZh ? '质量分' : 'Quality Score',
        chunkContent: isZh ? '分块内容' : 'Chunk Content',
        detailedMetrics: isZh ? '详细指标' : 'Detailed Metrics',
        qualityType: isZh ? '质量类型' : 'Quality Type',
        density: isZh ? '密度' : 'Density',
        coherence: isZh ? '连贯性' : 'Coherence',
        complexity: isZh ? '复杂度' : 'Complexity',
        highQuality: isZh ? '高质量' : 'High Quality',
        lowQuality: isZh ? '低质量' : 'Low Quality',
        chunksSelectedSuffix: isZh ? '个分块已选择' : 'chunks selected',
        back: isZh ? '返回' : 'Back',
        generating: isZh ? '生成中...' : 'Generating...',
        generateQaPairs: isZh ? '生成问答对' : 'Generate QA Pairs',
        generatedEvaluationSet: isZh ? '3. 已生成评估集' : '3. Generated Evaluation Set',
        allStatus: isZh ? '全部状态' : 'All Status',
        validOnly: isZh ? '仅有效' : 'Valid Only',
        invalidOnly: isZh ? '仅无效' : 'Invalid Only',
        allDocuments: isZh ? '全部文档' : 'All Documents',
        regenerate: isZh ? '重新生成' : 'Regenerate',
        readyForEvaluation: isZh ? '可开始评估：' : 'Ready for Evaluation:',
        questionsGeneratedValidatedSuffix: isZh ? '个问题已生成并验证。' : 'questions generated and validated.',
        coverage: isZh ? '覆盖范围：' : 'Coverage:',
        sourceChunksUsedSuffix: isZh ? '个源分块已使用。' : 'source chunks used.',
        sourceChunk: isZh ? '来源分块' : 'Source Chunk',
        questionAnswer: isZh ? '问题与答案' : 'Question & Answer',
        category: isZh ? '类别' : 'Category',
        status: isZh ? '状态' : 'Status',
        fullChunkContent: isZh ? '完整分块内容' : 'Full Chunk Content',
        viewChunkReport: isZh ? '查看分块分析报告' : 'View Chunk Analysis Report',
        question: isZh ? '问题' : 'Question',
        answer: isZh ? '答案' : 'Answer',
        saveChangesShort: isZh ? '保存修改' : 'Save Changes',
        editQuestion: isZh ? '编辑问题' : 'Edit Question',
        deleteQuestion: isZh ? '删除问题' : 'Delete Question',
        validated: isZh ? '已验证' : 'Validated',
        viewReport: isZh ? '查看报告' : 'View Report',
        exportJson: isZh ? '导出 JSON' : 'Export JSON',
        startAiEvaluation: isZh ? '开始 AI 评估' : 'Start AI Evaluation',
        evaluating: isZh ? '评估中...' : 'Evaluating...',
        aiEvaluationResults: isZh ? '4. AI 评估结果' : '4. AI Evaluation Results',
        sortLabel: isZh ? '排序：' : 'Sort:',
        sortDefault: isZh ? '默认' : 'Default',
        sortHighLow: isZh ? '高到低' : 'High to Low',
        sortLowHigh: isZh ? '低到高' : 'Low to High',
        avgScore: isZh ? '平均得分：' : 'Avg Score:',
        aiModelAnswer: isZh ? 'AI 模型回答' : 'AI Model Answer',
        regenerateAnswer: isZh ? '重新生成答案' : 'Regenerate Answer',
        badAnswer: isZh ? '差回答' : 'Bad Answer',
        markBad: isZh ? '标记差回答' : 'Mark Bad',
        score: isZh ? '得分' : 'Score',
        regenerating: isZh ? '重新生成中...' : 'Regenerating...',
        evaluationReasoning: isZh ? '评估推理' : 'Evaluation Reasoning',
        save: isZh ? '保存' : 'Save',
        referenceAnswer: isZh ? '参考答案' : 'Reference Answer',
        stepLabels: isZh ? ['选择文档', '分块分析', '问答生成', 'AI 评估'] : ['Select Document', 'Chunk Analysis', 'QA Generation', 'AI Evaluation'],
    },
    history: {
        title: isZh ? '评估任务历史' : 'Evaluation Task History',
        subtitle: isZh ? '管理并查看历史评估任务。' : 'Manage and review historical tasks.',
        newTask: isZh ? '新建评估任务' : 'New Evaluation Task',
        allKnowledgeBases: isZh ? '全部知识库' : 'All Knowledge Bases',
        allQaGenStatus: isZh ? '全部问答生成状态' : 'All QA Gen Status',
        recallEvalStatus: isZh ? '召回评估状态' : 'Recall Eval Status',
        completed: isZh ? '已完成' : 'Completed',
        analysis: isZh ? '分析中' : 'Analysis',
        generate: isZh ? '生成中' : 'Generate',
        pending: isZh ? '待处理' : 'Pending',
        knowledgeBaseInfo: isZh ? '知识库信息' : 'Knowledge Base Info',
        validQa: isZh ? '有效问答' : 'Valid Q&A',
        qaGenerationStatus: isZh ? '问答生成状态' : 'QA Generation Status',
        recallEvaluationStatus: isZh ? '召回评估状态' : 'Recall Evaluation Status',
        createdTime: isZh ? '创建时间' : 'Created Time',
        actions: isZh ? '操作' : 'Actions',
        includedDocuments: isZh ? '包含文档' : 'Included Documents',
        docs: isZh ? '份文档' : 'docs',
        more: isZh ? '更多' : 'more',
        view: isZh ? '查看' : 'View',
        delete: isZh ? '删除' : 'Delete',
        download: isZh ? '下载' : 'Download',
        empty: isZh ? '没有符合筛选条件的评估记录。' : 'No evaluation records found matching your filters.',
        kbNames: {
            kbA: isZh ? '知识库 A' : 'Knowledge Base A',
            kbB: isZh ? '知识库 B' : 'Knowledge Base B',
            product: isZh ? '产品知识库' : 'Product Knowledge Base',
        },
    },
})

const formatEvaluationStatus = (status, historyCopy) => {
    const mapping = {
        completed: historyCopy.completed,
        analysis: historyCopy.analysis,
        generate: historyCopy.generate,
        pending: historyCopy.pending,
    }

    return mapping[status] || status
}

const formatQaType = (type, isZh) => {
    if (!isZh) {
        return type
    }

    return type === 'Factual' ? '事实型' : type === 'Conceptual' ? '概念型' : type
}

// Validation Report Modal Component
const ValidationReportModal = ({ qaPair, onClose }) => {
     const { isZh } = useLanguage()
     const copy = getEvaluationCopy(isZh)

    if (!qaPair) return null
  
    const metrics = [
         { label: copy.validationReport.metrics[0], value: qaPair.validation.accuracy, color: 'text-green-600', bg: 'bg-green-500' },
         { label: copy.validationReport.metrics[1], value: qaPair.validation.completeness, color: 'text-blue-600', bg: 'bg-blue-500' },
         { label: copy.validationReport.metrics[2], value: qaPair.validation.clarity, color: 'text-purple-600', bg: 'bg-purple-500' },
         { label: copy.validationReport.metrics[3], value: qaPair.validation.diversity, color: 'text-orange-600', bg: 'bg-orange-500' },
    ]
    
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden m-4">
              <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                       <Icon name="barChart" className="w-5 h-5 text-[#6266EA]" />
                       {copy.validationReport.title}
                  </h3>
                  <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
                      <Icon name="x" className="w-5 h-5" />
                  </button>
              </div>
              
              <div className="p-6 space-y-6">
                  <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
                      <div className="text-xs font-bold text-blue-600 uppercase tracking-wide mb-1">{copy.validationReport.question}</div>
                      <p className="text-gray-900 font-medium">{qaPair.question}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                      {metrics.map((metric, idx) => (
                          <div key={idx} className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors">
                              <div className="flex items-center justify-between mb-2">
                                  <span className="text-sm font-medium text-gray-600">{metric.label}</span>
                                  <span className={`text-lg font-bold ${metric.color}`}>{(metric.value * 100).toFixed(0)}%</span>
                              </div>
                              <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                                  <div className={`h-full rounded-full ${metric.bg}`} style={{width: `${metric.value * 100}%`}}></div>
                              </div>
                          </div>
                      ))}
                  </div>

                  <div className="border-t border-gray-100 pt-4">
                       <div className="flex items-start gap-3">
                           <div className="mt-1">
                               <div className="w-8 h-8 rounded-full bg-[#6266EA]/10 flex items-center justify-center text-[#6266EA]">
                                   <Icon name="cpu" className="w-4 h-4" />
                               </div>
                           </div>
                           <div>
                               <h4 className="text-sm font-semibold text-gray-900">{copy.validationReport.engine}</h4>
                               <p className="text-sm text-gray-600 mt-1 leading-relaxed">
                                   {copy.validationReport.analysis}
                               </p>
                               <div className="flex gap-2 mt-3">
                                   <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-600">
                                       {copy.validationReport.model}: GPT-4o
                                   </span>
                                   <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-600">
                                       {copy.validationReport.latency}: 1.2s
                                   </span>
                                   <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-600">
                                       {copy.validationReport.worker}
                                   </span>
                               </div>
                           </div>
                       </div>
                  </div>
              </div>

              <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end">
                  <button onClick={onClose} className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#6266EA]">
                      {copy.validationReport.close}
                  </button>
              </div>
          </div>
      </div>
    )
}

// Chunk Validation Report Modal
const ChunkReportModal = ({ chunk, qaPairs, onClose }) => {
    const { isZh } = useLanguage()
    const copy = getEvaluationCopy(isZh)

    if (!chunk) return null;

    const chunkQAs = qaPairs.filter(qa => qa.chunkId === chunk.id);
    const avgScore = chunkQAs.length > 0 
        ? (chunkQAs.reduce((acc, qa) => acc + qa.score, 0) / chunkQAs.length).toFixed(1)
        : 0;
    
    // Mock aggregated metrics
    const aggMetrics = [
        { label: 'Avg Factual Accuracy', value: 96, color: 'text-green-600' },
        { label: 'Avg Concept Density', value: 92, color: 'text-purple-600' },
        { label: 'QA Diversity', value: 88, color: 'text-blue-600' }
    ];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fadeIn">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl overflow-hidden m-4 max-h-[90vh] flex flex-col">
                <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
                    <div>
                        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                             <Icon name="cpu" className="w-5 h-5 text-[#6266EA]" />
                                {copy.chunkReport.title}
                        </h3>
                            <p className="text-xs text-gray-500 mt-0.5">{copy.chunkReport.subtitle} {chunk.id}</p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
                        <Icon name="x" className="w-5 h-5" />
                    </button>
                </div>

                <div className="overflow-y-auto p-6 space-y-6 flex-1">
                    {/* Source Preview */}
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex justify-between">
                            <span>{copy.chunkReport.sourcePreview}</span>
                            <span className="flex items-center gap-1"><Icon name="file" className="w-3 h-3"/> {chunk.sourceDoc}</span>
                        </div>
                        <p className="text-sm text-gray-600 italic border-l-2 border-gray-300 pl-3 line-clamp-3">
                            "{chunk.content}"
                        </p>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-4 gap-4">
                        <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl text-center">
                            <div className="text-2xl font-bold text-blue-700">{chunkQAs.length}</div>
                            <div className="text-xs font-medium text-blue-600 uppercase mt-1">{copy.chunkReport.generatedQAs}</div>
                        </div>
                        {aggMetrics.map((m, i) => (
                            <div key={i} className="bg-white border border-gray-200 p-4 rounded-xl text-center shadow-sm">
                                <div className={`text-2xl font-bold ${m.color}`}>{m.value}%</div>
                                <div className="text-xs font-medium text-gray-500 uppercase mt-1">{copy.chunkReport.metrics[i]}</div>
                            </div>
                        ))}
                    </div>

                    {/* QA Breakdown */}
                    <div>
                        <h4 className="text-sm font-semibold text-gray-900 mb-3 uppercase tracking-wide">{copy.chunkReport.analysis}</h4>
                        <div className="space-y-3">
                            {chunkQAs.map((qa, idx) => (
                                <div key={qa.id} className="border border-gray-200 rounded-lg p-3 hover:border-[#6266EA]/50 transition-colors">
                                    <div className="flex justify-between items-start mb-1">
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${qa.type === 'Factual' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                                            QA #{idx+1} • {qa.type}
                                        </span>
                                        <span className="text-xs font-bold text-gray-900">{copy.chunkReport.score}: {qa.score}</span>
                                    </div>
                                    <p className="text-sm font-medium text-gray-900 mb-1">{qa.question}</p>
                                    <p className="text-xs text-gray-500 line-clamp-1">{qa.answer}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Simple Prompt Editor with Auto-Switch Preview
const PromptField = ({ value, onChange, placeholder, minHeight = "h-80" }) => {
    const [isEditing, setIsEditing] = useState(false);
    
    // Auto-focus textarea when switching to edit mode
    const textareaRef = useRef(null);
    useEffect(() => {
        if (isEditing && textareaRef.current) {
            textareaRef.current.focus();
        }
    }, [isEditing]);

    const renderMarkdown = (text) => {
        if (!text) return <span className="text-gray-400 italic">Click to edit...</span>;
        return text.split('\n').map((line, idx) => {
            // H2 Header (##) - The user specifically requested this to be colored
            if (line.trim().startsWith('##')) {
                return (
                    <h3 key={idx} className="text-[#6266EA] font-bold mt-4 mb-2 text-sm border-b border-[#6266EA]/10 pb-1">
                        {line}
                    </h3>
                )
            }
            // H1 Header (#)
            if (line.trim().startsWith('# ')) {
                return <h2 key={idx} className="text-gray-900 font-bold text-base mt-4 mb-2">{line}</h2>
            }
            // Bold Highlighting
            if (line.includes('**')) {
                 const segments = line.split(/(\*\*.*?\*\*)/g);
                 return (
                     <div key={idx} className="mb-1 text-sm text-gray-700 leading-relaxed">
                        {segments.map((seg, i) => {
                            if (seg.startsWith('**') && seg.endsWith('**')) {
                                return <strong key={i} className="text-gray-900 font-semibold">{seg.slice(2, -2)}</strong>
                            }
                            return seg;
                        })}
                     </div>
                 )
            }
             // List Items
             if (line.trim().startsWith('-')) {
                 return <div key={idx} className="ml-2 mb-1 text-sm text-gray-700 leading-relaxed pl-2 border-l-2 border-gray-100">
                    {line}
                 </div>
             }
            if (!line.trim()) return <div key={idx} className="h-2"></div>;
            return <div key={idx} className="text-sm text-gray-600 leading-relaxed">{line}</div>
        })
    }

    return (
        <div className={`w-full ${minHeight} relative group`}>
            {isEditing ? (
                <textarea 
                    ref={textareaRef}
                    className="w-full h-full p-4 text-sm text-gray-700 font-mono border border-[#6266EA] rounded-lg focus:ring-2 focus:ring-[#6266EA]/20 outline-none resize-none leading-relaxed bg-white shadow-sm"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    onBlur={() => setIsEditing(false)}
                    placeholder={placeholder}
                />
            ) : (
                <div 
                    onClick={() => setIsEditing(true)}
                    className="w-full h-full p-4 border border-gray-200 rounded-lg overflow-y-auto bg-gray-50/50 hover:bg-white hover:border-[#6266EA]/50 transition-all cursor-text shadow-sm"
                >
                    {renderMarkdown(value)}
                </div>
            )}
        </div>
    )
}

const CreateEvaluationWizard = ({ onBack, initialData = null }) => {
    const { isZh } = useLanguage()
    const copy = getEvaluationCopy(isZh)
  const [currentStep, setCurrentStep] = useState(initialData ? 3 : 1) // 1: Select, 2: Analyze, 3: QA
  const [inputMode, setInputMode] = useState('kb') // 'kb' | 'file'
  const [uploadedFiles, setUploadedFiles] = useState([])
  const [selectedKB, setSelectedKB] = useState(initialData?.kb || '')
  const [selectedResources, setSelectedResources] = useState(initialData?.resource ? [initialData.resource] : [])
  const [isResourceDropdownOpen, setIsResourceDropdownOpen] = useState(false)
  const [selectedDocs, setSelectedDocs] = useState([])
  const [isLoadingDocs, setIsLoadingDocs] = useState(false)
  const [docSearchQuery, setDocSearchQuery] = useState('')
  const [isConfigExpanded, setIsConfigExpanded] = useState(false)
  
  // Configuration State
    const [qaGenPrompt, setQaGenPrompt] = useState(copy.prompts.qaGen)
    const [qaEvalPrompt, setQaEvalPrompt] = useState(copy.prompts?.qaEval || '')
    const [answerGenPrompt, setAnswerGenPrompt] = useState(copy.prompts?.answerGen || '')
    const [chunkEvalPrompt, setChunkEvalPrompt] = useState(copy.prompts?.chunkEval || '')
  const [maxQAsPer10k, setMaxQAsPer10k] = useState(15)

    useEffect(() => {
            setQaGenPrompt(copy.prompts.qaGen)
            setQaEvalPrompt(copy.prompts.qaEval)
            setAnswerGenPrompt(copy.prompts.answerGen)
            setChunkEvalPrompt(copy.prompts.chunkEval)
    }, [copy.prompts.qaGen, copy.prompts.qaEval, copy.prompts.answerGen, copy.prompts.chunkEval])

  // Mock Data
  const connectedKBs = [
      { id: 'kb1', name: 'Product Knowledge Base', resources: ['User Guide', 'API Docs', 'Release Notes'] },
      { id: 'kb2', name: 'Technical Support', resources: ['Troubleshooting', 'FAQs'] },
      { id: 'kb3', name: 'External Data (VolcGoogle)', resources: ['Web Crawl 2024'] }
  ]

  const mockDocuments = [
      { id: 101, name: 'Core_Architecture_v2.pdf', size: '2.4 MB', date: '2024-03-15' },
      { id: 102, name: 'Deployment_Pipeline_Guide.docx', size: '1.1 MB', date: '2024-03-10' },
      { id: 103, name: 'Security_Best_Practices.txt', size: '45 KB', date: '2024-03-01' },
  ]

  const defaultChunks = [
      { id: 'c1', content: 'The Chunking Engine chooses a strategy (semantic vs fixed) to split documents into optimal segments for retrieval. This involves analyzing document structure and headers.', score: 92, density: 0.85, coherence: 0.90, complexity: 0.7, keyConcepts: ['Chunking', 'Strategy', 'Retrieval'], yield: 4, status: 'High Quality', selected: true, sourceDoc: 'Core_Architecture_v2.pdf' },
      { id: 'c2', content: 'Phase 3 involves running analysis in batches using Qwen-Max to determine info density. High density chunks are prioritized for QA generation to maximize coverage.', score: 88, density: 0.82, coherence: 0.88, complexity: 0.65, keyConcepts: ['Qwen-Max', 'Info Density', 'Batch Analysis'], yield: 3, status: 'High Quality', selected: true, sourceDoc: 'Deployment_Pipeline_Guide.docx' },
      { id: 'c3', content: 'If resources are insufficient, the allocator calculates a quality score for each chunk based on text length and keyword frequency.', score: 75, density: 0.60, coherence: 0.75, complexity: 0.45, keyConcepts: ['Allocator', 'Resources'], yield: 2, status: 'Low Quality', selected: false, sourceDoc: 'Core_Architecture_v2.pdf' },
      { id: 'c4', content: 'Validation includes factual accuracy, answer completeness, and clarity checks. Each QA pair undergoes a triple-verification process.', score: 95, density: 0.95, coherence: 0.92, complexity: 0.85, keyConcepts: ['Validation', 'Accuracy', 'Clarity', 'Verification'], yield: 5, status: 'High Quality', selected: true, sourceDoc: 'Security_Best_Practices.txt' },
      { id: 'c5', content: 'Introduction to the system. This section is brief.', score: 45, density: 0.3, coherence: 0.4, complexity: 0.2, keyConcepts: ['Intro'], yield: 0, status: 'Low Quality', selected: false, sourceDoc: 'Core_Architecture_v2.pdf' },
  ]

  const [chunks, setChunks] = useState(defaultChunks)

  // Initialize with dummy data if editing/viewing existing
  const [qaPairs, setQaPairs] = useState(initialData ? [
      { 
          id: 'q1', 
          question: 'What are the two main chunking strategies mentioned?', 
          answer: 'The two strategies are Semantic Chunking (based on meaning) and Fixed-size Chunking (based on character count).', 
          type: 'Factual', 
          chunkId: 'c1', 
          sourceDoc: 'Core_Architecture_v2.pdf', 
          score: 98, 
          valid: true,
          validation: { accuracy: 0.99, completeness: 0.98, clarity: 0.95, diversity: 0.90 }
      },
      { 
          id: 'q1-2', 
          question: 'When is Fixed-size chunking specifically recommended?', 
          answer: 'Fixed-size chunking is recommended when document structure involves strict formatting codes or when computational resources are limited.', 
          type: 'Conceptual', 
          chunkId: 'c1', 
          sourceDoc: 'Core_Architecture_v2.pdf', 
          score: 85, 
          valid: true,
          validation: { accuracy: 0.90, completeness: 0.85, clarity: 0.92, diversity: 0.88 }
      },
      { 
          id: 'q3', 
          question: 'What models are used for validation?', 
          answer: 'GPT-4o is used for shared LLM calls during the validation phase.', 
          type: 'Factual', 
          chunkId: 'c4', 
          sourceDoc: 'Security_Best_Practices.txt', 
          score: 95, 
          valid: true,
          validation: { accuracy: 0.97, completeness: 0.95, clarity: 0.94, diversity: 0.85 }
      }
  ] : [])
  const [isGenerating, setIsGenerating] = useState(false)
  const [reportQA, setReportQA] = useState(null)
  const [reportChunk, setReportChunk] = useState(null)
  
  // Edit State
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({ question: '', answer: '' })

  const [sortField, setSortField] = useState('score')
  const [sortAsc, setSortAsc] = useState(false)

  // Filter State
  const [qaFilterStats, setQaFilterStats] = useState('all') // 'all' | 'valid' | 'invalid'
  const [qaFilterDoc, setQaFilterDoc] = useState('all') // 'all' | specific doc name

  // AI Evaluation State
  const [aiResults, setAiResults] = useState({})
  const [isEvaluating, setIsEvaluating] = useState(false)
  const [resultSort, setResultSort] = useState('default') // 'default' | 'asc' | 'desc'

  // Feedback & Regeneration State
  const [badAnswers, setBadAnswers] = useState(new Set())
  const [regeneratingIds, setRegeneratingIds] = useState(new Set())

  const toggleBadAnswer = (id) => {
      setBadAnswers(prev => {
          const newSet = new Set(prev)
          if (newSet.has(id)) newSet.delete(id)
          else newSet.add(id)
          return newSet
      })
  }

  const handleRegenerateSingle = (id) => {
      setRegeneratingIds(prev => {
          const newSet = new Set(prev)
          newSet.add(id)
          return newSet
      })
      
      // Simulate regeneration
      setTimeout(() => {
          setAiResults(prev => ({
              ...prev,
              [id]: {
                  ...prev[id],
                  aiAnswer: "Regenerated Answer: This response has been refined to better address the nuances of the question. It provides a more direct explanation verified against the source text chunks.",
                  score: Math.min((prev[id]?.score || 0) + 5, 100), // Slight improvement
                  reasoning: "The regenerated answer addresses previous gaps and offers clearer evidence."
              }
          }))
          setRegeneratingIds(prev => {
              const newSet = new Set(prev)
              newSet.delete(id)
              return newSet
          })
          // Also clear bad answer status if it was bad
          setBadAnswers(prev => {
              const newSet = new Set(prev)
              newSet.delete(id)
              return newSet
          })
      }, 1500)
  }

  // Handlers for QA Management
  const handleDeleteQA = (id) => {
      if (window.confirm('Are you sure you want to delete this QA pair?')) {
          setQaPairs(qaPairs.filter(qa => qa.id !== id))
      }
  }

  const handleEditClick = (qa) => {
      setEditingId(qa.id)
      setEditForm({ question: qa.question, answer: qa.answer })
  }

  const handleSaveEdit = () => {
      setQaPairs(qaPairs.map(qa => 
          qa.id === editingId 
              ? { ...qa, question: editForm.question, answer: editForm.answer } 
              : qa
      ))
      setEditingId(null)
  }

  const handleCancelEdit = () => {
      setEditingId(null)
  }

  // Step 1: Handle Document Selection
  const handleDocSelect = (doc) => {
      setSelectedDocs(prev => {
          const isSelected = prev.some(d => d.id === doc.id)
          if (isSelected) {
              return prev.filter(d => d.id !== doc.id)
          } else {
              return [...prev, doc]
          }
      })
  }

  const handleResourceChange = (val) => {
      // Logic moved inline to component for multi-select
  }

  const startAnalysis = () => {
      // Simulate loading/analysis
      setCurrentStep(2)
  }

  // Step 2: Sorting and Selection
  const sortedChunks = useMemo(() => {
      return [...chunks].sort((a, b) => {
          const valA = a[sortField]
          const valB = b[sortField]
          return sortAsc ? valA - valB : valB - valA
      })
  }, [chunks, sortField, sortAsc])

  const toggleChunkSelection = (id) => {
      setChunks(chunks.map(c => c.id === id ? { ...c, selected: !c.selected } : c))
  }

  const handleGenerateQA = () => {
      setIsGenerating(true)
      setTimeout(() => {
          // Mock Generation
          const newPairs = [
              { 
                  id: 'q1', 
                  question: 'What are the two main chunking strategies mentioned?', 
                  answer: 'The two strategies are Semantic Chunking (based on meaning) and Fixed-size Chunking (based on character count).', 
                  type: 'Factual', 
                  chunkId: 'c1', 
                  sourceDoc: 'Core_Architecture_v2.pdf', 
                  score: 98, 
                  valid: true,
                  validation: { accuracy: 0.99, completeness: 0.98, clarity: 0.95, diversity: 0.90 }
              },
              { 
                  id: 'q1-2', 
                  question: 'When is Fixed-size chunking specifically recommended?', 
                  answer: 'Fixed-size chunking is recommended when document structure involves strict formatting codes or when computational resources are limited.', 
                  type: 'Conceptual', 
                  chunkId: 'c1', 
                  sourceDoc: 'Core_Architecture_v2.pdf', 
                  score: 85, 
                  valid: true,
                  validation: { accuracy: 0.90, completeness: 0.85, clarity: 0.92, diversity: 0.88 }
              },
              { 
                  id: 'q2', 
                  question: 'How is the quality score calculated when resources are insufficient?', 
                  answer: 'It is weighted based on multiple factors: Information Density (25%), Topic Coherence (20%), Complexity (15%), Length (15%), Concept Density (15%), and Question Potential (10%).', 
                  type: 'Conceptual', 
                  chunkId: 'c3', 
                  sourceDoc: 'Core_Architecture_v2.pdf', 
                  score: 92, 
                  valid: true,
                  validation: { accuracy: 0.95, completeness: 0.90, clarity: 0.88, diversity: 0.92 }
              },
              { 
                  id: 'q3', 
                  question: 'What models are used for validation?', 
                  answer: 'GPT-4o is used for shared LLM calls during the validation phase.', 
                  type: 'Factual', 
                  chunkId: 'c4', 
                  sourceDoc: 'Security_Best_Practices.txt', 
                  score: 95, 
                  valid: true,
                  validation: { accuracy: 0.97, completeness: 0.95, clarity: 0.94, diversity: 0.85 }
              },
          ]
          setQaPairs(newPairs)
          setIsGenerating(false)
          setCurrentStep(3)
      }, 1500)
  }

  const handleRunAIEvaluation = () => {
    setIsEvaluating(true)
    setTimeout(() => {
        const results = {}
        qaPairs.forEach(qa => {
            const score = Math.floor(Math.random() * 30) + 70 // 70-100
            results[qa.id] = {
                aiAnswer: "This is a simulated AI generated answer that demonstrates the model's ability to retrieve and synthesize information from the context. It covers the key points mentioned in the ground truth.",
                score: score,
                reasoning: "The answer correctly identifies the core concepts and provides a concise explanation verified against the source text."
            }
        })
        setAiResults(results)
        setIsEvaluating(false)
        setCurrentStep(4)
    }, 2000)
  }

  // Progress Stepper
  const StepIndicator = () => (
      <div className="flex items-center justify-center mb-8">
          {[
              { id: 1, label: copy.wizard.stepLabels[0] },
              { id: 2, label: copy.wizard.stepLabels[1] },
              { id: 3, label: copy.wizard.stepLabels[2] },
              { id: 4, label: copy.wizard.stepLabels[3] }
          ].map((step, idx) => (
              <div key={step.id} className="flex items-center">
                  <div className={`flex flex-col items-center relative z-10 ${currentStep >= step.id ? 'text-[#6266EA]' : 'text-gray-400'}`}>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold border-2 transition-colors duration-300 ${
                          currentStep >= step.id ? 'bg-[#6266EA] border-[#6266EA] text-white' : 'bg-white border-gray-300'
                      }`}>
                          {currentStep > step.id ? <Icon name="check" className="w-5 h-5" /> : step.id}
                      </div>
                      <span className="text-xs font-medium mt-2 absolute -bottom-6 w-32 text-center">{step.label}</span>
                  </div>
                  {idx < 3 && (
                      <div className={`w-24 h-0.5 mx-2 mb-4 transition-colors duration-300 ${currentStep > step.id ? 'bg-[#6266EA]' : 'bg-gray-200'}`} />
                  )}
              </div>
          ))}
      </div>
  )

  return (
    <>
        <header className="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-4">
               {onBack && (
                  <button onClick={onBack} className="flex items-center gap-1 text-gray-500 hover:text-gray-900 transition-colors p-1 -ml-2 rounded-lg hover:bg-gray-100">
                      <Icon name="arrowRight" className="w-5 h-5 rotate-180" />
                  </button>
               )}
               <h1 className="text-xl font-semibold text-gray-900">{copy.wizard.title}</h1>
               <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-600 border border-blue-100">{copy.wizard.badge}</span>
          </div>
        </header>
        
        <ValidationReportModal qaPair={reportQA} onClose={() => setReportQA(null)} />
        <ChunkReportModal chunk={reportChunk} qaPairs={qaPairs} onClose={() => setReportChunk(null)} />

        <main className="flex-1 overflow-y-auto p-8">
            <div className="max-w-5xl mx-auto space-y-8">
                <StepIndicator />

                        {/* Configuration Modal */}
                        {isConfigExpanded && (
                            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fadeIn">
                                <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col animate-scaleIn">
                                    <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
                                        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                                            <Icon name="settings" className="w-5 h-5 text-[#6266EA]" />
                                            {copy.wizard.generationConfiguration}
                                        </h3>
                                        <button onClick={() => setIsConfigExpanded(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                                            <Icon name="x" className="w-5 h-5" />
                                        </button>
                                    </div>
                                    
                                    <div className="p-6 overflow-y-auto space-y-8">
                                        {/* Step 1: Chunk Analysis Configuration */}
                                        <div>
                                            <h4 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-4 flex items-center gap-2">
                                                <Icon name="cpu" className="w-4 h-4 text-[#6266EA]" />
                                                {copy.wizard.step1Config}
                                            </h4>
                                            <div className="grid grid-cols-1 gap-6">
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-2">{copy.wizard.chunkQualityPrompt}</label>
                                                    <PromptField 
                                                        value={chunkEvalPrompt}
                                                        onChange={setChunkEvalPrompt}
                                                        placeholder={copy.wizard.chunkQualityPrompt}
                                                        minHeight="h-80"
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        <div className="border-t border-gray-100"></div>

                                        {/* Step 2: QA Generation Configuration */}
                                        <div>
                                            <h4 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-4 flex items-center gap-2">
                                                <Icon name="zap" className="w-4 h-4 text-[#6266EA]" />
                                                {copy.wizard.step2Config}
                                            </h4>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                <div className="space-y-4">
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700 mb-2">{copy.wizard.qaGenerationPrompt}</label>
                                                        <PromptField 
                                                            value={qaGenPrompt}
                                                            onChange={setQaGenPrompt}
                                                            placeholder={copy.wizard.qaGenerationPrompt}
                                                            minHeight="h-80"
                                                        />
                                                    </div>
                                                    <div>
                                                         <label className="block text-sm font-medium text-gray-700 mb-2">{copy.wizard.maxQAsPerChunk}</label>
                                                        <div className="flex items-center gap-4">
                                                            <input 
                                                                type="number" 
                                                                className="w-full text-sm text-gray-900 border border-gray-200 rounded-lg p-2.5 focus:ring-2 focus:ring-[#6266EA]/20 focus:border-[#6266EA] outline-none"
                                                                value={maxQAsPer10k}
                                                                onChange={(e) => setMaxQAsPer10k(parseInt(e.target.value) || 0)}
                                                            />
                                                        </div>
                                                        <p className="text-xs text-gray-500 italic mt-1">{copy.wizard.qaDensityHint}</p>
                                                    </div>
                                                </div>
                                                <div className="space-y-4">
                                                     <div>
                                                        <label className="block text-sm font-medium text-gray-700 mb-2">{copy.wizard.answerKeyPrompt}</label>
                                                        <PromptField 
                                                            value={answerGenPrompt}
                                                            onChange={setAnswerGenPrompt}
                                                            placeholder={copy.wizard.answerKeyPrompt}
                                                            minHeight="h-80"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700 mb-2">{copy.wizard.qaEvaluationPrompt}</label>
                                                        <PromptField 
                                                            value={qaEvalPrompt}
                                                            onChange={setQaEvalPrompt}
                                                            placeholder={copy.wizard.qaEvaluationPrompt}
                                                            minHeight="h-80"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
                                        <button 
                                            onClick={() => setIsConfigExpanded(false)}
                                            className="px-4 py-2 text-gray-600 hover:text-gray-900 font-medium"
                                        >
                                            {copy.wizard.cancel}
                                        </button>
                                        <button 
                                            onClick={() => setIsConfigExpanded(false)}
                                            className="px-6 py-2 bg-[#6266EA] text-white rounded-lg font-medium hover:bg-[#5256d0] shadow-sm"
                                        >
                                            {copy.wizard.saveChanges}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                {/* Step 1: Selection */}
                {currentStep === 1 && (
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 animate-fadeIn">
                        <h2 className="text-lg font-semibold text-gray-900 mb-6 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Icon name="database" className="w-5 h-5 text-[#6266EA]" />
                                1. Select Source Document
                            </div>
                            <button 
                                onClick={() => setIsConfigExpanded(true)}
                                className="text-xs font-medium text-gray-500 hover:text-[#6266EA] flex items-center gap-1 transition-colors px-3 py-1.5 rounded-lg hover:bg-gray-50 border border-transparent hover:border-gray-200"
                            >
                                <Icon name="settings" className="w-4 h-4" />
                                Configuration
                            </button>
                        </h2>

                        <div className="flex p-1 bg-gray-100 rounded-lg w-fit mb-6">
                            <button
                                onClick={() => { setInputMode('kb'); setSelectedDocs([]); }}
                                className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
                                    inputMode === 'kb' 
                                        ? 'bg-white text-gray-900 shadow-sm' 
                                        : 'text-gray-500 hover:text-gray-700'
                                }`}
                            >
                                Vector Database
                            </button>
                            <button
                                onClick={() => { setInputMode('file'); setSelectedDocs([...uploadedFiles]); }}
                                className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
                                    inputMode === 'file' 
                                        ? 'bg-white text-gray-900 shadow-sm' 
                                        : 'text-gray-500 hover:text-gray-700'
                                }`}
                            >
                                Upload JSON File
                            </button>
                        </div>

                        {inputMode === 'kb' && (
                            <>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Knowledge Base</label>
                                        <select 
                                            className="w-full px-4 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#6266EA]/20 focus:border-[#6266EA] outline-none"
                                            value={selectedKB}
                                            onChange={(e) => setSelectedKB(e.target.value)}
                                        >
                                            <option value="">Select Knowledge Base...</option>
                                            {connectedKBs.map(kb => (
                                                <option key={kb.id} value={kb.id}>{kb.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="relative">
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Resource (Collection)</label>
                                        <button
                                            onClick={() => selectedKB && setIsResourceDropdownOpen(!isResourceDropdownOpen)}
                                            disabled={!selectedKB}
                                            className={`w-full px-4 py-2 bg-white border border-gray-200 rounded-lg text-left flex items-center justify-between focus:ring-2 focus:ring-[#6266EA]/20 focus:border-[#6266EA] outline-none ${!selectedKB && 'bg-gray-50 text-gray-400 cursor-not-allowed'}`}
                                        >
                                            <span className="truncate">
                                                {selectedResources.length > 0 
                                                    ? selectedResources.join(', ')
                                                    : "Select Resources..."}
                                            </span>
                                            <Icon name="chevronDown" className="w-4 h-4 text-gray-400" />
                                        </button>
                                        
                                        {isResourceDropdownOpen && (
                                            <>
                                                <div className="fixed inset-0 z-10" onClick={() => setIsResourceDropdownOpen(false)}></div>
                                                <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                                                    {selectedKB && connectedKBs.find(k => k.id === selectedKB)?.resources.map(r => (
                                                        <div 
                                                            key={r}
                                                            onClick={() => {
                                                                const newResources = selectedResources.includes(r)
                                                                    ? selectedResources.filter(res => res !== r)
                                                                    : [...selectedResources, r]
                                                                setSelectedResources(newResources)
                                                                // Reset docs when resources change as a simplification or fetch new ones
                                                                setIsLoadingDocs(true)
                                                                setTimeout(() => setIsLoadingDocs(false), 500)
                                                            }}
                                                            className="px-4 py-2 hover:bg-gray-50 cursor-pointer flex items-center gap-2"
                                                        >
                                                            <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${selectedResources.includes(r) ? 'bg-[#6266EA] border-[#6266EA]' : 'border-gray-300'}`}>
                                                                {selectedResources.includes(r) && <Icon name="check" className="w-3 h-3 text-white" />}
                                                            </div>
                                                            <span className="text-sm text-gray-700">{r}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>

                                {selectedResources.length > 0 && (
                                    <div className="border border-gray-200 rounded-lg overflow-hidden min-h-[200px]">
                                        <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 flex items-center justify-between">
                                            <span className="text-xs font-semibold text-gray-500 uppercase">Available Documents</span>
                                            <div className="relative">
                                                <input 
                                                    type="text"
                                                    placeholder="Search documents..."
                                                    value={docSearchQuery}
                                                    onChange={(e) => setDocSearchQuery(e.target.value)}
                                                    className="pl-8 pr-3 py-1 text-xs border border-gray-200 rounded-md focus:outline-none focus:border-[#6266EA] w-48"
                                                />
                                                <Icon name="search" className="w-3 h-3 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                                            </div>
                                        </div>
                                        {isLoadingDocs ? (
                                            <div className="flex flex-col items-center justify-center py-12 text-gray-400 gap-3">
                                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#6266EA]"></div>
                                                <span className="text-sm">Loading documents...</span>
                                            </div>
                                        ) : (
                                            <div className="divide-y divide-gray-100 h-[250px] overflow-y-auto">
                                                {mockDocuments
                                                    .filter(doc => doc.name.toLowerCase().includes(docSearchQuery.toLowerCase()))
                                                    .map(doc => {
                                                    const isSelected = selectedDocs.some(d => d.id === doc.id)
                                                    return (
                                                    <div 
                                                        key={doc.id}
                                                        onClick={() => handleDocSelect(doc)}
                                                        className={`px-4 py-3 flex items-center justify-between cursor-pointer transition-colors ${isSelected ? 'bg-[#6266EA]/5 border-l-2 border-[#6266EA]' : 'hover:bg-gray-50 border-l-2 border-transparent'}`}
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${isSelected ? 'bg-[#6266EA] border-[#6266EA]' : 'border-gray-300'}`}>
                                                                {isSelected && <Icon name="check" className="w-3 h-3 text-white" />}
                                                            </div>
                                                            <Icon name="file" className="w-4 h-4 text-gray-400" />
                                                            <div>
                                                                <div className="text-sm font-medium text-gray-900">{doc.name}</div>
                                                                <div className="text-xs text-gray-500">{doc.size} · {doc.date}</div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    )
                                                })}
                                                {mockDocuments.filter(doc => doc.name.toLowerCase().includes(docSearchQuery.toLowerCase())).length === 0 && (
                                                    <div className="py-8 text-center text-sm text-gray-400">
                                                        No documents found matching "{docSearchQuery}"
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </>
                        )}

                        {inputMode === 'file' && (
                            <div className="mb-6">
                                <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 flex flex-col items-center justify-center text-center hover:border-[#6266EA] transition-colors cursor-pointer bg-gray-50"
                                     onClick={() => {
                                         // Mock file input click
                                         const mockFile = {
                                             id: `file_${Date.now()}`,
                                             name: 'uploaded_data_dataset.json',
                                             size: '1.2 MB',
                                             date: new Date().toISOString().split('T')[0]
                                         };
                                         setUploadedFiles(prev => [...prev, mockFile]);
                                         setSelectedDocs(prev => [...prev, mockFile]);
                                     }}
                                >
                                    <div className="w-12 h-12 rounded-full bg-[#6266EA]/10 flex items-center justify-center mb-4">
                                        <Icon name="plus" className="w-6 h-6 text-[#6266EA]" />
                                    </div>
                                    <h3 className="text-sm font-semibold text-gray-900">Click to upload JSON file</h3>
                                    <p className="text-xs text-gray-500 mt-1">or drag and drop here</p>
                                </div>
                                {uploadedFiles.length > 0 && (
                                    <div className="bg-white border border-gray-200 rounded-lg mt-4 divide-y divide-gray-100">
                                         {uploadedFiles.map(file => (
                                             <div key={file.id} className="px-4 py-3 flex items-center justify-between">
                                                 <div className="flex items-center gap-3">
                                                     <Icon name="file" className="w-4 h-4 text-[#6266EA]" />
                                                     <div>
                                                         <div className="text-sm font-medium text-gray-900">{file.name}</div>
                                                         <div className="text-xs text-gray-500">{file.size} · {file.date}</div>
                                                     </div>
                                                 </div>
                                                 <button onClick={(e) => {
                                                     e.stopPropagation();
                                                     setUploadedFiles(uploadedFiles.filter(f => f.id !== file.id));
                                                     setSelectedDocs(prev => prev.filter(d => d.id !== file.id));
                                                 }} className="text-gray-400 hover:text-red-500">
                                                     <Icon name="trash" className="w-4 h-4" />
                                                 </button>
                                             </div>
                                         ))}
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="flex justify-end mt-6">
                            <button 
                                onClick={startAnalysis}
                                disabled={selectedDocs.length === 0}
                                className={`px-6 py-2 rounded-lg font-medium flex items-center gap-2 transition-all ${
                                    selectedDocs.length > 0
                                    ? 'bg-[#6266EA] text-white hover:bg-[#5256d0] shadow-sm' 
                                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                }`}
                            >
                                {copy.wizard.startChunkAnalysis} ({selectedDocs.length}) <Icon name="arrowRight" className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )}

                {/* Step 2: Analysis */}
                {currentStep === 2 && (
                    <div className="space-y-6 animate-fadeIn">
                        {/* Summary Stats */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                                <div className="text-xs text-gray-500 uppercase font-semibold">{copy.wizard.totalChunks}</div>
                                <div className="text-2xl font-bold text-gray-900 mt-1">{chunks.length}</div>
                            </div>
                            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                                <div className="text-xs text-gray-500 uppercase font-semibold">{copy.wizard.avgQualityScore}</div>
                                <div className="text-2xl font-bold text-[#6266EA] mt-1">
                                    {(chunks.reduce((acc, c) => acc + c.score, 0) / chunks.length).toFixed(1)}
                                </div>
                            </div>
                        </div>

                        {/* Chunk List */}
                        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                                    <Icon name="cpu" className="w-5 h-5 text-[#6266EA]" />
                                    {copy.wizard.chunkAnalysisSelection}
                                </h2>
                                <div className="flex items-center gap-2">
                                    <button 
                                        onClick={() => setIsConfigExpanded(true)}
                                        className="text-xs font-medium text-gray-500 hover:text-[#6266EA] flex items-center gap-1 transition-colors px-3 py-1.5 rounded-lg hover:bg-gray-50 border border-transparent hover:border-gray-200"
                                    >
                                        <Icon name="settings" className="w-4 h-4" />
                                        {copy.wizard.configuration}
                                    </button>
                                    <span className="text-sm text-gray-500">{copy.wizard.sortBy}</span>
                                    <button 
                                        onClick={() => { setSortField('score'); setSortAsc(!sortAsc) }}
                                        className={`px-3 py-1 text-xs font-medium rounded border transition-colors ${sortField === 'score' ? 'bg-[#6266EA]/10 text-[#6266EA] border-[#6266EA]/30' : 'bg-white border-gray-200 text-gray-600'}`}
                                    >
                                        {copy.wizard.qualityScore} {sortField === 'score' && (sortAsc ? '↑' : '↓')}
                                    </button>
                                </div>
                            </div>

                            <table className="w-full text-left">
                                <thead className="bg-gray-50 border-b border-gray-200">
                                    <tr>
                                        <th className="px-6 py-3 w-12">
                                            <input type="checkbox" className="rounded text-[#6266EA] focus:ring-[#6266EA]" 
                                                checked={chunks.every(c => c.selected)}
                                                onChange={(e) => setChunks(chunks.map(c => ({...c, selected: e.target.checked})))}
                                            />
                                        </th>
                                        <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{copy.wizard.chunkContent}</th>
                                        <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider w-32">
                                            <div className="flex items-center gap-1 cursor-pointer" onClick={() => setSortField('score')}>
                                                {copy.wizard.qualityScore}
                                                <Icon name="chevron-down" className={`w-3 h-3 ${sortField === 'score' ? 'text-gray-900' : 'text-gray-300'}`} />
                                            </div>
                                        </th>
                                        <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{copy.wizard.detailedMetrics}</th>
                                        <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider w-24">{copy.wizard.qualityType}</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {sortedChunks.map(chunk => (
                                        <tr key={chunk.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-6 py-4">
                                                <input 
                                                    type="checkbox" 
                                                    checked={chunk.selected}
                                                    onChange={() => toggleChunkSelection(chunk.id)}
                                                    className="rounded text-[#6266EA] focus:ring-[#6266EA]" 
                                                />
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="space-y-1">
                                                    <p className="text-sm text-gray-600 line-clamp-2" title={chunk.content}>{chunk.content}</p>
                                                    <div className="flex items-center gap-2">
                                                        <Icon name="file" className="w-3 h-3 text-gray-400" />
                                                        <span className="text-xs text-gray-500 font-medium">{chunk.sourceDoc}</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`text-sm font-bold ${chunk.score >= 80 ? 'text-green-600' : chunk.score >= 60 ? 'text-yellow-600' : 'text-red-600'}`}>
                                                    {chunk.score}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex gap-3">
                                                    <span className="inline-flex flex-col">
                                                        <span className="text-[10px] text-gray-400 uppercase">{copy.wizard.density}</span>
                                                        <span className="text-xs font-medium text-gray-700">{(chunk.density * 100).toFixed(0)}%</span>
                                                    </span>
                                                    <span className="w-px h-8 bg-gray-100"></span>
                                                    <span className="inline-flex flex-col">
                                                        <span className="text-[10px] text-gray-400 uppercase">{copy.wizard.coherence}</span>
                                                        <span className="text-xs font-medium text-gray-700">{(chunk.coherence * 100).toFixed(0)}%</span>
                                                    </span>
                                                    <span className="w-px h-8 bg-gray-100"></span>
                                                    <span className="inline-flex flex-col">
                                                        <span className="text-[10px] text-gray-400 uppercase">{copy.wizard.complexity}</span>
                                                        <span className="text-xs font-medium text-gray-700">{(chunk.complexity * 100).toFixed(0)}%</span>
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                                    chunk.status === 'High Quality' ? 'bg-green-50 text-green-700' :
                                                    'bg-red-50 text-red-700'
                                                }`}>
                                                    {chunk.status === 'High Quality' ? copy.wizard.highQuality : copy.wizard.lowQuality}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            
                            <div className="p-4 border-t border-gray-200 bg-gray-50 space-y-4">


                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-gray-500">{chunks.filter(c => c.selected).length} {copy.wizard.chunksSelectedSuffix}</span>
                                    <div className="flex gap-3">
                                        <button 
                                            onClick={() => setCurrentStep(1)}
                                            className="px-4 py-2 text-gray-600 hover:text-gray-900 font-medium"
                                        >
                                            {copy.wizard.back}
                                        </button>
                                        <button 
                                            onClick={handleGenerateQA}
                                            disabled={isGenerating || chunks.filter(c => c.selected).length === 0}
                                            className="px-6 py-2 bg-[#6266EA] text-white rounded-lg font-medium hover:bg-[#5256d0] shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                        >
                                            {isGenerating ? (
                                                <>{copy.wizard.generating}</>
                                            ) : (
                                                <>{copy.wizard.generateQaPairs} <Icon name="zap" className="w-4 h-4" /></>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Step 3: QA Generation Results */}
                {currentStep === 3 && (
                     <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden animate-fadeIn">
                        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                                <Icon name="list" className="w-5 h-5 text-[#6266EA]" />
                                {copy.wizard.generatedEvaluationSet}
                            </h2>
                            <div className="flex items-center gap-3">
                                {/* Filters */}
                                <select 
                                    className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-[#6266EA]"
                                    value={qaFilterStats}
                                    onChange={(e) => setQaFilterStats(e.target.value)}
                                >
                                    <option value="all">{copy.wizard.allStatus}</option>
                                    <option value="valid">{copy.wizard.validOnly}</option>
                                    <option value="invalid">{copy.wizard.invalidOnly}</option>
                                </select>
                                <select 
                                    className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-[#6266EA] max-w-[150px]"
                                    value={qaFilterDoc}
                                    onChange={(e) => setQaFilterDoc(e.target.value)}
                                >
                                    <option value="all">{copy.wizard.allDocuments}</option>
                                    {[...new Set(qaPairs.map(qa => qa.sourceDoc))].map(doc => (
                                        <option key={doc} value={doc}>{doc}</option>
                                    ))}
                                </select>
                                
                                <div className="h-4 w-px bg-gray-200 mx-1"></div>

                                <button 
                                    onClick={() => setIsConfigExpanded(true)}
                                    className="text-xs font-medium text-gray-500 hover:text-[#6266EA] flex items-center gap-1 transition-colors px-3 py-1.5 rounded-lg hover:bg-gray-50 border border-transparent hover:border-gray-200"
                                >
                                    <Icon name="settings" className="w-4 h-4" />
                                    {copy.wizard.configuration}
                                </button>
                                <button 
                                    onClick={() => { setQaPairs([]); setCurrentStep(2) }}
                                    className="text-sm text-[#6266EA] hover:underline flex items-center gap-1"
                                >
                                    <Icon name="refresh" className="w-3 h-3" /> {copy.wizard.regenerate}
                                </button>
                            </div>
                        </div>

                        <div className="p-6">
                            <div className="mb-6 flex gap-4">
                                <div className="bg-green-50 text-green-700 px-4 py-3 rounded-lg text-sm flex-1 border border-green-100">
                                    <strong>{copy.wizard.readyForEvaluation}</strong> {qaPairs.length} {copy.wizard.questionsGeneratedValidatedSuffix}
                                </div>
                                <div className="bg-blue-50 text-blue-700 px-4 py-3 rounded-lg text-sm flex-1 border border-blue-100">
                                    <strong>{copy.wizard.coverage}</strong> {chunks.filter(c => c.selected).length} {copy.wizard.sourceChunksUsedSuffix}
                                </div>
                            </div>

                            <div className="border border-gray-200 rounded-lg overflow-hidden">
                                <table className="w-full text-left">
                                    <thead className="bg-gray-50 border-b border-gray-200">
                                        <tr>
                                            <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider w-16">#</th>
                                            <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider w-1/4">{copy.wizard.sourceChunk}</th>
                                            <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{copy.wizard.questionAnswer}</th>
                                            <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider w-32">{copy.wizard.qualityScore}</th>
                                            <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider w-32">{copy.wizard.category}</th>
                                            <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider w-32">{copy.wizard.status}</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {qaPairs
                                            .filter(qa => {
                                                if (qaFilterStats === 'valid') return qa.valid;
                                                if (qaFilterStats === 'invalid') return !qa.valid;
                                                return true;
                                            })
                                            .filter(qa => qaFilterDoc === 'all' || qa.sourceDoc === qaFilterDoc)
                                            .sort((a, b) => a.sourceDoc.localeCompare(b.sourceDoc))
                                            .map((qa, idx) => (
                                            <tr key={qa.id} className="hover:bg-gray-50 transition-colors">
                                                <td className="px-6 py-4 align-top text-gray-500 text-sm font-medium">
                                                    {idx + 1}
                                                </td>
                                                <td className="px-6 py-4 align-top">
                                                    <div className="space-y-2 group relative">
                                                        {/* Chunk Content Snippet */}
                                                        <div>
                                                            <div className="text-sm text-gray-900 font-medium line-clamp-2 cursor-help decoration-dotted underline-offset-4 hover:underline decoration-gray-300">
                                                                {chunks.find(c => c.id === qa.chunkId)?.content}
                                                            </div>
                                                            {/* Hover Tooltip */}
                                                            <div className="absolute left-0 top-full mt-2 w-80 p-4 bg-gray-900 text-white text-xs rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 pointer-events-none">
                                                                <div className="font-semibold mb-2 text-gray-400 uppercase tracking-wider text-[10px]">{copy.wizard.fullChunkContent}</div>
                                                                <p className="leading-relaxed text-gray-100 dark-text-selection">
                                                                    {chunks.find(c => c.id === qa.chunkId)?.content}
                                                                </p>
                                                                <div className="absolute -top-1 left-4 w-2 h-2 bg-gray-900 transform rotate-45"></div>
                                                            </div>
                                                        </div>

                                                        {/* Metadata & Report Action */}
                                                        <div className="flex items-center justify-between mt-1">
                                                            <div className="flex items-center gap-2 text-gray-500 text-xs">
                                                                <Icon name="file" className="w-3.5 h-3.5" />
                                                                <span className="line-clamp-1 max-w-[120px]" title={qa.sourceDoc}>{qa.sourceDoc}</span>
                                                            </div>
                                                            <button 
                                                                onClick={() => setReportChunk(chunks.find(c => c.id === qa.chunkId))}
                                                                className="text-gray-400 hover:text-[#6266EA] p-1 rounded hover:bg-gray-100 transition-all"
                                                                title={copy.wizard.viewChunkReport}
                                                            >
                                                                <Icon name="activity" className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 align-top">
                                                    {editingId === qa.id ? (
                                                        <div className="space-y-4 animate-fadeIn">
                                                            <div>
                                                                <label className="text-[10px] text-gray-400 font-bold uppercase mb-1 tracking-wide block">{copy.wizard.question}</label>
                                                                <textarea 
                                                                    className="w-full text-sm text-gray-900 border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-[#6266EA] focus:border-transparent outline-none bg-white font-sans"
                                                                    rows={2}
                                                                    value={editForm.question}
                                                                    onChange={(e) => setEditForm({...editForm, question: e.target.value})}
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="text-[10px] text-gray-400 font-bold uppercase mb-1 tracking-wide block">{copy.wizard.answer}</label>
                                                                <textarea 
                                                                    className="w-full text-sm text-gray-600 border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-[#6266EA] focus:border-transparent outline-none bg-white font-sans"
                                                                    rows={3}
                                                                    value={editForm.answer}
                                                                    onChange={(e) => setEditForm({...editForm, answer: e.target.value})}
                                                                />
                                                            </div>
                                                            <div className="flex gap-2">
                                                                <button onClick={handleSaveEdit} className="flex items-center gap-1 px-3 py-1.5 bg-[#6266EA] text-white text-xs font-medium rounded hover:bg-[#5256d0] shadow-sm transition-colors">
                                                                    <Icon name="save" className="w-3 h-3" /> {copy.wizard.saveChangesShort}
                                                                </button>
                                                                <button onClick={handleCancelEdit} className="px-3 py-1.5 bg-white border border-gray-300 text-gray-600 text-xs font-medium rounded hover:bg-gray-50 transition-colors">
                                                                    {copy.wizard.cancel}
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="space-y-3 group/qa">
                                                            <div>
                                                                <div className="flex justify-between items-start">
                                                                    <div className="flex items-center gap-2">
                                                                         <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wide">{copy.wizard.question}</div>
                                                                         {/* Mock Tag based on Image feedback */}
                                                                    </div>
                                                                    <div className="flex gap-1 opacity-100 md:opacity-0 md:group-hover/qa:opacity-100 transition-all duration-200">
                                                                        <button 
                                                                            onClick={() => handleEditClick(qa)} 
                                                                            className="p-1.5 text-gray-400 hover:text-[#6266EA] rounded-md hover:bg-[#6266EA]/5 transition-colors"
                                                                            title={copy.wizard.editQuestion}
                                                                        >
                                                                            <Icon name="edit" className="w-3.5 h-3.5" />
                                                                        </button>
                                                                        <button 
                                                                            onClick={() => handleDeleteQA(qa.id)} 
                                                                            className="p-1.5 text-gray-400 hover:text-red-500 rounded-md hover:bg-red-50 transition-colors"
                                                                            title={copy.wizard.deleteQuestion}
                                                                        >
                                                                            <Icon name="trash" className="w-3.5 h-3.5" />
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                                <p className="text-sm text-gray-900 font-medium leading-relaxed">{qa.question}</p>
                                                            </div>
                                                            <div>
                                                                <div className="text-[10px] text-gray-400 font-bold uppercase mb-1 tracking-wide">{copy.wizard.answer}</div>
                                                                <p className="text-sm text-gray-600 leading-relaxed">{qa.answer}</p>
                                                            </div>
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 align-top">
                                                    <div className={`text-xl font-bold ${qa.score >= 80 ? 'text-green-600' : qa.score >= 60 ? 'text-yellow-600' : 'text-red-600'}`}>
                                                        {qa.score}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 align-top">
                                                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${qa.type === 'Factual' ? 'bg-blue-100 text-blue-600' : 'bg-purple-100 text-purple-600'}`}>
                                                        {formatQaType(qa.type, isZh)}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 align-top">
                                                     {qa.valid && (
                                                        <div className="flex flex-col items-start gap-2">
                                                            <span className="flex items-center gap-1.5 text-xs text-green-700 font-medium bg-green-50 px-3 py-1 rounded-full border border-green-100 w-fit">
                                                                <Icon name="check" className="w-3.5 h-3.5" /> {copy.wizard.validated}
                                                            </span>
                                                            <button 
                                                                onClick={() => setReportQA(qa)}
                                                                className="text-xs text-[#6266EA] hover:underline flex items-center gap-1 font-medium mt-1"
                                                            >
                                                                {copy.wizard.viewReport} <Icon name="arrowRight" className="w-3 h-3" />
                                                            </button>
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
                            <button className="px-6 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 font-medium shadow-sm">
                                {copy.wizard.exportJson}
                            </button>
                            <button 
                                onClick={handleRunAIEvaluation}
                                disabled={isEvaluating}
                                className="px-6 py-2 bg-[#6266EA] text-white rounded-lg hover:bg-[#5256d0] font-medium shadow-sm flex items-center gap-2"
                            >
                                {isEvaluating ? copy.wizard.evaluating : copy.wizard.startAiEvaluation} 
                                {!isEvaluating && <Icon name="zap" className="w-4 h-4" />}
                            </button>
                        </div>
                     </div>
                )}

                {/* Step 4: AI Evaluation Results */}
                {currentStep === 4 && (
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden animate-fadeIn">
                        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                                <Icon name="activity" className="w-5 h-5 text-[#6266EA]" />
                                {copy.wizard.aiEvaluationResults}
                            </h2>
                            <div className="flex items-center gap-3">
                                <button 
                                    onClick={() => setResultSort(prev => {
                                        if (prev === 'default') return 'desc'
                                        if (prev === 'desc') return 'asc'
                                        return 'default'
                                    })}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                                >
                                    <Icon name="filter" className="w-3.5 h-3.5" />
                                    {copy.wizard.sortLabel} {resultSort === 'default' ? copy.wizard.sortDefault : resultSort === 'desc' ? copy.wizard.sortHighLow : copy.wizard.sortLowHigh}
                                </button>
                                <div className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs font-medium border border-blue-100">
                                    {copy.wizard.avgScore} {Object.values(aiResults).length > 0 
                                        ? (Object.values(aiResults).reduce((acc, curr) => acc + curr.score, 0) / Object.values(aiResults).length).toFixed(1) 
                                        : 0}
                                </div>
                            </div>
                        </div>

                        <div className="divide-y divide-gray-100">
                            {[...qaPairs]
                                .sort((a, b) => {
                                    if (resultSort === 'default') return 0
                                    const scoreA = aiResults[a.id]?.score || 0
                                    const scoreB = aiResults[b.id]?.score || 0
                                    return resultSort === 'asc' ? scoreA - scoreB : scoreB - scoreA
                                })
                                .map((qa, idx) => {
                                const result = aiResults[qa.id]
                                return (
                                    <div key={qa.id} className="p-6 hover:bg-gray-50 transition-colors">
                                        <div className="flex gap-6">
                                            <div className="w-1/3 space-y-4">
                                                <div>
                                                    <div className="text-[10px] text-gray-400 font-bold uppercase mb-1 tracking-wide">{copy.wizard.question}</div>
                                                    <p className="text-sm text-gray-900 font-medium">{qa.question}</p>
                                                </div>
                                                <div>
                                                    <div className="text-[10px] text-gray-400 font-bold uppercase mb-1 tracking-wide">{copy.wizard.referenceAnswer}</div>
                                                    <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg border border-gray-100">{qa.answer}</p>
                                                </div>
                                            </div>
                                            
                                            <div className="flex-1 space-y-4">
                                                 <div>
                                                    <div className="flex items-center justify-between mb-1">
                                                        <div className="flex items-center gap-2">
                                                            <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wide">{copy.wizard.aiModelAnswer}</div>
                                                            <button 
                                                                onClick={() => handleRegenerateSingle(qa.id)}
                                                                disabled={regeneratingIds.has(qa.id)}
                                                                className={`p-1 rounded-full hover:bg-gray-100 transition-colors text-gray-500 hover:text-[#6266EA] ${regeneratingIds.has(qa.id) ? 'animate-spin' : ''}`}
                                                                title={copy.wizard.regenerateAnswer}
                                                            >
                                                                <Icon name="refresh" className="w-3 h-3" />
                                                            </button>
                                                        </div>
                                                        <div className="flex items-center gap-3">
                                                            <button
                                                                onClick={() => toggleBadAnswer(qa.id)}
                                                                className={`flex items-center gap-1.5 px-2 py-0.5 rounded border text-[10px] font-bold uppercase tracking-wide transition-all ${
                                                                    badAnswers.has(qa.id) 
                                                                        ? 'bg-red-50 text-red-600 border-red-200' 
                                                                        : 'bg-white text-gray-400 border-gray-200 hover:border-gray-300 hover:text-gray-600'
                                                                }`}
                                                            >
                                                                <Icon name="thumbsDown" className="w-3 h-3" />
                                                                {badAnswers.has(qa.id) ? copy.wizard.badAnswer : copy.wizard.markBad}
                                                            </button>
                                                            <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                                                                (result?.score || 0) >= 90 ? 'bg-green-100 text-green-700' : 
                                                                (result?.score || 0) >= 80 ? 'bg-blue-100 text-blue-700' : 
                                                                'bg-yellow-100 text-yellow-700'
                                                            }`}>
                                                                {copy.wizard.score}: {result?.score || 0}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <div className={`p-4 rounded-lg text-sm leading-relaxed border transition-colors ${
                                                        regeneratingIds.has(qa.id) 
                                                            ? 'bg-gray-50 border-gray-100 text-gray-400 animate-pulse' 
                                                            : 'bg-purple-50 border-purple-100 text-gray-800'
                                                    }`}>
                                                        {regeneratingIds.has(qa.id) ? copy.wizard.regenerating : result?.aiAnswer}
                                                    </div>
                                                </div>
                                                <div>
                                                    <div className="text-[10px] text-gray-400 font-bold uppercase mb-1 tracking-wide">{copy.wizard.evaluationReasoning}</div>
                                                    <p className="text-xs text-gray-500 italic">
                                                        "{result?.reasoning}"
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                        
                        <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
                            <button 
                                onClick={() => setCurrentStep(3)}
                                className="px-6 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 font-medium shadow-sm"
                            >
                                {copy.wizard.back}
                            </button>
                            <button onClick={() => onBack && onBack()} className="px-6 py-2 bg-[#6266EA] text-white rounded-lg hover:bg-[#5256d0] font-medium shadow-sm">
                                {copy.wizard.save}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </main>
    </>
  )
}

const EvaluationHistoryList = ({ onCreateNew, onSelectRow }) => {
    const { isZh } = useLanguage()
    const copy = getEvaluationCopy(isZh)
    const [searchTerm, setSearchTerm] = useState('')
    const [filterDate, setFilterDate] = useState('')
    const [filterKB, setFilterKB] = useState('')
    const [filterStatus, setFilterStatus] = useState('')
    const [filterAIStatus, setFilterAIStatus] = useState('')

    const historyData = [
        { 
            id: 'task_1', 
            createdAt: '2024-01-15 14:30:00', 
            status: 'completed', 
            aiStatus: 'completed',
            kbName: copy.history.kbNames.kbA, 
            docCount: 5, 
            docs: ['Product_Manual_v2.pdf', 'API_Reference.md', 'Setup_Guide.docx', 'Release_Notes_Q1.pdf', 'FAQ_Internal.pdf'],
            chunkCount: 120, 
            validQACount: 85, 
            processedCount: 100 
        },
        { 
            id: 'task_2', 
            createdAt: '2024-01-14 09:15:00', 
            status: 'analysis', 
            aiStatus: 'pending',
            kbName: copy.history.kbNames.kbB, 
            docCount: 3, 
            docs: ['Troubleshooting_Network.pdf', 'Server_Config.yaml', 'Error_Codes.xlsx'],
            chunkCount: '-', 
            validQACount: '-', 
            processedCount: '-' 
        },
        { 
            id: 'task_3', 
            createdAt: '2024-01-13 16:45:00', 
            status: 'generate', 
            aiStatus: 'pending',
            kbName: copy.history.kbNames.product, 
            docCount: 10, 
            docs: ['Competitor_Analysis_2024.pdf', 'Market_Trends.pptx', 'User_Feedback_Q4.csv', 'Product_Roadmap.pdf', 'Feature_Specs.docx'],
            chunkCount: 200, 
            validQACount: '-', 
            processedCount: 150 
        },
    ]

    const filteredData = historyData.filter(item => {
        // Only search by id (Task ID) or kbName, not document names
        const matchSearch = item.kbName.toLowerCase().includes(searchTerm.toLowerCase()) || item.id.toLowerCase().includes(searchTerm.toLowerCase())
        const matchKB = filterKB ? item.kbName === filterKB : true
        const matchStatus = filterStatus ? item.status === filterStatus : true
        const matchAIStatus = filterAIStatus ? item.aiStatus === filterAIStatus : true
        // Simple date string match for prototype
        const matchDate = filterDate ? item.createdAt.includes(filterDate) : true
        return matchSearch && matchKB && matchDate && matchStatus && matchAIStatus
    })

    const getStatusStyle = (status) => {
        switch(status) {
            case 'completed': return 'bg-green-100 text-green-800 border-green-200';
            case 'analysis': return 'bg-blue-100 text-blue-800 border-blue-200';
            case 'generate': return 'bg-purple-100 text-purple-800 border-purple-200';
            default: return 'bg-gray-100 text-gray-800 border-gray-200';
        }
    }

    return (
        <div className="flex-1 overflow-y-auto p-8 animate-fadeIn">
            <div className="max-w-7xl mx-auto space-y-8">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-semibold text-gray-900">{copy.history.title}</h1>
                        <p className="text-sm text-gray-500 mt-1">{copy.history.subtitle}</p>
                    </div>
                    <button 
                        onClick={onCreateNew}
                        className="px-4 py-2 bg-[#6266EA] text-white rounded-lg font-medium hover:bg-[#5256d0] shadow-sm flex items-center gap-2 transition-all"
                    >
                        <Icon name="plus" className="w-5 h-5" />
                        {copy.history.newTask}
                    </button>
                </div>

                {/* Filters */}
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-wrap items-center gap-4">
                    <select 
                        className="px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#6266EA] bg-white flex-1 min-w-[200px]"
                        value={filterKB}
                        onChange={(e) => setFilterKB(e.target.value)}
                    >
                        <option value="">{copy.history.allKnowledgeBases}</option>
                        <option value={copy.history.kbNames.kbA}>{copy.history.kbNames.kbA}</option>
                        <option value={copy.history.kbNames.kbB}>{copy.history.kbNames.kbB}</option>
                        <option value={copy.history.kbNames.product}>{copy.history.kbNames.product}</option>
                    </select>
                    <select 
                        className="px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#6266EA] bg-white"
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                    >
                        <option value="">{copy.history.allQaGenStatus}</option>
                        <option value="completed">{copy.history.completed}</option>
                        <option value="analysis">{copy.history.analysis}</option>
                        <option value="generate">{copy.history.generate}</option>
                    </select>
                    <select 
                        className="px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#6266EA] bg-white"
                        value={filterAIStatus}
                        onChange={(e) => setFilterAIStatus(e.target.value)}
                    >
                        <option value="">{copy.history.recallEvalStatus}</option>
                        <option value="completed">{copy.history.completed}</option>
                        <option value="pending">{copy.history.pending}</option>
                    </select>
                    <input 
                        type="date" 
                        className="px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#6266EA]"
                        value={filterDate}
                        onChange={(e) => setFilterDate(e.target.value)}
                    />
                </div>

                {/* Table */}
                <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                                <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{copy.history.knowledgeBaseInfo}</th>
                                <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-center">{copy.history.validQa}</th>
                                <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{copy.history.qaGenerationStatus}</th>
                                <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{copy.history.recallEvaluationStatus}</th>
                                <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{copy.history.createdTime}</th>
                                <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">{copy.history.actions}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredData.map(item => (
                                <tr 
                                    key={item.id} 
                                    className="hover:bg-gray-50 transition-colors cursor-pointer"
                                    onClick={() => onSelectRow && onSelectRow(item)}
                                >
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col gap-1">
                                            <span className="text-sm font-medium text-gray-900">{item.kbName}</span>
                                            <div className="flex items-center gap-3 text-xs text-gray-500">
                                                <div className="group relative flex items-center gap-1 cursor-help">
                                                    <Icon name="file" className="w-3 h-3" /> 
                                                    <span className="group-hover:text-[#6266EA] transition-colors">{item.docCount} {copy.history.docs}</span>
                                                    
                                                    {/* Document List Tooltip */}
                                                    <div className="absolute left-0 top-full mt-2 w-64 p-3 bg-white border border-gray-200 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 pointer-events-none">
                                                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 pb-1 border-b border-gray-100">
                                                            {copy.history.includedDocuments}
                                                        </div>
                                                        <ul className="space-y-1.5 max-h-40 overflow-y-auto">
                                                            {item.docs && item.docs.slice(0, 5).map((doc, i) => (
                                                                <li key={i} className="flex items-start gap-2 text-xs text-gray-600">
                                                                    <Icon name="file" className="w-3 h-3 flex-shrink-0 mt-0.5 text-gray-400" />
                                                                    <span className="break-all line-clamp-2">{doc}</span>
                                                                </li>
                                                            ))}
                                                            {item.docs && item.docs.length > 5 && (
                                                                <li className="text-[10px] text-gray-400 pl-5 italic">
                                                                    + {item.docs.length - 5} {copy.history.more}...
                                                                </li>
                                                            )}
                                                        </ul>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span className="text-sm text-gray-600 font-mono">{item.validQACount}</span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded border text-xs font-medium capitalize ${getStatusStyle(item.status)}`}>
                                            {formatEvaluationStatus(item.status, copy.history)}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded border text-xs font-medium capitalize ${getStatusStyle(item.aiStatus)}`}>
                                            {formatEvaluationStatus(item.aiStatus, copy.history)}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="text-sm text-gray-500">{item.createdAt}</span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-3 text-xs font-medium">
                                            <button className="text-[#6266EA] hover:underline" onClick={(e) => {e.stopPropagation(); onSelectRow && onSelectRow(item)}}>{copy.history.view}</button>
                                            <button className="text-red-600 hover:underline" onClick={(e) => e.stopPropagation()}>{copy.history.delete}</button>
                                            <button 
                                                className={`hover:underline ${item.aiStatus === 'completed' ? 'text-gray-600 hover:text-gray-900' : 'text-gray-300 cursor-not-allowed'}`} 
                                                onClick={(e) => {
                                                    e.stopPropagation(); 
                                                    if(item.aiStatus === 'completed') {
                                                        // Handle download logic here
                                                    }
                                                }}
                                                disabled={item.aiStatus !== 'completed'}
                                            >
                                                {copy.history.download}
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {filteredData.length === 0 && (
                        <div className="p-8 text-center text-gray-500 text-sm">
                            {copy.history.empty}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

const EvaluationAgent = () => {
    const [viewMode, setViewMode] = useState('list') // 'list' | 'create'
    const [selectedHistoryItem, setSelectedHistoryItem] = useState(null)

    const handleCreateNew = () => {
        setSelectedHistoryItem(null)
        setViewMode('create')
    }

    const handleSelectRow = (item) => {
        setSelectedHistoryItem(item)
        setViewMode('create')
    }

    return (
        <div className="flex h-screen bg-white">
            <Sidebar compact />
            <ProjectSideMenu title="平台工具" subtitle="评测与质量运营" items={platformToolMenuItems} />
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#f8f9fa]">
                {viewMode === 'list' && (
                    <EvaluationHistoryList 
                        onCreateNew={handleCreateNew} 
                        onSelectRow={handleSelectRow}
                    />
                )}
                {viewMode === 'create' && (
                    <CreateEvaluationWizard 
                        onBack={() => setViewMode('list')} 
                        initialData={selectedHistoryItem}
                    />
                )}
            </div>
        </div>
    )
}

export default EvaluationAgent
