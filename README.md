# Печатает Максим

Сайт и браузерная Studio для подготовки брендированных лент и стикеров.

## Основные части

- `index.html`, `css/`, `js/` — публичная посадочная страница.
- `studio/` — актуальный конфигуратор ленты и стикеров.
- `tests/` — Playwright-проверки главной страницы и Studio.
- `docs/` — архитектура, UX-правила, changelog и план развития.
- старые URL `/constructor.html` и `/ribbon-studio-design-system-v1.html`
  создаются deployment-сборкой как переходы на актуальную `/studio/`.

## Локальный запуск

```bash
npm install
npm run dev
```

Главная страница: `http://127.0.0.1:4173/`

Studio: `http://127.0.0.1:4173/studio/`

## Проверки

```bash
npm run check:fast
npm run check:pr
npm run check:full
```

`check:fast` предназначен для локального цикла, `check:pr` — для Pull Request,
а `check:full` — для полного regression. Playwright проверяет мобильную ширину
`390 px` и настольную `1440 px`.

## Текущее ограничение заявок

Главная страница и Studio формируют локальный текстовый файл заявки. Прямая серверная отправка контактов пока не подключена; её реализация — первый продуктовый приоритет в [roadmap](docs/ROADMAP.md).

## Документация

- [Быстрый контекст проекта для разработчика и ChatGPT](docs/PROJECT_CONTEXT.md)
- [Журнал решений](docs/DECISIONS.md)
- [Шаблон задачи](docs/TASK_TEMPLATE.md)
- [Архитектура](docs/ARCHITECTURE.md)
- [Roadmap](docs/ROADMAP.md)
- [UX-правила](docs/UX_RULES.md)
- [Changelog](docs/CHANGELOG.md)
- [Правила разработки](AGENTS.md)
