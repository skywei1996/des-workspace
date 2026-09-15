/**
 * Skill: decision-conclusion-extract
 * 讨论结论提炼
 */

import type { DecisionConclusionExtractInput, DecisionConclusionExtractOutput, ConclusionItem } from '../shared/types.js';

interface LLMClientLike {
  generateJSON<T>(prompt: string, systemPrompt?: string): Promise<T>;
}

export async function decisionConclusionExtract(input: DecisionConclusionExtractInput, _context?: { llmClient?: LLMClientLike }): Promise<DecisionConclusionExtractOutput> { const { llmClient } = _context ?? {}; 
  const { todoDetail, relatedReports } = input;

  try {
    let context = `待办事项：${todoDetail.title}\n`;
    if (todoDetail.aiSummary) context += `AI摘要：${todoDetail.aiSummary}\n`;
    context += `状态：${todoDetail.status}\n\n`;

    if (relatedReports.length > 0) {
      context += `相关汇报讨论：\n`;
      for (const report of relatedReports) {
        context += `\n汇报内容：${report.content}\n`;
        if (report.replies && report.replies.length > 0) {
          context += `回复：\n`;
          for (const reply of report.replies) {
            context += `  - ${reply.replyEmpName}：${reply.content}\n`;
          }
        }
      }
    }

    const systemPrompt = `你是一个专业的会议记录助手，擅长从讨论中提炼明确的结论。

请按照以下 JSON 格式返回：
{
  "conclusions": [
    {
      "content": "具体结论内容",
      "source": "todo或report",
      "confidence": "高/中/低"
    }
  ]
}

要求：
1. 只提炼已经明确的结论性陈述
2. 结论应该是可执行的决定或共识
3. 直接返回 JSON，不要包含其他说明`;

    const userPrompt = `请从以下待办及相关讨论中提炼结论：\n\n${context}`;

    const result = await llmClient.generateJSON<{ conclusions: ConclusionItem[] }>(userPrompt, systemPrompt);

    if (!result.conclusions || result.conclusions.length === 0) {
      return { success: false, message: '未识别到明确的讨论结论' };
    }

    return { success: true, data: result };
  } catch (error) {
    return { success: false, message: `结论提炼失败: ${error instanceof Error ? error.message : String(error)}` };
  }
}
