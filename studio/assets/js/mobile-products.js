(() => {
  const setup = () => {
    const panel = document.querySelector('.mobile-products-panel');
    const panelSlot = document.querySelector('#mobileProductsSlot');
    const dockToggle = document.querySelector('#mobileProductsDockToggle');
    const topbar = document.querySelector('.topbar');
    const zoomStage = panel.querySelector('[data-preview-zoom-stage]');
    const zoomButtons = [...panel.querySelectorAll('[data-preview-zoom]')];
    const panelHosts = [...document.querySelectorAll('[data-products-host]')];
    const logoInput = document.querySelector('#logoInput');
    const textInput = document.querySelector('#textInput');

    if (
      !panel ||
      !panelSlot ||
      !dockToggle ||
      !logoInput ||
      !textInput
    )
      return;

    const switches = [...panel.querySelectorAll('[data-mobile-product]')];
    const samples = [...panel.querySelectorAll('[data-mobile-product-sample]')];
    const ribbonSurface = panel.querySelector('.mobile-products-ribbon-sample');
    const stickerSurface = panel.querySelector('.mobile-products-sticker-sample');
    let contentTextState = null;
    let contentLogoState = null;
    let effectiveLayouts = null;
    const logoInkCache = new Map();
    let dockFrame = null;
    let dockExpanded = false;
    let dockFloating = false;
    let keyboardCompact = false;
    let panelMode = document.body.dataset.activePanel || 'upload';
    let manualRibbonGapDeltaPx = 0;
    let hasManualRibbonGapDelta = false;
    let manualRibbonGapContentKey = null;
    const PREVIEW_ZOOM_MIN = 0.5;
    const PREVIEW_ZOOM_MAX_RIBBON = 1.25;
    let previewZoom = 1;

    const requestLogoInkBounds = (src) => {
      if (!src || logoInkCache.has(src)) return;
      logoInkCache.set(src, null);
      const image = new Image();
      image.onload = () => {
        try {
          const size = 256;
          const canvas = document.createElement('canvas');
          canvas.width = size;
          canvas.height = size;
          const context = canvas.getContext('2d', {willReadFrequently: true});
          context.clearRect(0, 0, size, size);
          context.drawImage(image, 0, 0, size, size);
          const pixels = context.getImageData(0, 0, size, size).data;
          let left = size;
          let right = -1;
          let top = size;
          let bottom = -1;
          for (let y = 0; y < size; y += 1) {
            for (let x = 0; x < size; x += 1) {
              if (pixels[(y * size + x) * 4 + 3] < 8) continue;
              left = Math.min(left, x);
              right = Math.max(right, x);
              top = Math.min(top, y);
              bottom = Math.max(bottom, y);
            }
          }
          logoInkCache.set(src, right < left
            ? {left: 0, right: 1, width: 1}
            : {
                left: left / size,
                right: (right + 1) / size,
                width: (right + 1 - left) / size,
              });
          requestAnimationFrame(() => syncStudioState());
        } catch {
          logoInkCache.set(src, {left: 0, right: 1, width: 1});
        }
      };
      image.onerror = () => logoInkCache.set(src, {left: 0, right: 1, width: 1});
      image.src = src;
    };

    const getPreviewZoomMax = () => {
      const product = document.body.dataset.activeContentProduct || 'ribbon';
      if (product !== 'sticker' || !stickerSurface) {
        return PREVIEW_ZOOM_MAX_RIBBON;
      }
      const stickerWidth = stickerSurface.offsetWidth || 1;
      const availableWidth = Math.max(1, window.innerWidth - 32);
      return Math.max(PREVIEW_ZOOM_MAX_RIBBON, availableWidth / stickerWidth);
    };

    const getRibbonPreviewCycleCount = () => {
      if (previewZoom <= 0.71) return 3;
      if (previewZoom <= 0.91) return 2;
      return 1;
    };

    const syncPreviewZoom = () => {
      if (!zoomStage) return;
      const previewZoomMax = getPreviewZoomMax();
      previewZoom = Math.min(previewZoomMax, Math.max(PREVIEW_ZOOM_MIN, previewZoom));
      zoomStage.style.setProperty('--preview-zoom', String(previewZoom));
      zoomStage.dataset.previewZoom = String(Math.round(previewZoom * 100));
      zoomStage.dataset.previewZoomMax = String(Math.round(previewZoomMax * 100));
      zoomStage.dataset.previewProduct =
        document.body.dataset.activeContentProduct || 'ribbon';
      zoomButtons.forEach((button) => {
        button.disabled =
          (button.dataset.previewZoom === 'out' && previewZoom <= PREVIEW_ZOOM_MIN) ||
          (button.dataset.previewZoom === 'in' && previewZoom >= previewZoomMax);
        button.title = `Масштаб предпросмотра: ${Math.round(previewZoom * 100)}%`;
      });
    };

    zoomButtons.forEach((button) => {
      button.addEventListener('click', () => {
        const previewZoomMax = getPreviewZoomMax();
        previewZoom = Math.min(
          previewZoomMax,
          Math.max(
            PREVIEW_ZOOM_MIN,
            previewZoom + (button.dataset.previewZoom === 'in' ? 0.1 : -0.1),
          ),
        );
        syncPreviewZoom();
        syncStudioState();
      });
    });
    window.addEventListener('resize', syncPreviewZoom, {passive: true});
    syncPreviewZoom();

    panel.dataset.presentation = 'flow';

    ribbonSurface.removeAttribute('aria-hidden');
    stickerSurface.removeAttribute('aria-hidden');
    ribbonSurface.replaceChildren();
    stickerSurface.replaceChildren();
    const ribbonGuide = document.createElement('span');
    const stickerGuide = document.createElement('span');
    ribbonGuide.className = 'mobile-products-printable-guide ribbon-guide';
    stickerGuide.className = 'mobile-products-printable-guide sticker-guide';
    ribbonGuide.dataset.previewOverlay = '';
    stickerGuide.dataset.previewOverlay = '';
    ribbonGuide.setAttribute('aria-hidden', 'true');
    stickerGuide.setAttribute('aria-hidden', 'true');

    const requestProductSettings = (product) => {
      if (panelMode !== 'settings' || !['ribbon', 'sticker'].includes(product))
        return;
      document.dispatchEvent(
        new CustomEvent('studio:settings-product-change', {
          detail: {product},
        }),
      );
    };

    const requestContentProduct = (product) => {
      if (panelMode !== 'upload' || !['ribbon', 'sticker'].includes(product))
        return;
      document.dispatchEvent(
        new CustomEvent('studio:content-product-change', {
          detail: {product},
        }),
      );
    };

    const createLogoZone = (product) => {
      const zone = document.createElement('button');
      const image = document.createElement('img');
      const action = document.createElement('span');
      const frame = document.createElement('span');
      zone.type = 'button';
      zone.className = `mobile-products-${product}-logo-zone`;
      zone.dataset.mobileProductsSafeZone = `${product}-logo`;
      image.className = `mobile-products-${product}-logo`;
      image.alt = '';
      action.className = 'mobile-products-zone-action';
      action.dataset.placeholderKind = 'logo';
      frame.className = 'mobile-products-object-frame';
      frame.setAttribute('aria-hidden', 'true');
      zone.append(image, action, frame);
      return { zone, image, action, frame };
    };

    const createTextZone = (product) => {
      const zone = document.createElement('button');
      const text = document.createElement('span');
      const action = document.createElement('span');
      const frame = document.createElement('span');
      zone.type = 'button';
      zone.className = `mobile-products-${product}-text-zone`;
      zone.dataset.mobileProductsSafeZone = `${product}-text`;
      text.className = `mobile-products-${product}-text`;
      action.className = 'mobile-products-zone-action';
      action.dataset.placeholderKind = 'text';
      frame.className = 'mobile-products-object-frame';
      frame.setAttribute('aria-hidden', 'true');
      zone.append(text, action, frame);
      return { zone, text, action, frame };
    };

    const ribbonLogo = createLogoZone('ribbon');
    const ribbonText = createTextZone('ribbon');
    const ribbonTrack = document.createElement('div');
    const ribbonInteractionCell = document.createElement('div');
    const stickerContent = document.createElement('div');
    const stickerLogo = createLogoZone('sticker');
    const stickerText = createTextZone('sticker');

    stickerContent.className = 'mobile-products-sticker-content';
    stickerContent.dataset.mobileProductsSafeZone = 'sticker-content';
    ribbonTrack.className = 'mobile-products-ribbon-repeat-track';
    ribbonTrack.setAttribute('aria-hidden', 'true');
    ribbonInteractionCell.className =
      'mobile-products-ribbon-interaction-cell';
    ribbonInteractionCell.append(ribbonLogo.zone, ribbonText.zone, ribbonGuide);
    ribbonSurface.append(ribbonTrack, ribbonInteractionCell);
    stickerContent.append(stickerLogo.zone, stickerText.zone);
    stickerSurface.append(stickerContent, stickerGuide);

    const attachTransformDrag = (zone, product, kind, surface) => {
      let pointerId = null;
      let lastX = 0;
      let lastY = 0;
      let distance = 0;

      zone.addEventListener('pointerdown', (event) => {
        const editableDock =
          !panel.classList.contains('is-floating') ||
          panel.classList.contains('is-expanded');
        const canDrag =
          (panelMode === 'settings' || panelMode === 'upload') &&
          editableDock &&
          event.button === 0;
        if (!canDrag) return;
        if (panelMode === 'settings') requestProductSettings(product);
        pointerId = event.pointerId;
        lastX = event.clientX;
        lastY = event.clientY;
        distance = 0;
        zone.setPointerCapture(pointerId);
      });

      zone.addEventListener('pointermove', (event) => {
        if (event.pointerId !== pointerId) return;
        const dx = event.clientX - lastX;
        const dy = event.clientY - lastY;
        distance += Math.hypot(dx, dy);
        lastX = event.clientX;
        lastY = event.clientY;
        if (distance < 4) return;
        event.preventDefault();
        zone.dataset.dragging = 'true';
        const bounds = surface.getBoundingClientRect();
        if (product === 'ribbon' && dx) {
          manualRibbonGapDeltaPx += kind === 'text' ? dx : -dx;
          hasManualRibbonGapDelta = true;
        }
        document.dispatchEvent(
          new CustomEvent('studio:transform-delta', {
            detail: {
              product,
              kind,
              dxRatio: dx / Math.max(bounds.width, 1),
              dyRatio: dy / Math.max(bounds.height, 1),
              gapDeltaPx:
                product === 'ribbon'
                  ? kind === 'text'
                    ? dx
                    : -dx
                  : 0,
            },
          }),
        );
      });

      const finishDrag = (event) => {
        if (event.pointerId !== pointerId) return;
        zone.dataset.dragging = 'false';
        try {
          zone.releasePointerCapture(pointerId);
        } catch {}
        pointerId = null;
      };
      zone.addEventListener('pointerup', finishDrag);
      zone.addEventListener('pointercancel', finishDrag);
    };

    attachTransformDrag(stickerLogo.zone, 'sticker', 'logo', stickerSurface);
    attachTransformDrag(stickerText.zone, 'sticker', 'text', stickerSurface);
    attachTransformDrag(ribbonLogo.zone, 'ribbon', 'logo', ribbonSurface);
    attachTransformDrag(ribbonText.zone, 'ribbon', 'text', ribbonSurface);

    const syncVisibility = () => {
      switches.forEach((productSwitch) => {
        const sample = samples.find(
          (item) =>
            item.dataset.mobileProductSample === productSwitch.dataset.mobileProduct,
        );

        if (sample) {
          const productFirstMode = document.body.classList.contains('product-first-mode');
          const bothProductsEnabled =
            document.body.dataset.hasRibbon === 'true' &&
            document.body.dataset.hasSticker === 'true';
          const activeWorkspace = document.body.dataset.activeWorkspace;
          const hideOutsideWorkspace =
            panelMode === 'upload' &&
            productFirstMode &&
            !bothProductsEnabled &&
            activeWorkspace &&
            activeWorkspace !== productSwitch.dataset.mobileProduct;
          sample.hidden = Boolean(hideOutsideWorkspace);
          sample.classList.toggle(
            'is-product-disabled',
            !productSwitch.checked || hideOutsideWorkspace,
          );
          sample.setAttribute(
            'aria-disabled',
            String(!productSwitch.checked || hideOutsideWorkspace),
          );
        }
      });
    };

    const applyProductSelection = ({ribbon, sticker}) => {
      const selection = {ribbon: Boolean(ribbon), sticker: Boolean(sticker)};
      switches.forEach((productSwitch) => {
        productSwitch.checked = selection[productSwitch.dataset.mobileProduct];
      });
      syncVisibility();
    };

    const readContentFallback = () => {
      try {
        const snapshot = JSON.parse(document.body.dataset.studioContent || '{}');
        return {
          text: snapshot.text
            ? {
                common: snapshot.text.common || '',
                ribbon: {
                  mode: snapshot.text.ribbon?.mode || 'inherit',
                  resolved: snapshot.text.resolvedRibbon || '',
                },
                sticker: {
                  mode: snapshot.text.sticker?.mode || 'inherit',
                  resolved: snapshot.text.resolvedSticker || '',
                },
              }
            : null,
          logo: snapshot.logo
            ? {
                ribbon: {
                  mode: snapshot.logo.ribbon?.mode || 'inherit',
                  hasLogo: Boolean(snapshot.logo.resolvedRibbon?.hasLogo),
                  ratio: snapshot.logo.resolvedRibbon?.ratio ?? null,
                },
                sticker: {
                  mode: snapshot.logo.sticker?.mode || 'inherit',
                  hasLogo: Boolean(snapshot.logo.resolvedSticker?.hasLogo),
                  ratio: snapshot.logo.resolvedSticker?.ratio ?? null,
                },
              }
            : null,
        };
      } catch {
        return null;
      }
    };

    const getPaintedRect = (
      layout,
      box,
      rootWidth,
      rootHeight,
      width,
      height,
    ) => {
      if (!layout || !box || rootWidth <= 0 || rootHeight <= 0) return null;
      const printable = layout.printable || {
        x: 0,
        y: 0,
        width: 1,
        height: 1,
      };
      const printableLeft = printable.x * rootWidth;
      const printableTop = printable.y * rootHeight;
      const printableWidth = printable.width * rootWidth;
      const printableHeight = printable.height * rootHeight;
      const scale = Math.min(
        1,
        printableWidth / Math.max(width, 1),
        printableHeight / Math.max(height, 1),
      );
      const paintedWidth = width * scale;
      const paintedHeight = height * scale;
      const centerX = (box.x + box.width / 2) * rootWidth;
      const centerY = (box.y + box.height / 2) * rootHeight;
      const left = Math.min(
        printableLeft + printableWidth - paintedWidth,
        Math.max(printableLeft, centerX - paintedWidth / 2),
      );
      const top = Math.min(
        printableTop + printableHeight - paintedHeight,
        Math.max(printableTop, centerY - paintedHeight / 2),
      );
      return {
        left,
        top,
        width: paintedWidth,
        height: paintedHeight,
      };
    };

    const renderRibbonRepeats = ({
      layout,
      repeatMm,
      ribbonWidth,
      logoSrc,
      logoRatio,
      textValue,
      hasLogo,
      hasText,
      font,
      print,
    }) => {
      if (!layout) return;
      const surfaceBounds = ribbonSurface.getBoundingClientRect();
      if (surfaceBounds.width <= 0 || surfaceBounds.height <= 0) return;

      const repeatWidth = surfaceBounds.width;
      const repeatHeight = surfaceBounds.height;
      const contentKey = `${logoSrc || ''}|${textValue || ''}|${logoRatio || ''}`;
      if (manualRibbonGapContentKey !== contentKey) {
        manualRibbonGapContentKey = contentKey;
        manualRibbonGapDeltaPx = 0;
        hasManualRibbonGapDelta = false;
      }
      const goldenGapRatio = 1 / 1.618;
      const ink = logoSrc && logoInkCache.get(logoSrc);
      requestLogoInkBounds(logoSrc);
      ribbonInteractionCell.style.visibility = 'visible';
      ribbonInteractionCell.style.opacity = '0';
      ribbonInteractionCell.style.pointerEvents = 'auto';
      ribbonInteractionCell.style.left = '0px';
      ribbonInteractionCell.style.top = '0px';
      ribbonInteractionCell.style.width = `${repeatWidth}px`;
      ribbonInteractionCell.style.height = `${repeatHeight}px`;
      ribbonTrack.replaceChildren();

      const textBox = layout.valid ? layout.textBox : layout.previewTextBox;
      const visibleText = layout.valid ? textValue : layout.previewText || '';
      const fontSizeRatio = layout.valid
        ? layout.fontSizeRatio
        : layout.previewFontSizeRatio;
      const logoWidth = layout.logoBox
        ? Math.max(1, layout.logoBox.width * repeatWidth)
        : 0;
      const logoHeight = layout.logoBox?.height * repeatHeight;
      const paintedLogoRect =
        Number(logoRatio) > 0 && logoHeight > 0
          ? getPaintedRect(
              layout,
              layout.logoBox,
              repeatWidth,
              repeatHeight,
              logoHeight * Number(logoRatio),
              logoHeight,
            )
          : null;
      const paintedLogoWidth = paintedLogoRect?.width || logoWidth;
      const inkLogoWidth = paintedLogoWidth * (ink?.width || 1);
      const textWidth = textBox ? Math.max(1, textBox.width * repeatWidth) : 0;
      const gap = inkLogoWidth * goldenGapRatio;
      const contentWidth =
        hasLogo && hasText
          ? inkLogoWidth + gap + textWidth
          : Math.max(logoWidth, textWidth);
      const repeatPitch =
        hasLogo && hasText ? contentWidth + gap : contentWidth;
      const contentScale = Math.min(1, (repeatWidth * 0.92) / repeatPitch);
      const placedLogoWidth = paintedLogoWidth * contentScale;
      const placedInkLogoWidth = inkLogoWidth * contentScale;
      const placedTextWidth = textWidth * contentScale;
      const layoutGap = layout.manualLayout && hasLogo && hasText
        ? Math.max(
            0,
            textBox.x * repeatWidth -
              (layout.logoBox.x * repeatWidth + placedLogoWidth * (ink?.right || 1)),
          )
        : null;
      const manualGap = hasManualRibbonGapDelta && hasLogo && hasText
        ? Math.max(0, placedInkLogoWidth / 1.618 + manualRibbonGapDeltaPx)
        : layoutGap;
      const placedGap = hasLogo && hasText
        ? manualGap ?? placedInkLogoWidth / 1.618
        : 0;
      const placedPitch = hasLogo && hasText
        ? placedInkLogoWidth + placedGap + placedTextWidth + placedGap
        : Math.max(placedLogoWidth, placedTextWidth);
      const contentStart = layout.manualLayout && hasLogo
        ? layout.logoBox.x * repeatWidth
        : Math.max(0, (repeatWidth - placedPitch) / 2);
      ribbonSurface.dataset.ribbonLogoTextGapPx = placedGap.toFixed(2);
      ribbonSurface.dataset.ribbonRepeatGapPx = placedGap.toFixed(2);
      for (const offset of [-1, 0, 1]) {
        const left = offset * placedPitch;
        const cell = document.createElement('span');
        cell.className = 'mobile-products-ribbon-repeat-cell';
        cell.style.left = `${left}px`;
        cell.style.top = '0px';
        cell.style.width = `${repeatWidth}px`;
        cell.style.height = `${repeatHeight}px`;

        if (hasLogo && logoSrc && layout.logoBox) {
          const image = document.createElement('img');
          image.className = 'mobile-products-ribbon-repeat-logo';
          image.alt = '';
          image.src = logoSrc;
          image.style.left = `${contentStart + placedLogoWidth / 2}px`;
          image.style.top = `${repeatHeight / 2}px`;
          image.style.width = `${placedLogoWidth}px`;
          image.style.height = `${(paintedLogoRect?.height || logoHeight) * contentScale}px`;
          image.style.objectFit = 'contain';
          cell.appendChild(image);
        }

        if (hasText && visibleText && textBox) {
          const text = document.createElement('span');
          text.className = 'mobile-products-ribbon-repeat-text';
          text.textContent = visibleText;
          const textLeft = hasLogo
            ? contentStart + placedLogoWidth * (ink?.right || 1) + placedGap
            : contentStart;
          text.style.left = `${textLeft + placedTextWidth / 2}px`;
          text.style.top = `${repeatHeight / 2}px`;
          text.style.width = `${placedTextWidth}px`;
          text.style.height = `${textBox.height * repeatHeight * contentScale}px`;
          text.style.color = print;
          text.style.fontFamily = font;
          text.style.fontSize = `${fontSizeRatio * repeatHeight * contentScale}px`;
          cell.appendChild(text);
        }
        ribbonTrack.appendChild(cell);
      }

      ribbonSurface.dataset.ribbonRepeatCount = '3';
      ribbonSurface.dataset.ribbonRepeatMm = String(repeatMm);
      ribbonSurface.dataset.ribbonPreviewCycleCount = '3';
      ribbonSurface.dataset.ribbonRepeatWidthPx = repeatWidth.toFixed(2);
      ribbonSurface.dataset.ribbonRepeatScale = '1';
      ribbonSurface.dataset.ribbonSingleRepeat = 'false';
      ribbonSurface.dataset.ribbonRepeatScaled = 'false';
    };

    const syncStudioState = () => {
      // All layout measurements below must use the unscaled scene. Measuring
      // a transformed stage feeds scaled dimensions back into logo/text
      // placement and causes the scene to collapse after every zoom click.
      const previousStageTransition = zoomStage?.style.transition || '';
      if (zoomStage) {
        zoomStage.style.transition = 'none';
        zoomStage.style.setProperty('--preview-zoom', '1');
        // Force the browser to commit scale 1 before any getBoundingClientRect
        // call below; otherwise the old CSS transition is still measurable.
        void zoomStage.offsetWidth;
      }
      let productStyles = {};
      try {
        productStyles = JSON.parse(
          document.body.dataset.studioProductStyles || '{}',
        );
      } catch {
        productStyles = {};
      }
      const commonText = document.querySelector('#textInput')?.value || '';
      const demoArtwork =
        panelMode === 'upload' &&
        document.body.dataset.previewDemo === 'true';
      const demoText = document.body.dataset.previewDemoText || 'ленты по любви';
      const demoStickerText =
        document.body.dataset.previewStickerText || 'Печатает Максим';
      const ribbonTextValue = demoArtwork
        ? demoText
        : contentTextState?.ribbon?.resolved ?? commonText;
      const stickerTextValue = demoArtwork
        ? demoStickerText
        : contentTextState?.sticker?.resolved ?? commonText;
      const ribbonTextValueTrimmed = ribbonTextValue.trim();
      const stickerTextValueTrimmed = stickerTextValue.trim();
      const fallbackFont = document.querySelector('#fontSelect')?.value || 'Manrope';
      const fallbackPrint =
        document.querySelector('#printColorSelect')?.value || '#171717';
      const ribbonStyle = {
        font: demoArtwork
          ? 'Comfortaa'
          : productStyles.ribbon?.font || fallbackFont,
        print: productStyles.ribbon?.print || fallbackPrint,
      };
      const stickerStyle = {
        font: demoArtwork
          ? 'Comfortaa'
          : productStyles.sticker?.font || fallbackFont,
        print: productStyles.sticker?.print || fallbackPrint,
      };
      const ribbonWidth =
        Number(document.querySelector('#widthChoice button.active')?.dataset.value) ||
        15;
      const stickerShape = document.body.dataset.stickerShape || 'circle';
      const stickerWidthMm = Number(document.body.dataset.stickerWidthMm) || 40;
      const stickerHeightMm = Number(document.body.dataset.stickerHeightMm) || stickerWidthMm;
      const stickerDisplaySize = document.body.dataset.stickerDisplaySize || `Ø${stickerWidthMm} мм`;
      const stickerSize = stickerWidthMm;
      const repeatMm = Number(document.querySelector('#repeatMm')?.value) || 100;
      const ribbon =
        document.body.style.getPropertyValue('--ribbon-live-color').trim() || '#f3eadc';
      const getProductionLogoSource = (selector) => {
        const image = document.querySelector(selector);
        return image?.getAttribute('href') || image?.getAttribute('xlink:href') || '';
      };
      const ribbonLogoSrc = getProductionLogoSource('#ribbonContent image');
      const stickerLogoSrc = getProductionLogoSource('#stickerContent image');
      const hasRibbonLogo = Boolean(ribbonLogoSrc);
      const hasStickerLogo = Boolean(stickerLogoSrc);
      const hasRibbonText = Boolean(
        ribbonTextValueTrimmed,
      );
      const hasStickerText = Boolean(
        stickerTextValueTrimmed,
      );
      if (!effectiveLayouts) {
        try {
          effectiveLayouts = JSON.parse(document.body.dataset.studioLayout || '{}');
        } catch {
          effectiveLayouts = {};
        }
      }

      const updateLogo = ({zone, image, action}, src, hasLogo, mode, product) => {
        if (hasLogo && src) {
          if (image.getAttribute('src') !== src) image.src = src;
        } else {
          image.removeAttribute('src');
        }
        image.hidden = !hasLogo;
        const label =
          panelMode === 'settings'
            ? `Настроить ${product === 'ribbon' ? 'ленту' : 'стикер'}`
            : demoArtwork
              ? 'Добавить логотип'
            : hasLogo
              ? 'Изменить логотип'
              : 'Добавить логотип';
        zone.dataset.demo = String(demoArtwork);
        zone.dataset.empty = String(!hasLogo);
        zone.dataset.contentMode = mode;
        zone.setAttribute('aria-label', label);
        action.textContent =
          panelMode === 'upload' && !hasLogo ? 'Ваш логотип' : label;
      };
      updateLogo(
        ribbonLogo,
        ribbonLogoSrc,
        hasRibbonLogo,
        contentLogoState?.ribbon?.mode || 'inherit',
        'ribbon',
      );
      updateLogo(
        stickerLogo,
        stickerLogoSrc,
        hasStickerLogo,
        contentLogoState?.sticker?.mode || 'inherit',
        'sticker',
      );

      const updateText = (
        { zone, text, action },
        value,
        hasText,
        mode,
        style,
        product,
      ) => {
        text.textContent = value;
        text.hidden = !hasText;
        text.style.color = style.print;
        text.style.fontFamily = style.font;
        const label =
          panelMode === 'settings'
            ? `Настроить ${product === 'ribbon' ? 'ленту' : 'стикер'}`
            : demoArtwork
              ? 'Добавить надпись'
            : hasText
              ? 'Изменить надпись'
              : 'Добавить надпись';
        zone.dataset.demo = String(demoArtwork);
        zone.dataset.empty = String(!hasText);
        zone.dataset.contentMode = mode;
        zone.setAttribute('aria-label', label);
        action.textContent =
          panelMode === 'upload' && !hasText ? 'Ваш текст' : label;
      };
      updateText(
        ribbonText,
        ribbonTextValueTrimmed,
        hasRibbonText,
        contentTextState?.ribbon?.mode || 'inherit',
        ribbonStyle,
        'ribbon',
      );
      updateText(
        stickerText,
        stickerTextValueTrimmed,
        hasStickerText,
        contentTextState?.sticker?.mode || 'inherit',
        stickerStyle,
        'sticker',
      );

      ribbonSurface.style.backgroundColor = ribbon;
      ribbonSurface.style.setProperty(
        '--ribbon-base-height',
        `${(ribbonWidth / 15) * 46}px`,
      );
      ribbonSurface.style.removeProperty('height');
      stickerSurface.style.backgroundColor =
        document.body.dataset.stickerBg || '#ffffff';
      const ribbonGeometry =
        window.RibbonStudioGeometry.getRibbonPrintableGeometry({
          widthMm: ribbonWidth,
          repeatMm,
          width: repeatMm,
          height: ribbonWidth,
        });
      ribbonGuide.style.left = `${(ribbonGeometry.bounds.x / repeatMm) * 100}%`;
      ribbonGuide.style.right =
        `${(ribbonGeometry.bounds.x / repeatMm) * 100}%`;
      ribbonGuide.style.top =
        `${(ribbonGeometry.bounds.y / ribbonWidth) * 100}%`;
      ribbonGuide.style.bottom =
        `${(ribbonGeometry.bounds.y / ribbonWidth) * 100}%`;
      const isRoundRect = stickerShape === 'roundrect';
      const mobileStickerWidth = isRoundRect
        ? Math.min(168, Math.max(132, stickerWidthMm * 2.1))
        : Math.min(104, Math.max(88, stickerSize * 2.5));
      const mobileStickerHeight = isRoundRect
        ? Math.max(42, mobileStickerWidth * (stickerHeightMm / stickerWidthMm))
        : mobileStickerWidth;
      stickerSurface.style.width = `${mobileStickerWidth}px`;
      stickerSurface.style.height = `${mobileStickerHeight}px`;
      stickerSurface.dataset.shape = stickerShape;
      panel.style.setProperty('--mobile-products-sticker-size', `${mobileStickerWidth}px`);
      panel.style.setProperty('--mobile-products-sticker-size-expanded', `${Math.max(mobileStickerWidth, mobileStickerHeight) * 1.25}px`);
      const stickerGeometry = isRoundRect
        ? window.RibbonStudioGeometry.getStickerGeometry({
            shape: 'roundrect',
            widthMm: stickerWidthMm,
            heightMm: stickerHeightMm,
            cornerRadiusMm: 2,
            x: 0,
            y: 0,
            width: mobileStickerWidth,
            height: mobileStickerHeight,
          })
        : window.RibbonStudioGeometry.getStickerPrintableGeometry({
            diameterMm: stickerSize,
            cx: stickerSize / 2,
            cy: stickerSize / 2,
            radius: stickerSize / 2,
          });
      if (isRoundRect) {
        const cornerRadiusPx = Math.min(
          mobileStickerHeight / 2,
          (2 / stickerHeightMm) * mobileStickerHeight,
        );
        stickerSurface.style.aspectRatio = `${stickerWidthMm} / ${stickerHeightMm}`;
        stickerSurface.style.borderRadius = `${cornerRadiusPx}px`;
        const safeInsetY = `${(2.5 / stickerHeightMm) * 100}%`;
        const safeInsetX = `${(2.5 / stickerWidthMm) * 100}%`;
        stickerGuide.style.inset = `${safeInsetY} ${safeInsetX}`;
        stickerGuide.style.borderRadius = '0px';
      } else {
        stickerSurface.style.aspectRatio = '1';
        stickerSurface.style.borderRadius = '50%';
        const stickerInset =
          ((stickerSize / 2 - stickerGeometry.circle.radius) / stickerSize) * 100;
        stickerGuide.style.inset = `${stickerInset}%`;
        stickerGuide.style.borderRadius = '50%';
      }
      panel.querySelector(
        '[data-mobile-product-sample="ribbon"] .mobile-products-sample-label',
      ).textContent = `Лента ${ribbonWidth} мм`;
      panel.querySelector(
        '[data-mobile-product-sample="sticker"] .mobile-products-sample-label',
      ).textContent = `Стикер ${stickerDisplaySize.replace(/^Ø/, '')}`;
      const applyLayout = (surface, logoPart, textPart, layout) => {
        if (!layout) return;
        const sticker = surface === stickerSurface;
        const hasProductLogo = sticker ? hasStickerLogo : hasRibbonLogo;
        const hasProductText = sticker ? hasStickerText : hasRibbonText;
        const textBox = layout.valid
          ? layout.textBox
          : layout.previewTextBox;
        surface.dataset.layout = JSON.stringify(layout);
        surface.dataset.layoutValid = String(layout.valid);
        logoPart.zone.dataset.layoutBox = JSON.stringify(layout.logoBox);
        textPart.zone.dataset.layoutBox = JSON.stringify(textBox);
        const surfaceHeight = surface.getBoundingClientRect().height;
        if (surfaceHeight <= 0) return;
        const positioningRoot = sticker ? surface : ribbonInteractionCell;
        const rootBounds = positioningRoot.getBoundingClientRect();
        if (rootBounds.width <= 0) return;
        const layoutHeight = sticker ? surfaceHeight : rootBounds.height;

        const place = (zone, box, minHeight = 0) => {
          for (const property of ['left', 'top', 'width', 'height']) {
            zone.style.removeProperty(property);
          }
          if (!box) return;
          const height = Math.max(box.height * layoutHeight, minHeight);
          zone.style.left = `${box.x * rootBounds.width}px`;
          zone.style.top =
            `${(box.y + box.height / 2) * layoutHeight - height / 2}px`;
          zone.style.width = `${box.width * rootBounds.width}px`;
          zone.style.height = `${height}px`;
        };
        const placePainted = (zone, box, width, height) => {
          const paintedRect = getPaintedRect(
            layout,
            box,
            rootBounds.width,
            layoutHeight,
            width,
            height,
          );
          if (!paintedRect) return;
          zone.style.left = `${paintedRect.left}px`;
          zone.style.top = `${paintedRect.top}px`;
          zone.style.width = `${paintedRect.width}px`;
          zone.style.height = `${paintedRect.height}px`;
        };
        place(logoPart.zone, hasProductLogo ? layout.logoBox : null);
        place(textPart.zone, hasProductText ? textBox : null, sticker ? 10 : 0);

        if (layout.logoBox) {
          logoPart.image.style.width = '100%';
          logoPart.image.style.height = '100%';
        }
        const visibleText = Boolean(textBox && hasProductText);
        textPart.text.hidden = !visibleText;
        if (visibleText) {
          if (!layout.valid && layout.previewText) {
            textPart.text.textContent = layout.previewText;
          }
          const fontSizeRatio = layout.valid
            ? layout.fontSizeRatio
            : layout.previewFontSizeRatio;
          textPart.text.style.fontSize =
            `${fontSizeRatio * layoutHeight}px`;
        }
        if (hasProductLogo && layout.logoBox) {
          const contentRatio = sticker
            ? contentLogoState?.sticker?.ratio
            : contentLogoState?.ribbon?.ratio;
          const ratio =
            Number(contentRatio) > 0
              ? Number(contentRatio)
              : logoPart.image.naturalWidth > 0 &&
                  logoPart.image.naturalHeight > 0
                ? logoPart.image.naturalWidth / logoPart.image.naturalHeight
                : null;
          if (ratio) {
            const height = layout.logoBox.height * layoutHeight;
            placePainted(
              logoPart.zone,
              layout.logoBox,
              height * ratio,
              height,
            );
          }
        }
      };
      const focusSingleRibbonRepeat = panelMode === 'upload' && dockFloating;
      const ribbonLogoRatio =
        Number(contentLogoState?.ribbon?.ratio) > 0
          ? Number(contentLogoState.ribbon.ratio)
          : null;
      renderRibbonRepeats({
        layout: effectiveLayouts?.ribbon,
        repeatMm,
        ribbonWidth,
        logoSrc: ribbonLogoSrc,
        logoRatio: ribbonLogoRatio,
        textValue: ribbonTextValueTrimmed,
        hasLogo: hasRibbonLogo,
        hasText: hasRibbonText,
        font: ribbonStyle.font,
        print: ribbonStyle.print,
        previewCycleCount: getRibbonPreviewCycleCount(),
        fitSingleRepeat: demoArtwork || focusSingleRibbonRepeat,
        singleRepeat: focusSingleRibbonRepeat,
      });
      applyLayout(
        ribbonSurface,
        ribbonLogo,
        ribbonText,
        effectiveLayouts?.ribbon,
      );
      applyLayout(
        stickerSurface,
        stickerLogo,
        stickerText,
        effectiveLayouts?.sticker,
      );

      const mode =
        hasStickerLogo && hasStickerText
          ? 'logo-and-text'
          : hasStickerLogo
            ? 'logo-only'
            : hasStickerText
              ? 'text-only'
              : 'empty';
      stickerContent.dataset.mobileProductsMode = mode;
      ribbonSurface.dataset.mobileProductsMode =
        hasRibbonLogo && hasRibbonText
          ? 'logo-and-text'
          : hasRibbonLogo
            ? 'logo-only'
            : hasRibbonText
            ? 'text-only'
            : 'empty';
      if (zoomStage) zoomStage.style.transition = previousStageTransition;
      syncPreviewZoom();
    };

    let studioSyncFrame = null;
    const scheduleStudioSync = () => {
      if (studioSyncFrame !== null) cancelAnimationFrame(studioSyncFrame);
      studioSyncFrame = requestAnimationFrame(() => {
        studioSyncFrame = null;
        syncStudioState();
      });
    };

    const mobileViewport = window.matchMedia('(max-width: 700px)');
    const desktopViewport = window.matchMedia('(min-width: 901px)');

    const updateDockMetrics = () => {
      if (!dockFloating) return;
      document.body.style.setProperty(
        '--mobile-products-dock-height',
        `${panel.getBoundingClientRect().height}px`,
      );
    };

    const syncDockPresentation = () => {
      const presentation = !dockFloating
        ? 'flow'
        : keyboardCompact
          ? 'dock-keyboard'
          : dockExpanded
            ? 'dock-expanded'
            : 'dock-compact';
      const visiblyExpanded = presentation === 'dock-expanded';
      panel.dataset.presentation = presentation;
      panel.classList.toggle('is-expanded', visiblyExpanded);
      panel.classList.toggle(
        'is-keyboard-compact',
        presentation === 'dock-keyboard',
      );
      dockToggle.setAttribute('aria-expanded', String(visiblyExpanded));
      dockToggle.querySelector('strong').textContent = visiblyExpanded
        ? 'Свернуть'
        : 'Развернуть';
    };

    const setDockExpanded = (expanded) => {
      dockExpanded = dockFloating && Boolean(expanded);
      syncDockPresentation();
      requestAnimationFrame(() => {
        updateDockMetrics();
        scheduleStudioSync();
      });
    };

    const setDockFloating = (floating) => {
      const nextFloating = mobileViewport.matches && Boolean(floating);
      panel.dataset.floating = String(nextFloating);
      if (nextFloating === dockFloating) {
        if (dockFloating) updateDockMetrics();
        return;
      }

      dockFloating = nextFloating;
      panelSlot.classList.toggle('is-floating', dockFloating);
      panel.classList.toggle('is-floating', dockFloating);
      document.body.classList.toggle('mobile-products-floating', dockFloating);
      if (!dockFloating) {
        document.body.style.removeProperty('--mobile-products-dock-height');
        dockExpanded = false;
        keyboardCompact = false;
      }
      syncDockPresentation();

      requestAnimationFrame(() => {
        updateDockMetrics();
        scheduleStudioSync();
      });
    };

    const updateKeyboardState = () => {
      const viewport = window.visualViewport;
      const keyboardVisible = Boolean(
        dockFloating &&
          viewport &&
          window.innerHeight - viewport.height > 140,
      );
      if (keyboardVisible === keyboardCompact) return;
      keyboardCompact = keyboardVisible;
      syncDockPresentation();
      requestAnimationFrame(() => {
        updateDockMetrics();
        scheduleStudioSync();
      });
    };

    const updateFloatingDock = () => {
      dockFrame = null;
      if (topbar) {
        document.body.style.setProperty(
          '--studio-mobile-header-height',
          `${topbar.getBoundingClientRect().height}px`,
        );
      }
      document.body.classList.toggle(
        'studio-header-scrolled',
        window.scrollY > 24,
      );
      // The full preview now remains in the normal-size sticky slot. The old
      // compact floating dock is intentionally disabled to avoid a second,
      // visually identical preview during scroll.
      setDockFloating(false);
    };

    const scheduleDockUpdate = () => {
      if (dockFrame !== null) return;
      dockFrame = requestAnimationFrame(updateFloatingDock);
    };

    const syncPanelMode = () => {
      const nextMode = ['upload', 'settings', 'order'].includes(
        document.body.dataset.activePanel,
      )
        ? document.body.dataset.activePanel
        : 'upload';
      const hostName =
        desktopViewport.matches && nextMode !== 'order' ? 'desktop' : nextMode;
      const host = panelHosts.find(
        (item) => item.dataset.productsHost === hostName,
      );
      if (!host) return;

      setDockFloating(false);
      panelMode = nextMode;
      panel.dataset.mode = panelMode;
      panelSlot.style.pointerEvents = panelMode === 'order' ? 'none' : 'auto';
      host.appendChild(panelSlot);
      panelSlot.dataset.hosted = 'true';

      const interactiveSamples = ['upload', 'settings'].includes(panelMode);
      samples.forEach((sample) => {
        if (interactiveSamples) {
          sample.setAttribute('role', 'button');
          sample.setAttribute('tabindex', '0');
        } else {
          sample.removeAttribute('role');
          sample.removeAttribute('tabindex');
        }
      });
      [ribbonLogo.zone, ribbonText.zone, stickerLogo.zone, stickerText.zone]
        .forEach((zone) => {
          zone.disabled = panelMode === 'order';
        });
      scheduleStudioSync();
      scheduleDockUpdate();
    };

    dockToggle.addEventListener('click', () => {
      setDockExpanded(!dockExpanded);
    });

    window.addEventListener('scroll', scheduleDockUpdate, {passive: true});
    window.addEventListener('resize', scheduleDockUpdate, {passive: true});
    window.visualViewport?.addEventListener('resize', scheduleDockUpdate, {
      passive: true,
    });
    window.visualViewport?.addEventListener('scroll', scheduleDockUpdate, {
      passive: true,
    });
    mobileViewport.addEventListener('change', scheduleDockUpdate);
    desktopViewport.addEventListener('change', syncPanelMode);

    switches.forEach((productSwitch) => {
      productSwitch.addEventListener('change', () => {
        if (!switches.some((item) => item.checked)) {
          const otherSwitch = switches.find((item) => item !== productSwitch);
          if (otherSwitch) otherSwitch.checked = true;
        }

        syncVisibility();
        document.dispatchEvent(
          new CustomEvent('studio:product-selection-change', {
            detail: Object.fromEntries(
              switches.map((item) => [item.dataset.mobileProduct, item.checked]),
            ),
          }),
        );
      });
    });

    samples.forEach((sample) => {
      sample.addEventListener('click', (event) => {
        if (event.target.closest('button[data-mobile-products-safe-zone]'))
          return;
        const product = sample.dataset.mobileProductSample;
        requestContentProduct(product);
        requestProductSettings(product);
      });
      sample.addEventListener('keydown', (event) => {
        if (event.target !== sample || !['Enter', ' '].includes(event.key)) return;
        event.preventDefault();
        const product = sample.dataset.mobileProductSample;
        requestContentProduct(product);
        requestProductSettings(product);
      });
    });

    document.addEventListener('studio:product-selection-updated', (event) => {
      applyProductSelection(event.detail || {});
    });

    document.addEventListener('studio:content-state-updated', (event) => {
      contentTextState = event.detail?.text || contentTextState;
      contentLogoState = event.detail?.logo || contentLogoState;
      syncStudioState();
    });
    document.addEventListener('studio:layout-updated', (event) => {
      effectiveLayouts = event.detail || {};
      syncStudioState();
    });
    document.addEventListener('studio:sticker-variant-updated', (event) => {
      syncStudioState();
      const displaySize = event.detail?.displaySize;
      if (displaySize) {
        panel
          .querySelectorAll('[data-mobile-product-sample="sticker"] .mobile-products-sample-label')
          .forEach((label) => {
            label.textContent = `Стикер ${displaySize.replace(/^Ø/, '')}`;
          });
      }
    });

    document.addEventListener('input', scheduleStudioSync);
    document.addEventListener('change', scheduleStudioSync);
    document.addEventListener('click', scheduleStudioSync);

    const panelModeObserver = new MutationObserver(syncPanelMode);
    panelModeObserver.observe(document.body, {
      attributes: true,
      attributeFilter: ['data-active-panel'],
    });

    const previewResizeObserver = new ResizeObserver(() => {
      scheduleStudioSync();
      if (dockFloating) scheduleDockUpdate();
    });
    previewResizeObserver.observe(panel);
    previewResizeObserver.observe(ribbonSurface);
    previewResizeObserver.observe(stickerSurface);
    window.addEventListener('resize', scheduleStudioSync, { passive: true });
    document.fonts?.ready.then(scheduleStudioSync);

    applyProductSelection({
      ribbon: document.body.dataset.hasRibbon === 'true',
      sticker: document.body.dataset.hasSticker === 'true',
    });
    const contentFallback = readContentFallback();
    contentTextState = contentFallback?.text || null;
    contentLogoState = contentFallback?.logo || null;
    syncPanelMode();
    syncStudioState();
    scheduleDockUpdate();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setup, { once: true });
  } else {
    setup();
  }
})();
