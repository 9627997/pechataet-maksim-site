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
  await ensureProductSettingsVisible(page);
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
  await ensureProductSettingsVisible(page);
  for (const selector of [
    '.mobile-products-ribbon-logo',
    '.mobile-products-sticker-logo',
  ]) {
    const logo = page.locator(selector);
    await expect(logo).toBeVisible();
    await expect.poll(() => logo.getAttribute('src')).toBe(expectedSrc);
  }
};

const expectMobileArtworkRendered = async (page) => {
  await ensureProductSettingsVisible(page);
  for (const selector of [
    '.mobile-products-ribbon-logo',
    '.mobile-products-ribbon-text',
    '.mobile-products-sticker-logo',
    '.mobile-products-sticker-text',
  ]) {
    const artwork = page.locator(selector);
    await expect(artwork).toBeVisible();
    await expect
      .poll(async () => {
        const bounds = await artwork.boundingBox();
        return bounds ? Math.min(bounds.width, bounds.height) : 0;
      })
      .toBeGreaterThan(0);
  }
};

const expectMobileRibbonFramed = async (page) => {
  await ensureProductSettingsVisible(page);
  await expect
    .poll(() =>
      page.locator('.mobile-products-ribbon-sample').evaluate((element) => {
        const bounds = element.getBoundingClientRect();
        const panel = element.closest('.mobile-products-panel');
        const panelBounds = panel.getBoundingClientRect();
        const panelStyle = getComputedStyle(panel);
        const leftEdge =
          panelBounds.left + Number.parseFloat(panelStyle.borderLeftWidth);
        const rightEdge =
          panelBounds.right - Number.parseFloat(panelStyle.borderRightWidth);
        return (
          Math.abs(bounds.left - leftEdge) <= 1 &&
          Math.abs(bounds.right - rightEdge) <= 1 &&
          Math.abs(bounds.width - (rightEdge - leftEdge)) <= 1
        );
      }),
    )
    .toBe(true);
  await expectNoHorizontalOverflow(page);
};

const expectShowcaseCaptionClear = async (page) => {
  const gap = await page.locator('#scene-kit').evaluate((scene) => {
    const caption = scene.querySelector('.scene-caption');
    const firstLabel = scene.querySelector(
      '.showcase-ribbon-15 .showcase-label',
    );
    return (
      firstLabel.getBoundingClientRect().top -
      caption.getBoundingClientRect().bottom
    );
  });
  expect(gap).toBeGreaterThanOrEqual(16);
};

const expectInterfaceResponsive = async (page) => {
  await ensureProductSettingsVisible(page);
  const ribbonSwitch = page.getByRole('switch', { name: 'Лента' });
  const ribbonSample = page.locator('[data-mobile-product-sample="ribbon"]');
  await ribbonSwitch.uncheck();
  await expect(ribbonSample).toBeHidden();
  await ribbonSwitch.check();
  await expect(ribbonSample).toBeVisible();
};

const completeFirstStepWithText = async (page) => {
  await page.locator('#textInput').fill('Мой бренд');
  await expect(page.locator('#continueUpload')).toBeEnabled();
};

const openSettings = async (page) => {
  const settings = page.locator('.nav-item[data-panel="settings"]');
  await expect(settings).toBeEnabled();
  await settings.click();
  await expect(page.locator('#panel-settings')).toBeVisible();
};

const ensureProductSettingsVisible = async (page, product = 'ribbon') => {
  const panel = page.locator('.mobile-products-panel');
  if (!(await panel.isVisible())) await openSettings(page);
  const sample = panel.locator(`[data-mobile-product-sample="${product}"]`);
  if ((await sample.getAttribute('aria-pressed')) !== 'true') {
    await sample.click({ position: { x: 4, y: 4 } });
  }
  await expect(panel).toBeVisible();
};

const readContentSnapshot = async (page) =>
  JSON.parse(await page.locator('body').getAttribute('data-studio-content'));

const readRibbonPreviewText = (page) =>
  page.evaluate(() => {
    const layout = JSON.parse(document.body.dataset.studioLayout).ribbon;
    const content = JSON.parse(document.body.dataset.studioContent);
    return layout.valid
      ? content.text.resolvedRibbon.trim()
      : layout.previewText;
  });

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

const jpegUpload = {
  name: 'test-logo.jpg',
  mimeType: 'image/jpeg',
  buffer: Buffer.from(
    '/9j/4AAQSkZJRgABAQAASABIAAD/4QBMRXhpZgAATU0AKgAAAAgAAYdpAAQAAAABAAAAGgAAAAAAA6ABAAMAAAABAAEAAKACAAQAAAABAAAADKADAAQAAAABAAAADAAAAAD/wAARCAAMAAwDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9sAQwACAgICAgIDAgIDBQMDAwUGBQUFBQYIBgYGBgYICggICAgICAoKCgoKCgoKDAwMDAwMDg4ODg4PDw8PDw8PDw8P/9sAQwECAgIEBAQHBAQHEAsJCxAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQ/90ABAAB/9oADAMBAAIRAxEAPwD7j/bM8WftLfDfxf4H1X4Y/Eu00HQPHPiDSvDEenTaLbXb2k175nmXZnlJaQDaP3eF9mFfdvgXTPFei+ENK0rxzraeI9ftoFS81GO2WzS6lHWQQISsYP8AdBIrJ8f/AAp+HnxS/sP/AIWBokOtf8I3qMOq6f5xcfZ723z5co2MucZ+62VPcGvQqAP/2Q==',
    'base64',
  ),
};

const createPdfUpload = () => {
  const content =
    'q\n1 1 1 rg\n0 0 300 120 re f\n0 0 0 rg\n30 30 240 60 re f\nQ\n';
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 120] /Resources << >> /Contents 4 0 R >>',
    `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}endstream`,
  ];
  let source = '%PDF-1.4\n';
  const offsets = [0];

  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(source));
    source += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefOffset = Buffer.byteLength(source);
  source += `xref\n0 ${objects.length + 1}\n`;
  source += '0000000000 65535 f \n';
  source += offsets
    .slice(1)
    .map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`)
    .join('');
  source +=
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n` +
    `startxref\n${xrefOffset}\n%%EOF\n`;

  return {
    name: 'test-logo.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from(source),
  };
};

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

test('fresh first step marks the demo and keeps customer content honest', async ({
  page,
}, testInfo) => {
  const runtimeErrors = watchRuntimeErrors(page);
  await page.goto('/studio/', { waitUntil: 'networkidle' });

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
  await expect(page.locator('#continueUpload')).toBeDisabled();
  await expect(page.locator('#continueUploadHelp')).toHaveText(
    'Введите название или загрузите логотип',
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
  if (testInfo.project.name === 'mobile') {
    const previewIsAboveCreation = await page.evaluate(() => {
      const preview = document
        .querySelector('.mobile-products-panel')
        .getBoundingClientRect();
      const creation = document
        .querySelector('#panel-upload')
        .getBoundingClientRect();
      return preview.top < creation.top && preview.bottom <= window.innerHeight;
    });
    expect(previewIsAboveCreation).toBe(true);
  }
  await expectShowcaseCaptionClear(page);

  const demoText =
    testInfo.project.name === 'mobile'
      ? page.locator('.dynamic-showcase-text').first()
      : page.locator('.dynamic-showcase-text').first();
  await expect(demoText).toHaveText('ленты по любви');

  await textInput.fill('Мой бренд');
  await expect(page.locator('body')).toHaveAttribute(
    'data-preview-demo',
    'true',
  );
  await expect(page.locator('body')).toHaveAttribute(
    'data-preview-logo-demo',
    'true',
  );
  await expect(page.locator('#continueUpload')).toBeEnabled();
  await expect(page.locator('#continueUploadHelp')).toBeHidden();
  await expect(page.locator('#macroLogoImage')).not.toHaveAttribute(
    'hidden',
    '',
  );
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
  await expect(page.locator('#macroLogoImage')).not.toHaveAttribute(
    'hidden',
    '',
  );
  snapshot = await readContentSnapshot(page);
  expect(snapshot.logo.common).toBeNull();
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

  await expect(page.locator('#macroLogoText')).toHaveText(/…$/);
  await expect(page.locator('#macroStickerText')).toHaveText(
    'старый общий текст',
  );
  await expect(
    page.locator('.ribbon-overflow-card-mobile [data-ribbon-overflow-text]'),
  ).toHaveText('старый общий текст');
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
  await openSettings(page);

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
      const src = await macroRibbon.getAttribute('src');
      return src ? Buffer.from(src.split(',')[1], 'base64').toString() : '';
    })
    .toContain('#ffffff');
  await expect
    .poll(async () => {
      const src = await macroSticker.getAttribute('src');
      return src ? Buffer.from(src.split(',')[1], 'base64').toString() : '';
    })
    .toContain('#171717');

  await page
    .locator('[data-mobile-product-sample="sticker"]')
    .click({ position: { x: 4, y: 4 } });
  await page.locator('#printColorSelect').selectOption('#ffffff');
  await expect
    .poll(async () => {
      const src = await macroSticker.getAttribute('src');
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
      await page.locator('.nav-item[data-panel="upload"]').click();
      await page.locator('#textInput').fill(commonText);
      await openSettings(page);
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
        await expect(page.locator('#traceStatus')).not.toHaveAttribute(
          'hidden',
          '',
        );
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
  await textInput.fill('общий текст');

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
    await readRibbonPreviewText(page),
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
    await readRibbonPreviewText(page),
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
      .click({ position: { x: 8, y: 8 } });
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

  await ribbonZone.click();
  await expect(textInput).toBeFocused();
  await textInput.fill('общий текст');
  const commonText = await textInput.inputValue();
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

test('product samples reveal independent ribbon and sticker settings', async ({
  page,
}) => {
  const runtimeErrors = watchRuntimeErrors(page);
  await page.goto('/studio/', { waitUntil: 'networkidle' });
  await completeFirstStepWithText(page);
  await page.locator('#continueUpload').click();

  const panel = page.locator('.mobile-products-panel');
  const ribbonSample = panel.locator('[data-mobile-product-sample="ribbon"]');
  const stickerSample = panel.locator('[data-mobile-product-sample="sticker"]');
  const ribbonText = page.locator('.mobile-products-ribbon-text');
  const stickerText = page.locator('.mobile-products-sticker-text');

  await expect(panel).toBeVisible();
  await expect(panel).toBeVisible();
  await expect(panel.getByRole('switch', { name: 'Лента' })).toBeChecked();
  await expect(panel.getByRole('switch', { name: 'Стикер' })).toBeChecked();
  await expect(ribbonSample).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-settings-product="ribbon"]')).toBeVisible();
  await expect(page.locator('[data-settings-product="sticker"]')).toBeHidden();
  await expect(page.locator('#fontSelect')).toHaveJSProperty(
    'tagName',
    'SELECT',
  );
  await expect(page.locator('#printColorSelect')).toHaveJSProperty(
    'tagName',
    'SELECT',
  );
  await expect(page.locator('#ribbonColorSelect')).toHaveJSProperty(
    'tagName',
    'SELECT',
  );

  await page.locator('#fontSelect').selectOption('Georgia');
  await page.locator('#printColorSelect').selectOption('#b69249');
  await page.locator('#ribbonColorSelect').selectOption('#b7202d');
  await expect(ribbonText).toHaveCSS('font-family', 'Georgia');
  await expect(ribbonText).toHaveCSS('color', 'rgb(182, 146, 73)');
  await expect(stickerText).toHaveCSS('font-family', 'Manrope');
  await expect(stickerText).toHaveCSS('color', 'rgb(23, 23, 23)');
  await expect(page.locator('.mobile-products-ribbon-sample')).toHaveCSS(
    'background-color',
    'rgb(183, 32, 45)',
  );

  await stickerSample.click({ position: { x: 4, y: 4 } });
  await expect(stickerSample).toHaveAttribute('aria-pressed', 'true');
  await expect(ribbonSample).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('#activeSettingsTitle')).toHaveText('Стикер');
  await expect(page.locator('[data-settings-product="ribbon"]')).toBeHidden();
  await expect(page.locator('[data-settings-product="sticker"]')).toBeVisible();
  await expect(page.locator('#fontSelect')).toHaveValue('Manrope');
  await expect(page.locator('#printColorSelect')).toHaveValue('#171717');

  await page.locator('#fontSelect').selectOption('PT Serif');
  await page.locator('#printColorSelect').selectOption('#c6c8cd');
  await expect(stickerText).toHaveCSS('font-family', '"PT Serif"');
  await expect(stickerText).toHaveCSS('color', 'rgb(198, 200, 205)');
  await expect(ribbonText).toHaveCSS('font-family', 'Georgia');
  await expect(ribbonText).toHaveCSS('color', 'rgb(182, 146, 73)');

  await ribbonSample.click({ position: { x: 4, y: 4 } });
  await expect(page.locator('#fontSelect')).toHaveValue('Georgia');
  await expect(page.locator('#printColorSelect')).toHaveValue('#b69249');
  await expect(page.locator('#ribbonColorSelect')).toHaveValue('#b7202d');
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

  await completeFirstStepWithText(page);
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
  await completeFirstStepWithText(page);
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

test('order dialog validates contact and downloads an accessible request', async ({
  page,
}) => {
  const runtimeErrors = watchRuntimeErrors(page);
  await page.goto('/studio/', { waitUntil: 'networkidle' });
  await completeFirstStepWithText(page);
  await page.locator('#continueUpload').click();
  await page.locator('#panel-settings .next-panel').click();

  const openOrder = page.locator('#openOrder');
  await openOrder.click();

  const dialog = page.getByRole('dialog', { name: 'Сформировать заявку' });
  const customerName = page.getByLabel('Имя');
  const customerPhone = page.getByLabel('Телефон');
  const downloadOrder = page.getByRole('button', { name: 'Скачать заявку' });
  await expect(dialog).toBeVisible();
  await expect(customerName).toBeFocused();

  await customerName.fill('Максим');
  await downloadOrder.click();
  await expect(page.locator('#orderFormStatus')).toHaveText(
    'Укажите телефон или Telegram.',
  );
  await expect(customerPhone).toBeFocused();

  await customerPhone.fill('+7 900 000-00-00');
  const downloadPromise = page.waitForEvent('download');
  await downloadOrder.click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe(
    'zayavka-studio-pechataet-maksim.txt',
  );
  await expect(page.locator('#orderFormStatus')).toContainText(
    'Заявка скачана.',
  );

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(openOrder).toBeFocused();
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
  await expect(page.locator('#macroLogoImage')).toBeHidden();
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

  await textInput.fill('временная надпись');
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
  const [stickerFileChooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    zones.stickerLogo.click({ position: { x: 10, y: 10 } }),
  ]);
  expect(await stickerFileChooser.element().getAttribute('id')).toBe(
    'logoInput',
  );
  await stickerFileChooser.setFiles([]);
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
  const stickerLogo = page.locator('.mobile-products-sticker-logo');
  const ribbonText = page.locator('.mobile-products-ribbon-text');
  const stickerText = page.locator('.mobile-products-sticker-text');
  const stickerContent = page.locator('.mobile-products-sticker-content');

  await expectMobileArtworkRendered(page);
  await expect(ribbonText).toHaveText('ленты по любви');
  await expect(stickerText).toHaveText('ленты по любви');
  await expect(stickerContent).toHaveAttribute(
    'data-mobile-products-mode',
    'logo-and-text',
  );

  await page.locator('#textInput').fill('новая длинная надпись для упаковки');
  await expect(ribbonText).toHaveText(await readRibbonPreviewText(page));
  await expect(stickerText).toHaveText('новая длинная надпись для упаковки');

  await page.locator('.nav-item[data-panel="settings"]').click();
  await page.locator('#fontSelect').selectOption('Georgia');
  await expect(ribbonText).toHaveCSS('font-family', 'Georgia');
  await expect(stickerText).toHaveCSS('font-family', 'Manrope');

  await page.locator('#logoInput').setInputFiles(fixturePath('test-logo.svg'));
  await expect(stickerLogo).toBeVisible();

  await page.locator('#printColorSelect').selectOption('#b69249');
  await expect(ribbonText).toHaveCSS('color', 'rgb(182, 146, 73)');
  await expect(stickerText).toHaveCSS('color', 'rgb(23, 23, 23)');

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

  await page.locator('#logoScale').evaluate((element) => {
    element.value = '50';
    element.dispatchEvent(new Event('input', { bubbles: true }));
  });
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
  await expect(page.locator('body')).toHaveAttribute(
    'data-preview-demo',
    'false',
  );
  const snapshot = await readContentSnapshot(page);
  expect(snapshot.text.common).toBe('');
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

test('JPEG upload opens an accessible crop dialog and completes tracing', async ({
  page,
}) => {
  const runtimeErrors = watchRuntimeErrors(page);
  await page.goto('/studio/', { waitUntil: 'networkidle' });

  await page.locator('#logoInput').setInputFiles(jpegUpload);
  const cropDialog = page.getByRole('dialog', {
    name: 'Выделите логотип',
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
  await page.goto('/studio/', { waitUntil: 'networkidle' });
  for (const asset of ['pdf.min.js', 'pdf.worker.min.js']) {
    const response = await page.request.get(
      `/studio/assets/vendor/pdfjs/${asset}`,
    );
    expect(response.ok()).toBe(true);
    expect(response.headers()['content-type']).toContain('javascript');
  }

  await page.locator('#logoInput').setInputFiles(createPdfUpload());
  const cropDialog = page.getByRole('dialog', {
    name: 'Выделите логотип',
  });
  await expect(cropDialog).toBeVisible();
  await expect(page.locator('#fileCardName')).toHaveText('test-logo.pdf');
  await expect(page.locator('#fileCardMeta')).toContainText('PDF');
  await expect(page.locator('#fileCardMeta')).toContainText('1 страница');

  await page.locator('#cropUseAll').click();
  await expect(cropDialog).toBeHidden();
  await expect(page.locator('#fileCardMeta')).toContainText('PDF · выделено');
  await expect(page.locator('#traceStatus')).toBeVisible();
  await expect(page.locator('#continueUpload')).toBeEnabled();
  await expect
    .poll(() => page.locator('#macroLogoImage').getAttribute('src'))
    .toMatch(/^data:image\/svg\+xml;base64,/);
  await expectNoHorizontalOverflow(page);
  expect(runtimeErrors).toEqual([]);
});

test('mobile first reveal keeps artwork visible and switches paired with labels', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile');

  const runtimeErrors = watchRuntimeErrors(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/studio/', { waitUntil: 'networkidle' });

  const panel = page.locator('.mobile-products-panel');
  await expect(panel).toBeHidden();

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(panel).toBeVisible();
  await expectMobileArtworkRendered(page);
  await expectMobileRibbonFramed(page);

  const switchLayout = await panel
    .locator('.mobile-products-switch')
    .evaluateAll((labels) => {
      const row = labels[0].parentElement.getBoundingClientRect();
      const pairBounds = labels.map((label) => {
        const text = label.querySelector('span:first-child');
        const control = label.querySelector('.mobile-products-switch-control');
        const labelBounds = label.getBoundingClientRect();
        return {
          bounds: labelBounds.toJSON(),
          gap:
            control.getBoundingClientRect().left -
            text.getBoundingClientRect().right,
        };
      });
      return {
        pairBounds,
        leftInset: pairBounds[0].bounds.left - row.left,
        rightInset: row.right - pairBounds.at(-1).bounds.right,
        centerOffset:
          (pairBounds[0].bounds.left + pairBounds.at(-1).bounds.right) / 2 -
          (row.left + row.right) / 2,
      };
    });
  for (const { gap } of switchLayout.pairBounds) {
    expect(gap).toBeGreaterThanOrEqual(6);
    expect(gap).toBeLessThanOrEqual(12);
  }
  for (const { bounds } of switchLayout.pairBounds) {
    expect(bounds.height).toBeGreaterThanOrEqual(44);
  }
  expect(switchLayout.leftInset).toBeGreaterThanOrEqual(6);
  expect(switchLayout.leftInset).toBeLessThanOrEqual(12);
  expect(switchLayout.rightInset).toBeGreaterThanOrEqual(6);
  expect(switchLayout.rightInset).toBeLessThanOrEqual(12);
  expect(Math.abs(switchLayout.centerOffset)).toBeLessThanOrEqual(1);

  await page.setViewportSize({ width: 700, height: 900 });
  await expect(panel).toBeVisible();
  await expectMobileRibbonFramed(page);
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

test('production geometry enforces 2.5 mm printable margins and circular bounds', async ({
  page,
}) => {
  await page.goto('/studio/', { waitUntil: 'networkidle' });
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

test('printable guides stay contextual and never enter the final preview', async ({
  page,
}, testInfo) => {
  const runtimeErrors = watchRuntimeErrors(page);
  await page.goto('/studio/', { waitUntil: 'networkidle' });

  const guide = page.locator(
    testInfo.project.name === 'mobile'
      ? '.mobile-products-printable-guide.ribbon-guide'
      : '#ribbonPrintableGuide',
  );
  const guideColorTarget =
    testInfo.project.name === 'mobile'
      ? guide
      : page.locator('#ribbonPrintableGuide rect');
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
  await expect(guide).toHaveCSS('opacity', '1');
  await expectShowcaseGuideOpacity('1');
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
  await expect(guide).toHaveCSS('opacity', '1');
  await expectShowcaseGuideOpacity('1');
  await expect(guideColorTarget).toHaveCSS(
    testInfo.project.name === 'mobile' ? 'border-top-color' : 'stroke',
    'rgba(190, 56, 65, 0.82)',
  );

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
  await page.goto('/studio/', { waitUntil: 'networkidle' });
  await completeFirstStepWithText(page);
  await page.locator('.nav-item[data-panel="settings"]').click();
  await ensureProductSettingsVisible(page, 'sticker');

  const option = page.locator('#stickerSizeChoice button[data-value="25"]');
  await expect(option).toBeVisible();
  await option.click();
  await expect(page.locator('#stickerSizeLabel')).toHaveText('Ø25 мм');
  await expect(page.locator('body')).toHaveAttribute('data-sticker-size', '25');
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
    await page.locator('#sceneTabs button[data-scene="macro"]').click();
    await expect(page.locator('.macro-sticker-printable-guide')).toBeAttached();
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
  await page.goto('/studio/', { waitUntil: 'networkidle' });

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
  expect(metrics.stickerTextFill).toBeGreaterThanOrEqual(0.75);
  expect(metrics.stickerGap).toBeLessThanOrEqual(0.04);
  expect(metrics.stickerGroupCenter).toBeCloseTo(metrics.stickerCenter, 5);
  await expectNoHorizontalOverflow(page);
});

test('uploaded wide logo paints at the full ribbon safe height on mobile', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile');

  await page.goto('/studio/', { waitUntil: 'networkidle' });
  await page.locator('#logoInput').setInputFiles({
    name: 'wide-logo.svg',
    mimeType: 'image/svg+xml',
    buffer: Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 100">' +
        '<rect width="400" height="100" fill="#111"/></svg>',
    ),
  });
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
}, testInfo) => {
  const fullText = 'Название бренда для упаковки';
  await page.goto('/studio/', { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.locator('#repeatMm').evaluate((element) => {
    element.value = '40';
    element.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.locator('#textInput').fill(fullText);

  const card = page.locator(
    testInfo.project.name === 'mobile'
      ? '.ribbon-overflow-card-mobile'
      : '.ribbon-overflow-card-desktop',
  );
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
  const clippedPreview =
    testInfo.project.name === 'mobile'
      ? page.locator('.mobile-products-ribbon-text')
      : page
          .locator('[data-product-type="ribbon"] .dynamic-showcase-text')
          .first();
  await expect(clippedPreview).toHaveText(before.layout.previewText);
  await expect(page.locator('#downloadOrder')).toBeDisabled();

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
  await expect(page.locator('#downloadOrder')).toBeEnabled();
  await expectNoHorizontalOverflow(page);
});

test('demo and uploaded logos remain visible when the inscription grows', async ({
  page,
}, testInfo) => {
  const fullText = 'Название бренда для упаковки';
  const card = page.locator(
    testInfo.project.name === 'mobile'
      ? '.ribbon-overflow-card-mobile'
      : '.ribbon-overflow-card-desktop',
  );
  await page.goto('/studio/', { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.locator('#textInput').fill(fullText);
  await page.locator('#fontSize').evaluate((element) => {
    element.value = '64';
    element.dispatchEvent(new Event('input', { bubbles: true }));
  });

  await expect(page.locator('body')).toHaveAttribute(
    'data-preview-logo-demo',
    'true',
  );
  await expect(page.locator('#macroLogoImage')).not.toHaveAttribute(
    'hidden',
    '',
  );
  if (testInfo.project.name === 'mobile') {
    await expect(page.locator('.mobile-products-ribbon-logo')).toBeVisible();
  }
  await expect(card).toBeVisible();
  await expect(card.locator('[data-ribbon-overflow-logo]')).toBeVisible();

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
  expect(result.preview.logoBox).not.toBeNull();
  expect(result.preview.overflow.fullLayout.logoBox).not.toBeNull();
  expect(result.production.logoBox).toBeNull();
  expect(result.content.logo.common).toBeNull();
  expect(result.serialized).not.toContain('<image');

  const demoSrc = await page.locator('#macroLogoImage').getAttribute('src');
  await page.locator('#logoInput').setInputFiles(fixturePath('test-logo.svg'));
  await expect(page.locator('#fileCardName')).toHaveText('test-logo.svg');
  await expect(page.locator('body')).toHaveAttribute(
    'data-preview-logo-demo',
    'false',
  );
  await expect
    .poll(() => page.locator('#macroLogoImage').getAttribute('src'))
    .not.toBe(demoSrc);
  await expect(card.locator('[data-ribbon-overflow-logo]')).toBeVisible();

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
  expect(result.preview.logoBox).not.toBeNull();
  expect(result.preview.overflow.fullLayout.logoBox).not.toBeNull();
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
}, testInfo) => {
  await page.goto('/studio/', { waitUntil: 'networkidle' });
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
  await expect(page.locator('#downloadOrder')).toBeDisabled();
  if (testInfo.project.name === 'mobile') {
    await expect(page.locator('.mobile-products-ribbon-text')).toBeVisible();
    await expect(page.locator('.mobile-products-ribbon-text')).toHaveText(/…$/);
  } else {
    await expect(page.locator('.mobile-products-ribbon-text')).toBeHidden();
    await expect(
      page
        .locator('[data-product-type="ribbon"] .dynamic-showcase-text')
        .first(),
    ).toHaveText(/…$/);
  }
  await expect(page.locator('.mobile-products-sticker-text')).toBeHidden();
  const overflowCard = page.locator(
    testInfo.project.name === 'mobile'
      ? '.ribbon-overflow-card-mobile'
      : '.ribbon-overflow-card-desktop',
  );
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
  await expect(page.locator('#downloadOrder')).toBeEnabled();
  await expect(overflowCard).toBeHidden();
});

test('effective layout is shared with macro and mobile and sticker boxes pass corner validation', async ({
  page,
}) => {
  await page.goto('/studio/', { waitUntil: 'networkidle' });
  await page.locator('#logoInput').setInputFiles(fixturePath('test-logo.svg'));
  await page.locator('#textInput').fill('коротко');
  await page
    .locator('#stickerSizeChoice button[data-value="25"]')
    .evaluate((button) => button.click());

  const result = await page.evaluate(() => {
    const layouts = JSON.parse(document.body.dataset.studioLayout);
    const macroRibbon = JSON.parse(
      document.querySelector('#macroLogo').dataset.layout,
    );
    const macroSticker = JSON.parse(
      document.querySelector('.macro-sticker-paper').dataset.layout,
    );
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
      macroRibbon,
      macroSticker,
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
  expect(result.macroRibbon).toEqual(result.layouts.ribbon);
  expect(result.mobileRibbon).toEqual(result.layouts.ribbon);
  expect(result.macroSticker).toEqual(result.layouts.sticker);
  expect(result.mobileSticker).toEqual(result.layouts.sticker);
  expect(result.logoInside).toBe(true);
  expect(result.textInside).toBe(true);
});

test('repeat guides preserve 2.5 mm margins for 40, 100, and 250 mm', async ({
  page,
}) => {
  await page.goto('/studio/', { waitUntil: 'networkidle' });
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
