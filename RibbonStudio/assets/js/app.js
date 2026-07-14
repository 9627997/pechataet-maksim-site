
document.addEventListener('DOMContentLoaded', () => {
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];
  const NS = 'http://www.w3.org/2000/svg';

  const state = {
    panel: 'upload',
    width: 15,
    ribbon: '#f3eadc',
    print: '#171717',
    logo: null,
    logoType: null,
    logoSvgSource: null,
    logoScale: 1,
    logoOffsetX: 0,
    text: 'печатаетмаксим',
    font: 'Manrope',
    fontSize: 32,
    repeatMm: 100,
    bundle: 'bundle',
    stickerSize: 40,
    stickerBg: '#ffffff',
    meters: 100,
    stickerQty: 100
  };

  const colors = [
    ['Молочный', '#f3eadc'], ['Белый', '#ffffff'], ['Пудровый', '#e5c5c4'],
    ['Красный', '#b7202d'], ['Бордовый', '#6b1f2d'], ['Изумрудный', '#0c6a4f'],
    ['Оливковый', '#6f754e'], ['Голубой', '#86b9ca'], ['Синий', '#274d83'],
    ['Лавандовый', '#9b8db5'], ['Серый', '#8e8d89'], ['Чёрный', '#171717']
  ];

  function svgEl(tag, attrs = {}) {
    const node = document.createElementNS(NS, tag);
    Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, value));
    return node;
  }

  function activate(groupSelector, button) {
    $$(groupSelector + ' button').forEach((item) => item.classList.remove('active'));
    button.classList.add('active');
  }

  function saveState() {
    const copy = {...state, logo: null};
    localStorage.setItem('ribbon-studio-v042', JSON.stringify(copy));
  }

  function restoreState() {
    try {
      Object.assign(state, JSON.parse(localStorage.getItem('ribbon-studio-v042') || '{}'));
    } catch {}
  }

  function showPanel(id) {
    state.panel = id;
    $$('.nav-item').forEach((button) => button.classList.toggle('active', button.dataset.panel === id));
    $$('.panel').forEach((panel) => panel.classList.toggle('active', panel.id === 'panel-' + id));
  }

  function drawLogo(parent, cx, cy, maxW, maxH) {
    if (!state.logo) return;

    let width = maxW * state.logoScale;
    let height = width / state.logo.ratio;

    if (height > maxH * state.logoScale) {
      height = maxH * state.logoScale;
      width = height * state.logo.ratio;
    }

    const image = svgEl('image', {
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

    const text = svgEl('text', {
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

  function renderRibbon() {
    const height = state.width === 15 ? 90 : 120;
    const y = 130 - height / 2;

    ['ribbonBase', 'ribbonShine', 'clipRect'].forEach((id) => {
      const element = $('#' + id);
      if (!element) return;
      element.setAttribute('y', y);
      element.setAttribute('height', height);
    });

    if ($('#safeZone')) {
      $('#safeZone').setAttribute('y', y + 10);
      $('#safeZone').setAttribute('height', height - 20);
    }
    if ($('#ribbonBase')) $('#ribbonBase').setAttribute('fill', state.ribbon);

    const layer = $('#ribbonContent');
    if (!layer) return;
    layer.innerHTML = '';

    const step = state.repeatMm * 4;

    for (let x = 70; x < 1200; x += step) {
      const group = svgEl('g');

      if (state.logo) {
        drawLogo(group, x - 55, 130, 105, height * 0.62);
        drawText(group, x + 65, 130, state.fontSize);
      } else {
        drawText(group, x, 130, state.fontSize);
      }

      layer.appendChild(group);
    }
  }

  function renderSticker() {
    if ($('#stickerBg')) $('#stickerBg').setAttribute('fill', state.stickerBg);

    const layer = $('#stickerContent');
    if (!layer) return;
    layer.innerHTML = '';

    if (state.logo) {
      drawLogo(layer, 200, 155, 180, 110);
      drawText(layer, 200, 265, 34);
    } else {
      drawText(layer, 200, 200, 42);
    }

    if ($('#stickerSizeLabel')) $('#stickerSizeLabel').textContent = `Ø${state.stickerSize} мм`;
  }

  function calculatePrice() {
    const ribbonBase = {10: 390, 25: 590, 50: 790, 100: 1090, 200: 1590}[state.meters] || 1090;
    const widthExtra = state.width === 20 ? 180 : 0;
    const stickerBase = state.bundle === 'bundle'
      ? ({50: 450, 100: 700, 250: 1350, 500: 2200}[state.stickerQty] || 700)
      : 0;

    return ribbonBase + widthExtra + stickerBase;
  }

  function setScene(scene) {
    $$('.scene').forEach((item) => item.classList.toggle('active', item.id === 'scene-' + scene));
    $$('#sceneTabs button').forEach((button) => button.classList.toggle('active', button.dataset.scene === scene));

    // Hidden images may not repaint immediately when their scene becomes visible.
    // Refresh once now and once on the next animation frame.
    updateMockupScenes();
    requestAnimationFrame(() => {
      updateMockupScenes();
      forceSceneRepaint(scene);
    });
  }

  function forceSceneRepaint(scene) {
    const node = $('#scene-' + scene);
    if (!node) return;
    node.style.transform = 'translateZ(0)';
    void node.offsetHeight;
    node.style.transform = '';
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function getSceneScale(sceneName) {
    if (!state.logo) return 1;

    const ratio = Number(state.logo.ratio) || 1;
    let fit = 1;

    if (sceneName === 'macro') {
      if (ratio > 4) fit = 0.72;
      else if (ratio > 2.5) fit = 0.82;
      else if (ratio < 0.7) fit = 0.78;
      else fit = 0.95;
    }

    if (sceneName === 'ribbon') {
      if (ratio > 4) fit = 0.72;
      else if (ratio > 2.5) fit = 0.84;
      else if (ratio < 0.7) fit = 0.62;
      else fit = 0.88;
    }

    if (sceneName === 'sticker') {
      if (ratio > 3) fit = 0.68;
      else if (ratio < 0.6) fit = 0.70;
      else fit = 0.88;
    }

    return clamp(state.logoScale * fit, 0.35, 1.55);
  }

  function updateMockupScenes() {
    const ribbonSurface = $('#ribbonSurface');
    const macroRibbon = $('#macroRibbon');
    const boxRibbonV = $('#boxRibbonV');
    const boxRibbonH = $('#boxRibbonH');
    const boxSticker = $('#boxSticker');

    if (ribbonSurface) ribbonSurface.style.backgroundColor = state.ribbon;
    if (macroRibbon) macroRibbon.style.backgroundColor = state.ribbon;
    if (boxRibbonV) boxRibbonV.style.backgroundColor = state.ribbon;
    if (boxRibbonH) boxRibbonH.style.backgroundColor = state.ribbon;
    if (boxSticker) boxSticker.style.backgroundColor = state.stickerBg;

    const displayText = state.text || 'ваш логотип';

    const macroImage = $('#macroLogoImage');
    const macroText = $('#macroLogoText');
    const boxRibbonImage = $('#boxRibbonImage');
    const boxRibbonText = $('#boxRibbonText');
    const boxStickerImage = $('#boxStickerImage');
    const boxStickerText = $('#boxStickerText');

    [macroImage, boxRibbonImage, boxStickerImage].forEach((image) => {
      if (!image) return;

      if (state.logo) {
        if (image.src !== state.logo.data) image.src = state.logo.data;
        image.hidden = false;
      } else {
        image.hidden = true;
        image.removeAttribute('src');
      }
    });

    [macroText, boxRibbonText, boxStickerText].forEach((text) => {
      if (!text) return;

      const hasText = Boolean(state.text && state.text.trim());
      text.hidden = !hasText;
      text.textContent = displayText;
      text.style.color = state.print;
      text.style.fontFamily = state.font;
    });

    if (macroImage) {
      macroImage.style.transform = `translateX(${state.logoOffsetX}px) scale(${getSceneScale('macro')})`;
    }
    if (boxRibbonImage) {
      boxRibbonImage.style.transform = `translateX(${state.logoOffsetX * 0.35}px) scale(${getSceneScale('ribbon')})`;
    }
    if (boxStickerImage) {
      boxStickerImage.style.transform = `scale(${getSceneScale('sticker')})`;
    }
  }

  function getStickerScale() {
    return {30: 0.78, 40: 1, 50: 1.22}[state.stickerSize] || 1;
  }

  function updateStickerScale() {
    const scale = getStickerScale();

    const stickerPaper = $('.sticker-paper');
    if (stickerPaper) {
      stickerPaper.style.transform = `scale(${scale})`;
    }

    const boxSticker = $('#boxSticker');
    if (boxSticker) {
      boxSticker.style.transform = `rotate(8deg) scale(${scale})`;
    }

    const stickerLabel = $('#stickerSizeLabel');
    if (stickerLabel) {
      stickerLabel.textContent = `Ø${state.stickerSize} мм`;
    }
  }

  function getRecommendation() {
    const ratio = state.logo ? Number(state.logo.ratio) || 1 : 1;
    const textLength = (state.text || '').trim().length;

    let width = 15;
    let stickerSize = 40;
    let repeatMm = 80;
    let logoScale = 1;
    let reason = 'Подходит для большинства логотипов и надписей.';

    if (ratio > 2.8 || textLength > 14) {
      width = 20;
      repeatMm = 100;
      logoScale = 0.88;
      reason = 'Широкий логотип или длинная надпись будут лучше читаться на ленте 20 мм.';
    } else if (ratio < 0.7) {
      width = 20;
      stickerSize = 50;
      repeatMm = 90;
      logoScale = 0.82;
      reason = 'Высокий знак требует больше высоты и свободного пространства.';
    } else if (!state.logo && textLength <= 10) {
      width = 15;
      stickerSize = 30;
      repeatMm = 70;
      logoScale = 1;
      reason = 'Короткая надпись хорошо работает в компактном формате.';
    }

    return {width, stickerSize, repeatMm, logoScale, reason};
  }

  function updateRecommendationCard() {
    const rec = getRecommendation();
    if ($('#recWidth')) $('#recWidth').textContent = rec.width + ' мм';
    if ($('#recSticker')) $('#recSticker').textContent = 'Ø' + rec.stickerSize + ' мм';
    if ($('#recRepeat')) $('#recRepeat').textContent = rec.repeatMm + ' мм';
    if ($('#recommendReason')) $('#recommendReason').textContent = rec.reason;
  }

  function render() {
    const printMode =
      state.print === '#b69249' ? 'gold' :
      state.print === '#c6c8cd' ? 'silver' :
      state.print === '#ffffff' ? 'white' : 'black';
    document.body.dataset.print = printMode;

    updateRecommendationCard();
    renderRibbon();
    renderSticker();
    updateMockupScenes();

    const ribbonMockup = $('.ribbon-mockup');
    const stickerArea = $('#stickerArea');
    const kitTable = $('.kit-table');

    if (ribbonMockup) {
      ribbonMockup.style.display = state.bundle === 'sticker' ? 'none' : 'block';
    }

    if (stickerArea) {
      stickerArea.style.display = state.bundle === 'ribbon' ? 'none' : 'grid';
    }

    if (kitTable) {
      kitTable.classList.toggle('only-ribbon', state.bundle === 'ribbon');
      kitTable.classList.toggle('only-sticker', state.bundle === 'sticker');
      kitTable.classList.toggle('bundle', state.bundle === 'bundle');
    }

    updateStickerScale();

    if ($('#status')) {
      $('#status').textContent =
        `Лента ${state.width} мм · ${state.bundle === 'bundle' ? 'стикер Ø' + state.stickerSize + ' мм · ' : ''}шаг ${state.repeatMm} мм`;
    }

    if ($('#orderRibbon')) $('#orderRibbon').textContent = `${state.width} мм · ${state.meters} м`;
    if ($('#orderSticker')) $('#orderSticker').textContent = `Ø${state.stickerSize} мм · ${state.stickerQty} шт.`;
    if ($('#orderStickerRow')) $('#orderStickerRow').style.display = state.bundle === 'bundle' ? 'flex' : 'none';
    if ($('#orderRepeat')) $('#orderRepeat').textContent = state.repeatMm + ' мм';
    if ($('#totalPrice')) $('#totalPrice').textContent = calculatePrice().toLocaleString('ru-RU') + ' ₽';

    saveState();
  }

  function showFileCard(file, meta, quality, warning = false) {
    const card = $('#fileCard');
    if (!card) return;

    card.hidden = false;
    card.classList.toggle('warning', warning);
    $('#fileCardIcon').textContent = warning ? '!' : '✓';
    $('#fileCardName').textContent = file.name;
    $('#fileCardMeta').textContent = meta;
    $('#fileCardQuality').textContent = quality;
    $('#continueUpload').disabled = false;
  }

  function isNonePaint(value) {
    if (!value) return false;
    const normalized = value.trim().toLowerCase();
    return normalized === 'none' || normalized === 'transparent';
  }

  function recolorSvgSource(svgSource) {
    const doc = new DOMParser().parseFromString(svgSource, 'image/svg+xml');
    const svg = doc.documentElement;

    if (svg.nodeName.toLowerCase() !== 'svg') return null;

    svg.querySelectorAll('script,foreignObject').forEach((node) => node.remove());

    // CSS classes inside exported SVGs often override fill/stroke attributes.
    // Remove stylesheet rules and force a single print color inline.
    svg.querySelectorAll('style').forEach((node) => node.remove());

    const shapeSelector = [
      'path', 'rect', 'circle', 'ellipse', 'polygon',
      'polyline', 'line', 'text', 'tspan', 'use'
    ].join(',');

    svg.querySelectorAll(shapeSelector).forEach((node) => {
      const fill = node.getAttribute('fill');
      const stroke = node.getAttribute('stroke');
      const style = node.getAttribute('style') || '';

      const styleFillMatch = style.match(/(?:^|;)\s*fill\s*:\s*([^;]+)/i);
      const styleStrokeMatch = style.match(/(?:^|;)\s*stroke\s*:\s*([^;]+)/i);

      const explicitFill = styleFillMatch ? styleFillMatch[1].trim() : fill;
      const explicitStroke = styleStrokeMatch ? styleStrokeMatch[1].trim() : stroke;

      // Preserve intentionally transparent/empty shapes.
      const keepFillNone = isNonePaint(explicitFill);
      const keepStrokeNone = isNonePaint(explicitStroke);

      node.removeAttribute('class');

      const cleanedStyle = style
        .replace(/(?:^|;)\s*fill\s*:\s*[^;]+/gi, '')
        .replace(/(?:^|;)\s*stroke\s*:\s*[^;]+/gi, '')
        .replace(/;;+/g, ';')
        .replace(/^;|;$/g, '');

      const forcedParts = [];
      if (cleanedStyle.trim()) forcedParts.push(cleanedStyle.trim());

      if (keepFillNone) {
        node.setAttribute('fill', 'none');
        forcedParts.push('fill:none!important');
      } else {
        node.setAttribute('fill', state.print);
        forcedParts.push(`fill:${state.print}!important`);
      }

      // Do not invent an outline where the source had no stroke.
      if (explicitStroke) {
        if (keepStrokeNone) {
          node.setAttribute('stroke', 'none');
          forcedParts.push('stroke:none!important');
        } else {
          node.setAttribute('stroke', state.print);
          forcedParts.push(`stroke:${state.print}!important`);
        }
      }

      node.setAttribute('style', forcedParts.join(';'));
    });

    // Replace gradient/pattern paints that may still be referenced by <use>.
    svg.querySelectorAll('linearGradient stop, radialGradient stop').forEach((stop) => {
      stop.setAttribute('stop-color', state.print);
      const style = stop.getAttribute('style') || '';
      const cleaned = style.replace(/stop-color\s*:\s*[^;]+/gi, '');
      stop.setAttribute('style', `${cleaned};stop-color:${state.print}!important`);
    });

    svg.setAttribute('color', state.print);

    const serialized = new XMLSerializer().serializeToString(svg);
    return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(serialized)));
  }

  function refreshSvgColor() {
    if (state.logoType !== 'svg' || !state.logoSvgSource || !state.logo) return;

    const recolored = recolorSvgSource(state.logoSvgSource);
    if (recolored) {
      state.logo.data = recolored;

      // Clear cached sources so every scene receives the new monochrome SVG.
      ['#macroLogoImage', '#boxRibbonImage', '#boxStickerImage'].forEach((selector) => {
        const image = $(selector);
        if (image) image.removeAttribute('src');
      });
    }
  }

  function loadFile(file) {
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

        state.logoSvgSource = serialized;
        state.logo = {
          data: recolorSvgSource(serialized),
          ratio
        };
        state.logoType = 'svg';

        showFileCard(file, 'SVG · векторный файл', 'Отлично: файл готов к печати');
        render();
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
          state.logoSvgSource = null;

          const minSide = Math.min(image.width, image.height);
          const warning = minSide < 1000;

          showFileCard(
            file,
            `${ext.toUpperCase()} · ${image.width} × ${image.height} px`,
            warning ? 'Мы бесплатно проверим и подготовим файл' : 'Качество изображения хорошее',
            warning
          );

          render();
        };

        image.src = reader.result;
      };

      reader.readAsDataURL(file);
      return;
    }

    alert('Поддерживаются SVG, PNG и JPEG');
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

    if ($('#textInput')) $('#textInput').value = state.text;
    if ($('#fontSelect')) $('#fontSelect').value = state.font;
    if ($('#fontSize')) $('#fontSize').value = state.fontSize;
    if ($('#repeatMm')) $('#repeatMm').value = state.repeatMm;
    if ($('#meters')) $('#meters').value = state.meters;
    if ($('#stickerQty')) $('#stickerQty').value = state.stickerQty;
    if ($('#logoScale')) $('#logoScale').value = Math.round(state.logoScale * 100);
    if ($('#logoOffsetX')) $('#logoOffsetX').value = state.logoOffsetX;
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

  $$('#sceneTabs button').forEach((button) =>
    button.addEventListener('click', () => setScene(button.dataset.scene))
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
      refreshSvgColor();
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

  $('#logoInput').addEventListener('change', (event) => loadFile(event.target.files[0]));

  const dropZone = $('#dropZone');
  ['dragenter', 'dragover'].forEach((type) =>
    dropZone.addEventListener(type, (event) => {
      event.preventDefault();
      dropZone.style.borderColor = '#171717';
    })
  );

  ['dragleave', 'drop'].forEach((type) =>
    dropZone.addEventListener(type, (event) => {
      event.preventDefault();
      dropZone.style.borderColor = '';
    })
  );

  dropZone.addEventListener('drop', (event) => loadFile(event.dataTransfer.files[0]));

  $('#textInput').addEventListener('input', (event) => {
    state.text = event.target.value;
    render();
  });

  $('#fontSelect').addEventListener('change', (event) => {
    state.font = event.target.value;
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
    const rec = getRecommendation();
    state.width = rec.width;
    state.repeatMm = rec.repeatMm;
    state.fontSize = rec.width === 20 ? 34 : 28;
    state.stickerSize = rec.stickerSize;
    state.bundle = 'bundle';
    state.logoScale = rec.logoScale;
    state.logoOffsetX = 0;
    syncControls();
    render();
  });

  $('#resetProject').addEventListener('click', () => {
    localStorage.removeItem('ribbon-studio-v042');
    location.reload();
  });

  restoreState();
  syncControls();
  render();
});
