/**
 * Skill: decision-summary-gen
 * 决策摘要生成
 */

import type { DecisionSummaryGenInput, DecisionSummaryGenOutput, DecisionSummary } from '../shared/types.js';

interface LLMClientLike {
  generateJSON<T>(prompt: string, systemPrompt?: string): Promise<T>;
}

export async function decisionSummaryGen(input: DecisionSummaryGenInput, _context?: { llmClient?: LLMClientLike }): Promise<DecisionSummaryGenOutput> { const { llmClient } = _context ?? {}; 
  const { todoId, resolved, pending } = input;

  if ((!resolved || resolved.length === 0) && (!pending || pending.length === 0)) {
    return { success: false, message: '没有可生成摘要的内容' };
  }

  try {
    let context = `决策事项 ID：${todoId}\n\n`;

    if (resolved && resolved.length > 0) {
      context += `已决事项：\n`;
      for (const item of resolved) context += `  - ${item.content}\n`;
    }
    if (pending && pending.length > 0) {
      context += `\n待决事项：\n`;
      for (const item of pending) context += `  - ${item.content}\n`;
    }

    const systemPrompt = `你是一个专业的决策总结助手，擅长生成清晰、可传达的决策摘要。

请按照以下 JSON 格式返回：
{
  "title": "决策标题（一句话概括）",
  "decision": "核心决策内容（1-2句话）",
  "resolvedPoints": ["已决事项1", "已决事项2"],
  "pendingPoints": ["待决事项1", "待决事项2"],
  "actionItems": ["行动项1", "行动项2"]
}

要求：直接返回 JSON，不要包含其他说明`;

    const userPrompt = `请生成以下事项的决策摘要：\n\n${context}`;

    const result = await llmClient.generateJSON<DecisionSummary>(userPrompt, systemPrompt);
    return { success: true, data: result };
  } catch (error) {
    return { success: false, message: `摘要生成失败: ${error instanceof Error ? error.message : String(error)}` };
  }
}
