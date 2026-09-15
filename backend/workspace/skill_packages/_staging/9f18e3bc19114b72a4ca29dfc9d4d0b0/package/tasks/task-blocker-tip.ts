/**
 * Skill: task-blocker-tip
 * 任务卡点提示
 */

import type { TaskBlockerTipInput, TaskBlockerTipOutput, BlockerTip } from '../shared/types.js';

interface LLMClientLike {
  generateJSON<T>(prompt: string, systemPrompt?: string): Promise<T>;
}

export async function taskBlockerTip(input: TaskBlockerTipInput, _context?: { llmClient?: LLMClientLike }): Promise<TaskBlockerTipOutput> { const { llmClient } = _context ?? {}; 
  const { taskId, taskTitle, blockerReason, daysOverdue, assignee, relatedContext } = input;

  if (!taskTitle || !blockerReason) {
    return { success: false, message: '任务标题和卡点原因不能为空' };
  }

  try {
    let context = `任务 ID：${taskId}\n`;
    context += `任务标题：${taskTitle}\n`;
    context += `卡点原因：${blockerReason}\n`;
    context += `逾期天数：${daysOverdue} 天\n`;
    if (assignee) context += `负责人：${assignee}\n`;
    if (relatedContext) context += `\n相关上下文：\n${relatedContext}\n`;

    const systemPrompt = `你是一个专业的项目管理助手，擅长为卡点任务提供解决建议。

请按照以下 JSON 格式返回：
{
  "tip": "针对性提示（1-2句话）",
  "suggestedActions": ["建议行动1", "建议行动2"],
  "escalationRecommend": "立即升级/继续观察/安排会议/重新分配",
  "priority": "紧急/高/中/低"
}

要求：直接返回 JSON，不要包含其他说明`;

    const userPrompt = `请为以下卡点任务提供解决建议：\n\n${context}`;

    const result = await llmClient.generateJSON<BlockerTip>(userPrompt, systemPrompt);
    return { success: true, data: result };
  } catch (error) {
    return { success: false, message: `卡点提示生成失败: ${error instanceof Error ? error.message : String(error)}` };
  }
}
