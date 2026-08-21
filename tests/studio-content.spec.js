import { expect, test } from '@playwright/test';
import {
  expectNoHorizontalOverflow,
  expectSvgDataToContain,
  fixturePath,
  openSettings,
  readContentSnapshot,
  readRibbonPreviewText,
  setLogoUploadTarget,
  svgUpload,
  watchRuntimeErrors,
} from './helpers/studio.js';

test('Studio opens without console errors or horizontal scrolling @smoke', async ({
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

  await page.goto('/studio/?product=set', { waitUntil: 'networkidle' });

  if (testInfo.project.name === 'mobile') {
    await expect(page.locator('main.studio')).toBeHidden();
    await expect(page.locator('.mobile-products-panel')).toBeVisible();
  } else {
    await expect(page.locator('main.studio')).toBeVisible();
  }

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

test('homepage entry context selects the requested Studio product @smoke', async ({
  page,
}, testInfo) => {
  const cases = [
    {
      query: 'product=ribbon',
      banner: 'Вы создаёте макет ленты.',
      inputLabel: 'Надпись на ленте',
      ribbon: true,
      sticker: false,
    },
    {
      query: 'product=sticker',
      banner: 'Вы создаёте макет стикера.',
      inputLabel: 'Надпись на стикере',
      ribbon: false,
      sticker: true,
    },
    {
      query: 'product=set&material=satin',
      banner: 'Вы создаёте комплект ленты и стикеров. Материал: сатин.',
      inputLabel: 'Надпись на ленте',
      ribbon: true,
      sticker: true,
    },
  ];

  for (const entry of cases) {
    await page.goto(`/studio/?${entry.query}`, { waitUntil: 'networkidle' });
    await expect(page.locator('#studioEntryContext')).toBeVisible();
    await expect(page.locator('#studioEntryContextText')).toContainText(
      entry.banner,
    );
    await expect(page.locator('#textInputLabel')).toHaveText(entry.inputLabel);
    await expect(page.locator('[data-mobile-product="ribbon"]')).toBeChecked({
      checked: entry.ribbon,
    });
    await expect(page.locator('[data-mobile-product="sticker"]')).toBeChecked({
      checked: entry.sticker,
    });
  }

  await page.goto('/studio/?product=set', { waitUntil: 'networkidle' });
  await expect(page.locator('#studioEntryContext')).toBeVisible();
  await expect(page.locator('#studioEntryContextText')).toContainText(
    'Вы создаёте комплект ленты и стикеров.',
  );
  await expect(page.locator('#textInputLabel')).toHaveText('Надпись на ленте');

  if (testInfo.project.name === 'desktop') {
    await expect(page.locator('main.studio')).toBeVisible();
  }
});

test('one preview component survives continuous viewport changes @smoke', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop');

  await page.goto('/studio/?product=set', { waitUntil: 'networkidle' });
  await page.locator('#mobileProductsSlot').evaluate((slot) => {
    slot.dataset.identityCheck = 'same-node';
  });

  for (const [width, host] of [
    [1440, 'desktop'],
    [900, 'upload'],
    [701, 'upload'],
    [700, 'upload'],
    [390, 'upload'],
    [1440, 'desktop'],
  ]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(
      page.locator(`[data-products-host="${host}"] #mobileProductsSlot`),
    ).toHaveAttribute('data-identity-check', 'same-node');
    await expect(page.locator('.mobile-products-panel')).toBeVisible();
    await expectNoHorizontalOverflow(page);
  }
});

test('fresh first step marks the demo and keeps customer content honest @smoke', async ({
  page,
}, testInfo) => {
  const runtimeErrors = watchRuntimeErrors(page);
  await page.goto('/studio/?product=set', { waitUntil: 'networkidle' });

  const textInput = page.locator('#textInput');
  await expect(textInput).toHaveValue('');
  await expect(textInput).toHaveAttribute(
    'placeholder',
    'Например: ленты по любви',
  );
  await expect(page.locator('body')).toHaveAttribute(
    'data-preview-demo',
    'true',
  );
  await expect(page.locator('#previewContextTitle')).toHaveText(
    'Пример оформления',
  );
  if (testInfo.project.name === 'mobile') {
    await expect(page.locator('#previewContextCopy')).toBeHidden();
  } else {
    await expect(page.locator('#previewContextCopy')).toHaveText(
      'Напишите название или загрузите логотип — я покажу, как выглядит макет.',
    );
  }
  await expect(page.locator('#continueUpload')).toBeDisabled();
  await expect(page.locator('#continueUploadHelp')).toHaveText(
    'Добавьте название или логотип — и продолжим.',
  );
  await expect(page.locator('#continueUploadHelp')).toBeVisible();
  await expect(page.locator('#panel-upload #fontSelect')).toHaveCount(0);
  await expect(page.locator('#panel-settings #fontSelect')).toHaveCount(1);
  await expect(page.locator('#dropZone')).toContainText('PDF');
  await expect(page.locator('#logoInput')).toHaveAttribute(
    'accept',
    /application\/pdf/,
  );
  await expect(page.locator('.format-list')).toHaveCount(0);
  await expect(page.locator('.help-note')).toHaveCount(0);
  await expect(page.locator('#contentProductEditorLabel')).toHaveText(
    'Что сейчас настраиваем',
  );
  await expect(page.locator('#contentProductEditorHint')).toHaveText(
    'Первый текст и логотип появятся на обоих изделиях. Затем их можно изменить отдельно.',
  );
  await expect(page.locator('.mobile-products-choice-label')).toHaveText(
    'В комплекте',
  );
  await expect(
    page.locator('#contentProductEditor').locator('xpath=..'),
  ).toHaveAttribute('data-content-product-host', 'mobile');
  if (testInfo.project.name === 'mobile') {
    await expect(
      page.locator('[data-products-host="upload"] #mobileProductsSlot'),
    ).toHaveCount(1);
    await expect(page.locator('.mobile-products-panel')).toHaveAttribute(
      'data-mode',
      'upload',
    );
    await expect(page.locator('.mobile-products-switches')).toBeVisible();
    await expect(page.locator('.studio')).toBeHidden();
    const mobileOrder = await page.evaluate(() => {
      const text = document.querySelector('#textInput').getBoundingClientRect();
      const upload = document
        .querySelector('#dropZone')
        .getBoundingClientRect();
      const preview = document
        .querySelector('.mobile-products-panel')
        .getBoundingClientRect();
      return {
        previewBeforeInputs:
          preview.bottom <= text.top && preview.bottom <= upload.top,
        formStartsInViewport: text.top < window.innerHeight,
        previewHeight: preview.height,
      };
    });
    expect(mobileOrder.previewBeforeInputs).toBe(true);
    expect(mobileOrder.formStartsInViewport).toBe(true);
    expect(mobileOrder.previewHeight).toBeLessThan(340);
    await expect(
      page.locator('[data-mobile-product-sample="ribbon"]'),
    ).toBeVisible();
    await expect(
      page.locator('[data-mobile-product-sample="sticker"]'),
    ).toBeHidden();
    await page
      .locator('#contentProductChoice [data-content-product="sticker"]')
      .click();
    await expect(
      page.locator('[data-mobile-product-sample="ribbon"]'),
    ).toBeHidden();
    await expect(
      page.locator('[data-mobile-product-sample="sticker"]'),
    ).toBeVisible();
    await page
      .locator('#contentProductChoice [data-content-product="ribbon"]')
      .click();
    await page.locator('[data-mobile-product="ribbon"]').click();
    await expect(page.locator('body')).toHaveAttribute(
      'data-active-content-product',
      'sticker',
    );
    await expect(
      page.locator('[data-mobile-product-sample="sticker"]'),
    ).toBeVisible();
    await page.locator('[data-mobile-product="ribbon"]').click();
    await page
      .locator('#contentProductChoice [data-content-product="ribbon"]')
      .click();
  } else {
    await expect(
      page.locator('[data-products-host="desktop"] #mobileProductsSlot'),
    ).toHaveCount(1);
    await expect(page.locator('.mobile-products-panel')).toBeVisible();
    await expect(page.locator('.production-renderer')).toBeHidden();
    await expect(
      page.locator('[data-mobile-product-sample="ribbon"]'),
    ).toBeVisible();
    await expect(
      page.locator('[data-mobile-product-sample="sticker"]'),
    ).toBeHidden();
    await page
      .locator('#contentProductChoice [data-content-product="sticker"]')
      .click();
    await expect(
      page.locator('[data-mobile-product-sample="ribbon"]'),
    ).toBeHidden();
    await expect(
      page.locator('[data-mobile-product-sample="sticker"]'),
    ).toBeVisible();
    await page
      .locator('#contentProductChoice [data-content-product="ribbon"]')
      .click();
  }
  const demoText = page.locator('.mobile-products-ribbon-text');
  await expect(demoText).toContainText('ленты');
  const demoOverflowCard = page.locator('.ribbon-overflow-card-mobile');
  await expect(demoOverflowCard).toBeHidden();
  await expect(page.locator('body')).toHaveAttribute(
    'data-ribbon-overflow',
    'false',
  );
  const previewText = page.locator('.mobile-products-ribbon-text');
  await expect(previewText).toHaveCSS('font-family', /Comfortaa/);

  if (testInfo.project.name === 'mobile') {
    const ribbon = page.locator('.mobile-products-ribbon-sample');
    await expect(ribbon).toHaveAttribute('data-layout-valid', 'true');
    const demoGeometry = await ribbon.evaluate((surface) => {
      const surfaceBox = surface.getBoundingClientRect();
      const cells = [
        ...surface.querySelectorAll(
          '.mobile-products-ribbon-repeat-cell, .mobile-products-ribbon-interaction-cell',
        ),
      ];
      const visibleParts = [];
      const overlaps = cells.filter((cell) => {
        const logo = cell.querySelector(
          '.mobile-products-ribbon-repeat-logo, .mobile-products-ribbon-logo-zone',
        );
        const text = cell.querySelector(
          '.mobile-products-ribbon-repeat-text, .mobile-products-ribbon-text-zone',
        );
        if (!logo || !text) return false;
        const logoBox = logo.getBoundingClientRect();
        const textBox = text.getBoundingClientRect();
        visibleParts.push(logoBox, textBox);
        const horizontalOverlap =
          Math.min(logoBox.right, textBox.right) -
          Math.max(logoBox.left, textBox.left);
        const verticalOverlap =
          Math.min(logoBox.bottom, textBox.bottom) -
          Math.max(logoBox.top, textBox.top);
        return horizontalOverlap > 0.5 && verticalOverlap > 0.5;
      }).length;
      return {
        overlaps,
        allInside: visibleParts.every(
          (box) =>
            box.left >= surfaceBox.left - 1 &&
            box.right <= surfaceBox.right + 1 &&
            box.top >= surfaceBox.top - 1 &&
            box.bottom <= surfaceBox.bottom + 1,
        ),
      };
    });
    expect(demoGeometry.overlaps).toBe(0);
    expect(demoGeometry.allInside).toBe(true);
  }

  await textInput.fill('Мой бренд');
  await expect(page.locator('body')).toHaveAttribute(
    'data-preview-demo',
    'false',
  );
  await expect(page.locator('body')).toHaveAttribute(
    'data-preview-logo-demo',
    'false',
  );
  await expect(page.locator('#previewContextTitle')).toHaveText('Ваш макет');
  await expect(page.locator('#previewContextCopy')).toBeHidden();
  await expect(page.locator('#continueUpload')).toBeEnabled();
  await expect(page.locator('#continueUploadHelp')).toBeHidden();
  let snapshot = await readContentSnapshot(page);
  expect(snapshot.text.common).toBe('Мой бренд');
  expect(snapshot.logo.common).toBeNull();
  expect(
    await page.evaluate(() =>
      window.RibbonStudioProduction.serialize('ribbon').includes('<image'),
    ),
  ).toBe(false);

  await page.reload({ waitUntil: 'networkidle' });
  await expect(textInput).toHaveValue('Мой бренд');
  await expect(page.locator('#continueUpload')).toBeEnabled();
  snapshot = await readContentSnapshot(page);
  expect(snapshot.logo.common).toBeNull();
  await textInput.fill('');
  await expect(page.locator('body')).toHaveAttribute(
    'data-preview-demo',
    'true',
  );
  await expect(page.locator('#previewContextTitle')).toHaveText(
    'Пример оформления',
  );
  await expect(page.locator('#continueUpload')).toBeDisabled();
  await expectNoHorizontalOverflow(page);
  expect(runtimeErrors).toEqual([]);
});

test('first content is shared and explicit edits stay with the selected product', async ({
  page,
}) => {
  const runtimeErrors = watchRuntimeErrors(page);
  await page.goto('/studio/?product=set', { waitUntil: 'networkidle' });

  const textInput = page.locator('#textInput');
  const ribbonChoice = page.locator(
    '#contentProductChoice [data-content-product="ribbon"]',
  );
  const stickerChoice = page.locator(
    '#contentProductChoice [data-content-product="sticker"]',
  );

  await textInput.fill('Общая надпись');
  let snapshot = await readContentSnapshot(page);
  expect(snapshot.text.common).toBe('Общая надпись');
  expect(snapshot.text.resolvedRibbon).toBe('Общая надпись');
  expect(snapshot.text.resolvedSticker).toBe('Общая надпись');

  await stickerChoice.click();
  await expect(page.locator('body')).toHaveAttribute(
    'data-active-content-product',
    'sticker',
  );
  await expect(textInput).toHaveValue('Общая надпись');
  await page.locator('#makeProductText').click();
  await textInput.fill('Надпись стикера');
  snapshot = await readContentSnapshot(page);
  expect(snapshot.text.ribbon).toEqual({ mode: 'inherit' });
  expect(snapshot.text.sticker).toEqual({
    mode: 'override',
    value: 'Надпись стикера',
  });
  expect(snapshot.text.resolvedRibbon).toBe('Общая надпись');
  expect(snapshot.text.resolvedSticker).toBe('Надпись стикера');

  await page.locator('#removeProductText').click();
  snapshot = await readContentSnapshot(page);
  expect(snapshot.text.resolvedRibbon).toBe('Общая надпись');
  expect(snapshot.text.resolvedSticker).toBe('');
  await page.locator('#restoreProductText').click();
  snapshot = await readContentSnapshot(page);
  expect(snapshot.text.sticker).toEqual({ mode: 'inherit' });
  expect(snapshot.text.resolvedSticker).toBe('Общая надпись');

  await ribbonChoice.click();
  await page
    .locator('#logoInput')
    .setInputFiles(svgUpload('common-logo.svg', 'common-logo', 20, 10));
  await expect
    .poll(async () => (await readContentSnapshot(page)).logo.common?.ratio)
    .toBeCloseTo(2, 1);

  await stickerChoice.click();
  const fileChooserPromise = page.waitForEvent('filechooser');
  await page.locator('#makeProductLogo').click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles(
    svgUpload('sticker-logo.svg', 'sticker-logo', 40, 10),
  );
  await expect
    .poll(async () => (await readContentSnapshot(page)).logo.sticker?.mode)
    .toBe('override');
  snapshot = await readContentSnapshot(page);
  expect(snapshot.logo.resolvedRibbon.ratio).toBeCloseTo(2, 1);
  expect(snapshot.logo.resolvedSticker.ratio).toBeCloseTo(4, 1);

  await page.locator('#removeProductLogo').click();
  snapshot = await readContentSnapshot(page);
  expect(snapshot.logo.resolvedRibbon.ratio).toBeCloseTo(2, 1);
  expect(snapshot.logo.resolvedSticker).toBeNull();
  await page.locator('#restoreProductLogo').click();
  snapshot = await readContentSnapshot(page);
  expect(snapshot.logo.sticker).toEqual({ mode: 'inherit' });
  expect(snapshot.logo.resolvedSticker).toEqual(snapshot.logo.common);

  await expect(page.locator('#continueUpload')).toBeEnabled();
  await expectNoHorizontalOverflow(page);
  expect(runtimeErrors).toEqual([]);
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

  await page.goto('/studio/?product=set', { waitUntil: 'networkidle' });

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

  await expect(page.locator('.mobile-products-ribbon-text')).toHaveText(
    'старый общий текст',
  );
  await expect(page.locator('.mobile-products-sticker-text')).toHaveText(
    'старый общий текст',
  );
  await expect(page.locator('body')).toHaveAttribute(
    'data-ribbon-overflow',
    'false',
  );
  await expect(page.locator('.ribbon-overflow-card-mobile')).toBeHidden();
  await expect(page.locator('#ribbonContent image').first()).toBeAttached();
  await expect(page.locator('#stickerContent image').first()).toBeAttached();

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

  await page.goto('/studio/?product=set', { waitUntil: 'networkidle' });

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

  await expect(page.locator('#textInput')).toHaveValue('');
  await expect(page.locator('.mobile-products-ribbon-text')).toBeHidden();
  await expect(page.locator('.mobile-products-sticker-text')).toHaveText(
    'новый общий текст',
  );
  await expect(page.locator('#ribbonContent image').first()).toHaveCount(0);
  await expect(page.locator('#stickerContent image').first()).toBeAttached();

  await page.reload({ waitUntil: 'networkidle' });
  snapshot = await readContentSnapshot(page);
  expect(snapshot.text.ribbon).toEqual({ mode: 'override', value: '' });
  expect(snapshot.text.resolvedRibbon).toBe('');
  expect(snapshot.text.resolvedSticker).toBe('новый общий текст');
  expect(snapshot.logo.ribbon).toEqual({ mode: 'override', value: null });
  expect(snapshot.logo.resolvedRibbon).toBeNull();
  await expect(page.locator('.mobile-products-ribbon-text')).toBeHidden();
  await expect(page.locator('.mobile-products-sticker-text')).toHaveText(
    'новый общий текст',
  );

  page.once('dialog', (dialog) => dialog.accept());
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

test('resolved logo assets render independently across product scenes', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile');

  const runtimeErrors = watchRuntimeErrors(page);
  await page.addInitScript(() => {
    if (sessionStorage.getItem('resolved-logo-assets-seeded')) return;
    sessionStorage.setItem('resolved-logo-assets-seeded', 'true');
    const asset = (marker, width, height) => ({
      logo: { data: null, ratio: width / height },
      logoType: 'svg',
      logoSvgSource: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}"><path id="${marker}" fill="#000" d="M0 0h${width}v${height}H0z"/></svg>`,
      originalRaster: null,
      traceInfo: null,
    });
    localStorage.setItem(
      'ribbon-studio-v042',
      JSON.stringify({
        text: 'общий текст',
        content: {
          logo: {
            common: asset('common-logo-marker', 20, 10),
            ribbon: {
              mode: 'override',
              value: asset('ribbon-logo-marker', 40, 10),
            },
            sticker: {
              mode: 'override',
              value: asset('sticker-logo-marker', 10, 20),
            },
          },
          text: {
            common: 'общий текст',
            ribbon: { mode: 'inherit' },
            sticker: { mode: 'inherit' },
          },
        },
      }),
    );
  });
  await page.goto('/studio/?product=set', { waitUntil: 'networkidle' });
  await openSettings(page);

  const macroRibbon = page.locator('#ribbonContent image').first();
  const macroSticker = page.locator('#stickerContent image').first();
  const boxRibbon = page.locator('#ribbonContent image').first();
  const boxSticker = page.locator('#stickerContent image').first();
  const mobileRibbon = page.locator('.mobile-products-ribbon-logo');
  const mobileSticker = page.locator('.mobile-products-sticker-logo');
  const ribbonSvg = page.locator('#ribbonContent image').first();
  const stickerSvg = page.locator('#stickerContent image').first();
  const ribbonShowcase = page
    .locator('[data-product-type="ribbon"] .dynamic-showcase-logo')
    .first();
  const stickerShowcase = page
    .locator('[data-product-type="sticker"] .dynamic-showcase-logo')
    .first();

  for (const locator of [
    macroRibbon,
    boxRibbon,
    mobileRibbon,
    ribbonShowcase,
  ]) {
    await expectSvgDataToContain(locator, 'ribbon-logo-marker');
  }
  await expectSvgDataToContain(ribbonSvg, 'ribbon-logo-marker', 'href');
  for (const locator of [
    macroSticker,
    boxSticker,
    mobileSticker,
    stickerShowcase,
  ]) {
    await expectSvgDataToContain(locator, 'sticker-logo-marker');
  }
  await expectSvgDataToContain(stickerSvg, 'sticker-logo-marker', 'href');

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
  await page.locator('#printColorSelect').selectOption('#ffffff');
  const detail = await contentEvent;
  expect(detail.logo).toEqual({
    common: { hasLogo: true, logoType: 'svg', ratio: 2 },
    ribbon: { mode: 'override', hasLogo: true, logoType: 'svg', ratio: 4 },
    sticker: { mode: 'override', hasLogo: true, logoType: 'svg', ratio: 0.5 },
  });
  expect(JSON.stringify(detail.logo)).not.toContain('data:image');
  expect(JSON.stringify(detail.logo)).not.toContain('<svg');
  await expect
    .poll(async () => {
      const src = await macroRibbon.getAttribute('href');
      return src ? Buffer.from(src.split(',')[1], 'base64').toString() : '';
    })
    .toContain('#ffffff');
  await expect
    .poll(async () => {
      const src = await macroSticker.getAttribute('href');
      return src ? Buffer.from(src.split(',')[1], 'base64').toString() : '';
    })
    .toContain('#171717');

  await page
    .locator('[data-mobile-product-sample="sticker"]')
    .click({ position: { x: 4, y: 4 } });
  await page.locator('#printColorSelect').selectOption('#ffffff');
  await expect
    .poll(async () => {
      const src = await macroSticker.getAttribute('href');
      return src ? Buffer.from(src.split(',')[1], 'base64').toString() : '';
    })
    .toContain('#ffffff');

  await page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem('ribbon-studio-v042'));
    saved.content.logo.ribbon = { mode: 'inherit' };
    localStorage.setItem('ribbon-studio-v042', JSON.stringify(saved));
  });
  await page.reload({ waitUntil: 'networkidle' });
  await openSettings(page);
  await expectSvgDataToContain(macroRibbon, 'common-logo-marker');
  await expectSvgDataToContain(macroSticker, 'sticker-logo-marker');
  await expectSvgDataToContain(mobileRibbon, 'common-logo-marker');
  await expectSvgDataToContain(mobileSticker, 'sticker-logo-marker');

  await page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem('ribbon-studio-v042'));
    saved.content.logo.ribbon = {
      mode: 'override',
      value: {
        logo: { data: null, ratio: 4 },
        logoType: 'svg',
        logoSvgSource:
          '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 10"><path id="ribbon-logo-marker" d="M0 0h40v10H0z"/></svg>',
        originalRaster: null,
        traceInfo: null,
      },
    };
    saved.content.logo.sticker = { mode: 'inherit' };
    localStorage.setItem('ribbon-studio-v042', JSON.stringify(saved));
  });
  await page.reload({ waitUntil: 'networkidle' });
  await expectSvgDataToContain(macroRibbon, 'ribbon-logo-marker');
  await expectSvgDataToContain(macroSticker, 'common-logo-marker');

  await page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem('ribbon-studio-v042'));
    saved.content.logo.ribbon = { mode: 'override', value: null };
    localStorage.setItem('ribbon-studio-v042', JSON.stringify(saved));
  });
  await page.reload({ waitUntil: 'networkidle' });
  await expect(macroRibbon).toBeHidden();
  await expect(boxRibbon).toBeHidden();
  await expect(mobileRibbon).toBeHidden();
  await expect(page.locator('#ribbonContent image').first()).toHaveCount(0);
  await expect(macroSticker).not.toHaveAttribute('hidden', '');
  await expectSvgDataToContain(macroSticker, 'common-logo-marker');
  expect((await readContentSnapshot(page)).logo.ribbon).toEqual({
    mode: 'override',
    value: null,
  });

  await expectNoHorizontalOverflow(page);
  expect(runtimeErrors).toEqual([]);
});

test('logo upload target persists through SVG callbacks and sequential uploads', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile');

  const runtimeErrors = watchRuntimeErrors(page);
  await page.addInitScript(() => {
    if (sessionStorage.getItem('target-upload-state-seeded')) return;
    sessionStorage.setItem('target-upload-state-seeded', 'true');
    const overrideSource =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 10"><path id="preserved-ribbon-override" d="M0 0h40v10H0z"/></svg>';
    const saved = JSON.parse(
      localStorage.getItem('ribbon-studio-v042') || '{}',
    );
    saved.content = saved.content || {
      text: {
        common: 'текст',
        ribbon: { mode: 'inherit' },
        sticker: { mode: 'inherit' },
      },
      logo: { common: null },
    };
    saved.content.logo.ribbon = {
      mode: 'override',
      value: {
        logo: { data: null, ratio: 4 },
        logoType: 'svg',
        logoSvgSource: overrideSource,
        originalRaster: null,
        traceInfo: null,
      },
    };
    saved.content.logo.sticker = { mode: 'inherit' };
    localStorage.setItem('ribbon-studio-v042', JSON.stringify(saved));
  });
  await page.goto('/studio/?product=set', { waitUntil: 'networkidle' });

  const ribbon = page.locator('#ribbonContent image').first();
  const sticker = page.locator('#stickerContent image').first();

  await page
    .locator('#logoInput')
    .setInputFiles(svgUpload('new-common.svg', 'new-common-marker'));
  await expectSvgDataToContain(ribbon, 'preserved-ribbon-override');
  await expectSvgDataToContain(sticker, 'new-common-marker');

  await setLogoUploadTarget(page, 'ribbon');
  await page
    .locator('#logoInput')
    .setInputFiles(svgUpload('ribbon-target.svg', 'ribbon-target-marker'));
  await expectSvgDataToContain(ribbon, 'ribbon-target-marker');
  await expectSvgDataToContain(sticker, 'new-common-marker');

  await setLogoUploadTarget(page, 'sticker');
  await page
    .locator('#logoInput')
    .setInputFiles(svgUpload('sticker-target.svg', 'sticker-target-marker'));
  await expectSvgDataToContain(ribbon, 'ribbon-target-marker');
  await expectSvgDataToContain(sticker, 'sticker-target-marker');

  await page.reload({ waitUntil: 'networkidle' });
  await expectSvgDataToContain(ribbon, 'ribbon-target-marker');
  await expectSvgDataToContain(sticker, 'sticker-target-marker');
  expect(runtimeErrors).toEqual([]);
});

test('raster upload target survives tracing and crop cancellation', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile');

  const runtimeErrors = watchRuntimeErrors(page);
  await page.goto('/studio/?product=set', { waitUntil: 'networkidle' });
  const ribbon = page.locator('#ribbonContent image').first();
  const sticker = page.locator('#stickerContent image').first();
  const initialRibbon = await ribbon.getAttribute('href');

  await setLogoUploadTarget(page, 'ribbon');
  await page
    .locator('#logoInput')
    .setInputFiles(fixturePath('transparent-logo.png'));
  await expect(page.locator('#traceStatus')).toBeVisible();
  await expect.poll(() => ribbon.getAttribute('href')).not.toBe(initialRibbon);
  await expect(page.locator('#stickerContent image')).toHaveCount(0);
  const tracedRibbon = await ribbon.getAttribute('href');

  await setLogoUploadTarget(page, 'sticker');
  await page
    .locator('#logoInput')
    .setInputFiles(fixturePath('opaque-logo.png'));
  await expect(page.locator('#cropModal')).toHaveClass(/open/);
  await page.locator('#cropApply').click();
  await expect(page.locator('#cropModal')).not.toHaveClass(/open/);
  await expect(page.locator('#fileCardName')).toHaveText('opaque-logo.png');
  await expect
    .poll(() => sticker.getAttribute('href'))
    .toMatch(/^data:image\/svg\+xml;base64,/);
  await expect(ribbon).toHaveAttribute('href', tracedRibbon);
  const tracedSticker = await sticker.getAttribute('href');

  await page.locator('#logoInput').setInputFiles([]);
  await setLogoUploadTarget(page, 'ribbon');
  await page
    .locator('#logoInput')
    .setInputFiles(fixturePath('opaque-logo.png'));
  await expect(page.locator('#cropModal')).toHaveClass(/open/);
  await page.locator('#cropCancel').click();
  await expect(page.locator('#cropModal')).not.toHaveClass(/open/);
  await expect(ribbon).toHaveAttribute('href', tracedRibbon);
  await expect(sticker).toHaveAttribute('href', tracedSticker);

  await page.reload({ waitUntil: 'networkidle' });
  await expect(ribbon).toHaveAttribute('href', tracedRibbon);
  await expect(sticker).toHaveAttribute('href', tracedSticker);
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

  await page.goto('/studio/?product=set', { waitUntil: 'networkidle' });

  const textInput = page.locator('#textInput');
  const macroRibbonText = page.locator('.mobile-products-ribbon-text');
  const macroStickerText = page.locator('.mobile-products-sticker-text');
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
  expect(await contentEvent).toMatchObject({
    text: {
      common: 'обновлённый общий',
      ribbon: { mode: 'inherit', resolved: 'обновлённый общий' },
      sticker: { mode: 'override', resolved: 'только стикер' },
    },
  });
  const updatedRibbonPreview = await readRibbonPreviewText(page);
  await expect(macroRibbonText).toHaveText(updatedRibbonPreview);
  await expect(macroStickerText).toHaveText('только стикер');
  await expect(mobileRibbonText).toHaveText(updatedRibbonPreview);
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
  await expect(textInput).toHaveValue('только лента');
  await expect(macroRibbonText).toHaveText('только лента');
  await expect(macroStickerText).toHaveText('только стикер');
  await expect(mobileRibbonText).toHaveText('только лента');
  await expect(mobileStickerText).toHaveText('только стикер');

  await expectNoHorizontalOverflow(page);
  expect(runtimeErrors).toEqual([]);
});

test('Studio navigation follows the three-step flow @smoke', async ({
  page,
}) => {
  const runtimeErrors = watchRuntimeErrors(page);
  await page.goto('/studio/?product=set', { waitUntil: 'networkidle' });

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
  await expect(page.locator('#fileCard')).toBeHidden();

  const continueUpload = page.locator('#continueUpload');
  await expect(continueUpload).toBeDisabled();
  await expect(navigation.locator('[data-panel="settings"]')).toBeDisabled();
  await expect(navigation.locator('[data-panel="order"]')).toBeDisabled();

  await page.evaluate(() => {
    document.querySelector('[data-panel="order"]').disabled = false;
  });
  await navigation.locator('[data-panel="order"]').click();
  await expect(page.locator('#panel-upload')).toBeVisible();

  await page.locator('#textInput').fill('Мой бренд');
  await expect(continueUpload).toBeEnabled();
  await expect(navigation.locator('[data-panel="settings"]')).toBeEnabled();
  await expect(navigation.locator('[data-panel="order"]')).toBeEnabled();
  await continueUpload.click();

  await expect(page.locator('#panel-settings')).toBeVisible();
  await expect(navigation.locator('[data-panel="settings"]')).toHaveClass(
    /active/,
  );
  await expect(page.locator('#panel-bundle')).toBeHidden();

  await navigation.locator('[data-panel="upload"]').click();
  await page.locator('#textInput').fill('');
  await expect(continueUpload).toBeDisabled();
  await expect(navigation.locator('[data-panel="settings"]')).toBeDisabled();
  await expect(navigation.locator('[data-panel="order"]')).toBeDisabled();

  await page.locator('#logoInput').setInputFiles(fixturePath('test-logo.svg'));
  await expect(continueUpload).toBeEnabled();
  await expect(page.locator('#fileCard')).toBeVisible();
  await expect(page.locator('#fileCardName')).toHaveText('test-logo.svg');
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

test('Create step validates input and manages the common logo @smoke', async ({
  page,
}) => {
  const runtimeErrors = watchRuntimeErrors(page);
  await page.goto('/studio/?product=set', { waitUntil: 'networkidle' });

  const textInput = page.locator('#textInput');
  const counter = page.locator('#textInputCounter');
  const continueUpload = page.locator('#continueUpload');
  const textStatus = page.locator('[data-create-status="text"]');
  const logoStatus = page.locator('[data-create-status="logo"]');

  await expect(textInput).not.toHaveAttribute('maxlength');
  await expect(counter).toHaveText('0 / 60');
  await expect(textStatus).toContainText('не добавлено');
  await expect(logoStatus).toContainText('не добавлен — необязательно');

  await page.locator('#logoInput').setInputFiles({
    name: 'logo.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('not a logo'),
  });
  await expect(page.locator('#uploadFeedback')).toContainText(
    'Поддерживаются только SVG, PNG, JPEG и PDF',
  );
  await expect(page.locator('#fileCard')).toBeHidden();
  await expect(continueUpload).toBeDisabled();

  await textInput.fill('  Мой    бренд   ');
  await expect(textInput).toHaveValue('Мой бренд ');
  await textInput.blur();
  await expect(textInput).toHaveValue('Мой бренд');
  await textInput.fill('');

  await textInput.fill('Мой бренд');
  await expect(counter).toHaveText('9 / 60');
  await expect(textStatus).toHaveClass(/is-complete/);
  await expect(continueUpload).toBeEnabled();
  await expect(page.locator('#ribbonContent text').first()).toBeAttached();
  await expect(page.locator('#dropZone')).toBeVisible();

  await textInput.fill('Очень длинное название '.repeat(4));
  await expect(page.locator('#textLengthWarning')).toBeVisible();
  await textInput.fill('Мой бренд');

  await page.locator('#logoInput').setInputFiles(fixturePath('test-logo.svg'));
  await expect(page.locator('#uploadFeedback')).toBeHidden();
  await expect(logoStatus).toHaveClass(/is-complete/);
  await expect(page.locator('#fileCardActions')).toBeVisible();

  await page.locator('#removeCommonLogo').click();
  await expect(page.locator('#fileCard')).toBeHidden();
  await expect(logoStatus).not.toHaveClass(/is-complete/);
  await expect(continueUpload).toBeEnabled();
  await expect(page.locator('#ribbonContent image').first()).toHaveCount(0);
  await expect(page.locator('#ribbonContent text').first()).toBeAttached();

  await textInput.fill('');
  await expect(counter).toHaveText('0 / 60');
  await expect(continueUpload).toBeDisabled();
  await page.locator('#logoInput').setInputFiles(fixturePath('test-logo.svg'));
  await expect(continueUpload).toBeEnabled();
  await expect(page.locator('#ribbonContent image').first()).toBeAttached();
  await expect(page.locator('#ribbonContent text')).toHaveCount(0);
  await expect(textInput).toBeEnabled();
  await expectNoHorizontalOverflow(page);
  expect(runtimeErrors).toEqual([]);
});
