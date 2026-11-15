// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import {act, createElement} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {deleteDB} from 'idb';
import App from './App';
import {LessonReader} from './components/LessonReader';
import {exerciseHints} from './data/exercise-hints';
import {lessonById} from './data/lessons';
import {emptyProgress, initialState, readState, writeState} from './storage';
import type {LessonId, ViewMode} from './types';

vi.mock('./components/ProviderSettings', () => ({ProviderSettings: () => null}));
vi.mock('./components/AppUpdate', () => ({AppUpdateNotice: () => null, AppUpdateSettings: () => null}));
vi.mock('./components/TutorPanel', () => ({TutorPanel: () => null}));

let host: HTMLDivElement, root: Root;
beforeEach(async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('ResizeObserver', class {observe() {} disconnect() {}});
  vi.stubGlobal('matchMedia', () => ({matches: false, addEventListener() {}, removeEventListener() {}}));
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  history.replaceState(null, '', '/#/settings');
  await deleteDB('from-zero-to-gpt');
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const patch = vi.fn();
async function renderLesson(enabled?: boolean, id: LessonId = 'functions', mode: ViewMode = 'code') {
  await act(async () => root.render(createElement(LessonReader, {
    lesson: lessonById[id], progress: {...emptyProgress(), mode, code: '# my draft', lastRun: 'saved output', codePassed: true},
    stage: 1, patch, navigate: vi.fn(), onCheckpoint: vi.fn(), onObserve: vi.fn(), experimentalExerciseHints: enabled,
  })));
  if (enabled && mode === 'code' && exerciseHints[id]) await settleUntil(() => !!ladder());
}
function button(label: string) {
  const found = [...host.querySelectorAll('button')].find(item => item.textContent === label);
  if (!found) throw new Error(`Missing button: ${label}`);
  return found;
}
async function click(label: string) {await act(async () => button(label).click());}
const ladder = () => host.querySelector('[role="group"]');
async function settleUntil(check: () => Promise<boolean> | boolean) {
  for (let attempt = 0; attempt < 100; attempt++) {
    let done = false;
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 10));
      done = await check();
    });
    if (done) return;
  }
  throw new Error('UI or storage did not settle');
}

describe('experimental exercise hints in the real lesson reader', () => {
  it('renders identical default and explicit-off lesson markup with no hint content', async () => {
    await renderLesson();
    const original = host.innerHTML;
    expect(ladder()).toBeNull();
    expect(original).not.toContain(exerciseHints.functions!.concept);
    await renderLesson(false);
    expect(host.innerHTML).toBe(original);
  });

  it('reveals one cue at a time, caps at three and never changes learner work or progress', async () => {
    patch.mockClear();
    await renderLesson(true);
    const editor = host.querySelector('textarea')!.value;
    expect(ladder()?.textContent).toContain('实验性');
    expect(ladder()?.querySelectorAll('li').length).toBe(0);
    expect(ladder()?.textContent).not.toContain(exerciseHints.functions!.checkCode);
    for (let step = 1; step <= 3; step++) {
      await click(`展开第 ${step} 条提示`);
      expect(ladder()?.querySelectorAll('li').length).toBe(step);
      expect(ladder()?.querySelectorAll('pre').length).toBe(step === 3 ? 1 : 0);
    }
    expect(ladder()?.querySelector('pre')?.textContent).toBe(exerciseHints.functions!.checkCode);
    expect(button('提示已全部展开').disabled).toBe(true);
    await click('提示已全部展开');
    expect(ladder()?.querySelectorAll('li').length).toBe(3);
    await click('收起全部提示');
    expect(ladder()?.querySelectorAll('li').length).toBe(0);
    expect(button('收起全部提示').disabled).toBe(true);
    expect(host.querySelector('textarea')!.value).toBe(editor);
    expect(host.querySelector('.code-output')!.textContent).toContain('saved output');
    expect(patch).not.toHaveBeenCalled();
  });

  it('resets disclosure across chapters, modes and opt-out, without hints for unsupported exercises', async () => {
    await renderLesson(true);
    await click('展开第 1 条提示');
    await renderLesson(true, 'linear');
    expect(ladder()?.querySelectorAll('li').length).toBe(0);
    await click('展开第 1 条提示');
    expect(ladder()?.textContent).toContain(exerciseHints.linear!.concept);
    expect(ladder()?.textContent).not.toContain(exerciseHints.functions!.concept);
    await renderLesson(false, 'linear');
    expect(ladder()).toBeNull();
    await renderLesson(true, 'linear');
    expect(ladder()?.querySelectorAll('li').length).toBe(0);
    await click('展开第 1 条提示');
    await renderLesson(true, 'linear', 'math');
    expect(ladder()).toBeNull();
    await renderLesson(true, 'linear');
    expect(ladder()?.querySelectorAll('li').length).toBe(0);
    await renderLesson(true, 'python');
    expect(ladder()).toBeNull();
  });

  it('wires the settings opt-in through App, persists it on reload and can disable it', async () => {
    const state = initialState();
    state.progress.functions = {...emptyProgress(), mode: 'code', code: '# keep this', note: 'my note', codePassed: true};
    await writeState(state);
    await act(async () => root.render(createElement(App)));
    await settleUntil(() => !!host.querySelector('input[type="checkbox"]'));
    const checkbox = host.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
    expect(checkbox.checked).toBe(false);
    await act(async () => checkbox.click());
    await settleUntil(async () => (await readState()).experimentalExerciseHints === true);
    await act(async () => {location.hash = '/lesson/functions';});
    await settleUntil(() => !!ladder());
    await click('展开第 1 条提示');
    await act(async () => root.unmount());
    root = createRoot(host);
    await act(async () => root.render(createElement(App)));
    await settleUntil(() => !!ladder());
    expect(ladder()?.querySelectorAll('li').length).toBe(0);
    await act(async () => {
      expect((await readState()).progress.functions).toMatchObject({code: '# keep this', note: 'my note', codePassed: true});
    });
    await act(async () => {location.hash = '/settings';});
    await settleUntil(() => !!host.querySelector('input[type="checkbox"]'));
    const restored = host.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
    expect(restored.checked).toBe(true);
    await act(async () => restored.click());
    await settleUntil(async () => (await readState()).experimentalExerciseHints === false);
    await act(async () => {location.hash = '/lesson/functions';});
    await settleUntil(() => !!host.querySelector('.code-lab'));
    expect(ladder()).toBeNull();
  });
});
