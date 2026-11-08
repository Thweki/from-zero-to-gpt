import {ProviderEngine} from './provider-engine';
import {randomUUID} from 'node:crypto';
import {chmod,mkdir,readFile,rename,writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type {ProviderService,ProviderServiceDraft,ProviderServiceSnapshot,ProviderServiceStore} from '../src/provider-services';

type Env=NodeJS.ProcessEnv;
const isObject=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);

export function validateProviderService(draft:ProviderServiceDraft):ProviderService{
  if(!isObject(draft))throw new Error('服务配置格式无效');
  const id=draft.id??`service-${randomUUID()}`;
  if(!/^[a-z0-9][a-z0-9-]{0,48}$/.test(id))throw new Error('服务 ID 格式无效');
  const name=draft.name.trim(),model=draft.model.trim();
  if(!name||name.length>60||!model||model.length>160)throw new Error('服务名称或模型格式无效');
  if(!['api-key','github-copilot','none','managed'].includes(draft.authMethod))throw new Error('认证方式无效');
  const url=new URL(draft.baseUrl);
  const local=['localhost','127.0.0.1','[::1]'].includes(url.hostname);
  if(url.username||url.password||url.search||url.hash||(url.protocol!=='https:'&&!(draft.allowLocalHttp&&local&&url.protocol==='http:')))throw new Error('服务地址必须使用 HTTPS；本地 HTTP 需要单独允许');
  if(draft.authMethod==='managed'&&(!draft.providerId||!/^[a-z0-9-]+$/.test(draft.providerId)))throw new Error('服务商无效');
  return {id,name,...(draft.providerId?{providerId:draft.providerId}:{}),baseUrl:url.toString().replace(/\/$/,''),model,authMethod:draft.authMethod,allowLocalHttp:draft.allowLocalHttp===true};
}

export function providerEndpoint(service:ProviderService){
  return service.baseUrl.endsWith('/chat/completions')?service.baseUrl:`${service.baseUrl}/chat/completions`;
}

export function defaultDataDirectory(env:Env=process.env){
  if(env.FROM_ZERO_DATA_DIR)return env.FROM_ZERO_DATA_DIR;
  const home=os.homedir();
  if(process.platform==='darwin')return path.join(home,'Library','Application Support','From Zero to GPT');
  if(process.platform==='win32')return path.join(env.APPDATA||path.join(home,'AppData','Roaming'),'From Zero to GPT');
  return path.join(env.XDG_DATA_HOME||path.join(home,'.local','share'),'from-zero-to-gpt');
}

async function readJson(pathname:string){
  try{return JSON.parse(await readFile(pathname,'utf8')) as unknown;}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return undefined;throw error;}
}

export class NodeProviderServiceStore implements ProviderServiceStore{
  private services?:ProviderService[];
  private credentials?:Record<string,string>;
  private activeId?:string|null;
  private queue=Promise.resolve();
  private engine=new ProviderEngine();
  private completedLogins=new Map<string,ProviderServiceSnapshot>();
  private engineQueue=Promise.resolve();
  private readonly configPath:string;
  private readonly credentialsPath:string;
  constructor(private readonly env:Env=process.env,root=defaultDataDirectory(env)){
    this.configPath=path.join(root,'services.json');
    this.credentialsPath=path.join(root,'credentials.json');
  }
  private defaultService():ProviderService{
    return validateProviderService({id:'opencode-go',name:this.env.TUTOR_PROVIDER||'OpenCode Go',baseUrl:this.env.TUTOR_BASE_URL||'https://opencode.ai/inference/go/openai/v1',model:this.env.TUTOR_MODEL||'deepseek-v4.1-flash',authMethod:'api-key',allowLocalHttp:this.env.TUTOR_ALLOW_LOCAL_HTTP==='1'});
  }
  private async load(){
    if(this.services&&this.credentials&&this.activeId!==undefined)return;
    const [rawServices,rawCredentials,rawActive]=await Promise.all([readJson(this.configPath),readJson(this.credentialsPath),readJson(path.join(path.dirname(this.configPath),'active-service.json'))]);
    if(rawServices===undefined)this.services=[this.defaultService()];
    else{
      if(!Array.isArray(rawServices))throw new Error('服务配置文件格式无效');
      this.services=rawServices.map(item=>validateProviderService(item as ProviderServiceDraft));
      if(new Set(this.services.map(service=>service.id)).size!==this.services.length)throw new Error('服务 ID 重复');
    }
    if(rawCredentials===undefined)this.credentials={};
    else{
      if(!isObject(rawCredentials)||Object.values(rawCredentials).some(value=>typeof value!=='string'||value.length>16000))throw new Error('凭据存储格式无效');
      this.credentials={...rawCredentials} as Record<string,string>;
    }
    this.activeId=typeof rawActive==='string'&&this.services.some(service=>service.id===rawActive)?rawActive:this.services[0]?.id??null;
  }
  private async writeJson(pathname:string,value:unknown){
    await mkdir(path.dirname(pathname),{recursive:true});
    const temporary=`${pathname}.${process.pid}.tmp`;
    await writeFile(temporary,JSON.stringify(value),{mode:0o600});
    await rename(temporary,pathname);
    await chmod(pathname,0o600).catch(()=>{});
  }
  private mutate<T>(operation:()=>Promise<T>):Promise<T>{
    const result=this.queue.then(operation);
    this.queue=result.then(()=>undefined,()=>undefined);
    return result;
  }
  async snapshot():Promise<ProviderServiceSnapshot>{
    await this.load();
    const services=this.services!.map(service=>({...service,hasCredential:service.authMethod==='none'||Boolean(this.credentials![service.id]||(service.id==='opencode-go'&&this.env.TUTOR_API_KEY))}));
    return {services,activeId:this.activeId??null};
  }
  async save(draft:ProviderServiceDraft,secret?:string,internal=false){
    return this.mutate(async()=>{
      await this.load();
      if(draft.authMethod==='managed'&&!internal){
        const existing=this.services!.find(s=>s.id===draft.id);
        if(!existing||existing.authMethod!=='managed'||existing.providerId!==draft.providerId||secret!==undefined)throw new Error('请使用服务商登录流程。');
      }
      const service=validateProviderService(draft),services=[...this.services!],credentials={...this.credentials!};
      const index=services.findIndex(item=>item.id===service.id);
      if(index>=0)services[index]=service;else services.push(service);
      if(secret!==undefined){
        if(!secret.trim()||secret.length>16000)throw new Error('API key 为空或过长');
        if(!['api-key','managed'].includes(service.authMethod))throw new Error('此认证方式不接受 API key');
        credentials[service.id]=secret.trim();
      }
      if(!['api-key','managed'].includes(service.authMethod))delete credentials[service.id];
      if(secret!==undefined||!['api-key','managed'].includes(service.authMethod))await this.writeJson(this.credentialsPath,credentials);
      await this.writeJson(this.configPath,services);
      await this.writeJson(path.join(path.dirname(this.configPath),'active-service.json'),service.id);
      this.services=services;this.credentials=credentials;this.activeId=service.id;
      return this.snapshot();
    });
  }
  private async hostId(){
    return this.mutate(async()=>{
    const filename=path.join(path.dirname(this.configPath),'host-id.json');
    const value=await readJson(filename);
    if(typeof value==='string'&&value.startsWith('urn:uuid:'))return value;
    const id=`urn:uuid:${randomUUID()}`;await this.writeJson(filename,id);return id;
    });
  }
  async managedRequest(action:string,data:Record<string,unknown>){
    if(!['catalog','loginStart','loginPoll','loginInput','loginCancel','models'].includes(action))throw new Error('无效操作');
    if(action==='loginStart')return this.engine.request(action,{providerId:data.providerId,method:data.method,hostId:await this.hostId()});
    if(action==='loginPoll'){
      const task=async()=>{
      const id=String(data.sessionId);
      const cached=this.completedLogins.get(id);if(cached)return {sessionId:id,state:'complete',snapshot:cached};
      const result=await this.engine.request(action,{sessionId:id});
      if(result.state==='complete'){
        const found=await this.engine.request('models',{providerId:result.providerId,credential:result.credential});
        const model=found.models[0]?.id;
        if(!model)throw new Error('该账号暂无可选择的模型。');
        const snapshot=await this.save({id:result.serviceId,name:result.name,providerId:result.providerId,authMethod:'managed',baseUrl:'https://managed.invalid',model},JSON.stringify(found.credential||result.credential),true);
        this.completedLogins.set(id,snapshot);if(this.completedLogins.size>8)this.completedLogins.delete(this.completedLogins.keys().next().value!);
        await this.engine.request('loginForget',{sessionId:id});
        return {sessionId:id,providerId:result.providerId,state:'complete',snapshot};
      }
      return result;
      };
      const result=this.engineQueue.then(task);this.engineQueue=result.then(()=>undefined,()=>undefined);return result;
    }
    if(action==='models'){
      const task=async()=>{
        await this.load();const service=this.services!.find(s=>s.id===data.id);
        if(!service||service.authMethod!=='managed')throw new Error('请先连接服务。');
        const result=await this.engine.request('models',{providerId:service.providerId,credential:JSON.parse(this.credentials![service.id])});
        if(result.credential)await this.persistManagedCredential(service.id,result.credential);
        return {models:result.models,catalogOnly:result.catalogOnly};
      };
      const result=this.engineQueue.then(task);this.engineQueue=result.then(()=>undefined,()=>undefined);return result;
    }
    return this.engine.request(action,{sessionId:data.sessionId,promptId:data.promptId,value:data.value});
  }
  private persistManagedCredential(id:string,value:unknown){
    return this.mutate(async()=>{if(!this.services!.some(s=>s.id===id))return;const next={...this.credentials!,[id]:JSON.stringify(value)};await this.writeJson(this.credentialsPath,next);this.credentials=next;});
  }
  async managedChat(messages:unknown,jobId:string,signal:AbortSignal,serviceId:string){
    const task=async()=>{
      if(signal.aborted)throw new Error('已取消');
      await this.load();const service=this.services!.find(s=>s.id===serviceId),secret=this.credentials![serviceId];
      if(!service?.providerId||!secret)throw new Error('请先连接服务。');
      const active={service,secret};
      const cancel=()=>{void this.engine.request('cancel',{jobId});};signal.addEventListener('abort',cancel,{once:true});
      try{
        const result=await this.engine.request('chat',{providerId:active.service.providerId,model:active.service.model,credential:JSON.parse(active.secret),messages,jobId});
        if(result.credential)await this.persistManagedCredential(active.service.id,result.credential);
        if(result.error)throw new Error(result.error);
        return String(result.answer);
      }finally{signal.removeEventListener('abort',cancel);}
    };
    const result=this.engineQueue.then(task);this.engineQueue=result.then(()=>undefined,()=>undefined);return result;
  }
  async remove(id:string){
    return this.mutate(async()=>{
      await this.load();
      const services=this.services!.filter(service=>service.id!==id),credentials={...this.credentials!};
      delete credentials[id];
      await this.writeJson(this.credentialsPath,credentials);
      await this.writeJson(this.configPath,services);
      this.services=services;this.credentials=credentials;
      if(this.activeId===id)this.activeId=services[0]?.id??null;
      await this.writeJson(path.join(path.dirname(this.configPath),'active-service.json'),this.activeId);
      return this.snapshot();
    });
  }
  async activate(id:string){
    return this.mutate(async()=>{
      await this.load();
      if(!this.services!.some(service=>service.id===id))throw new Error('服务不存在');
      this.activeId=id;
      await this.writeJson(path.join(path.dirname(this.configPath),'active-service.json'),id);
      return this.snapshot();
    });
  }
  async active(){
    await this.load();
    const service=this.services!.find(item=>item.id===this.activeId);
    if(!service)return null;
    const secret=this.credentials![service.id]||(service.id==='opencode-go'?this.env.TUTOR_API_KEY:undefined);
    return {service:{...service},secret};
  }
}
