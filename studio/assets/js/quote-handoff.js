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
  const editorDrafts = new Map();
  // A per-history-entry random key scopes drafts to this browser tab and
  // quote, without writing the bearer quote token to sessionStorage.
  const draftSessionId =
    fromQuoteLink && validSessionId(previousState.pmQuoteDraftSession)
      ? previousState.pmQuoteDraftSession
      : fromQuoteLink ? crypto.randomUUID() : null;
  const draftStorageKey = draftSessionId
    ? 'pm-quote-workspaces-v1:' + draftSessionId
    : null;
  function validSessionId(value) {
    return typeof value === 'string' &&
      /^[0-9a-f-]{36}$/.test(value);
  }
  if (draftSessionId && draftSessionId !== previousState.pmQuoteDraftSession) {
    history.replaceState(
      {...history.state, pmQuoteDraftSession: draftSessionId},
      '',
      location.pathname + location.search,
    );
  }
  let persistenceWarning = '';
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
    if (persistenceWarning) root.dataset.persistenceWarning = 'true';
    else delete root.dataset.persistenceWarning;
    list.replaceChildren();
    if (status === 'loading') {
      message.textContent = 'Проверяем корзину калькулятора на сервере…';
    } else if (status === 'ready') {
      message.textContent =
        'Перенесены все ' + record.orderItems.length + ' позиций. Выбирайте «Редактировать эту позицию», затем сохраните её макет отдельно. Предварительная стоимость: ' +
        safeNumber(record.finalClientPrice).toLocaleString('ru-RU') +
        ' ₽. Ниже остаются макеты-образцы, а каждый сохранённый файл отдельной позиции согласует Максим до производства.' +
        (persistenceWarning ? ' ' + persistenceWarning : '');
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
    restoreSessionDrafts();
    render();
    if (status === 'ready') {
      document.dispatchEvent(new CustomEvent('studio:quote-ready'));
    }
  }

  function persistSessionDrafts() {
    if (!draftStorageKey || status !== 'ready' || !record) return false;
    try {
      sessionStorage.setItem(draftStorageKey, JSON.stringify({
        schema: 1,
        expiresAt: record.expiresAt,
        orderItems: record.orderItems,
        editorDrafts: Object.fromEntries(editorDrafts),
        lineArtworks: Object.fromEntries(lineArtworks),
        editingItemId,
      }));
      persistenceWarning = '';
      return true;
    } catch {
      persistenceWarning = 'В браузере закончилось место для черновиков. Не обновляйте вкладку до отправки заявки.';
      return false;
    }
  }

  function restoreSessionDrafts() {
    if (!draftStorageKey || status !== 'ready' || !record) return;
    let snapshot;
    try {
      snapshot = JSON.parse(sessionStorage.getItem(draftStorageKey) || 'null');
    } catch {
      return;
    }
    if (!snapshot || snapshot.schema !== 1 ||
        snapshot.expiresAt !== record.expiresAt ||
        JSON.stringify(snapshot.orderItems) !== JSON.stringify(record.orderItems)) {
      sessionStorage.removeItem(draftStorageKey);
      return;
    }
    const ids = new Set(record.orderItems.map((item) => item.itemId));
    for (const [id, draft] of Object.entries(snapshot.editorDrafts || {})) {
      if (ids.has(id) && draft && typeof draft === 'object') {
        editorDrafts.set(id, draft);
      }
    }
    for (const [id, artwork] of Object.entries(snapshot.lineArtworks || {})) {
      if (ids.has(id) && artwork &&
          typeof artwork.previewSvg === 'string' &&
          typeof artwork.printSvg === 'string' &&
          typeof artwork.previewPng === 'string') {
        lineArtworks.set(id, artwork);
      }
    }
    // Active session is reloaded as a draft by app.js, not implicitly sent.
    if (ids.has(snapshot.editingItemId)) {
      editingItemId = snapshot.editingItemId;
    }
  }

  function saveEditorDraft(itemId, draft) {
    if (status !== 'ready' || !record?.orderItems.some((item) => item.itemId === itemId)) {
      throw new Error('Нельзя сохранить черновик неизвестной позиции.');
    }
    editorDrafts.set(itemId, structuredClone(draft));
    persistSessionDrafts();
  }

  function getEditorDraft(itemId) {
    return editorDrafts.has(itemId)
      ? structuredClone(editorDrafts.get(itemId))
      : null;
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
    persistSessionDrafts();
    render();
  }

  function selectEditingItem(itemId) {
    if (status !== 'ready' || !record?.orderItems.some((item) => item.itemId === itemId)) {
      throw new Error('Неизвестная позиция заказа.');
    }
    editingItemId = itemId;
    persistSessionDrafts();
    render();
  }

  function clearItemArtwork(itemId) {
    lineArtworks.delete(itemId);
    persistSessionDrafts();
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
    saveEditorDraft,
    getEditorDraft,
    selectEditingItem,
    getEditingItemId: () => editingItemId,
    getArtworkCount: () => lineArtworks.size,
    getPersistenceWarning: () => persistenceWarning,
    getState: () => status,
    getItems: () => record === null ? [] : structuredClone(record.orderItems),
  });
  render();
  void load();
})();
