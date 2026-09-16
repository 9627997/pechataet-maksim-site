<?php

declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

function pmq_config(): array
{
    $path = dirname(__DIR__, 3) . '/private/pechataet-maksim-orders.php';
    $config = is_file($path) ? (array) require $path : [];
    $config['storage_dir'] = $config['storage_dir'] ?? (getenv('PM_ORDER_STORAGE_DIR') ?: '/var/www/u2767403/data/www/.pechataet-maksim-orders');
    $config['notifications'] = $config['notifications'] ?? ['max_attempts' => 3, 'retry_delay_seconds' => 1];
    return $config;
}

function pmq_request(string $url, array $payload, ?array $file = null, array $headers = []): array
{
    if (!function_exists('curl_init')) return ['ok' => false, 'error' => 'curl_unavailable'];
    $curl = curl_init($url);
    $fields = $file === null ? json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) : $file;
    curl_setopt_array($curl, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $fields,
        CURLOPT_HTTPHEADER => $file === null ? array_merge(['Content-Type: application/json'], $headers) : $headers,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_POSTREDIR => 3,
        CURLOPT_CONNECTTIMEOUT => 3,
        CURLOPT_TIMEOUT => $file === null ? 6 : 10,
    ]);
    $body = curl_exec($curl);
    $status = (int) curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
    $error = curl_error($curl);
    curl_close($curl);
    $decoded = is_string($body) ? json_decode($body, true) : null;
    return ['ok' => $body !== false && $status >= 200 && $status < 300 && (!is_array($decoded) || ($decoded['ok'] ?? true) !== false), 'status' => $status, 'error' => $error];
}

function pmq_attempt(callable $callback, int $max, int $delay): array
{
    $last = ['status' => 'failed', 'attempts' => 0];
    for ($attempt = 1; $attempt <= $max; $attempt++) {
        try { $last = $callback(); } catch (Throwable $error) { $last = ['status' => 'failed', 'error' => $error->getMessage()]; }
        $last['attempts'] = $attempt;
        if (in_array($last['status'] ?? '', ['sent', 'disabled'], true)) return $last;
        if ($attempt < $max) sleep($delay * $attempt);
    }
    return $last;
}

function pmq_text(array $order): string
{
    $customer = $order['customer'] ?? [];
    $ribbon = $order['products']['ribbon'] ?? [];
    $sticker = $order['products']['sticker'] ?? [];
    return implode("\n", [
        'Новая заявка ' . ($order['orderId'] ?? ''),
        '',
        'Имя: ' . ($customer['name'] ?? ''),
        'Телефон: ' . ($customer['phone'] ?? 'не указан'),
        'Telegram: ' . ($customer['telegram'] ?? 'не указан'),
        'Комментарий: ' . ($customer['comment'] ?? 'не указан'),
        ($ribbon['enabled'] ?? false) ? 'Лента: ' . ($ribbon['widthMm'] ?? '') . ' мм · ' . ($ribbon['meters'] ?? '') . ' м' : 'Лента: не выбрана',
        ($sticker['enabled'] ?? false) ? 'Стикеры: ' . ($sticker['quantity'] ?? '') . ' шт.' : 'Стикеры: не выбраны',
    ]);
}

function pmq_process(string $directory, array $config): void
{
    $queuePath = $directory . '/notification-queue.json';
    $queue = json_decode((string) file_get_contents($queuePath), true);
    if (!is_array($queue) || ($queue['status'] ?? '') === 'sent') return;
    $order = json_decode((string) file_get_contents($directory . '/order.json'), true);
    if (!is_array($order)) throw new RuntimeException('Invalid order.json');
    foreach ([['ribbonSvg', 'ribbon.svg'], ['stickerSvg', 'sticker.svg'], ['ribbonPreviewSvg', 'ribbon-preview.svg'], ['ribbonPrintSvg', 'ribbon-print-black.svg'], ['stickerPreviewSvg', 'sticker-preview.svg'], ['stickerPrintSvg', 'sticker-print-black.svg']] as [$key, $file]) {
        if (is_file($directory . '/' . $file)) $order['artifacts'][$key] = file_get_contents($directory . '/' . $file);
    }
    $max = max(1, min(5, (int) ($config['notifications']['max_attempts'] ?? 3)));
    $delay = max(0, min(10, (int) ($config['notifications']['retry_delay_seconds'] ?? 1)));
    $token = (string) ($config['telegram']['bot_token'] ?? '');
    $chat = (string) ($config['telegram']['chat_id'] ?? '');
    $text = pmq_text($order);
    $telegram = (!$token || !$chat) ? ['status' => 'disabled'] : pmq_attempt(function () use ($token, $chat, $text, $directory, $order): array {
        $result = pmq_request('https://api.telegram.org/bot' . $token . '/sendMessage', ['chat_id' => $chat, 'text' => $text]);
        if (!$result['ok']) return ['status' => 'failed'] + $result;
        $zip = $directory . '/order-package.zip';
        if (is_file($zip)) $result = pmq_request('https://api.telegram.org/bot' . $token . '/sendDocument', ['chat_id' => $chat, 'caption' => 'Макеты ' . ($order['orderId'] ?? ''), 'document' => new CURLFile($zip, 'application/zip', basename($zip))]);
        return ['status' => $result['ok'] ? 'sent' : 'failed'] + $result;
    }, $max, $delay);
    $googleUrl = (string) ($config['google']['webhook_url'] ?? '');
    $google = $googleUrl === '' ? ['status' => 'disabled'] : pmq_attempt(function () use ($config, $order, $googleUrl): array {
        $result = pmq_request($googleUrl, ['secret' => $config['google']['shared_secret'], 'order' => $order]);
        return ['status' => $result['ok'] ? 'sent' : 'failed'] + $result;
    }, $max, $delay);
    $maxToken = (string) ($config['max']['access_token'] ?? '');
    $maxChat = (string) ($config['max']['chat_id'] ?? '');
    $max = (!$maxToken || !$maxChat) ? ['status' => 'disabled'] : pmq_attempt(function () use ($maxToken, $maxChat, $text): array {
        $result = pmq_request('https://platform-api.max.ru/messages?chat_id=' . rawurlencode($maxChat), ['text' => $text], null, ['Authorization: ' . $maxToken]);
        return ['status' => $result['ok'] ? 'sent' : 'failed'] + $result;
    }, $max, $delay);
    $failed = array_filter([$telegram, $google, $max], static fn(array $result): bool => ($result['status'] ?? '') === 'failed');
    $status = $failed ? 'partial_failure' : 'completed';
    file_put_contents($directory . '/notifications.json', json_encode(['status' => $status, 'attemptedAt' => gmdate('c'), 'telegram' => $telegram, 'google' => $google, 'max' => $max], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . "\n", LOCK_EX);
    $queue['status'] = $status === 'completed' ? 'sent' : 'partial_failure';
    $queue['attempts'] = max((int) ($telegram['attempts'] ?? 0), (int) ($google['attempts'] ?? 0), (int) ($max['attempts'] ?? 0));
    $queue['processedAt'] = gmdate('c');
    file_put_contents($queuePath, json_encode($queue, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . "\n", LOCK_EX);
}

$config = pmq_config();
$pattern = rtrim($config['storage_dir'], '/') . '/orders/*/*/*/notification-queue.json';
foreach (glob($pattern) ?: [] as $queuePath) {
    try { pmq_process(dirname($queuePath), $config); } catch (Throwable $error) { error_log('Studio notification worker: ' . $error->getMessage()); }
}
