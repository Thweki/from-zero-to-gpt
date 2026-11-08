import {isTauriRuntime,tutorApiUrl} from './runtime';
import type {ProviderServiceDraft,ProviderServiceSnapshot} from './provider-services';

type ServiceOperation='save'|'activate'|'remove';
function endpoint(operation:''|ServiceOperation){return tutorApiUrl(`services${operation?`/${operation}`:''}`);}
async function invokeNative<T>(command:string,args?:Record<string,unknown>):Promise<T>{
  const {invoke}=await import('@tauri-apps/api/core');
  return invoke<T>(command,args);
}
async function request<T>(operation:''|ServiceOperation,body?:unknown):Promise<T>{
  const url=endpoint(operation);
  if(!url)throw new Error('此部署不允许从浏览器管理模型服务。');
  const response=await fetch(url,{method:body===undefined?'GET':'POST',headers:body===undefined?{}:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),cache:'no-store'});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(typeof data.error==='string'?data.error:'服务管理暂时不可用。');
  return data as T;
}
export function providerServicesSnapshot():Promise<ProviderServiceSnapshot>{
  if(isTauriRuntime&&!endpoint(''))return invokeNative('provider_services_snapshot');
  return request('');
}
export function saveProviderService(service:ProviderServiceDraft,secret?:string):Promise<ProviderServiceSnapshot>{
  if(isTauriRuntime&&!endpoint('save'))return invokeNative('provider_service_save',{service,secret});
  return request('save',{service,secret});
}
export function activateProviderService(id:string):Promise<ProviderServiceSnapshot>{
  if(isTauriRuntime&&!endpoint('activate'))return invokeNative('provider_service_activate',{id});
  return request('activate',{id});
}
export function removeProviderService(id:string):Promise<ProviderServiceSnapshot>{
  if(isTauriRuntime&&!endpoint('remove'))return invokeNative('provider_service_remove',{id});
  return request('remove',{id});
}
export function nativeTutorStatus(){return invokeNative<Record<string,unknown>>('native_tutor_status');}
export function nativeTutorChat(payload:unknown){return invokeNative<{answer:string}>('native_tutor_chat',{payload});}
export function nativeTutorCancel(sessionId:string){return invokeNative<void>('native_tutor_cancel',{sessionId});}

export async function providerEngineRequest<T>(action:string,data:Record<string,unknown>={}):Promise<T>{
  if(isTauriRuntime&&!endpoint(''))return invokeNative('provider_engine_request',{action,data});
  const url=tutorApiUrl('services/engine');if(!url)throw new Error('此部署不支持账号连接。请使用桌面版或本地服务。');
  const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,data}),cache:'no-store'});
  const result=await response.json();if(!response.ok)throw new Error(result.error||'模型服务操作失败。');return result;
}
export async function openProviderUrl(url:string){
  if(new URL(url).protocol!=='https:')throw new Error('登录地址无效。');
  if(isTauriRuntime)return invokeNative('open_provider_url',{url});
  window.open(url,'_blank','noopener,noreferrer');
}
