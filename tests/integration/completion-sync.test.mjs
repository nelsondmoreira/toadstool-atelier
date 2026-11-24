import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recordCompletion, totals, pendingEvents } from '../../frontend/cloud/completion-ledger.mjs';
import { syncCompletions, parseCompletionId } from '../../frontend/cloud/completion-sync.mjs';

const event = (slot = '0') => ({
  id: `mission:2026-11-09:${slot}`,
  kind: 'mission',
  skill: 'Anatomy',
  xp: 20,
  cycle: 0,
  completedAt: '2026-11-09T10:00:00Z'
});

const ledger = () => recordCompletion([], event()).events;

test('RPC confirms offline XP without changing visible total', async () => {
  const calls = [];
  const client = {
    rpc: async (name, args) => {
      calls.push([name, args]);
      return {
        data: [{
            outcome: 'confirmed'
          }],
        error: null
      };
    }
  };
  const out = await syncCompletions(client, ledger());
  assert.equal(out.events[0].status, 'confirmed');
  assert.equal(totals(out.events).cycleXp, 20);
  assert.equal(calls[0][1].p_week_key, '2026-11-09');
});

test('duplicate confirms an already-earned award without removing XP', async () => {
  const out = await syncCompletions({
    rpc: async () => ({
      data: [{
          outcome: 'duplicate'
        }]
    })
  }, ledger());
  assert.equal(totals(out.events).cycleXp, 20);
  assert.equal(out.results[0].status, 'duplicate');
});

test('network errors retain pending events for retry', async () => {
  const out = await syncCompletions({
    rpc: async () => {
      throw Error('offline');
    }
  }, ledger());
  assert.equal(pendingEvents(out.events).length, 1);
  assert.equal(totals(out.events).cycleXp, 20);
});

test('server rejection rolls back only rejected XP', async () => {
  const two = recordCompletion(ledger(), event('1')).events;
  let n = 0;
  const out = await syncCompletions({
    rpc: async () => ({
      data: [{
          outcome: ++n === 1 ? 'rejected' : 'confirmed'
        }]
    })
  }, two);
  assert.equal(totals(out.events).cycleXp, 20);
  assert.equal(pendingEvents(out.events).length, 0);
});

test('malformed server result cannot acknowledge event', async () => {
  const out = await syncCompletions({
    rpc: async () => ({
      data: {
        outcome: 'oops'
      }
    })
  }, ledger());
  assert.equal(pendingEvents(out.events).length, 1);
});

test('retry after uncertain acknowledgement resolves as duplicate', async () => {
  const first = await syncCompletions({
    rpc: async () => ({
      error: {
        message: 'timeout'
      }
    })
  }, ledger());
  const second = await syncCompletions({
    rpc: async () => ({
      data: [{
          outcome: 'duplicate'
        }]
    })
  }, first.events);
  assert.equal(totals(second.events).cycleXp, 20);
});

test('invalid identity cannot reach RPC', () => assert.throws(() => parseCompletionId('mission:../../x:0')));

test('independent devices can race; second gets duplicate (simulated serialized server)', async () => {
  const awarded = new Set();
  const client = {
    rpc: async (_, args) => {
      const key = `${args.p_cycle}:${args.p_week_key}:${args.p_kind}:${args.p_slot}`;
      const outcome = awarded.has(key) ? 'duplicate' : 'confirmed';
      awarded.add(key);
      return {
        data: [{
            outcome
          }]
      };
    }
  };
  const [a, b] = await Promise.all([syncCompletions(client, ledger()), syncCompletions(client, ledger())]);
  assert.equal(totals(a.events).cycleXp, 20);
  assert.equal(totals(b.events).cycleXp, 20);
  assert.equal(awarded.size, 1);
});
