import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/require-user';
import { aiFailure } from '@/lib/http';
import { getOwnedById } from '@/server/services/content.service';
import { reindexContent } from '@/server/services/rag.service';

export const dynamic = 'force-dynamic';

/** POST /api/contents/:id/reindex — 手动重建切片（索引失败后补偿用）。 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    await getOwnedById(id, user.sub);
    const chunks = await reindexContent(id);
    return NextResponse.json({ chunks, contentId: id });
  } catch (error) {
    return aiFailure(error);
  }
}
