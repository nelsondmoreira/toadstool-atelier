// Optional offline vault primitives. No keys or passphrases are persisted.
// This module is deliberately NOT wired into the existing plaintext storage yet:
// switching storage without a recoverable migration/unlock UI risks data loss.
const enc = new TextEncoder();
const dec = new TextDecoder('utf-8', { fatal: true });
const ITERATIONS = 310_000;
const FORMAT = 'pah-vault-v1';
const cryptoAPI = globalThis.crypto;
function accountId(id) {
  if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(id)) throw new TypeError('Valid signed-in account required');
  return id;
}
function bytesToB64(bytes) {
  // Chunking avoids argument-list limits for large encrypted artwork.
  let result = '';
  for (let i = 0; i < bytes.length; i += 8192) result += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(result);
}
function b64ToBytes(value, expected) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9+/]*={0,2}$/.test(value)) throw new Error('Malformed encrypted vault');
  const bin = atob(value);
  if (expected !== undefined && bin.length !== expected) throw new Error('Malformed encrypted vault');
  return Uint8Array.from(bin, c => c.charCodeAt(0));
}
async function derive(passphrase, salt, iterations) {
  if (typeof passphrase !== 'string' || passphrase.length < 12) throw new Error('Vault passphrase must have at least 12 characters');
  const material = await cryptoAPI.subtle.importKey('raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return cryptoAPI.subtle.deriveKey({name:'PBKDF2',salt,iterations,hash:'SHA-256'},material,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
}
function aad(id) { return enc.encode(`${FORMAT}\0${id}`); }
export async function sealVault(id, passphrase, value) {
  accountId(id);
  const salt = cryptoAPI.getRandomValues(new Uint8Array(16));
  const iv = cryptoAPI.getRandomValues(new Uint8Array(12));
  const key = await derive(passphrase, salt, ITERATIONS);
  const payload = enc.encode(JSON.stringify(value));
  const ciphertext = await cryptoAPI.subtle.encrypt({name:'AES-GCM',iv,additionalData:aad(id)},key,payload);
  return JSON.stringify({format:FORMAT,kdf:'PBKDF2-SHA256',iterations:ITERATIONS,salt:bytesToB64(salt),iv:bytesToB64(iv),ciphertext:bytesToB64(new Uint8Array(ciphertext))});
}
export async function openVault(id, passphrase, envelope) {
  accountId(id);
  let item;
  try { item = JSON.parse(envelope); } catch { throw new Error('Malformed encrypted vault'); }
  if (!item || item.format !== FORMAT || item.kdf !== 'PBKDF2-SHA256' || item.iterations !== ITERATIONS) throw new Error('Unsupported encrypted vault');
  const salt = b64ToBytes(item.salt,16);
  const iv = b64ToBytes(item.iv,12);
  const ciphertext = b64ToBytes(item.ciphertext);
  if (ciphertext.length < 16) throw new Error('Malformed encrypted vault');
  const key = await derive(passphrase,salt,item.iterations);
  try {
    const plain = await cryptoAPI.subtle.decrypt({name:'AES-GCM',iv,additionalData:aad(id)},key,ciphertext);
    return JSON.parse(dec.decode(plain));
  } catch { throw new Error('Unable to unlock vault: incorrect passphrase or modified data'); }
}
export function vaultKey(id) { return `pah:vault:account:${accountId(id)}:v1`; }
// Safe staging: do not erase plaintext automatically. Explicit user-approved cleanup
// is a separate step after read-back verification and recovery guidance.
export async function stageVaultMigration(storage, id, passphrase, state) {
  const key = vaultKey(id);
  if (storage.getItem(key) !== null) throw new Error('Vault already exists; refusing overwrite');
  const encrypted = await sealVault(id,passphrase,state);
  storage.setItem(key,encrypted); // quota failures leave original state untouched
  try {
    const verified = await openVault(id,passphrase,storage.getItem(key));
    if (JSON.stringify(verified) !== JSON.stringify(state)) throw new Error('Vault verification failed');
  } catch (err) {
    // Preserve staged data for diagnostics; never touch the plaintext original.
    throw err;
  }
  return {verified:true,plaintextStillPresent:true};
}
