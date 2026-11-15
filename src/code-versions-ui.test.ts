// @vitest-environment jsdom
import {act, createElement, useState} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {CodeVersions} from './components/CodeVersions';
import {CodeLab} from './components/CodeLab';
import {LessonReader} from './components/LessonReader';
import {emptyProgress} from './storage';
import type {LessonProgress} from './types';
import {lessonById} from './data/lessons';
import {MAX_VERSION_CODE, type CodeVersion} from './code-versions';

let root: Root;
let container: HTMLDivElement;
const version: CodeVersion = {id:'first', name:'原始尝试', code:'print("saved")\n', savedAt:'2026-11-15T12:00:00.000Z'};
const onChange = vi.fn(), onRestore = vi.fn();

beforeEach(() => {
  Object.assign(globalThis, {IS_REACT_ACT_ENVIRONMENT:true});
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});
async function render(code = 'print("draft")', versions: CodeVersion[] = []) {
  await act(async () => root.render(createElement(CodeVersions, {code, versions, onChange, onRestore})));
}
function button(name: string) {
  const result = [...container.querySelectorAll('button')].find(item=>item.textContent===name);
  if (!result) throw new Error(`Button missing: ${name}`);
  return result;
}
async function click(name: string) {await act(async () => button(name).click());}
async function name(value: string) {
  const input = container.querySelector('input')!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
    input.dispatchEvent(new Event('input', {bubbles:true}));
  });
}

describe('code versions controls', () => {
  it('saves an exact, named copy without changing or executing the editor draft', async () => {
    const code = '  # 中文\r\nprint("<script>literal</script>")\n';
    await render(code);
    expect(button('保存当前代码为版本').disabled).toBe(true);
    await name('  循环实现  ');
    await click('保存当前代码为版本');
    const saved = onChange.mock.calls[0][0][0] as CodeVersion;
    expect(saved).toMatchObject({code, name:'循环实现'});
    expect(saved.id).toBeTruthy();
    expect(Number.isFinite(Date.parse(saved.savedAt))).toBe(true);
    expect(onRestore).not.toHaveBeenCalled();
    expect(container.querySelector('input')!.value).toBe('');
    await render(code, [saved]);
    expect(container.querySelector('pre')!.textContent).toBe(code);
    expect(container.querySelector('script')).toBeNull();
    expect(button('恢复到编辑器').disabled).toBe(true);
  });

  it('requires confirmation to restore or delete, and deletion preserves the draft', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    await render('draft', [version]);
    await click('恢复到编辑器');
    await click('删除版本');
    expect(onRestore).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
    confirm.mockReturnValue(true);
    await click('恢复到编辑器');
    expect(onRestore).toHaveBeenCalledExactlyOnceWith(version.code);
    await click('删除版本');
    expect(onChange).toHaveBeenCalledExactlyOnceWith([]);
    expect(onRestore).toHaveBeenCalledTimes(1);
  });

  it('keeps prior versions intact and enforces the count, name and code limits', async () => {
    await render('draft', [version]);
    await name('   ');
    expect(button('保存当前代码为版本').disabled).toBe(true);
    expect(container.querySelector('input')!.maxLength).toBe(60);
    await name('another');
    await click('保存当前代码为版本');
    expect(onChange.mock.calls[0][0][0]).toBe(version);
    expect(onChange.mock.calls[0][0]).toHaveLength(2);
    await name('sixth');
    await render('draft', Array.from({length:5}, (_, i)=>({...version, id:String(i)})));
    expect(button('保存当前代码为版本').disabled).toBe(true);
    await click('保存当前代码为版本');
    expect(onChange).toHaveBeenCalledTimes(1);
    await render('x'.repeat(MAX_VERSION_CODE+1));
    expect(button('保存当前代码为版本').disabled).toBe(true);
    await render('x'.repeat(MAX_VERSION_CODE));
    expect(button('保存当前代码为版本').disabled).toBe(false);
  });

  it('supports empty versions and keyboard save without saving during IME composition', async () => {
    await render('');
    await name('empty');
    const input = container.querySelector('input')!;
    await act(async () => {input.dispatchEvent(new KeyboardEvent('keydown', {key:'Enter', bubbles:true, isComposing:true}));});
    expect(onChange).not.toHaveBeenCalled();
    await act(async () => {input.dispatchEvent(new KeyboardEvent('keydown', {key:'Enter', bubbles:true}));});
    expect(onChange.mock.calls[0][0][0].code).toBe('');
  });

  it('stops the active Python worker and clears stale results when restoring into CodeLab', async () => {
    const terminate = vi.fn(), postMessage = vi.fn(), onCode = vi.fn(), onResult = vi.fn();
    vi.stubGlobal('Worker', class {terminate = terminate; postMessage = postMessage;});
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    await act(async () => root.render(createElement(CodeLab, {
      lesson:lessonById.functions, code:'draft', lastRun:'✓ previous result',
      versions:[version], onVersionsChange:onChange, onCode, onResult,
    })));
    await act(async () => container.querySelector<HTMLButtonElement>('.code-actions .primary')!.click());
    expect(postMessage).toHaveBeenCalledTimes(1);
    await click('恢复到编辑器');
    expect(terminate).toHaveBeenCalledTimes(1);
    expect(onCode).toHaveBeenCalledExactlyOnceWith(version.code);
    expect(onResult).toHaveBeenCalledExactlyOnceWith('');
    expect(container.querySelector('.code-actions')!.textContent).toContain('运行并测试');
  });

  it('restores through LessonReader while preserving other learning evidence and saved versions', async () => {
    vi.stubGlobal('ResizeObserver', class {observe() {} disconnect() {}});
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    let latest: LessonProgress = {...emptyProgress(), mode:'code', code:'draft', lastRun:'✓ earlier result', codePassed:true, readCompleted:true, quizPassed:true, status:'mastered', codeVersions:[version]};
    function Harness() {
      const [progress, setProgress] = useState(latest);
      latest = progress;
      return createElement(LessonReader, {
        lesson:lessonById.functions, progress, stage:1,
        patch:(patch:Partial<LessonProgress>)=>setProgress(current=>({...current, ...patch})),
        navigate:vi.fn(), onCheckpoint:vi.fn(), onObserve:vi.fn(),
      });
    }
    await act(async () => root.render(createElement(Harness)));
    await click('恢复到编辑器');
    expect(container.querySelector<HTMLTextAreaElement>('.code-editor')!.value).toBe(version.code);
    expect(container.querySelector('.code-output')).toBeNull();
    expect(latest).toMatchObject({code:version.code, lastRun:'', codePassed:false, readCompleted:true, quizPassed:true, status:'mastered', codeVersions:[version]});
  });
});
