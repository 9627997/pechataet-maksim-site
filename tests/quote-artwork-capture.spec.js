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
  await expect(page.locator('#linkedQuoteLines button')).toHaveCount(6);
  await expect(page.locator('#linkedQuoteLines > li').first()).toHaveAttribute('data-active', 'true');
  await expect(page.locator('#linkedQuoteActive')).toContainText('Макет 1 из 6');
  await expect(page.locator('#linkedQuoteActive')).toContainText('молочный');
  await expect(page.locator('#linkedQuoteActive')).not.toContainText('#f3eadc');
  await expect(page.locator('#panel-upload #linkedQuoteNext')).toHaveCount(1);
  await expect(page.locator('#linkedQuoteProgress')).toHaveText(
    'Готово макетов: 0 из 6',
  );
  await expect(page.locator('#linkedQuoteJump')).toBeVisible();
  expect(await page.locator('#linkedQuoteSummary').evaluate(el => el.getBoundingClientRect().height)).toBeLessThan(320);
  await page.locator('#linkedQuoteJump').click();
  await expect(page.locator('#textInput')).toBeInViewport();
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
  await expect(page.locator('#linkedQuoteLines > li').first()).toHaveAttribute('data-saved', 'true');

  // New workspaces are separate editor sessions: switching lines must not
  // silently replace the first line's in-progress content with the second.
  const first = page.locator('#linkedQuoteLines > li').nth(0);
  const second = page.locator('#linkedQuoteLines > li').nth(1);
  await first.locator('button').first().click();
  await expect(first.locator('button').first()).toHaveAttribute('aria-current', 'step');
  await expect(first).toHaveAttribute('data-active', 'true');
  await expect(page.locator('#linkedQuoteNext')).toBeEnabled();
  await page.locator('#textInput').evaluate((input) => {
    input.value = 'Первая лента';
    input.dispatchEvent(new Event('input', {bubbles: true}));
  });
  await second.locator('button').first().click();
  await expect(second.locator('button').first()).toHaveAttribute('aria-current', 'step');
  await expect(page.locator('#linkedQuoteActive')).toContainText('Макет 2 из 6');
  await expect(page.locator('#textInput')).toBeInViewport();
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


test('save and next creates six real distinct print artifacts @smoke', async ({page}) => {
  test.setTimeout(120000);
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
  const orderItems = [1, 2, 3].flatMap(index => [item('ribbon', index), item('sticker', index)]);
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
  await expect(page.locator('#linkedQuoteLines > li').first()).toHaveAttribute('data-active', 'true');
  await page.locator('#linkedQuoteJump').click();
  await page.locator('#linkedQuoteNext').click();
  await expect(page.locator('#linkedQuoteEditorFeedback')).toBeVisible();
  await expect(page.locator('#linkedQuoteEditorFeedback')).toContainText('Добавьте надпись или логотип');
  await expect(page.locator('#linkedQuoteProgress')).toHaveText('Готово макетов: 0 из 6');
  await page.locator('#linkedQuoteJump').click();
  const names = ['ALFA', 'BETA', 'GAMA', 'DELT', 'EPSI', 'ZETA'];
  for (let i = 0; i < orderItems.length; i++) {
    await expect.poll(() => page.evaluate(() => window.PmQuoteHandoff.getEditingItemId())).toBe(orderItems[i].itemId);
    await expect(page.locator('#panel-upload')).toBeVisible();
    await expect(page.locator('#linkedQuoteActive')).toContainText('Макет ' + (i + 1) + ' из 6');
    await expect(page.locator('#textInput')).toBeInViewport();
    await page.locator('#textInput').click();
    await page.locator('#textInput').fill(names[i]);
    await expect(page.locator('body')).toHaveAttribute('data-artwork-valid', 'true');
    // The visible per-position capture uses the same production serializer.
    // Use the actual save-and-next button, not the handoff registration API.
    await page.locator('#linkedQuoteNext').click();
    await expect(page.locator('#linkedQuoteProgress')).toHaveText('Готово макетов: ' + (i + 1) + ' из 6', {timeout: 20000});
  }
  await expect(page.locator('#panel-order')).toBeVisible();
  await expect(page.locator('#openOrder')).toBeVisible();
  const artifacts = await page.evaluate(() => window.PmQuoteHandoff.augmentPayload({requestId: 'test-six-real-artifacts'}).artifactsByItemId);
  expect(Object.keys(artifacts)).toEqual(orderItems.map(item => item.itemId));
  expect(new Set(Object.values(artifacts).map(art => art.printSvg)).size).toBe(6);
  for (const [i, item] of orderItems.entries()) {
    expect(artifacts[item.itemId].previewSvg).toContain(names[i]);
    expect(artifacts[item.itemId].printSvg).toContain('<svg');
    expect(artifacts[item.itemId].previewPng).toMatch(/^data:image\/png;base64,/);
  }
});
