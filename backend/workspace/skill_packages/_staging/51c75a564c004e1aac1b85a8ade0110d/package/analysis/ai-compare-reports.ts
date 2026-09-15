/**
 * Skill: ai-compare-reports
 * 多汇报归纳对比
 */

import { sseClientSkill } from '../shared/sse-client.js';
import type { AiCompareReportsInput, AiCompareReportsOutput, ComparisonItem } from '../shared/types.js';

export async function aiCompareReports(input: AiCompareReportsInput): Promise<AiCompareReportsOutput> {
  const { reportIdList, timeRange } = input;

  if (reportIdList.length < 2) {
    return { success: false, message: '对比分析至少需要 2 条汇报' };
  }

  const timeRangeDesc = timeRange
    ? `时间范围：${new Date(timeRange.begin).toLocaleDateString()} 至 ${new Date(timeRange.end).toLocaleDateString()}`
    : '';

  const question = `请对以下 ${reportIdList.length} 条汇报进行横向对比分析。

${timeRangeDesc}

请从以下维度进行对比：
1. 主要进展：各汇报的核心进展
2. 趋势变化：相比前期的变化趋势（改善/稳定/恶化/波动）
3. 关键发现：值得关注的共性和差异

请按结构化的方式输出，包含总体摘要和分项对比。`;

  const result = await sseClientSkill({ reportIdList, question });

  if (!result.success || !result.data) {
    return { success: false, message: result?.message || '多汇报对比失败' };
  }

  const content = result.data.content;
  const lines = content.split('\n');
  let summary = '';
  let summaryEndIndex = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.length > 0 && !line.startsWith('-') && !line.startsWith('#')) {
      summary += line + '\n';
      summaryEndIndex = i;
      if (summary.length > 100) break;
    }
  }

  const comparison: ComparisonItem[] = [];
  const trendPatterns = [
    { regex: /改善|提升|进步/, trend: '改善' as const },
    { regex: /稳定|持平|维持/, trend: '稳定' as const },
    { regex: /恶化|下降|退步/, trend: '恶化' as const },
    { regex: /波动|反复|不确定/, trend: '波动' as const },
  ];

  for (let i = summaryEndIndex + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('-') || line.startsWith('•')) {
      const topic = line.replace(/^[-•·]\s*/, '');
      let trend: '改善' | '稳定' | '恶化' | '波动' = '稳定';
      for (const pattern of trendPatterns) {
        if (pattern.regex.test(topic)) { trend = pattern.trend; break; }
      }
      comparison.push({ topic, trend, description: topic });
    }
  }

  return {
    success: true,
    data: { summary: summary.trim() || content.slice(0, 200), comparison },
  };
}
