import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/require-user';
import { aiFailure, searchParamsObject } from '@/lib/http';
import { aiJobsQuerySchema } from '@/lib/ai/validation';
import { listAiJobs } from '@/server/services/ai.service';

export const dynamic = 'force-dynamic';

/** GET /api/ai/jobs — 当前用户的 AI 调用流水，供看板与告警使用。 */
export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const query = aiJobsQuerySchema.parse(searchParamsObject(new URL(request.url).searchParams));
    return NextResponse.json(await listAiJobs(user.sub, query));
  } catch (error) {
    return aiFailure(error);
  }
}
