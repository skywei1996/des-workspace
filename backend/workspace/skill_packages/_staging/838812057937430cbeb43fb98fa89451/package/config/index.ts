/**
 * CWork Skill Package - 配置模块
 *
 * 只包含 CWork 业务系统配置，不包含 LLM 凭证
 */

const requiredEnv = (key: string): string => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`缺少环境变量: ${key}`);
  }
  return value;
};

// CWork API 配置
export const CWORK_CONFIG = {
  appKey: requiredEnv('CWORK_APP_KEY'),
  baseUrl: requiredEnv('CWORK_BASE_URL'),
} as const;

// SSE 配置
export const SSE_CONFIG = {
  timeout: Number(process.env['SSE_TIMEOUT'] ?? 60000),
  maxReports: Number(process.env['SSE_MAX_REPORTS'] ?? 20),
} as const;

// 分页配置
export const PAGINATION_CONFIG = {
  defaultPageSize: Number(process.env['PAGINATION_DEFAULT'] ?? 20),
  maxPageSize: Number(process.env['PAGINATION_MAX'] ?? 50),
} as const;
