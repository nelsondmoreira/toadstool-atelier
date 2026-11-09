import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('./artwork-queue.js',import.meta.url),'utf8');
test('new upload is encrypted before its queue metadata is committed',()=>{const encrypt=source.indexOf('await vault.save(enqueueOwner,id,optimized.mime,bytes)');const persist=source.indexOf('try {await put(item);}');assert.ok(encrypt>=0&&persist>encrypt);assert.match(source,/slot, encrypted:true, mime:optimized.mime/);});
test('encrypted upload is decrypted before network transfer',()=>{assert.match(source,/item.encrypted\?await vault.load\(activeOwner,item.id\)/);assert.match(source,/item.encrypted\?new Blob\(\[decrypted.bytes\]/);});
test('account changes are checked after encrypt and before network transfer',()=>{assert.match(source,/if\(owner!==enqueueOwner\)\{await cleanup\.schedule\(enqueueOwner,id,'account-switched-before-queue-commit'\);throw Error\('Account changed while encrypting artwork'\);\}/);assert.match(source,/if\(owner!==activeOwner\)break;/);});
