// Restore authenticated cloud artwork to the account's encrypted local repository.
// Cloud recovery is possible only for objects the authenticated server can return.
const TYPES=new Set(['image/png','image/jpeg','image/webp']);
const ID=/^[A-Za-z0-9_-]{1,128}$/;
export function createArtworkRestorer({vault,remote}) {
  if(!vault||!remote||typeof remote.list!=='function'||typeof remote.download!=='function')throw Error('Invalid restoration dependencies');
  let owner=null,epoch=0,running=null;
  function session(account){owner=account||null;epoch++;running=null;}
  async function restore(){
    if(!owner)throw Error('Sign in to restore artwork');
    if(running)return running;
    const account=owner,version=epoch;
    const valid=()=>owner===account&&epoch===version;
    const task=(async()=>{
      const report={restored:[],skipped:[],failed:[]};
      const items=await remote.list(account);
      if(!Array.isArray(items)||items.length>10000)throw Error('Invalid cloud artwork manifest');
      const seen=new Set();
      for(const item of items){
        if(!valid())break;
        if(!item||!ID.test(item.id)||!TYPES.has(item.mime)||seen.has(item.id)){
          report.failed.push({id:item?.id??null,error:'Invalid or duplicate manifest entry'});continue;
        }
        seen.add(item.id);
        try{
          // Existing local artwork (including unsynced work) must never be replaced.
          if(await vault.load(account,item.id)){report.skipped.push(item.id);continue;}
          if(!valid())break;
          const downloaded=await remote.download(account,item.id);
          if(!valid())break;
          if(!downloaded||downloaded.mime!==item.mime||!(downloaded.bytes instanceof Uint8Array)||downloaded.bytes.length===0||downloaded.bytes.length>30*1024*1024)throw Error('Invalid cloud image');
          await vault.save(account,item.id,item.mime,downloaded.bytes);
          if(!valid())break;
          const checked=await vault.load(account,item.id);
          if(!checked||checked.mime!==item.mime||checked.bytes.length!==downloaded.bytes.length||checked.bytes.some((b,i)=>b!==downloaded.bytes[i]))throw Error('Restored image verification failed');
          report.restored.push(item.id);
        }catch(error){if(!valid())break;report.failed.push({id:item.id,error:String(error.message||error)});}
      }
      if(!valid())throw Error('Account changed during artwork restoration');
      return report;
    })();
    running=task;
    try{return await task;}finally{if(running===task)running=null;}
  }
  return {session,restore};
}
export function createArtworkRecoveryHttp({baseUrl,token,fetchImpl=globalThis.fetch}){
  if(!/^https?:\/\//.test(baseUrl)||typeof token!=='function'||typeof fetchImpl!=='function')throw Error('Invalid cloud recovery transport');
  async function call(route,owner,id){
    const bearer=await token();if(!bearer)throw Error('Not authenticated');
    const response=await fetchImpl(new URL(route,baseUrl),{method:'POST',headers:{authorization:`Bearer ${bearer}`,'content-type':'application/json'},body:JSON.stringify({owner,...(id?{id}:{})})});
    if(!response.ok)throw Error(`Artwork API ${response.status}`);
    return response.json();
  }
  return {
    list:async owner=>(await call('/artwork/list',owner)).items,
    download:async(owner,id)=>{const data=await call('/artwork/download',owner,id);if(!Array.isArray(data.bytes)||data.bytes.length>30*1024*1024||data.bytes.some(x=>!Number.isInteger(x)||x<0||x>255))throw Error('Invalid download bytes');return {mime:data.mime,bytes:Uint8Array.from(data.bytes)};}
  };
}
