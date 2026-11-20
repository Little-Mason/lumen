-- 首次迁移后执行：npx prisma db execute --file prisma/sql/001_pgvector.sql --schema prisma/schema.prisma
-- 不要用 psql "$DATABASE_URL"：连接串里的 ?schema=public 是 Prisma 专用参数，psql 会报 invalid URI query parameter。
-- Prisma 的 Unsupported("vector(1536)") 只会建出列，索引与扩展需手工补。

CREATE EXTENSION IF NOT EXISTS vector;

-- 若 EMBEDDING_DIM 不是 1536，同步修改 schema.prisma 与本文件中的维度。
-- HNSW 适合小到中等规模（<10 万切片），无需训练、召回稳定。
CREATE INDEX IF NOT EXISTS content_chunk_embedding_hnsw
  ON "ContentChunk"
  USING hnsw (embedding vector_cosine_ops)
  WHERE embedding IS NOT NULL;

-- 检索示例（参数化，$1 为查询向量，$2 为 topK）：
-- SELECT "contentId", "chunkIndex", text,
--        1 - (embedding <=> $1::vector) AS similarity
-- FROM "ContentChunk"
-- WHERE embedding IS NOT NULL
-- ORDER BY embedding <=> $1::vector
-- LIMIT $2;
