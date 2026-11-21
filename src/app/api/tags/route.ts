import { NextResponse } from 'next/server';
import { contentFailure } from '@/lib/http';
import { listTags } from '@/server/services/content.service';

export const dynamic = 'force-dynamic';

/** GET /api/tags — 公开，标签及已发布内容计数。 */
export async function GET() {
  try {
    const items = await listTags();
    return NextResponse.json({ items });
  } catch (error) {
    return contentFailure(error);
  }
}
