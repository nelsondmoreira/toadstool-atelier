import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=(readFileSync(new URL('../index.html',import.meta.url),'utf8')+'\n'+readFileSync(new URL('../src/app.mjs',import.meta.url),'utf8'));
test('Atelier confirmation saves encrypted bytes before committing the design reference',()=>{
 const block=html.slice(html.indexOf("if(id==='confirmCustom'"),html.indexOf("if(id==='restoreCustom'"));
 assert.match(block,/await window\.pahGalleryVault\.save\(file\)/);
 assert.match(block,/await window\.pahGalleryVault\.url\(entry\.id\)/);
 assert.ok(block.indexOf('await window.pahGalleryVault.save(file)')<block.indexOf("s.custom[slot]={data:'vault:'+entry.id"));
 assert.doesNotMatch(block,/data:previewData/);
});
test('Atelier images are resolved from encrypted references and guarded against account switches',()=>{
 const block=html.slice(html.indexOf('function resolveDesignImages'),html.indexOf('async function migrateLegacyDesigns'));
 assert.match(block,/owner===activeAccount/);
 assert.match(block,/img\.dataset\.designRef===ref/);
 assert.match(block,/pahGalleryVault\?\.url/);
});
test('Legacy design migration keeps plaintext until encryption is verified',()=>{
 const block=html.slice(html.indexOf('async function migrateLegacyDesigns'),html.indexOf('function renderGallery'));
 assert.ok(block.indexOf('await window.pahGalleryVault.save(file)')<block.indexOf("s.custom[id]={...design,data:'vault:'+entry.id}"));
 assert.match(block,/if\(!verified\)throw/);
 assert.match(block,/if\(owner!==activeAccount\)return/);
});
