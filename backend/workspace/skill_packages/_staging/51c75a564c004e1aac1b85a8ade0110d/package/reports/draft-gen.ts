/**
 * Skill: draft-gen
 * 汇报草稿生成
 */

import type { DraftGenInput, DraftGenSkillOutput, DraftGenOutput } from '../shared/types.js';

interface LLMClientLike {
  generate(prompt: string, systemPrompt?: string): Promise<string>;
  generateJSON<T>(prompt: string, systemPrompt?: string): Promise<T>;
}

/**
 * @param input - 包含原始内容、汇报类型等
 * @param options - { llmClient } - LLM 客户端（必填）
 */
export async function draftGen(input: DraftGenInput, _context?: { llmClient?: LLMClientLike }): Promise<DraftGenSkillOutput> { const { llmClient } = _context ?? {}; 
  const { rawContent, reportType, targetAudience, templateId } = input;

  if (!rawContent || rawContent.trim().length < 10) {
    return { success: false, message: '汇报内容过短，请至少提供10个字的描述' };
  }

  try {
    const targetAudienceDesc = targetAudience ? `汇报对象：${targetAudience}` : '汇报对象：直属上级';
    const templateDesc = templateId ? `模板 ID：${templateId}` : '';

    const systemPrompt = `你是一个专业的企业汇报助手，擅长将零散的工作内容整理为结构化汇报。

汇报类型：${reportType}
${targetAudienceDesc}
${templateDesc}

请按照以下 JSON 格式返回：
{
  "title": "汇报标题",
  "background": "背景说明（可选）",
  "progress": ["进展1", "进展2"],
  "problems": ["问题1（可选）"],
  "plan": ["计划1（可选）"],
  "risks": ["风险1（可选）"]
}

要求：直接返回 JSON，不要包含其他说明`;

    const userPrompt = `请将以下工作内容整理为${reportType}：

${rawContent}`;

    const result = await llmClient.generateJSON<DraftGenOutput>(userPrompt, systemPrompt);

    if (!result.progress || result.progress.length === 0) {
      return { success: false, message: '生成失败：未能识别有效的工作进展' };
    }

    return { success: true, data: result };
  } catch (error) {
    return { success: false, message: `汇报生成失败: ${error instanceof Error ? error.message : String(error)}` };
  }
}
