// Static source inspection only; this does not execute browser or database behavior.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/app.mjs', import.meta.url), 'utf8');

function sourceBetween(startPattern, endPattern) {
  const start = source.search(startPattern);
  assert.ok(start >= 0, 'Expected start of source block');
  const remaining = source.slice(start);
  const end = remaining.search(endPattern);
  assert.ok(end > 0, 'Expected end of source block after its start');
  return remaining.slice(0, end);
}

function assertBefore(block, firstPattern, secondPattern) {
  const first = block.search(firstPattern);
  const second = block.search(secondPattern);
  assert.ok(first >= 0, 'Expected first operation');
  assert.ok(second > first, 'Expected second operation after the first');
}

test('Atelier confirmation saves encrypted bytes before committing the design reference', () => {
  const block = sourceBetween(/if\s*\(id\s*===\s*'confirmCustom'/, /if\s*\(id\s*===\s*'restoreCustom'/);
  assert.match(block, /await window\.pahGalleryVault\.save\(file\)/);
  assert.match(block, /await window\.pahGalleryVault\.url\(entry\.id\)/);
  assertBefore(block, /await window\.pahGalleryVault\.save\(file\)/, /s\.custom\[slot\]\s*=\s*\{\s*data:\s*'vault:'\s*\+\s*entry\.id/);
  assert.doesNotMatch(block, /data:\s*previewData/);
});

test('Atelier images are resolved from encrypted references and guarded against account switches', () => {
  const block = sourceBetween(/function resolveDesignImages/, /async function migrateLegacyDesigns/);
  assert.match(block, /owner\s*===\s*activeAccount/);
  assert.match(block, /img\.dataset\.designRef\s*===\s*ref/);
  assert.match(block, /pahGalleryVault\?\.url/);
});

test('Legacy design migration keeps plaintext until encryption is verified', () => {
  const block = sourceBetween(/async function migrateLegacyDesigns/, /function renderGallery/);
  assertBefore(block, /await window\.pahGalleryVault\.save\(file\)/, /s\.custom\[id\]\s*=\s*\{\s*\.\.\.design,\s*data:\s*'vault:'\s*\+\s*entry\.id\s*\}/);
  assert.match(block, /if\s*\(!verified\)\s*throw/);
  assert.match(block, /if\s*\(owner\s*!==\s*activeAccount\)\s*return/);
});
