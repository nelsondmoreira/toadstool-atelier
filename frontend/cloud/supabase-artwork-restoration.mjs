import {createArtworkRestorer} from './artwork-restoration.mjs';
const TYPES=new Set(['image/png','image/jpeg','image/webp']);
const ID=/^[a-zA-Z0-9_-]{1,128}$/;
// The authenticated Supabase client applies RLS to artwork_assets and storage policies.
export function createSupabaseArtworkRemote(supabase){
  return {
    async list(owner){
      const {data,error}=await supabase.from('artwork_assets').select('id,mime_type,storage_path,kind').eq('user_id',owner).eq('kind','inspiration');
      if(error)throw error;
      return (data||[]).map(row=>{
        if(!ID.test(row.id)||!TYPES.has(row.mime_type)||typeof row.storage_path!=='string'||!row.storage_path.startsWith(`${owner}/inspiration/`)||row.storage_path.includes('..'))throw Error('Invalid artwork manifest row');
        return {id:row.id,mime:row.mime_type,path:row.storage_path,kind:row.kind};
      });
    },
    async download(owner,id){
      // Resolve paths only through account-scoped metadata, never from untrusted UI input.
      const {data,error}=await supabase.from('artwork_assets').select('storage_path,mime_type').eq('user_id',owner).eq('kind','inspiration').eq('id',id).single();
      if(error)throw error;
      if(!data?.storage_path?.startsWith(`${owner}/inspiration/`)||!TYPES.has(data.mime_type))throw Error('Invalid artwork path');
      const result=await supabase.storage.from('artist-artwork').download(data.storage_path);
      if(result.error)throw result.error;
      const bytes=new Uint8Array(await result.data.arrayBuffer());
      return {mime:data.mime_type,bytes};
    }
  };
}
export function createGalleryCloudRestoration({supabase,vault,getAccount,getState,commit}){
  const remote=createSupabaseArtworkRemote(supabase);
  const restorer=createArtworkRestorer({vault,remote});
  let owner=null,epoch=0,ready=Promise.resolve();
  function session(account){owner=account||null;epoch++;restorer.session(owner);ready=Promise.resolve(vault.session(owner));return ready;}
  async function restore(){
    const account=owner,token=epoch;
    await ready;
    if(owner!==account||epoch!==token)throw Error('Account changed during vault preparation');
    if(!account)return {restored:[],skipped:[],failed:[]};
    const report=await restorer.restore();
    if(owner!==account||epoch!==token||getAccount()!==account)throw Error('Account changed during gallery restoration');
    const manifest=await remote.list(account);
    if(owner!==account||epoch!==token||getAccount()!==account)throw Error('Account changed during gallery restoration');
    const available=new Set([...report.restored,...report.skipped]);
    const current=getState();
    const existing=new Set(current.gallery.filter(x=>x.type==='encrypted-image').map(x=>x.id));
    const additions=manifest.filter(x=>available.has(x.id)&&!existing.has(x.id)).map(x=>({type:'encrypted-image',id:x.id,mime:x.mime}));
    if(additions.length)await commit(account,{...current,gallery:[...additions,...current.gallery]});
    return {...report,added:additions.length};
  }
  return {session,restore};
}
