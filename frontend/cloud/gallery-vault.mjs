// Gallery images are encrypted in IndexedDB; application state stores IDs only.
// Object URLs are ephemeral and revoked on account switch or removal.
export function createGalleryVault(vault,{createURL=blob=>URL.createObjectURL(blob),revokeURL=url=>URL.revokeObjectURL(url)}={}) {
  let owner=null, epoch=0;
  const urls=new Map();
  const clear=()=>{for(const url of urls.values())revokeURL(url);urls.clear();};
  return {
    async session(next){const token=++epoch;clear();owner=next||null;await vault.session(owner);if(token!==epoch)throw Error('Superseded gallery session');},
    async save(file){
      const account=owner, token=epoch;
      if(!account)throw Error('Sign in before storing private gallery artwork');
      if(!file||!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>30*1024*1024||!file.size)throw Error('Choose a PNG, JPG or WebP under 30 MB');
      const bytes=new Uint8Array(await file.arrayBuffer());
      if(token!==epoch||owner!==account)throw Error('Account changed during artwork preparation');
      const id=crypto.randomUUID();
      await vault.save(account,id,file.type,bytes);
      if(token!==epoch||owner!==account){await vault.remove(account,id);throw Error('Account changed during artwork encryption');}
      return {type:'encrypted-image',id,mime:file.type};
    },
    async url(id){
      const account=owner, token=epoch;
      if(!account)return null;
      if(urls.has(id))return urls.get(id);
      const image=await vault.load(account,id);
      if(token!==epoch||owner!==account||!image)return null;
      const url=createURL(new Blob([image.bytes],{type:image.mime}));
      if(token!==epoch||owner!==account){revokeURL(url);return null;}
      urls.set(id,url);return url;
    },
    async remove(id){if(!owner)throw Error('Sign in to remove artwork');const account=owner;await vault.remove(account,id);const url=urls.get(id);if(url){revokeURL(url);urls.delete(id);}},
    async removeForAccount(account,id){if(!account||!id)throw Error('Account and image ID required');await vault.remove(account,id);if(account===owner){const url=urls.get(id);if(url){revokeURL(url);urls.delete(id);}}},
    clear,
  };
}
