/**
 * Skill: ai-highlight-extract
 * 汇报重点提炼
 */

import { sseClientSkill } from '../shared/sse-client.js';
import type { AiHighlightExtractInput, AiHighlightExtractOutput } from '../shared/types.js';

export async function aiHighlightExtract(input: AiHighlightExtractInput): Promise<AiHighlightExtractOutput> {
  const { reportIdList } = input;
  const question = `请提炼以下汇报的重点内容，按重要性排序输出。每条重点用简洁的语言概括。`;

  const result = await sseClientSkill({ reportIdList, question });

  if (!result.success || !result.data) {
    return { success: false, message: result?.message || '重点提炼失败' };
  }

  const content = result.data.content;
  const lines = content.split('\n').filter((line) => line.trim().length > 0);

  const highlights = lines.map((line) => {
    return line.replace(/^\d+[\.\)]\s*/, '').replace(/^[a-zA-Z][\.\)]\s*/, '').replace(/^[-•·]\s*/, '').trim();
  }).filter((line) => line.length > 0);

  return { success: true, data: { highlights, sourceReports: reportIdList } };
}
