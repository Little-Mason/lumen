'use client';

import { useState } from 'react';
import { readAiStream } from '@/lib/ai/stream-client';

export type AssistKind = 'OUTLINE' | 'TITLE' | 'TAGS' | 'SUMMARIZE' | 'POLISH';

const ACTIONS: { kind: AssistKind; label: string }[] = [
  { kind: 'OUTLINE', label: '大纲' },
  { kind: 'TITLE', label: '标题' },
  { kind: 'TAGS', label: '标签' },
  { kind: 'SUMMARIZE', label: '摘要' },
  { kind: 'POLISH', label: '润色' },
];

const LABEL: Record<AssistKind, string> = {
  OUTLINE: '大纲',
  TITLE: '标题',
  TAGS: '标签',
  SUMMARIZE: '摘要',
  POLISH: '润色',
};

/** 写作台里的 AI 工具条：流式生成 → 用户确认后一键应用到对应字段。 */
export function AiAssistBar({
  body,
  contentId,
  onApply,
}: {
  body: string;
  contentId?: string;
  onApply: (kind: AssistKind, text: string) => void;
}) {
  const [busy, setBusy] = useState<AssistKind | null>(null);
  const [output, setOutput] = useState('');
  const [lastKind, setLastKind] = useState<AssistKind | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(kind: AssistKind) {
    if (!body.trim()) return;
    setBusy(kind);
    setOutput('');
    setLastKind(kind);
    setError(null);
    try {
      const response = await fetch('/api/ai/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind,
          body,
          ...(contentId ? { contentId } : {}),
          stream: true,
        }),
      });
      await readAiStream(response, {
        onDelta: (text) => setOutput((previous) => previous + text),
        onError: (message) => setError(message),
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '网络错误，请稍后重试');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="rounded-xl border border-black/10 bg-white p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <p className="text-sm font-medium">AI 写作助手</p>
        <span className="text-xs text-black/40">流式生成，确认后再应用</span>
      </div>

      <div className="flex flex-wrap gap-2">
        {ACTIONS.map((action) => (
          <button
            key={action.kind}
            type="button"
            disabled={!body.trim() || busy !== null}
            onClick={() => void run(action.kind)}
            className="rounded-lg border border-black/15 bg-white px-3 py-1.5 text-sm hover:border-black/40 disabled:opacity-50"
          >
            {busy === action.kind ? `${action.label}…` : action.label}
          </button>
        ))}
        <button
          type="button"
          disabled={!output || !lastKind || busy !== null}
          onClick={() => {
            if (lastKind) onApply(lastKind, output);
          }}
          className="rounded-lg bg-ink px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
        >
          应用到编辑器
        </button>
      </div>

      {!body.trim() && (
        <p className="mt-2 text-xs text-black/40">先在左侧写点正文，AI 才有输入。</p>
      )}
      {error && (
        <p role="alert" className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}
      {output && (
        <pre className="mt-3 max-h-48 overflow-y-auto whitespace-pre-wrap rounded-lg bg-black/[0.02] px-3 py-2 font-sans text-sm">
          {output}
        </pre>
      )}
      {output && lastKind && (
        <p className="mt-1 text-xs text-black/45">
          {LABEL[lastKind]}结果将写入对应字段，应用后记得点「保存」。
        </p>
      )}
    </div>
  );
}
