import {spawnSync} from 'node:child_process';
const args=process.argv.slice(2),targetIndex=args.indexOf('--target');
const env={...process.env,...(targetIndex>=0?{TAURI_ENV_TARGET_TRIPLE:args[targetIndex+1]}:{})};
const engine=spawnSync(process.execPath,['scripts/build-provider-engine.mjs'],{env,stdio:'inherit'});
if(engine.status!==0)process.exit(engine.status||1);
const config={bundle:{createUpdaterArtifacts:Boolean(process.env.TAURI_SIGNING_PRIVATE_KEY)}};
const build=spawnSync(process.execPath,['node_modules/@tauri-apps/cli/tauri.js','build','--config',JSON.stringify(config),...args],{env,stdio:'inherit'});
process.exit(build.status??1);
