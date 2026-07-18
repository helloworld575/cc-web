import { expect, test } from './fixtures';
import { login } from './helpers';

test('admin skills finder resolves grouped skill metadata', async ({ page }) => {
  await login(page);
  await page.goto('/admin/skills');

  await expect(page.getByText('Hierarchical skills')).toBeVisible();
  await expect(page.getByTestId('admin-skills-list-panel')).toBeVisible();
  await expect(page.getByTestId('admin-skills-list-scroll')).toBeVisible();
  await expect(page.getByTestId('admin-skill-detail-panel')).toBeVisible();
  await expect.poll(async () => {
    return page.getByRole('button', { name: /find-skills/i }).count();
  }).toBeGreaterThan(0);

  const listMetrics = await page.getByTestId('admin-skills-list-scroll').evaluate((element) => {
    const styles = window.getComputedStyle(element);
    return {
      overflowY: styles.overflowY,
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
    };
  });
  expect(listMetrics.overflowY).toBe('auto');
  expect(listMetrics.scrollHeight).toBeGreaterThan(listMetrics.clientHeight);

  const detailPosition = await page.getByTestId('admin-skill-detail-panel').evaluate((element) => {
    return window.getComputedStyle(element).position;
  });
  expect(detailPosition).toBe('sticky');

  await expect(page.getByTestId('admin-skill-list-item').first()).toBeVisible();
  const firstSkillMetrics = await page.getByTestId('admin-skill-list-item').first().evaluate((element) => ({
    height: element.getBoundingClientRect().height,
    descriptionCount: element.querySelectorAll('[data-testid="admin-skill-list-description"]').length,
  }));
  expect(firstSkillMetrics.height).toBeLessThan(96);
  expect(firstSkillMetrics.descriptionCount).toBe(0);

  await page.getByTestId('admin-skills-search').fill('article faq');
  await expect(page.getByText('article-faq')).toBeVisible();
  await expect(page.getByText('content / article / faq')).toBeVisible();

  await page.getByTestId('admin-skills-search').fill('find skills');
  await expect(page.getByText('find-skills')).toBeVisible();
  await expect(page.getByText('agent / skills / discovery')).toBeVisible();

  await page.getByRole('button', { name: /find-skills/i }).click();
  await expect(page.getByTestId('admin-skill-id')).toHaveValue('find-skills');
  await expect(page.getByTestId('admin-skill-body')).toBeVisible();

  await page.getByTestId('admin-skills-search').fill('content router');
  await expect(page.getByText('content-router')).toBeVisible();
  await page.getByRole('button', { name: /content-router/i }).click();
  await expect(page.getByTestId('admin-skill-role')).toHaveValue('router');
  await expect(page.getByTestId('admin-skill-mode')).toHaveValue('route');
  await expect(page.getByTestId('admin-skill-route-skill-0')).toHaveValue('article-faq');
  await expect(page.getByTestId('admin-skill-route-when-0')).toHaveValue(/FAQ/i);
});

test('subscription skill is a router with dedicated AI and security leaves', async ({ page }) => {
  await login(page);
  await page.goto('/admin/skills');

  await page.getByTestId('admin-skills-search').fill('subscription');
  await page.getByRole('button', { name: /^subscription\s+Knowledge/i }).click();
  await expect(page.getByTestId('admin-skill-id')).toHaveValue('subscription');
  await expect(page.getByTestId('admin-skill-role')).toHaveValue('router');
  await expect(page.getByTestId('admin-skill-mode')).toHaveValue('route');
  await expect(page.getByTestId('admin-skill-route-skill-0')).toHaveValue('subscription-ai');
  await expect(page.getByTestId('admin-skill-route-skill-1')).toHaveValue('subscription-security');

  await page.getByRole('button', { name: /^subscription-security\s+Knowledge/i }).click();
  await expect(page.getByTestId('admin-skill-id')).toHaveValue('subscription-security');
  await expect(page.getByTestId('admin-skill-role')).toHaveValue('leaf');
  await expect(page.getByTestId('admin-skill-mode')).toHaveValue('direct');

  await page.getByRole('button', { name: /^subscription-ai\s+Knowledge/i }).click();
  await expect(page.getByTestId('admin-skill-id')).toHaveValue('subscription-ai');
  await expect(page.getByTestId('admin-skill-role')).toHaveValue('leaf');
  await expect(page.getByTestId('admin-skill-mode')).toHaveValue('direct');
});
