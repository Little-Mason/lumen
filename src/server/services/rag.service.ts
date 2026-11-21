import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { env } from '@/lib/env';
import { chunkMarkdown } from '@/lib/ai/chunk';
import { embedTexts } from '@/lib/ai/provider';
import { AiError } from '@/lib/ai/errors';
import type { RagSource } from '@/lib/ai/types';

/** 向量列是 Prisma Unsupported，写入与检索一律走参数化 raw SQL。 */

type ChunkRow = {
  contentId: string;
  chunkIndex: number;
  text: string;
  title: string;
  slug: string;
  similarity: number;
};

function vectorLiteral(vector: number[]): string {
  return `[${vector.join(',')}]`;
}

export async function removeContentChunks(contentId: string): Promise<void> {
  await db.contentChunk.deleteMany({ where: { contentId } });
}

/**
 * 发布或正文更新后重建切片：先删旧切片，再批量 embedding 并写入。
 * 只索引已发布内容，草稿/归档不会出现在知识库里。
 */
export async function reindexContent(contentId: string): Promise<number> {
  const content = await db.content.findUnique({
    where: { id: contentId },
    select: { title: true, contentMd: true, status: true },
  });
  if (!content) throw new AiError('NOT_FOUND', '内容不存在');

  await removeContentChunks(contentId);
  if (content.status !== 'PUBLISHED') return 0;

  const chunks = chunkMarkdown(`# ${content.title}\n\n${content.contentMd}`, {
    size: env.CHUNK_SIZE,
    overlap: env.CHUNK_OVERLAP,
  });
  if (chunks.length === 0) return 0;

  const vectors = await embedTexts(chunks.map((chunk) => chunk.text));
  if (vectors.length !== chunks.length) {
    throw new AiError('INDEX_FAILED', 'embedding 数量与切片数量不一致');
  }

  for (let index = 0; index < chunks.length; index += 1) {
    const chunk = chunks[index];
    const vector = vectors[index];
    if (!chunk || !vector) continue;
    const literal = vectorLiteral(vector);
    await db.$executeRaw`
      INSERT INTO "ContentChunk"
        ("id", "contentId", "chunkIndex", "text", "embedding", "tokenCount", "createdAt")
      VALUES
        (${randomUUID()}, ${contentId}, ${chunk.chunkIndex}, ${chunk.text},
         ${literal}::vector, ${chunk.tokenCount}, NOW())
    `;
  }
  return chunks.length;
}

/** HNSW + 余弦距离检索，只返回已发布内容的片段。 */
export async function retrieve(
  question: string,
  options: { topK?: number; contentId?: string } = {},
): Promise<RagSource[]> {
  const [queryVector] = await embedTexts([question]);
  if (!queryVector) return [];
  const literal = vectorLiteral(queryVector);
  const topK = options.topK ?? env.RAG_TOP_K;
  const scope = options.contentId ? Prisma.sql`AND p."id" = ${options.contentId}` : Prisma.empty;

  const rows = await db.$queryRaw<ChunkRow[]>(Prisma.sql`
    SELECT c."contentId"::text AS "contentId",
           c."chunkIndex" AS "chunkIndex",
           c."text"::text AS "text",
           p."title"::text AS "title",
           p."slug"::text AS "slug",
           (1 - (c."embedding" <=> ${literal}::vector))::float8 AS "similarity"
    FROM "ContentChunk" c
    JOIN "Content" p ON p."id" = c."contentId"
    WHERE c."embedding" IS NOT NULL
      AND p."status" = 'PUBLISHED'
      ${scope}
    ORDER BY c."embedding" <=> ${literal}::vector
    LIMIT ${topK}
  `);

  return rows.map((row) => ({
    contentId: row.contentId,
    chunkIndex: Number(row.chunkIndex),
    text: row.text,
    title: row.title,
    slug: row.slug,
    similarity: Number(row.similarity),
  }));
}

/** 片段包裹在明确分隔符里，并去掉控制字符；正文中的指令一律当数据。 */
export function buildRagContext(sources: RagSource[]): string {
  if (sources.length === 0) return '（无检索片段）';
  return sources
    .map((source, index) => {
      const text = source.text.replace(/[\u0000-\u001f]/g, ' ').slice(0, 1200);
      return `【片段 ${index + 1}｜来源：${source.title} /posts/${source.slug}#chunk-${source.chunkIndex}｜相似度 ${source.similarity.toFixed(3)}】\n${text}`;
    })
    .join('\n\n');
}
