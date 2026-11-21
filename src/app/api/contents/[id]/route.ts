import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/require-user';
import { apiError, contentFailure, readJson } from '@/lib/http';
import { archiveContent, getOwnedById, updateContent } from '@/server/services/content.service';
import { safeReindex, safeRemoveIndex } from '@/server/services/index-sync';

export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ id: string }> };

/** GET /api/contents/:id — 作者本人读取 Markdown 全文。 */
export async function GET(_request: Request, { params }: Context) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const content = await getOwnedById(id, user.sub);
    return NextResponse.json({ content });
  } catch (error) {
    return contentFailure(error);
  }
}

/** PATCH /api/contents/:id — 更新正文/标题/标签/状态。 */
export async function PATCH(request: Request, { params }: Context) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const body = await readJson(request);
    if (body === null) return apiError(400, 'INVALID_INPUT', '请求体必须是合法 JSON');

    const content = await updateContent(id, body, user.sub);
    const touchesBody =
      typeof body === 'object' &&
      body !== null &&
      Object.prototype.hasOwnProperty.call(body, 'contentMd');
    if (content.status === 'PUBLISHED' && touchesBody) {
      await safeReindex(content.id);
    }
    return NextResponse.json({ content });
  } catch (error) {
    return contentFailure(error);
  }
}

/** DELETE /api/contents/:id — 软归档，不物理删除。 */
export async function DELETE(_request: Request, { params }: Context) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const content = await archiveContent(id, user.sub);
    await safeRemoveIndex(content.id);
    return NextResponse.json({ content });
  } catch (error) {
    return contentFailure(error);
  }
}
