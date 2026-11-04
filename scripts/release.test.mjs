import assert from 'node:assert/strict';
import {mkdirSync,mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';
import {checkVersion,expectedAssets,validateAssets} from './release-assets.mjs';

test('release tag must match npm, Tauri and Cargo versions',()=>{
  const version=checkVersion();
  assert.equal(checkVersion(`v${version}`),version);
  assert.throws(()=>checkVersion('v999.0.0'),/Release tag/);
});

test('version check works in a Windows CRLF checkout',()=>{
  const directory=mkdtempSync(join(tmpdir(),'release-crlf-'));
  try {
    mkdirSync(join(directory,'src-tauri'));
    for(const name of ['package.json','package-lock.json','src-tauri/tauri.conf.json','src-tauri/Cargo.toml','src-tauri/Cargo.lock']){
      writeFileSync(join(directory,name),readFileSync(name,'utf8').replace(/\r?\n/g,'\r\n'));
    }
    const result=spawnSync(process.execPath,[fileURLToPath(new URL('./release-assets.mjs',import.meta.url)),'version',`v${checkVersion()}`],{cwd:directory,encoding:'utf8'});
    assert.equal(result.status,0,result.stderr);
  } finally {rmSync(directory,{recursive:true,force:true});}
});

test('release requires all platforms and valid installer formats',()=>{
  const directory=mkdtempSync(join(tmpdir(),'desktop-release-'));
  const version=checkVersion();
  try {
    assert.throws(()=>validateAssets(directory,version),/All three platforms/);
    for(const name of expectedAssets(version)) {
      const buffer=Buffer.alloc(2048);
      if(name.endsWith('.AppImage'))Buffer.from('7f454c46','hex').copy(buffer);
      if(name.endsWith('.deb'))buffer.write('!<arch>\n');
      if(name.endsWith('.exe'))buffer.write('MZ');
      if(name.endsWith('.dmg'))buffer.write('koly',buffer.length-512);
      writeFileSync(join(directory,name),buffer);
    }
    assert.equal(validateAssets(directory,version).length,4);
    writeFileSync(join(directory,expectedAssets(version)[0]),Buffer.alloc(2048));
    assert.throws(()=>validateAssets(directory,version),/Invalid installer format/);
    writeFileSync(join(directory,'unexpected.txt'),'unexpected');
    assert.throws(()=>validateAssets(directory,version),/All three platforms/);
  } finally {rmSync(directory,{recursive:true,force:true});}
});
