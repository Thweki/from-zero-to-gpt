// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { ReviewQueue } from './components/ReviewQueue';
import { emptyProgress, initialState, readState, writeState } from './storage';
import type { LearningState } from './types';

vi.mock('./storage', async importOriginal => ({ ...await importOriginal<typeof import('./storage')>(), readState: vi.fn(), writeState: vi.fn().mockResolvedValue(undefined) }));
vi.mock('./components/ProviderSettings', () => ({ ProviderSettings: () => null }));
vi.mock('./components/AppUpdate', () => ({ AppUpdateNotice: () => null, AppUpdateSettings: () => null }));
vi.mock('./components/TutorPanel', () => ({ TutorPanel: () => null }));
vi.mock('./components/SelectionTutor', () => ({ SelectionTutor: () => null }));
vi.mock('./use-readable-plots', () => ({ useReadablePlots: () => undefined }));

let container: HTMLDivElement, root: Root;
const now = Date.parse('2026-11-15T12:00:00Z');
function button(text: string) {
  const result = [...container.querySelectorAll('button')].find(el => el.textContent?.includes(text));
  expect(result, `button ${text}`).toBeTruthy();
  return result!;
}
async function route(hash: string) {
  await act(async () => { history.replaceState(null, '', hash); window.dispatchEvent(new Event('hashchange')); });
}
const saved = () => vi.mocked(writeState).mock.calls.at(-1)![0];

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.useFakeTimers();
  vi.setSystemTime(now);
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
  vi.stubGlobal('scrollTo', vi.fn());
  vi.clearAllMocks();
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove(); vi.useRealTimers(); vi.unstubAllGlobals();
});

describe('review queue UI', () => {
  it('gates the route and navigation, persists enabling/rating/disabling, and preserves learning evidence', async () => {
    const state = initialState();
    state.progress.functions = { ...emptyProgress(), status: 'mastered', quizPassed: true, quizAnswer: 2, code: 'learner code', note: 'learner note', review: true };
    vi.mocked(readState).mockResolvedValue(state);
    history.replaceState(null, '', '#/review');
    await act(async () => root.render(createElement(App)));
    expect(container.querySelector('nav a[href="#/review"]')).toBeNull();
    expect(container.querySelector('[aria-label="复习卡片"]')).toBeNull();
    expect(container.textContent).toContain('此功能默认关闭');
    expect(saved()).toEqual(state);

    await route('#/settings');
    const toggle = container.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
    expect(toggle.checked).toBe(false);
    await act(async () => toggle.click());
    expect(saved().reviewQueueEnabled).toBe(true);
    expect(container.querySelector('nav a[href="#/review"]')).not.toBeNull();
    await route('#/review');
    expect(container.querySelector('[aria-label="复习答案"]')).toBeNull();
    expect(container.textContent).not.toContain('延长间隔');
    await act(async () => button('显示答案与解释').click());
    expect(container.querySelector('[aria-label="复习答案"]')).not.toBeNull();
    await act(async () => button('记住了 · 延长间隔').click());
    const rated = saved();
    expect(rated.progress.functions).toEqual({ ...state.progress.functions, reviewSchedule: { step: 1, dueAt: new Date(now + 86_400_000).toISOString() } });
    expect(container.textContent).toContain('当前没有待复习章节');

    await route('#/settings');
    await act(async () => container.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click());
    expect(saved().reviewQueueEnabled).toBe(false);
    expect(saved().progress).toEqual(rated.progress);
    await route('#/review');
    expect(container.querySelector('[aria-label="复习卡片"]')).toBeNull();
    // A new app instance reads the saved, disabled preference and retained schedule.
    vi.mocked(readState).mockResolvedValue(saved());
    await act(async () => { root.unmount(); root = createRoot(container); root.render(createElement(App)); });
    expect(container.textContent).toContain('此功能默认关闭');
  });

  it('advances to a fresh card without leaked answers; returning to a lesson never schedules it', async () => {
    let state: LearningState = { ...initialState(), reviewQueueEnabled: true, progress: {
      functions: { ...emptyProgress(), status: 'learning' }, linear: { ...emptyProgress(), status: 'learning' },
    } };
    const navigate = vi.fn();
    const onReview = vi.fn((id, reviewSchedule) => {
      state = { ...state, progress: { ...state.progress, [id]: { ...state.progress[id as keyof typeof state.progress], reviewSchedule } } };
      render();
    });
    function render() { root.render(createElement(ReviewQueue, { state, onReview, navigate })); }
    await act(async () => render());
    await act(async () => button('回到本章学习').click());
    expect(navigate).toHaveBeenCalledWith('functions');
    expect(onReview).not.toHaveBeenCalled();
    await act(async () => button('显示答案与解释').click());
    await act(async () => { const again = button('还没记住'); again.click(); again.click(); });
    expect(onReview).toHaveBeenCalledTimes(1);
    expect(state.progress.functions?.reviewSchedule).toEqual({ step: 0, dueAt: new Date(now + 600_000).toISOString() });
    expect(container.textContent).toContain('线性函数与参数');
    expect(container.querySelector('[aria-label="复习答案"]')).toBeNull();
    expect(document.activeElement?.tagName).toBe('H2');
  });

  it('refreshes an idle queue when a scheduled chapter becomes due', async () => {
    const state: LearningState = { ...initialState(), reviewQueueEnabled: true, progress: {
      functions: { ...emptyProgress(), status: 'learning', reviewSchedule: { step: 0, dueAt: new Date(now + 600_000).toISOString() } },
    } };
    const onReview = vi.fn();
    await act(async () => root.render(createElement(ReviewQueue, { state, onReview, navigate: vi.fn() })));
    expect(container.textContent).toContain('当前没有待复习章节');
    await act(async () => vi.advanceTimersByTime(600_000));
    expect(container.querySelector('[aria-label="复习卡片"]')).not.toBeNull();
    expect(onReview).not.toHaveBeenCalled();
  });
});
