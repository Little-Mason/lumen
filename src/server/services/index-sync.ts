import { logger } from '@/lib/logger';
import { removeContentChunks, reindexContent } from '@/server/services/rag.service';

/**
 * 内容发布流程不能被 RAG 失败阻断：向量化失败只记日志，写作与发布照常成功。
 * 后台提供 /api/contents/:id/reindex 供手动补建索引。
 */
export async function safeReindex(contentId: string): Promise<number> {
  try {
    return await reindexContent(contentId);
  } catch (error) {
    logger.warn('content reindex failed', { contentId, error: String(error) });
    return 0;
  }
}

export async function safeRemoveIndex(contentId: string): Promise<void> {
  try {
    await removeContentChunks(contentId);
  } catch (error) {
    logger.warn('content index removal failed', { contentId, error: String(error) });
  }
}
