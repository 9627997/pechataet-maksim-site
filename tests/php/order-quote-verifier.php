<?php
declare(strict_types=1);

require_once dirname(__DIR__, 2) . '/api/calc/PmQuoteTokenStore.php';
require_once dirname(__DIR__, 2) . '/api/calc/PmQuoteTokenApi.php';
require_once dirname(__DIR__, 2) . '/api/orders/PmOrderQuoteVerifier.php';

$root = sys_get_temp_dir() . '/pm-order-quote-' . bin2hex(random_bytes(6));
$web = $root . '/site';
$private = $root . '/private/pm-calc';
@mkdir($web, 0700, true);
@mkdir($private, 0700, true);
$stub = <<<'PHP'
<?php
declare(strict_types=1);
final class PmCalcPreview {
    public function __construct(string $snapshot, string $assortment) {}
    public function quote(array $payload): array {
        if (count($payload['orderItems'] ?? []) < 1) {
            throw new InvalidArgumentException('ORDER_ITEMS_INVALID');
        }
        return ['finalClientPrice' => '490.00'];
    }
}
PHP;
$items = [[
    'itemId' => 'item-1', 'productType' => 'ribbon',
    'quantity' => ['meters' => '5'],
    'configuration' => [
        'widthMm' => 15, 'repeatMm' => 100,
        'materialColor' => '#f3eadc', 'printColor' => '#171717',
    ],
]];
$rejects = static function (callable $fn, array $messages): void {
    try {
        $fn();
        throw new RuntimeException('Expected rejection');
    } catch (InvalidArgumentException $error) {
        assert(in_array($error->getMessage(), $messages, true));
    }
};
$cleanup = static function (string $path) use (&$cleanup): void {
    if (!file_exists($path)) return;
    if (is_dir($path)) {
        foreach (scandir($path) as $name) {
            if ($name === '.' || $name === '..') continue;
            $cleanup($path . '/' . $name);
        }
        @rmdir($path);
    } else {
        @unlink($path);
    }
};
try {
    file_put_contents($private . '/config.php', "<?php return ['preview_enabled'=>true,'mode'=>'preliminary_only','quote_tokens_enabled'=>true];");
    file_put_contents($private . '/PmCalcPreview.php', $stub);
    file_put_contents($private . '/ASSORTMENT_PRIVATE.json', '{}');
    file_put_contents($private . '/SNAPSHOT_ASSORTMENT_PRIVATE.json', '{"version":1}');
    require_once $private . '/PmCalcPreview.php';
    $api = new PmQuoteTokenApi($private, new PmCalcPreview('', ''));
    $issued = $api->issue($items);
    $reqId = 'request-0000000001';
    $input = ['requestId' => $reqId, 'quoteId' => $issued['quoteId'], 'orderItems' => $items];
    assert(PmOrderQuoteVerifier::verify($input, $web)['orderItems'] === $items);
    assert(PmOrderQuoteVerifier::verify($input, $web)['verifiedPreliminaryAmount'] === '490.00');
    $rejects(
        fn () => PmOrderQuoteVerifier::verify(array_merge($input, ['requestId'=>'request-0000000002']), $web),
        ['QUOTE_REPLAY']
    );
    $tampered = $input;
    $tampered['orderItems'][0]['quantity']['meters'] = '10';
    $rejects(fn () => PmOrderQuoteVerifier::verify($tampered, $web), ['QUOTE_BASKET_CHANGED']);
    $old = $input;
    $old['quoteId'] = str_repeat('0', 48);
    $rejects(fn () => PmOrderQuoteVerifier::verify($old, $web), ['QUOTE_NOT_FOUND']);
    file_put_contents($private . '/SNAPSHOT_ASSORTMENT_PRIVATE.json', '{"version":2}');
    $rejects(fn () => PmOrderQuoteVerifier::verify($input, $web), ['QUOTE_STALE']);
    file_put_contents($private . '/config.php', "<?php return ['preview_enabled'=>true,'mode'=>'preliminary_only'];");
    $rejects(fn () => PmOrderQuoteVerifier::verify($input, $web), ['QUOTE_NOT_ENABLED']);
    assert(PmOrderQuoteVerifier::verify(['requestId'=>$reqId, 'orderItems'=>$items], $web) === null);
    echo "PASS: verified full linked basket, replay control, tampering, snapshot, disabled fallback\n";
} finally {
    $cleanup($root);
}
