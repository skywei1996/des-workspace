/**
 * Skill: task-create
 * 创建工作任务
 */

import { cworkClient } from '../shared/cwork-client.js';
import type { TaskCreateInput, TaskCreateOutput } from '../shared/types.js';

export async function taskCreate(input: TaskCreateInput): Promise<TaskCreateOutput> {
  const { title, content, target, assignee, deadline, reportEmpIdList = [], pushNow = true } = input;

  if (!title || title.trim().length === 0) return { success: false, message: '任务标题不能为空' };
  if (!content || content.trim().length === 0) return { success: false, message: '任务描述不能为空' };
  if (!deadline) return { success: false, message: '任务截止时间不能为空' };

  try {
    const params = {
      main: title,
      needful: content,
      target: target || content,
      typeId: 9999,
      reportEmpIdList: reportEmpIdList.length > 0 ? reportEmpIdList : assignee ? [assignee] : [],
      endTime: deadline,
      ownerEmpIdList: assignee ? [assignee] : undefined,
      pushNow: pushNow ? 1 : 0,
    };

    const taskId = await cworkClient.createPlan(params);
    return { success: true, data: { taskId } };
  } catch (error) {
    return { success: false, message: `任务创建失败: ${error instanceof Error ? error.message : String(error)}` };
  }
}
