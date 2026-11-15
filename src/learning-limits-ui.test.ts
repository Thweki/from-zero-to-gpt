// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import {act,createElement,useState} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {deleteDB,openDB} from 'idb';
import App from './App';
import {CodeLab} from './components/CodeLab';
import {lessonById} from './data/lessons';
import {emptyProgress,initialState,readState,writeState} from './storage';
import {learningLimits} from './learning-limits';

vi.mock('./use-readable-plots',()=>({useReadablePlots:()=>{}}));
vi.mock('./components/AppUpdate',()=>({AppUpdateNotice:()=>null,AppUpdateSettings:()=>null}));
vi.mock('./components/SelectionTutor',()=>({SelectionTutor:()=>null}));
vi.mock('./components/ProviderSettings',()=>({ProviderSettings:()=>null}));
let root:Root,container:HTMLDivElement;
beforeEach(async()=>{
  await deleteDB('from-zero-to-gpt');
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
  vi.stubGlobal('matchMedia',()=>({matches:false,addEventListener:()=>{},removeEventListener:()=>{}}));
  Element.prototype.scrollIntoView=()=>{};window.scrollTo=()=>{};
  window.location.hash='/notes';
  container=document.createElement('div');document.body.append(container);root=createRoot(container);
});
afterEach(async()=>{await act(async()=>root.unmount());container.remove();vi.unstubAllGlobals();vi.restoreAllMocks();});
async function renderApp(){await act(async()=>{root.render(createElement(App));});await vi.waitFor(async()=>{await act(async()=>{await new Promise(resolve=>setTimeout(resolve,0));});expect(container.querySelector('.loading-screen')).toBeNull();});}
async function edit(target:HTMLTextAreaElement,value:string){await act(async()=>{Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value')!.set!.call(target,value);target.dispatchEvent(new Event('input',{bubbles:true}));});}
async function click(text:string){const button=[...container.querySelectorAll('button')].find(button=>button.textContent===text);expect(button).toBeTruthy();await act(async()=>button!.click());}
const textarea=(label:string)=>container.querySelector<HTMLTextAreaElement>(`textarea[aria-label="${label}"]`)!;
const full='x'.repeat(learningLimits.text);

describe('normal learning inputs',()=>{
  it('notes page and scratchpad reject oversized pastes, retain the previous value, and save reloadable boundary text',async()=>{
    await renderApp();
    const note=container.querySelector<HTMLTextAreaElement>('.note-card textarea')!;
    await edit(note,full);expect((await readState()).progress.functions?.note).toBe(full);
    await edit(note,full+'x');expect(note.value).toBe(full);expect(container.textContent).toContain('超长修改未应用');
    const scratch=textarea('当前章节随手笔记');await edit(scratch,full+'x');expect(scratch.value).toBe(full);
    await edit(scratch,'revised');expect((await readState()).progress.functions?.note).toBe('revised');
  });
  it('checkpoint fields reject oversized edits before the explicit save',async()=>{
    await renderApp();await act(async()=>container.querySelector<HTMLButtonElement>('[aria-label="保存学习断点"]')!.click());
    await edit(textarea('现在正在想什么'),full);await edit(textarea('现在正在想什么'),full+'x');
    await edit(textarea('下次回来先做哪一步'),full);await edit(textarea('下次回来先做哪一步'),full+'x');
    expect(textarea('现在正在想什么').value).toBe(full);expect(textarea('下次回来先做哪一步').value).toBe(full);
    await click('保存并结束本次学习');expect((await readState()).checkpoint).toMatchObject({question:full,next:full});
  });
  it('code paste and programmatic indentation cannot exceed the persistence limit',async()=>{
    let current='';
    function Harness(){const [code,setCode]=useState('');return createElement(CodeLab,{lesson:lessonById.functions,code,onCode:value=>{current=value;setCode(value);},onResult:()=>{}});}
    await act(async()=>root.render(createElement(Harness)));
    const editor=textarea('Python 代码编辑器');await edit(editor,full);await edit(editor,full+'x');
    expect(current).toBe(full);await click('缩进');expect(current).toBe(full);expect(container.textContent).toContain('超长修改未应用');
    const state=initialState();state.progress.functions={...emptyProgress(),code:current};await writeState(state);expect(await readState()).toEqual(state);
  });
  it('keeps oversized Python output visible without passing it to persistence',async()=>{
    const results=vi.fn();let worker:{onmessage:((event:{data:unknown})=>void)|null};
    class FakeWorker {onmessage=null;onerror=null;postMessage(){}terminate(){}constructor(){worker=this;}}
    vi.stubGlobal('Worker',FakeWorker);
    await act(async()=>root.render(createElement(CodeLab,{lesson:lessonById.functions,code:'print(1)',onCode:()=>{},onResult:results})));
    const run=container.querySelector<HTMLButtonElement>('.code-actions .primary')!;await act(async()=>run.click());
    await act(async()=>worker.onmessage!({data:{type:'result',passed:false,output:full+'x'}}));
    expect(results).not.toHaveBeenCalled();expect(container.querySelector('.code-output pre')?.textContent).toBe(full+'x');expect(container.textContent).toContain('未保存');
  });
});

describe('startup recovery and export',()=>{
  it('shows other chapters, exports the exact original record, and resumes saving only after explicit valid repair',async()=>{
    const raw=initialState();raw.progress.functions={...emptyProgress(),code:full+'x'};raw.progress.linear={...emptyProgress(),note:'other chapter remains visible'};
    const db=await openDB('from-zero-to-gpt',1,{upgrade(db){db.createObjectStore('learning');}});await db.put('learning',raw,'state');db.close();
    const blobs:Blob[]=[];vi.stubGlobal('URL',class extends URL {static createObjectURL(blob:Blob){blobs.push(blob);return 'blob:test';}static revokeObjectURL(){}});
    vi.spyOn(HTMLAnchorElement.prototype,'click').mockImplementation(()=>{});
    await renderApp();expect(container.textContent).toContain('数据恢复模式');expect([...container.querySelectorAll('.note-card textarea')].map(t=>(t as HTMLTextAreaElement).value)).toContain('other chapter remains visible');
    await click('导出原始记录');const exported=await new Promise<string>(resolve=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result as string);reader.readAsText(blobs[0]);});expect(JSON.parse(exported)).toEqual(raw);
    await click('保存修复后的数据');expect((await readState().catch(error=>error)).raw).toEqual(raw);
    const repaired=structuredClone(raw);repaired.progress.functions!.code='repaired';
    await edit(textarea('恢复学习数据 JSON'),JSON.stringify(repaired));await click('验证并恢复 JSON');
    // DOM clicks do not await async handlers: wait for IndexedDB and flush React's update.
    await vi.waitFor(async()=>{
      await act(async()=>{expect(await readState()).toEqual(repaired);});
      expect(container.textContent).not.toContain('数据恢复模式');
      expect(container.querySelector('.storage-warning')).toBeNull();
    });
    expect([...container.querySelectorAll('.note-card textarea')].map(t=>(t as HTMLTextAreaElement).value)).toContain('other chapter remains visible');
    await edit(container.querySelector<HTMLTextAreaElement>('.note-card textarea')!,'autosaving after JSON repair');
    await vi.waitFor(async()=>{await act(async()=>{expect((await readState()).progress.functions?.note).toBe('autosaving after JSON repair');});});
  });
  it('keeps an in-page repair unsaved until explicitly confirmed, then exits recovery and resumes autosaving',async()=>{
    const raw=initialState();raw.progress.functions={...emptyProgress(),note:full+'x'};
    const db=await openDB('from-zero-to-gpt',1,{upgrade(db){db.createObjectStore('learning');}});await db.put('learning',raw,'state');db.close();
    await renderApp();
    const note=container.querySelector<HTMLTextAreaElement>('.note-card textarea')!;
    await edit(note,'repaired note');
    expect((await readState().catch(error=>error)).raw).toEqual(raw);
    expect(container.textContent).toContain('数据恢复模式');
    await click('保存修复后的数据');
    await vi.waitFor(async()=>{
      await act(async()=>{expect((await readState()).progress.functions?.note).toBe('repaired note');});
      expect(container.textContent).not.toContain('数据恢复模式');
      expect(container.querySelector('.storage-warning')).toBeNull();
    });
    await edit(note,'autosaving after in-page repair');
    await vi.waitFor(async()=>{await act(async()=>{expect((await readState()).progress.functions?.note).toBe('autosaving after in-page repair');});});
  });
});
