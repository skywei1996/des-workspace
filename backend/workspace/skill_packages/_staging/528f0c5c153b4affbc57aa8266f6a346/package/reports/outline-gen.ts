/**
 * Skill: outline-gen
 * 汇报大纲生成
 */

import type { OutlineGenInput, OutlineGenSkillOutput, OutlineGenOutput } from '../shared/types.js';

interface LLMClientLike {
  generateJSON<T>(prompt: string, systemPrompt?: string): Promise<T>;
}

/**
 * @param input - 包含原始内容、汇报类型
 * @param options - { llmClient } - LLM 客户端（必填）
 */
export async function outlineGen(input: OutlineGenInput, _context?: { llmClient?: LLMClientLike }): Promise<OutlineGenSkillOutput> { const { llmClient } = _context ?? {}; 
  const { rawContent, reportType } = input;

  if (!rawContent || rawContent.trim().length < 10) {
    return { success: false, message: '内容过短，请至少提供10个字的描述' };
  }

  try {
    const systemPrompt = `你是一个专业的汇报策划助手，擅长从零散内容中提炼结构化大纲。

汇报类型：${reportType}

请按照以下 JSON 格式返回：
{
  "suggestedTitle": "建议标题",
  "sections": [
    {
      "title": "章节标题",
      "points": ["要点1", "要点2"]
    }
  ]
}

要求：直接返回 JSON，不要包含其他说明`;

    const userPrompt = `请为以下内容生成${reportType}大纲：

${rawContent}`;

    const result = await llmClient.generateJSON<OutlineGenOutput>(userPrompt, systemPrompt);

    if (!result.sections || result.sections.length === 0) {
      return { success: false, message: '生成失败：未能生成有效的大纲结构' };
    }

    return { success: true, data: result };
  } catch (error) {
    return { success: false, message: `大纲生成失败: ${error instanceof Error ? error.message : String(error)}` };
  }
}
