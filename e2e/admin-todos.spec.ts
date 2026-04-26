import { expect, test } from '@playwright/test';
import { login } from './helpers';

test('admin todos can be created, filtered, completed, and deleted', async ({ page }) => {
  await login(page);
  await page.goto('/admin/tools');

  const todoText = `E2E todo ${Date.now()}`;
  await page.getByTestId('todo-markdown-editor').fill(todoText);
  await page.locator('input[type="date"]').first().fill('2026-05-02');
  await page.getByRole('button', { name: 'Add' }).click();

  const todoItem = page.locator('li').filter({ hasText: todoText });
  await expect(todoItem).toBeVisible();
  await expect(todoItem.locator('input[type="date"]')).toHaveValue('2026-05-02');

  await page.getByPlaceholder('Search...').fill(todoText);
  await expect(todoItem).toBeVisible();
  await expect(page.getByText('Seeded todo from e2e runtime')).not.toBeVisible();

  await todoItem.locator('input[type="checkbox"]').click();
  await expect(todoItem.locator('article').first()).toHaveClass(/line-through/);

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
  await page.getByTestId('todo-markdown-editor').fill('Race-safe todo');
  await page.getByRole('button', { name: 'Add' }).click();
  const newTodoItem = page.locator('li').filter({ hasText: 'Race-safe todo' });
  await expect(newTodoItem).toBeVisible();

  releaseInitialList?.();
  await expect(page.locator('li').filter({ hasText: 'Existing online todo' })).toBeVisible();
  await expect(newTodoItem).toBeVisible();
});

test('admin todos use a larger markdown editor with toolbar, preview toggle, and edit mode', async ({ page }) => {
  await login(page);
  await page.goto('/admin/tools');

  const todoText = `Markdown todo ${Date.now()}`;
  const editor = page.getByTestId('todo-markdown-editor');
  await expect(editor).toBeVisible();
  await expect(editor).toHaveCSS('min-height', '320px');

  await editor.fill(todoText);
  await page.getByTestId('markdown-toolbar-bold').click();
  await expect(editor).toHaveValue(`**${todoText}**`);

  await expect(page.getByTestId('todo-markdown-preview')).toContainText(todoText);
  await page.getByTestId('todo-preview-toggle').click();
  await expect(page.getByTestId('todo-markdown-preview')).toBeHidden();
  await page.getByTestId('todo-preview-toggle').click();
  await expect(page.getByTestId('todo-markdown-preview')).toBeVisible();

  await page.getByRole('button', { name: 'Add' }).click();
  const todoItem = page.locator('li').filter({ hasText: todoText });
  await expect(todoItem).toBeVisible();

  await todoItem.getByRole('button', { name: 'Edit' }).click();
  await expect(editor).toHaveValue(`**${todoText}**`);
  await editor.fill(`### ${todoText}\n\n- follow up`);
  await page.getByRole('button', { name: 'Save changes' }).click();

  await expect(todoItem).toContainText(todoText);
  await expect(todoItem).toContainText('follow up');

  await todoItem.getByRole('button', { name: /delete/i }).click();
  await expect(page.getByText(todoText)).not.toBeVisible();
});

test('admin todo markdown toolbar targets the mobile editor', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 840 });
  await login(page);
  await page.goto('/admin/tools');

  const mobileEditor = page.getByTestId('todo-markdown-editor-mobile');
  await expect(mobileEditor).toBeVisible();
  await mobileEditor.fill('Mobile markdown todo');
  await page.getByTestId('markdown-toolbar-bold').click();

  await expect(mobileEditor).toHaveValue('**Mobile markdown todo**');
});
