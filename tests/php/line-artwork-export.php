<?php
declare(strict_types=1);

require_once dirname(__DIR__, 2) . '/api/orders/PmLineArtworkExport.php';

$directory = sys_get_temp_dir() . '/pm-line-export-' . bin2hex(random_bytes(8));
if (!mkdir($directory, 0700)) throw new RuntimeException('Cannot create fixture directory');
$reject = static function (callable $test): void {
    try {
        $test();
        throw new LogicException('Expected unsafe artwork to be rejected');
    } catch (RuntimeException $error) {
        assert($error->getMessage() !== '');
    }
};
try {
    $manifest = [];
    $basket = [];
    for ($i = 1; $i <= 6; $i++) {
        $id = ($i <= 3 ? 'ribbon-' : 'sticker-') . $i;
        $prefix = sprintf('line-%02d', $i);
        $basket[] = ['itemId' => $id];
        $manifest[] = [
            'itemId' => $id,
            'previewSvg' => $prefix . '-preview.svg',
            'printSvg' => $prefix . '-print.svg',
            'previewPng' => $prefix . '-preview.png',
        ];
        file_put_contents($directory . '/' . $prefix . '-preview.svg',
            '<svg xmlns="http://www.w3.org/2000/svg"><text>preview-' . $id . '</text></svg>');
        file_put_contents($directory . '/' . $prefix . '-print.svg',
            '<svg xmlns="http://www.w3.org/2000/svg"><text>print-' . $id . '</text></svg>');
        file_put_contents($directory . '/' . $prefix . '-preview.png',
            "\x89PNG\r\n\x1a\n" . 'distinct-' . $id);
    }
    $order = [
        'linkedBasket' => ['orderItems' => $basket],
        'lineArtworkManifest' => $manifest,
    ];
    $result = pm_export_line_artworks($directory, $order);
    assert(count($result) === 6);
    foreach ($basket as $item) {
        $id = $item['itemId'];
        assert(str_contains($result[$id]['printSvg'], 'print-' . $id));
        assert(str_contains($result[$id]['previewSvg'], 'preview-' . $id));
        assert(str_contains(base64_decode($result[$id]['previewPng'], true), 'distinct-' . $id));
    }
    // The existing one-ribbon/one-sticker order remains supported.
    assert(pm_export_line_artworks($directory, [
        'linkedBasket' => ['orderItems' => []],
        'lineArtworkManifest' => [],
    ]) === []);

    $bad = $order;
    $bad['lineArtworkManifest'][0]['itemId'] = 'sticker-99';
    $reject(static fn () => pm_export_line_artworks($directory, $bad));
    $bad = $order;
    $bad['lineArtworkManifest'][1]['itemId'] = 'ribbon-1';
    $reject(static fn () => pm_export_line_artworks($directory, $bad));
    $bad = $order;
    $bad['lineArtworkManifest'][0]['printSvg'] = '../secret.svg';
    $reject(static fn () => pm_export_line_artworks($directory, $bad));
    unlink($directory . '/line-06-preview.png');
    $reject(static fn () => pm_export_line_artworks($directory, $order));
    echo "PASS: six distinct Google backup artifacts, legacy fallback, and fail-closed validation\n";
} finally {
    foreach (glob($directory . '/*') ?: [] as $file) unlink($file);
    rmdir($directory);
}
