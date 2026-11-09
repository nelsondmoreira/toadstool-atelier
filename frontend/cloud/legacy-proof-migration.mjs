import {decodeImageDataURL} from './gallery-legacy-migration.mjs';

// Migrate proof images, not badge ownership. Each successful reference is committed
// independently; failure never discards the original image or earned badge.
export function createLegacyProofMigration({gallery,persist,decode=decodeImageDataURL}) {
  if(typeof gallery?.save!=='function'||typeof gallery?.url!=='function'||typeof persist!=='function')throw Error('Invalid proof migration dependencies');
  let busy=false;
  return async function migrate({owner,getState,isCurrent}){
    if(busy)return {status:'busy'};
    if(!owner||typeof getState!=='function'||typeof isCurrent!=='function')throw Error('Account migration context required');
    busy=true;
    const result={migrated:0,failures:[],interrupted:false};
    try{
      const source=getState();
      const locations=[...Object.keys(source.atelierDone||{}).map(id=>({kind:'atelier',id})),
        ...Array.from({length:source.achievements?.length||0},(_,id)=>({kind:'achievement',id})),
        {kind:'quest',id:'current'}];
      for(const loc of locations){
        if(!isCurrent(owner)){result.interrupted=true;break;}
        const current=getState();
        const record=loc.kind==='atelier'?current.atelierDone?.[loc.id]:loc.kind==='achievement'?current.achievements?.[loc.id]:current;
        const proof=loc.kind==='quest'?record?.questProof:record?.proof;
        if(typeof proof!=='string'||!proof.startsWith('data:'))continue;
        let entry;
        try{
          const {mime,bytes}=decode(proof);
          entry=await gallery.save({type:mime,size:bytes.length,arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)});
          if(!isCurrent(owner)){result.interrupted=true;break;}
          if(!await gallery.url(entry.id))throw Error('Encrypted proof readback failed');
          if(!isCurrent(owner)){result.interrupted=true;break;}
          const latest=getState();
          const live=loc.kind==='atelier'?latest.atelierDone?.[loc.id]:loc.kind==='achievement'?latest.achievements?.[loc.id]:latest;
          const liveProof=loc.kind==='quest'?live?.questProof:live?.proof;
          if(liveProof!==proof){result.interrupted=true;break;}
          const ref='vault:'+entry.id;
          let next;
          if(loc.kind==='atelier')next={...latest,atelierDone:{...latest.atelierDone,[loc.id]:{...live,proof:ref}}};
          else if(loc.kind==='achievement')next={...latest,achievements:latest.achievements.map((a,i)=>i===loc.id?{...a,proof:ref}:a)};
          else next={...latest,questProof:ref};
          await persist(owner,next);
          result.migrated++;
        }catch(err){result.failures.push({...loc,reason:String(err?.message||err)});}
      }
      return result;
    }finally{busy=false;}
  };
}
