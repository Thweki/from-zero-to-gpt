// @vitest-environment jsdom
import {act, createElement, StrictMode} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {ExperimentalStudyTimer} from './components/StudyTimer';
import App from './App';
import {writeState} from './storage';

vi.mock('./storage', async importOriginal => {
  const original = await importOriginal<typeof import('./storage')>();
  return {...original, readState: vi.fn(async () => original.initialState()), writeState: vi.fn(async () => {})};
});
// jsdom has no layout engine; this hook measures SVG viewboxes.
vi.mock('./use-readable-plots', () => ({useReadablePlots: () => {}}));

let container: HTMLDivElement, root: Root, clock: number;
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.useFakeTimers();
  clock = 0;
  vi.spyOn(performance, 'now').mockImplementation(() => clock);
  vi.stubEnv('VITE_EXPERIMENTAL_STUDY_TIMER', 'true');
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.mocked(writeState).mockClear();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('study timer in the application', () => {
  async function openApp() {
    vi.stubGlobal('matchMedia', vi.fn(() => ({matches: false, addEventListener() {}, removeEventListener() {}})));
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    window.history.replaceState(null, '', '#/map');
    await act(async () => root.render(createElement(App)));
  }

  it('does not expose a timer in the default application', async () => {
    vi.stubEnv('VITE_EXPERIMENTAL_STUDY_TIMER', undefined);
    await openApp();
    expect(container.querySelector('#main-content')).not.toBeNull();
    expect(container.querySelector('.study-timer')).toBeNull();
  });

  it('keeps a session across routes without writing ticks, and pauses only after a successful checkpoint', async () => {
    await openApp();
    const saves = vi.mocked(writeState).mock.calls.length;
    await click('开始计时');
    await tick(10000);
    expect(vi.mocked(writeState).mock.calls.length).toBe(saves);
    await act(async () => {
      window.history.replaceState(null, '', '#/notes');
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    expect(display()).toBe('00:00:10');
    expect(button('暂停计时')).toBeDefined();
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="保存学习断点"]')!.click());
    vi.mocked(writeState).mockRejectedValueOnce(new Error('Storage unavailable'));
    await click('保存并结束本次学习');
    expect(button('暂停计时')).toBeDefined();
    expect(container.querySelector('[role="dialog"]')).not.toBeNull();
    clock = 12500;
    await click('保存并结束本次学习');
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(display()).toBe('00:00:12');
    expect(button('继续计时')).toBeDefined();
    await tick(20000);
    expect(display()).toBe('00:00:12');
    const saved = vi.mocked(writeState).mock.calls.at(-1)![0];
    expect(saved.progress).toEqual({});
    expect(saved.checkpoint?.lessonId).toBe('functions');
    expect(saved).not.toHaveProperty('elapsedMs');
  });
});
async function render(stopKey?: string) {
  await act(async () => root.render(createElement(StrictMode, null, createElement(ExperimentalStudyTimer, {stopKey}))));
}
function button(label: string) {
  const found = [...container.querySelectorAll('button')].find(element => element.textContent === label);
  expect(found, label).toBeDefined();
  return found!;
}
async function click(label: string) { await act(async () => button(label).click()); }
const display = () => container.querySelector('[role="timer"]')?.textContent;
async function tick(timestamp: number) {
  clock = timestamp;
  await act(async () => vi.advanceTimersByTime(1000));
}

describe('experimental study timer controls', () => {
  it.each([undefined, '', 'false', '1', 'TRUE'])('is absent and schedules nothing with flag %s', async flag => {
    vi.stubEnv('VITE_EXPERIMENTAL_STUDY_TIMER', flag);
    await render();
    expect(container.innerHTML).toBe('');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('starts only on request, pauses, resumes, and resets without counting breaks', async () => {
    await render();
    expect(display()).toBe('00:00:00');
    expect(vi.getTimerCount()).toBe(0);
    expect(button('重置计时').disabled).toBe(true);
    await click('开始计时');
    expect(vi.getTimerCount()).toBe(1);
    expect(button('重置计时').disabled).toBe(true);
    await tick(61500);
    expect(display()).toBe('00:01:01');
    clock = 61750;
    await click('暂停计时');
    expect(container.querySelector('[role="status"]')?.textContent).toBe('已暂停');
    expect(vi.getTimerCount()).toBe(0);
    await tick(120000);
    expect(display()).toBe('00:01:01');
    await click('继续计时');
    await tick(120250);
    expect(display()).toBe('00:01:02');
    await click('暂停计时');
    await click('重置计时');
    expect(display()).toBe('00:00:00');
    expect(button('开始计时').disabled).toBe(false);
  });

  it('catches up after background throttling and ignores wall-clock adjustments', async () => {
    await render();
    await click('开始计时');
    vi.setSystemTime(new Date('2040-01-01'));
    clock = 3601250;
    await act(async () => document.dispatchEvent(new Event('visibilitychange')));
    expect(display()).toBe('01:00:01');
    expect(container.querySelector('[role="timer"]')?.getAttribute('aria-live')).toBe('off');
  });

  it('retains time across parent renders and pauses when a session is saved', async () => {
    await render('previous-checkpoint');
    await click('开始计时');
    await tick(10000);
    await render('previous-checkpoint');
    expect(button('暂停计时').disabled).toBe(false);
    clock = 12500;
    await render('new-checkpoint');
    expect(display()).toBe('00:00:12');
    expect(button('继续计时').disabled).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('cleans up its running clock and listener, and starts fresh after remount', async () => {
    const remove = vi.spyOn(document, 'removeEventListener');
    await render();
    await click('开始计时');
    await tick(1500);
    await act(async () => root.render(null));
    expect(vi.getTimerCount()).toBe(0);
    expect(remove).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
    await render();
    expect(display()).toBe('00:00:00');
    expect(vi.getTimerCount()).toBe(0);
  });
});
