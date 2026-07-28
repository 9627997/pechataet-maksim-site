import { expect, test } from '@playwright/test';
import {
  completeFirstStepWithText,
  createPdfUpload,
  ensureProductSettingsVisible,
  expectInterfaceResponsive,
  expectMobileLogosToMatch,
  expectMobilePreviewVisible,
  expectMobileRibbonFramed,
  expectNoHorizontalOverflow,
  fixturePath,
  jpegUpload,
  openSettings,
  readContentSnapshot,
  readRibbonPreviewText,
  watchRuntimeErrors,
} from './helpers/studio.js';

test('mobile preview safe zones activate the shared logo and text inputs', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile');
  test.setTimeout(60_000);

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
  await expect(page.locator('.mobile-products-ribbon-logo')).toBeHidden();
  await expect(page.locator('.mobile-products-sticker-logo')).toBeHidden();
  await expect(page.locator('.mobile-products-ribbon-text')).toBeHidden();
  await expect(page.locator('.mobile-products-sticker-text')).toBeHidden();
  for (const zone of [zones.ribbonLogo, zones.stickerLogo]) {
    await expect(zone.locator('.mobile-products-zone-action')).toHaveText(
      'Ваш логотип',
    );
  }
  for (const zone of [zones.ribbonText, zones.stickerText]) {
    await expect(zone.locator('.mobile-products-zone-action')).toHaveText(
      'Ваш текст',
    );
  }
  const emptyProduction = await page.evaluate(() => ({
    ribbon: window.RibbonStudioProduction.serialize('ribbon'),
    sticker: window.RibbonStudioProduction.serialize('sticker'),
    content: document.body.dataset.studioContent,
  }));
  expect(JSON.stringify(emptyProduction)).not.toContain('Ваш логотип');
  expect(JSON.stringify(emptyProduction)).not.toContain('Ваш текст');

  await textInput.fill('временная надпись');
  await textInput.fill('');
  for (const zone of [zones.ribbonText, zones.stickerText]) {
    await expect(zone).toBeVisible();
    await expect(zone).toHaveAttribute('aria-label', 'Добавить надпись');
    await expect(zone.locator('.mobile-products-zone-action')).toHaveText(
      'Ваш текст',
    );
    await expect(zone.locator('.mobile-products-zone-action')).toHaveCSS(
      'opacity',
      '1',
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
        zone.evaluate((element) =>
          Number.parseFloat(getComputedStyle(element, '::before').height),
        ),
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

  await expect(stickerLogo).toBeHidden();
  await expect(ribbonText).toBeHidden();
  await expect(stickerText).toBeHidden();
  await expect(stickerContent).toHaveAttribute(
    'data-mobile-products-mode',
    'empty',
  );

  await page.locator('#textInput').fill('новая длинная надпись для упаковки');
  await expect(ribbonText).toBeVisible();
  await expect(stickerText).toBeVisible();
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

test('mobile first reveal keeps the guided preview and switches paired with labels @smoke', async ({
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
  await expectMobileRibbonFramed(page);
  await expect(page.locator('.mobile-products-switches')).toBeVisible();
  await expect(page.locator('.studio')).toBeHidden();
  await completeFirstStepWithText(page);
  await openSettings(page);
  await expect(page.locator('.mobile-products-switches')).toBeVisible();
  await expect(page.locator('.studio')).toBeVisible();

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

test('smart mobile preview dock stays visible across all three steps', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile');

  const runtimeErrors = watchRuntimeErrors(page);
  await page.goto('/studio/', { waitUntil: 'networkidle' });
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
    await expect(page.locator('body')).toHaveAttribute(
      'data-active-panel',
      step,
    );
    const ribbonSwitch = panel.locator('[data-mobile-product="ribbon"]');
    const stickerSwitch = panel.locator('[data-mobile-product="sticker"]');
    await expect(ribbonSwitch).toBeVisible();
    await expect(stickerSwitch).toBeVisible();
    await expect(
      panel.locator('[data-mobile-product-sample="ribbon"]'),
    ).toBeVisible();
    await expect(
      panel.locator('[data-mobile-product-sample="sticker"]'),
    ).toBeVisible();

    const dockBounds = await panel.boundingBox();
    expect(dockBounds).not.toBeNull();
    expect(dockBounds.x).toBeGreaterThanOrEqual(8);
    expect(dockBounds.x + dockBounds.width).toBeLessThanOrEqual(382);
    expect(dockBounds.y).toBeGreaterThanOrEqual(0);
    const viewportHeight = await page.evaluate(() => window.innerHeight);
    expect(dockBounds.y + dockBounds.height).toBeLessThanOrEqual(
      viewportHeight + 2,
    );

    if (isFloating) {
      const toolbarCenters = await panel
        .locator('.mobile-products-switches')
        .evaluate((toolbar) =>
          [
            toolbar.querySelector('.mobile-products-switch:first-child'),
            toolbar.querySelector('.mobile-products-dock-toggle'),
            toolbar.querySelector('.mobile-products-switch:last-child'),
          ].map((element) => {
            const bounds = element.getBoundingClientRect();
            return bounds.top + bounds.height / 2;
          }),
        );
      expect(
        Math.max(...toolbarCenters) - Math.min(...toolbarCenters),
      ).toBeLessThanOrEqual(1);
    }

    if (step === 'upload' && isFloating) {
      await dockToggle.click();
      await expect(panel).toHaveClass(/is-expanded/);
      await expect(dockToggle).toHaveAttribute('aria-expanded', 'true');
      await expect(dockToggle).toContainText('Свернуть');
      await dockToggle.click();
      await expect(panel).not.toHaveClass(/is-expanded/);
      await expect(dockToggle).toHaveAttribute('aria-expanded', 'false');
    }
  }

  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(panel).not.toHaveClass(/is-floating/);
  await expect(panel).toHaveAttribute('data-floating', 'false');
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
