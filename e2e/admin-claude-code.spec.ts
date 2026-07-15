import { expect, test } from './fixtures';
import { login } from './helpers';

test('admin Claude Code page exposes the worker prompt UI', async ({ page }) => {
  await login(page);
  await page.goto('/admin/claude-code');

  await expect(page.getByRole('heading', { name: 'Personal Assistant' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Send to assistant' })).toBeVisible();
  await expect(page.getByText('Raw NDJSON')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Personal Assistant' })).toBeVisible();
});

test('personal assistant keeps both turns in the same conversation', async ({ page }) => {
  await login(page);
  const requests: Array<Record<string, unknown>> = [];

  await page.route('**/api/claude-code', async route => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
      return;
    }
    const body = route.request().postDataJSON() as Record<string, unknown>;
    requests.push(body);
    await route.fulfill({
      status: 200,
      contentType: 'text/plain; charset=utf-8',
      headers: { 'X-Claude-Chat-ID': '12' },
      body: requests.length === 1 ? 'First answer' : 'Second answer',
    });
  });
  await page.route('**/api/claude-code/12', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 12,
        title: 'First question',
        cwd: 'default',
        status: 'idle',
        messages: [],
      }),
    });
  });

  await page.goto('/admin/claude-code');
  const composer = page.getByRole('textbox', { name: 'Message' });
  await composer.fill('First question');
  await page.getByRole('button', { name: 'Send to assistant' }).click();
  await expect(page.getByText('First answer')).toBeVisible();

  await composer.fill('Second question');
  await page.getByRole('button', { name: 'Send to assistant' }).click();
  await expect(page.getByText('First answer')).toBeVisible();
  await expect(page.getByText('Second answer')).toBeVisible();
  expect(requests).toEqual([
    expect.objectContaining({ message: 'First question' }),
    expect.objectContaining({ chat_id: 12, message: 'Second question' }),
  ]);
});

test('personal assistant preserves prior turns and restores input after failure', async ({ page }) => {
  await login(page);
  let callCount = 0;
  await page.route('**/api/claude-code', async route => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
      return;
    }
    callCount += 1;
    if (callCount === 1) {
      await route.fulfill({
        status: 200,
        contentType: 'text/plain',
        headers: { 'X-Claude-Chat-ID': '12' },
        body: 'First answer',
      });
      return;
    }
    await route.fulfill({
      status: 504,
      contentType: 'application/json',
      body: JSON.stringify({ code: 'CLAUDE_TIMEOUT', error: 'safe' }),
    });
  });

  await page.goto('/admin/claude-code');
  const composer = page.getByRole('textbox', { name: 'Message' });
  await composer.fill('First question');
  await page.getByRole('button', { name: 'Send to assistant' }).click();
  await expect(page.getByText('First answer')).toBeVisible();

  await composer.fill('Retry this question');
  await page.getByRole('button', { name: 'Send to assistant' }).click();
  await expect(page.getByText('First answer')).toBeVisible();
  await expect(composer).toHaveValue('Retry this question');
  await expect(page.locator('div[role="alert"]').filter({ hasText: 'assistant worker' })).toBeVisible();
});

test('personal assistant can stop a pending turn and retry its message', async ({ page }) => {
  await login(page);
  await page.route('**/api/claude-code', async route => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
      return;
    }
    await new Promise(resolve => setTimeout(resolve, 750));
    await route.abort('aborted').catch(() => undefined);
  });

  await page.goto('/admin/claude-code');
  const composer = page.getByRole('textbox', { name: 'Message' });
  await composer.fill('Keep this message');
  await page.getByRole('button', { name: 'Send to assistant' }).click();
  await page.getByRole('button', { name: 'Stop' }).click();

  await expect(composer).toHaveValue('Keep this message');
  await expect(page.getByRole('button', { name: 'Send to assistant' })).toBeEnabled();
});

test('personal assistant loads, starts, and deletes saved conversations', async ({ page }) => {
  await login(page);
  await page.route('**/api/claude-code', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{
        id: 9,
        title: 'Saved plan',
        cwd: 'default',
        status: 'idle',
        created_at: '2026-07-15 08:00:00',
        updated_at: '2026-07-15 08:00:00',
      }]),
    });
  });
  await page.route('**/api/claude-code/9', async route => {
    if (route.request().method() === 'DELETE') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 9,
        title: 'Saved plan',
        cwd: 'default',
        status: 'idle',
        messages: [
          { role: 'user', content: 'Plan today' },
          { role: 'assistant', content: 'Saved answer' },
        ],
      }),
    });
  });

  await page.goto('/admin/claude-code');
  await page.locator('aside button').filter({ hasText: 'Saved plan' }).first().click();
  await expect(page.getByText('Saved answer')).toBeVisible();
  await page.getByRole('button', { name: 'New conversation' }).click();
  await expect(page.getByText('Saved answer')).toHaveCount(0);

  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Delete conversation Saved plan' }).click();
  await expect(page.getByText('Saved plan', { exact: true })).toHaveCount(0);
});
