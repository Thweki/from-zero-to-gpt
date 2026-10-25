import {useEffect,useSyncExternalStore} from 'react';

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
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8000);
    inFlight=(async()=>{
      await Promise.resolve();
      try{
        const response=await fetcher('/api/tutor/status',{signal:controller.signal,cache:'no-store'});
        if(!response.ok)throw new Error('connection');
        const data=await response.json();
        if(typeof data.configured!=='boolean'||typeof data.provider!=='string'||typeof data.model!=='string')throw new Error('invalid status');
        const status:TutorStatus={configured:data.configured,provider:data.provider,model:data.model,baseURL:typeof data.baseURL==='string'?data.baseURL:'',accessCodeRequired:data.accessCodeRequired===true,imagesSupported:data.imagesSupported===true};
        publish({phase:status.configured?'ready':'unavailable',status,error:status.configured?'':'服务端尚未配置模型密钥。教材和数学实验仍可照常使用。'});
      }catch{publish({phase:'error',status:null,error:'暂时无法连接导师。请检查网络或服务配置；教材和问题草稿仍可使用。'});}
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
