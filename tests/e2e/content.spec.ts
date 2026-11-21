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

test('登录 → 写作 → 发布 → 匿名窗口可见且有正确 meta', async ({ page, browser }) => {
  const title = `W2 内容闭环 ${Date.now()}`;
  await login(page);

  await page.goto('/dashboard/content/new');
  await page.getByLabel('标题').fill(title);
  await page
    .getByLabel('正文（Markdown）')
    .fill('# 内容闭环\n\n这是一篇由 E2E 发布的 **Markdown** 文章，用来验证公开页与 meta 描述。');
  await page.getByLabel('标签').fill('Next.js, 测试');
  await page.getByRole('button', { name: '发布', exact: true }).click();

  await expect(page).toHaveURL(/\/dashboard\/content\//);
  const publicLink = page.getByRole('link', { name: '查看公开页' });
  await expect(publicLink).toBeVisible();
  const href = await publicLink.getAttribute('href');
  expect(href).toMatch(/^\/posts\//);

  // 用全新匿名 context，确保不携带登录 Cookie。
  const anonymous = await browser.newContext();
  const anonymousPage = await anonymous.newPage();
  await anonymousPage.goto(href as string);
  await expect(anonymousPage.getByRole('heading', { name: title })).toBeVisible();
  await expect(anonymousPage.locator('article')).toContainText('这是一篇由 E2E 发布的');

  const description = await anonymousPage
    .locator('meta[name="description"]')
    .getAttribute('content');
  expect(description).toBeTruthy();
  expect(description).not.toContain('把技术文章、小说连载与学习笔记统一管理');
  await anonymous.close();
});

test('内容 API 只暴露已发布内容，写接口要求登录', async ({ request }) => {
  const list = await request.get('/api/contents');
  expect(list.status()).toBe(200);
  const body = (await list.json()) as { items: { status: string }[] };
  expect(body.items.every((item) => item.status === 'PUBLISHED')).toBe(true);

  const created = await request.post('/api/contents', {
    data: { title: 'should be blocked', contentMd: 'x' },
  });
  expect(created.status()).toBe(401);
});
