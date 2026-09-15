/**
 * Skill: report-formality-adjust
 * 汇报正式度调整
 */

import type { ReportFormalityAdjustInput, ReportFormalityAdjustOutput } from '../shared/types.js';

interface LLMClientLike {
  generate(prompt: string, systemPrompt?: string): Promise<string>;
}

export async function reportFormalityAdjust(input: ReportFormalityAdjustInput, _context?: { llmClient?: LLMClientLike }): Promise<ReportFormalityAdjustOutput> { const { llmClient } = _context ?? {}; 
  const { content, targetFormality, reportType = '通用' } = input;

  if (!content || content.trim().length === 0) {
    return { success: false, message: '汇报内容不能为空' };
  }

  try {
    const formalityMap = {
      formal: '正式（使用敬语、书面语、严谨表达）',
      'semi-formal': '半正式（礼貌但不过分拘谨，平衡专业与亲和）',
      informal: '非正式（口语化、简洁直接）',
    };

    const systemPrompt = `你是一个专业的文书编辑助手，擅长调整文本的正式程度。

调整要求：
- 正式：使用敬语、书面语、完整句式，避免口语，表达严谨
- 半正式：礼貌但不拘谨，专业且亲和，适度使用书面语
- 非正式：简洁直接，可使用口语，注重沟通效率

注意事项：
1. 保持核心信息不变
2. 只调整语言风格和表达方式
3. 确保逻辑连贯
4. 直接返回调整后的内容，不要包含其他说明`;

    const userPrompt = `请将以下${reportType}汇报调整为${formalityMap[targetFormality]}风格：

${content}`;

    const result = await llmClient.generate(userPrompt, systemPrompt);
    return { success: true, data: result };
  } catch (error) {
    return { success: false, message: `正式度调整失败: ${error instanceof Error ? error.message : String(error)}` };
  }
}
