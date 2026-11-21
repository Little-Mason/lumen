import { expect, test } from '@playwright/test';

const SEED_EMAIL = 'owner@lumen.local';
const SEED_PASSWORD = 'change-me-123';

async function login(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.getByLabel('邮箱').fill(SEED_EMAIL);
  await page.getByLabel('密码').fill(SEED_PASSWORD);
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

test('AI 工作台流式生成摘要，并写入调用记录', async ({ page }) => {
  await login(page);
  await page.goto('/dashboard/ai');

  await page
    .getByLabel('正文')
    .fill('# 摘要测试\n\n这是一段用来验证流式输出与记账的正文，提到 pgvector 和 RAG。');
  await page.getByRole('button', { name: '生成摘要' }).click();

  await expect(page.getByTestId('ai-result')).toContainText('流式输出与记账', {
    timeout: 20_000,
  });
  await expect(page.getByTestId('ai-result-meta')).toContainText('tokens');

  await page.getByRole('button', { name: '调用记录' }).click();
  await expect(page.getByText('SUCCESS').first()).toBeVisible();
});

test('写作台 AI 工具条把生成结果应用到编辑器字段', async ({ page }) => {
  await login(page);
  await page.goto('/dashboard/content/new');

  await page.getByLabel('标题').fill(`AI 编辑器 ${Date.now()}`);
  await page
    .getByLabel('正文（Markdown）')
    .fill('# 工具条\n\n这是 AI 工具条应用测试，用来验证结果回填。');
  await page.getByRole('button', { name: '摘要', exact: true }).click();

  const apply = page.getByRole('button', { name: '应用到编辑器' });
  await expect(apply).toBeEnabled({ timeout: 20_000 });
  await apply.click();
  await expect(page.getByLabel('摘要')).toHaveValue(/AI 工具条应用测试/);
});

test('知识库问答：发布后可检索并带出处，无片段时明确拒答', async ({ page }) => {
  await login(page);

  const title = `RAG 检索 ${Date.now()}`;
  await page.goto('/dashboard/content/new');
  await page.getByLabel('标题').fill(title);
  await page
    .getByLabel('正文（Markdown）')
    .fill(
      '# 向量检索\n\nLumen 使用 pgvector 的 HNSW 索引做余弦相似度检索，切片按标题与段落边界划分。',
    );
  await page.getByRole('button', { name: '发布', exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard\/content\//);

  await page.goto('/dashboard/ai');
  await page.getByRole('button', { name: '知识库问答' }).click();
  await page.getByLabel('向内容库提问').fill('pgvector 的 HNSW 索引如何检索？');
  await page.getByRole('button', { name: '提问' }).click();

  await expect(page.getByTestId('rag-citations')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId('ai-result')).toContainText('根据内容库记录');

  // 限定到一个没有切片的内容时，必须拒答而不是编造。
  const refusal = await page.request.post('/api/ai/ask', {
    data: {
      question: '完全无关的私人问题',
      contentId: 'definitely-no-such-content',
      stream: false,
    },
  });
  expect(refusal.status()).toBe(200);
  const body = (await refusal.json()) as { result: { text: string }; sources: unknown[] };
  expect(body.sources).toHaveLength(0);
  expect(body.result.text).toContain('内容库中没有相关记录');
});
