// The vault is an in-memory test double. Real cryptography is covered by the encrypted-store and HTTP tests.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createVaultUploadPipeline } from '../../frontend/cloud/vault-upload-pipeline.mjs';

function setup() {
  const stored = new Map(), rows = new Map(), remote = new Map();
  let blocked = false, removed = false;
  const vault = {
    async save(o, id, m, b, p) {
      if (blocked)
        throw Error('vault full');
      stored.set(`${o}:${id}`, {
        mime: m,
        bytes: b.slice(),
        pass: p
      });
    },
    async load(o, id, p) {
      const r = stored.get(`${o}:${id}`);
      if (!r)
        return null;
      if (r.pass !== p)
        throw Error('locked');
      return r;
    },
    async remove(o, id) {
      stored.delete(`${o}:${id}`);
    }
  };
  const queue = {
    async put(r) {
      rows.set(`${r.owner}:${r.id}`, structuredClone(r));
    },
    async list(o) {
      return [...rows.values()].filter(r => r.owner === o);
    },
    async remove(o, id) {
      rows.delete(`${o}:${id}`);
    }
  };
  const upload = async (item, bytes) => {
    remote.set(item.path, bytes.slice());
  };
  const metadata = async () => { };
  const pipeline = createVaultUploadPipeline({
    vault,
    queue,
    upload,
    metadata,
    deleted: async () => removed
  });
  const input = (owner = 'alice', id = 'a') => ({
    owner,
    id,
    kind: 'inspiration',
    mime: 'image/png',
    bytes: new Uint8Array([1, 2, 3]),
    passphrase: 'strong password'
  });
  return {
    pipeline,
    input,
    rows,
    stored,
    remote,
    queue,
    vault,
    setBlocked: v => blocked = v,
    setDeleted: v => removed = v
  };
}

test('encrypted bytes are persisted separately; queue contains metadata only', async () => {
  const x = setup();
  await x.pipeline.enqueue(x.input());
  const row = [...x.rows.values()][0];
  assert.equal('blob' in row, false);
  assert.equal('passphrase' in row, false);
  assert.equal('bytes' in row, true);
  assert.equal(typeof row.bytes, 'number');
  assert.deepEqual([...x.stored.get('alice:a').bytes], [1, 2, 3]);
});

test('encrypted write failure never creates queue entry', async () => {
  const x = setup();
  x.setBlocked(true);
  await assert.rejects(x.pipeline.enqueue(x.input()), /vault full/);
  assert.equal(x.rows.size, 0);
});

test('successful upload acknowledges queue and sends correct bytes', async () => {
  const x = setup();
  await x.pipeline.enqueue(x.input());
  assert.deepEqual((await x.pipeline.flush('alice', 'strong password')).uploaded, ['a']);
  assert.equal(x.rows.size, 0);
  assert.deepEqual([...x.remote.values()].map(b => [...b]), [[1, 2, 3]]);
});

test('incorrect unlock secret leaves queue untouched', async () => {
  const x = setup();
  await x.pipeline.enqueue(x.input());
  assert.equal((await x.pipeline.flush('alice', 'incorrect')).failed.length, 1);
  assert.equal(x.rows.size, 1);
});

test('two accounts never cross-upload', async () => {
  const x = setup();
  await x.pipeline.enqueue(x.input('alice', 'same'));
  await x.pipeline.enqueue(x.input('bob', 'same'));
  await x.pipeline.flush('alice', 'strong password');
  assert.equal(x.rows.size, 1);
  assert.equal([...x.rows.values()][0].owner, 'bob');
});

test('deletion tombstone prevents new enqueue', async () => {
  const x = setup();
  x.setDeleted(true);
  await assert.rejects(x.pipeline.enqueue(x.input()), /deleted/);
  assert.equal(x.rows.size, 0);
});

test('deletion tombstone prevents upload', async () => {
  const x = setup();
  await x.pipeline.enqueue(x.input());
  x.setDeleted(true);
  assert.deepEqual((await x.pipeline.flush('alice', 'strong password')).skipped, ['a']);
  assert.equal(x.remote.size, 0);
});

test('retry after failed metadata publication is idempotent at storage path', async () => {
  const x = setup();
  let calls = 0;
  const p = createVaultUploadPipeline({
    vault: x.vault,
    queue: x.queue,
    upload: async (item, bytes) => {
      x.remote.set(item.path, bytes);
    },
    metadata: async () => {
      if (++calls === 1)
        throw Error('offline');
    }
  });
  await p.enqueue(x.input());
  assert.equal((await p.flush('alice', 'strong password')).failed.length, 1);
  assert.equal(x.rows.size, 1);
  assert.equal((await p.flush('alice', 'strong password')).uploaded.length, 1);
  assert.equal(x.rows.size, 0);
  assert.equal(x.remote.size, 1);
});

test('concurrent flush of same owner does not duplicate uploads', async () => {
  const x = setup();
  let unblock;
  const gate = new Promise(r => unblock = r);
  let calls = 0;
  const p = createVaultUploadPipeline({
    vault: x.vault,
    queue: x.queue,
    upload: async () => {
      calls++;
      await gate;
    },
    metadata: async () => { }
  });
  await p.enqueue(x.input());
  const first = p.flush('alice', 'strong password');
  const second = await p.flush('alice', 'strong password');
  assert.equal(second.busy, true);
  unblock();
  await first;
  assert.equal(calls, 1);
});

test('unsupported MIME is rejected before persistence', async () => {
  const x = setup();
  await assert.rejects(x.pipeline.enqueue({
    ...x.input(),
    mime: 'text/html'
  }), /Invalid artwork/);
  assert.equal(x.stored.size, 0);
});

test('deletion during upload removes remote bytes and never publishes metadata', {
  timeout: 5000
}, async () => {
  const x = setup();
  await x.pipeline.enqueue(x.input());
  let remove;
  const gate = new Promise(r => remove = r);
  let signalUploadStarted;
  const uploadStarted = new Promise(resolve => signalUploadStarted = resolve);
  let published = 0;
  let deleted = false;
  const p = createVaultUploadPipeline({
    vault: x.vault,
    queue: x.queue,
    upload: async (item, bytes) => {
      x.remote.set(item.path, bytes);
      signalUploadStarted();
      await gate;
    },
    metadata: async () => {
      published++;
    },
    deleted: async () => deleted,
    removeRemote: async (item) => {
      x.remote.delete(item.path);
    }
  });
  const pending = p.flush('alice', 'strong password');
  await uploadStarted;
  deleted = true;
  remove();
  const result = await pending;
  assert.deepEqual(result.skipped, ['a']);
  assert.equal(published, 0);
  assert.equal(x.remote.size, 0);
  assert.equal(x.rows.size, 0);
});

test('failed cleanup of a deleted in-flight upload stays retryable', {
  timeout: 5000
}, async () => {
  const x = setup();
  await x.pipeline.enqueue(x.input());
  let deleted = false, fail = true;
  let release;
  const gate = new Promise(r => release = r);
  let signalUploadStarted;
  const uploadStarted = new Promise(resolve => signalUploadStarted = resolve);
  const p = createVaultUploadPipeline({
    vault: x.vault,
    queue: x.queue,
    upload: async (item, bytes) => {
      x.remote.set(item.path, bytes);
      signalUploadStarted();
      await gate;
    },
    metadata: async () => {
      throw Error('must not publish');
    },
    deleted: async () => deleted,
    removeRemote: async (item) => {
      if (fail)
        throw Error('cleanup offline');
      x.remote.delete(item.path);
    }
  });
  const run = p.flush('alice', 'strong password');
  await uploadStarted;
  deleted = true;
  release();
  assert.equal((await run).failed.length, 1);
  assert.equal(x.rows.size, 1);
  fail = false;
  const retry = await p.flush('alice', 'strong password');
  assert.deepEqual(retry.skipped, ['a']);
  assert.equal(x.remote.size, 0);
  assert.equal(x.rows.size, 0);
});
