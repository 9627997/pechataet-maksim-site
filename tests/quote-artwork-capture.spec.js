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
  await expect(page.locator('#linkedQuoteSelect')).toHaveValue('ribbon-1');
  await expect(page.locator('#linkedQuoteLines')).toBeHidden();
  await expect(page.locator('#linkedQuoteNext')).toBeVisible();
  await expect(page.locator('#panel-upload')).toHaveClass(/active/);
  await expect(page.locator('#linkedQuoteSteps button')).toHaveCount(6);
  await expect(page.locator('#linkedQuoteSteps button').first()).toHaveAttribute('aria-current', 'step');
  const bounds = await page.locator('#linkedQuoteSummary').boundingBox();
  expect(bounds.height).toBeLessThan(page.viewportSize().height * 0.65);
  await page.locator('#linkedQuoteToggle').click();
  await expect(page.locator('#linkedQuoteLines')).toBeVisible();
  await page.locator('#linkedQuoteToggle').click();
  await expect(page.locator('#linkedQuoteLines')).toBeHidden();
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
  await expect(first.locator('button').first()).toHaveText('Редактируется эта позиция');
  await expect(first).toHaveAttribute('data-active', 'true');
  await expect(first.locator('button').nth(1)).toBeEnabled();
  await expect(second.locator('button').nth(1)).toBeDisabled();
  await page.locator('#textInput').evaluate((input) => {
    input.value = 'Первая лента';
    input.dispatchEvent(new Event('input', {bubbles: true}));
  });
  await expect(page.locator('#linkedQuoteProgress')).toHaveText('Готово макетов: 0 из 6');
  await expect(page.locator('#linkedEditorNotice')).toContainText('Макет изменён');
  await expect(page.locator('#linkedQuoteSteps button').first()).toContainText('!');
  await page.locator('#linkedQuoteSelect').selectOption('ribbon-2');
  await expect(second.locator('button').first()).toHaveText('Редактируется эта позиция');
  await page.locator('#textInput').evaluate((input) => {
    input.value = 'Вторая лента';
    input.dispatchEvent(new Event('input', {bubbles: true}));
  });
  await page.locator('#linkedQuoteSelect').selectOption('ribbon-1');
  await expect(page.locator('#textInput')).toHaveValue('Первая лента');
  expect(await page.evaluate(() => window.PmQuoteHandoff.getEditingItemId())).toBe('ribbon-1');

  // A reload is a real customer scenario. The private quote must re-resolve
  // and the tab-scoped item drafts and explicit item artwork must return.
  await page.reload({waitUntil: 'domcontentloaded'});
  await expect(page.locator('#linkedQuoteSummary')).toHaveAttribute('data-status', 'ready');
  await expect(page.locator('#linkedQuoteLines > li')).toHaveCount(6);
  await expect(page.locator('#textInput')).toHaveValue('Первая лента');
  expect(await page.evaluate(() => window.PmQuoteHandoff.getArtworkCount())).toBe(0);
  await expect(page.locator('#linkedEditorNotice')).toContainText('Макет изменён');
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
  await expect(page.locator('#linkedQuoteSelect')).toHaveValue('ribbon-1');
  await expect(page.locator('#linkedQuoteLines')).toBeHidden();
  await page.locator('#linkedQuoteNext').click();
  await expect(page.locator('#linkedEditorNotice')).toContainText('Добавьте надпись или логотип');
  const names = ['ALFA', 'BETA', 'GAMA', 'DELT', 'EPSI', 'ZETA'];
  for (let i = 0; i < orderItems.length; i++) {
    await expect.poll(() => page.evaluate(() => window.PmQuoteHandoff.getEditingItemId())).toBe(orderItems[i].itemId);
    await expect(page.locator('#panel-upload')).toHaveClass(/active/);
    await expect(page.locator('#textInput')).toBeVisible();
    await page.locator('#textInput').fill(names[i]);
    await expect(page.locator('body')).toHaveAttribute('data-artwork-valid', 'true');
    // The visible per-position capture uses the same production serializer.
    // Use the actual save-and-next button, not the handoff registration API.
    await page.locator('#linkedQuoteNext').click();
    await expect(page.locator('#linkedQuoteProgress')).toHaveText('Готово макетов: ' + (i + 1) + ' из 6', {timeout: 20000});
  }
  await expect(page.locator('#openOrder')).toBeVisible();
  await expect(page.locator('#linkedQuoteReview .linked-quote-review-card')).toHaveCount(6);
  await expect(page.locator('#linkedQuoteReview img')).toHaveCount(6);
  await expect(page.locator('#linkedQuoteReview')).toContainText('6 из 6');
  await expect(page.locator('#linkedQuoteReview')).toContainText(/2\s?990/);
  await page.locator('#linkedQuoteReview .linked-quote-review-card').first().locator('button').click();
  await expect(page.locator('#textInput')).toHaveValue('ALFA');
  await expect(page.locator('#linkedQuoteProgress')).toHaveText('Готово макетов: 6 из 6');
  await page.locator('#continueUpload').click();
  await expect(page.locator('#widthChoice')).toBeHidden();
  await expect(page.locator('#printColorSelect')).toBeHidden();
  await expect(page.locator('#repeatMm')).toBeHidden();
  await expect(page.locator('#panel-settings .next-panel')).toBeHidden();
  await page.locator('.nav-item[data-panel="upload"]').click();
  await page.locator('#textInput').fill('OMEGA');
  await expect(page.locator('#linkedQuoteProgress')).toHaveText('Готово макетов: 5 из 6');
  await expect(page.locator('#linkedEditorNotice')).toContainText('Макет изменён');
  await page.locator('#linkedQuoteNext').click();
  await expect(page.locator('#linkedQuoteReview img')).toHaveCount(6);
  names[0] = 'OMEGA';
  await page.locator('#openOrder').click();
  await expect(page.locator('#orderSummary')).toContainText('Изделий: 6');
  await expect(page.locator('#orderSummary')).toContainText('Макетов: 6');
  const artifacts = await page.evaluate(() => window.PmQuoteHandoff.augmentPayload({requestId: 'test-six-real-artifacts'}).artifactsByItemId);
  expect(Object.keys(artifacts)).toEqual(orderItems.map(item => item.itemId));
  expect(new Set(Object.values(artifacts).map(art => art.printSvg)).size).toBe(6);
  for (const [i, item] of orderItems.entries()) {
    expect(artifacts[item.itemId].previewSvg).toContain(names[i]);
    expect(artifacts[item.itemId].printSvg).toContain('<svg');
    expect(artifacts[item.itemId].previewPng).toMatch(/^data:image\/png;base64,/);
  }
});
