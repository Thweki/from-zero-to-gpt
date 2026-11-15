// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { emptyProgress, initialState, readState, writeState } from './storage';

vi.mock('./storage', async importOriginal => ({
  ...await importOriginal<typeof import('./storage')>(),
  readState: vi.fn(), writeState: vi.fn().mockResolvedValue(undefined),
}));

let root: Root, container: HTMLDivElement;
const queryInput = () => container.querySelector<HTMLInputElement>('#personal-note-query')!;
const results = () => container.querySelector('#note-search-results')!;
const status = () => container.querySelector('#note-search-status')!.textContent;
async function fill(input: HTMLInputElement | HTMLTextAreaElement, text: string) {
  await act(async () => {
    const prototype = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(input, text);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}
async function click(button: HTMLButtonElement) { await act(async () => { button.click(); }); }

beforeEach(async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { callback(0); return 0; });
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() });
  window.history.replaceState(null, '', '/#/notes');
  const state = initialState();
  state.progress.functions = { ...emptyProgress(), note: 'Attention：我的思考', code: 'keep code', review: true };
  state.progress.vectors = { ...emptyProgress(), note: 'İ🧠 ' + '前文'.repeat(100) + 'ATTENTION <img src=x> 我的向量理解' };
  vi.mocked(readState).mockResolvedValue(state);
  vi.mocked(writeState).mockClear().mockResolvedValue(undefined);
  container = document.createElement('div'); document.body.append(container);
  root = createRoot(container);
  await act(async () => { root.render(createElement(App)); });
});

afterEach(async () => {
  await act(async () => { root.unmount(); });
  container.remove();
  delete (HTMLElement.prototype as { scrollIntoView?: unknown }).scrollIntoView;
  vi.restoreAllMocks(); vi.unstubAllGlobals();
});

describe('notes page search integration', () => {
  it('renders safe excerpts and opens the matching original editor without changing notes or code', async () => {
    const savesBeforeSearch = vi.mocked(writeState).mock.calls.length;
    await fill(queryInput(), ' attention ');
    expect(status()).toBe('找到 2 篇笔记');
    expect([...results().querySelectorAll('mark')].map(node => node.textContent)).toEqual(['Attention', 'ATTENTION']);
    expect(results().querySelector('img')).toBeNull();
    expect(results().textContent).toContain('<img src=x>');
    expect(vi.mocked(writeState).mock.calls).toHaveLength(savesBeforeSearch);
    await click(results().querySelectorAll<HTMLButtonElement>('button')[1]);
    const editor = container.querySelector<HTMLTextAreaElement>('[data-note-id="vectors"] textarea')!;
    expect(document.activeElement).toBe(editor);
    expect(editor.value.slice(editor.selectionStart, editor.selectionEnd)).toBe('ATTENTION');
    expect(editor.scrollIntoView).toHaveBeenCalled();
    expect(container.querySelector<HTMLSelectElement>('select[aria-label="选择笔记章节"]')!.value).toBe('vectors');
    const state = vi.mocked(writeState).mock.calls.at(-1)![0];
    expect(state.progress.functions).toMatchObject({ note: 'Attention：我的思考', code: 'keep code', review: true });
    expect(state.progress.vectors!.note).toBe(editor.value);
  });

  it('updates results after editing and deleting text and clears back to the search input', async () => {
    await fill(queryInput(), 'attention');
    const editor = container.querySelector<HTMLTextAreaElement>('[data-note-id="vectors"] textarea')!;
    await fill(editor, '新的理解');
    expect(status()).toBe('找到 1 篇笔记');
    await fill(queryInput(), '新的');
    expect(results().querySelector('mark')!.textContent).toBe('新的');
    await fill(editor, '');
    expect(status()).toContain('没有找到匹配的笔记');
    await click(container.querySelector<HTMLButtonElement>('.note-search-controls button')!);
    expect(queryInput().value).toBe('');
    expect(document.activeElement).toBe(queryInput());
    expect(results().children).toHaveLength(0);
    expect(status()).toContain('搜索仅在本地进行');
  });

  it('supports Escape and blank queries without hiding the existing notes', async () => {
    await fill(queryInput(), 'missing phrase');
    expect(status()).toContain('没有找到匹配的笔记');
    expect(container.querySelectorAll('.note-card')).toHaveLength(2);
    await act(async () => { queryInput().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); });
    expect(queryInput().value).toBe('');
    expect(document.activeElement).toBe(queryInput());
    await fill(queryInput(), '   ');
    expect(results().children).toHaveLength(0);
    expect(status()).toContain('搜索仅在本地进行');
  });
});
