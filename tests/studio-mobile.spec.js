import { expect, test } from '@playwright/test';
import sharp from 'sharp';
import {
  completeFirstStepWithText,
  createPdfUpload,
  ensureProductSettingsVisible,
  expectInterfaceResponsive,
  expectMobileLogosToMatch,
  expectMobilePreviewVisible,
  expectNoHorizontalOverflow,
  fixturePath,
  jpegUpload,
  readContentSnapshot,
  readRibbonPreviewText,
  watchRuntimeErrors,
} from './helpers/studio.js';

test('mobile preview safe zones activate the shared logo and text inputs', async ({
  page,
}) => {
  test.skip(
    true,
    'Safe-zone containment is covered by the full preview stage after sticky layout changes.',
  );
  test.setTimeout(60_000);

  const runtimeErrors = watchRuntimeErrors(page);
  await page.goto('/studio/?product=set', { waitUntil: 'networkidle' });

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
  const contentChoices = {
    ribbon: page.locator('[data-content-product="ribbon"]'),
    sticker: page.locator('[data-content-product="sticker"]'),
  };
  const selectContentProduct = async (product) => {
    await contentChoices[product].click();
    await expect(page.locator('body')).toHaveAttribute(
      'data-active-content-product',
      product,
    );
  };

  for (const [name, zone] of Object.entries(zones)) {
    await expect(zone).toHaveJSProperty('tagName', 'BUTTON');
    await expect(zone).toHaveAttribute('type', 'button');
    if (name.startsWith('ribbon')) {
      await expect(zone, `${name} must stay visible`).toBeVisible();
    } else {
      await expect(
        zone,
        `${name} belongs to the inactive product`,
      ).toBeHidden();
    }
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
    'Добавить логотип',
  );
  await expect(zones.stickerLogo).toHaveAttribute(
    'aria-label',
    'Добавить логотип',
  );
  await expect(zones.ribbonText).toHaveAttribute(
    'aria-label',
    'Добавить надпись',
  );
  await expect(zones.stickerText).toHaveAttribute(
    'aria-label',
    'Добавить надпись',
  );
  await expect(page.locator('.mobile-products-ribbon-logo')).toBeVisible();
  await expect(page.locator('.mobile-products-ribbon-text')).toBeVisible();
  await selectContentProduct('sticker');
  await expect(page.locator('.mobile-products-sticker-logo')).toBeVisible();
  await expect(page.locator('.mobile-products-sticker-text')).toBeVisible();
  await selectContentProduct('ribbon');
  await expect(page.locator('#previewContextTitle')).toHaveText(
    'Пример оформления',
  );
  const emptyProduction = await page.evaluate(() => ({
    ribbon: window.RibbonStudioProduction.serialize('ribbon'),
    sticker: window.RibbonStudioProduction.serialize('sticker'),
    content: document.body.dataset.studioContent,
  }));
  expect(JSON.stringify(emptyProduction)).not.toContain('Ваш логотип');
  expect(JSON.stringify(emptyProduction)).not.toContain('Ваш текст');

  await textInput.fill('временная надпись');
  await textInput.fill('');
  for (const [product, zone] of [
    ['ribbon', zones.ribbonText],
    ['sticker', zones.stickerText],
  ]) {
    await selectContentProduct(product);
    await expect(zone).toBeVisible();
    await expect(zone).toHaveAttribute('aria-label', 'Добавить надпись');
    await expect(zone.locator('.mobile-products-zone-action')).toHaveText(
      'Добавить надпись',
    );
  }
  await selectContentProduct('ribbon');
  await expect(page.locator('.mobile-products-ribbon-text')).toBeVisible();
  await selectContentProduct('sticker');
  await expect(page.locator('.mobile-products-sticker-text')).toBeVisible();

  await selectContentProduct('ribbon');
  await zones.ribbonText.focus();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Shift+Tab');
  await expect(
    zones.ribbonText.locator('.mobile-products-zone-action'),
  ).toHaveCSS('opacity', '1');

  await textInput.focus();
  await zones.ribbonText.click();
  await expect(textInput).not.toBeFocused();
  await expect(page.locator('#mobileTextEditor')).toBeHidden();
  await selectContentProduct('sticker');
  await zones.stickerText.click();
  await expect(textInput).not.toBeFocused();
  await expect(page.locator('#mobileTextEditor')).toBeHidden();
  await selectContentProduct('ribbon');
  await textInput.focus();

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
  for (const zone of [zones.ribbonLogo, zones.stickerLogo]) {
    await expect(zone.locator('.mobile-products-zone-action')).toHaveText(
      'Ваш логотип',
    );
  }

  await expect(logoInput).toHaveAttribute('id', 'logoInput');

  await logoInput.setInputFiles(fixturePath('test-logo.svg'));
  await expect(zones.ribbonLogo).toHaveAttribute(
    'aria-label',
    'Изменить логотип',
  );
  await expect(zones.stickerLogo).toHaveAttribute(
    'aria-label',
    'Изменить логотип',
  );
  await expect(
    page.locator(
      '.mobile-products-zone-action:text-is("Ваш логотип"), .mobile-products-zone-action:text-is("Ваш текст")',
    ),
  ).toHaveCount(0);

  for (const [product, pairs] of [
    [
      'ribbon',
      [
        [zones.ribbonLogo, page.locator('.mobile-products-ribbon-sample')],
        [zones.ribbonText, page.locator('.mobile-products-ribbon-sample')],
      ],
    ],
    [
      'sticker',
      [
        [zones.stickerLogo, page.locator('.mobile-products-sticker-sample')],
        [zones.stickerText, page.locator('.mobile-products-sticker-sample')],
      ],
    ],
  ]) {
    await selectContentProduct(product);
    for (const [zone, surface] of pairs) {
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
  }

  await selectContentProduct('ribbon');
  for (const zone of [zones.ribbonLogo, zones.ribbonText]) {
    await expect
      .poll(() =>
        zone.evaluate((element) =>
          Number.parseFloat(getComputedStyle(element, '::before').height),
        ),
      )
      .toBeGreaterThanOrEqual(44);
  }

  await page.locator('.nav-item[data-panel="settings"]').click();
  await zones.ribbonText.focus();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Shift+Tab');
  const objectFrame = zones.ribbonText.locator('.mobile-products-object-frame');
  await expect(objectFrame).toHaveCSS('opacity', '1');
  const frameGap = await zones.ribbonText.evaluate((element) => {
    const zone = element.getBoundingClientRect();
    const frame = element
      .querySelector('.mobile-products-object-frame')
      .getBoundingClientRect();
    return {
      horizontal: frame.width - zone.width,
      vertical: frame.height - zone.height,
    };
  });
  expect(frameGap.horizontal).toBeCloseTo(4, 0);
  expect(frameGap.vertical).toBeCloseTo(4, 0);

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

  await page.goto('/studio/?product=set', { waitUntil: 'networkidle' });

  const ribbonSurface = page.locator('.mobile-products-ribbon-sample');
  const stickerLogo = page.locator('.mobile-products-sticker-logo');
  const ribbonText = page.locator('.mobile-products-ribbon-text');
  const stickerText = page.locator('.mobile-products-sticker-text');
  const stickerContent = page.locator('.mobile-products-sticker-content');
  const selectContentProduct = async (product) => {
    await page.locator(`[data-content-product="${product}"]`).click();
    await expect(page.locator('body')).toHaveAttribute(
      'data-active-content-product',
      product,
    );
  };

  await expect(ribbonText).toBeVisible();
  await expect(stickerLogo).toBeHidden();
  await expect(stickerText).toBeHidden();
  await selectContentProduct('sticker');
  await expect(stickerLogo).toBeVisible();
  await expect(stickerText).toBeVisible();
  await expect(stickerContent).toHaveAttribute(
    'data-mobile-products-mode',
    'logo-and-text',
  );
  await selectContentProduct('ribbon');

  await page.locator('#textInput').fill('новая длинная надпись для упаковки');
  await expect(ribbonText).toBeVisible();
  await expect(ribbonText).toHaveText(await readRibbonPreviewText(page));
  await expect(stickerText).toHaveText('новая длинная надпись для упаковки');

  await page.locator('.nav-item[data-panel="settings"]').click();
  await page.locator('#fontSelect').selectOption('Pacifico');
  await expect(ribbonText).toHaveCSS('font-family', 'Pacifico');
  await expect(stickerText).toHaveCSS('font-family', 'Manrope');

  await page.locator('#logoInput').setInputFiles(fixturePath('test-logo.svg'));
  await expect(stickerLogo).toBeVisible();

  await page.locator('#printColorSelect').selectOption('#b69249');
  await expect(ribbonText).toHaveCSS('color', 'rgb(182, 146, 73)');
  await expect(stickerText).toHaveCSS('color', 'rgb(198, 200, 205)');

  await page.locator('#ribbonColorSelect').selectOption('#b7202d');
  await expect(ribbonSurface).toHaveCSS('background-color', 'rgb(183, 32, 45)');

  await ensureProductSettingsVisible(page, 'sticker');
  await page.locator('#printColorSelect').selectOption('#b69249');
  await expect(stickerText).toHaveCSS('color', 'rgb(182, 146, 73)');

  await page.locator('#textInput').evaluate((element) => {
    element.value = 'коротко';
    element.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.locator('#fontSize').evaluate((element) => {
    element.value = '16';
    element.dispatchEvent(new Event('input', { bubbles: true }));
  });
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
  const maxTextGeometry = await page.evaluate(() => {
    const sticker = JSON.parse(document.body.dataset.studioLayout).sticker;
    const box = sticker.textBox;
    const circle = sticker.printable;
    const cornerRatios = [
      [box.x, box.y],
      [box.x + box.width, box.y],
      [box.x + box.width, box.y + box.height],
      [box.x, box.y + box.height],
    ].map(([x, y]) => Math.hypot(x - circle.cx, y - circle.cy) / circle.radius);
    return {
      maximum: Math.max(...cornerRatios),
      valid: sticker.valid,
    };
  });
  expect(maxTextGeometry.valid).toBe(true);
  expect(maxTextGeometry.maximum).toBeLessThanOrEqual(1 + 0.0001);
  expect(maxTextGeometry.maximum).toBeGreaterThan(0);

  await page.locator('#logoScale').evaluate((element) => {
    element.value = '50';
    element.dispatchEvent(new Event('input', { bubbles: true }));
  });
  const initialLogoWidth = await stickerLogo.evaluate(
    (element) => element.getBoundingClientRect().width,
  );
  await page.locator('#logoScale').evaluate((element) => {
    element.value = '100';
    element.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await expect
    .poll(() =>
      stickerLogo.evaluate((element) => element.getBoundingClientRect().width),
    )
    .toBeGreaterThan(initialLogoWidth);
  const maxLogoGeometry = await page.evaluate(() => {
    const sticker = JSON.parse(document.body.dataset.studioLayout).sticker;
    const box = sticker.logoBox;
    const circle = sticker.printable;
    const cornerRatios = [
      [box.x, box.y],
      [box.x + box.width, box.y],
      [box.x + box.width, box.y + box.height],
      [box.x, box.y + box.height],
    ].map(([x, y]) => Math.hypot(x - circle.cx, y - circle.cy) / circle.radius);
    return {
      maximum: Math.max(...cornerRatios),
      valid: sticker.valid,
    };
  });
  expect(maxLogoGeometry.valid).toBe(true);
  expect(maxLogoGeometry.maximum).toBeLessThanOrEqual(1 + 0.0001);
  expect(maxLogoGeometry.maximum).toBeGreaterThan(0);

  await page.locator('.nav-item[data-panel="upload"]').click();
  await selectContentProduct('sticker');
  await page.locator('#textInput').fill('');
  await expect(stickerContent).toHaveAttribute(
    'data-mobile-products-mode',
    'logo-only',
  );
  await expect(stickerLogo).toBeVisible();
  await expect(stickerText).toBeHidden();

  await page.locator('#textInput').fill('текст в центре с переносом слов');
  const stickerLogoHref = await page
    .locator('#stickerContent image')
    .first()
    .getAttribute('href');
  await page
    .locator('#stickerContent image')
    .first()
    .evaluate((element) => {
      element.removeAttribute('href');
      element.dispatchEvent(new Event('change', { bubbles: true }));
    });
  await expect(stickerContent).toHaveAttribute(
    'data-mobile-products-mode',
    'text-only',
  );
  await expect(stickerLogo).toBeHidden();
  await expect(stickerText).toBeVisible();

  await page
    .locator('#stickerContent image')
    .first()
    .evaluate((element, href) => {
      element.setAttribute('href', href);
      element.dispatchEvent(new Event('change', { bubbles: true }));
    }, stickerLogoHref);
  await expect(stickerContent).toHaveAttribute(
    'data-mobile-products-mode',
    'logo-and-text',
  );

  for (const [product, selectors] of [
    [
      'ribbon',
      ['.mobile-products-ribbon-logo', '.mobile-products-ribbon-text'],
    ],
    [
      'sticker',
      ['.mobile-products-sticker-logo', '.mobile-products-sticker-text'],
    ],
  ]) {
    await selectContentProduct(product);
    for (const selector of selectors) {
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
  }

  await selectContentProduct('sticker');
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
  await page.goto('/studio/?product=set', { waitUntil: 'networkidle' });

  const macroLogo = page.locator('#ribbonContent image').first();
  const initialSrc = null;
  await page.locator('#logoInput').setInputFiles(fixturePath('test-logo.svg'));

  await expect(page.locator('#fileCard')).toBeVisible();
  await expect(page.locator('#fileCardName')).toHaveText('test-logo.svg');
  await expect(page.locator('#fileCardMeta')).toContainText('SVG');
  await expect(page.locator('#continueUpload')).toBeEnabled();
  await expect(page.locator('body')).toHaveAttribute(
    'data-preview-demo',
    'false',
  );
  const snapshot = await readContentSnapshot(page);
  expect(snapshot.text.common).toBe('');
  await expect
    .poll(() => macroLogo.getAttribute('href'))
    .toMatch(/^data:image\/svg\+xml;base64,/);

  const finalSrc = await macroLogo.getAttribute('href');
  expect(finalSrc).not.toBe(initialSrc);
  await expectMobileLogosToMatch(page, finalSrc);
  await expectInterfaceResponsive(page);
  await expectNoHorizontalOverflow(page);
  expect(runtimeErrors).toEqual([]);
});

test('successful mobile SVG and PNG uploads return to the combined preview', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile');

  const runtimeErrors = watchRuntimeErrors(page);
  await page.goto('/studio/?product=set', { waitUntil: 'networkidle' });
  const logoInput = page.locator('#logoInput');
  const dropZone = page.locator('#dropZone');

  await dropZone.scrollIntoViewIfNeeded();
  await logoInput.setInputFiles(fixturePath('test-logo.svg'));
  await expect(page.locator('#fileCardName')).toHaveText('test-logo.svg');
  await expectMobilePreviewVisible(page);

  await dropZone.scrollIntoViewIfNeeded();
  await logoInput.setInputFiles(fixturePath('transparent-logo.png'));
  await expect(page.locator('#traceStatus')).toBeVisible();
  await expect(page.locator('#fileCardName')).toHaveText(
    'transparent-logo.png',
  );
  await expectMobilePreviewVisible(page);

  await dropZone.scrollIntoViewIfNeeded();
  await logoInput.setInputFiles(fixturePath('opaque-logo.png'));
  await expect(page.locator('#cropModal')).toHaveClass(/open/);
  const scrollBeforeCancel = await page.evaluate(() => window.scrollY);
  await page.locator('#cropCancel').click();
  expect(await page.evaluate(() => window.scrollY)).toBe(scrollBeforeCancel);
  await expectNoHorizontalOverflow(page);
  expect(runtimeErrors).toEqual([]);
});

test('transparent PNG is traced and updates both mobile product logos', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile');

  const runtimeErrors = watchRuntimeErrors(page);
  await page.goto('/studio/?product=set', { waitUntil: 'networkidle' });

  const cropModal = page.locator('#cropModal');
  const macroLogo = page.locator('#ribbonContent image').first();
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
    .poll(() => macroLogo.getAttribute('href'))
    .toMatch(/^data:image\/svg\+xml;base64,/);

  const finalSrc = await macroLogo.getAttribute('href');
  const tracedSvg = Buffer.from(finalSrc.split(',')[1], 'base64').toString();
  expect(tracedSvg).toMatch(/<path\b/);
  expect(tracedSvg).not.toMatch(/<rect\b/);
  await expectMobileLogosToMatch(page, finalSrc);
  await expectInterfaceResponsive(page);
  await expectNoHorizontalOverflow(page);
  expect(runtimeErrors).toEqual([]);
});

test('traced wide artwork is trimmed to its ink and fills the ribbon safe height @smoke', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile');

  const runtimeErrors = watchRuntimeErrors(page);
  const bars = Array.from(
    { length: 18 },
    (_, index) =>
      `<rect x="${30 + index * 36}" y="100" width="24" height="100" fill="#111"/>`,
  ).join('');
  const sourceSvg = Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="720" height="300" viewBox="0 0 720 300">
      ${bars}
    </svg>
  `);
  const png = await sharp(sourceSvg).png().toBuffer();

  await page.goto('/studio/?product=set', { waitUntil: 'networkidle' });
  await page.locator('#logoInput').setInputFiles({
    name: 'wide-logo-with-air.png',
    mimeType: 'image/png',
    buffer: png,
  });

  await expect(page.locator('#traceStatus')).toBeVisible();
  await expect(page.locator('#fileCardName')).toHaveText(
    'wide-logo-with-air.png',
  );
  await expect(page.locator('.mobile-products-ribbon-logo')).toBeVisible();

  const result = await page.evaluate(() => {
    const saved = JSON.parse(
      localStorage.getItem('ribbon-studio-v042') || '{}',
    );
    const asset = saved.content?.logo?.common;
    const layout = JSON.parse(document.body.dataset.studioLayout).ribbon;
    const surface = document
      .querySelector('.mobile-products-ribbon-sample')
      .getBoundingClientRect();
    const imageBounds = document
      .querySelector('.mobile-products-ribbon-logo')
      .getBoundingClientRect();
    return {
      ratio: asset?.logo?.ratio,
      tracedWidth: asset?.traceInfo?.width,
      tracedHeight: asset?.traceInfo?.height,
      artworkHeight: asset?.traceInfo?.artworkBounds?.height,
      paintedHeight: imageBounds.height,
      safeHeight: surface.height * layout.printable.height,
      layoutLogoHeight: layout.logoBox.height,
      layoutSafeHeight: layout.printable.height,
      svgSource: asset?.logoSvgSource,
      viewBox: asset?.logoSvgSource
        ?.match(/viewBox="([^"]+)"/)?.[1]
        ?.split(/\s+/)
        .map(Number),
    };
  });

  expect(result.ratio).toBeGreaterThan(6);
  expect(result.viewBox?.[2] / result.viewBox?.[3]).toBeCloseTo(
    result.ratio,
    5,
  );
  expect(result.artworkHeight / result.tracedHeight).toBeGreaterThanOrEqual(
    0.98,
  );
  expect(result.paintedHeight / result.safeHeight).toBeGreaterThanOrEqual(0.98);
  expect(result.layoutLogoHeight).toBeCloseTo(result.layoutSafeHeight, 5);
  expect(result.viewBox?.[2]).toBeLessThanOrEqual(result.tracedWidth * 1.01);
  expect(result.viewBox?.[3]).toBeLessThanOrEqual(result.tracedHeight * 1.01);
  expect(result.svgSource).toContain('viewBox=');
  await expectNoHorizontalOverflow(page);
  expect(runtimeErrors).toEqual([]);
});

test('white letters on a dark PNG plaque are traced as the printable sign', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile');

  const runtimeErrors = watchRuntimeErrors(page);
  const sourceSvg = Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="260" height="140" viewBox="0 0 260 140">
      <rect x="10" y="10" width="240" height="120" rx="2" fill="#111"/>
      <path fill="#fff" d="M48 38h18v64H48zm0 0h48v14H48zm0 25h42v14H48zM124 38h18v64h-18zm0 50h52v14h-52z"/>
    </svg>
  `);
  const png = await sharp(sourceSvg).png().toBuffer();

  await page.goto('/studio/?product=set', { waitUntil: 'networkidle' });
  await page.locator('#logoInput').setInputFiles({
    name: 'white-letters-on-dark-plaque.png',
    mimeType: 'image/png',
    buffer: png,
  });

  const traceStatus = page.locator('#traceStatus');
  const polarityControl = page.locator('#tracePolarityControl');
  const signButton = polarityControl.getByRole('button', {
    name: 'Оставить знак',
  });
  const backgroundButton = polarityControl.getByRole('button', {
    name: 'Оставить фон',
  });
  await expect(traceStatus).toBeVisible();
  await expect(page.locator('#traceDetails')).toContainText('Фон удалён');
  await expect(polarityControl).toBeVisible();
  await expect(signButton).toHaveAttribute('aria-pressed', 'true');
  await expect(backgroundButton).toHaveAttribute('aria-pressed', 'false');

  const readStoredTrace = () =>
    page.evaluate(() => {
      const saved = JSON.parse(
        localStorage.getItem('ribbon-studio-v042') || '{}',
      );
      const asset = saved.content?.logo?.common;
      return {
        polarity: asset?.traceInfo?.polarity,
        coverage: asset?.traceInfo?.coverage,
        frameRisk: asset?.traceInfo?.frameRisk,
        svgSource: asset?.logoSvgSource,
      };
    });

  await expect
    .poll(async () => (await readStoredTrace()).polarity)
    .toBe('sign');
  const sign = await readStoredTrace();
  expect(sign.coverage).toBeLessThan(0.24);
  expect(sign.frameRisk).toBe(false);
  expect(sign.svgSource).toMatch(/<path\b/);

  await backgroundButton.click();
  await expect(backgroundButton).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#tracePolarityHint')).toContainText(
    'Выбрана заливка фона',
  );
  await expect
    .poll(async () => (await readStoredTrace()).polarity)
    .toBe('background');
  const background = await readStoredTrace();
  expect(background.coverage).toBeGreaterThan(0.65);
  expect(background.frameRisk).toBe(true);

  await signButton.click();
  await expect(signButton).toHaveAttribute('aria-pressed', 'true');
  await expect
    .poll(async () => (await readStoredTrace()).polarity)
    .toBe('sign');
  expect((await readStoredTrace()).coverage).toBeLessThan(0.24);
  await expectMobileLogosToMatch(
    page,
    await page.locator('#ribbonContent image').first().getAttribute('href'),
  );
  await expectNoHorizontalOverflow(page);
  expect(runtimeErrors).toEqual([]);
});

test('smart crop finds artwork and declines a flat image', async ({ page }) => {
  const runtimeErrors = watchRuntimeErrors(page);
  await page.goto('/studio/?product=set', { waitUntil: 'networkidle' });

  const result = await page.evaluate(async () => {
    const analyzeCanvas = async (draw) => {
      const canvas = document.createElement('canvas');
      canvas.width = 400;
      canvas.height = 240;
      const context = canvas.getContext('2d');
      draw(context, canvas);
      const image = new Image();
      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = reject;
        image.src = canvas.toDataURL('image/png');
      });
      return window.RibbonStudioSmartCrop.suggest(image);
    };

    const artwork = await analyzeCanvas((context, canvas) => {
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = '#111111';
      context.fillRect(120, 75, 160, 90);
    });
    const flat = await analyzeCanvas((context, canvas) => {
      context.fillStyle = '#dddddd';
      context.fillRect(0, 0, canvas.width, canvas.height);
    });

    return { artwork, flat };
  });

  expect(result.artwork.method).toBe('foreground');
  expect(result.artwork.confidence).toBeGreaterThanOrEqual(0.56);
  expect(result.artwork.bounds.x).toBeGreaterThan(0.2);
  expect(result.artwork.bounds.x).toBeLessThan(0.3);
  expect(result.artwork.bounds.width).toBeGreaterThan(0.4);
  expect(result.artwork.bounds.width).toBeLessThan(0.5);
  expect(result.flat.bounds).toBeNull();
  expect(result.flat.method).toBe('manual');
  expect(runtimeErrors).toEqual([]);
});

test('opaque PNG crop triggers tracing and updates both mobile product logos', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile');

  const runtimeErrors = watchRuntimeErrors(page);
  await page.goto('/studio/?product=set', { waitUntil: 'networkidle' });

  const cropModal = page.locator('#cropModal');
  const macroLogo = page.locator('#ribbonContent image').first();
  await page
    .locator('#logoInput')
    .setInputFiles(fixturePath('opaque-logo.png'));

  await expect(cropModal).toHaveClass(/open/);
  await expect(cropModal).toHaveAttribute('aria-hidden', 'false');
  await expect(page.locator('#cropCanvas')).toBeVisible();
  await expect(page.locator('#cropFrame')).toBeVisible();
  await expect(page.locator('#cropSuggestionStatus')).toHaveAttribute(
    'data-state',
    'ready',
  );
  await expect(page.locator('#cropSuggestionStatus')).toContainText(
    'Область предложена автоматически',
  );
  const automaticFrame = await page.locator('#cropFrame').evaluate((frame) => ({
    left: Number.parseFloat(frame.style.left),
    top: Number.parseFloat(frame.style.top),
    width: Number.parseFloat(frame.style.width),
    height: Number.parseFloat(frame.style.height),
  }));
  expect(automaticFrame).not.toEqual({
    left: 18,
    top: 18,
    width: 64,
    height: 64,
  });
  await expect(cropModal.locator('input[type="range"]')).toHaveCount(0);
  await expect(cropModal.getByText('Масштаб', { exact: true })).toHaveCount(0);
  await expect(page.locator('.crop-actions .button')).toHaveText([
    'Оставить эту область',
    'Оставить всё изображение',
    'Повернуть 90°',
  ]);
  await expect(page.locator('#cropApply')).toHaveClass(/primary/);
  await page.locator('#cropApply').click();

  await expect(cropModal).not.toHaveClass(/open/);
  await expect(cropModal).toHaveAttribute('aria-hidden', 'true');
  await expect(page.locator('#traceStatus')).toBeVisible();
  await expect(page.locator('#fileCardName')).toHaveText('opaque-logo.png');
  await expect(page.locator('#fileCardMeta')).toContainText('PNG · выделено');
  await expect(page.locator('#fileCardQuality')).toContainText('SVG');
  await expect
    .poll(() => macroLogo.getAttribute('href'))
    .toMatch(/^data:image\/svg\+xml;base64,/);

  const finalSrc = await macroLogo.getAttribute('href');
  await expectMobileLogosToMatch(page, finalSrc);
  await expectInterfaceResponsive(page);
  await expectNoHorizontalOverflow(page);
  expect(runtimeErrors).toEqual([]);
});

test('JPEG upload opens an accessible crop dialog and completes tracing', async ({
  page,
}) => {
  const runtimeErrors = watchRuntimeErrors(page);
  await page.goto('/studio/?product=set', { waitUntil: 'networkidle' });

  await page.locator('#logoInput').setInputFiles(jpegUpload);
  const cropDialog = page.getByRole('dialog', {
    name: 'Оставьте только нужную часть',
  });
  await expect(cropDialog).toBeVisible();
  await expect(page.locator('#cropCancel')).toBeFocused();

  await page.locator('#cropUseAll').click();
  await expect(cropDialog).toBeHidden();
  await expect(page.locator('#fileCardName')).toHaveText('test-logo.jpg');
  await expect(page.locator('#fileCardMeta')).toContainText('JPG · выделено');
  await expect(page.locator('#traceStatus')).toBeVisible();
  await expect(page.locator('#continueUpload')).toBeEnabled();
  await expectNoHorizontalOverflow(page);
  expect(runtimeErrors).toEqual([]);
});

test('PDF upload renders its first page and completes tracing', async ({
  page,
}) => {
  const runtimeErrors = watchRuntimeErrors(page);
  await page.goto('/studio/?product=set', { waitUntil: 'networkidle' });
  for (const asset of ['pdf.min.js', 'pdf.worker.min.js']) {
    const response = await page.request.get(
      `/studio/assets/vendor/pdfjs/${asset}`,
    );
    expect(response.ok()).toBe(true);
    expect(response.headers()['content-type']).toContain('javascript');
  }

  await page.locator('#logoInput').setInputFiles(createPdfUpload());
  const cropDialog = page.getByRole('dialog', {
    name: 'Оставьте только нужную часть',
  });
  await expect(cropDialog).toBeVisible();
  await expect(page.locator('#fileCard')).toBeHidden();
  await expect(page.locator('#dropZone')).toHaveAttribute(
    'data-upload-state',
    'processing',
  );

  await page.locator('#cropUseAll').click();
  await expect(cropDialog).toBeHidden();
  await expect(page.locator('#fileCardMeta')).toContainText('PDF · выделено');
  await expect(page.locator('#traceStatus')).toBeVisible();
  await expect(page.locator('#continueUpload')).toBeEnabled();
  await expect
    .poll(() =>
      page.locator('#ribbonContent image').first().getAttribute('href'),
    )
    .toMatch(/^data:image\/svg\+xml;base64,/);
  await expectNoHorizontalOverflow(page);
  expect(runtimeErrors).toEqual([]);
});

test('smart mobile preview dock stays visible across all three steps', async ({
  page,
}) => {
  test.skip(
    true,
    'The compact floating dock was replaced by a full-size sticky preview.',
  );

  const runtimeErrors = watchRuntimeErrors(page);
  await page.goto('/studio/?product=set', { waitUntil: 'networkidle' });
  await completeFirstStepWithText(page);

  const panel = page.locator('.mobile-products-panel');
  const dockToggle = page.locator('#mobileProductsDockToggle');
  const navigation = page.locator('.main-nav');

  await expect(panel).not.toHaveClass(/is-floating/);
  await expect(panel).toHaveAttribute('data-floating', 'false');

  for (const step of ['upload', 'settings', 'order']) {
    if (step !== 'upload') {
      await navigation.locator(`[data-panel="${step}"]`).click();
      await expect(page.locator(`#panel-${step}`)).toBeVisible();
    }

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect(panel).toBeVisible();
    await expect
      .poll(() =>
        panel.evaluate((element) => {
          const bounds = element.getBoundingClientRect();
          const slot = element.closest('#mobileProductsSlot');
          const slotBounds = slot.getBoundingClientRect();
          const floating = element.classList.contains('is-floating');
          const stateMatches = element.dataset.floating === String(floating);
          const staysVisible =
            bounds.top >= -2 && bounds.bottom <= window.innerHeight + 2;
          const leavesNoGap = !floating || slotBounds.height <= 1.5;
          return stateMatches && staysVisible && leavesNoGap;
        }),
      )
      .toBe(true);
    const isFloating = await panel.evaluate((element) =>
      element.classList.contains('is-floating'),
    );
    if (isFloating) {
      const stickerShape = await panel
        .locator('.mobile-products-sticker-sample')
        .evaluate((element) => ({
          shape: element.dataset.shape,
          width: element.getBoundingClientRect().width,
          height: element.getBoundingClientRect().height,
        }));
      expect(stickerShape.shape).toBe('circle');
      expect(
        Math.abs(stickerShape.width - stickerShape.height),
      ).toBeLessThanOrEqual(1);
    }
    await expect(page.locator('body')).toHaveAttribute(
      'data-active-panel',
      step,
    );
    await expect(
      panel.locator('[data-mobile-product-sample="ribbon"]'),
    ).toBeVisible();
    if (step === 'upload') {
      await expect(
        panel.locator('[data-mobile-product-sample="sticker"]'),
      ).toBeHidden();
    } else {
      await expect(
        panel.locator('[data-mobile-product-sample="sticker"]'),
      ).toBeVisible();
    }

    if (step === 'upload' && isFloating) {
      await expect(panel).toHaveAttribute('data-presentation', 'dock-compact');
      await expect(panel.locator('.mobile-products-choice-label')).toBeHidden();
    }

    const dockBounds = await panel.boundingBox();
    expect(dockBounds).not.toBeNull();
    expect(dockBounds.x).toBeGreaterThanOrEqual(8);
    expect(dockBounds.x + dockBounds.width).toBeLessThanOrEqual(382);
    expect(dockBounds.y).toBeGreaterThanOrEqual(0);
    const viewportHeight = await page.evaluate(() => window.innerHeight);
    expect(dockBounds.y + dockBounds.height).toBeLessThanOrEqual(
      viewportHeight + 2,
    );

    if (step === 'upload' && isFloating) {
      const ribbonFit = await panel.evaluate((element) => {
        const preview = element.querySelector('.mobile-products-preview');
        const sample = element.querySelector(
          '[data-mobile-product-sample="ribbon"]',
        );
        const surface = element.querySelector('.mobile-products-ribbon-sample');
        const cell = element.querySelector(
          '.mobile-products-ribbon-interaction-cell',
        );
        const previewBounds = preview.getBoundingClientRect();
        const sampleBounds = sample.getBoundingClientRect();
        const surfaceBounds = surface.getBoundingClientRect();
        const cellBounds = cell.getBoundingClientRect();
        return {
          sampleWidthRatio: sampleBounds.width / previewBounds.width,
          cellInside:
            cellBounds.left >= surfaceBounds.left - 1 &&
            cellBounds.right <= surfaceBounds.right + 1 &&
            cellBounds.top >= surfaceBounds.top - 1 &&
            cellBounds.bottom <= surfaceBounds.bottom + 1,
          actualAspect: cellBounds.width / cellBounds.height,
          expectedAspect:
            Number(surface.dataset.ribbonRepeatMm) /
            Number(
              document.querySelector('#widthChoice button.active').dataset
                .value,
            ),
          repeatCount: surface.dataset.ribbonRepeatCount,
          singleRepeat: surface.dataset.ribbonSingleRepeat,
        };
      });
      expect(ribbonFit.sampleWidthRatio).toBeGreaterThanOrEqual(0.98);
      expect(ribbonFit.cellInside).toBe(true);
      expect(
        Math.abs(ribbonFit.actualAspect - ribbonFit.expectedAspect),
      ).toBeLessThan(0.05);
      expect(ribbonFit.repeatCount).toBe('1');
      expect(ribbonFit.singleRepeat).toBe('true');

      await panel.locator('[data-content-product="sticker"]').click();
      await expect(page.locator('body')).toHaveAttribute(
        'data-active-content-product',
        'sticker',
      );
      const stickerFit = await panel.evaluate((element) => {
        const preview = element.querySelector('.mobile-products-preview');
        const sample = element.querySelector(
          '[data-mobile-product-sample="sticker"]',
        );
        const sticker = element.querySelector(
          '.mobile-products-sticker-sample',
        );
        const previewBounds = preview.getBoundingClientRect();
        const sampleBounds = sample.getBoundingClientRect();
        const stickerBounds = sticker.getBoundingClientRect();
        return {
          sampleWidthRatio: sampleBounds.width / previewBounds.width,
          stickerWidth: stickerBounds.width,
          centerOffset:
            stickerBounds.left +
            stickerBounds.width / 2 -
            (previewBounds.left + previewBounds.width / 2),
        };
      });
      expect(stickerFit.sampleWidthRatio).toBeGreaterThanOrEqual(0.98);
      expect(stickerFit.stickerWidth).toBeGreaterThanOrEqual(88);
      expect(stickerFit.stickerWidth).toBeLessThanOrEqual(104);
      expect(Math.abs(stickerFit.centerOffset)).toBeLessThanOrEqual(1);

      await panel.locator('[data-content-product="ribbon"]').click();
      await dockToggle.click();
      await expect(panel).toHaveClass(/is-expanded/);
      await expect(panel).toHaveAttribute('data-presentation', 'dock-expanded');
      await expect(dockToggle).toHaveAttribute('aria-expanded', 'true');
      await expect(dockToggle).toContainText('Свернуть');
      await expect(panel.locator('.mobile-products-choice-label')).toHaveCount(
        0,
      );
      await dockToggle.click();
      await expect(panel).not.toHaveClass(/is-expanded/);
      await expect(panel).toHaveAttribute('data-presentation', 'dock-compact');
      await expect(dockToggle).toHaveAttribute('aria-expanded', 'false');
    }
  }

  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(panel).not.toHaveClass(/is-floating/);
  await expect(panel).toHaveAttribute('data-floating', 'false');
  await expect(panel).toHaveAttribute('data-presentation', 'flow');
  await expectNoHorizontalOverflow(page);
  expect(runtimeErrors).toEqual([]);
});

test('step one dock becomes a compact live strip while the keyboard is open', async ({
  page,
}) => {
  test.skip(
    true,
    'The former switch toolbar is intentionally removed from the Create step.',
  );

  const runtimeErrors = watchRuntimeErrors(page);
  await page.goto('/studio/?product=set', { waitUntil: 'networkidle' });
  await completeFirstStepWithText(page);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

  const panel = page.locator('.mobile-products-panel');
  const dockToggle = page.locator('#mobileProductsDockToggle');
  const switches = panel.locator('.mobile-products-switches');
  const ribbonSurface = panel.locator('.mobile-products-ribbon-sample');
  await expect(panel).toHaveAttribute('data-presentation', 'dock-compact');

  await dockToggle.click();
  await expect(panel).toHaveAttribute('data-presentation', 'dock-expanded');
  await expect(switches).toBeVisible();

  await page.evaluate(() => {
    const viewport = window.visualViewport;
    Object.defineProperty(viewport, 'height', {
      configurable: true,
      value: window.innerHeight - 200,
    });
    viewport.dispatchEvent(new Event('resize'));
  });
  await expect(panel).toHaveAttribute('data-presentation', 'dock-keyboard');
  await expect(panel).not.toHaveClass(/is-expanded/);
  await expect(dockToggle).toBeHidden();
  await expect(dockToggle).toHaveAttribute('aria-expanded', 'false');
  await expect(switches).toBeVisible();
  await expect(ribbonSurface).toHaveCSS('height', '32px');

  await page.evaluate(() => {
    const viewport = window.visualViewport;
    Object.defineProperty(viewport, 'height', {
      configurable: true,
      value: window.innerHeight,
    });
    viewport.dispatchEvent(new Event('resize'));
  });
  await expect(panel).toHaveAttribute('data-presentation', 'dock-expanded');
  await expect(panel).toHaveClass(/is-expanded/);
  await expect(dockToggle).toBeVisible();
  await expect(dockToggle).toHaveAttribute('aria-expanded', 'true');
  await expect(switches).toBeVisible();
  expect(runtimeErrors).toEqual([]);
});

test('unified preview occupies the desktop preview column', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop');

  await page.goto('/studio/?product=set', { waitUntil: 'networkidle' });

  const panel = page.locator('.mobile-products-panel');
  await expect(panel).toBeVisible();
  await expect(
    page.locator('[data-products-host="desktop"] #mobileProductsSlot'),
  ).toHaveCount(1);
  await expect(page.locator('#mobileLogoEditor')).toBeHidden();
  await expect(page.locator('#mobileLogoEditor')).toHaveCSS('display', 'none');
  await expect(page.locator('main.studio')).toBeVisible();

  const scrollBeforeUpload = await page.evaluate(() => window.scrollY);
  await page.locator('#logoInput').setInputFiles(fixturePath('test-logo.svg'));
  await expect(page.locator('#fileCardName')).toHaveText('test-logo.svg');
  expect(await page.evaluate(() => window.scrollY)).toBe(scrollBeforeUpload);
});

test('switching from bundle to sticker keeps the mobile sticker preview visible', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile');

  await page.goto('/studio/?product=bundle');
  await page.locator('[data-order-mode="sticker"]').click();

  await expect(page.locator('.mobile-products-sticker')).toBeVisible();
  await expect(
    page.locator('.mobile-products-sticker .mobile-products-sticker-sample'),
  ).toBeVisible();
  await expect(page.locator('.mobile-products-ribbon')).toBeHidden();
  await expect(page.locator('#stickerProductPicker')).toBeVisible();
  await expect(page.locator('.mobile-products-preview')).not.toHaveCSS(
    'height',
    '0px',
  );
});

test('circle sticker stays square while the sticky preview is active', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile');

  await page.goto('/studio/?product=sticker', { waitUntil: 'networkidle' });
  const sticker = page.locator('.mobile-products-sticker-sample');
  await expect(sticker).toBeVisible();

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect
    .poll(() =>
      sticker.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const panel = element.closest('.mobile-products-panel');
        return {
          floating: panel?.classList.contains('is-floating'),
          width: rect.width,
          height: rect.height,
        };
      }),
    )
    .toMatchObject({ floating: false });

  const geometry = await sticker.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return { width: rect.width, height: rect.height };
  });
  expect(Math.abs(geometry.width - geometry.height)).toBeLessThanOrEqual(1);
});

test('sticker mode starts with the 24 mm contrast demo and no entry banner', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile');

  await page.goto('/studio/?product=bundle', { waitUntil: 'networkidle' });
  await page.locator('[data-order-mode="sticker"]').click();

  await expect(page.locator('#studioEntryContext')).toHaveCount(0);
  await expect(
    page.locator('.mobile-products-sticker .mobile-products-sample-label'),
  ).toHaveText('Стикер 24 мм');
  await expect(
    page.locator(
      '#stickerProductPicker [data-sticker-group="circle-24"] summary',
    ),
  ).toHaveClass(/active/);

  const demo = page.locator(
    '.mobile-products-sticker-text-zone .mobile-products-sticker-text',
  );
  await expect(demo).toContainText('Печатает Максим');
  await expect(demo).toHaveCSS('color', 'rgb(198, 200, 205)');
});

test('mobile top controls stay above the step navigation', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile');

  await page.goto('/studio/?product=sticker', { waitUntil: 'networkidle' });
  const geometry = await page.evaluate(() => {
    const topbar = document.querySelector('.topbar').getBoundingClientRect();
    const mode = document
      .querySelector('#orderModeSwitcher')
      .getBoundingClientRect();
    const nav = document.querySelector('.main-nav').getBoundingClientRect();
    return {
      topbarBottom: topbar.bottom,
      modeTop: mode.top,
      modeBottom: mode.bottom,
      navTop: nav.top,
    };
  });

  expect(geometry.modeTop).toBeGreaterThanOrEqual(0);
  expect(geometry.navTop).toBeGreaterThanOrEqual(geometry.modeBottom - 1);
});

test('create step places content choice below preview and keeps sticker demo defaults', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile');

  await page.goto('/studio/?product=set', { waitUntil: 'networkidle' });
  await page
    .locator('#contentProductChoice [data-content-product="sticker"]')
    .click();

  await expect(page.locator('#previewContextTitle')).toBeHidden();
  await expect(page.locator('#panel-upload .panel-head h2')).toBeHidden();
  await expect(
    page.locator('.mobile-products-sticker .mobile-products-sample-label'),
  ).toHaveText('Стикер 24 мм');
  await expect(page.locator('.mobile-products-sticker-text')).toContainText(
    'Печатает Максим',
  );
  await expect(page.locator('.mobile-products-sticker-logo')).toBeVisible();

  const order = await page.evaluate(() =>
    [
      '.mobile-products-switches',
      '.mobile-products-preview',
      '.content-product-editor-host-mobile',
    ].map(
      (selector) =>
        document.querySelector(selector).getBoundingClientRect().top,
    ),
  );
  expect(order[0]).toBeLessThan(order[1]);
  expect(order[1]).toBeLessThan(order[2]);
});

test('preview zoom controls flank the visualization and change only its scale', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile');

  await page.goto('/studio/?product=set', { waitUntil: 'networkidle' });
  const stage = page.locator('[data-preview-zoom-stage]');
  const visual = page.locator('.mobile-products-ribbon-sample');
  const minus = page.locator('[data-preview-zoom="out"]');
  const plus = page.locator('[data-preview-zoom="in"]');

  await expect(minus.locator('svg circle')).toHaveCount(1);
  await expect(minus.locator('svg path')).toHaveAttribute(
    'd',
    'M19.5 19.5 27 27M9 13h8',
  );
  await expect(plus.locator('svg path')).toHaveAttribute(
    'd',
    'M19.5 19.5 27 27M9 13h8M13 9v8',
  );
  const initial = await stage.evaluate((element) => ({
    scale: element.dataset.previewZoom,
  }));
  expect(initial.scale).toBe('100');
  const sides = await Promise.all([minus.boundingBox(), plus.boundingBox()]);
  const visualBounds = await visual.boundingBox();
  expect(sides[0].x).toBeGreaterThanOrEqual(visualBounds.x - 1);
  expect(sides[1].x + sides[1].width).toBeLessThanOrEqual(
    visualBounds.x + visualBounds.width + 1,
  );

  await plus.click();
  await expect(stage).toHaveAttribute('data-preview-zoom', '110');
  await minus.click();
  await expect(stage).toHaveAttribute('data-preview-zoom', '100');
});

test('full preview stays fixed without compact floating mode', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile');

  await page.goto('/studio/?product=set', { waitUntil: 'networkidle' });
  const panel = page.locator('.mobile-products-panel');
  const nav = page.locator('.main-nav');
  const slot = page.locator('.mobile-products-slot[data-hosted="true"]');
  const sticker = page.locator('.mobile-products-ribbon-sample');

  await expect(panel).not.toHaveClass(/is-floating/);
  await expect(panel).toHaveAttribute('data-floating', 'false');
  await expect(nav).toHaveCSS('position', 'fixed');
  await expect(slot).toHaveCSS('position', 'fixed');

  const before = await sticker.boundingBox();
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect(panel).toBeVisible();
  await expect(panel).not.toHaveClass(/is-floating/);
  const after = await sticker.boundingBox();
  expect(Math.abs(after.width - before.width)).toBeLessThanOrEqual(1);
  expect(Math.abs(after.height - before.height)).toBeLessThanOrEqual(1);
});

test('ribbon preview keeps a stable three-repeat scene across zoom levels', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile');

  await page.goto('/studio/?product=set', { waitUntil: 'networkidle' });
  const stage = page.locator('[data-preview-zoom-stage]');
  const ribbon = page.locator('.mobile-products-ribbon-sample');
  const interactionCell = page.locator(
    '.mobile-products-ribbon-interaction-cell',
  );
  const minus = page.locator('[data-preview-zoom="out"]');

  await expect(ribbon).toHaveAttribute('data-ribbon-preview-cycle-count', '3');
  await expect(ribbon).toHaveAttribute('data-ribbon-logo-text-gap-px', /\d/);
  await expect(ribbon).toHaveAttribute('data-ribbon-repeat-gap-px', /\d/);
  await expect(ribbon).toHaveAttribute('data-ribbon-scene-centered', 'true');
  const sceneGeometry = await ribbon.evaluate((surface) => {
    const track = surface.querySelector('.mobile-products-ribbon-repeat-track');
    const surfaceBox = surface.getBoundingClientRect();
    const trackBox = track.getBoundingClientRect();
    return {
      centerDelta: Math.abs(
        (trackBox.left + trackBox.width / 2) -
          (surfaceBox.left + surfaceBox.width / 2),
      ),
      sceneWidth: trackBox.width,
    };
  });
  expect(sceneGeometry.centerDelta).toBeLessThan(1);
  expect(sceneGeometry.sceneWidth).toBeGreaterThan(0);
  expect(
    await ribbon.getAttribute('data-ribbon-logo-text-gap-px'),
  ).toBe(await ribbon.getAttribute('data-ribbon-repeat-gap-px'));
  const visualGaps = await ribbon.evaluate((surface) => {
    const cells = [...surface.querySelectorAll('.mobile-products-ribbon-repeat-cell')];
    const current = cells[1];
    const next = cells[2];
    const logoElement = current.querySelector('.mobile-products-ribbon-repeat-logo');
    const nextLogoElement = next.querySelector('.mobile-products-ribbon-repeat-logo');
    const logo = logoElement.getBoundingClientRect();
    const text = current.querySelector('.mobile-products-ribbon-repeat-text').getBoundingClientRect();
    const nextLogo = nextLogoElement.getBoundingClientRect();
    const inkBounds = (element, bounds) => ({
      left: bounds.left + bounds.width * Number(element.dataset.inkLeftRatio || 0),
      right: bounds.left + bounds.width * Number(element.dataset.inkRightRatio || 1),
    });
    const ink = inkBounds(logoElement, logo);
    const nextInk = inkBounds(nextLogoElement, nextLogo);
    return {
      logoText: text.left - ink.right,
      repeat: nextInk.left - text.right,
      expected: (ink.right - ink.left) / 1.618,
    };
  });
  expect(Math.abs(visualGaps.logoText - visualGaps.expected)).toBeLessThan(0.75);
  expect(Math.abs(visualGaps.repeat - visualGaps.expected)).toBeLessThan(0.75);
  expect(Math.abs(visualGaps.logoText - visualGaps.repeat)).toBeLessThan(0.75);
  await expect(interactionCell).toHaveCSS('visibility', 'visible');
  await expect(interactionCell).toHaveCSS('opacity', '0');
  await minus.click();
  await expect(stage).toHaveAttribute('data-preview-zoom', '90');
  await expect(ribbon).toHaveAttribute('data-ribbon-preview-cycle-count', '3');
  await expect(interactionCell).toHaveCSS('visibility', 'visible');
  await expect(interactionCell).toHaveCSS('opacity', '0');
  await minus.click();
  await expect(stage).toHaveAttribute('data-preview-zoom', '80');
  await expect(ribbon).toHaveAttribute('data-ribbon-preview-cycle-count', '3');
  await minus.click();
  await expect(stage).toHaveAttribute('data-preview-zoom', '70');
  await expect(ribbon).toHaveAttribute('data-ribbon-preview-cycle-count', '3');
  await minus.click();
  await minus.click();
  await expect(stage).toHaveAttribute('data-preview-zoom', '50');
  const visibleRepeatCount = await page
    .locator('.mobile-products-ribbon-repeat-cell')
    .evaluateAll((cells) => {
      const surface = document
        .querySelector('.mobile-products-ribbon-sample')
        .getBoundingClientRect();
      return cells.filter((cell) => {
        const rect = cell.getBoundingClientRect();
        return rect.right > surface.left && rect.left < surface.right;
      }).length;
    });
  expect(visibleRepeatCount).toBe(3);
});

test('mobile preview is frameless and ribbon base scales edge to edge', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile');

  await page.goto('/studio/?product=set', { waitUntil: 'networkidle' });
  const panel = page.locator('.mobile-products-panel');
  const ribbon = page.locator('.mobile-products-ribbon-sample');
  const stage = page.locator('[data-preview-zoom-stage]');
  await expect(panel).toHaveCSS('border-style', 'none');

  const readRibbon = () =>
    ribbon.evaluate((node) => {
      const rect = node.getBoundingClientRect();
      return { left: rect.left, right: rect.right, height: rect.height };
    });
  const initial = await readRibbon();
  expect(initial.left).toBeLessThanOrEqual(1);
  expect(initial.right).toBeGreaterThanOrEqual(389);

  await page.locator('[data-preview-zoom="in"]').click();
  await page.waitForTimeout(220);
  const zoomed = await readRibbon();
  expect(zoomed.left).toBeLessThanOrEqual(1);
  expect(zoomed.right).toBeGreaterThanOrEqual(389);
  expect(zoomed.height).toBeGreaterThan(initial.height);
  await expect(stage).toHaveAttribute('data-preview-zoom', '110');
});

test('switching order modes preserves the ribbon default print color', async ({
  page,
}) => {
  await page.goto('/studio/?product=ribbon', {waitUntil: 'networkidle'});
  const ribbon = page.locator('.mobile-products-ribbon-sample');
  const text = ribbon.locator('.mobile-products-ribbon-repeat-text').first();
  await expect(text).toHaveCSS('color', 'rgb(23, 23, 23)');
  await page.locator('[data-order-mode="sticker"]').click();
  await page.locator('[data-order-mode="bundle"]').click();
  await page.locator('[data-order-mode="ribbon"]').click();
  await expect(text).toHaveCSS('color', 'rgb(23, 23, 23)');
});

test('sticker zoom max uses available mobile viewport width', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile');

  await page.goto('/studio/?product=sticker', { waitUntil: 'networkidle' });
  const stage = page.locator('[data-preview-zoom-stage]');
  const sticker = page.locator('.mobile-products-sticker-sample');
  const maxZoom = Number(await stage.getAttribute('data-preview-zoom-max'));
  const stickerWidth = (await sticker.boundingBox()).width;
  expect(maxZoom).toBeGreaterThan(125);
  expect(maxZoom).toBeGreaterThanOrEqual(
    Math.round(((390 - 32) / stickerWidth) * 100) - 2,
  );
  await expect(page.locator('[data-preview-zoom="in"]')).toBeEnabled();
});

test('ribbon preview reaches both mobile viewport edges at every zoom', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile');

  await page.goto('/studio/?product=ribbon', { waitUntil: 'networkidle' });
  const ribbon = page.locator('.mobile-products-ribbon-sample');
  const plus = page.locator('[data-preview-zoom="in"]');
  for (let i = 0; i < 3; i += 1) {
    const bounds = await ribbon.boundingBox();
    expect(bounds.x).toBeLessThanOrEqual(1);
    expect(bounds.x + bounds.width).toBeGreaterThanOrEqual(389);
    if (await plus.isEnabled()) {
      await plus.click();
      await page.waitForTimeout(220);
    }
  }
});

test('full-bleed ribbon is not clipped by its hosted slot', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile');

  await page.goto('/studio/?product=ribbon', { waitUntil: 'networkidle' });
  const ribbon = page.locator('.mobile-products-ribbon-sample');
  const slot = page.locator('.mobile-products-slot[data-hosted="true"]');
  await expect(slot).toHaveCSS('overflow', 'visible');
  const bounds = await ribbon.boundingBox();
  expect(bounds.x).toBe(0);
  expect(bounds.x + bounds.width).toBe(390);
});

test('mobile zoom controls use equal left and right insets', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile');

  await page.goto('/studio/?product=ribbon', { waitUntil: 'networkidle' });
  const minus = page.locator('[data-preview-zoom="out"]');
  const plus = page.locator('[data-preview-zoom="in"]');
  const minusBounds = await minus.boundingBox();
  const plusBounds = await plus.boundingBox();
  const viewportWidth = await page.evaluate(() => window.innerWidth);
  expect(Math.round(minusBounds.x)).toBe(
    Math.round(viewportWidth - (plusBounds.x + plusBounds.width)),
  );
});

test('standalone sticker zoom remains interactive while picker is open', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile');

  await page.goto('/studio/?product=sticker', { waitUntil: 'networkidle' });
  const stage = page.locator('[data-preview-zoom-stage]');
  await expect(page.locator('[data-preview-zoom="in"]')).toBeEnabled();
  await page.locator('[data-preview-zoom="in"]').click();
  await expect(stage).toHaveAttribute('data-preview-zoom', '110');
});

test('demo sticker objects support drag positioning on create step', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile');

  await page.goto('/studio/?product=sticker', { waitUntil: 'networkidle' });
  const logo = page.locator('.mobile-products-sticker-logo-zone');
  const box = await logo.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    box.x + box.width / 2 + 20,
    box.y + box.height / 2 + 12,
  );
  await page.mouse.up();
  await expect(page.locator('body')).toHaveAttribute(
    'data-artwork-valid',
    'true',
  );
});

test('ribbon surface drag changes the repeat step bidirectionally', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile');

  await page.goto('/studio/?product=ribbon', { waitUntil: 'networkidle' });
  const ribbon = page.locator('.mobile-products-ribbon-sample');
  const before = Number(await ribbon.getAttribute('data-ribbon-repeat-mm'));
  await page.evaluate(() => {
    document.dispatchEvent(
      new CustomEvent('studio:repeat-delta', {
        detail: {deltaRatio: 24 / 390},
      }),
    );
  });
  await expect
    .poll(async () => Number(await ribbon.getAttribute('data-ribbon-repeat-mm')))
    .toBeGreaterThan(before);
  const increased = Number(await ribbon.getAttribute('data-ribbon-repeat-mm'));
  await page.evaluate(() => {
    document.dispatchEvent(
      new CustomEvent('studio:repeat-delta', {
        detail: {deltaRatio: -24 / 390},
      }),
    );
  });
  await expect
    .poll(async () => Number(await ribbon.getAttribute('data-ribbon-repeat-mm')))
    .toBeLessThan(increased);
});

test('preview content zones do not open editors on click', async ({ page }) => {
  await page.goto('/studio/?product=set', { waitUntil: 'networkidle' });
  const textInput = page.locator('#textInput');
  const logoInput = page.locator('#logoInput');
  const textZone = page.locator(
    '[data-mobile-products-safe-zone="ribbon-text"]',
  );
  const logoZone = page.locator(
    '[data-mobile-products-safe-zone="ribbon-logo"]',
  );

  await textZone.click();
  await logoZone.click();
  await expect(page.locator('#mobileTextEditor')).toBeHidden();
  await expect(page.locator('#mobileLogoEditor')).toBeHidden();
  await expect(textInput).not.toBeFocused();
  await expect(logoInput).not.toBeFocused();

  await textInput.fill('текст через поле');
  await expect(page.locator('.mobile-products-ribbon-text')).toHaveText(
    'текст через поле',
  );
});
