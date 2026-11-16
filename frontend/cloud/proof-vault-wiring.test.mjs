// Static source inspection only; this does not execute browser or database behavior.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = (readFileSync(new URL('../index.html', import.meta.url), 'utf8') + '\n' + readFileSync(new URL('../src/app.mjs', import.meta.url), 'utf8'));

test('quest and Atelier proof submissions use encrypted vault references rather than imageData', () => {
  assert.match(html, /s\.questProof\s*=\s*await savePrivateProof\(f\)/);
  assert.match(html, /let data\s*=\s*await savePrivateProof\(f\);\s*s\.atelierDone/);
  assert.doesNotMatch(html, /s\.questProof\s*=\s*await imageData\(f\)/);
  assert.doesNotMatch(html, /let data\s*=\s*await imageData\(f\);\s*s\.atelierDone/);
});

test('proof reveal resolves encrypted reference and rechecks active account after await', () => {
  assert.match(html, /url\s*=\s*await proofURL\(expected\)/);
  assert.match(html, /account\s*!==\s*activeAccount\s*\|\|\s*expected\s*!==\s*reveal\.dataset\.proof/);
});

test('proof deletion removes encrypted bytes before deleting badge proof reference', () => {
  assert.match(html, /await window\.pahGalleryVault\.remove\(originalProof\.slice\(6\)\)/);
  assert.match(html, /if\s*\(owner\s*!==\s*activeAccount\s*\|\|\s*record\.proof\s*!==\s*originalProof\)\s*return;?\s*\}\s*delete record\.proof/);
});
