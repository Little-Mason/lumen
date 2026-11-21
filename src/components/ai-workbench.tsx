'use client';

import Link from 'next/link';
import { useState } from 'react';
import { readAiStream, type StreamDone, type StreamMeta } from '@/lib/ai/stream-client';
import type { AiJobDTO, RagSourceDTO } from '@/types';

type WorkbenchContent = { id: string; title: string; contentMd: string };

const KINDS = [
  { kind: 'OUTLINE', label: '生成大纲', hint: '最多 6 节，可直接开写' },
  { kind: 'TITLE', label: '标题备选', hint: '5 个不同风格' },
  { kind: 'TAGS', label: '推荐标签', hint: '3–5 个逗号分隔' },
  { kind: 'SUMMARIZE', label: '生成摘要', hint: '120 字内，可作 SEO description' },
  { kind: 'POLISH', label: '润色正文', hint: '流式返回完整 Markdown' },
] as const;

type Kind = (typeof KINDS)[number]['kind'];
type Tab = 'write' | 'ask' | 'jobs';

const field =
  'w-full rounded-lg border border-black/15 bg-white px-3 py-2 text-sm outline-none focus:border-black/50';
const button =
  'rounded-lg border border-black/15 bg-white px-3 py-1.5 text-sm hover:border-black/40 disabled:opacity-50';

const KIND_LABEL: Record<string, string> = {
  OUTLINE: '大纲',
  TITLE: '标题',
  TAGS: '标签',
  SUMMARIZE: '摘要',
  POLISH: '润色',
  RAG_ASK: '知识库问答',
};

function formatTime(iso: string): string {
  return new Date(iso).toISOString().slice(0, 16).replace('T', ' ');
}

export function AiWorkbench({
  contents,
  initialJobs,
  providerLabel,
}: {
  contents: WorkbenchContent[];
  initialJobs: AiJobDTO[];
  providerLabel: string;
}) {
  const [tab, setTab] = useState<Tab>('write');
  const [contentId, setContentId] = useState('');
  const [body, setBody] = useState('');
  const [useStream, setUseStream] = useState(true);
  const [output, setOutput] = useState('');
  const [done, setDone] = useState<StreamDone | null>(null);
  const [meta, setMeta] = useState<StreamMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [citations, setCitations] = useState<RagSourceDTO[]>([]);
  const [jobs, setJobs] = useState<AiJobDTO[]>(initialJobs);

  async function refreshJobs() {
    try {
      const response = await fetch('/api/ai/jobs?pageSize=20');
      if (response.ok) {
        const data = (await response.json()) as { items: AiJobDTO[] };
        setJobs(data.items);
      }
    } catch {
      // 记录刷新失败不该打断刚生成的结果展示。
    }
  }

  function loadContent(id: string) {
    setContentId(id);
    const found = contents.find((item) => item.id === id);
    if (found) setBody(found.contentMd);
  }

  async function run(kind: Kind) {
    if (!body.trim()) {
      setError('请先输入正文，或从上方下拉框载入一篇内容。');
      return;
    }
    setTab('write');
    setBusy(true);
    setOutput('');
    setDone(null);
    setMeta(null);
    setError(null);
    try {
      const payload = {
        kind,
        body,
        ...(contentId ? { contentId } : {}),
        stream: useStream,
      };
      const response = await fetch('/api/ai/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!useStream) {
        const data = (await response.json()) as {
          result?: { text: string } & StreamDone['result'];
          error?: { message?: string };
        };
        if (!response.ok || !data.result) {
          throw new Error(data.error?.message ?? '生成失败');
        }
        setOutput(data.result.text);
        setDone({ result: data.result, sources: [] });
        await refreshJobs();
        return;
      }

      await readAiStream(response, {
        onMeta: setMeta,
        onDelta: (text) => setOutput((previous) => previous + text),
        onDone: (value) => {
          setDone(value);
          void refreshJobs();
        },
        onError: (message) => setError(message),
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '网络错误，请稍后重试');
    } finally {
      setBusy(false);
    }
  }

  async function ask() {
    if (!question.trim()) {
      setError('请输入要问的问题。');
      return;
    }
    setTab('ask');
    setBusy(true);
    setAnswer('');
    setCitations([]);
    setDone(null);
    setMeta(null);
    setError(null);
    try {
      const response = await fetch('/api/ai/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, stream: true }),
      });
      await readAiStream(response, {
        onMeta: (value) => {
          setMeta(value);
          setCitations(value.sources);
        },
        onDelta: (text) => setAnswer((previous) => previous + text),
        onDone: (value) => {
          setDone(value);
          setCitations(value.sources);
          void refreshJobs();
        },
        onError: (message) => setError(message),
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '网络错误，请稍后重试');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            ['write', '写作助手'],
            ['ask', '知识库问答'],
            ['jobs', '调用记录'],
          ] as [Tab, string][]
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setTab(value)}
            className={`rounded-full border px-4 py-1.5 text-sm ${
              tab === value
                ? 'border-ink bg-ink text-white'
                : 'border-black/15 bg-white text-black/60 hover:border-black/40'
            }`}
          >
            {label}
          </button>
        ))}
        <span className="ml-auto rounded-full bg-black/[0.04] px-3 py-1 text-xs text-black/55">
          {providerLabel}
        </span>
      </div>

      {tab === 'write' && (
        <section className="space-y-4 rounded-xl border border-black/10 bg-white p-5">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <div>
              <label htmlFor="ai-content" className="mb-1 block text-sm font-medium">
                从已有内容载入
              </label>
              <select
                id="ai-content"
                className={field}
                value={contentId}
                onChange={(event) => loadContent(event.target.value)}
              >
                <option value="">不关联内容（手动输入正文）</option>
                {contents.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title}
                  </option>
                ))}
              </select>
            </div>
            <label className="flex items-end gap-2 pb-2 text-xs text-black/60">
              <input
                type="checkbox"
                checked={useStream}
                onChange={(event) => setUseStream(event.target.checked)}
              />
              流式输出
            </label>
          </div>

          <div>
            <label htmlFor="ai-body" className="mb-1 block text-sm font-medium">
              正文
            </label>
            <textarea
              id="ai-body"
              className={`${field} h-40 resize-y font-mono leading-6`}
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder="粘贴或载入需要处理的 Markdown 正文…"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {KINDS.map((item) => (
              <button
                key={item.kind}
                type="button"
                title={item.hint}
                disabled={busy}
                onClick={() => void run(item.kind)}
                className={button}
              >
                {item.label}
              </button>
            ))}
          </div>

          <ResultPanel output={output} error={error} done={done} meta={meta} />
        </section>
      )}

      {tab === 'ask' && (
        <section className="space-y-4 rounded-xl border border-black/10 bg-white p-5">
          <div>
            <label htmlFor="ai-question" className="mb-1 block text-sm font-medium">
              向内容库提问
            </label>
            <div className="flex flex-wrap gap-2">
              <input
                id="ai-question"
                className={`${field} flex-1`}
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !busy) void ask();
                }}
                placeholder="例如：pgvector 的 HNSW 索引是怎么用的？"
              />
              <button
                type="button"
                disabled={busy}
                onClick={() => void ask()}
                className="rounded-lg bg-ink px-5 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {busy ? '生成中…' : '提问'}
              </button>
            </div>
            <p className="mt-1 text-xs text-black/45">
              只检索已发布内容；片段不足时模型会明确回答「内容库中没有相关记录」。
            </p>
          </div>

          <ResultPanel output={answer} error={error} done={done} meta={meta} />

          {citations.length > 0 && (
            <div data-testid="rag-citations">
              <p className="mb-2 text-sm font-medium">引用来源</p>
              <ul className="space-y-2">
                {citations.map((source) => (
                  <li
                    key={`${source.contentId}-${source.chunkIndex}`}
                    className="rounded-lg border border-black/10 bg-black/[0.02] px-3 py-2 text-sm"
                  >
                    <Link
                      href={`/posts/${source.slug}`}
                      className="font-medium text-accent hover:underline"
                    >
                      [{citations.indexOf(source) + 1}] {source.title}
                    </Link>
                    <span className="ml-2 text-xs text-black/45">
                      片段 #{source.chunkIndex} · 相似度 {source.similarity.toFixed(3)}
                    </span>
                    <p className="mt-1 text-xs text-black/55">{source.preview}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {tab === 'jobs' && (
        <section className="space-y-3 rounded-xl border border-black/10 bg-white p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">最近 20 次调用</p>
            <button type="button" className={button} onClick={() => void refreshJobs()}>
              刷新
            </button>
          </div>
          {jobs.length === 0 ? (
            <p className="text-sm text-black/45">还没有调用记录。</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-black/45">
                  <tr>
                    <th className="py-2 pr-3">时间 (UTC)</th>
                    <th className="py-2 pr-3">能力</th>
                    <th className="py-2 pr-3">状态</th>
                    <th className="py-2 pr-3">模型</th>
                    <th className="py-2 pr-3">tokens</th>
                    <th className="py-2 pr-3">成本(分)</th>
                    <th className="py-2 pr-3">耗时</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((job) => (
                    <tr key={job.id} className="border-t border-black/[0.06]">
                      <td className="py-2 pr-3 font-mono">{formatTime(job.createdAt)}</td>
                      <td className="py-2 pr-3">{KIND_LABEL[job.kind] ?? job.kind}</td>
                      <td className="py-2 pr-3">
                        <span
                          className={
                            job.status === 'SUCCESS'
                              ? 'text-emerald-700'
                              : job.status === 'FAILED'
                                ? 'text-red-700'
                                : 'text-black/45'
                          }
                        >
                          {job.status}
                        </span>
                      </td>
                      <td className="py-2 pr-3 font-mono">{job.model}</td>
                      <td className="py-2 pr-3">
                        {job.promptTokens}/{job.completionTokens}
                      </td>
                      <td className="py-2 pr-3">{job.costCents}</td>
                      <td className="py-2 pr-3">{job.latencyMs}ms</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-xs text-black/40">
            成本为估算口径（非账单）；失败调用同样落库，便于追溯。
          </p>
        </section>
      )}
    </div>
  );
}

function ResultPanel({
  output,
  error,
  done,
  meta,
}: {
  output: string;
  error: string | null;
  done: StreamDone | null;
  meta: StreamMeta | null;
}) {
  return (
    <div className="space-y-2">
      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}
      <div
        data-testid="ai-result"
        className="min-h-28 whitespace-pre-wrap rounded-lg border border-black/10 bg-black/[0.02] px-3 py-2 text-sm"
      >
        {output || <span className="text-black/40">结果会显示在这里。</span>}
      </div>
      {done?.result && (
        <p data-testid="ai-result-meta" className="text-xs text-black/50">
          Job {done.result.jobId} · {done.result.promptTokens}+{done.result.completionTokens} tokens
          · 约 {done.result.costCents} 分 · {done.result.latencyMs}ms
          {done.result.cached ? ' · 命中缓存' : ''}
        </p>
      )}
      {meta && <p className="text-xs text-black/40">模型：{meta.model}</p>}
      {output && (
        <button
          type="button"
          className={button}
          onClick={() => void navigator.clipboard?.writeText(output)}
        >
          复制结果
        </button>
      )}
    </div>
  );
}
