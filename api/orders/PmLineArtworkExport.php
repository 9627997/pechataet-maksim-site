<?php
declare(strict_types=1);

/**
 * Rebuild the six independent, server-validated reference designs for the
 * Google notification payload. Only files named in our privately stored order
 * manifest are read; browser-supplied paths are never used.
 *
 * This is backup data, NOT a machine-ready approval or price authority.
 */
function pm_export_line_artworks(string $directory, array $order): array
{
    $manifest = $order['lineArtworkManifest'] ?? [];
    if (!is_array($manifest) || count($manifest) > 6) {
        throw new RuntimeException('Invalid private line artwork manifest');
    }
    $items = $order['linkedBasket']['orderItems'] ?? [];
    if (!is_array($items)) {
        if ($manifest === []) return [];
        throw new RuntimeException('Linked basket missing for private artwork export');
    }
    $allowed = [];
    foreach ($items as $item) {
        $id = $item['itemId'] ?? null;
        if (!is_string($id) || isset($allowed[$id])) {
            throw new RuntimeException('Invalid private basket item ID');
        }
        $allowed[$id] = true;
    }
    $export = [];
    $seen = [];
    foreach ($manifest as $line) {
        if (!is_array($line)) throw new RuntimeException('Invalid private artwork line');
        $id = $line['itemId'] ?? null;
        if (!is_string($id) || !isset($allowed[$id]) || isset($seen[$id])) {
            throw new RuntimeException('Artwork manifest does not match canonical basket');
        }
        $seen[$id] = true;
        $data = [];
        foreach (['previewSvg', 'printSvg', 'previewPng'] as $field) {
            $name = $line[$field] ?? null;
            if (!is_string($name) || !preg_match('/^line-[0-9]{2}-(?:preview\\.svg|print\\.svg|preview\\.png)$/D', $name)) {
                throw new RuntimeException('Invalid private artwork filename');
            }
            $file = $directory . '/' . $name;
            if (!is_file($file) || is_link($file) || filesize($file) > 8 * 1024 * 1024) {
                throw new RuntimeException('Private artwork file missing or unsafe');
            }
            $bytes = file_get_contents($file);
            if ($bytes === false || $bytes === '') {
                throw new RuntimeException('Private artwork file unreadable');
            }
            $data[$field] = $field === 'previewPng' ? base64_encode($bytes) : $bytes;
        }
        $export[$id] = $data;
    }
    return $export;
}
