import { expect, test } from '@playwright/test';

// Server-controlled 3+3 snapshot. No private pricing model in browser tests.
const token = 'e'.repeat(48);
const items = [
  ...[0, 1, 2].map((i) => ({
    itemId: 'r-' + i,
    productType: 'ribbon',
    quantity: { meters: String(5 * (i + 1)) },
    configuration: {
      widthMm: i % 2 ? 20 : 15,
      repeatMm: 100,
      materialColor: '#f3eadc',
      printColor: '#171717',
    },
  })),
  ...[0, 1, 2].map((i) => ({
    itemId: 's-' + i,
    productType: 'sticker',
    quantity: { pieces: String(50 * (i + 1)) },
    configuration: {
      variantId: 'circle-25',
      shape: 'circle',
      widthMm: 25,
      heightMm: 25,
      cornerRadiusMm: null,
      printColor: '#171717',
      backgroundColor: '#b7202d',
    },
  })),
];

test('quote handoff carries the exact 3+3 basket without a URL price @smoke', async ({
  page,
}) => {
  await page.route('**/api/calc/', async (route) => {
    const body = route.request().postDataJSON();
    expect(body).toEqual({ operation: 'resolve', quoteId: token });
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'quote_resolved',
        orderItems: items,
        expiresAt: Math.floor(Date.now() / 1000) + 1800,
        finalClientPrice: '2490.00',
        currency: 'RUB',
        canSubmitOrder: false,
      }),
    });
  });
  await page.goto('/studio/?product=bundle#quote=' + token, {
    waitUntil: 'domcontentloaded',
  });
  await expect(page.locator('#linkedQuoteSummary')).toBeVisible();
  await expect(page.locator('#linkedQuoteSummary')).toHaveAttribute(
    'data-status',
    'ready',
  );
  await expect(page.locator('#linkedQuoteLines li')).toHaveCount(6);
  await expect(page.locator('#linkedQuoteMessage')).toContainText(
    'Макеты-образцы',
  );
  expect(page.url()).not.toContain('#quote=');
  const result = await page.evaluate(() => {
    const linked = window.PmQuoteHandoff;
    return {
      state: linked.getState(),
      items: linked.getItems(),
      payload: linked.augmentPayload({ requestId: 'legacy', pricing: { amount: 1 } }),
    };
  });
  expect(result.state).toBe('ready');
  expect(result.items).toEqual(items);
  expect(result.payload.orderItems).toEqual(items);
  expect(result.payload.quoteId).toBe(token);
  expect(result.payload.pricing.amount).toBeNull();
  expect(result.payload.pricing.requiresIndividualCalculation).toBe(true);
});

test('expired quote never silently becomes a legacy order @smoke', async ({
  page,
}) => {
  await page.route('**/api/calc/', (route) =>
    route.fulfill({
      status: 410,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'rejected', code: 'QUOTE_EXPIRED' }),
    }),
  );
  await page.goto('/studio/?product=bundle#quote=' + token, {
    waitUntil: 'domcontentloaded',
  });
  await expect(page.locator('#linkedQuoteSummary')).toHaveAttribute(
    'data-status',
    'invalid',
  );
  await expect(page.locator('#linkedQuoteMessage')).toContainText(
    'недействителен',
  );
  const attempt = await page.evaluate(() => {
    try {
      window.PmQuoteHandoff.augmentPayload({ requestId: 'legacy' });
      return 'unsafe_accept';
    } catch {
      return 'blocked';
    }
  });
  expect(attempt).toBe('blocked');
  expect(page.url()).not.toContain('#quote=');
});
