import { expect, test } from '@playwright/test';
import { login } from './helpers';

test('admin Claude Code page exposes the worker prompt UI', async ({ page }) => {
  await login(page);
  await page.goto('/admin/claude-code');

  await expect(page.getByRole('heading', { name: 'Claude Code Worker' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Run Claude Code' })).toBeVisible();
  await expect(page.getByText('Raw NDJSON')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Claude Code' })).toBeVisible();
});
