
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
    originalRaster: null,
    traceInfo: null,
    logoScale: 1,
    logoOffsetX: 0,
    text: 'ленты по любви',
    font: 'Manrope',
    fontSize: 32,
    repeatMm: 100,
    bundle: 'bundle',
    stickerSize: 40,
    stickerBg: '#ffffff',
    meters: 100,
    stickerQty: 100,
    lastMeters: 100,
    lastStickerQty: 100
  };

  const cropState = {
    file: null,
    image: null,
    originalDataUrl: null,
    rotation: 0,
    zoom: 1,
    offsetX: 0,
    offsetY: 0,
    dragMode: null,
    dragStartX: 0,
    dragStartY: 0,
    startOffsetX: 0,
    startOffsetY: 0,
    startFrame: null,
    activeHandle: null
  };

  const DEFAULT_LOGO_SVG = `<?xml version="1.0" encoding="UTF-8"?>
<svg id="_Слой_1" data-name="Слой 1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 50">
  <defs><style>.cls-1{fill:#1d1d1b;}</style></defs>
  <g>
    <path class="cls-1" d="m27.75,16.43c-.44,0-.79.35-.83.78-.08.78-.42,1.54-1.01,2.13-.93.93-2.25,1.23-3.43.91-.5-.14-.67-.78-.3-1.15l.59-.59,3.59-3.59.57-.57c.28-.28.28-.74,0-1.02h0c-2.08-2.08-5.54-1.94-7.43.42-1.44,1.79-1.44,4.41,0,6.2,1.89,2.36,5.35,2.5,7.43.42.92-.92,1.4-2.1,1.45-3.3.01-.35-.28-.64-.63-.64h0Zm-6.84-2.08c1.2-1.2,3.06-1.35,4.43-.46l-4.89,4.89c-.89-1.37-.74-3.22.46-4.43Z"/>
    <path class="cls-1" d="m50.4,11.86c-.4,0-.73.33-.73.73v.74c-.9-.91-2.15-1.47-3.53-1.47-2.75,0-4.99,2.23-4.99,4.99s2.23,4.99,4.99,4.99c1.38,0,2.63-.56,3.53-1.47v.74c0,.4.33.73.73.73s.73-.33.73-.73v-8.52c0-.4-.33-.73-.73-.73Zm-4.26,8.38c-1.87,0-3.39-1.52-3.39-3.39s1.52-3.39,3.39-3.39,3.39,1.52,3.39,3.39-1.52,3.39-3.39,3.39Z"/>
    <path class="cls-1" d="m61.77,11.86h-8.47c-.38,0-.73.27-.77.65-.04.44.3.8.72.8h2.79c.41,0,.74.33.74.74v7c0,.38.27.73.65.77.44.04.8-.3.8-.72v-7.05c0-.41.33-.74.74-.74h2.75c.38,0,.73-.27.77-.65.04-.44-.3-.8-.72-.8Z"/>
    <path class="cls-1" d="m71.97,11.86c-.4,0-.73.33-.73.73v.74c-.9-.91-2.15-1.47-3.53-1.47-2.75,0-4.99,2.23-4.99,4.99s2.23,4.99,4.99,4.99c1.38,0,2.63-.56,3.53-1.47v.74c0,.4.33.73.73.73s.73-.33.73-.73v-8.52c0-.4-.33-.73-.73-.73Zm-4.26,8.38c-1.87,0-3.39-1.52-3.39-3.39s1.52-3.39,3.39-3.39,3.39,1.52,3.39,3.39-1.52,3.39-3.39,3.39Z"/>
    <path class="cls-1" d="m83.46,16.43c-.44,0-.79.35-.83.78-.08.78-.42,1.54-1.01,2.13-.93.93-2.25,1.23-3.43.91-.5-.14-.67-.78-.3-1.15l.59-.59,3.59-3.59.57-.57c.28-.28.28-.74,0-1.02h0c-2.08-2.08-5.54-1.94-7.43.42-1.44,1.79-1.44,4.41,0,6.2,1.89,2.36,5.35,2.5,7.43.42.92-.92,1.4-2.1,1.45-3.3.01-.35-.28-.64-.63-.64h0Zm-6.84-2.08c1.2-1.2,3.06-1.35,4.43-.46l-4.89,4.89c-.89-1.37-.74-3.22.46-4.43Z"/>
    <path class="cls-1" d="m93.34,11.86h-8.47c-.38,0-.73.27-.77.65-.04.44.3.8.72.8h2.79c.41,0,.74.33.74.74v7c0,.38.27.73.65.77.44.04.8-.3.8-.72v-7.05c0-.41.33-.74.74-.74h2.75c.38,0,.73-.27.77-.65.04-.44-.3-.8-.72-.8Z"/>
    <path class="cls-1" d="m30.78,12.59c0-.4-.33-.73-.73-.73h0c-.4,0-.73.33-.73.73v2.35c0,2.75,2.23,4.99,4.99,4.99,1.38,0,2.63-.56,3.53-1.47v2.64c0,.4.33.73.73.73s.73-.33.73-.73v-8.52c0-.4-.33-.73-.73-.73s-.73.33-.73.73v2.36c0,1.94-1.59,3.53-3.53,3.53s-3.53-1.58-3.53-3.53v-2.35Z"/>
    <path class="cls-1" d="m11.99,13.31c1.95,0,3.53,1.58,3.53,3.53v4.26c0,.4.33.73.73.73h0c.4,0,.73-.33.73-.73v-4.26c0-2.75-2.23-4.99-4.99-4.99h0c-2.75,0-4.99,2.23-4.99,4.99v4.26c0,.4.33.73.73.73h0c.4,0,.73-.33.73-.73v-4.26c0-1.95,1.58-3.53,3.53-3.53"/>
  </g>
  <g>
    <path class="cls-1" d="m47.67,28.17c-.4,0-.73.33-.73.73v.74c-.9-.91-2.15-1.47-3.53-1.47-2.75,0-4.99,2.23-4.99,4.99s2.23,4.99,4.99,4.99c1.38,0,2.63-.56,3.53-1.47v.74c0,.4.33.73.73.73s.73-.33.73-.73v-8.52c0-.4-.33-.73-.73-.73Zm-4.26,8.38c-1.87,0-3.39-1.52-3.39-3.39s1.52-3.39,3.39-3.39,3.39,1.52,3.39,3.39-1.52,3.39-3.39,3.39Z"/>
    <path class="cls-1" d="m59.68,37l-2.11-3.44c-.17-.25-.17-.57,0-.82l2.11-3.44c.23-.33.14-.78-.19-1.01h0c-.33-.23-.78-.14-1.01.19l-2.46,3.94h-4.71v-3.53c0-.4-.33-.73-.73-.73s-.73.33-.73.73v8.52c0,.4.33.73.73.73s.73-.33.73-.73v-3.53h4.71l2.46,3.94c.23.33.68.42,1.01.19.33-.23.42-.68.19-1.01Z"/>
    <path class="cls-1" d="m68.3,33.46c-.13,1.47-1.22,2.78-2.85,3.05-1.36.22-2.75-.43-3.44-1.62-1.1-1.89-.18-4.22,1.78-4.92,1.29-.46,2.67-.09,3.57.83.22.22.53.31.82.2h.02c.54-.2.71-.89.31-1.3-1.42-1.47-3.68-1.99-5.7-1.06-2.23,1.03-3.38,3.62-2.66,5.97.84,2.74,3.78,4.2,6.45,3.25,1.9-.68,3.13-2.39,3.29-4.27.05-.58-.52-1.02-1.07-.82h0c-.3.11-.5.38-.52.7Z"/>
    <path class="cls-1" d="m81.33,30.91v-2.01c0-.4-.33-.73-.73-.73h0c-.4,0-.73.33-.73.73v4.13c0,1.88-1.41,3.52-3.29,3.65-2.06.14-3.77-1.5-3.77-3.52v-4.26c0-.4-.33-.73-.73-.73h0c-.4,0-.73.33-.73.73v4.13c0,2.64,2,4.93,4.64,5.11,1.52.1,2.9-.47,3.88-1.45v.74c0,.4.33.73.73.73h0c.4,0,.73-.33.73-.73v-6.5h0Z"/>
    <path class="cls-1" d="m36.25,28.17h0c-.24,0-.46.12-.59.3-.04.01-3.35,4.76-3.35,4.76-.15.22-.47.22-.62,0,0,0-3.36-4.81-3.41-4.82-.13-.15-.32-.24-.54-.24-.4,0-.73.33-.73.73v8.52c0,.4.33.73.73.73s.73-.33.73-.73v-6.29l3,4.34c.12.17.33.25.55.23.21.01.41-.06.52-.23l2.99-4.32v6.27c0,.4.33.73.73.73h0c.4,0,.73-.33.73-.73v-8.52c0-.4-.33-.73-.73-.73Z"/>
    <path class="cls-1" d="m92.02,28.17h0c-.24,0-.46.12-.59.3-.04.01-3.35,4.76-3.35,4.76-.15.22-.47.22-.62,0,0,0-3.36-4.81-3.41-4.82-.13-.15-.32-.24-.54-.24-.4,0-.73.33-.73.73v8.52c0,.4.33.73.73.73s.73-.33.73-.73v-6.29l3,4.34c.12.17.33.25.55.23.21.01.41-.06.52-.23l2.99-4.32v6.27c0,.4.33.73.73.73h0c.4,0,.73-.33.73-.73v-8.52c0-.4-.33-.73-.73-.73Z"/>
  </g>
  <g>
    <circle class="cls-1" cx="15.01" cy="33.15" r="1.97"/>
    <circle class="cls-1" cx="10.34" cy="33.15" r="1.22"/>
    <path class="cls-1" d="m21.63,29.96c-1.76,0-3.19,1.43-3.19,3.19s1.43,3.19,3.19,3.19,3.19-1.43,3.19-3.19-1.43-3.19-3.19-3.19Zm0,4.41c-.67,0-1.22-.55-1.22-1.22s.55-1.22,1.22-1.22,1.22.55,1.22,1.22-.55,1.22-1.22,1.22Z"/>
  </g>
</svg>`;

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

      const validMeters = [10, 25, 50, 100, 200];
      const validStickerQuantities = [50, 100, 250, 500];
      state.lastMeters = validMeters.includes(state.lastMeters)
        ? state.lastMeters
        : validMeters.includes(state.meters) ? state.meters : 100;
      state.lastStickerQty = validStickerQuantities.includes(state.lastStickerQty)
        ? state.lastStickerQty
        : validStickerQuantities.includes(state.stickerQty) ? state.stickerQty : 100;

      const restoredBundle = ['bundle', 'ribbon', 'sticker'].includes(state.bundle)
        ? state.bundle
        : 'bundle';
      const hasRibbon = restoredBundle !== 'sticker';
      const hasSticker = restoredBundle !== 'ribbon';
      state.meters = hasRibbon && validMeters.includes(state.meters)
        ? state.meters
        : hasRibbon ? state.lastMeters : 0;
      state.stickerQty = hasSticker && validStickerQuantities.includes(state.stickerQty)
        ? state.stickerQty
        : hasSticker ? state.lastStickerQty : 0;
      state.bundle = hasRibbon && hasSticker ? 'bundle' : hasRibbon ? 'ribbon' : 'sticker';

      const legacyDemoTexts = ['привет', 'печатаетмаксим', 'сделано красиво'];
      if (legacyDemoTexts.includes((state.text || '').trim().toLowerCase())) {
        state.text = 'ленты по любви';
      }
    } catch {}
  }

  function loadDefaultLogo() {
    if (state.logo) return;

    const doc = new DOMParser().parseFromString(DEFAULT_LOGO_SVG, 'image/svg+xml');
    const svg = doc.documentElement;
    const viewBox = (svg.getAttribute('viewBox') || '0 0 100 50')
      .trim().split(/\s+/).map(Number);
    const ratio = viewBox.length === 4 && viewBox[3] ? viewBox[2] / viewBox[3] : 2;

    state.logoSvgSource = DEFAULT_LOGO_SVG;
    state.logo = {
      data: recolorSvgSource(DEFAULT_LOGO_SVG),
      ratio
    };
    state.logoType = 'svg';
  }


  function recolorLogoForShowcase(color) {
    if (!state.logo) return null;

    if (['svg', 'svg-auto'].includes(state.logoType) && state.logoSvgSource) {
      const previousPrint = state.print;
      state.print = color;
      const recolored = recolorSvgSource(state.logoSvgSource);
      state.print = previousPrint;
      return recolored;
    }

    return state.logo.data;
  }

  function updateShowcaseContent() {
    const textValue = (state.text || '').trim();
    const logoData = state.logo ? state.logo.data : null;
    const onUpload = state.panel === 'upload';

    $$('.dynamic-showcase-text').forEach((el) => {
      el.textContent = textValue;
      el.hidden = !textValue;
      el.style.fontFamily = state.font;
    });

    if (onUpload) {
      const demo = [
        {
          selector: '.showcase-ribbon-15',
          ribbon: '#b51f2e',
          print: '#b69249'
        },
        {
          selector: '.showcase-ribbon-20',
          ribbon: '#e9dcc7',
          print: '#111111'
        },
        {
          selector: '.showcase-sticker-black',
          print: '#c6c8cd'
        },
        {
          selector: '.showcase-sticker-white',
          print: '#111111'
        },
        {
          selector: '.showcase-sticker-clear',
          print: '#b69249'
        }
      ];

      demo.forEach((item) => {
        const root = $(item.selector);
        if (!root) return;

        if (item.ribbon) {
          root.querySelector('.dynamic-ribbon')
            ?.style.setProperty('--showcase-ribbon-color', item.ribbon);
        }

        root.querySelectorAll('.dynamic-showcase-text').forEach((el) => {
          el.style.color = item.print;
        });

        const fixedLogo = recolorLogoForShowcase(item.print);

        root.querySelectorAll('.dynamic-showcase-logo').forEach((img) => {
          if (fixedLogo) {
            img.src = fixedLogo;
            img.hidden = false;
            img.style.filter = 'none';
          } else {
            img.hidden = true;
            img.removeAttribute('src');
          }
        });
      });
    } else {
      $$('.dynamic-showcase-text').forEach((el) => {
        el.style.color = state.print;
      });

      $$('.dynamic-ribbon').forEach((el) => {
        el.style.setProperty('--showcase-ribbon-color', state.ribbon);
      });

      if (logoData) {
        if (['svg', 'svg-auto'].includes(state.logoType) && state.logoSvgSource) {
          refreshSvgColor();
        }

        const liveLogo = state.logo ? state.logo.data : logoData;

        $$('.dynamic-showcase-logo').forEach((img) => {
          img.src = liveLogo;
          img.hidden = false;
          img.style.filter = 'none';
        });
      } else {
        $$('.dynamic-showcase-logo').forEach((img) => {
          img.hidden = true;
          img.removeAttribute('src');
        });
      }
    }
  }

  function updateProductShowcase() {
    const scene = $('#scene-kit');
    const showcase = $('#productShowcase');
    if (!scene || !showcase) return;

    const onUpload = state.panel === 'upload';
    const ribbonsOnly = !onUpload && state.bundle === 'ribbon';
    const stickersOnly = !onUpload && state.bundle === 'sticker';
    const showAll = onUpload || state.bundle === 'bundle';

    scene.classList.toggle('showcase-ribbons-only', ribbonsOnly);
    scene.classList.toggle('showcase-stickers-only', stickersOnly);

    showcase.querySelectorAll('[data-product-type]').forEach((item) => {
      const type = item.dataset.productType;
      const hide =
        !showAll &&
        ((ribbonsOnly && type !== 'ribbon') ||
         (stickersOnly && type !== 'sticker'));

      item.classList.toggle('is-hidden', hide);
    });
  }

  function showPanel(id) {
    state.panel = id;
    $$('.nav-item').forEach((button) => button.classList.toggle('active', button.dataset.panel === id));
    $$('.panel').forEach((panel) => panel.classList.toggle('active', panel.id === 'panel-' + id));
    updateProductShowcase();
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

  function fittedTextSize(text, maxWidth, preferredSize, minSize = 10) {
    const value = (text || '').trim();
    if (!value) return preferredSize;

    const estimatedAtPreferred = value.length * preferredSize * 0.58;
    if (estimatedAtPreferred <= maxWidth) return preferredSize;

    return Math.max(minSize, preferredSize * (maxWidth / estimatedAtPreferred));
  }

  function renderRibbon() {
    const height = state.width === 15 ? 76 : 100;
    const y = 130 - height / 2;

    ['ribbonBase', 'ribbonShine', 'clipRect'].forEach((id) => {
      const element = $('#' + id);
      if (!element) return;
      element.setAttribute('y', y);
      element.setAttribute('height', height);
    });

    if ($('#safeZone')) {
      $('#safeZone').setAttribute('y', y + 5);
      $('#safeZone').setAttribute('height', height - 10);
    }

    if ($('#ribbonBase')) $('#ribbonBase').setAttribute('fill', state.ribbon);

    const layer = $('#ribbonContent');
    if (!layer) return;
    layer.innerHTML = '';

    const repeatWidth = Math.max(360, state.repeatMm * 6.2);
    const hasLogo = Boolean(state.logo);
    const hasText = Boolean((state.text || '').trim());

    for (let startX = -30; startX < 1260; startX += repeatWidth) {
      const cell = svgEl('g');

      const clipId = `repeat-clip-${Math.round(startX)}`;
      const defs = svgEl('defs');
      const clipPath = svgEl('clipPath', {id: clipId});

      clipPath.appendChild(svgEl('rect', {
        x: startX + 12,
        y: y + 3,
        width: repeatWidth - 24,
        height: height - 6
      }));

      defs.appendChild(clipPath);
      cell.appendChild(defs);

      const content = svgEl('g', {'clip-path': `url(#${clipId})`});

      if (hasLogo && hasText) {
        const logoZone = repeatWidth * 0.42;
        const textZone = repeatWidth * 0.46;
        const gap = repeatWidth * 0.035;

        const logoCenterX = startX + 18 + logoZone / 2;
        const textCenterX = startX + 18 + logoZone + gap + textZone / 2;

        drawLogo(
          content,
          logoCenterX,
          130,
          logoZone * 0.92,
          height * 0.72
        );

        const preferredSize = state.width === 20 ? 39 : 31;
        const textSize = fittedTextSize(
          state.text,
          textZone * 0.94,
          preferredSize,
          17
        );

        drawText(content, textCenterX, 130, textSize);
      } else if (hasLogo) {
        drawLogo(
          content,
          startX + repeatWidth / 2,
          130,
          repeatWidth * 0.72,
          height * 0.76
        );
      } else if (hasText) {
        const textSize = fittedTextSize(
          state.text,
          repeatWidth * 0.84,
          state.width === 20 ? 43 : 34,
          18
        );

        drawText(content, startX + repeatWidth / 2, 130, textSize);
      }

      cell.appendChild(content);
      layer.appendChild(cell);
    }
  }

  function renderSticker() {
    if ($('#stickerBg')) $('#stickerBg').setAttribute('fill', state.stickerBg);

    const layer = $('#stickerContent');
    if (!layer) return;
    layer.innerHTML = '';

    const hasLogo = Boolean(state.logo);
    const hasText = Boolean((state.text || '').trim());

    if (hasLogo && hasText) {
      drawLogo(layer, 200, 145, 154, 84);

      const size = fittedTextSize(
        state.text,
        250,
        state.stickerSize === 30 ? 22 : state.stickerSize === 40 ? 27 : 31,
        14
      );
      drawText(layer, 200, 270, size);
    } else if (hasLogo) {
      drawLogo(layer, 200, 200, 215, 145);
    } else if (hasText) {
      const size = fittedTextSize(
        state.text,
        270,
        state.stickerSize === 30 ? 28 : state.stickerSize === 40 ? 35 : 40,
        16
      );
      drawText(layer, 200, 200, size);
    }

    if ($('#stickerSizeLabel')) {
      $('#stickerSizeLabel').textContent = `Ø${state.stickerSize} мм`;
    }
  }

  function calculatePrice() {
    const ribbonBase = state.meters > 0
      ? ({10: 390, 25: 590, 50: 790, 100: 1090, 200: 1590}[state.meters] || 0)
      : 0;
    const widthExtra = state.meters > 0 && state.width === 20 ? 180 : 0;
    const stickerBase = state.stickerQty > 0
      ? ({50: 450, 100: 700, 250: 1350, 500: 2200}[state.stickerQty] || 0)
      : 0;

    return ribbonBase + widthExtra + stickerBase;
  }

  function publishProductSelection() {
    const detail = {
      ribbon: state.meters > 0,
      sticker: state.stickerQty > 0
    };
    document.body.dataset.hasRibbon = String(detail.ribbon);
    document.body.dataset.hasSticker = String(detail.sticker);
    document.dispatchEvent(new CustomEvent('studio:product-selection-updated', {detail}));
  }

  function setProductSelection({ribbon, sticker}) {
    if (!ribbon && !sticker) {
      publishProductSelection();
      return false;
    }

    if (state.meters > 0) state.lastMeters = state.meters;
    if (state.stickerQty > 0) state.lastStickerQty = state.stickerQty;

    state.meters = ribbon ? (state.meters || state.lastMeters) : 0;
    state.stickerQty = sticker ? (state.stickerQty || state.lastStickerQty) : 0;
    state.bundle = ribbon && sticker ? 'bundle' : ribbon ? 'ribbon' : 'sticker';
    syncControls();
    render();
    return true;
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
    const macroStickerImage = $('#macroStickerImage');
    const macroStickerText = $('#macroStickerText');
    const boxRibbonImage = $('#boxRibbonImage');
    const boxRibbonText = $('#boxRibbonText');
    const boxStickerImage = $('#boxStickerImage');
    const boxStickerText = $('#boxStickerText');

    [macroImage, macroStickerImage, boxRibbonImage, boxStickerImage].forEach((image) => {
      if (!image) return;

      if (state.logo) {
        if (image.src !== state.logo.data) image.src = state.logo.data;
        image.hidden = false;
      } else {
        image.hidden = true;
        image.removeAttribute('src');
      }
    });

    [macroText, macroStickerText, boxRibbonText, boxStickerText].forEach((text) => {
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
    if (macroStickerImage) {
      macroStickerImage.style.transform = `scale(${Math.min(getSceneScale('sticker'), 1)})`;
    }

    const hasLogo = Boolean(state.logo);
    const hasText = Boolean((state.text || '').trim());

    [
      $('#macroLogo'),
      $('.macro-sticker-paper'),
      $('.box-ribbon-content'),
      $('.box-sticker-content')
    ].forEach((element) => {
      if (!element) return;
      element.classList.toggle('has-logo-and-text', hasLogo && hasText);
      element.classList.toggle('has-logo-only', hasLogo && !hasText);
      element.classList.toggle('has-text-only', !hasLogo && hasText);
    });
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

    const macroSticker = $('#macroSticker');
    if (macroSticker) {
      macroSticker.style.setProperty('--sticker-scale', scale);
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
    updateShowcaseContent();
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
    document.body.dataset.ribbonWidth = String(state.width);
    document.body.style.setProperty('--ribbon-live-color', state.ribbon);
    document.body.dataset.stickerSize = String(state.stickerSize);
    document.body.style.setProperty('--ribbon-mm', String(state.width));
    document.body.style.setProperty('--sticker-mm', String(state.stickerSize));

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

    const boxRibbonV = $('#boxRibbonV');
    const boxRibbonH = $('#boxRibbonH');
    const boxSticker = $('#boxSticker');
    const macroRibbon = $('#macroRibbon');
    const macroSticker = $('#macroSticker');

    const showRibbon = state.bundle !== 'sticker';
    const showSticker = state.bundle !== 'ribbon';

    [boxRibbonV, boxRibbonH, macroRibbon].forEach((element) => {
      if (element) element.classList.toggle('product-hidden', !showRibbon);
    });

    [boxSticker, macroSticker].forEach((element) => {
      if (element) element.classList.toggle('product-hidden', !showSticker);
    });

    const macroStage = $('#macroStage');
    if (macroStage) {
      macroStage.classList.toggle('macro-only-ribbon', state.bundle === 'ribbon');
      macroStage.classList.toggle('macro-only-sticker', state.bundle === 'sticker');
      macroStage.classList.toggle('macro-bundle', state.bundle === 'bundle');
    }

    updateProductShowcase();
    updateStickerScale();

    if ($('#status')) {
      $('#status').textContent =
        `Лента ${state.width} мм · ${state.bundle === 'bundle' ? 'стикер Ø' + state.stickerSize + ' мм · ' : ''}шаг ${state.repeatMm} мм`;
    }

    if ($('#orderRibbon')) $('#orderRibbon').textContent = `${state.width} мм · ${state.meters} м`;
    if ($('#orderSticker')) $('#orderSticker').textContent = `Ø${state.stickerSize} мм · ${state.stickerQty} шт.`;
    if ($('#orderStickerRow')) $('#orderStickerRow').style.display = 'flex';
    if ($('#orderRepeat')) $('#orderRepeat').textContent = state.repeatMm + ' мм';
    if ($('#totalPrice')) $('#totalPrice').textContent = calculatePrice().toLocaleString('ru-RU') + ' ₽';

    saveState();
    publishProductSelection();
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
    if (!['svg','svg-auto'].includes(state.logoType) || !state.logoSvgSource || !state.logo) return;

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

  function hasTransparency(imageData) {
    const data = imageData.data;
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] < 250) return true;
    }
    return false;
  }

  function estimateBackground(imageData, width, height) {
    const samples = [];
    const points = [
      [0,0], [width-1,0], [0,height-1], [width-1,height-1],
      [Math.floor(width/2),0], [Math.floor(width/2),height-1],
      [0,Math.floor(height/2)], [width-1,Math.floor(height/2)]
    ];

    points.forEach(([x,y]) => {
      const i = (y * width + x) * 4;
      samples.push([
        imageData.data[i],
        imageData.data[i+1],
        imageData.data[i+2]
      ]);
    });

    return samples.reduce((acc, rgb) => [
      acc[0] + rgb[0] / samples.length,
      acc[1] + rgb[1] / samples.length,
      acc[2] + rgb[2] / samples.length
    ], [0,0,0]);
  }

  function colorDistance(r, g, b, bg) {
    return Math.sqrt(
      Math.pow(r - bg[0], 2) +
      Math.pow(g - bg[1], 2) +
      Math.pow(b - bg[2], 2)
    );
  }

  function rasterToSvg(image, fileType) {
    const maxSide = 900;
    const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d', {willReadFrequently: true});
    ctx.drawImage(image, 0, 0, width, height);

    const imageData = ctx.getImageData(0, 0, width, height);
    const transparent = hasTransparency(imageData);
    const bg = estimateBackground(imageData, width, height);

    // Adaptive threshold: preserve visible alpha for transparent PNG,
    // otherwise separate foreground from the sampled edge background.
    const threshold = transparent ? 24 : 58;
    const runs = [];
    let foregroundPixels = 0;

    for (let y = 0; y < height; y++) {
      let runStart = -1;

      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        const r = imageData.data[i];
        const g = imageData.data[i+1];
        const b = imageData.data[i+2];
        const a = imageData.data[i+3];

        let foreground;
        if (transparent) {
          foreground = a > 40;
        } else {
          const distance = colorDistance(r, g, b, bg);
          const luminance = (0.2126*r + 0.7152*g + 0.0722*b);
          const bgLum = (0.2126*bg[0] + 0.7152*bg[1] + 0.0722*bg[2]);
          foreground = distance > threshold && Math.abs(luminance - bgLum) > 20;
        }

        if (foreground) {
          foregroundPixels++;
          if (runStart < 0) runStart = x;
        }

        if ((!foreground || x === width - 1) && runStart >= 0) {
          const endX = foreground && x === width - 1 ? x + 1 : x;
          runs.push([runStart, y, endX - runStart, 1]);
          runStart = -1;
        }
      }
    }

    const ratio = width / height;
    const rects = runs.map(([x,y,w,h]) =>
      `<rect x="${x}" y="${y}" width="${w}" height="${h}"/>`
    ).join('');

    const svgSource =
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" ` +
      `width="${width}" height="${height}">` +
      `<g fill="${state.print}" stroke="none">${rects}</g></svg>`;

    const coverage = foregroundPixels / (width * height);
    let quality = 'Контуры определены автоматически.';
    let warning = false;

    if (coverage < 0.008) {
      quality = 'Обнаружено мало деталей — файл обязательно проверим вручную.';
      warning = true;
    } else if (coverage > 0.72) {
      quality = 'Фон может быть сложным — перед производством потребуется проверка.';
      warning = true;
    }

    return {
      svgSource,
      ratio,
      width,
      height,
      transparent,
      coverage,
      quality,
      warning,
      fileType
    };
  }

  function showTraceStatus(result) {
    const status = $('#traceStatus');
    if (!status) return;

    status.hidden = false;
    status.classList.toggle('warning', result.warning);

    $('#traceDetails').textContent =
      `${result.transparent ? 'Прозрачность сохранена' : 'Фон удалён автоматически'} · ` +
      `${result.width} × ${result.height} · ${result.quality}`;
  }

  function openCropModal(file, image, dataUrl) {
    cropState.file = file;
    cropState.image = image;
    cropState.originalDataUrl = dataUrl;
    cropState.rotation = 0;
    cropState.zoom = 1;
    cropState.offsetX = 0;
    cropState.offsetY = 0;

    $('#cropZoom').value = 100;
    resetCropFrame();

    $('#cropModal').classList.add('open');
    $('#cropModal').setAttribute('aria-hidden', 'false');

    requestAnimationFrame(drawCropCanvas);
  }

  function closeCropModal() {
    $('#cropModal').classList.remove('open');
    $('#cropModal').setAttribute('aria-hidden', 'true');
  }

  function resetCropFrame() {
    const frame = $('#cropFrame');
    frame.style.left = '18%';
    frame.style.top = '18%';
    frame.style.width = '64%';
    frame.style.height = '64%';
  }

  function getCropCanvasMetrics() {
    const stage = $('#cropStage');
    const rect = stage.getBoundingClientRect();
    const canvas = $('#cropCanvas');
    const dpr = Math.max(1, window.devicePixelRatio || 1);

    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);

    return {rect, canvas, dpr};
  }

  function drawCropCanvas() {
    if (!cropState.image) return;

    const {rect, canvas, dpr} = getCropCanvasMetrics();
    const ctx = canvas.getContext('2d');

    ctx.setTransform(dpr,0,0,dpr,0,0);
    ctx.clearRect(0,0,rect.width,rect.height);

    const rotated = cropState.rotation % 180 !== 0;
    const imageW = rotated ? cropState.image.height : cropState.image.width;
    const imageH = rotated ? cropState.image.width : cropState.image.height;

    const baseScale = Math.min(rect.width / imageW, rect.height / imageH);
    const scale = baseScale * cropState.zoom;
    const drawW = cropState.image.width * scale;
    const drawH = cropState.image.height * scale;

    ctx.save();
    ctx.translate(rect.width/2 + cropState.offsetX, rect.height/2 + cropState.offsetY);
    ctx.rotate(cropState.rotation * Math.PI / 180);
    ctx.drawImage(cropState.image, -drawW/2, -drawH/2, drawW, drawH);
    ctx.restore();
  }

  function hasImageTransparency(image) {
    const c = document.createElement('canvas');
    const maxSide = 300;
    const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
    c.width = Math.max(1, Math.round(image.width * scale));
    c.height = Math.max(1, Math.round(image.height * scale));
    const x = c.getContext('2d', {willReadFrequently:true});
    x.drawImage(image,0,0,c.width,c.height);
    return hasTransparency(x.getImageData(0,0,c.width,c.height));
  }

  function cropSelectionToImage(useWhole = false) {
    const stageRect = $('#cropStage').getBoundingClientRect();
    const frameRect = $('#cropFrame').getBoundingClientRect();

    const selection = useWhole ? {
      x:0, y:0, width:stageRect.width, height:stageRect.height
    } : {
      x:frameRect.left-stageRect.left,
      y:frameRect.top-stageRect.top,
      width:frameRect.width,
      height:frameRect.height
    };

    const outputScale = 2;
    const out = document.createElement('canvas');
    out.width = Math.max(1, Math.round(selection.width * outputScale));
    out.height = Math.max(1, Math.round(selection.height * outputScale));
    const octx = out.getContext('2d');

    const preview = document.createElement('canvas');
    preview.width = Math.round(stageRect.width * outputScale);
    preview.height = Math.round(stageRect.height * outputScale);
    const pctx = preview.getContext('2d');

    const rotated = cropState.rotation % 180 !== 0;
    const imageW = rotated ? cropState.image.height : cropState.image.width;
    const imageH = rotated ? cropState.image.width : cropState.image.height;
    const baseScale = Math.min(stageRect.width / imageW, stageRect.height / imageH);
    const scale = baseScale * cropState.zoom * outputScale;
    const drawW = cropState.image.width * scale;
    const drawH = cropState.image.height * scale;

    pctx.save();
    pctx.translate(
      stageRect.width*outputScale/2 + cropState.offsetX*outputScale,
      stageRect.height*outputScale/2 + cropState.offsetY*outputScale
    );
    pctx.rotate(cropState.rotation * Math.PI / 180);
    pctx.drawImage(cropState.image, -drawW/2, -drawH/2, drawW, drawH);
    pctx.restore();

    octx.drawImage(
      preview,
      selection.x*outputScale,
      selection.y*outputScale,
      selection.width*outputScale,
      selection.height*outputScale,
      0,0,out.width,out.height
    );

    const croppedDataUrl = out.toDataURL('image/png');
    const croppedImage = new Image();

    croppedImage.onload = () => {
      processRasterAfterCrop(
        cropState.file,
        croppedImage,
        croppedDataUrl,
        cropState.originalDataUrl,
        {
          x:selection.x/stageRect.width,
          y:selection.y/stageRect.height,
          width:selection.width/stageRect.width,
          height:selection.height/stageRect.height,
          rotation:cropState.rotation,
          zoom:cropState.zoom,
          usedWhole:useWhole
        }
      );
    };

    croppedImage.src = croppedDataUrl;
    closeCropModal();
  }

  function processRasterAfterCrop(file, image, croppedDataUrl, originalDataUrl, cropMeta) {
    const ext = file.name.split('.').pop().toLowerCase();
    const result = rasterToSvg(image, ext);

    if (!result || !result.svgSource) {
      showFileCard(
        file,
        `${ext.toUpperCase()} · ${image.width} × ${image.height} px`,
        'Не удалось автоматически подготовить вектор',
        true
      );
      return;
    }

    state.originalRaster = {
      name: file.name,
      type: file.type,
      width: cropState.image ? cropState.image.width : image.width,
      height: cropState.image ? cropState.image.height : image.height,
      data: originalDataUrl,
      crop: cropMeta
    };

    state.traceInfo = result;
    state.logoSvgSource = result.svgSource;
    state.logoType = 'svg-auto';
    state.logo = {
      data: recolorSvgSource(result.svgSource),
      ratio: result.ratio
    };

    const minSide = Math.min(image.width, image.height);
    const warning = minSide < 700 || result.warning;

    showFileCard(
      file,
      `${ext.toUpperCase()} · выделено ${image.width} × ${image.height} px`,
      warning
        ? 'Макет преобразован в SVG — контуры проверим вручную'
        : 'Изображение автоматически преобразовано в SVG',
      warning
    );

    showTraceStatus(result);
    refreshSvgColor();
    render();
    updateShowcaseContent();
    updateProductShowcase();
  }

  function initCropInteractions() {
    const stage = $('#cropStage');
    const frame = $('#cropFrame');

    const pointer = (event) => {
      const rect = stage.getBoundingClientRect();
      return {x:event.clientX-rect.left,y:event.clientY-rect.top};
    };

    stage.addEventListener('pointerdown', (event) => {
      if (!cropState.image) return;
      const handle = event.target.closest('.crop-handle');
      const p = pointer(event);

      cropState.dragStartX = p.x;
      cropState.dragStartY = p.y;

      if (handle) {
        cropState.dragMode = 'resize';
        cropState.activeHandle = handle.dataset.handle;
        cropState.startFrame = {
          left:parseFloat(frame.style.left),
          top:parseFloat(frame.style.top),
          width:parseFloat(frame.style.width),
          height:parseFloat(frame.style.height)
        };
      } else if (event.target === frame || frame.contains(event.target)) {
        cropState.dragMode = 'frame';
        cropState.startFrame = {
          left:parseFloat(frame.style.left),
          top:parseFloat(frame.style.top),
          width:parseFloat(frame.style.width),
          height:parseFloat(frame.style.height)
        };
      } else {
        cropState.dragMode = 'image';
        cropState.startOffsetX = cropState.offsetX;
        cropState.startOffsetY = cropState.offsetY;
      }

      stage.setPointerCapture(event.pointerId);
    });

    stage.addEventListener('pointermove', (event) => {
      if (!cropState.dragMode) return;

      const stageRect = stage.getBoundingClientRect();
      const p = pointer(event);
      const dx = p.x-cropState.dragStartX;
      const dy = p.y-cropState.dragStartY;

      if (cropState.dragMode === 'image') {
        cropState.offsetX = cropState.startOffsetX+dx;
        cropState.offsetY = cropState.startOffsetY+dy;
        drawCropCanvas();
        return;
      }

      if (!cropState.startFrame) return;

      const dxPct = dx/stageRect.width*100;
      const dyPct = dy/stageRect.height*100;
      let {left,top,width,height} = cropState.startFrame;

      if (cropState.dragMode === 'frame') {
        left += dxPct;
        top += dyPct;
      } else {
        const h = cropState.activeHandle;
        if (h.includes('w')) {left += dxPct;width -= dxPct}
        if (h.includes('e')) width += dxPct;
        if (h.includes('n')) {top += dyPct;height -= dyPct}
        if (h.includes('s')) height += dyPct;
      }

      width = Math.max(12,Math.min(96,width));
      height = Math.max(12,Math.min(96,height));
      left = Math.max(0,Math.min(100-width,left));
      top = Math.max(0,Math.min(100-height,top));

      frame.style.left = left+'%';
      frame.style.top = top+'%';
      frame.style.width = width+'%';
      frame.style.height = height+'%';
    });

    const finish = (event) => {
      cropState.dragMode = null;
      cropState.activeHandle = null;
      try {stage.releasePointerCapture(event.pointerId)} catch {}
    };

    stage.addEventListener('pointerup', finish);
    stage.addEventListener('pointercancel', finish);

    $('#cropZoom').addEventListener('input', (event) => {
      cropState.zoom = Number(event.target.value)/100;
      drawCropCanvas();
    });

    $('#cropRotate').addEventListener('click', () => {
      cropState.rotation = (cropState.rotation+90)%360;
      cropState.offsetX = 0;
      cropState.offsetY = 0;
      drawCropCanvas();
    });

    $('#cropApply').addEventListener('click', () => cropSelectionToImage(false));
    $('#cropUseAll').addEventListener('click', () => cropSelectionToImage(true));
    $('#cropCancel').addEventListener('click', closeCropModal);

    window.addEventListener('resize', () => {
      if ($('#cropModal').classList.contains('open')) drawCropCanvas();
    });
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

        state.originalRaster = null;
        state.traceInfo = null;
        if ($('#traceStatus')) $('#traceStatus').hidden = true;
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
          const transparentPng = ext === 'png' && hasImageTransparency(image);

          if (transparentPng) {
            processRasterAfterCrop(
              file,
              image,
              reader.result,
              reader.result,
              {x:0, y:0, width:1, height:1, rotation:0, zoom:1, usedWhole:true}
            );
          } else {
            openCropModal(file, image, reader.result);
          }
        };

        image.onerror = () => {
          showFileCard(
            file,
            ext.toUpperCase(),
            'Не удалось прочитать изображение',
            true
          );
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
    if ($('#meters')) $('#meters').disabled = state.meters === 0;
    if ($('#stickerQty')) $('#stickerQty').disabled = state.stickerQty === 0;
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
      updateShowcaseContent();
    })
  );

  $$('#bundleChoice button').forEach((button) =>
    button.addEventListener('click', () => {
      activate('#bundleChoice', button);
      setProductSelection({
        ribbon: button.dataset.value !== 'sticker',
        sticker: button.dataset.value !== 'ribbon'
      });
    })
  );

  document.addEventListener('studio:product-selection-change', (event) => {
    setProductSelection({
      ribbon: Boolean(event.detail?.ribbon),
      sticker: Boolean(event.detail?.sticker)
    });
  });

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
    updateShowcaseContent();
  });

  $('#fontSelect').addEventListener('change', (event) => {
    state.font = event.target.value;
    render();
    updateShowcaseContent();
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
    if (state.meters > 0) state.lastMeters = state.meters;
    render();
  });

  $('#stickerQty').addEventListener('input', (event) => {
    state.stickerQty = +event.target.value;
    if (state.stickerQty > 0) state.lastStickerQty = state.stickerQty;
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
    state.logoScale = rec.logoScale;
    state.logoOffsetX = 0;
    setProductSelection({ribbon: true, sticker: true});
  });

  $('#resetProject').addEventListener('click', () => {
    localStorage.removeItem('ribbon-studio-v042');
    location.reload();
  });

  initCropInteractions();
  restoreState();
  loadDefaultLogo();
  syncControls();
  render();
  updateShowcaseContent();
  updateProductShowcase();
});
