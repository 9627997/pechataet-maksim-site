(() => {
  const setup = () => {
    const panel = document.querySelector('.mobile-products-panel');
    const ribbonLogoSource = document.querySelector('#macroLogoImage');
    const stickerLogoSource = document.querySelector('#macroStickerImage');
    const logoInput = document.querySelector('#logoInput');
    const textInput = document.querySelector('#textInput');

    if (!panel || !ribbonLogoSource || !stickerLogoSource || !logoInput || !textInput)
      return;

    const switches = [...panel.querySelectorAll('[data-mobile-product]')];
    const samples = [...panel.querySelectorAll('[data-mobile-product-sample]')];
    const addContentButtons = [
      ...panel.querySelectorAll('[data-mobile-products-add]'),
    ];
    const ribbonSurface = panel.querySelector('.mobile-products-ribbon-sample');
    const stickerSurface = panel.querySelector('.mobile-products-sticker-sample');
    let contentTextState = null;
    let contentLogoState = null;
    let effectiveLayouts = null;

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
      document.dispatchEvent(
        new CustomEvent('studio:settings-product-change', {
          detail: {product},
        }),
      );
    };

    const requestTransformTarget = (product, target) => {
      document.dispatchEvent(
        new CustomEvent('studio:settings-transform-target-change', {
          detail: {product, target},
        }),
      );
    };

    const requestContentEdit = (event, kind, product) => {
      if (document.body.dataset.activePanel === 'settings') {
        event.stopPropagation();
        requestProductSettings(product);
        requestTransformTarget(product, kind);
        return;
      }

      document.dispatchEvent(
        new CustomEvent('studio:content-edit-request', {
          detail: {kind, product},
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
      zone.addEventListener('click', (event) => {
        requestContentEdit(event, 'logo', product);
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
      zone.addEventListener('click', (event) => {
        requestContentEdit(event, 'text', product);
      });
      zone.append(text, action);
      return { zone, text, action };
    };

    const ribbonLogo = createLogoZone('ribbon');
    const ribbonText = createTextZone('ribbon');
    const stickerContent = document.createElement('div');
    const stickerLogo = createLogoZone('sticker');
    const stickerText = createTextZone('sticker');

    stickerContent.className = 'mobile-products-sticker-content';
    stickerContent.dataset.mobileProductsSafeZone = 'sticker-content';
    ribbonSurface.append(ribbonLogo.zone, ribbonText.zone, ribbonGuide);
    stickerContent.append(stickerLogo.zone, stickerText.zone);
    stickerSurface.append(stickerContent, stickerGuide);

    const installDirectTransform = (zone, product, target, surface) => {
      const pointers = new Map();
      let lastPinchDistance = null;

      const dispatchDelta = (dx, dy) => {
        const bounds = surface.getBoundingClientRect();
        if (!bounds.width || !bounds.height) return;
        document.dispatchEvent(
          new CustomEvent('studio:settings-transform-delta', {
            detail: {
              product,
              target,
              dxRatio: dx / bounds.width,
              dyRatio: dy / bounds.height,
            },
          }),
        );
      };

      zone.addEventListener('pointerdown', (event) => {
        if (document.body.dataset.activePanel !== 'settings') return;
        event.preventDefault();
        event.stopPropagation();
        requestProductSettings(product);
        requestTransformTarget(product, target);
        pointers.set(event.pointerId, {x: event.clientX, y: event.clientY});
        zone.setPointerCapture?.(event.pointerId);
        if (pointers.size === 2) {
          const [first, second] = [...pointers.values()];
          lastPinchDistance = Math.hypot(second.x - first.x, second.y - first.y);
        }
      });

      zone.addEventListener('pointermove', (event) => {
        const previous = pointers.get(event.pointerId);
        if (!previous || document.body.dataset.activePanel !== 'settings') return;
        event.preventDefault();
        const next = {x: event.clientX, y: event.clientY};
        pointers.set(event.pointerId, next);
        if (pointers.size >= 2) {
          const [first, second] = [...pointers.values()];
          const distance = Math.hypot(second.x - first.x, second.y - first.y);
          if (lastPinchDistance && distance) {
            document.dispatchEvent(
              new CustomEvent('studio:settings-transform-scale', {
                detail: {
                  product,
                  target,
                  factor: distance / lastPinchDistance,
                },
              }),
            );
          }
          lastPinchDistance = distance;
        } else {
          dispatchDelta(next.x - previous.x, next.y - previous.y);
        }
      });

      const endPointer = (event) => {
        pointers.delete(event.pointerId);
        if (pointers.size < 2) lastPinchDistance = null;
      };
      zone.addEventListener('pointerup', endPointer);
      zone.addEventListener('pointercancel', endPointer);
    };

    installDirectTransform(ribbonLogo.zone, 'ribbon', 'logo', ribbonSurface);
    installDirectTransform(ribbonText.zone, 'ribbon', 'text', ribbonSurface);
    installDirectTransform(stickerLogo.zone, 'sticker', 'logo', stickerSurface);
    installDirectTransform(stickerText.zone, 'sticker', 'text', stickerSurface);

    const syncVisibility = () => {
      const settingsMode = document.body.dataset.activePanel === 'settings';
      switches.forEach((productSwitch) => {
        const sample = samples.find(
          (item) =>
            item.dataset.mobileProductSample === productSwitch.dataset.mobileProduct,
        );

        if (sample) {
          sample.hidden = settingsMode ? false : !productSwitch.checked;
          sample.classList.toggle('is-product-excluded', !productSwitch.checked);
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
      const sticker =
        document.body.style.getPropertyValue('--sticker-live-color').trim() || '#ffffff';
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

      const updateLogo = ({zone, image, action}, src, hasLogo, mode) => {
        if (hasLogo && src) image.src = src;
        else image.removeAttribute('src');
        image.hidden = !hasLogo;
        const label = hasLogo ? 'Изменить логотип' : 'Добавить логотип';
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
      );
      updateLogo(
        stickerLogo,
        stickerLogoSrc,
        hasStickerLogo,
        contentLogoState?.sticker?.mode || 'inherit',
      );

      const updateText = ({ zone, text, action }, value, hasText, mode, style) => {
        text.textContent = value;
        text.hidden = !hasText;
        text.style.color = style.print;
        text.style.fontFamily = style.font;
        const label = hasText ? 'Изменить надпись' : 'Добавить надпись';
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
      );
      updateText(
        stickerText,
        stickerTextValueTrimmed,
        hasStickerText,
        contentTextState?.sticker?.mode || 'inherit',
        stickerStyle,
      );

      ribbonSurface.style.backgroundColor = ribbon;
      stickerSurface.style.backgroundColor = sticker;
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
        const visibleTextBox = layout.valid
          ? layout.textBox
          : layout.previewTextBox;
        surface.dataset.layout = JSON.stringify(layout);
        surface.dataset.layoutValid = String(layout.valid);
        logoPart.zone.dataset.layoutBox = JSON.stringify(layout.logoBox);
        textPart.zone.dataset.layoutBox = JSON.stringify(layout.textBox);
        const surfaceHeight = surface.getBoundingClientRect().height;
        if (surfaceHeight <= 0) return;

        if (surface === stickerSurface) {
          const place = (zone, box, minHeight = 0) => {
            for (const property of ['left', 'top', 'width', 'height']) {
              zone.style.removeProperty(property);
            }
            if (!box) return;
            const height = Math.max(box.height * surfaceHeight, minHeight);
            zone.style.left = `${box.x * 100}%`;
            zone.style.top =
              `${(box.y + box.height / 2) * surfaceHeight - height / 2}px`;
            zone.style.width = `${box.width * 100}%`;
            zone.style.height = `${height}px`;
          };
          place(
            logoPart.zone,
            hasStickerLogo ? layout.logoBox : null,
          );
          place(
            textPart.zone,
            hasStickerText ? visibleTextBox : null,
            10,
          );
        }
        if (surface === ribbonSurface) {
          const place = (zone, box) => {
            for (const property of ['left', 'top', 'width', 'height']) {
              zone.style.removeProperty(property);
            }
            if (!box) return;
            zone.style.position = 'absolute';
            zone.style.left = `${box.x * 100}%`;
            zone.style.top = '0';
            zone.style.width = `${box.width * 100}%`;
            zone.style.height = '100%';
          };
          place(logoPart.zone, hasRibbonLogo ? layout.logoBox : null);
          place(textPart.zone, hasRibbonText ? visibleTextBox : null);
          if (layout.logoBox) {
            const naturalRatio =
              logoPart.image.naturalWidth / logoPart.image.naturalHeight;
            const surfaceWidth = surface.getBoundingClientRect().width;
            const desiredLogoWidth =
              layout.logoBox.height * surfaceHeight * naturalRatio;
            const layoutLogoWidth = layout.logoBox.width * surfaceWidth;
            if (
              Number.isFinite(naturalRatio) &&
              naturalRatio > 0 &&
              desiredLogoWidth > layoutLogoWidth &&
              layout.printable?.width
            ) {
              const printableLeft = layout.printable.x * surfaceWidth;
              const printableRight =
                (layout.printable.x + layout.printable.width) * surfaceWidth;
              const width = Math.min(
                desiredLogoWidth,
                printableRight - printableLeft,
              );
              const center =
                (layout.logoBox.x + layout.logoBox.width / 2) * surfaceWidth;
              const left = Math.min(
                printableRight - width,
                Math.max(printableLeft, center - width / 2),
              );
              logoPart.zone.style.left = `${left}px`;
              logoPart.zone.style.width = `${width}px`;
            }
            logoPart.image.style.top =
              `${(layout.logoBox.y + layout.logoBox.height / 2) * 100}%`;
          }
          if (visibleTextBox) {
            textPart.text.style.position = 'absolute';
            textPart.text.style.top =
              `${(visibleTextBox.y + visibleTextBox.height / 2) * 100}%`;
            textPart.text.style.left = '0';
            textPart.text.style.width = '100%';
            textPart.text.style.transform = 'translateY(-50%)';
          }
        }
        if (layout.logoBox) {
          logoPart.image.style.width = '100%';
          logoPart.image.style.height =
            surface === stickerSurface
              ? '100%'
              : `${(layout.printable?.height || 1) * surfaceHeight}px`;
        }
        const textBox = layout.valid
          ? layout.textBox
          : layout.previewTextBox;
        const visibleText = Boolean(textBox);
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
          if (surface === stickerSurface && hasStickerText && layout.textBox) {
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
      };
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

      const settingsMode = document.body.dataset.activePanel === 'settings';
      syncVisibility();
      panel.dataset.interactionMode = settingsMode ? 'settings' : 'content';
      samples.forEach((sample) => {
        if (settingsMode) {
          sample.setAttribute('role', 'button');
          sample.tabIndex = 0;
        } else {
          sample.setAttribute('role', 'group');
          sample.removeAttribute('tabindex');
          sample.removeAttribute('aria-pressed');
        }
      });
      [ribbonLogo, ribbonText, stickerLogo, stickerText].forEach(({zone}) => {
        const product = zone.dataset.mobileProductsSafeZone.split('-')[0];
        const target = zone.dataset.mobileProductsSafeZone.split('-')[1];
        const empty = zone.dataset.empty === 'true';
        zone.tabIndex = 0;
        zone.disabled = settingsMode && empty;
        zone.classList.toggle(
          'is-transform-selected',
          settingsMode &&
            document.body.dataset.settingsTransformProduct === product &&
            document.body.dataset.settingsTransformTarget === target,
        );
        if (settingsMode) {
          zone.setAttribute(
            'aria-label',
            `Настроить ${target === 'logo' ? 'логотип' : 'текст'} на ${product === 'ribbon' ? 'ленте' : 'стикере'}`,
          );
        }
      });

      const demoMode = document.body.dataset.previewDemo === 'true';
      const presence = {
        ribbon: {
          logo: demoMode || hasRibbonLogo,
          text: demoMode || hasRibbonText,
        },
        sticker: {
          logo: demoMode || hasStickerLogo,
          text: demoMode || hasStickerText,
        },
      };
      const showAddActions = document.body.dataset.activePanel === 'upload';
      addContentButtons.forEach((button) => {
        const product = button.dataset.product;
        const kind = button.dataset.mobileProductsAdd;
        const exists = presence[product]?.[kind] !== false;
        button.hidden = !showAddActions;
        button.dataset.actionMode = exists ? 'edit' : 'add';
        button.textContent =
          `${exists ? 'Изменить' : 'Добавить'} ${kind === 'logo' ? 'логотип' : 'текст'}`;
      });
      panel.querySelectorAll('[data-mobile-products-add-actions]').forEach(
        (actions) => {
          actions.hidden = ![...actions.querySelectorAll('button')].some(
            (button) => !button.hidden,
          );
        },
      );
    };

    let studioSyncFrame = null;
    const scheduleStudioSync = () => {
      if (studioSyncFrame !== null) cancelAnimationFrame(studioSyncFrame);
      studioSyncFrame = requestAnimationFrame(() => {
        studioSyncFrame = null;
        syncStudioState();
      });
    };
    [ribbonLogo.image, stickerLogo.image].forEach((image) => {
      image.addEventListener('load', scheduleStudioSync);
    });

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
        if (document.body.dataset.activePanel !== 'settings') return;
        requestProductSettings(sample.dataset.mobileProductSample);
      });
      sample.addEventListener('keydown', (event) => {
        if (document.body.dataset.activePanel !== 'settings') return;
        if (event.target !== sample || !['Enter', ' '].includes(event.key)) return;
        event.preventDefault();
        requestProductSettings(sample.dataset.mobileProductSample);
      });
    });

    addContentButtons.forEach((button) => {
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        document.dispatchEvent(
          new CustomEvent(
            button.dataset.actionMode === 'edit'
              ? 'studio:content-edit-request'
              : 'studio:content-add-request',
            {
            detail: {
              kind: button.dataset.mobileProductsAdd,
              product: button.dataset.product,
            },
            },
          ),
        );
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
    document.addEventListener('studio:settings-transform-state', syncStudioState);

    document.addEventListener('input', scheduleStudioSync);
    document.addEventListener('change', scheduleStudioSync);
    document.addEventListener('click', scheduleStudioSync);

    const logoObserver = new MutationObserver(syncStudioState);
    logoObserver.observe(ribbonLogoSource, {
      attributes: true,
      attributeFilter: ['src', 'hidden'],
    });

    const previewResizeObserver = new ResizeObserver(scheduleStudioSync);
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
    syncStudioState();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setup, { once: true });
  } else {
    setup();
  }
})();
