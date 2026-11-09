import {stateKey} from './account-scope.mjs';
// Account-scoped completion synchronization; optional until cloud auth is configured.
import {syncCompletions,fetchCompletionAwards,mergeServerAwards} from './completion-sync.mjs';

export function setupCompletionBridge(client) {
  let user=null,busy=false,dirty=false,timer=null;
  const status=document.getElementById('xpSyncStatus');
  const read=()=>{try{return JSON.parse(localStorage.getItem(stateKey(user?.id))||'{}')}catch{return {}}};
  const show=(message)=>{if(status)status.textContent=message};
  async function flush(){
    if(!user || busy || !navigator.onLine)return;
    busy=true;dirty=false;
    const account=user.id;
    try{
      const snapshot=read();
      const ledger=Array.isArray(snapshot.xpLedger)?snapshot.xpLedger:[];
      const synced=await syncCompletions(client,ledger);
      const awards=await fetchCompletionAwards(client);
      if(user?.id!==account)return;
      
      // Do not overwrite changes recorded while the request was in flight.
      const latest=read().xpLedger||[];
      const updated=mergeServerAwards(latest,awards,synced.events);
      window.dispatchEvent(new CustomEvent('pah:completion-reconciled',{detail:{events:updated,accountId:account}}));
      const pending=updated.filter(e=>e.status==='pending').length;
      show(pending?`${pending} XP events waiting to sync`:'✓ XP synchronized');
    }catch(err){show('XP saved offline · sync will retry');}
    finally{busy=false;if(dirty)schedule()}
  }
  function schedule(){if(!user)return;dirty=true;clearTimeout(timer);timer=setTimeout(flush,350)}
  const onChange=()=>schedule();
  const onOnline=()=>schedule();
  window.addEventListener('pah:state-changed',onChange);
  window.addEventListener('online',onOnline);
  return {session(session){const next=session?.user||null;if(next?.id!==user?.id){user=next;clearTimeout(timer);if(user)schedule();else show('XP saved on this device · sign in to sync')}},dispose(){clearTimeout(timer);window.removeEventListener('pah:state-changed',onChange);window.removeEventListener('online',onOnline)}};
}
