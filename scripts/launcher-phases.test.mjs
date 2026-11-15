import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtemp,readdir,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {measureLaunchPhase,phasePrefix,trackLaunchPhases,launcherSmokeEnvironment,terminateLauncherTree,redactLauncherOutput} from './launcher-phases.mjs';

test('captured output redacts external URLs, credentials and authorization before upload or failure reporting',()=>{
  const token='ghp_'+'x'.repeat(30),key='sk-'+'y'.repeat(30);
  const output=redactLauncherOutput(`https://user:pass@registry.example/private?token=hidden\nhttps://example.com/reset/private-code\nAuthorization: Bearer fixture-secret\nNPM_TOKEN=fixture-token\n${token} ${key}\nhttp://localhost:5173\nEAI_AGAIN registry.npmjs.org`);
  for(const secret of ['user:pass','hidden','private-code','fixture-secret','fixture-token',token,key])assert.ok(!output.includes(secret),secret);
  assert.ok(output.includes('http://localhost:5173'));assert.ok(output.includes('EAI_AGAIN registry.npmjs.org'));
  assert.equal(redactLauncherOutput('http://localhost:5173/?token=secret'),'[external URL redacted]');
});

test('smoke subprocesses use isolated configuration and exclude ambient secrets and injection flags',()=>{
  const env=launcherSmokeEnvironment({PATH:'fixture-path',SystemRoot:'fixture-system',FROM_ZERO_PYTHON:'python',FROM_ZERO_NPM_CACHE:'fixture-cache',
    TUTOR_API_KEY:'synthetic-secret',NODE_OPTIONS:'--import=unsafe',HTTPS_PROXY:'https://user:pass@example.invalid',NPM_TOKEN:'synthetic-token',HOME:'personal-home'},'isolated-home');
  assert.equal(env.PATH,'fixture-path');assert.equal(env.FROM_ZERO_PYTHON,'python');assert.equal(env.npm_config_cache,'fixture-cache');
  assert.equal(env.HOME,'isolated-home');assert.equal(env.USERPROFILE,'isolated-home');
  for(const key of ['TUTOR_API_KEY','NODE_OPTIONS','HTTPS_PROXY','NPM_TOKEN'])assert.equal(env[key],undefined);
  assert.ok(env.npm_config_userconfig.startsWith('isolated-home'));assert.ok(env.npm_config_globalconfig.startsWith('isolated-home'));
});

test('cleanup targets the owned Windows process tree with a deadline and does not conceal termination failure',()=>{
  const calls=[];const run=(...args)=>{calls.push(args);return {status:0};};
  terminateLauncherTree(1234,{platform:'win32',run});
  assert.deepEqual(calls,[['taskkill',['/pid','1234','/T','/F'],{stdio:'ignore',windowsHide:true,timeout:5000}]]);
  assert.throws(()=>terminateLauncherTree(1234,{platform:'win32',run:()=>({status:1}),kill:()=>{}}),/Could not terminate/);
  assert.doesNotThrow(()=>terminateLauncherTree(1234,{platform:'win32',run:()=>({status:1}),kill:()=>{throw Object.assign(new Error('gone'),{code:'ESRCH'});}}));
  assert.throws(()=>terminateLauncherTree(0,{platform:'win32',run}),/Invalid owned/);
  const signals=[];terminateLauncherTree(1234,{platform:'linux',kill:(...args)=>signals.push(args)});assert.deepEqual(signals,[[-1234,'SIGTERM']]);
});

test('phase measurements report successful and failed work without hiding errors',async()=>{
  const lines=[];
  assert.equal(await measureLaunchPhase('runtime',async()=>42,line=>lines.push(line)),42);
  const failure=new Error('fixture failure');
  await assert.rejects(()=>measureLaunchPhase('projects',async()=>{throw failure;},line=>lines.push(line)),error=>error===failure);
  const events=lines.map(line=>JSON.parse(line.slice(phasePrefix.length)));
  assert.deepEqual(events.map(({phase,event})=>[phase,event]),[['runtime','start'],['runtime','done'],['projects','start'],['projects','failed']]);
  for(const event of events.filter(event=>event.event!=='start'))assert.ok(Number.isFinite(event.durationMs)&&event.durationMs>=0);
});

test('cold startup budgets installation separately from runtime, packaging and readiness',()=>{
  let time=0;const tracker=trackLaunchPhases({now:()=>time});
  for(const [phase,duration] of [['install',250000],['runtime',12000],['projects',2000],['ready',1000]]){
    tracker.record({phase,event:'start'});time+=duration;tracker.check();tracker.record({phase,event:'done',durationMs:duration});
  }
  assert.equal(tracker.complete(),true);
  assert.deepEqual(tracker.snapshot().completed.map(step=>step.durationMs),[250000,12000,2000,1000]);
});

test('a stalled phase fails its own deadline; repeated checks cannot extend it',()=>{
  for(const phase of ['install','runtime','projects','ready']){
    let time=0;const tracker=trackLaunchPhases({now:()=>time,budgets:{bootstrap:100,install:100,runtime:100,projects:100,ready:100,confirmation:100}});
    for(const previous of ['install','runtime','projects','ready']){
      tracker.record({phase:previous,event:'start'});
      if(previous===phase)break;
      tracker.record({phase:previous,event:'done',durationMs:0});
    }
    time=99;tracker.check();tracker.check();time=100;
    assert.throws(()=>tracker.check(),new RegExp(`phase ${phase} timed out`));
    assert.throws(()=>tracker.record({phase,event:'done',durationMs:100}),/timed out/);
  }
});

test('warm startup forbids reinstall and still requires runtime, ZIP and readiness phases',()=>{
  const tracker=trackLaunchPhases({warm:true});
  assert.throws(()=>tracker.record({phase:'install',event:'start'}),/expected runtime/);
  for(const phase of ['runtime','projects','ready']){
    tracker.record({phase,event:'start'});tracker.record({phase,event:'done',durationMs:0});
  }
  assert.equal(tracker.complete(),true);
});

test('missing phase output, failed work and missing final readiness confirmation remain failures',()=>{
  let time=0;const tracker=trackLaunchPhases({now:()=>time});time=30000;
  assert.throws(()=>tracker.check(),/phase bootstrap timed out/);
  assert.throws(()=>tracker.record({phase:'install',event:'start'}),/bootstrap timed out/);
  const failure=trackLaunchPhases();failure.record({phase:'install',event:'start'});
  assert.throws(()=>failure.record({phase:'install',event:'failed',durationMs:1}),/install failed/);
  time=0;const completed=trackLaunchPhases({warm:true,now:()=>time});
  for(const phase of ['runtime','projects','ready']){completed.record({phase,event:'start'});completed.record({phase,event:'done',durationMs:0});}
  time=5000;assert.throws(()=>completed.check(),/phase confirmation timed out/);
});

test('launcher-owned install defers only our root resource copy without needing dependencies',async()=>{
  const root=await mkdtemp(join(tmpdir(),'from zero deferred resources '));
  try{
    const script=fileURLToPath(new URL('copy-python.mjs',import.meta.url));
    const result=spawnSync(process.execPath,[script],{cwd:root,env:{...process.env,FROM_ZERO_LAUNCH_INSTALL:'1'},encoding:'utf8',timeout:5000});
    assert.equal(result.status,0,result.stderr);
    assert.match(result.stdout,/resource preparation deferred/);
    assert.deepEqual(await readdir(root),[]);
  }finally{await rm(root,{recursive:true,force:true});}
});
