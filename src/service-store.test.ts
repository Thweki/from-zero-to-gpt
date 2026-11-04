import {mkdtemp,readFile,rm,stat} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {afterEach,describe,expect,it,vi} from 'vitest';
import {handleTutorRequest} from '../server/tutor';
import {NodeProviderServiceStore,defaultDataDirectory,providerEndpoint,validateProviderService} from '../server/service-store';

const roots:string[]=[];
afterEach(async()=>{await Promise.all(roots.splice(0).map(root=>rm(root,{recursive:true,force:true})));});
async function createStore(env:NodeJS.ProcessEnv={}){
  const root=await mkdtemp(path.join(os.tmpdir(),'fz-gpt-services-'));roots.push(root);
  return {store:new NodeProviderServiceStore(env,root),root};
}
const draft={name:'测试服务',baseUrl:'https://models.example/v1',model:'test-model',authMethod:'api-key' as const};

describe('多服务本地配置与凭据隔离',()=>{
  it('配置和密钥分别原子保存，状态与列表不泄露密钥',async()=>{
    const {store,root}=await createStore();
    const saved=await store.save(draft,'test-secret-value');
    expect(saved.activeId).toBe(saved.services[1].id);
    expect(JSON.stringify(saved)).not.toContain('test-secret-value');
    expect(await readFile(path.join(root,'services.json'),'utf8')).not.toContain('test-secret-value');
    expect(JSON.parse(await readFile(path.join(root,'credentials.json'),'utf8'))).toEqual({[saved.activeId!]:'test-secret-value'});
    expect((await stat(path.join(root,'credentials.json'))).mode&0o777).toBe(0o600);
    expect(path.resolve(root).startsWith(path.resolve(process.cwd()))).toBe(false);
    expect((await store.active())?.secret).toBe('test-secret-value');
    const restored=new NodeProviderServiceStore({},root);
    expect((await restored.snapshot()).activeId).toBe(saved.activeId);
  });
  it('编辑服务不覆盖现有密钥，切换与删除更新当前服务',async()=>{
    const {store}=await createStore();
    const first=await store.save(draft,'key-one');
    const second=await store.save({...draft,name:'第二服务',model:'other-model'},'key-two');
    const id=second.activeId!;
    await store.save({...draft,id,name:'改名服务',model:'other-model'});
    expect((await store.active())?.secret).toBe('key-two');
    await store.activate(first.services[0].id);
    expect((await store.active())?.service.id).toBe(first.services[0].id);
    await store.remove(id);
    expect((await store.active())?.service.id).toBe(first.services[0].id);
    expect(JSON.stringify(await store.snapshot())).not.toContain('key-two');
  });
  it('默认环境配置保持兼容，但不把环境密钥写入磁盘',async()=>{
    const {store,root}=await createStore({TUTOR_API_KEY:'environment-secret'});
    expect((await store.snapshot()).services[0].hasCredential).toBe(true);
    expect((await store.active())?.secret).toBe('environment-secret');
    await expect(readFile(path.join(root,'credentials.json'),'utf8')).rejects.toMatchObject({code:'ENOENT'});
  });
  it('拒绝不安全地址、错误认证和空密钥',async()=>{
    const {store}=await createStore();
    for(const baseUrl of ['https://user:pass@example.com','https://example.com?key=secret','http://example.com'])expect(()=>validateProviderService({...draft,baseUrl})).toThrow();
    expect(validateProviderService({...draft,baseUrl:'http://localhost:11434/v1',allowLocalHttp:true}).baseUrl).toBe('http://localhost:11434/v1');
    expect(providerEndpoint(validateProviderService(draft))).toBe('https://models.example/v1/chat/completions');
    await expect(store.save(draft,'')).rejects.toThrow('API key');
    await expect(store.save({...draft,authMethod:'github-copilot'},'not-an-oauth-token')).rejects.toThrow('不接受 API key');
  });
  it('真实协议使用当前服务且不泄露密钥，无存储部署保持只读',async()=>{
    const {store}=await createStore();
    const saved=await store.save(draft,'protocol-secret');
    const fetcher=vi.fn(async()=>new Response(JSON.stringify({choices:[{message:{content:'模拟回答'}}]})));
    const list=await handleTutorRequest(new Request('https://learning.example/api/tutor/services'),{},fetcher,store);
    expect(JSON.stringify(await list.json())).not.toContain('protocol-secret');
    const status=await handleTutorRequest(new Request('https://learning.example/api/tutor/status'),{},fetcher,store);
    expect(await status.json()).toMatchObject({configured:true,provider:'测试服务',model:'test-model',serviceId:saved.activeId,authMethod:'api-key'});
    const body={lessonId:'functions',message:'测试问题',history:[],mode:'hint',difficulty:'standard',sessionId:'service-store-test'};
    const response=await handleTutorRequest(new Request('https://learning.example/api/tutor/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),{},fetcher,store);
    expect(response.status).toBe(200);
    const [endpoint,init]=fetcher.mock.calls[0] as unknown as [string,RequestInit];
    expect(endpoint).toBe('https://models.example/v1/chat/completions');
    expect((init.headers as Record<string,string>).Authorization).toBe('Bearer protocol-secret');
    expect(JSON.parse(init.body as string).model).toBe('test-model');
    expect((await handleTutorRequest(new Request('https://learning.example/api/tutor/services'),{},fetcher)).status).toBe(403);
  });
  it('默认数据目录位于用户目录而非仓库',()=>{
    expect(defaultDataDirectory({})).not.toContain(process.cwd());
  });
  it('服务管理遵守部署访问码，公网无访问码时保持禁止',async()=>{
    const {store}=await createStore();
    for(const route of ['services','services/save','services/activate','services/remove']){
      const request=new Request(`https://learning.example/api/tutor/${route}`,{method:route==='services'?'GET':'POST'});
      expect((await handleTutorRequest(request,{TUTOR_ACCESS_TOKEN:'deployment-token'},fetch,store)).status).toBe(401);
      expect((await handleTutorRequest(request,{TUTOR_PUBLIC_ORIGIN:'https://learning.example'},fetch,store)).status).toBe(403);
    }
    const authorized=new Request('https://learning.example/api/tutor/services',{headers:{Authorization:'Bearer deployment-token'}});
    expect((await handleTutorRequest(authorized,{TUTOR_ACCESS_TOKEN:'deployment-token'},fetch,store)).status).toBe(200);
  });
  it('新服务不会回退到其他提供商的环境密钥，无认证服务不发送密钥',async()=>{
    const env={TUTOR_API_KEY:'environment-secret'};
    const {store}=await createStore(env);
    const fetcher=vi.fn(async()=>new Response(JSON.stringify({choices:[{message:{content:'模拟回答'}}]})));
    const request=()=>new Request('https://learning.example/api/tutor/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({lessonId:'functions',message:'测试问题',history:[],mode:'hint',difficulty:'standard',sessionId:'credential-isolation'})});
    await store.save(draft);
    expect((await handleTutorRequest(request(),env,fetcher,store)).status).toBe(503);
    expect(fetcher).not.toHaveBeenCalled();
    await store.save({...draft,authMethod:'none'});
    expect((await handleTutorRequest(request(),env,fetcher,store)).status).toBe(200);
    const [,init]=fetcher.mock.calls[0] as unknown as [string,RequestInit];
    expect(init.headers).not.toHaveProperty('Authorization');
  });
});
