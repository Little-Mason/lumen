import { describe, expect, it } from 'vitest';
import { decodeSseStream, encodeSseEvent, sseResponse } from '@/lib/sse';

function responseFrom(chunks: string[]): Response {
  const encoder = new TextEncoder();
  return new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
        controller.close();
      },
    }),
  );
}

describe('encodeSseEvent', () => {
  it('编码成 event + data + 空行', () => {
    expect(encodeSseEvent({ event: 'delta', data: { text: '你好' } })).toBe(
      'event: delta\ndata: {"text":"你好"}\n\n',
    );
  });
});

describe('decodeSseStream', () => {
  it('逐帧解析 meta / delta / done', async () => {
    const response = responseFrom([
      'event: meta\ndata: {"jobId":"j1"}\n\n',
      'event: delta\ndata: {"text":"第一块"}\n\n',
      'event: done\ndata: {"result":{"text":"完整"}}\n\n',
    ]);
    const events = [];
    for await (const event of decodeSseStream(response)) events.push(event);
    expect(events).toEqual([
      { event: 'meta', data: { jobId: 'j1' } },
      { event: 'delta', data: { text: '第一块' } },
      { event: 'done', data: { result: { text: '完整' } } },
    ]);
  });

  it('帧被 TCP 分片切断时仍能拼回，坏帧不影响后续帧', async () => {
    const response = responseFrom([
      'event: de',
      'lta\ndata: {"text":"A"}\n',
      '\nevent: delta\ndata: {bad json}\n\nevent: delta\ndata: {"text":"B"}\n\n',
    ]);
    const texts: string[] = [];
    for await (const event of decodeSseStream(response)) {
      if (event.event === 'delta') texts.push(String((event.data as { text: string }).text));
    }
    expect(texts).toEqual(['A', 'B']);
  });
});

describe('sseResponse', () => {
  it('把异步事件流变成可解析的 SSE 响应', async () => {
    async function* events() {
      yield { event: 'delta', data: { text: 'x' } };
      yield { event: 'done', data: { ok: true } };
    }
    const response = sseResponse(events());
    expect(response.headers.get('Content-Type')).toContain('text/event-stream');
    const seen = [];
    for await (const event of decodeSseStream(response)) seen.push(event.event);
    expect(seen).toEqual(['delta', 'done']);
  });
});
