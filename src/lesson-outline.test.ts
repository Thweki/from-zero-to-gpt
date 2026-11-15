// @vitest-environment jsdom
import {act,createElement,useState} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {lessons,lessonById} from './data/lessons';
import {lessonOutline} from './lesson-outline';
import {LessonReader} from './components/LessonReader';
import {emptyProgress} from './storage';
import type {Lesson,LessonProgress,ViewMode} from './types';

vi.mock('./components/LessonLab',()=>({LessonLab:()=>null}));
vi.mock('./components/CodeLab',()=>({CodeLab:()=>null}));
vi.mock('./components/ProjectDownload',()=>({ProjectDownload:()=>null}));

describe('lesson outline data',()=>{
  it('uses every existing reading heading in order, with unique targets across the curriculum',()=>{
    const ids:string[]=[];
    for(const lesson of lessons){
      for(const mode of ['intuition','math','deep'] as const){
        const entries=lessonOutline(lesson,mode);
        expect(entries.map(entry=>entry.title)).toEqual(lesson[mode].map(section=>section.title));
        ids.push(...entries.map(entry=>entry.id));
      }
      expect(lessonOutline(lesson,'code')).toEqual([]);
    }
    expect(new Set(ids).size).toBe(ids.length);
  });
  it('keeps repeated and punctuation-heavy titles separately addressable',()=>{
    const title='重复标题：f(x) / 中文';
    const lesson={...lessonById.functions,intuition:[{title,paragraphs:[]},{title,paragraphs:[]}]};
    const entries=lessonOutline(lesson,'intuition');
    expect(entries[0].id).not.toBe(entries[1].id);
    expect(lessonOutline(lesson,'intuition')).toEqual(entries);
  });
});

describe('reader outline interaction',()=>{
  let root:Root,container:HTMLDivElement;
  const originalScroll=Object.getOwnPropertyDescriptor(HTMLElement.prototype,'scrollIntoView');
  const patch=vi.fn();
  const scroll=vi.fn();
  beforeEach(()=>{
    vi.useFakeTimers();
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
    vi.stubGlobal('ResizeObserver',class{observe(){}disconnect(){}});
    vi.stubGlobal('matchMedia',()=>({matches:true}));
    vi.stubGlobal('requestAnimationFrame',(callback:FrameRequestCallback)=>setTimeout(()=>callback(0),0));
    vi.stubGlobal('cancelAnimationFrame',(id:number)=>clearTimeout(id));
    Object.defineProperty(document,'fonts',{configurable:true,value:{ready:Promise.resolve()}});
    vi.spyOn(HTMLElement.prototype,'getBoundingClientRect').mockReturnValue({top:0,bottom:0} as DOMRect);
    Object.defineProperty(HTMLElement.prototype,'scrollIntoView',{configurable:true,value:scroll});
    container=document.createElement('div');document.body.append(container);root=createRoot(container);
    patch.mockClear();scroll.mockClear();
  });
  afterEach(async()=>{
    await act(async()=>root.unmount());container.remove();
    if(originalScroll)Object.defineProperty(HTMLElement.prototype,'scrollIntoView',originalScroll);
    else Reflect.deleteProperty(HTMLElement.prototype,'scrollIntoView');
    vi.restoreAllMocks();vi.unstubAllGlobals();vi.useRealTimers();
  });
  async function render(mode:ViewMode='intuition',lesson:Lesson=lessonById.functions){
    function Harness(){
      const [progress,setProgress]=useState<LessonProgress>({...emptyProgress(),mode,note:'keep note',code:'keep code',quizPassed:true});
      return createElement(LessonReader,{lesson,progress,stage:1,patch:(value:Partial<LessonProgress>)=>{patch(value);setProgress(previous=>({...previous,...value}));},navigate:vi.fn(),onCheckpoint:vi.fn(),onObserve:vi.fn()});
    }
    await act(async()=>root.render(createElement(Harness)));
  }
  const entries=()=>[...container.querySelectorAll<HTMLButtonElement>('.lesson-outline button')];
  async function click(element:HTMLElement){await act(async()=>element.click());await act(async()=>vi.runAllTimersAsync());}

  it.each(['intuition','math','deep'] as const)('%s lists exact headings and jumps with focus without writing progress',async mode=>{
    await render(mode);
    const expected=lessonOutline(lessonById.functions,mode);
    expect(entries().map(button=>button.lastElementChild!.textContent)).toEqual(expected.map(entry=>entry.title));
    const menu=container.querySelector('details.lesson-location')! as HTMLDetailsElement;
    menu.open=true;
    await click(entries().at(-1)!);
    const heading=document.getElementById(expected.at(-1)!.id)!;
    expect(heading.tagName).toBe('H2');expect(document.activeElement).toBe(heading);
    expect(scroll).toHaveBeenCalledWith({block:'start',behavior:'instant'});
    expect(menu.open).toBe(false);expect(patch).not.toHaveBeenCalled();
    expect(container.querySelector('[role=tabpanel]')!.getAttribute('data-mode')).toBe(mode);
  });
  it('replaces targets on mode changes and leaves existing shortcuts available in code mode',async()=>{
    await render();
    const oldIds=entries().map(button=>button.getAttribute('aria-controls'));
    await click(container.querySelector('#tab-math')!);
    expect(entries().map(button=>button.getAttribute('aria-controls'))).toEqual(lessonOutline(lessonById.functions,'math').map(entry=>entry.id));
    for(const id of oldIds)expect(document.getElementById(id!)).toBeNull();
    await click(container.querySelector('#tab-code')!);
    expect(entries()).toHaveLength(0);
    expect(container.querySelectorAll('.lesson-jump-nav>button')).toHaveLength(4);
    await click(container.querySelector('[aria-label="跳到自测练习"]')!);
    expect(document.activeElement?.id).toBe('lesson-quiz');
    expect(entries()).toHaveLength(lessonById.functions.intuition.length);
  });
  it('Escape closes the outline and returns focus to its summary',async()=>{
    await render();
    const menu=container.querySelector<HTMLDetailsElement>('.lesson-location')!;
    menu.open=true;entries()[0].focus();
    await act(async()=>entries()[0].dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})));
    expect(menu.open).toBe(false);expect(document.activeElement).toBe(menu.querySelector('summary'));
    expect(patch).not.toHaveBeenCalled();
  });
  it('uses smooth scrolling when reduced motion is not requested',async()=>{
    vi.stubGlobal('matchMedia',()=>({matches:false}));
    await render();await click(entries()[0]);
    expect(scroll).toHaveBeenCalledWith({block:'start',behavior:'smooth'});
  });
  it('replaces the outline when another lesson opens',async()=>{
    await render();
    const previous=entries().map(button=>button.getAttribute('aria-controls'));
    await render('intuition',lessonById.linear);
    expect(entries().map(button=>button.getAttribute('aria-controls'))).toEqual(lessonOutline(lessonById.linear,'intuition').map(entry=>entry.id));
    for(const id of previous)expect(document.getElementById(id!)).toBeNull();
  });
  it('tracks manual scrolling and clears the current heading beyond the reading sections',async()=>{
    await render();
    const headings=[...container.querySelectorAll<HTMLElement>('.lesson-outline-target')];
    let positions=headings.map((_,index)=>200+index*200);
    let end=1000;
    headings.forEach((heading,index)=>vi.spyOn(heading,'getBoundingClientRect').mockImplementation(()=>({top:positions[index]} as DOMRect)));
    vi.spyOn(headings.at(-1)!.parentElement!,'getBoundingClientRect').mockImplementation(()=>({bottom:end} as DOMRect));
    const update=async()=>{await act(async()=>{window.dispatchEvent(new Event('scroll'));await vi.runAllTimersAsync();});};
    await update();expect(entries().some(button=>button.hasAttribute('aria-current'))).toBe(false);
    positions=positions.map(position=>position-200);await update();
    expect(entries()[0].getAttribute('aria-current')).toBe('location');
    positions=positions.map(position=>position-200);await update();
    expect(entries()[1].getAttribute('aria-current')).toBe('location');
    end=0;await update();expect(entries().some(button=>button.hasAttribute('aria-current'))).toBe(false);
  });
});
