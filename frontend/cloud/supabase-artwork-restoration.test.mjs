import test from 'node:test';
import assert from 'node:assert/strict';
import {createGalleryCloudRestoration} from './supabase-artwork-restoration.mjs';
function fixture(){
 const cloud=new Map([['art1',{mime:'image/png',bytes:new Uint8Array([1,2,3])}]]);
 const local=new Map();let owner='alice',state={gallery:[]},commits=0;
 const client={from(table){assert.equal(table,'artwork_assets');return {select(){return {eq(){return this},single:async()=>({data:{storage_path:'alice/inspiration/art1.png',mime_type:'image/png'}}),then(resolve){resolve({data:[{id:'art1',mime_type:'image/png',storage_path:'alice/inspiration/art1.png',kind:'inspiration'}]})}}}}},storage:{from(bucket){assert.equal(bucket,'artist-artwork');return {download:async()=>({data:new Blob([cloud.get('art1').bytes]),error:null})}}}};
 const vault={session:async()=>{},load:async(account,id)=>local.get(account+id)||null,save:async(account,id,mime,bytes)=>{local.set(account+id,{mime,bytes})}};
 const restore=createGalleryCloudRestoration({supabase:client,vault,getAccount:()=>owner,getState:()=>state,commit:async(account,next)=>{assert.equal(account,owner);state=next;commits++}});
 return {restore,local,get state(){return state},get commits(){return commits},setOwner:x=>owner=x};
}
test('Supabase download restores a missing gallery image and persists its reference',async()=>{const f=fixture();await f.restore.session('alice');const r=await f.restore.restore();assert.equal(r.added,1);assert.deepEqual([...f.local.get('aliceart1').bytes],[1,2,3]);assert.equal(f.state.gallery[0].id,'art1')});
test('Repeated restoration preserves existing local data and avoids duplicate entries',async()=>{const f=fixture();await f.restore.session('alice');await f.restore.restore();const r=await f.restore.restore();assert.equal(r.added,0);assert.equal(f.commits,1);assert.equal(f.state.gallery.length,1)});
test('Account switch before restoration does not commit old gallery',async()=>{const f=fixture();await f.restore.session('alice');f.setOwner('bob');await assert.rejects(f.restore.restore(),/Account changed/);assert.equal(f.commits,0)});
