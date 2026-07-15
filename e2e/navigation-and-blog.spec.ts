import { expect, test } from './fixtures';
import { writeFile } from 'node:fs/promises';
import { login } from './helpers';

test('language toggle updates immediately and persists across reloads', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByRole('button', { name: '中文' })).toBeVisible();

  await page.getByRole('button', { name: '中文' }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN');
  await expect(page.getByRole('button', { name: 'EN', exact: true })).toBeVisible();
  await expect(page.getByText('身份', { exact: true })).toBeVisible();
  await expect(page.getByText('邮箱', { exact: true })).toBeVisible();

  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN');
  await expect(page.getByRole('button', { name: 'EN', exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'EN', exact: true }).click();
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
  const slug = page.url().split('/').pop()!;

  await page.getByTestId('admin-blog-editor-title').fill(title);
  await page.getByTestId('admin-blog-editor-date').fill('2026-04-23');
  await page.getByTestId('admin-blog-editor-brief').fill('Brief generated during Playwright e2e.');
  await page.getByTestId('admin-blog-editor-content').last().fill([
    '# E2E Content',
    '',
    '## Setup notes',
    '',
    'This markdown was saved during the browser flow.',
    '',
    '### Tiny detail',
    '',
    'Heading navigation should link here too.',
    '',
    '| Feature | Status |',
    '| --- | --- |',
    '| Shared preview | Ready |',
    '',
    '- [x] Published task',
    '',
    '~~Retired wording~~',
    '',
    'https://example.com/reference',
  ].join('\n'));
  const editorPreview = page.getByTestId('admin-blog-editor-preview');
  await expect(editorPreview.locator('table')).toContainText('Shared preview');
  await expect(editorPreview.locator('li.task-list-item')).toContainText('Published task');
  await expect(editorPreview.locator('del')).toHaveText('Retired wording');
  await expect(editorPreview.getByRole('link', { name: 'https://example.com/reference' })).toHaveAttribute(
    'href',
    'https://example.com/reference'
  );
  await page.getByTestId('admin-blog-save').click();
  await expect(page.getByTestId('admin-blog-saved')).toBeVisible();

  await page.goto('/');
  await expect(page.getByRole('link', { name: 'Admin' })).toBeVisible();

  await page.goto('/blog');
  await expect(page.getByText(title)).toBeVisible();
  await page.getByText(title).click();
  await expect(page.getByTestId('blog-heading-nav')).toBeVisible();
  await expect(page.getByTestId('blog-heading-nav').getByRole('link', { name: 'Setup notes' })).toBeVisible();
  await expect(page.getByTestId('blog-heading-nav').getByRole('link', { name: 'Tiny detail' })).toBeVisible();
  await expect(page.getByTestId('blog-post-view-count')).toContainText(/views|访问/);
  await expect(page.getByTestId('blog-comments')).toBeVisible();
  await page.getByPlaceholder('Name').fill('E2E Reader');
  await page.getByPlaceholder('Comment').fill('Comment from public blog e2e.');
  await page.getByRole('button', { name: 'Post comment' }).click();
  await expect(page.getByText('Comment from public blog e2e.')).toBeVisible();
  await expect(page.getByText('This markdown was saved during the browser flow.')).toBeVisible();
  await expect(page.getByTestId('blog-post-date')).toHaveAttribute('datetime', '2026-04-23');
  await expect(page.getByTestId('blog-post-date')).toContainText('April 23, 2026');
  const article = page.getByTestId('blog-post-content');
  await expect(article.locator('table')).toContainText('Shared preview');
  await expect(article.locator('input[type="checkbox"]')).toBeChecked();
  await expect(article.locator('del')).toHaveText('Retired wording');
  await expect(article.getByRole('link', { name: 'https://example.com/reference' })).toHaveAttribute(
    'href',
    'https://example.com/reference'
  );

  await page.goto('/blog');
  await expect(page.getByTestId(`blog-post-views-${slug}`)).toContainText(/views|访问/);
});

test('public blog defaults to newest-first sorting and paginates older posts', async ({ page }) => {
  await page.goto('/blog');

  const list = page.getByTestId('blog-post-list');
  await expect(list.locator('li').first()).toContainText('Seeded Hello');
  await expect(page.getByTestId('blog-sort')).toHaveValue('newest');
  await expect(page.getByRole('button', { name: 'Next', exact: true })).toBeVisible();

  await page.getByTestId('blog-sort').selectOption('oldest');
  await expect(list.locator('li').first()).toContainText('Seeded Archive 01');

  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(list).toContainText('Seeded Hello');
});

test('admin blog editor uses TOAST UI markdown editing, image upload, and height-aware skills', async ({ page }, testInfo) => {
  await login(page);

  const title = `E2E Markdown Blog ${Date.now()}`;
  await page.getByTestId('admin-blog-new-title').fill(title);
  await page.getByTestId('admin-blog-create').click();
  await expect(page).toHaveURL(/\/admin\/blog\/.+/);
  await page.waitForLoadState('networkidle');

  const editor = page.getByTestId('admin-blog-editor-content');
  await expect(editor).toBeVisible();
  await expect(page.getByTestId('admin-blog-editor-content-root')).toHaveCSS('min-height', '640px');

  await expect(page.getByRole('button', { name: 'Bold' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Insert image' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Insert table' })).toBeVisible();

  await editor.fill('# Blog markdown body');
  await expect(page.getByTestId('admin-blog-editor-preview')).toContainText('Blog markdown body');

  const uploadPath = testInfo.outputPath('editor-upload.png');
  await writeFile(uploadPath, Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7Zx7cAAAAASUVORK5CYII=',
    'base64'
  ));
  await page.getByRole('button', { name: 'Insert image' }).click();
  await page.locator('.toastui-editor-popup-add-image input[type="file"]').setInputFiles(uploadPath);
  const uploadResponse = page.waitForResponse(response => response.url().endsWith('/api/files') && response.request().method() === 'POST');
  await page.locator('.toastui-editor-popup-add-image .toastui-editor-ok-button').click();
  expect((await uploadResponse).ok()).toBeTruthy();
  await expect(editor).toContainText(/\!\[editor-upload\]\(\/uploads\/.+\.png\)/);

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

test('admin blog analytics page opens for authenticated users', async ({ page }) => {
  await login(page);
  await page.route('**/api/admin/blog-analytics', async route => {
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        totalViews: 153,
        posts: Array.from({ length: 14 }, (_, index) => ({
          slug: `analytics-post-${index + 1}`,
          title: `Analytics Post ${index + 1}`,
          date: '2026-07-08',
          views: 100 - index,
          comments: index % 3,
          latestViewedAt: '2026-07-08 10:00:00',
        })),
        sources: Array.from({ length: 9 }, (_, index) => ({
          source: `source-${index + 1}`,
          views: 20 - index,
        })),
        recentViews: Array.from({ length: 16 }, (_, index) => ({
          slug: `analytics-post-${(index % 4) + 1}`,
          source: `source-${(index % 3) + 1}`,
          referrer: `https://example.com/ref-${index + 1}`,
          created_at: '2026-07-08 10:00:00',
        })),
        recentComments: Array.from({ length: 12 }, (_, index) => ({
          id: index + 1,
          slug: `analytics-post-${(index % 4) + 1}`,
          author: `Reader ${index + 1}`,
          content: `Comment ${index + 1}`,
          created_at: '2026-07-08 10:00:00',
        })),
      }),
    });
  });

  await page.goto('/admin/blog-analytics');
  await expect(page.getByTestId('admin-blog-analytics')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Blog Analytics' })).toBeVisible();
  await expect(page.getByText('Analytics Post 1', { exact: true })).toBeVisible();
  await expect(page.getByText('Analytics Post 11', { exact: true })).toHaveCount(0);

  const postsScroll = await page.getByTestId('admin-blog-posts-scroll').evaluate(element => {
    const style = window.getComputedStyle(element);
    return {
      overflowY: style.overflowY,
      maxHeight: Number.parseFloat(style.maxHeight),
    };
  });
  expect(['auto', 'scroll']).toContain(postsScroll.overflowY);
  expect(postsScroll.maxHeight).toBeGreaterThan(0);

  await page.getByTestId('admin-blog-posts-pagination').getByRole('button', { name: 'Next' }).click();
  await expect(page.getByText('Analytics Post 11', { exact: true })).toBeVisible();
  await expect(page.getByText('Analytics Post 1', { exact: true })).toHaveCount(0);
});
