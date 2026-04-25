import { expect, test } from '@playwright/test';
import { login } from './helpers';

test('admin todos can be created, filtered, completed, and deleted', async ({ page }) => {
  await login(page);
  await page.goto('/admin/tools');

  const todoText = `E2E todo ${Date.now()}`;
  await page.getByPlaceholder('New todo').fill(todoText);
  await page.locator('input[type="date"]').first().fill('2026-05-02');
  await page.getByRole('button', { name: 'Add' }).click();

  const todoItem = page.locator('li').filter({ hasText: todoText });
  await expect(todoItem).toBeVisible();
  await expect(todoItem.locator('input[type="date"]')).toHaveValue('2026-05-02');

  await page.getByPlaceholder('Search...').fill(todoText);
  await expect(todoItem).toBeVisible();
  await expect(page.getByText('Seeded todo from e2e runtime')).not.toBeVisible();

  await todoItem.locator('input[type="checkbox"]').click();
  await expect(todoItem.locator('span').filter({ hasText: todoText }).first()).toHaveClass(/line-through/);

  await todoItem.getByRole('button', { name: /delete/i }).click();
  await expect(page.getByText(todoText)).not.toBeVisible();
});
