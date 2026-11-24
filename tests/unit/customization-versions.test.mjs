import test from 'node:test';
import assert from 'node:assert/strict';
import { compareVersions } from '../../frontend/cloud/customization-versions.mjs';

test('later local choice supersedes an earlier choice', () => {
  assert.equal(
    compareVersions({ phone: 2 }, { phone: 1 }),
    'after',
  );
  assert.equal(
    compareVersions({ phone: 1 }, { phone: 2 }),
    'before',
  );
});

test('a choice made after receiving another device version is later', () => {
  assert.equal(
    compareVersions({ phone: 2, tablet: 1 }, { phone: 2 }),
    'after',
  );
});

test('independent offline choices are concurrent in either order', () => {
  const phoneChoice = { phone: 3 };
  const tabletChoice = { phone: 2, tablet: 1 };

  assert.equal(compareVersions(phoneChoice, tabletChoice), 'concurrent');
  assert.equal(compareVersions(tabletChoice, phoneChoice), 'concurrent');
});

test('matching vectors are equal regardless of property order', () => {
  assert.equal(
    compareVersions(
      { phone: 2, tablet: 1 },
      { tablet: 1, phone: 2 },
    ),
    'equal',
  );
});

test('empty vectors represent no known changes', () => {
  assert.equal(compareVersions({}, {}), 'equal');
  assert.equal(compareVersions({ phone: 1 }, {}), 'after');
});

test('invalid counters and vectors are rejected', () => {
  for (const counter of [-1, 0, 1.5, NaN, Infinity, '1']) {
    assert.throws(
      () => compareVersions({ phone: counter }, {}),
      TypeError,
    );
  }

  for (const vector of [null, [], 'invalid']) {
    assert.throws(() => compareVersions(vector, {}), TypeError);
  }
});