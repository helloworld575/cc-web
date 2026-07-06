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
  await editor.getByRole('button', { name: 'Save' }).click();

  await expect(page.getByText('Saved!')).toBeVisible();
  const providerCard = page.locator('.border.rounded-lg').filter({ hasText: providerName });
  await expect(providerCard).toBeVisible();
  await expect(providerCard).toContainText('gpt-e2e');
  await expect(providerCard).not.toContainText('Default');
  await expect(page.locator('.border.rounded-lg').filter({ hasText: 'Claude Env Default' })).toContainText('Default');
});

test('admin AI provider form applies the Right Code GPT-5.5 preset', async ({ page }) => {
  await login(page);
  await page.goto('/admin/ai-config');

  await page.getByRole('button', { name: /\+ New Provider/ }).click();

  const editor = page.locator('main').locator('.border.rounded-lg').last();
  await editor.getByRole('button', { name: 'Right Code GPT-5.5' }).click();

  await expect(editor.locator('input').nth(0)).toHaveValue('Right Code GPT-5.5');
  await expect(editor.locator('select').first()).toHaveValue('openai');
  await expect(editor.locator('input').nth(1)).toHaveValue('https://www.right.codes/codex');
  await expect(editor.locator('input').nth(3)).toHaveValue('gpt-5.5');
  await expect(editor.locator('input').nth(4)).toHaveValue('32000');
});
