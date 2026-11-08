import {afterEach,describe,expect,it,vi} from 'vitest';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {ProviderEngine} from '../server/provider-engine';
import {NodeProviderServiceStore} from '../server/service-store';
import {builtinModels} from '@earendil-works/pi-ai/providers/all';
const roots:string[]=[];
afterEach(async()=>{vi.restoreAllMocks();vi.unstubAllGlobals();await Promise.all(roots.splice(0).map(root=>rm(root,{recursive:true,force:true})));});
const tick=()=>new Promise(resolve=>setTimeout(resolve,0));

describe('service-owned connection flows',()=>{
 it('cancellation arriving immediately after dispatch stops the registered inference job',async()=>{
  const fetch=vi.fn(async()=>{throw new Error('Unexpected network access');});vi.stubGlobal('fetch',fetch);
  const engine=new ProviderEngine(),credential={type:'api_key',key:'test-cancel-key'};
  const pending=engine.request('chat',{providerId:'deepseek',model:builtinModels().getModels('deepseek')[0].id,credential,messages:[{role:'user',content:'hello'}],jobId:'cancel-now'});
  await engine.request('cancel',{jobId:'cancel-now'});
  expect(await pending).toMatchObject({credential,error:expect.any(String)});expect(fetch).not.toHaveBeenCalled();
 });
 it('persists a rotated OAuth refresh token even when the subsequent model request is rejected',async()=>{
  const root=await mkdtemp(path.join(os.tmpdir(),'gpt-refresh-'));roots.push(root);
  const fetch=vi.fn(async(url:string|URL|Request)=>String(url).includes('/oauth/token')?Response.json({access_token:'test-new-access',refresh_token:'test-rotated-refresh',expires_in:3600}):Response.json({error:{type:'permission_error',message:'denied'}},{status:403}));vi.stubGlobal('fetch',fetch);
  const store=new NodeProviderServiceStore({},root),service={name:'Claude',providerId:'anthropic',authMethod:'managed' as const,baseUrl:'https://managed.invalid',model:builtinModels().getModels('anthropic')[0].id};
  const snapshot=await store.save(service,JSON.stringify({type:'oauth',access:'test-old-access',refresh:'test-old-refresh',expires:1}),true);
  await expect(store.managedChat([{role:'user',content:'hello'}],'refresh-test',new AbortController().signal,snapshot.activeId!)).rejects.toThrow();
  expect(JSON.parse((await store.active())!.secret!)).toMatchObject({refresh:'test-rotated-refresh',access:'test-new-access'});
  expect(JSON.stringify(await store.snapshot())).not.toContain('test-rotated-refresh');
 });
 it('uses the provider endpoint and protocol to send a real SDK request and consume streamed text',async()=>{
  const stream=[{id:'test',object:'chat.completion.chunk',choices:[{index:0,delta:{role:'assistant',content:'自动选择接口成功'},finish_reason:null}]},{id:'test',object:'chat.completion.chunk',choices:[{index:0,delta:{},finish_reason:'stop'}]}].map(chunk=>`data: ${JSON.stringify(chunk)}\n\n`).join('')+'data: [DONE]\n\n';
  const fetch=vi.fn(async()=>new Response(stream,{headers:{'content-type':'text/event-stream'}}));vi.stubGlobal('fetch',fetch);
  const engine=new ProviderEngine();const {models}=await engine.request('models',{providerId:'deepseek'});
  const credential={type:'api_key',key:'test-private-key'};
  const result=await engine.request('chat',{providerId:'deepseek',credential,model:models[0].id,messages:[{role:'system',content:'Explain clearly'},{role:'user',content:'你好'}],jobId:'test-chat'});
  expect(result.answer).toBe('自动选择接口成功');expect(result.credential).toEqual(credential);
  const [url,options]=fetch.mock.calls[0] as unknown as [string,RequestInit];
  expect(String(url)).toBe('https://api.deepseek.com/chat/completions');
  expect(new Headers(options.headers).get('authorization')).toBe('Bearer test-private-key');
  expect(JSON.parse(String(options.body))).toMatchObject({model:models[0].id,stream:true});
 });
 it('catalog exposes actual auth methods and provider protocols without requiring a URL',async()=>{
  const {providers}=await new ProviderEngine().request('catalog');
  for(const id of ['openai','anthropic','google','github-copilot','deepseek','openrouter','opencode-go'])expect(providers.find((p:any)=>p.id===id)).toBeDefined();
  for(const id of ['openai','anthropic','github-copilot','openrouter'])expect(providers.find((p:any)=>p.id===id).methods.some((m:any)=>m.id==='oauth')).toBe(true);
  expect(providers.find((p:any)=>p.id==='google').methods.some((m:any)=>m.id==='oauth')).toBe(false);
 });
 it('API key flow saves privately, selects models, survives restart, and never exposes credentials',async()=>{
  const root=await mkdtemp(path.join(os.tmpdir(),'gpt-provider-'));roots.push(root);
  const store=new NodeProviderServiceStore({},root);
  const start=await store.managedRequest('loginStart',{providerId:'deepseek',method:'api_key'}) as any;
  await tick();const prompt=await store.managedRequest('loginPoll',start) as any;
  expect(prompt.prompt.type).toBe('secret');
  await expect(store.managedRequest('loginInput',{...start,promptId:'stale',value:'wrong'})).rejects.toThrow();
  await store.managedRequest('loginInput',{...start,promptId:prompt.prompt.id,value:'test-private-key'});await tick();
  const done=await store.managedRequest('loginPoll',start) as any;
  expect(done.state).toBe('complete');expect(JSON.stringify(done)).not.toContain('test-private-key');expect(done).not.toHaveProperty('credential');
  const service=done.snapshot.services.find((s:any)=>s.id===done.snapshot.activeId);
  expect(service.providerId).toBe('deepseek');expect(service.authMethod).toBe('managed');expect(service.hasCredential).toBe(true);
  expect(await readFile(path.join(root,'services.json'),'utf8')).not.toContain('test-private-key');
  const restored=new NodeProviderServiceStore({},root);expect((await restored.snapshot()).activeId).toBe(service.id);
  const models=await restored.managedRequest('models',{id:service.id}) as any;expect(models.models.length).toBeGreaterThan(0);expect(models).not.toHaveProperty('credential');
  await restored.save({...service,name:'改名'});expect(JSON.parse((await restored.active())!.secret!).key).toBe('test-private-key');
  await expect(restored.save({...service,providerId:'openai'})).rejects.toThrow();
  await expect(restored.save(service,'replacement')).rejects.toThrow();
  expect((await store.managedRequest('loginPoll',start) as any).snapshot.activeId).toBe(service.id);
  await restored.remove(service.id);expect(await readFile(path.join(root,'credentials.json'),'utf8')).not.toContain('test-private-key');
 });
 it('cancelled login cannot accept input or produce a stored service',async()=>{
  const engine=new ProviderEngine();const start=await engine.request('loginStart',{providerId:'deepseek',method:'api_key'});await tick();
  await engine.request('loginCancel',start);await expect(engine.request('loginPoll',start)).rejects.toThrow('过期');
 });
});
