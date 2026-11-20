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
  'hash(\'sha256\', $token)',
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
