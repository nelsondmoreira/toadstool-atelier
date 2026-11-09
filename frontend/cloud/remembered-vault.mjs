// Opt-in remembered unlock. A non-extractable AES key is persisted by IndexedDB
// separately from the encrypted passphrase. This protects against casual storage
// inspection, NOT malicious same-origin scripts or an unlocked browser profile.
const enc = new TextEncoder();
const dec = new TextDecoder();
const FORMAT = 'pah-remembered-unlock-v1';
function validAccount(account) {
  if (typeof account !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(account)) throw Error('Invalid account');
  return account;
}
function aad(account) { return enc.encode(`${FORMAT}\0${validAccount(account)}`); }
function ensureAdapter(adapter) {
  if (!adapter || !['getKey','putKey','getEnvelope','putEnvelope','deleteEnvelope'].every(k => typeof adapter[k] === 'function')) throw Error('Invalid remembered-unlock adapter');
}
export function rememberedVault(adapter, cryptoApi=globalThis.crypto) {
  ensureAdapter(adapter);
  async function remember(account, passphrase) {
    validAccount(account);
    if (typeof passphrase !== 'string' || passphrase.length < 12) throw Error('Invalid vault passphrase');
    // Reuse the device key, so other remembered accounts aren't broken.
    let key = await adapter.getKey();
    if (!key) {
      key = await cryptoApi.subtle.generateKey({name:'AES-GCM',length:256},false,['encrypt','decrypt']);
      await adapter.putKey(key);
    }
    const iv=cryptoApi.getRandomValues(new Uint8Array(12));
    const ciphertext=await cryptoApi.subtle.encrypt({name:'AES-GCM',iv,additionalData:aad(account)},key,enc.encode(passphrase));
    await adapter.putEnvelope(account,{format:FORMAT,account,iv,ciphertext});
  }
  async function unlock(account) {
    validAccount(account);
    const envelope=await adapter.getEnvelope(account);
    if (!envelope) return null;
    if (envelope.format!==FORMAT || envelope.account!==account || envelope.iv?.byteLength!==12 || !envelope.ciphertext) throw Error('Invalid remembered unlock');
    const key=await adapter.getKey();
    if (!key) throw Error('Remembered unlock key missing; enter passphrase');
    try {
      return dec.decode(await cryptoApi.subtle.decrypt({name:'AES-GCM',iv:envelope.iv,additionalData:aad(account)},key,envelope.ciphertext));
    } catch { throw Error('Remembered unlock unavailable; enter passphrase'); }
  }
  async function forget(account) { await adapter.deleteEnvelope(validAccount(account)); }
  return {remember,unlock,forget};
}
// Device-local CryptoKey and per-account envelopes in one IndexedDB database.
export function indexedRememberedVaultAdapter(factory=globalThis.indexedDB) {
  if (!factory) throw Error('IndexedDB unavailable');
  async function operation(mode, fn) {
    const db=await new Promise((resolve,reject)=>{
      const request=factory.open('pah-remembered-unlock-v1',1);
      request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains('secrets'))request.result.createObjectStore('secrets');};
      request.onsuccess=()=>resolve(request.result);
      request.onerror=()=>reject(request.error||Error('Cannot open remembered unlock database'));
    });
    return new Promise((resolve,reject)=>{
      const tx=db.transaction('secrets',mode);const store=tx.objectStore('secrets');
      let req;try{req=fn(store);}catch(error){db.close();reject(error);return;}
      let result;req.onsuccess=()=>{result=req.result;};
      tx.oncomplete=()=>{db.close();resolve(result);};
      tx.onerror=()=>{db.close();reject(tx.error||Error('Remembered unlock transaction failed'));};
      tx.onabort=()=>{db.close();reject(tx.error||Error('Remembered unlock transaction aborted'));};
    });
  }
  return {
    getKey:()=>operation('readonly',s=>s.get('device-key')),
    putKey:key=>operation('readwrite',s=>s.put(key,'device-key')),
    getEnvelope:account=>operation('readonly',s=>s.get(`account:${validAccount(account)}`)),
    putEnvelope:(account,value)=>operation('readwrite',s=>s.put(value,`account:${validAccount(account)}`)),
    deleteEnvelope:account=>operation('readwrite',s=>s.delete(`account:${validAccount(account)}`))
  };
}
