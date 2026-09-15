/**
 * Skill: task-structure
 * 任务结构化整理
 */

import { empSearch } from '../shared/emp-search.js';
import type { TaskStructureInput, TaskStructureOutput, TaskDraft } from '../shared/types.js';

function parseDeadline(dateStr: string): number | undefined {
  if (!dateStr) return undefined;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const relativePatterns = [
    { pattern: /今天|今日/i, days: 0 },
    { pattern: /明天|明日/i, days: 1 },
    { pattern: /后天/i, days: 2 },
    { pattern: /下周初/i, days: 7 - today.getDay() + 1 || 8 },
    { pattern: /下周末/i, days: 7 - today.getDay() + 5 || 12 },
    { pattern: /月底|本月末/i, days: new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate() - today.getDate() },
  ];

  for (const { pattern, days } of relativePatterns) {
    if (pattern.test(dateStr)) {
      const targetDate = new Date(today);
      targetDate.setDate(targetDate.getDate() + days);
      targetDate.setHours(18, 0, 0, 0);
      return targetDate.getTime();
    }
  }

  const dateMatch = dateStr.match(/(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
  if (dateMatch) {
    const [, , month, day] = dateMatch;
    const targetDate = new Date(today.getFullYear(), parseInt(month) - 1, parseInt(day), 18, 0, 0, 0);
    if (targetDate >= today) return targetDate.getTime();
  }

  const daysLaterMatch = dateStr.match(/(\d+)天[后之]/);
  if (daysLaterMatch) {
    const days = parseInt(daysLaterMatch[1]);
    const targetDate = new Date(today);
    targetDate.setDate(targetDate.getDate() + days);
    targetDate.setHours(18, 0, 0, 0);
    return targetDate.getTime();
  }

  return undefined;
}

export async function taskStructure(input: TaskStructureInput): Promise<TaskStructureOutput> {
  const { todoDescription, suggestedAssignee, suggestedDeadline, needful } = input;

  if (!todoDescription || todoDescription.trim().length < 5) {
    return { success: false, message: '待办描述过短' };
  }

  try {
    let empId: string | undefined;
    let empName: string | undefined;

    if (suggestedAssignee) {
      const empResult = await empSearch({ name: suggestedAssignee });
      if (empResult.success && empResult.data && empResult.data.length > 0) {
        empId = empResult.data[0].id;
        empName = empResult.data[0].name;
      }
    }

    const deadline = suggestedDeadline ? parseDeadline(suggestedDeadline) : undefined;
    const title = todoDescription.slice(0, 20) + (todoDescription.length > 20 ? '...' : '');

    const taskDraft: TaskDraft = {
      title,
      content: todoDescription,
      target: needful || todoDescription,
      assignee: empId,
      assigneeName: empName,
      deadline,
      grades: '一般',
    };

    return { success: true, data: taskDraft };
  } catch (error) {
    return { success: false, message: `任务结构化失败: ${error instanceof Error ? error.message : String(error)}` };
  }
}
