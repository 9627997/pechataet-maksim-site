import assert from 'node:assert/strict';

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

console.log('Trace mask checks passed.');
