// @vitest-environment jsdom
import {act,createElement} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import App from './App';
import {emptyProgress,initialState,readState,writeState} from './storage';

vi.mock('./storage',async importOriginal=>{
  const actual=await importOriginal<typeof import('./storage')>();
  return {...actual,readState:vi.fn(),writeState:vi.fn(async()=>{})};
});
// Layout and the lazy experiment renderer require a real browser; those are
// covered by reading-focus.spec.ts. Keep the App and LessonReader real here.
vi.mock('./use-readable-plots',()=>({useReadablePlots:()=>{}}));
vi.mock('./components/LessonLab',()=>({LessonLab:()=>null}));
vi.mock('./components/TutorPanel',()=>({TutorPanel:()=>null}));
let root:Root;
let container:HTMLDivElement;
const entry=()=>container.querySelector<HTMLButtonElement>('.reading-focus-toggle')!;
const exit=()=>container.querySelector<HTMLButtonElement>('.reading-focus-exit');
const sidebar=()=>container.querySelector('.sidebar')!;
const active=()=>container.querySelector('.app-shell')!.classList.contains('reading-focus');
async function flush(){await act(async()=>{await new Promise(resolve=>setTimeout(resolve,0));});}
async function click(element:HTMLElement){await act(async()=>element.click());await flush();}
async function escape(){await act(async()=>document.activeElement!.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})));await flush();}
async function route(hash:string){await act(async()=>{history.replaceState(null,'',`${location.search}${hash}`);window.dispatchEvent(new HashChangeEvent('hashchange'));});await flush();}
async function render(query='?experimentalFocus=1'){
  history.replaceState(null,'',`/${query}#/lesson/linear`);
  root=createRoot(container);
  await act(async()=>root.render(createElement(App)));
  await flush();
}

beforeEach(()=>{
  Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
  vi.stubGlobal('matchMedia',()=>({matches:false,addEventListener:()=>{},removeEventListener:()=>{}}));
  vi.stubGlobal('ResizeObserver',class {observe(){} unobserve(){} disconnect(){}});
  vi.stubGlobal('requestAnimationFrame',(callback:FrameRequestCallback)=>window.setTimeout(()=>callback(0),0));
  vi.spyOn(window,'scrollTo').mockImplementation(()=>{});
  const state=initialState();
  state.progress.linear={...emptyProgress(),mode:'math',note:'saved thought',code:'saved code',labValues:{k:2}};
  vi.mocked(readState).mockResolvedValue(state);
  container=document.createElement('div');document.body.append(container);
});
afterEach(async()=>{
  if(root)await act(async()=>root.unmount());
  container.remove();vi.restoreAllMocks();vi.unstubAllGlobals();vi.clearAllMocks();
});

it.each(['','?experimentalFocus=0','?experimentalFocus=true'])('does not offer focus with query %j',async query=>{
  await render(query);
  expect(entry()).toBeNull();expect(active()).toBe(false);
  expect(sidebar().hasAttribute('inert')).toBe(false);
});

it('starts off, makes navigation inert, preserves the reader and does not save focus as learning state',async()=>{
  await render();
  expect(entry().getAttribute('aria-pressed')).toBe('false');
  const reader=container.querySelector('.lesson-page');
  const saves=vi.mocked(writeState).mock.calls.length;
  await click(entry());
  expect(active()).toBe(true);expect(sidebar().hasAttribute('inert')).toBe(true);
  expect(document.activeElement).toBe(exit());
  expect(container.querySelector('.lesson-page')).toBe(reader);
  expect(container.querySelector('[role=tabpanel]')!.getAttribute('data-mode')).toBe('math');
  expect(vi.mocked(writeState).mock.calls).toHaveLength(saves);
  await click(exit()!);
  expect(active()).toBe(false);expect(sidebar().hasAttribute('inert')).toBe(false);
  expect(document.activeElement).toBe(entry());
  expect(vi.mocked(writeState).mock.calls).toHaveLength(saves);
  expect(vi.mocked(writeState).mock.calls.at(-1)![0].progress.linear).toMatchObject({note:'saved thought',code:'saved code',labValues:{k:2}});
});

it('dismisses nested tools first, restores focus after search and leaves editable fields alone',async()=>{
  await render();await click(entry());
  await act(async()=>document.dispatchEvent(new KeyboardEvent('keydown',{key:'k',ctrlKey:true,bubbles:true})));
  expect(container.querySelector('[role=dialog]')).not.toBeNull();
  await escape();
  expect(container.querySelector('[role=dialog]')).toBeNull();expect(active()).toBe(true);
  expect(document.activeElement).toBe(exit());
  await click(container.querySelector('[aria-label="保存学习断点"]')!);
  await escape();expect(active()).toBe(true);expect(container.querySelector('[role=dialog]')).toBeNull();
  await click(container.querySelector('.context-toggle')!);
  await escape();expect(active()).toBe(true);
  const menu=container.querySelector<HTMLDetailsElement>('.lesson-location')!;
  menu.open=true;menu.querySelector('summary')!.focus();
  await escape();expect(menu.open).toBe(false);expect(active()).toBe(true);
  const textarea=container.querySelector<HTMLTextAreaElement>('.scratchpad')!;
  textarea.focus();await escape();expect(active()).toBe(true);
  exit()!.focus();await escape();expect(active()).toBe(false);expect(document.activeElement).toBe(entry());
});

it('retains focus across lessons but resets on other routes and a new mount',async()=>{
  await render();await click(entry());
  await route('#/lesson/functions');expect(active()).toBe(true);
  await route('#/map');expect(active()).toBe(false);expect(entry()).toBeNull();
  await route('#/lesson/functions');expect(active()).toBe(false);
  await click(entry());await act(async()=>root.unmount());
  await render();expect(active()).toBe(false);
});
