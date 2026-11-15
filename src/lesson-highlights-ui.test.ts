// @vitest-environment jsdom
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {act,createElement,useState} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {SelectionTutor} from './components/SelectionTutor';
import {LessonReader} from './components/LessonReader';
import {addHighlight,type LessonHighlight} from './lesson-highlights';
import {emptyProgress} from './storage';
import {lessonById} from './data/lessons';
import type {LessonProgress} from './types';
vi.mock('./components/LessonLab',()=>({LessonLab:()=>null}));
vi.mock('./components/CodeLab',()=>({CodeLab:()=>null}));
vi.mock('./components/ProjectDownload',()=>({ProjectDownload:()=>null}));
let root:Root,host:HTMLElement,lastProgress:LessonProgress;
const picked=vi.fn();
function Harness({initial=[]}:{initial?:LessonHighlight[]}){
  const [progress,setProgress]=useState<LessonProgress>({...emptyProgress(),note:'保留笔记',code:'print(1)',highlights:initial});lastProgress=progress;
  const patch=(p:Partial<LessonProgress>)=>setProgress(current=>({...current,...p}));
  return createElement('main',{id:'main-content'},
    createElement(SelectionTutor,{lesson:lessonById.functions,resetKey:progress.mode,values:{},onPick:picked,onHighlight:anchor=>patch({highlights:addHighlight(progress.highlights||[],anchor,'highlight-id')})}),
    createElement(LessonReader,{lesson:lessonById.functions,progress,stage:1,patch,navigate:()=>{},onCheckpoint:()=>{},onObserve:()=>{}}));
}
function button(text:string){return [...document.querySelectorAll<HTMLButtonElement>('button')].find(b=>b.textContent===text||b.getAttribute('aria-label')===text)!;}
function click(text:string){act(()=>button(text).click());}
function select(){
  const p=host.querySelector('[data-highlight-paragraph]')!;
  const range=document.createRange();const text=p.querySelector('[data-highlight-part]')!.firstChild!;
  range.setStart(text,0);range.setEnd(text,4);
  act(()=>{const selection=window.getSelection()!;selection.removeAllRanges();selection.addRange(range);p.dispatchEvent(new MouseEvent('pointerup',{bubbles:true,clientX:200,clientY:200}));});
}
beforeEach(()=>{
  (globalThis as Record<string,unknown>).IS_REACT_ACT_ENVIRONMENT=true;
  vi.stubGlobal('ResizeObserver',class {observe(){} disconnect(){}});
  vi.stubGlobal('matchMedia',()=>({matches:true}));
  vi.stubGlobal('requestAnimationFrame',(callback:FrameRequestCallback)=>{callback(0);return 0;});
  HTMLElement.prototype.scrollIntoView=vi.fn();
  Range.prototype.getBoundingClientRect=()=>({x:0,y:0,width:50,height:20,top:0,left:0,right:50,bottom:20,toJSON:()=>({})});
  host=document.createElement('div');document.body.append(host);root=createRoot(host);picked.mockClear();
  act(()=>root.render(createElement(Harness)));
});
afterEach(()=>{act(()=>root.unmount());document.body.replaceChildren();window.getSelection()?.removeAllRanges();vi.unstubAllGlobals();});

describe('reader and selection toolbar integration',()=>{
  it('adds visible highlights, jumps from another mode, removes and preserves unrelated progress',()=>{
    select();expect(button('高亮选中文字')).toBeDefined();click('高亮选中文字');
    expect(host.querySelector('mark')?.textContent).toBe(lastProgress.highlights![0].source.slice(0,4));
    expect(host.querySelectorAll('.lesson-highlights li')).toHaveLength(1);
    expect(document.querySelector('[role=toolbar]')).toBeNull();expect(picked).not.toHaveBeenCalled();
    click('数学推导');expect(host.querySelector('mark')).toBeNull();
    act(()=>host.querySelector<HTMLButtonElement>('.highlight-jump')!.click());
    expect(lastProgress.mode).toBe('intuition');expect(host.querySelector('mark')).toBe(document.activeElement);
    expect(HTMLElement.prototype.scrollIntoView).toHaveBeenCalled();
    act(()=>host.querySelector<HTMLButtonElement>('.highlight-remove')!.click());
    expect(host.querySelector('mark')).toBeNull();expect(lastProgress.highlights).toEqual([]);
    expect(lastProgress).toMatchObject({note:'保留笔记',code:'print(1)',review:false,status:'new'});
  });
  it('keeps tutor transfer intact and offers no highlighter for headings or cross-paragraph selections',()=>{
    select();click('将选中内容带到 AI 导师');expect(picked).toHaveBeenCalledWith(expect.objectContaining({kind:'text'}));
    expect(lastProgress.highlights).toEqual([]);
    const heading=host.querySelector('h1')!;const range=document.createRange();range.selectNodeContents(heading);
    act(()=>{window.getSelection()!.removeAllRanges();window.getSelection()!.addRange(range);heading.dispatchEvent(new MouseEvent('pointerup',{bubbles:true}));});
    expect(button('高亮选中文字')).toBeUndefined();expect(button('将选中内容带到 AI 导师')).toBeDefined();
    const paragraphs=host.querySelectorAll('[data-highlight-paragraph]');range.setStart(paragraphs[0],0);range.setEnd(paragraphs[1],1);
    act(()=>{window.getSelection()!.removeAllRanges();window.getSelection()!.addRange(range);paragraphs[0].dispatchEvent(new MouseEvent('pointerup',{bubbles:true}));});
    expect(button('高亮选中文字')).toBeUndefined();
  });
  it('dismisses with Escape, resets on mode changes, and supports the keyboard toolbar shortcut',()=>{
    select();act(()=>document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})));
    expect(document.querySelector('[role=toolbar]')).toBeNull();
    select();act(()=>document.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',altKey:true,bubbles:true})));
    expect(document.activeElement).toBe(button('将选中内容带到 AI 导师'));
    act(()=>button('高亮选中文字').focus());expect(document.activeElement).toBe(button('高亮选中文字'));
    click('数学推导');expect(document.querySelector('[role=toolbar]')).toBeNull();
  });
});
