---
name: cwork-tasks
description: 任务能力域，提供任务创建、卡点识别、结构化整理、调整建议等 Skill
---

## Skills

| Skill | 说明 | LLM 依赖 |
|-------|------|----------|
| task-create | 创建工作任务 | ❌ |
| task-list-query | 分页查询工作任务列表（已在 shared） | ❌ |
| task-chain-get | 拼接任务→汇报的完整链路（已在 shared） | ❌ |
| task-blocker-identify | 识别逾期/卡点/进度滞后的任务 | ❌ |
| todo-extract | 从内容中抽取待办事项 | ✅ |
| task-structure | 将待办整理为结构化任务草稿 | ❌ |
| task-blocker-tip | 为卡点任务提供解决建议 | ✅ |
| task-adjustment-suggest | 基于进展情况提出任务调整建议 | ✅ |

## 触发条件

- 需要创建、跟踪、管理工作任务
- 需要识别和解决任务卡点
- 需要从汇报或讨论中提取待办并结构化

## 使用方式

```typescript
import { taskCreate } from './task-create.js';
import { todoExtract } from './todo-extract.js';
import { taskBlockerIdentify } from './task-blocker-identify.js';

// 创建任务（不需要 LLM）
const created = await taskCreate({
  title: '完成登录功能',
  content: '实现用户登录模块',
  target: '登录功能上线',
  deadline: Date.now() + 7 * 24 * 60 * 60 * 1000,
});

// 抽取待办（需要 LLM）
const extracted = await todoExtract({
  source: '需要完成登录功能，修复支付bug',
  sourceType: 'report',
}, { llmClient });

// 识别卡点（不需要 LLM）
const blockers = await taskBlockerIdentify({
  pageSize: 50,
  status: 1,
});
```

## 注意事项

- 标记 ✅ 的 Skill 需要传入 `llmClient` 参数
- 标记 ❌ 的 Skill 不需要 LLM，可直接调用
