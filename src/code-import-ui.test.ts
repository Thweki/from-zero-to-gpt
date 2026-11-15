// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CodeLab } from './components/CodeLab';
import { lessonById } from './data/lessons';
import { readPythonFile } from './python-import';

vi.mock('./python-import', () => ({ readPythonFile: vi.fn() }));

let host: HTMLDivElement, root: Root;
const onCode = vi.fn(), onResult = vi.fn();
const worker = { postMessage: vi.fn(), terminate: vi.fn() };
const makeWorker = vi.fn(function () { return worker; });

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('Worker', makeWorker);
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

function render(id: 'functions' | 'linear' = 'functions') {
  act(() => root.render(createElement(CodeLab, {
    lesson: lessonById[id], code: '# my draft', lastRun: '✓ previous result', onCode, onResult,
  })));
}
function button(text: string) {
  const result = [...host.querySelectorAll('button')].find(node => node.textContent?.includes(text));
  expect(result, text).toBeDefined();
  return result!;
}
function click(text: string) { act(() => button(text).click()); }
async function select(name = 'exercise.py') {
  const input = host.querySelector<HTMLInputElement>('input[type=file]')!;
  expect(input).not.toBeNull();
  Object.defineProperty(input, 'files', { configurable: true, value: [new File(['ignored'], name)] });
  await act(async () => { input.dispatchEvent(new Event('change', { bubbles: true })); });
  expect(input.value).toBe(''); // The same file can be selected again.
}

describe('CodeLab file import', () => {
  it('previews escaped source, then applies only on confirmation and clears the old result', async () => {
    const code = '# <script>alert(1)</script>\ndef square(x):\n    return x * x\n';
    vi.mocked(readPythonFile).mockResolvedValue(code);
    render();
    await select();
    expect(host.querySelector('pre[aria-label="文件代码"]')?.textContent).toBe(code);
    expect(host.querySelector('script')).toBeNull();
    expect(onCode).not.toHaveBeenCalled();
    expect(onResult).not.toHaveBeenCalled();
    click('替换当前代码');
    expect(onCode).toHaveBeenCalledExactlyOnceWith(code);
    expect(onResult).toHaveBeenCalledExactlyOnceWith('');
    expect(makeWorker).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(host.querySelector('textarea'));
    expect(host.querySelector('pre[aria-label="文件代码"]')).toBeNull();
  });

  it('cancels without changing draft or result and allows selecting the same file again', async () => {
    vi.mocked(readPythonFile).mockResolvedValue('print(1)');
    render();
    await select();
    click('取消导入');
    expect(host.querySelector('pre[aria-label="文件代码"]')).toBeNull();
    expect(document.activeElement).toBe(host.querySelector('input[type=file]'));
    expect(onCode).not.toHaveBeenCalled();
    expect(onResult).not.toHaveBeenCalled();
    await select();
    expect(button('替换当前代码').disabled).toBe(false);
  });

  it('shows a read error while preserving the existing code and result', async () => {
    vi.mocked(readPythonFile).mockRejectedValue(new Error('请将文件保存为 UTF-8 编码后重试。'));
    render();
    await select();
    expect(host.querySelector('.code-import [role=status]')?.textContent).toContain('UTF-8');
    expect(onCode).not.toHaveBeenCalled();
    expect(onResult).not.toHaveBeenCalled();
    expect(host.querySelector('textarea')?.value).toBe('# my draft');
  });

  it('prevents replacement during a run, then permits it after stopping', async () => {
    vi.mocked(readPythonFile).mockResolvedValue('print(1)');
    render();
    await select();
    click('运行并测试');
    expect(button('替换当前代码').disabled).toBe(true);
    expect(host.querySelector<HTMLInputElement>('input[type=file]')?.disabled).toBe(true);
    click('替换当前代码');
    expect(onCode).not.toHaveBeenCalled();
    click('停止');
    click('替换当前代码');
    expect(onCode).toHaveBeenCalledExactlyOnceWith('print(1)');
    expect(worker.terminate).toHaveBeenCalledOnce();
  });

  it.each(['cancel', 'lesson', 'newer file'] as const)('ignores a late read after %s', async action => {
    let resolve!: (code: string) => void;
    vi.mocked(readPythonFile).mockImplementationOnce(() => new Promise(done => { resolve = done; }));
    render();
    await select('old.py');
    if (action === 'cancel') click('取消导入');
    else if (action === 'lesson') render('linear');
    else {
      vi.mocked(readPythonFile).mockResolvedValueOnce('print("new")');
      await select('new.py');
    }
    await act(async () => resolve('print("old")'));
    expect(host.querySelector('pre[aria-label="文件代码"]')?.textContent ?? '').not.toContain('old');
    if (action === 'newer file') expect(host.querySelector('pre[aria-label="文件代码"]')?.textContent).toBe('print("new")');
    expect(onCode).not.toHaveBeenCalled();
    expect(onResult).not.toHaveBeenCalled();
  });
});
