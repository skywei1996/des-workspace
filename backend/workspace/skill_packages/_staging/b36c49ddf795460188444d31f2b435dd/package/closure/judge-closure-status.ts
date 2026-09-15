/**
 * Skill: judge-closure-status
 * 闭环状态判断
 */

import type { JudgeClosureStatusInput, JudgeClosureStatusOutput, ClosureJudgment } from '../shared/types.js';

interface LLMClientLike {
  generateJSON<T>(prompt: string, systemPrompt?: string): Promise<T>;
}

export async function judgeClosureStatus(input: JudgeClosureStatusInput, _context?: { llmClient?: LLMClientLike }): Promise<JudgeClosureStatusOutput> { const { llmClient } = _context ?? {}; 
  const { itemId, itemType, followupChain, deadline } = input;

  if (!followupChain || followupChain.timeline.length === 0) {
    return { success: false, message: '跟进链路为空，无法判断闭环状态' };
  }

  try {
    const now = Date.now();
    const isOverdue = deadline && deadline < now;

    let context = `事项 ID：${itemId}\n`;
    context += `事项类型：${itemType}\n`;
    if (deadline) {
      context += `截止时间：${new Date(deadline).toLocaleString()}\n`;
      context += `是否逾期：${isOverdue ? '是' : '否'}\n`;
    }
    context += `\n跟进链路：\n`;
    for (const item of followupChain.timeline) {
      context += `  [${new Date(item.time).toLocaleString()}] ${item.nodeType}: ${item.content.slice(0, 100)}...\n`;
    }

    const systemPrompt = `你是一个专业的项目跟踪助手，擅长判断事项是否已闭环。

闭环判断标准：
1. 任务闭环：任务已完成，相关汇报显示最终成果
2. 决策闭环：决策已执行，效果已确认
3. 反馈闭环：问题已解决，处理结果已确认

请按照以下 JSON 格式返回：
{
  "isClosed": true/false,
  "closedAt": 1234567890000（闭环时间戳，如未闭环则省略）,
  "evidence": ["证据1", "证据2"],
  "reasoning": "判断理由",
  "confidence": "高/中/低"
}

要求：直接返回 JSON，不要包含其他说明`;

    const userPrompt = `请判断以下事项是否已闭环：\n\n${context}`;

    const result = await llmClient.generateJSON<ClosureJudgment>(userPrompt, systemPrompt);
    return { success: true, data: result };
  } catch (error) {
    return { success: false, message: `闭环判断失败: ${error instanceof Error ? error.message : String(error)}` };
  }
}
