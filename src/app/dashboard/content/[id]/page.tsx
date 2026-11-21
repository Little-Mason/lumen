import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ContentEditor } from '@/components/content-editor';
import { readSession } from '@/lib/auth/session';
import { getOwnedById } from '@/server/services/content.service';

export const dynamic = 'force-dynamic';
export const metadata = { title: '编辑内容' };

export default async function EditContentPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await readSession();
  if (!session) redirect('/login?next=/dashboard/content');

  const { id } = await params;
  let content;
  try {
    content = await getOwnedById(id, session.sub);
  } catch {
    notFound();
  }

  return (
    <div>
      <Link href="/dashboard/content" className="text-sm text-black/50 hover:text-black/80">
        ← 返回内容列表
      </Link>
      <h1 className="mb-6 mt-4 text-3xl font-semibold tracking-tight">编辑内容</h1>
      <ContentEditor mode="edit" initial={content} />
    </div>
  );
}
