---
name: cwork-shared
description: CWork 数据获取层，提供汇报、任务、待办等基础数据查询能力（无需 LLM）
---

## 快速开始

```typescript
import { setup } from './setup.js';

// 初始化（只需一次）
setup({
  appKey: '你的appKey',           // 必填
  baseUrl: 'https://...',          // 可选，默认生产环境地址
});

// 之后所有 Skill 即可使用
import { empSearch } from './emp-search.js';
const result = await empSearch({ name: '张三' });
```

## Skills

| Skill | 说明 |
|-------|------|
| emp-search | 按姓名搜索员工，获取 empId |
| inbox-query | 分页查询收件箱汇报列表 |
| outbox-query | 分页查询发件箱汇报列表 |
| report-get-by-id | 根据 reportId 获取汇报详情 |
| task-list-query | 分页查询工作任务列表 |
| todo-list-query | 分页查询决策/建议待办列表 |
| task-chain-get | 拼接任务→汇报的完整跟进链路 |
| sse-client | SSE 流式 AI 问答封装 |

## 触发条件

- 需要查询 CWork 业务数据（汇报、任务、待办）
- 不需要 LLM 能力的基础数据获取场景

## 使用方式

```typescript
import { empSearch } from './emp-search.js';
import { inboxQuery } from './inbox-query.js';
import { reportGetById } from './report-get-by-id.js';

// 搜索员工
const empResult = await empSearch({ name: '张三' });

// 查询收件箱
const inboxResult = await inboxQuery({ pageSize: 20, pageIndex: 1 });

// 获取汇报详情
const reportResult = await reportGetById({ reportId: '123456' });
```

## 注意事项

- 这些 Skill 不依赖 LLM client，可直接使用
- 所有 API 调用凭证从环境变量读取（`CWORK_APP_KEY`、`CWORK_BASE_URL`）
