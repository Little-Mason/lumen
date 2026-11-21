import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/require-user';
import { contentFailure, searchParamsObject } from '@/lib/http';
import { calendarQuerySchema } from '@/lib/calendar/validation';
import { getCalendar } from '@/server/services/calendar.service';

export const dynamic = 'force-dynamic';

/** GET /api/calendar?month=YYYY-MM — 当前作者该月的发布节奏与编辑中内容。 */
export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const { month } = calendarQuerySchema.parse(
      searchParamsObject(new URL(request.url).searchParams),
    );
    return NextResponse.json(await getCalendar(user.sub, month));
  } catch (error) {
    return contentFailure(error);
  }
}
