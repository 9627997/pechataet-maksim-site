(() => {
  const setup = () => {
    const panel = document.querySelector('.mobile-products-panel');
    const logoSource = document.querySelector('#macroLogoImage');

    if (!panel || !logoSource) return;

    const switches = [...panel.querySelectorAll('[data-mobile-product]')];
    const samples = [...panel.querySelectorAll('[data-mobile-product-sample]')];
    const ribbonSurface = panel.querySelector('.mobile-products-ribbon-sample');
    const stickerSurface = panel.querySelector('.mobile-products-sticker-sample');

    ribbonSurface.replaceChildren();
    stickerSurface.replaceChildren();

    const createLogoZone = (product) => {
      const zone = document.createElement('div');
      const image = document.createElement('img');
      zone.className = `mobile-products-${product}-logo-zone`;
      zone.dataset.mobileProductsSafeZone = `${product}-logo`;
      image.className = `mobile-products-${product}-logo`;
      image.alt = '';
      zone.appendChild(image);
      return { zone, image };
    };

    const createTextZone = (product) => {
      const zone = document.createElement('div');
      const text = document.createElement('span');
      zone.className = `mobile-products-${product}-text-zone`;
      zone.dataset.mobileProductsSafeZone = `${product}-text`;
      text.className = `mobile-products-${product}-text`;
      zone.appendChild(text);
      return { zone, text };
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

    const syncStudioState = () => {
      const text = document.querySelector('#textInput')?.value.trim() || '';
      const font = document.querySelector('#fontSelect')?.value || 'Manrope';
      const fontSize = Number(document.querySelector('#fontSize')?.value) || 32;
      const logoScale = Number(document.querySelector('#logoScale')?.value) || 100;
      const print =
        document.querySelector('#printChoice button.active')?.dataset.value || '#171717';
      const ribbon =
        document.body.style.getPropertyValue('--ribbon-live-color').trim() || '#f3eadc';
      const logoSrc = logoSource.getAttribute('src') || '';
      const hasLogo = Boolean(logoSrc && !logoSource.hidden);
      const hasText = Boolean(text);
      const scale = Math.min(1.8, Math.max(0.5, logoScale / 100));

      [ribbonLogo.image, stickerLogo.image].forEach((image) => {
        if (hasLogo) image.src = logoSrc;
        else image.removeAttribute('src');
        image.hidden = !hasLogo;
      });

      [ribbonText.text, stickerText.text].forEach((element) => {
        element.textContent = text;
        element.hidden = !hasText;
        element.style.color = print;
        element.style.fontFamily = font;
      });

      ribbonSurface.style.backgroundColor = ribbon;
      ribbonText.text.style.fontSize = `${Math.min(20, Math.max(10, fontSize * 0.44))}px`;
      stickerText.text.style.fontSize = `${Math.min(17, Math.max(9, fontSize * 0.36))}px`;
      ribbonLogo.image.style.width = `${Math.min(92, 54 * scale)}%`;
      stickerLogo.image.style.width = `${Math.min(92, (hasText ? 52 : 68) * scale)}%`;

      ribbonLogo.zone.hidden = !hasLogo;
      ribbonText.zone.hidden = !hasText;
      stickerLogo.zone.hidden = !hasLogo;
      stickerText.zone.hidden = !hasText;

      const mode = hasLogo && hasText ? 'logo-and-text' : hasLogo ? 'logo-only' : 'text-only';
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

    document.addEventListener('input', scheduleStudioSync);
    document.addEventListener('change', scheduleStudioSync);
    document.addEventListener('click', scheduleStudioSync);

    const logoObserver = new MutationObserver(syncStudioState);
    logoObserver.observe(logoSource, {
      attributes: true,
      attributeFilter: ['src', 'hidden'],
    });

    applyProductSelection({
      ribbon: document.body.dataset.hasRibbon === 'true',
      sticker: document.body.dataset.hasSticker === 'true',
    });
    syncStudioState();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setup, { once: true });
  } else {
    setup();
  }
})();
