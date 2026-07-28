import { expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';

export const fixturePath = (name) =>
  fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url));

export const watchRuntimeErrors = (page) => {
  const errors = [];
  page.on('console', (message) => {
    if (message.type() === 'error')
      errors.push(`console.error: ${message.text()}`);
  });
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  return errors;
};

export const expectNoHorizontalOverflow = async (page) => {
  const hasOverflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth >
        document.documentElement.clientWidth ||
      document.body.scrollWidth > document.body.clientWidth,
  );
  expect(hasOverflow).toBe(false);
};

export const expectMobilePreviewVisible = async (page) => {
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

export const expectMobileLogosToMatch = async (page, expectedSrc) => {
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

export const expectMobileRibbonFramed = async (page) => {
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

export const expectShowcaseCaptionClear = async (page) => {
  if (!(await page.locator('.studio').isVisible())) return;
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

export const expectInterfaceResponsive = async (page) => {
  if (
    (await page.locator('body').getAttribute('data-active-panel')) !==
    'settings'
  )
    await openSettings(page);
  await ensureProductSettingsVisible(page);
  const ribbonSwitch = page.getByRole('switch', { name: 'Лента' });
  const ribbonSample = page.locator('[data-mobile-product-sample="ribbon"]');
  await ribbonSwitch.uncheck();
  await expect(ribbonSample).toBeHidden();
  await ribbonSwitch.check();
  await expect(ribbonSample).toBeVisible();
};

export const completeFirstStepWithText = async (page) => {
  await page.locator('#textInput').fill('Мой бренд');
  await expect(page.locator('#continueUpload')).toBeEnabled();
};

export const openSettings = async (page) => {
  const settings = page.locator('.nav-item[data-panel="settings"]');
  await expect(settings).toBeEnabled();
  await settings.click();
  await expect(page.locator('#panel-settings')).toBeVisible();
};

export const ensureProductSettingsVisible = async (
  page,
  product = 'ribbon',
) => {
  const panel = page.locator('.mobile-products-panel');
  if (!(await panel.isVisible())) await openSettings(page);
  const sample = panel.locator(`[data-mobile-product-sample="${product}"]`);
  if ((await sample.getAttribute('aria-pressed')) !== 'true') {
    await sample.click({ position: { x: 4, y: 4 } });
  }
  await expect(panel).toBeVisible();
};

export const readContentSnapshot = async (page) =>
  JSON.parse(await page.locator('body').getAttribute('data-studio-content'));

export const readRibbonPreviewText = (page) =>
  page.evaluate(() => {
    const layout = JSON.parse(document.body.dataset.studioLayout).ribbon;
    const content = JSON.parse(document.body.dataset.studioContent);
    return layout.valid
      ? content.text.resolvedRibbon.trim()
      : layout.previewText;
  });

export const expectSvgDataToContain = async (
  locator,
  marker,
  attribute = 'src',
) => {
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

export const setLogoUploadTarget = (page, target) =>
  page.evaluate((nextTarget) => {
    document.dispatchEvent(
      new CustomEvent('studio:logo-upload-target-set', {
        detail: { target: nextTarget },
      }),
    );
  }, target);

export const svgUpload = (name, marker, width = 30, height = 10) => ({
  name,
  mimeType: 'image/svg+xml',
  buffer: Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}"><path id="${marker}" d="M0 0h${width}v${height}H0z"/></svg>`,
  ),
});

export const jpegUpload = {
  name: 'test-logo.jpg',
  mimeType: 'image/jpeg',
  buffer: Buffer.from(
    '/9j/4AAQSkZJRgABAQAASABIAAD/4QBMRXhpZgAATU0AKgAAAAgAAYdpAAQAAAABAAAAGgAAAAAAA6ABAAMAAAABAAEAAKACAAQAAAABAAAADKADAAQAAAABAAAADAAAAAD/wAARCAAMAAwDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9sAQwACAgICAgIDAgIDBQMDAwUGBQUFBQYIBgYGBgYICggICAgICAoKCgoKCgoKDAwMDAwMDg4ODg4PDw8PDw8PDw8P/9sAQwECAgIEBAQHBAQHEAsJCxAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQ/90ABAAB/9oADAMBAAIRAxEAPwD7j/bM8WftLfDfxf4H1X4Y/Eu00HQPHPiDSvDEenTaLbXb2k175nmXZnlJaQDaP3eF9mFfdvgXTPFei+ENK0rxzraeI9ftoFS81GO2WzS6lHWQQISsYP8AdBIrJ8f/AAp+HnxS/sP/AIWBokOtf8I3qMOq6f5xcfZ723z5co2MucZ+62VPcGvQqAP/2Q==',
    'base64',
  ),
};

export const createPdfUpload = () => {
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
