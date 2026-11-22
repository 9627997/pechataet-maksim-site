import {expect, test} from '@playwright/test';

test('expired 3+3 quote can be reissued after reload without losing a line draft @smoke', async ({
  page,
}) => {
  const oldToken = 'a'.repeat(48);
  const newToken = 'b'.repeat(48);
  const expiresAt = Math.floor(Date.now() / 1000) + 1800;
  const nextExpiry = expiresAt + 1800;
  const items = [
    ...[1, 2, 3].map((i) => ({
      itemId: 'ribbon-' + i,
      productType: 'ribbon',
      quantity: {meters: '25'},
      configuration: {
        widthMm: 15,
        repeatMm: 100,
        materialColor: '#f3eadc',
        printColor: '#171717',
      },
    })),
    ...[1, 2, 3].map((i) => ({
      itemId: 'sticker-' + i,
      productType: 'sticker',
      quantity: {pieces: '250'},
      configuration: {
        variantId: 'circle-25',
        shape: 'circle',
        widthMm: 25,
        heightMm: 25,
        cornerRadiusMm: null,
        printColor: '#171717',
        backgroundColor: '#ffffff',
      },
    })),
  ];
  let oldExpired = false;
  let issued = 0;
  await page.route('**/api/calc/', async (route) => {
    const body = route.request().postDataJSON();
    if (body.operation === 'issue') {
      issued++;
      expect(body.orderItems).toEqual(items);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'quote_issued',
          quoteId: newToken,
          expiresAt: nextExpiry,
          finalClientPrice: '2990.00',
          canSubmitOrder: false,
        }),
      });
      return;
    }
    if (body.operation === 'resolve' && body.quoteId === oldToken && oldExpired) {
      await route.fulfill({
        status: 410,
        contentType: 'application/json',
        body: '{"status":"rejected","code":"QUOTE_EXPIRED"}',
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'quote_resolved',
        orderItems: items,
        expiresAt: body.quoteId === oldToken ? expiresAt : nextExpiry,
        finalClientPrice: '2990.00',
        canSubmitOrder: false,
      }),
    });
  });

  await page.goto('/studio/?product=ribbon#quote=' + oldToken);
  await expect(page.locator('#linkedQuoteLines > li')).toHaveCount(6);
  await page.locator('#linkedQuoteLines > li').first().locator('button').first().click();
  await page.locator('#textInput').evaluate((input) => {
    input.value = 'ПЕРВАЯ ЛЕНТА';
    input.dispatchEvent(new Event('input', {bubbles: true}));
  });
  await page.evaluate(() =>
    window.PmQuoteHandoff.registerItemArtwork('ribbon-1', {
      previewSvg: '<svg><text>first-preview</text></svg>',
      printSvg: '<svg width="100mm" height="15mm"><text>first</text></svg>',
      previewPng: 'data:image/png;base64,AAAA',
    }),
  );
  oldExpired = true;
  await page.reload({waitUntil: 'domcontentloaded'});
  await expect(page.locator('#linkedQuoteSummary')).toHaveAttribute('data-status', 'invalid');
  await expect(page.locator('#linkedQuoteRenew')).toHaveText('Восстановить расчёт');
  await page.locator('#linkedQuoteRenew').click();
  await expect(page.locator('#linkedQuoteSummary')).toHaveAttribute('data-status', 'ready');
  await expect(page.locator('#linkedQuoteLines > li')).toHaveCount(6);
  await expect(page.locator('#textInput')).toHaveValue('ПЕРВАЯ ЛЕНТА');
  const recovered = await page.evaluate(() => {
    const api = window.PmQuoteHandoff;
    return {
      quoteId: api.augmentPayload({requestId: 'request-0000000001'}).quoteId,
      art: api.augmentPayload({requestId: 'request-0000000001'}).artifactsByItemId,
      expiry: api.getExpiresAt(),
    };
  });
  expect(issued).toBe(1);
  expect(recovered.quoteId).toBe(newToken);
  expect(recovered.expiry).toBe(nextExpiry);
  expect(Object.keys(recovered.art)).toEqual(['ribbon-1']);
  expect(recovered.art['ribbon-1'].printSvg).toContain('first');

  await page.reload({waitUntil: 'domcontentloaded'});
  await expect(page.locator('#linkedQuoteLines > li')).toHaveCount(6);
  await expect(page.locator('#textInput')).toHaveValue('ПЕРВАЯ ЛЕНТА');
  expect(await page.evaluate(() => window.PmQuoteHandoff.getArtworkCount())).toBe(1);
});

test('changed preliminary amount requires consent before replacing an active quote @smoke', async ({
  page,
}) => {
  const oldToken = 'c'.repeat(48);
  const newToken = 'd'.repeat(48);
  const items = [{
    itemId: 'ribbon-1',
    productType: 'ribbon',
    quantity: {meters: '25'},
    configuration: {
      widthMm: 15,
      repeatMm: 100,
      materialColor: '#f3eadc',
      printColor: '#171717',
    },
  }];
  const oldExpiresAt = Math.floor(Date.now() / 1000) + 1800;
  const newExpiresAt = oldExpiresAt + 1800;
  let mutateBasket = false;
  await page.route('**/api/calc/', async (route) => {
    const body = route.request().postDataJSON();
    const issue = body.operation === 'issue';
    const refreshed = body.quoteId === newToken || issue;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(issue ? {
        status: 'quote_issued',
        quoteId: newToken,
        expiresAt: newExpiresAt,
        finalClientPrice: '3490.00',
        canSubmitOrder: false,
      } : {
        status: 'quote_resolved',
        orderItems: mutateBasket && refreshed
          ? [{...items[0], quantity: {meters: '50'}}]
          : items,
        expiresAt: refreshed ? newExpiresAt : oldExpiresAt,
        finalClientPrice: refreshed ? '3490.00' : '2990.00',
        canSubmitOrder: false,
      }),
    });
  });
  await page.goto('/studio/?product=ribbon#quote=' + oldToken);
  await expect(page.locator('#linkedQuoteLines > li')).toHaveCount(1);
  await page.locator('#linkedQuoteLines > li button').first().click();
  await page.locator('#textInput').evaluate((input) => {
    input.value = 'МОЙ ДИЗАЙН';
    input.dispatchEvent(new Event('input', {bubbles: true}));
  });
  page.once('dialog', (dialog) => dialog.dismiss());
  await page.locator('#linkedQuoteRenew').click();
  await expect(page.locator('#linkedQuoteRenew')).toBeEnabled();
  expect(await page.evaluate(() => window.PmQuoteHandoff.getClientPrice())).toBe('2990.00');
  expect(await page.evaluate(() => history.state.pmQuoteId)).toBe(oldToken);

  mutateBasket = true;
  await page.locator('#linkedQuoteRenew').click();
  await expect(page.locator('#linkedQuoteRenew')).toBeEnabled();
  expect(await page.evaluate(() => history.state.pmQuoteId)).toBe(oldToken);

  mutateBasket = false;
  page.once('dialog', (dialog) => dialog.accept());
  await page.locator('#linkedQuoteRenew').click();
  await expect(page.locator('#linkedQuoteMessage')).toContainText('Новый предварительный расчёт подтверждён');
  expect(await page.evaluate(() => history.state.pmQuoteId)).toBe(newToken);
  expect(await page.evaluate(() => window.PmQuoteHandoff.getClientPrice())).toBe('3490.00');
  await expect(page.locator('#textInput')).toHaveValue('МОЙ ДИЗАЙН');
});
