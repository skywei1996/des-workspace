/**
 * Skill: report-complete
 * 汇报结构补全
 */

import type { ReportCompleteInput, ReportCompleteOutput, CompletedReport } from '../shared/types.js';

interface LLMClientLike {
  generateJSON<T>(prompt: string, systemPrompt?: string): Promise<T>;
}

export async function reportComplete(input: ReportCompleteInput, _context?: { llmClient?: LLMClientLike }): Promise<ReportCompleteOutput> { const { llmClient } = _context ?? {}; 
  const { draftContent, missingFields } = input;

  if (!draftContent || draftContent.trim().length < 10) {
    return { success: false, message: '草稿内容过短' };
  }

  try {
    const defaultFields = ['progress', 'problems', 'plan', 'risks'];
    const fieldsToComplete = missingFields || defaultFields;

    const systemPrompt = `你是一个专业的汇报助手，擅长补全汇报内容。

请按照以下 JSON 格式返回：
{
  "title": "汇报标题",
  "background": "背景说明",
  "progress": ["进展1", "进展2"],
  "problems": ["问题1"],
  "plan": ["计划1"],
  "risks": ["风险1"]
}

要求：直接返回 JSON，不要包含其他说明`;

    const userPrompt = `请补全以下汇报内容（需补全字段：${fieldsToComplete.join('、')}）：

${draftContent}`;

    const result = await llmClient.generateJSON<CompletedReport>(userPrompt, systemPrompt);
    return { success: true, data: result };
  } catch (error) {
    return { success: false, message: `汇报补全失败: ${error instanceof Error ? error.message : String(error)}` };
  }
}
