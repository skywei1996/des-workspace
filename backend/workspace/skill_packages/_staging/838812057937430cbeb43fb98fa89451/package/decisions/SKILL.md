---
name: cwork-decisions
description: 决策能力域，提供结论提炼、已决/待决区分、摘要生成、讨论整理等 Skill
---

## Skills

| Skill | 说明 | LLM 依赖 |
|-------|------|----------|
| decision-conclusion-extract | 从待办/汇报讨论中提炼结论 | ✅ |
| decision-resolved-pending | 区分已确认结论与待确认事项 | ✅ |
| decision-summary-gen | 生成可复述、可传达的决策摘要 | ✅ |
| todo-complete | 提交决策结果，标记待办为已完成 | ❌ |
| discussion-thread | 整理讨论串，提取关键观点和结论 | ✅ |
| decision-format-standardize | 将决策内容格式化为标准记录 | ❌ |

## 触发条件

- 需要从讨论或汇报中提炼决策结论
- 需要区分已决事项和待决事项
- 需要完成或归档决策待办

## 使用方式

```typescript
import { decisionConclusionExtract } from './decision-conclusion-extract.js';
import { decisionSummaryGen } from './decision-summary-gen.js';
import { todoComplete } from './todo-complete.js';

// 提炼结论（需要 LLM）
const conclusions = await decisionConclusionExtract({
  todoDetail: { title: '是否上线新功能', status: 'pending' },
  relatedReports: [{ reportId: '123', content: '测试通过...' }],
}, { llmClient });

// 生成摘要（需要 LLM）
const summary = await decisionSummaryGen({
  todoId: 'todo-123',
  resolved: [{ content: '决定上线', status: '已决', reason: '测试通过' }],
  pending: [],
}, { llmClient });

// 完成待办（不需要 LLM）
await todoComplete({ todoId: 'todo-123', decision: 'agree', conclusion: '同意上线' });
```

## 注意事项

- 标记 ✅ 的 Skill 需要传入 `llmClient` 参数
- 标记 ❌ 的 Skill 不需要 LLM，可直接调用
