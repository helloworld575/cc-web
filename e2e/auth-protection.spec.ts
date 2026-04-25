import { expect, test } from '@playwright/test';
import { E2E_ADMIN_PASSWORD, nextE2EIp } from './helpers';

test('admin routes redirect anonymous users and login rejects bad credentials', async ({ page }) => {
  await page.setExtraHTTPHeaders({ 'x-forwarded-for': nextE2EIp() });

  await page.goto('/admin/blog');
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
