import {test} from 'node:test';
import assert from 'node:assert/strict';
import {syncCompletions,mergeServerAwards,fetchCompletionAwards} from './completion-sync.mjs';
import {totals} from './completion-ledger.mjs';
const event=(slot='0',status='pending')=>({id:`mission:2026-11-09:${slot}`,kind:'mission',cycle:0,skill:'Anatomy',xp:20,status,completedAt:'2026-11-09T12:00:00Z'});
test('server duplicate is confirmed, not removed from local XP',async()=>{
 const client={rpc:async()=>({data:{outcome:'duplicate',awarded_xp:0,total_cycle_xp:20},error:null})};
 const {events,results}=await syncCompletions(client,[event()]);
 assert.equal(events[0].status,'confirmed');assert.equal(totals(events).cycleXp,20);assert.equal(results[0].status,'duplicate');
});
test('two concurrent devices submitting same mission converge to one award',async()=>{
 const awards=new Map();const client={rpc:async(_,{p_slot})=>{const prior=awards.has(p_slot);awards.set(p_slot,event(p_slot,'confirmed'));return {data:{outcome:prior?'duplicate':'confirmed'},error:null}}};
 const [a,b]=await Promise.all([syncCompletions(client,[event()]),syncCompletions(client,[event()])]);
 const merged=mergeServerAwards([...a.events,...b.events],[...awards.values()]);
 assert.equal(merged.length,1);assert.equal(totals(merged).cycleXp,20);
});
test('two different offline missions survive server reconciliation',()=>{
 const merged=mergeServerAwards([event('0'),event('1')],[event('0','confirmed')]);
 assert.equal(merged.length,2);assert.equal(totals(merged).cycleXp,40);assert.equal(totals(merged).pending,1);
});
test('server rejection removes optimistic XP but leaves other rewards',async()=>{
 const client={rpc:async(_,{p_slot})=>({data:{outcome:p_slot==='0'?'rejected':'confirmed'},error:null})};
 const {events}=await syncCompletions(client,[event('0'),event('1')]);
 assert.equal(totals(events).cycleXp,20);
});
test('transient RPC failure keeps event pending for retry',async()=>{
 const client={rpc:async()=>({data:null,error:{message:'network down'}})};
 const {events,results}=await syncCompletions(client,[event()]);
 assert.equal(events[0].status,'pending');assert.equal(results[0].status,'retry');
});
test('server snapshot overrides stale local award fields',()=>{
 const local=[{...event('0','confirmed'),xp:50}];
 const merged=mergeServerAwards(local,[event('0','confirmed')]);
 assert.equal(merged[0].xp,20);
});
test('fetch awards rejects malformed response and propagates database errors',async()=>{
 await assert.rejects(()=>fetchCompletionAwards({from:()=>({select:async()=>({data:null,error:{message:'offline'}})})}));
 await assert.rejects(()=>fetchCompletionAwards({from:()=>({select:async()=>({data:{},error:null})})}));
});
test('invalid event identity cannot be sent to RPC',async()=>{
 let calls=0;const client={rpc:async()=>{calls++;return {data:{outcome:'confirmed'}}}};
 const {events}=await syncCompletions(client,[{...event(),id:'../invalid'}]);
 assert.equal(calls,0);assert.equal(events[0].status,'rejected');
});
