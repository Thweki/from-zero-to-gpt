// @vitest-environment jsdom
import {act,createElement} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {LessonReader} from './components/LessonReader';
import {lessonById} from './data/lessons';
import {emptyProgress} from './storage';
import {readerFontSizeKey,useReaderFontSize} from './use-reader-font-size';

vi.mock('./components/LessonLab',()=>({LessonLab:()=>null}));
vi.mock('./components/CodeLab',()=>({CodeLab:()=>null}));

let container:HTMLDivElement,root:Root;
const patch=vi.fn();
function Harness({lessonId='functions'}:{lessonId?:'functions'|'vectors'}){
  const readerFont=useReaderFontSize();
  return createElement(LessonReader,{key:lessonId,lesson:lessonById[lessonId],progress:emptyProgress(),stage:1,patch,navigate:vi.fn(),onCheckpoint:vi.fn(),onObserve:vi.fn(),readerFont});
}
async function render(lessonId?:'functions'|'vectors'){
  await act(async()=>root.render(createElement(Harness,{lessonId})));
}
async function choose(value:string){
  await act(async()=>{
    const select=container.querySelector('select')!;
    select.value=value;
    select.dispatchEvent(new Event('change',{bubbles:true}));
  });
}
beforeEach(()=>{
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
  vi.stubGlobal('ResizeObserver',class{observe(){} disconnect(){}});
  localStorage.clear();patch.mockClear();
  container=document.createElement('div');document.body.append(container);root=createRoot(container);
});
afterEach(async()=>{
  await act(async()=>root.unmount());container.remove();vi.restoreAllMocks();vi.unstubAllGlobals();
});

describe('reader font preference',()=>{
  it.each([null,'standard','large','largest','huge','1.3','{"size":"large"}',''])('restores only supported saved sizes: %s',async saved=>{
    if(saved!==null)localStorage.setItem(readerFontSizeKey,saved);
    await render();
    const expected=saved==='large'||saved==='largest'?saved:'standard';
    expect(container.querySelector('select')!.value).toBe(expected);
    expect(container.querySelector('article')!.dataset.readerFontSize).toBe(expected);
    expect(patch).not.toHaveBeenCalled();
  });

  it('applies all sizes, persists immediately, and resets without changing lesson progress or text',async()=>{
    await render();
    const text=container.querySelector('#lesson-mode-panel')!.textContent;
    for(const size of ['large','largest','standard']){
      await choose(size);
      expect(container.querySelector('article')!.dataset.readerFontSize).toBe(size);
      expect(localStorage.getItem(readerFontSizeKey)).toBe(size);
      expect(container.querySelector('#lesson-mode-panel')!.textContent).toBe(text);
    }
    expect(patch).not.toHaveBeenCalled();
  });

  it('keeps the choice through chapter remounts and a new application mount',async()=>{
    await render();await choose('largest');await render('vectors');
    expect(container.querySelector('select')!.value).toBe('largest');
    await act(async()=>root.unmount());root=createRoot(container);await render();
    expect(container.querySelector('article')!.dataset.readerFontSize).toBe('largest');
  });

  it('still reads and changes sizes when localStorage access throws',async()=>{
    vi.spyOn(window,'localStorage','get').mockImplementation(()=>{throw new DOMException('Blocked','SecurityError');});
    await render();expect(container.querySelector('select')!.value).toBe('standard');
    await choose('largest');await render('vectors');
    expect(container.querySelector('article')!.dataset.readerFontSize).toBe('largest');
    expect(container.querySelector('[role="status"]')!.textContent).toContain('无法保存');
    expect(patch).not.toHaveBeenCalled();
  });

  it('recovers from a failed write when the user retries',async()=>{
    await render();
    const write=vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw new DOMException('Full','QuotaExceededError');});
    await choose('large');expect(container.querySelector('[role="status"]')).not.toBeNull();
    write.mockRestore();await choose('standard');
    expect(container.querySelector('[role="status"]')).toBeNull();
    expect(localStorage.getItem(readerFontSizeKey)).toBe('standard');
  });
});
