// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LessonFormula } from './components/LessonFormula';
import { MathContent } from './components/Formula';
import { LessonReader } from './components/LessonReader';
import { lessons } from './data/lessons';
import { emptyProgress } from './storage';

const source = String.raw`\begin{bmatrix}1 & 2 \\ 3 & 4\end{bmatrix} + \frac{\alpha^2}{n}`;
let container: HTMLDivElement, root: Root;
let writeText: ReturnType<typeof vi.fn>;
const button = () => container.querySelector('button')!;
const status = () => container.querySelector('[role="status"]')!.textContent;
const render = async (value = source) => {
  await act(async () => root.render(createElement(MathContent, null, createElement(LessonFormula, { source: value }))));
};
const click = async () => { await act(async () => button().click()); };

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  writeText = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal('navigator', { clipboard: { writeText } });
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

describe('copying lesson formulas', () => {
  it('offers one copy control per displayed formula across every math and deep lesson view', () => {
    for (const lesson of lessons) for (const mode of ['math', 'deep'] as const) {
      const sections: typeof lesson.math = lesson[mode];
      const expected = new Set(sections.map(section => section.formula?.trim()).filter(Boolean));
      if (mode === 'math' && lesson.formula) expected.add(lesson.formula.trim());
      container.innerHTML = renderToStaticMarkup(createElement(LessonReader, {
        lesson, progress: { ...emptyProgress(), mode }, stage: 1,
        patch: vi.fn(), navigate: vi.fn(), onCheckpoint: vi.fn(), onObserve: vi.fn(),
      }));
      const cards = [...container.querySelectorAll('.formula-card,.main-formula')];
      expect(cards.length, `${lesson.id}/${mode}`).toBe(expected.size);
      for (const card of cards) {
        expect(card.querySelectorAll('.formula-copy button').length).toBe(1);
        expect(card.querySelector('button')!.textContent).toBe('复制 LaTeX');
        expect(expected.has(card.querySelector('annotation')!.textContent!.trim())).toBe(true);
      }
    }
    container.innerHTML = '';
  });

  it('copies the exact rendered LaTeX, without delimiters, HTML, or duplicate MathML text', async () => {
    await render();
    expect(container.querySelector('.katex-error')).toBeNull();
    expect(container.querySelector('annotation')!.textContent).toBe(source);
    expect(writeText).not.toHaveBeenCalled();
    await click();
    expect(writeText).toHaveBeenCalledExactlyOnceWith(source);
    expect(status()).toBe('已复制 LaTeX');
    expect(container.querySelector('textarea')).toBeNull();
  });

  it.each(['unavailable', 'rejected', 'throws'])('provides selected, read-only source when clipboard is %s', async failure => {
    if (failure === 'unavailable') vi.stubGlobal('navigator', {});
    else if (failure === 'rejected') writeText.mockRejectedValue(new Error('Denied'));
    else writeText.mockImplementation(() => { throw new Error('Denied'); });
    await render();
    await click();
    expect(status()).toContain('请手动复制');
    expect(status()).not.toContain('已复制');
    const field = container.querySelector('textarea')!;
    expect(field.value).toBe(source);
    expect(field.readOnly).toBe(true);
    expect(document.activeElement).toBe(field);
    expect([field.selectionStart, field.selectionEnd]).toEqual([0, source.length]);
  });

  it('allows retrying after permission failure and waits for the write before reporting success', async () => {
    writeText.mockRejectedValueOnce(new Error('Denied'));
    await render();
    await click();
    let finish!: () => void;
    writeText.mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve; }));
    await click();
    expect(button().getAttribute('aria-disabled')).toBe('true');
    expect(status()).toBe('正在复制…');
    await click();
    expect(writeText).toHaveBeenCalledTimes(2);
    await act(async () => finish());
    expect(button().getAttribute('aria-disabled')).toBe('false');
    expect(status()).toBe('已复制 LaTeX');
    expect(container.querySelector('textarea')).toBeNull();
  });

  it('does not show a late clipboard result on a different formula', async () => {
    let fail!: (error: Error) => void;
    writeText.mockImplementationOnce(() => new Promise<void>((_, reject) => { fail = reject; }));
    await render();
    await click();
    await render('y = x^2');
    await act(async () => fail(new Error('Denied')));
    expect(status()).toBe('');
    expect(container.querySelector('textarea')).toBeNull();
    await click();
    expect(writeText).toHaveBeenLastCalledWith('y = x^2');
    expect(status()).toBe('已复制 LaTeX');
  });

  it('keeps copy feedback local to the selected formula', async () => {
    await act(async () => root.render(createElement('div', null,
      createElement(LessonFormula, { source }),
      createElement(LessonFormula, { source: 'y = x^2' }),
    )));
    await act(async () => container.querySelectorAll('button')[1].click());
    expect(writeText).toHaveBeenCalledExactlyOnceWith('y = x^2');
    expect([...container.querySelectorAll('[role="status"]')].map(node => node.textContent)).toEqual(['', '已复制 LaTeX']);
  });
});
