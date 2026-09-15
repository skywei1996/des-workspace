/**
 * Skill: emp-search
 * 员工搜索 - 将姓名解析为 empId
 *
 * 层次: L1 基础数据获取
 */

import { cworkClient } from './cwork-client.js';
import type { EmpSearchInput, EmpSearchOutput, Employee } from './types.js';

/**
 * @param input - 员工姓名
 * @param options - 可选配置
 * @returns 员工信息列表
 */
export async function empSearch(input: EmpSearchInput): Promise<EmpSearchOutput> {
  const { name } = input;

  if (!name || name.trim().length === 0) {
    return { success: false, message: '员工姓名不能为空' };
  }

  try {
    const response = await cworkClient.searchEmpByName(name.trim());
    const allEmps: Employee[] = [
      ...(response.inside?.empList || []),
      ...(response.outside?.empList || []),
    ];
    if (allEmps.length === 0) {
      return { success: false, message: `未找到姓名为"${name}"的员工` };
    }
    return { success: true, data: allEmps };
  } catch (error) {
    return { success: false, message: `员工搜索失败: ${error instanceof Error ? error.message : String(error)}` };
  }
}
