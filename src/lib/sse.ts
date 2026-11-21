/**
 * 同构 SSE 工具：服务端编码、浏览器端解码。
 * 这个文件刻意不 import 任何服务端依赖（env / db / provider），
 * 因为写作台与 AI 工作台都是客户端组件。
 */
export type SseEvent = { event: string; data: unknown };

const SSE_HEADERS: Record<string, string> = {
  'Content-Type': 'text/event-stream; charset=utf-8',
  'Cache-Control': 'no-cache, no-transform',
  Connection: 'keep-alive',
  'X-Accel-Buffering': 'no',
};

export function encodeSseEvent(event: SseEvent): string {
  return `event: ${event.event}\ndata: ${JSON.stringify(event.data)}\n\n`;
}

/** 把异步事件流转成 SSE Response；生成器抛错时流会自然终止。 */
export function sseResponse(events: AsyncIterable<SseEvent>): Response {
  const encoder = new TextEncoder();
  const iterator = events[Symbol.asyncIterator]();
  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const next = await iterator.next();
        if (next.done) {
          controller.close();
          return;
        }
        controller.enqueue(encoder.encode(encodeSseEvent(next.value)));
      } catch (error) {
        controller.error(error);
      }
    },
    async cancel() {
      await iterator.return?.();
    },
  });
  return new Response(stream, { headers: SSE_HEADERS });
}

/** 浏览器端逐条解析 SSE，忽略注释行与不完整的尾部帧。 */
export async function* decodeSseStream(response: Response): AsyncGenerator<SseEvent> {
  if (!response.body) return;
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let boundary = buffer.indexOf('\n\n');
      while (boundary !== -1) {
        const frame = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        boundary = buffer.indexOf('\n\n');

        let event = 'message';
        const dataLines: string[] = [];
        for (const line of frame.split('\n')) {
          if (line.startsWith('event:')) event = line.slice(6).trim();
          if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
        }
        if (!dataLines.length) continue;
        try {
          yield { event, data: JSON.parse(dataLines.join('\n')) as unknown };
        } catch {
          // 单个坏帧不应中断整条流。
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
