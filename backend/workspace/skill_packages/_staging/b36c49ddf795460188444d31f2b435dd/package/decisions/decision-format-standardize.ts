/**
 * Skill: decision-format-standardize
 * 决策格式标准化
 */

import type { DecisionFormatStandardizeInput, DecisionFormatStandardizeOutput } from '../shared/types.js';

export async function decisionFormatStandardize(input: DecisionFormatStandardizeInput): Promise<DecisionFormatStandardizeOutput> {
  const {
    decisionId,
    title,
    decision,
    resolvedPoints = [],
    pendingPoints = [],
    actionItems = [],
    participants = [],
    decisionTime = Date.now(),
  } = input;

  if (!title || !decision) return { success: false, message: '决策标题和决策内容不能为空' };

  try {
    let formatted = `# 决策记录\n\n`;
    formatted += `**决策编号**：${decisionId}\n\n`;
    formatted += `**决策时间**：${new Date(decisionTime).toLocaleString()}\n\n`;
    if (participants.length > 0) formatted += `**参与人员**：${participants.join('、')}\n\n`;
    formatted += `---\n\n`;
    formatted += `## 决策事项\n\n${title}\n\n`;
    formatted += `## 决策内容\n\n${decision}\n\n`;

    if (resolvedPoints.length > 0) {
      formatted += `## ✅ 已决事项\n\n`;
      resolvedPoints.forEach((point, i) => { formatted += `${i + 1}. ${point}\n`; });
      formatted += `\n`;
    }
    if (pendingPoints.length > 0) {
      formatted += `## ⏳ 待决事项\n\n`;
      pendingPoints.forEach((point, i) => { formatted += `${i + 1}. ${point}\n`; });
      formatted += `\n`;
    }
    if (actionItems.length > 0) {
      formatted += `## 📋 行动项\n\n`;
      actionItems.forEach((item, i) => { formatted += `${i + 1}. ${item}\n`; });
      formatted += `\n`;
    }
    formatted += `---\n\n*此决策记录由系统自动生成*`;

    return { success: true, data: formatted };
  } catch (error) {
    return { success: false, message: `格式化失败: ${error instanceof Error ? error.message : String(error)}` };
  }
}
