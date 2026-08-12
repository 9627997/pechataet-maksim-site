# Приём заявок Studio

## Что уже делает система

`POST /api/orders/` принимает данные шага «Получить» и production-SVG выбранных
изделий. Успешный ответ появляется только после атомарной записи комплекта в
приватный каталог вне web-root.

В комплект входят:

- `request.txt` — читаемая заявка;
- `order.json` — структурированные данные;
- `ribbon.svg` и/или `sticker.svg` — производственные макеты;
- `order-package.zip`, если на сервере доступно расширение PHP `ZipArchive`;
- `notifications.json` — результат попыток доставки уведомлений.

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

## Google Drive и Google Sheets

1. Создать приватную папку Drive для заявок.
2. Создать таблицу с колонками: номер, дата, имя, телефон, Telegram,
   комментарий, состав, ссылка.
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

Сбой Telegram, MAX или Google записывается в `notifications.json`, но не
отменяет уже принятую заявку. FTP из браузера не применяется: при необходимости
серверный cron может отдельно копировать закрытые комплекты во внешний архив.
