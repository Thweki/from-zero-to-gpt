// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import {act, createElement, useState, type ReactNode} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {LessonReader} from './components/LessonReader';
import {lessonById} from './data/lessons';
import {emptyProgress, initialState, readState, writeState} from './storage';
import {headingId, readingHeadings, type HeadingBookmark} from './heading-bookmarks';
import type {LessonProgress} from './types';

vi.mock('./components/LessonLab', () => ({LessonLab:() => null}));
vi.mock('./components/CodeLab', () => ({CodeLab:() => null}));
vi.mock('./components/ProjectDownload', () => ({ProjectDownload:() => null}));
vi.mock('./components/Formula', () => ({Formula:() => null, MathContent:({children}:{children:ReactNode}) => children}));

let root:Root;
let container:HTMLDivElement;
let progress:LessonProgress;
const scroll = vi.fn();
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('ResizeObserver', class {observe() {} disconnect() {}});
  vi.stubGlobal('matchMedia', () => ({matches:true}));
  Object.defineProperty(document, 'fonts', {configurable:true, value:{ready:Promise.resolve()}});
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {configurable:true, value:scroll});
  scroll.mockClear();
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function render(initial:LessonProgress) {
  function Reader() {
    const [value, setValue] = useState(initial);
    progress = value;
    return createElement(LessonReader, {lesson:lessonById.functions, progress:value, stage:1,
      patch:patch => setValue(previous => ({...previous, ...patch})), navigate:vi.fn(), onCheckpoint:vi.fn(), onObserve:vi.fn()});
  }
  await act(async () => root.render(createElement(Reader)));
}
function button(name:string):HTMLButtonElement {
  const found = [...container.querySelectorAll('button')].find(element => (element.getAttribute('aria-label') ?? element.textContent) === name);
  expect(found, name).toBeDefined();
  return found!;
}
async function click(name:string) {await act(async () => button(name).click());}
async function rename(name:string) {
  const input = container.querySelector('input')!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, name);
    input.dispatchEvent(new Event('input', {bubbles:true}));
  });
}

describe('reader heading bookmark integration', () => {
  it('captures a scrolled heading, saves through IndexedDB, switches mode to jump, renames and removes', async () => {
    await render({...emptyProgress(), mode:'math', review:true});
    const targets = readingHeadings(lessonById.functions, 'math');
    const destination = document.getElementById(headingId(targets[1]))!;
    for (const [index, target] of targets.entries()) {
      vi.spyOn(document.getElementById(headingId(target))!, 'getBoundingClientRect').mockReturnValue({top:index * 300 - 300} as DOMRect);
    }
    await click('段落书签（0）');
    expect(document.activeElement).toBe(container.querySelector('input'));
    await rename('  ');
    expect(button('保存当前位置').disabled).toBe(true);
    await rename('重新推导');
    await click('保存当前位置');
    expect(progress.headingBookmarks).toEqual([{...targets[1], name:'重新推导'}]);
    expect(progress.review).toBe(true);
    const state = initialState();
    state.progress.functions = progress;
    await writeState(state);
    expect((await readState()).progress.functions?.headingBookmarks).toEqual(progress.headingBookmarks);
    await click('关闭书签');
    await click('深入研究');
    expect(document.getElementById(destination.id)).toBeNull();
    await click('段落书签（1）');
    await click('跳到书签：重新推导');
    await act(async () => {await new Promise(resolve => requestAnimationFrame(resolve));});
    expect(progress.mode).toBe('math');
    expect(document.activeElement?.id).toBe(destination.id);
    expect(scroll).toHaveBeenCalledWith({block:'start', behavior:'instant'});
    expect(container.querySelector('#heading-bookmark-panel')).toBeNull();
    await click('段落书签（1）');
    await rename('新的名字');
    await click('更新书签名称');
    expect(progress.headingBookmarks).toEqual([{...targets[1], name:'新的名字'}]);
    await click('删除书签：新的名字');
    expect(progress.headingBookmarks).toEqual([]);
    expect(document.activeElement).toBe(container.querySelector('input'));
    await act(async () => container.querySelector('input')!.dispatchEvent(new KeyboardEvent('keydown', {key:'Escape', bubbles:true})));
    expect(document.activeElement).toBe(button('段落书签（0）'));
  });

  it('makes stale destinations unavailable and enforces the per-lesson limit without preventing deletion', async () => {
    const bookmarks:HeadingBookmark[] = Array.from({length:30}, (_, occurrence) => ({mode:'deep', heading:'旧标题', occurrence, name:`旧书签 ${occurrence}`}));
    await render({...emptyProgress(), headingBookmarks:bookmarks});
    await click('段落书签（30）');
    expect(button('保存当前位置').disabled).toBe(true);
    expect(button('跳到书签：旧书签 0').disabled).toBe(true);
    expect(container.textContent).toContain('标题已变更，无法定位');
    await click('删除书签：旧书签 0');
    expect(progress.headingBookmarks).toHaveLength(29);
    expect(button('保存当前位置').disabled).toBe(false);
    await rename('<img src=x onerror=alert(1)>');
    await click('保存当前位置');
    expect(progress.headingBookmarks).toHaveLength(30);
    expect(container.querySelector('.heading-bookmark-panel img')).toBeNull();
    expect(button('跳到书签：<img src=x onerror=alert(1)>').disabled).toBe(false);
  });
});
