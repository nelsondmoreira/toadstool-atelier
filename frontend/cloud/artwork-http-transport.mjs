// Minimal fetch transport for testing the encrypted-first pipeline across a real
// HTTP boundary. Production Supabase transport will use its authenticated SDK.
export function createArtworkHttpTransport({baseUrl, token, fetchImpl=globalThis.fetch}) {
  if (!/^https?:\/\//.test(baseUrl)||typeof token!=='function'||typeof fetchImpl!=='function') throw Error('Invalid HTTP transport');
  async function request(path,body) {
    const auth=await token();
    if (!auth) throw Error('Not authenticated');
    const response=await fetchImpl(new URL(path,baseUrl),{
      method:'POST',headers:{'authorization':`Bearer ${auth}`,'content-type':'application/json'},
      body:JSON.stringify(body)
    });
    if (!response.ok) throw Error(`Artwork API ${response.status}`);
    return response.json();
  }
  return {
    upload:async (item,bytes)=>request('/artwork/upload',{
      owner:item.owner,id:item.id,path:item.path,mime:item.mime,bytes:Array.from(bytes)
    }),
    removeRemote:async item=>request('/artwork/delete',{owner:item.owner,id:item.id,path:item.path}),
    metadata:async item=>request('/artwork/metadata',{
      owner:item.owner,id:item.id,path:item.path,kind:item.kind,slot:item.slot,mime:item.mime
    })
  };
}
