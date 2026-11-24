// Static source inspection only; this does not execute browser or database behavior.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const queue = readFileSync(new URL('../../frontend/cloud/artwork-queue.js', import.meta.url), 'utf8');

const sql = readFileSync(new URL('../../backend/supabase/schema.sql', import.meta.url), 'utf8');

function assertBefore(firstPattern, secondPattern) {
  const first = queue.search(firstPattern);
  const second = queue.search(secondPattern);
  assert.ok(first >= 0, 'Expected the first operation to exist');
  assert.ok(second > first, 'Expected the second operation to exist after the first');
}

test('IndexedDB upgrades existing upload queue without discarding uploads', () => {
  assert.match(queue, /indexedDB\.open\(DB,\s*2\)/);
  assert.match(queue, /if\s*\(!req\.result\.objectStoreNames\.contains\(STORE\)\)/);
});

test('deletion tombstone saved before queued uploads are removed', () => {
  assertBefore(/await saveDeletion\(\{\s*key:\s*proofKey\(activeOwner/, /for\s*\(const item of pending\)\s*\{\s*await remove\(item\.id\)/);
});

test('offline deleted proof cannot enqueue', () => {
  assert.match(queue, /await isDeleted\(enqueueOwner,\s*kind,\s*slot\)/);
});

test('upload checks tombstone before and after network call', () => {
  const uploadStart = queue.search(/for\s*\(const item of items\)/);
  const uploadEnd = queue.indexOf("window.addEventListener('online'");
  assert.ok(uploadStart >= 0, 'Expected the upload loop');
  assert.ok(uploadEnd > uploadStart, 'Expected the end of the upload section');
  const upload = queue.slice(uploadStart, uploadEnd);
  const checks = [...upload.matchAll(/await isDeleted\(activeOwner,\s*item\.kind,\s*item\.slot\)/g)];
  const network = upload.search(/await supabase\.storage\.from\('artist-artwork'\)\.upload\(/);
  assert.equal(checks.length, 2);
  assert.ok(network >= 0, 'Expected the network upload');
  assert.ok(checks[0].index < network && checks[1].index > network, 'Deletion must be checked on both sides of the upload');
});

test('cloud deletion requires user and kind and slot', () => {
  assert.match(sql, /uid is null or p_kind not in/);
});

test('database trigger rejects proof resurrection', () => {
  assert.match(sql, /create trigger prevent_deleted_proof_resurrection/);
});

test('cleanup retries and acknowledges only after removal', () => {
  assertBefore(/storage\.from\('artist-artwork'\)\.remove\(paths\)/, /rpc\('ack_proof_storage_cleanup'/);
});

test('badge data is not removed by proof cleanup SQL', () => {
  const start = sql.indexOf('-- v1.2:');
  assert.ok(start >= 0, 'Expected the proof cleanup SQL section');
  assert.doesNotMatch(sql.slice(start), /delete\s+from\s+public\.artist_profiles/i);
});
