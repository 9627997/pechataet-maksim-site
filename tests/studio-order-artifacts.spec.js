import { expect, test } from '@playwright/test';
import {
  completeFirstStepWithText,
  openSettings,
  watchRuntimeErrors,
} from './helpers/studio.js';

// Регрессии цепочки заявки:
// 1) PNG-превью артефактов рендерятся из production-SVG (без preview-
//    оверлеев, с встроенными шрифтами) — иначе в Drive/Telegram уходят
//    «чёрная полоса» вместо ленты и пустой круг вместо стикера.
// 2) Дефолт печати стикера контрастен тёмному фону (серебро, не чёрный).

const rasterizeBoth = (page) =>
  page.evaluate(async () => {
    const toDataUrl = (url) =>
      fetch(url)
        .then((response) => (response.ok ? response.blob() : ''))
        .then(
          (blob) =>
            blob &&
            new Promise((resolve) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result);
              reader.onerror = () => resolve('');
              reader.readAsDataURL(blob);
            }),
        )
        .catch(() => '');
    const manrope = await toDataUrl('/fonts/manrope-variable.woff2');
    const geometry = window.RibbonStudioGeometry;
    const analyze = (dataUrl) =>
      new Promise((resolve) => {
        const image = new Image();
        image.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = image.width;
          canvas.height = image.height;
          const context = canvas.getContext('2d');
          context.drawImage(image, 0, 0);
          const { data } = context.getImageData(
            0,
            0,
            canvas.width,
            canvas.height,
          );
          // Считаем пиксели только внутри полосы ленты / центральной полосы
          // стикера — там, где должен быть текст. Полный холст не подходит:
          // кремовый фон холста маскирует чёрный оверлей среднего бага.
          const rows = (y0, y1) => {
            let light = 0;
            let mid = 0;
            let total = 0;
            const top = Math.floor(canvas.height * y0);
            const bottom = Math.floor(canvas.height * y1);
            for (let y = top; y < bottom; y += 1) {
              for (let x = 0; x < canvas.width; x += 2) {
                const index = (y * canvas.width + x) * 4;
                const luminance =
                  0.299 * data[index] +
                  0.587 * data[index + 1] +
                  0.114 * data[index + 2];
                total += 1;
                if (luminance > 200) light += 1;
                // Серебро #c6c8cd (lum ≈ 200) попадает сюда, но не в light.
                if (luminance > 120 && luminance <= 240) mid += 1;
              }
            }
            return { light: light / total, mid: mid / total };
          };
          resolve({
            band: rows(0.35, 0.65),
            center: rows(0.45, 0.55),
          });
        };
        image.onerror = () => resolve(null);
        image.src = dataUrl;
      });
    const ribbonSvg = document.querySelector('#ribbonSvg');
    const stickerSvg = document.querySelector('#stickerSvg');
    const ribbonMarkup = geometry.serializeProductionSvg(ribbonSvg);
    const stickerMarkup = geometry.serializeProductionSvg(stickerSvg);
    const fonts = { Manrope: manrope || '' };
    const [ribbon, sticker] = await Promise.all([
      analyze(await geometry.rasterizeSvgToPngDataUrl(ribbonSvg, { fonts })),
      analyze(await geometry.rasterizeSvgToPngDataUrl(stickerSvg, { fonts })),
    ]);
    return { ribbon, sticker, ribbonMarkup, stickerMarkup };
  });

test('order preview PNGs render production artwork with embedded fonts @smoke', async ({
  page,
}) => {
  const runtimeErrors = watchRuntimeErrors(page);
  await page.goto('/studio/?product=set', { waitUntil: 'networkidle' });
  await completeFirstStepWithText(page);
  await page.locator('#continueUpload').click();
  await openSettings(page);

  const result = await rasterizeBoth(page);
  expect(result.ribbon).not.toBeNull();
  expect(result.sticker).not.toBeNull();

  // Production-разметка не должна тащить preview-оверлеи и гайды: их стили
  // живут на странице, вне её они рисуются чёрными и закрывают текст.
  for (const markup of [result.ribbonMarkup, result.stickerMarkup]) {
    expect(markup).not.toContain('data-preview-overlay');
    expect(markup).not.toContain('ribbonPrintableGuide');
    expect(markup).not.toContain('stickerPrintableGuide');
  }
  // Шрифт должен быть встроен, иначе PNG отрисуется фолбэк-шрифтом.
  expect(result.ribbonMarkup).toContain('Мой бренд');
  for (const markup of [result.ribbonMarkup, result.stickerMarkup]) {
    expect(markup).not.toContain('text-anchor="[object Object]"');
  }

  // Лента: в полосе ленты кремовая основа (светлые пиксели). Если оверлей
  // гайда закроет её чёрной заливкой, светлых пикселей в полосе почти не
  // останется.
  expect(result.ribbon.band.light).toBeGreaterThan(0.5);

  // Стикер: в центральной полосе (где надпись) должны быть пиксели печати.
  // Серебро #c6c8cd не считается «светлым» (lum ≈ 200), поэтому отдельно
  // меряем «средние» пиксели: при потере текста их будет ноль.
  expect(result.sticker.center.mid).toBeGreaterThan(0.02);

  expect(runtimeErrors).toEqual([]);
});

test('sticker default print contrasts dark background @smoke', async ({
  page,
}) => {
  const runtimeErrors = watchRuntimeErrors(page);
  await page.goto('/studio/?product=set', { waitUntil: 'networkidle' });
  await completeFirstStepWithText(page);
  await page.locator('#continueUpload').click();
  await openSettings(page);

  const styles = await page.evaluate(() =>
    JSON.parse(document.body.dataset.studioProductStyles),
  );
  // Чёрная печать на чёрном фоне давала невидимую надпись по умолчанию.
  expect(styles.sticker.print).toBe('#c6c8cd');

  await page
    .locator('#settingsProductSwitch [data-settings-product-choice="sticker"]')
    .click();
  await expect(page.locator('#printColorSelect')).toHaveValue('#c6c8cd');
  expect(runtimeErrors).toEqual([]);
});
