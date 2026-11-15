// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import {act, createElement} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import App from './App';
import {emptyProgress, initialState, readState, writeState} from './storage';
import {lessonById} from './data/lessons';
import {bookmarkHref} from './bookmarks';

vi.mock('./components/LessonLab', () => ({LessonLab:() => null}));
vi.mock('./components/CodeLab', () => ({CodeLab:() => null}));
vi.mock('./components/ProjectDownload', () => ({ProjectDownload:() => null}));
vi.mock('./components/TutorPanel', () => ({TutorPanel:() => null}));
vi.mock('./components/Formula', () => ({
  MathContent:({children}:{children:React.ReactNode}) => children,
  Formula:({children}:{children:React.ReactNode}) => children,
}));

let root:Root;
let container:HTMLDivElement;
const settle = async () => {
  // Hash changes, IndexedDB and font-ready animation frames settle in separate turns.
  for (let turn = 0; turn < 3; turn++) await act(async () => {await new Promise(resolve => setTimeout(resolve, 20));});
};
const button = (label:string) => {
  const found = Array.from(container.querySelectorAll('button')).find(element => element.getAttribute('aria-label') === label || element.textContent === label);
  expect(found, label).toBeDefined();
  return found!;
};
const click = async (element:HTMLElement) => {await act(async () => element.click()); await settle();};
const go = async (hash:string) => {await act(async () => {location.hash = hash;}); await settle();};

beforeEach(async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('ResizeObserver', class {observe() {} disconnect() {}});
  vi.stubGlobal('matchMedia', vi.fn(() => ({matches:false, addEventListener() {}, removeEventListener() {}})));
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  Object.defineProperty(document, 'fonts', {configurable:true, value:{ready:Promise.resolve()}});
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {configurable:true, value:vi.fn()});
  history.replaceState(null, '', '/#/lesson/functions');
  const state = initialState();
  state.progress.functions = {...emptyProgress(), note:'keep my note', code:'x = 2', review:true, quizPassed:true};
  await writeState(state);
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  await act(async () => root.render(createElement(App)));
  await settle();
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('section bookmark learning flow', () => {
  it('adds from headings, persists across remounts, jumps across chapters and modes, and removes from notes', async () => {
    const title = lessonById.functions.math[0].title;
    await click(button('数学推导'));
    await click(button(`添加小节书签：${title}`));
    expect(button(`移除小节书签：${title}`).getAttribute('aria-pressed')).toBe('true');
    expect((await readState()).progress.functions).toMatchObject({bookmarks:[{mode:'math', title}], note:'keep my note', code:'x = 2', review:true, quizPassed:true});
    await click(button('直觉理解'));
    await go('#/lesson/linear');
    const otherTitle = lessonById.linear.deep[0].title;
    await click(button('深入研究'));
    await click(button(`添加小节书签：${otherTitle}`));
    await go('#/notes');
    expect(container.querySelectorAll('.section-bookmarks a')).toHaveLength(2);
    const href = bookmarkHref('functions', {mode:'math', title});
    const link = Array.from(container.querySelectorAll<HTMLAnchorElement>('.section-bookmarks a')).find(item => item.getAttribute('href') === href)!;
    expect(link.textContent).toContain(title);
    await click(link);
    expect(button('数学推导').getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement?.id).toBe('reading-math-0');
    expect(HTMLElement.prototype.scrollIntoView).toHaveBeenCalled();

    await act(async () => root.unmount());
    root = createRoot(container);
    await act(async () => root.render(createElement(App)));
    await settle();
    expect(button(`移除小节书签：${title}`).getAttribute('aria-pressed')).toBe('true');
    expect(document.activeElement?.id).toBe('reading-math-0');
    await click(button(`移除小节书签：${title}`));
    expect(button(`添加小节书签：${title}`).getAttribute('aria-pressed')).toBe('false');
    await go('#/notes');
    expect(container.querySelectorAll('.section-bookmarks a')).toHaveLength(1);
    await click(button(`移除书签：${lessonById.linear.title} · 深入研究 · ${otherTitle}`));
    expect(container.querySelector('.section-bookmarks')?.textContent).toContain('在正文小节标题旁添加书签');
    const state = await readState();
    expect(state.progress.functions?.bookmarks).toEqual([]);
    expect(state.progress.linear?.bookmarks).toEqual([]);
    expect(state.progress.functions).toMatchObject({note:'keep my note', code:'x = 2', review:true, quizPassed:true});
  });

  it('keeps full imported bookmark lists within the persistence limit and lets learners remove stale entries', async () => {
    const state = await readState();
    state.progress.functions!.bookmarks = Array.from({length:100}, (_, index) => ({mode:'math', title:`old section ${index}`}));
    await act(async () => root.unmount());
    await writeState(state);
    root = createRoot(container);
    await act(async () => root.render(createElement(App)));
    await settle();
    expect(button(`添加小节书签：${lessonById.functions.intuition[0].title}`).disabled).toBe(true);
    await go('#/notes');
    expect(container.querySelector('.section-bookmarks a')?.getAttribute('href')).toBe('#/lesson/functions');
    await click(button(`移除书签：${lessonById.functions.title} · 数学推导 · old section 0`));
    await go('#/lesson/functions');
    await click(button(`添加小节书签：${lessonById.functions.intuition[0].title}`));
    expect((await readState()).progress.functions?.bookmarks).toHaveLength(100);
  });

  it('navigates between two bookmarks in the same mounted chapter and tolerates stale links', async () => {
    for (const mode of ['math', 'deep', 'intuition'] as const) {
      await go(bookmarkHref('functions', {mode, title:lessonById.functions[mode][0].title}));
      expect(document.activeElement?.id).toBe(`reading-${mode}-0`);
      expect(container.querySelector('#lesson-mode-panel')?.getAttribute('data-mode')).toBe(mode);
    }
    await go('#/lesson/functions/math/%broken');
    expect(container.querySelector('h1')?.textContent).toBe(lessonById.functions.title);
    await go(bookmarkHref('functions', {mode:'math', title:'removed title'}));
    expect(container.querySelector('#lesson-mode-panel')?.getAttribute('data-mode')).toBe('intuition');
  });
});
