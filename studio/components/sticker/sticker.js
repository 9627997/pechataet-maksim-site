
import { state } from '../shared/state.js';
import { $ } from '../shared/dom.js';

const NS = 'http://www.w3.org/2000/svg';

function element(tag, attributes = {}) {
  const node = document.createElementNS(NS, tag);
  Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, value));
  return node;
}

function drawLogo(parent, cx, cy, maxW, maxH) {
  if (!state.logo) return;

  let width = maxW * state.logoScale;
  let height = width / state.logo.ratio;

  if (height > maxH * state.logoScale) {
    height = maxH * state.logoScale;
    width = height * state.logo.ratio;
  }

  const image = element('image', {
    x: cx - width / 2 + state.logoOffsetX,
    y: cy - height / 2,
    width,
    height,
    preserveAspectRatio: 'xMidYMid meet'
  });

  image.setAttribute('href', state.logo.data);
  parent.appendChild(image);
}

function drawText(parent, x, y, size) {
  if (!state.text) return;

  const text = element('text', {
    x,
    y,
    'text-anchor': 'middle',
    'dominant-baseline': 'middle',
    'font-family': state.font,
    'font-size': size,
    'font-weight': '700',
    fill: state.print
  });

  text.textContent = state.text;
  parent.appendChild(text);
}

export function renderSticker() {
  $('#stickerBg').setAttribute('fill', state.stickerBg);

  const layer = $('#stickerContent');
  layer.innerHTML = '';

  if (state.logo) {
    drawLogo(layer, 200, 155, 180, 110);
    drawText(layer, 200, 265, 34);
  } else {
    drawText(layer, 200, 200, 42);
  }

  $('#stickerSizeLabel').textContent = `Ø${state.stickerSize} мм`;
}
