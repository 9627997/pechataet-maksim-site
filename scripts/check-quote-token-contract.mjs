#!/usr/bin/env node
// Contract check without exposing private pricing data.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import PhpParser from 'php-parser';

const source = readFileSync('api/calc/PmQuoteTokenStore.php', 'utf8');
const test = readFileSync('tests/php/quote-token-store.php', 'utf8');
const engine = new PhpParser.Engine({
  parser: { php7: true, suppressErrors: false },
});
assert.equal(engine.parseCode(source).kind, 'program');
assert.equal(engine.parseCode(test).kind, 'program');

for (const needle of [
  'random_bytes(24)',
  "hash('sha256', $token)",
  'hash_equals(',
  'expiresAt',
  'QUOTE_STALE',
  'QUOTE_EXPIRED',
  'QUOTE_STORAGE_UNSAFE',
  'array_is_list(',
]) {
  assert.ok(source.includes(needle), `Missing quote invariant: ${needle}`);
}

const php = spawnSync('php', ['-l', 'api/calc/PmQuoteTokenStore.php'], {
  encoding: 'utf8',
});
if (php.error?.code === 'ENOENT') {
  console.log('PASS: PHP AST validated; CLI runtime not installed');
} else {
  assert.equal(php.status, 0, php.stderr || php.stdout);
  const result = spawnSync(
    'php',
    [
      '-d',
      'zend.assertions=1',
      '-d',
      'assert.exception=1',
      'tests/php/quote-token-store.php',
    ],
    { encoding: 'utf8' },
  );
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.ok(result.stdout.includes('PASS: opaque token'));
  console.log('PASS: quote token PHP syntax and runtime contract');
}

const api = readFileSync('api/calc/PmQuoteTokenApi.php', 'utf8');
const apiTest = readFileSync('tests/php/quote-token-api.php', 'utf8');
const gateway = readFileSync('api/calc/index.php', 'utf8');
const deploy = readFileSync('scripts/build-deploy.mjs', 'utf8');

assert.equal(engine.parseCode(api).kind, 'program');
assert.equal(engine.parseCode(apiTest).kind, 'program');

for (const needle of [
  'PmQuoteTokenStore',
  'canonicalItems',
  'verifyForOrder',
  "hash_file('sha256', $path)",
  "$this->engine->quote(['orderItems' => $canonical])",
  "'canSubmitOrder' => false",
]) {
  assert.ok(api.includes(needle), 'Missing token API invariant: ' + needle);
}

for (const needle of [
  "($config['quote_tokens_enabled'] ?? false) !== true",
  "require_once __DIR__ . '/PmQuoteTokenApi.php'",
  "$tokenApi->issue($payload['orderItems'])",
  "$tokenApi->resolve($payload['quoteId'])",
  "'canSubmitOrder'=>false",
]) {
  assert.ok(
    gateway.includes(needle),
    'Missing gated gateway contract: ' + needle,
  );
}
for (const path of ['PmQuoteTokenStore.php', 'PmQuoteTokenApi.php']) {
  const expression = new RegExp(
    "'api/calc/" + path.replaceAll('.', '\\.') + "'",
    'g',
  );
  assert.equal(
    [...deploy.matchAll(expression)].length,
    2,
    'Quote source must be in deploy allowlist and required files: ' + path,
  );
}
if (!php.error) {
  for (const filename of [
    'api/calc/PmQuoteTokenApi.php',
    'tests/php/quote-token-api.php',
    'api/calc/index.php',
  ]) {
    const lint = spawnSync('php', ['-l', filename], { encoding: 'utf8' });
    assert.equal(lint.status, 0, lint.stderr || lint.stdout);
  }
  const integration = spawnSync(
    'php',
    [
      '-d',
      'zend.assertions=1',
      '-d',
      'assert.exception=1',
      'tests/php/quote-token-api.php',
    ],
    { encoding: 'utf8' },
  );
  assert.equal(integration.status, 0, integration.stderr || integration.stdout);
  assert.ok(integration.stdout.includes('PASS: quote API issuance'));
}
console.log(
  'PASS: gated token issuance and resolution, canonical basket, PHP contract',
);
