// Convert legacy data-URL gallery entries one at a time. Commit state only after
// encrypted persistence and a successful decrypt/readback. Never delete originals
// on failure. The caller owns the account-scoped state persistence function.
export function createLegacyGalleryMigration({gallery, persist, decode=decodeImageDataURL}) {
  if (!gallery?.save || !gallery?.url || typeof persist !== 'function') throw Error('Invalid gallery migration dependencies');
  let busy = false;
  return async function migrate({owner, getState, isCurrent}) {
    if (busy) return {status:'busy'};
    if (!owner || typeof getState !== 'function' || typeof isCurrent !== 'function') throw Error('Account migration context required');
    busy = true;
    const result = {migrated:0, failures:[], interrupted:false};
    try {
      // Do not hold a stale state snapshot while awaiting crypto or storage.
      const count = getState().gallery?.length || 0;
      for (let i=0; i<count; i++) {
        if (!isCurrent(owner)) {result.interrupted=true;break;}
        const item = getState().gallery?.[i];
        if (item?.type !== 'image') continue;
        let entry;
        try {
          const {mime,bytes}=decode(item.data);
          entry=await gallery.save({type:mime,size:bytes.length,arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)});
          if (!isCurrent(owner)) {result.interrupted=true;break;}
          if (!await gallery.url(entry.id)) throw Error('Encrypted readback failed');
          if (!isCurrent(owner)) {result.interrupted=true;break;}
          // Persist a new immutable state; never mutate the in-memory original first.
          const current=getState();
          if (current.gallery?.[i] !== item) {result.interrupted=true;break;}
          const next={...current,gallery:current.gallery.map((g,j)=>j===i?entry:g)};
          await persist(owner,next);
          if (!isCurrent(owner)) {result.interrupted=true;break;}
          result.migrated++;
        } catch (e) {
          result.failures.push({index:i,reason:String(e?.message||e)});
        }
      }
      return result;
    } finally {busy=false;}
  };
}
export function decodeImageDataURL(value) {
  if (typeof value !== 'string') throw Error('Invalid legacy image');
  const match=/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match) throw Error('Unsupported legacy image encoding');
  const binary=atob(match[2]);
  if (!binary.length || binary.length>30*1024*1024) throw Error('Legacy image exceeds allowed size');
  const bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));
  return {mime:match[1],bytes};
}
