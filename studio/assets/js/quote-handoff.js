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
  let captureBusy = false;
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
  if (root && list) root.append(renewalButton);

  const activeLabel = document.createElement('p');
  activeLabel.id = 'linkedQuoteActive';
  const priceLabel = document.createElement('p');
  priceLabel.id = 'linkedQuotePrice';
  const jumpButton = document.createElement('button');
  jumpButton.type = 'button';
  jumpButton.id = 'linkedQuoteJump';
  jumpButton.className = 'button ghost';
  jumpButton.textContent = 'К редактору ↓';
  jumpButton.addEventListener('click', () => {
    if (captureBusy || renewalBusy || status !== 'ready') return;
    if (!editingItemId) {
      document.dispatchEvent(new CustomEvent('studio:quote-edit-item', {
        detail: {itemId: record.orderItems[0].itemId, focusEditor: true},
      }));
    } else {
      document.dispatchEvent(new CustomEvent('studio:quote-focus-editor'));
    }
  });

  const progress = document.createElement('p');
  progress.id = 'linkedQuoteProgress';
  progress.setAttribute('role', 'status');
  const nextButton = document.createElement('button');
  nextButton.id = 'linkedQuoteNext';
  nextButton.type = 'button';
  nextButton.className = 'button primary wide';
  nextButton.hidden = true;
  const editorFeedback = document.createElement('p');
  editorFeedback.id = 'linkedQuoteEditorFeedback';
  editorFeedback.setAttribute('role', 'status');
  editorFeedback.hidden = true;
  function showEditorFeedback(text = '') {
    editorFeedback.textContent = text;
    editorFeedback.hidden = !text;
  }
  if (root && list) {
    root.insertBefore(progress, list);
    list.after(activeLabel, priceLabel, jumpButton);
  }
  function placeSaveAction(panel = document.body.dataset.activePanel || 'upload') {
    const target = document.getElementById('panel-' + panel);
    const anchor = target?.querySelector('.next-panel, #openOrder');
    if (anchor && nextButton.nextElementSibling !== anchor) anchor.before(nextButton);
    else if (target && !anchor && nextButton.parentElement !== target) target.append(nextButton);
    if (nextButton.parentElement && editorFeedback.nextElementSibling !== nextButton) nextButton.before(editorFeedback);
    nextButton.hidden = status !== 'ready' || !editingItemId ||
      (panel === 'order' && lineArtworks.size === record?.orderItems.length);
  }
  placeSaveAction();
  nextButton.addEventListener('click', () => {
    if (captureBusy || !editingItemId) return;
    document.dispatchEvent(new CustomEvent('studio:quote-capture-item', {
      detail: {itemId: editingItemId, advance: true},
    }));
  });

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
  const colors = {
    '#171717': 'чёрный', '#b69249': 'золото', '#c6c8cd': 'серебро',
    '#ffffff': 'белый', '#f3eadc': 'молочный', '#e5c5c4': 'пудровый',
    '#b7202d': 'красный', '#6b1f2d': 'бордовый', '#0c6a4f': 'изумрудный',
    '#6f754e': 'оливковый', '#86b9ca': 'голубой', '#274d83': 'синий',
    '#9b8db5': 'лавандовый', '#8e8d89': 'серый', transparent: 'прозрачный',
  };
  const colorName = (value) => colors[String(value).toLowerCase()] || 'цвет по расчёту';
  function label(item) {
    const cfg = item.configuration || {};
    const product = item.productType === 'ribbon'
      ? 'Лента ' + cfg.widthMm + ' мм · ' + item.quantity.meters + ' м'
      : 'Стикер ' + (cfg.shape === 'circle' ? 'Ø ' + cfg.widthMm : cfg.widthMm + ' × ' + cfg.heightMm) +
        ' мм · ' + item.quantity.pieces + ' шт.';
    return product + ' · основа: ' + colorName(cfg.materialColor ?? cfg.backgroundColor) +
      ' · печать: ' + colorName(cfg.printColor);
  }

  function render() {
    if (!root || !message || !list) return;
    root.hidden = !fromQuoteLink;
    if (!fromQuoteLink) return;
    root.dataset.status = status;
    document.body.dataset.linkedQuote = status;
    progress.hidden = status !== 'ready';
    activeLabel.hidden = status !== 'ready';
    priceLabel.hidden = status !== 'ready';
    jumpButton.hidden = status !== 'ready';
    jumpButton.disabled = captureBusy || renewalBusy;
    placeSaveAction();
    nextButton.disabled = captureBusy || renewalBusy;
    if (status === 'ready') {
      progress.textContent = 'Готово макетов: ' + lineArtworks.size + ' из ' + record.orderItems.length;
      const index = record.orderItems.findIndex(item => item.itemId === editingItemId);
      activeLabel.textContent = index >= 0
        ? 'Макет ' + (index + 1) + ' из ' + record.orderItems.length + ' · ' + label(record.orderItems[index])
        : 'Выберите изделие для создания макета';
      priceLabel.textContent = 'Предварительно: ' + safeNumber(record.finalClientPrice).toLocaleString('ru-RU') + ' ₽';
      jumpButton.textContent = index >= 0 ? 'К редактору ↓' : 'Создать первый макет ↓';
      nextButton.textContent = captureBusy ? 'Сохраняем макет…' : 'Сохранить макет и перейти дальше';
    }
    if (persistenceWarning) root.dataset.persistenceWarning = 'true';
    else delete root.dataset.persistenceWarning;
    list.replaceChildren();
    const recoverable = status === 'invalid' && readSessionSnapshot() !== null;
    renewalButton.hidden = status !== 'ready' && !recoverable;
    renewalButton.disabled = renewalBusy || captureBusy;
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
        'Выберите изделие выше редактора. Все макеты проверит Максим перед печатью.' +
        (persistenceWarning ? ' ' + persistenceWarning : '') +
        (renewalMessage ? ' ' + renewalMessage : '');
      for (const [index, item] of record.orderItems.entries()) {
        const li = document.createElement('li');
        const active = editingItemId === item.itemId;
        const saved = lineArtworks.has(item.itemId);
        li.dataset.active = String(active);
        li.dataset.saved = String(saved);
        const edit = document.createElement('button');
        edit.type = 'button';
        edit.className = 'linked-quote-tab';
        edit.disabled = captureBusy || renewalBusy;
        if (active) edit.setAttribute('aria-current', 'step');
        edit.setAttribute('aria-label', (index + 1) + '. ' + label(item) +
          (active ? ' · редактируется' : saved ? ' · макет сохранён' : ' · нужен макет'));
        const number = document.createElement('strong');
        number.textContent = (index + 1) + (saved ? ' ✓' : '');
        const product = document.createElement('span');
        product.textContent = item.productType === 'ribbon' ? 'Лента' : 'Стикер';
        edit.append(number, product);
        edit.addEventListener('click', () => {
          document.dispatchEvent(new CustomEvent('studio:quote-edit-item', {
            detail: {itemId: item.itemId, focusEditor: true},
          }));
        });
        li.append(edit);
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
    showEditorFeedback();
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
    placeSaveAction,
    showEditorFeedback,
    setCaptureBusy: (value) => { captureBusy = value; render(); },
    getCaptureBusy: () => captureBusy,
    nextIncompleteItem: () => {
      if (!record) return null;
      const index = record.orderItems.findIndex(item => item.itemId === editingItemId);
      const ordered = [...record.orderItems.slice(index + 1), ...record.orderItems.slice(0, index + 1)];
      return ordered.find(item => !lineArtworks.has(item.itemId))?.itemId ?? null;
    },
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
