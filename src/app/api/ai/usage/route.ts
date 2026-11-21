import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/require-user';
import { aiFailure, searchParamsObject } from '@/lib/http';
import { usageQuerySchema } from '@/lib/usage/validation';
import { getUsageSummary } from '@/server/services/usage.service';

export const dynamic = 'force-dynamic';

/** GET /api/ai/usage — 当前用户的调用量、成本、失败率与 P95，供看板/告警复用。 */
export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const { days } = usageQuerySchema.parse(searchParamsObject(new URL(request.url).searchParams));
    return NextResponse.json(await getUsageSummary(user.sub, days));
  } catch (error) {
    return aiFailure(error);
  }
}
