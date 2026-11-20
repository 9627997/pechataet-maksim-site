#!/usr/bin/env node
// Guard that public Pricing 2 remains authoritative.
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const file = readFileSync('api/calc/index.php', 'utf8');
const check = (needle) => {
  assert.ok(file.includes(needle), `Missing gateway guard: ${needle}`);
};

check("require_once $private . '/PmCalcPreview.php'");
check('$engine = new PmCalcPreview(');
const shadowFlag = "($config['pricing3_shadow_enabled'] ?? false) === true";
check(shadowFlag);
check("require_once $private . '/PmCalcPreviewV3.php'");
check('$pricing3Shadow->quote($payload)');
check('$price = $engine->quote($payload)');
check("'canSubmitOrder'=>false");
assert.ok(!file.includes('pricing3_quote_enabled'));
assert.ok(!file.includes('pricing3Public'));
const privateCall = file.indexOf('new PmCalcPreviewV3(');
assert.ok(privateCall > file.indexOf(shadowFlag));
const publicQuotes = file.match(/\$price = \$engine->quote\(\$payload\);/g);
assert.equal(publicQuotes?.length, 1);
console.log('PASS: Pricing 2 public; Pricing 3 private shadow only');
