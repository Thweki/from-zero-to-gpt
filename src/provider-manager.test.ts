// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import {act,createElement} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {handleTutorRequest,type TutorEnvironment} from '../server/tutor';
import {NodeProviderServiceStore} from '../server/service-store';
import {ProviderSettings} from './components/ProviderSettings';
import {activateProviderService,providerEngineRequest,providerServicesSnapshot,removeProviderService,saveProviderService} from './provider-manager';
import {initialState,readState,writeState} from './storage';

const accessCode='test-only-management-code';
const apiKey='test-only-provider-key';
const draft={name:'Test service',baseUrl:'https://models.example/v1',model:'test-model',authMethod:'api-key' as const};
let directory:string,store:NodeProviderServiceStore,root:Root|undefined,container:HTMLDivElement;
let env:TutorEnvironment;
const traffic:{url:string;authorization:string|null;body:string;status:number;response:string}[]=[];
const pending=new Set<Promise<Response>>();
const upstream=vi.fn(async()=>{throw new Error('Unexpected upstream request');});
async function drain(){while(pending.size)await Promise.all(pending);}
async function settle(){await act(async()=>{await drain();});await act(async()=>{await drain();});}
async function mount(){container=document.createElement('div');document.body.append(container);root=createRoot(container);await act(async()=>{root!.render(createElement(ProviderSettings));});await settle();}
function button(label:string){const found=[...container.querySelectorAll('button')].find(b=>b.textContent?.trim()===label||b.getAttribute('aria-label')===label);expect(found).toBeDefined();return found!;}
async function click(label:string){await act(async()=>{button(label).click();});await settle();}
async function fill(label:string,value:string){
 const input=container.querySelector<HTMLInputElement|HTMLSelectElement>(`[aria-label="${label}"]`)!;
 expect(input).not.toBeNull();
 await act(async()=>{Object.getOwnPropertyDescriptor(input instanceof HTMLSelectElement?HTMLSelectElement.prototype:HTMLInputElement.prototype,'value')!.set!.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));});
}

beforeEach(async()=>{
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
 directory=await mkdtemp(path.join(os.tmpdir(),'gpt-management-client-'));
 store=new NodeProviderServiceStore({},directory);
 env={TUTOR_ACCESS_TOKEN:accessCode,TUTOR_PUBLIC_ORIGIN:'https://learning.example'};
 traffic.length=0;upstream.mockClear();localStorage.clear();sessionStorage.clear();
 // Run the real settings transport against the real Node route and store.
 vi.stubGlobal('fetch',(input:string|URL|Request,init?:RequestInit)=>{
  const request=new Request(new URL(String(input),'https://learning.example'),init);
  const operation=(async()=>{
   const body=await request.clone().text();
   const response=await handleTutorRequest(request,env,upstream,store);
   traffic.push({url:request.url,authorization:request.headers.get('Authorization'),body,status:response.status,response:await response.clone().text()});
   return response;
  })();
  pending.add(operation);void operation.finally(()=>pending.delete(operation));return operation;
 });
});
afterEach(async()=>{
 if(root){await act(async()=>{root!.unmount();});root=undefined;}
 await drain();container?.remove();vi.restoreAllMocks();vi.unstubAllGlobals();
 await rm(directory,{recursive:true,force:true});
});

describe('settings client management authorization',()=>{
 it('authenticates every CRUD route and engine request, without retaining authorization between calls',async()=>{
  const operations=[
   (code:string)=>providerServicesSnapshot(code),
   (code:string)=>saveProviderService(draft,apiKey,code),
   (code:string)=>activateProviderService('opencode-go',code),
   (code:string)=>removeProviderService('missing',code),
   (code:string)=>providerEngineRequest('catalog',{},code),
  ];
  for(const operation of operations){
   await expect(operation('')).rejects.toThrow('访问码');
   await expect(operation('test-only-wrong-code')).rejects.toThrow('访问码');
   await operation(accessCode);
  }
  const saved=await saveProviderService(draft,apiKey,accessCode);
  expect((await activateProviderService(saved.activeId!,accessCode)).activeId).toBe(saved.activeId);
  expect((await removeProviderService(saved.activeId!,accessCode)).services.some(s=>s.id===saved.activeId)).toBe(false);
  await expect(providerServicesSnapshot()).rejects.toThrow('访问码');
  expect(traffic.at(-1)?.authorization).toBeNull();
  for(const request of traffic){expect(request.url).not.toContain(accessCode);expect(request.body).not.toContain(accessCode);expect(request.response).not.toContain(accessCode);expect(request.response).not.toContain(apiKey);}
  for(const file of ['services.json','credentials.json','active-service.json'])expect(await readFile(path.join(directory,file),'utf8')).not.toContain(accessCode);
  expect(upstream).not.toHaveBeenCalled();
 });

 it('retries initial authorization in the mounted settings UI and passes it through login, model selection, save and cancellation',async()=>{
  const learning=initialState();await writeState(learning);
  const storageWrite=vi.spyOn(Storage.prototype,'setItem');
  await mount();
  expect(container.querySelector('[role="alert"]')?.textContent).toContain('访问码');
  const codeInput=container.querySelector<HTMLInputElement>('[aria-label="服务管理访问码"]')!;
  expect(codeInput.type).toBe('password');expect(codeInput.autocomplete).toBe('off');
  await fill('服务管理访问码','test-only-wrong-code');await click('授权并重试');
  expect(container.querySelector('[role="alert"]')?.textContent).toContain('访问码');
  await fill('服务管理访问码',accessCode);await click('授权并重试');
  expect(container.querySelector('[aria-label="已保存的模型服务"]')).not.toBeNull();
  expect(container.querySelector('[role="alert"]')).toBeNull();
  await fill('服务商','deepseek');await click('使用 API Key');
  await fill('API Key',apiKey);await click('继续');
  await act(async()=>{await new Promise(resolve=>setTimeout(resolve,1100));await drain();});await settle();
  expect(container.querySelector('[aria-label="已连接服务设置"]')).not.toBeNull();
  await click('刷新模型');await click('保存并使用此模型');
  expect(container.textContent).toContain('服务配置已保存。');
  await click('新增服务');await fill('服务商','deepseek');await click('使用 API Key');await click('取消连接');
  const actions=traffic.filter(t=>t.url.endsWith('/engine')&&t.status===200).map(t=>JSON.parse(t.body).action);
  for(const action of ['catalog','loginStart','loginPoll','loginInput','loginCancel','models'])expect(actions).toContain(action);
  for(const request of traffic.filter(t=>t.url.endsWith('/engine')))expect(request.authorization).toBe(`Bearer ${accessCode}`);
  const authorized=traffic.filter(t=>t.url.includes('/services')&&t.status===200);
  expect(authorized.length).toBeGreaterThan(6);
  for(const request of authorized){expect(request.authorization).toBe(`Bearer ${accessCode}`);expect(request.body).not.toContain(accessCode);expect(request.response).not.toContain(accessCode);expect(request.response).not.toContain(apiKey);}
  expect(container.textContent).not.toContain(accessCode);expect(container.textContent).not.toContain(apiKey);
  expect(await readState()).toEqual(learning);expect(JSON.stringify(await readState())).not.toContain(accessCode);
  expect(storageWrite).not.toHaveBeenCalled();expect(localStorage.length).toBe(0);expect(sessionStorage.length).toBe(0);
  await act(async()=>{root!.unmount();});root=undefined;container.remove();await drain();
  await mount();
  expect(container.querySelector<HTMLInputElement>('[aria-label="服务管理访问码"]')!.value).toBe('');
  expect(container.querySelector('[role="alert"]')?.textContent).toContain('访问码');
  expect(traffic.filter(t=>t.url.endsWith('/services')).at(-1)?.authorization).toBeNull();
  expect(upstream).not.toHaveBeenCalled();
 });

 it('rechecks the settings load after a transient failure and keeps unprotected local management working',async()=>{
  env={};
  const fetcher=fetch;
  let failed=false;
  vi.stubGlobal('fetch',(input:string|URL|Request,init?:RequestInit)=>{
   if(String(input).endsWith('/services')&&!failed){failed=true;return Promise.reject(new Error('Temporary failure'));}
   return fetcher(input,init);
  });
  await mount();expect(container.querySelector('[role="alert"]')?.textContent).toContain('Temporary failure');
  await click('重新检查');expect(container.querySelector('[aria-label="已保存的模型服务"]')).not.toBeNull();
  expect(container.querySelector('[role="alert"]')).toBeNull();
  expect(traffic.every(t=>t.authorization===null)).toBe(true);
 });
});
