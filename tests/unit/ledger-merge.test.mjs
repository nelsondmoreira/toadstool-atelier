import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeAwards } from '../../frontend/cloud/ledger-merge.mjs';

const e = (slot = '0', cycle = 0, status = 'pending') => ({
  id: `mission:2026-11-09:${slot}`,
  cycle,
  kind: 'mission',
  xp: 20,
  skill: 'Anatomy',
  status
});

test('server rejection is not resurrected by in-flight local snapshot', () => {
  const old = e();
  const processed = [{
      ...old,
      status: 'rejected'
    }];
  assert.equal(mergeAwards([old], [], processed)[0].status, 'rejected');
});

test('confirmed RPC missing from stale server snapshot remains pending', () => {
  const old = e();
  assert.equal(mergeAwards([old], [], [{
      ...old,
      status: 'confirmed'
    }])[0].status, 'pending');
});

test('authoritative server award replaces forged local XP', () => {
  const merged = mergeAwards([{
      ...e(),
      xp: 50
    }], [{
      ...e(),
      xp: 20,
      status: 'confirmed'
    }]);
  assert.equal(merged[0].xp, 20);
});

test('new completion made during request survives merge', () => {
  const merged = mergeAwards([e('0'), e('1')], [{
      ...e('0'),
      status: 'confirmed'
    }], [{
      ...e('0'),
      status: 'confirmed'
    }]);
  assert.equal(merged.length, 2);
  assert.equal(merged.find(x => x.id.endsWith(':1')).status, 'pending');
});

test('prestige cycles with same weekly slot are distinct', () => {
  const merged = mergeAwards([e('0', 0), e('0', 1)], [{
      ...e('0', 0),
      status: 'confirmed'
    }]);
  assert.equal(merged.length, 2);
  assert.equal(merged.find(x => x.cycle === 1).status, 'pending');
});

test('rejected event stays rejected on later sync without award', () => {
  const old = {
    ...e(),
    status: 'rejected'
  };
  assert.equal(mergeAwards([old], [])[0].status, 'rejected');
});

test('authoritative award overrides prior rejection', () => {
  const merged = mergeAwards([{
      ...e(),
      status: 'rejected'
    }], [{
      ...e(),
      status: 'confirmed'
    }]);
  assert.equal(merged[0].status, 'confirmed');
});

test('duplicate entries collapse by cycle and completion identity', () => {
  assert.equal(mergeAwards([e(), e()], []).length, 1);
});
