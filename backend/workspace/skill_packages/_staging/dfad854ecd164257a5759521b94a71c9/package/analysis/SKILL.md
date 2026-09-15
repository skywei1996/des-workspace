---
name: cwork-analysis
description: 分析能力域，提供重点提炼、问题识别、风险识别、趋势总结等 Skill
---

## Skills

| Skill | 说明 | LLM 依赖 |
|-------|------|----------|
| ai-highlight-extract | 从汇报中提炼关键要点 | ❌ (SSE) |
| ai-problem-identify | 识别汇报中的问题描述和异常信号 | ❌ (SSE) |
| ai-risk-identify | 识别潜在风险和风险信号 | ❌ (SSE) |
| ai-compare-reports | 对多条汇报进行归纳对比 | ❌ (SSE) |
| summary-trends | 总结多期汇报的趋势变化 | ✅ |
| format-analysis-output | 将分析结果格式化为可读文档 | ❌ |

## 触发条件

- 需要从汇报中提取重点、识别问题或风险
- 需要对比多期汇报的变化趋势
- 需要将分析结果格式化输出

## 使用方式

```typescript
import { aiHighlightExtract } from './ai-highlight-extract.js';
import { aiProblemIdentify } from './ai-problem-identify.js';
import { aiCompareReports } from './ai-compare-reports.js';
import { summaryTrends } from './summary-trends.js';
import { formatAnalysisOutput } from './format-analysis-output.js';

// 重点提炼（使用 SSE，不需要显式传 llmClient）
const highlights = await aiHighlightExtract({ reportIdList: ['r1', 'r2'] });

// 问题识别（使用 SSE）
const problems = await aiProblemIdentify({ reportIdList: ['r1', 'r2'] });

// 多汇报对比（使用 SSE）
const comparison = await aiCompareReports({
  reportIdList: ['r1', 'r2', 'r3'],
  timeRange: { begin: Date.now() - 7 * 86400000, end: Date.now() },
});

// 趋势总结（需要 LLM）
const trends = await summaryTrends({
  reports: [{ reportId: 'r1', submitTime: Date.now(), content: '...' }],
  focusAreas: ['功能开发', '质量提升'],
}, { llmClient });

// 格式化输出（不需要 LLM）
const formatted = await formatAnalysisOutput({
  analysisType: 'problem',
  problems: problems.data,
  reportTitle: '本周问题分析',
});
```

## 注意事项

- SSE 类 Skill（ai-highlight-extract、ai-problem-identify、ai-risk-identify、ai-compare-reports）使用 SSE 与 CWork AI 平台交互，不需要传入 `llmClient`
- format-analysis-output 是纯格式化逻辑，不需要 LLM
- summary-trends 需要传入 `llmClient` 参数
