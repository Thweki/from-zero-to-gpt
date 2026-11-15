// @vitest-environment jsdom
import {act, createElement} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {CodeLab} from './components/CodeLab';
import {lessonById} from './data/lessons';

let container: HTMLDivElement, root: Root;
const onCode = vi.fn(), onResult = vi.fn();
beforeEach(() => {
  Object.assign(globalThis, {IS_REACT_ACT_ENVIRONMENT: true});
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  vi.clearAllMocks();
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});
async function render(code: string, lesson = lessonById.functions) {
  await act(async () => root.render(createElement(CodeLab, {lesson, code, onCode, onResult})));
}
async function toggle(open: boolean) {
  const details = container.querySelector<HTMLDetailsElement>('.code-comparison')!;
  await act(async () => {
    details.open = open;
    details.dispatchEvent(new Event('toggle'));
  });
}

describe('CodeLab starter comparison', () => {
  it('opens an unchanged-code message and never edits or runs the learner code', async () => {
    await render(lessonById.functions.starter);
    expect(container.querySelector('.code-comparison summary')?.textContent).toBe('查看我的改动（与初始代码比较）');
    expect(container.querySelector('.code-comparison p')).toBeNull();
    await toggle(true);
    expect(container.querySelector('.code-comparison p')?.textContent).toBe('与初始代码相同。');
    expect(onCode).not.toHaveBeenCalled();
    expect(onResult).not.toHaveBeenCalled();
  });

  it('updates line counts as code changes and releases the preview on collapse', async () => {
    const starter = lessonById.functions.starter;
    await render(`${starter}\nprint(123)`);
    await toggle(true);
    expect(container.querySelectorAll('[data-change="added"]')).toHaveLength(1);
    expect(container.querySelectorAll('[data-change="removed"]')).toHaveLength(0);
    expect(container.querySelector('.code-comparison p')?.textContent).toContain('新增 1 行 · 删除 0 行');
    await render(starter);
    expect(container.querySelector('table')).toBeNull();
    expect(container.querySelector('.code-comparison p')?.textContent).toBe('与初始代码相同。');
    await render(`${starter}\npass`);
    await toggle(false);
    expect(container.querySelector('table')).toBeNull();
    await toggle(true);
    expect(container.querySelectorAll('[data-change="added"]')).toHaveLength(1);
    expect(onCode).not.toHaveBeenCalled();
    expect(onResult).not.toHaveBeenCalled();
  });

  it('renders code literally, including math delimiters, HTML and indentation', async () => {
    const code = '    print("<script id=\'injected\'>$x$</script>")\n\tpass';
    await render(code);
    await toggle(true);
    const added = [...container.querySelectorAll('[data-change="added"] code')];
    expect(added.map(line => line.textContent)).toEqual(['····print("<script·id=\'injected\'>$x$</script>")', '→   pass']);
    expect(container.querySelector('.code-comparison script, .code-comparison .katex')).toBeNull();
    expect(container.querySelector('textarea')?.value).toBe(code);
    expect(container.querySelector('[role="region"]')?.getAttribute('tabindex')).toBe('0');
  });

  it('leaves large drafts intact, then recovers when the draft is shortened', async () => {
    const code = 'x'.repeat(100_001);
    await render(code);
    await toggle(true);
    expect(container.querySelector('.code-comparison p')?.textContent).toContain('代码较长');
    expect(container.querySelector('table')).toBeNull();
    expect(container.querySelector('textarea')?.value).toBe(code);
    await render('pass');
    expect(container.querySelector('table')).not.toBeNull();
    expect(onCode).not.toHaveBeenCalled();
    expect(onResult).not.toHaveBeenCalled();
  });

  it('uses the new chapter starter when lesson props change', async () => {
    await render('pass');
    await toggle(true);
    await render(lessonById.linear.starter, lessonById.linear);
    expect(container.querySelector('.code-comparison p')?.textContent).toBe('与初始代码相同。');
  });
});
