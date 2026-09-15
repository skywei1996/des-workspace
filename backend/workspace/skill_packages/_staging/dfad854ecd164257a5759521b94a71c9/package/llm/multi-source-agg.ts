/**
 * Skill: multi-source-agg
 * 多源汇总 - 聚合任务、汇报、决策等多源信息生成工作总结
 */

import type { MultiSourceAggInput, MultiSourceAggOutput, WorkSummary, TaskListItem, TodoListItem, ReportListItem } from '../shared/types.js';
import type { TaskListQueryOutput } from '../shared/types.js';
import type { InboxQueryOutput } from '../shared/types.js';
import type { TodoListQueryOutput } from '../shared/types.js';

interface LLMClientLike {
  generateJSON<T>(prompt: string, systemPrompt?: string): Promise<T>;
}

interface SkillDeps {
  taskListQuery: (input: { pageIndex: number; pageSize: number }) => Promise<TaskListQueryOutput>;
  todoListQuery: (input: { pageIndex: number; pageSize: number }) => Promise<TodoListQueryOutput>;
  inboxQuery: (input: { pageIndex: number; pageSize: number }) => Promise<InboxQueryOutput>;
}

async function getTasksInTimeRange(start: number, end: number, deps: SkillDeps): Promise<TaskListItem[]> {
  try {
    const result = await deps.taskListQuery({ pageIndex: 1, pageSize: 100 });
    if (result.success && result.data) {
      return result.data.list.filter((task: TaskListItem) => {
        const taskTime = typeof task.createTime === 'number' ? task.createTime : 0;
        return taskTime >= start && taskTime <= end;
      });
    }
  } catch { /* ignore */ }
  return [];
}

async function getReportsInTimeRange(start: number, end: number, deps: SkillDeps): Promise<ReportListItem[]> {
  try {
    const result = await deps.inboxQuery({ pageIndex: 1, pageSize: 100 });
    if (result.success && result.data) {
      return result.data.list.filter((report: ReportListItem) => {
        const reportTime = typeof report.createTime === 'number' ? report.createTime : 0;
        return reportTime >= start && reportTime <= end;
      });
    }
  } catch { /* ignore */ }
  return [];
}

async function getDecisionsInTimeRange(start: number, end: number, deps: SkillDeps): Promise<TodoListItem[]> {
  try {
    const result = await deps.todoListQuery({ pageIndex: 1, pageSize: 100 });
    if (result.success && result.data) {
      return result.data.list.filter((todo: TodoListItem) => {
        const todoTime = typeof todo.createTime === 'number' ? todo.createTime : 0;
        return todoTime >= start && todoTime <= end;
      });
    }
  } catch { /* ignore */ }
  return [];
}

/**
 * @param input - 汇总请求参数
 * @param options - { llmClient, taskListQuery, todoListQuery, inboxQuery }
 */
export async function multiSourceAgg(
  input: MultiSourceAggInput,
  { llmClient, taskListQuery, todoListQuery, inboxQuery }: { llmClient: LLMClientLike } & SkillDeps
): Promise<MultiSourceAggOutput> {
  if (!llmClient) throw new Error('llmClient is required');

  const { timeRange, focusAreas } = input;
  const end = timeRange?.end || Date.now();
  const start = timeRange?.start || (end - 7 * 24 * 60 * 60 * 1000);

  const deps: SkillDeps = { taskListQuery, todoListQuery, inboxQuery };

  try {
    const [tasks, reports, decisions] = await Promise.all([
      getTasksInTimeRange(start, end, deps),
      getReportsInTimeRange(start, end, deps),
      getDecisionsInTimeRange(start, end, deps),
    ]);

    const completedTasks = tasks.filter((t: TaskListItem) => String(t.status) === '已完成');
    const inProgressTasks = tasks.filter((t: TaskListItem) => String(t.status) === '进行中');

    let context = `# 多源数据汇总\n\n`;
    context += `**统计周期**：${new Date(start).toLocaleDateString()} ~ ${new Date(end).toLocaleDateString()}\n\n`;
    context += `## 数据概览\n\n`;
    context += `- 任务数：${tasks.length}（已完成 ${completedTasks.length}，进行中 ${inProgressTasks.length}）\n`;
    context += `- 汇报数：${reports.length}\n`;
    context += `- 决策数：${decisions.length}\n\n`;

    if (tasks.length > 0) {
      context += `## 任务列表\n\n`;
      tasks.slice(0, 20).forEach((task: TaskListItem, i: number) => {
        context += `${i + 1}. [${task.status}] ${task.main || '无标题'}\n`;
      });
    }

    if (reports.length > 0) {
      context += `\n## 汇报摘要\n\n`;
      reports.slice(0, 10).forEach((report: ReportListItem, i: number) => {
        context += `${i + 1}. ${report.main || '无标题'}\n`;
      });
    }

    if (decisions.length > 0) {
      context += `\n## 决策事项\n\n`;
      decisions.slice(0, 10).forEach((decision: TodoListItem, i: number) => {
        const status = decision.detail?.progress ? '已处理' : '待处理';
        context += `${i + 1}. [${status}] ${decision.main || '无标题'}\n`;
      });
    }

    if (focusAreas?.length) {
      context += `\n## 重点关注领域\n\n`;
      focusAreas.forEach((area: string) => context += `- ${area}\n`);
    }

    const systemPrompt = `你是一个专业的工作总结助手，擅长聚合多源信息生成结构化工作总结。

请按照以下 JSON 格式返回：
{
  "period": "统计周期描述",
  "overview": "整体概述（2-3句话）",
  "tasks": { "total": 123, "completed": 45, "inProgress": 30, "overdue": 5, "highlights": ["亮点1"] },
  "reports": { "total": 10, "keyInsights": ["洞察1"], "problems": ["问题1"], "risks": ["风险1"] },
  "decisions": { "total": 8, "resolved": ["已决策1"], "pending": ["待决1"] },
  "trends": { "positive": ["向好趋势1"], "concerning": ["隐忧1"] },
  "recommendations": ["建议1"]
}

要求：直接返回 JSON，不要包含其他说明`;

    const userPrompt = `请基于以下多源数据生成工作总结：\n\n${context}`;

    const result = await llmClient.generateJSON<WorkSummary>(userPrompt, systemPrompt);
    return { success: true, data: result };
  } catch (error) {
    return { success: false, message: `多源汇总失败: ${error instanceof Error ? error.message : String(error)}` };
  }
}
