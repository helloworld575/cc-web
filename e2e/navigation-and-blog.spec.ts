import { expect, test } from '@playwright/test';
import { login } from './helpers';

test('language toggle updates immediately and persists across reloads', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByRole('button', { name: '中文' })).toBeVisible();

  await page.getByRole('button', { name: '中文' }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN');
  await expect(page.getByRole('button', { name: 'EN' })).toBeVisible();

  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN');
  await expect(page.getByRole('button', { name: 'EN' })).toBeVisible();

  await page.getByRole('button', { name: 'EN' }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByRole('button', { name: '中文' })).toBeVisible();
});

test('public navigation and blog publishing flow work end to end', async ({ page }) => {
  await page.goto('/');
  const bodyLayout = await page.locator('body').evaluate((element) => {
    const style = window.getComputedStyle(element);
    return {
      display: style.display,
      flexDirection: style.flexDirection,
      minHeight: style.minHeight,
    };
  });
  expect(bodyLayout.display).toBe('flex');
  expect(bodyLayout.flexDirection).toBe('column');
  await expect(page.getByRole('heading', { name: /^ThomasLee's Blog$/ })).toBeVisible();
  await expect(page.getByText('ID · thomaslee')).toBeVisible();
  await expect(page.getByRole('link', { name: 'zhichenli6@gmail.com' })).toHaveAttribute('href', 'mailto:zhichenli6@gmail.com');
  await expect(page.getByRole('link', { name: 'thomaslee.site' })).toHaveAttribute('href', 'https://thomaslee.site');
  await expect(page.getByRole('link', { name: 'helloworld575' })).toHaveAttribute('href', 'https://github.com/helloworld575');
  await expect(page.getByText(/^Copyright © \d{4} ThomasLee$/)).toBeVisible();
  await expect(
    page.getByText('For copyright, attribution, privacy, or content removal requests, email the public contact address listed on this page.')
  ).toBeVisible();
  await page.getByRole('main').getByRole('link', { name: 'Blog' }).click();
  await expect(page).toHaveURL(/\/blog/);
  await expect(page.getByText('Seeded Hello')).toBeVisible();

  await login(page);

  const title = `E2E Post ${Date.now()}`;
  await page.getByTestId('admin-blog-new-title').fill(title);
  await page.getByTestId('admin-blog-create').click();
  await expect(page).toHaveURL(/\/admin\/blog\/.+/);
  await page.waitForLoadState('networkidle');

  await page.getByTestId('admin-blog-editor-title').fill(title);
  await page.getByTestId('admin-blog-editor-date').fill('2026-04-23');
  await page.getByTestId('admin-blog-editor-brief').fill('Brief generated during Playwright e2e.');
  await page.getByTestId('admin-blog-editor-content').last().fill('# E2E Content\n\nThis markdown was saved during the browser flow.');
  await page.getByTestId('admin-blog-save').click();
  await expect(page.getByTestId('admin-blog-saved')).toBeVisible();

  await page.goto('/');
  await expect(page.getByRole('link', { name: 'Admin' })).toBeVisible();

  await page.goto('/blog');
  await expect(page.getByText(title)).toBeVisible();
  await page.getByText(title).click();
  await expect(page.getByText('This markdown was saved during the browser flow.')).toBeVisible();
});

test('admin blog editor has a large markdown toolbar, preview toggle, and height-aware skills', async ({ page }) => {
  await login(page);

  const title = `E2E Markdown Blog ${Date.now()}`;
  await page.getByTestId('admin-blog-new-title').fill(title);
  await page.getByTestId('admin-blog-create').click();
  await expect(page).toHaveURL(/\/admin\/blog\/.+/);
  await page.waitForLoadState('networkidle');

  const editor = page.getByTestId('admin-blog-editor-content');
  await expect(editor).toBeVisible();
  await expect(editor).toHaveCSS('min-height', '640px');

  await editor.fill('Blog markdown body');
  await page.getByTestId('markdown-toolbar-heading').click();
  await expect(editor).toHaveValue('### Blog markdown body');

  await expect(page.getByTestId('admin-blog-editor-preview')).toContainText('Blog markdown body');
  await page.getByTestId('admin-blog-preview-toggle').click();
  await expect(page.getByTestId('admin-blog-editor-preview')).toBeHidden();
  await page.getByTestId('admin-blog-preview-toggle').click();
  await expect(page.getByTestId('admin-blog-editor-preview')).toBeVisible();

  const providerSelect = page.getByTestId('admin-blog-skill-provider');
  await expect(providerSelect).toBeVisible();
  await expect(providerSelect).toHaveValue('-1');
  await providerSelect.selectOption('-2');
  await expect(providerSelect).toHaveValue('-2');

  let aiRequestBody: any = null;
  await page.route('**/api/ai', async route => {
    aiRequestBody = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
      body: [
        'data: {"output":"text","provider_id":-2,"model":"gpt-5.5"}',
        '',
        'data: {"text":"provider ok"}',
        '',
      ].join('\n'),
    });
  });

  await page.getByTestId('admin-blog-skill-search').fill('api publishing');
  await page.getByTestId('admin-blog-skill-list').getByRole('button').first().click();
  await expect.poll(() => aiRequestBody?.provider_id).toBe(-2);
  await expect(page.getByText('provider ok')).toBeVisible();

  const skillsListMaxHeight = await page.getByTestId('admin-blog-skill-list').evaluate(element => {
    return Number.parseFloat(window.getComputedStyle(element).maxHeight);
  });
  const viewportHeight = page.viewportSize()?.height ?? 720;
  expect(skillsListMaxHeight).toBeLessThanOrEqual(viewportHeight - 180);
});
