import { expect, test } from '@playwright/test';
import { login } from './helpers';

test('admin AI provider form saves an OpenAI-compatible provider', async ({ page }) => {
  await login(page);
  await page.goto('/admin/ai-config');

  const providerName = `E2E Provider ${Date.now()}`;
  await page.getByRole('button', { name: /\+ New Provider/ }).click();

  const editor = page.locator('main').locator('.border.rounded-lg').last();
  await editor.locator('input').nth(0).fill(providerName);
  await editor.locator('select').first().selectOption('openai');
  await editor.locator('input').nth(1).fill('https://example.invalid/openai');
  await editor.locator('input').nth(2).fill('sk-e2e-provider');
  await editor.locator('input').nth(3).fill('gpt-e2e');
  await editor.locator('input').nth(4).fill('2048');
  await editor.locator('textarea').fill('Respond only with e2e-safe mock content.');
  await editor.locator('input[type="checkbox"]').check();
  await editor.getByRole('button', { name: 'Save' }).click();

  await expect(page.getByText('Saved!')).toBeVisible();
  const providerCard = page.locator('.border.rounded-lg').filter({ hasText: providerName });
  await expect(providerCard).toBeVisible();
  await expect(providerCard).toContainText('Default');
  await expect(providerCard).toContainText('gpt-e2e');
});
