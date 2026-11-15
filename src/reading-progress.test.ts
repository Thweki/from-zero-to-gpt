// @vitest-environment jsdom
import {act,createElement} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {readingPercent} from './components/ReadingProgress';
import {LessonReader} from './components/LessonReader';
import {lessonById} from './data/lessons';
import {emptyProgress} from './storage';
import type {LessonId,ViewMode} from './types';

vi.mock('./components/LessonLab',()=>({LessonLab:()=>null}));
vi.mock('./components/CodeLab',()=>({CodeLab:()=>null}));

describe('reading position geometry',()=>{
  it.each([
    [200,2000,800,100,0],
    [100,2000,800,100,0],
    [-550,2000,800,100,50],
    [-1200,2000,800,100,100],
    [-2400,2000,800,100,100],
    [200,400,800,100,100],
    [600,400,800,100,0],
    [200,700,800,100,0],
    [100,700,800,100,100],
    [0,0,800,100,0],
    [0,2000,80,100,0],
  ])('top %s, height %s, viewport %s, tools %s → %s%%',(top,height,viewport,tools,expected)=>{
    expect(readingPercent(top,height,viewport,tools)).toBe(expected);
  });
});

describe('lesson reading progress',()=>{
  let host:HTMLDivElement,root:Root;
  let top:number,height:number,toolsBottom:number;
  let nextFrame:number,frames:Map<number,FrameRequestCallback>;
  let observers:{callback:ResizeObserverCallback;observe:ReturnType<typeof vi.fn>;disconnect:ReturnType<typeof vi.fn>}[];
  const patch=vi.fn();
  const render=(mode:ViewMode='intuition',id:LessonId='functions')=>act(()=>root.render(createElement(LessonReader,{
    key:id,lesson:lessonById[id],progress:{...emptyProgress(),mode},stage:1,patch,navigate:vi.fn(),onCheckpoint:vi.fn(),onObserve:vi.fn(),
  })));
  const bar=()=>host.querySelector('[role="progressbar"]')!;
  const flush=()=>act(()=>{const callbacks=[...frames.values()];frames.clear();callbacks.forEach(callback=>callback(0));});
  const scroll=()=>{window.dispatchEvent(new Event('scroll'));flush();};

  beforeEach(()=>{
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
    vi.stubGlobal('innerHeight',800);
    top=200;height=2000;toolsBottom=100;nextFrame=0;frames=new Map();observers=[];patch.mockClear();
    vi.stubGlobal('requestAnimationFrame',vi.fn((callback:FrameRequestCallback)=>{frames.set(++nextFrame,callback);return nextFrame;}));
    vi.stubGlobal('cancelAnimationFrame',vi.fn((id:number)=>frames.delete(id)));
    vi.stubGlobal('ResizeObserver',class {
      observe=vi.fn();disconnect=vi.fn();
      constructor(public callback:ResizeObserverCallback){observers.push(this);}
    });
    vi.spyOn(HTMLElement.prototype,'getBoundingClientRect').mockImplementation(function(this:HTMLElement){
      if(this.classList.contains('lesson-reading-content'))return {top,bottom:top+height,height} as DOMRect;
      if(this.classList.contains('lesson-sticky-tools'))return {top:56,bottom:toolsBottom,height:toolsBottom-56} as DOMRect;
      return {top:0,bottom:4000,height:4000} as DOMRect;
    });
    host=document.createElement('div');document.body.append(host);root=createRoot(host);
  });
  afterEach(()=>{act(()=>root.unmount());host.remove();vi.restoreAllMocks();vi.unstubAllGlobals();});

  it('tracks scrolling forward and back without changing saved learning evidence',()=>{
    render();
    expect(bar().getAttribute('aria-label')).toBe('直觉理解阅读位置');
    expect(bar().getAttribute('aria-valuenow')).toBe('0');
    top=-550;scroll();
    expect(bar().getAttribute('aria-valuenow')).toBe('50');
    expect((bar().firstElementChild as HTMLElement).style.transform).toBe('scaleX(0.5)');
    top=-1200;scroll();expect(bar().getAttribute('aria-valuenow')).toBe('100');
    expect(bar().getAttribute('aria-valuetext')).toContain('仅表示滚动位置');
    top=200;scroll();expect(bar().getAttribute('aria-valuenow')).toBe('0');
    expect(patch).not.toHaveBeenCalled();
  });

  it('measures only prose, recomputes for each mode, and hides in code mode',()=>{
    render();
    const prose=host.querySelector('.lesson-reading-content')!;
    expect(prose.querySelector('.problem-callout')).not.toBeNull();
    expect(prose.querySelector('.prose-section')).not.toBeNull();
    expect(prose.querySelector('#lesson-experiment,#lesson-quiz,.learning-evidence')).toBeNull();
    top=-1200;scroll();
    top=100;height=3300;render('math');
    expect(bar().getAttribute('aria-label')).toBe('数学推导阅读位置');
    expect(bar().getAttribute('aria-valuenow')).toBe('0');
    expect(host.querySelector('.lesson-reading-content .formula-card')).not.toBeNull();
    render('code');expect(host.querySelector('[role="progressbar"]')).toBeNull();
    top=100;height=400;render('deep');
    expect(bar().getAttribute('aria-label')).toBe('深入研究阅读位置');
    expect(bar().getAttribute('aria-valuenow')).toBe('100');
    expect(host.querySelector('.lesson-reading-content .related-section')).toBeNull();
    top=200;height=2000;render('intuition','linear');
    expect(bar().getAttribute('aria-valuenow')).toBe('0');
  });

  it('coalesces scroll events and recalculates for viewport, prose, and toolbar resizing',()=>{
    render();top=-550;
    window.dispatchEvent(new Event('scroll'));window.dispatchEvent(new Event('scroll'));
    expect(frames.size).toBe(1);flush();expect(bar().getAttribute('aria-valuenow')).toBe('50');
    vi.stubGlobal('innerHeight',1000);window.dispatchEvent(new Event('resize'));flush();
    expect(bar().getAttribute('aria-valuenow')).toBe('59');
    const observer=observers.find(item=>item.observe.mock.calls.some(([element])=>element.classList.contains('lesson-reading-content')))!;
    expect(observer.observe.mock.calls.map(([element])=>element.tagName)).toEqual(['DIV','DIV','ARTICLE']);
    height=3000;toolsBottom=200;observer.callback([],{} as ResizeObserver);flush();
    expect(bar().getAttribute('aria-valuenow')).toBe('34');
  });

  it('disconnects observers, cancels pending work, and removes listeners when leaving the reader',()=>{
    render();
    window.dispatchEvent(new Event('scroll'));expect(frames.size).toBe(1);
    act(()=>root.render(null));
    expect(frames.size).toBe(0);
    expect(observers.every(observer=>observer.disconnect.mock.calls.length===1)).toBe(true);
    window.dispatchEvent(new Event('scroll'));window.dispatchEvent(new Event('resize'));
    expect(frames.size).toBe(0);
  });
});
