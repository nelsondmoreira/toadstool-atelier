import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { createLegacyGalleryMigration } from './gallery-legacy-migration.mjs';
import { createGalleryVault } from './gallery-vault.mjs';
import { encryptedArtworkRepository } from './encrypted-artwork-store.mjs';
import { createArtworkVaultSession } from './artwork-vault-session.mjs';

if (!globalThis.crypto)
  globalThis.crypto = webcrypto;

function fixture() {
  const records = new Map();
  const adapter = {
    get: async (k) => records.get(k),
    put: async (r) => records.set(r.key, r),
    delete: async (k) => records.delete(k),
    list: async (owner) => [...records.values()].filter(r => r.owner === owner)
  };
  const repository = encryptedArtworkRepository(adapter);
  const vault = createArtworkVaultSession({
    repository,
    remembered: {
      unlock: async () => 'strong-secret-12345',
      remember: async () => { }
    },
    askPassphrase: async () => {
      throw Error('prompt');
    }
  });
  const gallery = createGalleryVault(vault, {
    createURL: () => 'blob:verified',
    revokeURL: () => { }
  });
  let state = {
    gallery: [{
        type: 'image',
        data: 'data:image/png;base64,' + Buffer.from('original artwork').toString('base64')
      }, {
        type: 'link',
        url: 'https://example.org'
      }]
  };
  let account = 'alice';
  let saves = 0;
  const persist = async (owner, next) => {
    assert.equal(owner, account);
    saves++;
    state = next;
  };
  const migration = createLegacyGalleryMigration({
    gallery,
    persist
  });
  return {
    records,
    gallery,
    migration,
    get state() {
      return state;
    },
    get saves() {
      return saves;
    },
    set account(a) {
      account = a;
    },
    isCurrent: a => a === account
  };
}

test('legacy gallery migration uses real AES encryption, decrypt readback and commits ID-only state', async () => {
  const f = fixture();
  await f.gallery.session('alice');
  const r = await f.migration({
    owner: 'alice',
    getState: () => f.state,
    isCurrent: f.isCurrent
  });
  assert.equal(r.migrated, 1);
  assert.equal(f.state.gallery[0].type, 'encrypted-image');
  assert.equal(f.state.gallery[0].data, undefined);
  assert.equal(f.state.gallery[1].type, 'link');
  assert.equal(f.saves, 1);
  assert.equal(JSON.stringify([...f.records.values()]).includes('original artwork'), false);
  assert.equal(await f.gallery.url(f.state.gallery[0].id), 'blob:verified');
});

test('rerun is idempotent and never re-encrypts completed items', async () => {
  const f = fixture();
  await f.gallery.session('alice');
  await f.migration({
    owner: 'alice',
    getState: () => f.state,
    isCurrent: f.isCurrent
  });
  const before = [...f.records.keys()];
  const r = await f.migration({
    owner: 'alice',
    getState: () => f.state,
    isCurrent: f.isCurrent
  });
  assert.equal(r.migrated, 0);
  assert.deepEqual([...f.records.keys()], before);
});

test('vault failure retains plaintext source rather than losing drawing', async () => {
  const f = fixture();
  await f.gallery.session('alice');
  const migration = createLegacyGalleryMigration({
    gallery: {
      save: async () => {
        throw Error('storage full');
      },
      url: async () => null
    },
    persist: async () => {
      throw Error('must not persist');
    }
  });
  const r = await migration({
    owner: 'alice',
    getState: () => f.state,
    isCurrent: f.isCurrent
  });
  assert.equal(r.migrated, 0);
  assert.match(r.failures[0].reason, /storage full/);
  assert.equal(f.state.gallery[0].type, 'image');
});

test('account switch during asynchronous encryption never commits another account data', async () => {
  const f = fixture();
  await f.gallery.session('alice');
  let release;
  const migration = createLegacyGalleryMigration({
    gallery: {
      save: () => new Promise(resolve => release = resolve),
      url: async () => 'blob:ok'
    },
    persist: async () => {
      throw Error('must not persist');
    }
  });
  const pending = migration({
    owner: 'alice',
    getState: () => f.state,
    isCurrent: f.isCurrent
  });
  f.account = 'bob';
  release({
    type: 'encrypted-image',
    id: 'old-account-id',
    mime: 'image/png'
  });
  const r = await pending;
  assert.equal(r.interrupted, true);
  assert.equal(f.state.gallery[0].type, 'image');
});

test('malformed legacy data URL is rejected without altering gallery', async () => {
  const f = fixture();
  await f.gallery.session('alice');
  f.state.gallery[0].data = 'javascript:alert(1)';
  const r = await f.migration({
    owner: 'alice',
    getState: () => f.state,
    isCurrent: f.isCurrent
  });
  assert.equal(r.migrated, 0);
  assert.equal(r.failures.length, 1);
  assert.equal(f.saves, 0);
});
