'use strict';

// An optional bearer-token handoff. The browser never reads private costs or
// treats the calculator's preliminary amount as an approved order total.
(() => {
  const token = new URLSearchParams(location.hash.slice(1)).get('quote');
  const fromQuoteLink = token !== null;
  if (fromQuoteLink) {
    // Keep the token out of navigation history, copied URLs, and analytics.
    history.replaceState(history.state, '', location.pathname + location.search);
  }
  let status = fromQuoteLink ? 'loading' : 'none';
  let record = null;
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
        'Перенесены все ' + record.orderItems.length + ' позиций. Предварительная стоимость: ' +
        safeNumber(record.finalClientPrice).toLocaleString('ru-RU') +
        ' ₽. Ниже создаются макеты-образцы (по одному на тип), а каждый отдельный тираж и макет согласует Максим до производства.';
      for (const item of record.orderItems) {
        const li = document.createElement('li');
        li.textContent = label(item);
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
    getState: () => status,
    getItems: () => record === null ? [] : structuredClone(record.orderItems),
  });
  render();
  void load();
})();
