import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';

export function checkVersion(tag) {
  const version=JSON.parse(readFileSync('package.json','utf8')).version;
  assert.match(version,/^\d+\.\d+\.\d+$/);
  assert.equal(JSON.parse(readFileSync('package-lock.json','utf8')).version,version);
  assert.equal(JSON.parse(readFileSync('package-lock.json','utf8')).packages[''].version,version);
  assert.equal(JSON.parse(readFileSync('src-tauri/tauri.conf.json','utf8')).version,version);
  assert.equal(readFileSync('src-tauri/Cargo.toml','utf8').match(/^version = "([^"]+)"/m)?.[1],version);
  assert.equal(readFileSync('src-tauri/Cargo.lock','utf8').match(/name = "from-zero-to-gpt"\r?\nversion = "([^"]+)"/)?.[1],version);
  if(tag)assert.equal(tag,`v${version}`,'Release tag must match every application manifest');
  return version;
}

export function expectedAssets(version) {
  return ['linux-x86_64.AppImage','linux-amd64.deb','macos-universal.dmg','windows-x64-setup.exe']
    .map(suffix=>`from-zero-to-gpt-${version}-${suffix}`);
}

export function expectedUpdateAssets(version) {
  return [`from-zero-to-gpt-${version}-macos-universal.app.tar.gz`,
    ...['linux-x86_64.AppImage','macos-universal.app.tar.gz','windows-x64-setup.exe'].map(suffix=>`from-zero-to-gpt-${version}-${suffix}.sig`)];
}

export function createUpdateManifest(directory,version,notes='',repository='Thweki/from-zero-to-gpt') {
  for(const name of expectedUpdateAssets(version))assert.ok(existsSync(join(directory,name)),`Missing signed updater artifact: ${name}`);
  const platforms={};
  for(const [targets,suffix] of [[['windows-x86_64'],'windows-x64-setup.exe'],[['linux-x86_64'],'linux-x86_64.AppImage'],[['darwin-x86_64','darwin-aarch64'],'macos-universal.app.tar.gz']]) {
    const name=`from-zero-to-gpt-${version}-${suffix}`;
    assert.ok(statSync(join(directory,name)).size>1024,'Empty update archive');
    const signature=readFileSync(join(directory,name+'.sig'),'utf8').trim();
    assert.ok(signature.length>40&&signature.length<4096,'Invalid updater signature');
    for(const target of targets)platforms[target]={signature,url:`https://github.com/${repository}/releases/download/v${version}/${name}`};
  }
  return {version,notes,pub_date:new Date().toISOString(),platforms};
}

export function validateAssets(directory,version) {
  const allNames=readdirSync(directory).sort();
  const names=allNames.filter(name=>!expectedUpdateAssets(version).includes(name));
  assert.deepEqual(names,expectedAssets(version).sort(),'All three platforms and all four installers are required');
  return names.map(name=>{
    const path=join(directory,name);
    assert.ok(statSync(path).isFile()&&statSync(path).size>1024,`Empty or invalid installer: ${name}`);
    const bytes=readFileSync(path);
    const magic=name.endsWith('.AppImage')?'7f454c46':name.endsWith('.deb')?'213c617263683e0a':name.endsWith('.exe')?'4d5a':null;
    if(magic)assert.equal(bytes.subarray(0,magic.length/2).toString('hex'),magic,`Invalid installer format: ${name}`);
    if(name.endsWith('.dmg'))assert.equal(bytes.subarray(-512,-508).toString(),'koly','Invalid DMG footer');
    return {name,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};
  });
}

function stage(platform) {
  const version=checkVersion();
  const bundles={
    Linux:[['release/bundle/appimage','.AppImage','linux-x86_64.AppImage'],['release/bundle/deb','.deb','linux-amd64.deb']],
    macOS:[['universal-apple-darwin/release/bundle/dmg','.dmg','macos-universal.dmg']],
    Windows:[['release/bundle/nsis','.exe','windows-x64-setup.exe']],
  };
  assert.ok(bundles[platform],`Unknown platform: ${platform}`);
  const output='artifacts/desktop-release';
  mkdirSync(output,{recursive:true});
  for(const [directory,extension,suffix] of bundles[platform]) {
    const source=join('src-tauri/target',directory);
    const files=readdirSync(source).filter(name=>name.endsWith(extension));
    assert.equal(files.length,1,`Expected exactly one ${extension} installer`);
    const target=`from-zero-to-gpt-${version}-${suffix}`;
    copyFileSync(join(source,files[0]),join(output,target));
    if(existsSync(join(source,files[0]+'.sig')))copyFileSync(join(source,files[0]+'.sig'),join(output,target+'.sig'));
  }
  if(platform==='macOS'){
    const source='src-tauri/target/universal-apple-darwin/release/bundle/macos';
    const archive=readdirSync(source).find(name=>name.endsWith('.app.tar.gz'));
    if(archive){
      const target=`from-zero-to-gpt-${version}-macos-universal.app.tar.gz`;
      copyFileSync(join(source,archive),join(output,target));
      if(existsSync(join(source,archive+'.sig')))copyFileSync(join(source,archive+'.sig'),join(output,target+'.sig'));
    }
  }
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) {
  const [command,argument]=process.argv.slice(2);
  if(command==='version')checkVersion(argument);
  else if(command==='stage')stage(argument);
  else if(command==='verify') {
    const directory=argument||'artifacts/desktop-release';
    const version=checkVersion(process.env.RELEASE_TAG);
    const assets=validateAssets(directory,version);
    const update=createUpdateManifest(directory,version,readFileSync(`docs/releases/v${version}.md`,'utf8'));
    writeFileSync(join(directory,'latest.json'),JSON.stringify(update,null,2)+'\n');
    assert.match(process.env.GITHUB_SHA||'',/^[a-f0-9]{40}$/);
    for(const name of ['LICENSE','THIRD_PARTY_NOTICES.md'])copyFileSync(name,join(directory,name));
    writeFileSync(join(directory,'release-manifest.json'),JSON.stringify({version,commit:process.env.GITHUB_SHA,runId:process.env.GITHUB_RUN_ID,assets},null,2)+'\n');
    const sums=readdirSync(directory).sort().map(name=>`${createHash('sha256').update(readFileSync(join(directory,name))).digest('hex')}  ${name}\n`).join('');
    writeFileSync(join(directory,'SHA256SUMS'),sums);
    console.log(`Verified ${assets.length} installers across Linux, macOS and Windows.`);
  } else throw new Error('Usage: release-assets.mjs version [tag] | stage <Linux|macOS|Windows> | verify [directory]');
}
