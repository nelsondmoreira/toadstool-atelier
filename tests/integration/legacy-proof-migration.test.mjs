import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { createLegacyProofMigration } from '../../frontend/cloud/legacy-proof-migration.mjs';
import { createGalleryVault } from '../../frontend/cloud/gallery-vault.mjs';
import { encryptedArtworkRepository } from '../../frontend/cloud/encrypted-artwork-store.mjs';
import { createArtworkVaultSession } from '../../frontend/cloud/artwork-vault-session.mjs';

if (!globalThis.crypto)
  globalThis.crypto = webcrypto;

const image = (s) => 'data:image/png;base64,' + Buffer.from(s).toString('base64');

async function setup() {
  const rows = new Map(), adapter = {
    get: async (k) => rows.get(k),
    put: async (r) => rows.set(r.key, r),
    delete: async (k) => rows.delete(k),
    list: async (owner) => [...rows.values()].filter(r => r.owner === owner)
  };
  const repo = encryptedArtworkRepository(adapter);
  const vault = createArtworkVaultSession({
    repository: repo,
    remembered: {
      unlock: async () => 'strong-secret-12345',
      remember: async () => { }
    },
    askPassphrase: async () => {
      throw Error('Unexpected prompt');
    }
  });
  const gallery = createGalleryVault(vault, {
    createURL: () => 'blob:verified',
    revokeURL: () => { }
  });
  await gallery.session('alice');
  let state = {
    questProof: image('quest bytes'),
    achievements: [{
        name: 'Quest',
        proof: image('achievement bytes'),
        date: '2026-01-01'
      }],
    atelierDone: {
      badge1: {
        proof: image('atelier bytes'),
        date: '2026-01-02'
      }
    }
  };
  let owner = 'alice', commits = 0;
  const migration = createLegacyProofMigration({
    gallery,
    persist: async (account, next) => {
      assert.equal(account, owner);
      state = next;
      commits++;
    }
  });
  return {
    rows,
    gallery,
    migration,
    get state() {
      return state;
    },
    set state(x) {
      state = x;
    },
    get commits() {
      return commits;
    },
    set owner(x) {
      owner = x;
    },
    isCurrent: a => a === owner
  };
}

test('real AES encryption migrates all three proof locations and preserves earned metadata', async () => {
  const f = await setup(), r = await f.migration({
    owner: 'alice',
    getState: () => f.state,
    isCurrent: f.isCurrent
  });
  assert.equal(r.migrated, 3);
  assert.equal(f.commits, 3);
  assert.match(f.state.questProof, /^vault:/);
  assert.match(f.state.achievements[0].proof, /^vault:/);
  assert.match(f.state.atelierDone.badge1.proof, /^vault:/);
  assert.equal(f.state.achievements[0].date, '2026-01-01');
  assert.equal(f.state.atelierDone.badge1.date, '2026-01-02');
  assert.equal(JSON.stringify([...f.rows.values()]).includes('achievement bytes'), false);
  assert.equal(await f.gallery.url(f.state.achievements[0].proof.slice(6)), 'blob:verified');
  const again = await f.migration({
    owner: 'alice',
    getState: () => f.state,
    isCurrent: f.isCurrent
  });
  assert.equal(again.migrated, 0);
});

test('failed encryption leaves all original proof images and badge history intact', async () => {
  const f = await setup();
  const migration = createLegacyProofMigration({
    gallery: {
      save: async () => {
        throw Error('quota exceeded');
      },
      url: async () => null
    },
    persist: async () => {
      throw Error('must not commit');
    }
  });
  const r = await migration({
    owner: 'alice',
    getState: () => f.state,
    isCurrent: f.isCurrent
  });
  assert.equal(r.failures.length, 3);
  assert.equal(f.commits, 0);
  assert.match(f.state.achievements[0].proof, /^data:/);
});

test('one malformed proof does not block migration of other proofs', async () => {
  const f = await setup();
  f.state = {
    ...f.state,
    achievements: [{
        proof: 'data:image/png;base64,broken!!!',
        name: 'Bad'
      }]
  };
  const r = await f.migration({
    owner: 'alice',
    getState: () => f.state,
    isCurrent: f.isCurrent
  });
  assert.equal(r.failures.length, 1);
  assert.equal(r.migrated, 2);
  assert.equal(f.state.achievements[0].proof, 'data:image/png;base64,broken!!!');
});

test('account switch during async save prevents cross-account state commit', async () => {
  const f = await setup();
  let release;
  const migration = createLegacyProofMigration({
    gallery: {
      save: () => new Promise(resolve => release = resolve),
      url: async () => 'blob:verified'
    },
    persist: async () => {
      throw Error('must not commit');
    }
  });
  const pending = migration({
    owner: 'alice',
    getState: () => f.state,
    isCurrent: f.isCurrent
  });
  f.owner = 'bob';
  release({
    id: 'encrypted-alice'
  });
  const r = await pending;
  assert.equal(r.interrupted, true);
  assert.equal(f.commits, 0);
  assert.match(f.state.questProof, /^data:/);
});

test('proof deleted while encryption is pending is not restored', async () => {
  const f = await setup();
  let release;
  const migration = createLegacyProofMigration({
    gallery: {
      save: () => new Promise(resolve => release = resolve),
      url: async () => 'blob:verified'
    },
    persist: async () => {
      throw Error('must not commit');
    }
  });
  const pending = migration({
    owner: 'alice',
    getState: () => f.state,
    isCurrent: f.isCurrent
  });
  f.state = {
    ...f.state,
    atelierDone: {
      ...f.state.atelierDone,
      badge1: {
        date: '2026-01-02',
        proof: null
      }
    }
  };
  release({
    id: 'encrypted-alice'
  });
  const r = await pending;
  assert.equal(r.interrupted, true);
  assert.equal(f.state.atelierDone.badge1.proof, null);
});

test('migration is single-flight to avoid duplicate concurrent encryption', async () => {
  const f = await setup();
  let release;
  const migration = createLegacyProofMigration({
    gallery: {
      save: () => new Promise(resolve => release = resolve),
      url: async () => 'blob:verified'
    },
    persist: async () => { }
  });
  const pending = migration({
    owner: 'alice',
    getState: () => f.state,
    isCurrent: f.isCurrent
  });
  const second = await migration({
    owner: 'alice',
    getState: () => f.state,
    isCurrent: f.isCurrent
  });
  assert.equal(second.status, 'busy');
  f.owner = 'bob';
  release({
    id: 'x'
  });
  await pending;
});
