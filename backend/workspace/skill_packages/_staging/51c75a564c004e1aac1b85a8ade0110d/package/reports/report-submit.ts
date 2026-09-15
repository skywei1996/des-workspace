/**
 * Skill: report-submit
 * 发送汇报
 */

import { cworkClient } from '../shared/cwork-client.js';
import type { ReportSubmitInput, ReportSubmitOutput } from '../shared/types.js';

export async function reportSubmit(input: ReportSubmitInput): Promise<ReportSubmitOutput> {
  const {
    main,
    contentHtml,
    contentType = 'html',
    typeId = 9999,
    grade = '一般',
    acceptEmpIdList,
    copyEmpIdList,
    reportLevelList,
  } = input;

  if (!main || main.trim().length === 0) return { success: false, message: '汇报标题不能为空' };
  if (!contentHtml || contentHtml.trim().length === 0) return { success: false, message: '汇报内容不能为空' };

  try {
    const result = await cworkClient.submitReport({
      main, contentHtml, contentType, typeId, grade,
      privacyLevel: '非涉密',
      acceptEmpIdList, copyEmpIdList,
      reportLevelList: reportLevelList && reportLevelList.length > 0 ? reportLevelList : undefined,
    });
    return { success: true, data: { reportId: result.id } };
  } catch (error) {
    return { success: false, message: `汇报提交失败: ${error instanceof Error ? error.message : String(error)}` };
  }
}
