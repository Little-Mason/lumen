import { expect, test } from '@playwright/test';

test('首页可访问且展示核心模块', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '一处写作，三处生长' })).toBeVisible();
  await expect(page.getByText('AI 能力与 RAG')).toBeVisible();
});

test('工作台占位页可访问', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page.getByRole('heading', { name: '工作台' })).toBeVisible();
});
