import { expect, test } from '@playwright/test';
import {
  completeFirstStepWithText,
  ensureProductSettingsVisible,
  expectNoHorizontalOverflow,
  fixturePath,
  watchRuntimeErrors,
} from './helpers/studio.js';

test('production geometry enforces 2.5 mm printable margins and circular bounds @smoke', async ({
  page,
}) => {
  await page.goto('/studio/?product=set', { waitUntil: 'networkidle' });
  const result = await page.evaluate(() => {
    const geometry = window.RibbonStudioGeometry;
    const ribbon = (widthMm) =>
      geometry.getRibbonPrintableGeometry({
        widthMm,
        repeatMm: 100,
        width: 100,
        height: widthMm,
      });
    const sticker = (diameterMm) =>
      geometry.getStickerPrintableGeometry({
        diameterMm,
        cx: 0,
        cy: 0,
        radius: diameterMm / 2,
      });
    const circle = { cx: 0, cy: 0, radius: 10 };
    const side = 20 / Math.sqrt(2);
    return {
      margin: geometry.PRINT_MARGIN_MM,
      ribbons: [ribbon(15).printableHeightMm, ribbon(20).printableHeightMm],
      stickers: [25, 30, 40, 50].map(
        (diameter) => sticker(diameter).printableDiameterMm,
      ),
      square20: geometry.areRectCornersInsideCircle(
        { x: -10, y: -10, width: 20, height: 20 },
        circle,
        0,
      ),
      inscribedSquare: geometry.areRectCornersInsideCircle(
        { x: -side / 2, y: -side / 2, width: side, height: side },
        circle,
        0,
      ),
      wide: geometry.fitRectToCircle(
        { x: 0, y: 0, width: 100, height: 10 },
        circle,
        1,
        0,
      ),
      tall: geometry.fitRectToCircle(
        { x: 0, y: 0, width: 10, height: 100 },
        circle,
        1,
        0,
      ),
      shiftedInside: geometry.areRectCornersInsideCircle(
        { x: 4, y: -1, width: 2, height: 2 },
        circle,
        0,
      ),
      shiftedOutside: geometry.areRectCornersInsideCircle(
        { x: 9, y: -1, width: 2, height: 2 },
        circle,
        0,
      ),
    };
  });

  expect(result.margin).toBe(2.5);
  expect(result.ribbons).toEqual([10, 15]);
  expect(result.stickers).toEqual([20, 25, 35, 45]);
  expect(result.square20).toBe(false);
  expect(result.inscribedSquare).toBe(true);
  expect(result.shiftedInside).toBe(true);
  expect(result.shiftedOutside).toBe(false);
  expect(result.wide.width).toBeGreaterThan(result.wide.height);
  expect(result.tall.height).toBeGreaterThan(result.tall.width);
});

test('roundrect uses ribbon linear layout and exact 2.5 mm margins @smoke', async ({
  page,
}) => {
  await page.goto('/studio/?product=sticker', {waitUntil: 'networkidle'});
  await page.locator('#textInput').fill('Линейный live тест');
  await page.locator('#logoInput').setInputFiles(fixturePath('test-logo.svg'));
  await page.locator('#continueUpload').click();
  await page.locator('[data-variant="roundrect-80x20"]').click();

  const result = await page.evaluate(() => {
    const geometry = window.RibbonStudioGeometry;
    const sticker = geometry.getStickerGeometry({
      shape: 'roundrect',
      widthMm: 80,
      heightMm: 20,
      cornerRadiusMm: 2,
      x: 0,
      y: 0,
      width: 356,
      height: 89,
    });
    const layout = JSON.parse(document.body.dataset.studioLayout).sticker;
    const production = document.querySelector(
      '#stickerContent [data-production-content]',
    );
    return {
      outer: sticker.outer,
      bounds: sticker.bounds,
      layout,
      images: production?.querySelectorAll('image').length || 0,
      texts: production?.querySelectorAll('text').length || 0,
    };
  });

  const scale = result.outer.width / 80;
  expect(result.bounds.x / scale).toBeCloseTo(2.5, 5);
  expect(result.bounds.y / scale).toBeCloseTo(2.5, 5);
  expect((result.outer.width - result.bounds.x - result.bounds.width) / scale).toBeCloseTo(2.5, 5);
  expect((result.outer.height - result.bounds.y - result.bounds.height) / scale).toBeCloseTo(2.5, 5);
  expect(result.bounds.radius).toBe(0);
  expect(result.layout.valid).toBe(true);
  expect(result.layout.logoBox.x).toBeLessThan(result.layout.textBox.x);
  expect(result.layout.logoBox.height / result.layout.printable.height).toBeGreaterThan(0.99);
  expect(result.layout.logoBox.y + result.layout.logoBox.height / 2).toBeCloseTo(
    result.layout.textBox.y + result.layout.textBox.height / 2,
    2,
  );
  expect(result.layout.textBox.width).toBeGreaterThan(0);
  expect(result.layout.textBox.x + result.layout.textBox.width).toBeLessThanOrEqual(
    result.bounds.x + result.bounds.width + 0.001,
  );
  expect(result.images).toBe(1);
  expect(result.texts).toBe(1);
});

test('roundrect text-only expands to the printable area and manual movement stays clamped @smoke', async ({
  page,
}) => {
  await page.goto('/studio/?product=sticker', {waitUntil: 'networkidle'});
  await page.locator('#textInput').fill('OK');
  await page.locator('#continueUpload').click();
  await page.locator('[data-variant="roundrect-80x20"]').click();

  const auto = await page.evaluate(() =>
    JSON.parse(document.body.dataset.studioLayout).sticker,
  );
  expect(auto.valid).toBe(true);
  const widthFill = auto.textBox.width / auto.printable.width;
  const heightFill = auto.textBox.height / auto.printable.height;
  expect(Math.max(widthFill, heightFill)).toBeGreaterThan(0.9);
  expect(heightFill).toBeGreaterThan(0.2);

  await page.locator('#layoutModeChoice button[data-value="manual"]').click();
  await page.locator('#fontSize').evaluate((input) => {
    input.value = input.max;
    input.dispatchEvent(new Event('input', {bubbles: true}));
  });
  await page.locator('#textOffsetX').evaluate((input) => {
    input.value = input.max;
    input.dispatchEvent(new Event('input', {bubbles: true}));
  });

  const manual = await page.evaluate(() =>
    JSON.parse(document.body.dataset.studioLayout).sticker,
  );
  expect(manual.valid).toBe(true);
  expect(manual.textBox.x).toBeGreaterThanOrEqual(manual.printable.x - 0.001);
  expect(manual.textBox.x + manual.textBox.width).toBeLessThanOrEqual(
    manual.printable.x + manual.printable.width + 0.001,
  );
});

test('roundrect traced logo and text fill printable height @smoke', async ({
  page,
}) => {
  await page.goto('/studio/?product=sticker', {waitUntil: 'networkidle'});
  await page.locator('#textInput').fill('Текст на максимум');
  await page.locator('#logoInput').setInputFiles(fixturePath('transparent-logo.png'));
  await expect(page.locator('#traceStatus')).toBeVisible();
  await page.locator('#continueUpload').click();
  await page.locator('[data-variant="roundrect-80x20"]').click();

  const metrics = await page.evaluate(() => {
    const layout = JSON.parse(document.body.dataset.studioLayout).sticker;
    const image = document.querySelector('#stickerContent image');
    const href = image?.getAttribute('href') || '';
    const svg = href.startsWith('data:image/svg+xml;base64,')
      ? atob(href.split(',')[1])
      : '';
    const viewBox = svg.match(/viewBox="([^"]+)"/)?.[1]?.split(/\s+/).map(Number);
    return {layout, viewBox};
  });

  expect(metrics.layout.valid).toBe(true);
  expect(metrics.layout.logoBox.height / metrics.layout.printable.height).toBeGreaterThan(0.99);
  expect(metrics.layout.textBox.height).toBeGreaterThan(0);
  expect(metrics.layout.textScaleY).toBe(1);
  expect(metrics.viewBox?.[2]).toBeLessThan(46);
  expect(metrics.viewBox?.[3]).toBeLessThan(48);
});

test('plain entry opens an isolated sticker editor with proportional text size @smoke', async ({
  page,
}) => {
  await page.goto('/studio/', {waitUntil: 'networkidle'});
  await page.locator('[data-start-product="sticker"]').click();
  await page.locator('#textInput').fill('Отдельный стикер');
  await page.locator('#continueUpload').click();
  await page.locator('[data-variant="roundrect-80x20"]').click();
  expect(await page.locator('[data-product-type="ribbon"]').evaluateAll((items) => items.every((item) => item.classList.contains('is-hidden')))).toBe(true);
  expect(await page.locator('[data-product-type="sticker"]').evaluateAll((items) => items.some((item) => !item.classList.contains('is-hidden')))).toBe(true);
  await page.locator('#layoutModeChoice button[data-value="manual"]').click();
  await expect(page.locator('#textScaleY')).toHaveCount(0);
  const before = await page.evaluate(() => JSON.parse(document.body.dataset.studioLayout).sticker.fontSizeRatio);
  await page.locator('#fontSize').evaluate((input) => {
    input.value = input.max;
    input.dispatchEvent(new Event('input', {bubbles: true}));
  });
  const after = await page.evaluate(() => JSON.parse(document.body.dataset.studioLayout).sticker);
  expect(after.fontSizeRatio).toBeGreaterThan(0);
  expect(after.fontSizeRatio).toBeGreaterThanOrEqual(before);
  expect(after.textScaleY).toBe(1);
  expect(after.textBox.y).toBeGreaterThanOrEqual(0 - 0.001);
  expect(after.textBox.y + after.textBox.height).toBeLessThanOrEqual(1 + 0.001);
});

test('roundrect uses proportional text size and ink-bound text box @smoke', async ({
  page,
}) => {
  await page.goto('/studio/?product=sticker', {waitUntil: 'networkidle'});
  await page.locator('#textInput').fill('Вертикальный текст');
  await page.locator('#continueUpload').click();
  await page.locator('[data-variant="roundrect-80x20"]').click();
  await page.locator('#layoutModeChoice button[data-value="manual"]').click();
  await expect(page.locator('#textScaleY')).toHaveCount(0);
  await page.locator('#fontSize').evaluate((input) => {
    input.value = input.max;
    input.dispatchEvent(new Event('input', {bubbles: true}));
  });
  const roundrect = await page.evaluate(() => {
    const layout = JSON.parse(document.body.dataset.studioLayout).sticker;
    return {layout};
  });
  expect(roundrect.layout.textScaleY).toBe(1);
  expect(roundrect.layout.textBox.width).toBeGreaterThan(0);
  expect(roundrect.layout.textBox.height).toBeGreaterThan(0);
  expect(roundrect.layout.textBox.x).toBeGreaterThanOrEqual(roundrect.layout.printable.x - 0.001);
  expect(roundrect.layout.textBox.x + roundrect.layout.textBox.width).toBeLessThanOrEqual(roundrect.layout.printable.x + roundrect.layout.printable.width + 0.001);
  expect(roundrect.layout.textBox.y).toBeGreaterThanOrEqual(roundrect.layout.printable.y - 0.001);
  expect(roundrect.layout.textBox.y + roundrect.layout.textBox.height).toBeLessThanOrEqual(roundrect.layout.printable.y + roundrect.layout.printable.height + 0.001);

  await page.locator('[data-variant="circle-40"]').click();
  await expect(page.locator('#textScaleY')).toHaveCount(0);
});

test('roundrect manual mode allows independent logo and text placement @smoke', async ({
  page,
}) => {
  await page.goto('/studio/?product=sticker', {waitUntil: 'networkidle'});
  await page.locator('#textInput').fill('Свободная композиция');
  await page.locator('#logoInput').setInputFiles(fixturePath('test-logo.svg'));
  await page.locator('#continueUpload').click();
  await page.locator('[data-variant="roundrect-80x20"]').click();
  await page.locator('#layoutModeChoice button[data-value="manual"]').click();
  await page.locator('#logoOffsetX').evaluate((input) => {
    input.value = input.max;
    input.dispatchEvent(new Event('input', {bubbles: true}));
  });
  await page.locator('#textOffsetX').evaluate((input) => {
    input.value = input.min;
    input.dispatchEvent(new Event('input', {bubbles: true}));
  });

  const layout = await page.evaluate(() =>
    JSON.parse(document.body.dataset.studioLayout).sticker,
  );
  expect(layout.valid).toBe(true);
  for (const box of [layout.logoBox, layout.textBox]) {
    expect(box.x).toBeGreaterThanOrEqual(layout.printable.x - 0.001);
    expect(box.y).toBeGreaterThanOrEqual(layout.printable.y - 0.001);
    expect(box.x + box.width).toBeLessThanOrEqual(
      layout.printable.x + layout.printable.width + 0.001,
    );
    expect(box.y + box.height).toBeLessThanOrEqual(
      layout.printable.y + layout.printable.height + 0.001,
    );
  }
  expect(layout.logoBox.x).toBeGreaterThan(0.5);
  expect(layout.textBox.x).toBeLessThan(0.5);
});

test('printable guides stay contextual and never enter the final preview', async ({
  page,
}, testInfo) => {
  const runtimeErrors = watchRuntimeErrors(page);
  await page.goto('/studio/?product=set', { waitUntil: 'networkidle' });

  const guide = page.locator(
    testInfo.project.name === 'mobile'
      ? '.mobile-products-printable-guide.ribbon-guide'
      : '#ribbonPrintableGuide',
  );
  const showcaseGuide = page.locator(
    '.showcase-ribbon-15 .showcase-ribbon-body',
  );
  const expectShowcaseGuideOpacity = (expected) =>
    expect
      .poll(() =>
        showcaseGuide.evaluate(
          (element) => getComputedStyle(element, '::after').opacity,
        ),
      )
      .toBe(expected);
  const textInput = page.locator('#textInput');
  const uploadNavigation = page.locator('.nav-item[data-panel="upload"]');
  const settingsNavigation = page.locator('.nav-item[data-panel="settings"]');
  const orderNavigation = page.locator('.nav-item[data-panel="order"]');
  const toggle = page.getByRole('switch', {
    name: 'Показать поля печати',
  });

  await expect(guide).toHaveCSS('opacity', '0');
  await expectShowcaseGuideOpacity('0');
  await textInput.focus();
  await expect(guide).toHaveCSS('opacity', '0');
  await expectShowcaseGuideOpacity('0');
  await uploadNavigation.focus();
  await expect(guide).toHaveCSS('opacity', '0');
  await expectShowcaseGuideOpacity('0');

  await completeFirstStepWithText(page);
  await settingsNavigation.click();
  await expect(toggle).not.toBeChecked();
  await expect(guide).toHaveCSS('opacity', '0');
  await expectShowcaseGuideOpacity('0');

  await toggle.check();
  await settingsNavigation.focus();
  await expect(guide).toHaveCSS('opacity', '1');
  await expectShowcaseGuideOpacity('1');

  await toggle.uncheck();
  await settingsNavigation.focus();
  await expect(guide).toHaveCSS('opacity', '0');
  await expectShowcaseGuideOpacity('0');

  await uploadNavigation.click();
  await textInput.fill('ОЧЕНЬ ДЛИННЫЙ ТЕКСТ '.repeat(80));
  await uploadNavigation.focus();
  await expect(page.locator('body')).toHaveAttribute(
    'data-artwork-valid',
    'false',
  );
  await expect(guide).toHaveCSS('opacity', '0');
  await expectShowcaseGuideOpacity('0');

  await orderNavigation.click();
  await expect(page.locator('body')).toHaveAttribute(
    'data-active-panel',
    'order',
  );
  await expect(guide).toHaveCSS('opacity', '0');
  await expectShowcaseGuideOpacity('0');
  await expectNoHorizontalOverflow(page);
  expect(runtimeErrors).toEqual([]);
});

test('25 mm sticker persists, updates previews, reports missing price, and excludes guides from production', async ({
  page,
}, testInfo) => {
  const runtimeErrors = watchRuntimeErrors(page);
  await page.goto('/studio/?product=set', { waitUntil: 'networkidle' });
  await completeFirstStepWithText(page);
  await page.locator('.nav-item[data-panel="settings"]').click();
  await ensureProductSettingsVisible(page, 'sticker');

  const option = page.locator('#stickerSizeChoice button[data-value="25"]');
  await expect(option).toBeVisible();
  await expect(async () => {
    await option.click();
    await expect(option).toHaveClass(/active/, { timeout: 1000 });
    await expect(page.locator('body')).toHaveAttribute(
      'data-sticker-size',
      '25',
      { timeout: 1000 },
    );
  }).toPass();
  await expect(page.locator('#stickerSizeLabel')).toHaveText('Ø25 мм');
  await expect(page.locator('#totalPrice')).toHaveText('Требуется расчёт');
  await expect(page.locator('#totalPrice')).toHaveAttribute(
    'data-price-unavailable',
    'true',
  );

  if (testInfo.project.name === 'mobile') {
    await expect(
      page.locator(
        '[data-mobile-product-sample="sticker"] .mobile-products-sample-label',
      ),
    ).toHaveText('Стикер 25 мм');
    await expect(
      page.locator('.mobile-products-printable-guide.sticker-guide'),
    ).toBeAttached();
  } else {
    await page.locator('.nav-item[data-panel="order"]').click();
    await expect(page.locator('.studio')).toBeHidden();
    await expect(page.locator('#panel-order')).toBeVisible();
    await expect(page.locator('#sceneTabs')).toHaveCount(0);
  }

  for (const guide of await page.locator('[data-preview-overlay]').all()) {
    await expect(guide).toHaveCSS('pointer-events', 'none');
  }

  const serialized = await page.evaluate(() => ({
    ribbon: window.RibbonStudioProduction.serialize('ribbon'),
    sticker: window.RibbonStudioProduction.serialize('sticker'),
  }));
  expect(serialized.ribbon).not.toContain('data-preview-overlay');
  expect(serialized.ribbon).not.toContain('ribbonPrintableGuide');
  expect(serialized.sticker).not.toContain('data-preview-overlay');
  expect(serialized.sticker).not.toContain('stickerPrintableGuide');

  await page.locator('.nav-item[data-panel="order"]').click();
  await page.locator('#openOrder').click();
  await expect(page.locator('#orderSummary')).toContainText('Стикер Ø25 мм');
  await expect(page.locator('#orderSummary')).toContainText(
    'требует индивидуального расчёта',
  );
  await page.locator('#closeOrder').click();

  await page.reload({ waitUntil: 'networkidle' });
  await expect(
    page.locator('#stickerSizeChoice button[data-value="25"]'),
  ).toHaveClass(/active/);
  await expect(page.locator('body')).toHaveAttribute('data-sticker-size', '25');
  await expectNoHorizontalOverflow(page);
  expect(runtimeErrors).toEqual([]);
});

test('default logo and text fill and center the available print areas', async ({
  page,
}) => {
  await page.goto('/studio/?product=set', { waitUntil: 'networkidle' });

  const metrics = await page.evaluate(() => {
    const { ribbon, sticker } = JSON.parse(document.body.dataset.studioLayout);
    const stickerSafeDiameter = sticker.printable.radius * 2;
    return {
      ribbonLogoHeight: ribbon.logoBox.height,
      ribbonSafeHeight: ribbon.printable.height,
      stickerLogoFill: sticker.logoBox.width / stickerSafeDiameter,
      stickerTextFill: sticker.textBox.width / stickerSafeDiameter,
      stickerGap:
        (sticker.textBox.y - (sticker.logoBox.y + sticker.logoBox.height)) /
        stickerSafeDiameter,
      stickerGroupCenter:
        (sticker.logoBox.y + sticker.textBox.y + sticker.textBox.height) / 2,
      stickerCenter: sticker.printable.cy,
    };
  });

  expect(metrics.ribbonLogoHeight).toBeCloseTo(metrics.ribbonSafeHeight, 5);
  expect(metrics.stickerLogoFill).toBeGreaterThanOrEqual(0.84);
  expect(metrics.stickerTextFill).toBeGreaterThanOrEqual(0.74);
  expect(metrics.stickerGap).toBeLessThanOrEqual(0.04);
  expect(metrics.stickerGroupCenter).toBeCloseTo(metrics.stickerCenter, 5);
  await expectNoHorizontalOverflow(page);
});

test('uploaded wide logo paints at the full ribbon safe height on mobile', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile');

  await page.goto('/studio/?product=set', { waitUntil: 'networkidle' });
  await page.locator('#logoInput').setInputFiles({
    name: 'wide-logo.svg',
    mimeType: 'image/svg+xml',
    buffer: Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 100">' +
        '<rect width="400" height="100" fill="#111"/></svg>',
    ),
  });
  await expect(page.locator('#fileCardName')).toHaveText('wide-logo.svg');
  await expect(page.locator('body')).toHaveAttribute(
    'data-preview-demo',
    'false',
  );
  await expect(page.locator('.mobile-products-ribbon-logo')).toBeVisible();

  const result = await page.evaluate(() => {
    const layout = JSON.parse(document.body.dataset.studioLayout).ribbon;
    const surface = document
      .querySelector('.mobile-products-ribbon-sample')
      .getBoundingClientRect();
    const image = document.querySelector('.mobile-products-ribbon-logo');
    const imageBounds = image.getBoundingClientRect();
    const intrinsicRatio = image.naturalWidth / image.naturalHeight;
    const paintedHeight = Math.min(
      imageBounds.height,
      imageBounds.width / intrinsicRatio,
    );
    return {
      paintedHeight,
      safeHeight: surface.height * layout.printable.height,
      layoutLogoHeight: layout.logoBox.height,
      layoutSafeHeight: layout.printable.height,
    };
  });

  expect(result.paintedHeight / result.safeHeight).toBeGreaterThanOrEqual(0.98);
  expect(result.layoutLogoHeight).toBeCloseTo(result.layoutSafeHeight, 5);
  await expectNoHorizontalOverflow(page);
});

test('ribbon overflow shows a clipped fragment and applies a proportional full preview', async ({
  page,
}) => {
  const fullText = 'Название бренда для упаковки';
  await page.goto('/studio/?product=set', { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.locator('#repeatMm').evaluate((element) => {
    element.value = '40';
    element.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.locator('#textInput').fill(fullText);

  const card = page.locator('.ribbon-overflow-card-mobile');
  await expect(card).toBeVisible();
  await expect(page.locator('body')).toHaveAttribute(
    'data-ribbon-overflow',
    'true',
  );

  const before = await page.evaluate(() => {
    const layout = JSON.parse(document.body.dataset.studioLayout).ribbon;
    const surface = [
      ...document.querySelectorAll('[data-ribbon-overflow-full]'),
    ]
      .find((element) => element.getBoundingClientRect().width > 0)
      .getBoundingClientRect();
    const fullPreviewText = [
      ...document.querySelectorAll('[data-ribbon-overflow-text]'),
    ].find((element) => element.getBoundingClientRect().width > 0);
    return {
      layout,
      surfaceRatio: surface.width / surface.height,
      fullTextFits:
        fullPreviewText.scrollWidth <= fullPreviewText.clientWidth + 1,
      production: window.RibbonStudioProduction.serialize('ribbon'),
    };
  });
  expect(before.layout.valid).toBe(false);
  expect(before.layout.previewText).toMatch(/…$/);
  expect(before.layout.previewText.length).toBeLessThan(fullText.length);
  expect(before.layout.overflow.requiredRepeatMm).toBeGreaterThan(40);
  expect(before.layout.overflow.requiredRepeatMm % 5).toBe(0);
  expect(before.layout.overflow.canApply).toBe(true);
  expect(
    Math.abs(
      before.surfaceRatio - before.layout.overflow.requiredRepeatMm / 15,
    ),
  ).toBeLessThan(0.01);
  expect(before.fullTextFits).toBe(true);
  expect(before.production).not.toContain(fullText);
  expect(before.production).not.toContain('…');

  await expect(card.locator('[data-ribbon-overflow-text]')).toHaveText(
    fullText,
  );
  await expect(card.locator('[data-apply-ribbon-repeat]')).toContainText(
    `${before.layout.overflow.requiredRepeatMm} мм`,
  );
  const clippedPreview = page.locator('.mobile-products-ribbon-text');
  await expect(clippedPreview).toHaveText(before.layout.previewText);
  await expect(page.locator('#submitOrder')).toBeDisabled();

  await card.locator('[data-apply-ribbon-repeat]').click();
  await expect(page.locator('#repeatMm')).toHaveValue(
    String(before.layout.overflow.requiredRepeatMm),
  );
  await expect(page.locator('body')).toHaveAttribute(
    'data-ribbon-overflow',
    'false',
  );
  await expect(card).toBeHidden();
  await expect(page.locator('body')).toHaveAttribute(
    'data-artwork-valid',
    'true',
  );
  const production = await page.evaluate(() =>
    window.RibbonStudioProduction.serialize('ribbon'),
  );
  expect(production).toContain(fullText);
  expect(production).not.toContain('…');
  await expect(page.locator('#submitOrder')).toBeEnabled();
  await expectNoHorizontalOverflow(page);
});

test('text stays logo-free until an uploaded logo is added', async ({
  page,
}) => {
  const fullText = 'Название бренда для упаковки';
  const card = page.locator('.ribbon-overflow-card-mobile');
  await page.goto('/studio/?product=set', { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.locator('#textInput').fill(fullText);
  await page.locator('#fontSize').evaluate((element) => {
    element.value = '64';
    element.dispatchEvent(new Event('input', { bubbles: true }));
  });

  await expect(page.locator('body')).toHaveAttribute(
    'data-preview-logo-demo',
    'false',
  );
  await expect(page.locator('#ribbonContent image').first()).toHaveCount(0);
  await expect(page.locator('.mobile-products-ribbon-logo')).toBeHidden();
  await expect(card).toBeHidden();

  let result = await page.evaluate(() => {
    const preview = JSON.parse(document.body.dataset.studioLayout).ribbon;
    const production = JSON.parse(
      document.body.dataset.studioProductionLayout,
    ).ribbon;
    return {
      preview,
      production,
      content: JSON.parse(document.body.dataset.studioContent),
      serialized: window.RibbonStudioProduction.serialize('ribbon'),
    };
  });
  expect(result.preview.valid).toBe(true);
  expect(result.preview.logoBox).toBeNull();
  expect(result.preview.overflow).toBeUndefined();
  expect(result.production.logoBox).toBeNull();
  expect(result.content.logo.common).toBeNull();
  expect(result.serialized).not.toContain('<image');

  await page.locator('#logoInput').setInputFiles(fixturePath('test-logo.svg'));
  await expect(page.locator('#fileCardName')).toHaveText('test-logo.svg');
  await expect(page.locator('body')).toHaveAttribute(
    'data-preview-logo-demo',
    'false',
  );
  await expect(page.locator('#ribbonContent image').first()).toBeAttached();
  await expect(card).toBeHidden();

  result = await page.evaluate(() => {
    const preview = JSON.parse(document.body.dataset.studioLayout).ribbon;
    const production = JSON.parse(
      document.body.dataset.studioProductionLayout,
    ).ribbon;
    return {
      preview,
      production,
      content: JSON.parse(document.body.dataset.studioContent),
      serialized: window.RibbonStudioProduction.serialize('ribbon'),
    };
  });
  expect(result.preview.valid).toBe(true);
  expect(result.preview.logoBox).not.toBeNull();
  expect(result.preview.overflow).toBeUndefined();
  expect(result.production.logoBox).not.toBeNull();
  expect(result.content.logo.common).toMatchObject({
    hasLogo: true,
    logoType: 'svg',
  });
  expect(result.serialized).toContain('<image');
  await expectNoHorizontalOverflow(page);
});

test('long production text is invalid and is not rendered outside printable areas', async ({
  page,
}) => {
  await page.goto('/studio/?product=set', { waitUntil: 'networkidle' });
  await page.locator('#textInput').fill('ОЧЕНЬ ДЛИННЫЙ ТЕКСТ '.repeat(80));
  await page
    .locator('#stickerSizeChoice button[data-value="25"]')
    .evaluate((button) => button.click());

  const layouts = await page
    .locator('body')
    .evaluate((body) => JSON.parse(body.dataset.studioLayout));
  expect(layouts.ribbon.valid).toBe(false);
  expect(layouts.sticker.valid).toBe(false);
  expect(layouts.ribbon.reason).toBe('text-too-long');
  expect(layouts.sticker.reason).toBe('text-too-long');
  await expect(
    page.locator('#ribbonContent [data-production-content] text'),
  ).toHaveCount(0);
  await expect(
    page.locator('#stickerContent [data-production-content] text'),
  ).toHaveCount(0);
  await expect(page.locator('#artworkValidation')).toContainText(
    'Сократите надпись',
  );
  await expect(page.locator('#submitOrder')).toBeDisabled();
  await expect(page.locator('.mobile-products-ribbon-text')).toBeVisible();
  await expect(page.locator('.mobile-products-ribbon-text')).toHaveText(/…$/);
  await expect(page.locator('.mobile-products-sticker-text')).toBeHidden();
  const overflowCard = page.locator('.ribbon-overflow-card-mobile');
  await expect(overflowCard).toBeVisible();
  await expect(
    overflowCard.locator('[data-ribbon-overflow-message]'),
  ).toContainText(
    /доступно не более 250 мм|Не удалось подобрать производственный шаг/,
  );
  await expect(overflowCard.locator('[data-apply-ribbon-repeat]')).toBeHidden();
  const invalidProduction = await page.evaluate(() =>
    window.RibbonStudioProduction.serialize('ribbon'),
  );
  expect(invalidProduction).not.toContain('…');

  await page.locator('#textInput').fill('коротко');
  await expect(page.locator('body')).toHaveAttribute(
    'data-artwork-valid',
    'true',
  );
  await expect(page.locator('#ribbonContent text').first()).toBeAttached();
  await expect(page.locator('#stickerContent text').first()).toBeAttached();
  await expect(page.locator('#submitOrder')).toBeEnabled();
  await expect(overflowCard).toBeHidden();
});

test('effective layout is shared with mobile and sticker boxes pass corner validation @smoke', async ({
  page,
}) => {
  await page.goto('/studio/?product=set', { waitUntil: 'networkidle' });
  await page.locator('#logoInput').setInputFiles(fixturePath('test-logo.svg'));
  await page.locator('#textInput').fill('коротко');
  await page
    .locator('#stickerSizeChoice button[data-value="25"]')
    .evaluate((button) => button.click());

  const result = await page.evaluate(() => {
    const layouts = JSON.parse(document.body.dataset.studioLayout);
    const mobileRibbon = JSON.parse(
      document.querySelector('.mobile-products-ribbon-sample').dataset.layout,
    );
    const mobileSticker = JSON.parse(
      document.querySelector('.mobile-products-sticker-sample').dataset.layout,
    );
    const denormalize = (box) => ({
      x: 22 + box.x * 356,
      y: 22 + box.y * 356,
      width: box.width * 356,
      height: box.height * 356,
    });
    const printable = window.RibbonStudioGeometry.getStickerPrintableGeometry({
      diameterMm: 25,
      cx: 200,
      cy: 200,
      radius: 178,
    });
    return {
      layouts,
      mobileRibbon,
      mobileSticker,
      logoInside: window.RibbonStudioGeometry.areRectCornersInsideCircle(
        denormalize(layouts.sticker.logoBox),
        printable.circle,
        0,
      ),
      textInside: window.RibbonStudioGeometry.areRectCornersInsideCircle(
        denormalize(layouts.sticker.textBox),
        printable.circle,
        0,
      ),
    };
  });
  expect(result.mobileRibbon).toEqual(result.layouts.ribbon);
  expect(result.mobileSticker).toEqual(result.layouts.sticker);
  expect(result.logoInside).toBe(true);
  expect(result.textInside).toBe(true);
});

test('automatic golden repeat follows composition and logo-only artwork', async ({
  page,
}, testInfo) => {
  await page.goto('/studio/?product=set', { waitUntil: 'networkidle' });

  const readRepeat = () =>
    page.evaluate(() => ({
      repeatMm: Number(document.body.dataset.ribbonRepeatMm),
      source: document.body.dataset.ribbonRepeatSource,
      mode: document.body.dataset.ribbonRepeatMode,
      contentWidthMm: Number(document.body.dataset.ribbonContentWidthMm),
      goldenGapMm: Number(document.body.dataset.ribbonGoldenGapMm),
    }));
  const expectGoldenRepeat = async (source) => {
    const result = await readRepeat();
    const expected = Math.min(
      250,
      Math.ceil(
        Math.max(40, result.contentWidthMm + result.contentWidthMm / 1.618) / 5,
      ) * 5,
    );
    expect(result.source).toBe(source);
    expect(result.mode).toBe('auto');
    expect(result.goldenGapMm).toBeCloseTo(result.contentWidthMm / 1.618, 1);
    expect(result.repeatMm).toBe(expected);
    await expect(page.locator('#repeatMm')).toHaveValue(String(expected));
    return result;
  };

  await expect(page.locator('#repeatMm')).toHaveAttribute('type', 'range');
  await page.locator('#textInput').fill('МАКСИМ');
  const textRepeat = await expectGoldenRepeat('text');

  if (testInfo.project.name === 'mobile') {
    const ribbon = page.locator('.mobile-products-ribbon-sample');
    await expect
      .poll(() => ribbon.locator('.mobile-products-ribbon-repeat-text').count())
      .toBeGreaterThan(0);
    await expect(ribbon).toHaveAttribute(
      'data-ribbon-repeat-mm',
      String(textRepeat.repeatMm),
    );
    const repeatTextIsWhole = await ribbon
      .locator('.mobile-products-ribbon-repeat-text')
      .evaluateAll(
        (elements, surface) => {
          const bounds = surface.getBoundingClientRect();
          return elements.every((element) => {
            const textBounds = element.getBoundingClientRect();
            return (
              textBounds.left >= bounds.left - 0.5 &&
              textBounds.right <= bounds.right + 0.5
            );
          });
        },
        await ribbon.elementHandle(),
      );
    expect(repeatTextIsWhole).toBe(true);
    const repeatOffsets = await ribbon.evaluate((surface) => {
      const central = surface.querySelector(
        '[data-mobile-products-safe-zone="ribbon-text"]',
      );
      const centralBounds = central.getBoundingClientRect();
      const centralCenter = centralBounds.left + centralBounds.width / 2;
      const centralMiddle = centralBounds.top + centralBounds.height / 2;
      const repeatWidth = Number(surface.dataset.ribbonRepeatWidthPx);
      return [
        ...surface.querySelectorAll('.mobile-products-ribbon-repeat-text'),
      ].map((element) => {
        const bounds = element.getBoundingClientRect();
        return {
          horizontal: Math.abs(
            (bounds.left + bounds.width / 2 - centralCenter) / repeatWidth,
          ),
          vertical: Math.abs(bounds.top + bounds.height / 2 - centralMiddle),
        };
      });
    });
    expect(repeatOffsets.length).toBeGreaterThan(0);
    for (const offset of repeatOffsets) {
      expect(offset.horizontal).toBeCloseTo(Math.round(offset.horizontal), 2);
      expect(offset.vertical).toBeLessThanOrEqual(0.5);
    }
  } else {
    await expect
      .poll(() =>
        page.locator('#ribbonContent [data-production-content]').count(),
      )
      .toBeGreaterThan(1);
  }

  await page.locator('#textInput').fill('');
  await page.locator('#logoInput').setInputFiles(fixturePath('test-logo.svg'));
  await expect(page.locator('#fileCardName')).toHaveText('test-logo.svg');
  const logoRepeat = await expectGoldenRepeat('logo');

  if (testInfo.project.name === 'mobile') {
    const ribbon = page.locator('.mobile-products-ribbon-sample');
    await expect
      .poll(() => ribbon.locator('.mobile-products-ribbon-repeat-logo').count())
      .toBeGreaterThan(0);
    await expect(ribbon).toHaveAttribute(
      'data-ribbon-repeat-mm',
      String(logoRepeat.repeatMm),
    );
    await expect
      .poll(() =>
        ribbon.evaluate((surface) =>
          [
            surface.querySelector('.mobile-products-ribbon-logo'),
            surface.querySelector('.mobile-products-ribbon-repeat-logo'),
          ].every(
            (image) =>
              image instanceof HTMLImageElement &&
              image.complete &&
              image.naturalWidth > 0 &&
              image.naturalHeight > 0,
          ),
        ),
      )
      .toBe(true);
    const logoSizes = await ribbon.evaluate((surface) => {
      const paintedSize = (image) => {
        const bounds = image.getBoundingClientRect();
        const ratio = image.naturalWidth / image.naturalHeight;
        const width = Math.min(bounds.width, bounds.height * ratio);
        const height = Math.min(bounds.height, bounds.width / ratio);
        return { width, height };
      };
      return {
        central: paintedSize(
          surface.querySelector('.mobile-products-ribbon-logo'),
        ),
        repeat: paintedSize(
          surface.querySelector('.mobile-products-ribbon-repeat-logo'),
        ),
      };
    });
    expect(
      Math.abs(logoSizes.repeat.width - logoSizes.central.width),
    ).toBeLessThanOrEqual(1);
    expect(
      Math.abs(logoSizes.repeat.height - logoSizes.central.height),
    ).toBeLessThanOrEqual(1);
  } else {
    await expect
      .poll(() =>
        page.locator('#ribbonContent [data-production-content]').count(),
      )
      .toBeGreaterThan(1);
  }

  await expectNoHorizontalOverflow(page);
});

test('repeat guides preserve 2.5 mm margins for 40, 100, and 250 mm', async ({
  page,
}) => {
  await page.goto('/studio/?product=set', { waitUntil: 'networkidle' });
  for (const repeatMm of [40, 100, 250]) {
    await page.locator('#repeatMm').evaluate((element, repeat) => {
      element.value = String(repeat);
      element.dispatchEvent(new Event('input', { bubbles: true }));
    }, repeatMm);
    const result = await page.evaluate((repeat) => {
      const layout = JSON.parse(document.body.dataset.studioLayout).ribbon;
      return {
        leftMm: layout.printable.x * repeat,
        rightMm: (1 - layout.printable.x - layout.printable.width) * repeat,
        guideLeft: document.querySelector(
          '.mobile-products-printable-guide.ribbon-guide',
        ).style.left,
      };
    }, repeatMm);
    expect(result.leftMm).toBeCloseTo(2.5, 7);
    expect(result.rightMm).toBeCloseTo(2.5, 7);
    expect(parseFloat(result.guideLeft)).toBeCloseTo((2.5 / repeatMm) * 100, 5);
  }
});

test('sticker create step keeps one active model and compact future shape picker @smoke', async ({ page }) => {
  await page.goto('/studio/', {waitUntil: 'networkidle'});
  await page.locator('[data-start-product="sticker"]').click();

  const picker = page.locator('#stickerProductPicker');
  await expect(picker).toBeVisible();
  await expect(picker.locator('[data-sticker-option]')).toHaveCount(6);
  await expect(picker.locator('[data-sticker-option-disabled="heart"]')).toHaveCount(1);
  await expect(picker.locator('[data-sticker-option-disabled="heart"]')).toHaveAttribute('aria-disabled', 'true');
  await expect(picker.locator('[data-sticker-option].active')).toHaveCount(1);
  await expect(page.locator('#textInput')).toBeVisible();
  await expect(page.locator('#dropZone')).toBeVisible();

  await picker.locator('[data-sticker-option="roundrect-80x20"][data-sticker-bg="#171717"]').click();
  await expect(picker.locator('[data-sticker-option].active')).toHaveCount(1);
  await expect(page.locator('body')).toHaveAttribute('data-sticker-variant-id', 'roundrect-80x20');
  await expect(page.locator('#textInput')).toBeVisible();

  await picker.locator('[data-sticker-option="circle-24"][data-sticker-bg="#b69249"]').click();
  await expect(page.locator('body')).toHaveAttribute('data-sticker-variant-id', 'circle-24');
  await expect(page.locator('[data-sticker-option="circle-24"][data-sticker-bg="#b69249"]')).toHaveAttribute('aria-pressed', 'true');
});
