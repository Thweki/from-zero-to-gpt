// @vitest-environment jsdom
import {act,createElement} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,expect,it,vi} from 'vitest';
import {CodeLab} from './components/CodeLab';
import {lessonById} from './data/lessons';

let root:Root;
afterEach(()=>{
  if(root)act(()=>root.unmount());
  document.body.replaceChildren();
  vi.unstubAllGlobals();
});

it('soft-wraps without editing code, losing selection, clearing results or changing the worker source',()=>{
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
  const postMessage=vi.fn();
  vi.stubGlobal('Worker',class {postMessage=postMessage;terminate=vi.fn();});
  const host=document.createElement('div');document.body.append(host);root=createRoot(host);
  const code='def square(x):\n    # '+ '长注释 '.repeat(100)+'\n    return x * x\n';
  const onCode=vi.fn(),onResult=vi.fn();
  act(()=>root.render(createElement(CodeLab,{lesson:lessonById.functions,code,lastRun:'previous output',onCode,onResult})));
  const editor=host.querySelector('textarea')!;
  const toggle=host.querySelector<HTMLButtonElement>('.code-wrap-toggle')!;
  editor.setSelectionRange(4,18,'backward');
  expect(toggle.getAttribute('aria-pressed')).toBe('false');
  expect(editor.wrap).toBe('off');
  expect(host.querySelectorAll('.line-numbers > div')).toHaveLength(4);
  act(()=>toggle.click());
  expect(toggle.getAttribute('aria-pressed')).toBe('true');
  expect(editor.wrap).toBe('soft');
  expect(host.querySelector('.line-numbers')).toBeNull();
  expect(editor.value).toBe(code);
  expect([editor.selectionStart,editor.selectionEnd,editor.selectionDirection]).toEqual([4,18,'backward']);
  expect(onCode).not.toHaveBeenCalled();expect(onResult).not.toHaveBeenCalled();
  expect(host.querySelector('.code-output')?.textContent).toContain('previous output');
  const run=Array.from(host.querySelectorAll('button')).find(button=>button.textContent?.includes('运行并测试'))!;
  act(()=>run.click());
  expect(postMessage).toHaveBeenCalledWith({code,tests:lessonById.functions.pythonTests});
  act(()=>toggle.click());
  expect(toggle.getAttribute('aria-pressed')).toBe('false');
  expect(editor.wrap).toBe('off');expect(editor.value).toBe(code);
  expect(host.querySelectorAll('.line-numbers > div')).toHaveLength(4);
});
