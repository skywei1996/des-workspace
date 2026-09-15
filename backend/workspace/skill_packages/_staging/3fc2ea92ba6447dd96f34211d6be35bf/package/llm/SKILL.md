---
name: cwork-llm
description: LLM 能力域，提供需要大语言模型能力的高级 Skill（如多源汇总）
---

## Skills

| Skill | 说明 | LLM 依赖 |
|-------|------|----------|
| multi-source-agg | 聚合任务、汇报、决策等多源信息生成工作总结 | ✅ |

## 触发条件

- 需要将多个数据源的信息汇总生成综合工作总结
- 需要 LLM 的理解、推理和生成能力

## 使用方式

```typescript
import { multiSourceAgg } from './multi-source-agg.js';
import { taskListQuery } from '../shared/task-list-query.js';
import { todoListQuery } from '../shared/todo-list-query.js';
import { inboxQuery } from '../shared/inbox-query.js';

const summary = await multiSourceAgg(
  {
    timeRange: {
      start: Date.now() - 7 * 24 * 60 * 60 * 1000,
      end: Date.now(),
    },
    focusAreas: ['功能开发', '质量提升'],
  },
  {
    llmClient,                        // 必填：LLM 客户端
    taskListQuery,                    // 必填：任务列表查询 Skill
    todoListQuery,                    // 必填：待办列表查询 Skill
    inboxQuery,                       // 必填：收件箱查询 Skill
  }
);
```

## 注意事项

- 所有参数都是必需的，缺一不可
- `taskListQuery`、`todoListQuery`、`inboxQuery` 从 `../shared/` 导入
- `llmClient` 由调用方注入，不在该 Skill 包内创建
