# Технический аудит проекта «Печатает Максим»

**Дата аудита:** 16 сентября 2026 года  
**Ветка и revision:** `main`, `7c3fe67`  
**Репозиторий:** [9627997/pechataet-maksim-site][1]

## Итог

Проект уже имеет сильную основу: статическая посадочная страница, отдельная Studio, production-SVG, локальный fallback заявки, PHP-приёмник с idempotency key и набор автоматических проверок. Сборка deployment artifact проходит, локальные проверки smart crop, trace mask и PHP-приёмника проходят.

Главные проблемы находятся не в базовой архитектуре, а в трёх практических зонах:

1. **Мобильный UX Studio содержит воспроизводимый блокирующий дефект.** На шаге создания стикера предпросмотр перекрывает picker форм и перехватывает pointer events. Один smoke-тест падает на ширине 390 px.
2. **Безопасность обработки PDF и SVG требует усиления до production.** Прямой `pdfjs-dist@6.1.200` попадает под advisory на выполнение JavaScript в malicious PDF. Серверная SVG-проверка блокирует несколько строковых маркеров, но не является полноценной санитизацией XML/SVG.
3. **Качество CI зависит от внешнего состояния окружения.** Первый `check:pr` дал 58 ложных падений из-за отсутствующего Chromium. После установки браузера результат стал полезным: 55 тестов прошли, 1 упал, 2 были пропущены.

Рабочее дерево после анализа осталось без изменений. Commit и push не выполнялись.

## Проверки

| Проверка | Результат | Комментарий |
|---|---:|---|
| `npm ci --ignore-scripts` | Пройдена | Установлено 137 пакетов; npm сообщил о 3 уязвимостях: 1 moderate и 2 high. |
| `npm run check:fast` | Пройдена | Изменённых отслеживаемых файлов нет. |
| `prettier --check` | Пройдена | Форматирование проверенных файлов корректно. |
| ESLint | Пройдена в составе `check:pr` | Ошибок lint в логе нет. |
| `node scripts/build-deploy.mjs` | Пройдена | Создан `_site`, размер около 30 MB. |
| Smart crop | Пройдена | `Smart crop checks passed`. |
| Trace mask | Пройдена | `Trace mask checks passed`. |
| PHP order receiver | Пройдена | Синтаксис, logging contract и fast-acceptance lifecycle корректны. |
| Playwright smoke | 55 passed, 1 failed, 2 skipped | Единственное воспроизводимое падение — мобильный sticker picker. |

## Критические и высокоприоритетные правки

### P0. Исправить перекрытие picker на мобильном

**Симптом.** Тест `tests/studio-production.spec.js:1026` падает на шаге выбора стикера. Кнопка `data-sticker-option="roundrect-80x20"` видима и стабильна, но клик перехватывает элемент предпросмотра:

> `<div ... aria-label="Настроить стикер" ...>` from `.mobile-products-host` subtree intercepts pointer events.

**Вероятная причина.** На mobile product-first пути `.mobile-products-panel` остаётся в потоке вокруг `#stickerProductPicker`, а preview-слой имеет активную область поверх picker. При этом CSS picker использует `z-index` только для внутреннего меню (`.sticker-product-group-menu`), но не задаёт отдельный stacking context и слой для самого picker. Перенос панели через `mobile-products.js` дополнительно меняет DOM-позицию между host-контейнерами.

**Рекомендуемая правка.**

- При открытом `#stickerProductPicker` явно переводить preview в неинтерактивное состояние или скрывать его на mobile product-first upload screen.
- Для product picker создать отдельный stacking context: `position: relative; z-index: 30;` и проверить, что его родитель не обрезает слой через `overflow`.
- Если preview должен оставаться видимым, ограничить pointer events только его визуальными overlay-элементами, а не всей поверхностью.
- Добавить отдельную проверку клика в 390 px, а не только проверку `toBeVisible()`.

Минимальный критерий готовности: сценарий выбора `roundrect-80x20`, затем `circle-24/gold`, проходит на mobile и desktop без `force: true` в Playwright.

### P0. Обновить PDF.js и закрепить безопасный режим

В `package.json` используется прямой `pdfjs-dist@6.1.200`. `npm audit` сообщает advisory `GHSA-hq66-cqwq-w95` для диапазона `<6.2.108`: malicious PDF может привести к выполнению JavaScript. Клиент уже задаёт `isEvalSupported: false` в `studio/assets/js/app.js:3902–3910`, но это полезная защита конфигурации, а не замена обновлению библиотеки.

**Рекомендуемая правка.**

1. Обновить `pdfjs-dist` до версии, закрывающей advisory, если API и worker-структура совместимы.
2. Перегенерировать или заменить локальный vendor artifact и проверить `pdf.min.*`, worker, wasm, standard fonts и ICC assets.
3. Добавить fixture повреждённого и специально сформированного PDF.
4. Ограничить размер PDF до 20 MB до `arrayBuffer()`; сейчас клиентский лимит проверяет размер файла, но отдельный серверный endpoint принимает уже сформированный SVG.
5. Прогнать PDF в worker с отключёнными XFA и eval-настройками, что уже частично сделано.

### P0/P1. Сделать SVG-санитизацию структурной, а не строковой

Серверная `pm_clean_svg()` в `api/orders/index.php:71–101` проверяет размер, наличие `<svg>` и несколько запрещённых подстрок: `script`, `javascript:`, `foreignObject`, `iframe`, `object`, `embed`. Это недостаточная гарантия для production-приёмника.

Проблемные классы, которые нужно покрыть:

- XML namespace и атрибуты событий `onload`, `onclick` и другие `on*`;
- `href`/`xlink:href` с внешними URL или data payload;
- `<use>` со ссылками на внешние ресурсы;
- CSS внутри `style`, `url(...)`, animation и filter references;
- XML processing instructions, entity expansion и нестандартные регистры/кодировки;
- SVG-файл, который проходит серверную проверку, но при открытии в производственном процессе ведёт себя иначе.

**Рекомендуемая правка.** Ввести отдельный модуль sanitizer с allowlist элементов и атрибутов. Разрешить только нужные производственные элементы, например `svg`, `g`, `path`, `rect`, `circle`, `ellipse`, `polygon`, `polyline`, `line` и ограниченный набор геометрических атрибутов. Удалять все события, внешние ссылки, стили, анимации и опасные namespaces. После очистки повторно сериализовать SVG и валидировать размер, viewBox и отсутствие запрещённых узлов.

Клиентская очистка в `app.js:3960–3987` также удаляет только `script` и `foreignObject`; её следует заменить тем же allowlist-модулем или эквивалентной реализацией.

## Высокоприоритетные улучшения

### Разделить `app.js` и `app.css`

`studio/assets/js/app.js` содержит 5 582 строки, а `studio/assets/css/app.css` — 2 309 строк. В `mobile-products.js` ещё 1 095 строк. Это повышает стоимость любой правки: состояние, загрузка файлов, crop, tracing, layout, storage, order/export и DOM-координация связаны в одном координаторе.

Разделение лучше проводить постепенно, без изменения UX:

- `state-storage.js`: schema, localStorage, восстановление и миграции;
- `upload-sanitize.js`: MIME/extension/signature checks, SVG sanitizer, PDF entry point;
- `crop-trace.js`: crop, raster preparation и trace orchestration;
- `render-preview.js`: DOM rendering и preview events;
- `order-export.js`: payload, production SVG, POST и local fallback.

Сначала стоит зафиксировать публичные DOM-события и shape состояния контрактными тестами. Затем переносить по одному модулю.

### Добавить WebKit и accessibility gate

В `playwright.config.js` определены только `mobile` и `desktop`, оба используют Chromium. Для проекта, ориентированного на мобильный путь, нужно добавить WebKit-проект с viewport 390 px и smoke-набором.

Roadmap уже указывает на необходимость axe/WCAG 2.2 AA. Это стоит реализовать до расширения функций:

- keyboard-only сценарий от product chooser до заявки;
- проверка focus return для crop и mobile dialogs;
- `fieldset/legend` для групп цветов, размеров и продуктов;
- тест 200% text zoom;
- проверка touch-targets и контраста;
- отсутствие горизонтального overflow на 390 px и 1440 px.

### Обновить зависимости и lockfile

`npm audit` нашёл:

- `pdfjs-dist@6.1.200` — direct, high;
- `brace-expansion@5.0.7` через ESLint/minimatch — high;
- `qs@6.15.3` через `http-server/union` — moderate.

После обновления нужно выполнить `npm audit`, `npm test` и проверить, что runtime artifact не включает случайно изменившиеся vendor-файлы. Уязвимости tooling не делают браузерный production-код автоматически уязвимым, но они ухудшают CI и supply-chain risk и должны быть закрыты в lockfile.

### Проверить ограничение rate limit

`pm_check_rate_limit()` использует файл-счётчик на час и блокировку общего `.orders.lock`, что подходит для небольшого трафика. Однако счётчики не имеют TTL-очистки, а ключ строится по `REMOTE_ADDR`. Перед production стоит проверить:

- корректность IP за reverse proxy;
- невозможность подмены доверенного proxy header;
- cleanup старых файлов `rate-limits`;
- поведение при параллельных запросах и ошибке записи;
- отдельное ограничение для повторяющихся request body с разными `requestId`.

## Средние улучшения

### Производительность загрузок

`loadPdfFile()` читает весь файл в память через `file.arrayBuffer()`, после чего создаёт canvas и PNG data URL. Для лимита 20 MB это приемлемо как базовый вариант, но на мобильных устройствах может дать пик памяти. Стоит ограничить итоговый canvas, освобождать PDF document/page после render и держать тяжёлые операции в worker.

В landing page hero уже использует оптимизированные форматы, но стоит добавить `srcset` и `sizes` для hero и карточек, а также проверить LCP/CLS на мобильном профиле.

### Стабильность deployment

Artifact `_site` содержит 30 MB, включая PDF.js wasm, fonts и vendor resources. Это ожидаемо для текущей функциональности, но стоит проверить gzip/brotli на сервере и caching для immutable assets. Cache-busting уже контролируется smoke-тестом, это хорошее решение, которое следует сохранить.

### Набор тестовых fixtures

Добавить явные fixtures и тесты для:

- SVG с event handler, внешним `href`, `<use>`, style URL и foreign namespace;
- SVG с неправильной сигнатурой/расширением;
- JPEG с EXIF orientation;
- большой JPEG и большой PDF;
- повреждённый PDF;
- переполнения localStorage и восстановления частично повреждённого draft.

## Предлагаемый порядок работ

1. Исправить мобильный picker и добавить реальную pointer-click проверку.
2. Обновить `pdfjs-dist` и закрыть dependency audit.
3. Вынести строгую SVG allowlist-санитизацию и добавить security fixtures.
4. Добавить WebKit smoke и accessibility gate.
5. Разделить `app.js` по границам ответственности.
6. После стабилизации провести Lighthouse/mobile performance review.

## Что не следует делать сейчас

Не стоит начинать большой рефакторинг Studio до исправления мобильного picker и обработки входных файлов. Эти изменения затрагивают пользовательский путь и безопасность. Сначала лучше закрыть P0, добавить регрессионные тесты, а затем переносить код небольшими самостоятельными задачами.

## References

[1]: https://github.com/9627997/pechataet-maksim-site "Репозиторий проекта «Печатает Максим»"
[2]: https://github.com/advisories/GHSA-hq66-cqwq-w95 "PDF.js arbitrary JavaScript execution advisory"
[3]: https://github.com/advisories/GHSA-mh99-v99m-4gvg "brace-expansion denial-of-service advisory"
[4]: https://github.com/advisories/GHSA-rgw5-rvv9-x895 "brace-expansion unbounded expansion advisory"
[5]: https://github.com/advisories/GHSA-x5fp-wj9c-mxmx "qs array-limit bypass advisory"
[6]: https://github.com/advisories/GHSA-4mjr-xmp4-gh2g "qs denial-of-service advisory"
