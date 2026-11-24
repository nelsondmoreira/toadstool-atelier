import test from 'node:test';
import assert from 'node:assert/strict';
import { createArtworkCleanup } from '../../frontend/cloud/artwork-cleanup.mjs';

function harness() {
  const rows = new Map(), files = new Set(['a:orphan', 'a:kept', 'b:private']);
  const refs = new Set(['a:kept']);
  let fail = false;
  const jobs = {
    put: async (j) => rows.set(j.key, structuredClone(j)),
    delete: async (k) => rows.delete(k),
    list: async (owner) => [...rows.values()].filter(j => j.owner === owner)
  };
  const vault = {
    remove: async (owner, id) => {
      if (fail)
        throw Error('disk unavailable');
      files.delete(`${owner}:${id}`);
    }
  };
  const make = () => createArtworkCleanup({
    jobs,
    vault,
    isReferenced: async (owner, id) => refs.has(`${owner}:${id}`)
  });
  return {
    rows,
    files,
    refs,
    make,
    setFail: x => fail = x
  };
}

test('orphan removed but referenced artwork survives', async () => {
  const h = harness(), c = h.make();
  await c.schedule('a', 'orphan');
  await c.schedule('a', 'kept');
  const r = await c.run('a');
  assert.deepEqual(r.deleted, ['orphan']);
  assert.deepEqual(r.retained, ['kept']);
  assert(h.files.has('a:kept'));
  assert(!h.files.has('a:orphan'));
  assert.equal(h.rows.size, 0);
});

test('failed deletion survives restart and succeeds on retry', async () => {
  const h = harness();
  await h.make().schedule('a', 'orphan');
  h.setFail(true);
  assert.equal((await h.make().run('a')).failed.length, 1);
  assert.equal(h.rows.get('a:orphan').attempts, 1);
  h.setFail(false);
  assert.deepEqual((await h.make().run('a')).deleted, ['orphan']);
});

test('account isolation', async () => {
  const h = harness();
  await h.make().schedule('b', 'private');
  await h.make().run('a');
  assert(h.files.has('b:private'));
  assert(h.rows.has('b:private'));
});

test('new reference between schedule and cleanup prevents deletion', async () => {
  const h = harness();
  await h.make().schedule('a', 'orphan');
  h.refs.add('a:orphan');
  assert.deepEqual((await h.make().run('a')).retained, ['orphan']);
  assert(h.files.has('a:orphan'));
});

test('invalid account and id are rejected', async () => {
  const h = harness();
  await assert.rejects(h.make().schedule('../b', 'orphan'));
  await assert.rejects(h.make().schedule('a', 'bad/id'));
});

test('cancel removes queued job without touching image', async () => {
  const h = harness();
  const c = h.make();
  await c.schedule('a', 'orphan');
  await c.cancel('a', 'orphan');
  await c.run('a');
  assert(h.files.has('a:orphan'));
});

test('concurrent runs for same account are suppressed', async () => {
  const h = harness();
  let release;
  const gate = new Promise(r => release = r);
  let entered;
  const started = new Promise(r => entered = r);
  const c = createArtworkCleanup({
    jobs: {
      put: async (j) => h.rows.set(j.key, j),
      delete: async (k) => h.rows.delete(k),
      list: async (owner) => [...h.rows.values()].filter(j => j.owner === owner)
    },
    vault: {
      remove: async () => {
        entered();
        await gate;
      }
    },
    isReferenced: async () => false
  });
  await c.schedule('a', 'orphan');
  const first = c.run('a');
  await started;
  assert.deepEqual(await c.run('a'), {
    skipped: true
  });
  release();
  await first;
});
