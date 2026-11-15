// @vitest-environment jsdom
import {act,createElement,StrictMode} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import App from './App';
import {nativeTutorChat} from './provider-manager';
import {initialState} from './storage';

const transport=vi.hoisted(()=>({invoke:vi.fn(),endpoint:null as string|null}));
vi.mock('@tauri-apps/api/core',()=>({invoke:transport.invoke}));
vi.mock('./runtime',()=>({isTauriRuntime:true,tutorApiUrl:()=>transport.endpoint}));
vi.mock('./storage',async importOriginal=>({
  ...await importOriginal<typeof import('./storage')>(),
  readState:vi.fn(async()=>initialState()),
  writeState:vi.fn(async()=>{}),
}));

type Payload={sessionId:string;lessonId:string;message:string};
type Job={payload:Payload;started:boolean;cancelled:boolean;resolve:(value:{answer:string})=>void;reject:(error:Error)=>void};
// Model the native managed gate, but allow IPC replies to arrive after cancellation.
// No provider, credentials, or network calls are involved.
function fakeNative(){
  const jobs:Job[]=[],cancelled:string[]=[];
  let active:Job|undefined,gateHeld=false;
  const pump=()=>{if(!gateHeld&&!active){active=jobs.find(job=>!job.started&&!job.cancelled);if(active)active.started=true;}};
  transport.invoke.mockImplementation((command:string,args?:{payload?:Payload;sessionId?:string})=>{
    if(command==='native_tutor_status')return Promise.resolve({configured:true,provider:'fake managed',model:'fixture',authMethod:'managed'});
    if(command==='native_tutor_chat')return new Promise<{answer:string}>((resolve,reject)=>{jobs.push({payload:args!.payload!,started:false,cancelled:false,resolve,reject});pump();});
    if(command==='native_tutor_cancel'){
      cancelled.push(args!.sessionId!);
      const job=jobs.find(job=>job.payload.sessionId===args!.sessionId);
      if(job){job.cancelled=true;if(active===job)active=undefined;pump();}
      return Promise.resolve();
    }
    throw new Error(`Unexpected fake command: ${command}`);
  });
  return {jobs,cancelled,holdGate:()=>{gateHeld=true;},releaseGate:()=>{gateHeld=false;pump();},finish:(job:Job,error=false)=>{
    if(active===job)active=undefined;
    if(error)job.reject(new Error('late fake failure'));else job.resolve({answer:job.cancelled?'abandoned answer':'current answer'});
    pump();
  }};
}

let root:Root,container:HTMLDivElement,native:ReturnType<typeof fakeNative>;
function element<T extends Element>(selector:string){const result=container.querySelector<T>(selector);expect(result,selector).not.toBeNull();return result!;}
async function click(label:string){
  const button=[...container.querySelectorAll<HTMLButtonElement>('button')].find(button=>button.getAttribute('aria-label')===label||button.textContent===label);
  expect(button,label).toBeDefined();expect(button!.disabled).toBe(false);
  await act(async()=>button!.click());
}
async function question(text='first question'){
  const input=element<HTMLTextAreaElement>('textarea[aria-label="向 AI 导师提问"]');
  await act(async()=>{
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value')!.set!.call(input,text);
    input.dispatchEvent(new Event('input',{bubbles:true}));
  });
  await click('发送');
}
async function route(hash:string){await act(async()=>{history.replaceState(null,'',hash);window.dispatchEvent(new HashChangeEvent('hashchange'));});}
async function mount(compact=false){
  history.replaceState(null,'',compact?'#/map':'#/tutor');
  await act(async()=>root.render(createElement(StrictMode,null,createElement(App))));
  if(compact)await click('问导师');
}

beforeEach(()=>{
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
  vi.stubGlobal('matchMedia',()=>({matches:false,addEventListener:vi.fn(),removeEventListener:vi.fn()}));
  vi.stubGlobal('ResizeObserver',class {observe(){}unobserve(){}disconnect(){}});
  Element.prototype.scrollIntoView=vi.fn();
  vi.spyOn(window,'scrollTo').mockImplementation(()=>{});
  transport.endpoint=null;transport.invoke.mockReset();native=fakeNative();
  vi.stubGlobal('fetch',vi.fn(()=>{throw new Error('Unexpected network request');}));
  container=document.createElement('div');document.body.append(container);root=createRoot(container);
});
afterEach(async()=>{await act(async()=>root.unmount());container.remove();vi.restoreAllMocks();vi.unstubAllGlobals();});

describe('native tutor cancellation through the shared panel lifecycle',()=>{
  it.each([false,true])('Stop releases the next request and ignores late settlement (failure=%s)',async failure=>{
    await mount();await question();const first=native.jobs[0];expect(first.started).toBe(true);
    await click('停止');expect(native.cancelled).toEqual([first.payload.sessionId]);
    expect(container.textContent).toContain('已停止回复');
    expect(element('.tutor-message.user').textContent).toContain('first question');
    await click('重试上次问题');const second=native.jobs[1];
    expect(second.started).toBe(true);expect(second.payload.sessionId).not.toBe(first.payload.sessionId);
    await act(async()=>native.finish(first,failure));
    expect(container.querySelector('.tutor-pending')).not.toBeNull();
    expect(container.querySelector('.tutor-error')).toBeNull();
    expect(container.textContent).not.toContain('abandoned answer');
    await act(async()=>native.finish(second));
    expect(element('.tutor-message.assistant').textContent).toContain('current answer');
    await act(async()=>root.unmount());
    expect(native.cancelled).toEqual([first.payload.sessionId]);
  });

  it.each(['chapter switch','compact close','page navigation'] as const)('%s cancels once and lets the next managed request start',async action=>{
    await mount(action==='compact close');await question();const first=native.jobs[0];
    if(action==='chapter switch'){
      const picker=element<HTMLSelectElement>('select[aria-label="导师关联章节"]');
      await act(async()=>{picker.value='linear';picker.dispatchEvent(new Event('change',{bubbles:true}));});
    }else if(action==='compact close'){
      await click('关闭学习助手');await click('问导师');
    }else{await route('#/notes');await route('#/tutor');}
    expect(native.cancelled).toEqual([first.payload.sessionId]);
    await question('next question');const second=native.jobs[1];expect(second.started).toBe(true);
    if(action==='chapter switch')expect(second.payload.lessonId).toBe('linear');
    await act(async()=>native.finish(first));
    expect(container.textContent).not.toContain('abandoned answer');
    expect(container.querySelector('.tutor-pending')).not.toBeNull();
    await act(async()=>native.finish(second));
    expect(element('.tutor-message.assistant').textContent).toContain('current answer');
    await act(async()=>root.unmount());
    expect(native.cancelled).toEqual([first.payload.sessionId]);
  });

  it('closing a queued compact request prevents it from taking the managed gate later',async()=>{
    native.holdGate();await mount(true);await question();const first=native.jobs[0];expect(first.started).toBe(false);
    await click('关闭学习助手');await click('问导师');await question('next question');
    expect(native.cancelled).toEqual([first.payload.sessionId]);
    native.releaseGate();expect(first.started).toBe(false);expect(native.jobs[1].started).toBe(true);
    await act(async()=>{native.finish(first,true);native.finish(native.jobs[1]);});
    expect(element('.tutor-message.assistant').textContent).toContain('current answer');
    expect(container.querySelector('.tutor-error')).toBeNull();
  });

  it('HTTP override uses fetch cancellation without sending a native cancel command',async()=>{
    transport.endpoint='https://fixture.invalid/chat';let signal:AbortSignal|undefined;
    vi.mocked(fetch).mockImplementation((_url,init)=>new Promise<Response>((_resolve,reject)=>{
      signal=init?.signal as AbortSignal;signal.addEventListener('abort',()=>reject(new DOMException('Stopped','AbortError')),{once:true});
    }));
    await mount(true);await question();await click('关闭学习助手');
    expect(signal?.aborted).toBe(true);expect(native.jobs).toHaveLength(0);expect(native.cancelled).toEqual([]);
  });

  it('an abort before IPC dispatch never starts native work',async()=>{
    const controller=new AbortController();
    const result=nativeTutorChat({sessionId:'fake-before-dispatch'},controller.signal);
    controller.abort();await expect(result).rejects.toMatchObject({name:'AbortError'});
    expect(native.jobs).toHaveLength(0);expect(native.cancelled).toEqual([]);
  });

  it('Stop followed by compact close sends cancellation only once, even with a late rejection',async()=>{
    await mount(true);await question();const first=native.jobs[0];
    await click('停止');await click('关闭学习助手');await click('问导师');
    expect(native.cancelled).toEqual([first.payload.sessionId]);
    await question('next question');expect(native.jobs[1].started).toBe(true);
    await act(async()=>native.finish(first,true));
    expect(container.querySelector('.tutor-pending')).not.toBeNull();
    expect(container.querySelector('.tutor-error')).toBeNull();
    await act(async()=>native.finish(native.jobs[1]));
    expect(element('.tutor-message.assistant').textContent).toContain('current answer');
  });

  it.each([false,true])('settled IPC removes the abort listener (failure=%s)',async failure=>{
    const controller=new AbortController();
    const result=nativeTutorChat({sessionId:'fake-completed-request'},controller.signal);
    const settled=failure?expect(result).rejects.toThrow('late fake failure'):expect(result).resolves.toEqual({answer:'current answer'});
    await act(async()=>{});
    await act(async()=>native.finish(native.jobs[0],failure));await settled;
    controller.abort();expect(native.cancelled).toEqual([]);
  });
});
