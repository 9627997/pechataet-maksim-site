import { test, expect } from '@playwright/test';

// Contract test for the public preliminary quote UI; the real PHP endpoint
// is tested separately against the pinned server-only Pricing 2.0 exports.
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

async function mockCalc(page, receipts) {
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
    receipts.push(items);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'estimate',
        finalClientPrice: '700.00',
        currency: 'RUB',
        canSubmitOrder: false,
      }),
    });
  });
}

test('ribbon meter stepper, presets and invalid manual input @smoke', async ({
  page,
}) => {
  const receipts = [];
  await mockCalc(page, receipts);
  await page.goto('/calc/');
  await expect(page.locator('#lines .line')).toHaveCount(2);
  const ribbon = page.locator('#lines .line').first();
  const qty = ribbon.locator('[data-key="quantity"]');
  await expect(qty).toHaveAttribute('type', 'text');
  await expect(qty).toHaveAttribute('inputmode', 'numeric');
  await expect(qty).toHaveValue('25');
  await expect(page.locator('#result')).toHaveText('700 ₽');

  await ribbon.locator('[data-quantity-action="plus"]').click();
  await expect(qty).toHaveValue('30');
  await expect(page.locator('#result')).toHaveText('700 ₽');
  await ribbon.locator('[data-quantity-action="minus"]').click();
  await expect(qty).toHaveValue('25');

  await ribbon.locator('[data-quantity-preset="10"]').click();
  await expect(qty).toHaveValue('10');
  await expect(ribbon.locator('[data-quantity-preset="10"]')).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.locator('#result')).toHaveText('700 ₽');

  const previousRequests = receipts.length;
  await qty.fill('137');
  await expect(qty).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('#quote')).toBeDisabled();
  await expect(page.locator('#result')).toHaveText('—');
  await expect(ribbon.locator('.quantity-hint')).toContainText('с шагом 5 м');
  await page.waitForTimeout(600);
  expect(receipts.length).toBe(previousRequests);

  await qty.fill('135');
  await expect(qty).toHaveAttribute('aria-invalid', 'false');
  await expect(page.locator('#result')).toHaveText('700 ₽');
  expect(
    receipts.filter((items) => items.length === 2).at(-1)[0].quantity.meters,
  ).toBe('135');

  await ribbon.locator('[data-quantity-preset="5"]').click();
  await expect(qty).toHaveValue('5');
  await expect(ribbon.locator('[data-quantity-action="minus"]')).toBeDisabled();
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBeTruthy();
});

test('sticker stepper, 50-piece quantities, mixed basket and limits @smoke', async ({
  page,
}) => {
  const receipts = [];
  await mockCalc(page, receipts);
  await page.goto('/calc/');
  await expect(page.locator('#lines .line')).toHaveCount(2);
  const sticker = page.locator('#lines .line[data-type="sticker"]').first();
  await sticker.locator('.line-toggle').click();
  const qty = sticker.locator('[data-key="quantity"]');
  await expect(qty).toHaveValue('250');
  await sticker.locator('[data-quantity-action="plus"]').click();
  await expect(qty).toHaveValue('300');
  await sticker.locator('[data-quantity-preset="1000"]').click();
  await expect(qty).toHaveValue('1000');
  await expect(page.locator('#result')).toHaveText('700 ₽');

  await qty.fill('75');
  await expect(qty).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('#result')).toHaveText('—');
  await expect(page.locator('#quote')).toBeDisabled();
  await qty.fill('750');
  await expect(qty).toHaveAttribute('aria-invalid', 'false');
  await expect(page.locator('#result')).toHaveText('700 ₽');
  expect(
    receipts.filter((items) => items.length === 2).at(-1)[1].quantity.pieces,
  ).toBe('750');

  await page.locator('#ribbon').click();
  await page.locator('#ribbon').click();
  await page.locator('#sticker').click();
  await page.locator('#sticker').click();
  await expect(page.locator('#ribbon')).toBeDisabled();
  await expect(page.locator('#sticker')).toBeDisabled();
  await expect(page.locator('#lines .line')).toHaveCount(6);
  await expect(page.locator('#clientCompositionList li')).toHaveCount(6);
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBeTruthy();
});
