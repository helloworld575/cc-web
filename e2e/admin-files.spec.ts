import { expect, test } from '@playwright/test';
import { login } from './helpers';

const PNG_1X1_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7Zx7cAAAAASUVORK5CYII=';

test('admin files can create an album and upload an image into it', async ({ page }) => {
  await login(page);
  await page.goto('/admin/files');

  const albumName = `E2E Album ${Date.now()}`;
  const fileName = `e2e-upload-${Date.now()}.png`;

  await page.getByPlaceholder(/album/i).fill(albumName);
  await page.getByRole('button', { name: /new album/i }).click();
  await expect(page.getByRole('button', { name: albumName })).toBeVisible();

  await page.getByRole('button', { name: albumName }).click();
  await page.locator('input[type="file"]').setInputFiles({
    name: fileName,
    mimeType: 'image/png',
    buffer: Buffer.from(PNG_1X1_BASE64, 'base64'),
  });

  await expect(page.getByText(fileName)).toBeVisible();
  await expect(page.getByText(/1 files|1 file|1 文件|1 photo/i)).toBeVisible();
});
