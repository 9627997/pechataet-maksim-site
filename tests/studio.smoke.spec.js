import { expect, test } from '@playwright/test';

test('Studio opens without console errors or horizontal scrolling', async ({
  page,
}, testInfo) => {
  const runtimeErrors = [];

  page.on('console', (message) => {
    if (message.type() === 'error') {
      runtimeErrors.push(`console.error: ${message.text()}`);
    }
  });
  page.on('pageerror', (error) => {
    runtimeErrors.push(`pageerror: ${error.message}`);
  });

  await page.goto('/studio/', { waitUntil: 'networkidle' });

  await expect(page.locator('main.studio')).toBeVisible();

  const overflow = await page.evaluate(() => ({
    documentElement: {
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    },
    body: {
      clientWidth: document.body.clientWidth,
      scrollWidth: document.body.scrollWidth,
    },
  }));

  expect(overflow.documentElement.scrollWidth).toBeLessThanOrEqual(
    overflow.documentElement.clientWidth,
  );
  expect(overflow.body.scrollWidth).toBeLessThanOrEqual(
    overflow.body.clientWidth,
  );
  expect(runtimeErrors).toEqual([]);

  await page.screenshot({
    path: `playwright-screenshots/studio-${testInfo.project.name}.png`,
    fullPage: true,
  });
});

test('mobile product switches control the static previews', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile');

  const runtimeErrors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') runtimeErrors.push(message.text());
  });
  page.on('pageerror', (error) => runtimeErrors.push(error.message));

  await page.goto('/studio/', { waitUntil: 'networkidle' });

  const panel = page.locator('.mobile-products-panel');
  const ribbonSwitch = page.getByRole('switch', { name: 'Лента' });
  const stickerSwitch = page.getByRole('switch', { name: 'Стикер' });
  const ribbonSample = page.locator('[data-mobile-product-sample="ribbon"]');
  const stickerSample = page.locator('[data-mobile-product-sample="sticker"]');

  await expect(panel).toBeVisible();
  await expect(ribbonSwitch).toBeChecked();
  await expect(stickerSwitch).toBeChecked();
  await expect(ribbonSample).toBeVisible();
  await expect(stickerSample).toBeVisible();

  await ribbonSwitch.uncheck();
  await expect(ribbonSample).toBeHidden();
  await expect(stickerSample).toBeVisible();

  await stickerSwitch.uncheck();
  await expect(stickerSwitch).not.toBeChecked();
  await expect(ribbonSwitch).toBeChecked();
  await expect(stickerSample).toBeHidden();
  await expect(ribbonSample).toBeVisible();

  await ribbonSwitch.uncheck();
  await expect(ribbonSwitch).not.toBeChecked();
  await expect(stickerSwitch).toBeChecked();
  await expect(ribbonSample).toBeHidden();
  await expect(stickerSample).toBeVisible();

  const hasHorizontalOverflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth >
        document.documentElement.clientWidth ||
      document.body.scrollWidth > document.body.clientWidth,
  );

  expect(hasHorizontalOverflow).toBe(false);
  expect(runtimeErrors).toEqual([]);
});

test('mobile previews stay synchronized with Studio state', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile');

  const runtimeErrors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') runtimeErrors.push(message.text());
  });
  page.on('pageerror', (error) => runtimeErrors.push(error.message));

  await page.goto('/studio/', { waitUntil: 'networkidle' });

  const ribbonSurface = page.locator('.mobile-products-ribbon-sample');
  const ribbonLogo = page.locator('.mobile-products-ribbon-logo');
  const stickerLogo = page.locator('.mobile-products-sticker-logo');
  const ribbonText = page.locator('.mobile-products-ribbon-text');
  const stickerText = page.locator('.mobile-products-sticker-text');
  const stickerContent = page.locator('.mobile-products-sticker-content');

  await expect(ribbonLogo).toBeVisible();
  await expect(stickerLogo).toBeVisible();
  await expect(ribbonText).toHaveText('ленты по любви');
  await expect(stickerText).toHaveText('ленты по любви');
  await expect(stickerContent).toHaveAttribute(
    'data-mobile-products-mode',
    'logo-and-text',
  );

  await page.locator('#textInput').fill('новая длинная надпись для упаковки');
  await expect(ribbonText).toHaveText('новая длинная надпись для упаковки');
  await expect(stickerText).toHaveText('новая длинная надпись для упаковки');

  await page.locator('#fontSelect').selectOption('Georgia');
  await expect(ribbonText).toHaveCSS('font-family', 'Georgia');
  await expect(stickerText).toHaveCSS('font-family', 'Georgia');

  await page.locator('.nav-item[data-panel="settings"]').click();
  await page.locator('#printChoice button[data-value="#b69249"]').click();
  await expect(ribbonText).toHaveCSS('color', 'rgb(182, 146, 73)');
  await expect(stickerText).toHaveCSS('color', 'rgb(182, 146, 73)');

  await page.locator('#ribbonSwatches button[title="Красный"]').click();
  await expect(ribbonSurface).toHaveCSS('background-color', 'rgb(183, 32, 45)');

  const initialFontSize = await stickerText.evaluate(
    (element) => getComputedStyle(element).fontSize,
  );
  await page.locator('#fontSize').evaluate((element) => {
    element.value = '64';
    element.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await expect
    .poll(() =>
      stickerText.evaluate((element) => getComputedStyle(element).fontSize),
    )
    .not.toBe(initialFontSize);

  const initialLogoWidth = await stickerLogo.evaluate(
    (element) => element.getBoundingClientRect().width,
  );
  await page.locator('#logoScale').evaluate((element) => {
    element.value = '150';
    element.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await expect
    .poll(() =>
      stickerLogo.evaluate((element) => element.getBoundingClientRect().width),
    )
    .toBeGreaterThan(initialLogoWidth);

  await page.locator('.nav-item[data-panel="upload"]').click();
  await page.locator('#textInput').fill('');
  await expect(stickerContent).toHaveAttribute(
    'data-mobile-products-mode',
    'logo-only',
  );
  await expect(stickerLogo).toBeVisible();
  await expect(stickerText).toBeHidden();

  await page.locator('#textInput').fill('текст в центре с переносом слов');
  await page.locator('#macroLogoImage').evaluate((element) => {
    element.hidden = true;
  });
  await expect(stickerContent).toHaveAttribute(
    'data-mobile-products-mode',
    'text-only',
  );
  await expect(stickerLogo).toBeHidden();
  await expect(stickerText).toBeVisible();

  await page.locator('#macroLogoImage').evaluate((element) => {
    element.hidden = false;
  });
  await expect(stickerContent).toHaveAttribute(
    'data-mobile-products-mode',
    'logo-and-text',
  );

  for (const selector of [
    '.mobile-products-ribbon-logo',
    '.mobile-products-ribbon-text',
    '.mobile-products-sticker-logo',
    '.mobile-products-sticker-text',
  ]) {
    const geometry = await page.locator(selector).evaluate((element) => {
      const bounds = element.getBoundingClientRect();
      const safeBounds = element.parentElement.getBoundingClientRect();
      return {
        bounds: bounds.toJSON(),
        safeBounds: safeBounds.toJSON(),
        inside:
          bounds.left >= safeBounds.left - 1 &&
          bounds.right <= safeBounds.right + 1 &&
          bounds.top >= safeBounds.top - 1 &&
          bounds.bottom <= safeBounds.bottom + 1,
      };
    });
    expect(
      geometry.inside,
      `${selector} must stay inside its safe zone: ${JSON.stringify(geometry)}`,
    ).toBe(true);
  }

  const stickerContentInsideCircle = await stickerContent.evaluate(
    (element) => {
      const bounds = element.getBoundingClientRect();
      const circle = element.parentElement.getBoundingClientRect();
      return (
        bounds.left >= circle.left &&
        bounds.right <= circle.right &&
        bounds.top >= circle.top &&
        bounds.bottom <= circle.bottom
      );
    },
  );
  expect(stickerContentInsideCircle).toBe(true);

  const hasHorizontalOverflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth >
        document.documentElement.clientWidth ||
      document.body.scrollWidth > document.body.clientWidth,
  );
  expect(hasHorizontalOverflow).toBe(false);
  expect(runtimeErrors).toEqual([]);
});

test('mobile product block is absent from the desktop layout', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop');

  await page.goto('/studio/', { waitUntil: 'networkidle' });

  const panel = page.locator('.mobile-products-panel');
  await expect(panel).toBeHidden();
  await expect(panel).toHaveCSS('display', 'none');
  await expect(page.locator('main.studio')).toBeVisible();
});
