import { expect, test } from './fixtures';
import { login } from './helpers';

test('tools workspace covers seeded data and streaming mock flows', async ({ page }) => {
  const chatPrompt = `Render markdown for e2e ${Date.now()}`;
  const fortuneKeyWarnings: string[] = [];

  page.on('console', message => {
    if (message.text().includes('Each child in a list should have a unique "key" prop')) {
      fortuneKeyWarnings.push(message.text());
    }
  });

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
  await page.getByLabel('进入全屏对话').click();
  await expect(page.getByLabel('退出全屏对话')).toBeVisible();
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
  await page.getByLabel('退出全屏对话').click();
  await expect(page.getByLabel('进入全屏对话')).toBeVisible();

  await expect(page.getByTestId('ai-chat-skill')).toBeVisible();
  await expect(page.getByTestId('ai-chat-skill').locator('option[value="content/distribution/api-publishing"]')).toHaveCount(1);
  await page.getByTestId('ai-chat-skill').selectOption('content/distribution/api-publishing');
  let chatRequestBody: any = null;
  await page.route('**/api/ai-chat', async route => {
    if (route.request().method() === 'POST') {
      chatRequestBody = route.request().postDataJSON();
    }
    await route.continue();
  });

  await page.getByTestId('ai-chat-input').fill(chatPrompt);
  await page.getByTestId('ai-chat-send').click();
  await expect.poll(() => chatRequestBody?.skill).toBe('content/distribution/api-publishing');
  await expect(page.getByTestId('ai-chat-messages')).toContainText('Mock response');
  await expect(page.getByTestId('ai-chat-messages')).toContainText('streamed item');
  await expect(page.getByTestId('markdown-csv-table')).toBeVisible();
  await expect(page.getByTestId('markdown-table')).toBeVisible();
  const markdownTextColor = await page.locator('.markdown-stream p').first().evaluate(element => window.getComputedStyle(element).color);
  const markdownRgb = markdownTextColor.match(/\d+/g)?.map(Number) ?? [255, 255, 255];
  expect(markdownRgb[0] + markdownRgb[1] + markdownRgb[2]).toBeLessThan(120);
  const codeBlockColors = await page.locator('.markdown-stream pre code').first().evaluate(element => {
    const codeStyle = window.getComputedStyle(element);
    const preStyle = window.getComputedStyle(element.closest('pre')!);
    return {
      color: codeStyle.color,
      backgroundColor: preStyle.backgroundColor,
    };
  });
  const codeRgb = codeBlockColors.color.match(/\d+/g)?.map(Number) ?? [0, 0, 0];
  const preBgRgb = codeBlockColors.backgroundColor.match(/\d+/g)?.map(Number) ?? [255, 255, 255];
  expect(codeRgb[0] + codeRgb[1] + codeRgb[2]).toBeGreaterThan(600);
  expect(preBgRgb[0] + preBgRgb[1] + preBgRgb[2]).toBeLessThan(120);
  await expect(page.getByTestId('ai-chat-history')).toContainText(chatPrompt);
  await page.getByLabel(new RegExp(`打开对话 ${chatPrompt}`)).click();
  await expect(page.getByTestId('ai-chat-messages')).toContainText('Mock response');
  page.once('dialog', async dialog => {
    expect(dialog.message()).toContain(chatPrompt);
    await dialog.accept();
  });
  const deleteResponsePromise = page.waitForResponse(response => (
    response.url().includes('/api/ai-chat/') && response.request().method() === 'DELETE'
  ));
  await page.getByLabel(new RegExp(`删除对话 ${chatPrompt}`)).click();
  const deleteResponse = await deleteResponsePromise;
  expect(deleteResponse.ok()).toBeTruthy();
  await expect(page.getByLabel(new RegExp(`删除对话 ${chatPrompt}`))).toHaveCount(0);
  await expect(page.getByTestId('ai-chat-messages')).not.toContainText('Mock response');

  await page.getByTestId('tools-tab-bazi').click();
  await page.getByTestId('fortune-start').click();
  await expect(page.getByTestId('fortune-analysis')).toContainText('Mock fortune analysis');
  await expect(page.getByText('已保存到历史。')).toBeVisible();

  await page.getByTestId('fortune-tab-history').click();
  const historyEntry = page.getByRole('button', { name: /BaZi/ }).first();
  await expect(historyEntry).toBeVisible();
  await historyEntry.click();
  await expect(page.getByText('Mock fortune analysis').last()).toBeVisible();
  expect(fortuneKeyWarnings).toEqual([]);

  page.once('dialog', async dialog => {
    expect(dialog.message()).toBe('确定删除此记录？');
    await dialog.accept();
  });
  const fortuneDeleteResponsePromise = page.waitForResponse(response => (
    /\/api\/fortune\/history\/\d+$/.test(response.url()) && response.request().method() === 'DELETE'
  ));
  await page.getByRole('button', { name: '删除' }).click();
  const fortuneDeleteResponse = await fortuneDeleteResponsePromise;
  expect(fortuneDeleteResponse.ok()).toBeTruthy();
  await expect(page.getByRole('button', { name: /BaZi/ })).toHaveCount(0);
});

test('ai chat does not auto-scroll while streaming a long message', async ({ page }) => {
  await login(page);
  await page.goto('/tools');
  await page.getByTestId('tools-tab-ai-chat').click();
  await expect(page.getByTestId('ai-chat-shell')).toBeVisible();

  const longPrompt = [
    `Do not auto scroll e2e ${Date.now()}`,
    ...Array.from({ length: 80 }, (_, index) => `line ${index + 1}: keep the reader where they are`),
  ].join('\n');

  await page.getByTestId('ai-chat-input').fill(longPrompt);
  await page.getByTestId('ai-chat-scroll').evaluate(element => { element.scrollTop = 0; });
  const beforeScrollTop = await page.getByTestId('ai-chat-scroll').evaluate(element => element.scrollTop);
  await page.getByTestId('ai-chat-send').click();
  await expect(page.getByTestId('ai-chat-messages')).toContainText('Mock response');
  const afterScrollTop = await page.getByTestId('ai-chat-scroll').evaluate(element => element.scrollTop);

  expect(afterScrollTop).toBeLessThanOrEqual(beforeScrollTop + 4);
});

test('ai chat surfaces stream errors and unlocks the composer', async ({ page }) => {
  await login(page);
  await page.goto('/tools');
  await page.getByTestId('tools-tab-ai-chat').click();
  await expect(page.getByTestId('ai-chat-shell')).toBeVisible();

  await page.route('**/api/ai-chat', async route => {
    if (route.request().method() !== 'POST') {
      await route.continue();
      return;
    }

    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
      body: [
        'data: {"chat_id":777}',
        '',
        'data: {"error":"Right Code provider failed: 401"}',
        '',
      ].join('\n'),
    });
  });

  await page.getByTestId('ai-chat-input').fill(`stream error e2e ${Date.now()}`);
  await page.getByTestId('ai-chat-send').click();

  await expect(page.getByText('Request failed. Please try again.')).toBeVisible();
  await expect(page.locator('body')).not.toContainText('Right Code provider failed: 401');
  await expect(page.getByTestId('ai-chat-input')).toBeEnabled();
  await page.getByTestId('ai-chat-input').fill('retry after stream error');
  await expect(page.getByTestId('ai-chat-send')).toBeEnabled();
});

test('AI tools never render HTML error pages returned by APIs', async ({ page }) => {
  await login(page);
  await page.goto('/tools');

  await page.getByTestId('tools-tab-image').click();
  await page.route('**/api/ai-image', async route => {
    if (route.request().method() !== 'POST') {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 502,
      headers: { 'Content-Type': 'text/html' },
      body: '<!doctype html><html><body>proxy login page should stay hidden</body></html>',
    });
  });
  await page.getByTestId('ai-image-prompt').fill('safe error rendering');
  await page.getByTestId('ai-image-generate').click();
  await expect(page.getByTestId('ai-image-generate')).toBeEnabled();
  await expect(page.locator('body')).not.toContainText('proxy login page should stay hidden');

  await page.unroute('**/api/ai-image');
  await page.getByTestId('tools-tab-ai-chat').click();
  await page.route('**/api/ai-chat', async route => {
    if (route.request().method() !== 'POST') {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 502,
      headers: { 'Content-Type': 'text/html' },
      body: '<html><body>gateway diagnostics should stay hidden</body></html>',
    });
  });
  await page.getByTestId('ai-chat-input').fill('safe chat error rendering');
  await page.getByTestId('ai-chat-send').click();
  await expect(page.getByTestId('ai-chat-input')).toBeEnabled();
  await expect(page.locator('body')).not.toContainText('gateway diagnostics should stay hidden');
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
