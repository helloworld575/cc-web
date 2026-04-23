import { expect, test } from '@playwright/test';
import { login } from './helpers';

test('public navigation and blog publishing flow work end to end', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'ThomasLee' })).toBeVisible();
  await page.getByRole('main').getByRole('link', { name: 'Blog' }).click();
  await expect(page).toHaveURL(/\/blog/);
  await expect(page.getByText('Seeded Hello')).toBeVisible();

  await login(page);

  const title = `E2E Post ${Date.now()}`;
  await page.getByTestId('admin-blog-new-title').fill(title);
  await page.getByTestId('admin-blog-create').click();
  await expect(page).toHaveURL(/\/admin\/blog\/.+/);
  await page.waitForLoadState('networkidle');

  await page.getByTestId('admin-blog-editor-title').fill(title);
  await page.getByTestId('admin-blog-editor-date').fill('2026-04-23');
  await page.getByTestId('admin-blog-editor-brief').fill('Brief generated during Playwright e2e.');
  await page.getByTestId('admin-blog-editor-content').last().fill('# E2E Content\n\nThis markdown was saved during the browser flow.');
  await page.getByTestId('admin-blog-save').click();
  await expect(page.getByTestId('admin-blog-saved')).toBeVisible();

  await page.goto('/blog');
  await expect(page.getByText(title)).toBeVisible();
  await page.getByText(title).click();
  await expect(page.getByText('This markdown was saved during the browser flow.')).toBeVisible();
});
