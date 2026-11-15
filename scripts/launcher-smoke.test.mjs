import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {existsSync} from 'node:fs';
import {mkdtemp,cp,readFile,writeFile,rm,mkdir} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {createServer} from 'node:net';
import {setTimeout as delay} from 'node:timers/promises';
import {projectRoot} from './launch.mjs';
import {phasePrefix,phaseBudgets,trackLaunchPhases,launcherSmokeEnvironment,terminateLauncherTree,redactLauncherOutput} from './launcher-phases.mjs';

async function freePort(){return new Promise((yes,no)=>{const s=createServer();s.on('error',no);s.listen(0,'127.0.0.1',()=>{const port=s.address().port;s.close(()=>yes(port));});});}
function boot(root,port,warm=false){
  const script=process.platform==='win32'?'start-windows.bat':process.platform==='darwin'?'start-macos.command':'start-linux.sh';
  const command=process.platform==='win32'?process.env.ComSpec||'cmd.exe':'sh';
  const args=process.platform==='win32'?['/d','/s','/c',`""${join(root,script)}" --no-open --port ${port}"`]:[join(root,script),'--no-open','--port',String(port)];
  const child=spawn(command,args,{cwd:tmpdir(),detached:process.platform!=='win32',windowsVerbatimArguments:process.platform==='win32',env:launcherSmokeEnvironment(process.env,join(root,'artifacts','smoke-home')),stdio:['ignore','pipe','pipe']});
  let output='';for(const stream of [child.stdout,child.stderr])stream.on('data',chunk=>{output=(output+chunk).slice(-40000);});
  const phases=trackLaunchPhases({warm});let phaseError,buffer='';
  child.stdout.on('data',chunk=>{
    buffer+=chunk;const lines=buffer.split('\n');buffer=lines.pop();
    for(const line of lines)if(line.startsWith(phasePrefix)){
      try{phases.record(JSON.parse(line.slice(phasePrefix.length)));}catch(error){phaseError??=error;}
    }
  });
  let ended=false,exit;const done=new Promise(yes=>{child.once('error',e=>{ended=true;output+=e.message;yes();});child.once('exit',(code,signal)=>{ended=true;exit={code,signal};yes();});});
  return {child,done,phases,phaseError:()=>phaseError,output:()=>redactLauncherOutput(output),ended:()=>ended,exit:()=>exit,warm};
}
async function stop(instance){
  if(!instance)return;
  instance.cleanup={pid:instance.child.pid,method:process.platform==='win32'?'taskkill /T /F':'SIGTERM process group',needed:!instance.ended()};
  if(instance.ended()){instance.cleanup.stopped=true;return;}
  try{terminateLauncherTree(instance.child.pid);}catch(error){instance.cleanup.error=error.message;throw error;}
  await Promise.race([instance.done,delay(5000)]);
  instance.cleanup.stopped=instance.ended();
  if(!instance.ended()){instance.cleanup.error='Owned launcher process did not stop';throw new Error(instance.cleanup.error);}
}
async function ready(instance,port){
  const names=instance.warm?['runtime','projects','ready']:['install','runtime','projects','ready'];
  const end=Date.now()+phaseBudgets.bootstrap+phaseBudgets.confirmation+names.reduce((sum,name)=>sum+phaseBudgets[name],0);
  while(Date.now()<end){
    try{if(instance.phaseError())throw instance.phaseError();instance.phases.check();}
    catch(error){throw new Error(`${error.message}\n${instance.output()}`);}
    if(instance.ended())throw new Error(`Launcher exited early:\n${instance.output()}`);
    if(instance.phases.complete())try{const response=await fetch(`http://127.0.0.1:${port}`,{signal:AbortSignal.timeout(1000)});if(response.ok&&(await response.text()).includes('From Zero to GPT')&&instance.output().includes('学习平台已启动'))return;}catch{/* Not ready. */}
    await delay(250);
  }
  throw new Error(`Launcher total startup budget exceeded:\n${instance.output()}`);
}

test('real platform wrapper: clean install, spaced path, HTTP resources, duplicate protection and warm restart',{timeout:720000},async()=>{
  const root=await mkdtemp(join(tmpdir(),'From Zero learning lab '));let first,second;
  const instances=[],artifacts=resolve(process.env.FROM_ZERO_LAUNCHER_ARTIFACT_DIR||join(projectRoot,'artifacts','launcher-smoke'));
  try{
    // Copy repository source only: never copy local configuration, dependencies or user artifacts.
    const list=spawnSync('git',['ls-files','-z'],{cwd:projectRoot,encoding:'utf8'});assert.equal(list.status,0);
    for(const file of list.stdout.split('\0').filter(Boolean))await cp(join(projectRoot,file),join(root,file),{recursive:true});
    assert.equal(existsSync(join(root,'node_modules')),false);
    const port=await freePort();first=boot(root,port);instances.push(first);await ready(first,port);
    assert.deepEqual(first.phases.snapshot().completed.map(step=>step.phase),['install','runtime','projects','ready']);
    assert.match(first.output(),/Browser runtime resource preparation deferred to the launcher/);
    assert.match(first.output(),new RegExp(`http://localhost:${port}`));
    const base=`http://127.0.0.1:${port}`;
    for(const asset of ['/python/pyodide.asm.wasm','/downloads/regression.zip','/downloads/micrograd.zip','/downloads/tiny-gpt.zip'])assert.equal((await fetch(base+asset,{method:'HEAD'})).status,200,asset);
    assert.equal((await fetch(base+'/api/tutor/status')).status,200);
    const duplicate=spawn(process.execPath,[join(root,'scripts','launch.mjs'),'--no-open','--port',String(port)],{cwd:tmpdir(),stdio:['ignore','pipe','pipe']});let duplicateOutput='';duplicate.stdout.on('data',x=>duplicateOutput+=x);duplicate.stderr.on('data',x=>duplicateOutput+=x);
    const exit=await new Promise(yes=>duplicate.once('exit',yes));assert.notEqual(exit,0);assert.match(duplicateOutput,/已有启动程序/);
    const sentinel=join(root,'node_modules','.from-zero-reuse-check');await writeFile(sentinel,'keep installed dependencies');
    const marker=await readFile(join(root,'node_modules','.from-zero-install.json'),'utf8');
    await stop(first);first=null;
    second=boot(root,port,true);instances.push(second);await ready(second,port);
    assert.deepEqual(second.phases.snapshot().completed.map(step=>step.phase),['runtime','projects','ready']);
    assert.equal(await readFile(sentinel,'utf8'),'keep installed dependencies');assert.equal(await readFile(join(root,'node_modules','.from-zero-install.json'),'utf8'),marker);
    console.log(`${process.platform}: fresh install + real wrapper + warm restart passed; test path contains spaces.`);
  }finally{
    try{await stop(first);await stop(second);}
    finally{
      await mkdir(artifacts,{recursive:true});
      for(const instance of instances){
        const name=instance.warm?'warm':'cold';
        await writeFile(join(artifacts,`${name}.log`),instance.output());
        await writeFile(join(artifacts,`${name}-phases.json`),JSON.stringify({...instance.phases.snapshot(),process:{pid:instance.child.pid,exit:instance.exit(),cleanup:instance.cleanup}},null,2)+'\n');
      }
      await rm(root,{recursive:true,force:true,maxRetries:5,retryDelay:300});
    }
  }
});
