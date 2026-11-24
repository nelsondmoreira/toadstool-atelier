import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { createGalleryVault } from '../../frontend/cloud/gallery-vault.mjs';
import { encryptedArtworkRepository } from '../../frontend/cloud/encrypted-artwork-store.mjs';
import { createArtworkVaultSession } from '../../frontend/cloud/artwork-vault-session.mjs';

if (!globalThis.crypto)
  globalThis.crypto = webcrypto;

function setup() {
  const records = new Map();
  const adapter = {
    get: async (k) => records.get(k),
    put: async (r) => records.set(r.key, r),
    delete: async (k) => records.delete(k),
    list: async (o) => [...records.values()].filter(x => x.owner === o)
  };
  const repository = encryptedArtworkRepository(adapter);
  const remembered = {
    unlock: async () => 'long-password-for-test',
    remember: async () => { }
  };
  const vault = createArtworkVaultSession({
    repository,
    remembered,
    askPassphrase: async () => {
      throw Error('Unexpected prompt');
    }
  });
  let count = 0;
  const revoked = [];
  const gallery = createGalleryVault(vault, {
    createURL: () => `blob:mock-${++count}`,
    revokeURL: u => revoked.push(u)
  });
  return {
    gallery,
    records,
    revoked,
    repository
  };
}

const file = (text = 'drawing') => ({
  type: 'image/png',
  size: text.length,
  arrayBuffer: async () => new TextEncoder().encode(text).buffer
});

test('gallery upload stores encrypted bytes and ID-only metadata', async () => {
  const { gallery, records } = setup();
  await gallery.session('alice');
  const item = await gallery.save(file('secret art'));
  assert.deepEqual(Object.keys(item).sort(), ['id', 'mime', 'type']);
  assert.equal(item.type, 'encrypted-image');
  const stored = [...records.values()][0];
  assert.equal(stored.owner, 'alice');
  assert.equal(JSON.stringify(stored).includes('secret art'), false);
  assert.match(await gallery.url(item.id), /^blob:mock-/);
});

test('account switching revokes decrypted object URLs and prevents cross-account reads', async () => {
  const { gallery, revoked } = setup();
  await gallery.session('alice');
  const item = await gallery.save(file());
  const url = await gallery.url(item.id);
  await gallery.session('bob');
  assert.deepEqual(revoked, [url]);
  assert.equal(await gallery.url(item.id), null);
});

test('removal deletes encrypted bytes and revokes object URL', async () => {
  const { gallery, records, revoked } = setup();
  await gallery.session('alice');
  const item = await gallery.save(file());
  const url = await gallery.url(item.id);
  await gallery.remove(item.id);
  assert.equal(records.size, 0);
  assert.deepEqual(revoked, [url]);
  assert.equal(await gallery.url(item.id), null);
});

test('wrong account and invalid files are rejected before persistence', async () => {
  const { gallery, records } = setup();
  await assert.rejects(gallery.save(file()), /Sign in/);
  await gallery.session('alice');
  await assert.rejects(gallery.save({
    ...file(),
    type: 'text/html'
  }), /Choose/);
  assert.equal(records.size, 0);
});

test('account switch during file read prevents cross-account write', async () => {
  const { gallery, records } = setup();
  await gallery.session('alice');
  let release;
  const pending = gallery.save({
    type: 'image/png',
    size: 4,
    arrayBuffer: () => new Promise(r => release = r)
  });
  await gallery.session('bob');
  release(new Uint8Array([1, 2, 3, 4]).buffer);
  await assert.rejects(pending, /Account changed/);
  assert.equal(records.size, 0);
});

test('removeForAccount cleans orphaned upload after account switch without touching active account', async () => {
  const { gallery, records } = setup();
  await gallery.session('alice');
  const alice = await gallery.save(file('alice proof'));
  await gallery.session('bob');
  const bob = await gallery.save(file('bob proof'));
  await gallery.removeForAccount('alice', alice.id);
  assert.equal(records.size, 1);
  assert.equal((await gallery.url(bob.id)).startsWith('blob:'), true);
  assert.equal([...records.values()][0].owner, 'bob');
});
