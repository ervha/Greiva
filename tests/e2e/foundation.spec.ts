import { test, expect } from '@playwright/test';
test('STEP1-E2E: React client starts alongside API and collaboration services', async ({ page, request }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Greiva PoC' })).toBeVisible();
  await expect(page.getByLabel('同期状態')).toHaveText('サーバーと同期済み');
  for (const [port, service] of [[3000, 'api'], [1234, 'collaboration']] as const) {
    const response = await request.get(`http://127.0.0.1:${port}/health`);
    expect(response.ok()).toBe(true);
    expect(await response.json()).toEqual({ service, status: 'ok', implementationStep: service === 'collaboration' ? 4 : 1 });
  }
});
