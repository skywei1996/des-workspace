/**
 * SSE 流式响应处理工具
 */

export interface SSEResult {
  fullContent: string;
  isComplete: boolean;
  summary?: string;
}

export async function processSSEResponse(response: Response): Promise<SSEResult> {
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('Response body is not readable');
  }

  const decoder = new TextDecoder();
  let fullContent = '';
  let isComplete = false;
  let summary: string | undefined;

  const readPromise = (async () => {
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine) continue;

        if (trimmedLine.startsWith('event:')) {
          const eventType = trimmedLine.slice(6).trim();
          if (eventType === 'done') {
            isComplete = true;
          }
          continue;
        }

        if (trimmedLine.startsWith('data:')) {
          const data = trimmedLine.slice(5).trim();
          fullContent += data + '\n';
        }
      }
    }
  })();

  await Promise.race([
    readPromise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('SSE timeout')), 60000)),
  ]);

  if (fullContent.length > 500) {
    summary = fullContent.substring(0, 200) + '...';
  } else if (fullContent.length > 0) {
    summary = fullContent;
  }

  return { fullContent, isComplete, summary };
}
