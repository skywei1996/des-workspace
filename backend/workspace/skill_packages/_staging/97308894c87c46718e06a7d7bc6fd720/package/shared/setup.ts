/**
 * CWork Skill Package 初始化函数
 */

import { SSE_CONFIG, PAGINATION_CONFIG } from '../config/index.js';

const DEFAULT_BASE_URL = 'https://sg-al-cwork-web.mediportal.com.cn';

export interface SetupOptions {
  /** 工作协同 appKey（必填） */
  appKey: string;
  /** 工作协同 API 地址，默认 https://sg-al-cwork-web.mediportal.com.cn */
  baseUrl?: string;
  /** SSE 超时（毫秒），默认 60000 */
  sseTimeout?: number;
  /** SSE 最大汇报数，默认 20 */
  sseMaxReports?: number;
  /** 分页默认大小，默认 20 */
  paginationDefault?: number;
  /** 分页最大大小，默认 50 */
  paginationMax?: number;
}

let initialized = false;

/**
 * 初始化 CWork Skill 包
 * 只需调用一次，之后所有 Skill 即可使用
 */
export function setup(options: SetupOptions): void {
  if (initialized) {
    console.warn('[cwork] 已初始化，重复调用无效');
    return;
  }

  if (!options.appKey) {
    throw new Error('[cwork] appKey 是必填参数');
  }

  // 设置环境变量（供 config/index.ts 使用）
  process.env['CWORK_APP_KEY'] = options.appKey;
  process.env['CWORK_BASE_URL'] = options.baseUrl ?? DEFAULT_BASE_URL;

  if (options.sseTimeout !== undefined) {
    process.env['SSE_TIMEOUT'] = String(options.sseTimeout);
  }
  if (options.sseMaxReports !== undefined) {
    process.env['SSE_MAX_REPORTS'] = String(options.sseMaxReports);
  }
  if (options.paginationDefault !== undefined) {
    process.env['PAGINATION_DEFAULT'] = String(options.paginationDefault);
  }
  if (options.paginationMax !== undefined) {
    process.env['PAGINATION_MAX'] = String(options.paginationMax);
  }

  initialized = true;
}

/**
 * 检查是否已初始化
 */
export function isReady(): boolean {
  return initialized;
}
