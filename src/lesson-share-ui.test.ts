// @vitest-environment jsdom
import {act,createElement} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import App from './App';
import {ShareLessonLink} from './components/ShareLessonLink';
import {initialState,emptyProgress,writeState} from './storage';
import {lessonById} from './data/lessons';
import {lessonHeadingId} from './lesson-share';

vi.mock('./storage',async importOriginal=>{
  const original=await importOriginal<typeof import('./storage')>();
  return {...original,readState:vi.fn(async()=>{
    const state=original.initialState();
    state.progress.functions={...original.emptyProgress(),mode:'code',note:'private note',code:'private code'};
    return state;
  }),writeState:vi.fn(async()=>{})};
});
// These services are independent of routing and sharing; no network or Python is needed.
vi.mock('./components/LessonLab',()=>({LessonLab:()=>null}));
vi.mock('./components/CodeLab',()=>({CodeLab:()=>null}));
vi.mock('./components/TutorPanel',()=>({TutorPanel:()=>null}));
vi.mock('./components/SelectionTutor',()=>({SelectionTutor:()=>null}));
vi.mock('./components/AppUpdate',()=>({AppUpdateNotice:()=>null,AppUpdateSettings:()=>null}));

let container:HTMLDivElement,root:Root;
beforeEach(()=>{
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
  vi.stubGlobal('matchMedia',vi.fn(()=>({matches:false,addEventListener:vi.fn(),removeEventListener:vi.fn()})));
  vi.stubGlobal('ResizeObserver',class{observe(){}disconnect(){}});
  vi.stubGlobal('requestAnimationFrame',(callback:FrameRequestCallback)=>setTimeout(()=>callback(0),0));
  vi.stubGlobal('cancelAnimationFrame',clearTimeout);
  Object.defineProperty(document,'fonts',{configurable:true,value:{ready:Promise.resolve()}});
  vi.spyOn(window,'scrollTo').mockImplementation(()=>{});
  Element.prototype.scrollIntoView=vi.fn();
  Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:vi.fn(async()=>{})}});
  window.history.replaceState(null,'','/#/lesson/functions');
  container=document.createElement('div');document.body.append(container);root=createRoot(container);
  vi.mocked(writeState).mockClear();
});
afterEach(async()=>{
  await act(async()=>root.unmount());container.remove();vi.restoreAllMocks();vi.unstubAllGlobals();
});
async function settle(){await act(async()=>{await new Promise(resolve=>setTimeout(resolve,30));});}
async function navigate(hash:string){
  await act(async()=>{window.history.replaceState(null,'',hash);window.dispatchEvent(new HashChangeEvent('hashchange'));});
  await settle();
}
async function click(label:string){
  const button=Array.from(container.querySelectorAll('button')).find(button=>button.getAttribute('aria-label')===label||button.textContent===label);
  expect(button,`button ${label}`).toBeDefined();await act(async()=>button!.click());
}

describe('share controls',()=>{
  it('copies a clean link and announces success only after the clipboard resolves',async()=>{
    let done!:()=>void;
    vi.mocked(navigator.clipboard.writeText).mockImplementation(()=>new Promise<void>(resolve=>{done=resolve;}));
    await act(async()=>root.render(createElement(ShareLessonLink,{lessonId:'functions',mode:'math'})));
    await click('复制本章链接');
    expect(container.querySelector('button')!.disabled).toBe(true);
    expect(container.querySelector('[role=status]')!.textContent).toBe('');
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(`${location.origin}/#/lesson/functions/math`);
    await act(async()=>done());
    expect(container.querySelector('[role=status]')!.textContent).toBe('链接已复制');
    expect(container.querySelector('input')).toBeNull();
  });
  it.each(['missing','denied'])('selects a manual-copy field when clipboard is %s',async kind=>{
    Object.defineProperty(navigator,'clipboard',{configurable:true,value:kind==='missing'?undefined:{writeText:vi.fn().mockRejectedValue(new Error('denied'))}});
    await act(async()=>root.render(createElement(ShareLessonLink,{lessonId:'linear',mode:'deep',heading:'Q / K'})));
    await click('复制小节链接：Q / K');
    const input=container.querySelector('input')!;
    expect(document.activeElement).toBe(input);
    expect(input.readOnly).toBe(true);
    expect(input.selectionStart).toBe(0);expect(input.selectionEnd).toBe(input.value.length);
    expect(input.value).toBe(`${location.origin}/#/lesson/linear/deep/Q%20%2F%20K`);
    expect(container.querySelector('[role=status]')!.textContent).toContain('无法自动复制');
    container.querySelector('button')!.focus();
    await click('复制小节链接：Q / K');
    expect(document.activeElement).toBe(input);
    expect(input.selectionEnd).toBe(input.value.length);
  });
});

describe('shared links in the real app router and reader',()=>{
  it('restores a heading over a saved mode, supports same-lesson navigation, and leaves tabs usable',async()=>{
    const heading=lessonById.functions.math[1].title;
    window.history.replaceState(null,'',`/#/lesson/functions/math/${encodeURIComponent(heading)}`);
    await act(async()=>root.render(createElement(App)));
    await settle();
    expect(container.querySelector('[role=tabpanel]')!.getAttribute('data-mode')).toBe('math');
    expect(document.activeElement?.id).toBe(lessonHeadingId('math',heading));
    await click(`复制小节链接：${heading}`);
    expect(navigator.clipboard.writeText).toHaveBeenLastCalledWith(`${location.origin}/#/lesson/functions/math/${encodeURIComponent(heading)}`);
    const saved=vi.mocked(writeState).mock.calls.at(-1)![0];
    expect(saved.progress.functions).toMatchObject({mode:'math',note:'private note',code:'private code'});
    await click('深入研究');
    expect(container.querySelector('[role=tabpanel]')!.getAttribute('data-mode')).toBe('deep');
    await click('复制本章链接');
    expect(navigator.clipboard.writeText).toHaveBeenLastCalledWith(`${location.origin}/#/lesson/functions/deep`);
    await navigate('#/lesson/functions/math/renamed-heading');
    expect(container.querySelector('[role=tabpanel]')!.getAttribute('data-mode')).toBe('math');
    expect(document.activeElement?.id).toBe('lesson-mode-panel');
    await navigate('#/lesson/functions/deep/%E0%A4%A');
    expect(container.querySelector('[role=tabpanel]')!.getAttribute('data-mode')).toBe('deep');
    expect(document.activeElement?.id).toBe('lesson-mode-panel');
    await navigate('#/lesson/functions');
    expect(container.querySelector('[role=tabpanel]')!.getAttribute('data-mode')).toBe('deep');
  });
  it('keeps legacy links on the saved mode and shares the new chapter after navigation',async()=>{
    await act(async()=>root.render(createElement(App)));
    await settle();
    expect(container.querySelector('[role=tabpanel]')!.getAttribute('data-mode')).toBe('code');
    await navigate('#/lesson/linear/intuition');
    await click('复制本章链接');
    expect(navigator.clipboard.writeText).toHaveBeenLastCalledWith(`${location.origin}/#/lesson/linear/intuition`);
    const saved=vi.mocked(writeState).mock.calls.at(-1)![0];
    expect(saved.progress.functions).toMatchObject({note:'private note',code:'private code'});
    expect(saved.progress.linear?.quizPassed).toBe(emptyProgress().quizPassed);
    expect(saved.theme).toBe(initialState().theme);
  });
});
