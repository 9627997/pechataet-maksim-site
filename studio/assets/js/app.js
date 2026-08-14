
document.addEventListener('DOMContentLoaded', () => {
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];
  const NS = 'http://www.w3.org/2000/svg';
  const {
    getRibbonPrintableGeometry,
    getStickerPrintableGeometry,
    getStickerGeometry,
    fitRectToCircle,
  } = window.RibbonStudioGeometry;
  const {
    fitTextToCircle,
    getRibbonContentLayout,
    getStickerContentLayout,
  } = window.RibbonStudioLayout;
  const textMeasureContext = document.createElement('canvas').getContext('2d');
  let currentLayouts = {ribbon: null, sticker: null};
  let currentPreviewLayouts = {ribbon: null, sticker: null};
  let textMeasurementSvg = null;
  let demoLogoAsset = null;
  const DEMO_TEXT = 'ленты по любви';
  const DEMO_FONT = 'Comfortaa';
  const MIN_RIBBON_REPEAT_MM = 40;
  const MAX_RIBBON_REPEAT_MM = 250;
  const GOLDEN_RATIO = 1.618;
  const REPEAT_ROUNDING_MM = 5;
  const PRINT_MARGIN_MM = 2.5;
  const MAX_COMMON_TEXT_LENGTH = 60;
  const ENABLE_ADDITIONAL_STICKER_SHAPES = true;
  const STICKER_VARIANTS = Object.freeze({
    'circle-25': Object.freeze({
      id: 'circle-25',
      shape: 'circle',
      label: 'Круглый стикер',
      displaySize: 'Ø25 мм',
      widthMm: 25,
      heightMm: 25,
      diameterMm: 25,
      cornerRadiusMm: null,
      enabled: true,
    }),
    'circle-30': Object.freeze({
      id: 'circle-30',
      shape: 'circle',
      label: 'Круглый стикер',
      displaySize: 'Ø30 мм',
      widthMm: 30,
      heightMm: 30,
      diameterMm: 30,
      cornerRadiusMm: null,
      enabled: true,
    }),
    'circle-40': Object.freeze({
      id: 'circle-40',
      shape: 'circle',
      label: 'Круглый стикер',
      displaySize: 'Ø40 мм',
      widthMm: 40,
      heightMm: 40,
      diameterMm: 40,
      cornerRadiusMm: null,
      enabled: true,
    }),
    'circle-50': Object.freeze({
      id: 'circle-50',
      shape: 'circle',
      label: 'Круглый стикер',
      displaySize: 'Ø50 мм',
      widthMm: 50,
      heightMm: 50,
      diameterMm: 50,
      cornerRadiusMm: null,
      enabled: true,
    }),
    'roundrect-80x20': Object.freeze({
      id: 'roundrect-80x20',
      shape: 'roundrect',
      label: 'Прямоугольный со скруглением',
      displaySize: '80 × 20 мм',
      widthMm: 80,
      heightMm: 20,
      diameterMm: null,
      cornerRadiusMm: 2,
      enabled: ENABLE_ADDITIONAL_STICKER_SHAPES,
    }),
  });
  const DEFAULT_STICKER_VARIANT_ID = 'circle-40';
  const getStickerVariant = (variantId = DEFAULT_STICKER_VARIANT_ID) =>
    STICKER_VARIANTS[variantId] || STICKER_VARIANTS[DEFAULT_STICKER_VARIANT_ID];
  const getStickerVariantIdFromLegacyState = (value) => {
    const diameter = Number(value);
    return [25, 30, 40, 50].includes(diameter)
      ? `circle-${diameter}`
      : DEFAULT_STICKER_VARIANT_ID;
  };
  const MAX_LOGO_FILE_BYTES = 20 * 1024 * 1024;
  const PDF_RENDER_MAX_SIDE = 1600;
  const PDFJS_MODULE_URL = new URL(
    'assets/vendor/pdfjs/pdf.min.js',
    document.baseURI
  ).href;
  const PDFJS_WORKER_URL = new URL(
    'assets/vendor/pdfjs/pdf.worker.min.js',
    document.baseURI
  ).href;
  const PDFJS_STANDARD_FONTS_URL = new URL(
    'assets/vendor/pdfjs/standard_fonts/',
    document.baseURI
  ).href;
  const PDFJS_ICC_URL = new URL(
    'assets/vendor/pdfjs/iccs/',
    document.baseURI
  ).href;
  const PDFJS_WASM_URL = new URL(
    'assets/vendor/pdfjs/wasm/',
    document.baseURI
  ).href;
  let pdfJsPromise = null;
  let tracePolaritySession = null;

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
    text: '',
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
    productStyles: {
      ribbon: {
        font: 'Manrope',
        print: '#171717',
        fontSize: 32,
        layoutMode: 'auto',
        textOffsetX: 0,
        textOffsetY: 0,
        logoScale: 1,
        logoOffsetX: 0,
        logoOffsetY: 0
      },
      sticker: {
        font: 'Manrope',
        print: '#171717',
        fontSize: 32,
        layoutMode: 'auto',
        textOffsetX: 0,
        textOffsetY: 0,
        logoScale: 1,
        logoOffsetX: 0,
        logoOffsetY: 0
      }
    },
    activeContentProduct: 'ribbon',
    activeSettingsProduct: 'ribbon',
    primaryProduct: null,
    productFirstMode: false,
    repeatMm: 100,
    repeatMode: 'auto',
    bundle: 'bundle',
    stickerVariantId: DEFAULT_STICKER_VARIANT_ID,
    stickerSize: 40,
    stickerBg: '#ffffff',
    showPrintGuides: false,
    commonTextAuthored: false,
    commonLogoUploaded: false,
    meters: 100,
    stickerQty: 100,
    lastMeters: 100,
    lastStickerQty: 100
  };

  const FONT_OPTIONS = [
    'Manrope',
    'Unbounded',
    'Comfortaa',
    'Play',
    'Yeseva One',
    'Commissioner',
    'Dela Gothic One',
    'Forum',
    'IBM Plex Sans',
    'PT Sans',
    'PT Serif',
    'Pacifico',
    'Playfair Display'
  ];
  const PRINT_OPTIONS = ['#171717', '#b69249', '#c6c8cd', '#ffffff'];

  function normalizeProductStyle(value, fallback = state) {
    const font = FONT_OPTIONS.includes(value?.font)
      ? value.font
      : FONT_OPTIONS.includes(fallback.font) ? fallback.font : 'Manrope';
    const print = PRINT_OPTIONS.includes(value?.print)
      ? value.print
      : PRINT_OPTIONS.includes(fallback.print) ? fallback.print : '#171717';
    return {
      font,
      print,
      fontSize: Math.min(64, Math.max(16, Number(value?.fontSize ?? fallback.fontSize) || 32)),
      layoutMode: value?.layoutMode === 'manual' ? 'manual' : 'auto',
      textOffsetX: Math.min(100, Math.max(-100, Number(value?.textOffsetX) || 0)),
      textOffsetY: Math.min(100, Math.max(-100, Number(value?.textOffsetY) || 0)),
      logoScale: Math.min(1, Math.max(0.1, Number(value?.logoScale ?? fallback.logoScale) || 1)),
      logoOffsetX: Math.min(100, Math.max(-100, Number(value?.logoOffsetX ?? fallback.logoOffsetX) || 0)),
      logoOffsetY: Math.min(100, Math.max(-100, Number(value?.logoOffsetY) || 0))
    };
  }

  function getProductStyle(product) {
    return state.productStyles[product === 'sticker' ? 'sticker' : 'ribbon'];
  }

  function syncLegacyStyleAliases(product = state.activeSettingsProduct) {
    const style = getProductStyle(product);
    state.font = style.font;
    state.print = style.print;
    state.fontSize = style.fontSize;
    state.logoScale = style.logoScale;
    state.logoOffsetX = style.logoOffsetX;
  }

  function getPaintedLogo(product, asset) {
    if (!asset?.logo) return asset;
    const style = getProductStyle(product);
    const data = asset.logoSvgSource
      ? recolorSvgSource(asset.logoSvgSource, style.print)
      : asset.logo.data;
    return data
      ? {...asset, logo: {...asset.logo, data}}
      : asset;
  }
  let hasUsedCommonTextEditor = false;
  let hasUsedCommonLogoEditor = false;
  let hasCompletedCommonLogoUpload = false;
  let pendingLogoTarget = 'common';
  let activeTextTarget = 'common';
  let cropModalOrigin = null;
  let orderModalOrigin = null;
  let pendingOrderRequestId = null;
  let orderSubmissionSucceeded = false;
  let acceptedOrderId = '';

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
    target: 'common',
    analysisToken: 0,
    suggestion: null,
    manuallyAdjusted: false
  };

  const DEFAULT_LOGO_SVG = `<?xml version="1.0" encoding="UTF-8"?>
<svg id="_Слой_1" data-name="Слой 1" xmlns="http://www.w3.org/2000/svg" viewBox="6.5 11.35 87.5 27.3">
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

  function hasUserContent() {
    return ['ribbon', 'sticker'].some(
      (product) =>
        Boolean(getResolvedText(product).trim()) ||
        Boolean(getResolvedLogo(product)?.logo),
    );
  }

  function isDemoPreviewActive() {
    return !hasUserContent();
  }

  function getPreviewText(product) {
    const resolved = getResolvedText(product).trim();
    return isDemoPreviewActive() && !resolved ? DEMO_TEXT : resolved;
  }

  function getPreviewFont(product) {
    return isDemoPreviewActive()
      ? DEMO_FONT
      : getProductStyle(product).font;
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

  function getProductLabel(product, form = 'nominative') {
    if (form === 'prepositional') {
      return product === 'sticker' ? 'стикере' : 'ленте';
    }
    if (form === 'genitive') {
      return product === 'sticker' ? 'стикера' : 'ленты';
    }
    return product === 'sticker' ? 'Стикер' : 'Лента';
  }

  function syncContentEditor() {
    const product = state.activeContentProduct;
    const productLabel = getProductLabel(product);
    const productPrepositional = getProductLabel(product, 'prepositional');
    const productGenitive = getProductLabel(product, 'genitive');
    const textOverride = state.content.text[product];
    const logoOverride = state.content.logo[product];
    const textIsIndividual = textOverride.mode === 'override';
    const logoIsIndividual = logoOverride.mode === 'override';
    const textValue =
      activeTextTarget === 'common'
        ? state.content.text.common
        : getResolvedText(product);

    document.body.dataset.activeContentProduct = product;
    $$('[data-content-product]').forEach((button) => {
      const active = button.dataset.contentProduct === product;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    $$('[data-mobile-product-sample]').forEach((sample) => {
      const active = sample.dataset.mobileProductSample === product;
      const editingContent = state.panel === 'upload';
      sample.classList.toggle('is-content-active', editingContent && active);
      sample.classList.toggle('is-content-inactive', editingContent && !active);
      if (editingContent) sample.setAttribute('aria-pressed', String(active));
    });

    if ($('#contentProductEditorHint')) {
      $('#contentProductEditorHint').textContent =
        'Первый текст и логотип появятся на обоих изделиях. Затем их можно изменить отдельно.';
    }
    if ($('#textInputLabel')) {
      $('#textInputLabel').textContent = `Надпись на ${productPrepositional}`;
    }
    if ($('#logoInputLabel')) {
      $('#logoInputLabel').textContent = `Логотип на ${productPrepositional}`;
    }
    if ($('#textInput') && document.activeElement !== $('#textInput')) {
      $('#textInput').value = isDemoPreviewActive() ? '' : textValue;
    }
    if ($('#textScopeStatus')) {
      $('#textScopeStatus').textContent = textIsIndividual
        ? textOverride.value.trim()
          ? `Только для ${productGenitive}`
          : `Не используется на ${productPrepositional}`
        : 'Общая для обоих';
    }
    if ($('#logoScopeStatus')) {
      $('#logoScopeStatus').textContent = logoIsIndividual
        ? logoOverride.value?.logo
          ? `Только для ${productGenitive}`
          : `Не используется на ${productPrepositional}`
        : 'Общий для обоих';
    }

    const makeText = $('#makeProductText');
    const restoreText = $('#restoreProductText');
    const removeText = $('#removeProductText');
    if (makeText) {
      makeText.hidden = textIsIndividual || !state.content.text.common.trim();
      makeText.textContent = `Сделать отдельной для ${productGenitive}`;
    }
    if (restoreText) {
      restoreText.hidden = !textIsIndividual;
      restoreText.textContent = 'Вернуть общую надпись';
    }
    if (removeText) {
      removeText.hidden = !getResolvedText(product).trim();
      removeText.textContent = `Убрать с ${productGenitive}`;
    }

    const makeLogo = $('#makeProductLogo');
    const restoreLogo = $('#restoreProductLogo');
    const removeLogo = $('#removeProductLogo');
    if (makeLogo) {
      makeLogo.hidden = logoIsIndividual || !state.content.logo.common?.logo;
      makeLogo.textContent = `Заменить только на ${productPrepositional}`;
    }
    if (restoreLogo) {
      restoreLogo.hidden = !logoIsIndividual;
      restoreLogo.textContent = 'Вернуть общий логотип';
    }
    if (removeLogo) {
      removeLogo.hidden = !getResolvedLogo(product)?.logo;
      removeLogo.textContent = `Убрать с ${productGenitive}`;
    }

    const replaceUploadedLogo = $('#replaceCommonLogo');
    const removeUploadedLogo = $('#removeCommonLogo');
    if (replaceUploadedLogo) {
      replaceUploadedLogo.textContent = logoIsIndividual
        ? `Заменить для ${productGenitive}`
        : 'Заменить общий';
    }
    if (removeUploadedLogo) {
      removeUploadedLogo.textContent = logoIsIndividual
        ? `Убрать с ${productGenitive}`
        : 'Удалить общий';
    }

    if ($('#settingsContentStatus')) {
      const settingsProduct = state.activeSettingsProduct;
      const hasSettingsText = Boolean(getResolvedText(settingsProduct).trim());
      const hasSettingsLogo = Boolean(getResolvedLogo(settingsProduct)?.logo);
      const textMode =
        state.content.text[settingsProduct].mode === 'override'
          ? getResolvedText(settingsProduct).trim()
            ? 'своя надпись'
            : 'без надписи'
          : state.content.text.common.trim()
            ? 'общая надпись'
            : 'надпись не добавлена';
      const logoMode =
        state.content.logo[settingsProduct].mode === 'override'
          ? getResolvedLogo(settingsProduct)?.logo
            ? 'свой логотип'
            : 'без логотипа'
          : state.content.logo.common?.logo
            ? 'общий логотип'
            : 'логотип не добавлен';
      $('#settingsContentStatus').textContent = `${textMode} · ${logoMode}`;
      $$('[data-setting-requires]').forEach((control) => {
        control.hidden =
          control.dataset.settingRequires === 'text'
            ? !hasSettingsText
            : !hasSettingsLogo;
      });
      if ($('#editSettingsText')) {
        $('#editSettingsText').textContent = hasSettingsText
          ? 'Изменить надпись'
          : 'Добавить надпись';
      }
      if ($('#editSettingsLogo')) {
        $('#editSettingsLogo').textContent = hasSettingsLogo
          ? 'Заменить логотип'
          : 'Добавить логотип';
      }
    }
  }

  function setActiveContentProduct(product, {renderPreview = true} = {}) {
    if (!['ribbon', 'sticker'].includes(product)) return;
    state.activeContentProduct = product;
    activeTextTarget =
      state.content.text[product].mode === 'override' ? product : 'common';
    syncContentEditor();
    updateProductShowcase();
    updateStudioContext();
    if (renderPreview) render();
  }

  function getResolvedLogo(product) {
    const override = state.content.logo[product];
    return override?.mode === 'override' ? override.value : state.content.logo.common;
  }

  function isDemoLogoPreview(product) {
    return Boolean(
      isDemoPreviewActive() &&
      demoLogoAsset &&
      state.content.logo[product]?.mode !== 'override' &&
      !getResolvedLogo(product),
    );
  }

  function copyProductContentOnce(sourceProduct, targetProduct) {
    if (!['ribbon', 'sticker'].includes(sourceProduct) || !['ribbon', 'sticker'].includes(targetProduct)) return;
    const resolvedText = getResolvedText(sourceProduct).trim();
    const resolvedLogo = getResolvedLogo(sourceProduct);
    if (resolvedText) {
      state.content.text[targetProduct] = {mode: 'override', value: resolvedText};
    }
    if (resolvedLogo) {
      state.content.logo[targetProduct] = {mode: 'override', value: resolvedLogo};
    }
    syncLegacyContentAliasesFromContent();
  }

  function copyProductStyleOnce(sourceProduct, targetProduct) {
    if (!['ribbon', 'sticker'].includes(sourceProduct) || !['ribbon', 'sticker'].includes(targetProduct)) return;
    state.productStyles[targetProduct] = {
      ...state.productStyles[targetProduct],
      ...getProductStyle(sourceProduct),
    };
  }

  function getPreviewLogo(product) {
    return isDemoLogoPreview(product)
      ? demoLogoAsset
      : getResolvedLogo(product);
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

  function commitLogoAsset(asset, target, {returnToPreview = true} = {}) {
    const normalizedTarget = normalizeLogoTarget(target);
    if (normalizedTarget === 'common') {
      if (!state.commonTextAuthored) {
        state.text = '';
        state.content.text.common = '';
      }
      state.content.logo.common = asset;
      hasCompletedCommonLogoUpload = true;
      state.commonLogoUploaded = true;
      syncLegacyContentAliasesFromContent();
      setFileCardActionsVisible(true);
      setUploadState('success', '');
      updateFirstStepAvailability();
    } else {
      state.content.logo[normalizedTarget] = {mode: 'override', value: asset};
    }
    updateFirstStepAvailability();
    render();
    if (returnToPreview) returnToMobilePreview();
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
      state.activeContentProduct =
        restored.activeContentProduct === 'sticker' ? 'sticker' : 'ribbon';
      state.activeSettingsProduct =
        restored.activeSettingsProduct === 'sticker' ? 'sticker' : 'ribbon';
      state.productStyles = {
        ribbon: normalizeProductStyle(restored.productStyles?.ribbon, restored),
        sticker: normalizeProductStyle(restored.productStyles?.sticker, restored)
      };
      syncLegacyStyleAliases();
      state.showPrintGuides = restored.showPrintGuides === true;
      state.stickerVariantId = getStickerVariant(restored.stickerVariantId || getStickerVariantIdFromLegacyState(restored.stickerSize)).id;
      const selectedStickerVariant = getStickerVariant(state.stickerVariantId);
      state.stickerSize = selectedStickerVariant.diameterMm || 40;
      state.repeatMm = Math.min(
        MAX_RIBBON_REPEAT_MM,
        Math.max(
          MIN_RIBBON_REPEAT_MM,
          Number(state.repeatMm) || 100,
        ),
      );
      state.repeatMode = restored.repeatMode === 'manual' ? 'manual' : 'auto';

      const legacyDemoTexts = [
        'привет',
        'печатаетмаксим',
        'сделано красиво',
        DEMO_TEXT,
      ];
      if (legacyDemoTexts.includes((state.text || '').trim().toLowerCase())) {
        state.text = '';
      }
      state.content = normalizeContentModel(restored.content, state);
      const commonText = state.content.text.common.trim();
      state.commonTextAuthored =
        restored.commonTextAuthored === true ||
        Boolean(commonText && !legacyDemoTexts.includes(commonText.toLowerCase()));
      if (!state.commonTextAuthored && legacyDemoTexts.includes(commonText.toLowerCase())) {
        state.content.text.common = '';
      }
      state.commonLogoUploaded = restored.commonLogoUploaded === true;
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
    if (!demoLogoAsset) {
      const doc = new DOMParser().parseFromString(
        DEFAULT_LOGO_SVG,
        'image/svg+xml',
      );
      const svg = doc.documentElement;
      const viewBox = (svg.getAttribute('viewBox') || '0 0 100 50')
        .trim()
        .split(/\s+/)
        .map(Number);
      const ratio =
        viewBox.length === 4 && viewBox[3] ? viewBox[2] / viewBox[3] : 2;
      demoLogoAsset = {
        logo: {
          data: recolorSvgSource(DEFAULT_LOGO_SVG),
          ratio,
        },
        logoType: 'svg',
        logoSvgSource: DEFAULT_LOGO_SVG,
        originalRaster: null,
        traceInfo: null,
      };
    }

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
      const normalizedProduct = product === 'sticker' ? 'sticker' : 'ribbon';
      const textValue = onUpload
        ? getPreviewText(normalizedProduct)
        : getResolvedText(normalizedProduct).trim();
      el.textContent = textValue;
      el.hidden = !textValue;
      el.style.fontFamily = onUpload
        ? getPreviewFont(normalizedProduct)
        : getProductStyle(normalizedProduct).font;
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
        const fixedLogo = recolorLogoForShowcase(getPreviewLogo(product), item.print);

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
        const product =
          el.closest('[data-product-type]')?.dataset.productType === 'sticker'
            ? 'sticker'
            : 'ribbon';
        el.style.color = getProductStyle(product).print;
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
        const asset = getPaintedLogo(product, getPreviewLogo(product));
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
    const onSettings = state.panel === 'settings';
    const focusedProduct = onUpload
      ? state.activeContentProduct
      : state.activeSettingsProduct;
    const focusSingleProduct = onSettings || onUpload;
    const productFirstBothEnabled =
      state.productFirstMode && state.meters > 0 && state.stickerQty > 0;
    const productFirstWorkspace =
      state.productFirstMode && !productFirstBothEnabled
        ? state.primaryProduct || focusedProduct
        : null;
    const workspaceProduct = productFirstWorkspace || focusedProduct;
    const ribbonsOnly = productFirstWorkspace
      ? workspaceProduct === 'ribbon'
      : focusSingleProduct
        ? focusedProduct === 'ribbon'
        : !onUpload && state.bundle === 'ribbon';
    const stickersOnly = productFirstWorkspace
      ? workspaceProduct === 'sticker'
      : focusSingleProduct
        ? focusedProduct === 'sticker'
        : !onUpload && state.bundle === 'sticker';
    const showAll = productFirstBothEnabled
      ? true
      : !onUpload && !onSettings && state.bundle === 'bundle';

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

    const selectedRibbon = state.width === 20
      ? '.showcase-ribbon-20'
      : '.showcase-ribbon-15';
    showcase.querySelectorAll('.showcase-ribbon').forEach((item) => {
      item.classList.toggle(
        'is-variant-hidden',
        !item.matches(selectedRibbon),
      );
    });
    showcase.querySelectorAll('.showcase-sticker').forEach((item) => {
      item.classList.toggle(
        'is-variant-hidden',
        !item.classList.contains('showcase-sticker-white'),
      );
    });
  }

  function readStudioEntryContext() {
    const params = new URLSearchParams(window.location.search);
    const product = ['ribbon', 'sticker', 'set'].includes(params.get('product'))
      ? params.get('product')
      : null;
    const material = ['satin', 'silicone'].includes(params.get('material'))
      ? params.get('material')
      : null;
    return product ? {product, material} : null;
  }

  function applyStudioEntryContext() {
    const entry = readStudioEntryContext();
    if (!entry) return;

    const hasExistingProject = hasUserContent();
    if (!hasExistingProject) {
      const activeProduct = entry.product === 'sticker' ? 'sticker' : 'ribbon';
      state.activeContentProduct = activeProduct;
      state.activeSettingsProduct = activeProduct;
      setProductSelection({
        ribbon: entry.product !== 'sticker',
        sticker: entry.product !== 'ribbon',
      });
    }

    const productLabel = {
      ribbon: 'Вы создаёте макет ленты.',
      sticker: 'Вы создаёте макет стикера.',
      set: 'Вы создаёте комплект ленты и стикеров.',
    }[entry.product];
    const materialLabel = entry.material === 'satin'
      ? ' Материал: сатин.'
      : entry.material === 'silicone'
        ? ' Материал: силикон.'
        : '';
    const context = $('#studioEntryContext');
    const text = $('#studioEntryContextText');
    if (!context || !text) return;
    text.textContent = hasExistingProject
      ? `${productLabel} Сохранённый проект не изменён.`
      : `${productLabel}${materialLabel} Настройте макет — материал подтвердим перед печатью.`;
    context.hidden = false;
    $('#studioEntryContextClose')?.addEventListener('click', () => {
      context.hidden = true;
    }, {once: true});
  }

  function updateStudioContext() {
    const eyebrow = $('#studioContextEyebrow');
    const title = $('#studioContextTitle');
    const sceneLabel = $('#sceneKitLabel');
    const sceneTitle = $('#sceneKitTitle');
    if (!eyebrow || !title || !sceneLabel || !sceneTitle) return;

    const context = {
      upload: {
        eyebrow: 'Живой образец',
        title:
          state.activeContentProduct === 'sticker'
            ? 'Предпросмотр стикера'
            : 'Предпросмотр ленты',
        sceneLabel:
          state.activeContentProduct === 'sticker'
            ? 'Выбран стикер'
            : 'Выбрана лента',
        sceneTitle:
          state.activeContentProduct === 'sticker'
            ? getStickerVariant(state.stickerVariantId).shape === 'roundrect'
              ? 'Прямоугольный стикер 80 × 20 мм · радиус 2 мм'
              : 'Круглый стикер'
            : 'Сатиновая лента',
      },
      settings: {
        eyebrow: 'Точная настройка',
        title:
          state.activeSettingsProduct === 'sticker'
            ? 'Настройте стикер'
            : 'Настройте ленту',
        sceneLabel:
          state.activeSettingsProduct === 'sticker'
            ? 'Выбран стикер'
            : 'Выбрана лента',
        sceneTitle:
          state.activeSettingsProduct === 'sticker'
            ? getStickerVariant(state.stickerVariantId).shape === 'roundrect'
              ? 'Прямоугольный стикер 80 × 20 мм · радиус 2 мм'
              : 'Круглый стикер'
            : 'Сатиновая лента',
      },
      order: {
        eyebrow: 'Итоговый просмотр',
        title: 'Проверьте комплект перед заявкой',
        sceneLabel: 'Фирменный комплект',
        sceneTitle: state.stickerQty > 0 && getStickerVariant(state.stickerVariantId).shape === 'roundrect'
          ? 'Сатиновая лента и прямоугольный стикер 80 × 20 мм'
          : 'Сатиновая лента и круглый стикер',
      },
    }[state.panel];

    eyebrow.textContent = context.eyebrow;
    title.textContent = context.title;
    sceneLabel.textContent = context.sceneLabel;
    sceneTitle.textContent = context.sceneTitle;
  }

  function showPanel(id) {
    if (id !== 'upload' && !isFirstStepReady()) return;

    state.panel = id;
    document.body.dataset.activePanel = id;
    if (id === 'order') setPrintGuidesEditing(false);
    $$('.nav-item').forEach((button) => button.classList.toggle('active', button.dataset.panel === id));
    $$('.panel').forEach((panel) => panel.classList.toggle('active', panel.id === 'panel-' + id));
    if (id === 'settings') {
      setActiveSettingsProduct(state.activeContentProduct);
    }
    if (id === 'upload') {
      setActiveContentProduct(state.activeContentProduct, {renderPreview: false});
    }
    updateProductShowcase();
    updateStudioContext();
  }

  function setPrintGuidesEditing(active) {
    document.body.classList.toggle('print-guides-editing', Boolean(active));
  }

  function syncPrintGuideState() {
    const visible = Boolean(state.showPrintGuides);
    document.body.classList.toggle('print-guides-pinned', visible);
    if ($('#printGuidesToggle')) $('#printGuidesToggle').checked = visible;
  }

  function isFirstStepReady() {
    return hasUserContent();
  }

  function updateFirstStepAvailability() {
    const ready = isFirstStepReady();
    const textReady = ['ribbon', 'sticker'].some((product) =>
      Boolean(getResolvedText(product).trim()),
    );
    const logoReady = ['ribbon', 'sticker'].some((product) =>
      Boolean(getResolvedLogo(product)?.logo),
    );
    const continueButton = $('#continueUpload');
    const continueHelp = $('#continueUploadHelp');
    if (continueButton) {
      continueButton.disabled = !ready;
      if (ready) {
        continueButton.removeAttribute('aria-describedby');
      } else {
        continueButton.setAttribute('aria-describedby', 'continueUploadHelp');
      }
    }
    if (continueHelp) continueHelp.hidden = ready;

    const updateStatus = (kind, complete, completeLabel, emptyLabel) => {
      const status = $(`[data-create-status="${kind}"]`);
      if (!status) return;
      status.classList.toggle('is-complete', complete);
      status.querySelector('span').textContent = complete ? '✓' : '○';
      status.querySelector('small').textContent = complete
        ? completeLabel
        : emptyLabel;
    };
    updateStatus('text', textReady, 'добавлено', 'не добавлено');
    updateStatus('logo', logoReady, 'добавлен', 'не добавлен — необязательно');

    if ($('#textInputCounter')) {
      const textLength = [...($('#textInput')?.value || '')].length;
      $('#textInputCounter').textContent =
        `${textLength} / ${MAX_COMMON_TEXT_LENGTH}`;
      $('#textInputMeta')?.classList.toggle(
        'is-over-limit',
        textLength > MAX_COMMON_TEXT_LENGTH
      );
      if ($('#textLengthWarning')) {
        $('#textLengthWarning').hidden = textLength <= MAX_COMMON_TEXT_LENGTH;
      }
    }

    $$('.nav-item').forEach((button) => {
      if (button.dataset.panel === 'upload') return;
      button.disabled = !ready;
    });
    syncContentEditor();
  }

  function clearDemoLogo() {
    if (state.commonLogoUploaded || hasCompletedCommonLogoUpload) return;
    state.logo = null;
    state.logoType = null;
    state.logoSvgSource = null;
    state.originalRaster = null;
    state.traceInfo = null;
    state.content.logo.common = null;
  }

  function trapDialogFocus(event, dialog) {
    if (event.key !== 'Tab') return;
    const focusable = [
      ...dialog.querySelectorAll(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    ].filter(
      (element) =>
        !element.hidden &&
        !element.closest('[hidden]') &&
        element.offsetParent !== null,
    );
    const first = focusable[0];
    const last = focusable.at(-1);
    if (!first || !last) return;

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function downloadTextFile(filename, content) {
    const url = URL.createObjectURL(
      new Blob([content], {type: 'text/plain;charset=utf-8'}),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function drawText(
    parent,
    x,
    y,
    size,
    value,
    product,
    anchor = 'middle',
    font = getProductStyle(product).font,
  ) {
    if (!value) return;
    const style = getProductStyle(product);

    const text = svgEl('text', {
      x,
      y,
      'text-anchor': anchor,
      'dominant-baseline': 'middle',
      'font-family': font,
      'font-size': size,
      'font-weight': '700',
      fill: style.print
    });

    text.textContent = value;
    parent.appendChild(text);
    return text;
  }

  function measureTextBox(
    text,
    size = 100,
    product = 'ribbon',
    font = getProductStyle(product).font,
  ) {
    textMeasureContext.font = `700 ${size}px ${font}`;
    const metrics = textMeasureContext.measureText(text || '');
    const ascent = metrics.actualBoundingBoxAscent || size * 0.8;
    const descent = metrics.actualBoundingBoxDescent || size * 0.2;
    return {width: metrics.width, height: ascent + descent};
  }

  function getTextMetrics(
    text,
    product = 'ribbon',
    font = getProductStyle(product).font,
  ) {
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
      'font-family': font,
      'font-size': 100,
      'font-weight': '700',
    });
    sample.textContent = text || '';
    textMeasurementSvg.replaceChildren(sample);
    const bbox = sample.getBBox();
    const measured = bbox.width && bbox.height
      ? {width: bbox.width, height: bbox.height}
      : measureTextBox(text, 100, product, font);
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

  function calculateRibbonLayout(
    repeatMm,
    text,
    resolvedLogo,
    textMetrics = getTextMetrics(text, 'ribbon'),
    preserveComposition = false,
  ) {
    const style = getProductStyle('ribbon');
    const height = state.width === 15 ? 76 : 100;
    const y = 130 - height / 2;
    const repeatWidth = Math.max(360, repeatMm * 6.2);
    let layoutRepeatMm = repeatMm;
    let layoutWidth = repeatWidth;
    let layoutX = 0;
    if (preserveComposition) {
      const natural = getNaturalRibbonContentWidthMm(
        text,
        resolvedLogo,
        textMetrics,
      );
      const naturalRepeatMm = Math.min(
        MAX_RIBBON_REPEAT_MM,
        Math.ceil(
          Math.max(
            MIN_RIBBON_REPEAT_MM,
            natural.widthMm + natural.widthMm / GOLDEN_RATIO,
          ) / REPEAT_ROUNDING_MM,
        ) * REPEAT_ROUNDING_MM,
      );
      layoutRepeatMm = Math.min(repeatMm, naturalRepeatMm);
      layoutWidth = Math.min(
        repeatWidth,
        Math.max(360, layoutRepeatMm * 6.2),
      );
      layoutX = (repeatWidth - layoutWidth) / 2;
    }
    const printable = getRibbonPrintableGeometry({
      widthMm: state.width,
      repeatMm,
      x: 0,
      y,
      width: repeatWidth,
      height,
    });
    const contentPrintable = preserveComposition
      ? getRibbonPrintableGeometry({
      widthMm: state.width,
      repeatMm: layoutRepeatMm,
      x: layoutX,
      y,
      width: layoutWidth,
      height,
        })
      : printable;
    const layout = getRibbonContentLayout({
      bounds: contentPrintable.bounds,
      centerY: y + height / 2,
      logo: resolvedLogo?.logo
        ? {ratio: Number(resolvedLogo.logo.ratio) || 1}
        : null,
      text,
      textMetrics,
      logoScale: style.logoScale,
      logoOffsetX: 0,
      logoOffsetY: style.logoOffsetY,
      textOffsetX: 0,
      textOffsetY: style.textOffsetY,
      manualLayout: style.layoutMode === 'manual',
      preferredFontSize:
        (state.width === 20 ? 39 : 31) * (style.fontSize / 32),
    });
    return {
      ...layout,
      outer: {x: 0, y, width: repeatWidth, height},
      printable,
      repeatMm,
    };
  }

  function getNaturalRibbonContentWidthMm(
    text,
    resolvedLogo,
    textMetrics = getTextMetrics(text, 'ribbon'),
  ) {
    const style = getProductStyle('ribbon');
    const hasLogo = Boolean(resolvedLogo?.logo);
    const hasText = Boolean(text);
    const outerHeight = state.width === 15 ? 76 : 100;
    const printableHeightMm = Math.max(0, state.width - PRINT_MARGIN_MM * 2);
    const printableHeightUnits =
      (printableHeightMm / state.width) * outerHeight;
    const preferredFontSize =
      (state.width === 20 ? 39 : 31) * (style.fontSize / 32);
    const fittedFontSize = hasText
      ? Math.min(
          preferredFontSize,
          printableHeightUnits / Math.max(textMetrics.heightPerSize, 1e-7),
        )
      : 0;
    const textWidthMm = hasText
      ? textMetrics.widthPerSize * fittedFontSize * (state.width / outerHeight)
      : 0;
    const logoRatio = Number(resolvedLogo?.logo?.ratio) || 1;
    const effectiveLogoScale = Math.min(1, Math.max(0, style.logoScale));
    const logoWidthMm = hasLogo
      ? printableHeightMm * logoRatio * effectiveLogoScale
      : 0;
    const internalGapMm =
      hasLogo && hasText
        ? Math.max(
            PRINT_MARGIN_MM,
            Math.min(8, (logoWidthMm + textWidthMm) * 0.04),
          )
        : 0;

    return {
      widthMm: logoWidthMm + textWidthMm + internalGapMm,
      logoWidthMm,
      textWidthMm,
      internalGapMm,
      source:
        hasLogo && hasText
          ? 'composition'
          : hasLogo
            ? 'logo'
            : hasText
              ? 'text'
              : 'empty',
    };
  }

  function calculateAutomaticRibbonRepeat() {
    const text = getPreviewText('ribbon').trim();
    const resolvedLogo = getPreviewLogo('ribbon');
    const textMetrics = getTextMetrics(
      text,
      'ribbon',
      getPreviewFont('ribbon'),
    );
    const content = getNaturalRibbonContentWidthMm(
      text,
      resolvedLogo,
      textMetrics,
    );
    const goldenGapMm = content.widthMm / GOLDEN_RATIO;
    const desiredRepeatMm = content.widthMm + goldenGapMm;
    let repeatMm =
      Math.ceil(
        Math.max(MIN_RIBBON_REPEAT_MM, desiredRepeatMm) / REPEAT_ROUNDING_MM,
      ) * REPEAT_ROUNDING_MM;
    repeatMm = Math.min(MAX_RIBBON_REPEAT_MM, repeatMm);

    while (
      repeatMm < MAX_RIBBON_REPEAT_MM &&
      !calculateRibbonLayout(
        repeatMm,
        text,
        resolvedLogo,
        textMetrics,
      ).valid
    ) {
      repeatMm = Math.min(
        MAX_RIBBON_REPEAT_MM,
        repeatMm + REPEAT_ROUNDING_MM,
      );
    }

    return {...content, repeatMm, goldenGapMm, desiredRepeatMm};
  }

  function updateRibbonRepeat() {
    const automatic = calculateAutomaticRibbonRepeat();
    if (state.repeatMode === 'auto') state.repeatMm = automatic.repeatMm;

    const actualGapMm = Math.max(0, state.repeatMm - automatic.widthMm);
    document.body.dataset.ribbonRepeatMode = state.repeatMode;
    document.body.dataset.ribbonRepeatSource = automatic.source;
    document.body.dataset.ribbonContentWidthMm = automatic.widthMm.toFixed(2);
    document.body.dataset.ribbonGoldenGapMm = automatic.goldenGapMm.toFixed(2);
    document.body.dataset.ribbonRepeatGapMm = actualGapMm.toFixed(2);
    document.body.dataset.ribbonRepeatMm = String(state.repeatMm);

    const input = $('#repeatMm');
    const mode = $('#repeatMode');
    const hint = $('#repeatHint');
    if (input) input.value = state.repeatMm;
    if (mode) {
      mode.textContent =
        `${state.repeatMode === 'auto' ? 'Автоматически' : 'Вручную'} · ${state.repeatMm} мм`;
    }
    if (hint) {
      hint.textContent =
        automatic.source === 'empty'
          ? 'Минимальный шаг до добавления логотипа или надписи.'
          : `Свободный интервал ${actualGapMm.toFixed(1)} мм: ширина композиции ÷ 1,618.`;
    }
  }

  function getClippedRibbonPreview(text, resolvedLogo) {
    const characters = [...text.trim()];
    let low = 0;
    let high = characters.length;
    let result = null;

    while (low <= high) {
      const length = Math.floor((low + high) / 2);
      const prefix = characters.slice(0, length).join('').trimEnd();
      const candidate = `${prefix}…`;
      const layout = calculateRibbonLayout(
        state.repeatMm,
        candidate,
        resolvedLogo,
      );
      if (layout.valid) {
        result = {text: candidate, layout};
        low = length + 1;
      } else {
        high = length - 1;
      }
    }

    return result;
  }

  function getRequiredRibbonLayout(text, resolvedLogo, textMetrics) {
    const recommendationMetrics = {
      ...textMetrics,
      widthPerSize: textMetrics.widthPerSize * 1.28,
    };
    const minimum = Math.max(MIN_RIBBON_REPEAT_MM, state.repeatMm);
    let maximum = Math.max(MAX_RIBBON_REPEAT_MM, minimum);
    let maximumLayout = calculateRibbonLayout(
      maximum,
      text,
      resolvedLogo,
      recommendationMetrics,
    );

    while (!maximumLayout.valid && maximum < 10000) {
      maximum = Math.min(10000, maximum * 2);
      maximumLayout = calculateRibbonLayout(
        maximum,
        text,
        resolvedLogo,
        recommendationMetrics,
      );
    }
    if (!maximumLayout.valid) return null;

    let low = minimum;
    let high = maximum;
    while (high - low > 1) {
      const middle = (low + high) / 2;
      const layout = calculateRibbonLayout(
        middle,
        text,
        resolvedLogo,
        recommendationMetrics,
      );
      if (layout.valid) high = middle;
      else low = middle;
    }

    let repeatMm = Math.ceil(high / 5) * 5;
    let layout = calculateRibbonLayout(
      repeatMm,
      text,
      resolvedLogo,
      recommendationMetrics,
    );
    while (!layout.valid && repeatMm < 10000) {
      repeatMm += 5;
      layout = calculateRibbonLayout(
        repeatMm,
        text,
        resolvedLogo,
        recommendationMetrics,
      );
    }
    return layout.valid ? {repeatMm, layout} : null;
  }

  function addRibbonOverflow(layout, text, resolvedLogo, textMetrics) {
    if (layout.valid || !text) return layout;

    const preview = getClippedRibbonPreview(text, resolvedLogo);
    const required = getRequiredRibbonLayout(
      text,
      resolvedLogo,
      textMetrics,
    );
    layout.previewText = preview?.text || '…';
    layout.previewTextBox = preview?.layout.textBox || null;
    layout.previewFontSize =
      preview?.layout.fontSize || layout.fontSize;
    layout.overflow = required
      ? {
          requiredRepeatMm: required.repeatMm,
          canApply: required.repeatMm <= MAX_RIBBON_REPEAT_MM,
          fullLayout: required.layout,
        }
      : {
          requiredRepeatMm: null,
          canApply: false,
          fullLayout: null,
        };
    return layout;
  }

  function renderStickerFrame(geometry, backgroundColor) {
    const frame = $('#stickerFrame');
    const guide = $('#stickerPrintableGuide');
    const paper = document.querySelector('.sticker-paper');
    if (!frame || !guide) return;
    if (paper) paper.dataset.shape = geometry.shape;
    frame.innerHTML = '';
    guide.innerHTML = '';
    const shape = geometry.shape === 'circle' ? 'circle' : 'rect';
    const createShape = (target, printable = false) => {
      const element = svgEl(shape);
      if (shape === 'circle') {
        const circle = printable ? geometry.circle : {
          cx: geometry.outer.x + geometry.outer.width / 2,
          cy: geometry.outer.y + geometry.outer.height / 2,
          radius: geometry.radius,
        };
        element.setAttribute('cx', circle.cx);
        element.setAttribute('cy', circle.cy);
        element.setAttribute('r', printable ? circle.radius : circle.radius);
      } else {
        const bounds = printable ? geometry.bounds : geometry.outer;
        element.setAttribute('x', bounds.x);
        element.setAttribute('y', bounds.y);
        element.setAttribute('width', bounds.width);
        element.setAttribute('height', bounds.height);
        element.setAttribute(
          'rx',
          printable ? bounds.radius : geometry.outer.radius || 0,
        );
      }
      target.appendChild(element);
      return element;
    };
    const base = createShape(frame);
    base.setAttribute('id', 'stickerBg');
    base.setAttribute('fill', backgroundColor || '#fff');
    const edge = createShape(frame);
    edge.setAttribute('fill', 'none');
    edge.setAttribute('stroke', 'rgba(0,0,0,.10)');
    edge.setAttribute('stroke-width', '3');
    const safe = createShape(guide, true);
    safe.setAttribute('data-preview-overlay', '');
  }

  function renderRibbon() {
    const resolvedLogo = getResolvedLogo('ribbon');
    const previewLogo = getPreviewLogo('ribbon');
    const paintedResolvedLogo = getPaintedLogo('ribbon', resolvedLogo);
    const paintedPreviewLogo = getPaintedLogo('ribbon', previewLogo);
    const resolvedText = getResolvedText('ribbon').trim();
    const previewTextValue = getPreviewText('ribbon');
    const textMetrics = getTextMetrics(resolvedText, 'ribbon');
    const ribbonLayout = addRibbonOverflow(
      calculateRibbonLayout(
        state.repeatMm,
        resolvedText,
        resolvedLogo,
        textMetrics,
        state.repeatMode === 'manual',
      ),
      resolvedText,
      resolvedLogo,
      textMetrics,
    );
    const previewFont = getPreviewFont('ribbon');
    const previewTextMetrics = getTextMetrics(
      previewTextValue,
      'ribbon',
      previewFont,
    );
    const previewLayout =
      previewLogo === resolvedLogo && previewTextValue === resolvedText
      ? ribbonLayout
      : addRibbonOverflow(
          calculateRibbonLayout(
            state.repeatMm,
            previewTextValue,
            previewLogo,
            previewTextMetrics,
            state.repeatMode === 'manual',
          ),
          previewTextValue,
          previewLogo,
          previewTextMetrics,
        );
    const {height, y, width: repeatWidth} = ribbonLayout.outer;
    const {printable} = ribbonLayout;
    currentLayouts.ribbon = ribbonLayout;
    currentPreviewLayouts.ribbon = previewLayout;

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

    const guideRect = $('#ribbonPrintableGuide rect');
    if (guideRect) {
      guideRect.setAttribute('x', 28 + printable.bounds.x);
      guideRect.setAttribute('y', printable.bounds.y);
      guideRect.setAttribute('width', 1144 - 2 * printable.bounds.x);
      guideRect.setAttribute('height', printable.bounds.height);
    }

    for (let startX = -30; startX < 1260; startX += repeatWidth) {
      const cell = svgEl('g');
      const boxIsFullyVisible = (box) =>
        Boolean(
          box &&
          startX + box.x >= 28 &&
          startX + box.x + box.width <= 1172,
        );

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

      const content = svgEl('g', {
        'clip-path': `url(#${clipId})`,
        'data-production-content': '',
      });

      if (ribbonLayout.logoBox) {
        drawLogoBox(content, paintedResolvedLogo, {
          ...ribbonLayout.logoBox,
          x: startX + ribbonLayout.logoBox.x,
        });
      }
      if (
        ribbonLayout.valid &&
        boxIsFullyVisible(ribbonLayout.textBox)
      ) {
        const text = drawText(
          content,
          startX + ribbonLayout.textBox.x + ribbonLayout.textBox.width / 2,
          ribbonLayout.textBox.y + ribbonLayout.textBox.height / 2,
          ribbonLayout.fontSize,
          resolvedText,
          'ribbon',
        );
        text.dataset.effectiveFontSize = String(ribbonLayout.fontSize);
      }

      cell.appendChild(content);

      if (previewLayout !== ribbonLayout) {
        cell.dataset.demoLogoPreview = 'true';
        const previewContent = svgEl('g', {
          'clip-path': `url(#${clipId})`,
          'data-preview-overlay': '',
        });
        if (previewLayout.logoBox) {
          drawLogoBox(previewContent, paintedPreviewLogo, {
            ...previewLayout.logoBox,
            x: startX + previewLayout.logoBox.x,
          });
        }
        const previewTextBox = previewLayout.valid
          ? previewLayout.textBox
          : previewLayout.previewTextBox;
        const previewText = previewLayout.valid
          ? previewTextValue
          : previewLayout.previewText;
        const previewFontSize = previewLayout.valid
          ? previewLayout.fontSize
          : previewLayout.previewFontSize;
        if (boxIsFullyVisible(previewTextBox) && previewText) {
          drawText(
            previewContent,
            startX + previewTextBox.x + previewTextBox.width / 2,
            previewTextBox.y + previewTextBox.height / 2,
            previewFontSize,
            previewText,
            'ribbon',
            'middle',
            previewFont,
          );
        }
        cell.appendChild(previewContent);
      }
      layer.appendChild(cell);
    }
  }

  function renderSticker() {
    const style = getProductStyle('sticker');

    const layer = $('#stickerContent');
    if (!layer) return;
    layer.innerHTML = '';

    const resolvedLogo = getResolvedLogo('sticker');
    const previewLogo = getPreviewLogo('sticker');
    const paintedResolvedLogo = getPaintedLogo('sticker', resolvedLogo);
    const paintedPreviewLogo = getPaintedLogo('sticker', previewLogo);
    const resolvedText = getResolvedText('sticker');
    const previewTextValue = getPreviewText('sticker');
    const hasText = Boolean(resolvedText.trim());
    const variant = getStickerVariant(state.stickerVariantId);
    const printable = getStickerGeometry({
      shape: variant.shape,
      widthMm: variant.widthMm,
      heightMm: variant.heightMm,
      diameterMm: variant.diameterMm,
      cornerRadiusMm: variant.cornerRadiusMm,
      x: 22,
      y: 22,
      width: 356,
      height: 356,
    });
    renderStickerFrame(printable, state.stickerBg);
    const stickerPreferred = {
      25: {combined: 28, textOnly: 34},
      30: {combined: 30, textOnly: 38},
      40: {combined: 32, textOnly: 44},
      50: {combined: 33, textOnly: 48},
    }[state.stickerSize];

    const getLayout = (
      logo,
      textValue = resolvedText,
      font = style.font,
    ) => {
      const hasLogo = Boolean(logo?.logo);
      const layoutHasText = Boolean(textValue.trim());
      return getStickerContentLayout({
        stickerArea: printable,
        circle: printable.circle,
        logo: hasLogo ? {ratio: Number(logo.logo.ratio) || 1} : null,
        text: layoutHasText ? textValue : '',
        textMetrics: getTextMetrics(textValue, 'sticker', font),
        logoScale: style.logoScale,
        logoOffsetX: style.logoOffsetX,
        logoOffsetY: style.logoOffsetY,
        textOffsetX: style.textOffsetX,
        textOffsetY: style.textOffsetY,
        manualLayout: style.layoutMode === 'manual',
        textScale: style.fontSize / 64,
        preferredFontSize: hasLogo && layoutHasText
          ? stickerPreferred.combined * (style.fontSize / 32)
          : stickerPreferred.textOnly * (style.fontSize / 32),
      });
    };
    const stickerLayout = getLayout(resolvedLogo);
    const previewLayout =
      previewLogo === resolvedLogo && previewTextValue === resolvedText.trim()
      ? stickerLayout
      : getLayout(
          previewLogo,
          previewTextValue,
          getPreviewFont('sticker'),
        );
    currentLayouts.sticker = {
      ...stickerLayout,
      outer: {x: 22, y: 22, width: 356, height: 356},
      printable,
    };
    currentPreviewLayouts.sticker = {
      ...previewLayout,
      outer: {x: 22, y: 22, width: 356, height: 356},
      printable,
    };

    const productionContent = svgEl('g', {
      'data-production-content': '',
    });
    if (stickerLayout.logoBox) {
      drawLogoBox(productionContent, paintedResolvedLogo, stickerLayout.logoBox);
    }
    if (stickerLayout.valid && stickerLayout.textBox) {
      const text = drawText(
        productionContent,
        stickerLayout.textBox.x + stickerLayout.textBox.width / 2,
        stickerLayout.textBox.y + stickerLayout.textBox.height / 2,
        stickerLayout.fontSize,
        resolvedText,
        'sticker',
      );
      text.dataset.effectiveFontSize = String(stickerLayout.fontSize);
    }
    layer.appendChild(productionContent);

    if (previewLayout !== stickerLayout) {
      layer.dataset.demoLogoPreview = 'true';
      const previewContent = svgEl('g', {'data-preview-overlay': ''});
      if (previewLayout.logoBox) {
        drawLogoBox(previewContent, paintedPreviewLogo, previewLayout.logoBox);
      }
      if (previewLayout.valid && previewLayout.textBox) {
        drawText(
          previewContent,
          previewLayout.textBox.x + previewLayout.textBox.width / 2,
          previewLayout.textBox.y + previewLayout.textBox.height / 2,
          previewLayout.fontSize,
          previewTextValue,
          'sticker',
          'middle',
          getPreviewFont('sticker'),
        );
      }
      layer.appendChild(previewContent);
    } else {
      delete layer.dataset.demoLogoPreview;
    }

    if ($('#stickerSizeLabel')) {
      $('#stickerSizeLabel').textContent = variant.displaySize;
    }
  }

  function getStickerPricing() {
    const variant = getStickerVariant(state.stickerVariantId);
    if (variant.id === 'roundrect-80x20') {
      return {requiresIndividualCalculation: true};
    }
    if (variant.id === 'circle-25') {
      return {requiresIndividualCalculation: true};
    }
    return {
      requiresIndividualCalculation: false,
      byQuantity: {50: 450, 100: 700, 250: 1350, 500: 2200},
    };
  }

  function getStickerDisplayLabel() {
    const variant = getStickerVariant(state.stickerVariantId);
    return variant.shape === 'roundrect'
      ? `${variant.displaySize} · радиус 2 мм`
      : variant.displaySize;
  }

  function getStickerOrderLabel() {
    return `Стикер ${getStickerDisplayLabel()}`;
  }

  function getStickerOrderLabelPlural() {
    return `Стикеры ${getStickerDisplayLabel()}`;
  }

  function calculatePrice() {
    const ribbonBase = state.meters > 0
      ? ({10: 390, 25: 590, 50: 790, 100: 1090, 200: 1590}[state.meters] || 0)
      : 0;
    const widthExtra = state.meters > 0 && state.width === 20 ? 180 : 0;
    const stickerPricing = getStickerPricing();
    const stickerPriceUnavailable =
      state.stickerQty > 0 && stickerPricing.requiresIndividualCalculation;
    const stickerBase = state.stickerQty > 0 && !stickerPriceUnavailable
      ? (stickerPricing.byQuantity[state.stickerQty] || 0)
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
    const normalized = {
      valid: layout.valid,
      reason: layout.reason || null,
      logoBox: normalizeBox(layout.logoBox),
      textBox: normalizeBox(layout.textBox),
      fontSizeRatio: layout.fontSize / outer.height,
      printable: layout.printable?.bounds || layout.bounds
        ? normalizeBox(layout.printable?.bounds || layout.bounds)
        : {
            cx: (layout.circle.cx - outer.x) / outer.width,
            cy: (layout.circle.cy - outer.y) / outer.height,
            radius: layout.circle.radius / outer.width,
          },
    };
    if (layout.previewText) {
      normalized.previewText = layout.previewText;
      normalized.previewTextBox = normalizeBox(layout.previewTextBox);
      normalized.previewFontSizeRatio =
        layout.previewFontSize / outer.height;
    }
    if (layout.overflow) {
      normalized.overflow = {
        requiredRepeatMm: layout.overflow.requiredRepeatMm,
        canApply: layout.overflow.canApply,
        fullLayout: normalizeLayout(layout.overflow.fullLayout),
      };
    }
    return normalized;
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
      const textBox = layout.valid
        ? layout.textBox
        : layout.previewTextBox;
      const displayText = layout.valid ? textValue.trim() : layout.previewText;
      const fontSizeRatio = layout.valid
        ? layout.fontSizeRatio
        : layout.previewFontSizeRatio;
      const showText = Boolean(textBox && displayText);
      text.hidden = !showText;
      if (showText) {
        text.textContent = displayText;
        text.style.left = `${(textBox.x + textBox.width / 2) * 100}%`;
        text.style.top = `${(textBox.y + textBox.height / 2) * 100}%`;
        text.style.width = `${textBox.width * 100}%`;
        text.style.height = `${textBox.height * 100}%`;
        text.style.setProperty(
          'font-size',
          `${fontSizeRatio * root.getBoundingClientRect().height}px`,
          'important',
        );
      }
    }
  }

  function updateRibbonOverflowCards(layout) {
    const style = getProductStyle('ribbon');
    const overflow = layout?.overflow;
    const visible = Boolean(
      overflow &&
      state.bundle !== 'sticker' &&
      !isDemoPreviewActive(),
    );
    const requiredRepeatMm = overflow?.requiredRepeatMm || null;
    document.body.dataset.ribbonOverflow = String(visible);
    if (requiredRepeatMm) {
      document.body.dataset.ribbonRecommendedRepeat = String(
        requiredRepeatMm,
      );
    } else {
      delete document.body.dataset.ribbonRecommendedRepeat;
    }

    const displayText = isDemoPreviewActive()
      ? getPreviewText('ribbon')
      : layout?.previewText || getResolvedText('ribbon').trim();
    $$('[data-product-type="ribbon"] .dynamic-showcase-text').forEach(
      (element) => {
        element.textContent = displayText;
      },
    );

    $$('[data-ribbon-overflow-card]').forEach((card) => {
      card.hidden = !visible;
      if (!visible) return;

      const fullLayout = overflow.fullLayout;
      const surface = card.querySelector('[data-ribbon-overflow-full]');
      const logo = card.querySelector('[data-ribbon-overflow-logo]');
      const text = card.querySelector('[data-ribbon-overflow-text]');
      const measure = card.querySelector('[data-ribbon-overflow-measure]');
      const message = card.querySelector('[data-ribbon-overflow-message]');
      const button = card.querySelector('[data-apply-ribbon-repeat]');
      const resolvedLogo = getPaintedLogo('ribbon', getPreviewLogo('ribbon'));
      const fullText = getPreviewText('ribbon').trim();

      card.dataset.canApply = String(Boolean(overflow.canApply));
      if (measure) {
        measure.textContent = requiredRepeatMm
          ? `Рекомендуемый шаг ${requiredRepeatMm} мм`
          : 'Надпись слишком длинная';
      }
      if (message) {
        message.textContent = overflow.canApply
          ? `Полный текст поместится без уменьшения при шаге ${requiredRepeatMm} мм.`
          : requiredRepeatMm
            ? `Для полного текста нужен шаг ${requiredRepeatMm} мм — доступно не более ${MAX_RIBBON_REPEAT_MM} мм. Уменьшите текст или размер шрифта.`
            : 'Не удалось подобрать производственный шаг. Уменьшите текст или размер шрифта.';
      }
      if (button) {
        button.hidden = !overflow.canApply;
        button.dataset.repeatMm = requiredRepeatMm || '';
        button.textContent = requiredRepeatMm
          ? `Применить шаг ${requiredRepeatMm} мм`
          : 'Применить рекомендуемый шаг';
      }
      if (!surface) return;
      surface.hidden = !fullLayout || !requiredRepeatMm;
      if (!fullLayout || !requiredRepeatMm) return;

      surface.style.aspectRatio = `${requiredRepeatMm} / ${state.width}`;
      surface.style.minHeight =
        requiredRepeatMm > MAX_RIBBON_REPEAT_MM ? '18px' : '';
      surface.style.backgroundColor = state.ribbon;
      surface.style.color = style.print;
      surface.dataset.repeatMm = String(requiredRepeatMm);
      surface.dataset.ribbonWidthMm = String(state.width);
      surface.dataset.layout = JSON.stringify(fullLayout);
      surface.setAttribute(
        'aria-label',
        `Полный макет надписи на ленте ${state.width} мм с шагом ${requiredRepeatMm} мм`,
      );

      const surfaceHeight = surface.getBoundingClientRect().height;
      if (logo) {
        const logoBox = fullLayout.logoBox;
        logo.hidden = !logoBox || !resolvedLogo?.logo?.data;
        if (!logo.hidden) {
          logo.src = resolvedLogo.logo.data;
          logo.style.left =
            `${(logoBox.x + logoBox.width / 2) * 100}%`;
          logo.style.top =
            `${(logoBox.y + logoBox.height / 2) * 100}%`;
          logo.style.width = `${logoBox.width * 100}%`;
          logo.style.height = `${logoBox.height * 100}%`;
        }
      }
      if (text) {
        text.hidden = !fullLayout.textBox || !fullText;
        if (!text.hidden) {
          const textBox = fullLayout.textBox;
          text.textContent = fullText;
          text.style.left =
            `${(textBox.x + textBox.width / 2) * 100}%`;
          text.style.top =
            `${(textBox.y + textBox.height / 2) * 100}%`;
          text.style.width = `${textBox.width * 100}%`;
          text.style.height = `${textBox.height * 100}%`;
          text.style.fontFamily = style.font;
          text.style.fontSize =
            `${fullLayout.fontSizeRatio * surfaceHeight}px`;
          text.style.color = style.print;
        }
      }
    });
  }

  function publishEffectiveLayouts() {
    const layouts = {
      ribbon: normalizeLayout(currentPreviewLayouts.ribbon),
      sticker: normalizeLayout(currentPreviewLayouts.sticker),
    };
    const productionLayouts = {
      ribbon: normalizeLayout(currentLayouts.ribbon),
      sticker: normalizeLayout(currentLayouts.sticker),
    };
    document.body.dataset.studioLayout = JSON.stringify(layouts);
    document.body.dataset.studioProductionLayout =
      JSON.stringify(productionLayouts);
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
    updateRibbonOverflowCards(layouts.ribbon);
    const invalid = [
      state.bundle !== 'sticker' && !layouts.ribbon.valid ? 'ribbon' : null,
      state.bundle !== 'ribbon' && !layouts.sticker.valid ? 'sticker' : null,
    ].filter(Boolean);
    const validation = $('#artworkValidation');
    if (validation) {
      validation.hidden = invalid.length === 0;
      if (!invalid.length) {
        validation.textContent = '';
      } else if (invalid.includes('ribbon') && layouts.ribbon.overflow) {
        const {requiredRepeatMm, canApply} = layouts.ribbon.overflow;
        validation.textContent = canApply
          ? `Текст не помещается в текущий шаг ленты. Примените рекомендуемый шаг ${requiredRepeatMm} мм.`
          : `Текст не помещается в ленту: требуется шаг ${requiredRepeatMm || 'более 10 000'} мм, доступно не более ${MAX_RIBBON_REPEAT_MM} мм. Сократите надпись или размер текста.`;
        if (invalid.includes('sticker')) {
          validation.textContent += ' Надпись также не помещается на стикере.';
        }
      } else {
        validation.textContent =
          'Текст не помещается в печатную область. Сократите надпись.';
      }
    }
    document.body.dataset.artworkValid = String(invalid.length === 0);
    $('#submitOrder').disabled = invalid.length > 0;
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
    if (
      (state.activeContentProduct === 'ribbon' && !ribbon) ||
      (state.activeContentProduct === 'sticker' && !sticker)
    ) {
      setActiveContentProduct(ribbon ? 'ribbon' : 'sticker', {
        renderPreview: false
      });
    }
    syncControls();
    render();
    return true;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function getStickerScale() {
    return getStickerVariant(state.stickerVariantId).shape === 'circle'
      ? ({25: 0.625, 30: 0.78, 40: 1, 50: 1.22}[state.stickerSize] || 1)
      : 1;
  }

  function updateStickerScale() {
    const scale = getStickerScale();

    const stickerPaper = $('.sticker-paper');
    if (stickerPaper) {
      stickerPaper.style.transform = `scale(${scale})`;
    }

    const stickerLabel = $('#stickerSizeLabel');
    if (stickerLabel) {
      stickerLabel.textContent = getStickerVariant(state.stickerVariantId).displaySize;
    }
  }

  function getRecommendation() {
    const resolvedLogos = [getPreviewLogo('ribbon'), getPreviewLogo('sticker')].filter(
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
    if ($('#recSticker')) $('#recSticker').textContent = `Ø${rec.stickerSize} мм`;
    if ($('#recRepeat')) $('#recRepeat').textContent = `Авто · ${state.repeatMm} мм`;
    if ($('#recommendReason')) $('#recommendReason').textContent = rec.reason;
  }

  function render() {
    // The existing upload pipeline writes the legacy common aliases.
    syncCommonContentFromLegacyAliases();
    updateRibbonRepeat();
    syncFontPicker();
    const previewLogoDemo = ['ribbon', 'sticker'].some((product) =>
      isDemoLogoPreview(product),
    );
    document.body.dataset.previewDemo = String(
      isDemoPreviewActive() || previewLogoDemo,
    );
    document.body.dataset.previewDemoText = DEMO_TEXT;
    document.body.dataset.previewLogoDemo = String(previewLogoDemo);
    if ($('#previewContextTitle')) {
      $('#previewContextTitle').textContent =
        isDemoPreviewActive() ? 'Пример оформления' : 'Ваш макет';
    }
    if ($('#previewContextCopy')) {
      $('#previewContextCopy').hidden = !isDemoPreviewActive();
    }
    updateShowcaseContent();
    const printMode = (product) => {
      const print = getProductStyle(product).print;
      return print === '#b69249' ? 'gold' :
        print === '#c6c8cd' ? 'silver' :
        print === '#ffffff' ? 'white' : 'black';
    };
    document.body.dataset.ribbonPrint = printMode('ribbon');
    document.body.dataset.stickerPrint = printMode('sticker');
    document.body.dataset.studioProductStyles = JSON.stringify(state.productStyles);

    updateRecommendationCard();
    renderRibbon();
    renderSticker();

    const ribbonMockup = $('.ribbon-mockup');
    const stickerArea = $('#stickerArea');
    const kitTable = $('.kit-table');
    document.body.dataset.ribbonWidth = String(state.width);
    document.body.style.setProperty('--ribbon-live-color', state.ribbon);
    const activeStickerVariant = getStickerVariant(state.stickerVariantId);
    document.body.dataset.stickerSize = String(state.stickerSize);
    document.body.dataset.stickerVariantId = activeStickerVariant.id;
    document.body.dataset.stickerShape = activeStickerVariant.shape;
    document.body.dataset.stickerWidthMm = String(activeStickerVariant.widthMm);
    document.body.dataset.stickerHeightMm = String(activeStickerVariant.heightMm);
    document.body.dataset.stickerDisplaySize = activeStickerVariant.displaySize;
    document
      .querySelectorAll('[data-mobile-product-sample="sticker"] .mobile-products-sample-label')
      .forEach((label) => {
        label.textContent = `Стикер ${activeStickerVariant.displaySize.replace(/^Ø/, '')}`;
      });
    document.dispatchEvent(
      new CustomEvent('studio:sticker-variant-updated', {
        detail: {
          id: activeStickerVariant.id,
          shape: activeStickerVariant.shape,
          widthMm: activeStickerVariant.widthMm,
          heightMm: activeStickerVariant.heightMm,
          displaySize: activeStickerVariant.displaySize,
        },
      }),
    );
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

    updateProductShowcase();
    updateStickerScale();
    publishEffectiveLayouts();
    syncContentEditor();

    if ($('#status')) {
      $('#status').textContent =
        `Лента ${state.width} мм · ${state.bundle === 'bundle' ? `стикер ${activeStickerVariant.displaySize} · ` : ''}шаг ${state.repeatMm} мм`;
    }

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

  function syncProductFirstLabels() {
    const product = state.primaryProduct || state.activeSettingsProduct || 'ribbon';
    const isSticker = product === 'sticker';
    const productName = isSticker ? 'стикер' : 'ленту';
    const productPrepositional = isSticker ? 'стикере' : 'ленте';
    const productGenitive = isSticker ? 'стикера' : 'ленты';
    const textLabel = $(`#textInputLabel`);
    const panelCopy = $('#panel-upload .panel-copy');
    const continueButton = $('#continueUpload');
    const settingsNext = document.querySelector('#panel-settings .next-panel');
    if (textLabel) textLabel.textContent = `Надпись на ${productPrepositional}`;
    if (panelCopy && state.productFirstMode) {
      panelCopy.textContent = `Добавьте название или логотип для ${productGenitive}.`;
    }
    if (continueButton && state.productFirstMode) {
      continueButton.textContent = `Далее: настроить ${isSticker ? 'стикер' : 'ленту'}`;
    }
    if (settingsNext && state.productFirstMode) {
      settingsNext.textContent = 'Далее: получить заказ';
    }
    const fontLabel = $('#fontSizeLabel');
    const layoutHelp = $('#layoutModeHelp');
    if (fontLabel && state.productFirstMode) fontLabel.textContent = `Размер текста на ${productPrepositional}`;
    if (layoutHelp && state.productFirstMode) layoutHelp.textContent = `Studio автоматически компонует ${productName}`;
  }

  function syncProductFirstShell() {
    const choice = $('#productFirstChoice');
    const shell = document.querySelector('.app-shell');
    const choosing = state.productFirstMode && !state.primaryProduct;
    if (choice) choice.hidden = !choosing;
    if (shell) shell.hidden = choosing;
    document.body.classList.toggle('product-first-mode', state.productFirstMode && !choosing);
    const bothProductsEnabled = state.meters > 0 && state.stickerQty > 0;
    const activeWorkspace = state.productFirstMode
      ? bothProductsEnabled
        ? state.activeSettingsProduct || state.activeContentProduct || state.primaryProduct || 'ribbon'
        : state.primaryProduct || state.activeSettingsProduct || state.activeContentProduct || 'ribbon'
      : '';
    document.body.dataset.primaryProduct = state.primaryProduct || '';
    document.body.dataset.activeWorkspace = activeWorkspace;
    document.body.dataset.productFirstChoosing = String(choosing);
    syncProductFirstLabels();
  }

  function updateOrderProductControls() {
    if ($('#orderProductNotice')) {
      $('#orderProductNotice').hidden = true;
    }
    const offer = $('#secondaryProductOffer');
    const summary = $('#orderItemsSummary');
    const list = $('#orderItemsSummaryList');
    const ribbonEnabled = state.meters > 0;
    const stickerEnabled = state.stickerQty > 0;
    const canOffer = state.productFirstMode && state.primaryProduct && !(ribbonEnabled && stickerEnabled);
    if (offer) {
      offer.hidden = !canOffer;
      if (canOffer) {
        const addSticker = state.primaryProduct === 'ribbon';
        $('#secondaryProductOfferTitle').textContent = addSticker
          ? 'Стикеры в том же стиле?'
          : 'Ленту к этому дизайну?';
        $('#secondaryProductOfferCopy').textContent = addSticker
          ? 'Используем текущую надпись и логотип. Настройки можно изменить отдельно.'
          : 'Используем текущую надпись и логотип. Настройки можно изменить отдельно.';
        $('#addSecondaryProduct').textContent = addSticker ? 'Добавить стикеры' : 'Добавить ленту';
      }
    }
    if (summary && list) {
      summary.hidden = !state.productFirstMode || !(ribbonEnabled || stickerEnabled);
      list.innerHTML = '';
      const appendProductCard = ({product, title, detail, quantity, meta}) => {
        const card = document.createElement('article');
        card.className = 'order-product-card';
        card.dataset.orderProduct = product;
        const copy = document.createElement('div');
        copy.className = 'order-product-card-copy';
        const label = document.createElement('span');
        label.className = 'order-product-card-label';
        label.textContent = title;
        const details = document.createElement('strong');
        details.textContent = detail;
        const quantityLine = document.createElement('small');
        quantityLine.textContent = `${quantity} · ${meta}`;
        copy.append(label, details, quantityLine);
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'button ghost order-product-card-action';
        button.dataset.configureProduct = product;
        button.textContent = `Настроить ${product === 'ribbon' ? 'ленту' : 'стикер'}`;
        card.append(copy, button);
        list.appendChild(card);
      };
      if (ribbonEnabled) {
        appendProductCard({
          product: 'ribbon',
          title: 'Изделие 01',
          detail: `Лента ${state.width} мм`,
          quantity: `${state.meters} м`,
          meta: 'настройки сохранены отдельно',
        });
      }
      if (stickerEnabled) {
        appendProductCard({
          product: 'sticker',
          title: ribbonEnabled ? 'Изделие 02' : 'Изделие 01',
          detail: getStickerOrderLabel(),
          quantity: `${state.stickerQty} шт.`,
          meta: 'настройки сохранены отдельно',
        });
      }
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
  }

  function setFileCardActionsVisible(visible) {
    if ($('#fileCardActions')) $('#fileCardActions').hidden = !visible;
  }

  function showUploadFeedback(message) {
    const feedback = $('#uploadFeedback');
    if (!feedback) return;
    feedback.textContent = message;
    feedback.hidden = !message;
  }

  function setUploadState(mode, message = '') {
    const dropZone = $('#dropZone');
    if (dropZone) {
      dropZone.dataset.uploadState = mode;
      dropZone.setAttribute('aria-busy', String(mode === 'processing'));
    }
    showUploadFeedback(message);
  }

  function validateLogoFile(file) {
    if (!file.size) return 'Файл пустой. Выберите другой логотип.';
    if (file.size > MAX_LOGO_FILE_BYTES) {
      return 'Файл больше 20 МБ. Уменьшите его или сохраните в SVG.';
    }
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['svg', 'png', 'jpg', 'jpeg', 'pdf'].includes(ext)) {
      return 'Поддерживаются только SVG, PNG, JPEG и PDF.';
    }
    return '';
  }

  async function tightenSvgArtwork(svg) {
    const host = document.createElement('div');
    Object.assign(host.style, {
      position: 'fixed',
      left: '-10000px',
      top: '0',
      width: '1000px',
      height: '1000px',
      visibility: 'hidden',
      pointerEvents: 'none',
    });
    const clone = svg.cloneNode(true);
    clone.removeAttribute('width');
    clone.removeAttribute('height');
    clone.style.width = '1000px';
    clone.style.height = '1000px';
    host.appendChild(clone);
    document.body.appendChild(host);
    await new Promise((resolve) => requestAnimationFrame(resolve));
    try {
      let bbox;
      try {
        bbox = clone.getBBox({stroke: true});
      } catch {
        bbox = clone.getBBox();
      }
      if (bbox.width > 0 && bbox.height > 0) {
        const padding = Math.max(bbox.width, bbox.height) * 0.002;
        svg.setAttribute(
          'viewBox',
          [
            bbox.x - padding,
            bbox.y - padding,
            bbox.width + padding * 2,
            bbox.height + padding * 2,
          ].join(' '),
        );
        svg.removeAttribute('width');
        svg.removeAttribute('height');
      }
    } catch {
      // The original viewBox remains the safe fallback for unsupported SVGs.
    } finally {
      host.remove();
    }
    return svg;
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
    recolorAsset(demoLogoAsset);
    ['ribbon', 'sticker'].forEach((product) => {
      const override = state.content.logo[product];
      if (override.mode === 'override') recolorAsset(override.value);
    });
    syncLegacyContentAliasesFromContent();

  }

  function hasTransparency(imageData) {
    const data = imageData.data;
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] < 250) return true;
    }
    return false;
  }

  async function rasterToSvg(image, fileType) {
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
    const tracer = window.RibbonStudioTrace;
    const maskEngine = window.RibbonStudioTraceMask;
    if (
      !maskEngine?.analyze ||
      !maskEngine?.toBinaryImageData ||
      !maskEngine?.trimMask
    ) {
      throw new Error('Модуль печатной маски недоступен.');
    }
    if (!tracer?.traceBinaryImage) {
      throw new Error('Модуль трассировки недоступен.');
    }

    const maskAnalysis = maskEngine.analyze(imageData);
    const traceVariant = async (polarity, mask, metrics) => {
      if (!metrics?.count) return null;
      const trimmed = maskEngine.trimMask(mask, width, height);
      if (!trimmed.width || !trimmed.height) return null;
      const traced = await tracer.traceBinaryImage(
        maskEngine.toBinaryImageData(
          trimmed.mask,
          trimmed.width,
          trimmed.height,
        ),
        {preset: 'faithful'},
      );
      const svgSource = traced?.svgSource;
      if (!svgSource || !/<path\b/i.test(svgSource)) {
        throw new Error('Трассировка не создала векторные контуры.');
      }
      return {
        polarity,
        svgSource,
        width: trimmed.width,
        height: trimmed.height,
        ratio: trimmed.ratio,
        artworkBounds: trimmed.artworkBounds,
        cropBounds: trimmed.cropBounds,
        padding: trimmed.padding,
        coverage: metrics.count / (width * height),
        frameRisk: metrics.frameRisk,
        pathCount: (svgSource.match(/<path\b/gi) || []).length,
        engine: traced.engine,
        engineVersion: traced.engineVersion,
        preset: traced.preset,
        durationMs: traced.durationMs,
      };
    };

    const [signVariant, backgroundVariant] = await Promise.all([
      traceVariant('sign', maskAnalysis.signMask, maskAnalysis.signMetrics),
      maskAnalysis.alternativesAvailable
        ? traceVariant(
            'background',
            maskAnalysis.backgroundMask,
            maskAnalysis.backgroundMetrics,
          )
        : null,
    ]);
    if (!signVariant) {
      throw new Error('Не удалось отделить знак от фона.');
    }

    let quality = 'Фон удалён — печатаются только элементы знака.';
    let warning = maskAnalysis.warning;
    if (signVariant.coverage < 0.008) {
      quality = 'Обнаружено мало деталей — файл обязательно проверим вручную.';
      warning = true;
    } else if (signVariant.frameRisk) {
      quality = 'В макете осталась крупная заливка — проверьте выбор печатной области.';
      warning = true;
    } else if (maskAnalysis.confidence < 0.62) {
      quality = 'Фон отделён с невысокой уверенностью — сравните варианты ниже.';
      warning = true;
    }

    return {
      svgSource: signVariant.svgSource,
      ratio: signVariant.ratio,
      width: signVariant.width,
      height: signVariant.height,
      transparent,
      coverage: signVariant.coverage,
      quality,
      warning,
      fileType,
      engine: signVariant.engine,
      engineVersion: signVariant.engineVersion,
      preset: signVariant.preset,
      durationMs: signVariant.durationMs,
      pathCount: signVariant.pathCount,
      polarity: 'sign',
      maskMethod: maskAnalysis.method,
      polarityConfidence: maskAnalysis.confidence,
      alternativesAvailable: Boolean(backgroundVariant),
      frameRisk: signVariant.frameRisk,
      variants: {
        sign: signVariant,
        background: backgroundVariant,
      },
    };
  }

  function showTraceStatus(result) {
    const status = $('#traceStatus');
    if (!status) return;

    status.hidden = false;
    status.classList.toggle('warning', result.warning);

    const polarityControl = $('#tracePolarityControl');
    const polarityHint = $('#tracePolarityHint');
    if (polarityControl) {
      polarityControl.hidden = !result.alternativesAvailable;
      polarityControl
        .querySelectorAll('[data-trace-polarity]')
        .forEach((button) => {
          const active = button.dataset.tracePolarity === result.polarity;
          button.classList.toggle('active', active);
          button.setAttribute('aria-pressed', String(active));
        });
    }
    if (polarityHint) {
      polarityHint.textContent =
        result.polarity === 'background'
          ? 'Выбрана заливка фона. Используйте её только если плашка является частью логотипа.'
          : 'По умолчанию фон удалён: на ленту переносятся буквы и элементы логотипа.';
    }
    const preparation =
      result.maskMethod === 'alpha'
        ? 'Прозрачность сохранена'
        : result.polarity === 'background'
          ? 'Выбрана фоновая заливка'
          : 'Фон удалён';
    $('#traceDetails').textContent =
      `${preparation} · ${result.width} × ${result.height} · ${result.quality}`;
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
    cropState.suggestion = null;
    cropState.manuallyAdjusted = false;
    const analysisToken = cropState.analysisToken + 1;
    cropState.analysisToken = analysisToken;

    $('#cropZoom').value = 100;
    resetCropFrame();
    setCropSuggestionStatus(
      'analyzing',
      'Ищем логотип или главный объект…',
    );

    cropModalOrigin =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : $('#dropZone');
    $('#cropModal').classList.add('open');
    $('#cropModal').setAttribute('aria-hidden', 'false');
    setPrintGuidesEditing(true);

    requestAnimationFrame(() => {
      drawCropCanvas();
      suggestCropArea(image, analysisToken);
      $('#cropCancel').focus({preventScroll: true});
    });
  }

  function closeCropModal({restoreFocus = true} = {}) {
    cropState.analysisToken += 1;
    $('#cropModal').classList.remove('open');
    $('#cropModal').setAttribute('aria-hidden', 'true');
    cropState.target = 'common';
    if (restoreFocus) {
      (cropModalOrigin || $('#dropZone'))?.focus({preventScroll: true});
    }
    cropModalOrigin = null;
    setPrintGuidesEditing(false);
  }

  function resetCropFrame() {
    const frame = $('#cropFrame');
    frame.style.left = '18%';
    frame.style.top = '18%';
    frame.style.width = '64%';
    frame.style.height = '64%';
  }

  function setCropSuggestionStatus(stateName, message) {
    const status = $('#cropSuggestionStatus');
    if (!status) return;
    status.dataset.state = stateName;
    status.textContent = message;
  }

  function applyCropSuggestionBounds(bounds) {
    if (!bounds || !cropState.image) return;
    const stageRect = $('#cropStage').getBoundingClientRect();
    const frame = $('#cropFrame');
    const imageWidth = cropState.image.width;
    const imageHeight = cropState.image.height;
    const baseScale = Math.min(
      stageRect.width / imageWidth,
      stageRect.height / imageHeight,
    );
    const drawWidth = imageWidth * baseScale;
    const drawHeight = imageHeight * baseScale;
    const imageLeft = (stageRect.width - drawWidth) / 2;
    const imageTop = (stageRect.height - drawHeight) / 2;
    const left = ((imageLeft + bounds.x * drawWidth) / stageRect.width) * 100;
    const top = ((imageTop + bounds.y * drawHeight) / stageRect.height) * 100;
    const width = (bounds.width * drawWidth / stageRect.width) * 100;
    const height = (bounds.height * drawHeight / stageRect.height) * 100;
    const safeWidth = Math.max(12, Math.min(100, width));
    const safeHeight = Math.max(12, Math.min(100, height));

    frame.style.left = `${Math.max(0, Math.min(100 - safeWidth, left))}%`;
    frame.style.top = `${Math.max(0, Math.min(100 - safeHeight, top))}%`;
    frame.style.width = `${safeWidth}%`;
    frame.style.height = `${safeHeight}%`;
  }

  async function suggestCropArea(image, analysisToken) {
    const smartCrop = window.RibbonStudioSmartCrop;
    if (!smartCrop?.suggest) {
      setCropSuggestionStatus(
        'manual',
        'Настройте область вручную — автоматический анализ недоступен.',
      );
      return;
    }

    try {
      const suggestion = await smartCrop.suggest(image);
      if (
        cropState.analysisToken !== analysisToken ||
        cropState.manuallyAdjusted ||
        !$('#cropModal').classList.contains('open')
      ) {
        return;
      }

      cropState.suggestion = suggestion;
      if (!suggestion?.bounds || suggestion.confidence < 0.5) {
        setCropSuggestionStatus(
          'manual',
          'Не удалось уверенно определить объект. Настройте рамку вручную.',
        );
        return;
      }

      applyCropSuggestionBounds(suggestion.bounds);
      const message = ['face', 'faces'].includes(suggestion.method)
        ? 'Лица найдены. Проверьте предложенную область.'
        : 'Область предложена автоматически. Проверьте рамку.';
      setCropSuggestionStatus('ready', message);
    } catch {
      setCropSuggestionStatus(
        'manual',
        'Не удалось уверенно определить объект. Настройте рамку вручную.',
      );
    }
  }

  function markCropManuallyAdjusted() {
    if (cropState.manuallyAdjusted) return;
    cropState.manuallyAdjusted = true;
    cropState.analysisToken += 1;
    setCropSuggestionStatus('manual', 'Область скорректирована вручную.');
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
      usedWhole:useWhole,
      smartCrop: cropState.suggestion
        ? {
            method: cropState.suggestion.method,
            confidence: cropState.suggestion.confidence,
            manuallyAdjusted: cropState.manuallyAdjusted || useWhole
          }
        : null
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

  async function processRasterAfterCrop(
    file,
    image,
    croppedDataUrl,
    originalDataUrl,
    cropMeta,
    target,
    originalSize = {width: image.width, height: image.height}
  ) {
    const ext = file.name.split('.').pop().toLowerCase();
    let result;
    try {
      result = await rasterToSvg(image, ext);
    } catch {
      setUploadState(
        'error',
        'Не удалось построить контуры. Попробуйте другой файл или загрузите готовый SVG.',
      );
      showFileCard(
        file,
        `${ext.toUpperCase()} · ${image.width} × ${image.height} px`,
        'Предыдущий макет сохранён — новый файл не применён',
        true,
      );
      return;
    }

    if (!result || !result.svgSource) {
      showFileCard(
        file,
        `${ext.toUpperCase()} · ${image.width} × ${image.height} px`,
        'Не удалось автоматически подготовить вектор',
        true
      );
      return;
    }

    tracePolaritySession = {
      file,
      imageWidth: image.width,
      imageHeight: image.height,
      originalRaster: {
        name: file.name,
        type: file.type,
        width: originalSize.width || image.width,
        height: originalSize.height || image.height,
        data: originalDataUrl,
        crop: cropMeta,
      },
      result,
      target,
    };
    applyTracePolarity('sign');
  }

  function traceInfoForPolarity(result, polarity) {
    const variant = result.variants?.[polarity] || result.variants?.sign;
    if (!variant) return null;
    const backgroundSelected = polarity === 'background';
    const warning = backgroundSelected || result.warning || variant.frameRisk;
    return {
      ratio: variant.ratio,
      width: variant.width,
      height: variant.height,
      artworkBounds: variant.artworkBounds,
      cropBounds: variant.cropBounds,
      padding: variant.padding,
      transparent: result.transparent,
      coverage: variant.coverage,
      quality: backgroundSelected
        ? 'Выбрана печать фоновой плашки.'
        : result.quality,
      warning,
      fileType: result.fileType,
      engine: variant.engine,
      engineVersion: variant.engineVersion,
      preset: variant.preset,
      durationMs: variant.durationMs,
      pathCount: variant.pathCount,
      polarity,
      maskMethod: result.maskMethod,
      polarityConfidence: result.polarityConfidence,
      alternativesAvailable: result.alternativesAvailable,
      frameRisk: variant.frameRisk,
    };
  }

  function applyTracePolarity(polarity) {
    const session = tracePolaritySession;
    if (!session) return;
    const normalizedPolarity =
      polarity === 'background' && session.result.variants?.background
        ? 'background'
        : 'sign';
    const variant = session.result.variants?.[normalizedPolarity];
    const traceInfo = traceInfoForPolarity(
      session.result,
      normalizedPolarity,
    );
    if (!variant?.svgSource || !traceInfo) return;

    const asset = {
      originalRaster: session.originalRaster,
      traceInfo,
      logoSvgSource: variant.svgSource,
      logoType: 'svg-auto',
      logo: {
        data: recolorSvgSource(variant.svgSource),
        ratio: variant.ratio,
      },
    };

    const minSide = Math.min(session.imageWidth, session.imageHeight);
    const warning = minSide < 700 || traceInfo.warning;

    showFileCard(
      session.file,
      `${traceInfo.fileType.toUpperCase()} · выделено ${session.imageWidth} × ${session.imageHeight} px`,
      warning
        ? normalizedPolarity === 'background'
          ? 'Выбрана фоновая плашка — перед печатью обязательно проверим макет'
          : 'Макет преобразован в SVG — контуры проверим вручную'
        : 'Изображение автоматически преобразовано в SVG',
      warning,
    );

    showTraceStatus(traceInfo);
    commitLogoAsset(asset, session.target, {
      returnToPreview: !session.applied,
    });
    session.applied = true;
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
      markCropManuallyAdjusted();
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
      markCropManuallyAdjusted();
      cropState.rotation = (cropState.rotation+90)%360;
      cropState.offsetX = 0;
      cropState.offsetY = 0;
      drawCropCanvas();
    });

    $('#cropApply').addEventListener('click', () => cropSelectionToImage(false));
    $('#cropUseAll').addEventListener('click', () => cropSelectionToImage(true));
    $('#cropCancel').addEventListener('click', closeCropModal);
    $('#cropModal').addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeCropModal();
        return;
      }
      trapDialogFocus(event, $('#cropModal'));
    });

    window.addEventListener('resize', () => {
      if (!$('#cropModal').classList.contains('open')) return;
      drawCropCanvas();
      if (cropState.suggestion?.bounds && !cropState.manuallyAdjusted) {
        applyCropSuggestionBounds(cropState.suggestion.bounds);
      }
    });
  }

  function getPdfJs() {
    if (!pdfJsPromise) {
      pdfJsPromise = import(PDFJS_MODULE_URL).then((pdfjs) => {
        pdfjs.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
        return pdfjs;
      });
    }
    return pdfJsPromise;
  }

  function imageFromDataUrl(dataUrl) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = dataUrl;
    });
  }

  async function loadPdfFile(file, target) {
    let loadingTask = null;
    try {
      setUploadState('processing', 'Проверяем логотип… Подготавливаем первую страницу PDF.');
      const pdfjs = await getPdfJs();
      const data = new Uint8Array(await file.arrayBuffer());
      loadingTask = pdfjs.getDocument({
        data,
        enableXfa: false,
        iccUrl: PDFJS_ICC_URL,
        isEvalSupported: false,
        maxImageSize: 24_000_000,
        standardFontDataUrl: PDFJS_STANDARD_FONTS_URL,
        useSystemFonts: true,
        wasmUrl: PDFJS_WASM_URL
      });
      const pdf = await loadingTask.promise;
      const page = await pdf.getPage(1);
      const baseViewport = page.getViewport({scale: 1});
      const renderScale = Math.min(
        3,
        PDF_RENDER_MAX_SIDE / Math.max(baseViewport.width, baseViewport.height)
      );
      const viewport = page.getViewport({scale: renderScale});
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.ceil(viewport.width));
      canvas.height = Math.max(1, Math.ceil(viewport.height));
      const context = canvas.getContext('2d', {alpha: false});

      await page.render({
        canvasContext: context,
        viewport,
        background: '#ffffff'
      }).promise;

      const renderedDataUrl = canvas.toDataURL('image/png');
      const image = await imageFromDataUrl(renderedDataUrl);
      setUploadState('processing', 'Логотип прочитан. Выберите область для макета.');
      openCropModal(file, image, renderedDataUrl, target);
      page.cleanup();
    } catch {
      pdfJsPromise = null;
      setUploadState('error',
        'Не удалось прочитать PDF. Сохраните первую страницу как PNG или SVG.'
      );
    } finally {
      if (loadingTask) await loadingTask.destroy();
    }
  }

  function loadFile(file, target = 'common') {
    if (!file) return;
    const validationMessage = validateLogoFile(file);
    if (validationMessage) {
      setUploadState('error', validationMessage);
      return;
    }
    tracePolaritySession = null;
    setUploadState('processing', 'Проверяем логотип…');
    const logoTarget = normalizeLogoTarget(target);

    const ext = file.name.split('.').pop().toLowerCase();
    const reader = new FileReader();

    if (ext === 'svg') {
      reader.onload = async () => {
        const doc = new DOMParser().parseFromString(reader.result, 'image/svg+xml');
        const svg = doc.documentElement;

        if (svg.nodeName.toLowerCase() !== 'svg') {
          setUploadState('error', 'Не удалось прочитать SVG. Проверьте файл и попробуйте снова.');
          return;
        }

        svg.querySelectorAll('script,foreignObject').forEach((node) => node.remove());
        await tightenSvgArtwork(svg);

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

    if (ext === 'pdf') {
      loadPdfFile(file, logoTarget);
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
          setUploadState('error', 'Не удалось прочитать изображение. Проверьте файл и попробуйте снова.');
        };

        image.src = reader.result;
      };

      reader.readAsDataURL(file);
      return;
    }

    setUploadState('error', 'Поддерживаются только SVG, PNG, JPEG и PDF.');
  }

  function syncControls() {
    const style = getProductStyle(state.activeSettingsProduct);
    const activeStickerVariant = getStickerVariant(state.stickerVariantId);
    document.body.dataset.stickerVariantId = activeStickerVariant.id;
    document.body.dataset.stickerShape = activeStickerVariant.shape;
    document.body.dataset.stickerWidthMm = String(activeStickerVariant.widthMm);
    document.body.dataset.stickerHeightMm = String(activeStickerVariant.heightMm);
    document.body.dataset.stickerDisplaySize = activeStickerVariant.displaySize;
    $$('#widthChoice button').forEach((button) =>
      button.classList.toggle('active', +button.dataset.value === state.width)
    );

    $$('#bundleChoice button').forEach((button) =>
      button.classList.toggle('active', button.dataset.value === state.bundle)
    );

    $$('#stickerVariantChoice button').forEach((button) => {
      button.classList.toggle('active', getStickerVariant(button.dataset.variant).shape === getStickerVariant(state.stickerVariantId).shape);
      button.disabled = button.dataset.enabled !== 'true';
      button.setAttribute('aria-disabled', String(button.disabled));
    });
    const stickerIsCircle = activeStickerVariant.shape === 'circle';
    if ($('#stickerSizeLabelControl')) {
      $('#stickerSizeLabelControl').textContent = stickerIsCircle
        ? 'Размер круглого стикера'
        : 'Размер выбранного стикера';
      $('#stickerSizeLabelControl').hidden = !stickerIsCircle;
    }
    if ($('#stickerSizeChoice')) $('#stickerSizeChoice').hidden = !stickerIsCircle;
    $$('#stickerSizeChoice button').forEach((button) =>
      button.classList.toggle('active', +button.dataset.value === state.stickerSize)
    );

    if ($('#textInput')) {
      const textValue =
        activeTextTarget === 'common'
          ? state.content.text.common
          : getResolvedText(state.activeContentProduct);
      $('#textInput').value = isDemoPreviewActive()
        ? ''
        : textValue;
    }
    syncFontPicker();
    if ($('#printColorSelect')) $('#printColorSelect').value = style.print;
    if ($('#ribbonColorSelect')) $('#ribbonColorSelect').value = state.ribbon;
    if ($('#fontSize')) $('#fontSize').value = style.fontSize;
    const ribbonSettings = state.activeSettingsProduct === 'ribbon';
    if ($('#textOffsetX')) $('#textOffsetX').value = style.textOffsetX;
    if ($('#textOffsetY')) $('#textOffsetY').value = style.textOffsetY;
    if ($('#repeatMm')) {
      $('#repeatMm').value = state.repeatMm;
    }
    if ($('#meters')) $('#meters').value = state.meters;
    if ($('#stickerQty')) $('#stickerQty').value = state.stickerQty;
    if ($('#logoScale')) $('#logoScale').value = Math.round(style.logoScale * 100);
    if ($('#logoOffsetX')) $('#logoOffsetX').value = style.logoOffsetX;
    $$('[data-transform-axis="horizontal"]').forEach((control) => {
      control.hidden = ribbonSettings;
    });
    if ($('#logoOffsetY')) $('#logoOffsetY').value = style.logoOffsetY;
    $$('#layoutModeChoice button').forEach((button) => {
      button.classList.toggle('active', button.dataset.value === style.layoutMode);
    });
    $$('.transform-card').forEach((card) => {
      card.classList.toggle('is-automatic', style.layoutMode === 'auto');
      card.querySelectorAll('input').forEach((input) => {
        input.disabled = style.layoutMode === 'auto';
      });
    });
    syncPrintGuideState();
  }

  function getFontPickerSampleText() {
    return getResolvedText(state.activeSettingsProduct).trim() || 'Ваша надпись';
  }

  function syncFontPicker() {
    const style = getProductStyle(state.activeSettingsProduct);
    const sampleText = getFontPickerSampleText();
    const select = $('#fontSelect');
    const preview = $('#fontPickerPreview');

    if (select) select.value = style.font;
    if (preview) {
      preview.textContent = sampleText;
      preview.style.fontFamily = style.font;
    }

    $$('.font-picker-option').forEach((option) => {
      const selected = option.dataset.fontValue === style.font;
      const sample = option.querySelector('[data-font-sample]');
      option.setAttribute('aria-selected', String(selected));
      if (sample) {
        sample.textContent = sampleText;
        sample.style.fontFamily = option.dataset.fontValue;
      }
    });
  }

  function setFontPickerOpen(open, {focusSelected = false} = {}) {
    const trigger = $('#fontPickerTrigger');
    const list = $('#fontPickerList');
    if (!trigger || !list) return;

    trigger.setAttribute('aria-expanded', String(open));
    list.hidden = !open;
    if (open && focusSelected) {
      requestAnimationFrame(() =>
        list.querySelector('[aria-selected="true"]')?.focus({preventScroll: true}),
      );
    }
  }

  function setActiveSettingsProduct(product, {focusControls = false} = {}) {
    if (!['ribbon', 'sticker'].includes(product)) return;
    state.activeSettingsProduct = product;
    syncLegacyStyleAliases(product);
    document.body.dataset.activeSettingsProduct = product;
    $$('[data-settings-product]').forEach((section) => {
      section.hidden = section.dataset.settingsProduct !== product;
    });
    $$('[data-mobile-product-sample]').forEach((sample) => {
      const active = sample.dataset.mobileProductSample === product;
      sample.classList.toggle('is-settings-active', active);
      sample.setAttribute('aria-pressed', String(active));
    });
    if ($('#activeSettingsTitle')) {
      $('#activeSettingsTitle').textContent =
        product === 'ribbon' ? 'Лента' : 'Стикер';
    }
    const productLabel = product === 'ribbon' ? 'ленте' : 'стикере';
    if ($('#fontSelectLabel')) {
      $('#fontSelectLabel').textContent = `Шрифт надписи на ${productLabel}`;
    }
    if ($('#printColorSelectLabel')) {
      $('#printColorSelectLabel').textContent = `Цвет печати на ${productLabel}`;
    }
    if ($('#fontSizeLabel')) {
      $('#fontSizeLabel').textContent = `Размер текста на ${productLabel}`;
    }
    if ($('#layoutModeHelp')) {
      $('#layoutModeHelp').textContent =
        `Studio ${getProductStyle(product).layoutMode === 'auto' ? 'автоматически компонует' : 'сохраняет ручную композицию для'} ${product === 'ribbon' ? 'ленты' : 'стикера'}`;
    }
    setFontPickerOpen(false);
    syncControls();
    updateProductShowcase();
    updateStudioContext();
    syncContentEditor();
    if (focusControls) $('#fontPickerTrigger')?.focus({preventScroll: true});
  }

  const printGuideEditingSelector = [
    '#textInput',
    '#fontSelect',
    '#printColorSelect',
    '#ribbonColorSelect',
    '#panel-settings button',
    '#panel-settings input',
    '[data-mobile-products-safe-zone]',
    '#mobileTextEditor button',
    '#mobileTextEditor input',
    '#mobileLogoEditor button',
    '#cropModal button',
    '#cropModal input'
  ].join(',');
  const isPrintGuideEditor = (element) =>
    element instanceof Element &&
    Boolean(element.closest(printGuideEditingSelector));

  document.addEventListener('focusin', (event) => {
    if (isPrintGuideEditor(event.target)) setPrintGuidesEditing(true);
  });
  document.addEventListener('focusout', () => {
    requestAnimationFrame(() => {
      if (!isPrintGuideEditor(document.activeElement)) {
        setPrintGuidesEditing(false);
      }
    });
  });

  $('#printGuidesToggle').addEventListener('change', (event) => {
    state.showPrintGuides = event.target.checked;
    syncPrintGuideState();
    saveState();
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
    const ribbon = Boolean(event.detail?.ribbon);
    const sticker = Boolean(event.detail?.sticker);
    setProductSelection({ribbon, sticker});
    if (
      (state.activeSettingsProduct === 'ribbon' && !ribbon) ||
      (state.activeSettingsProduct === 'sticker' && !sticker)
    ) {
      setActiveSettingsProduct(ribbon ? 'ribbon' : 'sticker');
    }
  });

  document.addEventListener('studio:settings-product-change', (event) => {
    setActiveSettingsProduct(event.detail?.product);
  });

  document.addEventListener('studio:content-product-change', (event) => {
    setActiveContentProduct(event.detail?.product);
  });

  $$('#contentProductChoice [data-content-product]').forEach((button) => {
    button.addEventListener('click', () => {
      setActiveContentProduct(button.dataset.contentProduct);
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
    setPrintGuidesEditing(false);
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
    setPrintGuidesEditing(true);
    $('#editCommonText').focus();
  };

  document.addEventListener('studio:text-edit-scope-required', (event) => {
    const product = event.detail?.product;
    if (!['ribbon', 'sticker'].includes(product)) return;
    openMobileTextEditor(product);
  });

  $('#editCommonText').addEventListener('click', () => {
    closeMobileTextEditor({restoreFocus: false});
    activeTextTarget = 'common';
    showPanel('upload');
    syncControls();
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
    setPrintGuidesEditing(false);
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
    setPrintGuidesEditing(true);
    $('#editCommonLogo').focus();
  };

  document.addEventListener('studio:logo-edit-scope-required', (event) => {
    const product = event.detail?.product;
    if (!['ribbon', 'sticker'].includes(product)) return;
    openMobileLogoEditor(product);
  });

  $('#editCommonLogo').addEventListener('click', () => {
    closeMobileLogoEditor({restoreFocus: false});
    showPanel('upload');
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

  $$('#stickerVariantChoice button').forEach((button) =>
    button.addEventListener('click', () => {
      if (button.disabled) return;
      activate('#stickerVariantChoice', button);
      state.stickerVariantId = getStickerVariant(button.dataset.variant).id;
      state.stickerSize = getStickerVariant(state.stickerVariantId).diameterMm || 40;
      syncControls();
      render();
      setTimeout(() => {
        const displaySize = getStickerVariant(state.stickerVariantId).displaySize;
        document
          .querySelectorAll('[data-mobile-product-sample="sticker"] .mobile-products-sample-label')
          .forEach((label) => {
            label.textContent = `Стикер ${displaySize.replace(/^Ø/, '')}`;
          });
      }, 0);
    })
  );
  $$('#stickerSizeChoice button').forEach((button) =>
    button.addEventListener('click', () => {
      activate('#stickerSizeChoice', button);
      state.stickerSize = +button.dataset.value;
      state.stickerVariantId = getStickerVariantIdFromLegacyState(state.stickerSize);
      syncControls();
      render();
    })
  );

  document.addEventListener('studio:logo-upload-target-set', (event) => {
    setPendingLogoTarget(event.detail?.target);
  });

  $('#makeProductText').addEventListener('click', () => {
    const product = state.activeContentProduct;
    state.content.text[product] = {
      mode: 'override',
      value: getResolvedText(product),
    };
    activeTextTarget = product;
    render();
    syncControls();
    $('#textInput').focus();
  });

  $('#restoreProductText').addEventListener('click', () => {
    const product = state.activeContentProduct;
    state.content.text[product] = {mode: 'inherit'};
    activeTextTarget = 'common';
    render();
    syncControls();
    updateFirstStepAvailability();
  });

  $('#removeProductText').addEventListener('click', () => {
    const product = state.activeContentProduct;
    state.content.text[product] = {mode: 'override', value: ''};
    activeTextTarget = product;
    render();
    syncControls();
    updateFirstStepAvailability();
  });

  $('#makeProductLogo').addEventListener('click', () => {
    openLogoPicker(state.activeContentProduct);
  });

  $('#restoreProductLogo').addEventListener('click', () => {
    clearLogoOverride(state.activeContentProduct);
    updateFirstStepAvailability();
  });

  $('#removeProductLogo').addEventListener('click', () => {
    state.content.logo[state.activeContentProduct] = {
      mode: 'override',
      value: null,
    };
    render();
    updateFirstStepAvailability();
  });

  $('#editSettingsText').addEventListener('click', () => {
    setActiveContentProduct(state.activeSettingsProduct, {renderPreview: false});
    activeTextTarget =
      state.content.text[state.activeSettingsProduct].mode === 'override'
        ? state.activeSettingsProduct
        : 'common';
    showPanel('upload');
    syncControls();
    $('#textInput').focus();
  });

  $('#editSettingsLogo').addEventListener('click', () => {
    setActiveContentProduct(state.activeSettingsProduct, {renderPreview: false});
    showPanel('upload');
    $('#dropZone').focus({preventScroll: true});
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
  dropZone.addEventListener('click', (event) => {
    if (event.target === $('#logoInput')) return;
    const product = state.activeContentProduct;
    setPendingLogoTarget(
      state.content.logo[product].mode === 'override' ? product : 'common',
    );
  });
  dropZone.addEventListener('keydown', (event) => {
    if (!['Enter', ' '].includes(event.key)) return;
    event.preventDefault();
    const product = state.activeContentProduct;
    openLogoPicker(
      state.content.logo[product].mode === 'override' ? product : 'common',
    );
  });
  ['dragenter', 'dragover'].forEach((type) =>
    dropZone.addEventListener(type, (event) => {
      event.preventDefault();
      dropZone.classList.add('is-dragging');
    })
  );

  ['dragleave', 'drop'].forEach((type) =>
    dropZone.addEventListener(type, (event) => {
      event.preventDefault();
      dropZone.classList.remove('is-dragging');
    })
  );

  dropZone.addEventListener('drop', (event) => {
    const product = state.activeContentProduct;
    const target =
      state.content.logo[product].mode === 'override' ? product : 'common';
    if (target === 'common') hasUsedCommonLogoEditor = true;
    loadFile(event.dataTransfer.files[0], target);
  });

  $('#replaceCommonLogo').addEventListener('click', () => {
    const product = state.activeContentProduct;
    const target =
      state.content.logo[product].mode === 'override' ? product : 'common';
    if (target === 'common') hasUsedCommonLogoEditor = true;
    openLogoPicker(target);
  });

  $('#removeCommonLogo').addEventListener('click', () => {
    tracePolaritySession = null;
    const product = state.activeContentProduct;
    if (state.content.logo[product].mode === 'override') {
      state.content.logo[product] = {mode: 'override', value: null};
      $('#fileCard').hidden = true;
      $('#traceStatus').hidden = true;
      setFileCardActionsVisible(false);
      setUploadState('idle', '');
      updateFirstStepAvailability();
      render();
      $('#dropZone').focus({preventScroll: true});
      return;
    }

    state.content.logo.common = null;
    syncLegacyContentAliasesFromContent();
    hasCompletedCommonLogoUpload = false;
    state.commonLogoUploaded = false;
    $('#fileCard').hidden = true;
    $('#traceStatus').hidden = true;
    setFileCardActionsVisible(false);
    setUploadState('idle', '');
    updateFirstStepAvailability();
    render();
    $('#dropZone').focus({preventScroll: true});
  });

  $$('#tracePolarityControl [data-trace-polarity]').forEach((button) => {
    button.addEventListener('click', () => {
      applyTracePolarity(button.dataset.tracePolarity);
    });
  });

  $('#textInput').addEventListener('input', (event) => {
    const normalized = event.target.value
      .replace(/[\r\n\t]+/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .replace(/^\s+/, '');
    if (event.target.value !== normalized) event.target.value = normalized;
    const meaningful = normalized.trim();
    if (activeTextTarget === 'common') {
      hasUsedCommonTextEditor = true;
      state.commonTextAuthored = Boolean(meaningful);
      setCommonText(meaningful);
    } else {
      setTextOverride(state.activeContentProduct, meaningful);
    }
    updateFirstStepAvailability();
  });

  $('#textInput').addEventListener('change', (event) => {
    event.target.value = event.target.value.trim();
    if (activeTextTarget === 'common') {
      setCommonText(event.target.value);
    } else {
      setTextOverride(state.activeContentProduct, event.target.value);
    }
    returnToMobilePreview();
  });

  $('#fontSelect').addEventListener('change', (event) => {
    const font = FONT_OPTIONS.includes(event.target.value)
      ? event.target.value
      : 'Manrope';
    getProductStyle(state.activeSettingsProduct).font = font;
    syncLegacyStyleAliases();
    render();
    updateShowcaseContent();
    syncFontPicker();
  });

  $('#fontPickerTrigger').addEventListener('click', () => {
    const open = $('#fontPickerTrigger').getAttribute('aria-expanded') !== 'true';
    setFontPickerOpen(open, {focusSelected: open});
  });

  $$('.font-picker-option').forEach((option) => {
    option.addEventListener('click', () => {
      $('#fontSelect').value = option.dataset.fontValue;
      $('#fontSelect').dispatchEvent(new Event('change', {bubbles: true}));
      setFontPickerOpen(false);
      $('#fontPickerTrigger').focus({preventScroll: true});
    });
  });

  $('#fontPicker').addEventListener('keydown', (event) => {
    const options = $$('.font-picker-option');
    const currentIndex = options.indexOf(document.activeElement);

    if (event.key === 'Escape') {
      event.preventDefault();
      setFontPickerOpen(false);
      $('#fontPickerTrigger').focus({preventScroll: true});
      return;
    }

    if (
      document.activeElement === $('#fontPickerTrigger') &&
      ['ArrowDown', 'Enter', ' '].includes(event.key)
    ) {
      event.preventDefault();
      setFontPickerOpen(true, {focusSelected: true});
      return;
    }

    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const nextIndex =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
        ? options.length - 1
        : (currentIndex + (event.key === 'ArrowDown' ? 1 : -1) + options.length) %
          options.length;
    options[nextIndex]?.focus({preventScroll: true});
  });

  document.addEventListener('click', (event) => {
    if (!event.target.closest('#fontPicker')) setFontPickerOpen(false);
  });

  $('#printColorSelect').addEventListener('change', (event) => {
    getProductStyle(state.activeSettingsProduct).print = event.target.value;
    syncLegacyStyleAliases();
    refreshSvgColor();
    render();
    updateShowcaseContent();
  });

  $('#ribbonColorSelect').addEventListener('change', (event) => {
    state.ribbon = event.target.value;
    render();
  });

  const enterManualLayout = (product = state.activeSettingsProduct) => {
    const style = getProductStyle(product);
    if (style.layoutMode === 'manual') return;

    const layout = currentLayouts[product];
    if (
      product === 'sticker' &&
      layout?.logoBox &&
      layout?.textBox &&
      layout?.circle
    ) {
      const resolvedLogo = getResolvedLogo('sticker');
      const logoRatio = Number(resolvedLogo?.logo?.ratio) || 1;
      const logoSource = logoRatio >= 1
        ? {x: 0, y: 0, width: logoRatio, height: 1}
        : {x: 0, y: 0, width: 1, height: 1 / logoRatio};
      const maximumLogo = fitRectToCircle(
        logoSource,
        layout.circle,
        1,
        0,
      );
      style.logoScale = Math.min(
        1,
        Math.max(0.1, layout.logoBox.width / maximumLogo.width),
      );

      const resolvedText = getResolvedText('sticker').trim();
      const maximumText = fitTextToCircle({
        text: resolvedText,
        metrics: getTextMetrics(resolvedText, 'sticker'),
        circle: layout.circle,
        requestedScale: 1,
      });
      style.fontSize = Math.min(
        64,
        Math.max(16, Math.round((layout.fontSize / maximumText.fontSize) * 64)),
      );

      const centeredLogo = fitRectToCircle(
        logoSource,
        layout.circle,
        style.logoScale,
        0,
      );
      const centeredText = fitTextToCircle({
        text: resolvedText,
        metrics: getTextMetrics(resolvedText, 'sticker'),
        circle: layout.circle,
        requestedScale: style.fontSize / 64,
      });
      const offsetFromCenter = (current, centered, axis, size) =>
        current[axis] + current[size] / 2 -
        (centered[axis] + centered[size] / 2);
      style.logoOffsetX = offsetFromCenter(
        layout.logoBox,
        centeredLogo,
        'x',
        'width',
      );
      style.logoOffsetY = offsetFromCenter(
        layout.logoBox,
        centeredLogo,
        'y',
        'height',
      );
      style.textOffsetX = offsetFromCenter(
        layout.textBox,
        centeredText.bbox,
        'x',
        'width',
      );
      style.textOffsetY = offsetFromCenter(
        layout.textBox,
        centeredText.bbox,
        'y',
        'height',
      );
    }

    style.layoutMode = 'manual';
  };

  const setLayoutMode = (mode) => {
    const style = getProductStyle(state.activeSettingsProduct);
    if (mode === 'manual') enterManualLayout();
    else style.layoutMode = 'auto';
    if (style.layoutMode === 'auto') {
      style.textOffsetX = 0;
      style.textOffsetY = 0;
      style.logoOffsetX = 0;
      style.logoOffsetY = 0;
      if (state.activeSettingsProduct === 'ribbon') state.repeatMode = 'auto';
    }
    syncControls();
    render();
  };

  const useManualLayout = () => enterManualLayout();

  $$('#layoutModeChoice button').forEach((button) => {
    button.addEventListener('click', () => setLayoutMode(button.dataset.value));
  });

  $('#fontSize').addEventListener('input', (event) => {
    useManualLayout();
    getProductStyle(state.activeSettingsProduct).fontSize = +event.target.value;
    syncControls();
    syncLegacyStyleAliases();
    render();
  });

  $('#textOffsetX').addEventListener('input', (event) => {
    useManualLayout();
    const style = getProductStyle(state.activeSettingsProduct);
    style.textOffsetX = +event.target.value;
    render();
  });

  $('#textOffsetY').addEventListener('input', (event) => {
    useManualLayout();
    getProductStyle(state.activeSettingsProduct).textOffsetY = +event.target.value;
    render();
  });

  $('#repeatMm').addEventListener('input', (event) => {
    state.repeatMode = 'manual';
    state.repeatMm = Math.min(
      MAX_RIBBON_REPEAT_MM,
      Math.max(MIN_RIBBON_REPEAT_MM, +event.target.value || 100),
    );
    syncControls();
    render();
  });

  $$('[data-apply-ribbon-repeat]').forEach((button) => {
    button.addEventListener('click', () => {
      const repeatMm = Number(button.dataset.repeatMm);
      if (
        !Number.isFinite(repeatMm) ||
        repeatMm < MIN_RIBBON_REPEAT_MM ||
        repeatMm > MAX_RIBBON_REPEAT_MM
      ) return;
      state.repeatMode = 'manual';
      state.repeatMm = repeatMm;
      syncControls();
      render();
      requestAnimationFrame(() => {
        (state.panel === 'upload' ? $('#continueUpload') : $('#repeatMm'))
          ?.focus({preventScroll: true});
      });
    });
  });

  $('#meters').addEventListener('input', (event) => {
    const meters = +event.target.value;
    if (
      !setProductSelection({
        ribbon: meters > 0,
        sticker: state.stickerQty > 0,
      })
    ) {
      syncControls();
      $('#orderProductNotice').hidden = false;
      return;
    }
    if (meters > 0) {
      state.meters = meters;
      state.lastMeters = meters;
      render();
    }
  });

  $('#stickerQty').addEventListener('input', (event) => {
    const stickerQty = +event.target.value;
    if (
      !setProductSelection({
        ribbon: state.meters > 0,
        sticker: stickerQty > 0,
      })
    ) {
      syncControls();
      $('#orderProductNotice').hidden = false;
      return;
    }
    if (stickerQty > 0) {
      state.stickerQty = stickerQty;
      state.lastStickerQty = stickerQty;
      render();
    }
  });

  $('#logoScale').addEventListener('input', (event) => {
    useManualLayout();
    getProductStyle(state.activeSettingsProduct).logoScale =
      +event.target.value / 100;
    syncControls();
    syncLegacyStyleAliases();
    render();
  });

  $('#logoOffsetX').addEventListener('input', (event) => {
    useManualLayout();
    const style = getProductStyle(state.activeSettingsProduct);
    style.logoOffsetX = +event.target.value;
    syncLegacyStyleAliases();
    render();
  });

  $('#logoOffsetY').addEventListener('input', (event) => {
    useManualLayout();
    getProductStyle(state.activeSettingsProduct).logoOffsetY =
      +event.target.value;
    render();
  });

  $('#resetTextTransform').addEventListener('click', () => {
    const style = getProductStyle(state.activeSettingsProduct);
    style.layoutMode = 'manual';
    style.textOffsetX = 0;
    style.textOffsetY = 0;
    syncControls();
    render();
  });

  $('#resetTransform').addEventListener('click', () => {
    const style = getProductStyle(state.activeSettingsProduct);
    style.layoutMode = 'manual';
    style.logoOffsetX = 0;
    style.logoOffsetY = 0;
    syncLegacyStyleAliases();
    syncControls();
    render();
  });

  $('#resetProductLayout').addEventListener('click', () => setLayoutMode('auto'));

  document.addEventListener('studio:transform-delta', (event) => {
    const product = event.detail?.product;
    const kind = event.detail?.kind;
    if (product !== 'sticker') return;
    if (!['logo', 'text'].includes(kind)) return;
    setActiveSettingsProduct(product);
    enterManualLayout(product);
    const style = getProductStyle(product);
    const outer = currentLayouts[product]?.outer;
    if (!outer) return;
    const clampOffset = (value) => Math.min(100, Math.max(-100, value));
    style[`${kind}OffsetX`] = clampOffset(
      style[`${kind}OffsetX`] +
        Number(event.detail.dxRatio || 0) * outer.width,
    );
    style[`${kind}OffsetY`] = clampOffset(
      style[`${kind}OffsetY`] + Number(event.detail.dyRatio || 0) * outer.height,
    );
    syncControls();
    render();
  });

  $('#makeBeautiful').addEventListener('click', () => {
    const rec = getRecommendation();
    state.width = rec.width;
    state.repeatMode = 'auto';
    state.stickerSize = rec.stickerSize;
    state.stickerVariantId = getStickerVariantIdFromLegacyState(rec.stickerSize);
    state.productStyles.ribbon.fontSize = rec.width === 20 ? 34 : 28;
    state.productStyles.ribbon.logoScale = rec.logoScale;
    state.productStyles.ribbon.logoOffsetX = 0;
    state.productStyles.ribbon.logoOffsetY = 0;
    state.productStyles.ribbon.textOffsetX = 0;
    state.productStyles.ribbon.textOffsetY = 0;
    state.productStyles.ribbon.layoutMode = 'auto';
    state.productStyles.sticker.fontSize = 32;
    state.productStyles.sticker.logoScale = rec.logoScale;
    state.productStyles.sticker.logoOffsetX = 0;
    state.productStyles.sticker.logoOffsetY = 0;
    state.productStyles.sticker.textOffsetX = 0;
    state.productStyles.sticker.textOffsetY = 0;
    state.productStyles.sticker.layoutMode = 'auto';
    syncLegacyStyleAliases();
    setProductSelection({ribbon: true, sticker: true});
  });

  function closeOrderModal({restoreFocus = true} = {}) {
    if ($('#orderFormStatus').getAttribute('aria-busy') === 'true') {
      return;
    }
    $('#orderModal').classList.remove('open');
    $('#orderModal').setAttribute('aria-hidden', 'true');
    if (restoreFocus) {
      orderModalOrigin?.focus({preventScroll: true});
    }
    if (orderSubmissionSucceeded) {
      pendingOrderRequestId = null;
    }
    orderModalOrigin = null;
  }

  function buildOrderRequestText(orderId = '') {
    const price = calculatePrice();
    const ribbonText = getResolvedText('ribbon').trim() || 'без надписи';
    const stickerText = getResolvedText('sticker').trim() || 'без надписи';
    const ribbonLogo = getResolvedLogo('ribbon')?.logo ? 'да' : 'нет';
    const stickerLogo = getResolvedLogo('sticker')?.logo ? 'да' : 'нет';
    const customerName = $('#customerName').value.trim();
    const customerPhone = $('#customerPhone').value.trim();
    const customerTelegram = $('#customerTelegram').value.trim();
    const preferredContact = getPreferredContact();
    const customerComment = $('#customerComment').value.trim();

    return [
      'Заявка — Печатает Максим',
      orderId ? `Номер заявки: ${orderId}` : '',
      '',
      `Имя: ${customerName}`,
      `Телефон: ${customerPhone || 'не указан'}`,
      `Telegram: ${customerTelegram || 'не указан'}`,
      `Предпочтительный способ связи: ${preferredContactLabel(preferredContact)}`,
      `Комментарий: ${customerComment || 'не указан'}`,
      '',
      'Состав заказа:',
      `- Основное изделие: ${state.primaryProduct === 'sticker' ? 'стикер' : 'лента'}`,
      state.meters > 0
        ? `- Лента ${state.width} мм: ${state.meters} м, шаг ${state.repeatMm} мм`
        : '- Лента: не выбрана',
      state.stickerQty > 0
        ? `- ${getStickerOrderLabelPlural()}: ${state.stickerQty} шт.`
        : '- Стикеры: не выбраны',
      `- Цвет ленты: ${state.ribbon}`,
      `- Цвет печати на ленте: ${getProductStyle('ribbon').print}`,
      `- Цвет печати на стикере: ${getProductStyle('sticker').print}`,
      `- Надпись на ленте: ${ribbonText}`,
      `- Надпись на стикере: ${stickerText}`,
      `- Логотип на ленте: ${ribbonLogo}`,
      `- Логотип на стикере: ${stickerLogo}`,
      `- Предварительная стоимость: ${
        price.unavailable
          ? 'требуется индивидуальный расчёт'
          : `${price.amount.toLocaleString('ru-RU')} ₽`
      }`,
      '',
      'Копия сформирована в Studio проекта «Печатает Максим».',
    ]
      .filter((line, index, lines) => line || lines[index - 1] !== '')
      .join('\n');
  }

  function createOrderRequestId() {
    if (typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    const random = new Uint8Array(16);
    crypto.getRandomValues(random);
    return [...random]
      .map((value) => value.toString(16).padStart(2, '0'))
      .join('');
  }

  function buildOrderPayload() {
    const price = calculatePrice();
    const ribbonStyle = getProductStyle('ribbon');
    const stickerStyle = getProductStyle('sticker');
    const ribbonEnabled = state.meters > 0;
    const stickerEnabled = state.stickerQty > 0;
    const stickerVariant = getStickerVariant(state.stickerVariantId);
    const stickerProduct = {
      enabled: stickerEnabled,
      variantId: stickerVariant.id,
      shape: stickerVariant.shape,
      widthMm: stickerVariant.widthMm,
      heightMm: stickerVariant.heightMm,
      cornerRadiusMm: stickerVariant.cornerRadiusMm,
      quantity: state.stickerQty,
      backgroundColor: state.stickerBg,
      printColor: stickerStyle.print,
    };
    if (stickerVariant.shape === 'circle') {
      stickerProduct.diameterMm = stickerVariant.diameterMm;
    }
    const orderItems = [
      ribbonEnabled
        ? {
            itemId: 'ribbon-1',
            productType: 'ribbon',
            quantity: {meters: state.meters},
            configuration: {
              widthMm: state.width,
              repeatMm: state.repeatMm,
              materialColor: state.ribbon,
              printColor: ribbonStyle.print,
            },
          }
        : null,
      stickerEnabled
        ? {
            itemId: 'sticker-1',
            productType: 'sticker',
            quantity: {pieces: state.stickerQty},
            configuration: {
              variantId: stickerVariant.id,
              shape: stickerVariant.shape,
              widthMm: stickerVariant.widthMm,
              heightMm: stickerVariant.heightMm,
              cornerRadiusMm: stickerVariant.cornerRadiusMm,
              printColor: stickerStyle.print,
              backgroundColor: state.stickerBg,
            },
          }
        : null,
    ].filter(Boolean);
    return {
      schemaVersion: 1,
      orderSchemaVersion: 2,
      primaryProduct: state.primaryProduct || (ribbonEnabled ? 'ribbon' : 'sticker'),
      orderItems,
      requestId: pendingOrderRequestId,
      createdAt: new Date().toISOString(),
      source: {
        page: location.href,
        locale: navigator.language || 'ru',
      },
      customer: {
        name: $('#customerName').value.trim(),
        preferredContact: getPreferredContact(),
        phone: $('#customerPhone').value.trim(),
        telegram: $('#customerTelegram').value.trim(),
        comment: $('#customerComment').value.trim(),
      },
      products: {
        ribbon: {
          enabled: ribbonEnabled,
          widthMm: state.width,
          meters: state.meters,
          repeatMm: state.repeatMm,
          materialColor: state.ribbon,
          printColor: ribbonStyle.print,
        },
        sticker: stickerProduct,
      },
      design: {
        ribbon: {
          text: getResolvedText('ribbon').trim(),
          font: ribbonStyle.font,
          hasLogo: Boolean(getResolvedLogo('ribbon')?.logo),
        },
        sticker: {
          text: getResolvedText('sticker').trim(),
          font: stickerStyle.font,
          hasLogo: Boolean(getResolvedLogo('sticker')?.logo),
        },
      },
      pricing: {
        preliminary: true,
        currency: 'RUB',
        amount: price.unavailable ? null : price.amount,
        requiresIndividualCalculation: price.unavailable,
      },
      artifacts: {
        ribbonSvg: ribbonEnabled
          ? window.RibbonStudioProduction.serialize('ribbon')
          : '',
        stickerSvg: stickerEnabled
          ? window.RibbonStudioProduction.serialize('sticker')
          : '',
      },
    };
  }

  function downloadOrderCopy(orderId = '') {
    downloadTextFile(
      orderId
        ? `zayavka-${orderId.toLowerCase()}.txt`
        : 'zayavka-studio-pechataet-maksim.txt',
      buildOrderRequestText(orderId),
    );
  }

  $('#openOrder').addEventListener('click', () => {
    const price = calculatePrice();
    const artworkValid = document.body.dataset.artworkValid === 'true';
    $('#orderSummary').textContent = [
      state.meters > 0 ? `Лента ${state.width} мм · ${state.meters} м` : '',
      state.stickerQty > 0
        ? `${getStickerOrderLabel()}: ${state.stickerQty} шт.`
        : '',
      !artworkValid
        ? 'Макет не готов: текст не помещается в печатную область'
        : price.unavailable
        ? `Цена ${getStickerDisplayLabel()} требует индивидуального расчёта`
        : `Итого: ${price.amount.toLocaleString('ru-RU')} ₽`,
    ]
      .filter(Boolean)
      .join(' · ');
    orderModalOrigin = document.activeElement;
    orderSubmissionSucceeded = false;
    acceptedOrderId = '';
    pendingOrderRequestId = null;
    $('#orderFormStatus').textContent = '';
    $('#orderFormStatus').classList.remove('is-error', 'is-success');
    $('#orderFormStatus').removeAttribute('aria-busy');
    $('#submitOrder').textContent = 'Отправить заявку';
    $('#submitOrder').disabled = !artworkValid;
    $('#orderModal').classList.add('open');
    $('#orderModal').setAttribute('aria-hidden', 'false');
    requestAnimationFrame(() =>
      $('#customerName').focus({preventScroll: true}),
    );
  });

  $('#closeOrder').addEventListener('click', closeOrderModal);

  $('#orderModal').addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeOrderModal();
      return;
    }
    trapDialogFocus(event, $('#orderModal'));
  });

  $('#downloadOrderCopy').addEventListener('click', () => {
    downloadOrderCopy(acceptedOrderId);
  });

  function getPreferredContact() {
    return $('input[name="preferredContact"]:checked')?.value || '';
  }

  function preferredContactLabel(value) {
    return value === 'phone'
      ? 'телефон'
      : value === 'telegram'
      ? 'Telegram'
      : 'не выбран';
  }

  function trackContactEvent(event, channel) {
    const detail = {
      event,
      channel,
      location: 'studio-order',
      page: location.pathname,
    };
    window.dispatchEvent(new CustomEvent('pm:contact', {detail}));
    if (Array.isArray(window.dataLayer)) {
      window.dataLayer.push(detail);
    }
  }

  function syncPreferredContactFields() {
    const preferredContact = getPreferredContact();
    const phoneSelected = preferredContact === 'phone';
    const telegramSelected = preferredContact === 'telegram';
    $('#customerPhoneField').hidden = !phoneSelected;
    $('#customerTelegramField').hidden = !telegramSelected;
    $('#customerPhone').required = phoneSelected;
    $('#customerTelegram').required = telegramSelected;
  }

  document.querySelectorAll('input[name="preferredContact"]').forEach((input) => {
    input.addEventListener('change', () => {
      syncPreferredContactFields();
      trackContactEvent('contact_method_selected', input.value);
    });
  });

  $('#orderForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const status = $('#orderFormStatus');
    const submitButton = $('#submitOrder');
    const customerName = $('#customerName').value.trim();
    const preferredContact = getPreferredContact();
    const preferredContactValue =
      preferredContact === 'phone'
        ? $('#customerPhone').value.trim()
        : preferredContact === 'telegram'
        ? $('#customerTelegram').value.trim()
        : '';

    if (!customerName) {
      status.textContent = 'Укажите имя.';
      status.classList.add('is-error');
      $('#customerName').focus();
      return;
    }
    if (!preferredContact) {
      status.textContent = 'Выберите удобный способ связи.';
      status.classList.add('is-error');
      $('input[name="preferredContact"]').focus();
      return;
    }
    if (!preferredContactValue) {
      status.textContent =
        preferredContact === 'phone'
          ? 'Укажите номер телефона.'
          : 'Укажите Telegram.';
      status.classList.add('is-error');
      $(preferredContact === 'phone' ? '#customerPhone' : '#customerTelegram').focus();
      return;
    }

    pendingOrderRequestId ||= createOrderRequestId();
    status.textContent = 'Сохраняем заявку и макеты…';
    status.classList.remove('is-error', 'is-success');
    status.setAttribute('aria-busy', 'true');
    submitButton.disabled = true;
    submitButton.textContent = 'Отправляем…';
    $('#closeOrder').disabled = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);

    try {
      const response = await fetch('/api/orders/', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(buildOrderPayload()),
        signal: controller.signal,
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok || result.status !== 'accepted' || !result.orderId) {
        throw new Error(result.message || 'receiver_unavailable');
      }

      orderSubmissionSucceeded = true;
      acceptedOrderId = result.orderId;
      trackContactEvent('order_submit', preferredContact);
      status.textContent = `Заявка ${result.orderId} принята. Максим свяжется с вами: ${preferredContactLabel(preferredContact)}.`;
      status.classList.add('is-success');
      submitButton.textContent = 'Заявка отправлена';
    } catch (error) {
      console.warn('Order submission failed:', error);
      status.textContent =
        'Не удалось отправить заявку. Она не потеряна: повторите попытку или скачайте копию.';
      status.classList.add('is-error');
      submitButton.disabled = false;
      submitButton.textContent = 'Повторить отправку';
    } finally {
      clearTimeout(timeout);
      status.removeAttribute('aria-busy');
      $('#closeOrder').disabled = false;
    }
  });

  $$('[data-start-product]').forEach((button) => {
    button.addEventListener('click', () => {
      const product = button.dataset.startProduct === 'sticker' ? 'sticker' : 'ribbon';
      state.primaryProduct = product;
      state.productFirstMode = true;
      state.bundle = product;
      state.meters = product === 'ribbon' ? (state.meters || state.lastMeters) : 0;
      state.stickerQty = product === 'sticker' ? (state.stickerQty || state.lastStickerQty) : 0;
      setActiveContentProduct(product, {renderPreview: false});
      setActiveSettingsProduct(product);
      syncControls();
      syncProductFirstShell();
      render();
      document.querySelector('[data-panel="upload"]')?.focus({preventScroll: true});
    });
  });

  $('#addSecondaryProduct')?.addEventListener('click', () => {
    if (!state.primaryProduct) return;
    const addSticker = state.primaryProduct === 'ribbon';
    const sourceProduct = state.primaryProduct;
    setProductSelection({ribbon: true, sticker: true});
    state.lastMeters = state.meters || 100;
    state.lastStickerQty = state.stickerQty || 100;
    if (addSticker) {
      state.stickerQty = state.lastStickerQty;
      copyProductContentOnce(sourceProduct, 'sticker');
      copyProductStyleOnce(sourceProduct, 'sticker');
    } else {
      state.meters = state.lastMeters;
      copyProductContentOnce(sourceProduct, 'ribbon');
      copyProductStyleOnce(sourceProduct, 'ribbon');
    }
    state.bundle = 'bundle';
    render();
  });

  $('#orderItemsSummaryList')?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-configure-product]');
    if (!button) return;
    const product = button.dataset.configureProduct;
    if (!['ribbon', 'sticker'].includes(product)) return;
    setActiveContentProduct(product, {renderPreview: false});
    setActiveSettingsProduct(product);
    showPanel('settings');
    render();
  });

  $('#resetProject').addEventListener('click', () => {
    if (
      hasUserContent() &&
      !window.confirm('Начать новый проект? Текущий макет будет удалён.')
    ) {
      return;
    }
    localStorage.removeItem('ribbon-studio-v042');
    location.reload();
  });

  initCropInteractions();
  restoreState();
  const requestedProduct = new URLSearchParams(location.search).get('product');
  if (['ribbon', 'sticker'].includes(requestedProduct)) {
    state.productFirstMode = true;
    state.primaryProduct = requestedProduct;
    state.bundle = requestedProduct;
    state.meters = requestedProduct === 'ribbon' ? (state.meters || state.lastMeters) : 0;
    state.stickerQty = requestedProduct === 'sticker' ? (state.stickerQty || state.lastStickerQty) : 0;
  } else if (requestedProduct === 'choose') {
    state.productFirstMode = true;
    state.primaryProduct = null;
    state.meters = 0;
    state.stickerQty = 0;
    state.bundle = 'ribbon';
  } else if (state.productFirstMode) {
    // A plain legacy route must not inherit a product-first draft. Preserve
    // genuine legacy ribbon-only/sticker-only LocalStorage projects.
    state.productFirstMode = false;
    state.primaryProduct = null;
    state.meters = state.lastMeters || 100;
    state.stickerQty = state.lastStickerQty || 100;
    state.bundle = 'bundle';
    state.activeContentProduct = 'ribbon';
    state.activeSettingsProduct = 'ribbon';
  }
  hasUsedCommonTextEditor =
    state.commonTextAuthored ||
    (Boolean(state.content.text.common.trim()) &&
      state.content.text.common.trim().toLowerCase() !== DEMO_TEXT);
  state.commonTextAuthored = hasUsedCommonTextEditor;
  const restoredCommonLogo = state.content.logo.common;
  const restoredCommonLogoIsDefault =
    restoredCommonLogo?.logoType === 'svg' &&
    restoredCommonLogo.logoSvgSource === DEFAULT_LOGO_SVG;
  hasCompletedCommonLogoUpload =
    state.commonLogoUploaded ||
    Boolean(restoredCommonLogo && !restoredCommonLogoIsDefault);
  state.commonLogoUploaded = hasCompletedCommonLogoUpload;
  if (hasCompletedCommonLogoUpload) {
    const format = (restoredCommonLogo?.logoType || 'logo')
      .replace('svg-auto', 'SVG')
      .toUpperCase();
    showFileCard(
      {name: 'Логотип проекта'},
      `${format} · восстановлен`,
      'Файл сохранён в этом браузере'
    );
    setFileCardActionsVisible(true);
  }
  if (restoredCommonLogoIsDefault) {
    state.content.logo.common = null;
    syncLegacyContentAliasesFromContent();
  }
  loadDefaultLogo();
  applyStudioEntryContext();
  if (state.primaryProduct) {
    setActiveContentProduct(state.primaryProduct, {renderPreview: false});
    setActiveSettingsProduct(state.primaryProduct);
  }
  syncProductFirstShell();
  setActiveContentProduct(
    state.productFirstMode && state.primaryProduct
      ? state.primaryProduct
      : state.activeContentProduct,
    {renderPreview: false},
  );
  setActiveSettingsProduct(
    state.productFirstMode && state.primaryProduct
      ? state.primaryProduct
      : state.activeSettingsProduct,
  );
  updateFirstStepAvailability();
  render();
  updateShowcaseContent();
  updateProductShowcase();
  document.fonts?.ready.then(() => render());
});
