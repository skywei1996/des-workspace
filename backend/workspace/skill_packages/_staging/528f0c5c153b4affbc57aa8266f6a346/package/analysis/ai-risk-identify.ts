/**
 * Skill: ai-risk-identify
 * 风险识别
 */

import { sseClientSkill } from '../shared/sse-client.js';
import type { AiRiskIdentifyInput, AiRiskIdentifyOutput, RiskItem } from '../shared/types.js';

export async function aiRiskIdentify(input: AiRiskIdentifyInput): Promise<AiRiskIdentifyOutput> {
  const { reportIdList } = input;

  const question = `请识别以下汇报中的潜在风险。对每个风险，说明：
1. 风险描述（可能发生什么）
2. 发生概率（高/中/低）
3. 影响程度（高/中/低）

按以下格式输出：
- 风险1：描述（概率：高，影响：中）
`;

  const result = await sseClientSkill({ reportIdList, question });

  if (!result.success || !result.data) {
    return { success: false, message: result?.message || '风险识别失败' };
  }

  const content = result.data.content;
  const lines = content.split('\n').filter((line) => line.trim().length > 0);
  const risks: RiskItem[] = [];

  for (const line of lines) {
    const match = line.match(/^[-·]\s*(.+?)\s*[（(]概率[：:]\s*(高|中|低)\s*[,，]\s*影响[：:]\s*(高|中|低)[）)]/);
    if (match) {
      const [, description, probability, impact] = match;
      risks.push({ description, probability: probability as '高' | '中' | '低', impact: impact as '高' | '中' | '低' });
    } else {
      const simpleMatch = line.match(/^[-·]\s*(.+)$/);
      if (simpleMatch) {
        risks.push({ description: simpleMatch[1], probability: '中', impact: '中' });
      }
    }
  }

  return { success: true, data: { risks } };
}
