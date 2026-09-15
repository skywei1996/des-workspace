/**
 * Skill: report-rewrite
 * 汇报改写
 */

import type { ReportRewriteInput, ReportRewriteOutput } from '../shared/types.js';

interface LLMClientLike {
  generateJSON<T>(prompt: string, systemPrompt?: string): Promise<T>;
}

export async function reportRewrite(input: ReportRewriteInput, _context?: { llmClient?: LLMClientLike }): Promise<ReportRewriteOutput> { const { llmClient } = _context ?? {}; 
  const { draftContent, rewriteType, instruction } = input;

  if (!draftContent || draftContent.trim().length < 10) {
    return { success: false, message: '草稿内容过短' };
  }

  try {
    const typeInstructions = {
      structure: '优化结构，使逻辑更清晰，层次更分明',
      expression: '优化表达，使语言更专业、准确、流畅',
      simplify: '精简内容，去除冗余，保留核心信息',
    };

    const systemPrompt = `你是一个专业的汇报编辑助手，擅长优化汇报内容。

当前优化类型：${typeInstructions[rewriteType]}
${instruction ? `额外要求：${instruction}` : ''}

请按照以下 JSON 格式返回：
{
  "rewritten": "改写后的完整内容",
  "changes": ["改动点1", "改动点2"]
}

要求：直接返回 JSON，不要包含其他说明`;

    const userPrompt = `请优化以下汇报内容：\n\n${draftContent}`;

    const result = await llmClient.generateJSON<{ rewritten: string; changes: string[] }>(userPrompt, systemPrompt);

    return {
      success: true,
      data: { original: draftContent, rewritten: result.rewritten, changes: result.changes },
    };
  } catch (error) {
    return { success: false, message: `汇报改写失败: ${error instanceof Error ? error.message : String(error)}` };
  }
}
