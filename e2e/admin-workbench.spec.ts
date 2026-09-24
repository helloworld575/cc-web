import { expect, test } from './fixtures';
import { login } from './helpers';

test('admin workbench shows task and agent summaries and keeps tool tabs deep-linkable', async ({ page }) => {
  await login(page);
  await page.goto('/admin');

  await expect(page.getByRole('heading', { name: 'My workbench' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Agents' })).toBeVisible();

  await page.goto('/tools?tab=skills');
  await expect(page.getByTestId('tools-tab-skills')).toHaveClass(/bg-slate-900/);
  await page.reload();
  await expect(page.getByTestId('tools-tab-skills')).toHaveClass(/bg-slate-900/);
});
