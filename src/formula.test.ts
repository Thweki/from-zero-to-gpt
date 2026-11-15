// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import katex from 'katex';
import { Formula, MathContent } from './components/Formula';

describe('formula rendering', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
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

  it('reuses KaTeX output when surrounding lesson content rerenders', () => {
    const render = vi.spyOn(katex, 'renderToString');
    const update = (note: string) => act(() => root.render(createElement(MathContent, null,
      createElement('p', null, '函数 f(x)=x²'),
      createElement('textarea', { value: note, readOnly: true }),
    )));
    update('');
    const formula = container.querySelector('[role="math"]')!;
    const html = formula.innerHTML;
    expect(html).toContain('class="katex"');
    expect(render).toHaveBeenCalledOnce();

    for (let i = 1; i <= 10; i++) update('笔记'.repeat(i));

    expect(container.querySelector('textarea')!.value).toBe('笔记'.repeat(10));
    expect(container.querySelector('[role="math"]')!.innerHTML).toBe(html);
    expect(render).toHaveBeenCalledOnce();
  });

  it('regenerates output when the expression or display mode changes', () => {
    const render = vi.spyOn(katex, 'renderToString');
    const update = (children: string, block: boolean) => act(() => root.render(createElement(Formula, { children, block })));
    update('x^2', false);
    const initial = container.innerHTML;
    update('x^3', false);
    expect(render).toHaveBeenCalledTimes(2);
    expect(container.innerHTML).not.toBe(initial);
    expect(container.querySelector('annotation')!.textContent).toBe('x^3');
    expect(container.querySelector('[role="math"]')!.getAttribute('aria-label')).toBe('x^3');

    update('x^3', true);
    expect(render).toHaveBeenCalledTimes(3);
    expect(container.querySelector('.formula.block .katex-display')).not.toBeNull();
    update('x^3', false);
    expect(render).toHaveBeenCalledTimes(4);
    expect(container.querySelector('.katex-display')).toBeNull();
  });

  it('updates the accessible label without regenerating unchanged math', () => {
    const render = vi.spyOn(katex, 'renderToString');
    const update = (label?: string) => act(() => root.render(createElement(Formula, { children: 'x^2', label })));
    update('平方');
    const html = container.querySelector('[role="math"]')!.innerHTML;
    update('x squared');
    expect(container.querySelector('[role="math"]')!.getAttribute('aria-label')).toBe('x squared');
    expect(container.querySelector('[role="math"]')!.innerHTML).toBe(html);
    update();
    expect(container.querySelector('[role="math"]')!.getAttribute('aria-label')).toBe('x^2');
    expect(render).toHaveBeenCalledOnce();
  });
});
