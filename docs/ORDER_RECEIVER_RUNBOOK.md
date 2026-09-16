# Приём заявок Studio

## Что уже делает система

`POST /api/orders/` принимает данные шага «Получить» и production-SVG выбранных
изделий. Успешный ответ появляется только после атомарной записи комплекта в
приватный каталог вне web-root.

Контракт клиента включает `customer.preferredContact` со значением `phone` или
`telegram`. Контакт выбранного типа обязателен и фиксируется в `order.json`,
`request.txt` и оперативных уведомлениях. Публичный Telegram проекта не нужен
для этого поля: клиент сообщает свой адрес для ответа.

В комплект входят:

- `request.txt` — читаемая заявка;
- `order.json` — структурированные данные;
- `ribbon.svg` и/или `sticker.svg` — производственные макеты;
- `order-package.zip`, если на сервере доступно расширение PHP `ZipArchive`;
- `notifications.json` — результат попыток доставки уведомлений, включая число
  попыток и список каналов с частичным сбоем.

Повторный POST с тем же `requestId` возвращает прежний номер и не создаёт
дубликат. Ограничение по IP — 20 новых заявок в час. При сбое браузер не
показывает ложное подтверждение и предлагает скачать локальную копию.

## Требования к REG.RU

- PHP 8.0 или новее;
- право PHP создавать каталог рядом с `DOCUMENT_ROOT`;
- расширение `curl` для Telegram, MAX и Google;
- расширение `zip` желательно для отправки единого архива в Telegram.

По умолчанию архив создаётся в
`dirname(DOCUMENT_ROOT)/.pechataet-maksim-orders`. Этот каталог не попадает под
deployment с `rsync --delete` и недоступен по HTTP.

Перед production-запуском отправить тестовую заявку и проверить, что в каталоге
появились `request.txt`, `order.json` и SVG. Если PHP не может создать соседний
каталог, задать существующий приватный путь через конфигурацию.

## Приватная конфигурация

Создать на сервере файл
`dirname(DOCUMENT_ROOT)/private/pechataet-maksim-orders.php`. Файл нельзя
добавлять в Git или размещать внутри публичного сайта.

```php
<?php

return [
    'storage_dir' => dirname($_SERVER['DOCUMENT_ROOT']) . '/.pechataet-maksim-orders',
    'rate_limit_per_hour' => 20,
    'telegram' => [
        'bot_token' => 'TOKEN_ОТ_BOTFATHER',
        'chat_id' => 'ID_ЧАТА_ИЛИ_ПОЛЬЗОВАТЕЛЯ',
    ],
    'max' => [
        'access_token' => 'ТОКЕН_MAX_BOT_API',
        'chat_id' => 'ID_ЧАТА_MAX',
    ],
    'google' => [
        'webhook_url' => 'URL_РАЗВЁРНУТОГО_APPS_SCRIPT',
        'shared_secret' => 'ДЛИННАЯ_СЛУЧАЙНАЯ_СТРОКА',
    ],
    'notifications' => [
        'max_attempts' => 3,
        'retry_delay_seconds' => 1,
    ],
];
```

Любой канал можно оставить пустым. Сохранение в основном архиве продолжит
работать. Токены также поддерживаются через переменные окружения
`PM_TELEGRAM_BOT_TOKEN`, `PM_TELEGRAM_CHAT_ID`, `PM_MAX_ACCESS_TOKEN`,
`PM_MAX_CHAT_ID`, `PM_GOOGLE_WEBHOOK_URL`, `PM_GOOGLE_SHARED_SECRET` и
`PM_ORDER_STORAGE_DIR`.

Production Telegram настраивается через environment `production` в GitHub:

1. добавить environment-secret `PM_TELEGRAM_BOT_TOKEN`;
2. добавить environment-secret `PM_TELEGRAM_CHAT_ID`;
3. запустить deployment из `main`;
4. workflow без вывода значений проверит методы Telegram `getMe` и `getChat`,
   передаст конфигурацию по SSH и установит её вне web-root с правами `600`.

Если токен отсутствует, недействителен или пользователь не запустил бота,
deployment останавливается до изменения production. Секреты нельзя передавать
через сообщения, хранить в Git или печатать в журналах Actions.

Для Google Drive backup в том же environment `production` добавить два
repository/environment secrets:

1. `PM_GOOGLE_WEBHOOK_URL` — опубликованный URL Apps Script, заканчивающийся
   `/exec`;
2. `PM_GOOGLE_SHARED_SECRET` — то же значение, которое сохранено в Script
   property `PM_SHARED_SECRET`.

Workflow передаст их на REG.RU только в приватный PHP-конфиг вне web-root. Если
задан только один из двух секретов, deployment остановится, чтобы не получить
частично настроенный канал. Значения Google не выводятся в логи Actions.

## Google Drive и Google Sheets

1. Создать приватную папку Drive для заявок.
2. Создать таблицу с колонками: номер, дата, имя, телефон, Telegram,
   предпочтительный способ связи, комментарий, состав, ссылка.
3. Создать Apps Script и вставить
   `integrations/google-apps-script/Code.gs`.
4. В Script properties добавить `PM_SHARED_SECRET`, `PM_DRIVE_FOLDER_ID` и
   `PM_SPREADSHEET_ID`.
5. Развернуть скрипт как Web app от имени владельца, доступ — для всех, кто
   знает URL. Доступ к данным защищает общий секрет в теле запроса.
6. Записать URL и тот же секрет в приватную конфигурацию REG.RU.

Скрипт создаёт отдельную папку заявки, сохраняет в ней данные и SVG, затем
добавляет строку в таблицу. Формулы из пользовательских полей экранируются.

## Каналы и критерий успеха

Главный источник правды — приватный архив REG.RU. Google — резервная копия и
реестр. Telegram — основное оперативное уведомление с ZIP, когда расширение
`zip` доступно. MAX — дополнительное текстовое уведомление.

Каждый внешний канал получает до трёх попыток с увеличивающейся задержкой по
умолчанию: 1, затем 2 секунды. Максимум и задержка настраиваются в приватном
конфиге через секцию `notifications.max_attempts` и
`notifications.retry_delay_seconds`. Telegram, Google и MAX выполняются
независимо: сбой Telegram не блокирует резервную копию Google.

Сбой внешнего канала записывается в `notifications.json` как `failed`, а общий
статус становится `partial_failure`; это не отменяет уже принятую заявку.
Google Drive является резервной копией файлов и реестром, Telegram — основным
оперативным уведомлением с ZIP, когда расширение `zip` доступно. FTP из браузера
не применяется: при необходимости серверный cron может отдельно копировать
закрытые комплекты во внешний архив.
