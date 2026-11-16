import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { encryptArtwork, decryptArtwork, encryptedArtworkRepository } from './encrypted-artwork-store.mjs';

if (!globalThis.crypto)
  globalThis.crypto = webcrypto;

const pass = 'long unique vault passphrase';

const bytes = new Uint8Array([1, 2, 3, 4, 255]);

function adapter() {
  const data = new Map();
  return {
    data,
    get: async (k) => data.get(k),
    put: async (r) => {
      data.set(r.key, r);
    },
    delete: async (k) => data.delete(k),
    list: async (owner) => [...data.values()].filter(r => r.owner === owner)
  };
}

test('encrypted bytes roundtrip and no plaintext persisted', async () => {
  const a = adapter(), repo = encryptedArtworkRepository(a);
  await repo.save('alice', 'drawing1', 'image/png', bytes, pass);
  assert.deepEqual((await repo.load('alice', 'drawing1', pass)).bytes, bytes);
  const record = [...a.data.values()][0];
  assert.equal(record.bytes, undefined);
  assert.equal(record.ciphertext instanceof ArrayBuffer, true);
});

test('same artwork encrypted twice has fresh nonce and salt', async () => {
  const a = await encryptArtwork('alice', 'id', 'image/png', bytes, pass), b = await encryptArtwork('alice', 'id', 'image/png', bytes, pass);
  assert.notDeepEqual(a.iv, b.iv);
  assert.notDeepEqual(a.salt, b.salt);
  assert.notDeepEqual(new Uint8Array(a.ciphertext), new Uint8Array(b.ciphertext));
});

test('wrong passphrase rejects', async () => {
  const r = await encryptArtwork('alice', 'id', 'image/png', bytes, pass);
  await assert.rejects(decryptArtwork('alice', 'id', r, 'another long passphrase'));
});

test('cross-account access rejects', async () => {
  const a = adapter(), repo = encryptedArtworkRepository(a);
  await repo.save('alice', 'id', 'image/png', bytes, pass);
  assert.equal(await repo.load('bob', 'id', pass), null);
  await assert.rejects(decryptArtwork('bob', 'id', [...a.data.values()][0], pass));
});

test('tampered ciphertext rejects', async () => {
  const r = await encryptArtwork('alice', 'id', 'image/png', bytes, pass);
  const c = new Uint8Array(r.ciphertext.slice(0));
  c[0] ^= 1;
  r.ciphertext = c.buffer;
  await assert.rejects(decryptArtwork('alice', 'id', r, pass));
});

test('tampered MIME authenticated', async () => {
  const r = await encryptArtwork('alice', 'id', 'image/png', bytes, pass);
  r.mime = 'image/jpeg';
  await assert.rejects(decryptArtwork('alice', 'id', r, pass));
});

test('failed writes preserve prior encrypted artwork', async () => {
  const a = adapter(), repo = encryptedArtworkRepository(a);
  await repo.save('alice', 'id', 'image/png', bytes, pass);
  const old = await a.get('alice:id');
  a.put = async () => {
    throw Error('QuotaExceededError');
  };
  await assert.rejects(repo.save('alice', 'id', 'image/png', new Uint8Array([8]), pass));
  assert.equal(await a.get('alice:id'), old);
});

test('verification detects corrupted persisted record', async () => {
  const a = adapter(), put = a.put;
  a.put = async (r) => put({
    ...r,
    ciphertext: new Uint8Array([1, 2, 3]).buffer
  });
  const repo = encryptedArtworkRepository(a);
  await assert.rejects(repo.save('alice', 'id', 'image/png', bytes, pass));
});

test('list is account-scoped and deletion isolated', async () => {
  const a = adapter(), repo = encryptedArtworkRepository(a);
  await repo.save('alice', 'id', 'image/png', bytes, pass);
  await repo.save('bob', 'id', 'image/jpeg', bytes, pass);
  assert.deepEqual(await repo.list('alice'), [{
      id: 'id',
      mime: 'image/png'
    }]);
  await repo.remove('alice', 'id');
  assert.equal(await repo.load('alice', 'id', pass), null);
  assert.deepEqual((await repo.load('bob', 'id', pass)).bytes, bytes);
});

test('reject invalid types and empty images', async () => {
  await assert.rejects(encryptArtwork('alice', 'id', 'image/svg+xml', bytes, pass));
  await assert.rejects(encryptArtwork('alice', 'id', 'image/png', new Uint8Array(), pass));
});
