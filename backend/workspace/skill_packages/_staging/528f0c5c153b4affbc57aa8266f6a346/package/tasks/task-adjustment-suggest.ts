/**
 * Skill: task-adjustment-suggest
 * 任务调整建议
 */

import type { TaskAdjustmentSuggestInput, TaskAdjustmentSuggestOutput, TaskAdjustment } from '../shared/types.js';

interface LLMClientLike {
  generateJSON<T>(prompt: string, systemPrompt?: string): Promise<T>;
}

export async function taskAdjustmentSuggest(input: TaskAdjustmentSuggestInput, _context?: { llmClient?: LLMClientLike }): Promise<TaskAdjustmentSuggestOutput> { const { llmClient } = _context ?? {}; 
  const { taskId, taskTitle, currentProgress, originalDeadline, remainingWork, blockers, resourceConstraints } = input;

  if (!taskTitle || !currentProgress) {
    return { success: false, message: '任务标题和当前进展不能为空' };
  }

  try {
    const now = Date.now();
    const daysUntilDeadline = Math.floor((originalDeadline - now) / (24 * 60 * 60 * 1000));
    const isOverdue = originalDeadline < now;

    let context = `任务 ID：${taskId}\n`;
    context += `任务标题：${taskTitle}\n`;
    context += `当前进展：${currentProgress}\n`;
    context += `原定截止时间：${new Date(originalDeadline).toLocaleString()}\n`;
    context += `距离截止：${isOverdue ? `已逾期 ${Math.abs(daysUntilDeadline)} 天` : `${daysUntilDeadline} 天`}\n`;
    context += `剩余工作：${remainingWork}\n`;
    if (blockers && blockers.length > 0) {
      context += `\n卡点因素：\n`;
      blockers.forEach((b, i) => context += `  ${i + 1}. ${b}\n`);
    }
    if (resourceConstraints) context += `\n资源约束：${resourceConstraints}\n`;

    const systemPrompt = `你是一个专业的项目管理助手，擅长基于任务进展情况提出调整建议。

请按照以下 JSON 格式返回：
{
  "adjustmentType": "deadline_extend/resource_increase/scope_reduce/priority_change/no_change",
  "reasoning": "调整理由",
  "suggestedDeadline": 1234567890000（仅当 deadline_extend 时）,
  "suggestedResources": ["资源建议"]（仅当 resource_increase 时）,
  "suggestedScope": "缩减后的范围描述"（仅当 scope_reduce 时）,
  "priorityChange": "raise/lower/maintain"
}

要求：直接返回 JSON，不要包含其他说明`;

    const userPrompt = `请为以下任务提供调整建议：\n\n${context}`;

    const result = await llmClient.generateJSON<TaskAdjustment>(userPrompt, systemPrompt);
    return { success: true, data: result };
  } catch (error) {
    return { success: false, message: `调整建议生成失败: ${error instanceof Error ? error.message : String(error)}` };
  }
}
