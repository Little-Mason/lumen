'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { AiAssistBar, type AssistKind } from '@/components/ai-assist';
import { StatusBadge } from '@/components/status-badge';
import { countWords } from '@/lib/utils/slug';
import type { ContentDetailDTO, ContentStatus, ContentType } from '@/types';

const field =
  'w-full rounded-lg border border-black/15 bg-white px-3 py-2 text-sm outline-none focus:border-black/50';

type ApiResult = { content?: ContentDetailDTO; error?: { message?: string } };

async function callApi(url: string, method: string, body?: unknown): Promise<ContentDetailDTO> {
  const response = await fetch(url, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = (await response.json()) as ApiResult;
  if (!response.ok || !data.content) {
    throw new Error(data.error?.message ?? '操作失败，请稍后重试');
  }
  return data.content;
}

export function ContentEditor({
  mode,
  initial,
}: {
  mode: 'create' | 'edit';
  initial?: ContentDetailDTO;
}) {
  const router = useRouter();
  const [id, setId] = useState(initial?.id ?? '');
  const [title, setTitle] = useState(initial?.title ?? '');
  const [type, setType] = useState<ContentType>(initial?.type ?? 'ARTICLE');
  const [contentMd, setContentMd] = useState(initial?.contentMd ?? '');
  const [excerpt, setExcerpt] = useState(initial?.excerpt ?? '');
  const [tags, setTags] = useState((initial?.tags ?? []).join(', '));
  const [status, setStatus] = useState<ContentStatus>(initial?.status ?? 'DRAFT');
  const [slug, setSlug] = useState(initial?.slug ?? '');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const { words, minutes } = countWords(contentMd);

  async function handleAction(action: 'save' | 'publish' | 'unpublish' | 'archive') {
    if (pending) return;
    if ((action === 'save' || action === 'publish') && (!title.trim() || !contentMd.trim())) {
      setError('标题与正文不能为空');
      return;
    }

    setPending(true);
    setError(null);
    setNotice(null);

    try {
      let content: ContentDetailDTO;

      if (action === 'unpublish') {
        content = await callApi(`/api/contents/${id}/unpublish`, 'POST');
      } else if (action === 'archive') {
        const response = await fetch(`/api/contents/${id}`, { method: 'DELETE' });
        const data = (await response.json()) as ApiResult;
        if (!response.ok || !data.content) {
          throw new Error(data.error?.message ?? '归档失败');
        }
        content = data.content;
      } else {
        const body = { title, contentMd, type, excerpt, tags };
        content = id
          ? await callApi(`/api/contents/${id}`, 'PATCH', body)
          : await callApi('/api/contents', 'POST', body);
        if (action === 'publish' && content.status !== 'PUBLISHED') {
          content = await callApi(`/api/contents/${content.id}/publish`, 'POST');
        }
      }

      setId(content.id);
      setTitle(content.title);
      setContentMd(content.contentMd);
      setExcerpt(content.excerpt ?? '');
      setTags(content.tags.join(', '));
      setStatus(content.status);
      setSlug(content.slug);

      if (mode === 'create' && content.id) {
        // 只改地址栏，不触发 App Router 导航：保留刚提交成功的状态与提示，
        // 之后保存会走 PATCH（因为有 id），刷新页面则命中 /dashboard/content/:id。
        window.history.replaceState(null, '', `/dashboard/content/${content.id}`);
      }
      router.refresh();
      setNotice(
        action === 'publish'
          ? '已发布，公开页面现在可以访问。'
          : action === 'unpublish'
            ? '已下线为草稿。'
            : action === 'archive'
              ? '已归档。'
              : '已保存。',
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '网络错误，请稍后重试');
    } finally {
      setPending(false);
    }
  }

  function applyAi(kind: AssistKind, text: string) {
    switch (kind) {
      case 'POLISH':
        setContentMd(text);
        break;
      case 'SUMMARIZE':
        setExcerpt(text);
        break;
      case 'TAGS':
        setTags(text);
        break;
      case 'OUTLINE':
        setContentMd((previous) => `${previous.trim()}\n\n${text}`.trim());
        break;
      case 'TITLE': {
        const first = text.split('\n')[0]?.replace(/^\s*\d+[.、]\s*/, '') ?? text;
        setTitle(first);
        break;
      }
    }
    setError(null);
    setNotice('AI 结果已应用到编辑器，记得保存。');
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <StatusBadge status={status} />
        <span className="text-xs text-black/45">
          {words} 字 · 约 {minutes} 分钟
        </span>
        {slug && <span className="font-mono text-xs text-black/40">/{slug}</span>}
        {status === 'PUBLISHED' && (
          <Link href={`/posts/${slug}`} className="text-xs text-accent hover:underline">
            查看公开页
          </Link>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-[1fr_180px]">
        <div>
          <label htmlFor="title" className="mb-1 block text-sm font-medium">
            标题
          </label>
          <input
            id="title"
            className={field}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="给这篇内容起个名字"
          />
        </div>
        <div>
          <label htmlFor="type" className="mb-1 block text-sm font-medium">
            类型
          </label>
          <select
            id="type"
            className={field}
            value={type}
            onChange={(event) => setType(event.target.value as ContentType)}
          >
            <option value="ARTICLE">文章</option>
            <option value="CHAPTER">章节</option>
            <option value="NOTE">笔记</option>
          </select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="tags" className="mb-1 block text-sm font-medium">
            标签
          </label>
          <input
            id="tags"
            className={field}
            value={tags}
            onChange={(event) => setTags(event.target.value)}
            placeholder="Next.js, 架构, 随笔"
          />
          <p className="mt-1 text-xs text-black/45">用逗号分隔，最多 8 个。</p>
        </div>
        <div>
          <label htmlFor="excerpt" className="mb-1 block text-sm font-medium">
            摘要
          </label>
          <input
            id="excerpt"
            className={field}
            value={excerpt}
            onChange={(event) => setExcerpt(event.target.value)}
            placeholder="留空则自动从正文提取"
          />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <label htmlFor="contentMd" className="mb-1 block text-sm font-medium">
            正文（Markdown）
          </label>
          <textarea
            id="contentMd"
            className={`${field} h-96 resize-y font-mono leading-6`}
            value={contentMd}
            onChange={(event) => setContentMd(event.target.value)}
            placeholder={'# 标题\n\n开始写作…'}
          />
        </div>
        <div>
          <p className="mb-1 text-sm font-medium">实时预览</p>
          <div className="prose-lumen h-96 overflow-y-auto rounded-lg border border-black/10 bg-white px-4 py-3">
            {contentMd.trim() ? (
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{contentMd}</ReactMarkdown>
            ) : (
              <p className="text-sm text-black/40">左侧输入 Markdown，这里会实时渲染。</p>
            )}
          </div>
        </div>
      </div>

      <AiAssistBar body={contentMd} contentId={id || undefined} onApply={applyAi} />

      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          {notice}
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={pending}
          onClick={() => handleAction('save')}
          className="rounded-lg border border-black/15 bg-white px-4 py-2 text-sm font-medium hover:border-black/40 disabled:opacity-60"
        >
          {status === 'PUBLISHED' ? '保存更新' : '保存草稿'}
        </button>
        {status !== 'PUBLISHED' && (
          <button
            type="button"
            disabled={pending}
            onClick={() => handleAction('publish')}
            className="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            发布
          </button>
        )}
        {id && status === 'PUBLISHED' && (
          <button
            type="button"
            disabled={pending}
            onClick={() => handleAction('unpublish')}
            className="rounded-lg border border-black/15 bg-white px-4 py-2 text-sm hover:border-black/40 disabled:opacity-60"
          >
            下线
          </button>
        )}
        {id && status !== 'ARCHIVED' && (
          <button
            type="button"
            disabled={pending}
            onClick={() => handleAction('archive')}
            className="rounded-lg px-4 py-2 text-sm text-black/45 hover:text-red-700 disabled:opacity-60"
          >
            归档
          </button>
        )}
        <Link
          href="/dashboard/content"
          className="rounded-lg px-4 py-2 text-sm text-black/55 hover:text-black/80"
        >
          返回列表
        </Link>
      </div>
    </div>
  );
}
