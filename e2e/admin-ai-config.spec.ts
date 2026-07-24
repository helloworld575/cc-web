import { expect, test } from './fixtures';
import { login } from './helpers';

test('admin AI providers page is environment managed and read-only', async ({ page }) => {
  await login(page);
  await page.goto('/admin/ai-config');

  await expect(page.getByText('Environment managed')).toBeVisible();
  await expect(page.getByText('AI provider editing is temporarily disabled')).toBeVisible();
  await expect(page.getByRole('button', { name: /\+ New Provider/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Save' })).toHaveCount(0);

  const claudeCard = page.locator('main').locator('.rounded-xl').filter({ hasText: 'Claude Env Default' });
  await expect(claudeCard).toContainText('Default');
  await expect(claudeCard).toContainText('env.local');
  await expect(claudeCard).toContainText('anthropic');
});

test('admin AI providers page shows the Right Code GPT-5.5 env provider', async ({ page }) => {
  await login(page);
  await page.goto('/admin/ai-config');

  const rightCodeCard = page.locator('main').locator('.rounded-xl').filter({ hasText: 'Right Code GPT-5.5 Env' });
  await expect(rightCodeCard).toBeVisible();
  await expect(rightCodeCard).toContainText('openai');
  await expect(rightCodeCard).toContainText('gpt-5.5');
  await expect(rightCodeCard).toContainText('32000 max tokens');
  await expect(rightCodeCard).toContainText('https://www.rightapi.ai/codex');
  await expect(rightCodeCard.getByRole('button', { name: 'Test' })).toBeVisible();
});
