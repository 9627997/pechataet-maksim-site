<?php
declare(strict_types=1);

// CI-only fixture: synthesize an isolated private Pricing 2 adapter and
// issue a real opaque token against that server-owned engine.
$root = $argv[1] ?? '';
if (!is_dir($root . '/web/api/calc')) throw new RuntimeException('Missing fixture web root');
$private = $root . '/private/pm-calc';
if (!is_dir($private) && !mkdir($private, 0700, true)) throw new RuntimeException('mkdir private');
file_put_contents($private . '/config.php',
    "<?php return ['preview_enabled'=>true,'mode'=>'preliminary_only','quote_tokens_enabled'=>true];");
file_put_contents($private . '/PmCalcPreview.php', <<<'PHP'
<?php
declare(strict_types=1);
final class PmCalcPreview {
    public function __construct(string $snapshot, string $assortment) {}
    public function quote(array $payload): array {
        if (count($payload['orderItems'] ?? []) !== 6) {
            throw new InvalidArgumentException('QUOTE_INVALID');
        }
        return ['finalClientPrice' => '4990.00'];
    }
}
PHP);
file_put_contents($private . '/ASSORTMENT_PRIVATE.json', '{"fixture":true}');
file_put_contents($private . '/SNAPSHOT_ASSORTMENT_PRIVATE.json', '{"version":"ci-only"}');

require_once $root . '/web/api/calc/PmQuoteTokenStore.php';
require_once $root . '/web/api/calc/PmQuoteTokenApi.php';
require_once $private . '/PmCalcPreview.php';
$items = [];
for ($i = 1; $i <= 3; $i++) {
    $items[] = [
        'itemId' => 'ribbon-' . $i,
        'productType' => 'ribbon',
        'quantity' => ['meters' => '25'],
        'configuration' => [
            'widthMm' => 15, 'repeatMm' => 100.0,
            'materialColor' => '#f3eadc', 'printColor' => '#171717',
        ],
    ];
}
foreach ([24, 25, 30] as $i => $diameter) {
    $items[] = [
        'itemId' => 'sticker-' . ($i + 1),
        'productType' => 'sticker',
        'quantity' => ['pieces' => '250'],
        'configuration' => [
            'variantId' => 'circle-' . $diameter,
            'shape' => 'circle', 'widthMm' => $diameter, 'heightMm' => $diameter,
            'cornerRadiusMm' => null,
            'printColor' => '#171717', 'backgroundColor' => '#ffffff',
        ],
    ];
}
$issued = (new PmQuoteTokenApi($private, new PmCalcPreview('', '')))->issue($items);
echo json_encode(['items' => $items, 'quoteId' => $issued['quoteId']], JSON_THROW_ON_ERROR);
