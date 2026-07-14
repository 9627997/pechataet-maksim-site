
import { $, } from '../shared/dom.js';
import { state } from '../shared/state.js';

export function initUpload(onChange) {
  const input = $('#logoInput');
  const dropZone = $('#dropZone');

  input.addEventListener('change', (event) => loadFile(event.target.files[0], onChange));

  ['dragenter', 'dragover'].forEach((type) => dropZone.addEventListener(type, (event) => {
    event.preventDefault();
    dropZone.style.borderColor = '#171717';
  }));

  ['dragleave', 'drop'].forEach((type) => dropZone.addEventListener(type, (event) => {
    event.preventDefault();
    dropZone.style.borderColor = '';
  }));

  dropZone.addEventListener('drop', (event) => loadFile(event.dataTransfer.files[0], onChange));
}

function showFileCard(file, meta, quality, warning = false) {
  $('#fileCard').hidden = false;
  $('#fileCard').classList.toggle('warning', warning);
  $('#fileCardIcon').textContent = warning ? '!' : '✓';
  $('#fileCardName').textContent = file.name;
  $('#fileCardMeta').textContent = meta;
  $('#fileCardQuality').textContent = quality;
  $('#continueUpload').disabled = false;
}

function loadFile(file, onChange) {
  if (!file) return;

  const ext = file.name.split('.').pop().toLowerCase();
  const reader = new FileReader();

  if (ext === 'svg') {
    reader.onload = () => {
      const doc = new DOMParser().parseFromString(reader.result, 'image/svg+xml');
      const svg = doc.documentElement;
      if (svg.nodeName.toLowerCase() !== 'svg') {
        alert('Не удалось прочитать SVG');
        return;
      }

      svg.querySelectorAll('script,foreignObject').forEach((node) => node.remove());

      const viewBox = (svg.getAttribute('viewBox') || '').trim().split(/\s+/).map(Number);
      const ratio = viewBox.length === 4 && viewBox[3] ? viewBox[2] / viewBox[3] : 1;
      const serialized = new XMLSerializer().serializeToString(svg);

      state.logo = {
        data: 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(serialized))),
        ratio
      };
      state.logoType = 'svg';

      showFileCard(file, 'SVG · векторный файл', 'Отлично: файл готов к печати');
      onChange();
    };
    reader.readAsText(file);
    return;
  }

  if (['jpg', 'jpeg', 'png'].includes(ext)) {
    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        state.logo = {data: reader.result, ratio: image.width / image.height};
        state.logoType = ext === 'png' ? 'png' : 'jpeg';

        const minSide = Math.min(image.width, image.height);
        const warning = minSide < 1000;

        showFileCard(
          file,
          `${ext.toUpperCase()} · ${image.width} × ${image.height} px`,
          warning ? 'Мы бесплатно проверим и подготовим файл' : 'Качество изображения хорошее',
          warning
        );
        onChange();
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
    return;
  }

  alert('Поддерживаются SVG, PNG и JPEG');
}
