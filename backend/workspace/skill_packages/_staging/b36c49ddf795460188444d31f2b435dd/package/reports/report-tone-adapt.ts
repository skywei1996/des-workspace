/**
 * Skill: report-tone-adapt
 * 汇报口径适配
 */

import type { ReportToneAdaptInput, ReportToneAdaptOutput } from '../shared/types.js';

interface LLMClientLike {
  generateJSON<T>(prompt: string, systemPrompt?: string): Promise<T>;
}

export async function reportToneAdapt(input: ReportToneAdaptInput, _context?: { llmClient?: LLMClientLike }): Promise<ReportToneAdaptOutput> { const { llmClient } = _context ?? {}; 
  const { draftContent, audience } = input;

  if (!draftContent || draftContent.trim().length < 10) {
    return { success: false, message: '草稿内容过短' };
  }

  try {
    const audienceInstructions = {
      '直属上级': '简洁务实，突出具体进展和问题，数据支撑，面向执行',
      '管理层': '战略视角，突出业务影响和风险，简洁明了，面向决策',
      '跨部门': '信息完整，背景清晰，便于协作，面向协调',
      '外部': '正式规范，突出成果和价值，面向展示',
    };

    const systemPrompt = `你是一个专业的沟通顾问，擅长根据汇报对象调整表达风格。

汇报对象：${audience}
风格要求：${audienceInstructions[audience]}

请按照以下 JSON 格式返回：
{
  "adapted": "适配后的内容",
  "explanation": "改动说明"
}

要求：直接返回 JSON，不要包含其他说明`;

    const userPrompt = `请将以下汇报适配${audience}：\n\n${draftContent}`;

    const result = await llmClient.generateJSON<{ adapted: string; explanation: string }>(userPrompt, systemPrompt);
    return { success: true, data: result };
  } catch (error) {
    return { success: false, message: `口径适配失败: ${error instanceof Error ? error.message : String(error)}` };
  }
}
