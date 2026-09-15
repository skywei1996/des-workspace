/**
 * Skill: summary-trends
 * 趋势总结
 */

import type { SummaryTrendsInput, SummaryTrendsOutput, TrendSummary } from '../shared/types.js';

interface LLMClientLike {
  generateJSON<T>(prompt: string, systemPrompt?: string): Promise<T>;
}

export async function summaryTrends(input: SummaryTrendsInput, _context?: { llmClient?: LLMClientLike }): Promise<SummaryTrendsOutput> { const { llmClient } = _context ?? {}; 
  const { reports, focusAreas } = input;

  if (!reports || reports.length < 2) {
    return { success: false, message: '至少需要两期汇报才能分析趋势' };
  }

  try {
    const sortedReports = [...reports].sort((a, b) => a.submitTime - b.submitTime);

    let context = `共有 ${sortedReports.length} 期汇报\n\n`;
    sortedReports.forEach((report, index) => {
      context += `### 第 ${index + 1} 期（${new Date(report.submitTime).toLocaleDateString()}）\n`;
      if (report.employeeName) context += `汇报人：${report.employeeName}\n`;
      context += `${report.content.slice(0, 300)}...\n\n`;
    });
    if (focusAreas && focusAreas.length > 0) {
      context += `\n重点关注领域：${focusAreas.join('、')}\n`;
    }

    const systemPrompt = `你是一个专业的项目分析助手，擅长从多期汇报中识别趋势变化。

请按照以下 JSON 格式返回：
{
  "overallTrend": "improving/stable/declining/fluctuating",
  "keyMetrics": [{ "metric": "指标名称", "trend": "up/down/stable", "description": "趋势描述" }],
  "patternInsights": ["模式洞察1", "模式洞察2"],
  "recommendations": ["建议1", "建议2"]
}

要求：直接返回 JSON，不要包含其他说明`;

    const userPrompt = `请分析以下多期汇报的趋势变化：\n\n${context}`;

    const result = await llmClient.generateJSON<TrendSummary>(userPrompt, systemPrompt);
    return { success: true, data: result };
  } catch (error) {
    return { success: false, message: `趋势分析失败: ${error instanceof Error ? error.message : String(error)}` };
  }
}
