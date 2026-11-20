<?php
declare(strict_types=1);
require_once dirname(__DIR__, 2) . '/api/calc/PmQuoteTokenStore.php';
require_once dirname(__DIR__, 2) . '/api/calc/PmQuoteTokenApi.php';

$root = sys_get_temp_dir() . '/pm-quote-api-test-' . bin2hex(random_bytes(8));
$private = $root . '/private/pm-calc';
$public = $root . '/site';
@mkdir($private, 0700, true);
@mkdir($public, 0700, true);
file_put_contents($private . '/SNAPSHOT_ASSORTMENT_PRIVATE.json', '{"version":1}');
file_put_contents($private . '/ASSORTMENT_PRIVATE.json', '{}');
file_put_contents($private . '/PmCalcPreview.php', '<?php // test-only pricing engine fingerprint');
$_SERVER['DOCUMENT_ROOT'] = $public;

$engine = new class {
    public int $calls = 0;
    public function quote(array $payload): array {
        $this->calls++;
        foreach ($payload['orderItems'] as $item) {
            if ($item['productType'] === 'ribbon' && $item['configuration']['materialColor'] === '#000000') {
                throw new InvalidArgumentException('OFFER_NOT_MAPPED');
            }
        }
        return ['finalClientPrice' => '490.00'];
    }
};
$ribbon = [
    'itemId' => 'item-ribbon-1',
    'productType' => 'ribbon',
    'quantity' => ['meters' => '5'],
    'configuration' => [
        'widthMm' => 15, 'repeatMm' => 100,
        'materialColor' => '#F3EADC', 'printColor' => '#171717'
    ]
];
$sticker = [
    'itemId' => 'item-sticker-1',
    'productType' => 'sticker',
    'quantity' => ['pieces' => '50'],
    'configuration' => [
        'variantId' => 'circle-25', 'shape' => 'circle',
        'widthMm' => 25, 'heightMm' => 25, 'cornerRadiusMm' => null,
        'printColor' => '#171717', 'backgroundColor' => '#FF0000'
    ]
];
$assertFail = static function (callable $fn) {
    try {
        $fn();
        throw new RuntimeException('Expected rejection did not happen');
    } catch (InvalidArgumentException $error) {
        assert(in_array($error->getMessage(), ['QUOTE_INVALID', 'OFFER_NOT_MAPPED', 'QUOTE_STALE', 'QUOTE_NOT_FOUND'], true));
    }
};

try {
    $api = new PmQuoteTokenApi($private, $engine);
    $issued = $api->issue([$ribbon, $sticker]);
    assert($issued['status'] === 'quote_issued');
    assert($issued['finalClientPrice'] === '490.00');
    assert($issued['canSubmitOrder'] === false);
    assert(strlen($issued['quoteId']) === 48);
    assert($engine->calls === 1);
    $resolved = $api->resolve($issued['quoteId']);
    assert($resolved['status'] === 'quote_resolved');
    assert($resolved['canSubmitOrder'] === false);
    assert(count($resolved['orderItems']) === 2);
    assert($resolved['orderItems'][0]['configuration']['materialColor'] === '#f3eadc');
    assert($resolved['orderItems'][1]['configuration']['backgroundColor'] === '#ff0000');
    assert($engine->calls === 1); // resolve reads an immutable record, never re-prices it

    $assertFail(fn () => $api->issue([array_merge($ribbon, ['extraCost' => 1])]));
    $assertFail(fn () => $api->issue([$ribbon, $ribbon]));
    $assertFail(fn () => $api->issue([array_replace_recursive($ribbon, ['quantity' => ['meters' => '6']])]));
    $assertFail(fn () => $api->issue([array_replace_recursive($sticker, ['quantity' => ['pieces' => '75']])]));
    $assertFail(fn () => $api->issue([array_replace_recursive($sticker, ['configuration' => ['widthMm' => 30]])]));
    $assertFail(fn () => $api->issue([array_replace_recursive($ribbon, ['configuration' => ['materialColor' => '#000000']])]));
    $assertFail(fn () => $api->issue([array_replace_recursive($ribbon, ['configuration' => ['extra' => 1]])]));
    $assertFail(fn () => $api->issue(array_fill(0, 4, $ribbon)));
    $assertFail(fn () => $api->resolve('this-is-not-a-token'));

    $large = [];
    for ($i = 0; $i < 3; $i++) {
        $r = $ribbon; $r['itemId'] = 'r-' . $i;
        $s = $sticker; $s['itemId'] = 's-' . $i;
        $large[] = $r;
        $large[] = $s;
    }
    assert(count($api->resolve($api->issue($large)['quoteId'])['orderItems']) === 6);
    file_put_contents($private . '/SNAPSHOT_ASSORTMENT_PRIVATE.json', '{"version":2}');
    $newApi = new PmQuoteTokenApi($private, $engine);
    $assertFail(fn () => $newApi->resolve($issued['quoteId']));
    assert($engine->calls === 3); // two successful issue calls, one rejected by fake engine
    echo "PASS: quote API issuance, canonical 3+3, rejected tampering, snapshot invalidation\n";
} finally {
    foreach (glob($private . '/quote-tokens/*') ?: [] as $file) @unlink($file);
    @rmdir($private . '/quote-tokens');
    @unlink($private . '/SNAPSHOT_ASSORTMENT_PRIVATE.json');
    @unlink($private . '/ASSORTMENT_PRIVATE.json');
    @unlink($private . '/PmCalcPreview.php');
    @rmdir($private);
    @rmdir(dirname($private));
    @rmdir($public);
    @rmdir($root);
}
