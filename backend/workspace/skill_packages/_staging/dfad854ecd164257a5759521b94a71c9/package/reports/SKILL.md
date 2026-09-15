---
name: cwork-reports
description: 汇报能力域，包含汇报生成、改写、提交、格式调整等 Skill
---

## Skills

| Skill | 说明 | LLM 依赖 |
|-------|------|----------|
| draft-gen | 将零散内容整理为结构化汇报草稿 | ✅ |
| outline-gen | 生成汇报大纲结构 | ✅ |
| report-rewrite | 对现有草稿进行结构/表达优化 | ✅ |
| report-submit | 将确认后的汇报草稿正式提交 | ❌ |
| report-complete | 补齐汇报中缺失的常见字段 | ✅ |
| report-tone-adapt | 根据汇报对象调整表达口径 | ✅ |
| report-format | 按模板格式化汇报内容 | ❌ |
| report-formality-adjust | 调整汇报的正式程度 | ✅ |

## 触发条件

- 需要生成、修改、提交工作汇报
- 需要调整汇报的语气、正式度或格式

## 使用方式

```typescript
import { draftGen } from './draft-gen.js';
import { reportSubmit } from './report-submit.js';

// 生成草稿（需要 LLM client）
const draft = await draftGen({
  rawContent: '完成了用户登录功能开发，修复了3个bug',
  reportType: '日报',
  targetAudience: '直属上级',
}, { llmClient });

// 提交汇报（不需要 LLM）
const submit = await reportSubmit({
  main: '今日工作汇报',
  contentHtml: '<p>...</p>',
});
```

## 注意事项

- 标记 ✅ 的 Skill 需要传入 `llmClient` 参数
- 标记 ❌ 的 Skill 不需要 LLM，可直接调用
