// @vitest-environment jsdom
import {act, createElement, StrictMode} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {LessonReader} from './components/LessonReader';
import {lessonById} from './data/lessons';
import {emptyProgress} from './storage';
import type {LessonId, ViewMode} from './types';

vi.mock('./components/LessonLab', () => ({LessonLab: () => null}));
vi.mock('./components/CodeLab', () => ({CodeLab: () => null}));
vi.mock('./components/ProjectDownload', () => ({ProjectDownload: () => null}));

let root: Root, host: HTMLDivElement;
let engine: {speak: ReturnType<typeof vi.fn>; cancel: ReturnType<typeof vi.fn>; pause: ReturnType<typeof vi.fn>; resume: ReturnType<typeof vi.fn>; paused: boolean};
const patch = vi.fn();
async function render(mode: ViewMode = 'intuition', id: LessonId = 'functions') {
  await act(async () => root.render(createElement(StrictMode, null, createElement(LessonReader, {
    key: id, lesson: lessonById[id], progress: {...emptyProgress(), mode}, stage: 1, patch,
    navigate: vi.fn(), onCheckpoint: vi.fn(), onObserve: vi.fn(),
  }))));
}
function button(text: string) {
  const found = [...host.querySelectorAll('button')].find(button => button.textContent === text);
  expect(found, `button ${text}`).toBeDefined();
  return found!;
}
async function click(text: string) { await act(async () => button(text).click()); }

beforeEach(() => {
  vi.stubEnv('VITE_EXPERIMENTAL_TTS', 'true');
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  engine = {speak: vi.fn(), cancel: vi.fn(), pause: vi.fn(), resume: vi.fn(), paused: false};
  vi.stubGlobal('speechSynthesis', engine);
  vi.stubGlobal('SpeechSynthesisUtterance', class { text: string; constructor(text: string) { this.text = text; } });
  patch.mockClear();
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); vi.unstubAllEnvs();
});

describe('opt-in lesson read-aloud', () => {
  it.each([undefined, '', 'false', '1'])('is absent with flag %s and never accesses speech', async flag => {
    vi.stubEnv('VITE_EXPERIMENTAL_TTS', flag);
    await render();
    expect(host.querySelector('.lesson-read-aloud')).toBeNull();
    expect(engine.speak).not.toHaveBeenCalled(); expect(engine.cancel).not.toHaveBeenCalled();
  });
  it('requires a click, exposes playback controls, and never changes learning evidence', async () => {
    await render(); expect(engine.speak).not.toHaveBeenCalled(); expect(button('停止朗读').disabled).toBe(true);
    await click('朗读本节'); expect(engine.speak.mock.lastCall![0].text).toBe(lessonById.functions.intuition[0].title);
    await click('暂停朗读'); expect(engine.pause).toHaveBeenCalledOnce();
    await click('继续朗读'); expect(engine.resume).toHaveBeenCalledOnce();
    await click('停止朗读'); expect(engine.cancel).toHaveBeenCalledOnce(); expect(button('停止朗读').disabled).toBe(true);
    expect(patch).not.toHaveBeenCalled();
  });
  it('selects an exact section and stops without automatically starting it', async () => {
    await render(); await click('朗读本节');
    const select = host.querySelector<HTMLSelectElement>('.lesson-read-aloud select')!;
    await act(async () => { select.value = '1'; select.dispatchEvent(new Event('change', {bubbles: true})); });
    expect(engine.cancel).toHaveBeenCalledOnce(); expect(engine.speak).toHaveBeenCalledOnce();
    await click('朗读本节'); expect(engine.speak.mock.lastCall![0].text).toBe(lessonById.functions.intuition[1].title);
  });
  it.each(['math', 'deep', 'code'] as const)('cancels on switching to %s without autoplay', async mode => {
    await render(); await click('朗读本节'); await render(mode);
    expect(engine.cancel).toHaveBeenCalledOnce(); expect(engine.speak).toHaveBeenCalledOnce();
    if (mode === 'code') expect(host.querySelector('.lesson-read-aloud')).toBeNull();
    else {
      await click('朗读本节'); expect(engine.speak.mock.lastCall![0].text).toBe(lessonById.functions[mode][0].title);
    }
  });
  it('cancels paused narration on chapter navigation and ignores its late callback', async () => {
    await render(); await click('朗读本节'); await click('暂停朗读');
    const old = engine.speak.mock.lastCall![0] as SpeechSynthesisUtterance;
    await render('intuition', 'vectors');
    await act(async () => old.onend?.call(old, {} as SpeechSynthesisEvent));
    expect(engine.cancel).toHaveBeenCalledOnce(); expect(engine.speak).toHaveBeenCalledOnce();
    expect(button('停止朗读').disabled).toBe(true);
  });
  it('stops when leaving the page and when the reader unmounts', async () => {
    await render(); await click('朗读本节');
    await act(async () => window.dispatchEvent(new Event('pagehide')));
    expect(engine.cancel).toHaveBeenCalledOnce(); expect(button('停止朗读').disabled).toBe(true);
    await click('朗读本节'); await act(async () => root.render(null));
    expect(engine.cancel).toHaveBeenCalledTimes(2);
  });
  it('shows an unsupported message while preserving normal reading', async () => {
    vi.stubGlobal('speechSynthesis', undefined); await render();
    expect(host.querySelector('.lesson-read-aloud [role=status]')?.textContent).toContain('不支持朗读');
    expect(host.querySelector('.prose-section')?.textContent).toContain(lessonById.functions.intuition[0].title);
    expect(host.querySelector('.lesson-read-aloud button')).toBeNull();
  });
  it('offers retry after a browser error and returns to idle on completion', async () => {
    await render(); await click('朗读本节');
    const utterance = engine.speak.mock.lastCall![0] as SpeechSynthesisUtterance;
    await act(async () => utterance.onerror?.call(utterance, {} as SpeechSynthesisErrorEvent));
    expect(host.querySelector('.lesson-read-aloud [role=status]')?.textContent).toContain('朗读失败');
    await click('朗读本节');
    let index = 1;
    while (index < engine.speak.mock.calls.length) {
      const current = engine.speak.mock.calls[index++][0] as SpeechSynthesisUtterance;
      await act(async () => current.onend?.call(current, {} as SpeechSynthesisEvent));
    }
    expect(button('停止朗读').disabled).toBe(true);
  });
});
