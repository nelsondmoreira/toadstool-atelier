import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIRMATION, validateDeletionRequest, isOwnedPath, shouldDeleteAccount } from './account-deletion-policy.mjs';
test('confirmation must match exactly',()=>{assert.equal(CONFIRMATION,'DELETE');assert.equal(validateDeletionRequest('POST','DELETE'),null);for(const s of ['delete',' DELETE','',undefined]) assert.equal(validateDeletionRequest('POST',s).status,400)});
test('only POST allowed',()=>assert.equal(validateDeletionRequest('GET','DELETE').status,405));
test('storage paths stay inside account namespace',()=>{assert.equal(isOwnedPath('user-a','user-a/quest-proof/a.png'),true);assert.equal(isOwnedPath('user-a','user-b/a.png'),false);assert.equal(isOwnedPath('user-a','user-a/../user-b/a'),false)});
test('storage failure prevents account removal',()=>{assert.equal(shouldDeleteAccount([]),true);assert.equal(shouldDeleteAccount(['failed']),false)});
test('path ownership rejects empty IDs, empty components and traversal',()=>{
  for (const [id,path] of [['','/foo'],['user-a','user-a//file'],['user-a','user-a/./file'],['user-a','user-a/../file'],['user-a','user-a\\other/file']]) {
    assert.equal(isOwnedPath(id,path),false,`unsafe path accepted: ${JSON.stringify([id,path])}`);
  }
});
