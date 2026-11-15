// @vitest-environment jsdom
import {act,createElement,useRef} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import type {LessonId,ViewMode} from './types';
import {readReadingPosition,writeReadingPosition} from './reading-position';
import {useReadingPosition} from './use-reading-position';

let root:Root,container:HTMLElement;
const originalFonts=Object.getOwnPropertyDescriptor(document,'fonts');
function Reader({lesson='functions',mode='intuition',jump=false,loading=false}:{lesson?:LessonId;mode?:ViewMode;jump?:boolean;loading?:boolean}){
  const ref=useRef<HTMLElement>(null);
  const restart=useReadingPosition(ref,lesson,mode,jump);
  return createElement('article',{ref},
    createElement('h1',{tabIndex:-1},'Lesson'),
    createElement('button',{onClick:restart},'Restart'),
    createElement('div',{id:'lesson-mode-panel',style:{scrollMarginTop:'100px'},'data-reading-anchor':'panel'},
      createElement('section',{'data-reading-anchor':'section-0'}),
      createElement('section',{'data-reading-anchor':'section-1'}),
      loading?createElement('div',{className:'lab-loading'}):null));
}
async function render(props:Parameters<typeof Reader>[0]={}){await act(async()=>{root.render(createElement(Reader,props));});}
async function settle(){await act(async()=>{await vi.advanceTimersByTimeAsync(20);});}
function scroll(top:number){vi.stubGlobal('scrollY',top);window.dispatchEvent(new Event('scroll'));}
function delayFonts(){
  let resolve!:()=>void;
  Object.defineProperty(document,'fonts',{configurable:true,value:{ready:new Promise<void>(done=>{resolve=done;})}});
  return resolve;
}
beforeEach(()=>{
  vi.useFakeTimers();localStorage.clear();history.replaceState(null,'','#/lesson/functions');history.scrollRestoration='auto';
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);vi.stubGlobal('scrollY',0);
  vi.stubGlobal('requestAnimationFrame',(callback:FrameRequestCallback)=>setTimeout(()=>callback(0),16));
  vi.stubGlobal('cancelAnimationFrame',clearTimeout);
  vi.stubGlobal('scrollTo',vi.fn((options:ScrollToOptions)=>scroll(options.top||0)));
  Object.defineProperty(document,'fonts',{configurable:true,value:{ready:Promise.resolve()}});
  vi.spyOn(HTMLElement.prototype,'getBoundingClientRect').mockImplementation(function(this:HTMLElement){
    const top=this.dataset.readingAnchor==='section-1'?1200:600;
    return {top:top-window.scrollY,height:this.dataset.readingAnchor==='panel'?2400:500} as DOMRect;
  });
  container=document.createElement('div');document.body.append(container);root=createRoot(container);
});
afterEach(async()=>{
  await act(async()=>root.unmount());container.remove();
  if(originalFonts)Object.defineProperty(document,'fonts',originalFonts);else Reflect.deleteProperty(document,'fonts');
  vi.restoreAllMocks();vi.unstubAllGlobals();vi.useRealTimers();
});

it('waits for both fonts and lazy content, then restores without stealing focus',async()=>{
  writeReadingPosition('functions','intuition',{anchor:'section-1',fraction:.4});
  const fontsReady=delayFonts();
  await render({loading:true});await settle();expect(scrollTo).not.toHaveBeenCalled();
  await act(async()=>fontsReady());await settle();expect(scrollTo).not.toHaveBeenCalled();
  await render();await settle();
  expect(scrollTo).toHaveBeenCalledWith({top:1300,behavior:'instant'});
  expect(document.activeElement).toBe(document.body);
  // Ordinary rerenders must not rewind the reader.
  scroll(1400);await render();await settle();expect(scrollTo).toHaveBeenCalledTimes(1);
});

it('flushes a pending scroll on mode change and restores each mode independently',async()=>{
  await render();await settle();scroll(1300);
  expect(readReadingPosition('functions','intuition')).toBeNull();
  await render({mode:'math'});await settle();
  expect(readReadingPosition('functions','intuition')).toEqual({anchor:'section-1',fraction:.4});
  scroll(600);
  await render();await settle();expect(window.scrollY).toBe(1300);
  expect(readReadingPosition('functions','math')).toEqual({anchor:'section-0',fraction:.2});
  await render({mode:'math'});await settle();expect(window.scrollY).toBe(600);
});

it('does not replace the old lesson position with the route reset to zero',async()=>{
  await render();await settle();scroll(1300);
  history.replaceState(null,'','#/lesson/linear');scroll(0);
  await render({lesson:'linear'});await settle();
  expect(readReadingPosition('functions','intuition')).toEqual({anchor:'section-1',fraction:.4});
  expect(readReadingPosition('linear','intuition')).toBeNull();
});

it.each(['pagehide','visibilitychange'])('flushes the latest location on %s without waiting for debounce',async event=>{
  await render();await settle();vi.stubGlobal('scrollY',1300);
  if(event==='visibilitychange'){
    vi.spyOn(document,'visibilityState','get').mockReturnValue('hidden');document.dispatchEvent(new Event(event));
  }else window.dispatchEvent(new Event(event));
  expect(readReadingPosition('functions','intuition')).toEqual({anchor:'section-1',fraction:.4});
});

it.each(['wheel','pointerdown','touchstart','keydown'])('yields pending restoration to %s',async event=>{
  writeReadingPosition('functions','intuition',{anchor:'section-1',fraction:.4});
  const fontsReady=delayFonts();await render();
  window.dispatchEvent(new Event(event));scroll(600);
  await act(async()=>fontsReady());await settle();
  expect(scrollTo).not.toHaveBeenCalled();expect(window.scrollY).toBe(600);
});

it('leaves explicit chapter jumps in control of their destination mode',async()=>{
  writeReadingPosition('functions','math',{anchor:'section-1',fraction:.4});
  await render();await settle();await render({mode:'math',jump:true});await settle();
  expect(scrollTo).not.toHaveBeenCalled();
  await render({mode:'math',jump:false});await settle();expect(scrollTo).not.toHaveBeenCalled();
});

it('restarts at the top, saves that choice immediately, and focuses the title',async()=>{
  writeReadingPosition('functions','intuition',{anchor:'section-1',fraction:.4});
  await render();await settle();
  await act(async()=>container.querySelector('button')!.click());
  expect(window.scrollY).toBe(0);
  expect(readReadingPosition('functions','intuition')).toEqual({anchor:'top',fraction:0});
  expect(document.activeElement).toBe(container.querySelector('h1'));
});

it('cancels a stale restoration after unmount and flushes the cached position',async()=>{
  writeReadingPosition('functions','intuition',{anchor:'section-1',fraction:.4});
  const fontsReady=delayFonts();await render();
  window.dispatchEvent(new Event('wheel'));scroll(600);
  await act(async()=>root.render(null));
  await act(async()=>fontsReady());await settle();
  expect(scrollTo).not.toHaveBeenCalled();
  expect(readReadingPosition('functions','intuition')).toEqual({anchor:'section-0',fraction:.2});
  expect(history.scrollRestoration).toBe('auto');
});
