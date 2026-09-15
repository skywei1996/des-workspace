/**
 * Skill: inbox-query
 * 收件箱查询
 */

import { cworkClient } from './cwork-client.js';
import type { InboxQueryInput, InboxQueryOutput } from './types.js';

export async function inboxQuery(input: InboxQueryInput): Promise<InboxQueryOutput> {
  const { pageSize, pageIndex = 1, ...filters } = input;
  if (!pageSize || pageSize <= 0) return { success: false, message: 'pageSize 必须大于 0' };

  try {
    const result = await cworkClient.getInboxList({ pageSize, pageIndex, ...filters });
    return { success: true, data: result };
  } catch (error) {
    return { success: false, message: `收件箱查询失败: ${error instanceof Error ? error.message : String(error)}` };
  }
}
