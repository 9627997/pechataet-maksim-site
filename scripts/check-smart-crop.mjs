import assert from 'node:assert/strict';
import { createCanvas, Image } from '@napi-rs/canvas';

globalThis.window = {};
globalThis.document = {
  createElement(tagName) {
    if (tagName !== 'canvas') throw new Error(`Unexpected element: ${tagName}`);
    let width = 1;
    let height = 1;
    let canvas = null;
    return {
      get width() {
        return width;
      },
      set width(value) {
        width = value;
        canvas = null;
      },
      get height() {
        return height;
      },
      set height(value) {
        height = value;
        canvas = null;
      },
      getContext(type, options) {
        if (!canvas) canvas = createCanvas(width, height);
        return canvas.getContext(type, options);
      },
    };
  },
};

await import('../studio/assets/js/smart-crop.js');

const loadImage = async (canvas) => {
  const image = new Image();
  image.src = canvas.toBuffer('image/png');
  await image.decode();
  return image;
};

const createImage = async (draw) => {
  const canvas = createCanvas(400, 240);
  const context = canvas.getContext('2d');
  draw(context, canvas);
  return loadImage(canvas);
};

const centeredArtwork = await createImage((context, canvas) => {
  context.fillStyle = '#fff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#111';
  context.fillRect(120, 75, 160, 90);
});
const centered = await window.RibbonStudioSmartCrop.suggest(centeredArtwork);
assert.equal(centered.method, 'foreground');
assert.ok(centered.confidence >= 0.56);
assert.ok(centered.bounds.x > 0.2 && centered.bounds.x < 0.3);
assert.ok(centered.bounds.width > 0.4 && centered.bounds.width < 0.5);

const edgeArtwork = await createImage((context, canvas) => {
  context.fillStyle = '#f7f5ef';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#15233c';
  context.fillRect(276, 54, 84, 116);
});
const edge = await window.RibbonStudioSmartCrop.suggest(edgeArtwork);
assert.equal(edge.method, 'foreground');
assert.ok(edge.bounds.x > 0.62, 'off-center object must stay off-center');
assert.ok(edge.bounds.x + edge.bounds.width <= 1);

const flatImage = await createImage((context, canvas) => {
  context.fillStyle = '#ddd';
  context.fillRect(0, 0, canvas.width, canvas.height);
});
const flat = await window.RibbonStudioSmartCrop.suggest(flatImage);
assert.equal(flat.method, 'manual');
assert.equal(flat.bounds, null);

globalThis.FaceDetector = class {
  async detect() {
    return [{ boundingBox: { x: 120, y: 50, width: 90, height: 100 } }];
  }
};
const photoLikeImage = await createImage((context, canvas) => {
  const gradient = context.createLinearGradient(
    0,
    0,
    canvas.width,
    canvas.height,
  );
  gradient.addColorStop(0, '#12213d');
  gradient.addColorStop(0.5, '#d99a76');
  gradient.addColorStop(1, '#8cc7b7');
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);
});
const face = await window.RibbonStudioSmartCrop.suggest(photoLikeImage);
assert.equal(face.method, 'face');
assert.equal(face.confidence, 0.94);
assert.ok(face.bounds.width > 0.4);

console.log('Smart crop checks passed.');
