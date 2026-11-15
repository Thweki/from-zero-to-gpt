// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import {serialize,deserialize} from 'node:v8';
import {act,createElement} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import App from './App';
import {emptyProgress,initialState,readState,writeState} from './storage';

vi.mock('./components/LessonLab',()=>({LessonLab:()=>null}));
vi.mock('./components/TutorPanel',()=>({TutorPanel:()=>null}));
vi.mock('./components/CodeLab',()=>({CodeLab:()=>null}));
vi.mock('./components/ProviderSettings',()=>({ProviderSettings:()=>null}));
vi.mock('./components/AppUpdate',()=>({AppUpdateNotice:()=>null,AppUpdateSettings:()=>null}));

let root:Root,container:HTMLDivElement;
const settle=()=>act(async()=>{await new Promise(resolve=>setTimeout(resolve,30));});
const button=(label:string)=>{
  const result=[...document.querySelectorAll<HTMLButtonElement>('button')].find(item=>item.getAttribute('aria-label')===label||item.textContent===label);
  expect(result,`button ${label}`).toBeTruthy();return result!;
};
const click=async(label:string)=>{await act(async()=>button(label).click());await settle();};
const go=async(hash:string)=>{
  await act(async()=>{history.replaceState(null,'',hash);window.dispatchEvent(new HashChangeEvent('hashchange'));});await settle();
};
async function selectQuote() {
  await act(async()=>{
    const paragraph=container.querySelector('.prose-section p')!;
    const range=document.createRange();range.selectNodeContents(paragraph);
    window.getSelection()!.removeAllRanges();window.getSelection()!.addRange(range);
    paragraph.dispatchEvent(new MouseEvent('pointerup',{bubbles:true,clientX:100,clientY:100}));
  });
}
async function edit(selector:string,value:string) {
  const editor=container.querySelector<HTMLTextAreaElement>(selector)!;expect(editor).toBeTruthy();
  await act(async()=>{
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value')!.set!.call(editor,value);
    editor.dispatchEvent(new Event('input',{bubbles:true}));
  });await settle();
}
beforeEach(async()=>{
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
  vi.stubGlobal('structuredClone',(value:unknown)=>deserialize(serialize(value)));
  vi.stubGlobal('matchMedia',()=>({matches:false,addEventListener:vi.fn(),removeEventListener:vi.fn()}));
  vi.stubGlobal('ResizeObserver',class {observe(){} unobserve(){} disconnect(){}});
  vi.spyOn(window,'scrollTo').mockImplementation(()=>{});
  Object.defineProperty(Range.prototype,'getBoundingClientRect',{configurable:true,value:()=>({left:0,right:100,top:0,bottom:20})});
  const state=initialState();state.progress.functions={...emptyProgress(),note:'keep note',code:'print(42)',lastRun:'keep result',observationDraft:'keep observation',tutorDraft:'keep question'};
  await writeState(state);
  history.replaceState(null,'','#/lesson/functions');
  container=document.createElement('div');document.body.append(container);root=createRoot(container);
  await act(async()=>root.render(createElement(App)));await settle();
});
afterEach(async()=>{
  await act(async()=>root?.unmount());container?.remove();window.getSelection()?.removeAllRanges();
  vi.restoreAllMocks();vi.unstubAllGlobals();
});

describe('quoted passage annotation workflow',()=>{
  it('creates, edits and deletes local comments without changing existing work, then reloads them',async()=>{
    const original=container.querySelector('.prose-section')!.textContent;
    await selectQuote();await click('为选中文字记批注');
    const selector='.context-panel .annotation-card textarea';
    expect(document.activeElement).toBe(container.querySelector(selector));
    await edit(selector,'my understanding');
    expect(container.querySelector('.prose-section')!.textContent).toBe(original);
    expect((await readState()).progress.functions).toMatchObject({note:'keep note',code:'print(42)',lastRun:'keep result',observationDraft:'keep observation',tutorDraft:'keep question',annotations:[{text:'my understanding',mode:'intuition'}]});
    await go('#/lesson/linear');await selectQuote();await click('为选中文字记批注');await edit(selector,'another chapter');
    await go('#/notes');
    const notes='.note-card:first-child .annotation-card textarea';
    expect(container.querySelector<HTMLTextAreaElement>(notes)!.value).toBe('my understanding');
    await edit(notes,'edited understanding');
    await act(async()=>root.unmount());root=createRoot(container);
    await act(async()=>root.render(createElement(App)));await settle();
    expect(container.querySelector<HTMLTextAreaElement>(notes)!.value).toBe('edited understanding');
    await click('删除批注 1');
    expect((await readState()).progress.functions!.annotations).toEqual([]);
    expect((await readState()).progress.linear!.annotations![0].text).toBe('another chapter');
  });

  it('captures mode and formula source once, supports keyboard actions, and stores plain text safely',async()=>{
    await click('数学推导');await selectQuote();
    await act(async()=>document.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',altKey:true,bubbles:true})));await settle();
    expect(document.activeElement).toBe(button('将选中内容带到 AI 导师'));
    const paragraph=container.querySelector('.prose-section p')!;
    // A deterministic KaTeX fixture verifies accessible + visual text is not duplicated.
    paragraph.innerHTML='formula <span class="katex"><span class="katex-html">x²</span><span class="katex-mathml"><math><annotation encoding="application/x-tex">x^2</annotation></math></span></span>';
    await selectQuote();await click('为选中文字记批注');
    await edit('.context-panel .annotation-card textarea','<script>private thought</script>');
    expect(container.querySelector('.annotation-card script')).toBeNull();
    expect((await readState()).progress.functions!.annotations![0]).toMatchObject({mode:'math',quote:'formula $x^2$',text:'<script>private thought</script>'});
    expect(container.querySelector('.context-panel .annotation-notes')!.textContent).toContain('批注已本地保存');
  });

  it('keeps unsaved comments editable and reports a storage error',async()=>{
    vi.spyOn(IDBObjectStore.prototype,'put').mockImplementation(()=>{throw new DOMException('Full','QuotaExceededError');});
    await selectQuote();await click('为选中文字记批注');
    await edit('.context-panel .annotation-card textarea','unsaved thought');
    expect(container.querySelector('.annotation-notes [role=status]')!.textContent).toBe('批注保存失败，请导出备份');
    expect(container.querySelector<HTMLTextAreaElement>('.annotation-card textarea')!.value).toBe('unsaved thought');
    expect((await readState()).progress.functions!.annotations).toBeUndefined();
  });

  it('refuses additions at the storage limit and allows adding after deleting one',async()=>{
    await act(async()=>root.unmount());
    const state=await readState();
    state.progress.functions!.annotations=Array.from({length:50},(_,i)=>({id:`seed-${i}`,mode:'deep',quote:'saved quote',text:'saved thought',createdAt:new Date().toISOString()}));
    await writeState(state);root=createRoot(container);
    await act(async()=>root.render(createElement(App)));await settle();
    await selectQuote();await click('为选中文字记批注');
    expect(container.textContent).toContain('本章最多保存 50 条批注');
    expect((await readState()).progress.functions!.annotations).toHaveLength(50);
    await go('#/notes');await click('删除批注 1');
    await go('#/lesson/functions');await selectQuote();await click('为选中文字记批注');
    const annotations=(await readState()).progress.functions!.annotations!;
    expect(annotations).toHaveLength(50);expect(annotations.at(-1)!.text).toBe('');
  });

  it('labels truncated quotes and does not offer annotation on personal notes',async()=>{
    container.querySelector('.prose-section p')!.textContent='a'.repeat(3200);
    await selectQuote();await click('为选中文字记批注');
    const quote=(await readState()).progress.functions!.annotations![0].quote;
    expect(quote.length).toBeLessThanOrEqual(3000);expect(quote).toContain('选区较长');
    await go('#/notes');
    await act(async()=>{
      const quote=container.querySelector('.annotation-card blockquote')!;
      const range=document.createRange();range.selectNodeContents(quote);
      window.getSelection()!.removeAllRanges();window.getSelection()!.addRange(range);
      quote.dispatchEvent(new MouseEvent('pointerup',{bubbles:true,clientX:100,clientY:100}));
    });
    expect(document.querySelector('button[aria-label="为选中文字记批注"]')).toBeNull();
  });
});
