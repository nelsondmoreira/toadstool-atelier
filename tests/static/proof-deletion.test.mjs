// Static source inspection only; this does not execute browser or database behavior.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = (readFileSync(new URL('../../frontend/index.html', import.meta.url), 'utf8') + '\n' + readFileSync(new URL('../../frontend/src/app.mjs', import.meta.url), 'utf8'));

const queue = readFileSync(new URL('../../frontend/cloud/artwork-queue.js', import.meta.url), 'utf8');

test('delete control starts hidden', () => assert.match(html, /id="deleteBadgeProof"\s+hidden/));

test('delete is gated by confirmation', () => assert.match(html, /deleteBadgeProof'\)\.onclick\s*=.*?if\s*\(!confirm\(/s));

test('deletion clears proof only, preserving badge metadata', () => {
  assert.match(html, /delete record\.proof/);
  assert.doesNotMatch(html, /delete s\.atelierDone\[id\]/);
});

test('deletion emits scoped queue cancellation', () => assert.match(html, /pah:artwork-proof-deleted/));

test('queue cancellation is owner and slot scoped', () => assert.match(queue, /x\.owner\s*===\s*activeOwner\s*&&\s*x\.kind\s*===\s*kind\s*&&\s*x\.slot\s*===\s*slot/));

test('dialog reset hides delete button', () => assert.match(html, /deleteBadgeProof'\)\.hidden\s*=\s*true/));
