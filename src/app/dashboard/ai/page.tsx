import { redirect } from 'next/navigation';
import { AiWorkbench } from '@/components/ai-workbench';
import { readSession } from '@/lib/auth/session';
import { env } from '@/lib/env';
import { listWritableContents } from '@/server/services/content.service';
import { listAiJobs } from '@/server/services/ai.service';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'AI 辅助' };

export default async function AiPage() {
  const session = await readSession();
  if (!session) redirect('/login?next=/dashboard/ai');

  const [contents, jobs] = await Promise.all([
    listWritableContents(session.sub),
    listAiJobs(session.sub, { page: 1, pageSize: 20 }),
  ]);

  const providerLabel =
    env.AI_PROVIDER === 'mock'
      ? 'Mock provider · 零 token 消耗'
      : `${env.AI_MODEL} + ${env.EMBEDDING_MODEL}`;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight">AI 辅助</h1>
        <p className="mt-1 text-sm text-black/55">
          写作能力、知识库问答与调用记账。发布内容时自动切片并写入向量索引，问答只引用库内片段。
        </p>
      </div>
      <AiWorkbench contents={contents} initialJobs={jobs.items} providerLabel={providerLabel} />
      <p className="mt-5 text-xs text-black/40">
        未配置密钥时默认走确定性 mock provider，可完整演示流式输出、限流、预算与记账；在
        <code className="mx-1 rounded bg-black/[0.04] px-1">.env</code>
        填入密钥并把 <code className="mx-1 rounded bg-black/[0.04] px-1">AI_PROVIDER</code> 改为
        <code className="ml-1 rounded bg-black/[0.04] px-1">openai-compatible</code>
        即可切换真实模型。
      </p>
    </div>
  );
}
