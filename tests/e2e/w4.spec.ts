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

test('用量看板读取真实 AiJob 聚合，且可切换时间范围', async ({ page }) => {
  await login(page);
  await page.goto('/dashboard/usage');

  await expect(page.getByRole('heading', { name: '用量与成本' })).toBeVisible();
  await expect(page.getByTestId('usage-total-calls')).toBeVisible();
  await expect(page.getByTestId('usage-failure-rate')).toBeVisible();
  await expect(page.getByTestId('usage-budget')).toBeVisible();
  await expect(page.getByTestId('usage-series').locator(':scope > div')).not.toHaveCount(0);
  await expect(page.getByTestId('usage-daily-table').locator('tbody tr')).toHaveCount(7);

  await page.getByRole('link', { name: '7 天' }).click();
  await expect(page).toHaveURL(/days=7/);
  await expect(page.getByTestId('usage-total-calls')).toBeVisible();

  const response = await page.request.get('/api/ai/usage?days=7');
  expect(response.status()).toBe(200);
  const body = (await response.json()) as {
    days: number;
    provider: string;
    totals: { series: unknown[] };
    budget: { limitCents: number };
  };
  expect(body.days).toBe(7);
  expect(body.totals.series).toHaveLength(7);
  expect(body.budget.limitCents).toBeGreaterThan(0);
});

test('发布日历是月视图，可翻页且条目来自真实发布时间', async ({ page }) => {
  await login(page);
  await page.goto('/dashboard/calendar');

  await expect(page.getByRole('heading', { name: '发布日历' })).toBeVisible();
  const before = await page.getByTestId('calendar-month').textContent();
  expect(before).toMatch(/\d{4} 年 \d{1,2} 月/);
  const cellCount = await page.getByTestId('calendar-grid').locator(':scope > div').count();
  expect(cellCount === 35 || cellCount === 42).toBe(true);
  await expect(page.getByTestId('calendar-published-count')).toBeVisible();

  await page.getByRole('link', { name: '← 上月' }).click();
  await expect(page).toHaveURL(/month=\d{4}-\d{2}/);
  expect(await page.getByTestId('calendar-month').textContent()).not.toBe(before);

  const response = await page.request.get('/api/calendar');
  expect(response.status()).toBe(200);
  const body = (await response.json()) as { month: string; cells: unknown[]; items: unknown[] };
  expect(body.month).toMatch(/^\d{4}-\d{2}$/);
  expect(body.cells.length).toBeGreaterThanOrEqual(35);
});

test('看板接口与页面都要求登录', async ({ request, page }) => {
  expect((await request.get('/api/ai/usage')).status()).toBe(401);
  expect((await request.get('/api/calendar')).status()).toBe(401);

  await page.goto('/dashboard/usage');
  await expect(page).toHaveURL(/\/login\?next=/);
  await page.goto('/dashboard/calendar');
  await expect(page).toHaveURL(/\/login\?next=/);
});
