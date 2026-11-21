import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/require-user';
import { contentFailure } from '@/lib/http';
import { publishContent } from '@/server/services/content.service';
import { safeReindex } from '@/server/services/index-sync';

export const dynamic = 'force-dynamic';

/** POST /api/contents/:id/publish — 发布，写入 publishedAt。 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const content = await publishContent(id, user.sub);
    await safeReindex(content.id);
    return NextResponse.json({ content });
  } catch (error) {
    return contentFailure(error);
  }
}
