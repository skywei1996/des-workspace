/**
 * Skill: ai-problem-identify
 * 问题识别
 */

import { sseClientSkill } from '../shared/sse-client.js';
import type { AiProblemIdentifyInput, AiProblemIdentifyOutput, ProblemItem } from '../shared/types.js';

export async function aiProblemIdentify(input: AiProblemIdentifyInput): Promise<AiProblemIdentifyOutput> {
  const { reportIdList } = input;

  const question = `请识别以下汇报中描述的问题和异常。对每个问题，说明：
1. 问题描述（具体是什么问题）
2. 严重程度（高/中/低）

按以下格式输出：
- 问题1（高）：具体描述
- 问题2（中）：具体描述
`;

  const result = await sseClientSkill({ reportIdList, question });

  if (!result.success || !result.data) {
    return { success: false, message: result?.message || '问题识别失败' };
  }

  const content = result.data.content;
  const lines = content.split('\n').filter((line) => line.trim().length > 0);
  const problems: ProblemItem[] = [];

  for (const line of lines) {
    const match = line.match(/^[-·]\s*(.+?)\s*[（(](高|中|低)[）)]\s*[:：]\s*(.+)$/);
    if (match) {
      const [, description, severity, detail] = match;
      problems.push({ description: detail || description, severity: severity as '高' | '中' | '低', sourceReport: reportIdList[0] });
    } else {
      const simpleMatch = line.match(/^[-·]\s*(.+)$/);
      if (simpleMatch) {
        problems.push({ description: simpleMatch[1], severity: '中', sourceReport: reportIdList[0] });
      }
    }
  }

  return { success: true, data: { problems } };
}
