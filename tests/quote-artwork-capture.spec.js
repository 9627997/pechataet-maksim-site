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
  const stableExpiresAt = Math.floor(Date.now() / 1000) + 1800;
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
          expiresAt: stableExpiresAt,
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
  ).toHaveCount(12);
  await expect(page.locator('#linkedQuoteProgress')).toHaveText(
    'Готово макетов: 0 из 6',
  );
  await expect(
    page.locator('#linkedQuoteLines > li').first().locator('button').nth(1),
  ).toBeDisabled();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true);
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
  await expect(page.locator('#linkedQuoteProgress')).toHaveText(
    'Готово макетов: 1 из 6',
  );
  await expect(page.locator('#linkedQuoteLines > li').first().locator('button').nth(1)).toHaveText(
    'Обновить макет позиции',
  );

  // New workspaces are separate editor sessions: switching lines must not
  // silently replace the first line's in-progress content with the second.
  const first = page.locator('#linkedQuoteLines > li').nth(0);
  const second = page.locator('#linkedQuoteLines > li').nth(1);
  await first.locator('button').first().click();
  await expect(first.locator('button').first()).toHaveText('Редактируется эта позиция');
  await expect(first).toHaveAttribute('data-active', 'true');
  await expect(first.locator('button').nth(1)).toBeEnabled();
  await expect(second.locator('button').nth(1)).toBeDisabled();
  await page.locator('#textInput').evaluate((input) => {
    input.value = 'Первая лента';
    input.dispatchEvent(new Event('input', {bubbles: true}));
  });
  await second.locator('button').first().click();
  await expect(second.locator('button').first()).toHaveText('Редактируется эта позиция');
  await page.locator('#textInput').evaluate((input) => {
    input.value = 'Вторая лента';
    input.dispatchEvent(new Event('input', {bubbles: true}));
  });
  await first.locator('button').first().click();
  await expect(page.locator('#textInput')).toHaveValue('Первая лента');
  expect(await page.evaluate(() => window.PmQuoteHandoff.getEditingItemId())).toBe('ribbon-1');

  // A reload is a real customer scenario. The private quote must re-resolve
  // and the tab-scoped item drafts and explicit item artwork must return.
  await page.reload({waitUntil: 'domcontentloaded'});
  await expect(page.locator('#linkedQuoteSummary')).toHaveAttribute('data-status', 'ready');
  await expect(page.locator('#linkedQuoteLines > li')).toHaveCount(6);
  await expect(page.locator('#textInput')).toHaveValue('Первая лента');
  expect(await page.evaluate(() => window.PmQuoteHandoff.getArtworkCount())).toBe(1);
  expect(await page.evaluate(() => window.PmQuoteHandoff.getEditingItemId())).toBe('ribbon-1');
});
