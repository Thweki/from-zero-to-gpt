// @vitest-environment jsdom
import {act, createElement, useState} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {Flashcards} from './components/Flashcards';
import {lessonById} from './data/lessons';
import type {LessonId} from './types';

Object.assign(globalThis, {IS_REACT_ACT_ENVIRONMENT: true});
let container: HTMLDivElement, root: Root;
beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});
async function mount(ids: LessonId[]) {
  function Harness() {
    const [lessonIds, setIds] = useState(ids);
    return createElement(Flashcards, {lessonIds, onRemove: id => setIds(current => current.filter(item => item !== id))});
  }
  await act(async () => root.render(createElement(Harness)));
}
function button(name: string) {
  const found = [...container.querySelectorAll('button')].find(item => (item.getAttribute('aria-label') || item.textContent) === name);
  if (!found) throw new Error(`Missing button: ${name}`);
  return found;
}
async function click(name: string) { await act(async () => button(name).click()); }
async function filter(id: string) {
  await act(async () => {
    const select = container.querySelector('select')!;
    select.value = id;
    select.dispatchEvent(new Event('change', {bubbles: true}));
  });
}
const answer = () => container.querySelector<HTMLElement>('#flashcard-answer')!;

describe('local flashcard practice', () => {
  it('offers a clear entry point when no chapters have been added', async () => {
    await mount([]);
    expect(container.textContent).toContain('还没有闪卡');
    expect(container.querySelector('a')?.getAttribute('href')).toBe('#/map');
    expect(container.querySelector('#flashcard-answer')).toBeNull();
  });

  it('hides answers until revealed, resets on navigation, and returns keyboard focus to the prompt', async () => {
    await mount(['functions']);
    expect(answer().hidden).toBe(true);
    expect(answer().textContent).not.toContain(lessonById.functions.intuition[0].paragraphs[0]);
    expect(button('上一张').disabled).toBe(true);
    await click('显示答案');
    expect(answer().hidden).toBe(false);
    expect(answer().querySelectorAll('p').length).toBe(lessonById.functions.intuition[0].paragraphs.length);
    expect(button('收起答案').getAttribute('aria-expanded')).toBe('true');
    await click('下一张');
    expect(answer().hidden).toBe(true);
    expect(document.activeElement).toBe(container.querySelector('[aria-label="闪卡练习"] h2'));
    expect(container.querySelector('[role="status"]')?.textContent).toContain('第 2 /');
    await click('上一张');
    expect(answer().hidden).toBe(true);
    for (let i = 1; i < lessonById.functions.intuition.length; i++) await click('下一张');
    await click('显示答案');
    await click('从头再练');
    expect(button('上一张').disabled).toBe(true);
    expect(answer().hidden).toBe(true);
  });

  it('filters to a chapter, hides its answer, and links to the correct source', async () => {
    await mount(['functions', 'linear']);
    await click('显示答案');
    await filter('linear');
    expect(answer().hidden).toBe(true);
    expect(container.querySelector('[role="status"]')?.textContent).toContain(`第 1 / ${lessonById.linear.intuition.length} 张`);
    expect(container.querySelector('.flashcard-controls a')?.getAttribute('href')).toBe('#/lesson/linear');
    await filter('');
    expect(container.querySelector('.flashcard-controls a')?.getAttribute('href')).toBe('#/lesson/functions');
  });

  it('handles removing the active chapter and the final chapter without stale answers', async () => {
    await mount(['functions', 'linear']);
    await filter('linear');
    await click('显示答案');
    await click(`移除闪卡章节：${lessonById.linear.title}`);
    expect(answer().hidden).toBe(true);
    expect(container.querySelector('select')?.value).toBe('');
    expect(container.querySelector('.flashcard-controls a')?.getAttribute('href')).toBe('#/lesson/functions');
    await click(`移除闪卡章节：${lessonById.functions.title}`);
    expect(container.textContent).toContain('还没有闪卡');
    expect(container.querySelector('#flashcard-answer')).toBeNull();
  });
});
