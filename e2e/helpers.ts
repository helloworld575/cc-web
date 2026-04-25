import { expect, type Page } from '@playwright/test';

export const E2E_ADMIN_PASSWORD = 'e2e-strong-pass-123';
const E2E_BASE_URL = 'http://localhost:3001';
let loginIpCounter = 10;

export function nextE2EIp() {
  loginIpCounter += 1;
  return `127.0.0.${loginIpCounter}`;
}

export async function login(page: Page) {
  const forwardedFor = nextE2EIp();
  await page.setExtraHTTPHeaders({ 'x-forwarded-for': forwardedFor });

  const csrfResponse = await page.request.get(`${E2E_BASE_URL}/api/auth/csrf`, {
    headers: { 'x-forwarded-for': forwardedFor },
  });
  expect(csrfResponse.ok()).toBeTruthy();
  const { csrfToken } = (await csrfResponse.json()) as { csrfToken: string };

  const callbackResponse = await page.request.post(`${E2E_BASE_URL}/api/auth/callback/credentials`, {
    headers: { 'x-forwarded-for': forwardedFor },
    form: {
      password: E2E_ADMIN_PASSWORD,
      csrfToken,
      callbackUrl: `${E2E_BASE_URL}/admin/blog`,
      json: 'true',
    },
  });
  expect(callbackResponse.ok()).toBeTruthy();

  await page.goto('/admin/blog');
  await expect(page).toHaveURL(/\/admin\/blog/);
}
