
import { $, $$, activate } from '../../components/shared/dom.js';
import { state, saveState, restoreState } from '../../components/shared/state.js';
import { initUpload } from '../../components/upload/upload.js';
import { renderRibbon } from '../../components/ribbon/ribbon.js';
import { renderSticker } from '../../components/sticker/sticker.js';
import { calculatePrice } from '../../components/order/order.js';

const colors = [
  ['Молочный', '#f3eadc'], ['Белый', '#ffffff'], ['Пудровый', '#e5c5c4'],
  ['Красный', '#b7202d'], ['Бордовый', '#6b1f2d'], ['Изумрудный', '#0c6a4f'],
  ['Оливковый', '#6f754e'], ['Голубой', '#86b9ca'], ['Синий', '#274d83'],
  ['Лавандовый', '#9b8db5'], ['Серый', '#8e8d89'], ['Чёрный', '#171717']
];

function showPanel(id) {
  state.panel = id;
  $$('.nav-item').forEach((button) => button.classList.toggle('active', button.dataset.panel === id));
  $$('.panel').forEach((panel) => panel.classList.toggle('active', panel.id === 'panel-' + id));
}

function render() {
  renderRibbon();
  renderSticker();

  $('#stickerArea').style.display = state.bundle === 'bundle' ? 'grid' : 'none';
  $('.kit-layout').style.gridTemplateColumns = state.bundle === 'bundle'
    ? 'minmax(0,1fr) 340px'
    : '1fr';

  $('#status').textContent =
    `Лента ${state.width} мм · ${state.bundle === 'bundle' ? 'стикер Ø' + state.stickerSize + ' мм · ' : ''}шаг ${state.repeatMm} мм`;

  $('#orderRibbon').textContent = `${state.width} мм · ${state.meters} м`;
  $('#orderSticker').textContent = `Ø${state.stickerSize} мм · ${state.stickerQty} шт.`;
  $('#orderStickerRow').style.display = state.bundle === 'bundle' ? 'flex' : 'none';
  $('#orderRepeat').textContent = state.repeatMm + ' мм';
  $('#totalPrice').textContent = calculatePrice().toLocaleString('ru-RU') + ' ₽';

  saveState();
}

function syncControls() {
  $$('#widthChoice button').forEach((button) =>
    button.classList.toggle('active', +button.dataset.value === state.width)
  );
  $$('#printChoice button').forEach((button) =>
    button.classList.toggle('active', button.dataset.value === state.print)
  );
  $$('#bundleChoice button').forEach((button) =>
    button.classList.toggle('active', button.dataset.value === state.bundle)
  );
  $$('#stickerSizeChoice button').forEach((button) =>
    button.classList.toggle('active', +button.dataset.value === state.stickerSize)
  );

  $('#textInput').value = state.text;
  $('#fontSize').value = state.fontSize;
  $('#repeatMm').value = state.repeatMm;
  $('#meters').value = state.meters;
  $('#stickerQty').value = state.stickerQty;
  $('#logoScale').value = Math.round(state.logoScale * 100);
  $('#logoOffsetX').value = state.logoOffsetX;
}

colors.forEach(([name, color], index) => {
  const button = document.createElement('button');
  button.className = 'swatch' + (index === 0 ? ' active' : '');
  button.title = name;
  button.style.background = color;
  button.addEventListener('click', () => {
    $$('.swatch').forEach((item) => item.classList.remove('active'));
    button.classList.add('active');
    state.ribbon = color;
    render();
  });
  $('#ribbonSwatches').appendChild(button);
});

$$('.nav-item').forEach((button) =>
  button.addEventListener('click', () => showPanel(button.dataset.panel))
);

$$('.next-panel').forEach((button) =>
  button.addEventListener('click', () => showPanel(button.dataset.next))
);

$$('#widthChoice button').forEach((button) =>
  button.addEventListener('click', () => {
    activate('#widthChoice', button);
    state.width = +button.dataset.value;
    render();
  })
);

$$('#printChoice button').forEach((button) =>
  button.addEventListener('click', () => {
    activate('#printChoice', button);
    state.print = button.dataset.value;
    render();
  })
);

$$('#bundleChoice button').forEach((button) =>
  button.addEventListener('click', () => {
    activate('#bundleChoice', button);
    state.bundle = button.dataset.value;
    render();
  })
);

$$('#stickerSizeChoice button').forEach((button) =>
  button.addEventListener('click', () => {
    activate('#stickerSizeChoice', button);
    state.stickerSize = +button.dataset.value;
    render();
  })
);

$('#textInput').addEventListener('input', (event) => {
  state.text = event.target.value;
  render();
});

$('#fontSize').addEventListener('input', (event) => {
  state.fontSize = +event.target.value;
  render();
});

$('#repeatMm').addEventListener('input', (event) => {
  state.repeatMm = Math.max(40, +event.target.value || 100);
  render();
});

$('#meters').addEventListener('input', (event) => {
  state.meters = +event.target.value;
  render();
});

$('#stickerQty').addEventListener('input', (event) => {
  state.stickerQty = +event.target.value;
  render();
});

$('#logoScale').addEventListener('input', (event) => {
  state.logoScale = +event.target.value / 100;
  render();
});

$('#logoOffsetX').addEventListener('input', (event) => {
  state.logoOffsetX = +event.target.value;
  render();
});

$('#resetTransform').addEventListener('click', () => {
  state.logoScale = 1;
  state.logoOffsetX = 0;
  syncControls();
  render();
});

$('#makeBeautiful').addEventListener('click', () => {
  state.width = state.logo && state.logo.ratio > 2 ? 20 : 15;
  state.repeatMm = state.width === 20 ? 90 : 80;
  state.fontSize = state.width === 20 ? 34 : 28;
  state.stickerSize = 40;
  state.bundle = 'bundle';
  state.logoScale = 1;
  state.logoOffsetX = 0;
  syncControls();
  render();
});

$('#resetProject').addEventListener('click', () => {
  localStorage.removeItem('ribbon-studio-v03');
  location.reload();
});

initUpload(render);
restoreState();
syncControls();
render();
