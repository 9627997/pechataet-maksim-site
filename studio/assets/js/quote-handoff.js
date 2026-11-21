'use strict';

// An optional bearer-token handoff. The browser never reads private costs or
// treats the calculator's preliminary amount as an approved order total.
(() => {
  const fragmentToken = new URLSearchParams(location.hash.slice(1)).get('quote');
  const previousState =
    history.state && typeof history.state === 'object' ? history.state : {};
  const rememberedToken =
    typeof previousState.pmQuoteId === 'string' ? previousState.pmQuoteId : null;
  const token = fragmentToken ?? rememberedToken;
  const fromQuoteLink = token !== null;
  if (fragmentToken !== null) {
    // Preserve only in this history entry to survive a Studio refresh. Never
    // copy the bearer token into analytics, the address bar, or localStorage.
    history.replaceState(
      {...previousState, pmQuoteId: fragmentToken},
      '',
      location.pathname + location.search,
    );
  }
  let status = fromQuoteLink ? 'loading' : 'none';
  let record = null;
  // Only explicit, independently prepared artwork may be attached to an item.
  // Never clone the one-ribbon/one-sticker Studio samples across multiple SKU.
  const lineArtworks = new Map();
  let editingItemId = null;
  const root = document.getElementById('linkedQuoteSummary');
  const message = document.getElementById('linkedQuoteMessage');
  const list = document.getElementById('linkedQuoteLines');

  const safeNumber = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
  function label(item) {
    const config = item.configuration || {};
    if (item.productType === 'ribbon') {
      return 'Лента ' + config.widthMm + ' мм · ' + item.quantity.meters + ' м · основа ' +
        config.materialColor + ' · нанесение ' + config.printColor;
    }
    return 'Стикеры ' + config.variantId + ' · ' + item.quantity.pieces +
      ' шт. · основа ' + config.backgroundColor + ' · нанесение ' + config.printColor;
  }

  function render() {
    if (!root || !message || !list) return;
    root.hidden = !fromQuoteLink;
    if (!fromQuoteLink) return;
    root.dataset.status = status;
    list.replaceChildren();
    if (status === 'loading') {
      message.textContent = 'Проверяем корзину калькулятора на сервере…';
    } else if (status === 'ready') {
      message.textContent =
        'Перенесены все ' + record.orderItems.length + ' позиций. Выбирайте «Редактировать эту позицию», затем сохраните её макет отдельно. Предварительная стоимость: ' +
        safeNumber(record.finalClientPrice).toLocaleString('ru-RU') +
        ' ₽. Ниже создаются макеты-образцы (по одному на тип), а каждый отдельный тираж и макет согласует Максим до производства.';
      for (const item of record.orderItems) {
        const li = document.createElement('li');
        const details = document.createElement('span');
        details.textContent = label(item);
        const edit = document.createElement('button');
        edit.type = 'button';
        edit.className = 'button ghost';
        edit.textContent = editingItemId === item.itemId
          ? 'Редактируется эта позиция'
          : 'Редактировать эту позицию';
        edit.disabled = editingItemId === item.itemId;
        edit.addEventListener('click', () => {
          document.dispatchEvent(new CustomEvent('studio:quote-edit-item', {
            detail: {itemId: item.itemId},
          }));
        });
        const capture = document.createElement('button');
        capture.type = 'button';
        capture.className = 'button ghost';
        capture.textContent = lineArtworks.has(item.itemId)
          ? 'Обновить макет позиции'
          : 'Сохранить текущий макет для позиции';
        capture.addEventListener('click', () => {
          document.dispatchEvent(new CustomEvent('studio:quote-capture-item', {
            detail: {itemId: item.itemId},
          }));
        });
        li.append(details, edit, capture);
        list.append(li);
      }
    } else {
      message.textContent =
        'Этот расчёт недействителен или устарел. Вернитесь в калькулятор и повторите расчёт: привязанную корзину нельзя отправлять как обычную заявку.';
    }
  }

  const validToken = typeof token === 'string' && /^[a-f0-9]{48}$/.test(token);
  async function load() {
    if (!fromQuoteLink) return;
    if (!validToken) {
      status = 'invalid';
      render();
      return;
    }
    try {
      const reply = await fetch('/api/calc/', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({operation: 'resolve', quoteId: token}),
      });
      const value = await reply.json().catch(() => ({}));
      if (!reply.ok || value.status !== 'quote_resolved' ||
          !Array.isArray(value.orderItems) || value.orderItems.length < 1 ||
          value.orderItems.length > 6 || value.canSubmitOrder !== false ||
          !Number.isInteger(value.expiresAt) || value.expiresAt <= Date.now() / 1000) {
        throw new Error('QUOTE_INVALID');
      }
      record = {
        orderItems: structuredClone(value.orderItems),
        finalClientPrice: value.finalClientPrice,
        expiresAt: value.expiresAt,
      };
      status = 'ready';
    } catch {
      status = 'invalid';
      record = null;
    }
    render();
  }

  function registerItemArtwork(itemId, artwork) {
    if (status !== 'ready' || record === null) {
      throw new Error('Сначала необходимо подтвердить корзину калькулятора.');
    }
    if (typeof itemId !== 'string' ||
        !record.orderItems.some((item) => item.itemId === itemId)) {
      throw new Error('Неизвестная позиция заказа.');
    }
    if (!artwork || typeof artwork !== 'object' ||
        Object.keys(artwork).sort().join('|') !== 'previewPng|previewSvg|printSvg' ||
        typeof artwork.previewSvg !== 'string' ||
        typeof artwork.printSvg !== 'string' ||
        typeof artwork.previewPng !== 'string' ||
        !artwork.previewSvg.includes('<svg') ||
        !artwork.printSvg.includes('<svg') ||
        !artwork.previewPng.startsWith('data:image/png;base64,')) {
      throw new Error('Для позиции нужны отдельные SVG и PNG-превью.');
    }
    lineArtworks.set(itemId, {
      previewSvg: artwork.previewSvg,
      printSvg: artwork.printSvg,
      previewPng: artwork.previewPng,
    });
    render();
  }

  function selectEditingItem(itemId) {
    if (status !== 'ready' || !record?.orderItems.some((item) => item.itemId === itemId)) {
      throw new Error('Неизвестная позиция заказа.');
    }
    editingItemId = itemId;
    render();
  }

  function clearItemArtwork(itemId) {
    lineArtworks.delete(itemId);
    render();
  }

  function augmentPayload(payload) {
    if (!fromQuoteLink) return payload;
    if (status !== 'ready' || record === null || record.expiresAt <= Date.now() / 1000) {
      throw new Error('Срок действия расчёта истёк или корзина недоступна. Откройте калькулятор и пересчитайте заказ.');
    }
    // The order receiver MUST compare these items with the token snapshot and
    // calculate the customer amount itself. Studio artwork is reference-only.
    return {
      ...payload,
      quoteId: token,
      orderItems: structuredClone(record.orderItems),
      ...(lineArtworks.size > 0
        ? {artifactsByItemId: Object.fromEntries(lineArtworks)}
        : {}),
      pricing: {
        preliminary: true,
        currency: 'RUB',
        amount: null,
        requiresIndividualCalculation: true,
      },
    };
  }

  window.PmQuoteHandoff = Object.freeze({
    load,
    augmentPayload,
    registerItemArtwork,
    clearItemArtwork,
    selectEditingItem,
    getEditingItemId: () => editingItemId,
    getArtworkCount: () => lineArtworks.size,
    getState: () => status,
    getItems: () => record === null ? [] : structuredClone(record.orderItems),
  });
  render();
  void load();
})();
