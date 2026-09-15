/**
 * Skill: report-get-by-id
 * 获取汇报内容
 */

import { cworkClient } from './cwork-client.js';
import type { ReportGetByIdInput, ReportGetByIdOutput } from './types.js';

export async function reportGetById(input: ReportGetByIdInput): Promise<ReportGetByIdOutput> {
  const { reportId } = input;
  if (!reportId || reportId.trim().length === 0) return { success: false, message: 'reportId 不能为空' };

  try {
    const reportDetail = await cworkClient.getReportInfo(reportId.trim());
    return { success: true, data: reportDetail };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    if (errorMsg.includes('401') || errorMsg.includes('权限')) {
      return { success: false, message: '该汇报不存在或无访问权限' };
    }
    return { success: false, message: `获取汇报内容失败: ${errorMsg}` };
  }
}
