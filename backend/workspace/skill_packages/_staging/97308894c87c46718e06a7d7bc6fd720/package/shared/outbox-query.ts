/**
 * Skill: outbox-query
 * 发件箱查询
 */

import { cworkClient } from './cwork-client.js';
import type { OutboxQueryInput, OutboxQueryOutput } from './types.js';

export async function outboxQuery(input: OutboxQueryInput): Promise<OutboxQueryOutput> {
  const { pageSize, pageIndex = 1, ...filters } = input;
  if (!pageSize || pageSize <= 0) return { success: false, message: 'pageSize 必须大于 0' };

  try {
    const result = await cworkClient.getOutboxList({ pageSize, pageIndex, ...filters });
    return { success: true, data: result };
  } catch (error) {
    return { success: false, message: `发件箱查询失败: ${error instanceof Error ? error.message : String(error)}` };
  }
}
