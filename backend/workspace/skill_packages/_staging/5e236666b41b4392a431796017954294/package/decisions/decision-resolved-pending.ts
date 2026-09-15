/**
 * Skill: decision-resolved-pending
 * 已决/待决区分
 */

import type { DecisionResolvedPendingInput, DecisionResolvedPendingOutput } from '../shared/types.js';

interface LLMClientLike {
  generateJSON<T>(prompt: string, systemPrompt?: string): Promise<T>;
}

export async function decisionResolvedPending(input: DecisionResolvedPendingInput, { llmClient }: { llmClient: LLMClientLike }): Promise<DecisionResolvedPendingOutput> {
  const { todoStatus, conclusions } = input;

  if (!conclusions || conclusions.length === 0) {
    return { success: false, message: '没有可区分的结论' };
  }

  try {
    const systemPrompt = `你是一个专业的决策分析助手，擅长区分已决事项和待决事项。

请按照以下 JSON 格式返回：
{
  "resolved": [{ "content": "已决结论", "status": "已决", "reason": "判断依据" }],
  "pending": [{ "content": "待决结论", "status": "待决", "reason": "判断依据" }],
  "summary": "总体状态说明"
}

要求：直接返回 JSON，不要包含其他说明`;

    const conclusionsText = conclusions.map((c, i) => `${i + 1}. ${c.content}（确信度：${c.confidence}）`).join('\n');
    const userPrompt = `请区分以下结论的已决/待决状态：\n\n待办状态：${todoStatus}\n\n结论列表：\n${conclusionsText}`;

    const result = await llmClient.generateJSON<{
      resolved: Array<{ content: string; status: string; reason: string }>;
      pending: Array<{ content: string; status: string; reason: string }>;
      summary: string;
    }>(userPrompt, systemPrompt);

    // Cast status to the expected literal types
    const resolved = result.resolved.map((r: any) => ({
      ...r,
      status: r.status as '已决' | '待决',
    }));
    const pending = result.pending.map((r: any) => ({
      ...r,
      status: r.status as '已决' | '待决',
    }));

    return { success: true, data: { resolved, pending, summary: result.summary } };
  } catch (error) {
    return { success: false, message: `区分失败: ${error instanceof Error ? error.message : String(error)}` };
  }
}
