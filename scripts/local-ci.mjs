import {spawn,execFileSync} from 'node:child_process';
import {existsSync,readFileSync,writeFileSync,appendFileSync,createWriteStream} from 'node:fs';
import {cp,mkdir,mkdtemp,open,rm,symlink} from 'node:fs/promises';
import {createServer} from 'node:net';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

const root=path.resolve(fileURLToPath(new URL('..',import.meta.url)));
const git=(cwd,...args)=>execFileSync('git',args,{cwd,encoding:'utf8',maxBuffer:64*1024*1024}).trim();
const resultsDir=path.join(root,'artifacts/local-ci');
export function verifyPush(report,updates,treeForCommit){
  if(report?.status!=='passed')throw new Error('尚无通过的本地 CI。请先运行 npm run ci:local。');
  for(const row of updates.trim().split('\n').filter(Boolean)){
    const [,sha]=row.trim().split(/\s+/);
    if(/^0+$/.test(sha))continue; // Deleting a remote ref introduces no code.
    if(!sha||treeForCommit(sha)!==report.tree)throw new Error('待推送源码与已通过本地 CI 的版本不同。请重新运行 npm run ci:local。');
  }
}

export async function snapshotSource(source,destination){
  execFileSync('git',['clone','--quiet','--shared','--no-checkout',source,destination],{stdio:'pipe'});
  // Include new files as well as tracked changes, but never ignored local data.
  const files=execFileSync('git',['ls-files','-co','--exclude-standard','-z'],{cwd:source,encoding:'utf8'}).split('\0').filter(Boolean);
  for(const file of new Set(files))if(existsSync(path.join(source,file))){
    await mkdir(path.dirname(path.join(destination,file)),{recursive:true});
    await cp(path.join(source,file),path.join(destination,file),{recursive:true,dereference:false});
  }
  git(destination,'add','-A');
  const tree=git(destination,'write-tree');
  git(destination,'-c','user.name=Local CI','-c','user.email=local-ci@localhost','-c','commit.gpgsign=false','-c','core.hooksPath=/dev/null','commit','--quiet','--allow-empty','-m','Local CI source snapshot (not published)');
  return tree;
}

async function main(){
  if(process.argv.includes('--verify-push')){
    const report=JSON.parse(readFileSync(path.join(resultsDir,'result.json'),'utf8'));
    verifyPush(report,readFileSync(0,'utf8'),sha=>git(root,'rev-parse',`${sha}^{tree}`));
    console.log('本地 CI 已通过，待推送源码与验证快照一致。');return;
  }
  if(Number(process.versions.node.split('.')[0])!==24)throw new Error('本地 CI 使用 Node 24，与 Actions 一致。请将 Node 24 加入 PATH 后运行 npm run ci:local。');
  const python=process.env.FROM_ZERO_PYTHON||'python3';
  const pythonVersion=execFileSync(python,['-I','-c','import platform; print(platform.python_version())'],{encoding:'utf8'}).trim();
  if(!pythonVersion.startsWith('3.12.'))throw new Error('本地 CI 使用 Python 3.12。请设置 FROM_ZERO_PYTHON 为其解释器路径。');
  await mkdir(resultsDir,{recursive:true});
  const lockPath=path.join(resultsDir,'running.lock');
  const lock=await open(lockPath,'wx').catch(()=>{throw new Error('本地 CI 正在运行，或上次中断后留下 running.lock。确认没有运行中的预检后再清理锁。');});
  await lock.writeFile(String(process.pid));await lock.close();
  const report={status:'running',startedAt:new Date().toISOString(),platform:process.platform,node:process.versions.node,python:pythonVersion,tree:null,steps:[],limitations:['Only the current host OS runs native desktop and launcher tests. Other OS installers require their own runner.','Android is optional in GitHub CI and is not part of this desktop preflight.']};
  const save=()=>writeFileSync(path.join(resultsDir,'result.json'),JSON.stringify(report,null,2)+'\n');save();
  let workspace;
  try{
    workspace=await mkdtemp(path.join(tmpdir(),'from-zero-local-ci-'));
    report.workspace=workspace;
    report.tree=await snapshotSource(root,workspace);save();
    const env={...process.env,CI:'true',FROM_ZERO_PYTHON:python,FROM_ZERO_DATA_DIR:path.join(workspace,'.cache','ci-services'),PATH:`${path.dirname(process.execPath)}${path.delimiter}${process.env.PATH}`};
    // The preflight never borrows provider credentials or production signing keys.
    for(const key of Object.keys(env))if(/^(TUTOR_|TAURI_SIGNING_|VITE_TUTOR_)/.test(key))delete env[key];
    const npm=process.env.npm_execpath;
    if(!npm)throw new Error('请使用 npm run ci:local 启动预检。');
    async function run(name,command,args,{cwd=workspace,extraEnv={}}={}){
      const logPath=path.join(resultsDir,`${String(report.steps.length+1).padStart(2,'0')}-${name.replace(/[^a-zA-Z0-9._-]/g,'-')}.log`);
      const step={name,status:'running',startedAt:new Date().toISOString(),log:logPath};report.steps.push(step);save();
      console.log(`[local-ci] ${name} …`);
      const log=createWriteStream(logPath);
      const status=await new Promise((resolve,reject)=>{
        const child=spawn(command,args,{cwd,env:{...env,...extraEnv},stdio:['ignore','pipe','pipe']});
        child.stdout.pipe(log,{end:false});child.stderr.pipe(log,{end:false});
        child.on('error',reject);child.on('close',code=>resolve(code));
      }).finally(()=>new Promise(resolve=>log.end(resolve)));
      step.status=status===0?'passed':'failed';step.finishedAt=new Date().toISOString();save();
      if(status!==0)throw new Error(`${name} 失败（退出码 ${status}）。日志：${logPath}`);
      console.log(`[local-ci] ${name} passed`);
    }
    const npmRun=name=>run(name,process.execPath,[npm,'run',name]);
    await run('repository-history',process.execPath,['scripts/check-repository.mjs','--history']);
    await run('workflow-lint','actionlint',[]);
    await run('shell-lint','shellcheck',['start-linux.sh','start-macos.command','.githooks/pre-push']);
    await run('clean-install',process.execPath,[npm,'ci']);
    for(const name of ['check','test','test:ci-local','test:delivery','test:tauri','test:release','validate:course','build','package:delivery'])await npmRun(name);
    const pythonEnv=path.join(resultsDir,'python-env');
    if(!existsSync(pythonEnv))await run('python-environment',python,['-m','venv',pythonEnv]);
    const pythonExe=path.join(pythonEnv,process.platform==='win32'?'Scripts/python.exe':'bin/python');
    await run('python-dependencies',pythonExe,['-m','pip','install','-r','projects/tiny-gpt/requirements.txt',...(process.platform==='darwin'?[]:['--index-url','https://download.pytorch.org/whl/cpu'])]);
    for(const project of ['regression','micrograd','tiny-gpt'])await run(`python-${project}`,pythonExe,['-m','unittest','discover','-v'],{cwd:path.join(workspace,'projects',project)});
    await run('launcher-clean-and-warm',process.execPath,['--test','scripts/launcher.test.mjs','scripts/launcher-smoke.test.mjs']);
    await run('chromium-install',process.execPath,[npm,'exec','--','playwright','install','chromium']);
    const port=await new Promise(resolve=>{const server=createServer();server.listen(0,'127.0.0.1',()=>{const port=server.address().port;server.close(()=>resolve(port));});});
    for(const shard of [1,2]){
      await run(`browser-shard-${shard}`,process.execPath,[npm,'run','test:e2e','--','--fully-parallel',`--shard=${shard}/2`],{extraEnv:{PLAYWRIGHT_PORT:String(port)}});
      await cp(path.join(workspace,'artifacts/playwright-results.json'),path.join(resultsDir,`browser-shard-${shard}.json`));
    }
    // Share only compiled Cargo artifacts, never source, credentials or app data.
    await mkdir(path.join(root,'src-tauri/target'),{recursive:true});
    await symlink(path.join(root,'src-tauri/target'),path.join(workspace,'src-tauri/target'),process.platform==='win32'?'junction':'dir');
    // The repository ignores target directories; this cache is a symlink.
    appendFileSync(path.join(workspace,'.git/info/exclude'),'\n/src-tauri/target\n');
    await run('native-tests','cargo',['test','--manifest-path','src-tauri/Cargo.toml','--locked']);
    for(const directory of ['release/bundle','universal-apple-darwin/release/bundle'])await rm(path.join(workspace,'src-tauri/target',directory),{recursive:true,force:true});
    const bundles=process.platform==='darwin'?['--target','universal-apple-darwin','--bundles','app,dmg']:process.platform==='win32'?['--bundles','nsis']:['--bundles','appimage,deb'];
    await run('desktop-build',process.execPath,[npm,'run','desktop:build','--',...bundles,'--ci','--','--locked']);
    await run('provider-runtime',process.execPath,['scripts/provider-engine-smoke.mjs']);
    if(process.platform==='darwin'){
      const config=JSON.parse(readFileSync(path.join(workspace,'src-tauri/tauri.conf.json'),'utf8'));
      const binaries=path.join(workspace,`src-tauri/target/universal-apple-darwin/release/bundle/macos/${config.productName}.app/Contents/MacOS`);
      for(const executable of ['from-zero-to-gpt','provider-engine']){
        const architectures=execFileSync('lipo',['-archs',path.join(binaries,executable)],{encoding:'utf8'}).trim().split(/\s+/);
        if(!['arm64','x86_64'].every(arch=>architectures.includes(arch)))throw new Error(`${executable} 缺少 Universal 架构`);
      }
      await run('bundled-provider-runtime',process.execPath,['scripts/provider-engine-smoke.mjs',path.join(binaries,'provider-engine')]);
    }
    await run('desktop-assets',process.execPath,['scripts/release-assets.mjs','stage',process.platform==='darwin'?'macOS':process.platform==='win32'?'Windows':'Linux']);
    if(git(workspace,'status','--porcelain','--untracked-files=all'))throw new Error('CI 修改了快照源码，请检查保留的工作目录。');
    report.status='passed';report.finishedAt=new Date().toISOString();save();
    console.log(`本地 CI 通过。源码树：${report.tree}\n报告：${path.join(resultsDir,'result.json')}\n仅验证当前主机系统；未推送或发布。`);
    await rm(workspace,{recursive:true,force:true,maxRetries:3});
  }catch(error){report.status='failed';report.error=error.message;report.finishedAt=new Date().toISOString();save();throw error;}
  finally{await rm(lockPath,{force:true});}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(error=>{console.error(error.message);process.exitCode=1;});
