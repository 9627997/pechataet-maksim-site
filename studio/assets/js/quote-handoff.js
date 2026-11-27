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
  if (root && list) root.insertBefore(renewalButton, list);

  const progress = document.createElement('p');
  progress.id = 'linkedQuoteProgress';
  progress.setAttribute('role', 'status');
  const nextButton = document.createElement('button');
  nextButton.id = 'linkedQuoteNext';
  nextButton.type = 'button';
  nextButton.className = 'button primary wide';
  nextButton.hidden = true;
  // Compact basket remains available while the actual editor is in view.
  const jump = document.createElement('button');
  jump.id = 'linkedQuoteJump';
  jump.type = 'button';
  jump.className = 'button ghost';
  jump.textContent = 'К редактору ↓';
  jump.hidden = true;
  const toggle = document.createElement('button');
  toggle.id = 'linkedQuoteToggle';
  toggle.type = 'button';
  toggle.className = 'button ghost';
  toggle.setAttribute('aria-controls', 'linkedQuoteLines');
  toggle.hidden = true;
  let expanded = false;
  let reviewMode = false;
  const review = document.createElement('section');
  review.id = 'linkedQuoteReview';
  review.hidden = true;
  document.getElementById('openOrder')?.before(review);
  const steps = document.createElement('div');
  steps.id = 'linkedQuoteSteps';
  steps.setAttribute('role', 'group');
  steps.setAttribute('aria-label', 'Макеты изделий');
  steps.hidden = true;
  const current = document.createElement('p');
  current.id = 'linkedQuoteCurrent';
  current.hidden = true;
  const selector = document.createElement('select');
  selector.id = 'linkedQuoteSelect';
  selector.className = 'input';
  selector.setAttribute('aria-label', 'Выберите изделие для редактирования');
  selector.hidden = true;
  selector.addEventListener('change', () => {
    expanded = false;
    document.dispatchEvent(new CustomEvent('studio:quote-edit-item', {
      detail: {itemId: selector.value, focusEditor: true},
    }));
  });
  toggle.addEventListener('click', () => {
    expanded = !expanded;
    render();
  });
  function focusEditor() {
    const panel = document.querySelector('.panel.active');
    const target = panel?.querySelector('.panel-head') || panel;
    target?.scrollIntoView({block: 'start'});
  }
  jump.addEventListener('click', focusEditor);
  if (root && list) {
    list.before(steps, current, selector, toggle, jump);
    list.after(nextButton);
  }
  if (root && list) root.insertBefore(progress, list);
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
  const colorName = (value) => ({
    '#171717': 'чёрный', '#b69249': 'золото', '#c6c8cd': 'серебро',
    '#ffffff': 'белый', '#f3eadc': 'молочный', '#e5c5c4': 'пудровый',
    '#b7202d': 'красный', '#6b1f2d': 'бордовый', '#0c6a4f': 'изумрудный',
    '#6f754e': 'оливковый', '#86b9ca': 'голубой', '#274d83': 'синий',
    '#9b8db5': 'лавандовый', '#8e8d89': 'серый', transparent: 'прозрачный',
  })[String(value).toLowerCase()] || 'по расчёту';
  function label(item) {
    const config = item.configuration || {};
    if (item.productType === 'ribbon') {
      return 'Лента ' + config.widthMm + ' мм · ' + item.quantity.meters + ' м · основа ' +
        colorName(config.materialColor) + ' · печать ' + colorName(config.printColor);
    }
    const size = config.shape === 'circle' ? 'Ø ' + config.widthMm : config.widthMm + ' × ' + config.heightMm;
    return 'Стикеры ' + size + ' мм · ' + item.quantity.pieces +
      ' шт. · основа ' + colorName(config.backgroundColor) + ' · печать ' + colorName(config.printColor);
  }

  function render() {
    if (!root || !message || !list) return;
    root.hidden = !fromQuoteLink;
    if (!fromQuoteLink) return;
    root.dataset.status = status;
    progress.hidden = status !== 'ready';
    nextButton.hidden = status !== 'ready' || !editingItemId || reviewMode;
    jump.hidden = status !== 'ready' || !editingItemId;
    toggle.hidden = status !== 'ready';
    list.dataset.expanded = String(expanded);
    current.hidden = status !== 'ready';
    selector.hidden = status !== 'ready';
    selector.disabled = captureBusy || renewalBusy;
    selector.replaceChildren();
    steps.replaceChildren();
    steps.hidden = status !== 'ready';
    if (status === 'ready') {
      const selected = record.orderItems.find(item => item.itemId === editingItemId);
      current.textContent = selected
        ? 'Макет ' + (record.orderItems.indexOf(selected) + 1) + ' из ' + record.orderItems.length + ' · ' + label(selected)
        : 'Выберите изделие, чтобы открыть редактор';
      const placeholder = new Option('Выберите изделие', '');
      placeholder.disabled = true;
      selector.append(placeholder);
      record.orderItems.forEach((item, index) => {
        selector.append(new Option((index + 1) + '. ' + label(item) + (lineArtworks.has(item.itemId) ? ' · готово' : ''), item.itemId));
        const step = document.createElement('button');
        step.type = 'button';
        step.className = 'linked-quote-step';
        step.textContent = (index + 1) + (lineArtworks.has(item.itemId) ? ' ✓' : '');
        step.setAttribute('aria-label', 'Макет ' + (index + 1) + ': ' + label(item) + (lineArtworks.has(item.itemId) ? ', сохранён' : ''));
        step.setAttribute('aria-current', editingItemId === item.itemId ? 'step' : 'false');
        step.disabled = captureBusy || renewalBusy;
        step.addEventListener('click', () => {
          expanded = false;
          document.dispatchEvent(new CustomEvent('studio:quote-edit-item', {detail: {itemId: item.itemId, focusEditor: true}}));
        });
        steps.append(step);
      });
      selector.value = editingItemId || '';
    }
    toggle.setAttribute('aria-expanded', String(expanded));
    toggle.textContent = expanded ? 'Свернуть список' : 'Все изделия (' + (record?.orderItems.length || 0) + ')';
    nextButton.disabled = captureBusy || renewalBusy;
    if (status === 'ready') {
      progress.textContent = 'Готово макетов: ' + lineArtworks.size + ' из ' + record.orderItems.length;
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
    renderReview();
    if (status === 'loading') {
      message.textContent = 'Проверяем корзину калькулятора на сервере…';
    } else if (status === 'ready') {
      message.textContent =
        (record.expiresAt <= Date.now() / 1000
          ? 'Срок расчёта истёк. Нажмите «Продлить расчёт на 30 минут» перед отправкой заявки. '
          : '') +
        'Выберите изделие и создайте макет в редакторе. Предварительная стоимость: ' +
        safeNumber(record.finalClientPrice).toLocaleString('ru-RU') +
        ' ₽. Демонстрационные макеты-образцы не отправляются без вашего сохранения.' +
        (persistenceWarning ? ' ' + persistenceWarning : '') +
        (renewalMessage ? ' ' + renewalMessage : '');
      for (const item of record.orderItems) {
        const li = document.createElement('li');
        li.dataset.active = String(editingItemId === item.itemId);
        li.dataset.saved = String(lineArtworks.has(item.itemId));
        const details = document.createElement('span');
        details.textContent = (record.orderItems.indexOf(item) + 1) + '. ' + label(item);
        details.className = 'linked-quote-line-details';
        const stateLabel = document.createElement('small');
        stateLabel.className = 'linked-quote-line-status';
        stateLabel.textContent = editingItemId === item.itemId ? 'Редактируется' : lineArtworks.has(item.itemId) ? 'Макет сохранён' : 'Нужен макет';
        details.append(document.createElement('br'), stateLabel);
        const edit = document.createElement('button');
        edit.type = 'button';
        edit.className = 'button ghost';
        edit.textContent = editingItemId === item.itemId
          ? 'Редактируется эта позиция'
          : 'Редактировать эту позицию';
        edit.disabled = captureBusy || renewalBusy || editingItemId === item.itemId;
        edit.addEventListener('click', () => {
          expanded = false;
          document.dispatchEvent(new CustomEvent('studio:quote-edit-item', {
            detail: {itemId: item.itemId, focusEditor: true},
          }));
        });
        const capture = document.createElement('button');
        capture.type = 'button';
        capture.className = 'button ghost';
        capture.textContent = lineArtworks.has(item.itemId)
          ? 'Обновить макет позиции'
          : 'Сохранить текущий макет для позиции';
        capture.disabled = captureBusy || renewalBusy || editingItemId !== item.itemId;
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

  function renderReview() {
    review.hidden = !reviewMode || status !== 'ready';
    review.replaceChildren();
    if (review.hidden) return;
    const heading = document.createElement('h3');
    heading.textContent = 'Ваш заказ · ' + lineArtworks.size + ' из ' + record.orderItems.length + ' макетов готовы';
    review.append(heading);
    for (const [index, item] of record.orderItems.entries()) {
      const card = document.createElement('article');
      card.className = 'linked-quote-review-card';
      card.dataset.itemId = item.itemId;
      const artwork = lineArtworks.get(item.itemId);
      if (artwork?.previewPng.startsWith('data:image/png;base64,')) {
        const preview = document.createElement('img');
        preview.src = artwork.previewPng;
        preview.alt = 'Макет ' + (index + 1);
        card.append(preview);
      }
      const copy = document.createElement('div');
      const title = document.createElement('strong');
      title.textContent = (index + 1) + '. ' + label(item);
      const state = document.createElement('small');
      state.textContent = artwork ? 'Макет сохранён' : 'Нужен макет';
      copy.append(title, state);
      const edit = document.createElement('button');
      edit.type = 'button';
      edit.className = 'button ghost';
      edit.textContent = 'Редактировать';
      edit.addEventListener('click', () => document.dispatchEvent(new CustomEvent('studio:quote-edit-item', {detail: {itemId: item.itemId, focusEditor: true}})));
      card.append(copy, edit);
      review.append(card);
    }
    const total = document.createElement('p');
    total.className = 'linked-quote-review-total';
    total.textContent = 'Предварительная стоимость: ' + safeNumber(record.finalClientPrice).toLocaleString('ru-RU') + ' ₽';
    review.append(total);
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
    setCaptureBusy: (value) => { captureBusy = value; render(); },
    getCaptureBusy: () => captureBusy,
    focusEditor,
    placeSaveAction: (panel) => {
      if (!fromQuoteLink) return;
      reviewMode = panel === 'order';
      nextButton.hidden = status !== 'ready' || !editingItemId || reviewMode;
      renderReview();
      const target = document.getElementById('panel-' + panel);
      if (!fromQuoteLink || !target || panel === 'order') {
        if (root && list) list.after(nextButton);
        return;
      }
      target.append(nextButton);
    },
    nextIncompleteItem: () => {
      if (!record) return null;
      const index = record.orderItems.findIndex(item => item.itemId === editingItemId);
      const ordered = [...record.orderItems.slice(index + 1), ...record.orderItems.slice(0, index + 1)];
      return ordered.find(item => !lineArtworks.has(item.itemId))?.itemId ?? null;
    },
    isComplete: () => status === 'ready' && record !== null && lineArtworks.size === record.orderItems.length,
    isLinked: () => fromQuoteLink,
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
