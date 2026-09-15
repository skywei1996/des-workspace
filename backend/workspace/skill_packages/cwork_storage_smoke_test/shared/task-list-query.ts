/**
 * Skill: task-list-query
 * 工作任务列表查询
 */

import { cworkClient } from './cwork-client.js';
import type { TaskListQueryInput, TaskListQueryOutput } from './types.js';

export async function taskListQuery(input: TaskListQueryInput): Promise<TaskListQueryOutput> {
  const { pageSize = 30, pageIndex = 1, ...filters } = input;
  if (pageSize <= 0) return { success: false, message: 'pageSize 必须大于 0' };

  try {
    const result = await cworkClient.searchTaskPage({ pageSize, pageIndex, ...filters });
    return { success: true, data: result };
  } catch (error) {
    return { success: false, message: `任务列表查询失败: ${error instanceof Error ? error.message : String(error)}` };
  }
}
