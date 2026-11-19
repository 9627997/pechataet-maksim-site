import { test, expect } from '@playwright/test';

// Public temporary calculator: backend pricing is exercised by separate PHP tests.
const catalog = [
  { type: 'ribbon', geometry: '15 mm', base: '#f3eadc', print: '#171717' },
  { type: 'ribbon', geometry: '20 mm', base: '#b7202d', print: '#b69249' },
  { type: 'sticker', geometry: 'circle-25', base: '#171717', print: '#b69249' },
  {
    type: 'sticker',
    geometry: 'circle-40',
    base: 'transparent',
    print: '#c6c8cd',
  },
];
while (catalog.length < 124) catalog.push({ ...catalog[catalog.length % 4] });

test('public /calc/ preliminary quote and 3+3 limits @smoke', async ({
  page,
}) => {
  await page.route('**/api/calc/', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'catalog', offers: catalog }),
      });
      return;
    }
    const items =
      JSON.parse(route.request().postData() || '{}').orderItems || [];
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'estimate',
        finalClientPrice: items.length === 1 ? '700.00' : '2800.00',
        currency: 'RUB',
        canSubmitOrder: false,
      }),
    });
  });
  await page.goto('/calc/');
  await expect(page.locator('#lines .line')).toHaveCount(2);
  await expect(page.locator('#result')).toHaveText(/2\s*800\s*₽/);
  await expect(page.locator('#clientCompositionList li')).toHaveCount(2);
  await expect(
    page.locator('#lines .line[data-type="ribbon"] [data-key="quantity"]'),
  ).toHaveValue('25');
  await expect(
    page.locator('#lines .line[data-type="sticker"] [data-key="quantity"]'),
  ).toHaveValue('250');
  await page.locator('#ribbon').click();
  await page.locator('#ribbon').click();
  await expect(page.locator('#ribbon')).toBeDisabled();
  await page.locator('#sticker').click();
  await page.locator('#sticker').click();
  await expect(page.locator('#sticker')).toBeDisabled();
  await expect(page.locator('#lines .line')).toHaveCount(6);
  await expect(page.locator('#clientCompositionList li')).toHaveCount(6);
  await expect(page.locator('#result')).toHaveText(/2\s*800\s*₽/);
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBeTruthy();
  await expect(page.locator('body')).not.toContainText(
    'Создать макеты всех изделий в Studio',
  );
});
