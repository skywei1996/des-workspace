/**
 * Skill: todo-list-query
 * 决策/建议待办列表查询
 */

import { cworkClient } from './cwork-client.js';
import type { TodoListQueryInput, TodoListQueryOutput } from './types.js';

export async function todoListQuery(input: TodoListQueryInput): Promise<TodoListQueryOutput> {
  const { pageIndex, pageSize } = input;
  if (!pageIndex || pageIndex <= 0) return { success: false, message: 'pageIndex 必须大于 0' };
  if (!pageSize || pageSize <= 0) return { success: false, message: 'pageSize 必须大于 0' };

  try {
    const result = await cworkClient.getTodoList({ pageIndex, pageSize });
    return { success: true, data: result };
  } catch (error) {
    return { success: false, message: `待办列表查询失败: ${error instanceof Error ? error.message : String(error)}` };
  }
}
