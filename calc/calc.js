'use strict';
const $ = (id) => document.getElementById(id);
const palette = {
  '#f3eadc': 'Молочный', '#ffffff': 'Белый', '#e5c5c4': 'Пудровый',
  '#b7202d': 'Красный', '#6b1f2d': 'Бордовый', '#0c6a4f': 'Изумрудный',
  '#6f754e': 'Оливковый', '#86b9ca': 'Голубой', '#274d83': 'Синий',
  '#9b8db5': 'Лавандовый', '#8e8d89': 'Серый', '#171717': 'Чёрный',
  '#b69249': 'Золото', '#c6c8cd': 'Серебро', transparent: 'Прозрачный',
};
const MAX_PER_TYPE = 3;
const MAX_ITEMS = 6;
const MAX_QUANTITY = 100000;
const QUANTITIES = {
  ribbon: {
    min: 5, step: 5, unit: 'м', title: 'Метраж ленты',
    presets: [5, 10, 15, 25, 50, 100, 200], defaultValue: 25,
    message: 'Укажите метраж от 5 м с шагом 5 м (например, 135 или 140 м).',
  },
  sticker: {
    min: 50, step: 50, unit: 'шт.', title: 'Количество стикеров',
    presets: [50, 100, 250, 500, 1000], defaultValue: 250,
    message: 'Укажите количество от 50 шт. с шагом 50 шт. (например, 700 или 750 шт.).',
  },
};
let catalog = [], sequence = 0, version = 0, quoteTimer = null;
let quotedPrice = null;
let tipTimer = null;
let tipToken = 0;
let tipTarget = null;
const volumeQuoteCache = new Map();
let volumeRequests = 0;
const MAX_VOLUME_REQUESTS = 12;
function setResult(text) {
  $('result').textContent = text;
  $('mobileTotal').textContent = text;
}
function hideVolumeTip() {
  tipToken++;
  if (tipTimer !== null) clearTimeout(tipTimer);
  tipTimer = null;
  tipTarget = null;
  $('volumeTip').hidden = true;
}

const rows = () => [...$('lines').children];
const setQuoteReady = (ready) => { $('quoteActions').hidden = !ready; };
function productLabel(type) { return type === 'ribbon' ? 'Сатиновая лента' : 'Стикеры'; }
function renderItemCount() {
  const count = rows().length;
  $('itemCount').textContent = `${count} ${count === 1 ? 'позиция' : count >= 2 && count <= 4 ? 'позиции' : 'позиций'}`;
  $('emptyCart').hidden = count > 0;
  $('exampleIntro').textContent = count === 0 ? 'Добавьте ленты или стикеры, чтобы получить стоимость.' : 'Меняйте материалы, количество и состав — стоимость пересчитается автоматически.';
  // Manual submit is shown only as an error-recovery action.
  $('quotePanel').hidden = count === 0;
  $('mobileTotalBar').hidden = count === 0;
}
function collapseLine(row, collapsed) {
  const editor = row.querySelector('.line-editor');
  const toggle = row.querySelector('.line-toggle');
  if (!editor || !toggle) return;
  editor.hidden = collapsed;
  row.classList.toggle('is-collapsed', collapsed);
  toggle.setAttribute('aria-expanded', String(!collapsed));
  toggle.textContent = collapsed ? 'Изменить' : 'Свернуть';
}
function summaryForLine(row) {
  const get = key => row.querySelector(`[data-key="${key}"]`)?.value || '';
  const quantity = get('quantity');
  const dimension = row.dataset.type === 'ribbon' ? get('geometry') : geom(get('geometry'));
  const quantityUnits = row.dataset.type === 'ribbon' ? 'м' : 'шт.';
  return `${dimension} · ${color(get('base'))} · ${color(get('print'))} · ${quantity} ${quantityUnits}`;
}
function renderRowSummaries() {
  rows().forEach(row => {
    const label = row.querySelector('.line-summary');
    if (label) label.textContent = summaryForLine(row);
  });
  renderItemCount();
}
function specText() {
  if (quotedPrice === null) return '';
  const details = rows().map((row, index) => {
    const get = key => row.querySelector(`[data-key="${key}"]`).value;
    const ribbon = row.dataset.type === 'ribbon';
    return `${index + 1}. ${productLabel(row.dataset.type)}; ${ribbon ? 'ширина ' + get('geometry') : geom(get('geometry'))}; основа: ${color(get('base'))}; нанесение: ${color(get('print'))}; количество: ${get('quantity')} ${ribbon ? 'м' : 'шт.'}`;
  });
  return ['Печатает Максим · предварительный расчёт', ...details, `ИТОГО: ${quotedPrice}`, 'Стоимость, наличие материалов и сроки требуют подтверждения. Это не оформленный заказ.', 'Источник: печатаетмаксим.рф/calc/'].join('\n');
}
function updateStudioLink() {
  const types = new Set(rows().map(row => row.dataset.type));
  const kind = types.size > 1 ? 'bundle' : types.has('sticker') ? 'sticker' : 'ribbon';
  $('studioNext').href = `/studio/?product=${kind}`;
}
const newId = () => `item-${Date.now().toString(36)}-${(++sequence).toString(36)}`;
const color = (c) => palette[c] || c;
const geom = (g) => g === 'roundrect-80x20' ? '80 × 20 мм · R2' : g.startsWith('circle-') ? 'Ø' + g.slice(7) + ' мм' : g;

function select(label, parent) {
  const l = document.createElement('label');
  l.textContent = label;
  const s = document.createElement('select');
  l.append(s);
  parent.append(l);
  return s;
}
function options(s, arr, format) {
  const prev = s.value;
  s.replaceChildren(...arr.map(v => {
    const o = document.createElement('option');
    o.value = v;
    o.textContent = format(v);
    return o;
  }));
  if (arr.includes(prev)) s.value = prev;
}
function validQuantity(text, type) {
  const rule = QUANTITIES[type];
  if (!/^[1-9][0-9]{0,5}$/.test(text)) return false;
  const value = Number(text);
  return Number.isSafeInteger(value) && value >= rule.min && value <= MAX_QUANTITY && value % rule.step === 0;
}
function firstInvalidQuantity() {
  return [...$('lines').children].find(row => {
    const input = row.querySelector('[data-key="quantity"]');
    return !validQuantity(input.value, row.dataset.type);
  });
}
function syncAddButtons() {
  for (const type of ['ribbon', 'sticker']) {
    $(type).disabled = !catalog.some(offer => offer.type === type) || [...$('lines').children].filter(e => e.dataset.type === type).length >= MAX_PER_TYPE;
  }
}
function invalidate() {
  hideVolumeTip();
  syncAddButtons();
  $('clientComposition').hidden = true;
  $('quote').hidden = true;
  $('clientCompositionList').replaceChildren();
  quotedPrice = null;
  setQuoteReady(false);
  $('shareStatus').textContent = '';
  renderRowSummaries();
  updateStudioLink();
  version++;
  if (quoteTimer !== null) clearTimeout(quoteTimer);
  quoteTimer = null;
  const invalid = firstInvalidQuantity();
  $('quote').disabled = !catalog.length || !$('lines').children.length || !!invalid;
  $('message').textContent = invalid ? QUANTITIES[invalid.dataset.type].message : '';
  if (invalid || !catalog.length || !$('lines').children.length) {
    setResult('—');
    return;
  }
  setResult('Обновляем…');
  quoteTimer = setTimeout(() => $('calc').requestSubmit(), 420);
}
function createQuantityField(type, id, initial, fields) {
  const rule = QUANTITIES[type];
  const wrapper = document.createElement('div');
  wrapper.className = 'quantity-field';
  const heading = document.createElement('div');
  heading.className = 'quantity-heading';
  const label = document.createElement('label');
  label.htmlFor = id + '-quantity';
  label.textContent = rule.title;
  const stepNote = document.createElement('small');
  stepNote.textContent = `Шаг ${rule.step} ${rule.unit}`;
  heading.append(label, stepNote);

  const controls = document.createElement('div');
  controls.className = 'quantity-controls';
  const minus = document.createElement('button');
  minus.type = 'button';
  minus.className = 'quantity-adjust';
  minus.dataset.quantityAction = 'minus';
  minus.textContent = '−';
  minus.setAttribute('aria-label', `Уменьшить ${rule.title.toLowerCase()} на ${rule.step} ${rule.unit}`);
  const input = document.createElement('input');
  input.type = 'text'; // No small native browser number spinners.
  input.inputMode = 'numeric';
  input.pattern = '[0-9]*';
  input.maxLength = 6;
  input.autoComplete = 'off';
  input.id = id + '-quantity';
  input.dataset.key = 'quantity';
  input.value = String(initial ?? rule.defaultValue);
  input.setAttribute('aria-describedby', id + '-quantity-hint');
  const unit = document.createElement('span');
  unit.className = 'quantity-unit';
  unit.textContent = rule.unit;
  const plus = document.createElement('button');
  plus.type = 'button';
  plus.className = 'quantity-adjust';
  plus.dataset.quantityAction = 'plus';
  plus.textContent = '+';
  plus.setAttribute('aria-label', `Увеличить ${rule.title.toLowerCase()} на ${rule.step} ${rule.unit}`);
  const inputShell = document.createElement('div');
  inputShell.className = 'quantity-input-shell';
  inputShell.append(input, unit);
  controls.append(minus, inputShell, plus);

  const presets = document.createElement('div');
  presets.className = 'quantity-presets';
  presets.setAttribute('role', 'group');
  presets.setAttribute('aria-label', `Быстрый выбор: ${rule.title.toLowerCase()}`);
  const presetButtons = rule.presets.map(amount => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'quantity-preset';
    button.dataset.quantityPreset = String(amount);
    button.textContent = `${amount} ${rule.unit}`;
    button.setAttribute('aria-pressed', 'false');
    presets.append(button);
    return button;
  });
  const hint = document.createElement('p');
  hint.id = id + '-quantity-hint';
  hint.className = 'quantity-hint';
  hint.setAttribute('aria-live', 'polite');

  let lastValid = rule.defaultValue;
  function refresh() {
    const ok = validQuantity(input.value, type);
    const number = Number(input.value);
    input.setAttribute('aria-invalid', String(!ok));
    if (ok) lastValid = number;
    hint.textContent = ok ? `Любое количество от ${rule.min} ${rule.unit}, кратное ${rule.step}.` : rule.message;
    hint.classList.toggle('is-error', !ok);
    minus.disabled = lastValid <= rule.min;
    plus.disabled = lastValid >= MAX_QUANTITY;
    for (const button of presetButtons) {
      const selected = ok && Number(button.dataset.quantityPreset) === number;
      button.classList.toggle('is-active', selected);
      button.setAttribute('aria-pressed', String(selected));
    }
  }
  function setAmount(amount) {
    if (amount < rule.min || amount > MAX_QUANTITY) return;
    input.value = String(amount);
    refresh();
    invalidate();
  }
  input.addEventListener('input', () => { refresh(); invalidate(); });
  minus.addEventListener('click', () => setAmount(lastValid - rule.step));
  plus.addEventListener('click', () => setAmount(lastValid + rule.step));
  for (const button of presetButtons) {
    button.addEventListener('click', () => setAmount(Number(button.dataset.quantityPreset)));
  }
  wrapper.append(heading, controls, presets, hint);
  fields.append(wrapper);
  refresh();
  return input;
}
function add(type, initial = null) {
  if (!catalog.some(offer => offer.type === type)) return;
  if ($('lines').children.length >= MAX_ITEMS || [...$('lines').children].filter(e => e.dataset.type === type).length >= MAX_PER_TYPE) return;
  const ribbon = type === 'ribbon';
  const id = initial?.itemId || newId();
  const row = document.createElement('section');
  row.className = 'line';
  row.id = id;
  row.dataset.type = type;
  const head = document.createElement('div');
  head.className = 'line-head';
  const title = document.createElement('strong');
  title.textContent = ribbon ? 'Сатиновая лента' : 'Стикеры';
  const remove = document.createElement('button');
  remove.type = 'button';
  remove.textContent = 'Удалить';
  remove.onclick = () => { row.remove(); const first = rows()[0]; if (first && rows().every(item => item.classList.contains('is-collapsed'))) collapseLine(first, false); invalidate(); };
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'line-toggle';
  toggle.textContent = 'Свернуть';
  toggle.setAttribute('aria-expanded', 'true');
  toggle.setAttribute('aria-controls', id + '-editor');
  toggle.addEventListener('click', () => {
    const wasCollapsed = row.classList.contains('is-collapsed');
    if (wasCollapsed) rows().forEach(other => collapseLine(other, true));
    collapseLine(row, !wasCollapsed);
  });
  const summary = document.createElement('p');
  summary.className = 'line-summary';
  const buttons = document.createElement('div');
  buttons.className = 'line-tools';
  buttons.append(toggle, remove);
  head.append(title, buttons);
  row.append(head, summary);
  const editor = document.createElement('div');
  editor.className = 'line-editor';
  editor.id = id + '-editor';
  row.append(editor);
  const fields = document.createElement('div');
  fields.className = 'fields';
  editor.append(fields);
  const g = select(ribbon ? 'Ширина' : 'Формат', fields);
  const b = select('Основа', fields);
  const p = select('Нанесение', fields);
  g.dataset.key = 'geometry';
  b.dataset.key = 'base';
  p.dataset.key = 'print';
  const list = catalog.filter(x => x.type === type);
  const unique = a => [...new Set(a)];
  const sample = document.createElement('div');
  sample.className = 'mini-preview';
  const figure = document.createElement('span');
  figure.className = 'mini-preview-figure ' + (ribbon ? 'is-ribbon' : 'is-sticker');
  figure.setAttribute('aria-hidden', 'true');
  figure.textContent = 'печатает максим';
  const hint = document.createElement('small');
  hint.textContent = 'Схематичный образец сочетания. Реальный цвет и ваш логотип уточняются при согласовании.';
  sample.append(figure, hint);
  editor.append(sample);
  const paint = () => {
    const bg = b.value;
    figure.style.backgroundColor = bg === 'transparent' ? '#fff' : bg;
    figure.style.color = p.value || '#171717';
    figure.classList.toggle('is-transparent', bg === 'transparent');
    figure.classList.toggle('is-rect', !ribbon && g.value === 'roundrect-80x20');
    figure.classList.toggle('is-silver', p.value === '#c6c8cd');
  };
  options(g, unique(list.map(x => x.geometry)), geom);
  const updatePrint = () => { options(p, unique(list.filter(x => x.geometry === g.value && x.base === b.value).map(x => x.print)), color); paint(); };
  const updateBase = () => { options(b, unique(list.filter(x => x.geometry === g.value).map(x => x.base)), color); updatePrint(); };
  g.onchange = () => { updateBase(); invalidate(); };
  b.onchange = () => { updatePrint(); invalidate(); };
  p.onchange = () => { paint(); invalidate(); };
  updateBase();
  if (initial) {
    const c = initial.configuration || {};
    const v = ribbon ? String(c.widthMm) + ' mm' : c.variantId;
    if ([...g.options].some(o => o.value === v)) { g.value = v; updateBase(); }
    const base = ribbon ? c.materialColor : c.backgroundColor;
    if ([...b.options].some(o => o.value === base)) { b.value = base; updatePrint(); }
    if ([...p.options].some(o => o.value === c.printColor)) p.value = c.printColor;
    paint();
  }
  createQuantityField(type, id, initial ? String(ribbon ? initial.quantity?.meters : initial.quantity?.pieces) : null, fields);
  rows().forEach(previous => collapseLine(previous, true));
  $('lines').append(row);
  renderRowSummaries();
  invalidate();
}
function order() {
  return [...$('lines').children].map(row => {
    const get = k => row.querySelector('[data-key="' + k + '"]').value;
    const ribbon = row.dataset.type === 'ribbon';
    const g = get('geometry'), b = get('base'), p = get('print');
    const rect = g === 'roundrect-80x20', d = Number(g.slice(7));
    return {
      itemId: row.id, productType: row.dataset.type,
      quantity: ribbon ? { meters: get('quantity') } : { pieces: get('quantity') },
      configuration: ribbon
        ? { widthMm: parseInt(g, 10), repeatMm: 100, materialColor: b, printColor: p }
        : { variantId: g, shape: rect ? 'roundrect' : 'circle', widthMm: rect ? 80 : d, heightMm: rect ? 20 : d, cornerRadiusMm: rect ? 2 : null, printColor: p, backgroundColor: b },
    };
  });
}
function renderClientComposition() {
  const target = $('clientCompositionList');
  target.replaceChildren();
  [...$('lines').children].forEach((line, i) => {
    const get = k => line.querySelector('[data-key="' + k + '"]').value;
    const ribbon = line.dataset.type === 'ribbon';
    const item = document.createElement('li');
    item.className = 'composition-row';
    const meta = document.createElement('div');
    meta.className = 'composition-copy';
    const title = document.createElement('strong');
    title.textContent = (i + 1).toString().padStart(2, '0') + ' · ' + (ribbon ? 'Сатиновая лента' : 'Стикер');
    const detail = document.createElement('span');
    detail.textContent = (ribbon ? 'Ширина ' + get('geometry') : geom(get('geometry'))) + ' · ' + color(get('base')) + ' · ' + color(get('print')) + ' нанесение';
    const quantity = document.createElement('b');
    quantity.textContent = get('quantity') + (ribbon ? ' м' : ' шт.');
    meta.append(title, detail);
    item.append(meta, quantity);
    target.append(item);
  });
  $('clientComposition').hidden = false;
}

async function customerQuoteForItem(item) {
  const key = JSON.stringify({ productType: item.productType, configuration: item.configuration, quantity: item.quantity });
  if (volumeQuoteCache.has(key)) return volumeQuoteCache.get(key);
  if (volumeRequests >= MAX_VOLUME_REQUESTS) return null;
  volumeRequests++;
  const reply = await fetch('/api/calc/', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderItems: [item] }),
  });
  if (!reply.ok) return null;
  const data = await reply.json();
  if (data.status !== 'estimate' || data.canSubmitOrder !== false) return null;
  const price = Number(data.finalClientPrice);
  const result = Number.isFinite(price) && price > 0 ? price : null;
  if (result !== null) volumeQuoteCache.set(key, result);
  return result;
}
async function computeVolumeTip(versionAtStart, token) {
  if (versionAtStart !== version || token !== tipToken || quotedPrice === null) return;
  const line = rows().find(row => {
    const value = Number(row.querySelector('[data-key="quantity"]').value);
    const rule = QUANTITIES[row.dataset.type];
    return validQuantity(String(value), row.dataset.type) && rule.presets.some(x => x > value);
  });
  if (!line) return;
  const type = line.dataset.type;
  const rule = QUANTITIES[type];
  const currentQty = Number(line.querySelector('[data-key="quantity"]').value);
  const nextQty = rule.presets.find(x => x > currentQty);
  const item = order().find(x => x.itemId === line.id);
  if (!item || !nextQty) return;
  const increased = structuredClone(item);
  if (type === 'ribbon') increased.quantity.meters = String(nextQty);
  else increased.quantity.pieces = String(nextQty);
  try {
    const [currentPrice, morePrice] = await Promise.all([
      customerQuoteForItem(item), customerQuoteForItem(increased),
    ]);
    if (token !== tipToken || versionAtStart !== version || !currentPrice || !morePrice) return;
    // No synthetic discounts: compare only real, separately priced client quotes.
    if (morePrice <= currentPrice) return;
    const reduction = (1 - (morePrice / nextQty) / (currentPrice / currentQty)) * 100;
    if (reduction < 5 || reduction >= 100) return;
    tipTarget = { rowId: line.id, qty: nextQty };
    const name = type === 'ribbon' ? 'ленты за метр' : 'стикера за штуку';
    $('volumeTipText').textContent = `При ${nextQty} ${rule.unit} средняя цена ${name} ниже примерно на ${Math.floor(reduction)}% по отдельному расчёту.`;
    $('volumeTipApply').textContent = `Выбрать ${nextQty} ${rule.unit}`;
    $('volumeTip').hidden = false;
  } catch {
    // Marketing comparison is optional. It must never block the main quote.
  }
}
function scheduleVolumeTip(versionAtStart) {
  const token = tipToken;
  tipTimer = setTimeout(() => {
    tipTimer = null;
    void computeVolumeTip(versionAtStart, token);
  }, 950);
}
$('volumeTipApply').addEventListener('click', () => {
  if (!tipTarget) return;
  const line = document.getElementById(tipTarget.rowId);
  const input = line?.querySelector('[data-key="quantity"]');
  if (!input) return;
  input.value = String(tipTarget.qty);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  collapseLine(line, false);
});

$('ribbon').onclick = () => add('ribbon');
$('sticker').onclick = () => add('sticker');
$('calc').onsubmit = async e => {
  e.preventDefault();
  if (quoteTimer !== null) { clearTimeout(quoteTimer); quoteTimer = null; }
  if (firstInvalidQuantity()) { invalidate(); firstInvalidQuantity().querySelector('[data-key="quantity"]').focus(); return; }
  const v = ++version;
  setResult('Считаем…');
  $('message').textContent = '';
  $('quote').disabled = true;
  try {
    const reply = await fetch('/api/calc/', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderItems: order() }) });
    const j = await reply.json();
    if (!reply.ok || j.status !== 'estimate' || j.canSubmitOrder !== false) throw Error(j.code || 'QUOTE');
    if (v === version) {
      const parsed = Number(j.finalClientPrice);
      if (!Number.isFinite(parsed) || parsed <= 0) throw Error('INVALID_PRICE');
      setResult(parsed.toLocaleString('ru-RU') + ' ₽');
      renderClientComposition();
      quotedPrice = $('result').textContent;
      setQuoteReady(true);
      $('quote').hidden = true;
      scheduleVolumeTip(v);
    }
  } catch (e) {
    if (v === version) {
      $('clientComposition').hidden = true;
      setQuoteReady(false);
      setResult('—');
      $('message').textContent = 'Расчёт сейчас недоступен. Попробуйте повторить или обратитесь к нам.';
      $('quote').hidden = false;
      $('quote').innerHTML = 'Повторить расчёт <span aria-hidden="true">↗</span>';
    }
  } finally {
    if (v === version) $('quote').disabled = false;
  }
};
(async () => {
  try {
    const r = await fetch('/api/calc/');
    const j = await r.json();
    // The assortment changes as materials receive technical approval; never pin it to 124.
    if (!r.ok || j.status !== 'catalog' || !Array.isArray(j.offers) || !j.offers.length ||
        !j.offers.every(offer => offer && ['ribbon', 'sticker'].includes(offer.type) &&
          ['geometry', 'base', 'print'].every(key => typeof offer[key] === 'string' && offer[key].length > 0))) {
      throw Error('CATALOG');
    }
    catalog = j.offers;
    $('ribbon').disabled = $('sticker').disabled = false;
    $('catalogMessage').textContent = 'Пример загружен. Можно изменить любой параметр или убрать изделие.';
    const hasRibbon = catalog.some(x => x.type === 'ribbon' && x.geometry === '15 mm' && x.base === '#f3eadc' && x.print === '#171717');
    const hasSticker = catalog.some(x => x.type === 'sticker' && x.geometry === 'circle-25' && x.base === '#171717' && x.print === '#b69249');
    const ribbon = catalog.find(x => x.type === 'ribbon' && x.geometry === '15 mm' && x.base === '#f3eadc' && x.print === '#171717') || catalog.find(x => x.type === 'ribbon');
    const sticker = catalog.find(x => x.type === 'sticker' && x.geometry === 'circle-25' && x.base === '#171717' && x.print === '#b69249') || catalog.find(x => x.type === 'sticker');
    if (ribbon) add('ribbon', { quantity: { meters: 25 }, configuration: { widthMm: parseInt(ribbon.geometry, 10), materialColor: ribbon.base, printColor: ribbon.print } });
    if (sticker) add('sticker', { quantity: { pieces: 250 }, configuration: { variantId: sticker.geometry, backgroundColor: sticker.base, printColor: sticker.print } });
    if (ribbon && sticker) { collapseLine(rows()[1], true); collapseLine(rows()[0], false); }
    if (!hasRibbon || !hasSticker) $('catalogMessage').textContent = 'Пример собран из доступных материалов. Любой параметр можно изменить.';
    syncAddButtons();
  } catch (e) {
    setResult('—');
    $('message').textContent = 'Каталог временно недоступен. Пожалуйста, зайдите позднее.';
    $('catalogMessage').textContent = 'Не удалось загрузить каталог. Проверьте подключение и откройте страницу снова.';
    $('catalogMessage').classList.add('is-error');
    $('itemCount').textContent = '0 позиций';
  }
})();

// Marketing hand-off: only customer-visible composition and the final quote are shared.
$('copySpec').addEventListener('click', async () => {
  const text = specText();
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    $('shareStatus').textContent = 'Комплектация и итоговая стоимость скопированы.';
  } catch {
    const fallback = document.createElement('textarea');
    fallback.value = text;
    fallback.setAttribute('readonly', '');
    fallback.style.position = 'fixed';
    fallback.style.opacity = '0';
    document.body.append(fallback);
    fallback.select();
    const ok = document.execCommand('copy');
    fallback.remove();
    $('shareStatus').textContent = ok ? 'Комплектация и итоговая стоимость скопированы.' : 'Автоматическое копирование недоступно. Попробуйте открыть Telegram.';
  }
});
$('shareTelegram').addEventListener('click', () => {
  const text = specText();
  if (!text) return;
  const url = `https://t.me/share/url?url=${encodeURIComponent('https://печатаетмаксим.рф/calc/')}&text=${encodeURIComponent(text)}`;
  window.open(url, '_blank', 'noopener,noreferrer');
  $('shareStatus').textContent = 'В Telegram выберите чат и отправьте комплектацию нам. Если окно не открылось, воспользуйтесь кнопкой копирования.';
});
