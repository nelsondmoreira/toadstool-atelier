import test from 'node:test';
import assert from 'node:assert/strict';
import { stateKey, readScopedState, writeScopedState, LEGACY_KEY, GUEST_KEY } from './account-scope.mjs';

const storage = () => {
  const m = new Map();
  return {
    getItem: k => m.has(k) ? m.get(k) : null,
    setItem: (k, v) => m.set(k, v),
    snapshot: () => m
  };
};

const fresh = () => ({
  totalXp: 0,
  gallery: [],
  xpLedger: []
});

test('account data is isolated from other accounts and guest', () => {
  const db = storage();
  writeScopedState(db, 'accountA', {
    totalXp: 500,
    gallery: ['private'],
    xpLedger: [1]
  });
  assert.deepEqual(readScopedState(db, 'accountB', fresh), fresh());
  assert.deepEqual(readScopedState(db, null, fresh), fresh());
  assert.equal(readScopedState(db, 'accountA', fresh).gallery[0], 'private');
});

test('sign out and sign back in preserves original private state', () => {
  const db = storage();
  writeScopedState(db, 'A', {
    totalXp: 120,
    gallery: ['proof']
  });
  writeScopedState(db, null, {
    totalXp: 7,
    gallery: ['guest']
  });
  assert.deepEqual(readScopedState(db, null, fresh).gallery, ['guest']);
  assert.deepEqual(readScopedState(db, 'A', fresh).gallery, ['proof']);
});

test('legacy shared demo data is not implicitly assigned to a signed-in account', () => {
  const db = storage();
  db.setItem(LEGACY_KEY, JSON.stringify({
    gallery: ['old private image']
  }));
  assert.deepEqual(readScopedState(db, 'A', fresh).gallery, []);
  assert.notEqual(stateKey('A'), LEGACY_KEY);
});

test('malformed saved data is preserved and fails closed', () => {
  const db = storage();
  db.setItem(stateKey('A'), '{broken');
  assert.throws(() => readScopedState(db, 'A', fresh), /could not be read/);
  assert.equal(db.getItem(stateKey('A')), '{broken');
});

test('storage quota errors propagate without claiming save succeeded', () => {
  const db = {
    setItem() {
      throw new Error('QuotaExceededError');
    }
  };
  assert.throws(() => writeScopedState(db, 'A', fresh()), /QuotaExceededError/);
});

test('malicious and invalid account identifiers cannot become keys', () => {
  for (const id of ['../guest', '', {}, 'abc:guest', 'a'.repeat(129)])
    assert.throws(() => stateKey(id), TypeError);
  assert.equal(stateKey(null), GUEST_KEY);
});

test('account-specific keys cannot collide', () => {
  assert.notEqual(stateKey('A'), stateKey('B'));
  assert.notEqual(stateKey(null), stateKey('A'));
});
