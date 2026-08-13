import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import PhpParser from 'php-parser';

const repositoryRoot = resolve(import.meta.dirname, '..');
const endpointPath = resolve(repositoryRoot, 'api/orders/index.php');
const endpoint = await readFile(endpointPath, 'utf8');
const parser = new PhpParser.Engine({
  parser: {
    extractDoc: true,
    php7: true,
    suppressErrors: false,
  },
  ast: { withPositions: true },
});

const ast = parser.parseCode(endpoint, 'api/orders/index.php');
assert.equal(ast.kind, 'program');
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
  "['phone', 'telegram']",
]) {
  assert.ok(
    endpoint.includes(requiredContract),
    `Order endpoint is missing contract: ${requiredContract}`,
  );
}

console.log(
  'Order receiver PHP syntax and public response contract are valid.',
);
