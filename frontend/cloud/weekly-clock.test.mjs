import test from 'node:test';
import assert from 'node:assert/strict';
import { mondayKey, validateOfflineCompletion, mergeCompletionEvents } from './weekly-clock.mjs';

const zone = 'Europe/Lisbon';

test('Sunday to Monday reset is at Lisbon midnight in winter', () => {
  assert.equal(mondayKey('2026-11-08T23:59:59Z', zone), '2026-11-02');
  assert.equal(mondayKey('2026-11-09T00:00:00Z', zone), '2026-11-09');
});

test('summer Lisbon midnight is 23:00 UTC on Sunday', () => {
  assert.equal(mondayKey('2026-07-05T22:59:59Z', zone), '2026-06-29');
  assert.equal(mondayKey('2026-07-05T23:00:00Z', zone), '2026-07-06');
});

test('DST spring week remains local-Monday anchored', () => {
  assert.equal(mondayKey('2026-03-29T22:59:59Z', zone), '2026-03-23');
  assert.equal(mondayKey('2026-03-29T23:00:00Z', zone), '2026-03-30');
});

test('DST autumn week remains local-Monday anchored', () => {
  assert.equal(mondayKey('2026-10-25T23:59:59Z', zone), '2026-10-19');
  assert.equal(mondayKey('2026-10-26T00:00:00Z', zone), '2026-10-26');
});

test('account zone overrides device zone', () => {
  assert.equal(mondayKey('2026-11-09T01:00:00Z', 'America/Los_Angeles'), '2026-11-02');
  assert.equal(mondayKey('2026-11-09T01:00:00Z', zone), '2026-11-09');
});

test('invalid zone and timestamp are rejected', () => {
  assert.throws(() => mondayKey('2026-11-09T12:00:00Z', 'No/Such_Zone'), RangeError);
  assert.throws(() => mondayKey('not a date', zone), RangeError);
});

test('Sunday offline quest accepted after reconnect on Tuesday', () => {
  const event = {
    id: 'q-1',
    weekKey: '2026-11-02',
    completedAt: '2026-11-08T23:55:00Z'
  };
  assert.equal(validateOfflineCompletion(event, {
    zone,
    receivedAt: Date.parse('2026-11-10T09:00:00Z')
  }).ok, true);
});

test('Monday completion cannot be attributed to prior week', () => {
  const event = {
    id: 'q-2',
    weekKey: '2026-11-02',
    completedAt: '2026-11-09T00:01:00Z'
  };
  assert.equal(validateOfflineCompletion(event, {
    zone,
    receivedAt: Date.parse('2026-11-10T09:00:00Z')
  }).reason, 'expired-week');
});

test('future clock anomaly is rejected', () => {
  const event = {
    id: 'q-3',
    weekKey: '2026-11-09',
    completedAt: '2026-11-11T12:00:00Z'
  };
  assert.equal(validateOfflineCompletion(event, {
    zone,
    receivedAt: Date.parse('2026-11-09T12:00:00Z')
  }).reason, 'future-clock');
});

test('same event ID merges once despite retries', () => {
  const e = {
    id: 'q-4',
    weekKey: '2026-11-02',
    completedAt: '2026-11-08T21:00:00Z'
  };
  const result = mergeCompletionEvents([e], [e], {
    zone,
    receivedAt: Date.parse('2026-11-10T09:00:00Z')
  });
  assert.equal(result.events.length, 1);
  assert.equal(result.rejected[0].reason, 'duplicate');
});

test('distinct event IDs merge, even across offline devices', () => {
  const a = {
    id: 'mission-a',
    weekKey: '2026-11-02',
    completedAt: '2026-11-08T20:00:00Z'
  };
  const b = {
    id: 'mission-b',
    weekKey: '2026-11-02',
    completedAt: '2026-11-08T20:01:00Z'
  };
  const result = mergeCompletionEvents([a], [b], {
    zone,
    receivedAt: Date.parse('2026-11-10T09:00:00Z')
  });
  assert.deepEqual(result.events.map(e => e.id), ['mission-a', 'mission-b']);
});

test('malformed event is rejected rather than crashing', () => {
  assert.equal(validateOfflineCompletion(null, {
    zone
  }).reason, 'invalid-event');
  assert.equal(validateOfflineCompletion({
    id: 'x',
    weekKey: '2026-11-02',
    completedAt: 'nonsense'
  }, {
    zone
  }).reason, 'invalid-timestamp');
});
