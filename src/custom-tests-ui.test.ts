// @vitest-environment jsdom
import {act,createElement,useState} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {LessonReader} from './components/LessonReader';
import {lessonById} from './data/lessons';
import {emptyProgress} from './storage';
import type {LessonProgress} from './types';

class TestWorker {
  static latest:TestWorker;
  onmessage:((event:{data:Record<string,unknown>})=>void)|null=null;
  onerror:(()=>void)|null=null;
  postMessage=vi.fn();
  terminate=vi.fn();
  constructor(){TestWorker.latest=this;}
}
let root:Root,container:HTMLDivElement,saved:LessonProgress;
const lesson=lessonById.functions;
beforeEach(async()=>{
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
  vi.stubGlobal('Worker',TestWorker);
  vi.stubGlobal('ResizeObserver',class {observe(){} disconnect(){}});
  container=document.createElement('div');document.body.append(container);root=createRoot(container);
  function Harness(){
    const [progress,setProgress]=useState<LessonProgress>({...emptyProgress(),mode:'code',code:lesson.reference,customTests:'assert square(-3) == 9',note:'keep my notes',review:true});
    saved=progress;
    return createElement(LessonReader,{lesson,progress,stage:1,patch:patch=>setProgress(previous=>({...previous,...patch})),navigate:()=>{},onCheckpoint:()=>{},onObserve:()=>{}});
  }
  await act(async()=>root.render(createElement(Harness)));
});
afterEach(async()=>{
  await act(async()=>root.unmount());container.remove();vi.unstubAllGlobals();
});
async function click(text:string){
  const button=[...container.querySelectorAll('button')].find(candidate=>candidate.textContent?.includes(text));
  expect(button).toBeDefined();await act(async()=>button!.click());
}
async function changeTests(value:string){
  const input=container.querySelector<HTMLTextAreaElement>('#custom-tests-editor')!;
  await act(async()=>{
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value')!.set!.call(input,value);
    input.dispatchEvent(new Event('input',{bubbles:true}));
  });
}
async function finish(){
  await act(async()=>TestWorker.latest.onmessage!({data:{type:'done',passed:true,customTestsPassed:true,output:'ok'}}));
}

describe('personal-test controls and learning evidence',()=>{
  it('sends the saved assertions, records success, then invalidates it on an edit',async()=>{
    await click('运行并测试');
    expect(TestWorker.latest.postMessage).toHaveBeenCalledWith({code:lesson.reference,tests:lesson.pythonTests,customTests:'assert square(-3) == 9'});
    await finish();
    expect(saved.codePassed).toBe(true);
    expect(container.querySelector('.code-output')?.textContent).toContain('个人测试也已通过');
    await changeTests('assert square(0) == 0');
    expect(saved).toMatchObject({customTests:'assert square(0) == 0',codePassed:false});
  });
  it('does not certify edited assertions with an in-flight result for older assertions',async()=>{
    await click('运行并测试');
    await changeTests('assert False');
    await finish();
    expect(saved).toMatchObject({customTests:'assert False',codePassed:false});
    expect(saved.lastRun).toContain('个人测试也已通过');
    expect(container.textContent).toContain('请重新运行');
  });
  it('reset stops execution and preserves personal tests and unrelated chapter data',async()=>{
    await click('运行并测试');const worker=TestWorker.latest;
    await act(async()=>container.querySelector<HTMLButtonElement>('[aria-label="重置代码"]')!.click());
    expect(worker.terminate).toHaveBeenCalled();
    expect(saved).toMatchObject({code:lesson.starter,customTests:'assert square(-3) == 9',lastRun:'',codePassed:false,note:'keep my notes',review:true});
    const input=container.querySelector<HTMLTextAreaElement>('#custom-tests-editor')!;
    expect(input.maxLength).toBe(10000);
    expect(input.value).toBe('assert square(-3) == 9');
  });
});
