---
name: cwork-closure
description: 闭环能力域，提供闭环状态判断、未闭环识别、催办提示、跟进总结等 Skill
---

## Skills

| Skill | 说明 | LLM 依赖 |
|-------|------|----------|
| judge-closure-status | 综合判断事项当前是否已闭环 | ✅ |
| identify-unclosed-items | 识别长期未反馈/未完成的事项 | ❌ |
| generate-unclosed-list | 生成未闭环事项汇总清单 | ❌ |
| reminder-tip | 生成催办提示语 | ✅ |
| summarize-followup-status | 总结事项的跟进状态 | ✅ |

## 触发条件

- 需要判断事项是否已闭环
- 需要识别和汇总长期未闭环的事项
- 需要生成催办提醒

## 使用方式

```typescript
import { judgeClosureStatus } from './judge-closure-status.js';
import { identifyUnclosedItems } from './identify-unclosed-items.js';
import { generateUnclosedList } from './generate-unclosed-list.js';
import { reminderTip } from './reminder-tip.js';

// 判断闭环状态（需要 LLM）
const judgment = await judgeClosureStatus({
  itemId: 'task-123',
  itemType: 'task',
  followupChain: { timeline: [...] },
  deadline: Date.now() + 7 * 24 * 60 * 60 * 1000,
}, { llmClient });

// 识别未闭环（不需要 LLM）
const unclosed = await identifyUnclosedItems({
  itemIds: ['task-1', 'task-2', 'decision-1'],
  itemType: 'task',
  daysThreshold: 7,
});

// 生成清单（不需要 LLM）
const list = await generateUnclosedList({ unclosedItems: unclosed.data });

// 催办提示（需要 LLM）
const tip = await reminderTip({
  itemId: 'task-123',
  itemType: 'task',
  recipient: '张三',
  daysUnresolved: 14,
  reminderStyle: 'polite',
}, { llmClient });
```

## 注意事项

- 标记 ✅ 的 Skill 需要传入 `llmClient` 参数
- 标记 ❌ 的 Skill 不需要 LLM，可直接调用
