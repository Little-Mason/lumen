import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ContentEditor } from '@/components/content-editor';
import { readSession } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';
export const metadata = { title: '新建内容' };

export default async function NewContentPage() {
  const session = await readSession();
  if (!session) redirect('/login?next=/dashboard/content/new');

  return (
    <div>
      <Link href="/dashboard/content" className="text-sm text-black/50 hover:text-black/80">
        ← 返回内容列表
      </Link>
      <h1 className="mb-6 mt-4 text-3xl font-semibold tracking-tight">新建内容</h1>
      <ContentEditor mode="create" />
    </div>
  );
}
