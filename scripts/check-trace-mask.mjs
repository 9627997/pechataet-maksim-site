import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ImageTracer = require('imagetracerjs');

globalThis.window = {};
await import('../studio/assets/js/trace-mask.js');

const traceMask = window.RibbonStudioTraceMask;

function createImage(width, height, background = [255, 255, 255, 255]) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let pixel = 0; pixel < width * height; pixel += 1) {
    data.set(background, pixel * 4);
  }
  return { data, width, height };
}

function fillRect(image, x, y, width, height, color) {
  for (let row = y; row < y + height; row += 1) {
    for (let column = x; column < x + width; column += 1) {
      image.data.set(color, (row * image.width + column) * 4);
    }
  }
}

function drawLetterBars(image, color) {
  fillRect(image, 34, 24, 12, 52, color);
  fillRect(image, 34, 24, 32, 10, color);
  fillRect(image, 34, 45, 27, 9, color);
  fillRect(image, 78, 24, 12, 52, color);
  fillRect(image, 78, 66, 34, 10, color);
}

const darkOnLight = createImage(140, 100);
drawLetterBars(darkOnLight, [18, 18, 18, 255]);
const darkResult = traceMask.analyze(darkOnLight);
assert.equal(darkResult.method, 'edge-background');
assert.equal(darkResult.signMetrics.frameRisk, false);
assert.ok(darkResult.signMetrics.coverage < 0.25);
assert.ok(darkResult.backgroundMetrics.coverage > 0.7);

const lightOnDark = createImage(140, 100, [18, 18, 18, 255]);
drawLetterBars(lightOnDark, [255, 255, 255, 255]);
const lightResult = traceMask.analyze(lightOnDark);
assert.equal(lightResult.method, 'edge-background');
assert.equal(lightResult.signMetrics.frameRisk, false);
assert.ok(lightResult.signMetrics.coverage < 0.25);
assert.ok(lightResult.backgroundMetrics.coverage > 0.7);

const transparentSign = createImage(140, 100, [0, 0, 0, 0]);
drawLetterBars(transparentSign, [18, 18, 18, 255]);
const transparentResult = traceMask.analyze(transparentSign);
assert.equal(transparentResult.method, 'alpha');
assert.equal(transparentResult.signMetrics.frameRisk, false);
assert.equal(transparentResult.alternativesAvailable, false);

const transparentPlaque = createImage(160, 120, [0, 0, 0, 0]);
fillRect(transparentPlaque, 10, 10, 140, 100, [18, 18, 18, 255]);
fillRect(transparentPlaque, 44, 36, 14, 48, [255, 255, 255, 255]);
fillRect(transparentPlaque, 44, 36, 40, 10, [255, 255, 255, 255]);
fillRect(transparentPlaque, 96, 36, 14, 48, [255, 255, 255, 255]);
const plaqueResult = traceMask.analyze(transparentPlaque);
assert.equal(plaqueResult.method, 'edge-background');
assert.equal(plaqueResult.signMetrics.frameRisk, false);
assert.ok(plaqueResult.signMetrics.coverage < 0.2);
assert.ok(plaqueResult.backgroundMetrics.coverage > 0.75);
assert.equal(plaqueResult.alternativesAvailable, true);

const framedLogo = createImage(140, 100);
fillRect(framedLogo, 15, 15, 110, 5, [18, 18, 18, 255]);
fillRect(framedLogo, 15, 80, 110, 5, [18, 18, 18, 255]);
fillRect(framedLogo, 15, 15, 5, 70, [18, 18, 18, 255]);
fillRect(framedLogo, 120, 15, 5, 70, [18, 18, 18, 255]);
drawLetterBars(framedLogo, [18, 18, 18, 255]);
const framedResult = traceMask.analyze(framedLogo);
assert.equal(framedResult.signMetrics.frameRisk, false);
assert.ok(framedResult.signMetrics.coverage < 0.35);

const binary = traceMask.toBinaryImageData(
  plaqueResult.signMask,
  transparentPlaque.width,
  transparentPlaque.height,
);
assert.equal(
  binary.data.length,
  transparentPlaque.width * transparentPlaque.height * 4,
);
assert.equal(binary.data[3], 255);

const wideSignWithAir = new Uint8Array(300 * 180);
for (let y = 72; y < 108; y += 1) {
  for (let x = 30; x < 270; x += 1) {
    wideSignWithAir[y * 300 + x] = 1;
  }
}
const trimmed = traceMask.trimMask(wideSignWithAir, 300, 180);
assert.deepEqual(trimmed.artworkBounds, {
  x: 30,
  y: 72,
  width: 240,
  height: 36,
  count: 8640,
});
assert.deepEqual(trimmed.cropBounds, {
  x: 29,
  y: 71,
  width: 242,
  height: 38,
});
assert.equal(trimmed.padding, 1);
assert.equal(trimmed.mask.length, trimmed.width * trimmed.height);
assert.ok(trimmed.ratio > 6.36);
assert.ok(trimmed.ratio < 6.37);
assert.equal(trimmed.mask[trimmed.width + 1], 1);

const trimmedBinary = traceMask.toBinaryImageData(
  trimmed.mask,
  trimmed.width,
  trimmed.height,
);
const tracedSource = ImageTracer.imagedataToSVG(trimmedBinary, {
  ltres: 1,
  qtres: 1,
  pathomit: 4,
  colorsampling: 0,
  colorquantcycles: 1,
  linefilter: true,
  roundcoords: 2,
  strokewidth: 0,
  pal: [
    { r: 0, g: 0, b: 0, a: 255 },
    { r: 255, g: 255, b: 255, a: 0 },
  ],
});
const tracedWithViewBox = tracedSource.includes('viewBox=')
  ? tracedSource
  : tracedSource.replace(
      '<svg ',
      `<svg viewBox="0 0 ${trimmed.width} ${trimmed.height}" `,
    );
assert.match(tracedWithViewBox, /<path\b/);
assert.match(
  tracedWithViewBox,
  new RegExp(`viewBox="0 0 ${trimmed.width} ${trimmed.height}"`),
);

console.log('Trace mask checks passed.');
