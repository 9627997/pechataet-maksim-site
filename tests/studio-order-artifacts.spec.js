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

// Печатные SVG (Drive/Telegram) собираются buildPrintTile: корневой viewBox
// обязан быть тайл-локальным «0 0 w h». В canvas-координатах вместе с
// translate(-x -y) на inner-g контент уходит за пределы холста: лента
// уходила в печать пустой, стикер — со сдвигом на ~2,5 мм (октябрь 2026).
test('print SVGs render inside their own viewBox @smoke', async ({ page }) => {
  const runtimeErrors = watchRuntimeErrors(page);
  await page.goto('/studio/?product=set', { waitUntil: 'networkidle' });
  await completeFirstStepWithText(page);
  await page.locator('#continueUpload').click();
  await openSettings(page);

  const result = await page.evaluate(async () => {
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
    const repeatMm = Number(document.body.dataset.ribbonRepeatMm);
    const ribbonWidthMm = Number(document.body.dataset.ribbonWidth);
    const fonts = { Manrope: manrope || '' };
    const ribbonPrint = geometry.serializePrintSvg(
      document.querySelector('#ribbonSvg'),
      { widthMm: repeatMm, heightMm: ribbonWidthMm, fonts },
    );
    const stickerPrint = geometry.serializePrintSvg(
      document.querySelector('#stickerSvg'),
      { widthMm: 40, heightMm: 40, fonts },
    );

    const rasterize = (markup) =>
      new Promise((resolve) => {
        const source =
          'data:image/svg+xml;base64,' +
          btoa(unescape(encodeURIComponent(markup)));
        const image = new Image();
        image.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = 900;
          canvas.height = Math.max(
            1,
            Math.round((900 * image.naturalHeight) / image.naturalWidth),
          );
          const context = canvas.getContext('2d');
          context.fillStyle = '#ffffff';
          context.fillRect(0, 0, canvas.width, canvas.height);
          context.drawImage(image, 0, 0, canvas.width, canvas.height);
          const { data } = context.getImageData(
            0,
            0,
            canvas.width,
            canvas.height,
          );
          let dark = 0;
          let sumX = 0;
          let sumY = 0;
          for (let y = 0; y < canvas.height; y += 1) {
            for (let x = 0; x < canvas.width; x += 1) {
              const index = (y * canvas.width + x) * 4;
              if (
                data[index] < 100 &&
                data[index + 1] < 100 &&
                data[index + 2] < 100
              ) {
                dark += 1;
                sumX += x;
                sumY += y;
              }
            }
          }
          resolve({
            dark,
            centroidX: dark ? sumX / dark / canvas.width : 0,
            centroidY: dark ? sumY / dark / canvas.height : 0,
          });
        };
        image.onerror = () => resolve(null);
        image.src = source;
      });

    // WebKit can complete one concurrent data: SVG decode with an empty canvas.
    // Keep this diagnostic render deterministic; production rasterization has
    // its own queue in geometry.js as well.
    const ribbon = await rasterize(ribbonPrint);
    const sticker = await rasterize(stickerPrint);
    return { ribbonPrint, stickerPrint, ribbon, sticker };
  });

  // Корневой viewBox печатных файлов — тайл-локальный, не canvas-координаты.
  for (const markup of [result.ribbonPrint, result.stickerPrint]) {
    expect(markup).toContain('viewBox="0 0 ');
  }
  // И файл реально рендерится: пустая лента / съехавший стикер ловятся здесь.
  expect(result.ribbon).not.toBeNull();
  expect(result.sticker).not.toBeNull();
  expect(result.ribbon.dark).toBeGreaterThan(500);
  expect(result.sticker.dark).toBeGreaterThan(500);
  // Текст по умолчанию центрируется: центроид стикера близок к центру
  // (сдвиг на 2,5 мм от окна viewBox давал centroidX/Y ≈ 0,44).
  expect(result.sticker.centroidX).toBeGreaterThan(0.47);
  expect(result.sticker.centroidX).toBeLessThan(0.53);
  expect(result.sticker.centroidY).toBeGreaterThan(0.47);
  expect(result.sticker.centroidY).toBeLessThan(0.53);
  // У ленты тоже один сегмент печати по центру тайла (не у края холста).
  expect(result.ribbon.centroidX).toBeGreaterThan(0.3);
  expect(result.ribbon.centroidX).toBeLessThan(0.7);
  expect(runtimeErrors).toEqual([]);
});
