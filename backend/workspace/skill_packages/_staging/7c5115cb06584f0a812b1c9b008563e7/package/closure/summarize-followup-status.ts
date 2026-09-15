/**
 * Skill: summarize-followup-status
 * 跟进状态总结
 */

import type { SummarizeFollowupStatusInput, SummarizeFollowupStatusOutput, FollowupStatusSummary } from '../shared/types.js';

interface LLMClientLike {
  generateJSON<T>(prompt: string, systemPrompt?: string): Promise<T>;
}

export async function summarizeFollowupStatus(input: SummarizeFollowupStatusInput, _context?: { llmClient?: LLMClientLike }): Promise<SummarizeFollowupStatusOutput> { const { llmClient } = _context ?? {}; 
  const { itemId, itemType, followupChain, deadline } = input;

  if (!followupChain || followupChain.length === 0) {
    return { success: false, message: '跟进链路为空，无法总结状态' };
  }

  try {
    const now = Date.now();

    let context = `事项 ID：${itemId}\n`;
    context += `事项类型：${itemType}\n`;
    context += `跟进节点数：${followupChain.length}\n`;
    if (deadline) {
      const daysUntilDeadline = Math.floor((deadline - now) / (24 * 60 * 60 * 1000));
      context += `截止时间：${new Date(deadline).toLocaleString()}\n`;
      context += `距离截止：${daysUntilDeadline > 0 ? `${daysUntilDeadline} 天` : `已逾期 ${Math.abs(daysUntilDeadline)} 天`}\n`;
    }
    context += `\n跟进链路：\n\n`;
    followupChain.forEach((node, index) => {
      const author = node.author || '系统';
      context += `${index + 1}. [${new Date(node.time).toLocaleString()}] ${author} - ${node.nodeType}\n`;
      context += `   ${node.content.slice(0, 100)}...\n\n`;
    });

    const systemPrompt = `你是一个专业的项目跟踪助手，擅长总结事项的跟进状态。

请按照以下 JSON 格式返回：
{
  "status": "closed/in_progress/stalled/blocked",
  "progress": "当前进展描述",
  "latestUpdate": "最新更新摘要",
  "timeSinceLastUpdate": 123456789,
  "milestones": [{ "time": 1234567890000, "event": "事件名称", "description": "事件描述" }],
  "blockers": ["卡点1", "卡点2"],
  "nextSteps": ["下一步1", "下一步2"],
  "estimatedCompletion": 1234567890000（可选）
}

要求：直接返回 JSON，不要包含其他说明`;

    const userPrompt = `请总结以下事项的跟进状态：\n\n${context}`;

    const result = await llmClient.generateJSON<FollowupStatusSummary>(userPrompt, systemPrompt);
    return { success: true, data: result };
  } catch (error) {
    return { success: false, message: `跟进状态总结失败: ${error instanceof Error ? error.message : String(error)}` };
  }
}
