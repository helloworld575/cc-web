import { expect, test } from '@playwright/test';
import { E2E_ADMIN_PASSWORD, nextE2EIp } from './helpers';

test('admin routes redirect anonymous users and login rejects bad credentials', async ({ page }) => {
  await page.setExtraHTTPHeaders({ 'x-forwarded-for': nextE2EIp() });

  await page.goto('/admin/blog');
  await expect(page).toHaveURL(/\/login/);

  await page.goto('/admin/diary');
  await expect(page).toHaveURL(/\/login/);

  await page.getByTestId('login-password').fill('wrong-password');
  await page.getByTestId('login-submit').click();
  await expect(page).toHaveURL(/\/login/);
  await expect(page.locator('p.text-red-500')).toBeVisible();

  await page.getByTestId('login-password').fill(E2E_ADMIN_PASSWORD);
  await page.getByTestId('login-submit').click();
  await expect(page).toHaveURL(/\/admin\/blog/);
  await expect(page.getByRole('heading', { name: /blog/i })).toBeVisible();
});

test('mobile login submits the password and reaches admin', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.setExtraHTTPHeaders({ 'x-forwarded-for': nextE2EIp() });

  await page.goto('/login');
  await expect(page.getByTestId('login-password')).toBeInViewport();
  await page.getByTestId('login-password').fill(E2E_ADMIN_PASSWORD);
  await expect(page.getByTestId('login-submit')).toBeInViewport();
  await page.getByTestId('login-submit').click();

  await expect(page).toHaveURL(/\/admin\/blog/);
  await expect(page.getByTestId('admin-blog-new-title')).toBeVisible();
});
