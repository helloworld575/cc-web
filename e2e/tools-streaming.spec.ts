import { expect, test } from '@playwright/test';
import { login } from './helpers';

test('tools workspace covers seeded data and streaming mock flows', async ({ page }) => {
  const chatPrompt = `Render markdown for e2e ${Date.now()}`;

  await login(page);
  await page.goto('/blog');
  await page.getByRole('link', { name: 'Tools' }).click();
  await expect(page).toHaveURL(/\/tools/);

  await page.getByTestId('tools-tab-todos').click();
  await expect(page.getByRole('main').getByText('Seeded todo from e2e runtime')).toBeVisible();

  await page.getByRole('button', { name: '中文' }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN');
  await expect(page.getByRole('heading', { name: '工具' })).toBeVisible();
  await expect(page.getByText('更安静的工作台')).toBeVisible();
  await expect(page.getByTestId('tools-tab-skills')).toContainText('技能');

  await expect(page.getByTestId('tools-tab-diary')).toHaveCount(0);

  await page.getByTestId('tools-tab-subscriptions').click();
  await expect(page.getByText('E2E Brief')).toBeVisible();

  await page.getByTestId('tools-tab-skills').click();
  await expect(page.getByTestId('tools-skills-compact-list')).toBeVisible();
  const skillsListMaxHeight = await page.getByTestId('tools-skills-compact-list').evaluate(element => {
    return Number.parseFloat(window.getComputedStyle(element).maxHeight);
  });
  const viewportHeight = page.viewportSize()?.height ?? 720;
  expect(skillsListMaxHeight).toBeLessThanOrEqual(viewportHeight - 180);
  await page.getByTestId('tools-skills-search').fill('find skills');
  await expect(page.getByTestId('tools-skills-panel')).toContainText('find-skills');
  await expect(page.getByTestId('tools-skills-panel')).toContainText('Agent / Skills');

  await page.getByTestId('tools-tab-image').click();
  await expect(page.getByRole('heading', { name: 'GPT 图像' })).toBeVisible();
  await expect(page.getByText('通过已配置的 chat-completions 生图端点生成图片。')).toBeVisible();
  await page.getByTestId('ai-image-reference-input').setInputFiles({
    name: 'reference.png',
    mimeType: 'image/png',
    buffer: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7Zx7cAAAAASUVORK5CYII=',
      'base64',
    ),
  });
  await expect(page.getByTestId('ai-image-reference-preview')).toBeVisible();
  await page.getByTestId('ai-image-prompt').fill('A playful paper-cut moon over Shanghai');
  await page.getByTestId('ai-image-generate').click();
  await expect(page.getByTestId('ai-image-result')).toBeVisible();

  await page.getByTestId('tools-tab-ai-chat').click();
  await expect(page.getByTestId('ai-chat-shell')).toBeVisible();
  await page.getByTestId('ai-chat-shell').scrollIntoViewIfNeeded();
  await expect(page.getByTestId('ai-chat-input')).toBeInViewport();
  await expect(page.getByTestId('ai-chat-scroll')).toBeVisible();
  const chatShellHeight = await page.getByTestId('ai-chat-shell').evaluate(element => element.getBoundingClientRect().height);
  expect(chatShellHeight).toBeGreaterThan(620);
  const chatScrollOverflow = await page.getByTestId('ai-chat-scroll').evaluate(element => window.getComputedStyle(element).overflowY);
  expect(['auto', 'scroll']).toContain(chatScrollOverflow);
  await page.getByLabel('Enter fullscreen chat').click();
  await expect(page.getByLabel('Exit fullscreen chat')).toBeVisible();
  await expect(page.getByTestId('ai-chat-shell')).toHaveAttribute('data-fullscreen', 'true');
  const fullscreenMountedAtBody = await page.getByTestId('ai-chat-shell').evaluate(element => element.parentElement === document.body);
  expect(fullscreenMountedAtBody).toBeTruthy();
  const fullscreenBox = await page.getByTestId('ai-chat-shell').boundingBox();
  expect(fullscreenBox?.height ?? 0).toBeGreaterThan((page.viewportSize()?.height ?? 720) - 40);
  const fullscreenIsTopLayer = await page.getByTestId('ai-chat-shell').evaluate(element => {
    const rect = element.getBoundingClientRect();
    const topElement = document.elementFromPoint(
      rect.left + rect.width / 2,
      rect.top + rect.height / 2,
    );
    return Boolean(topElement && (topElement === element || element.contains(topElement)));
  });
  expect(fullscreenIsTopLayer).toBeTruthy();
  await expect(page.getByTestId('ai-chat-input')).toBeInViewport();
  await page.getByLabel('Exit fullscreen chat').click();
  await expect(page.getByLabel('Enter fullscreen chat')).toBeVisible();
  await page.getByTestId('ai-chat-input').fill(chatPrompt);
  await page.getByTestId('ai-chat-send').click();
  await expect(page.getByTestId('ai-chat-messages')).toContainText('Mock response');
  await expect(page.getByTestId('ai-chat-messages')).toContainText('streamed item');
  await expect(page.getByTestId('markdown-csv-table')).toBeVisible();
  await expect(page.getByTestId('markdown-table')).toBeVisible();
  const markdownTextColor = await page.locator('.markdown-stream p').first().evaluate(element => window.getComputedStyle(element).color);
  const markdownRgb = markdownTextColor.match(/\d+/g)?.map(Number) ?? [255, 255, 255];
  expect(markdownRgb[0] + markdownRgb[1] + markdownRgb[2]).toBeLessThan(120);
  await expect(page.getByTestId('ai-chat-history')).toContainText(chatPrompt);
  await page.getByLabel(new RegExp(`Open chat ${chatPrompt}`)).click();
  await expect(page.getByTestId('ai-chat-messages')).toContainText('Mock response');
  page.once('dialog', async dialog => {
    expect(dialog.message()).toContain(chatPrompt);
    await dialog.accept();
  });
  const deleteResponsePromise = page.waitForResponse(response => (
    response.url().includes('/api/ai-chat/') && response.request().method() === 'DELETE'
  ));
  await page.getByLabel(new RegExp(`Delete chat ${chatPrompt}`)).click();
  const deleteResponse = await deleteResponsePromise;
  expect(deleteResponse.ok()).toBeTruthy();
  await expect(page.getByLabel(new RegExp(`Delete chat ${chatPrompt}`))).toHaveCount(0);
  await expect(page.getByTestId('ai-chat-messages')).not.toContainText('Mock response');

  await page.getByTestId('tools-tab-bazi').click();
  await page.getByTestId('fortune-start').click();
  await expect(page.getByTestId('fortune-analysis')).toContainText('Mock fortune analysis');
  await expect(page.getByText('Saved to history.')).toBeVisible();

  await page.getByTestId('fortune-tab-history').click();
  await expect(page.getByRole('button', { name: /BaZi/ }).first()).toBeVisible();
});

test('mobile drawer opens tools and tool tabs stay clickable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  await page.goto('/');

  await page.getByLabel('Menu').click();
  await page.getByTestId('nav-mobile-tools').click();
  await expect(page).toHaveURL(/\/tools/);

  await page.getByTestId('tools-tab-image').click();
  await expect(page.getByTestId('ai-image-prompt')).toBeVisible();

  await page.getByTestId('tools-tab-skills').click();
  await expect(page.getByTestId('tools-skills-compact-list')).toBeVisible();
});
