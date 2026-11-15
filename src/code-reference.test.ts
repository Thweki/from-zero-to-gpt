// @vitest-environment jsdom
import {act, createElement} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {CodeLab} from './components/CodeLab';
import {lessonById} from './data/lessons';

class PythonWorker {
  static instances: PythonWorker[] = [];
  onmessage?: (event: {data: {type: string; output?: string; passed?: boolean}}) => void;
  onerror?: () => void;
  postMessage = vi.fn();
  terminate = vi.fn();
  constructor(readonly url: string) { PythonWorker.instances.push(this); }
  emit(data: {type: string; output?: string; passed?: boolean}) { this.onmessage?.({data}); }
}

let container: HTMLDivElement, root: Root;
const onCode = vi.fn(), onResult = vi.fn();
const lesson = lessonById.functions;
const ownCode = 'def square(x):\n    return x\n';
const ownResult = '运行错误\nAssertionError: 请继续尝试';

beforeEach(async () => {
  vi.useFakeTimers();
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('Worker', PythonWorker);
  PythonWorker.instances = [];
  onCode.mockClear(); onResult.mockClear();
  container = document.createElement('div'); document.body.append(container);
  root = createRoot(container);
  await act(async () => { root.render(createElement(CodeLab, {lesson, code: ownCode, lastRun: ownResult, onCode, onResult})); });
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove(); vi.unstubAllGlobals(); vi.useRealTimers();
});

async function click(label: string) {
  const button = [...container.querySelectorAll('button')].find(button => button.textContent?.includes(label));
  expect(button, `missing button: ${label}`).toBeDefined();
  await act(async () => button!.click());
}
async function startReference() {
  await click('对照参考'); await click('运行参考示例');
  return PythonWorker.instances.at(-1)!;
}

describe('run reference examples without changing the learner attempt', () => {
  it('runs the chapter reference and displays its output separately, without exercise credit', async () => {
    expect(PythonWorker.instances).toHaveLength(0);
    const worker = await startReference();
    expect(worker.url).toBe('/python.worker.js');
    expect(worker.postMessage).toHaveBeenCalledWith({code: lesson.reference, tests: lesson.pythonTests});
    await act(async () => worker.emit({type: 'done', passed: true, output: '-2 -> 4\n2 -> 4\n'}));
    expect(container.querySelector('[aria-label="参考示例运行结果"]')?.textContent).toContain('参考示例验收通过');
    expect(container.querySelector('[aria-label="参考示例运行结果"]')?.textContent).toContain('-2 -> 4');
    expect(container.querySelector('textarea')?.value).toBe(ownCode);
    expect(container.textContent).toContain('请继续尝试');
    expect(onCode).not.toHaveBeenCalled(); expect(onResult).not.toHaveBeenCalled();
    expect(worker.terminate).toHaveBeenCalledTimes(1);
  });

  it('can run the learner attempt afterwards with the original credit callback', async () => {
    const reference = await startReference();
    await act(async () => reference.emit({type: 'done', passed: true, output: 'reference output'}));
    await click('运行并测试');
    const own = PythonWorker.instances.at(-1)!;
    expect(own).not.toBe(reference);
    expect(own.postMessage).toHaveBeenCalledWith({code: ownCode, tests: lesson.pythonTests});
    await act(async () => own.emit({type: 'done', passed: true, output: 'own output'}));
    expect(onResult).toHaveBeenCalledExactlyOnceWith('✓ 本章单元测试通过\nown output', ownCode);
    expect(container.querySelector('[aria-label="参考示例运行结果"]')?.textContent).toContain('reference output');
  });

  it.each(['error', 'load', 'timeout', 'stop'] as const)('keeps reference %s feedback out of saved learner results and allows retry', async kind => {
    const worker = await startReference();
    const runButton = [...container.querySelectorAll('button')].find(button => button.textContent?.includes('运行参考示例'))!;
    expect(runButton.disabled).toBe(true);
    let message: string;
    if (kind === 'stop') { await click('停止'); message = '已手动停止'; }
    else if (kind === 'timeout') { await act(async () => vi.advanceTimersByTime(30000)); message = '超过 30 秒'; }
    else if (kind === 'load') { await act(async () => worker.onerror?.()); message = '加载失败'; }
    else { await act(async () => worker.emit({type: 'error', output: 'ValueError: example failed'})); message = 'ValueError'; }
    expect(container.querySelector('[aria-label="参考示例运行结果"]')?.textContent).toContain(message);
    expect(onResult).not.toHaveBeenCalled(); expect(onCode).not.toHaveBeenCalled();
    expect(worker.terminate).toHaveBeenCalledTimes(1);
    await click('运行参考示例');
    const retry = PythonWorker.instances.at(-1)!;
    await act(async () => worker.emit({type: 'done', passed: true, output: 'stale output'}));
    expect(container.textContent).not.toContain('stale output');
    expect(retry.terminate).not.toHaveBeenCalled();
    await act(async () => retry.emit({type: 'done', passed: true, output: 'retry output'}));
    expect(container.querySelector('[aria-label="参考示例运行结果"]')?.textContent).toContain('retry output');
    expect(onResult).not.toHaveBeenCalled();
  });

  it('terminates a reference run when leaving the code lab', async () => {
    const worker = await startReference();
    await act(async () => root.unmount());
    expect(worker.terminate).toHaveBeenCalledTimes(1);
    await act(async () => vi.advanceTimersByTime(30000));
    expect(onResult).not.toHaveBeenCalled();
    root = createRoot(container);
  });
});
