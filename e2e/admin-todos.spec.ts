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

test('admin todo submitted during initial load is not overwritten by stale list response', async ({ page }) => {
  await login(page);

  let releaseInitialList: (() => void) | undefined;
  const initialListReleased = new Promise<void>(resolve => {
    releaseInitialList = resolve;
  });

  await page.route('**/api/todos', async route => {
    const request = route.request();
    if (request.method() === 'GET') {
      await initialListReleased;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ id: 1, text: 'Existing online todo', done: 0, created_at: '2026-04-25 10:00:00', deadline: null }]),
      });
      return;
    }

    if (request.method() === 'POST') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: 2, text: 'Race-safe todo', done: 0, created_at: '2026-04-25 10:01:00', deadline: null }),
      });
      return;
    }

    await route.continue();
  });

  await page.goto('/admin/tools');
  await page.getByPlaceholder('New todo').fill('Race-safe todo');
  await page.getByRole('button', { name: 'Add' }).click();
  await expect(page.getByText('Race-safe todo')).toBeVisible();

  releaseInitialList?.();
  await expect(page.getByText('Existing online todo')).toBeVisible();
  await expect(page.getByText('Race-safe todo')).toBeVisible();
});
