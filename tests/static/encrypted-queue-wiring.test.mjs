// Static source inspection only; this does not execute browser or database behavior.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../../frontend/cloud/artwork-queue.js', import.meta.url), 'utf8');

test('new upload is encrypted before its queue metadata is committed', () => {
  const encrypt = source.search(/await vault\.save\(enqueueOwner,\s*id,\s*optimized\.mime,\s*bytes\)/);
  const persist = source.search(/try\s*\{\s*await put\(item\);\s*\}/);
  assert.ok(encrypt >= 0, 'Expected encrypted persistence');
  assert.ok(persist > encrypt, 'Queue metadata must be persisted after encryption');
  assert.match(source, /slot,\s*encrypted:\s*true,\s*mime:\s*optimized\.mime/);
});

test('encrypted upload is decrypted before network transfer', () => {
  assert.match(source, /item\.encrypted\s*\?\s*await vault\.load\(activeOwner,\s*item\.id\)/);
  assert.match(source, /item\.encrypted\s*\?\s*new Blob\(\[decrypted\.bytes\]/);
});

test('account changes are checked after encrypt and before network transfer', () => {
  assert.match(source, /if\s*\(owner\s*!==\s*enqueueOwner\)\s*\{\s*await cleanup\.schedule\(enqueueOwner,\s*id,\s*'account-switched-before-queue-commit'\);\s*throw Error\('Account changed while encrypting artwork'\);\s*\}/);
  assert.match(source, /if\s*\(owner\s*!==\s*activeOwner\)\s*break;/);
});
