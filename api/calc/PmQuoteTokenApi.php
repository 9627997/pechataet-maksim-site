<?php
declare(strict_types=1);

/**
 * Server-only bridge between an already validated Pricing 2 quote and an
 * opaque short-lived token. This class does not contain private price rules.
 *
 * All calls are additionally gated by private config in api/calc/index.php.
 */
final class PmQuoteTokenApi
{
    private PmQuoteTokenStore $store;
    private object $engine;
    private string $snapshotSha;

    public function __construct(string $privateRoot, object $engine)
    {
        // A snapshot change is not the only way prices can change: PHP model
        // and assortment inputs must invalidate previously issued quotes too.
        $parts = [];
        foreach ([
            'SNAPSHOT_ASSORTMENT_PRIVATE.json',
            'ASSORTMENT_PRIVATE.json',
            'PmCalcPreview.php',
        ] as $required) {
            $path = $privateRoot . '/' . $required;
            $hash = is_file($path) ? hash_file('sha256', $path) : false;
            if (!is_string($hash) || !preg_match('/^[a-f0-9]{64}$/D', $hash)) {
                throw new RuntimeException('QUOTE_UNAVAILABLE');
            }
            $parts[] = $required . ':' . $hash;
        }
        // Older signed bundles may not have every helper file; bind those
        // that exist and record absence to prevent a later silent change.
        foreach (['ExactPricing.php', 'BigNat.php', 'PmOrderRounding.php'] as $helper) {
            $path = $privateRoot . '/' . $helper;
            $hash = is_file($path) ? hash_file('sha256', $path) : false;
            $parts[] = $helper . ':' . ($hash === false ? 'absent' : $hash);
        }
        $this->snapshotSha = hash('sha256', implode('|', $parts));
        $this->store = new PmQuoteTokenStore($privateRoot . '/quote-tokens');
        $this->engine = $engine;
    }

    private static function exactKeys(array $value, array $keys): bool
    {
        $actual = array_keys($value);
        sort($actual);
        sort($keys);
        return $actual === $keys;
    }

    private static function color($value, bool $transparent = false): string
    {
        if ($transparent && $value === 'transparent') return 'transparent';
        if (!is_string($value) || !preg_match('/^#[a-fA-F0-9]{6}$/D', $value)) {
            throw new InvalidArgumentException('QUOTE_INVALID');
        }
        return strtolower($value);
    }

    private static function quantity($value, int $step): string
    {
        if (!is_int($value) && !is_string($value)) throw new InvalidArgumentException('QUOTE_INVALID');
        $text = (string) $value;
        if (!preg_match('/^[1-9][0-9]{0,5}$/D', $text)) throw new InvalidArgumentException('QUOTE_INVALID');
        $number = (int) $text;
        if ($number < $step || $number > 100000 || $number % $step !== 0) {
            throw new InvalidArgumentException('QUOTE_INVALID');
        }
        return $text;
    }

    public static function canonicalItems(array $items): array
    {
        if (!array_is_list($items) || count($items) < 1 || count($items) > 6) {
            throw new InvalidArgumentException('QUOTE_INVALID');
        }
        $result = [];
        $ids = [];
        $ribbonCount = 0;
        $stickerCount = 0;
        foreach ($items as $item) {
            if (!is_array($item) || !self::exactKeys($item, ['itemId', 'productType', 'quantity', 'configuration'])) {
                throw new InvalidArgumentException('QUOTE_INVALID');
            }
            $id = $item['itemId'];
            if (!is_string($id) || !preg_match('/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/D', $id) || isset($ids[$id])) {
                throw new InvalidArgumentException('QUOTE_INVALID');
            }
            $ids[$id] = true;
            $type = $item['productType'];
            $quantity = $item['quantity'];
            $configuration = $item['configuration'];
            if (!is_array($quantity) || !is_array($configuration)) {
                throw new InvalidArgumentException('QUOTE_INVALID');
            }
            if ($type === 'ribbon') {
                $ribbonCount++;
                if ($ribbonCount > 3 || !self::exactKeys($quantity, ['meters'])
                    || !self::exactKeys($configuration, ['widthMm', 'repeatMm', 'materialColor', 'printColor'])) {
                    throw new InvalidArgumentException('QUOTE_INVALID');
                }
                $width = $configuration['widthMm'];
                $repeat = $configuration['repeatMm'];
                if (!is_int($width) || !in_array($width, [15, 20], true)
                    || (!is_int($repeat) && !is_float($repeat))
                    || !is_finite((float) $repeat) || $repeat < 5 || $repeat > 500
                    || round((float) $repeat, 1) !== (float) $repeat) {
                    throw new InvalidArgumentException('QUOTE_INVALID');
                }
                $normalizedQuantity = ['meters' => self::quantity($quantity['meters'], 5)];
                $normalizedConfiguration = [
                    'widthMm' => $width,
                    'repeatMm' => $repeat,
                    'materialColor' => self::color($configuration['materialColor']),
                    'printColor' => self::color($configuration['printColor']),
                ];
            } elseif ($type === 'sticker') {
                $stickerCount++;
                if ($stickerCount > 3 || !self::exactKeys($quantity, ['pieces'])
                    || !self::exactKeys($configuration, [
                        'variantId', 'shape', 'widthMm', 'heightMm',
                        'cornerRadiusMm', 'printColor', 'backgroundColor'
                    ])) {
                    throw new InvalidArgumentException('QUOTE_INVALID');
                }
                $variant = $configuration['variantId'];
                $shape = $configuration['shape'];
                $width = $configuration['widthMm'];
                $height = $configuration['heightMm'];
                $radius = $configuration['cornerRadiusMm'];
                if (!is_string($variant)
                    || !preg_match('/^(?:circle-(?:24|25|30|40|50)|roundrect-80x20)$/D', $variant)
                    || !is_int($width) || !is_int($height)) {
                    throw new InvalidArgumentException('QUOTE_INVALID');
                }
                if ($variant === 'roundrect-80x20') {
                    if ($shape !== 'roundrect' || $width !== 80 || $height !== 20 || $radius !== 2) {
                        throw new InvalidArgumentException('QUOTE_INVALID');
                    }
                } else {
                    $diameter = (int) substr($variant, 7);
                    if ($shape !== 'circle' || $width !== $diameter || $height !== $diameter || $radius !== null) {
                        throw new InvalidArgumentException('QUOTE_INVALID');
                    }
                }
                $normalizedQuantity = ['pieces' => self::quantity($quantity['pieces'], 50)];
                $normalizedConfiguration = [
                    'variantId' => $variant,
                    'shape' => $shape,
                    'widthMm' => $width,
                    'heightMm' => $height,
                    'cornerRadiusMm' => $radius,
                    'printColor' => self::color($configuration['printColor']),
                    'backgroundColor' => self::color($configuration['backgroundColor'], true),
                ];
            } else {
                throw new InvalidArgumentException('QUOTE_INVALID');
            }
            $result[] = [
                'itemId' => $id,
                'productType' => $type,
                'quantity' => $normalizedQuantity,
                'configuration' => $normalizedConfiguration,
            ];
        }
        return $result;
    }

    private static function canonicalMoney($amount): string
    {
        if (is_int($amount) && $amount > 0) return (string) $amount . '.00';
        if (is_float($amount) && is_finite($amount) && $amount > 0 && $amount < 1000000000
            && round($amount, 2) === $amount) {
            return number_format($amount, 2, '.', '');
        }
        if (!is_string($amount) || !preg_match('/^[1-9][0-9]{0,8}(?:\.[0-9]{1,2})?$/D', $amount)) {
            throw new RuntimeException('QUOTE_UNAVAILABLE');
        }
        $parts = explode('.', $amount);
        return $parts[0] . '.' . str_pad($parts[1] ?? '', 2, '0');
    }

    public function issue(array $items): array
    {
        // Always re-quote on the server. Client-supplied price is never accepted.
        $canonical = self::canonicalItems($items);
        $price = $this->engine->quote(['orderItems' => $canonical]);
        if (!is_array($price)) throw new RuntimeException('QUOTE_UNAVAILABLE');
        $amount = self::canonicalMoney($price['finalClientPrice'] ?? null);
        $issued = $this->store->issue($canonical, $amount, $this->snapshotSha);
        return [
            'status' => 'quote_issued',
            'quoteId' => $issued['quoteId'],
            'expiresAt' => $issued['expiresAt'],
            'finalClientPrice' => $amount,
            'currency' => 'RUB',
            'canSubmitOrder' => false,
        ];
    }

    /**
     * Recheck a token against the exact browser-submitted basket at order time.
     * Never treat the amount saved in the browser as evidence of a server quote.
     */
    public function verifyForOrder(string $token, array $submittedItems): array
    {
        $record = $this->store->resolve($token, $this->snapshotSha);
        $items = self::canonicalItems($submittedItems);
        if ($items !== $record['orderItems']) {
            throw new InvalidArgumentException('QUOTE_BASKET_CHANGED');
        }
        // The original quote is preliminary; it cannot survive a price change
        // even if the snapshot fingerprint were accidentally held constant.
        $price = $this->engine->quote(['orderItems' => $items]);
        if (!is_array($price) ||
            self::canonicalMoney($price['finalClientPrice'] ?? null) !== $record['finalClientPrice']) {
            throw new InvalidArgumentException('QUOTE_STALE');
        }
        return [
            'orderItems' => $record['orderItems'],
            'finalClientPrice' => $record['finalClientPrice'],
            'expiresAt' => $record['expiresAt'],
        ];
    }

    public function resolve(string $token): array
    {
        $found = $this->store->resolve($token, $this->snapshotSha);
        return [
            'status' => 'quote_resolved',
            'orderItems' => $found['orderItems'],
            'expiresAt' => $found['expiresAt'],
            'finalClientPrice' => $found['finalClientPrice'],
            'currency' => 'RUB',
            'canSubmitOrder' => false,
        ];
    }
}
