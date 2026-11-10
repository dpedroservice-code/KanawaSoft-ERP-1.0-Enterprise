import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const app=readFileSync(new URL('../app/app.js',import.meta.url),'utf8');

test('ERP core parses after offline synchronization and backup changes',()=>{
  assert.doesNotThrow(()=>new vm.Script(app,{filename:'app.js'}));
});

test('offline queue is persisted asynchronously, scoped by tenant and user, and retried without deletion',()=>{
  assert.match(app,/async function queueSync\(entity, action, payload, options\)/);
  assert.match(app,/item\.company_id === companyId && item\.user_id === userId/);
  assert.match(app,/item\.attempts = Number\(item\.attempts \|\| 0\) \+ 1/);
  assert.match(app,/await DB\.put\('_sync_queue', item\)/);
  assert.match(app,/return sent;[\s\S]*?finally \{\s*syncQueueProcessing = false/);
  assert.match(app,/window\.addEventListener\('online',run\)/);
  assert.match(app,/iniciarSincronizacaoAutomatica\(\)/);
});

test('backup uses per-file random salt and IV with PBKDF2 and AES-GCM',()=>{
  assert.match(app,/PBKDF2/);
  assert.match(app,/iterations:310000/);
  assert.match(app,/AES-GCM/);
  assert.match(app,/crypto\.getRandomValues\(new Uint8Array\(16\)\)/);
  assert.match(app,/crypto\.getRandomValues\(new Uint8Array\(12\)\)/);
  assert.match(app,/async function importarBackupCompleto\(file\)/);
  assert.match(app,/await crypto\.subtle\.decrypt/);
  assert.match(app,/BACKUP_EXCLUDED_STORES/);
});

test('reset clears dependent local collections first and does not erase Supabase data',()=>{
  assert.match(app,/Reset Total apaga o cache local[\s\S]*?Supabase NÃO serão apagados/);
  assert.match(app,/const removalOrder=\[\.\.\.dependencyLevels\.flat\(\),\.\.\.remaining\]/);
  assert.match(app,/for\(const store of removalOrder\)if\(DB\.stores\.includes\(store\)\)await DB\.clear\(store\)/);
  assert.doesNotMatch(app,/localStorage\.clear\(\)/);
});

test('fiscal signing is not falsely simulated with a client-side SHA-1 digest',()=>{
  assert.doesNotMatch(app,/CryptoJS\.SHA1|SHA1\(stringChave\)/);
});
