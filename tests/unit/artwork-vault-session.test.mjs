// Repository and remembered-secret adapters are test doubles; these tests cover session orchestration.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createArtworkVaultSession } from '../../frontend/cloud/artwork-vault-session.mjs';

function setup(askPassphrase = async () => 'very-long-passphrase') {
  const saved = new Map(), rememberedSecrets = new Map();
  let calls = 0;
  const repository = {
    async save(owner, id, mime, bytes, pass) {
      saved.set(`${owner}:${id}`, {
        mime,
        bytes,
        pass
      });
    },
    async load(owner, id, pass) {
      const r = saved.get(`${owner}:${id}`);
      if (!r || r.pass !== pass)
        throw Error('Wrong secret');
      return r;
    },
    async remove(owner, id) {
      saved.delete(`${owner}:${id}`);
    }
  };
  const remembered = {
    async unlock(owner) {
      return rememberedSecrets.get(owner) || null;
    },
    async remember(owner, pass) {
      rememberedSecrets.set(owner, pass);
    }
  };
  const vault = createArtworkVaultSession({
    repository,
    remembered,
    askPassphrase: async (owner) => {
      calls++;
      return askPassphrase(owner);
    }
  });
  return {
    vault,
    saved,
    rememberedSecrets,
    get calls() {
      return calls;
    }
  };
}

test('encrypted queue session stores only through repository and remembers unlock', async () => {
  const x = setup();
  await x.vault.session('a');
  await x.vault.save('a', 'one', 'image/png', new Uint8Array([1, 2]));
  assert.equal(x.calls, 1);
  assert.equal((await x.vault.load('a', 'one')).bytes[1], 2);
  await x.vault.session(null);
  await x.vault.session('a');
  assert.equal((await x.vault.load('a', 'one')).bytes[0], 1);
  assert.equal(x.calls, 1);
});

test('sign-out blocks stale account operations', async () => {
  const x = setup();
  await x.vault.session('a');
  await x.vault.session(null);
  await assert.rejects(x.vault.save('a', 'one', 'image/png', new Uint8Array([1])), /account changed/i);
  assert.equal(x.saved.size, 0);
});

test('switching accounts does not share remembered secrets', async () => {
  const x = setup(async (owner) => owner === 'a' ? 'aaaaaaaaaaaa' : 'bbbbbbbbbbbb');
  await x.vault.session('a');
  await x.vault.save('a', 'one', 'image/png', new Uint8Array([1]));
  await x.vault.session('b');
  await x.vault.save('b', 'one', 'image/png', new Uint8Array([2]));
  assert.equal(x.rememberedSecrets.get('a'), 'aaaaaaaaaaaa');
  assert.equal(x.rememberedSecrets.get('b'), 'bbbbbbbbbbbb');
  await assert.rejects(x.vault.load('a', 'one'), /account changed/i);
});

test('cancelled unlock does not persist artwork', async () => {
  const x = setup(async () => null);
  await x.vault.session('a');
  await assert.rejects(x.vault.save('a', 'one', 'image/png', new Uint8Array([1])), /cancelled/);
  assert.equal(x.saved.size, 0);
});

test('account switch during unlock prevents cross-account save', async () => {
  let resume;
  const x = setup(() => new Promise(r => resume = r));
  await x.vault.session('a');
  const pending = x.vault.save('a', 'one', 'image/png', new Uint8Array([1]));
  await Promise.resolve();
  await x.vault.session('b');
  resume('very-long-passphrase');
  await assert.rejects(pending, /account changed/);
  assert.equal(x.saved.size, 0);
});
