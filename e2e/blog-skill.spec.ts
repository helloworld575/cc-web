import { expect, test } from './fixtures';
import { login } from './helpers';

test('blog writer exposes its runtime contract and can be selected for drafting', async ({ page }) => {
  await login(page);
  await page.goto('/admin/skills');
  await page.getByTestId('admin-skills-search').fill('technical-blog-writer');
  await page.getByRole('button', { name: /technical-blog-writer/i }).click();
  await expect(page.getByTestId('admin-skill-id')).toHaveValue('technical-blog-writer');
  await expect(page.getByRole('textbox', { name: 'System prompt', exact: true })).not.toHaveValue('');
  const prompt = await page.getByRole('textbox', { name: 'Prompt', exact: true }).inputValue();
  expect(prompt.match(/\{\{[^}]+\}\}/g)).toEqual(['{{content}}']);

  await page.goto('/tools');
  await page.getByTestId('tools-tab-ai-chat').click();
  const skill = 'content/article/technical-blog-writer';
  await page.getByTestId('ai-chat-skill').selectOption(skill);
  const input = 'Draft an evidence-backed review from the supplied release notes.';
  const requestPromise = page.waitForRequest(request => (
    request.url().endsWith('/api/ai-chat') && request.method() === 'POST'
  ));
  await page.getByTestId('ai-chat-input').fill(input);
  await page.getByTestId('ai-chat-send').click();
  const request = await requestPromise;
  expect(request.postDataJSON().skill).toBe(skill);
  await expect(page.getByTestId('ai-chat-messages')).toContainText('Mock response');
  await expect(page.getByTestId('ai-chat-input')).toBeEnabled();
  await expect(page.getByTestId('ai-chat-stop')).toHaveCount(0);
});
