// Encrypted-first upload pipeline. Deliberately opt-in until vault unlock UX is wired.
// The queue stores metadata only; plaintext bytes never enter the queue adapter.
const MIME = new Set(['image/png','image/jpeg','image/webp']);
const KINDS = new Set(['inspiration','quest-proof','atelier-proof','atelier-design']);
const assertId = (s,label) => {if(typeof s!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(s))throw Error(`Invalid ${label}`);};
export function createVaultUploadPipeline({vault,queue,upload,metadata,removeRemote=async()=>{},deleted=async()=>false}) {
  if(!vault||!queue||typeof vault.save!=='function'||typeof vault.load!=='function'||typeof vault.remove!=='function'||typeof queue.put!=='function'||typeof queue.list!=='function'||typeof queue.remove!=='function'||typeof upload!=='function'||typeof metadata!=='function')throw Error('Invalid pipeline dependencies');
  const inFlight=new Set();
  async function enqueue({owner,id,kind,slot=null,mime,bytes,passphrase}) {
    assertId(owner,'owner');assertId(id,'artwork ID');
    if(!KINDS.has(kind)||!MIME.has(mime)||!(bytes instanceof Uint8Array)||!bytes.length)throw Error('Invalid artwork');
    if(await deleted(owner,kind,slot))throw Error('Artwork was deleted');
    // Persist encrypted bytes first. If the metadata write fails, an orphaned encrypted
    // object may remain, but no plaintext has been persisted and retry is safe.
    await vault.save(owner,id,mime,bytes,passphrase);
    const path=`${owner}/${kind}/${id}.${mime==='image/png'?'png':mime==='image/webp'?'webp':'jpg'}`;
    const record={id,owner,kind,slot,mime,path,status:'pending',attempts:0,bytes:bytes.length};
    await queue.put(record);
    return record;
  }
  async function flush(owner,passphrase) {
    assertId(owner,'owner');
    if(inFlight.has(owner))return {busy:true};
    inFlight.add(owner);
    const result={uploaded:[],failed:[],skipped:[]};
    try {
      for(const item of await queue.list(owner)) {
        if(item.owner!==owner)continue;
        try {
          if(await deleted(owner,item.kind,item.slot)){
            // Cleanup must be idempotent: this may be a retry after an interrupted upload.
            await removeRemote(item);
            await queue.remove(owner,item.id);
            result.skipped.push(item.id);continue;
          }
          const data=await vault.load(owner,item.id,passphrase);
          if(!data||data.mime!==item.mime)throw Error('Encrypted artwork missing or mismatched');
          await upload(item,data.bytes);
          // Deletion can happen while upload is in flight; don't publish metadata.
          if(await deleted(owner,item.kind,item.slot)){
            // A deletion that arrives during HTTP upload must remove the remote object.
            // Keep the queue entry if cleanup fails so the next flush retries it.
            await removeRemote(item);
            await queue.remove(owner,item.id);
            result.skipped.push(item.id);continue;
          }
          await metadata(item);
          // A failed queue removal is retryable: server storage/metadata must be idempotent.
          await queue.remove(owner,item.id);
          result.uploaded.push(item.id);
        }catch(e){result.failed.push({id:item.id,error:String(e?.message||e)});}
      }
      return result;
    }finally{inFlight.delete(owner);}
  }
  return {enqueue,flush};
}
