<?php

declare(strict_types=1);

const PM_MAX_REQUEST_BYTES = 25 * 1024 * 1024;
const PM_MAX_SVG_BYTES = 8 * 1024 * 1024;

function pm_json_response(int $status, array $payload): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}

function pm_fail(int $status, string $code, string $message): void
{
    pm_json_response($status, [
        'status' => 'rejected',
        'code' => $code,
        'message' => $message,
    ]);
    exit;
}

function pm_string_length(string $value): int
{
    return function_exists('mb_strlen') ? mb_strlen($value, 'UTF-8') : strlen($value);
}

function pm_clean_string($value, int $maxLength, bool $required = false): string
{
    if (!is_string($value)) {
        if ($required) {
            throw new InvalidArgumentException('Обязательное текстовое поле не заполнено.');
        }
        return '';
    }

    $value = trim(str_replace("\0", '', $value));
    if ($required && $value === '') {
        throw new InvalidArgumentException('Обязательное текстовое поле не заполнено.');
    }
    if (pm_string_length($value) > $maxLength) {
        throw new InvalidArgumentException('Одно из текстовых полей слишком длинное.');
    }
    return $value;
}

function pm_allowed_number($value, array $allowed, string $field): int
{
    if (!is_int($value) && !(is_float($value) && floor($value) === $value)) {
        throw new InvalidArgumentException("Некорректное значение: {$field}.");
    }
    $number = (int) $value;
    if (!in_array($number, $allowed, true)) {
        throw new InvalidArgumentException("Недопустимое значение: {$field}.");
    }
    return $number;
}

function pm_clean_color($value, string $fallback): string
{
    if (!is_string($value) || !preg_match('/^#[0-9a-fA-F]{6}$/', $value)) {
        return $fallback;
    }
    return strtolower($value);
}

function pm_clean_svg($value, string $field): string
{
    if (!is_string($value) || trim($value) === '') {
        throw new InvalidArgumentException("Не сформирован файл макета: {$field}.");
    }
    if (strlen($value) > PM_MAX_SVG_BYTES) {
        throw new InvalidArgumentException("Файл макета слишком большой: {$field}.");
    }

    $probe = strtolower($value);
    $blocked = [
        '<!doctype',
        '<!entity',
        '<?php',
        '<script',
        '%3cscript',
        'javascript:',
        '<foreignobject',
        '<iframe',
        '<object',
        '<embed',
    ];
    foreach ($blocked as $needle) {
        if (strpos($probe, $needle) !== false) {
            throw new InvalidArgumentException("Файл макета содержит запрещённые элементы: {$field}.");
        }
    }
    if (!preg_match('/<svg\b/i', $value)) {
        throw new InvalidArgumentException("Файл макета не является SVG: {$field}.");
    }
    return $value;
}

function pm_load_config(): array
{
    $documentRoot = rtrim((string) ($_SERVER['DOCUMENT_ROOT'] ?? dirname(__DIR__, 2)), '/');
    $storageDefault = dirname($documentRoot) . '/.pechataet-maksim-orders';
    $defaults = [
        'storage_dir' => getenv('PM_ORDER_STORAGE_DIR') ?: $storageDefault,
        'allowed_origins' => [],
        'rate_limit_per_hour' => 20,
        'telegram' => [
            'bot_token' => getenv('PM_TELEGRAM_BOT_TOKEN') ?: '',
            'chat_id' => getenv('PM_TELEGRAM_CHAT_ID') ?: '',
        ],
        'max' => [
            'access_token' => getenv('PM_MAX_ACCESS_TOKEN') ?: '',
            'chat_id' => getenv('PM_MAX_CHAT_ID') ?: '',
        ],
        'google' => [
            'webhook_url' => getenv('PM_GOOGLE_WEBHOOK_URL') ?: '',
            'shared_secret' => getenv('PM_GOOGLE_SHARED_SECRET') ?: '',
        ],
    ];

    $configPath = getenv('PM_ORDER_CONFIG') ?: dirname($documentRoot) . '/private/pechataet-maksim-orders.php';
    if (!is_file($configPath)) {
        return $defaults;
    }

    $custom = require $configPath;
    if (!is_array($custom)) {
        throw new RuntimeException('Файл конфигурации приёмника должен возвращать массив.');
    }
    return array_replace_recursive($defaults, $custom);
}

function pm_assert_origin(array $config): void
{
    $origin = (string) ($_SERVER['HTTP_ORIGIN'] ?? '');
    if ($origin === '') {
        return;
    }

    $originHost = strtolower((string) parse_url($origin, PHP_URL_HOST));
    $requestHost = strtolower(preg_replace('/:\d+$/', '', (string) ($_SERVER['HTTP_HOST'] ?? '')));
    $allowed = array_filter($config['allowed_origins'] ?? [], 'is_string');
    if ($originHost !== $requestHost && !in_array($origin, $allowed, true)) {
        pm_fail(403, 'origin_not_allowed', 'Этот источник не может отправлять заявки.');
    }
}

function pm_prepare_storage(array $config): string
{
    $storage = rtrim((string) ($config['storage_dir'] ?? ''), '/');
    if ($storage === '') {
        throw new RuntimeException('Не задан каталог архива заявок.');
    }
    if (!is_dir($storage) && !mkdir($storage, 0700, true) && !is_dir($storage)) {
        throw new RuntimeException('Не удалось создать приватный архив заявок.');
    }
    @chmod($storage, 0700);

    $documentRoot = realpath((string) ($_SERVER['DOCUMENT_ROOT'] ?? ''));
    $storageReal = realpath($storage);
    if (
        $documentRoot !== false &&
        $storageReal !== false &&
        ($storageReal === $documentRoot || strpos($storageReal, $documentRoot . DIRECTORY_SEPARATOR) === 0)
    ) {
        throw new RuntimeException('Архив заявок нельзя размещать внутри публичной папки сайта.');
    }
    return $storageReal ?: $storage;
}

function pm_normalize_payload(array $input): array
{
    $requestId = pm_clean_string($input['requestId'] ?? '', 80, true);
    if (!preg_match('/^[a-zA-Z0-9-]{16,80}$/', $requestId)) {
        throw new InvalidArgumentException('Некорректный идентификатор отправки.');
    }

    $customerInput = is_array($input['customer'] ?? null) ? $input['customer'] : [];
    $customer = [
        'name' => pm_clean_string($customerInput['name'] ?? '', 120, true),
        'preferredContact' => pm_clean_string($customerInput['preferredContact'] ?? '', 20, true),
        'phone' => pm_clean_string($customerInput['phone'] ?? '', 40),
        'telegram' => pm_clean_string($customerInput['telegram'] ?? '', 80),
        'comment' => pm_clean_string($customerInput['comment'] ?? '', 2000),
    ];
    if (!in_array($customer['preferredContact'], ['phone', 'telegram'], true)) {
        throw new InvalidArgumentException('Выберите удобный способ связи.');
    }
    if ($customer[$customer['preferredContact']] === '') {
        throw new InvalidArgumentException('Укажите контакт для выбранного способа связи.');
    }

    $productsInput = is_array($input['products'] ?? null) ? $input['products'] : [];
    $ribbonInput = is_array($productsInput['ribbon'] ?? null) ? $productsInput['ribbon'] : [];
    $stickerInput = is_array($productsInput['sticker'] ?? null) ? $productsInput['sticker'] : [];
    $ribbonEnabled = ($ribbonInput['enabled'] ?? false) === true;
    $stickerEnabled = ($stickerInput['enabled'] ?? false) === true;
    if (!$ribbonEnabled && !$stickerEnabled) {
        throw new InvalidArgumentException('В заявке должен быть хотя бы один продукт.');
    }

    $ribbon = [
        'enabled' => $ribbonEnabled,
        'widthMm' => $ribbonEnabled ? pm_allowed_number($ribbonInput['widthMm'] ?? null, [15, 20], 'ширина ленты') : 0,
        'meters' => $ribbonEnabled ? pm_allowed_number($ribbonInput['meters'] ?? null, [10, 25, 50, 100, 200], 'метраж ленты') : 0,
        'repeatMm' => $ribbonEnabled ? pm_allowed_number($ribbonInput['repeatMm'] ?? null, range(40, 250), 'шаг повтора') : 0,
        'materialColor' => pm_clean_color($ribbonInput['materialColor'] ?? '', '#f3eadc'),
        'printColor' => pm_clean_color($ribbonInput['printColor'] ?? '', '#171717'),
    ];
    $sticker = [
        'enabled' => $stickerEnabled,
        'diameterMm' => $stickerEnabled ? pm_allowed_number($stickerInput['diameterMm'] ?? null, [25, 40, 50], 'диаметр стикера') : 0,
        'quantity' => $stickerEnabled ? pm_allowed_number($stickerInput['quantity'] ?? null, [50, 100, 250, 500], 'количество стикеров') : 0,
        'backgroundColor' => pm_clean_color($stickerInput['backgroundColor'] ?? '', '#ffffff'),
        'printColor' => pm_clean_color($stickerInput['printColor'] ?? '', '#171717'),
    ];

    $designInput = is_array($input['design'] ?? null) ? $input['design'] : [];
    $normalizeDesign = static function ($value): array {
        $value = is_array($value) ? $value : [];
        return [
            'text' => pm_clean_string($value['text'] ?? '', 60),
            'font' => pm_clean_string($value['font'] ?? '', 80),
            'hasLogo' => ($value['hasLogo'] ?? false) === true,
        ];
    };

    $pricingInput = is_array($input['pricing'] ?? null) ? $input['pricing'] : [];
    $amount = $pricingInput['amount'] ?? null;
    if ($amount !== null && (!is_int($amount) || $amount < 0 || $amount > 10000000)) {
        throw new InvalidArgumentException('Некорректная предварительная стоимость.');
    }

    $artifactsInput = is_array($input['artifacts'] ?? null) ? $input['artifacts'] : [];
    $artifacts = [
        'ribbonSvg' => $ribbonEnabled ? pm_clean_svg($artifactsInput['ribbonSvg'] ?? '', 'лента') : '',
        'stickerSvg' => $stickerEnabled ? pm_clean_svg($artifactsInput['stickerSvg'] ?? '', 'стикер') : '',
    ];

    return [
        'schemaVersion' => 1,
        'requestId' => $requestId,
        'createdAtClient' => pm_clean_string($input['createdAt'] ?? '', 40),
        'customer' => $customer,
        'products' => ['ribbon' => $ribbon, 'sticker' => $sticker],
        'design' => [
            'ribbon' => $normalizeDesign($designInput['ribbon'] ?? []),
            'sticker' => $normalizeDesign($designInput['sticker'] ?? []),
        ],
        'pricing' => [
            'preliminary' => true,
            'currency' => 'RUB',
            'amount' => $amount,
            'requiresIndividualCalculation' => ($pricingInput['requiresIndividualCalculation'] ?? false) === true,
        ],
        'artifacts' => $artifacts,
    ];
}

function pm_write_private_file(string $path, string $contents): void
{
    if (file_put_contents($path, $contents, LOCK_EX) === false) {
        throw new RuntimeException('Не удалось записать файл заявки.');
    }
    @chmod($path, 0600);
}

function pm_request_text(array $order): string
{
    $customer = $order['customer'];
    $ribbon = $order['products']['ribbon'];
    $sticker = $order['products']['sticker'];
    $price = $order['pricing']['requiresIndividualCalculation']
        ? 'требуется индивидуальный расчёт'
        : number_format((int) ($order['pricing']['amount'] ?? 0), 0, ',', ' ') . ' ₽';
    $ribbonLine = $ribbon['enabled']
        ? "- Лента {$ribbon['widthMm']} мм: {$ribbon['meters']} м, шаг {$ribbon['repeatMm']} мм"
        : '- Лента: не выбрана';
    $stickerLine = $sticker['enabled']
        ? "- Стикеры Ø{$sticker['diameterMm']} мм: {$sticker['quantity']} шт."
        : '- Стикеры: не выбраны';

    return implode("\n", [
        'Заявка — Печатает Максим',
        "Номер заявки: {$order['orderId']}",
        "Принята: {$order['acceptedAt']}",
        '',
        "Имя: {$customer['name']}",
        'Телефон: ' . ($customer['phone'] ?: 'не указан'),
        'Telegram: ' . ($customer['telegram'] ?: 'не указан'),
        'Предпочтительный способ связи: ' . ($customer['preferredContact'] === 'phone' ? 'телефон' : 'Telegram'),
        'Комментарий: ' . ($customer['comment'] ?: 'не указан'),
        '',
        'Состав заказа:',
        $ribbonLine,
        $stickerLine,
        "- Надпись на ленте: " . ($order['design']['ribbon']['text'] ?: 'без надписи'),
        "- Надпись на стикере: " . ($order['design']['sticker']['text'] ?: 'без надписи'),
        "- Предварительная стоимость: {$price}",
    ]) . "\n";
}

function pm_create_zip(string $directory): ?string
{
    if (!class_exists('ZipArchive')) {
        return null;
    }
    $zipPath = $directory . '/order-package.zip';
    $zip = new ZipArchive();
    if ($zip->open($zipPath, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
        return null;
    }
    foreach (['request.txt', 'order.json', 'ribbon.svg', 'sticker.svg'] as $filename) {
        $path = $directory . '/' . $filename;
        if (is_file($path)) {
            $zip->addFile($path, $filename);
        }
    }
    $zip->close();
    @chmod($zipPath, 0600);
    return is_file($zipPath) ? $zipPath : null;
}

function pm_check_rate_limit(string $storage, int $limit): void
{
    $remote = (string) ($_SERVER['REMOTE_ADDR'] ?? 'unknown');
    $key = hash('sha256', $remote . '|' . gmdate('Y-m-d-H'));
    $directory = $storage . '/rate-limits';
    if (!is_dir($directory) && !mkdir($directory, 0700, true) && !is_dir($directory)) {
        throw new RuntimeException('Не удалось проверить лимит отправки.');
    }
    $path = $directory . '/' . $key . '.count';
    $count = is_file($path) ? (int) file_get_contents($path) : 0;
    if ($count >= max(1, $limit)) {
        pm_fail(429, 'rate_limited', 'Слишком много заявок. Повторите попытку позже.');
    }
    pm_write_private_file($path, (string) ($count + 1));
}

function pm_store_order(string $storage, array $payload, array $config): array
{
    $lockPath = $storage . '/.orders.lock';
    $lock = fopen($lockPath, 'c+');
    if ($lock === false || !flock($lock, LOCK_EX)) {
        throw new RuntimeException('Архив заявок временно недоступен.');
    }

    try {
        $idempotencyDirectory = $storage . '/idempotency';
        if (!is_dir($idempotencyDirectory)) {
            mkdir($idempotencyDirectory, 0700, true);
        }
        $mappingPath = $idempotencyDirectory . '/' . hash('sha256', $payload['requestId']) . '.json';
        if (is_file($mappingPath)) {
            $existing = json_decode((string) file_get_contents($mappingPath), true);
            if (is_array($existing) && !empty($existing['orderId'])) {
                return [
                    'orderId' => $existing['orderId'],
                    'acceptedAt' => $existing['acceptedAt'],
                    'directory' => $existing['directory'],
                    'duplicate' => true,
                    'payload' => $payload,
                ];
            }
        }

        pm_check_rate_limit($storage, (int) ($config['rate_limit_per_hour'] ?? 20));
        $acceptedAt = gmdate('c');
        $orderId = 'PM-' . gmdate('Ymd') . '-' . strtoupper(bin2hex(random_bytes(4)));
        $parent = $storage . '/orders/' . gmdate('Y/m');
        if (!is_dir($parent) && !mkdir($parent, 0700, true) && !is_dir($parent)) {
            throw new RuntimeException('Не удалось создать каталог заявки.');
        }
        $directory = $parent . '/' . $orderId;
        $temporary = $parent . '/.' . $orderId . '-' . bin2hex(random_bytes(3));
        if (!mkdir($temporary, 0700, true)) {
            throw new RuntimeException('Не удалось подготовить каталог заявки.');
        }

        $order = $payload;
        $order['orderId'] = $orderId;
        $order['acceptedAt'] = $acceptedAt;
        unset($order['artifacts']);
        pm_write_private_file(
            $temporary . '/order.json',
            json_encode($order, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . "\n"
        );
        pm_write_private_file($temporary . '/request.txt', pm_request_text($order));
        if ($payload['products']['ribbon']['enabled']) {
            pm_write_private_file($temporary . '/ribbon.svg', $payload['artifacts']['ribbonSvg']);
        }
        if ($payload['products']['sticker']['enabled']) {
            pm_write_private_file($temporary . '/sticker.svg', $payload['artifacts']['stickerSvg']);
        }
        pm_write_private_file(
            $temporary . '/notifications.json',
            json_encode(['status' => 'pending'], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) . "\n"
        );
        pm_create_zip($temporary);

        if (!rename($temporary, $directory)) {
            throw new RuntimeException('Не удалось зафиксировать заявку в архиве.');
        }
        $mapping = [
            'orderId' => $orderId,
            'acceptedAt' => $acceptedAt,
            'directory' => $directory,
        ];
        pm_write_private_file(
            $mappingPath,
            json_encode($mapping, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . "\n"
        );

        return $mapping + ['duplicate' => false, 'payload' => $payload];
    } finally {
        flock($lock, LOCK_UN);
        fclose($lock);
    }
}

function pm_post_json(string $url, array $payload, array $headers = []): array
{
    $body = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    $headers[] = 'Content-Type: application/json';

    if (function_exists('curl_init')) {
        $curl = curl_init($url);
        curl_setopt_array($curl, [
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => $body,
            CURLOPT_HTTPHEADER => $headers,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CONNECTTIMEOUT => 3,
            CURLOPT_TIMEOUT => 6,
        ]);
        $response = curl_exec($curl);
        $status = (int) curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
        $error = curl_error($curl);
        curl_close($curl);
        $decoded = is_string($response) ? json_decode($response, true) : null;
        $applicationAccepted = !is_array($decoded) || ($decoded['ok'] ?? true) !== false;
        return [
            'ok' => $response !== false && $status >= 200 && $status < 300 && $applicationAccepted,
            'status' => $status,
            'error' => $error,
        ];
    }

    $context = stream_context_create(['http' => [
        'method' => 'POST',
        'header' => implode("\r\n", $headers),
        'content' => $body,
        'timeout' => 6,
        'ignore_errors' => true,
    ]]);
    $response = @file_get_contents($url, false, $context);
    $decoded = is_string($response) ? json_decode($response, true) : null;
    $applicationAccepted = !is_array($decoded) || ($decoded['ok'] ?? true) !== false;
    return [
        'ok' => $response !== false && $applicationAccepted,
        'status' => 0,
        'error' => $response === false ? 'request_failed' : '',
    ];
}

function pm_notify_telegram(array $settings, array $order): array
{
    $token = (string) ($settings['bot_token'] ?? '');
    $chatId = (string) ($settings['chat_id'] ?? '');
    if ($token === '' || $chatId === '') {
        return ['status' => 'disabled'];
    }
    $text = "Новая заявка {$order['orderId']}\n\n" . pm_request_text($order['payload'] + [
        'orderId' => $order['orderId'],
        'acceptedAt' => $order['acceptedAt'],
    ]);
    $result = pm_post_json(
        "https://api.telegram.org/bot{$token}/sendMessage",
        ['chat_id' => $chatId, 'text' => $text]
    );

    $zipPath = $order['directory'] . '/order-package.zip';
    if ($result['ok'] && is_file($zipPath) && function_exists('curl_init')) {
        $curl = curl_init("https://api.telegram.org/bot{$token}/sendDocument");
        curl_setopt_array($curl, [
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => [
                'chat_id' => $chatId,
                'caption' => "Макеты {$order['orderId']}",
                'document' => new CURLFile($zipPath, 'application/zip', basename($zipPath)),
            ],
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CONNECTTIMEOUT => 3,
            CURLOPT_TIMEOUT => 10,
        ]);
        $response = curl_exec($curl);
        $status = (int) curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
        $result = ['ok' => $response !== false && $status >= 200 && $status < 300, 'status' => $status, 'error' => curl_error($curl)];
        curl_close($curl);
    }
    return ['status' => $result['ok'] ? 'sent' : 'failed', 'httpStatus' => $result['status'], 'error' => $result['error']];
}

function pm_notify_max(array $settings, array $order): array
{
    $token = (string) ($settings['access_token'] ?? '');
    $chatId = (string) ($settings['chat_id'] ?? '');
    if ($token === '' || $chatId === '') {
        return ['status' => 'disabled'];
    }
    $text = "Новая заявка {$order['orderId']}\n" . pm_request_text($order['payload'] + [
        'orderId' => $order['orderId'],
        'acceptedAt' => $order['acceptedAt'],
    ]);
    $result = pm_post_json(
        'https://platform-api.max.ru/messages?chat_id=' . rawurlencode($chatId),
        ['text' => $text],
        ['Authorization: ' . $token]
    );
    return ['status' => $result['ok'] ? 'sent' : 'failed', 'httpStatus' => $result['status'], 'error' => $result['error']];
}

function pm_notify_google(array $settings, array $order): array
{
    $url = (string) ($settings['webhook_url'] ?? '');
    $secret = (string) ($settings['shared_secret'] ?? '');
    if ($url === '' || $secret === '') {
        return ['status' => 'disabled'];
    }
    $result = pm_post_json($url, [
        'secret' => $secret,
        'order' => $order['payload'] + [
            'orderId' => $order['orderId'],
            'acceptedAt' => $order['acceptedAt'],
        ],
    ]);
    return ['status' => $result['ok'] ? 'sent' : 'failed', 'httpStatus' => $result['status'], 'error' => $result['error']];
}

function pm_run_notifications(array $config, array $order): void
{
    if ($order['duplicate']) {
        return;
    }
    $attempt = static function (callable $notification): array {
        try {
            return $notification();
        } catch (Throwable $error) {
            return ['status' => 'failed', 'error' => $error->getMessage()];
        }
    };
    $results = [
        'attemptedAt' => gmdate('c'),
        'telegram' => $attempt(static fn (): array => pm_notify_telegram($config['telegram'] ?? [], $order)),
        'max' => $attempt(static fn (): array => pm_notify_max($config['max'] ?? [], $order)),
        'google' => $attempt(static fn (): array => pm_notify_google($config['google'] ?? [], $order)),
    ];
    pm_write_private_file(
        $order['directory'] . '/notifications.json',
        json_encode($results, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . "\n"
    );
}

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    header('Allow: POST');
    pm_fail(405, 'method_not_allowed', 'Используйте POST для отправки заявки.');
}

try {
    $config = pm_load_config();
    pm_assert_origin($config);
    $contentLength = (int) ($_SERVER['CONTENT_LENGTH'] ?? 0);
    if ($contentLength > PM_MAX_REQUEST_BYTES) {
        pm_fail(413, 'request_too_large', 'Заявка и макеты превышают допустимый размер.');
    }
    $raw = file_get_contents('php://input');
    if ($raw === false || $raw === '') {
        pm_fail(400, 'empty_request', 'Получена пустая заявка.');
    }
    if (strlen($raw) > PM_MAX_REQUEST_BYTES) {
        pm_fail(413, 'request_too_large', 'Заявка и макеты превышают допустимый размер.');
    }
    $input = json_decode($raw, true, 64, JSON_THROW_ON_ERROR);
    if (!is_array($input)) {
        pm_fail(400, 'invalid_json', 'Некорректный формат заявки.');
    }
    $payload = pm_normalize_payload($input);
    $storage = pm_prepare_storage($config);
    $order = pm_store_order($storage, $payload, $config);

    pm_json_response($order['duplicate'] ? 200 : 201, [
        'status' => 'accepted',
        'orderId' => $order['orderId'],
        'acceptedAt' => $order['acceptedAt'],
        'duplicate' => $order['duplicate'],
    ]);

    ignore_user_abort(true);
    if (function_exists('fastcgi_finish_request')) {
        fastcgi_finish_request();
    }
    try {
        pm_run_notifications($config, $order);
    } catch (Throwable $notificationError) {
        error_log('Pechataet Maksim order notification: ' . $notificationError->getMessage());
    }
} catch (JsonException $error) {
    pm_fail(400, 'invalid_json', 'Некорректный формат заявки.');
} catch (InvalidArgumentException $error) {
    pm_fail(422, 'validation_failed', $error->getMessage());
} catch (Throwable $error) {
    error_log('Pechataet Maksim order receiver: ' . $error->getMessage());
    pm_fail(503, 'receiver_unavailable', 'Не удалось сохранить заявку. Повторите попытку или скачайте копию.');
}
