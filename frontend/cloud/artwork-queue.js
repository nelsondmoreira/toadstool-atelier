import {optimizeImage} from './image-optimization.mjs';
import {browserArtworkVault} from './artwork-vault-session.mjs';
import {createArtworkCleanup, indexedCleanupJobs} from './artwork-cleanup.mjs';
// Private, account-scoped offline artwork upload queue (v0.5).
// IndexedDB stores File blobs; Supabase Storage stores private objects.
const DB = 'pah-artwork-queue-v1';
const STORE = 'uploads';
const DELETIONS = 'proof_deletions';
const MAX_BYTES = 30 * 1024 * 1024;
const MIME = new Set(['image/png', 'image/jpeg', 'image/webp']);
function dbOpen() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 2);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        const store = req.result.createObjectStore(STORE, {keyPath:'id'});
        store.createIndex('owner', 'owner');
      }
      if (!req.result.objectStoreNames.contains(DELETIONS)) req.result.createObjectStore(DELETIONS, {keyPath:'key'});
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function transact(mode, fn, table=STORE) {
  const db = await dbOpen();
  return new Promise((resolve,reject) => {
    const tx = db.transaction(table, mode);
    let value;
    tx.oncomplete = () => {db.close(); resolve(value);};
    tx.onerror = () => {db.close(); reject(tx.error);};
    try { const req = fn(tx.objectStore(table)); if(req) {req.onsuccess=()=>{value=req.result;};} }
    catch(e) {tx.abort(); reject(e);}
  });
}
const all = () => transact('readonly', store => store.getAll());
const put = item => transact('readwrite', store => store.put(item));
const remove = id => transact('readwrite', store => store.delete(id));
const now = () => new Date().toISOString();
const deletions = () => transact('readonly', st=>st.getAll(),DELETIONS);
const saveDeletion = item => transact('readwrite', st=>st.put(item),DELETIONS);
const clearDeletion = key => transact('readwrite', st=>st.delete(key),DELETIONS);
const proofKey = (owner,kind,slot) => `${owner}:${kind}:${slot}`;
async function isDeleted(owner,kind,slot) {return (await deletions()).some(x=>x.key===proofKey(owner,kind,slot));}

export function setupArtworkQueue(supabase, {vault=browserArtworkVault()}={}) {
  let owner = null, running = false;
  // Durable cleanup for encrypted bytes whose queue metadata never committed.
  // Only queue-owned IDs are scheduled here; gallery/proof references are never swept.
  const cleanup = createArtworkCleanup({
    jobs:indexedCleanupJobs(), vault,
    isReferenced:async(account,id)=>(await all()).some(row=>row.owner===account&&row.id===id)
  });
  const status = document.getElementById('artworkQueueStatus');
  async function paint(extra='') {
    if (!status) return;
    if (!owner) { status.textContent='Private artwork sync: sign in to enable uploads.'; return; }
    try {
      const items = (await all()).filter(x=>x.owner===owner);
      const pending = items.filter(x=>x.status!=='uploaded').length;
      const pendingDeletes=(await deletions()).filter(x=>x.owner===owner).length;
      status.textContent = pending ? `☁ ${pending} artwork upload${pending===1?'':'s'} pending${navigator.onLine?'':' · offline'}${extra?' · '+extra:''}` : (pendingDeletes?`☁ ${pendingDeletes} proof deletion${pendingDeletes===1?'':'s'} pending`:'☁ Artwork upload queue is clear');
    } catch(e) {status.textContent='Artwork queue unavailable: '+e.message;}
  }
  async function enqueue(file, kind, slot=null) {
    const enqueueOwner = owner;
    if (!enqueueOwner) throw Error('Sign in before adding artwork to the cloud queue.');
    if (!file || !MIME.has(file.type) || file.size>MAX_BYTES) throw Error('Choose a PNG, JPG or WebP image under 30 MB.');
    if (['quest-proof','atelier-proof'].includes(kind) && await isDeleted(enqueueOwner,kind,slot)) throw Error('This proof has been deleted; it cannot be uploaded again.');
    const optimized = await optimizeImage(file);
    // Image decoding is asynchronous. Never attribute a drawing to a different
    // account if sign-out or account switching happened while decoding.
    if (owner !== enqueueOwner) throw Error('Account changed while preparing artwork; please retry after signing in.');
    if (['quest-proof','atelier-proof'].includes(kind) && await isDeleted(enqueueOwner,kind,slot)) throw Error('This proof has been deleted; it cannot be uploaded again.');
    if (owner !== enqueueOwner) throw Error('Account changed while preparing artwork; please retry after signing in.');
    const id = crypto.randomUUID();
    const bytes = new Uint8Array(await optimized.blob.arrayBuffer());
    await vault.save(enqueueOwner,id,optimized.mime,bytes);
    if(owner!==enqueueOwner){await cleanup.schedule(enqueueOwner,id,'account-switched-before-queue-commit');throw Error('Account changed while encrypting artwork');}
    const extension = optimized.mime==='image/png'?'png':optimized.mime==='image/webp'?'webp':'jpg';
    const item = {id, owner:enqueueOwner, kind, slot, encrypted:true, mime:optimized.mime, bytes:optimized.optimizedBytes, originalBytes:optimized.originalBytes,
      path:`${enqueueOwner}/${kind}/${id}.${extension}`, status:'pending', attempts:0, createdAt:now()};
    try {await put(item);} catch(e) {await cleanup.schedule(enqueueOwner,id,'queue-commit-failed');throw e;}
    await paint();
    if(navigator.onLine) void flush();
    return id;
  }
  async function flush() {
    if (!owner || running || !navigator.onLine) {await paint();return;}
    running=true;
    const activeOwner=owner;
    try {
      // Cleanup failures must not block ordinary uploads or proof deletions.
      try { await cleanup.run(activeOwner); } catch (error) {
        if (status) status.textContent='Local artwork cleanup will retry: '+String(error?.message||error);
      }
      await flushDeletions(activeOwner);
      const items = (await all()).filter(x=>x.owner===activeOwner && x.status!=='uploaded');
      for (const item of items) {
        if(owner!==activeOwner || !navigator.onLine) break;
        if (['quest-proof','atelier-proof'].includes(item.kind) && await isDeleted(activeOwner,item.kind,item.slot)) {await remove(item.id);if(item.encrypted)await vault.remove(activeOwner,item.id);continue;}
        try {
          const decrypted=item.encrypted?await vault.load(activeOwner,item.id):null;
          if(item.encrypted&&(!decrypted||decrypted.mime!==item.mime))throw Error('Encrypted artwork unavailable');
          if(owner!==activeOwner)break;
          const uploadBlob=item.encrypted?new Blob([decrypted.bytes],{type:item.mime}):item.blob; // Legacy queue items remain retryable.
          const {error:uploadError}=await supabase.storage.from('artist-artwork').upload(item.path,uploadBlob,{contentType:item.mime,upsert:false});
          // An existing object can be a successful retry after a lost acknowledgement.
          if(uploadError && !/already exists|duplicate/i.test(uploadError.message)) throw uploadError;
          const {error:metadataError}=await supabase.from('artwork_assets').upsert({id:item.id,user_id:activeOwner,kind:item.kind,slot:item.slot,storage_path:item.path,mime_type:item.mime,byte_size:item.bytes},{onConflict:'id'});
          if(metadataError) throw metadataError;
          // Deletion may have been requested while the upload was in flight.
          if (['quest-proof','atelier-proof'].includes(item.kind) && await isDeleted(activeOwner,item.kind,item.slot)) {
            await saveDeletion({key:proofKey(activeOwner,item.kind,item.slot),owner:activeOwner,kind:item.kind,slot:item.slot});
          }
          await remove(item.id);
          if(item.encrypted)await vault.remove(activeOwner,item.id);
        } catch(e) {
          item.attempts++;
          item.lastError=String(e.message||e).slice(0,180);
          item.lastAttemptAt=now();
          await put(item);
          // Don't spin endlessly on permissions/configuration errors.
          await paint('retry later');
          break;
        }
      }
    } finally {running=false; await paint();}
  }
  window.addEventListener('online',()=>void flush());
  document.addEventListener('visibilitychange',()=>{if(!document.hidden) void flush();});
  // Persist a tombstone BEFORE removing pending uploads. This survives offline restarts.
  // A cloud RPC removes asset metadata and records a durable server-side tombstone.
  async function deleteProof(kind,slot) {
    if (!owner || !['quest-proof','atelier-proof'].includes(kind) || !slot) return;
    const activeOwner=owner;
    await saveDeletion({key:proofKey(activeOwner,kind,slot),owner:activeOwner,kind,slot});
    const pending=(await all()).filter(x=>x.owner===activeOwner&&x.kind===kind&&x.slot===slot);
    for(const item of pending) {await remove(item.id);if(item.encrypted)await vault.remove(activeOwner,item.id);}
    await paint();
    if(navigator.onLine) await flush();
  }
  async function flushDeletions(activeOwner) {
    for (const job of (await deletions()).filter(x=>x.owner===activeOwner)) {
      if(owner!==activeOwner || !navigator.onLine) return;
      try {
        const {data,error}=await supabase.rpc('delete_proof_assets',{p_kind:job.kind,p_slot:job.slot});
        if(error) throw error;
        // Server records the tombstone before returning paths; failed object deletion is retried.
        const paths=(data||[]).map(row=>row.storage_path).filter(Boolean);
        if(paths.length) {
          const {error:removeError}=await supabase.storage.from('artist-artwork').remove(paths);
          if(removeError) throw removeError;
          const {error:ackError}=await supabase.rpc('ack_proof_storage_cleanup',{p_paths:paths});
          if(ackError) throw ackError;
        }
        await clearDeletion(job.key);
      } catch(e) {
        if(status)status.textContent='Proof deletion awaiting cloud confirmation: '+String(e.message||e);
        break;
      }
    }
  }
  document.addEventListener('pah:artwork-proof-deleted', event=>{
    const {kind,slot}=event.detail||{};
    void deleteProof(kind,slot).catch(e=>{if(status)status.textContent='Proof cleanup pending: '+e.message;});
  });
  document.addEventListener('pah:artwork-confirmed', event=>{
    const {file,kind,slot}=event.detail||{};
    if(!owner||!file||!['inspiration','quest-proof','atelier-proof','atelier-design'].includes(kind))return;
    void enqueue(file,kind,slot||null).catch(e=>{if(status)status.textContent='Artwork queue: '+e.message;});
  });
  return {enqueue,flush,paint,session:async session=>{owner=session?.user?.id||null;await vault.session(owner);await paint();if(owner)await flush();}};
}
