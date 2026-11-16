// Static source inspection only; this does not execute browser or database behavior.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('queue source wires durable cleanup on failed commit and account switch', async () => {
  const source = await readFile(new URL('./artwork-queue.js', import.meta.url), 'utf8');
  assert.match(source, /cleanup\.schedule\(enqueueOwner,\s*id,\s*'queue-commit-failed'\)/);
  assert.match(source, /cleanup\.schedule\(enqueueOwner,\s*id,\s*'account-switched-before-queue-commit'\)/);
  assert.match(source, /await cleanup\.run\(activeOwner\)/);
  assert.match(source, /isReferenced:\s*async\s*\(account,\s*id\)\s*=>\s*\(await all\(\)\)/);
});
