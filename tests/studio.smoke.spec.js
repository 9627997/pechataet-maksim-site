import { expect, test } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const fixturePath = (name) =>
  fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url));

const watchRuntimeErrors = (page) => {
  const errors = [];
  page.on('console', (message) => {
    if (message.type() === 'error')
      errors.push(`console.error: ${message.text()}`);
  });
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  return errors;
};

const expectNoHorizontalOverflow = async (page) => {
  const hasOverflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth >
        document.documentElement.clientWidth ||
      document.body.scrollWidth > document.body.clientWidth,
  );
  expect(hasOverflow).toBe(false);
};

const expectMobileLogosToMatch = async (page, expectedSrc) => {
  for (const selector of [
    '.mobile-products-ribbon-logo',
    '.mobile-products-sticker-logo',
  ]) {
    const logo = page.locator(selector);
    await expect(logo).toBeVisible();
    await expect.poll(() => logo.getAttribute('src')).toBe(expectedSrc);
  }
};

const expectInterfaceResponsive = async (page) => {
  const ribbonSwitch = page.getByRole('switch', { name: 'Лента' });
  const ribbonSample = page.locator('[data-mobile-product-sample="ribbon"]');
  await ribbonSwitch.uncheck();
  await expect(ribbonSample).toBeHidden();
  await ribbonSwitch.check();
  await expect(ribbonSample).toBeVisible();
};

const readContentSnapshot = async (page) =>
  JSON.parse(await page.locator('body').getAttribute('data-studio-content'));

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

test('legacy Studio content migrates to common content', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile');

  const runtimeErrors = watchRuntimeErrors(page);
  const svgSource =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 10"><path fill="#000" d="M0 0h20v10H0z"/></svg>';
  const logoData = `data:image/svg+xml;base64,${Buffer.from(svgSource).toString('base64')}`;
  await page.addInitScript(
    ({ source, data }) => {
      if (sessionStorage.getItem('legacy-content-seeded')) return;
      sessionStorage.setItem('legacy-content-seeded', 'true');
      localStorage.setItem(
        'ribbon-studio-v042',
        JSON.stringify({
          text: 'старый общий текст',
          logo: { data, ratio: 2 },
          logoType: 'svg',
          logoSvgSource: source,
          originalRaster: null,
          traceInfo: null,
        }),
      );
    },
    { source: svgSource, data: logoData },
  );

  await page.goto('/studio/', { waitUntil: 'networkidle' });

  let snapshot = await readContentSnapshot(page);
  expect(snapshot.text).toEqual({
    common: 'старый общий текст',
    ribbon: { mode: 'inherit' },
    sticker: { mode: 'inherit' },
    resolvedRibbon: 'старый общий текст',
    resolvedSticker: 'старый общий текст',
  });
  expect(snapshot.logo.common).toMatchObject({
    hasLogo: true,
    ratio: 2,
    logoType: 'svg',
    hasSvgSource: true,
  });
  expect(snapshot.logo.ribbon).toEqual({ mode: 'inherit' });
  expect(snapshot.logo.sticker).toEqual({ mode: 'inherit' });
  expect(snapshot.logo.resolvedRibbon).toEqual(snapshot.logo.common);
  expect(snapshot.logo.resolvedSticker).toEqual(snapshot.logo.common);

  await expect(page.locator('#macroLogoText')).toHaveText('старый общий текст');
  await expect(page.locator('#macroStickerText')).toHaveText(
    'старый общий текст',
  );
  await expect
    .poll(() => page.locator('#macroLogoImage').getAttribute('src'))
    .toBe(await page.locator('#macroStickerImage').getAttribute('src'));

  await page.reload({ waitUntil: 'networkidle' });
  snapshot = await readContentSnapshot(page);
  expect(snapshot.text.common).toBe('старый общий текст');
  expect(snapshot.text.ribbon).toEqual({ mode: 'inherit' });
  expect(snapshot.text.sticker).toEqual({ mode: 'inherit' });
  expect(snapshot.logo.common).toMatchObject({
    hasLogo: true,
    ratio: 2,
    logoType: 'svg',
    hasSvgSource: true,
  });

  await expectNoHorizontalOverflow(page);
  expect(runtimeErrors).toEqual([]);
});

test('content overrides normalize, resolve, persist, and reset', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile');

  const runtimeErrors = watchRuntimeErrors(page);
  const svgSource =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 10"><path fill="#000" d="M0 0h30v10H0z"/></svg>';
  const logoData = `data:image/svg+xml;base64,${Buffer.from(svgSource).toString('base64')}`;
  await page.addInitScript(
    ({ source, data }) => {
      if (sessionStorage.getItem('content-overrides-seeded')) return;
      sessionStorage.setItem('content-overrides-seeded', 'true');
      localStorage.setItem(
        'ribbon-studio-v042',
        JSON.stringify({
          text: 'legacy alias must follow common',
          content: {
            logo: {
              common: {
                logo: { data, ratio: 3 },
                logoType: 'svg',
                logoSvgSource: source,
                originalRaster: null,
                traceInfo: null,
              },
              ribbon: { mode: 'override', value: null },
              sticker: { mode: 'unknown', value: null },
            },
            text: {
              common: 'новый общий текст',
              ribbon: { mode: 'override', value: '' },
              sticker: { mode: 'unknown', value: 'не использовать' },
            },
          },
        }),
      );
    },
    { source: svgSource, data: logoData },
  );

  await page.goto('/studio/', { waitUntil: 'networkidle' });

  let snapshot = await readContentSnapshot(page);
  expect(snapshot.text.common).toBe('новый общий текст');
  expect(snapshot.text.ribbon).toEqual({ mode: 'override', value: '' });
  expect(snapshot.text.sticker).toEqual({ mode: 'inherit' });
  expect(snapshot.text.resolvedRibbon).toBe('');
  expect(snapshot.text.resolvedSticker).toBe('новый общий текст');
  expect(snapshot.logo.ribbon).toEqual({ mode: 'override', value: null });
  expect(snapshot.logo.sticker).toEqual({ mode: 'inherit' });
  expect(snapshot.logo.resolvedRibbon).toBeNull();
  expect(snapshot.logo.resolvedSticker).toEqual(snapshot.logo.common);

  await expect(page.locator('#textInput')).toHaveValue('новый общий текст');
  await expect(page.locator('#macroLogoText')).toBeHidden();
  await expect(page.locator('#macroStickerText')).toHaveText(
    'новый общий текст',
  );
  await expect(page.locator('.mobile-products-ribbon-text')).toBeHidden();
  await expect(page.locator('.mobile-products-sticker-text')).toHaveText(
    'новый общий текст',
  );
  await expect
    .poll(() => page.locator('#macroLogoImage').getAttribute('src'))
    .toBe(await page.locator('#macroStickerImage').getAttribute('src'));

  await page.reload({ waitUntil: 'networkidle' });
  snapshot = await readContentSnapshot(page);
  expect(snapshot.text.ribbon).toEqual({ mode: 'override', value: '' });
  expect(snapshot.text.resolvedRibbon).toBe('');
  expect(snapshot.text.resolvedSticker).toBe('новый общий текст');
  expect(snapshot.logo.ribbon).toEqual({ mode: 'override', value: null });
  expect(snapshot.logo.resolvedRibbon).toBeNull();
  await expect(page.locator('#macroLogoText')).toBeHidden();
  await expect(page.locator('#macroStickerText')).toHaveText(
    'новый общий текст',
  );

  await page.locator('#resetProject').click();
  await page.waitForLoadState('networkidle');
  snapshot = await readContentSnapshot(page);
  expect(snapshot.text.ribbon).toEqual({ mode: 'inherit' });
  expect(snapshot.text.sticker).toEqual({ mode: 'inherit' });
  expect(snapshot.logo.ribbon).toEqual({ mode: 'inherit' });
  expect(snapshot.logo.sticker).toEqual({ mode: 'inherit' });
  expect(snapshot.text.resolvedRibbon).toBe(snapshot.text.common);
  expect(snapshot.text.resolvedSticker).toBe(snapshot.text.common);

  await expectNoHorizontalOverflow(page);
  expect(runtimeErrors).toEqual([]);
});

test('resolved product text stays independent from common editing', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile');

  const runtimeErrors = watchRuntimeErrors(page);
  await page.addInitScript(() => {
    if (sessionStorage.getItem('resolved-text-seeded')) return;
    sessionStorage.setItem('resolved-text-seeded', 'true');
    localStorage.setItem(
      'ribbon-studio-v042',
      JSON.stringify({
        text: 'общий текст',
        content: {
          logo: {
            common: null,
            ribbon: { mode: 'inherit' },
            sticker: { mode: 'inherit' },
          },
          text: {
            common: 'общий текст',
            ribbon: { mode: 'inherit' },
            sticker: { mode: 'override', value: 'только стикер' },
          },
        },
      }),
    );
  });

  await page.goto('/studio/', { waitUntil: 'networkidle' });

  const textInput = page.locator('#textInput');
  const macroRibbonText = page.locator('#macroLogoText');
  const macroStickerText = page.locator('#macroStickerText');
  const mobileRibbonText = page.locator('.mobile-products-ribbon-text');
  const mobileStickerText = page.locator('.mobile-products-sticker-text');

  await expect(textInput).toHaveValue('общий текст');
  await expect(macroRibbonText).toHaveText('общий текст');
  await expect(macroStickerText).toHaveText('только стикер');
  await expect(mobileRibbonText).toHaveText('общий текст');
  await expect(mobileStickerText).toHaveText('только стикер');

  const contentEvent = page.evaluate(
    () =>
      new Promise((resolve) => {
        document.addEventListener(
          'studio:content-state-updated',
          (event) => resolve(event.detail),
          { once: true },
        );
      }),
  );
  await textInput.fill('обновлённый общий');
  expect(await contentEvent).toEqual({
    text: {
      common: 'обновлённый общий',
      ribbon: { mode: 'inherit', resolved: 'обновлённый общий' },
      sticker: { mode: 'override', resolved: 'только стикер' },
    },
  });
  await expect(macroRibbonText).toHaveText('обновлённый общий');
  await expect(macroStickerText).toHaveText('только стикер');
  await expect(mobileRibbonText).toHaveText('обновлённый общий');
  await expect(mobileStickerText).toHaveText('только стикер');

  let snapshot = await readContentSnapshot(page);
  expect(snapshot.text.common).toBe('обновлённый общий');
  expect(snapshot.text.ribbon).toEqual({ mode: 'inherit' });
  expect(snapshot.text.sticker).toEqual({
    mode: 'override',
    value: 'только стикер',
  });

  await page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem('ribbon-studio-v042'));
    saved.content.text.ribbon = {
      mode: 'override',
      value: 'только лента',
    };
    localStorage.setItem('ribbon-studio-v042', JSON.stringify(saved));
  });
  await page.reload({ waitUntil: 'networkidle' });

  snapshot = await readContentSnapshot(page);
  expect(snapshot.text.ribbon).toEqual({
    mode: 'override',
    value: 'только лента',
  });
  expect(snapshot.text.sticker).toEqual({
    mode: 'override',
    value: 'только стикер',
  });
  await expect(textInput).toHaveValue('обновлённый общий');
  await expect(macroRibbonText).toHaveText('только лента');
  await expect(macroStickerText).toHaveText('только стикер');
  await expect(mobileRibbonText).toHaveText('только лента');
  await expect(mobileStickerText).toHaveText('только стикер');

  await page.locator('[data-mobile-products-safe-zone="ribbon-text"]').click();
  await expect(textInput).toBeFocused();
  await page.locator('[data-mobile-products-safe-zone="sticker-text"]').click();
  await expect(textInput).toBeFocused();

  await expectNoHorizontalOverflow(page);
  expect(runtimeErrors).toEqual([]);
});

test('Studio navigation follows the three-step flow', async ({ page }) => {
  const runtimeErrors = watchRuntimeErrors(page);
  await page.goto('/studio/', { waitUntil: 'networkidle' });

  const navigation = page.locator('.main-nav');
  const items = navigation.locator('.nav-item');
  const expectedItems = [
    { number: '01', label: 'Создать', panel: 'upload' },
    { number: '02', label: 'Настроить', panel: 'settings' },
    { number: '03', label: 'Получить', panel: 'order' },
  ];

  await expect(items).toHaveCount(3);
  await expect(navigation.locator('[data-panel="bundle"]')).toHaveCount(0);

  for (const [index, expected] of expectedItems.entries()) {
    const item = items.nth(index);
    await expect(item).toHaveAttribute('data-panel', expected.panel);
    await expect(item.locator('span')).toHaveText(expected.number);
    await expect(item).toContainText(expected.label);
  }

  const widths = await items.evaluateAll((elements) =>
    elements.map((element) => element.getBoundingClientRect().width),
  );
  expect(Math.max(...widths) - Math.min(...widths)).toBeLessThanOrEqual(1);

  await expect(page.locator('#panel-bundle')).toHaveCount(1);
  await expect(page.locator('#panel-bundle')).toBeHidden();
  await expect(page.locator('#bundleChoice')).toHaveCount(1);

  await page.locator('#logoInput').setInputFiles(fixturePath('test-logo.svg'));
  const continueUpload = page.locator('#continueUpload');
  await expect(continueUpload).toBeEnabled();
  await expect(continueUpload).toHaveAttribute('data-next', 'settings');
  await continueUpload.click();

  await expect(page.locator('#panel-settings')).toBeVisible();
  await expect(navigation.locator('[data-panel="settings"]')).toHaveClass(
    /active/,
  );
  await expect(page.locator('#panel-bundle')).toBeHidden();

  const continueSettings = page.locator('#panel-settings .next-panel');
  await expect(continueSettings).toHaveAttribute('data-next', 'order');
  await continueSettings.click();
  await expect(page.locator('#panel-order')).toBeVisible();
  await expect(navigation.locator('[data-panel="order"]')).toHaveClass(
    /active/,
  );

  for (const panel of ['upload', 'settings', 'order']) {
    await navigation.locator(`[data-panel="${panel}"]`).click();
    await expect(page.locator(`#panel-${panel}`)).toBeVisible();
    await expect(navigation.locator(`[data-panel="${panel}"]`)).toHaveClass(
      /active/,
    );
    await expect(page.locator('#panel-bundle')).toBeHidden();
  }

  await expectNoHorizontalOverflow(page);
  expect(runtimeErrors).toEqual([]);
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

test('mobile product switches control order quantities and price', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile');

  const runtimeErrors = watchRuntimeErrors(page);
  await page.goto('/studio/', { waitUntil: 'networkidle' });

  const ribbonSwitch = page.getByRole('switch', { name: 'Лента' });
  const stickerSwitch = page.getByRole('switch', { name: 'Стикер' });
  const meters = page.locator('#meters');
  const stickerQty = page.locator('#stickerQty');
  const totalPrice = page.locator('#totalPrice');

  await expect(ribbonSwitch).toBeChecked();
  await expect(stickerSwitch).toBeChecked();
  await expect(page.locator('body')).toHaveAttribute('data-has-ribbon', 'true');
  await expect(page.locator('body')).toHaveAttribute(
    'data-has-sticker',
    'true',
  );
  await expect(meters).toHaveValue('100');
  await expect(stickerQty).toHaveValue('100');
  await expect(totalPrice).toHaveText(/1\s790\s₽/);

  await page.locator('.nav-item[data-panel="order"]').click();
  await meters.selectOption('25');
  await stickerQty.selectOption('250');
  await expect(totalPrice).toHaveText(/1\s940\s₽/);

  await ribbonSwitch.uncheck();
  await expect(meters).toHaveValue('0');
  await expect(meters).toBeDisabled();
  await expect(stickerQty).toHaveValue('250');
  await expect(page.locator('#orderRibbon')).toContainText('0 м');
  await expect(totalPrice).toHaveText(/1\s350\s₽/);
  await expect(page.locator('body')).toHaveAttribute(
    'data-has-ribbon',
    'false',
  );
  await expect(page.locator('body')).toHaveAttribute(
    'data-has-sticker',
    'true',
  );

  await page.reload({ waitUntil: 'networkidle' });
  await expect(ribbonSwitch).not.toBeChecked();
  await expect(stickerSwitch).toBeChecked();
  await expect(meters).toHaveValue('0');
  await ribbonSwitch.check();
  await expect(meters).toHaveValue('25');
  await expect(meters).toBeEnabled();
  await expect(totalPrice).toHaveText(/1\s940\s₽/);

  await stickerSwitch.uncheck();
  await expect(stickerQty).toHaveValue('0');
  await expect(stickerQty).toBeDisabled();
  await expect(meters).toHaveValue('25');
  await expect(page.locator('#orderSticker')).toContainText('0 шт.');
  await expect(totalPrice).toHaveText(/590\s₽/);
  await expect(page.locator('body')).toHaveAttribute('data-has-ribbon', 'true');
  await expect(page.locator('body')).toHaveAttribute(
    'data-has-sticker',
    'false',
  );

  await page.reload({ waitUntil: 'networkidle' });
  await expect(ribbonSwitch).toBeChecked();
  await expect(stickerSwitch).not.toBeChecked();
  await stickerSwitch.check();
  await expect(stickerQty).toHaveValue('250');
  await expect(stickerQty).toBeEnabled();
  await expect(totalPrice).toHaveText(/1\s940\s₽/);

  await ribbonSwitch.uncheck();
  await stickerSwitch.uncheck();
  await expect(ribbonSwitch).toBeChecked();
  await expect(stickerSwitch).not.toBeChecked();
  await expect(page.locator('body')).toHaveAttribute('data-has-ribbon', 'true');
  await expect(page.locator('body')).toHaveAttribute(
    'data-has-sticker',
    'false',
  );
  await expect(meters).toHaveValue('25');
  await expect(stickerQty).toHaveValue('0');

  await expectNoHorizontalOverflow(page);
  expect(runtimeErrors).toEqual([]);
});

test('order product controls remove, restore, and persist products', async ({
  page,
}, testInfo) => {
  const runtimeErrors = watchRuntimeErrors(page);
  await page.goto('/studio/', { waitUntil: 'networkidle' });
  await page.locator('.nav-item[data-panel="order"]').click();

  const body = page.locator('body');
  const meters = page.locator('#meters');
  const stickerQty = page.locator('#stickerQty');
  const totalPrice = page.locator('#totalPrice');
  const ribbonButton = page.locator('#toggleOrderRibbon');
  const stickerButton = page.locator('#toggleOrderSticker');
  const notice = page.locator('#orderProductNotice');

  await expect(ribbonButton).toBeVisible();
  await expect(stickerButton).toBeVisible();
  await expect(ribbonButton).toHaveText('Убрать');
  await expect(stickerButton).toHaveText('Убрать');
  await expect(ribbonButton).toBeEnabled();
  await expect(stickerButton).toBeEnabled();
  await expect(notice).toHaveText(
    'В заказе должен остаться хотя бы один продукт.',
  );
  await expect(notice).toBeHidden();

  await meters.selectOption('25');
  await stickerQty.selectOption('250');
  await expect(totalPrice).toHaveText(/1\s940\s₽/);

  await ribbonButton.click();
  await expect(meters).toHaveValue('0');
  await expect(page.locator('#orderRibbon')).toContainText('0 м');
  await expect(totalPrice).toHaveText(/1\s350\s₽/);
  await expect(ribbonButton).toHaveText('Добавить');
  await expect(ribbonButton).toBeEnabled();
  await expect(stickerButton).toHaveText('Убрать');
  await expect(stickerButton).toBeDisabled();
  await expect(stickerButton).toHaveAttribute(
    'title',
    'В заказе должен остаться хотя бы один продукт.',
  );
  await expect(stickerButton).toHaveAttribute(
    'aria-describedby',
    'orderProductNotice',
  );
  await expect(notice).toBeVisible();
  await expect(body).toHaveAttribute('data-has-ribbon', 'false');
  await expect(body).toHaveAttribute('data-has-sticker', 'true');
  if (testInfo.project.name === 'mobile') {
    await expect(page.getByRole('switch', { name: 'Лента' })).not.toBeChecked();
    await expect(page.getByRole('switch', { name: 'Стикер' })).toBeChecked();
  }

  await ribbonButton.click();
  await expect(meters).toHaveValue('25');
  await expect(totalPrice).toHaveText(/1\s940\s₽/);
  await expect(ribbonButton).toHaveText('Убрать');
  await expect(stickerButton).toBeEnabled();
  await expect(notice).toBeHidden();

  await stickerButton.click();
  await expect(stickerQty).toHaveValue('0');
  await expect(page.locator('#orderSticker')).toContainText('0 шт.');
  await expect(totalPrice).toHaveText(/590\s₽/);
  await expect(stickerButton).toHaveText('Добавить');
  await expect(stickerButton).toBeEnabled();
  await expect(ribbonButton).toHaveText('Убрать');
  await expect(ribbonButton).toBeDisabled();
  await expect(ribbonButton).toHaveAttribute(
    'title',
    'В заказе должен остаться хотя бы один продукт.',
  );
  await expect(ribbonButton).toHaveAttribute(
    'aria-describedby',
    'orderProductNotice',
  );
  await expect(body).toHaveAttribute('data-has-ribbon', 'true');
  await expect(body).toHaveAttribute('data-has-sticker', 'false');
  if (testInfo.project.name === 'mobile') {
    await expect(page.getByRole('switch', { name: 'Лента' })).toBeChecked();
    await expect(
      page.getByRole('switch', { name: 'Стикер' }),
    ).not.toBeChecked();
  }

  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('.nav-item[data-panel="order"]').click();
  await expect(meters).toHaveValue('25');
  await expect(stickerQty).toHaveValue('0');
  await expect(ribbonButton).toBeDisabled();
  await expect(stickerButton).toHaveText('Добавить');
  await expect(body).toHaveAttribute('data-has-ribbon', 'true');
  await expect(body).toHaveAttribute('data-has-sticker', 'false');

  await stickerButton.click();
  await expect(stickerQty).toHaveValue('250');
  await expect(totalPrice).toHaveText(/1\s940\s₽/);
  await expect(stickerButton).toHaveText('Убрать');
  await expect(ribbonButton).toBeEnabled();

  await expectNoHorizontalOverflow(page);
  expect(runtimeErrors).toEqual([]);
});

test('mobile preview safe zones activate the shared logo and text inputs', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile');

  const runtimeErrors = watchRuntimeErrors(page);
  await page.goto('/studio/', { waitUntil: 'networkidle' });

  const zones = {
    ribbonLogo: page.locator('[data-mobile-products-safe-zone="ribbon-logo"]'),
    ribbonText: page.locator('[data-mobile-products-safe-zone="ribbon-text"]'),
    stickerLogo: page.locator(
      '[data-mobile-products-safe-zone="sticker-logo"]',
    ),
    stickerText: page.locator(
      '[data-mobile-products-safe-zone="sticker-text"]',
    ),
  };
  const textInput = page.locator('#textInput');
  const logoInput = page.locator('#logoInput');

  for (const [name, zone] of Object.entries(zones)) {
    await expect(zone, `${name} must stay visible`).toBeVisible();
    await expect(zone).toHaveJSProperty('tagName', 'BUTTON');
    await expect(zone).toHaveAttribute('type', 'button');
  }
  await expect(zones.ribbonLogo).toHaveAttribute(
    'data-mobile-products-safe-zone',
    'ribbon-logo',
  );
  await expect(zones.ribbonText).toHaveAttribute(
    'data-mobile-products-safe-zone',
    'ribbon-text',
  );
  await expect(zones.stickerLogo).toHaveAttribute(
    'data-mobile-products-safe-zone',
    'sticker-logo',
  );
  await expect(zones.stickerText).toHaveAttribute(
    'data-mobile-products-safe-zone',
    'sticker-text',
  );
  await expect(
    page.locator('.mobile-products-ribbon-sample'),
  ).not.toHaveAttribute('aria-hidden', 'true');
  await expect(
    page.locator('.mobile-products-sticker-sample'),
  ).not.toHaveAttribute('aria-hidden', 'true');

  await expect(zones.ribbonLogo).toHaveAttribute(
    'aria-label',
    'Изменить логотип',
  );
  await expect(zones.stickerLogo).toHaveAttribute(
    'aria-label',
    'Изменить логотип',
  );
  await expect(zones.ribbonText).toHaveAttribute(
    'aria-label',
    'Изменить надпись',
  );
  await expect(zones.stickerText).toHaveAttribute(
    'aria-label',
    'Изменить надпись',
  );
  await expect(page.locator('.mobile-products-ribbon-logo')).toBeVisible();
  await expect(page.locator('.mobile-products-sticker-logo')).toBeVisible();
  await expect(page.locator('.mobile-products-ribbon-text')).toBeVisible();
  await expect(page.locator('.mobile-products-sticker-text')).toBeVisible();

  await textInput.fill('');
  for (const zone of [zones.ribbonText, zones.stickerText]) {
    await expect(zone).toBeVisible();
    await expect(zone).toHaveAttribute('aria-label', 'Добавить надпись');
    await expect(zone.locator('.mobile-products-zone-action')).toHaveText(
      'Добавить надпись',
    );
  }

  await zones.ribbonText.click();
  await expect(textInput).toBeFocused();
  await zones.stickerText.click();
  await expect(textInput).toBeFocused();
  await zones.ribbonText.focus();
  await zones.ribbonText.press('Enter');
  await expect(textInput).toBeFocused();
  await zones.stickerText.focus();
  await zones.stickerText.press('Space');
  await expect(textInput).toBeFocused();

  await textInput.fill('общая надпись');
  await expect(zones.ribbonText).toHaveAttribute(
    'aria-label',
    'Изменить надпись',
  );
  await expect(zones.stickerText).toHaveAttribute(
    'aria-label',
    'Изменить надпись',
  );
  await expect(page.locator('.mobile-products-ribbon-text')).toHaveText(
    'общая надпись',
  );
  await expect(page.locator('.mobile-products-sticker-text')).toHaveText(
    'общая надпись',
  );

  await page.locator('#macroLogoImage').evaluate((element) => {
    element.hidden = true;
  });
  for (const zone of [zones.ribbonLogo, zones.stickerLogo]) {
    await expect(zone).toBeVisible();
    await expect(zone).toHaveAttribute('aria-label', 'Добавить логотип');
    await expect(zone.locator('.mobile-products-zone-action')).toHaveText(
      'Добавить логотип',
    );
  }

  for (const zone of [zones.ribbonLogo, zones.stickerLogo]) {
    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      zone.click(),
    ]);
    expect(await fileChooser.element().getAttribute('id')).toBe('logoInput');
    await fileChooser.setFiles([]);
  }
  await expect(logoInput).toHaveAttribute('id', 'logoInput');

  await page.locator('#macroLogoImage').evaluate((element) => {
    element.hidden = false;
  });
  await expect(zones.ribbonLogo).toHaveAttribute(
    'aria-label',
    'Изменить логотип',
  );
  await expect(zones.stickerLogo).toHaveAttribute(
    'aria-label',
    'Изменить логотип',
  );

  for (const [zone, surface] of [
    [zones.ribbonLogo, page.locator('.mobile-products-ribbon-sample')],
    [zones.ribbonText, page.locator('.mobile-products-ribbon-sample')],
    [zones.stickerLogo, page.locator('.mobile-products-sticker-sample')],
    [zones.stickerText, page.locator('.mobile-products-sticker-sample')],
  ]) {
    const inside = await zone.evaluate(
      (element, surfaceSelector) => {
        const bounds = element.getBoundingClientRect();
        const surfaceBounds = document
          .querySelector(surfaceSelector)
          .getBoundingClientRect();
        return (
          bounds.left >= surfaceBounds.left - 1 &&
          bounds.right <= surfaceBounds.right + 1 &&
          bounds.top >= surfaceBounds.top - 1 &&
          bounds.bottom <= surfaceBounds.bottom + 1
        );
      },
      await surface.evaluate((element) => `.${element.classList[0]}`),
    );
    expect(inside).toBe(true);
  }

  for (const zone of [zones.ribbonLogo, zones.ribbonText]) {
    await expect
      .poll(() =>
        zone.evaluate((element) => element.getBoundingClientRect().height),
      )
      .toBeGreaterThanOrEqual(44);
  }

  await expectNoHorizontalOverflow(page);
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

test('SVG upload updates both mobile product logos', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile');

  const runtimeErrors = watchRuntimeErrors(page);
  await page.goto('/studio/', { waitUntil: 'networkidle' });

  const macroLogo = page.locator('#macroLogoImage');
  const initialSrc = await macroLogo.getAttribute('src');
  await page.locator('#logoInput').setInputFiles(fixturePath('test-logo.svg'));

  await expect(page.locator('#fileCard')).toBeVisible();
  await expect(page.locator('#fileCardName')).toHaveText('test-logo.svg');
  await expect(page.locator('#fileCardMeta')).toContainText('SVG');
  await expect(page.locator('#continueUpload')).toBeEnabled();
  await expect
    .poll(() => macroLogo.getAttribute('src'))
    .toMatch(/^data:image\/svg\+xml;base64,/);

  const finalSrc = await macroLogo.getAttribute('src');
  expect(finalSrc).not.toBe(initialSrc);
  await expectMobileLogosToMatch(page, finalSrc);
  await expectInterfaceResponsive(page);
  await expectNoHorizontalOverflow(page);
  expect(runtimeErrors).toEqual([]);
});

test('transparent PNG is traced and updates both mobile product logos', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile');

  const runtimeErrors = watchRuntimeErrors(page);
  await page.goto('/studio/', { waitUntil: 'networkidle' });

  const cropModal = page.locator('#cropModal');
  const macroLogo = page.locator('#macroLogoImage');
  await page
    .locator('#logoInput')
    .setInputFiles(fixturePath('transparent-logo.png'));

  await expect(cropModal).toHaveAttribute('aria-hidden', 'true');
  await expect(cropModal).not.toHaveClass(/open/);
  await expect(page.locator('#traceStatus')).toBeVisible();
  await expect(page.locator('#traceDetails')).toContainText(
    'Прозрачность сохранена',
  );
  await expect(page.locator('#fileCardName')).toHaveText(
    'transparent-logo.png',
  );
  await expect(page.locator('#fileCardMeta')).toContainText('PNG · выделено');
  await expect
    .poll(() => macroLogo.getAttribute('src'))
    .toMatch(/^data:image\/svg\+xml;base64,/);

  const finalSrc = await macroLogo.getAttribute('src');
  await expectMobileLogosToMatch(page, finalSrc);
  await expectInterfaceResponsive(page);
  await expectNoHorizontalOverflow(page);
  expect(runtimeErrors).toEqual([]);
});

test('opaque PNG crop triggers tracing and updates both mobile product logos', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile');

  const runtimeErrors = watchRuntimeErrors(page);
  await page.goto('/studio/', { waitUntil: 'networkidle' });

  const cropModal = page.locator('#cropModal');
  const macroLogo = page.locator('#macroLogoImage');
  await page
    .locator('#logoInput')
    .setInputFiles(fixturePath('opaque-logo.png'));

  await expect(cropModal).toHaveClass(/open/);
  await expect(cropModal).toHaveAttribute('aria-hidden', 'false');
  await expect(page.locator('#cropCanvas')).toBeVisible();
  await expect(page.locator('#cropFrame')).toBeVisible();
  await page.locator('#cropApply').click();

  await expect(cropModal).not.toHaveClass(/open/);
  await expect(cropModal).toHaveAttribute('aria-hidden', 'true');
  await expect(page.locator('#traceStatus')).toBeVisible();
  await expect(page.locator('#fileCardName')).toHaveText('opaque-logo.png');
  await expect(page.locator('#fileCardMeta')).toContainText('PNG · выделено');
  await expect(page.locator('#fileCardQuality')).toContainText('SVG');
  await expect
    .poll(() => macroLogo.getAttribute('src'))
    .toMatch(/^data:image\/svg\+xml;base64,/);

  const finalSrc = await macroLogo.getAttribute('src');
  await expectMobileLogosToMatch(page, finalSrc);
  await expectInterfaceResponsive(page);
  await expectNoHorizontalOverflow(page);
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
