<?php
declare(strict_types=1);
require_once dirname(__DIR__, 2) . '/api/calc/PmQuoteTokenStore.php';
$root = sys_get_temp_dir() . '/pm-quote-test-' . bin2hex(random_bytes(6));
$dir = $root . '/quote-tokens';
try {
    $store = new PmQuoteTokenStore($dir);
    $sha = str_repeat('a', 64);
    $items = [['itemId' => 'test-1', 'productType' => 'ribbon', 'quantity' => ['meters' => '5']]];
    $issued = $store->issue($items, '490.00', $sha);
    assert(strlen($issued['quoteId']) === 48);
    $record = $store->resolve($issued['quoteId'], $sha);
    assert($record['orderItems'] === $items);
    assert($record['finalClientPrice'] === '490.00');
    assert($record['pricingModelId'] === 'pricing2');
    $model3 = $store->issue($items, '510.00', $sha, 'pricing3');
    assert($store->resolve($model3['quoteId'], $sha, 'pricing3')['finalClientPrice'] === '510.00');
    try {
        $store->resolve($model3['quoteId'], $sha, 'pricing2');
        throw new RuntimeException('Cross-pricing-model quote must be rejected');
    } catch (InvalidArgumentException $error) {
        assert($error->getMessage() === 'QUOTE_STALE');
    }
    // Schema 1 tokens existed only under Pricing 2. Preserve short TTL
    // compatibility after introducing explicit identity in schema 2.
    $legacyPath = $dir . '/' . hash('sha256', $issued['quoteId']) . '.json';
    $legacy = json_decode(file_get_contents($legacyPath), true, 32, JSON_THROW_ON_ERROR);
    assert($legacy['schema'] === 2 && $legacy['pricingModelId'] === 'pricing2');
    $legacy['schema'] = 1;
    unset($legacy['pricingModelId']);
    file_put_contents($legacyPath, json_encode($legacy, JSON_THROW_ON_ERROR));
    assert($store->resolve($issued['quoteId'], $sha)['pricingModelId'] === 'pricing2');
    try {
        $store->resolve($issued['quoteId'], $sha, 'pricing3');
        throw new RuntimeException('Legacy token must not verify as Pricing 3');
    } catch (InvalidArgumentException $error) {
        assert($error->getMessage() === 'QUOTE_STALE');
    }

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
    // resolve() already deletes expired records; recreate one to test GC.
    file_put_contents($path, json_encode($data, JSON_THROW_ON_ERROR));
    // Active token and its claim remain untouched; an expired token and its
    // claim are pruned without clearing a different active token.
    $live = $store->issue($items, '490.00', $sha);
    $liveHash = hash('sha256', $live['quoteId']);
    $claims = dirname($dir) . '/quote-claims';
    @mkdir($claims, 0700, true);
    $expiredClaim = $claims . '/' . hash('sha256', $issued['quoteId']) . '.txt';
    $liveClaim = $claims . '/' . $liveHash . '.txt';
    file_put_contents($expiredClaim, 'request-expired-000001');
    file_put_contents($liveClaim, 'request-active-0000001');
    assert($store->pruneExpired() === 1);
    assert(!is_file($path));
    assert(!is_file($expiredClaim));
    assert(is_file($liveClaim));
    assert($store->resolve($live['quoteId'], $sha)['finalClientPrice'] === '490.00');

    // A fresh broken record is not deleted immediately; only old corrupted
    // artifacts are eligible for cleanup after a 2*TTL grace period.
    $badPath = $dir . '/' . str_repeat('c', 64) . '.json';
    file_put_contents($badPath, '{broken');
    assert($store->pruneExpired() === 0);
    touch($badPath, time() - 4000);
    assert($store->pruneExpired() === 1);
    assert(!file_exists($badPath));
    assert(is_file($liveClaim));
    // Expiry during normal resolve must also clean the corresponding claim.
    $onDemand = $store->issue($items, '490.00', $sha);
    $onDemandHash = hash('sha256', $onDemand['quoteId']);
    $onDemandPath = $dir . '/' . $onDemandHash . '.json';
    $onDemandClaim = $claims . '/' . $onDemandHash . '.txt';
    $onDemandData = json_decode(file_get_contents($onDemandPath), true, 32, JSON_THROW_ON_ERROR);
    $onDemandData['issuedAt'] -= 4000;
    $onDemandData['expiresAt'] -= 4000;
    file_put_contents($onDemandPath, json_encode($onDemandData, JSON_THROW_ON_ERROR));
    file_put_contents($onDemandClaim, 'request-expired-000002');
    try {
        $store->resolve($onDemand['quoteId'], $sha);
        throw new RuntimeException('Expired token should be rejected');
    } catch (InvalidArgumentException $error) {
        assert($error->getMessage() === 'QUOTE_EXPIRED');
    }
    assert(!is_file($onDemandPath));
    assert(!is_file($onDemandClaim));

    @unlink($liveClaim);
    @rmdir($claims);
    echo "PASS: opaque token, snapshot invalidation, expiration, private storage\n";
} finally {
    foreach (glob($dir . '/*') ?: [] as $path) @unlink($path);
    @rmdir($dir);
    @rmdir($root);
}
