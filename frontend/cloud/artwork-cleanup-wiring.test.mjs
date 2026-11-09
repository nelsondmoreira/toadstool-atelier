import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
test('real upload queue schedules durable cleanup on failed commit and account switch',async()=>{
 const source=await readFile(new URL('./artwork-queue.js',import.meta.url),'utf8');
 assert.match(source,/cleanup\.schedule\(enqueueOwner,id,'queue-commit-failed'\)/);
 assert.match(source,/cleanup\.schedule\(enqueueOwner,id,'account-switched-before-queue-commit'\)/);
 assert.match(source,/await cleanup\.run\(activeOwner\)/);
 assert.match(source,/isReferenced:async\(account,id\)=>\(await all\(\)\)/);
});
