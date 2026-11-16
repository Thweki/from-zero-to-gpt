// @vitest-environment jsdom
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {act, createElement} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import App from './App';
import {initialState, readState, writeState} from './storage';

vi.mock('./storage', async importOriginal => ({
  ...await importOriginal<typeof import('./storage')>(),
  readState:vi.fn(),
  writeState:vi.fn().mockResolvedValue(undefined),
}));
vi.mock('./use-readable-plots', () => ({useReadablePlots:() => {}}));
vi.mock('./components/TutorPanel', () => ({TutorPanel:() => null}));
vi.mock('./components/SelectionTutor', () => ({SelectionTutor:() => null}));
vi.mock('./components/LessonReader', () => ({LessonReader:() => null}));

let root: Root;
let container: HTMLDivElement;
beforeEach(() => {
  vi.useFakeTimers({toFake:['Date']});
  vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('matchMedia', () => ({matches:false, addEventListener:vi.fn(), removeEventListener:vi.fn()}));
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  vi.mocked(readState).mockResolvedValue(initialState());
  vi.mocked(writeState).mockClear().mockResolvedValue(undefined);
  history.replaceState(null, '', '/#/map');
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

async function navigate(hash: string) {
  await act(async () => {
    history.replaceState(null, '', hash);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });
}
const links = () => Array.from(container.querySelectorAll('.recent-lessons a')).map(a => a.getAttribute('href'));

describe('home recently opened integration', () => {
  it('records navigation, shows one entry per chapter, and restores the list from saved state', async () => {
    await act(async () => root.render(createElement(App)));
    expect(container.querySelector('.recent-lessons')).toBeNull();
    await navigate('#/lesson/functions');
    vi.setSystemTime(new Date('2026-01-02T00:00:00Z'));
    await navigate('#/lesson/linear');
    await navigate('#/map');
    expect(links()).toEqual(['#/lesson/linear', '#/lesson/functions']);
    vi.setSystemTime(new Date('2026-01-03T00:00:00Z'));
    const target = container.querySelector<HTMLAnchorElement>('.recent-lessons a[href="#/lesson/functions"]')!;
    await act(async () => {
      target.click();
      await new Promise(resolve => setTimeout(resolve, 20));
    });
    expect(location.hash).toBe('#/lesson/functions');
    await navigate('#/map');
    expect(links()).toEqual(['#/lesson/functions', '#/lesson/linear']);
    const saved = vi.mocked(writeState).mock.calls.at(-1)![0];
    expect(saved.progress.functions?.lastVisited).toBeTruthy();
    await act(async () => root.unmount());
    vi.mocked(readState).mockResolvedValue(saved);
    root = createRoot(container);
    await act(async () => root.render(createElement(App)));
    expect(links()).toEqual(['#/lesson/functions', '#/lesson/linear']);
  });

  it('shows visits selected in auxiliary pages but does not fabricate a visit when just opening home', async () => {
    await act(async () => root.render(createElement(App)));
    await navigate('#/notes');
    const chapter = container.querySelector<HTMLSelectElement>('select[aria-label="选择笔记章节"]')!;
    await act(async () => {
      chapter.value = 'linear';
      chapter.dispatchEvent(new Event('change', {bubbles:true}));
    });
    await navigate('#/map');
    expect(links()).toEqual(['#/lesson/linear']);
    expect(vi.mocked(writeState).mock.calls.at(-1)![0].progress.functions).toBeUndefined();
  });
});
