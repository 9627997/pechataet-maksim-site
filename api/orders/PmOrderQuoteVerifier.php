<?php
declare(strict_types=1);

/**
 * Optional server-verified calculator basket attached to a Studio request.
 * A linked basket stays preliminary and requires manual artwork/production
 * review. This file has no private formulas or procurement information.
 */
final class PmOrderQuoteVerifier
{
    public static function verify(array $input, string $documentRoot): ?array
    {
        if (!array_key_exists('quoteId', $input)) {
            return null; // Existing Studio requests remain fully compatible.
        }
        $token = $input['quoteId'];
        if (!is_string($token) || !preg_match('/^[a-f0-9]{48}$/D', $token)
            || !is_array($input['orderItems'] ?? null)) {
            throw new InvalidArgumentException('QUOTE_INVALID');
        }
        $root = realpath($documentRoot);
        $private = $root !== false ? realpath(dirname($root) . '/private/pm-calc') : false;
        if ($root === false || $private === false
            || str_starts_with($private, $root . DIRECTORY_SEPARATOR)
            || !is_file($private . '/config.php') || !is_file($private . '/PmCalcPreview.php')) {
            throw new RuntimeException('QUOTE_UNAVAILABLE');
        }
        $config = require $private . '/config.php';
        if (!is_array($config) || ($config['preview_enabled'] ?? false) !== true
            || ($config['mode'] ?? null) !== 'preliminary_only'
            || ($config['quote_tokens_enabled'] ?? false) !== true) {
            throw new InvalidArgumentException('QUOTE_NOT_ENABLED');
        }
        require_once dirname(__DIR__) . '/calc/PmQuoteTokenStore.php';
        require_once dirname(__DIR__) . '/calc/PmQuoteTokenApi.php';
        require_once $private . '/PmCalcPreview.php';
        $engine = new PmCalcPreview(
            $private . '/SNAPSHOT_ASSORTMENT_PRIVATE.json',
            $private . '/ASSORTMENT_PRIVATE.json'
        );
        $service = new PmQuoteTokenApi($private, $engine);
        $verified = $service->verifyForOrder($token, $input['orderItems']);

        $requestId = $input['requestId'] ?? null;
        if (!is_string($requestId) || !preg_match('/^[a-zA-Z0-9-]{16,80}$/D', $requestId)) {
            throw new InvalidArgumentException('QUOTE_INVALID');
        }

        // Bind a bearer quote to one requestId. The same requestId remains
        // retryable: order receiver owns final idempotent storage/response.
        $claims = $private . '/quote-claims';
        if (!is_dir($claims) && !@mkdir($claims, 0700, true) && !is_dir($claims)) {
            throw new RuntimeException('QUOTE_UNAVAILABLE');
        }
        @chmod($claims, 0700);
        $claimPath = $claims . '/' . hash('sha256', $token) . '.txt';
        $handle = @fopen($claimPath, 'c+');
        if ($handle === false) throw new RuntimeException('QUOTE_UNAVAILABLE');
        try {
            @chmod($claimPath, 0600);
            if (!flock($handle, LOCK_EX)) throw new RuntimeException('QUOTE_UNAVAILABLE');
            $previous = trim((string) stream_get_contents($handle));
            if ($previous !== '' && !hash_equals($previous, $requestId)) {
                throw new InvalidArgumentException('QUOTE_REPLAY');
            }
            if ($previous === '') {
                rewind($handle);
                if (ftruncate($handle, 0) === false
                    || fwrite($handle, $requestId) !== strlen($requestId)
                    || !fflush($handle)) {
                    throw new RuntimeException('QUOTE_UNAVAILABLE');
                }
            }
        } finally {
            flock($handle, LOCK_UN);
            fclose($handle);
        }

        return [
            'orderItems' => $verified['orderItems'],
            'verifiedPreliminaryAmount' => $verified['finalClientPrice'],
            'expiresAt' => $verified['expiresAt'],
            'artworkScope' => 'reference_only',
            'requiresIndividualCalculation' => true,
        ];
    }
}
