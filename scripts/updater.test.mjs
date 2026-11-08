import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createUpdateManifest,expectedUpdateAssets} from './release-assets.mjs';
test('release manifest requires signed packages and maps both Mac architectures to universal archive',()=>{
 const dir=mkdtempSync(join(tmpdir(),'gpt-updater-'));try{
  assert.throws(()=>createUpdateManifest(dir,'1.2.3'),/Missing signed/);
  for(const name of [...expectedUpdateAssets('1.2.3'),'from-zero-to-gpt-1.2.3-windows-x64-setup.exe','from-zero-to-gpt-1.2.3-linux-x86_64.AppImage'])writeFileSync(join(dir,name),name.endsWith('.sig')?'test-signature-'.repeat(10):Buffer.alloc(2048));
  const manifest=createUpdateManifest(dir,'1.2.3','Example notes');assert.equal(manifest.version,'1.2.3');assert.deepEqual(Object.keys(manifest.platforms).sort(),['darwin-aarch64','darwin-x86_64','linux-x86_64','windows-x86_64']);
  assert.equal(manifest.platforms['darwin-aarch64'].url,manifest.platforms['darwin-x86_64'].url);assert.match(manifest.platforms['windows-x86_64'].url,/releases\/download\/v1\.2\.3\/.*\.exe$/);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('updater trusts a pinned public key and the intended HTTPS GitHub feed',()=>{
 const config=JSON.parse(readFileSync('src-tauri/tauri.conf.json','utf8')).plugins.updater;
 assert.equal(config.endpoints[0],'https://github.com/Thweki/from-zero-to-gpt/releases/latest/download/latest.json');assert.ok(config.pubkey.length>40);assert.notEqual(config.dangerousInsecureTransportProtocol,true);
});
