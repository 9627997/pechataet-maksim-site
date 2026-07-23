(() => {
  const setup = () => {
    const panel = document.querySelector('.mobile-products-panel');
    const panelSlot = document.querySelector('#mobileProductsSlot');
    const dockToggle = document.querySelector('#mobileProductsDockToggle');
    const panelHosts = [...document.querySelectorAll('[data-products-host]')];
    const ribbonLogoSource = document.querySelector('#macroLogoImage');
    const stickerLogoSource = document.querySelector('#macroStickerImage');
    const logoInput = document.querySelector('#logoInput');
    const textInput = document.querySelector('#textInput');

    if (
      !panel ||
      !panelSlot ||
      !dockToggle ||
      !ribbonLogoSource ||
      !stickerLogoSource ||
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
    let dockFrame = null;
    let dockExpanded = false;
    let dockFloating = false;
    let panelMode = document.body.dataset.activePanel || 'upload';

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

    const createLogoZone = (product) => {
      const zone = document.createElement('button');
      const image = document.createElement('img');
      const action = document.createElement('span');
      zone.type = 'button';
      zone.className = `mobile-products-${product}-logo-zone`;
      zone.dataset.mobileProductsSafeZone = `${product}-logo`;
      image.className = `mobile-products-${product}-logo`;
      image.alt = '';
      action.className = 'mobile-products-zone-action';
      zone.addEventListener('click', () => {
        if (zone.dataset.suppressClick === 'true') {
          zone.dataset.suppressClick = 'false';
          return;
        }
        if (panelMode === 'order') return;
        if (panelMode === 'upload') {
          document.dispatchEvent(
            new CustomEvent('studio:logo-upload-target-set', {
              detail: {target: 'common'},
            }),
          );
          logoInput.click();
          return;
        }
        requestProductSettings(product);
      });
      zone.append(image, action);
      return { zone, image, action };
    };

    const createTextZone = (product) => {
      const zone = document.createElement('button');
      const text = document.createElement('span');
      const action = document.createElement('span');
      zone.type = 'button';
      zone.className = `mobile-products-${product}-text-zone`;
      zone.dataset.mobileProductsSafeZone = `${product}-text`;
      text.className = `mobile-products-${product}-text`;
      action.className = 'mobile-products-zone-action';
      zone.addEventListener('click', () => {
        if (zone.dataset.suppressClick === 'true') {
          zone.dataset.suppressClick = 'false';
          return;
        }
        if (panelMode === 'order') return;
        if (panelMode === 'upload') {
          textInput.focus();
          return;
        }
        requestProductSettings(product);
      });
      zone.append(text, action);
      return { zone, text, action };
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
        if (panelMode !== 'settings' || !editableDock || event.button !== 0) return;
        requestProductSettings(product);
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
        document.dispatchEvent(
          new CustomEvent('studio:transform-delta', {
            detail: {
              product,
              kind,
              dxRatio: dx / Math.max(bounds.width, 1),
              dyRatio: dy / Math.max(bounds.height, 1),
            },
          }),
        );
      });

      const finishDrag = (event) => {
        if (event.pointerId !== pointerId) return;
        if (distance >= 4) zone.dataset.suppressClick = 'true';
        zone.dataset.dragging = 'false';
        try {
          zone.releasePointerCapture(pointerId);
        } catch {}
        pointerId = null;
      };
      zone.addEventListener('pointerup', finishDrag);
      zone.addEventListener('pointercancel', finishDrag);
    };

    attachTransformDrag(ribbonLogo.zone, 'ribbon', 'logo', ribbonSurface);
    attachTransformDrag(ribbonText.zone, 'ribbon', 'text', ribbonSurface);
    attachTransformDrag(stickerLogo.zone, 'sticker', 'logo', stickerSurface);
    attachTransformDrag(stickerText.zone, 'sticker', 'text', stickerSurface);

    const syncVisibility = () => {
      switches.forEach((productSwitch) => {
        const sample = samples.find(
          (item) =>
            item.dataset.mobileProductSample === productSwitch.dataset.mobileProduct,
        );

        if (sample) sample.hidden = !productSwitch.checked;
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
                },
                sticker: {
                  mode: snapshot.logo.sticker?.mode || 'inherit',
                  hasLogo: Boolean(snapshot.logo.resolvedSticker?.hasLogo),
                },
              }
            : null,
        };
      } catch {
        return null;
      }
    };

    const renderRibbonRepeats = ({
      layout,
      repeatMm,
      ribbonWidth,
      logoSrc,
      textValue,
      hasLogo,
      hasText,
      font,
      print,
    }) => {
      if (!layout) return;
      const surfaceBounds = ribbonSurface.getBoundingClientRect();
      if (surfaceBounds.width <= 0 || surfaceBounds.height <= 0) return;

      const repeatWidth = (repeatMm / ribbonWidth) * surfaceBounds.height;
      const centerLeft = (surfaceBounds.width - repeatWidth) / 2;
      ribbonInteractionCell.style.left = `${centerLeft}px`;
      ribbonInteractionCell.style.width = `${repeatWidth}px`;
      ribbonTrack.replaceChildren();

      let firstLeft = centerLeft;
      while (firstLeft > 0) firstLeft -= repeatWidth;

      const textBox = layout.valid ? layout.textBox : layout.previewTextBox;
      const visibleText = layout.valid ? textValue : layout.previewText || '';
      const fontSizeRatio = layout.valid
        ? layout.fontSizeRatio
        : layout.previewFontSizeRatio;
      let repeatCount = 0;

      for (
        let left = firstLeft;
        left < surfaceBounds.width;
        left += repeatWidth
      ) {
        repeatCount += 1;
        if (Math.abs(left - centerLeft) < 0.5) continue;

        const cell = document.createElement('span');
        cell.className = 'mobile-products-ribbon-repeat-cell';
        cell.style.left = `${left}px`;
        cell.style.width = `${repeatWidth}px`;

        const boxIsFullyVisible = (box) => {
          if (!box) return false;
          const boxLeft = left + box.x * repeatWidth;
          const boxRight = left + (box.x + box.width) * repeatWidth;
          return boxLeft >= 0.5 && boxRight <= surfaceBounds.width - 0.5;
        };

        if (
          hasLogo &&
          logoSrc &&
          layout.logoBox &&
          boxIsFullyVisible(layout.logoBox)
        ) {
          const image = document.createElement('img');
          const box = layout.logoBox;
          image.className = 'mobile-products-ribbon-repeat-logo';
          image.alt = '';
          image.src = logoSrc;
          image.style.left = `${(box.x + box.width / 2) * 100}%`;
          image.style.top = `${(box.y + box.height / 2) * 100}%`;
          image.style.width = `${box.width * 100}%`;
          image.style.height = `${box.height * 100}%`;
          cell.appendChild(image);
        }

        if (
          hasText &&
          visibleText &&
          textBox &&
          boxIsFullyVisible(textBox)
        ) {
          const text = document.createElement('span');
          text.className = 'mobile-products-ribbon-repeat-text';
          text.textContent = visibleText;
          text.style.left = `${(textBox.x + textBox.width / 2) * 100}%`;
          text.style.top = `${(textBox.y + textBox.height / 2) * 100}%`;
          text.style.width = `${textBox.width * 100}%`;
          text.style.height = `${textBox.height * 100}%`;
          text.style.color = print;
          text.style.fontFamily = font;
          text.style.fontSize = `${fontSizeRatio * surfaceBounds.height}px`;
          cell.appendChild(text);
        }

        ribbonTrack.appendChild(cell);
      }

      ribbonSurface.dataset.ribbonRepeatCount = String(repeatCount);
      ribbonSurface.dataset.ribbonRepeatMm = String(repeatMm);
      ribbonSurface.dataset.ribbonRepeatWidthPx = repeatWidth.toFixed(2);
    };

    const syncStudioState = () => {
      let productStyles = {};
      try {
        productStyles = JSON.parse(
          document.body.dataset.studioProductStyles || '{}',
        );
      } catch {
        productStyles = {};
      }
      const commonText = document.querySelector('#textInput')?.value || '';
      const ribbonTextValue =
        contentTextState?.ribbon?.resolved ?? commonText;
      const stickerTextValue =
        contentTextState?.sticker?.resolved ?? commonText;
      const ribbonTextValueTrimmed = ribbonTextValue.trim();
      const stickerTextValueTrimmed = stickerTextValue.trim();
      const fallbackFont = document.querySelector('#fontSelect')?.value || 'Manrope';
      const fallbackPrint =
        document.querySelector('#printColorSelect')?.value || '#171717';
      const ribbonStyle = {
        font: productStyles.ribbon?.font || fallbackFont,
        print: productStyles.ribbon?.print || fallbackPrint,
      };
      const stickerStyle = {
        font: productStyles.sticker?.font || fallbackFont,
        print: productStyles.sticker?.print || fallbackPrint,
      };
      const ribbonWidth =
        Number(document.querySelector('#widthChoice button.active')?.dataset.value) ||
        15;
      const stickerSize =
        Number(
          document.querySelector('#stickerSizeChoice button.active')?.dataset.value,
        ) || 40;
      const repeatMm = Number(document.querySelector('#repeatMm')?.value) || 100;
      const ribbon =
        document.body.style.getPropertyValue('--ribbon-live-color').trim() || '#f3eadc';
      const ribbonLogoSrc = ribbonLogoSource.getAttribute('src') || '';
      const stickerLogoSrc = stickerLogoSource.getAttribute('src') || '';
      const hasRibbonLogo = Boolean(ribbonLogoSrc && !ribbonLogoSource.hidden);
      const hasStickerLogo = Boolean(stickerLogoSrc && !stickerLogoSource.hidden);
      const hasRibbonText = Boolean(ribbonTextValueTrimmed);
      const hasStickerText = Boolean(stickerTextValueTrimmed);
      if (!effectiveLayouts) {
        try {
          effectiveLayouts = JSON.parse(document.body.dataset.studioLayout || '{}');
        } catch {
          effectiveLayouts = {};
        }
      }

      const updateLogo = ({zone, image, action}, src, hasLogo, mode, product) => {
        if (hasLogo && src) image.src = src;
        else image.removeAttribute('src');
        image.hidden = !hasLogo;
        const label = panelMode === 'settings'
          ? `Настроить ${product === 'ribbon' ? 'ленту' : 'стикер'}`
          : hasLogo ? 'Изменить логотип' : 'Добавить логотип';
        zone.dataset.empty = String(!hasLogo);
        zone.dataset.contentMode = mode;
        zone.setAttribute('aria-label', label);
        action.textContent = label;
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
        const label = panelMode === 'settings'
          ? `Настроить ${product === 'ribbon' ? 'ленту' : 'стикер'}`
          : hasText ? 'Изменить надпись' : 'Добавить надпись';
        zone.dataset.empty = String(!hasText);
        zone.dataset.contentMode = mode;
        zone.setAttribute('aria-label', label);
        action.textContent = label;
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
      ribbonSurface.style.height = `${(ribbonWidth / 15) * 46}px`;
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
      stickerSurface.style.width = `${stickerSize * 2.5}px`;
      const stickerGeometry =
        window.RibbonStudioGeometry.getStickerPrintableGeometry({
          diameterMm: stickerSize,
          cx: stickerSize / 2,
          cy: stickerSize / 2,
          radius: stickerSize / 2,
        });
      const stickerInset =
        ((stickerSize / 2 - stickerGeometry.circle.radius) / stickerSize) * 100;
      stickerGuide.style.inset = `${stickerInset}%`;
      panel.querySelector(
        '[data-mobile-product-sample="ribbon"] .mobile-products-sample-label',
      ).textContent = `Лента ${ribbonWidth} мм`;
      panel.querySelector(
        '[data-mobile-product-sample="sticker"] .mobile-products-sample-label',
      ).textContent = `Стикер ${stickerSize} мм`;
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

        const place = (zone, box, minHeight = 0) => {
          for (const property of ['left', 'top', 'width', 'height']) {
            zone.style.removeProperty(property);
          }
          if (!box) return;
          const height = Math.max(box.height * surfaceHeight, minHeight);
          zone.style.left = `${box.x * rootBounds.width}px`;
          zone.style.top =
            `${(box.y + box.height / 2) * surfaceHeight - height / 2}px`;
          zone.style.width = `${box.width * rootBounds.width}px`;
          zone.style.height = `${height}px`;
        };
        const placePainted = (zone, box, width, height) => {
          const printable = layout.printable || {
            x: 0,
            y: 0,
            width: 1,
            height: 1,
          };
          const printableLeft = printable.x * rootBounds.width;
          const printableTop = printable.y * surfaceHeight;
          const printableWidth = printable.width * rootBounds.width;
          const printableHeight = printable.height * surfaceHeight;
          const scale = Math.min(
            1,
            printableWidth / Math.max(width, 1),
            printableHeight / Math.max(height, 1),
          );
          const paintedWidth = width * scale;
          const paintedHeight = height * scale;
          const centerX = (box.x + box.width / 2) * rootBounds.width;
          const centerY = (box.y + box.height / 2) * surfaceHeight;
          const left = Math.min(
            printableLeft + printableWidth - paintedWidth,
            Math.max(printableLeft, centerX - paintedWidth / 2),
          );
          const top = Math.min(
            printableTop + printableHeight - paintedHeight,
            Math.max(printableTop, centerY - paintedHeight / 2),
          );
          zone.style.left = `${left}px`;
          zone.style.top = `${top}px`;
          zone.style.width = `${paintedWidth}px`;
          zone.style.height = `${paintedHeight}px`;
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
            `${fontSizeRatio * surfaceHeight}px`;
          if (sticker && layout.valid && layout.textBox) {
            const paintedTextHeight =
              textPart.text.getBoundingClientRect().height;
            const safeZoneHeight =
              textPart.zone.getBoundingClientRect().height;
            if (paintedTextHeight > safeZoneHeight) {
              const box = layout.textBox;
              textPart.zone.style.top =
                `${(box.y + box.height / 2) * surfaceHeight - paintedTextHeight / 2}px`;
              textPart.zone.style.height = `${paintedTextHeight}px`;
            }
          }
        }
        if (!sticker) {
          if (hasProductLogo && layout.logoBox) {
            const ratio =
              logoPart.image.naturalWidth > 0 &&
              logoPart.image.naturalHeight > 0
                ? logoPart.image.naturalWidth / logoPart.image.naturalHeight
                : null;
            if (ratio) {
              const height = layout.logoBox.height * surfaceHeight;
              placePainted(
                logoPart.zone,
                layout.logoBox,
                height * ratio,
                height,
              );
            }
          }
          if (visibleText) {
            placePainted(
              textPart.zone,
              textBox,
              Math.max(textPart.text.scrollWidth, 1),
              Math.max(textPart.text.scrollHeight, 1),
            );
          }
        }
      };
      renderRibbonRepeats({
        layout: effectiveLayouts?.ribbon,
        repeatMm,
        ribbonWidth,
        logoSrc: ribbonLogoSrc,
        textValue: ribbonTextValueTrimmed,
        hasLogo: hasRibbonLogo,
        hasText: hasRibbonText,
        font: ribbonStyle.font,
        print: ribbonStyle.print,
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
            : 'text-only';
      stickerContent.dataset.mobileProductsMode = mode;
      ribbonSurface.dataset.mobileProductsMode =
        hasRibbonLogo && hasRibbonText
          ? 'logo-and-text'
          : hasRibbonLogo
            ? 'logo-only'
            : hasRibbonText
              ? 'text-only'
              : 'empty';
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

    const updateDockMetrics = () => {
      if (!dockFloating) return;
      document.body.style.setProperty(
        '--mobile-products-dock-height',
        `${panel.getBoundingClientRect().height}px`,
      );
    };

    const setDockExpanded = (expanded) => {
      dockExpanded = dockFloating && Boolean(expanded);
      panel.classList.toggle('is-expanded', dockExpanded);
      dockToggle.setAttribute('aria-expanded', String(dockExpanded));
      dockToggle.querySelector('strong').textContent = dockExpanded
        ? 'Свернуть'
        : 'Развернуть';
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
        setDockExpanded(false);
      }

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
      panel.classList.toggle('is-keyboard-compact', keyboardVisible);
      if (keyboardVisible && dockExpanded) setDockExpanded(false);
    };

    const updateFloatingDock = () => {
      dockFrame = null;
      if (!mobileViewport.matches) {
        setDockFloating(false);
        panel.classList.remove('is-keyboard-compact');
        return;
      }

      const slotTop = panelSlot.getBoundingClientRect().top;
      const shouldFloat = dockFloating ? slotTop < 24 : slotTop <= 8;
      setDockFloating(shouldFloat);
      updateKeyboardState();
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
      const host = panelHosts.find(
        (item) => item.dataset.productsHost === nextMode,
      );
      if (!host) return;

      setDockFloating(false);
      panelMode = nextMode;
      panel.dataset.mode = panelMode;
      host.appendChild(panelSlot);
      panelSlot.dataset.hosted = 'true';

      const interactiveSamples = panelMode === 'settings';
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
      sample.addEventListener('click', () => {
        requestProductSettings(sample.dataset.mobileProductSample);
      });
      sample.addEventListener('keydown', (event) => {
        if (event.target !== sample || !['Enter', ' '].includes(event.key)) return;
        event.preventDefault();
        requestProductSettings(sample.dataset.mobileProductSample);
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

    document.addEventListener('input', scheduleStudioSync);
    document.addEventListener('change', scheduleStudioSync);
    document.addEventListener('click', scheduleStudioSync);

    const panelModeObserver = new MutationObserver(syncPanelMode);
    panelModeObserver.observe(document.body, {
      attributes: true,
      attributeFilter: ['data-active-panel'],
    });

    const logoObserver = new MutationObserver(syncStudioState);
    logoObserver.observe(ribbonLogoSource, {
      attributes: true,
      attributeFilter: ['src', 'hidden'],
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
