import { expect, test } from '@playwright/test';
import { login } from './helpers';

test('admin diary markdown editor keeps a light writing surface', async ({ page }) => {
  await login(page);
  await page.goto('/admin/diary');

  const editor = page.locator('textarea:visible').first();
  await expect(editor).toBeVisible();

  const backgroundColor = await editor.evaluate((element) => getComputedStyle(element).backgroundColor);
  expect(backgroundColor).toBe('rgb(255, 255, 255)');
});
