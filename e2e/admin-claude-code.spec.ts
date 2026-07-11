import { expect, test } from './fixtures';
import { login } from './helpers';

test('admin Claude Code page exposes the worker prompt UI', async ({ page }) => {
  await login(page);
  await page.goto('/admin/claude-code');

  await expect(page.getByRole('heading', { name: 'Personal Assistant' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Send to assistant' })).toBeVisible();
  await expect(page.getByText('Raw NDJSON')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Personal Assistant' })).toBeVisible();
});
