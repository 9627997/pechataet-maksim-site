import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import PhpParser from 'php-parser';

const repositoryRoot = resolve(import.meta.dirname, '..');
const endpointPath = resolve(repositoryRoot, 'api/orders/index.php');
const endpoint = await readFile(endpointPath, 'utf8');
const verifier = await readFile(
  resolve(repositoryRoot, 'api/orders/PmOrderQuoteVerifier.php'),
  'utf8',
);
const workerPath = resolve(
  repositoryRoot,
  'api/orders/notification-worker.php',
);
const worker = await readFile(workerPath, 'utf8');
const parser = new PhpParser.Engine({
  parser: {
    extractDoc: true,
    php7: true,
    suppressErrors: false,
  },
  ast: { withPositions: true },
});

const ast = parser.parseCode(endpoint, 'api/orders/index.php');
assert.equal(
  parser.parseCode(verifier, 'api/orders/PmOrderQuoteVerifier.php').kind,
  'program',
);
const workerAst = parser.parseCode(
  worker,
  'api/orders/notification-worker.php',
);
assert.equal(ast.kind, 'program');
assert.equal(workerAst.kind, 'program');
assert.ok(ast.children.length > 0, 'PHP endpoint must contain executable code');

for (const requiredContract of [
  "'status' => 'accepted'",
  "'orderId' => $order['orderId']",
  "'duplicate' => $order['duplicate']",
  'pm_clean_svg',
  'pm_check_rate_limit',
  'pm_store_order',
  'pm_run_notifications',
  "'preferredContact'",
  "'amount' => null",
  "'requiresIndividualCalculation' => true",
  "['phone', 'telegram']",
  '[24, 25, 30, 40, 50, 80]',
  "['circle', 'roundrect']",
  "'variantId'",
  'pm_notification_attempts',
  "'partial_failure'",
  "'failedChannels'",
  'pm_write_technical_log',
  "'request_normalized'",
  "'order_accepted'",
  "'archive_completed'",
]) {
  assert.ok(
    endpoint.includes(requiredContract),
    `Order endpoint is missing contract: ${requiredContract}`,
  );
}

const responsePosition = endpoint.indexOf(
  "pm_json_response($order['duplicate'] ? 200 : 201",
);
const archivePosition = endpoint.indexOf("pm_create_zip($order['directory'])");
assert.ok(responsePosition >= 0, 'Order receiver must send accepted response');
assert.ok(
  endpoint.includes(
    "pm_ranged_number($ribbonInput['repeatMm'] ?? null, 5, 500, 'шаг повтора')",
  ),
  'Repeat step bounds must accept any studio-legitimate value (content + interval), not the old fixed-step presets',
);
assert.ok(
  archivePosition > responsePosition,
  'Archive creation must happen after accepted response',
);
assert.ok(
  endpoint.includes("'/archive.json'"),
  'Order receiver must persist archive lifecycle state',
);
assert.ok(
  endpoint.includes('pm_enqueue_notifications'),
  'Order receiver must enqueue notifications',
);
assert.ok(
  !endpoint.includes('pm_run_notifications($config, $order)'),
  'Order receiver must NOT run notifications inline — the cron worker owns delivery, inline runs hold the shopper connection past the client abort timeout',
);
assert.ok(
  endpoint.includes('CURLINFO_REDIRECT_URL'),
  'Endpoint HTTP helper must handle Apps Script POST->GET signed redirects (FOLLOWLOCATION+POSTREDIR gets a 405 from script.googleusercontent.com)',
);
assert.ok(
  worker.includes('pmq_process'),
  'Notification worker must process queued orders',
);
assert.ok(
  worker.includes('notification-queue.json'),
  'Notification worker must use the queue file',
);
assert.ok(
  worker.includes('CURLINFO_REDIRECT_URL'),
  'Worker HTTP helper must handle Apps Script POST->GET signed redirects too',
);
for (const marker of [
  "require_once __DIR__ . '/PmOrderQuoteVerifier.php'",
  "'linkedBasket'",
  "'quote_basket_changed'",
  "'quote_replay'",
  "'amount' => null",
  "'requiresIndividualCalculation' => true",
]) {
  assert.ok(
    endpoint.includes(marker),
    'Missing linked quote order contract: ' + marker,
  );
}
assert.ok(
  verifier.includes('verifyForOrder'),
  'Order quote must be rechecked server-side',
);
assert.ok(
  verifier.includes("'quote_tokens_enabled'"),
  'Private flag is mandatory',
);
// Optional 3+3 per-line artwork must bind to server-verified item IDs,
// never write untrusted paths and never drop the legacy artwork archive.
for (const marker of [
  'function pm_normalize_line_artworks(',
  "'artifactsByItemId'",
  "'lineArtworks'",
  "array_key_exists('previewSvg', $files)",
  "array_key_exists('printSvg', $files)",
  "array_key_exists('previewPng', $files)",
  "'artwork_without_quote'",
  "abs($height - (float) $config['widthMm'])",
  "'/line-[0-9][0-9]-*'",
  "'-print.svg'",
  "'-preview.png'",
]) {
  assert.ok(
    endpoint.includes(marker),
    'Per-line artwork contract missing: ' + marker,
  );
}
assert.ok(endpoint.includes("'ribbon-print-black.svg'"));
assert.ok(endpoint.includes("'sticker-print-black.svg'"));

const php = spawnSync('php', ['-v'], { encoding: 'utf8' });
if (!php.error) {
  for (const filename of [
    'api/orders/PmOrderQuoteVerifier.php',
    'tests/php/order-quote-verifier.php',
    'api/orders/index.php',
  ]) {
    const lint = spawnSync('php', ['-l', filename], { encoding: 'utf8' });
    assert.equal(lint.status, 0, lint.stderr || lint.stdout);
  }
  const run = spawnSync(
    'php',
    [
      '-d',
      'zend.assertions=1',
      '-d',
      'assert.exception=1',
      'tests/php/order-quote-verifier.php',
    ],
    { encoding: 'utf8' },
  );
  assert.equal(run.status, 0, run.stderr || run.stdout);
  assert.ok(run.stdout.includes('PASS: verified full linked basket'));
}
console.log(
  'Order receiver PHP syntax, logging contract, and fast-acceptance lifecycle are valid.',
);
