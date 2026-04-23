import { expect, test } from '@playwright/test';
import { login } from './helpers';

test('admin skills finder resolves grouped skill metadata', async ({ page }) => {
  await login(page);
  await page.goto('/admin/skills');

  await expect(page.getByText('Hierarchical skills')).toBeVisible();
  await page.getByTestId('admin-skills-search').fill('article faq');
  await expect(page.getByText('article-faq')).toBeVisible();
  await expect(page.getByText('content / article / faq')).toBeVisible();
});
