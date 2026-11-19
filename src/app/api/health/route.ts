import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

/** 供 CI 冒烟、容器健康检查、部署后验证使用。不暴露任何敏感信息。 */
export async function GET() {
  const started = Date.now();
  try {
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json({
      status: 'ok',
      db: 'up',
      version: process.env.npm_package_version ?? '0.1.0',
      latencyMs: Date.now() - started,
    });
  } catch {
    return NextResponse.json(
      { status: 'degraded', db: 'down', latencyMs: Date.now() - started },
      { status: 503 },
    );
  }
}
