import {encryptedArtworkRepository,indexedArtworkAdapter} from './encrypted-artwork-store.mjs';
import {rememberedVault,indexedRememberedVaultAdapter} from './remembered-vault.mjs';

// A remembered secret is available only while its account is active. Never
// persist plaintext passphrases or cache decrypted artwork across sign-out.
export function createArtworkVaultSession({repository,remembered,askPassphrase}) {
  if(!repository||!remembered||typeof askPassphrase!=='function')throw Error('Invalid vault session dependencies');
  let active=null, secret=null, generation=0;
  async function session(owner) {generation++;active=owner||null;secret=null;}
  async function unlock(owner,{interactive=false}={}) {
    if(!owner||owner!==active)throw Error('Artwork account changed');
    const token=generation;
    if(secret)return secret;
    let candidate=await remembered.unlock(owner);
    if(!candidate&&interactive) {
      candidate=await askPassphrase(owner);
      if(typeof candidate!=='string'||candidate.length<12)throw Error('Vault unlock cancelled; artwork not stored');
      if(owner!==active||token!==generation)throw Error('Artwork account changed during unlock');
      await remembered.remember(owner,candidate);
    }
    if(owner!==active||token!==generation)throw Error('Artwork account changed during unlock');
    if(!candidate)throw Error('Unlock your private artwork vault before syncing');
    secret=candidate;return secret;
  }
  async function save(owner,id,mime,bytes) {
    const token=generation, passphrase=await unlock(owner,{interactive:true});
    if(owner!==active||token!==generation)throw Error('Artwork account changed before encryption');
    await repository.save(owner,id,mime,bytes,passphrase);
    if(owner!==active||token!==generation)throw Error('Artwork account changed during encryption');
  }
  async function load(owner,id) {return repository.load(owner,id,await unlock(owner));}
  return {session,unlock,save,load,remove:(owner,id)=>repository.remove(owner,id)};
}
export function browserArtworkVault() {
  return createArtworkVaultSession({
    repository:encryptedArtworkRepository(indexedArtworkAdapter()),
    remembered:rememberedVault(indexedRememberedVaultAdapter()),
    askPassphrase:async()=>window.prompt('Create an offline artwork vault passphrase (12+ characters). It will be remembered on this device. Keep a copy until cloud recovery is available.')
  });
}
