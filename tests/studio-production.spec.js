import { expect, test } from '@playwright/test';
import {
  completeFirstStepWithText,
  expectNoHorizontalOverflow,
  fixturePath,
  isMobileProject,
  watchRuntimeErrors,
} from './helpers/studio.js';

const STUDIO_FONTS = [
  'Manrope',
  'Unbounded',
  'Comfortaa',
  'Play',
  'Yeseva One',
  'Commissioner',
  'Dela Gothic One',
  'Forum',
  'IBM Plex Sans',
  'PT Sans',
  'PT Serif',
  'Pacifico',
  'Playfair Display',
];

const selectRoundrect = async (page) => {
  await page
    .locator('[data-sticker-group="roundrect-80x20"] > summary')
    .click();
  await page
    .locator(
      '[data-sticker-option="roundrect-80x20"][data-sticker-bg="#171717"]',
    )
    .click();
};

const visibleProducts = async (page, selector) =>
  page
    .locator(selector)
    .evaluateAll((items) =>
      items
        .filter(
          (item) => !item.hidden && getComputedStyle(item).display !== 'none',
        )
        .map(
          (item) =>
            item.dataset.productType || item.dataset.mobileProductSample,
        ),
    );

test('production SVG flattens vector logos without linked nested files @smoke', async ({
  page,
}) => {
  await page.goto('/studio/?product=sticker', { waitUntil: 'networkidle' });
  await page.locator('#textInput').fill('Печатает Максим');
  await page.locator('#logoInput').setInputFiles(fixturePath('test-logo.svg'));
  await page.locator('#continueUpload').click();

  const result = await page.evaluate(() => {
    const previewImage = document.querySelector('#stickerContent image');
    const svg = window.RibbonStudioProduction.serialize('sticker');
    return {
      previewImage: Boolean(previewImage),
      hasNestedSvgData: svg.includes('data:image/svg+xml'),
      hasProductionGroup: /<g[^>]*transform=/.test(svg),
      hasExternalLink: /(?:href|xlink:href)="(?:blob:|file:|https?:)/.test(svg),
      hasLogoPath: svg.includes('<path'),
    };
  });

  expect(result.previewImage).toBe(true);
  expect(result.hasNestedSvgData).toBe(false);
  expect(result.hasProductionGroup).toBe(true);
  expect(result.hasExternalLink).toBe(false);
  expect(result.hasLogoPath).toBe(true);
});

test('production geometry: full-bleed ribbon height, 2.5 mm sticker margins, circular bounds @smoke', async ({
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
      ribbonMargin: geometry.RIBBON_PRINT_MARGIN_MM,
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
  // The ribbon prints full-bleed across its width: the whole ribbon height
  // is printable (margin 0), while die-cut stickers keep the 2.5 mm margin.
  expect(result.ribbonMargin).toBe(0);
  expect(result.ribbons).toEqual([15, 20]);
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
  await page.goto('/studio/?product=sticker', { waitUntil: 'networkidle' });
  await page.locator('#textInput').fill('Линейный live тест');
  await page.locator('#logoInput').setInputFiles(fixturePath('test-logo.svg'));
  await selectRoundrect(page);
  await page.locator('#continueUpload').click();

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
  expect(
    (result.outer.width - result.bounds.x - result.bounds.width) / scale,
  ).toBeCloseTo(2.5, 5);
  expect(
    (result.outer.height - result.bounds.y - result.bounds.height) / scale,
  ).toBeCloseTo(2.5, 5);
  expect(result.bounds.radius).toBe(0);
  expect(result.layout.valid).toBe(true);
  expect(result.layout.logoBox.x).toBeLessThan(result.layout.textBox.x);
  expect(
    result.layout.logoBox.height / result.layout.printable.height,
  ).toBeGreaterThan(0.99);
  expect(
    result.layout.logoBox.y + result.layout.logoBox.height / 2,
  ).toBeCloseTo(result.layout.textBox.y + result.layout.textBox.height / 2, 2);
  expect(result.layout.textBox.width).toBeGreaterThan(0);
  expect(
    result.layout.textBox.x + result.layout.textBox.width,
  ).toBeLessThanOrEqual(result.bounds.x + result.bounds.width + 0.001);
  expect(result.images).toBe(1);
  expect(result.texts).toBe(1);
});

test('roundrect text-only expands to the printable area and manual movement stays clamped @smoke', async ({
  page,
}) => {
  await page.goto('/studio/?product=sticker', { waitUntil: 'networkidle' });
  await page.locator('#textInput').fill('OK');
  await selectRoundrect(page);
  await page.locator('#continueUpload').click();

  const auto = await page.evaluate(
    () => JSON.parse(document.body.dataset.studioLayout).sticker,
  );
  expect(auto.valid).toBe(true);
  const widthFill = auto.textBox.width / auto.printable.width;
  const heightFill = auto.textBox.height / auto.printable.height;
  expect(Math.max(widthFill, heightFill)).toBeGreaterThan(0.9);
  expect(heightFill).toBeGreaterThan(0.2);

  await page.locator('#layoutModeChoice button[data-value="manual"]').click();
  await page.locator('#fontSize').evaluate((input) => {
    input.value = input.max;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.locator('#textOffsetX').evaluate((input) => {
    input.value = input.max;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });

  const manual = await page.evaluate(
    () => JSON.parse(document.body.dataset.studioLayout).sticker,
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
  await page.goto('/studio/?product=sticker', { waitUntil: 'networkidle' });
  await page.locator('#textInput').fill('Текст на максимум');
  await page
    .locator('#logoInput')
    .setInputFiles(fixturePath('transparent-logo.png'));
  await expect(page.locator('#traceStatus')).toBeVisible();
  await selectRoundrect(page);
  await page.locator('#continueUpload').click();

  const metrics = await page.evaluate(() => {
    const layout = JSON.parse(document.body.dataset.studioLayout).sticker;
    const image = document.querySelector('#stickerContent image');
    const href = image?.getAttribute('href') || '';
    const svg = href.startsWith('data:image/svg+xml;base64,')
      ? atob(href.split(',')[1])
      : '';
    const viewBox = svg
      .match(/viewBox="([^"]+)"/)?.[1]
      ?.split(/\s+/)
      .map(Number);
    return { layout, viewBox };
  });

  expect(metrics.layout.valid).toBe(true);
  expect(
    metrics.layout.logoBox.height / metrics.layout.printable.height,
  ).toBeGreaterThan(0.99);
  expect(metrics.layout.textBox.height).toBeGreaterThan(0);
  expect(metrics.layout.textScaleY).toBe(1);
  expect(metrics.viewBox?.[2]).toBeLessThan(46);
  expect(metrics.viewBox?.[3]).toBeLessThan(48);
});

test('ribbon entry keeps sticker preview hidden on settings @smoke', async ({
  page,
}) => {
  await page.goto('/studio/?product=ribbon', { waitUntil: 'networkidle' });
  await page.getByLabel('Надпись на ленте').fill('Мой бренд');
  await page.locator('#continueUpload').click();

  await expect(page.locator('#scene-kit')).toHaveClass(/showcase-ribbons-only/);
  expect(
    await page
      .locator('[data-product-type="sticker"]')
      .evaluateAll((items) => items.every((item) => item.hidden)),
  ).toBe(true);
  expect(
    await page
      .locator('[data-product-type="ribbon"]')
      .evaluateAll((items) =>
        items.some(
          (item) => !item.hidden && getComputedStyle(item).display !== 'none',
        ),
      ),
  ).toBe(true);
});

test('product modes keep only the active preview until bundle order @smoke', async ({
  page,
}) => {
  const expectOnly = async (product) => {
    const showcase = await visibleProducts(
      page,
      '#productShowcase [data-product-type]',
    );
    const mobile = await visibleProducts(page, '[data-mobile-product-sample]');
    expect(new Set(showcase)).toEqual(new Set([product]));
    expect(new Set(mobile)).toEqual(new Set([product]));
  };
  const openFresh = async (product) => {
    await page.goto(`/studio/?product=${product}`, {
      waitUntil: 'networkidle',
    });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'networkidle' });
  };

  await openFresh('ribbon');
  await page.getByLabel('Надпись на ленте').fill('Лента');
  await expectOnly('ribbon');
  await page.locator('#continueUpload').click();
  await expectOnly('ribbon');
  await page.locator('#panel-settings .next-panel').click();
  await expectOnly('ribbon');

  await openFresh('sticker');
  await page.getByLabel('Надпись на стикере').fill('Стикер');
  await expectOnly('sticker');
  await page.locator('#continueUpload').click();
  await expectOnly('sticker');
  await page.locator('#panel-settings .next-panel').click();
  await expectOnly('sticker');

  await openFresh('bundle');
  await page.getByLabel('Надпись на ленте').fill('Комплект');
  await page
    .locator('#contentProductChoice [data-content-product="ribbon"]')
    .click();
  await expectOnly('ribbon');
  await page
    .locator('#contentProductChoice [data-content-product="sticker"]')
    .click();
  await expectOnly('sticker');
  await page.locator('#continueUpload').click();
  await page.locator('[data-mobile-product-sample="sticker"]').click();
  await expectOnly('sticker');
  await page.locator('#panel-settings .next-panel').click();
  expect(
    new Set(
      await visibleProducts(page, '#productShowcase [data-product-type]'),
    ),
  ).toEqual(new Set(['ribbon', 'sticker']));
});

test('plain entry opens an isolated sticker editor with proportional text size @smoke', async ({
  page,
}) => {
  await page.goto('/studio/', { waitUntil: 'networkidle' });
  await page.locator('[data-start-product="sticker"]').click();
  await page.locator('#textInput').fill('Отдельный стикер');
  await selectRoundrect(page);
  await page.locator('#continueUpload').click();
  expect(
    await page
      .locator('[data-product-type="ribbon"]')
      .evaluateAll((items) =>
        items.every((item) => item.classList.contains('is-hidden')),
      ),
  ).toBe(true);
  expect(
    await page
      .locator('[data-product-type="sticker"]')
      .evaluateAll((items) =>
        items.some((item) => !item.classList.contains('is-hidden')),
      ),
  ).toBe(true);
  await page.locator('#layoutModeChoice button[data-value="manual"]').click();
  await expect(page.locator('#textScaleY')).toHaveCount(0);
  const before = await page.evaluate(
    () => JSON.parse(document.body.dataset.studioLayout).sticker.fontSizeRatio,
  );
  await page.locator('#fontSize').evaluate((input) => {
    input.value = input.max;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  const after = await page.evaluate(
    () => JSON.parse(document.body.dataset.studioLayout).sticker,
  );
  expect(after.fontSizeRatio).toBeGreaterThan(0);
  expect(after.fontSizeRatio).toBeGreaterThanOrEqual(before);
  expect(after.textScaleY).toBe(1);
  expect(after.textBox.y).toBeGreaterThanOrEqual(0 - 0.001);
  expect(after.textBox.y + after.textBox.height).toBeLessThanOrEqual(1 + 0.001);
});

test('roundrect uses proportional text size and ink-bound text box @smoke', async ({
  page,
}) => {
  await page.goto('/studio/?product=sticker', { waitUntil: 'networkidle' });
  await page.locator('#textInput').fill('Вертикальный текст');
  await selectRoundrect(page);
  await page.locator('#continueUpload').click();
  await page.locator('#layoutModeChoice button[data-value="manual"]').click();
  await expect(page.locator('#textScaleY')).toHaveCount(0);
  await page.locator('#fontSize').evaluate((input) => {
    input.value = input.max;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  const roundrect = await page.evaluate(() => {
    const layout = JSON.parse(document.body.dataset.studioLayout).sticker;
    return { layout };
  });
  expect(roundrect.layout.textScaleY).toBe(1);
  expect(roundrect.layout.textBox.width).toBeGreaterThan(0);
  expect(roundrect.layout.textBox.height).toBeGreaterThan(0);
  expect(roundrect.layout.textBox.x).toBeGreaterThanOrEqual(
    roundrect.layout.printable.x - 0.001,
  );
  expect(
    roundrect.layout.textBox.x + roundrect.layout.textBox.width,
  ).toBeLessThanOrEqual(
    roundrect.layout.printable.x + roundrect.layout.printable.width + 0.001,
  );
  expect(roundrect.layout.textBox.y).toBeGreaterThanOrEqual(
    roundrect.layout.printable.y - 0.001,
  );
  expect(
    roundrect.layout.textBox.y + roundrect.layout.textBox.height,
  ).toBeLessThanOrEqual(
    roundrect.layout.printable.y + roundrect.layout.printable.height + 0.001,
  );

  await expect(page.locator('#textScaleY')).toHaveCount(0);
});

test('roundrect logo fills printable height and shape stays in create step @smoke', async ({
  page,
}) => {
  await page.goto('/studio/?product=sticker', { waitUntil: 'networkidle' });
  await page.locator('#textInput').fill('');
  await page.locator('#logoInput').setInputFiles(fixturePath('test-logo.svg'));
  await selectRoundrect(page);
  await page.locator('#continueUpload').click();

  await expect(page.locator('#stickerVariantChoice')).toHaveCount(0);
  await expect(page.locator('#stickerSizeChoice')).toHaveCount(0);

  const full = await page.evaluate(() => {
    const layout = JSON.parse(document.body.dataset.studioLayout).sticker;
    return {
      logoFill: layout.logoBox.height / layout.printable.height,
      logoWidth: layout.logoBox.width,
    };
  });
  expect(full.logoFill).toBeGreaterThan(0.98);
  expect(full.logoWidth).toBeGreaterThan(0);

  await page.locator('#layoutModeChoice button[data-value="manual"]').click();
  await page.locator('#logoScale').evaluate((input) => {
    input.value = '50';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  const half = await page.evaluate(() => {
    const layout = JSON.parse(document.body.dataset.studioLayout).sticker;
    return layout.logoBox.height / layout.printable.height;
  });
  expect(half).toBeGreaterThan(0.45);
  expect(half).toBeLessThan(0.55);
});

test('all sticker fonts keep ink-aware text inside printable bounds @smoke', async ({
  page,
}) => {
  await page.goto('/studio/?product=sticker', { waitUntil: 'networkidle' });
  await page.locator('#textInput').fill('Печатает Максим');
  await selectRoundrect(page);
  await page.locator('#continueUpload').click();

  for (const font of STUDIO_FONTS) {
    await page.locator('#fontSelect').selectOption(font);
    await page.evaluate(
      ({ family, sample }) =>
        document.fonts?.load(`700 32px "${family}"`, sample),
      { family: font, sample: 'Печатает Максим' },
    );
    await page.waitForTimeout(50);
    const result = await page.evaluate(() => {
      const layout = JSON.parse(document.body.dataset.studioLayout).sticker;
      const box = layout.textBox;
      const printable = layout.printable;
      return {
        box,
        printable,
        fontLoaded: document.fonts.check(
          `700 32px "${document.querySelector('#fontSelect').value}"`,
          'Печатает Максим',
        ),
      };
    });
    expect(result.fontLoaded).toBe(true);
    expect(result.box.width).toBeGreaterThan(0);
    expect(result.box.height).toBeGreaterThan(0);
    expect(result.box.x).toBeGreaterThanOrEqual(result.printable.x - 0.001);
    expect(result.box.y).toBeGreaterThanOrEqual(result.printable.y - 0.001);
    expect(result.box.x + result.box.width).toBeLessThanOrEqual(
      result.printable.x + result.printable.width + 0.001,
    );
    expect(result.box.y + result.box.height).toBeLessThanOrEqual(
      result.printable.y + result.printable.height + 0.001,
    );
  }
});

test('roundrect manual mode allows independent logo and text placement @smoke', async ({
  page,
}) => {
  await page.goto('/studio/?product=sticker', { waitUntil: 'networkidle' });
  await page.locator('#textInput').fill('Свободная композиция');
  await page.locator('#logoInput').setInputFiles(fixturePath('test-logo.svg'));
  await selectRoundrect(page);
  await page.locator('#continueUpload').click();
  await page.locator('#layoutModeChoice button[data-value="manual"]').click();
  await page.locator('#logoOffsetX').evaluate((input) => {
    input.value = input.max;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.locator('#textOffsetX').evaluate((input) => {
    input.value = input.min;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });

  const layout = await page.evaluate(
    () => JSON.parse(document.body.dataset.studioLayout).sticker,
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
    isMobileProject(testInfo.project.name)
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
  test.skip(!isMobileProject(testInfo.project.name));

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

test('repeat interval 0 keeps the whole artwork and never clips the preview', async ({
  page,
}) => {
  const fullText = 'Название бренда для упаковки';
  await page.goto('/studio/?product=set', { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);

  // Empty state: the interval already defaults to the ribbon width (owner
  // regression — the badge used to read "зазор 0.0 мм" with a broken demo
  // preview before any content existed).
  await expect(page.locator('body')).toHaveAttribute(
    'data-ribbon-repeat-gap-mm',
    /^\d+\.00$/,
  );
  const emptyGap = Number(
    await page.locator('body').getAttribute('data-ribbon-repeat-gap-mm'),
  );
  const ribbonWidth = Number(
    await page.locator('body').getAttribute('data-ribbon-width'),
  );
  expect(emptyGap).toBe(ribbonWidth);

  // Interval 0 = repeats back-to-back. The repeat step is always derived
  // as content + g, so the artwork can never end up clipped into a
  // "Пр…" strip: the step simply follows the content width.
  await page.locator('#repeatMm').evaluate((element) => {
    element.value = '0';
    element.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await expect(page.locator('#repeatMm')).toHaveValue('0');
  await page.locator('#textInput').fill(fullText);

  const result = await page.evaluate(() => {
    const layout = JSON.parse(document.body.dataset.studioLayout).ribbon;
    return {
      layout,
      repeatMm: Number(document.body.dataset.ribbonRepeatMm),
      contentWidthMm: Number(document.body.dataset.ribbonContentWidthMm),
      gapMm: Number(document.body.dataset.ribbonRepeatGapMm),
      production: window.RibbonStudioProduction.serialize('ribbon'),
    };
  });
  expect(result.gapMm).toBe(0);
  expect(result.layout.valid).toBe(true);
  expect(result.layout.overflow).toBeUndefined();
  // Step equals the content width exactly (interval 0).
  expect(Math.abs(result.repeatMm - result.contentWidthMm)).toBeLessThan(0.6);
  // No clipped fragment anywhere: the production file carries the full
  // text even at the tightest interval.
  expect(result.production).toContain(fullText);
  expect(result.production).not.toContain('…');

  await expect(page.locator('.ribbon-overflow-card-mobile')).toBeHidden();
  await expect(page.locator('.mobile-products-ribbon-text')).toHaveText(
    fullText,
  );
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
  expect(result.serialized).toContain('<g transform=');
  expect(result.serialized).toContain('<path');
  await expectNoHorizontalOverflow(page);
});

test('long production text is invalid and is not rendered outside printable areas', async ({
  page,
}) => {
  await page.goto('/studio/?product=set', { waitUntil: 'networkidle' });
  await page.locator('#textInput').fill('ОЧЕНЬ ДЛИННЫЙ ТЕКСТ '.repeat(80));

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

  // На медленных CI-раннерах (Linux WebKit) layout может появиться позже
  // сетевого простоя; ждём, пока sticker-раскладка полностью не посчитается.
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const layouts = JSON.parse(
            document.body.dataset.studioLayout || '{}',
          );
          return Boolean(layouts.sticker?.logoBox && layouts.sticker?.textBox);
        }),
      { timeout: 30_000 },
    )
    .toBe(true);

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

test('automatic repeat interval equals the ribbon width for every artwork kind', async ({
  page,
}, testInfo) => {
  await page.goto('/studio/?product=set', { waitUntil: 'networkidle' });

  const readRepeat = () =>
    page.evaluate(() => ({
      repeatMm: Number(document.body.dataset.ribbonRepeatMm),
      source: document.body.dataset.ribbonRepeatSource,
      mode: document.body.dataset.ribbonRepeatMode,
      contentWidthMm: Number(document.body.dataset.ribbonContentWidthMm),
      logoWidthMm: Number(document.body.dataset.ribbonLogoWidthMm),
      autoGapMm: Number(document.body.dataset.ribbonAutoGapMm),
      repeatGapMm: Number(document.body.dataset.ribbonRepeatGapMm),
      ribbonWidthMm: Number(document.body.dataset.ribbonWidth),
    }));
  const expectAutoRepeat = async (source) => {
    const result = await readRepeat();
    // The interval between repeats is always the ribbon's own physical
    // width (15 or 20 mm), whatever the content — and the same interval
    // separates logo from text inside a composition.
    const expectedGapMm = result.ribbonWidthMm;
    // Auto mode keeps the exact desired distance instead of rounding up to
    // a 5 mm print grid, so the repeat step is exactly content width + the
    // interval. contentWidthMm/autoGapMm come from dataset strings rounded
    // to 2 decimals for display, so compare with a small tolerance.
    const expected = Math.min(
      250,
      Math.max(5, result.contentWidthMm + expectedGapMm),
    );
    expect(result.source).toBe(source);
    expect(result.mode).toBe('auto');
    expect(result.autoGapMm).toBeCloseTo(expectedGapMm, 1);
    expect(result.repeatGapMm).toBeCloseTo(expectedGapMm, 1);
    expect(Math.abs(result.repeatMm - expected)).toBeLessThanOrEqual(0.6);
    // The slider shows the interval itself and drags smoothly (step="any");
    // the auto interval is a whole number of mm, so the slider value
    // matches it exactly. Geometry always uses the precise value checked
    // above, not the slider's string.
    const sliderValue = Number(await page.locator('#repeatMm').inputValue());
    expect(Math.abs(sliderValue - result.repeatGapMm)).toBeLessThanOrEqual(0.75);
    return result;
  };

  await expect(page.locator('#repeatMm')).toHaveAttribute('type', 'range');
  await page.locator('#textInput').fill('МАКСИМ');
  const textRepeat = await expectAutoRepeat('text');

  if (isMobileProject(testInfo.project.name)) {
    const ribbon = page.locator('.mobile-products-ribbon-sample');
    await expect
      .poll(() => ribbon.locator('.mobile-products-ribbon-repeat-text').count())
      .toBeGreaterThan(0);
    await expect(ribbon).toHaveAttribute(
      'data-ribbon-repeat-mm',
      String(textRepeat.repeatMm),
    );
    // The live scene keeps three repeat cells mounted at all times (left/
    // center/right) so zooming and panning never trigger a re-render; the
    // side cells are intentionally allowed to sit partly or fully outside
    // the visible surface. Only the cell with the most overlap with the
    // surface is the one a shopper actually sees, so that is the one that
    // must render as a whole, uncropped repeat.
    const repeatTextGeometry = await ribbon
      .locator('.mobile-products-ribbon-repeat-text')
      .evaluateAll(
        (elements, surface) => {
          const bounds = surface.getBoundingClientRect();
          const intersecting = elements.filter((element) => {
            const textBounds = element.getBoundingClientRect();
            return (
              textBounds.right > bounds.left + 0.5 &&
              textBounds.left < bounds.right - 0.5
            );
          }).length;
          const central =
            elements[Math.floor(elements.length / 2)]?.getBoundingClientRect();
          return {
            // With a wide repeat step the outermost repeats legitimately
            // sit fully outside the surface; what matters is that the
            // scene still shows real repeats and the central one is whole.
            intersectingCount: intersecting,
            centralIsWhole: Boolean(
              central &&
              central.left >= bounds.left - 0.5 &&
              central.right <= bounds.right + 0.5,
            ),
          };
        },
        await ribbon.elementHandle(),
      );
    expect(repeatTextGeometry.intersectingCount).toBeGreaterThan(0);
    expect(repeatTextGeometry.centralIsWhole).toBe(true);
    const repeatOffsets = await ribbon.evaluate((surface) => {
      const central = surface.querySelector(
        '[data-mobile-products-safe-zone="ribbon-text"]',
      );
      const centralBounds = central.getBoundingClientRect();
      const centralCenter = centralBounds.left + centralBounds.width / 2;
      const centralMiddle = centralBounds.top + centralBounds.height / 2;
      const repeatPitch = Number(surface.dataset.ribbonRepeatPitchPx);
      return [
        ...surface.querySelectorAll('.mobile-products-ribbon-repeat-text'),
      ].map((element) => {
        const bounds = element.getBoundingClientRect();
        return {
          horizontal: Math.abs(
            (bounds.left + bounds.width / 2 - centralCenter) / repeatPitch,
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
  const logoRepeat = await expectAutoRepeat('logo');

  if (isMobileProject(testInfo.project.name)) {
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
    ).toBeLessThanOrEqual(1.5);
    expect(
      Math.abs(logoSizes.repeat.height - logoSizes.central.height),
    ).toBeLessThanOrEqual(1.5);
  } else {
    await expect
      .poll(() =>
        page.locator('#ribbonContent [data-production-content]').count(),
      )
      .toBeGreaterThan(1);
  }

  await page.locator('#textInput').fill('МАКСИМ');
  await expectAutoRepeat('composition');

  await expectNoHorizontalOverflow(page);
});

test('repeat guides are length-wise free and span the full ribbon width (full-bleed)', async ({
  page,
}) => {
  // The ribbon prints continuously along its length AND full-bleed across
  // its width: the printable guide spans each repeat from edge to edge on
  // both axes (0 mm margins anywhere).
  await page.goto('/studio/?product=set', { waitUntil: 'networkidle' });
  for (const repeatMm of [40, 100, 250]) {
    await page.locator('#repeatMm').evaluate((element, repeat) => {
      element.value = String(repeat);
      element.dispatchEvent(new Event('input', { bubbles: true }));
    }, repeatMm);
    const result = await page.evaluate((repeat) => {
      const layout = JSON.parse(document.body.dataset.studioLayout).ribbon;
      const guide = document.querySelector(
        '.mobile-products-printable-guide.ribbon-guide',
      );
      return {
        leftMm: layout.printable.x * repeat,
        rightMm: (1 - layout.printable.x - layout.printable.width) * repeat,
        topMm: layout.printable.y * Number(document.body.dataset.ribbonWidth),
        bottomMm:
          (1 - layout.printable.y - layout.printable.height) *
          Number(document.body.dataset.ribbonWidth),
        guideLeft: guide.style.left,
        guideTop: parseFloat(guide.style.top),
        guideBottom: parseFloat(guide.style.bottom),
      };
    }, repeatMm);
    expect(result.leftMm).toBeCloseTo(0, 7);
    expect(result.rightMm).toBeCloseTo(0, 7);
    expect(result.topMm).toBeCloseTo(0, 7);
    expect(result.bottomMm).toBeCloseTo(0, 7);
    expect(parseFloat(result.guideLeft)).toBeCloseTo(0, 5);
    expect(result.guideTop).toBeCloseTo(0, 5);
    expect(result.guideBottom).toBeCloseTo(0, 5);
  }
});

test('order step hides the repeat interval controls in the sidebar', async ({
  page,
}) => {
  await page.goto('/studio/?product=set', { waitUntil: 'networkidle' });
  await page.locator('#textInput').fill('МАКСИМ');

  // The sidebar slider lives on the tuning step «02 Настроить».
  await page.locator('.nav-item[data-panel="settings"]').click();
  await expect(page.locator('body')).toHaveAttribute(
    'data-active-panel',
    'settings',
  );
  await expect(page.locator('#repeatMm')).toBeVisible();

  // Step «03 Получить» is the read-only order summary: the interval was
  // tuned on the previous steps.
  await page.locator('.nav-item[data-panel="order"]').click();
  await expect(page.locator('body')).toHaveAttribute(
    'data-active-panel',
    'order',
  );
  await expect(page.locator('#repeatMm')).toBeHidden();
  await expect(page.locator('#repeatHint')).toBeHidden();
  await expect(page.locator('.repeat-control-head')).toBeHidden();
});

test('settings step offers the ribbon/sticker switch in bundle mode and drives the active product', async ({
  page,
}) => {
  await page.goto('/studio/?product=set', { waitUntil: 'networkidle' });
  await page.locator('#textInput').fill('МАКСИМ');
  await page.locator('.nav-item[data-panel="settings"]').click();

  const switcher = page.locator('#settingsProductSwitch');
  await expect(switcher).toBeVisible();
  await expect(switcher.locator('[data-settings-product-choice="ribbon"]'))
    .toHaveClass(/active/);

  await switcher.locator('[data-settings-product-choice="sticker"]').click();
  await expect(page.locator('body')).toHaveAttribute(
    'data-active-settings-product',
    'sticker',
  );
  await expect(page.locator('#activeSettingsTitle')).toHaveText('Стикер');
  await expect(
    switcher.locator('[data-settings-product-choice="sticker"]'),
  ).toHaveClass(/active/);
  await expect(
    page.locator('[data-settings-product="ribbon"]'),
  ).toBeHidden();

  await switcher.locator('[data-settings-product-choice="ribbon"]').click();
  await expect(page.locator('body')).toHaveAttribute(
    'data-active-settings-product',
    'ribbon',
  );
  await expect(page.locator('[data-settings-product="ribbon"]')).toBeVisible();
});

test('settings step hides the ribbon/sticker switch for single-product orders', async ({
  page,
}) => {
  await page.goto('/studio/?product=ribbon', { waitUntil: 'networkidle' });
  await page.locator('#textInput').fill('МАКСИМ');
  await page.locator('.nav-item[data-panel="settings"]').click();
  await expect(page.locator('#settingsProductSwitch')).toBeHidden();
});

test('ribbon text fills the full ribbon height at the top of the size slider', async ({
  page,
}) => {
  await page.goto('/studio/?product=ribbon', { waitUntil: 'networkidle' });
  await page.locator('#textInput').fill('МАКСИМ');
  await page.locator('.nav-item[data-panel="settings"]').click();

  const readTextBox = () =>
    page.evaluate(() => {
      const layout = JSON.parse(document.body.dataset.studioLayout).ribbon;
      return {
        textBox: layout.textBox,
        printable: layout.printable,
      };
    });

  const before = await readTextBox();
  // The printable band is the full ribbon now (0 mm cross-width margin).
  expect(before.printable.y).toBeCloseTo(0, 5);
  expect(before.printable.height).toBeCloseTo(1, 5);
  expect(before.textBox.height).toBeLessThan(0.9);

  await page.locator('#fontSize').evaluate((element) => {
    element.value = element.max;
    element.dispatchEvent(new Event('input', { bubbles: true }));
  });
  const after = await readTextBox();
  // At the slider's top the text reaches the whole ribbon height, edge to
  // edge — not a margin-inset band.
  expect(after.textBox.height).toBeGreaterThan(0.95);
});

test('ribbon text and logo travel the full ribbon height vertically', async ({
  page,
}) => {
  await page.goto('/studio/?product=ribbon', { waitUntil: 'networkidle' });
  await page.locator('#textInput').fill('МАКСИМ');
  await page.locator('.nav-item[data-panel="settings"]').click();

  const readTextBox = () =>
    page.evaluate(
      () => JSON.parse(document.body.dataset.studioLayout).ribbon.textBox,
    );
  const centered = await readTextBox();
  await page.locator('#textOffsetY').evaluate((element) => {
    element.value = element.min;
    element.dispatchEvent(new Event('input', { bubbles: true }));
  });
  const top = await readTextBox();
  await page.locator('#textOffsetY').evaluate((element) => {
    element.value = element.max;
    element.dispatchEvent(new Event('input', { bubbles: true }));
  });
  const bottom = await readTextBox();

  // The full-height travel range: top edge at the ribbon edge, bottom edge
  // at the ribbon edge.
  expect(top.y).toBeCloseTo(0, 1);
  expect(bottom.y + bottom.height).toBeCloseTo(1, 1);
  expect(top.y).toBeLessThan(centered.y);
  expect(bottom.y).toBeGreaterThan(centered.y);
  expect(centered.y + centered.height / 2).toBeCloseTo(0.5, 1);
});

test('sticker create step keeps one active model and compact future shape picker @smoke', async ({
  page,
}) => {
  await page.goto('/studio/', { waitUntil: 'networkidle' });
  await page.locator('[data-start-product="sticker"]').click();

  const picker = page.locator('#stickerProductPicker');
  await expect(picker).toBeVisible();
  await expect(page.locator('body')).toHaveAttribute(
    'data-sticker-variant-id',
    'circle-24',
  );
  await expect(page.locator('body')).toHaveAttribute(
    'data-sticker-bg',
    '#171717',
  );
  await expect(page.locator('body')).toHaveAttribute(
    'data-sticker-print',
    'silver',
  );
  await expect(picker.locator('[data-sticker-option]')).toHaveCount(9);
  await expect(
    picker.locator(
      '[data-sticker-group="transparent-circle"] [data-sticker-option]',
    ),
  ).toHaveCount(3);
  expect(
    await page.evaluate(
      () =>
        document.querySelector(
          '#stickerProductPicker .sticker-product-picker-options',
        ).scrollWidth <=
        document.querySelector(
          '#stickerProductPicker .sticker-product-picker-options',
        ).clientWidth,
    ),
  ).toBe(true);
  await picker
    .locator('[data-sticker-group="transparent-circle"] > summary')
    .click();
  const transparentSummary = picker.locator(
    '[data-sticker-group="transparent-circle"] > summary',
  );
  const transparentMenu = picker.locator(
    '[data-sticker-group="transparent-circle"] .sticker-product-group-menu',
  );
  await expect
    .poll(async () => {
      const summaryBox = await transparentSummary.boundingBox();
      const menuBox = await transparentMenu.boundingBox();
      return summaryBox && menuBox
        ? menuBox.y >= summaryBox.y + summaryBox.height
        : false;
    })
    .toBe(true);
  await expect(
    picker.locator(
      '[data-sticker-group="transparent-circle"] [data-sticker-option="circle-40"]',
    ),
  ).toBeVisible();
  await expect(
    picker.locator('[data-sticker-option-disabled="heart"]'),
  ).toHaveCount(1);
  await expect(
    picker.locator('[data-sticker-option-disabled="heart"]'),
  ).toHaveAttribute('aria-disabled', 'true');
  await expect(picker.locator('[data-sticker-option].active')).toHaveCount(1);
  await expect(page.locator('#textInput')).toBeVisible();
  await expect(page.locator('#dropZone')).toBeVisible();

  await picker
    .locator('[data-sticker-group="roundrect-80x20"] > summary')
    .click();
  await expect(page.locator('[data-preview-zoom="in"]')).toBeEnabled();
  await picker
    .locator(
      '[data-sticker-option="roundrect-80x20"][data-sticker-bg="#171717"]',
    )
    .click();
  await expect(page.locator('body')).toHaveAttribute(
    'data-sticker-print',
    'white',
  );
  await expect(page.locator('.mobile-products-sticker-sample')).toHaveCSS(
    'background-color',
    'rgb(23, 23, 23)',
  );
  await expect(picker.locator('[data-sticker-option].active')).toHaveCount(1);
  await expect(
    picker.locator('[data-sticker-group="roundrect-80x20"] > summary'),
  ).toHaveClass(/active/);
  await expect(
    picker.locator('[data-sticker-group="transparent-circle"] > summary'),
  ).not.toHaveClass(/active/);
  await expect(page.locator('body')).toHaveAttribute(
    'data-sticker-variant-id',
    'roundrect-80x20',
  );
  await expect(page.locator('#textInput')).toBeVisible();

  await picker.locator('[data-sticker-group="circle-24"] > summary').click();
  await picker
    .locator('[data-sticker-option="circle-24"][data-sticker-bg="#b69249"]')
    .click();
  await expect(page.locator('body')).toHaveAttribute(
    'data-sticker-print',
    'black',
  );
  await expect(page.locator('body')).toHaveAttribute(
    'data-sticker-variant-id',
    'circle-24',
  );
  await expect(
    page.locator(
      '[data-sticker-option="circle-24"][data-sticker-bg="#b69249"]',
    ),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.mobile-products-sticker-sample')).toHaveCSS(
    'background-color',
    'rgb(182, 146, 73)',
  );

  await picker
    .locator('[data-sticker-group="roundrect-80x20"] > summary')
    .click();
  await picker
    .locator(
      '[data-sticker-option="roundrect-80x20"][data-sticker-bg="#b7202d"]',
    )
    .click();
  await expect(page.locator('body')).toHaveAttribute(
    'data-sticker-print',
    'gold',
  );
  await expect(page.locator('.mobile-products-sticker-sample')).toHaveCSS(
    'background-color',
    'rgb(183, 32, 45)',
  );
});

test('bundle mode keeps one project while switching order composition @smoke', async ({
  page,
}) => {
  await page.goto('/studio/?product=choose', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Собрать комплект →' }).click();

  await expect(page.locator('#orderModeSwitcher')).toBeVisible();
  await expect(
    page.locator('#orderModeSwitcher [data-order-mode="bundle"]'),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('body')).toHaveAttribute('data-has-ribbon', 'true');
  await expect(page.locator('body')).toHaveAttribute(
    'data-has-sticker',
    'true',
  );

  await page.locator('#textInput').fill('Общий текст комплекта');
  await page.locator('#orderModeSwitcher [data-order-mode="ribbon"]').click();
  await expect(
    page.locator('#orderModeSwitcher [data-order-mode="ribbon"]'),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('body')).toHaveAttribute('data-has-ribbon', 'true');
  await expect(page.locator('body')).toHaveAttribute(
    'data-has-sticker',
    'false',
  );

  await page.locator('#orderModeSwitcher [data-order-mode="bundle"]').click();
  await expect(page.locator('body')).toHaveAttribute('data-has-ribbon', 'true');
  await expect(page.locator('body')).toHaveAttribute(
    'data-has-sticker',
    'true',
  );
  await expect(page.locator('#textInput')).toHaveValue('Общий текст комплекта');
});

test('restored traced logo is retightened before roundrect layout @smoke', async ({
  page,
}) => {
  await page.goto('/studio/?product=sticker', { waitUntil: 'networkidle' });
  await page.locator('#textInput').fill('');
  await page.locator('#logoInput').setInputFiles(fixturePath('test-logo.svg'));
  await selectRoundrect(page);
  await page.locator('#continueUpload').click();

  await page.evaluate(() => {
    const key = 'ribbon-studio-v042';
    const stored = JSON.parse(localStorage.getItem(key));
    const logo = stored?.content?.logo?.common;
    if (!logo?.logoSvgSource) throw new Error('stored common logo is missing');
    logo.logoSvgSource = logo.logoSvgSource.replace(
      /viewBox="[^"]+"/,
      'viewBox="0 0 1000 1000"',
    );
    logo.logo = { ...logo.logo, ratio: 1 };
    localStorage.setItem(key, JSON.stringify(stored));
  });

  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('[data-panel="upload"]').click();
  await selectRoundrect(page);
  await page.locator('#continueUpload').click();
  const result = await page.evaluate(() => {
    const layout = JSON.parse(document.body.dataset.studioLayout).sticker;
    const image = document.querySelector('#stickerContent image');
    const href = image?.getAttribute('href') || '';
    const svg = href.startsWith('data:image/svg+xml;base64,')
      ? atob(href.split(',')[1])
      : '';
    const viewBox = svg
      .match(/viewBox="([^"]+)"/)?.[1]
      ?.split(/\s+/)
      .map(Number);
    return { layout, viewBox };
  });
  expect(result.layout.valid).toBe(true);
  expect(
    result.layout.logoBox.height / result.layout.printable.height,
  ).toBeGreaterThan(0.99);
  expect(result.viewBox?.[2]).toBeLessThan(200);
  expect(result.viewBox?.[3]).toBeLessThan(200);
});

test('print SVG artifacts are black, guide-free, and sized in millimeters', async ({
  page,
}) => {
  await page.goto('/studio/?product=set', { waitUntil: 'networkidle' });
  await page.locator('#textInput').fill('Печатает Максим');
  const result = await page.evaluate(() => ({
    ribbon: window.RibbonStudioGeometry.serializePrintSvg(
      document.querySelector('#ribbonSvg'),
      { widthMm: 80, heightMm: 15 },
    ),
    sticker: window.RibbonStudioGeometry.serializePrintSvg(
      document.querySelector('#stickerSvg'),
      { widthMm: 24, heightMm: 24 },
    ),
  }));
  expect(result.ribbon).toContain('width="80mm"');
  expect(result.ribbon).toContain('height="15mm"');
  expect(result.sticker).toContain('width="24mm"');
  expect(result.sticker).toContain('height="24mm"');
  for (const svg of [result.ribbon, result.sticker]) {
    expect(svg).toContain('data-file-purpose="print-black"');
    expect(svg).toContain('data-target-dpi="300"');
    expect(svg).not.toContain('data-preview-overlay');
    expect(svg).not.toContain('id="ribbonBase"');
    expect(svg).not.toContain('id="stickerBg"');
  }
  expect(result.ribbon).toContain('#000000');
});
