/**
 * Skill: generate-unclosed-list
 * 未闭环清单生成
 */

import type { GenerateUnclosedListInput, GenerateUnclosedListOutput, UnclosedListSummary } from '../shared/types.js';
import type { UnclosedItem } from '../shared/types.js';

export async function generateUnclosedList(input: GenerateUnclosedListInput): Promise<GenerateUnclosedListOutput> {
  const { unclosedItems } = input;

  if (!unclosedItems || unclosedItems.length === 0) {
    return { success: false, message: '暂无未闭环事项' };
  }

  try {
    const highPriorityCount = unclosedItems.filter((item: UnclosedItem) => item.daysUnresolved >= 30).length;
    const mediumPriorityCount = unclosedItems.filter((item: UnclosedItem) => item.daysUnresolved >= 14 && item.daysUnresolved < 30).length;

    let priority: '高' | '中' | '低' = '低';
    if (highPriorityCount > 0) priority = '高';
    else if (mediumPriorityCount > 0) priority = '中';

    const summary = `发现 ${unclosedItems.length} 个未闭环事项`;
    const details = unclosedItems.map((item: UnclosedItem) => {
      const typeLabel = item.itemType === 'task' ? '任务' : item.itemType === 'decision' ? '决策' : '反馈';
      return `- [${typeLabel}] ${item.itemId}（未更新 ${item.daysUnresolved} 天）：${item.suggestedAction}`;
    }).join('\n');

    const result: UnclosedListSummary = {
      summary: `${summary}，其中 ${highPriorityCount} 个严重超期，${mediumPriorityCount} 个长期未更新。\n\n${details}`,
      list: unclosedItems,
      priority,
    };

    return { success: true, data: result };
  } catch (error) {
    return { success: false, message: `清单生成失败: ${error instanceof Error ? error.message : String(error)}` };
  }
}
