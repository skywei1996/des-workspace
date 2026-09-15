/**
 * Skill: discussion-thread
 * 讨论串整理
 */

import type { DiscussionThreadInput, DiscussionThreadOutput, DiscussionSummary } from '../shared/types.js';

interface LLMClientLike {
  generateJSON<T>(prompt: string, systemPrompt?: string): Promise<T>;
}

export async function discussionThread(input: DiscussionThreadInput, _context?: { llmClient?: LLMClientLike }): Promise<DiscussionThreadOutput> { const { llmClient } = _context ?? {}; 
  const { threadId, messages, focusQuestion } = input;

  if (!messages || messages.length === 0) return { success: false, message: '讨论消息不能为空' };

  try {
    let context = `讨论串 ID：${threadId}\n\n消息数量：${messages.length}\n\n`;
    if (focusQuestion) context += `关注问题：${focusQuestion}\n\n`;
    context += `讨论内容：\n\n`;
    messages.forEach((msg) => {
      context += `[${new Date(msg.timestamp).toLocaleString()}] ${msg.author}:\n${msg.content}\n\n`;
    });

    const systemPrompt = `你是一个专业的会议记录助手，擅长整理讨论串并提取关键信息。

请按照以下 JSON 格式返回：
{
  "topic": "讨论主题（一句话概括）",
  "participants": ["参与者1", "参与者2"],
  "timeline": [{ "time": 1234567890000, "author": "发言者", "keyPoint": "关键观点摘要" }],
  "keyViewpoints": [{ "viewpoint": "观点描述", "supporters": ["支持者1"], "argument": "论据" }],
  "conclusions": ["结论1", "结论2"],
  "openQuestions": ["未决问题1", "未决问题2"]
}

要求：直接返回 JSON，不要包含其他说明`;

    const userPrompt = `请整理以下讨论串：\n\n${context}`;

    const result = await llmClient.generateJSON<DiscussionSummary>(userPrompt, systemPrompt);
    return { success: true, data: result };
  } catch (error) {
    return { success: false, message: `讨论串整理失败: ${error instanceof Error ? error.message : String(error)}` };
  }
}
