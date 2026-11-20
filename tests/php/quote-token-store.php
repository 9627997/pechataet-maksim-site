<?php
declare(strict_types=1);
require_once dirname(__DIR__, 2) . '/api/calc/PmQuoteTokenStore.php';
$dir = sys_get_temp_dir() . '/pm-quote-test-' . bin2hex(random_bytes(6));
try {
    $store = new PmQuoteTokenStore($dir);
    $sha = str_repeat('a', 64);
    $items = [['itemId' => 'test-1', 'productType' => 'ribbon', 'quantity' => ['meters' => '5']]];
    $issued = $store->issue($items, '490.00', $sha);
    assert(strlen($issued['quoteId']) === 48);
    $record = $store->resolve($issued['quoteId'], $sha);
    assert($record['orderItems'] === $items);
    assert($record['finalClientPrice'] === '490.00');
    try {
        $store->resolve($issued['quoteId'], str_repeat('b', 64));
        throw new RuntimeException('Stale snapshot should be rejected');
    } catch (InvalidArgumentException $error) {
        assert($error->getMessage() === 'QUOTE_STALE');
    }
    try {
        $store->resolve('not-a-token', $sha);
        throw new RuntimeException('Bad token should be rejected');
    } catch (InvalidArgumentException $error) {
        assert($error->getMessage() === 'QUOTE_NOT_FOUND');
    }
    $path = $dir . '/' . hash('sha256', $issued['quoteId']) . '.json';
    $data = json_decode(file_get_contents($path), true, 32, JSON_THROW_ON_ERROR);
    $data['issuedAt'] -= 4000;
    $data['expiresAt'] -= 4000;
    file_put_contents($path, json_encode($data, JSON_THROW_ON_ERROR));
    try {
        $store->resolve($issued['quoteId'], $sha);
        throw new RuntimeException('Expired token should be rejected');
    } catch (InvalidArgumentException $error) {
        assert(in_array($error->getMessage(), ['QUOTE_INVALID', 'QUOTE_EXPIRED'], true));
    }
    echo "PASS: opaque token, snapshot invalidation, expiration, private storage\n";
} finally {
    foreach (glob($dir . '/*') ?: [] as $path) @unlink($path);
    @rmdir($dir);
}
