/**
 * Skill: sse-client
 * SSE 流式客户端封装
 */

import { cworkClient } from './cwork-client.js';
import { processSSEResponse } from './sse-processing.js';
import { SSE_CONFIG } from '../config/index.js';
import type { SSEClientInput, SSEClientOutput } from './types.js';

export async function sseClientSkill(input: SSEClientInput, _context?: { llmClient?: any }): Promise<SSEClientOutput> {
  const { reportIdList, question } = input;

  if (!reportIdList || reportIdList.length === 0) {
    return { success: false, message: 'reportIdList 不能为空' };
  }
  if (reportIdList.length > SSE_CONFIG.maxReports) {
    return { success: false, message: `单次分析最多支持 ${SSE_CONFIG.maxReports} 条汇报` };
  }
  if (!question || question.trim().length === 0) {
    return { success: false, message: 'question 不能为空' };
  }

  try {
    const response = await cworkClient.aiSseQa(question, reportIdList);
    const result = await processSSEResponse(response);
    return {
      success: true,
      data: { content: result.fullContent, isComplete: result.isComplete, summary: result.summary },
    };
  } catch (error) {
    return { success: false, message: `SSE 分析失败: ${error instanceof Error ? error.message : String(error)}` };
  }
}
