import {useSyncExternalStore} from 'react';
import type {Update} from '@tauri-apps/plugin-updater';
import {isTauriRuntime} from './runtime';
export const releaseUrl='https://github.com/Thweki/from-zero-to-gpt/releases/latest';
export const updaterSupported=isTauriRuntime&&!/Android|iPhone|iPad/.test(navigator.userAgent);
type UpdateHandle=Pick<Update,'version'|'body'|'download'|'install'|'close'>;
export type UpdateState={phase:'idle'|'checking'|'latest'|'available'|'downloading'|'ready'|'installing'|'installed'|'error';version?:string;notes?:string;received:number;total?:number;error?:string};
export function createAppUpdater(check:()=>Promise<UpdateHandle|null>,relaunch:()=>Promise<void>){
 let state:UpdateState={phase:'idle',received:0},update:UpdateHandle|null=null,inFlight:Promise<void>|null=null;
 const listeners=new Set<()=>void>();
 const publish=(patch:Partial<UpdateState>)=>{state={...state,...patch};listeners.forEach(l=>l());};
 const run=(task:()=>Promise<void>)=>{if(inFlight)return inFlight;inFlight=task().finally(()=>{inFlight=null;});return inFlight;};
 return {
  getSnapshot:()=>state,subscribe:(listener:()=>void)=>{listeners.add(listener);return()=>{listeners.delete(listener);};},
  check:()=>run(async()=>{
   if(['ready','installed'].includes(state.phase))return;
   publish({phase:'checking',error:undefined});
   try{await update?.close();update=null;update=await check();publish({phase:update?'available':'latest',version:update?.version,notes:update?.body,received:0,total:undefined});}
   catch{publish({phase:'error',error:'暂时无法检查更新。请检查网络，或到 GitHub 查看发布版本。'});}
  }),
  download:()=>run(async()=>{
   if(!update||!['available','error'].includes(state.phase))return;
   publish({phase:'downloading',received:0,total:undefined,error:undefined});
   try{await update.download(event=>{if(event.event==='Started')publish({total:event.data.contentLength});else if(event.event==='Progress')publish({received:state.received+event.data.chunkLength});},{timeout:120000});publish({phase:'ready'});}
   catch{publish({phase:'error',error:'更新包下载或签名校验失败，当前版本未改变。请重新检查更新。'});}
  }),
  install:()=>run(async()=>{
   if(!update||state.phase!=='ready')return;
   publish({phase:'installing',error:undefined});
   try{await update.install();publish({phase:'installed'});}
   catch{publish({phase:'error',error:'更新安装失败。请重新检查，或从 GitHub 下载安装包。'});return;}
   try{await relaunch();}catch{publish({phase:'installed',error:'更新已安装，请手动关闭并重新打开应用。'});}
  }),
 };
}
export const appUpdater=createAppUpdater(async()=>{const {check}=await import('@tauri-apps/plugin-updater');return check({timeout:15000});},async()=>{const {relaunch}=await import('@tauri-apps/plugin-process');await relaunch();});
export const useAppUpdate=()=>useSyncExternalStore(appUpdater.subscribe,appUpdater.getSnapshot,appUpdater.getSnapshot);
