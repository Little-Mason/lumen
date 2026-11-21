import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/require-user';
import { aiFailure, apiError, readJson } from '@/lib/http';
import { ragAskSchema } from '@/lib/ai/validation';
import { runAiJob, streamAiJob } from '@/server/services/ai.service';
import { buildRagContext, retrieve } from '@/server/services/rag.service';
import type { AiServiceInput } from '@/lib/ai/types';

export const dynamic = 'force-dynamic';

/**
 * POST /api/ai/ask — 知识库问答：embed 问题 → HNSW 检索 → 带出处流式回答。
 * 检索片段由服务端组装，客户端无法伪造引用；无片段时模型必须明确拒答。
 */
export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const raw = await readJson(request);
    if (raw === null) return apiError(400, 'INVALID_INPUT', '请求体必须是合法 JSON');

    const input = ragAskSchema.parse(raw);
    const sources = await retrieve(input.question, { contentId: input.contentId });
    const serviceInput: AiServiceInput = {
      kind: 'RAG_ASK',
      body: input.question,
      extra: buildRagContext(sources),
      sources,
    };

    if (input.stream) {
      return await streamAiJob(user.sub, serviceInput, request.signal);
    }
    const result = await runAiJob(user.sub, serviceInput);
    return NextResponse.json({
      result,
      sources: sources.map((source) => ({
        contentId: source.contentId,
        chunkIndex: source.chunkIndex,
        title: source.title,
        slug: source.slug,
        similarity: Number(source.similarity.toFixed(4)),
      })),
    });
  } catch (error) {
    return aiFailure(error);
  }
}
