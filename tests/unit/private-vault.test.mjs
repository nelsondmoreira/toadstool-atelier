import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';

if (!globalThis.crypto)
  globalThis.crypto = webcrypto;

const { sealVault, openVault, vaultKey, stageVaultMigration } = await import('../../frontend/cloud/private-vault.mjs');

const pass = 'correct horse battery staple';

const data = {
  xp: 80,
  gallery: [{
      type: 'image',
      data: 'data:image/png;base64,' + 'a'.repeat(12000)
    }],
  events: [1, 2]
};

test('round trip preserves large artwork and progression', async () => assert.deepEqual(await openVault('userA', pass, await sealVault('userA', pass, data)), data));

test('envelope does not contain private plaintext or passphrase', async () => {
  const blob = await sealVault('userA', pass, {
    secret: 'distinctive PRIVATE sketch'
  });
  assert.doesNotMatch(blob, /PRIVATE sketch|correct horse/);
});

test('random IV and salt make repeated encryptions distinct', async () => {
  const first = JSON.parse(await sealVault('userA', pass, data));
  const second = JSON.parse(await sealVault('userA', pass, data));
  assert.notEqual(first.iv, second.iv);
  assert.notEqual(first.salt, second.salt);
  assert.notEqual(first.ciphertext, second.ciphertext);
});

test('wrong passphrase is rejected', async () => assert.rejects(openVault('userA', 'wrong passphrase 123', await sealVault('userA', pass, data)), /Unable to unlock/));

test('account binding prevents cross-account decryption', async () => assert.rejects(openVault('userB', pass, await sealVault('userA', pass, data)), /Unable to unlock/));

test('tampering with ciphertext is detected', async () => {
  const obj = JSON.parse(await sealVault('userA', pass, data));
  obj.ciphertext = (obj.ciphertext[0] === 'A' ? 'B' : 'A') + obj.ciphertext.slice(1);
  await assert.rejects(openVault('userA', pass, JSON.stringify(obj)), /Unable to unlock/);
});

test('malformed envelopes and unsupported versions fail closed', async () => {
  await assert.rejects(openVault('userA', pass, '{'), /Malformed/);
  const x = JSON.parse(await sealVault('userA', pass, data));
  x.iterations = 1;
  await assert.rejects(openVault('userA', pass, JSON.stringify(x)), /Unsupported/);
});

test('weak passphrase and invalid account ID rejected', async () => {
  await assert.rejects(sealVault('userA', 'short', data), /12 characters/);
  await assert.rejects(sealVault('../other', pass, data), /Valid signed-in/);
  assert.throws(() => vaultKey(null), /Valid signed-in/);
});

test('staged migration verifies ciphertext and preserves plaintext', async () => {
  const m = new Map([['plaintext', JSON.stringify(data)]]);
  const s = {
    getItem: k => m.get(k) ?? null,
    setItem: (k, v) => m.set(k, v)
  };
  const result = await stageVaultMigration(s, 'userA', pass, data);
  assert.deepEqual(result, {
    verified: true,
    plaintextStillPresent: true
  });
  assert.equal(m.get('plaintext'), JSON.stringify(data));
  assert.deepEqual(await openVault('userA', pass, m.get(vaultKey('userA'))), data);
  await assert.rejects(stageVaultMigration(s, 'userA', pass, data), /already exists/);
});

test('quota error leaves plaintext and no vault', async () => {
  const s = {
    getItem: k => k === 'plaintext' ? JSON.stringify(data) : null,
    setItem() {
      throw new Error('QuotaExceededError');
    }
  };
  await assert.rejects(stageVaultMigration(s, 'userA', pass, data), /QuotaExceededError/);
  assert.equal(s.getItem('plaintext'), JSON.stringify(data));
});
