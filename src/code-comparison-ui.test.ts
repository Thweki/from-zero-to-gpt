// @vitest-environment jsdom
import { act, createElement, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CodeLab } from './components/CodeLab';
import { lessonById } from './data/lessons';

vi.mock('./components/Formula', () => ({ MathContent: ({ children }: { children: ReactNode }) => children }));

let host: HTMLDivElement, root: Root;
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(() => { act(() => root.unmount()); host.remove(); vi.unstubAllGlobals(); });
function click(label: string) {
  const button = [...host.querySelectorAll('button')].find(button => button.textContent === label);
  expect(button, `button ${label}`).toBeDefined();
  act(() => button!.click());
}

describe('CodeLab reference comparison', () => {
  it('opens on demand, updates from the editor, and never runs or overwrites learner work', () => {
    const onCode = vi.fn(), onResult = vi.fn(), worker = vi.fn();
    vi.stubGlobal('Worker', worker);
    const render = (code: string) => act(() => root.render(createElement(CodeLab, {
      lesson: lessonById.functions, code, lastRun: 'previous output', onCode, onResult,
    })));
    render('my_attempt = 1');
    expect(host.querySelector('.code-comparison')).toBeNull();
    click('对照参考');
    expect(host.querySelector('.code-comparison table')).toBeNull();
    click('逐行比较我的代码');
    expect(host.querySelector('[data-kind="mine"] code')?.textContent).toBe('my_attempt = 1');
    expect(host.querySelector('.code-output')?.textContent).toContain('previous output');
    render(lessonById.functions.reference);
    expect(host.querySelector('.code-comparison [role="status"]')?.textContent).toBe('两份代码逐行相同。');
    expect(host.querySelectorAll('[data-kind="mine"], [data-kind="reference"]')).toHaveLength(0);
    click('查看完整参考');
    expect(host.querySelector('.code-comparison pre')?.textContent).toBe(lessonById.functions.reference);
    expect(host.querySelector('textarea')?.value).toBe(lessonById.functions.reference);
    expect(onCode).not.toHaveBeenCalled(); expect(onResult).not.toHaveBeenCalled(); expect(worker).not.toHaveBeenCalled();
  });

  it('renders source as text and labels differences without relying on color', () => {
    act(() => root.render(createElement(CodeLab, {
      lesson: { ...lessonById.functions, reference: 'print("safe")' },
      code: '<img src=x onerror=alert(1)>', onCode: vi.fn(), onResult: vi.fn(),
    })));
    click('对照参考'); click('逐行比较我的代码');
    expect(host.querySelector('img')).toBeNull();
    expect(host.querySelector('[data-kind="mine"]')?.textContent).toContain('仅我的');
    expect(host.querySelector('[data-kind="reference"]')?.textContent).toContain('仅参考');
    expect(host.querySelector('[data-kind="mine"] code')?.textContent).toBe('<img src=x onerror=alert(1)>');
    expect(host.querySelector('.code-comparison-scroll')?.getAttribute('tabindex')).toBe('0');
  });

  it('explains the size limit, preserves the editor and still offers the complete reference', () => {
    const code = '\n'.repeat(501);
    act(() => root.render(createElement(CodeLab, { lesson: lessonById.functions, code, onCode: vi.fn(), onResult: vi.fn() })));
    click('对照参考'); click('逐行比较我的代码');
    expect(host.querySelector('.code-comparison [role="status"]')?.textContent).toContain('代码过长');
    expect(host.querySelector('.code-comparison table')).toBeNull();
    expect(host.querySelector('.code-comparison pre')?.textContent).toBe(lessonById.functions.reference);
    expect(host.querySelector('textarea')?.value).toBe(code);
  });
});
