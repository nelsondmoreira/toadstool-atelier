import test from 'node:test';
import assert from 'node:assert/strict';
import {createArtworkVaultMigration} from './artwork-vault-migration.mjs';
function fixture({failSave=false, corrupt=false}={}) {
  const original=[{owner:'a',id:'one',mime:'image/png',blob:new Uint8Array([1,2,3])},{owner:'b',id:'other',mime:'image/png',blob:new Uint8Array([8])}];
  const encrypted=new Map();
  const queue={list:async()=>original};
  const vault={save:async(owner,id,mime,bytes)=>{if(failSave)throw Error('quota exceeded');encrypted.set(owner+id,{mime,bytes:new Uint8Array(bytes)});},load:async(owner,id)=>{const result=encrypted.get(owner+id);return corrupt&&result?{mime:result.mime,bytes:new Uint8Array([9])}:result??null;}};
  return {original,encrypted,queue,vault,migrate:createArtworkVaultMigration({queue,vault,readBytes:async blob=>blob})};
}
test('stages only active account and retains plaintext originals for later explicit cutover',async()=>{const f=fixture();const r=await f.migrate.stage('a','long secure phrase');assert.deepEqual(r.staged,['one']);assert.equal(r.safeToCutover,true);assert.equal(r.originalsRetained,true);assert.equal(f.original.length,2);assert.equal(f.encrypted.size,1);});
test('rerunning after interruption is idempotent and verifies already-staged bytes',async()=>{const f=fixture();await f.migrate.stage('a','passphrase');const r=await f.migrate.stage('a','passphrase');assert.deepEqual(r.alreadyStaged,['one']);assert.deepEqual(r.staged,[]);});
test('storage quota failure preserves original and reports unsafe cutover',async()=>{const f=fixture({failSave:true});const r=await f.migrate.stage('a','passphrase');assert.equal(r.safeToCutover,false);assert.match(r.failures[0].reason,/quota/);assert.equal(f.original[0].blob[0],1);});
test('corrupted encrypted readback is detected and blocks cutover',async()=>{const f=fixture({corrupt:true});const r=await f.migrate.stage('a','passphrase');assert.equal(r.safeToCutover,false);assert.match(r.failures[0].reason,/verification/);});
test('conflicting existing encrypted image is never overwritten',async()=>{const f=fixture();f.encrypted.set('aone',{mime:'image/png',bytes:new Uint8Array([7])});const r=await f.migrate.stage('a','passphrase');assert.equal(r.safeToCutover,false);assert.deepEqual([...f.encrypted.get('aone').bytes],[7]);});
test('progress callback sees each processed item',async()=>{const f=fixture();const seen=[];await f.migrate.stage('a','passphrase',{onProgress:p=>seen.push(p)});assert.deepEqual(seen,[{processed:1,total:2}]);});
test('rejects invalid dependencies and missing unlock secret',async()=>{assert.throws(()=>createArtworkVaultMigration({}),/dependencies/);const f=fixture();await assert.rejects(f.migrate.stage('a',''),/unlock/);});
test('concurrent migrations cannot overlap',async()=>{let release;const gate=new Promise(r=>release=r);const f=fixture();const m=createArtworkVaultMigration({queue:f.queue,vault:f.vault,readBytes:async bytes=>{await gate;return bytes;}});const first=m.stage('a','passphrase');await assert.rejects(m.stage('a','passphrase'),/already running/);release();await first;});
