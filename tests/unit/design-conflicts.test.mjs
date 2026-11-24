import test from 'node:test';
import assert from 'node:assert/strict';
import { compareDesigns, resolveDesignConflict, syncConfirmedDesign } from '../../frontend/cloud/design-conflicts.mjs';

const a = {
  operationId: 'a',
  path: 'u/atelier-design/a',
  confirmedAt: '2026-11-09T09:00:00.000Z'
};

const b = {
  operationId: 'b',
  path: 'u/atelier-design/b',
  confirmedAt: '2026-11-09T09:05:00.000Z'
};

test('newer confirmation wins even when uploaded earlier', () => assert.equal(resolveDesignConflict(a, b).action, 'apply'));

test('late offline upload cannot overwrite newer confirmation', () => assert.deepEqual(resolveDesignConflict(b, a), {
  action: 'superseded',
  previousPath: null,
  orphanPath: a.path
}));

test('duplicate retry is idempotent', () => assert.equal(resolveDesignConflict(a, {
  ...a
}).action, 'already-applied'));

test('first customization applies', () => assert.equal(resolveDesignConflict(null, a).action, 'apply'));

test('ties have deterministic operation ID ordering', () => assert.ok(compareDesigns({
  ...a,
  confirmedAt: b.confirmedAt
}, b) < 0));

test('invalid timestamps rejected', () => assert.throws(() => compareDesigns({
  ...a,
  confirmedAt: 'not-a-date'
}, b)));

test('missing job metadata rejected', async () => await assert.rejects(syncConfirmedDesign({
  owner: 'u',
  slot: 's',
  job: {},
  adapter: {}
})));

test('network failure never calls commit', async () => {
  let committed = false;
  await assert.rejects(syncConfirmedDesign({
    owner: 'u',
    slot: 's',
    job: a,
    adapter: {
      uploadIfNeeded: async () => {
        throw Error('offline');
      },
      commitIfNewer: async () => {
        committed = true;
      }
    }
  }));
  assert.equal(committed, false);
});

test('superseded upload is reported and not applied', async () => {
  const result = await syncConfirmedDesign({
    owner: 'u',
    slot: 's',
    job: a,
    adapter: {
      uploadIfNeeded: async () => { },
      commitIfNewer: async () => ({
        status: 'superseded'
      })
    }
  });
  assert.equal(result.status, 'superseded');
});
