/**
 * Skill: reminder-tip
 * 催办提示
 */

import type { ReminderTipInput, ReminderTipOutput, ReminderTip } from '../shared/types.js';

interface LLMClientLike {
  generateJSON<T>(prompt: string, systemPrompt?: string): Promise<T>;
}

export async function reminderTip(input: ReminderTipInput, _context?: { llmClient?: LLMClientLike }): Promise<ReminderTipOutput> { const { llmClient } = _context ?? {}; 
  const { itemId, itemType, recipient, daysUnresolved, originalRequest, reminderStyle = 'polite', context = '' } = input;

  if (!recipient) return { success: false, message: '接收人不能为空' };

  try {
    const typeLabel = itemType === 'task' ? '任务' : itemType === 'decision' ? '决策' : '反馈';

    let promptContext = `事项 ID：${itemId}\n`;
    promptContext += `事项类型：${typeLabel}\n`;
    promptContext += `接收人：${recipient}\n`;
    promptContext += `未解决天数：${daysUnresolved} 天\n`;
    if (originalRequest) promptContext += `原始要求：${originalRequest}\n`;
    if (context) promptContext += `附加上下文：${context}\n`;

    const styleMap = {
      polite: '礼貌委婉，语气温和，适合初次提醒',
      urgent: '紧急直接，强调重要性，适合严重超期',
      formal: '正式规范，使用书面语，适合正式场合',
    };

    const systemPrompt = `你是一个专业的催办助手，擅长生成得体的催办提示。

请按照以下 JSON 格式返回：
{
  "subject": "提醒主题（简短明确）",
  "message": "提醒消息（完整的催办文案）",
  "suggestedActions": ["建议行动1", "建议行动2"],
  "tone": "friendly/neutral/urgent"
}

催办风格：${styleMap[reminderStyle]}

要求：直接返回 JSON，不要包含其他说明`;

    const userPrompt = `请生成以下事项的催办提示：\n\n${promptContext}`;

    const result = await llmClient.generateJSON<ReminderTip>(userPrompt, systemPrompt);
    return { success: true, data: result };
  } catch (error) {
    return { success: false, message: `催办提示生成失败: ${error instanceof Error ? error.message : String(error)}` };
  }
}
