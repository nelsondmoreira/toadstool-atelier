// Durable, conservative cleanup of locally encrypted artwork.
// A queued cleanup is never authorization to delete a referenced image.
const valid = x => typeof x === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(x);
export function createArtworkCleanup({jobs, vault, isReferenced, clock=()=>Date.now()}) {
  if (!jobs || !['put','list','delete'].every(k=>typeof jobs[k]==='function') || !vault || typeof vault.remove!=='function' || typeof isReferenced!=='function') throw Error('Invalid cleanup dependencies');
  const active = new Set();
  function check(owner,id){if(!valid(owner)||!valid(id))throw Error('Invalid artwork identity');}
  return {
    async schedule(owner,id,reason='unreferenced') {
      check(owner,id);
      const key=`${owner}:${id}`;
      await jobs.put({key,owner,id,reason:String(reason).slice(0,80),createdAt:clock(),attempts:0});
      return key;
    },
    async cancel(owner,id){check(owner,id);await jobs.delete(`${owner}:${id}`);},
    async run(owner) {
      if(!valid(owner))throw Error('Invalid account');
      if(active.has(owner))return {skipped:true};
      active.add(owner);
      const result={deleted:[],retained:[],failed:[]};
      try {
        for(const job of await jobs.list(owner)) {
          if(job.owner!==owner||!valid(job.id)||job.key!==`${owner}:${job.id}`)continue;
          try {
            // Recheck immediately before deletion; a reference may have appeared since scheduling.
            if(await isReferenced(owner,job.id)) {
              await jobs.delete(job.key);
              result.retained.push(job.id);
              continue;
            }
            await vault.remove(owner,job.id);
            await jobs.delete(job.key);
            result.deleted.push(job.id);
          } catch(error) {
            result.failed.push({id:job.id,error:String(error?.message||error)});
            // Keep the original job durable for retry; never claim success.
            try {await jobs.put({...job,attempts:(job.attempts||0)+1,lastAttemptAt:clock()});}catch{}
          }
        }
        return result;
      } finally {active.delete(owner);}
    }
  };
}

// Independent IndexedDB journal; survives app restarts and account changes.
export function indexedCleanupJobs(factory=globalThis.indexedDB) {
  if(!factory)throw Error('IndexedDB unavailable');
  async function transaction(mode,operation) {
    const db=await new Promise((resolve,reject)=>{
      const request=factory.open('pah-artwork-cleanup-v1',1);
      request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains('jobs')){
        const store=request.result.createObjectStore('jobs',{keyPath:'key'});
        store.createIndex('owner','owner');
      }};
      request.onsuccess=()=>resolve(request.result);
      request.onerror=()=>reject(request.error||Error('Cannot open cleanup journal'));
    });
    return new Promise((resolve,reject)=>{
      const tx=db.transaction('jobs',mode);let value;
      try {const req=operation(tx.objectStore('jobs'));req.onsuccess=()=>{value=req.result;};}
      catch(e){tx.abort();db.close();reject(e);return;}
      tx.oncomplete=()=>{db.close();resolve(value);};
      tx.onerror=()=>{db.close();reject(tx.error||Error('Cleanup journal failure'));};
      tx.onabort=()=>{db.close();reject(tx.error||Error('Cleanup journal aborted'));};
    });
  }
  return {put:job=>transaction('readwrite',s=>s.put(job)),delete:key=>transaction('readwrite',s=>s.delete(key)),list:owner=>transaction('readonly',s=>s.index('owner').getAll(owner))};
}
