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
