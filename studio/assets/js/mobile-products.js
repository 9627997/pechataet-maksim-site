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
        document.dispatchEvent(
          new CustomEvent('studio:content-edit-request', {
            detail: { kind: 'logo', product },
          }),
        );
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
        document.dispatchEvent(
          new CustomEvent('studio:content-edit-request', {
            detail: { kind: 'text', product },
          }),
        );
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

    const syncStudioState = () => {
      const commonText = document.querySelector('#textInput')?.value || '';
      const ribbonTextValue =
        contentTextState?.ribbon?.resolved ?? commonText;
      const stickerTextValue =
        contentTextState?.sticker?.resolved ?? commonText;
      const ribbonTextValueTrimmed = ribbonTextValue.trim();
      const stickerTextValueTrimmed = stickerTextValue.trim();
      const font = document.querySelector('#fontSelect')?.value || 'Manrope';
      const ribbonWidth =
        Number(document.querySelector('#widthChoice button.active')?.dataset.value) ||
        15;
      const stickerSize =
        Number(
          document.querySelector('#stickerSizeChoice button.active')?.dataset.value,
        ) || 40;
      const repeatMm = Number(document.querySelector('#repeatMm')?.value) || 100;
      const print =
        document.querySelector('#printChoice button.active')?.dataset.value || '#171717';
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

      const updateText = ({ zone, text, action }, value, hasText, mode) => {
        text.textContent = value;
        text.hidden = !hasText;
        text.style.color = print;
        text.style.fontFamily = font;
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
      );
      updateText(
        stickerText,
        stickerTextValueTrimmed,
        hasStickerText,
        contentTextState?.sticker?.mode || 'inherit',
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
        surface.dataset.layout = JSON.stringify(layout);
        surface.dataset.layoutValid = String(layout.valid);
        logoPart.zone.dataset.layoutBox = JSON.stringify(layout.logoBox);
        textPart.zone.dataset.layoutBox = JSON.stringify(layout.textBox);
        if (surface === stickerSurface) {
          const place = (zone, box, minHeight = 0) => {
            for (const property of ['left', 'top', 'width', 'height']) {
              zone.style.removeProperty(property);
            }
            if (!box) return;
            const surfaceHeight = surface.getBoundingClientRect().height;
            const height = Math.max(box.height * surfaceHeight, minHeight);
            zone.style.left = `${box.x * 100}%`;
            zone.style.top =
              `${(box.y + box.height / 2) * surfaceHeight - height / 2}px`;
            zone.style.width = `${box.width * 100}%`;
            zone.style.height = `${height}px`;
          };
          place(logoPart.zone, layout.logoBox);
          place(textPart.zone, layout.textBox, 10);
        }
        if (layout.logoBox) {
          logoPart.image.style.width =
            surface === stickerSurface
              ? '100%'
              : `${layout.logoBox.width * 100}%`;
          logoPart.image.style.height =
            surface === stickerSurface
              ? '100%'
              : `${layout.logoBox.height * 100}%`;
        }
        const validText = Boolean(layout.valid && layout.textBox);
        textPart.text.hidden = !validText;
        if (validText) {
          textPart.text.style.fontSize =
            `${layout.fontSizeRatio * surface.getBoundingClientRect().height}px`;
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
    };

    const scheduleStudioSync = () => requestAnimationFrame(syncStudioState);

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

    const logoObserver = new MutationObserver(syncStudioState);
    logoObserver.observe(ribbonLogoSource, {
      attributes: true,
      attributeFilter: ['src', 'hidden'],
    });

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
