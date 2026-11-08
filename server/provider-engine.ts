import {randomUUID} from 'node:crypto';
import appPackage from '../package.json';
import {InMemoryCredentialStore,type Credential,type AuthPrompt,type AuthEvent,type AuthType,type Context,type Message} from '@earendil-works/pi-ai';
import {builtinModels} from '@earendil-works/pi-ai/providers/all';
import {registerBunOAuthFlows} from '@earendil-works/pi-ai/bun-oauth';

registerBunOAuthFlows();
// Never silently borrow credentials from another application or process environment.
const authContext={env:async()=>undefined,fileExists:async()=>false};
const identity={name:'from-zero-to-gpt',version:appPackage.version};
const makeModels=(credentials=new InMemoryCredentialStore())=>builtinModels({credentials,authContext,identity});
const catalog=makeModels();
const aliases:Record<string,string>={openai:'OpenAI / ChatGPT',anthropic:'Claude / Anthropic',google:'Google Gemini','openai-codex':'ChatGPT / Codex（旧版登录）'};
const preferred=['openai','anthropic','google','github-copilot','deepseek','openrouter','opencode-go','opencode','kimi-coding','zai','minimax'];
type Session={id:string;providerId:string;state:'waiting'|'complete'|'error';controller:AbortController;expires:number;event?:AuthEvent;notice?:AuthEvent;timer?:ReturnType<typeof setTimeout>;prompt?:(AuthPrompt&{id:string});resolve?:(value:string)=>void;reject?:(error:Error)=>void;credential?:Credential;error?:string;models:ReturnType<typeof makeModels>};
export class ProviderEngine {
  private sessions=new Map<string,Session>();
  private jobs=new Map<string,AbortController>();
  async request(action:string,data:Record<string,any>={}):Promise<any>{
    for(const [id,s] of this.sessions)if(s.expires<Date.now()){clearTimeout(s.timer);s.controller.abort();s.reject?.(new Error('授权已过期，请重新连接。'));this.sessions.delete(id);}
    if(action==='catalog')return {providers:catalog.getProviders().filter(p=>p.getModels().length>0).map(p=>({id:p.id,name:aliases[p.id]||p.name,methods:[...(p.auth.apiKey?.login?[{id:'api_key',name:'使用 API Key'}]:[]),...(p.auth.oauth?[{id:'oauth',name:'登录订阅账号',description:p.auth.oauth.name}]:[])],modelCount:p.getModels().length})).sort((a,b)=>(preferred.indexOf(a.id)<0?99:preferred.indexOf(a.id))-(preferred.indexOf(b.id)<0?99:preferred.indexOf(b.id)))};
    if(action==='loginStart'){
      if(this.sessions.size>=8)throw new Error('请先结束已有的连接流程。');
      const provider=catalog.getProvider(data.providerId);
      if(!provider||!['api_key','oauth'].includes(data.method))throw new Error('请选择受支持的服务和登录方式。');
      const controller=new AbortController();
      const s:Session={id:randomUUID(),providerId:provider.id,state:'waiting',controller,expires:Date.now()+10*60_000,models:makeModels()};
      this.sessions.set(s.id,s);
      s.timer=setTimeout(()=>{controller.abort();s.reject?.(new Error('授权已过期'));this.sessions.delete(s.id);},10*60_000);s.timer.unref();
      void s.models.login(provider.id,data.method as AuthType,{
        signal:controller.signal,
        notify:event=>{if(event.type==='auth_url'||event.type==='device_code'){s.event=event;s.notice=undefined;}else{s.notice=event;}},
        prompt:prompt=>new Promise<string>((resolve,reject)=>{
          if(prompt.signal?.aborted||controller.signal.aborted){reject(new Error('已取消连接。'));return;}
          const id=randomUUID();const {signal:_signal,...publicPrompt}=prompt;s.prompt={...publicPrompt,id};
          const cancel=()=>{if(s.prompt?.id===id){s.prompt=undefined;s.resolve=undefined;s.reject=undefined;}reject(new Error('已取消输入。'));};
          const cleanup=()=>{prompt.signal?.removeEventListener('abort',cancel);controller.signal.removeEventListener('abort',cancel);};
          s.resolve=value=>{cleanup();resolve(value);};s.reject=error=>{cleanup();reject(error);};
          prompt.signal?.addEventListener('abort',cancel,{once:true});controller.signal.addEventListener('abort',cancel,{once:true});
        }),
      },{agentName:'From Zero to GPT',getDeviceId:()=>data.hostId}).then(credential=>{s.credential=credential;s.state='complete';s.prompt=undefined;},()=>{s.error='连接未完成：授权可能已取消、过期，或网络不可用。请重新连接。';s.state='error';s.prompt=undefined;});
      return {sessionId:s.id};
    }
    if(['loginPoll','loginInput','loginCancel','loginForget'].includes(action)){
      const s=this.sessions.get(data.sessionId);if(!s)throw new Error('连接会话已过期，请重新开始。');
      if(action==='loginCancel'||action==='loginForget'){clearTimeout(s.timer);s.controller.abort();s.reject?.(new Error('已取消'));this.sessions.delete(s.id);return {};}
      if(action==='loginInput'){
        if(!s.prompt||data.promptId!==s.prompt.id||typeof data.value!=='string'||data.value.length>16000)throw new Error('输入已过期，请使用当前提示。');
        const resolve=s.resolve;s.prompt=undefined;s.resolve=undefined;s.reject=undefined;resolve?.(data.value);return {};
      }
      // Credentials are internal host IPC only. Hosts persist them and strip this field before responding to UI.
      return {sessionId:s.id,providerId:s.providerId,state:s.state,event:s.event,notice:s.notice,prompt:s.prompt,error:s.error,...(s.state==='complete'?{credential:s.credential,serviceId:`service-${s.id}`,name:aliases[s.providerId]||catalog.getProvider(s.providerId)!.name}:{} )};
    }
    if(action==='cancel'){this.jobs.get(data.jobId)?.abort();return {};}
    if(action==='models'||action==='chat'){
      if(!catalog.getProvider(data.providerId))throw new Error('服务商不存在。');
      const credentials=new InMemoryCredentialStore();
      const models=makeModels(credentials);
      const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),action==='chat'?120000:20000);
      const jobId=data.jobId||randomUUID();this.jobs.set(jobId,controller);
      try{
        if(data.credential)await credentials.modify(data.providerId,async()=>data.credential as Credential);
        if(action==='models'){
          const result=await models.refresh({providers:[data.providerId],allowNetwork:true,force:true,signal:controller.signal});
          return {models:models.getModels(data.providerId).map(m=>({id:m.id,name:m.name})),catalogOnly:result.errors.size>0,credential:await credentials.read(data.providerId)};
        }
        let model=models.getModel(data.providerId,data.model);
        if(!model){await models.refresh({providers:[data.providerId],allowNetwork:true,signal:controller.signal});model=models.getModel(data.providerId,data.model);}
        if(!model)throw new Error('所选模型已不在服务目录中，请重新选择。');
        const messages=data.messages as Array<{role:string;content:any}>;
        const context:Context={systemPrompt:messages.filter(m=>m.role==='system').map(m=>m.content).join('\n'),messages:messages.filter(m=>m.role!=='system').map(m=>m.role==='assistant'?{role:'assistant',content:[{type:'text',text:m.content}],api:model!.api,provider:model!.provider,model:model!.id,usage:{input:0,output:0,cacheRead:0,cacheWrite:0,totalTokens:0,cost:{input:0,output:0,cacheRead:0,cacheWrite:0,total:0}},stopReason:'stop',timestamp:Date.now()}:{role:'user',content:typeof m.content==='string'?m.content:m.content.map((part:any)=>part.type==='text'?part:{type:'image',data:part.image_url.url.split(',')[1],mimeType:part.image_url.url.split(';')[0].slice(5)}),timestamp:Date.now()}) as Message[]};
        const answer=await models.completeSimple(model,context,{signal:controller.signal,maxTokens:2400,sessionId:data.jobId});
        const text=answer.content.filter(c=>c.type==='text').map(c=>c.text).join('\n');
        // Persist a rotated refresh token even when inference subsequently fails.
        const credential=await credentials.read(data.providerId);
        if(answer.stopReason==='error'||answer.stopReason==='aborted'||!text.trim())return {error:'模型未完成回答，请检查订阅额度、模型权限或重新登录。',credential};
        return {answer:text.slice(0,24000),credential};
      }catch{
        const credential=await credentials.read(data.providerId);
        if(action==='models')return {models:models.getModels(data.providerId).map(m=>({id:m.id,name:m.name})),catalogOnly:true,credential};
        return {error:'模型请求失败或已取消，请检查账号权限与网络。',credential};
      }finally{clearTimeout(timeout);this.jobs.delete(jobId);}
    }
    throw new Error('不支持的模型服务操作。');
  }
}
