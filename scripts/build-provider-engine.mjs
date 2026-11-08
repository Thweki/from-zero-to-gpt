import {spawnSync,execFileSync} from 'node:child_process';
import {mkdirSync,copyFileSync} from 'node:fs';
import path from 'node:path';
const bun=path.resolve('node_modules/bun/bin/bun.exe');
const host=execFileSync('rustc',['-vV'],{encoding:'utf8'}).match(/^host: (.+)$/m)[1];
const requested=process.env.TAURI_ENV_TARGET_TRIPLE||host;
if(requested.includes('android')||process.env.TAURI_ENV_PLATFORM==='android')process.exit(0);
mkdirSync('src-tauri/binaries',{recursive:true});
const targets=requested==='universal-apple-darwin'?['aarch64-apple-darwin','x86_64-apple-darwin']:[requested];
function build(target){
 const arch=target.startsWith('aarch64')?'arm64':'x64';
 const os=target.includes('windows')?'windows':target.includes('apple')?'darwin':'linux';
 const filename=`src-tauri/binaries/provider-engine-${target}${os==='windows'?'.exe':''}`;
 const result=spawnSync(bun,['build','server/provider-worker.ts','--compile',`--target=bun-${os}-${arch}${(os==='windows'||os==='linux')&&arch==='x64'?'-baseline':''}`,'--outfile',filename],{stdio:'inherit'});
 if(result.status!==0)process.exit(result.status||1);
 return filename;
}
const binaries=targets.map(build);
if(targets.length===2){const r=spawnSync('lipo',['-create',...binaries,'-output','src-tauri/binaries/provider-engine-universal-apple-darwin'],{stdio:'inherit'});if(r.status!==0)process.exit(1);}
if(requested===host||requested==='universal-apple-darwin')copyFileSync(`src-tauri/binaries/provider-engine-${requested}${requested.includes('windows')?'.exe':''}`,`src-tauri/binaries/provider-engine${requested.includes('windows')?'.exe':''}`);
