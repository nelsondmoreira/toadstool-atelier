import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {rememberedVault} from './remembered-vault.mjs';
function setup(){
  const envelopes=new Map();let key;
  const adapter={getKey:async()=>key,putKey:async v=>{key=v;},getEnvelope:async a=>envelopes.get(a),putEnvelope:async(a,v)=>{envelopes.set(a,v);},deleteEnvelope:async a=>{envelopes.delete(a);}};
  return {vault:rememberedVault(adapter,webcrypto),envelopes,adapter,removeKey:()=>{key=undefined;}};
}
test('remembered unlock survives vault instance recreation without persisting plaintext',async()=>{
  const {vault,adapter,envelopes}=setup();await vault.remember('accountA','correct horse battery');
  assert.equal(await rememberedVault(adapter,webcrypto).unlock('accountA'),'correct horse battery');
  assert.equal(JSON.stringify([...envelopes.values()]).includes('correct horse'),false);
  assert.equal((await adapter.getKey()).extractable,false);
});
test('account B cannot use account A envelope',async()=>{
  const {vault,envelopes}=setup();await vault.remember('accountA','correct horse battery');
  envelopes.set('accountB',envelopes.get('accountA'));
  await assert.rejects(vault.unlock('accountB'),/Invalid remembered unlock/);
});
test('tampered ciphertext fails closed',async()=>{
  const {vault,envelopes}=setup();await vault.remember('accountA','correct horse battery');
  const e=envelopes.get('accountA');e.ciphertext=new Uint8Array(e.ciphertext);e.ciphertext[0]^=1;
  await assert.rejects(vault.unlock('accountA'),/unavailable/);
});
test('forgotten device key does not invent recovery',async()=>{
  const {vault,removeKey}=setup();await vault.remember('accountA','correct horse battery');removeKey();
  await assert.rejects(vault.unlock('accountA'),/key missing/);
});
test('forget removes only the chosen account remembered unlock',async()=>{
  const {vault}=setup();await vault.remember('accountA','correct horse battery');await vault.remember('accountB','another secure passphrase');
  await vault.forget('accountA');assert.equal(await vault.unlock('accountA'),null);
  assert.equal(await vault.unlock('accountB'),'another secure passphrase');
});
test('reject invalid account and weak passphrase',async()=>{
  const {vault}=setup();await assert.rejects(vault.remember('../bad','correct horse battery'));
  await assert.rejects(vault.remember('good','short'));
});
