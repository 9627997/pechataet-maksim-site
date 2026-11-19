import { test, expect } from '@playwright/test';

const offers = [
  { type: 'ribbon', geometry: '15 mm', base: '#f3eadc', print: '#171717' },
  { type: 'sticker', geometry: 'circle-25', base: '#171717', print: '#b69249' },
];
while (offers.length < 124) offers.push(offers[offers.length % 2]);

test('UX 2.1.2 shows a real-time starter bundle, persistent total and editable lines @smoke', async ({
  page,
}) => {
  await page.route('**/api/calc/', async (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'catalog', offers }),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'estimate',
        finalClientPrice: '2290.00',
        canSubmitOrder: false,
      }),
    });
  });
  await page.goto('/calc/');
  await expect(page.locator('#configurator')).toBeVisible();
  await expect(page.locator('#lines .line')).toHaveCount(2);
  await expect(
    page.locator('#lines .line[data-type="ribbon"] [data-key="quantity"]'),
  ).toHaveValue('25');
  await expect(
    page.locator('#lines .line[data-type="sticker"] [data-key="quantity"]'),
  ).toHaveValue('250');
  await expect(page.locator('#emptyCart')).toBeHidden();
  await expect(page.locator('#result')).toHaveText(/2\s*290\s*₽/);
  await expect(page.locator('#mobileTotal')).toHaveText(/2\s*290\s*₽/);
  await expect(page.locator('#quotePanel')).toBeVisible();
  await expect(page.locator('#quote')).toBeHidden();
  await expect(page.locator('#shareTelegram')).toBeVisible();
  await expect(page.locator('#copySpec')).toBeVisible();
  await expect(page.locator('#studioNext')).toHaveAttribute(
    'href',
    '/studio/?product=bundle',
  );
  await expect(page.locator('.line-editor:visible')).toHaveCount(1);
  await expect(page.locator('#clientCompositionList li')).toHaveCount(2);
  for (let i = 0; i < 2; i++)
    await page
      .locator('#lines .line')
      .first()
      .locator('.line-tools button')
      .last()
      .click();
  await expect(page.locator('#lines .line')).toHaveCount(0);
  await expect(page.locator('#emptyCart')).toBeVisible();
  await expect(page.locator('#mobileTotalBar')).toBeHidden();
  await page.locator('#sticker').click();
  await expect(page.locator('#lines .line')).toHaveCount(1);
  await expect(page.locator('#result')).toHaveText(/2\s*290\s*₽/);
  await expect(page.locator('#studioNext')).toHaveAttribute(
    'href',
    '/studio/?product=sticker',
  );
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBeTruthy();
});

test('UX 2.1.2 shows a volume tip only when verified independent quotes reduce average price @smoke', async ({
  page,
}) => {
  await page.route('**/api/calc/', async (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'catalog', offers }),
      });
    }
    const items =
      JSON.parse(route.request().postData() || '{}').orderItems || [];
    let price = '2290.00';
    if (items.length === 1 && items[0].productType === 'ribbon') {
      price = Number(items[0].quantity.meters) >= 50 ? '1700.00' : '1000.00';
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'estimate',
        finalClientPrice: price,
        canSubmitOrder: false,
      }),
    });
  });
  await page.goto('/calc/');
  await expect(page.locator('#result')).toHaveText(/2\s*290\s*₽/);
  await expect(page.locator('#volumeTip')).toBeVisible({ timeout: 6000 });
  await expect(page.locator('#volumeTipText')).toContainText('50 м');
  await page.locator('#volumeTipApply').click();
  await expect(
    page.locator('#lines .line[data-type="ribbon"] [data-key="quantity"]'),
  ).toHaveValue('50');
  await expect(page.locator('#result')).toHaveText(/2\s*290\s*₽/);
});

test('UX 2.1.2 never invents a quantity discount when quote totals are equal @smoke', async ({
  page,
}) => {
  await page.route('**/api/calc/', async (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'catalog', offers }),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'estimate',
        finalClientPrice: '2290.00',
        canSubmitOrder: false,
      }),
    });
  });
  await page.goto('/calc/');
  await expect(page.locator('#result')).toHaveText(/2\s*290\s*₽/);
  await page.waitForTimeout(1600);
  await expect(page.locator('#volumeTip')).toBeHidden();
});

test('UX 2.1.2 exposes a clear catalog-unavailable state @smoke', async ({
  page,
}) => {
  await page.route('**/api/calc/', (route) =>
    route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'unavailable' }),
    }),
  );
  await page.goto('/calc/');
  await expect(page.locator('#catalogMessage')).toContainText(
    'Не удалось загрузить каталог',
  );
  await expect(page.locator('#ribbon')).toBeDisabled();
  await expect(page.locator('#sticker')).toBeDisabled();
  await expect(page.locator('#lines .line')).toHaveCount(0);
  await expect(page.locator('#quotePanel')).toBeHidden();
  await expect(page.locator('#mobileTotalBar')).toBeHidden();
});


test('UX accepts a changing catalog instead of requiring exactly 124 offers @smoke', async ({
  page,
}) => {
  const smallCatalog = offers.slice(0, 2);
  await page.route('**/api/calc/', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(
        route.request().method() === 'GET'
          ? { status: 'catalog', offers: smallCatalog }
          : {
              status: 'estimate',
              finalClientPrice: '1020.00',
              currency: 'RUB',
              canSubmitOrder: false,
            },
      ),
    }),
  );
  await page.goto('/calc/');
  await expect(page.locator('#lines .line')).toHaveCount(2);
  await expect(page.locator('#result')).toHaveText(/1\s*020\s*₽/);
  await expect(page.locator('#ribbon')).toBeEnabled();
  await expect(page.locator('#sticker')).toBeEnabled();
});

test('UX does not offer a product type absent from public catalog @smoke', async ({
  page,
}) => {
  await page.route('**/api/calc/', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(
        route.request().method() === 'GET'
          ? { status: 'catalog', offers: [offers[0]] }
          : {
              status: 'estimate',
              finalClientPrice: '490.00',
              currency: 'RUB',
              canSubmitOrder: false,
            },
      ),
    }),
  );
  await page.goto('/calc/');
  await expect(page.locator('#lines .line')).toHaveCount(1);
  await expect(page.locator('#ribbon')).toBeEnabled();
  await expect(page.locator('#sticker')).toBeDisabled();
  await expect(page.locator('#result')).toHaveText('490 ₽');
});
