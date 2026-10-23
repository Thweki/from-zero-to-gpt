import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {existsSync} from 'node:fs';
import {mkdtemp,cp,readFile,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createServer} from 'node:net';
import {setTimeout as delay} from 'node:timers/promises';
import {projectRoot} from './launch.mjs';

async function freePort(){return new Promise((yes,no)=>{const s=createServer();s.on('error',no);s.listen(0,'127.0.0.1',()=>{const port=s.address().port;s.close(()=>yes(port));});});}
function boot(root,port){
  const script=process.platform==='win32'?'start-windows.bat':process.platform==='darwin'?'start-macos.command':'start-linux.sh';
  const command=process.platform==='win32'?process.env.ComSpec||'cmd.exe':'sh';
  const args=process.platform==='win32'?['/d','/s','/c',`""${join(root,script)}" --no-open --port ${port}"`]:[join(root,script),'--no-open','--port',String(port)];
  const child=spawn(command,args,{cwd:tmpdir(),detached:process.platform!=='win32',windowsVerbatimArguments:process.platform==='win32',env:{...process.env,FROM_ZERO_NO_PAUSE:'1'},stdio:['ignore','pipe','pipe']});
  let output='';for(const stream of [child.stdout,child.stderr])stream.on('data',chunk=>{output=(output+chunk).slice(-40000);});
  let ended=false;const done=new Promise(yes=>{child.once('error',e=>{ended=true;output+=e.message;yes();});child.once('exit',()=>{ended=true;yes();});});
  return {child,done,output:()=>output,ended:()=>ended};
}
async function stop(instance){
  if(!instance||instance.ended())return;
  if(process.platform==='win32')spawnSync('taskkill',['/pid',String(instance.child.pid),'/T','/F'],{stdio:'ignore'});
  else try{process.kill(-instance.child.pid,'SIGTERM');}catch(error){if(error.code!=='ESRCH')throw error;}
  await Promise.race([instance.done,delay(5000)]);
  if(!instance.ended())throw new Error('Owned launcher process did not stop');
}
async function ready(instance,port){
  const end=Date.now()+240000;
  while(Date.now()<end){
    if(instance.ended())throw new Error(`Launcher exited early:\n${instance.output()}`);
    try{const response=await fetch(`http://127.0.0.1:${port}`,{signal:AbortSignal.timeout(1000)});if(response.ok&&(await response.text()).includes('From Zero to GPT')&&instance.output().includes('学习平台已启动'))return;}catch{/* Not ready. */}
    await delay(250);
  }
  throw new Error(`Launcher readiness timed out:\n${instance.output()}`);
}

test('real platform wrapper: clean install, spaced path, HTTP resources, duplicate protection and warm restart',{timeout:420000},async()=>{
  const root=await mkdtemp(join(tmpdir(),'From Zero learning lab '));let first,second;
  try{
    // Copy repository source only: never copy local configuration, dependencies or user artifacts.
    const list=spawnSync('git',['ls-files','-z'],{cwd:projectRoot,encoding:'utf8'});assert.equal(list.status,0);
    for(const file of list.stdout.split('\0').filter(Boolean))await cp(join(projectRoot,file),join(root,file),{recursive:true});
    assert.equal(existsSync(join(root,'node_modules')),false);
    const port=await freePort();first=boot(root,port);await ready(first,port);
    assert.match(first.output(),new RegExp(`http://localhost:${port}`));
    const base=`http://127.0.0.1:${port}`;
    for(const asset of ['/python/pyodide.asm.wasm','/downloads/regression.zip','/downloads/micrograd.zip','/downloads/tiny-gpt.zip'])assert.equal((await fetch(base+asset,{method:'HEAD'})).status,200,asset);
    assert.equal((await fetch(base+'/api/tutor/status')).status,200);
    const duplicate=spawn(process.execPath,[join(root,'scripts','launch.mjs'),'--no-open','--port',String(port)],{cwd:tmpdir(),stdio:['ignore','pipe','pipe']});let duplicateOutput='';duplicate.stdout.on('data',x=>duplicateOutput+=x);duplicate.stderr.on('data',x=>duplicateOutput+=x);
    const exit=await new Promise(yes=>duplicate.once('exit',yes));assert.notEqual(exit,0);assert.match(duplicateOutput,/已有启动程序/);
    const sentinel=join(root,'node_modules','.from-zero-reuse-check');await writeFile(sentinel,'keep installed dependencies');
    const marker=await readFile(join(root,'node_modules','.from-zero-install.json'),'utf8');
    await stop(first);first=null;
    second=boot(root,port);await ready(second,port);
    assert.equal(await readFile(sentinel,'utf8'),'keep installed dependencies');assert.equal(await readFile(join(root,'node_modules','.from-zero-install.json'),'utf8'),marker);
    console.log(`${process.platform}: fresh install + real wrapper + warm restart passed; test path contains spaces.`);
  }finally{await stop(first);await stop(second);await rm(root,{recursive:true,force:true,maxRetries:5,retryDelay:300});}
});
