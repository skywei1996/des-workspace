/**
 * Skill: task-blocker-identify
 * 任务卡点识别
 */

import { taskListQuery } from '../shared/task-list-query.js';
import type { TaskBlockerInput, TaskBlockerIdentifyOutput, TaskListItem, BlockerTask } from '../shared/types.js';

export async function taskBlockerIdentify(input: TaskBlockerInput): Promise<TaskBlockerIdentifyOutput> {
  const { taskList, pageNum = 1, pageSize = 50, status, empIdList } = input;

  let tasks: TaskListItem[] = [];

  if (!taskList || taskList.length === 0) {
    const result = await taskListQuery({ pageNum, pageSize, status, empIdList });
    if (!result.success || !result.data) return { success: false, message: '任务列表获取失败' };
    tasks = result.data.list;
  } else {
    tasks = taskList;
  }

  const blockers: BlockerTask[] = [];
  const now = Date.now();

  for (const task of tasks) {
    // 检查逾期
    if (task.endTime) {
      const endTime = new Date(task.endTime).getTime();
      if (endTime < now && task.status !== 0) {
        blockers.push({
          taskId: task.id,
          title: task.main,
          issue: '逾期',
          severity: '高',
          details: { endTime: task.endTime, reportStatus: task.reportStatus },
        });
        continue;
      }
    }

    // 检查汇报进度滞后
    if (task.reportTotalCount > 0) {
      const expectedProgress = task.reportTotalCount;
      const actualProgress = task.reportSubmitCount || 0;
      if (task.reportStatus === 3 || actualProgress < expectedProgress * 0.5) {
        blockers.push({
          taskId: task.id,
          title: task.main,
          issue: '进度滞后',
          severity: actualProgress === 0 ? '高' : '中',
          details: { reportSubmitCount: actualProgress, reportTotalCount: expectedProgress },
        });
        continue;
      }
    }

    // 检查卡点（长期未更新）
    if (task.lastReportTime) {
      const lastReportTime = new Date(task.lastReportTime).getTime();
      const daysSinceLastReport = (now - lastReportTime) / (1000 * 60 * 60 * 24);
      if (daysSinceLastReport > 7 && task.status !== 0) {
        blockers.push({
          taskId: task.id,
          title: task.main,
          issue: '卡点',
          severity: daysSinceLastReport > 14 ? '高' : '中',
        });
      }
    }
  }

  return { success: true, data: blockers };
}
