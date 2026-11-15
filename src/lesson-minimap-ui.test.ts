// @vitest-environment jsdom
import {act,createElement,createRef} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {renderToStaticMarkup} from 'react-dom/server';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {LessonMinimap,readingHeadingId} from './components/LessonMinimap';
import {LessonReader} from './components/LessonReader';
import {lessonById} from './data/lessons';
import {emptyProgress} from './storage';

let root:Root,container:HTMLDivElement,resize:()=>void,offset:number,reduced:boolean;
const disconnect=vi.fn(),scrollTo=vi.fn();
const sections=[{title:'First'},{title:'Second'}];
const toolsRef=createRef<HTMLDivElement>();
const rect=(top:number,bottom:number)=>({top,bottom,height:bottom-top} as DOMRect);
beforeEach(()=>{
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
  offset=0;reduced=true;
  vi.stubGlobal('ResizeObserver',class{constructor(callback:()=>void){resize=callback;}observe(){}disconnect=disconnect;});
  vi.stubGlobal('requestAnimationFrame',(callback:FrameRequestCallback)=>setTimeout(()=>callback(0),0));
  vi.stubGlobal('cancelAnimationFrame',clearTimeout);
  vi.stubGlobal('matchMedia',()=>({matches:reduced}));
  vi.stubGlobal('scrollTo',scrollTo);
  vi.stubGlobal('innerHeight',600);
  vi.useFakeTimers();
  container=document.createElement('div');document.body.append(container);root=createRoot(container);
});
afterEach(()=>{
  act(()=>root.unmount());container.remove();vi.useRealTimers();vi.unstubAllGlobals();vi.restoreAllMocks();vi.clearAllMocks();
});
async function render(mode='math'){
  await act(async()=>root.render(createElement('article',null,
    createElement('div',{ref:toolsRef,style:{top:'56px'}},createElement(LessonMinimap,{key:mode,lessonId:'functions',mode,sections,toolsRef})),
    ...sections.map((section,i)=>createElement('section',{key:i},createElement('h2',{id:readingHeadingId('functions',mode,i),tabIndex:-1},section.title))),
  )));
  vi.spyOn(toolsRef.current!,'getBoundingClientRect').mockImplementation(()=>rect(56,156));
  container.querySelectorAll('h2').forEach((heading,i)=>{
    vi.spyOn(heading,'getBoundingClientRect').mockImplementation(()=>rect(200+i*400-offset,240+i*400-offset));
    vi.spyOn(heading.parentElement!,'getBoundingClientRect').mockImplementation(()=>rect(200+i*400-offset,600+i*400-offset));
  });
  await act(async()=>{resize();vi.runAllTimers();});
}
describe('minimap controls and observation',()=>{
  it('wires the real reader to only the current prose mode and leaves learning records alone',()=>{
    const lesson=lessonById.functions,patch=vi.fn();
    for(const mode of ['intuition','math','deep','code'] as const){
      const markup=renderToStaticMarkup(createElement(LessonReader,{
        lesson,progress:{...emptyProgress(),mode},stage:1,patch,navigate:vi.fn(),onCheckpoint:vi.fn(),onObserve:vi.fn(),
      }));
      const document=new DOMParser().parseFromString(markup,'text/html');
      const buttons=document.querySelectorAll('.lesson-minimap button');
      expect(buttons.length).toBe(mode==='code'?0:lesson[mode].length);
      if(mode!=='code')buttons.forEach((button,i)=>{
        const heading=document.getElementById(readingHeadingId(lesson.id,mode,i));
        expect(heading?.textContent).toContain(lesson[mode][i].title);
        expect(heading?.getAttribute('tabindex')).toBe('-1');
        expect(button.getAttribute('aria-label')).toContain(lesson[mode][i].title);
      });
    }
    expect(patch).not.toHaveBeenCalled();
  });
  it('tracks visible range on scroll, resize, and return above the prose',async()=>{
    await render();
    const band=()=>container.querySelector<HTMLElement>('.lesson-minimap-viewport');
    expect(band()?.style.width).toBe('50%');
    offset=500;
    await act(async()=>{window.dispatchEvent(new Event('scroll'));vi.runAllTimers();});
    expect(container.querySelector('[aria-current]')?.textContent).toBe('2');
    expect(band()?.style.left).toBe('58.5%');
    offset=1000;
    await act(async()=>{resize();vi.runAllTimers();});
    expect(band()).toBeNull();expect(container.querySelector('[aria-current]')).toBeNull();
    offset=0;
    await act(async()=>{window.dispatchEvent(new Event('resize'));vi.runAllTimers();});
    expect(band()?.style.left).toBe('0%');
  });
  it('focuses the heading and scrolls below measured chrome, honoring motion preference',async()=>{
    await render();
    const button=container.querySelectorAll('button')[1];
    expect(button.getAttribute('aria-label')).toContain('Second');
    await act(async()=>button.click());
    expect(document.activeElement?.id).toBe('reading-functions-math-1');
    expect(scrollTo).toHaveBeenLastCalledWith({top:432,behavior:'instant'});
    reduced=false;await act(async()=>button.click());
    expect(scrollTo).toHaveBeenLastCalledWith({top:432,behavior:'smooth'});
  });
  it('rebinds to the new mode and disconnects old observers',async()=>{
    await render();await render('deep');
    expect(disconnect).toHaveBeenCalled();
    await act(async()=>container.querySelectorAll('button')[0].click());
    expect(document.activeElement?.id).toBe('reading-functions-deep-0');
  });
  it('recalculates section proportions after text reflows',async()=>{
    await render();
    const first=container.querySelector('button')!;
    expect(first.style.width).toBe('50%');
    const heading=container.querySelectorAll('h2')[1];
    vi.mocked(heading.getBoundingClientRect).mockImplementation(()=>rect(400,440));
    await act(async()=>{resize();vi.runAllTimers();});
    expect(first.style.width).toBe('25%');
  });
  it('removes listeners and cancels queued measurements on unmount',async()=>{
    const remove=vi.spyOn(window,'removeEventListener');
    await render();
    await act(async()=>{window.dispatchEvent(new Event('scroll'));});
    expect(vi.getTimerCount()).toBe(1);
    await act(async()=>root.render(null));
    expect(vi.getTimerCount()).toBe(0);
    expect(disconnect).toHaveBeenCalledTimes(1);
    expect(remove.mock.calls.map(([event])=>event)).toEqual(expect.arrayContaining(['scroll','resize']));
  });
});
