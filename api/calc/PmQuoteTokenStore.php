<?php
declare(strict_types=1);

/**
 * Opaque quote-token storage; no confidential price model in this file.
 * NOT wired into any public route until QuoteId contract and order validation pass.
 */
final class PmQuoteTokenStore
{
    private const TTL_SECONDS = 1800;
    private const MAX_BYTES = 30000;
    private string $directory;

    public function __construct(string $directory)
    {
        if (!is_dir($directory) && !@mkdir($directory, 0700, true) && !is_dir($directory)) {
            throw new RuntimeException('QUOTE_STORAGE_UNAVAILABLE');
        }
        $actual = realpath($directory);
        $webRootInput = (string) ($_SERVER['DOCUMENT_ROOT'] ?? '');
        $webRoot = $webRootInput !== '' ? realpath($webRootInput) : false;
        $webPrefix = $webRoot !== false ? rtrim($webRoot, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR : '';
        if ($actual === false
            || ($webRoot !== false && ($actual === $webRoot || str_starts_with($actual, $webPrefix)))
            || ((fileperms($actual) & 0077) !== 0)) {
            throw new RuntimeException('QUOTE_STORAGE_UNSAFE');
        }
        $this->directory = $actual;
    }

    private function path(string $token): string
    {
        if (!preg_match('/^[a-f0-9]{48}$/D', $token)) {
            throw new InvalidArgumentException('QUOTE_NOT_FOUND');
        }
        return $this->directory . '/' . hash('sha256', $token) . '.json';
    }

    public function issue(array $canonicalItems, string $clientAmount, string $snapshotSha, string $pricingModelId = 'pricing2'): array
    {
        if (!array_is_list($canonicalItems) || count($canonicalItems) < 1 || count($canonicalItems) > 6
            || !preg_match('/^(?:0|[1-9][0-9]{0,10})(?:\.[0-9]{1,2})?$/D', $clientAmount)
            || (float) $clientAmount <= 0
            || !preg_match('/^[a-f0-9]{64}$/D', $snapshotSha)
            || !preg_match('/^pricing[1-9][0-9]?$/D', $pricingModelId)) {
            throw new InvalidArgumentException('QUOTE_INVALID');
        }
        $token = bin2hex(random_bytes(24));
        $now = time();
        $record = [
            'schema' => 2,
            'pricingModelId' => $pricingModelId,
            'issuedAt' => $now,
            'expiresAt' => $now + self::TTL_SECONDS,
            'snapshotSha' => $snapshotSha,
            'orderItems' => $canonicalItems,
            'finalClientPrice' => $clientAmount,
        ];
        $data = json_encode($record, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
        if (strlen($data) > self::MAX_BYTES) throw new InvalidArgumentException('QUOTE_TOO_LARGE');
        $filename = $this->path($token);
        $handle = @fopen($filename, 'x');
        if ($handle === false) throw new RuntimeException('QUOTE_STORAGE_UNAVAILABLE');
        try {
            @chmod($filename, 0600);
            if (fwrite($handle, $data) !== strlen($data) || !fflush($handle)) {
                throw new RuntimeException('QUOTE_STORAGE_UNAVAILABLE');
            }
        } catch (Throwable $error) {
            @unlink($filename);
            throw $error;
        } finally {
            fclose($handle);
        }
        // Spread bounded maintenance over successful issues; no cron needed.
        // Failure to clean expired files must not affect a customer quote.
        if (random_int(1, 16) === 1) $this->pruneExpired();
        return ['quoteId' => $token, 'expiresAt' => $record['expiresAt']];
    }

    /**
     * Best-effort bounded cleanup of expired token files and linked claims.
     * Only hashed filenames inside the private 0700 directory are visited.
     * Active quotes are never removed; a malformed record must age for at
     * least twice the TTL before it is eligible for deletion.
     */
    private function removeExpiredRecord(string $recordPath, string $hash): bool
    {
        if (!preg_match('/^[a-f0-9]{64}$/D', $hash) || !@unlink($recordPath)) return false;
        $claims = dirname($this->directory) . '/quote-claims';
        if (is_dir($claims) && !is_link($claims)) {
            $claim = $claims . '/' . $hash . '.txt';
            if (is_file($claim) && !is_link($claim)) @unlink($claim);
        }
        return true;
    }

    public function pruneExpired(int $maxScanned = 256): int
    {
        if ($maxScanned < 1 || $maxScanned > 1024) {
            throw new InvalidArgumentException('QUOTE_INVALID');
        }
        $removed = 0;
        $scanned = 0;
        $now = time();
        try {
            $entries = new DirectoryIterator($this->directory);
            foreach ($entries as $entry) {
                if ($scanned >= $maxScanned) break;
                if (!$entry->isFile() || $entry->isLink()) continue;
                $name = $entry->getFilename();
                if (!preg_match('/^[a-f0-9]{64}\\.json$/D', $name)) continue;
                $scanned++;
                $path = $this->directory . '/' . $name;
                $raw = @file_get_contents($path, false, null, 0, self::MAX_BYTES + 1);
                $data = is_string($raw) && strlen($raw) <= self::MAX_BYTES
                    ? json_decode($raw, true)
                    : null;
                $expiresAt = is_array($data) ? ($data['expiresAt'] ?? null) : null;
                // Broken/incomplete records are allowed a long grace period.
                $oldMalformed = !is_int($expiresAt)
                    && $entry->getMTime() + self::TTL_SECONDS * 2 <= $now;
                if (!(is_int($expiresAt) && $expiresAt <= $now) && !$oldMalformed) {
                    continue;
                }
                if (!$this->removeExpiredRecord($path, substr($name, 0, -5))) continue;
                $removed++;
            }
        } catch (Throwable $error) {
            // Garbage collection must never cause a valid quote to fail.
            return $removed;
        }
        return $removed;
    }

    public function resolve(string $token, string $currentSnapshotSha, string $expectedPricingModelId = 'pricing2'): array
    {
        if (!preg_match('/^[a-f0-9]{64}$/D', $currentSnapshotSha)
            || !preg_match('/^pricing[1-9][0-9]?$/D', $expectedPricingModelId)) {
            throw new InvalidArgumentException('QUOTE_INVALID');
        }
        $filename = $this->path($token);
        $raw = @file_get_contents($filename, false, null, 0, self::MAX_BYTES + 1);
        if (!is_string($raw) || strlen($raw) > self::MAX_BYTES) {
            throw new InvalidArgumentException('QUOTE_NOT_FOUND');
        }
        try {
            $data = json_decode($raw, true, 32, JSON_THROW_ON_ERROR);
        } catch (JsonException $error) {
            throw new InvalidArgumentException('QUOTE_INVALID', 0, $error);
        }
        if (!is_array($data) || !in_array($data['schema'] ?? null, [1, 2], true)
            || !is_int($data['expiresAt'] ?? null)
            || !is_int($data['issuedAt'] ?? null)
            || $data['issuedAt'] > time()
            || $data['expiresAt'] - $data['issuedAt'] !== self::TTL_SECONDS
            || !is_array($data['orderItems'] ?? null)
            || !array_is_list($data['orderItems'])
            || count($data['orderItems']) < 1 || count($data['orderItems']) > 6
            || !is_string($data['finalClientPrice'] ?? null)) {
            throw new InvalidArgumentException('QUOTE_INVALID');
        }
        // Previous schema-1 tokens were issued exclusively by Pricing 2.
        // Keep their short-lived compatibility while refusing model mixing.
        $recordModel = $data['schema'] === 1 ? 'pricing2' : ($data['pricingModelId'] ?? null);
        if (!is_string($recordModel) || !preg_match('/^pricing[1-9][0-9]?$/D', $recordModel)) {
            throw new InvalidArgumentException('QUOTE_INVALID');
        }
        if ($data['expiresAt'] <= time()) {
            $this->removeExpiredRecord($filename, hash('sha256', $token));
            throw new InvalidArgumentException('QUOTE_EXPIRED');
        }
        if (!hash_equals($expectedPricingModelId, $recordModel)) {
            throw new InvalidArgumentException('QUOTE_STALE');
        }
        if (!is_string($data['snapshotSha'] ?? null)
            || !hash_equals($currentSnapshotSha, $data['snapshotSha'])) {
            throw new InvalidArgumentException('QUOTE_STALE');
        }
        return [
            'orderItems' => $data['orderItems'],
            'pricingModelId' => $recordModel,
            'finalClientPrice' => $data['finalClientPrice'],
            'expiresAt' => $data['expiresAt'],
        ];
    }
}
