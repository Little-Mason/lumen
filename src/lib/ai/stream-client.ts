import { decodeSseStream } from '@/lib/sse';
import type { AiJobResult, RagSourceDTO } from '@/types';

/** 浏览器端消费 AI SSE：meta → delta* → done | error，同时兼容普通 JSON 错误响应。 */
export type StreamMeta = {
  jobId: string;
  kind: string;
  model: string;
  sources: RagSourceDTO[];
};
export type StreamDone = { result: AiJobResult; sources: RagSourceDTO[] };

type Handlers = {
  onMeta?: (meta: StreamMeta) => void;
  onDelta?: (text: string) => void;
  onDone?: (done: StreamDone) => void;
  onError?: (message: string) => void;
};

type Frame = { text?: string; result?: AiJobResult; sources?: RagSourceDTO[]; message?: string };

export async function readAiStream(response: Response, handlers: Handlers): Promise<void> {
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: { message?: string };
    } | null;
    handlers.onError?.(body?.error?.message ?? `请求失败（HTTP ${response.status}）`);
    return;
  }

  for await (const event of decodeSseStream(response)) {
    const data = (event.data ?? {}) as Frame & StreamMeta;
    if (event.event === 'meta') handlers.onMeta?.(data as StreamMeta);
    else if (event.event === 'delta') handlers.onDelta?.(String(data.text ?? ''));
    else if (event.event === 'done') handlers.onDone?.(data as StreamDone);
    else if (event.event === 'error') {
      handlers.onError?.(String(data.message ?? 'AI 暂不可用，可继续手动写作'));
    }
  }
}
