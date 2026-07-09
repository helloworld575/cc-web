import { expect, test } from '@playwright/test';
import { login } from './helpers';

test('admin diary markdown editor keeps a light writing surface', async ({ page }) => {
  await login(page);
  await page.goto('/admin/diary');

  const editor = page.getByTestId('diary-markdown-editor');
  await expect(editor).toBeVisible();
  await editor.fill('Diary **markdown** note');
  await expect(page.getByTestId('diary-markdown-preview')).toContainText('Diary markdown note');

  const backgroundColor = await page.getByTestId('diary-markdown-editor-root').evaluate((element) => getComputedStyle(element).backgroundColor);
  expect(backgroundColor).toBe('rgb(255, 255, 255)');
});
