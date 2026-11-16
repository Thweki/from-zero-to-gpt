// @vitest-environment jsdom
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {act, createElement, StrictMode} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {useTheme} from './use-theme';
import type {LearningState} from './types';

const cacheKey = 'from-zero-to-gpt:theme';
const bootstrap = readFileSync('index.html', 'utf8').match(/<script>(.*?)<\/script>/s)![1];
let dark: boolean;
let listeners: Set<() => void>;
let root: Root;
let container: HTMLDivElement;

function Probe({preference, ready}: {preference: LearningState['theme']; ready: boolean}) {
  return createElement('output', null, useTheme(preference, ready));
}
function render(preference: LearningState['theme'], ready = true) {
  act(() => root.render(createElement(StrictMode, null, createElement(Probe, {preference, ready}))));
}
function changeSystem(value: boolean) {
  act(() => { dark = value; listeners.forEach(listener => listener()); });
}
function expectTheme(theme: 'light' | 'dark') {
  expect(document.documentElement.dataset.theme).toBe(theme);
  expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe(theme === 'dark' ? '#191b1d' : '#f7f7f2');
}

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  dark = false;
  listeners = new Set();
  vi.stubGlobal('matchMedia', vi.fn(() => ({
    get matches() { return dark; },
    addEventListener: (_event: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_event: string, listener: () => void) => listeners.delete(listener),
  })));
  localStorage.clear();
  delete document.documentElement.dataset.theme;
  document.head.innerHTML = '<meta name="theme-color" content="#f7f7f2">';
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('live theme preference', () => {
  it('follows OS changes in both directions without replacing the system preference', () => {
    dark = true;
    render('system');
    expectTheme('dark');
    expect(container.textContent).toBe('dark');
    changeSystem(false);
    expectTheme('light');
    expect(container.textContent).toBe('light');
    changeSystem(true);
    expectTheme('dark');
    expect(localStorage.getItem(cacheKey)).toBe('system');
  });

  it.each(['light', 'dark'] as const)('locks %s regardless of OS, then resumes following immediately', preference => {
    render(preference);
    changeSystem(true);
    expectTheme(preference);
    changeSystem(false);
    expectTheme(preference);
    expect(localStorage.getItem(cacheKey)).toBe(preference);
    changeSystem(true);
    render('system');
    expectTheme('dark');
    changeSystem(false);
    expectTheme('light');
  });

  it('preserves the boot hint until storage is ready, then applies the loaded preference', () => {
    localStorage.setItem(cacheKey, 'dark');
    document.documentElement.dataset.theme = 'dark';
    render('system', false);
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(localStorage.getItem(cacheKey)).toBe('dark');
    render('light');
    expectTheme('light');
    expect(localStorage.getItem(cacheKey)).toBe('light');
  });

  it('still follows the OS when localStorage writes fail', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('unavailable'); });
    render('system');
    changeSystem(true);
    expectTheme('dark');
  });

  it('falls back to light when media queries are unavailable, with fixed dark still usable', () => {
    vi.stubGlobal('matchMedia', undefined);
    render('system');
    expectTheme('light');
    render('dark');
    expectTheme('dark');
  });

  it('cleans up the OS subscription on unmount, including StrictMode remounts', () => {
    render('system');
    expect(listeners.size).toBe(1);
    act(() => root.render(null));
    expect(listeners.size).toBe(0);
  });
});

describe('first paint before React or IndexedDB', () => {
  for (const preference of [null, 'system', 'light', 'dark', 'invalid']) {
    it.each([false, true])(`resolves cached ${preference} with OS dark=%s`, systemDark => {
      dark = systemDark;
      if (preference !== null) localStorage.setItem(cacheKey, preference);
      runInNewContext(bootstrap, {document, window, localStorage});
      expectTheme(preference === 'light' || preference === 'dark' ? preference : dark ? 'dark' : 'light');
    });
  }
  it('uses the OS even when reading the paint hint fails', () => {
    dark = true;
    runInNewContext(bootstrap, {document, window, localStorage: {getItem() { throw new Error('unavailable'); }}});
    expectTheme('dark');
  });
  it('falls back to light without media query support', () => {
    runInNewContext(bootstrap, {document, window: {}, localStorage});
    expectTheme('light');
  });
});
