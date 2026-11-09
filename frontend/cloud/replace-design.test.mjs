import test from 'node:test';
import assert from 'node:assert/strict';
import {replaceDesign,retryCleanup} from './replace-design.mjs';
function harness(options={}) {
 const state={active:'user/atelier-design/original',deleted:[],pending:[],staged:[],errors:[]};
 const adapter={
  newId:()=> 'next',
  stage:async x=>state.staged.push(x),
  upload:async()=>{if(options.uploadFails)throw Error('network offline')},
  commit:async({path})=>{if(options.commitFails)throw Error('database unavailable');const previous=state.active;state.active=path;return previous},
  scheduleCleanup:async job=>state.pending.push(job),
  cleanup:async({path})=>{if(options.cleanupFails)throw Error('delete temporarily unavailable');state.deleted.push(path)},
  noteCleanupFailure:async x=>state.errors.push(x),
  complete:async()=>{},noteFailure:async x=>state.errors.push(x),
  isReferenced:async path=>path===state.active,
  finishCleanup:async()=>{state.pending=[]}
 };return {state,adapter};
}
test('successful replacement switches pointer then deletes previous object',async()=>{
 const {state,adapter}=harness();await replaceDesign({owner:'user',slot:'badge1',file:{},adapter});
 assert.equal(state.active,'user/atelier-design/next');assert.deepEqual(state.deleted,['user/atelier-design/original']);
});
test('offline upload preserves original and never deletes it',async()=>{
 const {state,adapter}=harness({uploadFails:true});await assert.rejects(replaceDesign({owner:'user',slot:'badge1',file:{},adapter}));
 assert.equal(state.active,'user/atelier-design/original');assert.deepEqual(state.deleted,[]);
});
test('failed database commit preserves original and never deletes it',async()=>{
 const {state,adapter}=harness({commitFails:true});await assert.rejects(replaceDesign({owner:'user',slot:'badge1',file:{},adapter}));
 assert.equal(state.active,'user/atelier-design/original');assert.deepEqual(state.deleted,[]);
});
test('failed deletion leaves new image active and queues cleanup',async()=>{
 const {state,adapter}=harness({cleanupFails:true});await replaceDesign({owner:'user',slot:'badge1',file:{},adapter});
 assert.equal(state.active,'user/atelier-design/next');assert.equal(state.pending.length,1);assert.equal(state.errors.length,1);
});
test('cleanup never deletes an image that is still referenced',async()=>{
 const {state,adapter}=harness();const result=await retryCleanup({adapter,job:{oldPath:state.active,owner:'user',operationId:'old'}});
 assert.equal(result.skipped,'still referenced');assert.deepEqual(state.deleted,[]);
});
test('missing owner or slot is rejected',async()=>{
 const {adapter}=harness();await assert.rejects(replaceDesign({owner:'',slot:'badge1',file:{},adapter}));
});
