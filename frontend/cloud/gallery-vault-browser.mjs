import {browserArtworkVault} from './artwork-vault-session.mjs';
import {createGalleryVault} from './gallery-vault.mjs';
const gallery=createGalleryVault(browserArtworkVault());
window.pahGalleryVault=gallery;
window.addEventListener('pah:account-changed',async event=>{
  try {await gallery.session(event.detail?.accountId||null);window.dispatchEvent(new Event('pah:gallery-vault-ready'));}
  catch(e){console.error('Private gallery vault could not switch account',e);}
});
