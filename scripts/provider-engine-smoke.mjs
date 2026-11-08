import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import path from 'node:path';

// Exercise the compiled runtime without network calls or personal credentials.
const executable=process.argv[2]||path.resolve(`src-tauri/binaries/provider-engine${process.platform==='win32'?'.exe':''}`);
const child=spawn(executable,[],{stdio:['pipe','pipe','pipe']});
const pending=new Map();let next=0;
child.stderr.resume();
const fail=error=>{for(const {reject,timer} of pending.values()){clearTimeout(timer);reject(error);}pending.clear();};
child.on('error',fail);child.on('exit',()=>fail(new Error('Provider process exited')));
createInterface({input:child.stdout}).on('line',line=>{
  const data=JSON.parse(line),entry=pending.get(data.id);if(!entry)return;
  pending.delete(data.id);clearTimeout(entry.timer);
  data.error?entry.reject(new Error(data.error)):entry.resolve(data.result);
});
function request(action,data={}){
  const id=String(++next);
  return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{pending.delete(id);reject(new Error(`Timed out: ${action}`));},10000);
    pending.set(id,{resolve,reject,timer});child.stdin.write(JSON.stringify({id,action,data})+'\n');
  });
}
try{
  const {providers}=await request('catalog');assert.ok(providers.length>=40);
  assert.ok(providers.find(p=>p.id==='github-copilot').methods.some(m=>m.id==='oauth'));
  const session=await request('loginStart',{providerId:'deepseek',method:'api_key'});
  const prompt=await request('loginPoll',session);assert.equal(prompt.prompt.type,'secret');
  await request('loginInput',{...session,promptId:prompt.prompt.id,value:'synthetic-smoke-key'});
  const done=await request('loginPoll',session);assert.equal(done.state,'complete');
  assert.equal(done.credential.key,'synthetic-smoke-key');
  const {models}=await request('models',{providerId:'deepseek',credential:done.credential});assert.ok(models.length>0);
  await request('loginForget',session);
  console.log(`Standalone provider runtime passed: ${providers.length} services, Key flow and model catalog.`);
}finally{child.stdin.end();child.kill();}
