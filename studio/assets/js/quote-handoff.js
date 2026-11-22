'use strict';

// An optional bearer-token handoff. The browser never reads private costs or
// treats the calculator's preliminary amount as an approved order total.
(() => {
  const fragmentToken = new URLSearchParams(location.hash.slice(1)).get('quote');
  const previousState =
    history.state && typeof history.state === 'object' ? history.state : {};
  const rememberedToken =
    typeof previousState.pmQuoteId === 'string' ? previousState.pmQuoteId : null;
  let token = fragmentToken ?? rememberedToken;
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
  let renewalMessage = '';
  let renewalBusy = false;
  const root = document.getElementById('linkedQuoteSummary');
  const message = document.getElementById('linkedQuoteMessage');
  const list = document.getElementById('linkedQuoteLines');
  const renewalButton = document.createElement('button');
  renewalButton.id = 'linkedQuoteRenew';
  renewalButton.className = 'button ghost';
  renewalButton.type = 'button';
  renewalButton.textContent = 'Продлить расчёт на 30 минут';
  renewalButton.addEventListener('click', () => {
    void renewQuote();
  });
  if (root && list) root.insertBefore(renewalButton, list);

  function readSessionSnapshot() {
    if (!draftStorageKey) return null;
    try {
      const value = JSON.parse(sessionStorage.getItem(draftStorageKey) || 'null');
      if (value?.schema !== 1 || !Array.isArray(value.orderItems) ||
          value.orderItems.length < 1 || value.orderItems.length > 6 ||
          !Number.isInteger(value.expiresAt)) return null;
      return value;
    } catch {
      return null;
    }
  }

  const sameItems = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const validServerQuote = (value, operation) =>
    value?.status === operation && value.canSubmitOrder === false &&
    Number.isInteger(value.expiresAt) &&
    value.expiresAt > Date.now() / 1000 &&
    Number.isFinite(Number(value.finalClientPrice)) &&
    Number(value.finalClientPrice) > 0;

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
    const recoverable = status === 'invalid' && readSessionSnapshot() !== null;
    renewalButton.hidden = status !== 'ready' && !recoverable;
    renewalButton.disabled = renewalBusy;
    renewalButton.textContent = renewalBusy
      ? 'Обновляем расчёт на сервере…'
      : status === 'ready' ? 'Продлить расчёт на 30 минут' : 'Восстановить расчёт';
    if (status === 'loading') {
      message.textContent = 'Проверяем корзину калькулятора на сервере…';
    } else if (status === 'ready') {
      message.textContent =
        (record.expiresAt <= Date.now() / 1000
          ? 'Срок расчёта истёк. Нажмите «Продлить расчёт на 30 минут» перед отправкой заявки. '
          : '') +
        'Перенесены все ' + record.orderItems.length + ' позиций. Выбирайте «Редактировать эту позицию», затем сохраните её макет отдельно. Предварительная стоимость: ' +
        safeNumber(record.finalClientPrice).toLocaleString('ru-RU') +
        ' ₽. Ниже остаются макеты-образцы, а каждый сохранённый файл отдельной позиции согласует Максим до производства.' +
        (persistenceWarning ? ' ' + persistenceWarning : '') +
        (renewalMessage ? ' ' + renewalMessage : '');
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
      message.textContent = recoverable
        ? 'Расчёт недействителен или истёк, но ваши черновики остались в этой вкладке. Нажмите «Восстановить расчёт» для новой проверки цены на сервере.' +
          (renewalMessage ? ' ' + renewalMessage : '')
        : 'Этот расчёт недействителен или устарел. Вернитесь в калькулятор и повторите расчёт: привязанную корзину нельзя отправлять как обычную заявку.';
    }
  }

  const isValidToken = (value) => typeof value === 'string' && /^[a-f0-9]{48}$/.test(value);
  async function load() {
    if (!fromQuoteLink) return;
    if (!isValidToken(token)) {
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
      if (!reply.ok || !validServerQuote(value, 'quote_resolved') ||
          !Array.isArray(value.orderItems) || value.orderItems.length < 1 ||
          value.orderItems.length > 6) {
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
        finalClientPrice: record.finalClientPrice,
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
    const snapshot = readSessionSnapshot();
    if (!snapshot || snapshot.expiresAt !== record.expiresAt ||
        !sameItems(snapshot.orderItems, record.orderItems)) {
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

  // Reissue is a fresh server-side Pricing 2 calculation, never a local
  // extension of an expired quote. The newly issued token is resolved and
  // compared with the original basket before any draft can be reattached.
  // A changed amount is presented for explicit customer consent.
  async function renewQuote() {
    if (renewalBusy || !fromQuoteLink) return false;
    const snapshot = record === null ? readSessionSnapshot() : null;
    const original = record || snapshot;
    if (!original || !Array.isArray(original.orderItems)) return false;
    renewalBusy = true;
    renewalMessage = '';
    render();
    try {
      const issueReply = await fetch('/api/calc/', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          operation: 'issue',
          orderItems: structuredClone(original.orderItems),
        }),
      });
      const issued = await issueReply.json().catch(() => ({}));
      if (!issueReply.ok || !validServerQuote(issued, 'quote_issued') ||
          !isValidToken(issued.quoteId)) throw new Error('ISSUE_FAILED');

      const resolveReply = await fetch('/api/calc/', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({operation: 'resolve', quoteId: issued.quoteId}),
      });
      const verified = await resolveReply.json().catch(() => ({}));
      if (!resolveReply.ok || !validServerQuote(verified, 'quote_resolved') ||
          !Array.isArray(verified.orderItems) ||
          !sameItems(verified.orderItems, original.orderItems) ||
          verified.expiresAt !== issued.expiresAt ||
          Number(verified.finalClientPrice) !== Number(issued.finalClientPrice)) {
        throw new Error('QUOTE_CHANGED');
      }

      const oldPrice = Number(original.finalClientPrice);
      const newPrice = Number(verified.finalClientPrice);
      if (!Number.isFinite(oldPrice) || oldPrice !== newPrice) {
        const previous = Number.isFinite(oldPrice)
          ? oldPrice.toLocaleString('ru-RU') + ' ₽'
          : 'неизвестна';
        const approved = window.confirm(
          'Предварительная цена изменилась. Прежняя: ' + previous +
          '. Новая: ' + newPrice.toLocaleString('ru-RU') +
          ' ₽. Продолжить оформление по новой цене?',
        );
        if (!approved) {
          renewalMessage = 'Новая предварительная цена не подтверждена. Заказ не изменён.';
          return false;
        }
      }

      // Restore a tab's previously verified per-line drafts only AFTER
      // the fresh server quote proves the exact same canonical basket.
      // Never copy drafts to a differently shaped or repriced SKU list.
      if (snapshot) {
        const ids = new Set(verified.orderItems.map((item) => item.itemId));
        for (const [id, draft] of Object.entries(snapshot.editorDrafts || {})) {
          if (ids.has(id) && draft && typeof draft === 'object') {
            editorDrafts.set(id, structuredClone(draft));
          }
        }
        for (const [id, artwork] of Object.entries(snapshot.lineArtworks || {})) {
          if (ids.has(id) && artwork && typeof artwork.previewSvg === 'string' &&
              typeof artwork.printSvg === 'string' && typeof artwork.previewPng === 'string') {
            lineArtworks.set(id, structuredClone(artwork));
          }
        }
        if (ids.has(snapshot.editingItemId)) editingItemId = snapshot.editingItemId;
      }
      token = issued.quoteId;
      record = {
        orderItems: structuredClone(verified.orderItems),
        finalClientPrice: verified.finalClientPrice,
        expiresAt: verified.expiresAt,
      };
      history.replaceState({...history.state, pmQuoteId: token},
        '', location.pathname + location.search);
      status = 'ready';
      persistSessionDrafts();
      renewalMessage = 'Новый предварительный расчёт подтверждён. Черновики и сохранённые макеты не удалены.';
      if (snapshot && editingItemId) {
        document.dispatchEvent(new CustomEvent('studio:quote-ready'));
      }
      return true;
    } catch {
      renewalMessage = 'Не удалось обновить расчёт. Макеты сохранены в этой вкладке; проверьте соединение и повторите.';
      return false;
    } finally {
      renewalBusy = false;
      render();
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
      throw new Error('Срок расчёта истёк или сервер недоступен. Нажмите «Продлить расчёт на 30 минут»; ваши макеты останутся в Studio.');
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
    renewQuote,
    getExpiresAt: () => record?.expiresAt ?? null,
    getClientPrice: () => record?.finalClientPrice ?? null,
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
