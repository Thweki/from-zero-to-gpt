import {useEffect,useSyncExternalStore} from 'react';
import {nativeTutorStatus} from './provider-manager';
import {isTauriRuntime,tutorApiUrl} from './runtime';

export type TutorStatus={configured:boolean;provider:string;model:string;baseURL:string;accessCodeRequired?:boolean;imagesSupported?:boolean};
type Snapshot={phase:'idle'|'checking'|'ready'|'unavailable'|'error';status:TutorStatus|null;error:string};
export function createTutorConnection(fetcher:typeof fetch=(...args)=>fetch(...args)){
  let snapshot:Snapshot={phase:'idle',status:null,error:''},checkedAt=0,inFlight:Promise<void>|null=null;
  const listeners=new Set<()=>void>();
  const publish=(next:Snapshot)=>{snapshot=next;listeners.forEach(listener=>listener());};
  const check=(force=false):Promise<void>=>{
    if(inFlight)return inFlight;
    if(!force&&snapshot.phase!=='idle'&&Date.now()-checkedAt<60000)return Promise.resolve();
    publish({phase:'checking',status:null,error:''});
    const endpoint=tutorApiUrl('status');
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8000);
    inFlight=(async()=>{
      await Promise.resolve();
      try{
        const data=endpoint?await (async()=>{const response=await fetcher(endpoint,{signal:controller.signal,cache:'no-store'});if(!response.ok)throw new Error('connection');return response.json();})():isTauriRuntime?await nativeTutorStatus():null;
        if(!data||typeof data.configured!=='boolean'||typeof data.provider!=='string'||typeof data.model!=='string')throw new Error('invalid status');
        const status:TutorStatus={configured:data.configured,provider:data.provider,model:data.model,baseURL:typeof data.baseURL==='string'?data.baseURL:'',accessCodeRequired:data.accessCodeRequired===true,imagesSupported:data.imagesSupported===true};
        publish({phase:status.configured?'ready':'unavailable',status,error:status.configured?'':'当前服务尚未配置凭据。请在设置中完成连接；课程与实验仍可照常使用。'});
      }catch{publish({phase:'error',status:null,error:isTauriRuntime&&!endpoint?'尚未配置导师服务。请在设置中添加模型服务；课程和实验可离线使用。':'暂时无法连接导师。请检查网络或服务配置；教材和问题草稿仍可使用。'});}
      finally{clearTimeout(timer);checkedAt=Date.now();inFlight=null;}
    })();
    return inFlight;
  };
  return {getSnapshot:()=>snapshot,subscribe:(listener:()=>void)=>{listeners.add(listener);return()=>{listeners.delete(listener);};},check};
}
const connection=createTutorConnection();
export function useTutorConnection(){
  const snapshot=useSyncExternalStore(connection.subscribe,connection.getSnapshot,connection.getSnapshot);
  useEffect(()=>{void connection.check();},[]);
  return {...snapshot,checking:snapshot.phase==='idle'||snapshot.phase==='checking',refresh:()=>void connection.check(true)};
}
