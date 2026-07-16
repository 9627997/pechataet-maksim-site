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

    ribbonSurface.removeAttribute('aria-hidden');
    stickerSurface.removeAttribute('aria-hidden');
    ribbonSurface.replaceChildren();
    stickerSurface.replaceChildren();

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
      zone.addEventListener('click', () => logoInput.click());
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
    ribbonSurface.append(ribbonLogo.zone, ribbonText.zone);
    stickerContent.append(stickerLogo.zone, stickerText.zone);
    stickerSurface.appendChild(stickerContent);

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
      const fontSize = Number(document.querySelector('#fontSize')?.value) || 32;
      const logoScale = Number(document.querySelector('#logoScale')?.value) || 100;
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
      const scale = Math.min(1.8, Math.max(0.5, logoScale / 100));

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
      ribbonText.text.style.fontSize = `${Math.min(20, Math.max(10, fontSize * 0.44))}px`;
      stickerText.text.style.fontSize = `${Math.min(17, Math.max(9, fontSize * 0.36))}px`;
      ribbonLogo.image.style.width = `${Math.min(92, 54 * scale)}%`;
      stickerLogo.image.style.width = `${Math.min(92, (hasStickerText ? 52 : 68) * scale)}%`;

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
