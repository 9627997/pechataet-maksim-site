#!/usr/bin/env node
// A non-secret static guard: the public PHP gateway may ONLY observe Pricing 3.
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';

const file = readFileSync('api/calc/index.php', 'utf8');
const text = (needle) => assert.ok(file.includes(needle), 'Missing public gateway guard: ' + needle);
text("require_once $private . '/PmCalcPreview.php'");
text("$engine = new PmCalcPreview(");
text("($config['pricing3_shadow_enabled'] ?? false) === true");
text("require_once $private . '/PmCalcPreviewV3.php'");
text('$pricing3Shadow->quote($payload)');
text('$price = $engine->quote($payload)');
text("'canSubmitOrder'=>false");
assert.ok(!file.includes('pricing3_quote_enabled'), 'Do not activate live Pricing 3 in the gateway');
assert.ok(!file.includes('pricing3Public'), 'Do not select Pricing 3 for public quotes');
assert.ok(!file.includes('new PmCalcPreviewV3(') || file.indexOf('new PmCalcPreviewV3(') > file.indexOf("($config['pricing3_shadow_enabled'] ?? false) === true"), 'No unguarded private observer');
assert.equal((file.match(/\$price = \$engine->quote\(\$payload\);/g) || []).length, 1);
console.log('PASS: public Pricing 2 remains authoritative; private Pricing 3 is shadow-only');
