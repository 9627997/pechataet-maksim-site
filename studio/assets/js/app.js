
document.addEventListener('DOMContentLoaded', () => {
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];
  const NS = 'http://www.w3.org/2000/svg';
  const {
    getRibbonPrintableGeometry,
    getStickerPrintableGeometry,
  } = window.RibbonStudioGeometry;
  const {
    getRibbonContentLayout,
    getStickerContentLayout,
  } = window.RibbonStudioLayout;
  const textMeasureContext = document.createElement('canvas').getContext('2d');
  let currentLayouts = {ribbon: null, sticker: null};
  let textMeasurementSvg = null;

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
    content: {
      logo: {
        common: null,
        ribbon: {mode: 'inherit'},
        sticker: {mode: 'inherit'}
      },
      text: {
        common: '',
        ribbon: {mode: 'inherit'},
        sticker: {mode: 'inherit'}
      }
    },
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
  let hasUsedCommonTextEditor = false;
  let hasUsedCommonLogoEditor = false;
  let pendingLogoTarget = 'common';

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
    activeHandle: null,
    target: 'common'
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

  function normalizeContentOverride(value, kind) {
    if (!value || value.mode !== 'override') return {mode: 'inherit'};
    if (kind === 'text' && typeof value.value === 'string') {
      return {mode: 'override', value: value.value};
    }
    if (
      kind === 'logo' &&
      (value.value === null ||
        (typeof value.value === 'object' && !Array.isArray(value.value)))
    ) {
      return {mode: 'override', value: value.value};
    }
    return {mode: 'inherit'};
  }

  function legacyLogoContent(source = state) {
    const hasLogoContent = Boolean(
      source.logo ||
      source.logoType ||
      source.logoSvgSource ||
      source.originalRaster ||
      source.traceInfo
    );
    if (!hasLogoContent) return null;

    return {
      logo: source.logo || null,
      logoType: source.logoType || null,
      logoSvgSource: source.logoSvgSource || null,
      originalRaster: source.originalRaster || null,
      traceInfo: source.traceInfo || null
    };
  }

  function normalizeContentModel(content, legacySource = state) {
    const textContent = content?.text;
    const logoContent = content?.logo;
    return {
      logo: {
        common:
          logoContent &&
          Object.prototype.hasOwnProperty.call(logoContent, 'common') &&
          (logoContent.common === null ||
            (typeof logoContent.common === 'object' && !Array.isArray(logoContent.common)))
            ? logoContent.common
            : legacyLogoContent(legacySource),
        ribbon: normalizeContentOverride(logoContent?.ribbon, 'logo'),
        sticker: normalizeContentOverride(logoContent?.sticker, 'logo')
      },
      text: {
        common:
          typeof textContent?.common === 'string'
            ? textContent.common
            : typeof legacySource.text === 'string' ? legacySource.text : '',
        ribbon: normalizeContentOverride(textContent?.ribbon, 'text'),
        sticker: normalizeContentOverride(textContent?.sticker, 'text')
      }
    };
  }

  function syncLegacyContentAliasesFromContent() {
    state.text = state.content.text.common;
    const commonLogo = state.content.logo.common;
    hydrateLogoAsset(commonLogo);
    ['ribbon', 'sticker'].forEach((product) => {
      const override = state.content.logo[product];
      if (override.mode === 'override') hydrateLogoAsset(override.value);
    });
    state.logoType = commonLogo?.logoType || null;
    state.logoSvgSource = commonLogo?.logoSvgSource || null;
    state.originalRaster = commonLogo?.originalRaster || null;
    state.traceInfo = commonLogo?.traceInfo || null;
    state.logo = commonLogo?.logo || null;
    if (state.logo && !state.logo.data && state.logoSvgSource) {
      state.logo = {
        ...state.logo,
        data: recolorSvgSource(state.logoSvgSource)
      };
      commonLogo.logo = state.logo;
    }
  }

  function syncCommonContentFromLegacyAliases() {
    state.content.text.common = typeof state.text === 'string' ? state.text : '';
    state.content.logo.common = legacyLogoContent();
  }

  function getResolvedText(product) {
    const override = state.content.text[product];
    return override?.mode === 'override' ? override.value : state.content.text.common;
  }

  function setCommonText(value) {
    const common = typeof value === 'string' ? value : '';
    state.content.text.common = common;
    state.text = common;
    render();
  }

  function setTextOverride(product, value) {
    if (!['ribbon', 'sticker'].includes(product)) return;
    state.content.text[product] = {
      mode: 'override',
      value: typeof value === 'string' ? value : ''
    };
    render();
  }

  function clearTextOverride(product) {
    if (!['ribbon', 'sticker'].includes(product)) return;
    state.content.text[product] = {mode: 'inherit'};
    render();
  }

  function getResolvedLogo(product) {
    const override = state.content.logo[product];
    return override?.mode === 'override' ? override.value : state.content.logo.common;
  }

  function normalizeLogoTarget(target) {
    return ['common', 'ribbon', 'sticker'].includes(target) ? target : 'common';
  }

  function setPendingLogoTarget(target) {
    pendingLogoTarget = normalizeLogoTarget(target);
  }

  function openLogoPicker(target) {
    setPendingLogoTarget(target);
    const input = $('#logoInput');
    input.value = '';
    input.click();
  }

  function returnToMobilePreview() {
    if (!window.matchMedia('(max-width: 700px)').matches) return;
    const previewContainer = $('.mobile-products-preview');
    if (!previewContainer) return;

    document.activeElement?.blur();
    requestAnimationFrame(() => {
      setTimeout(() => {
        const rect = previewContainer.getBoundingClientRect();
        const approximatelyVisible =
          rect.top >= -120 && rect.bottom <= window.innerHeight + 120;
        if (approximatelyVisible) return;

        previewContainer.scrollIntoView({behavior: 'smooth', block: 'center'});
      }, 150);
    });
  }

  function clearLogoOverride(product) {
    if (!['ribbon', 'sticker'].includes(product)) return;
    state.content.logo[product] = {mode: 'inherit'};
    render();
  }

  function commitLogoAsset(asset, target) {
    const normalizedTarget = normalizeLogoTarget(target);
    if (normalizedTarget === 'common') {
      state.content.logo.common = asset;
      syncLegacyContentAliasesFromContent();
    } else {
      state.content.logo[normalizedTarget] = {mode: 'override', value: asset};
    }
    render();
    returnToMobilePreview();
  }

  function hydrateLogoAsset(asset, color = state.print) {
    if (!asset?.logo || asset.logo.data || !asset.logoSvgSource) return asset;
    const data = recolorSvgSource(asset.logoSvgSource, color);
    if (data) asset.logo = {...asset.logo, data};
    return asset;
  }

  function summarizeLogoContent(value) {
    if (value === null) return null;
    return {
      hasLogo: Boolean(value?.logo),
      ratio: value?.logo?.ratio ?? null,
      logoType: value?.logoType || null,
      hasSvgSource: Boolean(value?.logoSvgSource),
      hasOriginalRaster: Boolean(value?.originalRaster),
      hasTraceInfo: Boolean(value?.traceInfo)
    };
  }

  function publishContentSnapshot() {
    const summarizeOverride = (override, kind) => ({
      mode: override.mode,
      ...(override.mode === 'override'
        ? {value: kind === 'logo' ? summarizeLogoContent(override.value) : override.value}
        : {})
    });
    document.body.dataset.studioContent = JSON.stringify({
      logo: {
        common: summarizeLogoContent(state.content.logo.common),
        ribbon: summarizeOverride(state.content.logo.ribbon, 'logo'),
        sticker: summarizeOverride(state.content.logo.sticker, 'logo'),
        resolvedRibbon: summarizeLogoContent(getResolvedLogo('ribbon')),
        resolvedSticker: summarizeLogoContent(getResolvedLogo('sticker'))
      },
      text: {
        common: state.content.text.common,
        ribbon: summarizeOverride(state.content.text.ribbon, 'text'),
        sticker: summarizeOverride(state.content.text.sticker, 'text'),
        resolvedRibbon: getResolvedText('ribbon'),
        resolvedSticker: getResolvedText('sticker')
      }
    });
  }

  function publishContentState() {
    const summarizeResolvedLogo = (product) => {
      const asset = getResolvedLogo(product);
      return {
        mode: state.content.logo[product].mode,
        hasLogo: Boolean(asset?.logo),
        logoType: asset?.logoType || null,
        ratio: asset?.logo?.ratio ?? null
      };
    };
    document.dispatchEvent(
      new CustomEvent('studio:content-state-updated', {
        detail: {
          logo: {
            common: {
              hasLogo: Boolean(state.content.logo.common?.logo),
              logoType: state.content.logo.common?.logoType || null,
              ratio: state.content.logo.common?.logo?.ratio ?? null
            },
            ribbon: summarizeResolvedLogo('ribbon'),
            sticker: summarizeResolvedLogo('sticker')
          },
          text: {
            common: state.content.text.common,
            ribbon: {
              mode: state.content.text.ribbon.mode,
              resolved: getResolvedText('ribbon')
            },
            sticker: {
              mode: state.content.text.sticker.mode,
              resolved: getResolvedText('sticker')
            }
          }
        }
      })
    );
  }

  function contentForStorage() {
    const stripDerivedData = (value) => {
      if (!value?.logo) return value;
      return {...value, logo: {...value.logo, data: null}};
    };
    const storeOverride = (override) =>
      override.mode === 'override'
        ? {mode: 'override', value: stripDerivedData(override.value)}
        : {mode: 'inherit'};
    return {
      logo: {
        common: stripDerivedData(state.content.logo.common),
        ribbon: storeOverride(state.content.logo.ribbon),
        sticker: storeOverride(state.content.logo.sticker)
      },
      text: {
        common: state.content.text.common,
        ribbon: {...state.content.text.ribbon},
        sticker: {...state.content.text.sticker}
      }
    };
  }

  function saveState() {
    syncCommonContentFromLegacyAliases();
    publishContentSnapshot();
    const copy = {
      ...state,
      logo: null,
      logoType: null,
      logoSvgSource: null,
      originalRaster: null,
      traceInfo: null,
      content: contentForStorage()
    };
    localStorage.setItem('ribbon-studio-v042', JSON.stringify(copy));
  }

  function restoreState() {
    try {
      const restored = JSON.parse(localStorage.getItem('ribbon-studio-v042') || '{}');
      Object.assign(state, restored);
      if (![25, 30, 40, 50].includes(Number(state.stickerSize))) {
        state.stickerSize = 40;
      }

      const legacyDemoTexts = ['привет', 'печатаетмаксим', 'сделано красиво'];
      if (legacyDemoTexts.includes((state.text || '').trim().toLowerCase())) {
        state.text = 'ленты по любви';
      }
      state.content = normalizeContentModel(restored.content, state);
      syncLegacyContentAliasesFromContent();

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
    syncCommonContentFromLegacyAliases();
  }


  function recolorLogoForShowcase(asset, color) {
    if (!asset?.logo) return null;

    if (['svg', 'svg-auto'].includes(asset.logoType) && asset.logoSvgSource) {
      return recolorSvgSource(asset.logoSvgSource, color);
    }

    return asset.logo.data;
  }

  function updateShowcaseContent() {
    const onUpload = state.panel === 'upload';

    $$('.dynamic-showcase-text').forEach((el) => {
      const product = el.closest('[data-product-type]')?.dataset.productType;
      const textValue = getResolvedText(product === 'sticker' ? 'sticker' : 'ribbon').trim();
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

        const product = root.dataset.productType === 'sticker' ? 'sticker' : 'ribbon';
        const fixedLogo = recolorLogoForShowcase(getResolvedLogo(product), item.print);

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

      refreshSvgColor();
      $$('.dynamic-showcase-logo').forEach((img) => {
        const product =
          img.closest('[data-product-type]')?.dataset.productType === 'sticker'
            ? 'sticker'
            : 'ribbon';
        const asset = getResolvedLogo(product);
        if (asset?.logo?.data) {
          img.src = asset.logo.data;
          img.hidden = false;
          img.style.filter = 'none';
        } else {
          img.hidden = true;
          img.removeAttribute('src');
        }
      });
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

  function drawText(parent, x, y, size, value, anchor = 'middle') {
    if (!value) return;

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

    text.textContent = value;
    parent.appendChild(text);
    return text;
  }

  function measureTextBox(text, size = 100) {
    textMeasureContext.font = `700 ${size}px ${state.font}`;
    const metrics = textMeasureContext.measureText(text || '');
    const ascent = metrics.actualBoundingBoxAscent || size * 0.8;
    const descent = metrics.actualBoundingBoxDescent || size * 0.2;
    return {width: metrics.width, height: ascent + descent};
  }

  function getTextMetrics(text) {
    if (!textMeasurementSvg) {
      textMeasurementSvg = svgEl('svg', {
        width: 1,
        height: 1,
        'aria-hidden': 'true',
      });
      Object.assign(textMeasurementSvg.style, {
        position: 'fixed',
        left: '-10000px',
        top: '0',
        visibility: 'hidden',
        pointerEvents: 'none',
      });
      document.body.appendChild(textMeasurementSvg);
    }
    const sample = svgEl('text', {
      x: 0,
      y: 100,
      'font-family': state.font,
      'font-size': 100,
      'font-weight': '700',
    });
    sample.textContent = text || '';
    textMeasurementSvg.replaceChildren(sample);
    const bbox = sample.getBBox();
    const measured = bbox.width && bbox.height
      ? {width: bbox.width, height: bbox.height}
      : measureTextBox(text, 100);
    return {
      widthPerSize: measured.width / 100,
      heightPerSize: measured.height / 100,
    };
  }

  function drawLogoBox(parent, asset, box) {
    if (!asset?.logo || !box) return null;
    const image = svgEl('image', {
      x: box.x,
      y: box.y,
      width: box.width,
      height: box.height,
      preserveAspectRatio: 'xMidYMid meet',
    });
    image.dataset.effectiveScale = String(box.scale);
    image.setAttribute('href', asset.logo.data);
    parent.appendChild(image);
    return image;
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

    if ($('#ribbonBase')) $('#ribbonBase').setAttribute('fill', state.ribbon);

    const layer = $('#ribbonContent');
    if (!layer) return;
    layer.innerHTML = '';

    const repeatWidth = Math.max(360, state.repeatMm * 6.2);
    const printable = getRibbonPrintableGeometry({
      widthMm: state.width,
      repeatMm: state.repeatMm,
      x: 0,
      y,
      width: repeatWidth,
      height,
    });
    const guideRect = $('#ribbonPrintableGuide rect');
    if (guideRect) {
      guideRect.setAttribute('x', 28 + printable.bounds.x);
      guideRect.setAttribute('y', printable.bounds.y);
      guideRect.setAttribute(
        'width',
        1144 - 2 * printable.bounds.x,
      );
      guideRect.setAttribute('height', printable.bounds.height);
    }
    const resolvedLogo = getResolvedLogo('ribbon');
    const hasLogo = Boolean(resolvedLogo?.logo);
    const resolvedText = getResolvedText('ribbon');
    const hasText = Boolean(resolvedText.trim());
    const ribbonLayout = getRibbonContentLayout({
      bounds: printable.bounds,
      centerY: 130,
      logo: hasLogo ? {ratio: Number(resolvedLogo.logo.ratio) || 1} : null,
      text: hasText ? resolvedText : '',
      textMetrics: getTextMetrics(resolvedText),
      logoScale: state.logoScale,
      logoOffsetX: state.logoOffsetX,
      preferredFontSize:
        (state.width === 20 ? 39 : 31) * (state.fontSize / 32),
    });
    currentLayouts.ribbon = {
      ...ribbonLayout,
      outer: {x: 0, y, width: repeatWidth, height},
      printable,
    };

    for (let startX = -30; startX < 1260; startX += repeatWidth) {
      const cell = svgEl('g');

      const clipId = `repeat-clip-${Math.round(startX)}`;
      const defs = svgEl('defs');
      const clipPath = svgEl('clipPath', {id: clipId});

      clipPath.appendChild(svgEl('rect', {
        x: startX + printable.bounds.x,
        y: printable.bounds.y,
        width: printable.bounds.width,
        height: printable.bounds.height
      }));

      defs.appendChild(clipPath);
      cell.appendChild(defs);

      const content = svgEl('g', {'clip-path': `url(#${clipId})`});

      if (ribbonLayout.logoBox) {
        drawLogoBox(content, resolvedLogo, {
          ...ribbonLayout.logoBox,
          x: startX + ribbonLayout.logoBox.x,
        });
      }
      if (ribbonLayout.valid && ribbonLayout.textBox) {
        const text = drawText(
          content,
          startX + ribbonLayout.textBox.x + ribbonLayout.textBox.width / 2,
          ribbonLayout.textBox.y + ribbonLayout.textBox.height / 2,
          ribbonLayout.fontSize,
          resolvedText,
        );
        text.dataset.effectiveFontSize = String(ribbonLayout.fontSize);
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

    const resolvedLogo = getResolvedLogo('sticker');
    const hasLogo = Boolean(resolvedLogo?.logo);
    const resolvedText = getResolvedText('sticker');
    const hasText = Boolean(resolvedText.trim());
    const printable = getStickerPrintableGeometry({
      diameterMm: state.stickerSize,
      cx: 200,
      cy: 200,
      radius: 178,
    });
    const guideCircle = $('#stickerPrintableGuide circle');
    if (guideCircle) guideCircle.setAttribute('r', printable.circle.radius);
    const stickerPreferred = {
      25: {combined: 19, textOnly: 24},
      30: {combined: 22, textOnly: 28},
      40: {combined: 27, textOnly: 35},
      50: {combined: 31, textOnly: 40},
    }[state.stickerSize];

    const stickerLayout = getStickerContentLayout({
      circle: printable.circle,
      logo: hasLogo ? {ratio: Number(resolvedLogo.logo.ratio) || 1} : null,
      text: hasText ? resolvedText : '',
      textMetrics: getTextMetrics(resolvedText),
      logoScale: state.logoScale,
      preferredFontSize: hasLogo && hasText
        ? stickerPreferred.combined * (state.fontSize / 32)
        : stickerPreferred.textOnly * (state.fontSize / 32),
    });
    currentLayouts.sticker = {
      ...stickerLayout,
      outer: {x: 22, y: 22, width: 356, height: 356},
      printable,
    };
    if (stickerLayout.logoBox) {
      drawLogoBox(layer, resolvedLogo, stickerLayout.logoBox);
    }
    if (stickerLayout.valid && stickerLayout.textBox) {
      const text = drawText(
        layer,
        stickerLayout.textBox.x + stickerLayout.textBox.width / 2,
        stickerLayout.textBox.y + stickerLayout.textBox.height / 2,
        stickerLayout.fontSize,
        resolvedText,
      );
      text.dataset.effectiveFontSize = String(stickerLayout.fontSize);
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
    const stickerPriceUnavailable =
      state.stickerQty > 0 && state.stickerSize === 25;
    const stickerBase = state.stickerQty > 0 && !stickerPriceUnavailable
      ? ({50: 450, 100: 700, 250: 1350, 500: 2200}[state.stickerQty] || 0)
      : 0;

    return {
      amount: ribbonBase + widthExtra + stickerBase,
      unavailable: stickerPriceUnavailable,
    };
  }

  function normalizeLayout(layout) {
    if (!layout) return null;
    const {outer} = layout;
    const normalizeBox = (box) =>
      box
        ? {
            x: (box.x - outer.x) / outer.width,
            y: (box.y - outer.y) / outer.height,
            width: box.width / outer.width,
            height: box.height / outer.height,
          }
        : null;
    return {
      valid: layout.valid,
      reason: layout.reason || null,
      logoBox: normalizeBox(layout.logoBox),
      textBox: normalizeBox(layout.textBox),
      fontSizeRatio: layout.fontSize / outer.height,
      printable: layout.bounds
        ? normalizeBox(layout.bounds)
        : {
            cx: (layout.circle.cx - outer.x) / outer.width,
            cy: (layout.circle.cy - outer.y) / outer.height,
            radius: layout.circle.radius / outer.width,
          },
    };
  }

  function positionPreviewContent(root, image, text, layout, textValue) {
    if (!root || !layout) return;
    root.dataset.layoutValid = String(layout.valid);
    root.dataset.layout = JSON.stringify(layout);
    if (image && layout.logoBox) {
      image.style.left = `${(layout.logoBox.x + layout.logoBox.width / 2) * 100}%`;
      image.style.top = `${(layout.logoBox.y + layout.logoBox.height / 2) * 100}%`;
      image.style.width = `${layout.logoBox.width * 100}%`;
      image.style.height = `${layout.logoBox.height * 100}%`;
      image.style.transform = 'translate(-50%, -50%)';
    }
    if (text) {
      const showText = Boolean(layout.valid && layout.textBox && textValue.trim());
      text.hidden = !showText;
      if (showText) {
        text.style.left = `${(layout.textBox.x + layout.textBox.width / 2) * 100}%`;
        text.style.top = `${(layout.textBox.y + layout.textBox.height / 2) * 100}%`;
        text.style.width = `${layout.textBox.width * 100}%`;
        text.style.height = `${layout.textBox.height * 100}%`;
        text.style.setProperty(
          'font-size',
          `${layout.fontSizeRatio * root.getBoundingClientRect().height}px`,
          'important',
        );
      }
    }
  }

  function publishEffectiveLayouts() {
    const layouts = {
      ribbon: normalizeLayout(currentLayouts.ribbon),
      sticker: normalizeLayout(currentLayouts.sticker),
    };
    document.body.dataset.studioLayout = JSON.stringify(layouts);
    document.body.style.setProperty(
      '--ribbon-repeat-margin-percent',
      `${layouts.ribbon.printable.x * 100}%`,
    );
    document.body.style.setProperty(
      '--ribbon-print-margin-percent',
      `${layouts.ribbon.printable.y * 100}%`,
    );
    document.body.style.setProperty(
      '--sticker-print-margin-percent',
      `${(0.5 - layouts.sticker.printable.radius) * 100}%`,
    );
    const ribbon15 = getRibbonPrintableGeometry({
      widthMm: 15,
      repeatMm: state.repeatMm,
      width: state.repeatMm,
      height: 15,
    });
    const ribbon20 = getRibbonPrintableGeometry({
      widthMm: 20,
      repeatMm: state.repeatMm,
      width: state.repeatMm,
      height: 20,
    });
    document.body.style.setProperty(
      '--ribbon-15-margin-percent',
      `${(ribbon15.bounds.y / 15) * 100}%`,
    );
    document.body.style.setProperty(
      '--ribbon-20-margin-percent',
      `${(ribbon20.bounds.y / 20) * 100}%`,
    );
    positionPreviewContent(
      $('#macroLogo'),
      $('#macroLogoImage'),
      $('#macroLogoText'),
      layouts.ribbon,
      getResolvedText('ribbon'),
    );
    positionPreviewContent(
      $('.macro-sticker-paper'),
      $('#macroStickerImage'),
      $('#macroStickerText'),
      layouts.sticker,
      getResolvedText('sticker'),
    );
    positionPreviewContent(
      $('.box-ribbon-content'),
      $('#boxRibbonImage'),
      $('#boxRibbonText'),
      layouts.ribbon,
      getResolvedText('ribbon'),
    );
    positionPreviewContent(
      $('.box-sticker-content'),
      $('#boxStickerImage'),
      $('#boxStickerText'),
      layouts.sticker,
      getResolvedText('sticker'),
    );
    const invalid = [
      state.bundle !== 'sticker' && !layouts.ribbon.valid ? 'ribbon' : null,
      state.bundle !== 'ribbon' && !layouts.sticker.valid ? 'sticker' : null,
    ].filter(Boolean);
    const validation = $('#artworkValidation');
    if (validation) {
      validation.hidden = invalid.length === 0;
      validation.textContent = invalid.length
        ? 'Текст не помещается в печатную область. Сократите надпись.'
        : '';
    }
    document.body.dataset.artworkValid = String(invalid.length === 0);
    $('#downloadOrder').disabled = invalid.length > 0;
    document.dispatchEvent(
      new CustomEvent('studio:layout-updated', {detail: layouts}),
    );
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
      publishEffectiveLayouts();
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

  function getSceneScale(sceneName, asset) {
    if (!asset?.logo) return 1;

    const ratio = Number(asset.logo.ratio) || 1;
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

    const ribbonTextValue = getResolvedText('ribbon');
    const stickerTextValue = getResolvedText('sticker');
    const ribbonLogo = getResolvedLogo('ribbon');
    const stickerLogo = getResolvedLogo('sticker');

    const macroImage = $('#macroLogoImage');
    const macroText = $('#macroLogoText');
    const macroStickerImage = $('#macroStickerImage');
    const macroStickerText = $('#macroStickerText');
    const boxRibbonImage = $('#boxRibbonImage');
    const boxRibbonText = $('#boxRibbonText');
    const boxStickerImage = $('#boxStickerImage');
    const boxStickerText = $('#boxStickerText');

    const updateLogoElements = (elements, asset) => {
      elements.forEach((image) => {
        if (!image) return;
        if (asset?.logo?.data) {
          if (image.getAttribute('src') !== asset.logo.data) image.src = asset.logo.data;
          image.hidden = false;
        } else {
          image.hidden = true;
          image.removeAttribute('src');
        }
      });
    };
    updateLogoElements([macroImage, boxRibbonImage], ribbonLogo);
    updateLogoElements([macroStickerImage, boxStickerImage], stickerLogo);

    const updateTextElements = (elements, value) => {
      const hasText = Boolean(value.trim());
      elements.forEach((text) => {
        if (!text) return;
        text.hidden = !hasText;
        text.textContent = value;
        text.style.color = state.print;
        text.style.fontFamily = state.font;
      });
    };
    updateTextElements([macroText, boxRibbonText], ribbonTextValue);
    updateTextElements([macroStickerText, boxStickerText], stickerTextValue);

    if (macroImage) {
      macroImage.style.transform = `translateX(${state.logoOffsetX}px) scale(${getSceneScale('macro', ribbonLogo)})`;
    }
    if (macroStickerImage) {
      macroStickerImage.style.transform = `scale(${Math.min(getSceneScale('sticker', stickerLogo), 1)})`;
    }

    const updateCompositionState = (elements, value, asset) => {
      const hasLogo = Boolean(asset?.logo);
      const hasText = Boolean(value.trim());
      elements.forEach((element) => {
        if (!element) return;
        element.classList.toggle('has-logo-and-text', hasLogo && hasText);
        element.classList.toggle('has-logo-only', hasLogo && !hasText);
        element.classList.toggle('has-text-only', !hasLogo && hasText);
      });
    };
    updateCompositionState(
      [$('#macroLogo'), $('.box-ribbon-content')],
      ribbonTextValue,
      ribbonLogo
    );
    updateCompositionState(
      [$('.macro-sticker-paper'), $('.box-sticker-content')],
      stickerTextValue,
      stickerLogo
    );
    if (boxRibbonImage) {
      boxRibbonImage.style.transform = `translateX(${state.logoOffsetX * 0.35}px) scale(${getSceneScale('ribbon', ribbonLogo)})`;
    }
    if (boxStickerImage) {
      boxStickerImage.style.transform = `scale(${getSceneScale('sticker', stickerLogo)})`;
    }
  }

  function getStickerScale() {
    return {25: 0.625, 30: 0.78, 40: 1, 50: 1.22}[state.stickerSize] || 1;
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
    const resolvedLogos = [getResolvedLogo('ribbon'), getResolvedLogo('sticker')].filter(
      (asset) => asset?.logo
    );
    const ratios = resolvedLogos.map((asset) => Number(asset.logo.ratio) || 1);
    const widestRatio = ratios.length ? Math.max(...ratios) : 1;
    const tallestRatio = ratios.length ? Math.min(...ratios) : 1;
    const ratio = widestRatio > 2.8 ? widestRatio : tallestRatio;
    const textLength = Math.max(
      getResolvedText('ribbon').trim().length,
      getResolvedText('sticker').trim().length
    );

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
    } else if (!resolvedLogos.length && textLength <= 10) {
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
    // The existing upload pipeline writes the legacy common aliases.
    syncCommonContentFromLegacyAliases();
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
    publishEffectiveLayouts();

    if ($('#status')) {
      $('#status').textContent =
        `Лента ${state.width} мм · ${state.bundle === 'bundle' ? 'стикер Ø' + state.stickerSize + ' мм · ' : ''}шаг ${state.repeatMm} мм`;
    }

    if ($('#orderRibbon')) $('#orderRibbon').textContent = `${state.width} мм · ${state.meters} м`;
    if ($('#orderSticker')) $('#orderSticker').textContent = `Ø${state.stickerSize} мм · ${state.stickerQty} шт.`;
    if ($('#orderRepeat')) $('#orderRepeat').textContent = state.repeatMm + ' мм';
    const price = calculatePrice();
    if ($('#totalPrice')) {
      $('#totalPrice').textContent = price.unavailable
        ? 'Требуется расчёт'
        : price.amount.toLocaleString('ru-RU') + ' ₽';
      $('#totalPrice').dataset.priceUnavailable = String(price.unavailable);
    }
    updateOrderProductControls();

    saveState();
    publishContentState();
    publishProductSelection();
  }

  window.RibbonStudioProduction = Object.freeze({
    serialize(product) {
      const svg = product === 'sticker' ? $('#stickerSvg') : $('#ribbonSvg');
      if (!svg) return '';
      return window.RibbonStudioGeometry.serializeProductionSvg(svg);
    },
  });

  function updateOrderProductControls() {
    const hasRibbon = state.meters > 0;
    const hasSticker = state.stickerQty > 0;
    const noticeId = 'orderProductNotice';
    const explanation = 'В заказе должен остаться хотя бы один продукт.';

    const updateButton = (button, active, onlyActive) => {
      if (!button) return;
      button.textContent = active ? 'Убрать' : 'Добавить';
      button.disabled = onlyActive;
      if (onlyActive) {
        button.title = explanation;
        button.setAttribute('aria-describedby', noticeId);
      } else {
        button.removeAttribute('title');
        button.removeAttribute('aria-describedby');
      }
    };

    updateButton($('#toggleOrderRibbon'), hasRibbon, hasRibbon && !hasSticker);
    updateButton($('#toggleOrderSticker'), hasSticker, hasSticker && !hasRibbon);

    if ($('#orderProductNotice')) {
      $('#orderProductNotice').hidden = hasRibbon && hasSticker;
    }
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

  function recolorSvgSource(svgSource, color = state.print) {
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
        node.setAttribute('fill', color);
        forcedParts.push(`fill:${color}!important`);
      }

      // Do not invent an outline where the source had no stroke.
      if (explicitStroke) {
        if (keepStrokeNone) {
          node.setAttribute('stroke', 'none');
          forcedParts.push('stroke:none!important');
        } else {
          node.setAttribute('stroke', color);
          forcedParts.push(`stroke:${color}!important`);
        }
      }

      node.setAttribute('style', forcedParts.join(';'));
    });

    // Replace gradient/pattern paints that may still be referenced by <use>.
    svg.querySelectorAll('linearGradient stop, radialGradient stop').forEach((stop) => {
      stop.setAttribute('stop-color', color);
      const style = stop.getAttribute('style') || '';
      const cleaned = style.replace(/stop-color\s*:\s*[^;]+/gi, '');
      stop.setAttribute('style', `${cleaned};stop-color:${color}!important`);
    });

    svg.setAttribute('color', color);

    const serialized = new XMLSerializer().serializeToString(svg);
    return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(serialized)));
  }

  function refreshSvgColor() {
    // Upload pipeline still writes the legacy common aliases until its dedicated refactor.
    syncCommonContentFromLegacyAliases();
    const recolorAsset = (asset) => {
      if (
        !asset?.logo ||
        !['svg', 'svg-auto'].includes(asset.logoType) ||
        !asset.logoSvgSource
      ) return;
      const data = recolorSvgSource(asset.logoSvgSource);
      if (data) asset.logo = {...asset.logo, data};
    };

    recolorAsset(state.content.logo.common);
    ['ribbon', 'sticker'].forEach((product) => {
      const override = state.content.logo[product];
      if (override.mode === 'override') recolorAsset(override.value);
    });
    syncLegacyContentAliasesFromContent();

    // Clear cached sources so every scene receives its resolved monochrome SVG.
    ['#macroLogoImage', '#macroStickerImage', '#boxRibbonImage', '#boxStickerImage'].forEach(
      (selector) => {
        const image = $(selector);
        if (image) image.removeAttribute('src');
      }
    );
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

  function openCropModal(file, image, dataUrl, target) {
    cropState.file = file;
    cropState.image = image;
    cropState.originalDataUrl = dataUrl;
    cropState.rotation = 0;
    cropState.zoom = 1;
    cropState.offsetX = 0;
    cropState.offsetY = 0;
    cropState.target = normalizeLogoTarget(target);

    $('#cropZoom').value = 100;
    resetCropFrame();

    $('#cropModal').classList.add('open');
    $('#cropModal').setAttribute('aria-hidden', 'false');

    requestAnimationFrame(drawCropCanvas);
  }

  function closeCropModal() {
    $('#cropModal').classList.remove('open');
    $('#cropModal').setAttribute('aria-hidden', 'true');
    cropState.target = 'common';
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
    const target = cropState.target;
    const file = cropState.file;
    const originalDataUrl = cropState.originalDataUrl;
    const originalWidth = cropState.image?.width || 0;
    const originalHeight = cropState.image?.height || 0;
    const cropMeta = {
      x:selection.x/stageRect.width,
      y:selection.y/stageRect.height,
      width:selection.width/stageRect.width,
      height:selection.height/stageRect.height,
      rotation:cropState.rotation,
      zoom:cropState.zoom,
      usedWhole:useWhole
    };

    croppedImage.onload = () => {
      processRasterAfterCrop(
        file,
        croppedImage,
        croppedDataUrl,
        originalDataUrl,
        cropMeta,
        target,
        {width: originalWidth, height: originalHeight}
      );
    };

    croppedImage.src = croppedDataUrl;
    closeCropModal();
  }

  function processRasterAfterCrop(
    file,
    image,
    croppedDataUrl,
    originalDataUrl,
    cropMeta,
    target,
    originalSize = {width: image.width, height: image.height}
  ) {
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

    const asset = {
      originalRaster: {
        name: file.name,
        type: file.type,
        width: originalSize.width || image.width,
        height: originalSize.height || image.height,
        data: originalDataUrl,
        crop: cropMeta
      },
      traceInfo: result,
      logoSvgSource: result.svgSource,
      logoType: 'svg-auto',
      logo: {
        data: recolorSvgSource(result.svgSource),
        ratio: result.ratio
      }
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
    commitLogoAsset(asset, target);
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

  function loadFile(file, target = 'common') {
    if (!file) return;
    const logoTarget = normalizeLogoTarget(target);

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

        if ($('#traceStatus')) $('#traceStatus').hidden = true;
        const asset = {
          originalRaster: null,
          traceInfo: null,
          logoSvgSource: serialized,
          logoType: 'svg',
          logo: {data: recolorSvgSource(serialized), ratio}
        };

        showFileCard(file, 'SVG · векторный файл', 'Отлично: файл готов к печати');
        commitLogoAsset(asset, logoTarget);
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
              {x:0, y:0, width:1, height:1, rotation:0, zoom:1, usedWhole:true},
              logoTarget,
              {width: image.width, height: image.height}
            );
          } else {
            openCropModal(file, image, reader.result, logoTarget);
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

    if ($('#textInput')) $('#textInput').value = state.content.text.common;
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

  document.addEventListener('studio:content-edit-request', (event) => {
    const kind = event.detail?.kind;
    const product = event.detail?.product;
    if (!['ribbon', 'sticker'].includes(product)) return;

    if (kind === 'logo') {
      const content = state.content.logo[product];
      const resolvedLogo = getResolvedLogo(product);
      if (
        content.mode === 'inherit' &&
        (!resolvedLogo || !hasUsedCommonLogoEditor)
      ) {
        if (resolvedLogo) hasUsedCommonLogoEditor = true;
        openLogoPicker('common');
        return;
      }
      document.dispatchEvent(
        new CustomEvent('studio:logo-edit-scope-required', {
          detail: {product}
        })
      );
      return;
    }

    if (kind !== 'text') return;

    const content = state.content.text[product];
    const resolvedText = getResolvedText(product);
    if (content.mode === 'inherit' && (!resolvedText || !hasUsedCommonTextEditor)) {
      $('#textInput').focus();
      if (resolvedText) hasUsedCommonTextEditor = true;
      return;
    }

    document.dispatchEvent(
      new CustomEvent('studio:text-edit-scope-required', {
        detail: {product}
      })
    );
  });

  const mobileTextEditor = $('#mobileTextEditor');
  const mobileTextEditorDialog = $('#mobileTextEditorDialog');
  const mobileTextEditorChoices = $('#mobileTextEditorChoices');
  const mobileTextOverrideForm = $('#mobileTextOverrideForm');
  const mobileTextOverrideInput = $('#mobileTextOverrideInput');
  let mobileTextEditorProduct = null;
  let mobileTextEditorOrigin = null;

  const closeMobileTextEditor = ({restoreFocus = true} = {}) => {
    if (mobileTextEditor.hidden) return;
    mobileTextEditor.hidden = true;
    mobileTextEditorChoices.hidden = false;
    mobileTextOverrideForm.hidden = true;
    if (restoreFocus) mobileTextEditorOrigin?.focus();
    mobileTextEditorProduct = null;
    mobileTextEditorOrigin = null;
  };

  const openMobileTextEditor = (product) => {
    if (!window.matchMedia('(max-width: 700px)').matches) return;
    const override = state.content.text[product];
    const productName = product === 'ribbon' ? 'ленты' : 'стикера';
    mobileTextEditorProduct = product;
    mobileTextEditorOrigin = $(`[data-mobile-products-safe-zone="${product}-text"]`);
    $('#mobileTextEditorTitle').textContent = `Надпись для ${productName}`;
    $('#editProductText').textContent = `Только для ${productName}`;
    $('#mobileTextOverrideLabel').textContent = `Надпись только для ${productName}`;
    $('#clearProductTextOverride').hidden = override.mode !== 'override';
    mobileTextEditorChoices.hidden = false;
    mobileTextOverrideForm.hidden = true;
    mobileTextEditor.hidden = false;
    $('#editCommonText').focus();
  };

  document.addEventListener('studio:text-edit-scope-required', (event) => {
    const product = event.detail?.product;
    if (!['ribbon', 'sticker'].includes(product)) return;
    openMobileTextEditor(product);
  });

  $('#editCommonText').addEventListener('click', () => {
    closeMobileTextEditor({restoreFocus: false});
    $('#textInput').focus();
  });

  $('#editProductText').addEventListener('click', () => {
    const product = mobileTextEditorProduct;
    if (!product) return;
    const override = state.content.text[product];
    mobileTextOverrideInput.value =
      override.mode === 'override' ? override.value : getResolvedText(product);
    mobileTextEditorChoices.hidden = true;
    mobileTextOverrideForm.hidden = false;
    mobileTextOverrideInput.focus();
  });

  mobileTextOverrideForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const product = mobileTextEditorProduct;
    if (!product) return;
    setTextOverride(product, mobileTextOverrideInput.value);
    closeMobileTextEditor();
    returnToMobilePreview();
  });

  $('#clearProductTextOverride').addEventListener('click', () => {
    const product = mobileTextEditorProduct;
    if (!product) return;
    clearTextOverride(product);
    closeMobileTextEditor();
    returnToMobilePreview();
  });

  [
    $('#closeMobileTextEditor'),
    $('#mobileTextEditorBackdrop'),
    $('#cancelMobileTextEditor'),
    $('#cancelMobileTextOverride')
  ].forEach((button) => button.addEventListener('click', () => closeMobileTextEditor()));

  mobileTextEditorDialog.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeMobileTextEditor();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = $$('button:not([hidden]), input:not([hidden])').filter(
      (element) =>
        mobileTextEditorDialog.contains(element) &&
        !element.disabled &&
        !element.closest('[hidden]')
    );
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  const mobileLogoEditor = $('#mobileLogoEditor');
  const mobileLogoEditorDialog = $('#mobileLogoEditorDialog');
  let mobileLogoEditorProduct = null;
  let mobileLogoEditorOrigin = null;

  const closeMobileLogoEditor = ({restoreFocus = true} = {}) => {
    if (mobileLogoEditor.hidden) return;
    mobileLogoEditor.hidden = true;
    if (restoreFocus) mobileLogoEditorOrigin?.focus();
    mobileLogoEditorProduct = null;
    mobileLogoEditorOrigin = null;
  };

  const openMobileLogoEditor = (product) => {
    if (!window.matchMedia('(max-width: 700px)').matches) return;
    const productName = product === 'ribbon' ? 'ленты' : 'стикера';
    mobileLogoEditorProduct = product;
    mobileLogoEditorOrigin = $(`[data-mobile-products-safe-zone="${product}-logo"]`);
    $('#mobileLogoEditorTitle').textContent = `Логотип для ${productName}`;
    $('#editProductLogo').textContent = `Только для ${productName}`;
    $('#clearProductLogoOverride').hidden =
      state.content.logo[product].mode !== 'override';
    mobileLogoEditor.hidden = false;
    $('#editCommonLogo').focus();
  };

  document.addEventListener('studio:logo-edit-scope-required', (event) => {
    const product = event.detail?.product;
    if (!['ribbon', 'sticker'].includes(product)) return;
    openMobileLogoEditor(product);
  });

  $('#editCommonLogo').addEventListener('click', () => {
    closeMobileLogoEditor({restoreFocus: false});
    openLogoPicker('common');
  });

  $('#editProductLogo').addEventListener('click', () => {
    const product = mobileLogoEditorProduct;
    if (!product) return;
    closeMobileLogoEditor({restoreFocus: false});
    openLogoPicker(product);
  });

  $('#clearProductLogoOverride').addEventListener('click', () => {
    const product = mobileLogoEditorProduct;
    if (!product) return;
    clearLogoOverride(product);
    closeMobileLogoEditor();
  });

  [
    $('#closeMobileLogoEditor'),
    $('#mobileLogoEditorBackdrop'),
    $('#cancelMobileLogoEditor')
  ].forEach((button) => button.addEventListener('click', () => closeMobileLogoEditor()));

  mobileLogoEditorDialog.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeMobileLogoEditor();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = $$('button:not([hidden]), input:not([hidden])').filter(
      (element) =>
        mobileLogoEditorDialog.contains(element) &&
        !element.disabled &&
        !element.closest('[hidden]')
    );
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  $('#toggleOrderRibbon').addEventListener('click', () => {
    setProductSelection({
      ribbon: state.meters === 0,
      sticker: state.stickerQty > 0
    });
  });

  $('#toggleOrderSticker').addEventListener('click', () => {
    setProductSelection({
      ribbon: state.meters > 0,
      sticker: state.stickerQty === 0
    });
  });

  $$('#stickerSizeChoice button').forEach((button) =>
    button.addEventListener('click', () => {
      activate('#stickerSizeChoice', button);
      state.stickerSize = +button.dataset.value;
      render();
    })
  );

  document.addEventListener('studio:logo-upload-target-set', (event) => {
    setPendingLogoTarget(event.detail?.target);
  });

  $('#logoInput').addEventListener('change', (event) => {
    const file = event.target.files?.[0];
    const target = pendingLogoTarget;
    event.target.value = '';
    setPendingLogoTarget('common');
    if (file && target === 'common') hasUsedCommonLogoEditor = true;
    loadFile(file, target);
  });

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
    hasUsedCommonTextEditor = true;
    setCommonText(event.target.value);
  });

  $('#textInput').addEventListener('change', returnToMobilePreview);

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

  $('#openOrder').addEventListener('click', () => {
    const price = calculatePrice();
    const artworkValid = document.body.dataset.artworkValid === 'true';
    $('#orderSummary').textContent = [
      state.meters > 0 ? `Лента ${state.width} мм · ${state.meters} м` : '',
      state.stickerQty > 0
        ? `Стикер Ø${state.stickerSize} мм · ${state.stickerQty} шт.`
        : '',
      !artworkValid
        ? 'Макет не готов: текст не помещается в печатную область'
        : price.unavailable
        ? 'Цена стикера Ø25 мм требует индивидуального расчёта'
        : `Итого: ${price.amount.toLocaleString('ru-RU')} ₽`,
    ]
      .filter(Boolean)
      .join(' · ');
    $('#orderModal').classList.add('open');
    $('#orderModal').setAttribute('aria-hidden', 'false');
  });

  $('#closeOrder').addEventListener('click', () => {
    $('#orderModal').classList.remove('open');
    $('#orderModal').setAttribute('aria-hidden', 'true');
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
  document.fonts?.ready.then(() => render());
});
