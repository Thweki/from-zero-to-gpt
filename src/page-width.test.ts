// @vitest-environment jsdom
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {act,createElement} from 'react';
import type {ReactNode} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {LessonReader} from './components/LessonReader';
import {lessons} from './data/lessons';
import {emptyProgress} from './storage';
import {pageWidthKey,pageWidths,readPageWidth,savePageWidth} from './page-width';

vi.mock('./components/LessonLab',()=>({LessonLab:()=>null}));
vi.mock('./components/CodeLab',()=>({CodeLab:()=>null}));
vi.mock('./components/Formula',()=>({MathContent:({children}:{children:ReactNode})=>children,Formula:()=>null}));

let host:HTMLDivElement,root:Root;
beforeEach(()=>{
  localStorage.clear();
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
  vi.stubGlobal('ResizeObserver',class{observe(){}disconnect(){}});
  host=document.createElement('div');document.body.append(host);root=createRoot(host);
});
afterEach(()=>{
  act(()=>root.unmount());host.remove();vi.restoreAllMocks();vi.unstubAllGlobals();
});

function renderLesson(index=0,mode:'intuition'|'math'|'code'|'deep'='intuition'){
  const patch=vi.fn();
  act(()=>root.render(createElement(LessonReader,{
    key:lessons[index].id,lesson:lessons[index],progress:{...emptyProgress(),mode},stage:1,
    patch,navigate:vi.fn(),onCheckpoint:vi.fn(),onObserve:vi.fn(),readerFont:{size:'standard',saveError:false,changeSize:vi.fn()},
  })));
  return patch;
}
function choose(width:string){
  const select=host.querySelector<HTMLSelectElement>('.page-width-control select')!;
  act(()=>{select.value=width;select.dispatchEvent(new Event('change',{bubbles:true}));});
}

describe('device page width',()=>{
  it.each([null,'','invalid','1200','{"width":"wide"}'])('defaults safely for stored value %s',value=>{
    if(value!==null)localStorage.setItem(pageWidthKey,value);
    expect(readPageWidth()).toBe('standard');
  });
  it.each(pageWidths)('round trips %s',width=>{
    expect(savePageWidth(width)).toBe(true);expect(readPageWidth()).toBe(width);
  });
  it('handles an unavailable storage getter',()=>{
    vi.spyOn(window,'localStorage','get').mockImplementation(()=>{throw new Error('blocked');});
    expect(readPageWidth()).toBe('standard');expect(savePageWidth('wide')).toBe(false);
    renderLesson();choose('wide');
    expect(host.querySelector('article')?.dataset.pageWidth).toBe('wide');
    expect(host.querySelector('[role="status"]')?.textContent).toContain('无法保存');
  });
  it('applies the selection immediately, across modes and chapter remounts, without editing learning records',()=>{
    const patch=renderLesson();
    expect(host.querySelector<HTMLSelectElement>('.page-width-control select')?.value).toBe('standard');
    choose('narrow');
    expect(host.querySelector('article')?.dataset.pageWidth).toBe('narrow');
    expect(localStorage.getItem(pageWidthKey)).toBe('narrow');
    expect(patch).not.toHaveBeenCalled();
    renderLesson(0,'math');
    expect(host.querySelector('article')?.dataset.pageWidth).toBe('narrow');
    renderLesson(1);
    expect(host.querySelector<HTMLSelectElement>('.page-width-control select')?.value).toBe('narrow');
    choose('standard');renderLesson(0);
    expect(host.querySelector('article')?.dataset.pageWidth).toBe('standard');
  });
  it('restores before rendering and reports quota failures while allowing retry',()=>{
    localStorage.setItem(pageWidthKey,'wide');renderLesson();
    expect(host.querySelector('article')?.dataset.pageWidth).toBe('wide');
    const write=vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw new Error('quota');});
    choose('narrow');
    expect(host.querySelector('article')?.dataset.pageWidth).toBe('narrow');
    expect(host.querySelector('[role="status"]')?.textContent).toContain('无法保存');
    write.mockRestore();choose('standard');
    expect(host.querySelector('[role="status"]')?.textContent).not.toContain('无法保存');
    expect(readPageWidth()).toBe('standard');
  });
});
