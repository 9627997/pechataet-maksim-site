<?php
declare(strict_types=1);
/** PM CALCULATOR public preliminary quote: no orders, no internal prices exposed. */
function pm_calc_reply(int $code, array $body): never {
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store, private');
    header('X-Content-Type-Options: nosniff');
    header('Referrer-Policy: same-origin');
    header('X-Robots-Tag: noindex');
    echo json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
    exit;
}
function pm_calc_method_allowed(): bool {
    $method = $_SERVER['REQUEST_METHOD'] ?? '';
    return $method === 'GET' || $method === 'POST';
}
function pm_calc_origin_ok(): bool {
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if ($origin === '') return true; // curl and same-origin GET may omit Origin
    $host = strtolower((string) ($_SERVER['HTTP_HOST'] ?? ''));
    $originHost = strtolower((string) parse_url($origin, PHP_URL_HOST));
    $originPort = parse_url($origin, PHP_URL_PORT);
    $port = parse_url('http://' . $host, PHP_URL_PORT);
    $originScheme = strtolower((string) parse_url($origin, PHP_URL_SCHEME));
    $isHttps = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
    return in_array($originScheme, ['http','https'], true)
        && $originScheme === ($isHttps ? 'https' : 'http')
        && $originHost === strtolower((string) parse_url('http://' . $host, PHP_URL_HOST))
        && ($originPort ?? ($originScheme === 'https' ? 443 : 80)) === ($port ?? ($isHttps ? 443 : 80));
}
function pm_calc_rate_limit(string $root): bool {
    $dir = $root . '/rate';
    if (!is_dir($dir) && !@mkdir($dir, 0700, true) && !is_dir($dir)) return false;
    $ip = (string) ($_SERVER['REMOTE_ADDR'] ?? 'unknown');
    $file = $dir . '/' . hash('sha256', $ip) . '.json';
    $handle = @fopen($file, 'c+');
    if (!$handle) return false;
    try {
        if (!flock($handle, LOCK_EX)) return false;
        $raw = stream_get_contents($handle);
        $hits = json_decode($raw ?: '[]', true);
        if (!is_array($hits)) $hits = [];
        $now = time();
        $hits = array_values(array_filter($hits, fn($x) => is_int($x) && $x > $now - 600 && $x <= $now));
        if (count($hits) >= 120) return false;
        $hits[] = $now;
        rewind($handle); ftruncate($handle, 0);
        fwrite($handle, json_encode($hits, JSON_THROW_ON_ERROR));
        fflush($handle);
        @chmod($file, 0600);
        return true;
    } finally { flock($handle, LOCK_UN); fclose($handle); }
}
try {
    if (!pm_calc_method_allowed()) pm_calc_reply(405, ['status'=>'rejected','code'=>'METHOD_NOT_ALLOWED']);
    if (!pm_calc_origin_ok()) pm_calc_reply(403, ['status'=>'rejected','code'=>'ORIGIN_DENIED']);
    $root = realpath((string) ($_SERVER['DOCUMENT_ROOT'] ?? ''));
    if ($root === false) pm_calc_reply(503, ['status'=>'unavailable']);
    $private = realpath(dirname($root) . '/private/pm-calc');
    if ($private === false || !is_file($private . '/config.php') || str_starts_with($private, $root . DIRECTORY_SEPARATOR)) {
        pm_calc_reply(503, ['status'=>'unavailable']);
    }
    $config = require $private . '/config.php';
    if (!is_array($config) || ($config['preview_enabled'] ?? false) !== true || ($config['mode'] ?? '') !== 'preliminary_only') {
        pm_calc_reply(503, ['status'=>'unavailable']);
    }
    require_once $private . '/PmCalcPreview.php';
    $engine = new PmCalcPreview($private.'/SNAPSHOT_ASSORTMENT_PRIVATE.json', $private.'/ASSORTMENT_PRIVATE.json');
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $rawOffers = $engine->visibleCatalog();
        if (!is_array($rawOffers) || !array_is_list($rawOffers) || !$rawOffers) {
            pm_calc_reply(503, ['status'=>'unavailable']);
        }
        $offers = [];
        foreach ($rawOffers as $offer) {
            // Explicit public projection: private engine fields must never become API fields.
            if (!is_array($offer) || !in_array($offer['type'] ?? null, ['ribbon', 'sticker'], true)) {
                pm_calc_reply(503, ['status'=>'unavailable']);
            }
            foreach (['geometry', 'base', 'print'] as $key) {
                if (!isset($offer[$key]) || !is_string($offer[$key]) || $offer[$key] === '') {
                    pm_calc_reply(503, ['status'=>'unavailable']);
                }
            }
            $offers[] = [
                'type' => $offer['type'],
                'geometry' => $offer['geometry'],
                'base' => $offer['base'],
                'print' => $offer['print'],
            ];
        }
        pm_calc_reply(200, ['status'=>'catalog', 'offers'=>$offers]);
    }
    if (!preg_match('~^application/json(?:\s*;.*)?$~i', (string) ($_SERVER['CONTENT_TYPE'] ?? ''))) {
        pm_calc_reply(415, ['status'=>'rejected','code'=>'CONTENT_TYPE']);
    }
    if ((int) ($_SERVER['CONTENT_LENGTH'] ?? 0) > 30000) {
        pm_calc_reply(413, ['status'=>'rejected','code'=>'REQUEST_TOO_LARGE']);
    }
    if (!pm_calc_rate_limit($private)) {
        pm_calc_reply(429, ['status'=>'rejected','code'=>'RATE_LIMIT']);
    }
    $raw = file_get_contents('php://input', false, null, 0, 30001);
    if (!is_string($raw) || strlen($raw) > 30000) {
        pm_calc_reply(413, ['status'=>'rejected','code'=>'REQUEST_TOO_LARGE']);
    }
    $payload = json_decode($raw, true, 32, JSON_THROW_ON_ERROR);
    if (!is_array($payload) || array_keys($payload) !== ['orderItems']) pm_calc_reply(422, ['status'=>'rejected','code'=>'INVALID_REQUEST']);
    $items = $payload['orderItems'];
    if (!is_array($items) || !array_is_list($items) || count($items) < 1 || count($items) > 6) {
        pm_calc_reply(422, ['status'=>'rejected','code'=>'ITEMS_LIMIT']);
    }
    $ribbons = 0; $stickers = 0;
    foreach ($items as $item) {
        if (!is_array($item)) pm_calc_reply(422, ['status'=>'rejected','code'=>'INVALID_ITEM']);
        if (($item['productType'] ?? '') === 'ribbon') $ribbons++;
        elseif (($item['productType'] ?? '') === 'sticker') $stickers++;
        else pm_calc_reply(422, ['status'=>'rejected','code'=>'INVALID_ITEM']);
    }
    if ($ribbons > 3 || $stickers > 3) pm_calc_reply(422, ['status'=>'rejected','code'=>'ITEMS_LIMIT']);
    // Public UX contract: ribbon increments of 5 m, stickers of 50 units.
    // This is an endpoint rule, not a mutation of the private Pricing 2.0 model.
    foreach ($items as $item) {
        $ribbon = $item['productType'] === 'ribbon';
        $quantity = $item['quantity'] ?? null;
        $key = $ribbon ? 'meters' : 'pieces';
        $step = $ribbon ? 5 : 50;
        if (!is_array($quantity) || !array_key_exists($key, $quantity)) {
            pm_calc_reply(422, ['status'=>'rejected','code'=>'QUANTITY_STEP']);
        }
        $raw = $quantity[$key];
        if (!is_string($raw) && !is_int($raw)) {
            pm_calc_reply(422, ['status'=>'rejected','code'=>'QUANTITY_STEP']);
        }
        $text = (string) $raw;
        if (!preg_match('/^[1-9][0-9]{0,5}$/D', $text)) {
            pm_calc_reply(422, ['status'=>'rejected','code'=>'QUANTITY_STEP']);
        }
        $number = (int) $text;
        if ($number < $step || $number > 100000 || $number % $step !== 0) {
            pm_calc_reply(422, ['status'=>'rejected','code'=>'QUANTITY_STEP']);
        }
    }
    $price = $engine->quote($payload);
    $amount = is_array($price) ? ($price['finalClientPrice'] ?? null) : null;
    $validMoney = (is_string($amount) && preg_match('/^(?:0|[1-9][0-9]{0,10})(?:\.[0-9]{1,2})?$/D', $amount) === 1)
        || (is_int($amount) && $amount > 0)
        || (is_float($amount) && is_finite($amount) && $amount > 0 && round($amount, 2) === $amount);
    if (!$validMoney || (float) $amount <= 0) {
        pm_calc_reply(503, ['status'=>'unavailable']);
    }
    // Never serialize engine rows or source files. Only a customer-facing total.
    pm_calc_reply(200, ['status'=>'estimate','finalClientPrice'=>$amount,'currency'=>'RUB','canSubmitOrder'=>false]);
} catch (Throwable $error) {
    // Deliberately do not leak filenames, costs, SKU variants or SQL/PHP traces.
    $known = ['OFFER_NOT_MAPPED','SAME_COLOR_BLOCKED','ORDER_ITEMS_INVALID','ITEM_INVALID','WIDTH_INVALID','CONFIG_INVALID','QUANTITY_INVALID'];
    $code = $error->getMessage();
    if (in_array($code, $known, true)) pm_calc_reply(422, ['status'=>'rejected','code'=>'UNSUPPORTED_COMBINATION']);
    if ($error instanceof JsonException) pm_calc_reply(400, ['status'=>'rejected','code'=>'INVALID_JSON']);
    error_log('PM CALC: preliminary quote unavailable');
    pm_calc_reply(503, ['status'=>'unavailable']);
}