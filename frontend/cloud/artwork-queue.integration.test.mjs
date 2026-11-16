import test, { beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { setupArtworkQueue } from './artwork-queue.js';
// A minimal asynchronous IndexedDB implementation. Unlike static/source checks,
// these tests exercise the real queue's transactions and asynchronous callbacks.

const mockedGlobals = ['indexedDB', 'document', 'window', 'navigator', 'createImageBitmap'];

let originalGlobals;

beforeEach(() => {
  originalGlobals = new Map(mockedGlobals.map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
});

afterEach(() => {
  for (const [name, descriptor] of originalGlobals) {
    if (descriptor)
      Object.defineProperty(globalThis, name, descriptor);
    else
      delete globalThis[name];
  }
});

async function waitFor(predicate, message) {
  for (let attempt = 0; attempt < 50; attempt++) {
    if (predicate())
      return;
    await new Promise(resolve => setImmediate(resolve));
  }
  assert.fail(message);
}

function installDB() {
  const tables = new Map();
  globalThis.indexedDB = {
    open(_name, version) {
      const req = {};
      const db = {
        objectStoreNames: {
          contains: name => tables.has(name)
        },
        createObjectStore(name) {
          const entries = new Map();
          tables.set(name, entries);
          return {
            createIndex() { }
          };
        },
        transaction(name) {
          if (!tables.has(name))
            throw Error(`Object store ${name} missing`);
          const tx = {
            oncomplete: null,
            onerror: null,
            error: null,
            objectStore(requested) {
              if (requested !== name)
                throw Error(`NotFoundError: ${requested} is not in transaction ${name}`);
              return {
                index(indexName) {
                  return {
                    getAll(owner) {
                      const r = {};
                      queueMicrotask(() => {
                        r.result = [...tables.get(name).values()].filter(x => x[indexName] === owner);
                        r.onsuccess?.();
                        tx.oncomplete?.();
                      });
                      return r;
                    }
                  };
                },
                getAll() {
                  const r = {};
                  queueMicrotask(() => {
                    r.result = [...tables.get(name).values()];
                    r.onsuccess?.();
                    tx.oncomplete?.();
                  });
                  return r;
                },
                put(item) {
                  const r = {};
                  queueMicrotask(() => {
                    tables.get(name).set(item.key ?? item.id, item);
                    r.result = item.key ?? item.id;
                    r.onsuccess?.();
                    tx.oncomplete?.();
                  });
                  return r;
                },
                delete(key) {
                  const r = {};
                  queueMicrotask(() => {
                    tables.get(name).delete(key);
                    r.onsuccess?.();
                    tx.oncomplete?.();
                  });
                  return r;
                }
              };
            }
          };
          return tx;
        },
        close() { }
      };
      req.result = db;
      queueMicrotask(() => {
        if (!tables.has('jobs') && _name === 'pah-artwork-cleanup-v1' || !tables.size)
          req.onupgradeneeded?.();
        req.onsuccess?.();
      });
      return req;
    }
  };
  const listeners = {};
  globalThis.document = {
    hidden: false,
    getElementById() {
      return null;
    },
    addEventListener(type, fn) {
      listeners[type] = fn;
    }
  };
  globalThis.window = {
    addEventListener() { }
  };
  Object.defineProperty(globalThis, 'navigator', {
    value: {
      onLine: false
    },
    configurable: true,
    writable: true
  });
  return {
    tables,
    listeners
  };
}

function mockSupabase() {
  const calls = [];
  return {
    calls,
    rpc: async (name, args) => {
      calls.push({
        name,
        args
      });
      return {
        data: [],
        error: null
      };
    },
    storage: {
      from() {
        return {
          remove: async () => ({
            error: null
          })
        };
      }
    }
  };
}

test('offline proof deletion creates a durable tombstone in the correct store', async () => {
  const { tables, listeners } = installDB();
  const cloud = mockSupabase();
  const queue = setupArtworkQueue(cloud);
  await queue.session({
    user: {
      id: 'artist-A'
    }
  });
  await listeners['pah:artwork-proof-deleted']({
    detail: {
      kind: 'quest-proof',
      slot: 'quest-123'
    }
  });
  await waitFor(() => tables.get('proof_deletions')?.size === 1, 'Expected the proof deletion event to persist a tombstone');
  assert.equal(tables.get('proof_deletions').size, 1);
  assert.equal((tables.get('uploads')?.size ?? 0), 0);
  assert.deepEqual([...tables.get('proof_deletions').values()][0], {
    key: 'artist-A:quest-proof:quest-123',
    owner: 'artist-A',
    kind: 'quest-proof',
    slot: 'quest-123'
  });
  assert.equal(cloud.calls.length, 0, 'offline deletion must not contact the cloud');
});

test('reconnecting flushes proof deletion and removes tombstone only after cloud success', async () => {
  const { tables, listeners } = installDB();
  const cloud = mockSupabase();
  const queue = setupArtworkQueue(cloud);
  await queue.session({
    user: {
      id: 'artist-B'
    }
  });
  await listeners['pah:artwork-proof-deleted']({
    detail: {
      kind: 'atelier-proof',
      slot: 'badge-7'
    }
  });
  await waitFor(() => tables.get('proof_deletions')?.size === 1, 'Expected the proof deletion event to persist a tombstone');
  assert.equal(tables.get('proof_deletions').size, 1);
  globalThis.navigator.onLine = true;
  await queue.flush();
  assert.equal(tables.get('proof_deletions').size, 0);
  assert.deepEqual(cloud.calls, [{
      name: 'delete_proof_assets',
      args: {
        p_kind: 'atelier-proof',
        p_slot: 'badge-7'
      }
    }]);
});

test('cloud deletion error retains tombstone for retry', async () => {
  const { tables, listeners } = installDB();
  const cloud = mockSupabase();
  cloud.rpc = async () => ({
    data: null,
    error: new Error('network failed')
  });
  const queue = setupArtworkQueue(cloud);
  await queue.session({
    user: {
      id: 'artist-C'
    }
  });
  await listeners['pah:artwork-proof-deleted']({
    detail: {
      kind: 'quest-proof',
      slot: 'quest-9'
    }
  });
  await waitFor(() => tables.get('proof_deletions')?.size === 1, 'Expected the proof deletion event to persist a tombstone');
  globalThis.navigator.onLine = true;
  await queue.flush();
  assert.equal(tables.get('proof_deletions').size, 1, 'retry record must survive failed RPC');
});

test('account switch during image decoding never stores artwork under the new account', async () => {
  const { tables } = installDB();
  const queue = setupArtworkQueue(mockSupabase());
  await queue.session({
    user: {
      id: 'artist-A'
    }
  });
  let release;
  const gate = new Promise(resolve => {
    release = resolve;
  });
  globalThis.createImageBitmap = async () => {
    await gate;
    return {
      width: 1,
      height: 1,
      close() { }
    };
  };
  document.createElement = () => ({
    getContext: () => ({
      drawImage() { },
      getImageData: () => ({
        data: new Uint8ClampedArray([0, 0, 0, 255])
      })
    }),
    toBlob: cb => cb(new Blob(['x'], {
      type: 'image/jpeg'
    }))
  });
  const file = new Blob(['image'], {
    type: 'image/jpeg'
  });
  const enqueue = queue.enqueue(file, 'inspiration');
  await queue.session({
    user: {
      id: 'artist-B'
    }
  });
  release();
  await assert.rejects(enqueue, /Account changed/);
  assert.equal((tables.get('uploads')?.size ?? 0), 0, 'no artwork may be assigned to account B');
});

test('sign-out during image decoding does not persist an unowned upload', async () => {
  const { tables } = installDB();
  const queue = setupArtworkQueue(mockSupabase());
  await queue.session({
    user: {
      id: 'artist-A'
    }
  });
  let release;
  const gate = new Promise(resolve => {
    release = resolve;
  });
  globalThis.createImageBitmap = async () => {
    await gate;
    return {
      width: 1,
      height: 1,
      close() { }
    };
  };
  document.createElement = () => ({
    getContext: () => ({
      drawImage() { },
      getImageData: () => ({
        data: new Uint8ClampedArray([0, 0, 0, 255])
      })
    }),
    toBlob: cb => cb(new Blob(['x'], {
      type: 'image/jpeg'
    }))
  });
  const enqueue = queue.enqueue(new Blob(['image'], {
    type: 'image/jpeg'
  }), 'inspiration');
  await queue.session(null);
  release();
  await assert.rejects(enqueue, /Account changed/);
  assert.equal((tables.get('uploads')?.size ?? 0), 0);
});
