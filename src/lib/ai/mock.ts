import { createHash } from 'node:crypto';
import type { AiJobKind } from '@/types';
import type { RagSource } from '@/lib/ai/types';

/**
 * 确定性 mock provider：无密钥、无网络、无 token 消耗。
 * 输出只由入参决定，因此 CI 的 E2E 可以稳定断言，换真模型时业务代码不改。
 */

const CJK = /[\u3400-\u9fff]/;

/** 中文按字 + 相邻二元组，英文按词，保证相近文本有相近向量。 */
export function tokenize(text: string): string[] {
  const pieces = text.toLowerCase().match(/[a-z0-9]+|[\u3400-\u9fff]/g) ?? [];
  const tokens = [...pieces];
  for (let i = 0; i < pieces.length - 1; i += 1) {
    const a = pieces[i] ?? '';
    const b = pieces[i + 1] ?? '';
    if (CJK.test(a) && CJK.test(b)) tokens.push(a + b);
  }
  return tokens;
}

/** 哈希词袋 + L2 归一化，维度固定为数据库 vector 列的长度。 */
export function mockEmbedding(text: string, dim = 1536): number[] {
  const vector = new Array<number>(dim).fill(0);
  for (const token of tokenize(text)) {
    const digest = createHash('sha1').update(token).digest();
    const index = digest.readUInt16BE(0) % dim;
    const sign = (digest[2] ?? 0) & 1 ? 1 : -1;
    vector[index] = (vector[index] ?? 0) + sign;
  }
  const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0)) || 1;
  return vector.map((v) => Number((v / norm).toFixed(6)));
}

/** mock 口径的 token 估算，仅用于 AiJob 记账与成本展示。 */
export function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 3));
}

function stripMarkdown(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_`~|-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const TAG_POOL = [
  'Next.js',
  'PostgreSQL',
  'pgvector',
  'RAG',
  'Docker',
  'AI',
  '架构',
  '雅思',
  '小说',
  '写作',
];

export type MockContext = {
  title: string;
  body: string;
  extra?: string;
  sources?: RagSource[];
};

/**
 * 正文里夹带的指令永远不会进入输出：所有模板只用白名单标签与标题/片段，
 * 不把 body 当作指令解析。提示注入用例据此断言「HACKED 不出现」。
 */
export function mockCompletion(kind: AiJobKind, ctx: MockContext): string {
  const plain = stripMarkdown(ctx.body);
  const title = stripMarkdown(ctx.title) || '未命名内容';

  switch (kind) {
    case 'OUTLINE':
      return [
        `1. 引言：交代《${title}》的背景与要解决的问题`,
        '2. 现状：梳理当前做法与主要痛点',
        '3. 方案：给出可落地的核心设计与取舍',
        '4. 实现：按步骤说明关键代码与配置',
        '5. 验证：列出验收标准与可观测指标',
        '6. 小结：回顾结论与后续计划',
      ].join('\n');
    case 'TITLE':
      return [
        `1. ${title}：从 0 到 1 的完整实践`,
        `2. 我如何重新设计《${title}》`,
        `3. ${title} 的五个关键决策`,
        `4. 写给初学者的 ${title} 指南`,
        `5. 一次关于 ${title} 的复盘`,
      ].join('\n');
    case 'TAGS': {
      const hits = TAG_POOL.filter((tag) => ctx.body.toLowerCase().includes(tag.toLowerCase()));
      // 契约要求 3–5 个：命中的白名单词优先，不足时补中性标签，最多 5 个。
      const tags = [...hits, '内容中枢', '随笔', '笔记'].slice(
        0,
        Math.max(3, Math.min(5, hits.length)),
      );
      return tags.join(', ');
    }
    case 'SUMMARIZE': {
      const summary = (plain || title).slice(0, 120);
      return /[。！？.!?]$/.test(summary) ? summary : `${summary}。`;
    }
    case 'POLISH': {
      const normalized = ctx.body
        .replace(/\r\n/g, '\n')
        .replace(/[ \t]+$/gm, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
      return normalized || plain;
    }
    case 'RAG_ASK': {
      const sources = ctx.sources ?? [];
      if (sources.length === 0) return '内容库中没有相关记录。';
      const citations = sources
        .map((s, i) => `[${i + 1}] ${s.title}（/posts/${s.slug}#chunk-${s.chunkIndex}）`)
        .join('；');
      const first = stripMarkdown(sources[0]?.text ?? '').slice(0, 160);
      const question = plain.slice(0, 60);
      return `根据内容库记录，关于「${question}」可以确认：${first}\n\n来源：${citations}`;
    }
    default:
      return plain.slice(0, 200);
  }
}
