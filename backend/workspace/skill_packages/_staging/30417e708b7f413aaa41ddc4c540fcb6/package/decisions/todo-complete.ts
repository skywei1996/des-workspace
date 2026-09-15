/**
 * Skill: todo-complete
 * 完成待办
 */

import { cworkClient } from '../shared/cwork-client.js';
import type { TodoCompleteInput, TodoCompleteOutput } from '../shared/types.js';

export async function todoComplete(input: TodoCompleteInput): Promise<TodoCompleteOutput> {
  const { todoId, decision, conclusion } = input;

  if (!todoId || todoId.trim().length === 0) return { success: false, message: 'todoId 不能为空' };
  if (!conclusion || conclusion.trim().length === 0) return { success: false, message: '结论内容不能为空' };

  try {
    const operateMap = { agree: 'agree', disagree: 'disagree', other: undefined };
    await cworkClient.completeTodo(todoId, conclusion, operateMap[decision]);
    return { success: true };
  } catch (error) {
    return { success: false, message: `待办完成失败: ${error instanceof Error ? error.message : String(error)}` };
  }
}
