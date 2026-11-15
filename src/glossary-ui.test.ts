// @vitest-environment jsdom
import {act, createElement, useState} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {LessonReader} from './components/LessonReader';
import {lessonById} from './data/lessons';
import {emptyProgress, initialState, validateImport} from './storage';
import type {LearningState, LessonId} from './types';

vi.mock('./components/LessonLab', () => ({LessonLab:() => null}));
vi.mock('./components/CodeLab', () => ({CodeLab:() => null}));

let container: HTMLDivElement;
let root: Root;
let saved: LearningState;
const navigate = vi.fn();
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('ResizeObserver', class {observe() {} disconnect() {}});
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  saved = initialState();
  saved.progress.functions = {...emptyProgress(), mode:'deep', code:'draft = 42', note:'keep this', labValues:{x:2}, quizPassed:true};
  navigate.mockClear();
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

function Harness({id = 'functions', initial = saved}: {id?:LessonId; initial?:LearningState}) {
  const [state, setState] = useState(initial);
  return createElement(LessonReader, {
    key:id, lesson:lessonById[id], stage:1, progress:state.progress[id] ?? {...emptyProgress(),mode:'deep'}, navigate,
    onCheckpoint:() => {}, onObserve:() => {},
    patch:patch => setState(previous => {
      saved = {...previous, progress:{...previous.progress, [id]:{...emptyProgress(), ...previous.progress[id], ...patch}}};
      return saved;
    }),
  });
}
const button = (label: string) => container.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!;
const click = async (element: HTMLElement) => {await act(async () => element.click());};
async function choose(id: string) {
  await act(async () => {
    const select = container.querySelector('select')!;
    select.value = id;
    select.dispatchEvent(new Event('change', {bubbles:true}));
  });
}

describe('in-lesson glossary', () => {
  it('opens relevant terms in place, allows cross-course lookup and changes only glossary state', async () => {
    const original = structuredClone(saved.progress.functions);
    await act(async () => root.render(createElement(Harness)));
    expect(button('术语表').getAttribute('aria-expanded')).toBe('false');
    expect(container.querySelector('.glossary-panel')).toBeNull();
    await click(button('术语表'));
    expect(container.querySelector('select')?.value).toBe('function');
    expect(container.querySelector('optgroup')?.label).toBe('本章相关');
    const panel = container.querySelector('.glossary-panel')!;
    expect(button('术语表').getAttribute('aria-controls')).toBe(panel.id);
    await choose('attention');
    expect(panel.textContent).toContain('Query 与 Key');
    expect(panel.textContent).toContain('例子');
    expect(saved.progress.functions).toEqual({...original, glossary:{open:true,termId:'attention'}});
    expect(navigate).not.toHaveBeenCalled();
  });

  it('persists across reading modes, restores from backup and isolates chapter choices', async () => {
    await act(async () => root.render(createElement(Harness)));
    await click(button('术语表'));
    await choose('gradient');
    for (const mode of ['math','code','intuition','deep']) {
      await click(container.querySelector<HTMLButtonElement>(`#tab-${mode}`)!);
      expect(container.querySelector('select')?.value).toBe('gradient');
      expect(button('术语表').getAttribute('aria-expanded')).toBe('true');
    }
    const backup = validateImport(JSON.parse(JSON.stringify(saved)));
    await act(async () => root.render(createElement(Harness, {key:'restored', initial:backup})));
    expect(container.querySelector('select')?.value).toBe('gradient');
    await act(async () => root.render(createElement(Harness, {key:'restored', id:'linear'})));
    expect(button('术语表').getAttribute('aria-expanded')).toBe('false');
    await click(button('术语表'));
    expect(container.querySelector('select')?.value).toBe('parameter');
    await act(async () => root.render(createElement(Harness, {key:'restored', id:'functions'})));
    expect(container.querySelector('select')?.value).toBe('gradient');
    expect(saved.progress.functions?.code).toBe('draft = 42');
    expect(saved.progress.functions?.note).toBe('keep this');
  });

  it('closes with Escape or its close button, restores focus and remembers the selection', async () => {
    await act(async () => root.render(createElement(Harness)));
    await click(button('术语表'));
    await choose('token');
    const select = container.querySelector('select')!;
    select.focus();
    await act(async () => select.dispatchEvent(new KeyboardEvent('keydown', {key:'Escape',bubbles:true})));
    expect(document.activeElement).toBe(button('术语表'));
    expect(container.querySelector('.glossary-panel')).toBeNull();
    expect(saved.progress.functions?.glossary).toEqual({open:false,termId:'token'});
    await click(button('术语表'));
    expect(container.querySelector('select')?.value).toBe('token');
    await click(button('关闭术语表'));
    expect(document.activeElement).toBe(button('术语表'));
    expect(button('术语表').getAttribute('aria-expanded')).toBe('false');
  });
});
