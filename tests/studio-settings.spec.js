import { expect, test } from '@playwright/test';
import {
  completeFirstStepWithText,
  expectNoHorizontalOverflow,
  fixturePath,
  openSettings,
  watchRuntimeErrors,
} from './helpers/studio.js';

test('product samples reveal independent ribbon and sticker settings @smoke', async ({
  page,
}) => {
  const runtimeErrors = watchRuntimeErrors(page);
  await page.goto('/studio/?product=set', { waitUntil: 'networkidle' });
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
  await expect(ribbonSample).toBeVisible();
  await expect(stickerSample).toBeVisible();
  await expect(page.locator('[data-transform-kind="text"]')).toBeVisible();
  await expect(page.locator('[data-transform-kind="logo"]')).toBeHidden();
  await expect(page.locator('#editSettingsLogo')).toHaveText(
    'Добавить логотип',
  );
  await expect(page.locator('#fontSelect')).toHaveJSProperty(
    'tagName',
    'SELECT',
  );
  await expect(page.locator('#fontPickerPreview')).toHaveText('Мой бренд');
  await page.locator('#fontPickerTrigger').click();
  await expect(page.locator('#fontPickerList')).toBeVisible();
  await expect(page.locator('#fontPickerList [role="option"]')).toHaveCount(13);
  expect(
    await page
      .locator('.font-picker-option [data-font-sample]')
      .allTextContents(),
  ).toEqual(Array(13).fill('Мой бренд'));
  expect(
    await page.evaluate(async () => {
      const families = [
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
      const loaded = await Promise.all(
        families.map((family) =>
          document.fonts.load(`700 20px "${family}"`, 'Мой бренд'),
        ),
      );
      return loaded.every((faces) => faces.length > 0);
    }),
  ).toBe(true);
  await expect(page.locator('#printColorSelect')).toHaveJSProperty(
    'tagName',
    'SELECT',
  );
  await expect(page.locator('#ribbonColorSelect')).toHaveJSProperty(
    'tagName',
    'SELECT',
  );
  await expect(panel.locator('.mobile-products-ribbon-text-zone')).toHaveCSS(
    'border-left-width',
    '0px',
  );

  await stickerSample.click();
  await expect(stickerSample).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#activeSettingsTitle')).toHaveText('Стикер');
  await expect(page.locator('#mobileTextEditor')).toBeHidden();
  await expect(page.locator('#mobileLogoEditor')).toBeHidden();
  await expect(
    panel.locator('[data-mobile-products-safe-zone="ribbon-logo"]'),
  ).toHaveAttribute('aria-label', 'Настроить ленту');
  const hoverAction = panel
    .locator('[data-mobile-products-safe-zone="ribbon-logo"]')
    .locator('.mobile-products-zone-action');
  await panel.locator('[data-mobile-products-safe-zone="ribbon-logo"]').hover();
  await expect(hoverAction).toBeHidden();
  await panel.locator('[data-mobile-products-safe-zone="ribbon-logo"]').click();
  await expect(ribbonSample).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#activeSettingsTitle')).toHaveText('Лента');

  const stickerSurface = panel.locator('.mobile-products-sticker-sample');
  const stickerBounds = await stickerSurface.boundingBox();
  await stickerSurface.click({
    position: { x: 4, y: stickerBounds.height / 2 },
  });
  await expect(page.locator('#activeSettingsTitle')).toHaveText('Стикер');
  const ribbonSurface = panel.locator('.mobile-products-ribbon-sample');
  const ribbonBounds = await ribbonSurface.boundingBox();
  await ribbonSurface.click({
    position: { x: ribbonBounds.width - 4, y: ribbonBounds.height / 2 },
  });
  await expect(page.locator('#activeSettingsTitle')).toHaveText('Лента');

  await page.locator('#fontPickerTrigger').click();
  await page
    .locator('#fontPickerList')
    .getByRole('option', { name: 'Pacifico' })
    .click();
  await expect(page.locator('#fontSelect')).toHaveValue('Pacifico');
  await expect(page.locator('#fontPickerPreview')).toHaveCSS(
    'font-family',
    'Pacifico',
  );
  await page.locator('#printColorSelect').selectOption('#b69249');
  await page.locator('#ribbonColorSelect').selectOption('#b7202d');
  await expect(ribbonText).toHaveCSS('font-family', 'Pacifico');
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
  await expect(page.locator('#layoutModeChoice')).toBeVisible();
  await expect(page.locator('#stickerVariantChoice')).toHaveCount(0);
  await expect(page.locator('#stickerSizeChoice')).toHaveCount(0);
  await expect(page.locator('#fontSelect')).toHaveValue('Manrope');
  await expect(page.locator('#printColorSelect')).toHaveValue('#171717');

  await page.locator('#fontSelect').selectOption('PT Serif');
  await page.locator('#printColorSelect').selectOption('#c6c8cd');
  await expect(stickerText).toHaveCSS('font-family', '"PT Serif"');
  await expect(stickerText).toHaveCSS('color', 'rgb(198, 200, 205)');
  await expect(ribbonText).toHaveCSS('font-family', 'Pacifico');
  await expect(ribbonText).toHaveCSS('color', 'rgb(182, 146, 73)');

  await ribbonSample.click({ position: { x: 4, y: 4 } });
  await expect(page.locator('#fontSelect')).toHaveValue('Pacifico');
  await expect(page.locator('#printColorSelect')).toHaveValue('#b69249');
  await expect(page.locator('#ribbonColorSelect')).toHaveValue('#b7202d');
  await expectNoHorizontalOverflow(page);
  expect(runtimeErrors).toEqual([]);
});

test('settings keep product focus and link back to its content editor', async ({
  page,
}) => {
  const runtimeErrors = watchRuntimeErrors(page);
  await page.goto('/studio/?product=set', { waitUntil: 'networkidle' });
  await completeFirstStepWithText(page);
  await page.locator('#continueUpload').click();

  const stickerSample = page.locator('[data-mobile-product-sample="sticker"]');
  await stickerSample.click({ position: { x: 4, y: 4 } });
  await expect(page.locator('#activeSettingsTitle')).toHaveText('Стикер');
  await expect(page.locator('#settingsContentStatus')).toHaveText(
    'общая надпись · логотип не добавлен',
  );

  await page.locator('#editSettingsText').click();
  await expect(page.locator('body')).toHaveAttribute(
    'data-active-panel',
    'upload',
  );
  await expect(page.locator('body')).toHaveAttribute(
    'data-active-content-product',
    'sticker',
  );
  await expect(page.locator('#textInputLabel')).toHaveText(
    'Надпись на стикере',
  );
  await expect(page.locator('#textInput')).toBeFocused();

  await openSettings(page);
  await expect(page.locator('#activeSettingsTitle')).toHaveText('Стикер');
  await page.locator('#editSettingsLogo').click();
  await expect(page.locator('body')).toHaveAttribute(
    'data-active-panel',
    'upload',
  );
  await expect(page.locator('#logoInputLabel')).toHaveText(
    'Логотип на стикере',
  );
  await expect(page.locator('#dropZone')).toBeFocused();
  await expectNoHorizontalOverflow(page);
  expect(runtimeErrors).toEqual([]);
});

test('settings show controls only for content present in the selected product @smoke', async ({
  page,
}) => {
  await page.goto('/studio/?product=set', { waitUntil: 'networkidle' });
  await page.locator('#logoInput').setInputFiles(fixturePath('test-logo.svg'));
  await page.locator('#continueUpload').click();

  await expect(page.locator('#settingsContentStatus')).toContainText(
    'надпись не добавлена',
  );
  await expect(page.locator('#fontPicker')).toBeHidden();
  await expect(page.locator('#fontSize')).toBeHidden();
  await expect(page.locator('[data-transform-kind="text"]')).toBeHidden();
  await expect(page.locator('[data-transform-kind="logo"]')).toBeVisible();
  await expect(page.locator('#editSettingsText')).toHaveText(
    'Добавить надпись',
  );
  await expect(page.locator('#editSettingsLogo')).toHaveText(
    'Заменить логотип',
  );

  await page.locator('#editSettingsText').click();
  await expect(page.locator('#textInput')).toBeFocused();
  await page.locator('#textInput').fill('Мой бренд');
  await page.locator('#continueUpload').click();

  await expect(page.locator('#fontPicker')).toBeVisible();
  await expect(page.locator('#fontSize')).toBeVisible();
  await expect(page.locator('[data-transform-kind="text"]')).toBeVisible();
  await expect(page.locator('[data-transform-kind="logo"]')).toBeVisible();
  await expect(page.locator('#editSettingsText')).toHaveText(
    'Изменить надпись',
  );
});

test('selected product owns the visible settings and manual transforms', async ({
  page,
}, testInfo) => {
  const runtimeErrors = watchRuntimeErrors(page);
  await page.goto('/studio/?product=set', { waitUntil: 'networkidle' });
  await page.locator('#textInput').fill('Мой бренд');
  await page.locator('#logoInput').setInputFiles(fixturePath('test-logo.svg'));
  await page.locator('#continueUpload').click();

  const panel = page.locator('.mobile-products-panel');
  const ribbonSample = panel.locator('[data-mobile-product-sample="ribbon"]');
  const stickerSample = panel.locator('[data-mobile-product-sample="sticker"]');
  const readStyles = () =>
    page
      .locator('body')
      .evaluate((body) => JSON.parse(body.dataset.studioProductStyles || '{}'));
  const readLayout = () =>
    page
      .locator('body')
      .evaluate((body) => JSON.parse(body.dataset.studioLayout || '{}'));
  const setRange = (selector, value) =>
    page.locator(selector).evaluate((input, nextValue) => {
      input.value = String(nextValue);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }, value);

  await expect(panel).toHaveAttribute('data-mode', 'settings');
  await expect(
    page.locator(
      `[data-products-host="${testInfo.project.name === 'desktop' ? 'desktop' : 'settings'}"] #mobileProductsSlot`,
    ),
  ).toHaveCount(1);
  await expect(page.locator('[data-settings-product="ribbon"]')).toBeVisible();
  await expect(page.locator('[data-settings-product="sticker"]')).toBeHidden();
  await expect(page.locator('#fontSelectLabel')).toContainText('ленте');
  await expect(
    page.locator('#layoutModeChoice [data-value="auto"]'),
  ).toHaveClass(/active/);
  await expect(page.locator('#logoOffsetY')).toBeDisabled();
  await expect(page.locator('.mobile-products-ribbon-text')).toHaveCSS(
    'color',
    'rgb(23, 23, 23)',
  );
  await expect
    .poll(async () => {
      const src = await page
        .locator('#ribbonContent image')
        .first()
        .getAttribute('href');
      return src ? Buffer.from(src.split(',')[1], 'base64').toString() : '';
    })
    .toContain('#171717');
  await page.locator('#printColorSelect').selectOption('#b69249');
  await expect(page.locator('.mobile-products-ribbon-text')).toHaveCSS(
    'color',
    'rgb(182, 146, 73)',
  );
  await expect
    .poll(async () => {
      const src = await page
        .locator('#ribbonContent image')
        .first()
        .getAttribute('href');
      return src ? Buffer.from(src.split(',')[1], 'base64').toString() : '';
    })
    .toContain('#b69249');
  await page.locator('#printColorSelect').selectOption('#171717');

  const automaticRibbon = (await readLayout()).ribbon;
  const initialRepeat = Number(
    await page.locator('body').getAttribute('data-ribbon-repeat-mm'),
  );
  const manualRepeat = Math.min(250, initialRepeat + 30);
  await page.locator('#layoutModeChoice [data-value="manual"]').click();
  await expect(page.locator('#logoOffsetY')).toBeEnabled();
  await setRange('#repeatMm', manualRepeat);
  const intervalRibbon = (await readLayout()).ribbon;
  const automaticTextOffsetMm =
    (automaticRibbon.textBox.x + automaticRibbon.textBox.width / 2 - 0.5) *
    initialRepeat;
  const intervalTextOffsetMm =
    (intervalRibbon.textBox.x + intervalRibbon.textBox.width / 2 - 0.5) *
    manualRepeat;
  expect(intervalTextOffsetMm).toBeCloseTo(automaticTextOffsetMm, 1);
  await setRange('#logoScale', 60);
  await setRange('#logoOffsetY', 40);
  await setRange('#textOffsetY', -25);
  await setRange('#fontSize', 40);

  let styles = await readStyles();
  expect(styles.ribbon).toMatchObject({
    layoutMode: 'manual',
    logoScale: 0.6,
    logoOffsetY: 40,
    textOffsetX: 0,
    textOffsetY: -25,
    fontSize: 40,
  });
  expect(styles.sticker.layoutMode).toBe('auto');
  await expect(page.locator('body')).toHaveAttribute(
    'data-ribbon-repeat-mm',
    String(manualRepeat),
  );
  const manualRibbon = (await readLayout()).ribbon;
  expect(manualRibbon.logoBox.y).not.toBe(automaticRibbon.logoBox.y);
  expect(manualRibbon.logoBox.x).toBeGreaterThanOrEqual(
    manualRibbon.printable.x - 0.001,
  );
  expect(manualRibbon.logoBox.y).toBeGreaterThanOrEqual(
    manualRibbon.printable.y - 0.001,
  );

  if (testInfo.project.name === 'mobile') {
    const mobileGeometry = await panel
      .locator('.mobile-products-ribbon-sample')
      .evaluate((surface) => {
        const interaction = surface.querySelector(
          '.mobile-products-ribbon-interaction-cell',
        );
        const interactionBounds = interaction.getBoundingClientRect();
        const normalize = (selector) => {
          const bounds = surface
            .querySelector(selector)
            .getBoundingClientRect();
          return {
            x: (bounds.left - interactionBounds.left) / interactionBounds.width,
            y: (bounds.top - interactionBounds.top) / interactionBounds.height,
            width: bounds.width / interactionBounds.width,
            height: bounds.height / interactionBounds.height,
          };
        };
        const layout = JSON.parse(surface.dataset.layout);
        return {
          layout,
          logo: normalize('[data-mobile-products-safe-zone="ribbon-logo"]'),
          text: normalize('[data-mobile-products-safe-zone="ribbon-text"]'),
          logoArtwork: normalize('.mobile-products-ribbon-logo'),
          textArtwork: normalize('.mobile-products-ribbon-text'),
        };
      });

    const center = (box, axis, size) => box[axis] + box[size] / 2;
    for (const [kind, mask, artwork, layoutBox] of [
      [
        'logo',
        mobileGeometry.logo,
        mobileGeometry.logoArtwork,
        mobileGeometry.layout.logoBox,
      ],
      [
        'text',
        mobileGeometry.text,
        mobileGeometry.textArtwork,
        mobileGeometry.layout.textBox,
      ],
    ]) {
      expect(center(mask, 'x', 'width')).toBeCloseTo(
        center(layoutBox, 'x', 'width'),
        2,
      );
      expect(center(mask, 'y', 'height')).toBeCloseTo(
        center(layoutBox, 'y', 'height'),
        2,
      );
      if (kind === 'logo') {
        expect(mask.width).toBeCloseTo(artwork.width, 2);
        expect(mask.height).toBeCloseTo(artwork.height, 2);
      } else {
        expect(mask.width).toBeLessThanOrEqual(artwork.width + 0.01);
        expect(mask.height).toBeLessThanOrEqual(artwork.height + 0.01);
        expect(mask.height).toBeGreaterThan(0);
      }
    }
  }

  await stickerSample.click({ position: { x: 4, y: 4 } });
  await expect(page.locator('[data-settings-product="ribbon"]')).toBeHidden();
  await expect(page.locator('#layoutModeChoice')).toBeVisible();
  await expect(page.locator('#stickerVariantChoice')).toHaveCount(0);
  await expect(page.locator('#stickerSizeChoice')).toHaveCount(0);
  await expect(page.locator('#fontSelectLabel')).toContainText('стикере');
  await expect(
    page.locator('#layoutModeChoice [data-value="auto"]'),
  ).toHaveClass(/active/);
  const automaticSticker = (await readLayout()).sticker;
  await page.locator('#layoutModeChoice [data-value="manual"]').click();
  const preservedSticker = (await readLayout()).sticker;
  for (const kind of ['logoBox', 'textBox']) {
    expect(preservedSticker[kind].x).toBeCloseTo(automaticSticker[kind].x, 2);
    expect(preservedSticker[kind].y).toBeCloseTo(automaticSticker[kind].y, 2);
    expect(preservedSticker[kind].width).toBeCloseTo(
      automaticSticker[kind].width,
      2,
    );
    expect(preservedSticker[kind].height).toBeCloseTo(
      automaticSticker[kind].height,
      2,
    );
  }
  await setRange('#textOffsetY', -30);
  await setRange('#logoOffsetX', 25);
  styles = await readStyles();
  expect(styles.sticker).toMatchObject({
    layoutMode: 'manual',
    textOffsetY: -30,
    logoOffsetX: 25,
  });
  expect(styles.ribbon.logoOffsetY).toBe(40);

  await ribbonSample.click({ position: { x: 4, y: 4 } });
  await expect(page.locator('#logoOffsetY')).toHaveValue('40');
  await expect(page.locator('#repeatMm')).toHaveValue(String(manualRepeat));
  await expect(
    page.locator('[data-transform-axis="horizontal"]').first(),
  ).toBeHidden();

  if (testInfo.project.name === 'mobile') {
    const isFloating = await panel.evaluate((element) =>
      element.classList.contains('is-floating'),
    );
    if (
      isFloating &&
      !(await panel.evaluate((element) =>
        element.classList.contains('is-expanded'),
      ))
    ) {
      await page.locator('#mobileProductsDockToggle').click();
      await expect(panel).toHaveClass(/is-expanded/);
    }
    await panel.evaluate((element) =>
      Promise.all(
        element
          .getAnimations({ subtree: true })
          .map((animation) => animation.finished.catch(() => undefined)),
      ),
    );
    const logoZone = panel.locator(
      '[data-mobile-products-safe-zone="ribbon-logo"]',
    );
    await expect(logoZone).toBeVisible();
    const dragBaseline = 120;
    await setRange('#repeatMm', dragBaseline);
    await expect(page.locator('body')).toHaveAttribute(
      'data-ribbon-repeat-mm',
      String(dragBaseline),
    );
    const repeatBeforeDrag = Number(
      await page.locator('body').getAttribute('data-ribbon-repeat-mm'),
    );
    const bounds = await logoZone.boundingBox();
    await page.mouse.move(
      bounds.x + bounds.width / 2,
      bounds.y + bounds.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(
      bounds.x + bounds.width / 2 + 18,
      bounds.y + bounds.height / 2 + 5,
      { steps: 4 },
    );
    await page.mouse.up();
    await expect
      .poll(async () =>
        Number(
          await page.locator('body').getAttribute('data-ribbon-repeat-mm'),
        ),
      )
      .toBe(repeatBeforeDrag);
    expect((await readStyles()).ribbon.logoOffsetX).toBe(0);
  }

  await expectNoHorizontalOverflow(page);
  expect(runtimeErrors).toEqual([]);
});

test('product switches control the unified preview', async ({ page }) => {
  const runtimeErrors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') runtimeErrors.push(message.text());
  });
  page.on('pageerror', (error) => runtimeErrors.push(error.message));

  await page.goto('/studio/?product=set', { waitUntil: 'networkidle' });

  const panel = page.locator('.mobile-products-panel');
  const ribbonSwitch = page.getByRole('switch', { name: 'Лента' });
  const stickerSwitch = page.getByRole('switch', { name: 'Стикер' });
  const ribbonSample = page.locator('[data-mobile-product-sample="ribbon"]');
  const stickerSample = page.locator('[data-mobile-product-sample="sticker"]');

  await expect(panel).toBeVisible();
  await expect(ribbonSwitch).toBeChecked();
  await expect(stickerSwitch).toBeChecked();
  await expect(ribbonSample).toBeVisible();
  await expect(stickerSample).toBeHidden();

  await ribbonSwitch.uncheck();
  await expect(ribbonSample).toBeHidden();
  await expect(ribbonSample).toHaveClass(/is-product-disabled/);
  await expect(stickerSample).toBeVisible();
  await expect(page.locator('body')).toHaveAttribute(
    'data-active-content-product',
    'sticker',
  );
  await expect(page.locator('body')).toHaveAttribute(
    'data-has-ribbon',
    'false',
  );
  await stickerSwitch.uncheck();
  await expect(stickerSwitch).not.toBeChecked();
  await expect(ribbonSwitch).toBeChecked();

  await stickerSwitch.check();
  await completeFirstStepWithText(page);
  await openSettings(page);
  await expect(ribbonSwitch).toBeChecked();
  await expect(stickerSwitch).toBeChecked();

  await ribbonSwitch.uncheck();
  await expect(ribbonSample).toBeVisible();
  await expect(ribbonSample).toHaveClass(/is-product-disabled/);
  await expect(stickerSample).toBeVisible();

  await stickerSwitch.uncheck();
  await expect(stickerSwitch).not.toBeChecked();
  await expect(ribbonSwitch).toBeChecked();
  await expect(stickerSample).toBeVisible();
  await expect(stickerSample).toHaveClass(/is-product-disabled/);
  await expect(ribbonSample).toBeVisible();

  await ribbonSwitch.uncheck();
  await expect(ribbonSwitch).not.toBeChecked();
  await expect(stickerSwitch).toBeChecked();
  await expect(ribbonSample).toBeVisible();
  await expect(ribbonSample).toHaveClass(/is-product-disabled/);
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

test('product switches control order quantities and price @smoke', async ({
  page,
}) => {
  const runtimeErrors = watchRuntimeErrors(page);
  await page.goto('/studio/?product=set', { waitUntil: 'networkidle' });
  await completeFirstStepWithText(page);
  await openSettings(page);

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

  await page.locator('.nav-item[data-panel="settings"]').click();
  await ribbonSwitch.uncheck();
  await page.locator('.nav-item[data-panel="order"]').click();
  await expect(meters).toHaveValue('0');
  await expect(meters).toBeEnabled();
  await expect(stickerQty).toHaveValue('250');
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
  await openSettings(page);
  await expect(ribbonSwitch).not.toBeChecked();
  await expect(stickerSwitch).toBeChecked();
  await expect(meters).toHaveValue('0');
  await ribbonSwitch.check();
  await page.locator('.nav-item[data-panel="order"]').click();
  await expect(meters).toHaveValue('25');
  await expect(meters).toBeEnabled();
  await expect(totalPrice).toHaveText(/1\s940\s₽/);

  await page.locator('.nav-item[data-panel="settings"]').click();
  await stickerSwitch.uncheck();
  await page.locator('.nav-item[data-panel="order"]').click();
  await expect(stickerQty).toHaveValue('0');
  await expect(stickerQty).toBeEnabled();
  await expect(meters).toHaveValue('25');
  await expect(totalPrice).toHaveText(/590\s₽/);
  await expect(page.locator('body')).toHaveAttribute('data-has-ribbon', 'true');
  await expect(page.locator('body')).toHaveAttribute(
    'data-has-sticker',
    'false',
  );

  await page.reload({ waitUntil: 'networkidle' });
  await openSettings(page);
  await expect(ribbonSwitch).toBeChecked();
  await expect(stickerSwitch).not.toBeChecked();
  await stickerSwitch.check();
  await page.locator('.nav-item[data-panel="order"]').click();
  await expect(stickerQty).toHaveValue('250');
  await expect(stickerQty).toBeEnabled();
  await expect(totalPrice).toHaveText(/1\s940\s₽/);

  await page.locator('.nav-item[data-panel="settings"]').click();
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

test('order quantities control, protect, and persist product selection', async ({
  page,
}) => {
  const runtimeErrors = watchRuntimeErrors(page);
  await page.goto('/studio/?product=set', { waitUntil: 'networkidle' });
  await completeFirstStepWithText(page);
  await page.locator('.nav-item[data-panel="order"]').click();

  const body = page.locator('body');
  const meters = page.locator('#meters');
  const stickerQty = page.locator('#stickerQty');
  const totalPrice = page.locator('#totalPrice');
  const ribbonSwitch = page.getByRole('switch', { name: 'Лента' });
  const stickerSwitch = page.getByRole('switch', { name: 'Стикер' });
  const notice = page.locator('#orderProductNotice');

  await expect(page.locator('.order-card')).toHaveCount(0);
  await expect(page.locator('.mobile-products-panel')).toHaveAttribute(
    'data-mode',
    'order',
  );
  const stickerSurface = page.locator('.mobile-products-sticker-sample');
  await stickerSurface.hover();
  await expect(
    stickerSurface.locator('.mobile-products-zone-action').first(),
  ).toBeHidden();
  await expect(stickerSurface).toHaveCSS('outline-style', 'none');
  await expect(stickerSurface).toHaveCSS('cursor', 'default');
  await expect(notice).toHaveText(
    'В заказе должен остаться хотя бы один продукт.',
  );
  await expect(notice).toBeHidden();

  await meters.selectOption('25');
  await stickerQty.selectOption('250');
  await expect(totalPrice).toHaveText(/1\s940\s₽/);

  await meters.selectOption('0');
  await expect(meters).toHaveValue('0');
  await expect(totalPrice).toHaveText(/1\s350\s₽/);
  await expect(ribbonSwitch).not.toBeChecked();
  await expect(stickerSwitch).toBeChecked();
  await expect(notice).toBeHidden();
  await expect(body).toHaveAttribute('data-has-ribbon', 'false');
  await expect(body).toHaveAttribute('data-has-sticker', 'true');

  await stickerQty.selectOption('0');
  await expect(stickerQty).toHaveValue('250');
  await expect(notice).toBeVisible();
  await expect(stickerSwitch).toBeChecked();

  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('.nav-item[data-panel="order"]').click();
  await expect(meters).toHaveValue('0');
  await expect(stickerQty).toHaveValue('250');
  await expect(ribbonSwitch).not.toBeChecked();
  await expect(stickerSwitch).toBeChecked();

  await meters.selectOption('25');
  await expect(ribbonSwitch).toBeChecked();
  await expect(totalPrice).toHaveText(/1\s940\s₽/);

  await expectNoHorizontalOverflow(page);
  expect(runtimeErrors).toEqual([]);
});

test('order dialog sends production files, retries safely and keeps a local copy @smoke', async ({
  page,
}) => {
  test.setTimeout(60_000);
  const runtimeErrors = watchRuntimeErrors(page);
  const requests = [];
  await page.route('**/api/orders/', async (route) => {
    requests.push(route.request().postDataJSON());
    if (requests.length === 1) {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'rejected',
          code: 'receiver_unavailable',
          message: 'Временная ошибка',
        }),
      });
      return;
    }
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'accepted',
        orderId: 'PM-20260812-ABCDEF01',
        acceptedAt: '2026-08-12T10:00:00Z',
        duplicate: false,
      }),
    });
  });
  await page.goto('/studio/?product=set', { waitUntil: 'networkidle' });
  await completeFirstStepWithText(page);
  await page.locator('#continueUpload').click();
  await page.locator('#panel-settings .next-panel').click();

  const openOrder = page.locator('#openOrder');
  await expect(openOrder).toHaveText('Перейти к отправке');
  await openOrder.click();

  const dialog = page.getByRole('dialog', { name: 'Отправить заявку' });
  const customerName = page.getByLabel('Имя');
  const phonePreference = page.getByLabel('Позвонить');
  const customerPhone = page.getByLabel('Ваш телефон');
  const submitOrder = page.getByRole('button', { name: 'Отправить заявку' });
  await expect(dialog).toBeVisible();
  await expect(customerName).toBeFocused();

  await customerName.fill('Максим');
  await submitOrder.click();
  await expect(page.locator('#orderFormStatus')).toHaveText(
    'Выберите удобный способ связи.',
  );
  await expect(phonePreference).toBeFocused();

  await phonePreference.check();
  await expect(customerPhone).toBeVisible();
  await customerPhone.fill('+7 900 000-00-00');
  await submitOrder.click();
  await expect(page.locator('#orderFormStatus')).toContainText(
    'Не удалось отправить заявку.',
  );
  expect(runtimeErrors).toEqual([
    expect.stringContaining('server responded with a status of 503'),
  ]);
  runtimeErrors.length = 0;
  await expect(
    page.getByRole('button', { name: 'Повторить отправку' }),
  ).toBeEnabled();

  await page.getByRole('button', { name: 'Повторить отправку' }).click();
  await expect(page.locator('#orderFormStatus')).toContainText(
    'Заявка PM-20260812-ABCDEF01 принята.',
  );
  await expect(
    page.getByRole('button', { name: 'Заявка отправлена' }),
  ).toBeDisabled();
  expect(requests).toHaveLength(2);
  expect(requests[0].requestId).toBe(requests[1].requestId);
  expect(requests[1].artifacts.ribbonSvg).toContain('<svg');
  expect(requests[1].artifacts.stickerSvg).toContain('<svg');
  expect(requests[1].customer.preferredContact).toBe('phone');

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Скачать копию' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('zayavka-pm-20260812-abcdef01.txt');

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(openOrder).toBeFocused();
  await expectNoHorizontalOverflow(page);
  expect(runtimeErrors).toEqual([]);
});
