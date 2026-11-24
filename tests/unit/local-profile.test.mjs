import test from 'node:test';
import assert from 'node:assert/strict';
import { getLocalProfileId } from '../../frontend/src/storage/local-profile.mjs';

const uuid = '12345678-1234-4123-8123-123456789abc';

function createStorage(initial = []) {
  const values = new Map(initial);

  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
}

test('creates and reuses the local profile across calls', () => {
  const storage = createStorage();
  const first = getLocalProfileId(storage, () => uuid);

  const second = getLocalProfileId(storage, () => {
    throw new Error('Existing profile must be reused');
  });

  assert.equal(first, `local-${uuid}`);
  assert.equal(second, first);
});

test('preserves an invalid stored profile for recovery', () => {
  const storage = createStorage([
    ['pah:local-profile:v1', 'invalid'],
  ]);

  assert.throws(
    () => getLocalProfileId(storage, () => uuid),
    /could not be read/,
  );

  assert.equal(storage.getItem('pah:local-profile:v1'), 'invalid');
});

test('does not return success when persistence fails', () => {
  const storage = {
    getItem: () => null,
    setItem: () => {
      throw new Error('Storage unavailable');
    },
  };

  assert.throws(
    () => getLocalProfileId(storage, () => uuid),
    /Storage unavailable/,
  );
});