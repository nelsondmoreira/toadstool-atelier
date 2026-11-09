// Opt-in encrypted IndexedDB artwork repository. No plaintext fallbacks.
// Passphrase is never stored; callers must explicitly unlock each session.
const encoder = new TextEncoder();
const FORMAT = 'pah-artwork-v1';
const ROUNDS = 310000;
const TYPES = new Set(['image/png','image/jpeg','image/webp']);
function validOwner(s) { if(typeof s!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(s)) throw Error('Invalid account'); return s; }
function validId(s) { if(typeof s!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(s)) throw Error('Invalid artwork ID'); return s; }
function keyFor(owner,id) {return `${validOwner(owner)}:${validId(id)}`;}
function associated(owner,id,mime) {return encoder.encode(`${FORMAT}\0${owner}\0${id}\0${mime}`);}
async function derive(passphrase,salt) {
  if(typeof passphrase!=='string'||passphrase.length<12) throw Error('Passphrase must have at least 12 characters');
  const raw=await crypto.subtle.importKey('raw',encoder.encode(passphrase),'PBKDF2',false,['deriveKey']);
  return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:ROUNDS,hash:'SHA-256'},raw,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
}
export async function encryptArtwork(owner,id,mime,bytes,passphrase) {
  keyFor(owner,id);
  if(!TYPES.has(mime)) throw Error('Unsupported artwork type');
  if(!(bytes instanceof Uint8Array)||bytes.length===0||bytes.length>30*1024*1024) throw Error('Invalid artwork bytes');
  const salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12));
  const key=await derive(passphrase,salt);
  const ciphertext=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:associated(owner,id,mime)},key,bytes);
  return {key:keyFor(owner,id),owner,id,mime,format:FORMAT,rounds:ROUNDS,salt,iv,ciphertext};
}
export async function decryptArtwork(owner,id,record,passphrase) {
  if(!record||record.key!==keyFor(owner,id)||record.owner!==owner||record.id!==id||record.format!==FORMAT||record.rounds!==ROUNDS||!TYPES.has(record.mime)||record.salt?.byteLength!==16||record.iv?.byteLength!==12||!record.ciphertext||record.ciphertext.byteLength<17) throw Error('Invalid encrypted artwork record');
  const key=await derive(passphrase,new Uint8Array(record.salt));
  try {return {mime:record.mime,bytes:new Uint8Array(await crypto.subtle.decrypt({name:'AES-GCM',iv:new Uint8Array(record.iv),additionalData:associated(owner,id,record.mime)},key,record.ciphertext))};}
  catch {throw Error('Unable to decrypt artwork');}
}
export function openArtworkDatabase(factory=globalThis.indexedDB) {
  if(!factory) throw Error('IndexedDB unavailable');
  return new Promise((resolve,reject)=>{
    const req=factory.open('pah-private-artwork-v1',1);
    req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains('artwork')){const store=req.result.createObjectStore('artwork',{keyPath:'key'});store.createIndex('owner','owner');}};
    req.onerror=()=>reject(req.error||Error('Cannot open artwork database'));
    req.onsuccess=()=>resolve(req.result);
  });
}
export function indexedArtworkAdapter(factory=globalThis.indexedDB) {
  async function op(mode,operation){const db=await openArtworkDatabase(factory);return new Promise((resolve,reject)=>{const tx=db.transaction('artwork',mode);const store=tx.objectStore('artwork');let value;let request;try{request=operation(store);}catch(e){db.close();tx.abort();reject(e);return;}request.onsuccess=()=>{value=request.result;};tx.oncomplete=()=>{db.close();resolve(value);};tx.onerror=()=>{db.close();reject(tx.error||Error('Artwork transaction failed'));};tx.onabort=()=>{db.close();reject(tx.error||Error('Artwork transaction aborted'));};});}
  return {get:key=>op('readonly',s=>s.get(key)),put:record=>op('readwrite',s=>s.put(record)),delete:key=>op('readwrite',s=>s.delete(key)),list:owner=>op('readonly',s=>s.index('owner').getAll(owner))};
}
export function encryptedArtworkRepository(adapter) {
  if(!adapter||!['get','put','delete','list'].every(k=>typeof adapter[k]==='function')) throw Error('Invalid storage adapter');
  return {
    async save(owner,id,mime,bytes,passphrase){const encrypted=await encryptArtwork(owner,id,mime,bytes,passphrase);await adapter.put(encrypted);const readback=await adapter.get(encrypted.key);const verified=await decryptArtwork(owner,id,readback,passphrase);if(verified.bytes.length!==bytes.length||verified.bytes.some((b,i)=>b!==bytes[i]))throw Error('Encrypted artwork verification failed');return {id,verified:true};},
    async load(owner,id,passphrase){const record=await adapter.get(keyFor(owner,id));return record?decryptArtwork(owner,id,record,passphrase):null;},
    async list(owner){validOwner(owner);const records=await adapter.list(owner);return records.filter(x=>x.owner===owner).map(x=>({id:x.id,mime:x.mime}));},
    async remove(owner,id){await adapter.delete(keyFor(owner,id));}
  };
}
