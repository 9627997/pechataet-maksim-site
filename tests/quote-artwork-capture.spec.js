import {expect, test} from '@playwright/test';

test('linked quote preserves six distinct artwork slots, no implicit cloning @smoke', async ({
  page,
}) => {
  const item = (type, index) =>
    type === 'ribbon'
      ? {
          itemId: `ribbon-${index}`,
          productType: 'ribbon',
          quantity: {meters: '25'},
          configuration: {
            widthMm: 15,
            repeatMm: 100,
            materialColor: '#f3eadc',
            printColor: '#171717',
          },
        }
      : {
          itemId: `sticker-${index}`,
          productType: 'sticker',
          quantity: {pieces: '250'},
          configuration: {
            variantId: 'circle-25',
            shape: 'circle',
            widthMm: 25,
            heightMm: 25,
            cornerRadiusMm: null,
            printColor: '#c6c8cd',
            backgroundColor: '#171717',
          },
        };
  const orderItems = [
    ...[1, 2, 3].map((index) => item('ribbon', index)),
    ...[1, 2, 3].map((index) => item('sticker', index)),
  ];
  await page.route('**/api/calc/', async (route) => {
    const body = route.request().postDataJSON();
    if (body?.operation === 'resolve') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'quote_resolved',
          orderItems,
          finalClientPrice: '2990.00',
          currency: 'RUB',
          expiresAt: Math.floor(Date.now() / 1000) + 1800,
          canSubmitOrder: false,
        }),
      });
    } else {
      await route.continue();
    }
  });
  await page.goto('/studio/?product=ribbon#quote=' + 'a'.repeat(48));
  await expect(page.locator('#linkedQuoteLines > li')).toHaveCount(6);
  await expect(
    page.locator('#linkedQuoteLines button'),
  ).toHaveCount(6);
  const results = await page.evaluate(() => {
    const api = window.PmQuoteHandoff;
    let unknownRejected = false;
    try {
      api.registerItemArtwork('not-in-quote', {
        previewSvg: '<svg/>',
        printSvg: '<svg/>',
        previewPng: 'data:image/png;base64,AAAA',
      });
    } catch {
      unknownRejected = true;
    }
    api.registerItemArtwork('ribbon-1', {
      previewSvg: '<svg/>',
      printSvg: '<svg/>',
      previewPng: 'data:image/png;base64,AAAA',
    });
    const result = api.augmentPayload({requestId: 'test-request-12345678'});
    return {
      unknownRejected,
      ids: api.getItems().map((entry) => entry.itemId),
      count: api.getArtworkCount(),
      attached: Object.keys(result.artifactsByItemId),
    };
  });
  expect(results.unknownRejected).toBe(true);
  expect(results.ids).toHaveLength(6);
  expect(results.count).toBe(1);
  expect(results.attached).toEqual(['ribbon-1']);
  await expect(page.locator('#linkedQuoteLines button').first()).toHaveText(
    'Обновить макет позиции',
  );
});
