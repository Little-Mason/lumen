import { expect, test } from '@playwright/test';

const SEED_EMAIL = 'owner@lumen.local';
const SEED_PASSWORD = 'change-me-123';
// 与 .env / ci.yml 的 AUTH_INVITE_CODE 保持一致；可用环境变量覆盖。
const INVITE_CODE = process.env.AUTH_INVITE_CODE ?? 'lumen-dev-invite';

test('首页可访问且展示核心模块', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '一处写作，三处生长' })).toBeVisible();
  await expect(page.getByText('AI 能力与 RAG')).toBeVisible();
});

test('未登录访问工作台会被送到登录页', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login\?next=/);
  await expect(page.getByRole('heading', { name: '登录 Lumen' })).toBeVisible();
});

test('种子账号登录后可以进入工作台', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('邮箱').fill(SEED_EMAIL);
  await page.getByLabel('密码').fill(SEED_PASSWORD);
  await page.getByRole('button', { name: '登录', exact: true }).click();

  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByRole('heading', { name: '工作台' })).toBeVisible();
  await expect(page.getByText(`当前登录：${SEED_EMAIL}`)).toBeVisible();
});

test('注册 → 退出 → 再次被拦截', async ({ page }) => {
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;

  await page.goto('/login');
  await page.getByRole('button', { name: '还没有账号？去注册' }).click();
  await page.getByLabel('邮箱').fill(email);
  await page.getByLabel('密码').fill('e2e-password-123');
  await page.getByLabel('邀请码').fill(INVITE_CODE);
  await page.getByRole('button', { name: '创建账号' }).click();

  await expect(page).toHaveURL(/\/dashboard/);
  await page.getByRole('button', { name: '退出' }).click();
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login\?next=/);
});
