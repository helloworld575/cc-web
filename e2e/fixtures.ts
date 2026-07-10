import { expect, test as base, type Page } from '@playwright/test';

async function waitForHydration(page: Page) {
  await page.waitForFunction(() => document.documentElement.dataset.hydrated === 'true');
}

export const test = base.extend({
  page: async ({ page }, use) => {
    const goto = page.goto.bind(page);
    const reload = page.reload.bind(page);

    Object.defineProperty(page, 'goto', {
      configurable: true,
      value: async (...args: Parameters<Page['goto']>) => {
        const response = await goto(...args);
        await waitForHydration(page);
        return response;
      },
    });

    Object.defineProperty(page, 'reload', {
      configurable: true,
      value: async (...args: Parameters<Page['reload']>) => {
        const response = await reload(...args);
        await waitForHydration(page);
        return response;
      },
    });

    await use(page);
  },
});

export { expect };
