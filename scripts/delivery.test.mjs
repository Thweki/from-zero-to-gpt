import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {inspectContent,forbiddenPath} from './check-repository.mjs';
import {verifyManifest} from './verify-delivery.mjs';

test('recognizes provider credentials without printing matched text',()=>{
  for(const value of ['oc_sk_'+'a'.repeat(40),'ghu_'+'A'.repeat(36),'sk-proj-'+'A'.repeat(50),'AKIA'+'A'.repeat(16),'-----BEGIN '+'OPENSSH PRIVATE KEY-----'])assert.equal(inspectContent(value).length,1);
  assert.deepEqual(inspectContent('TUTOR_API_KEY=<仅在服务端设置>'),[]);
});
test('excludes generated artifacts, personal backups and credential files',()=>{
  for(const file of ['node_modules/x','dist/index.html','public/python/x','public/downloads/a.zip','.env','.env.local','.dev.vars','.npmrc','id_ed25519','model.pt','learning-backup-2026.json','artifacts/result.json'])assert.equal(!!forbiddenPath(file),true,file);
  for(const file of ['.env.example','README.md','package-lock.json','.openai/hosting.json','projects/tiny-gpt/model.py','.github/workflows/ci.yml'])assert.equal(!!forbiddenPath(file),false,file);
});
const bytes=Buffer.from('test archive bytes'),commit='a'.repeat(40);
const valid=()=>({schemaVersion:1,commitSha:commit,artifact:{filename:'site-worker.tar.gz',sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length},deployment:{automatic:false}});
test('verifies a matching source and archive',()=>assert.equal(verifyManifest(valid(),bytes,commit).length,64));
test('rejects archive tampering',()=>assert.throws(()=>verifyManifest(valid(),Buffer.from('changed'),commit),/integrity/));
test('rejects a build from a different commit',()=>assert.throws(()=>verifyManifest(valid(),bytes,'b'.repeat(40)),/commit/));
test('rejects a path escape in the artifact filename',()=>{const value=valid();value.artifact.filename='../outside.tar.gz';assert.throws(()=>verifyManifest(value,bytes,commit),/filename/);});
test('cannot mislabel artifact delivery as automatic production deployment',()=>{const value=valid();value.deployment.automatic=true;assert.throws(()=>verifyManifest(value,bytes,commit),/production/);});
