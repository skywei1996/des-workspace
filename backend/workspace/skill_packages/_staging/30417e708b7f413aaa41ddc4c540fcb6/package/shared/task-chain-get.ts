/**
 * Skill: task-chain-get
 * 任务跟进汇报链路拼接
 */

import { cworkClient } from './cwork-client.js';
import type { TaskChainGetInput, TaskChainGetSkillOutput, TaskChainItem } from './types.js';

export async function taskChainGet(input: TaskChainGetInput): Promise<TaskChainGetSkillOutput> {
  const { taskId, maxReports = 20 } = input;
  if (!taskId || taskId.trim().length === 0) return { success: false, message: 'taskId 不能为空' };

  try {
    const taskDetail = await cworkClient.getSimplePlanAndReportInfo(taskId.trim());

    if (!taskDetail.reportList || taskDetail.reportList.length === 0) {
      return {
        success: true,
        data: {
          taskId: taskDetail.id,
          title: taskDetail.main,
          status: taskDetail.status,
          reports: [],
          latestUpdate: (taskDetail.lastReportTime || taskDetail.createTime) as string,
        },
      };
    }

    const reportList = taskDetail.reportList.slice(0, maxReports);
    const reportPromises = reportList.map(async (reportRef) => {
      try {
        const reportDetail = await cworkClient.getReportInfo(reportRef.id);
        return {
          reportId: reportDetail.reportId,
          content: reportDetail.content,
          createTime: reportDetail.createTime,
        };
      } catch (error) {
        console.warn(`Failed to get report ${reportRef.id}:`, error);
        return null;
      }
    });

    const reportResults = await Promise.all(reportPromises);
    const reports: TaskChainItem[] = reportResults.filter((r): r is TaskChainItem => r !== null);
    reports.sort((a, b) => new Date(a.createTime).getTime() - new Date(b.createTime).getTime());

    return {
      success: true,
      data: {
        taskId: taskDetail.id,
        title: taskDetail.main,
        status: taskDetail.status,
        reports,
        latestUpdate: reports.length > 0 ? reports[reports.length - 1].createTime : (taskDetail.lastReportTime || taskDetail.createTime) as string,
      },
    };
  } catch (error) {
    return { success: false, message: `获取任务链路失败: ${error instanceof Error ? error.message : String(error)}` };
  }
}
