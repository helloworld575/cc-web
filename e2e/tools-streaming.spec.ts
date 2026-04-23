import { expect, test } from '@playwright/test';
import { login } from './helpers';

test('tools workspace covers seeded data and streaming mock flows', async ({ page }) => {
  await login(page);
  await page.goto('/tools');

  await page.getByTestId('tools-tab-todos').click();
  await expect(page.getByText('Seeded todo from e2e runtime')).toBeVisible();

  await page.getByTestId('tools-tab-diary').click();
  await expect(page.getByText('E2E diary note')).toBeVisible();

  await page.getByTestId('tools-tab-subscriptions').click();
  await expect(page.getByText('E2E Brief')).toBeVisible();

  await page.getByTestId('tools-tab-skills').click();
  await page.getByTestId('tools-skills-search').fill('find skills');
  await expect(page.getByTestId('tools-skills-panel')).toContainText('find-skills');
  await expect(page.getByTestId('tools-skills-panel')).toContainText('Agent / Skills');

  await page.getByTestId('tools-tab-ai-chat').click();
  await page.getByTestId('ai-chat-input').fill('Render markdown for e2e');
  await page.getByTestId('ai-chat-send').click();
  await expect(page.getByTestId('ai-chat-messages')).toContainText('Mock response');
  await expect(page.getByTestId('ai-chat-messages')).toContainText('streamed item');

  await page.getByTestId('tools-tab-bazi').click();
  await page.getByTestId('fortune-start').click();
  await expect(page.getByTestId('fortune-analysis')).toContainText('Mock fortune analysis');

  await page.getByTestId('fortune-tab-history').click();
  await expect(page.getByRole('button', { name: /BaZi/ }).first()).toBeVisible();
});
