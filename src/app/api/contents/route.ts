import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/require-user';
import { apiError, contentFailure, readJson, searchParamsObject } from '@/lib/http';
import { listQuerySchema } from '@/lib/content/validation';
import { createContent, listPublished } from '@/server/services/content.service';

export const dynamic = 'force-dynamic';

/** GET /api/contents — 公开，只返回已发布内容。 */
export async function GET(request: Request) {
  try {
    const query = listQuerySchema.parse(searchParamsObject(new URL(request.url).searchParams));
    const result = await listPublished(query);
    return NextResponse.json(result);
  } catch (error) {
    return contentFailure(error);
  }
}

/** POST /api/contents — 登录用户建草稿。 */
export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await readJson(request);
    if (body === null) return apiError(400, 'INVALID_INPUT', '请求体必须是合法 JSON');

    const content = await createContent(body, user.sub);
    return NextResponse.json({ content }, { status: 201 });
  } catch (error) {
    return contentFailure(error);
  }
}
