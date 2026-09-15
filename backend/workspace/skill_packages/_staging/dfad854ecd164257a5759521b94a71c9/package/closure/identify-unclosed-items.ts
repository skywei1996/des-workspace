/**
 * Skill: identify-unclosed-items
 * 未闭环事项识别
 */

import { todoListQuery } from '../shared/todo-list-query.js';
import { taskChainGet } from '../shared/task-chain-get.js';
import type { IdentifyUnclosedItemsInput, IdentifyUnclosedItemsOutput, UnclosedItem, TodoListItem } from '../shared/types.js';

async function getLastUpdate(itemType: string, itemId: string): Promise<{ lastUpdate?: string }> {
  try {
    if (itemType === 'task') {
      const chain = await taskChainGet({ taskId: itemId });
      if (chain.success && chain.data) return { lastUpdate: chain.data.latestUpdate };
    } else if (itemType === 'decision' || itemType === 'feedback') {
      const todos = await todoListQuery({ pageIndex: 1, pageSize: 100 });
      if (todos.success && todos.data) {
        const todo = todos.data.list.find((t: TodoListItem) => t.todoId === itemId);
        if (todo) return { lastUpdate: todo.detail?.progress ? new Date().toISOString() : undefined };
      }
    }
  } catch { /* ignore */ }
  return {};
}

export async function identifyUnclosedItems(input: IdentifyUnclosedItemsInput): Promise<IdentifyUnclosedItemsOutput> {
  const { itemIds, itemType, daysThreshold = 7 } = input;

  if (!itemIds || itemIds.length === 0) return { success: false, message: 'itemIds 不能为空' };

  try {
    const unclosedItems: UnclosedItem[] = [];
    const now = Date.now();

    for (const itemId of itemIds) {
      const { lastUpdate } = await getLastUpdate(itemType, itemId);

      if (!lastUpdate) {
        unclosedItems.push({
          itemId, itemType, daysUnresolved: daysThreshold,
          suggestedAction: '无法获取最后更新时间，请人工确认事项状态',
        });
        continue;
      }

      const lastUpdateTime = new Date(lastUpdate).getTime();
      const daysUnresolved = Math.floor((now - lastUpdateTime) / (24 * 60 * 60 * 1000));

      if (daysUnresolved >= daysThreshold) {
        let suggestedAction = `事项超过 ${daysThreshold} 天未更新`;
        if (daysUnresolved >= 30) suggestedAction = '严重超期，建议立即跟进或关闭';
        else if (daysUnresolved >= 14) suggestedAction = '长期未更新，建议催办确认';
        else suggestedAction = '建议跟进确认最新状态';

        unclosedItems.push({ itemId, itemType, daysUnresolved, lastFeedback: lastUpdate, suggestedAction });
      }
    }

    return { success: true, data: unclosedItems };
  } catch (error) {
    return { success: false, message: `未闭环识别失败: ${error instanceof Error ? error.message : String(error)}` };
  }
}
