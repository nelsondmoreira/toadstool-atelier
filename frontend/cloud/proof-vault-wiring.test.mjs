import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=(readFileSync(new URL('../index.html',import.meta.url),'utf8')+'\n'+readFileSync(new URL('../src/app.mjs',import.meta.url),'utf8'));
test('quest and Atelier proof submissions use encrypted vault references rather than imageData',()=>{
 assert.match(html,/s\.questProof=await savePrivateProof\(f\)/);
 assert.match(html,/let data=await savePrivateProof\(f\);s\.atelierDone/);
 assert.doesNotMatch(html,/s\.questProof=await imageData\(f\)/);
 assert.doesNotMatch(html,/let data=await imageData\(f\);s\.atelierDone/);
});
test('proof reveal resolves encrypted reference and rechecks active account after await',()=>{
 assert.match(html,/url=await proofURL\(expected\)/);
 assert.match(html,/account!==activeAccount\|\|expected!==reveal\.dataset\.proof/);
});
test('proof deletion removes encrypted bytes before deleting badge proof reference',()=>{
 assert.match(html,/await window\.pahGalleryVault\.remove\(originalProof\.slice\(6\)\)/);
 assert.match(html,/if\(owner!==activeAccount\|\|record\.proof!==originalProof\)return\}delete record\.proof/);
});
