/**
 * Skill: format-analysis-output
 * 分析结果格式化
 */

import type { FormatAnalysisOutputInput, FormatAnalysisOutputOutput } from '../shared/types.js';

export async function formatAnalysisOutput(input: FormatAnalysisOutputInput): Promise<FormatAnalysisOutputOutput> {
  const { analysisType, highlights, problems, risks, compareResult, reportTitle = '汇报分析', analysisTime = Date.now() } = input;

  try {
    let formatted = '';
    const header = `# ${reportTitle}\n\n生成时间：${new Date(analysisTime).toLocaleString()}\n\n---\n\n`;

    switch (analysisType) {
      case 'highlight':
        if (!highlights) return { success: false, message: '缺少高亮分析数据' };
        formatted = header;
        formatted += `## 📌 关键要点\n\n`;
        highlights.highlights.forEach((h, i) => {
          formatted += `${i + 1}. **${h.category}**：${h.content}\n`;
          if (h.important) formatted += `   ⭐ 重要\n`;
        });
        formatted += `\n## 📝 摘要\n\n${highlights.summary}\n`;
        break;

      case 'problem':
        if (!problems) return { success: false, message: '缺少问题分析数据' };
        formatted = header;
        formatted += `## ⚠️ 问题分析\n\n`;
        problems.problems.forEach((p, i) => {
          const severityLabel = { high: '🔴 严重', medium: '🟡 中等', low: '🟢 轻微' }[p.severity];
          formatted += `${i + 1}. ${severityLabel}\n`;
          formatted += `   - 问题描述：${p.description}\n`;
          if (p.suggestions?.length) formatted += `   - 建议：${p.suggestions.join('、')}\n`;
        });
        formatted += `\n## 📊 问题统计\n\n`;
        formatted += `- 总计：${problems.problems.length} 个问题\n`;
        formatted += `- 严重：${problems.problems.filter(p => p.severity === 'high').length} 个\n`;
        formatted += `- 中等：${problems.problems.filter(p => p.severity === 'medium').length} 个\n`;
        formatted += `- 轻微：${problems.problems.filter(p => p.severity === 'low').length} 个\n`;
        break;

      case 'risk':
        if (!risks) return { success: false, message: '缺少风险分析数据' };
        formatted = header;
        formatted += `## 🔴 风险分析\n\n`;
        risks.risks.forEach((r, i) => {
          const levelLabel = { high: '🔴 高风险', medium: '🟡 中风险', low: '🟢 低风险' }[r.level];
          formatted += `${i + 1}. ${levelLabel}（概率：${r.probability}，影响：${r.impact}）\n`;
          formatted += `   - 风险描述：${r.description}\n`;
          if (r.mitigation) formatted += `   - 缓解措施：${r.mitigation}\n`;
        });
        formatted += `\n## 📊 风险统计\n\n`;
        formatted += `- 总计：${risks.risks.length} 个风险\n`;
        formatted += `- 高风险：${risks.risks.filter(r => r.level === 'high').length} 个\n`;
        formatted += `- 中风险：${risks.risks.filter(r => r.level === 'medium').length} 个\n`;
        formatted += `- 低风险：${risks.risks.filter(r => r.level === 'low').length} 个\n`;
        break;

      case 'compare':
        if (!compareResult) return { success: false, message: '缺少对比分析数据' };
        formatted = header;
        formatted += `## 📊 对比分析\n\n${compareResult}\n`;
        break;

      default:
        return { success: false, message: '未知的分析类型' };
    }

    return { success: true, data: formatted };
  } catch (error) {
    return { success: false, message: `格式化失败: ${error instanceof Error ? error.message : String(error)}` };
  }
}
