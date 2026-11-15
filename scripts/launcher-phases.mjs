import {performance} from 'node:perf_hooks';
import {spawnSync} from 'node:child_process';
import {join} from 'node:path';

export const phasePrefix='FROM_ZERO_LAUNCH_PHASE ';
// Cold dependency installation includes real npm lifecycle hooks. Server startup
// and warm reuse must not borrow its network/install budget.
export const phaseBudgets={bootstrap:30000,install:300000,runtime:60000,projects:30000,ready:30000,confirmation:5000};

export function redactLauncherOutput(text){
  return text.replace(/https?:\/\/[^\s<>"']+/gi,url=>{
    try{const parsed=new URL(url);if(['localhost','127.0.0.1','[::1]'].includes(parsed.hostname)&&!parsed.username&&!parsed.password&&!parsed.search&&!parsed.hash)return url;}catch{/* Redact malformed URLs too. */}
    return '[external URL redacted]';
  }).replace(/\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]+/gi,'$1 [redacted]')
    .replace(/\b((?:[A-Z_]*(?:TOKEN|PASSWORD|SECRET|API_KEY)|authorization)\s*[:=]\s*)[^\r\n]+/gi,'$1[redacted]')
    .replace(/\b(?:gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|npm_[A-Za-z0-9]{20,}|sk-[A-Za-z0-9_-]{20,})\b/g,'[credential redacted]');
}

export function launcherSmokeEnvironment(source,home){
  const env={};
  for(const key of ['PATH','SystemRoot','WINDIR','COMSPEC','ComSpec','PATHEXT','TMPDIR','TMP','TEMP','FROM_ZERO_PYTHON','CI'])if(source[key])env[key]=source[key];
  // No ambient provider credentials, NODE_OPTIONS, proxy auth or personal npmrc.
  return {...env,HOME:home,USERPROFILE:home,APPDATA:join(home,'AppData','Roaming'),LOCALAPPDATA:join(home,'AppData','Local'),
    npm_config_userconfig:join(home,'empty-user-npmrc'),npm_config_globalconfig:join(home,'empty-global-npmrc'),
    npm_config_cache:source.FROM_ZERO_NPM_CACHE||source.npm_config_cache||source.NPM_CONFIG_CACHE||join(home,'npm-cache'),
    FROM_ZERO_NO_PAUSE:'1',FROM_ZERO_LAUNCH_PHASES:'1'};
}

export function terminateLauncherTree(pid,{platform=process.platform,run=spawnSync,kill=process.kill}={}){
  if(!Number.isSafeInteger(pid)||pid<=0)throw new Error('Invalid owned launcher PID');
  if(platform==='win32'){
    const result=run('taskkill',['/pid',String(pid),'/T','/F'],{stdio:'ignore',windowsHide:true,timeout:5000});
    if(result.error||result.status!==0){
      // The wrapper may have exited between the liveness check and taskkill.
      try{kill(pid,0);}catch(error){if(error.code==='ESRCH')return;throw error;}
      throw new Error('Could not terminate owned Windows launcher process tree');
    }
  }else try{kill(-pid,'SIGTERM');}catch(error){if(error.code!=='ESRCH')throw error;}
}

export async function measureLaunchPhase(phase,operation,emit=process.env.FROM_ZERO_LAUNCH_PHASES==='1'?console.log:()=>{}){
  const start=performance.now();
  emit(phasePrefix+JSON.stringify({phase,event:'start'}));
  try{
    const result=await operation();
    emit(phasePrefix+JSON.stringify({phase,event:'done',durationMs:Math.round(performance.now()-start)}));
    return result;
  }catch(error){
    emit(phasePrefix+JSON.stringify({phase,event:'failed',durationMs:Math.round(performance.now()-start)}));
    throw error;
  }
}

// The smoke owns the wrapper/process tree and enforces each deadline even if an
// installer stops producing output. Ordinary log traffic never extends a phase.
export function trackLaunchPhases({warm=false,now=Date.now,budgets=phaseBudgets}={}){
  const expected=warm?['runtime','projects','ready']:['install','runtime','projects','ready'];
  const completed=[];
  let index=0,active='bootstrap',started=now(),deadline=started+budgets.bootstrap;
  return {
    record(event){
      // Output may arrive between watchdog polls. A late start cannot reset an
      // already expired bootstrap/previous-phase budget and hide the timeout.
      if(now()>=deadline)throw new Error(`Launcher ${warm?'warm':'cold'} phase ${active} timed out before ${event.phase} ${event.event}`);
      if(event.event==='start'){
        if(active!=='bootstrap'||event.phase!==expected[index])throw new Error(`Unexpected launcher phase ${event.phase}; expected ${expected[index]}`);
        active=event.phase;started=now();deadline=started+budgets[active];
      }else if(event.event==='done'||event.event==='failed'){
        if(event.phase!==active)throw new Error(`Unexpected launcher phase completion ${event.phase}`);
        const elapsedMs=now()-started;
        completed.push({phase:active,event:event.event,durationMs:event.durationMs,observedMs:elapsedMs});
        if(event.event==='failed')throw new Error(`Launcher phase ${active} failed after ${elapsedMs} ms`);
        // A completed event arriving after the deadline is still a failure.
        if(now()>=deadline)throw new Error(`Launcher phase ${active} exceeded ${budgets[active]} ms`);
        index++;active=index===expected.length?'confirmation':'bootstrap';started=now();deadline=started+budgets[active];
      }else throw new Error('Invalid launcher phase event');
    },
    check(){if(now()>=deadline)throw new Error(`Launcher ${warm?'warm':'cold'} phase ${active} timed out after ${now()-started} ms (budget ${budgets[active]} ms)`);},
    complete:()=>index===expected.length,
    snapshot:()=>({warm,complete:index===expected.length,active,elapsedMs:now()-started,completed:[...completed]}),
  };
}
