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

const expectMobilePreviewVisible = async (page) => {
  await expect
    .poll(() =>
      page.locator('.mobile-products-preview').evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return rect.top >= -120 && rect.bottom <= window.innerHeight + 120;
      }),
    )
    .toBe(true);
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

const expectSvgDataToContain = async (locator, marker, attribute = 'src') => {
  await expect
    .poll(async () => {
      const dataUrl = await locator.getAttribute(attribute);
      if (!dataUrl?.startsWith('data:image/svg+xml;base64,')) return false;
      return Buffer.from(dataUrl.split(',')[1], 'base64')
        .toString()
        .includes(marker);
    })
    .toBe(true);
};

const setLogoUploadTarget = (page, target) =>
  page.evaluate((nextTarget) => {
    document.dispatchEvent(
      new CustomEvent('studio:logo-upload-target-set', {
        detail: { target: nextTarget },
      }),
    );
  }, target);

const svgUpload = (name, marker, width = 30, height = 10) => ({
  name,
  mimeType: 'image/svg+xml',
  buffer: Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}"><path id="${marker}" d="M0 0h${width}v${height}H0z"/></svg>`,
  ),
});

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
  await expect(page.locator('#macroLogoImage')).not.toHaveAttribute(
    'hidden',
    '',
  );
  await expect(page.locator('#macroStickerImage')).not.toHaveAttribute(
    'hidden',
    '',
  );

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
  await expect(page.locator('#macroLogoImage')).toHaveAttribute('hidden', '');
  await expect(page.locator('#macroStickerImage')).not.toHaveAttribute(
    'hidden',
    '',
  );

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
  await page.goto('/studio/', { waitUntil: 'networkidle' });

  const macroRibbon = page.locator('#macroLogoImage');
  const macroSticker = page.locator('#macroStickerImage');
  const boxRibbon = page.locator('#boxRibbonImage');
  const boxSticker = page.locator('#boxStickerImage');
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
  await page
    .locator('#printChoice button[data-value="#ffffff"]')
    .evaluate((button) => button.click());
  const detail = await contentEvent;
  expect(detail.logo).toEqual({
    common: { hasLogo: true, logoType: 'svg', ratio: 2 },
    ribbon: { mode: 'override', hasLogo: true, logoType: 'svg', ratio: 4 },
    sticker: { mode: 'override', hasLogo: true, logoType: 'svg', ratio: 0.5 },
  });
  expect(JSON.stringify(detail.logo)).not.toContain('data:image');
  expect(JSON.stringify(detail.logo)).not.toContain('<svg');
  for (const locator of [macroRibbon, macroSticker]) {
    await expect
      .poll(async () => {
        const src = await locator.getAttribute('src');
        return Buffer.from(src.split(',')[1], 'base64').toString();
      })
      .toContain('#ffffff');
  }

  await page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem('ribbon-studio-v042'));
    saved.content.logo.ribbon = { mode: 'inherit' };
    localStorage.setItem('ribbon-studio-v042', JSON.stringify(saved));
  });
  await page.reload({ waitUntil: 'networkidle' });
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
  await expect(page.locator('#ribbonContent image')).toHaveCount(0);
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
  await page.goto('/studio/', { waitUntil: 'networkidle' });

  const ribbon = page.locator('#macroLogoImage');
  const sticker = page.locator('#macroStickerImage');

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
  await page.goto('/studio/', { waitUntil: 'networkidle' });
  const ribbon = page.locator('#macroLogoImage');
  const sticker = page.locator('#macroStickerImage');
  const initialRibbon = await ribbon.getAttribute('src');
  const initialSticker = await sticker.getAttribute('src');

  await setLogoUploadTarget(page, 'ribbon');
  await page
    .locator('#logoInput')
    .setInputFiles(fixturePath('transparent-logo.png'));
  await expect(page.locator('#traceStatus')).toBeVisible();
  await expect.poll(() => ribbon.getAttribute('src')).not.toBe(initialRibbon);
  await expect(sticker).toHaveAttribute('src', initialSticker);
  const tracedRibbon = await ribbon.getAttribute('src');

  await setLogoUploadTarget(page, 'sticker');
  await page
    .locator('#logoInput')
    .setInputFiles(fixturePath('opaque-logo.png'));
  await expect(page.locator('#cropModal')).toHaveClass(/open/);
  await page.locator('#cropApply').click();
  await expect(page.locator('#cropModal')).not.toHaveClass(/open/);
  await expect.poll(() => sticker.getAttribute('src')).not.toBe(initialSticker);
  await expect(ribbon).toHaveAttribute('src', tracedRibbon);
  const tracedSticker = await sticker.getAttribute('src');

  await page.locator('#logoInput').setInputFiles([]);
  await setLogoUploadTarget(page, 'ribbon');
  await page
    .locator('#logoInput')
    .setInputFiles(fixturePath('opaque-logo.png'));
  await expect(page.locator('#cropModal')).toHaveClass(/open/);
  await page.locator('#cropCancel').click();
  await expect(page.locator('#cropModal')).not.toHaveClass(/open/);
  await expect(ribbon).toHaveAttribute('src', tracedRibbon);
  await expect(sticker).toHaveAttribute('src', tracedSticker);

  await page.reload({ waitUntil: 'networkidle' });
  await expect(ribbon).toHaveAttribute('src', tracedRibbon);
  await expect(sticker).toHaveAttribute('src', tracedSticker);
  await expectNoHorizontalOverflow(page);
  expect(runtimeErrors).toEqual([]);
});

test('mobile text and logo editing survives twenty alternating cycles', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile');

  const runtimeErrors = watchRuntimeErrors(page);
  await page.goto('/studio/', { waitUntil: 'networkidle' });
  const logoInput = page.locator('#logoInput');
  const textEditor = page.locator('#mobileTextEditor');
  const logoEditor = page.locator('#mobileLogoEditor');
  const cropModal = page.locator('#cropModal');
  const textZone = (product) =>
    page.locator(`[data-mobile-products-safe-zone="${product}-text"]`);
  const logoZone = (product) =>
    page.locator(`[data-mobile-products-safe-zone="${product}-logo"]`);
  const macroLogo = (product) =>
    page.locator(
      product === 'ribbon' ? '#macroLogoImage' : '#macroStickerImage',
    );

  const openTextEditor = async (product) => {
    await textZone(product).click();
    await expect(textEditor).toBeVisible();
  };
  const saveTextOverride = async (product, value) => {
    await openTextEditor(product);
    await page.locator('#editProductText').click();
    await page.locator('#mobileTextOverrideInput').fill(value);
    await page
      .locator('#mobileTextOverrideForm')
      .getByRole('button', { name: 'Сохранить' })
      .click();
    await expect(textEditor).toBeHidden();
    await expect(page.locator(`.mobile-products-${product}-text`)).toHaveText(
      value,
    );
  };
  const clearTextOverride = async (product) => {
    await openTextEditor(product);
    await page.locator('#clearProductTextOverride').click();
    await expect(textEditor).toBeHidden();
  };
  const openLogoEditor = async (product) => {
    await logoZone(product).click();
    await expect(logoEditor).toBeVisible();
  };
  const uploadProductLogo = async (product, file, marker) => {
    await openLogoEditor(product);
    const [chooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.locator('#editProductLogo').click(),
    ]);
    await chooser.setFiles(file);
    await expect(logoEditor).toBeHidden();
    await expect(logoInput).toHaveValue('');
    await expectSvgDataToContain(macroLogo(product), marker);
  };
  const clearLogoOverride = async (product) => {
    await openLogoEditor(product);
    await page.locator('#clearProductLogoOverride').click();
    await expect(logoEditor).toBeHidden();
  };

  for (let cycle = 1; cycle <= 20; cycle += 1) {
    if (cycle % 2 === 1) {
      const commonText = `stress-common-${cycle}`;
      await page.locator('#textInput').fill(commonText);
      for (const product of ['ribbon', 'sticker']) {
        const other = product === 'ribbon' ? 'sticker' : 'ribbon';
        const otherText = await page
          .locator(`.mobile-products-${other}-text`)
          .textContent();
        await saveTextOverride(product, `${product}-${cycle}-first`);
        await expect(page.locator(`.mobile-products-${other}-text`)).toHaveText(
          otherText,
        );
        await saveTextOverride(product, `${product}-${cycle}-second`);
        await clearTextOverride(product);
        await expect(
          page.locator(`.mobile-products-${product}-text`),
        ).toHaveText(commonText);
      }
    } else {
      const commonMarker = `common-${cycle}`;
      await logoInput.setInputFiles(
        svgUpload(`common-${cycle}.svg`, commonMarker),
      );
      await expect(logoInput).toHaveValue('');
      await expectSvgDataToContain(macroLogo('ribbon'), commonMarker);
      await expectSvgDataToContain(macroLogo('sticker'), commonMarker);

      if (cycle === 2) {
        await openLogoEditor('ribbon');
        const [cancelledChooser] = await Promise.all([
          page.waitForEvent('filechooser'),
          page.locator('#editProductLogo').click(),
        ]);
        await cancelledChooser.setFiles([]);
        await expect(logoEditor).toBeHidden();
      }

      for (const product of ['ribbon', 'sticker']) {
        const other = product === 'ribbon' ? 'sticker' : 'ribbon';
        const otherSrc = await macroLogo(other).getAttribute('src');
        const repeatedFile = svgUpload(
          `same-${product}.svg`,
          `${product}-${cycle}-same`,
        );
        await uploadProductLogo(
          product,
          repeatedFile,
          `${product}-${cycle}-same`,
        );
        await uploadProductLogo(
          product,
          repeatedFile,
          `${product}-${cycle}-same`,
        );
        await expect(macroLogo(other)).toHaveAttribute('src', otherSrc);
        await clearLogoOverride(product);
      }

      if (cycle === 2) {
        await openLogoEditor('ribbon');
        let chooser = await Promise.all([
          page.waitForEvent('filechooser'),
          page.locator('#editProductLogo').click(),
        ]).then(([fileChooser]) => fileChooser);
        await chooser.setFiles(fixturePath('transparent-logo.png'));
        await expect(page.locator('#traceStatus')).toBeVisible();
        await expect(logoInput).toHaveValue('');
        await clearLogoOverride('ribbon');

        await openLogoEditor('sticker');
        chooser = await Promise.all([
          page.waitForEvent('filechooser'),
          page.locator('#editProductLogo').click(),
        ]).then(([fileChooser]) => fileChooser);
        await chooser.setFiles(fixturePath('opaque-logo.png'));
        await expect(cropModal).toHaveClass(/open/);
        await expect(logoInput).toHaveValue('');
        await page.locator('#cropApply').click();
        await expect(cropModal).not.toHaveClass(/open/);
        await clearLogoOverride('sticker');

        await openLogoEditor('ribbon');
        chooser = await Promise.all([
          page.waitForEvent('filechooser'),
          page.locator('#editProductLogo').click(),
        ]).then(([fileChooser]) => fileChooser);
        await chooser.setFiles(fixturePath('opaque-logo.png'));
        await expect(cropModal).toHaveClass(/open/);
        await page.locator('#cropCancel').click();
        await expect(cropModal).not.toHaveClass(/open/);

        await openLogoEditor('ribbon');
        chooser = await Promise.all([
          page.waitForEvent('filechooser'),
          page.locator('#editProductLogo').click(),
        ]).then(([fileChooser]) => fileChooser);
        await chooser.setFiles(fixturePath('opaque-logo.png'));
        await expect(cropModal).toHaveClass(/open/);
        await page.locator('#cropApply').click();
        await expect(cropModal).not.toHaveClass(/open/);
        await clearLogoOverride('ribbon');
      }
    }

    await expect(textEditor).toBeHidden();
    await expect(logoEditor).toBeHidden();
    await expect(cropModal).not.toHaveClass(/open/);
  }

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
  expect(await contentEvent).toMatchObject({
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

  for (const product of ['ribbon', 'sticker']) {
    const scopeRequired = page.evaluate(
      () =>
        new Promise((resolve) => {
          document.addEventListener(
            'studio:text-edit-scope-required',
            (event) => resolve(event.detail),
            { once: true },
          );
        }),
    );
    await page
      .locator(`[data-mobile-products-safe-zone="${product}-text"]`)
      .click();
    expect(await scopeRequired).toEqual({ product });
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.locator('#cancelMobileTextEditor').click();
  }

  await expectNoHorizontalOverflow(page);
  expect(runtimeErrors).toEqual([]);
});

test('mobile text zones request editing and require scope after shared editing starts', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile');

  const runtimeErrors = watchRuntimeErrors(page);
  await page.goto('/studio/', { waitUntil: 'networkidle' });

  const textInput = page.locator('#textInput');
  const ribbonText = page.locator(
    '[data-mobile-products-safe-zone="ribbon-text"]',
  );
  const stickerText = page.locator(
    '[data-mobile-products-safe-zone="sticker-text"]',
  );

  const editRequest = page.evaluate(
    () =>
      new Promise((resolve) => {
        document.addEventListener(
          'studio:content-edit-request',
          (event) => resolve(event.detail),
          { once: true },
        );
      }),
  );
  await ribbonText.click();
  expect(await editRequest).toEqual({ kind: 'text', product: 'ribbon' });
  await expect(textInput).toBeFocused();

  const scopeRequired = page.evaluate(
    () =>
      new Promise((resolve) => {
        document.addEventListener(
          'studio:text-edit-scope-required',
          (event) => resolve(event.detail),
          { once: true },
        );
      }),
  );
  await stickerText.click();
  expect(await scopeRequired).toEqual({ product: 'sticker' });

  await expectNoHorizontalOverflow(page);
  expect(runtimeErrors).toEqual([]);
});

test('common text input enables product scope on the next safe-zone tap', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile');

  const runtimeErrors = watchRuntimeErrors(page);
  await page.goto('/studio/', { waitUntil: 'networkidle' });
  const textInput = page.locator('#textInput');
  const ribbonText = page.locator(
    '[data-mobile-products-safe-zone="ribbon-text"]',
  );

  await textInput.fill('изменённый общий текст');
  await expect(page.locator('#macroLogoText')).toHaveText(
    'изменённый общий текст',
  );
  await expect(page.locator('#macroStickerText')).toHaveText(
    'изменённый общий текст',
  );

  await ribbonText.click();
  await expect(page.locator('#mobileTextEditor')).toBeVisible();
  await expect(page.locator('#editCommonText')).toHaveText('Изменить везде');
  await expect(page.locator('#editProductText')).toHaveText('Только для ленты');
  await expectNoHorizontalOverflow(page);
  expect(runtimeErrors).toEqual([]);
});

test('successful mobile text editing returns to the combined preview', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile');

  const runtimeErrors = watchRuntimeErrors(page);
  await page.goto('/studio/', { waitUntil: 'networkidle' });
  const textInput = page.locator('#textInput');
  const ribbonZone = page.locator(
    '[data-mobile-products-safe-zone="ribbon-text"]',
  );
  const editor = page.locator('#mobileTextEditor');

  await textInput.scrollIntoViewIfNeeded();
  await textInput.fill('общий текст после подтверждения');
  await textInput.blur();
  await expectMobilePreviewVisible(page);

  await ribbonZone.click();
  await expect(editor).toBeVisible();
  await page.locator('#editProductText').click();
  await page.locator('#mobileTextOverrideInput').fill('только лента');
  await page
    .locator('#mobileTextOverrideForm')
    .getByRole('button', { name: 'Сохранить' })
    .click();
  await expectMobilePreviewVisible(page);
  await expect(page.locator('.mobile-products-ribbon-text')).toHaveText(
    'только лента',
  );
  await expect(page.locator('.mobile-products-sticker-text')).toHaveText(
    'общий текст после подтверждения',
  );

  await ribbonZone.click();
  await page.locator('#clearProductTextOverride').click();
  await expectMobilePreviewVisible(page);
  await expect(page.locator('.mobile-products-ribbon-text')).toHaveText(
    'общий текст после подтверждения',
  );

  await ribbonZone.click();
  const scrollBeforeCancel = await page.evaluate(() => window.scrollY);
  await page.locator('#cancelMobileTextEditor').click();
  await expect(editor).toBeHidden();
  expect(await page.evaluate(() => window.scrollY)).toBe(scrollBeforeCancel);
  await expectNoHorizontalOverflow(page);
  expect(runtimeErrors).toEqual([]);
});

test('empty inherited common text always focuses the shared editor', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile');

  const runtimeErrors = watchRuntimeErrors(page);
  await page.addInitScript(() => {
    localStorage.setItem(
      'ribbon-studio-v042',
      JSON.stringify({
        text: '',
        content: {
          logo: {
            common: null,
            ribbon: { mode: 'inherit' },
            sticker: { mode: 'inherit' },
          },
          text: {
            common: '',
            ribbon: { mode: 'inherit' },
            sticker: { mode: 'inherit' },
          },
        },
      }),
    );
  });
  await page.goto('/studio/', { waitUntil: 'networkidle' });

  const textInput = page.locator('#textInput');
  const scopeEvents = await page.evaluateHandle(() => {
    const events = [];
    document.addEventListener('studio:text-edit-scope-required', (event) => {
      events.push(event.detail);
    });
    return events;
  });

  for (const product of ['ribbon', 'sticker', 'ribbon']) {
    await page
      .locator(`[data-mobile-products-safe-zone="${product}-text"]`)
      .click();
    await expect(textInput).toBeFocused();
    await textInput.blur();
  }
  expect(await scopeEvents.jsonValue()).toEqual([]);

  await expectNoHorizontalOverflow(page);
  expect(runtimeErrors).toEqual([]);
});

test('mobile text editor creates, persists, and clears product overrides', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile');

  const runtimeErrors = watchRuntimeErrors(page);
  await page.goto('/studio/', { waitUntil: 'networkidle' });

  const textInput = page.locator('#textInput');
  const dialog = page.getByRole('dialog');
  const ribbonZone = page.locator(
    '[data-mobile-products-safe-zone="ribbon-text"]',
  );
  const stickerZone = page.locator(
    '[data-mobile-products-safe-zone="sticker-text"]',
  );
  const overrideInput = page.locator('#mobileTextOverrideInput');
  const commonText = await textInput.inputValue();

  await ribbonZone.click();
  await expect(textInput).toBeFocused();
  await ribbonZone.click();
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute('aria-modal', 'true');
  await expect(dialog).toHaveAttribute(
    'aria-labelledby',
    'mobileTextEditorTitle',
  );
  await expect(page.locator('#clearProductTextOverride')).toBeHidden();
  await page.locator('#editProductText').click();
  await expect(overrideInput).toBeFocused();
  await expect(overrideInput).toHaveValue(commonText);
  await overrideInput.fill('только лента');
  await page
    .locator('#mobileTextOverrideForm')
    .getByRole('button', {
      name: 'Сохранить',
    })
    .click();
  await expect(dialog).toBeHidden();
  await expect(ribbonZone).not.toBeFocused();
  await expectMobilePreviewVisible(page);
  await expect(textInput).toHaveValue(commonText);

  let snapshot = await readContentSnapshot(page);
  expect(snapshot.text.common).toBe(commonText);
  expect(snapshot.text.ribbon).toEqual({
    mode: 'override',
    value: 'только лента',
  });
  expect(snapshot.text.sticker).toEqual({ mode: 'inherit' });
  await expect(page.locator('.mobile-products-ribbon-text')).toHaveText(
    'только лента',
  );

  await stickerZone.click();
  await expect(dialog).toBeVisible();
  await expect(page.locator('#editProductText')).toHaveText(
    'Только для стикера',
  );
  await page.locator('#editProductText').click();
  await expect(overrideInput).toHaveValue(commonText);
  await overrideInput.fill('');
  await page
    .locator('#mobileTextOverrideForm')
    .getByRole('button', {
      name: 'Сохранить',
    })
    .click();
  await expect(stickerZone).not.toBeFocused();
  await expectMobilePreviewVisible(page);
  await expect(textInput).toHaveValue(commonText);

  snapshot = await readContentSnapshot(page);
  expect(snapshot.text.sticker).toEqual({ mode: 'override', value: '' });
  expect(snapshot.text.resolvedSticker).toBe('');
  await expect(stickerZone).toHaveAttribute('aria-label', 'Добавить надпись');
  await expect(page.locator('.mobile-products-sticker-text')).toBeHidden();
  await expect(stickerZone.locator('.mobile-products-zone-action')).toHaveCSS(
    'opacity',
    '0',
  );

  await page.reload({ waitUntil: 'networkidle' });
  await expect(textInput).toHaveValue(commonText);
  snapshot = await readContentSnapshot(page);
  expect(snapshot.text.ribbon).toEqual({
    mode: 'override',
    value: 'только лента',
  });
  expect(snapshot.text.sticker).toEqual({ mode: 'override', value: '' });

  await stickerZone.click();
  await expect(dialog).toBeVisible();
  await expect(page.locator('#clearProductTextOverride')).toBeVisible();
  await page.locator('#editProductText').click();
  await expect(overrideInput).toHaveValue('');
  await page.locator('#cancelMobileTextOverride').click();
  await stickerZone.click();
  await page.locator('#clearProductTextOverride').click();
  await expect(dialog).toBeHidden();
  await expect(stickerZone).not.toBeFocused();
  await expectMobilePreviewVisible(page);

  snapshot = await readContentSnapshot(page);
  expect(snapshot.text.sticker).toEqual({ mode: 'inherit' });
  expect(snapshot.text.resolvedSticker).toBe(commonText);
  await page.reload({ waitUntil: 'networkidle' });
  snapshot = await readContentSnapshot(page);
  expect(snapshot.text.sticker).toEqual({ mode: 'inherit' });
  expect(snapshot.text.ribbon).toEqual({
    mode: 'override',
    value: 'только лента',
  });

  await expectNoHorizontalOverflow(page);
  expect(runtimeErrors).toEqual([]);
});

test('mobile text editor closes accessibly and traps focus', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile');

  const runtimeErrors = watchRuntimeErrors(page);
  await page.addInitScript(() => {
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
            ribbon: { mode: 'override', value: 'только лента' },
            sticker: { mode: 'inherit' },
          },
        },
      }),
    );
  });
  await page.goto('/studio/', { waitUntil: 'networkidle' });

  const zone = page.locator('[data-mobile-products-safe-zone="ribbon-text"]');
  const editor = page.locator('#mobileTextEditor');
  const dialog = page.getByRole('dialog');
  const closeButton = page.locator('#closeMobileTextEditor');
  const cancelButton = page.locator('#cancelMobileTextEditor');

  await zone.click();
  await expect(dialog).toBeVisible();
  await closeButton.focus();
  await closeButton.press('Shift+Tab');
  await expect(cancelButton).toBeFocused();

  await cancelButton.click();
  await expect(editor).toBeHidden();
  await expect(zone).toBeFocused();

  await zone.click();
  await closeButton.click();
  await expect(editor).toBeHidden();
  await expect(zone).toBeFocused();

  await zone.click();
  await page
    .locator('#mobileTextEditorBackdrop')
    .click({ position: { x: 5, y: 5 } });
  await expect(editor).toBeHidden();
  await expect(zone).toBeFocused();

  await zone.click();
  await page.keyboard.press('Escape');
  await expect(editor).toBeHidden();
  await expect(zone).toBeFocused();

  await zone.click();
  await page.locator('#editCommonText').click();
  await expect(editor).toBeHidden();
  await expect(page.locator('#textInput')).toBeFocused();
  const snapshot = await readContentSnapshot(page);
  expect(snapshot.text.ribbon).toEqual({
    mode: 'override',
    value: 'только лента',
  });

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

test('mobile logo zones request scope and upload common and product SVG assets', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile');

  const runtimeErrors = watchRuntimeErrors(page);
  await page.goto('/studio/', { waitUntil: 'networkidle' });
  const ribbonZone = page.locator(
    '[data-mobile-products-safe-zone="ribbon-logo"]',
  );
  const stickerZone = page.locator(
    '[data-mobile-products-safe-zone="sticker-logo"]',
  );
  const ribbon = page.locator('#macroLogoImage');
  const sticker = page.locator('#macroStickerImage');
  const editor = page.locator('#mobileLogoEditor');
  const dialog = page.locator('#mobileLogoEditorDialog');

  const ribbonRequest = page.evaluate(
    () =>
      new Promise((resolve) => {
        document.addEventListener(
          'studio:content-edit-request',
          (event) => resolve(event.detail),
          { once: true },
        );
      }),
  );
  const [commonChooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    ribbonZone.click(),
  ]);
  expect(await ribbonRequest).toEqual({ kind: 'logo', product: 'ribbon' });
  expect(await commonChooser.element().getAttribute('id')).toBe('logoInput');
  await commonChooser.setFiles(
    svgUpload('scope-common.svg', 'scope-common-marker'),
  );
  await expectSvgDataToContain(ribbon, 'scope-common-marker');
  await expectSvgDataToContain(sticker, 'scope-common-marker');
  await expect(editor).toBeHidden();

  await ribbonZone.click();
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute('role', 'dialog');
  await expect(dialog).toHaveAttribute('aria-modal', 'true');
  await expect(dialog).toHaveAttribute(
    'aria-labelledby',
    'mobileLogoEditorTitle',
  );
  await expect(page.locator('#mobileLogoEditorTitle')).toHaveText(
    'Логотип для ленты',
  );
  await expect(page.locator('#editProductLogo')).toHaveText('Только для ленты');
  await expect(page.locator('#clearProductLogoOverride')).toBeHidden();

  const [ribbonChooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.locator('#editProductLogo').click(),
  ]);
  await ribbonChooser.setFiles(
    svgUpload('scope-ribbon.svg', 'scope-ribbon-marker'),
  );
  await expectSvgDataToContain(ribbon, 'scope-ribbon-marker');
  await expectSvgDataToContain(sticker, 'scope-common-marker');

  const stickerRequest = page.evaluate(
    () =>
      new Promise((resolve) => {
        document.addEventListener(
          'studio:content-edit-request',
          (event) => resolve(event.detail),
          { once: true },
        );
      }),
  );
  await stickerZone.click();
  expect(await stickerRequest).toEqual({ kind: 'logo', product: 'sticker' });
  await expect(dialog).toBeVisible();
  await expect(page.locator('#mobileLogoEditorTitle')).toHaveText(
    'Логотип для стикера',
  );
  await expect(page.locator('#editProductLogo')).toHaveText(
    'Только для стикера',
  );
  const [stickerChooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.locator('#editProductLogo').click(),
  ]);
  await stickerChooser.setFiles(
    svgUpload('scope-sticker.svg', 'scope-sticker-marker'),
  );
  await expectSvgDataToContain(ribbon, 'scope-ribbon-marker');
  await expectSvgDataToContain(sticker, 'scope-sticker-marker');

  await page.reload({ waitUntil: 'networkidle' });
  await expectSvgDataToContain(ribbon, 'scope-ribbon-marker');
  await expectSvgDataToContain(sticker, 'scope-sticker-marker');
  await expectNoHorizontalOverflow(page);
  expect(runtimeErrors).toEqual([]);
});

test('mobile logo override can return to the current common logo', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile');

  const runtimeErrors = watchRuntimeErrors(page);
  await page.addInitScript(() => {
    if (sessionStorage.getItem('logo-override-editor-seeded')) return;
    sessionStorage.setItem('logo-override-editor-seeded', 'true');
    const asset = (marker) => ({
      logo: { data: null, ratio: 2 },
      logoType: 'svg',
      logoSvgSource: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 10"><path id="${marker}" d="M0 0h20v10H0z"/></svg>`,
      originalRaster: null,
      traceInfo: null,
    });
    localStorage.setItem(
      'ribbon-studio-v042',
      JSON.stringify({
        content: {
          logo: {
            common: asset('return-common-marker'),
            ribbon: {
              mode: 'override',
              value: asset('return-override-marker'),
            },
            sticker: {
              mode: 'override',
              value: asset('other-override-marker'),
            },
          },
          text: {
            common: 'текст',
            ribbon: { mode: 'inherit' },
            sticker: { mode: 'inherit' },
          },
        },
      }),
    );
  });
  await page.goto('/studio/', { waitUntil: 'networkidle' });

  const zone = page.locator('[data-mobile-products-safe-zone="ribbon-logo"]');
  const editor = page.locator('#mobileLogoEditor');
  const ribbon = page.locator('#macroLogoImage');
  const sticker = page.locator('#macroStickerImage');
  await zone.click();
  await expect(editor).toBeVisible();
  await expect(page.locator('#clearProductLogoOverride')).toBeVisible();
  const [commonChooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.locator('#editCommonLogo').click(),
  ]);
  await commonChooser.setFiles(
    svgUpload('updated-common.svg', 'updated-return-common-marker'),
  );
  await expectSvgDataToContain(ribbon, 'return-override-marker');
  await expectSvgDataToContain(sticker, 'other-override-marker');

  await zone.click();
  await expect(editor).toBeVisible();
  await page.locator('#clearProductLogoOverride').click();
  await expect(editor).toBeHidden();
  await expect(zone).toBeFocused();
  await expectSvgDataToContain(ribbon, 'updated-return-common-marker');
  expect((await readContentSnapshot(page)).logo.ribbon.mode).toBe('inherit');

  await page.reload({ waitUntil: 'networkidle' });
  await expectSvgDataToContain(ribbon, 'updated-return-common-marker');
  await expectSvgDataToContain(sticker, 'other-override-marker');
  expect((await readContentSnapshot(page)).logo.ribbon.mode).toBe('inherit');
  expect(runtimeErrors).toEqual([]);
});

test('null logo override opens an accessible cancellable scope dialog', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile');

  const runtimeErrors = watchRuntimeErrors(page);
  await page.addInitScript(() => {
    const saved = JSON.parse(
      localStorage.getItem('ribbon-studio-v042') || '{}',
    );
    saved.content = saved.content || {
      logo: {},
      text: {
        common: 'текст',
        ribbon: { mode: 'inherit' },
        sticker: { mode: 'inherit' },
      },
    };
    saved.content.logo.ribbon = { mode: 'override', value: null };
    localStorage.setItem('ribbon-studio-v042', JSON.stringify(saved));
  });
  await page.goto('/studio/', { waitUntil: 'networkidle' });

  const zone = page.locator('[data-mobile-products-safe-zone="ribbon-logo"]');
  const editor = page.locator('#mobileLogoEditor');
  const close = page.locator('#closeMobileLogoEditor');
  const cancel = page.locator('#cancelMobileLogoEditor');
  await expect(zone).toBeVisible();
  await expect(zone).toHaveAttribute('aria-label', 'Добавить логотип');

  await zone.click();
  await expect(editor).toBeVisible();
  await expect(page.locator('#clearProductLogoOverride')).toBeVisible();
  await close.focus();
  await close.press('Shift+Tab');
  await expect(cancel).toBeFocused();
  await cancel.click();
  await expect(editor).toBeHidden();
  await expect(zone).toBeFocused();

  await zone.click();
  await close.click();
  await expect(editor).toBeHidden();
  await expect(zone).toBeFocused();
  await zone.click();
  await page
    .locator('#mobileLogoEditorBackdrop')
    .click({ position: { x: 5, y: 5 } });
  await expect(editor).toBeHidden();
  await expect(zone).toBeFocused();
  await zone.click();
  await page.keyboard.press('Escape');
  await expect(editor).toBeHidden();
  await expect(zone).toBeFocused();

  await zone.click();
  await page.locator('#clearProductLogoOverride').click();
  await expectSvgDataToContain(page.locator('#macroLogoImage'), '_Слой_1');
  expect((await readContentSnapshot(page)).logo.ribbon.mode).toBe('inherit');
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
    await expect(zone.locator('.mobile-products-zone-action')).toHaveCSS(
      'opacity',
      '0',
    );
  }
  await expect(page.locator('.mobile-products-ribbon-text')).toBeHidden();
  await expect(page.locator('.mobile-products-sticker-text')).toBeHidden();

  await zones.ribbonText.focus();
  await expect(
    zones.ribbonText.locator('.mobile-products-zone-action'),
  ).toHaveCSS('opacity', '1');

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
  await page.locator('#macroStickerImage').evaluate((element) => {
    element.hidden = true;
    element.dispatchEvent(new Event('change', { bubbles: true }));
  });
  for (const zone of [zones.ribbonLogo, zones.stickerLogo]) {
    await expect(zone).toBeVisible();
    await expect(zone).toHaveAttribute('aria-label', 'Добавить логотип');
    await expect(zone.locator('.mobile-products-zone-action')).toHaveText(
      'Добавить логотип',
    );
  }

  const [fileChooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    zones.ribbonLogo.click(),
  ]);
  expect(await fileChooser.element().getAttribute('id')).toBe('logoInput');
  await fileChooser.setFiles([]);
  await zones.stickerLogo.click();
  await expect(page.locator('#mobileLogoEditorDialog')).toBeVisible();
  await page.locator('#cancelMobileLogoEditor').click();
  await expect(logoInput).toHaveAttribute('id', 'logoInput');

  await page.locator('#macroLogoImage').evaluate((element) => {
    element.hidden = false;
  });
  await page.locator('#macroStickerImage').evaluate((element) => {
    element.hidden = false;
    element.dispatchEvent(new Event('change', { bubbles: true }));
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
  await page.locator('#macroStickerImage').evaluate((element) => {
    element.hidden = true;
    element.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await expect(stickerContent).toHaveAttribute(
    'data-mobile-products-mode',
    'text-only',
  );
  await expect(stickerLogo).toBeHidden();
  await expect(stickerText).toBeVisible();

  await page.locator('#macroStickerImage').evaluate((element) => {
    element.hidden = false;
    element.dispatchEvent(new Event('change', { bubbles: true }));
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

test('successful mobile SVG and PNG uploads return to the combined preview', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile');

  const runtimeErrors = watchRuntimeErrors(page);
  await page.goto('/studio/', { waitUntil: 'networkidle' });
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
  await expect(cropModal.locator('input[type="range"]')).toHaveCount(0);
  await expect(cropModal.getByText('Масштаб', { exact: true })).toHaveCount(0);
  await expect(page.locator('.crop-actions .button')).toHaveText([
    'Использовать выделенную область',
    'Использовать всё изображение',
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
  await expect(page.locator('#mobileLogoEditor')).toBeHidden();
  await expect(page.locator('#mobileLogoEditor')).toHaveCSS('display', 'none');
  await expect(page.locator('main.studio')).toBeVisible();

  const scrollBeforeUpload = await page.evaluate(() => window.scrollY);
  await page.locator('#logoInput').setInputFiles(fixturePath('test-logo.svg'));
  await expect(page.locator('#fileCardName')).toHaveText('test-logo.svg');
  expect(await page.evaluate(() => window.scrollY)).toBe(scrollBeforeUpload);
});
