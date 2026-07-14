
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

function drawText(parent, x, y, size, anchor = 'middle') {
  if (!state.text) return;

  const text = element('text', {
    x,
    y,
    'text-anchor': anchor,
    'dominant-baseline': 'middle',
    'font-family': state.font,
    'font-size': size,
    'font-weight': '700',
    fill: state.print
  });

  text.textContent = state.text;
  parent.appendChild(text);
}

export function renderRibbon() {
  const height = state.width === 15 ? 90 : 120;
  const y = 130 - height / 2;

  ['ribbonBase', 'ribbonShine', 'clipRect'].forEach((id) => {
    $('#' + id).setAttribute('y', y);
    $('#' + id).setAttribute('height', height);
  });

  $('#safeZone').setAttribute('y', y + 10);
  $('#safeZone').setAttribute('height', height - 20);
  $('#ribbonBase').setAttribute('fill', state.ribbon);

  const layer = $('#ribbonContent');
  layer.innerHTML = '';

  const step = state.repeatMm * 4;

  for (let x = 70; x < 1200; x += step) {
    const group = element('g');

    if (state.logo) {
      drawLogo(group, x - 55, 130, 105, height * 0.62);
      drawText(group, x + 65, 130, state.fontSize);
    } else {
      drawText(group, x, 130, state.fontSize);
    }

    layer.appendChild(group);
  }
}
