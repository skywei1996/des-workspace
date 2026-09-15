/**
 * Skill: todo-extract
 * 待办抽取 - 从内容中抽取待办事项
 */

import type { TodoExtractInput, TodoExtractOutput, TodoItem } from '../shared/types.js';

interface LLMClientLike {
  generateJSON<T>(prompt: string, systemPrompt?: string): Promise<T>;
}

export async function todoExtract(input: TodoExtractInput, _context?: { llmClient?: LLMClientLike }): Promise<TodoExtractOutput> { const { llmClient } = _context ?? {}; 
  const { source, sourceType } = input;

  if (!source || source.trim().length < 10) {
    return { success: false, message: '内容过短，请至少提供10个字的描述' };
  }

  try {
    const systemPrompt = `你是一个专业的任务分析助手，擅长从文本中识别和提取待办事项。

请按照以下 JSON 格式返回：
{
  "todos": [
    {
      "description": "待办描述",
      "suggestedAssignee": "建议责任人（可选）",
      "suggestedDeadline": "建议截止时间（可选）"
    }
  ]
}

要求：
1. 识别明确的行动项（动词开头的内容）
2. 描述要具体、可执行
3. 直接返回 JSON，不要包含其他说明`;

    const userPrompt = `请从以下${sourceType === 'report' ? '汇报' : '讨论'}内容中提取待办事项：

${source}`;

    const result = await llmClient.generateJSON<{ todos: TodoItem[] }>(userPrompt, systemPrompt);

    if (!result.todos || result.todos.length === 0) {
      return { success: false, message: '未识别到明确的待办事项' };
    }

    return { success: true, data: { items: result.todos } };
  } catch (error) {
    return { success: false, message: `待办抽取失败: ${error instanceof Error ? error.message : String(error)}` };
  }
}
