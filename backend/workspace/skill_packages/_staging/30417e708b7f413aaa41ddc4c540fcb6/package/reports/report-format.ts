/**
 * Skill: report-format
 * 汇报格式化
 */

import type { ReportFormatInput, ReportFormatOutput } from '../shared/types.js';

export async function reportFormat(input: ReportFormatInput): Promise<ReportFormatOutput> {
  const { title, progress, problems, plan, risks, formatTemplate = 'standard' } = input;

  if (!title || title.trim().length === 0) {
    return { success: false, message: '汇报标题不能为空' };
  }

  try {
    let formatted = '';

    switch (formatTemplate) {
      case 'simple':
        formatted = `## ${title}\n\n`;
        if (progress) formatted += `**进展**\n${progress}\n\n`;
        if (plan) formatted += `**计划**\n${plan}\n\n`;
        if (problems) formatted += `**问题**\n${problems}\n\n`;
        if (risks) formatted += `**风险**\n${risks}\n`;
        break;
      case 'detailed':
        formatted = `# ${title}\n\n---\n\n`;
        if (progress) formatted += `## 📊 工作进展\n\n${progress}\n\n`;
        if (problems) formatted += `## ⚠️ 存在问题\n\n${problems}\n\n`;
        if (risks) formatted += `## 🔴 风险提示\n\n${risks}\n\n`;
        if (plan) formatted += `## 📋 下步计划\n\n${plan}\n\n`;
        formatted += `---\n\n`;
        break;
      case 'standard':
      default:
        formatted = `【汇报】${title}\n\n`;
        if (progress) formatted += `一、工作进展\n${progress}\n\n`;
        if (problems) formatted += `二、存在问题\n${problems}\n\n`;
        if (plan) formatted += `三、下步计划\n${plan}\n\n`;
        if (risks) formatted += `四、风险提示\n${risks}\n`;
        break;
    }

    return { success: true, data: formatted };
  } catch (error) {
    return { success: false, message: `格式化失败: ${error instanceof Error ? error.message : String(error)}` };
  }
}
