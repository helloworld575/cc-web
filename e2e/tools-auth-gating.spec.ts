import { expect, test } from '@playwright/test';
import { login } from './helpers';

test('public tools hide AI actions while keeping subscription briefs visible', async ({ page }) => {
  await page.route('**/api/subscriptions/briefs', async route => {
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([
        {
          id: 1,
          source_id: 1,
          source_name: 'AI Feed',
          category: 'rss',
          title: 'Visible Brief',
          url: 'https://example.com/visible-brief',
          brief: 'Public digest text from a stored result.',
          fetched_at: '2026-07-08 09:00:00',
        },
      ]),
    });
  });

  await page.goto('/tools');

  await expect(page.getByTestId('tools-tab-ai-chat')).toHaveCount(0);
  await expect(page.getByTestId('tools-tab-image')).toHaveCount(0);

  await page.getByTestId('tools-tab-subscriptions').click();
  await expect(page.getByRole('link', { name: 'Visible Brief' })).toBeVisible();
  await expect(page.getByText('Public digest text from a stored result.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Fetch subscriptions' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Integrate briefs' })).toHaveCount(0);
});

test('authenticated tools show AI and subscription actions', async ({ page }) => {
  await login(page);
  await page.route('**/api/subscriptions/briefs', async route => {
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: '[]',
    });
  });

  await page.goto('/tools');

  await expect(page.getByTestId('tools-tab-ai-chat')).toBeVisible();
  await expect(page.getByTestId('tools-tab-image')).toBeVisible();

  await page.getByTestId('tools-tab-subscriptions').click();
  await expect(page.getByTestId('subscription-crawl-all')).toBeVisible();
  await expect(page.getByTestId('subscription-integrate-all')).toBeVisible();
});
