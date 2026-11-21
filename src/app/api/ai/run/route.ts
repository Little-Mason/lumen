import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/require-user';
import { aiFailure, apiError, readJson } from '@/lib/http';
import { runAiSchema } from '@/lib/ai/validation';
import { runAiJob, streamAiJob } from '@/server/services/ai.service';

export const dynamic = 'force-dynamic';

/**
 * POST /api/ai/run — 五种写作能力。
 * stream:false 返回 JSON；stream:true 返回 SSE（meta → delta* → done | error）。
 */
export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const raw = await readJson(request);
    if (raw === null) return apiError(400, 'INVALID_INPUT', '请求体必须是合法 JSON');

    const input = runAiSchema.parse(raw);
    if (input.stream) {
      return await streamAiJob(user.sub, input, request.signal);
    }
    const result = await runAiJob(user.sub, input);
    return NextResponse.json({ result });
  } catch (error) {
    return aiFailure(error);
  }
}
