import { expect, test } from './fixtures';
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

test('subscription integration shows bounded provider errors in both languages', async ({ page }) => {
  await login(page);
  await page.route('**/api/subscriptions/briefs', async route => {
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: '[]',
    });
  });
  await page.route('**/api/subscriptions/integrate', async route => {
    await route.fulfill({
      status: 503,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: 'provider_not_configured',
        error: '<html>internal provider diagnostics</html>',
        retryable: false,
      }),
    });
  });

  await page.goto('/tools');
  await page.getByTestId('tools-tab-subscriptions').click();
  await page.getByTestId('subscription-integrate-all').click();

  const alert = page.getByTestId('subscription-error');
  await expect(alert).toHaveText('No AI provider is configured.');
  await expect(page.getByText('internal provider diagnostics')).toHaveCount(0);

  await page.getByRole('button', { name: '中文' }).click();
  await expect(alert).toHaveText('尚未配置 AI 服务商。');
});

test('subscription briefs are compact, paginated, and filterable', async ({ page }) => {
  await page.route('**/api/subscriptions/briefs', async route => {
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Array.from({ length: 13 }, (_, index) => ({
        id: index + 1,
        source_id: index % 2,
        source_name: index % 2 === 0 ? 'Source A' : 'Source B',
        category: index % 2 === 0 ? 'ai' : 'infra',
        title: `Brief ${index + 1}`,
        url: `https://example.com/brief-${index + 1}`,
        brief: `Stored subscription digest ${index + 1}. `.repeat(12),
        fetched_at: '2026-07-08 09:00:00',
      }))),
    });
  });

  await page.goto('/tools');
  await page.getByTestId('tools-tab-subscriptions').click();

  await expect(page.getByTestId('subscription-brief-card')).toHaveCount(6);
  await expect(page.getByText('Brief 1', { exact: true })).toBeVisible();
  await expect(page.getByText('Brief 7', { exact: true })).toHaveCount(0);

  const listMetrics = await page.getByTestId('subscription-briefs-list').evaluate(element => {
    const style = window.getComputedStyle(element);
    return {
      overflowY: style.overflowY,
      maxHeight: Number.parseFloat(style.maxHeight),
    };
  });
  expect(['auto', 'scroll']).toContain(listMetrics.overflowY);
  expect(listMetrics.maxHeight).toBeGreaterThan(0);

  await page.getByTestId('subscription-pagination').getByRole('button', { name: 'Next' }).click();
  await expect(page.getByText('Brief 7', { exact: true })).toBeVisible();
  await expect(page.getByText('Brief 1', { exact: true })).toHaveCount(0);

  await page.getByTestId('subscription-category-filter').selectOption('ai');
  await expect(page.getByText('Brief 1', { exact: true })).toBeVisible();
  await expect(page.getByText('Brief 2', { exact: true })).toHaveCount(0);

  await page.getByTestId('subscription-source-filter').selectOption('Source B');
  await expect(page.getByText('Brief 1', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Brief 2', { exact: true })).toHaveCount(0);
});
