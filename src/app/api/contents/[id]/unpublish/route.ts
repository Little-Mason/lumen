import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/require-user';
import { contentFailure } from '@/lib/http';
import { unpublishContent } from '@/server/services/content.service';
import { safeRemoveIndex } from '@/server/services/index-sync';

export const dynamic = 'force-dynamic';

/** POST /api/contents/:id/unpublish — 下线回草稿，保留 publishedAt 历史。 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const content = await unpublishContent(id, user.sub);
    await safeRemoveIndex(content.id);
    return NextResponse.json({ content });
  } catch (error) {
    return contentFailure(error);
  }
}
