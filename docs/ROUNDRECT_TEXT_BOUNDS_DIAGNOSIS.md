# Диагностика границ текста в прямоугольном стикере 80×20 мм

## Итог

Проблема не в том, что 2,5 мм отступы рассчитаны неверно. Для прямоугольного стикера 80×20 мм код корректно строит наружную форму и printable bounds размером 75×15 мм. Проблема в том, что после расчёта printable bounds текущий layout применяет дополнительные ограничения композиции и не даёт пользователю управлять фактическим размером видимого начертания.

> **Единственная обязательная непечатаемая зона должна быть 2,5 мм от каждого края.** Всё, что находится внутри области 75×15 мм, должно быть доступно для позиционирования и масштабирования пользователем, если конкретное содержание физически помещается в эту область.

## Что является правильным

В `geometry.js` используется `PRINT_MARGIN_MM = 2.5`. Для `roundrect-80x20` вычисляются:

| Параметр | Значение |
| --- | ---: |
| Наружный размер | 80×20 мм |
| Радиус наружных углов | 2 мм |
| Левый/правый отступ | 2,5 мм |
| Верхний/нижний отступ | 2,5 мм |
| Printable width | 75 мм |
| Printable height | 15 мм |
| Printable guide radius | 0 мм |

Нулевой радиус внутреннего guide объясним: радиус наружной формы 2 мм меньше отступа 2,5 мм, поэтому внутри печатной области безопасная граница становится прямоугольной. Это не дополнительный inset.

## Подтверждённые причины визуально маленького текста

### 1. Алгоритм умеет только уменьшать текст

В `layout.js`, внутри `fitTextToArea`, scale ограничен сверху единицей:

```js
const scale = Math.min(1, widthScale, heightScale);
```

Следствие: короткая надпись никогда не увеличивается выше `preferredSize`, даже если в printable rectangle остаётся много свободного места. Алгоритм защищает от переполнения, но не решает обратную задачу — заполнение доступного пространства.

### 2. Пользовательский размер шрифта ограничен 16–64

В `index.html` slider объявлен как `min="16" max="64"`. В `app.js` `normalizeProductStyle` повторно принудительно ограничивает сохранённое значение тем же диапазоном. Поэтому даже ручное управление не может увеличить короткую надпись настолько, чтобы использовать доступные 75×15 мм.

`minFontSize: 4` для roundrect — это только нижняя граница аварийного уменьшения длинного текста. Она не расширяет верхнюю границу и не делает текст printable-area-aware.

### 3. Logo+text использует скрытую композиционную зону

В `getRibbonContentLayout` для logo+text применяются эвристики:

- до 72% printable width резервируется под логотип;
- добавляется gap 4% ширины;
- оставшаяся ширина текста дополнительно умножается на 0,94.

Это не печатные поля. Это внутренний дизайнерский layout, но в интерфейсе он не обозначен как отдельная настраиваемая композиционная зона. Поэтому пользователь воспринимает его как необъяснимое уменьшение доступной области.

### 4. Layout box не равен видимому ink bounds

SVG `<text>` позиционируется через `dominant-baseline: middle`. Расчёт использует `getBBox()`/Canvas metrics, однако реальный видимый ink footprint зависит от side bearings, ascender/descender и особенностей выбранного шрифта. Поэтому даже textBox, совпадающий с printable bounds математически, визуально не обязан касаться его краёв.

Валидация должна различать layout box и фактический glyph ink bounds после загрузки шрифта.

### 5. Safe guide не является причиной, но название вводит в заблуждение

`stickerPrintableGuide` рисуется непосредственно по `geometry.bounds`. Он не добавляет вторую геометрическую границу. Однако подпись «Показывать безопасную область» может создавать ощущение, что существует ещё одна внутренняя зона. Для пользователя нужно явно назвать её «Границы печати · отступ 2,5 мм» и показать, что внутри неё разрешено всё позиционирование.

## Ошибка в текущем пользовательском контракте

Сейчас интерфейс обещает ручное расположение, но фактически даёт только generic offset sliders `-100..100` и общий font-size slider. Он не даёт:

- понятного масштаба относительно printable area;
- действия «Заполнить печатную область»;
- регулируемого logo/text gap;
- проверки именно видимого ink bounds;
- объяснения, какая зона является обязательной, а какая — дизайнерской эвристикой.

## Рекомендуемый исправленный контракт

Auto mode должен создавать читаемую стартовую композицию, но иметь явное действие «Заполнить печатную область». Для text-only это означает масштабирование до максимально допустимого размера по ширине или высоте printable rectangle. Для logo+text доля логотипа и gap должны быть либо настраиваемыми, либо честно обозначенными как стартовая композиция.

Manual mode должен управлять реальным содержимым внутри printable bounds: размером текста, положением текста, размером/положением логотипа и расстоянием между ними. Ограничение должно быть только одно: фактический ink bounds не выходит за 75×15 мм. При достижении границы UI должен показать clamp/status, а не молча оставлять пользователя в меньшей зоне.

## Что не следует делать

Не следует просто убрать 2,5 мм отступы, расширить наружный guide или отключить clipping. Это нарушит заявленные печатные поля. Не следует также бездумно растягивать каждый текст до всех 75 мм: для logo+text и коротких слов это может ухудшить визуальную композицию. Нужен прозрачный режим стартовой композиции плюс явный пользовательский контроль.

## Статус

Диагностика завершена. Production код не изменялся. Следующий шаг — согласовать и реализовать roundrect printable-control contract локально, добавить ink-bound regressions и только после этого планировать staged deployment.

## Live verification after PR #60

Production correctly serves the new `app.js?v=871079993dbf`, but still serves `layout.js?v=d3d2d02fa443`, which is the previous cache version. The live serialized roundrect text-only layout is valid and has a textBox width equal to the printable width, but the visual preview is still not a trustworthy final verification of the new layout until the current layout.js hash is published. This is a cache-busting deployment gap, not a geometry conclusion. The next staged correction must update the layout.js hash, rerun CI, and deploy again before live UX verification.

## Final live asset verification

After PR #61, production serves both current hashes: `layout.js?v=191dd813439d` and `app.js?v=871079993dbf`. The serialized roundrect text-only layout is valid; its normalized textBox width is `0.9375`, exactly equal to normalized printable width `0.9375`, and its height is `0.1669` versus printable height `0.1875`. This confirms that the text-only auto layout now uses the full printable width while remaining inside the 2.5 mm bounds.

The sandbox browser upload helper could not attach the local SVG to the hidden production file input, so the final production logo+text check is covered by the local Playwright regression (including maximum printable-height logo and independent opposite-direction manual placement) rather than a live uploaded asset. No order was submitted.

## Traced-logo and vertical-text correction

The reproduced automatic tracing output contained an invisible opacity-zero rectangle in the SVG path list and retained a larger `46×48` viewBox while visible artwork occupied approximately `1..45 × 1..47`. The layout therefore filled the printable logo box with the full viewBox, not the visible artwork. The tracing commit now removes invisible paths from the ink-bounds measurement clone and tightens the traced SVG viewBox before it is persisted.

A second independent issue affected text. Width fitting selected the largest proportional font that fit the horizontal line, leaving visible glyph height at roughly 56% of the 15 mm printable height. Roundrect now stores `textScaleY`; auto mode expands the text vertically to the available printable height, while manual mode exposes a dedicated vertical text scale control and keeps the resulting box clamped to the exact printable bounds. Desktop SVG and mobile HTML previews use the same scale value.
