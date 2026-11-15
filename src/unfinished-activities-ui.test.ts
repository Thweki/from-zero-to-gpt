// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import {act, createElement} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import App from './App';
import {emptyProgress, initialState, readState, writeState} from './storage';
import {lessonById} from './data/lessons';
import type {LearningState} from './types';

// Keep routing, the reader, quiz, inbox, and IndexedDB real; omit unrelated runtimes.
vi.mock('./components/LessonLab', () => ({LessonLab: () => createElement('div', null, '实验')}));
vi.mock('./components/CodeLab', () => ({CodeLab: ({code}: {code: string}) => createElement('textarea', {value: code, readOnly: true, 'aria-label': '测试代码'})}));

let root: Root;
let host: HTMLDivElement;
let fixture: LearningState;
beforeEach(async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('matchMedia', vi.fn(() => ({matches: false, addEventListener() {}, removeEventListener() {}})));
  vi.stubGlobal('ResizeObserver', class {observe() {} unobserve() {} disconnect() {}});
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  Object.defineProperty(document, 'fonts', {configurable: true, value: {ready: Promise.resolve()}});
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {configurable: true, value: vi.fn()});
  history.replaceState(null, '', '#/unfinished');
  fixture = initialState();
  fixture.progress = {
    functions: {...emptyProgress(), status: 'mastered', mode: 'deep', note: '保留我的思考', code: 'my_code = 42', readCompleted: true, experimented: true},
    linear: {...emptyProgress(), status: 'learning', mode: 'code', code: lessonById.linear.starter},
  };
  await writeState(fixture);
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals();
});

const settle = () => act(async () => {await new Promise(resolve => setTimeout(resolve, 40));});
async function render() {
  await act(async () => {root.render(createElement(App));});
  for (let attempt = 0; attempt < 10 && !host.querySelector('main'); attempt++) await settle();
  await settle();
}
async function navigate(hash: string) {
  await act(async () => {
    history.pushState(null, '', hash);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });
  await settle();
}
async function filter(value: string) {
  await act(async () => {
    const select = host.querySelector<HTMLSelectElement>('.unfinished-filter select')!;
    select.value = value; select.dispatchEvent(new Event('change', {bubbles: true}));
  });
}

describe('unfinished activity inbox integration', () => {
  it('filters without writing learning evidence and shows filtered empty state', async () => {
    await render();
    expect(host.querySelector('.nav-link[href="#/unfinished"]')?.classList.contains('active')).toBe(true);
    expect(host.querySelector('.unfinished-page [role="status"]')?.textContent).toBe('2 个章节 · 6 项未完事项');
    await filter('reading');
    expect(host.querySelectorAll('.unfinished-card')).toHaveLength(1);
    expect(host.querySelector('.unfinished-card h2')?.textContent).toContain('线性函数与参数');
    expect(host.querySelector('.unfinished-card a')?.getAttribute('href')).toBe('#/lesson/linear/reading');
    expect(await readState()).toEqual(fixture);
  });

  it('follows reading links from a saved code tab and removes completed reading after remount', async () => {
    await render(); await filter('reading');
    await navigate(host.querySelector('.unfinished-card a')!.getAttribute('href')!);
    expect(document.activeElement?.id).toBe('lesson-mode-panel');
    expect(host.querySelector('#tab-intuition')?.getAttribute('aria-selected')).toBe('true');
    await act(async () => host.querySelector<HTMLButtonElement>('.reading-next button')!.click());
    await navigate('#/unfinished');
    expect(host.querySelector('.unfinished-page [role="status"]')?.textContent).toBe('2 个章节 · 5 项未完事项');
    await act(async () => root.unmount()); root = createRoot(host);
    await render(); await filter('reading');
    expect(host.querySelector('.unfinished-empty h2')?.textContent).toBe('此类活动暂无未完事项');
    await filter('all'); expect(host.querySelectorAll('.unfinished-card')).toHaveLength(2);
  });

  it('focuses quiz, code and experiment destinations and preserves notes, code and mastery', async () => {
    await render();
    await navigate(host.querySelector('a[href="#/lesson/functions/quiz"]')!.getAttribute('href')!);
    expect(document.activeElement?.id).toBe('lesson-quiz');
    await act(async () => {
      host.querySelectorAll<HTMLInputElement>('.quiz-options input')[lessonById.functions.quiz.correct].click();
    });
    await act(async () => host.querySelector<HTMLButtonElement>('.quiz-card .button.primary')!.click());
    await navigate('#/unfinished');
    expect(host.querySelector('a[href="#/lesson/functions/quiz"]')).toBeNull();
    await navigate(host.querySelector('a[href="#/lesson/functions/code"]')!.getAttribute('href')!);
    expect(document.activeElement?.id).toBe('lesson-code');
    expect(host.querySelector<HTMLTextAreaElement>('[aria-label="测试代码"]')?.value).toBe('my_code = 42');
    await act(async () => host.querySelector<HTMLButtonElement>('#tab-deep')!.click());
    expect(host.querySelector('#tab-deep')?.getAttribute('aria-selected')).toBe('true');
    await navigate('#/lesson/functions/experiment');
    expect(document.activeElement?.id).toBe('lesson-experiment');
    expect((await readState()).progress.functions).toMatchObject({note: '保留我的思考', code: 'my_code = 42', status: 'mastered', quizPassed: true});
  });

  it('opens a direct activity URL on reload and ignores unknown section names', async () => {
    history.replaceState(null, '', '#/lesson/functions/code');
    await render(); await settle();
    expect(document.activeElement?.id).toBe('lesson-code');
    await navigate('#/lesson/functions/constructor');
    expect(host.querySelector('#tab-code')?.getAttribute('aria-selected')).toBe('true');
    await act(async () => host.querySelector<HTMLButtonElement>('#tab-math')!.click());
    expect(host.querySelector('#tab-math')?.getAttribute('aria-selected')).toBe('true');
  });

  it('shows no invented tasks for a fresh learner', async () => {
    await writeState(initialState()); await render();
    expect(host.querySelector('.unfinished-empty h2')?.textContent).toBe('暂无未完事项');
    expect(host.querySelectorAll('.unfinished-card')).toHaveLength(0);
    expect(host.querySelector('.unfinished-empty a')?.getAttribute('href')).toBe('#/map');
  });
});
