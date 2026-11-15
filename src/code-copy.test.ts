// @vitest-environment jsdom
import {act,createElement} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {CodeLab} from './components/CodeLab';
import {lessonById} from './data/lessons';

let container:HTMLDivElement,root:Root;
const onCode=vi.fn(),onResult=vi.fn();
const source='\n# 中文与空白\ndef square(x):\n\treturn x ** 2  \n\nprint("<tag> & $x$")\n';
async function render(code=source,lesson=lessonById.functions){
  await act(async()=>root.render(createElement(CodeLab,{lesson,code,lastRun:'saved output',onCode,onResult})));
}
function copyButton(){
  return [...container.querySelectorAll('button')].find(button=>button.textContent==='复制代码')!;
}
async function copy(){await act(async()=>copyButton().click());}
function clipboard(writeText=vi.fn().mockResolvedValue(undefined)){
  Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText}});
  return writeText;
}
function status(){return container.querySelector('.code-description[role="status"]')!;}

beforeEach(()=>{
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
  container=document.createElement('div');document.body.append(container);root=createRoot(container);
  onCode.mockClear();onResult.mockClear();
});
afterEach(async()=>{
  await act(async()=>root.unmount());container.remove();
  Reflect.deleteProperty(navigator,'clipboard');vi.unstubAllGlobals();
});

describe('copy the current lesson code',()=>{
  it('copies the exact edited source, including whitespace and Unicode, without changing learning evidence',async()=>{
    const writeText=clipboard();await render();
    const editor=container.querySelector('textarea')!;editor.setSelectionRange(4,9);
    await copy();
    expect(writeText).toHaveBeenCalledExactlyOnceWith(source);
    expect(status().textContent).toBe('已复制当前代码');
    expect(editor.value).toBe(source);expect(editor.selectionStart).toBe(4);expect(editor.selectionEnd).toBe(9);
    expect(container.querySelector('.code-output pre')?.textContent).toBe('saved output');
    expect(onCode).not.toHaveBeenCalled();expect(onResult).not.toHaveBeenCalled();
  });

  it('clears old confirmation on edit and copies the latest source on the next click',async()=>{
    const writeText=clipboard();await render();await copy();
    await render('new_code = 42\n');expect(status().textContent).toBe('');
    await copy();expect(writeText).toHaveBeenLastCalledWith('new_code = 42\n');
  });

  it.each(['missing','rejected','throws'])('selects the current code for manual copying when clipboard access is %s, then allows retry',async mode=>{
    if(mode==='rejected')clipboard(vi.fn().mockRejectedValue(new Error('denied')));
    if(mode==='throws')clipboard(vi.fn(()=>{throw new Error('unavailable');}));
    await render();await copy();
    const editor=container.querySelector('textarea')!;
    expect(document.activeElement).toBe(editor);
    expect(editor.selectionStart).toBe(0);expect(editor.selectionEnd).toBe(source.length);
    expect(status().textContent).toContain('请使用系统复制命令');
    expect(status().textContent).not.toContain('已复制');
    expect(onCode).not.toHaveBeenCalled();expect(onResult).not.toHaveBeenCalled();
    const writeText=clipboard();await copy();expect(writeText).toHaveBeenCalledWith(source);
    expect(status().textContent).toBe('已复制当前代码');
  });

  it.each(['resolve','reject'])('ignores a stale %s after the learner edits the code',async outcome=>{
    let resolve!:()=>void,reject!:(error:Error)=>void;
    const writeText=clipboard(vi.fn(()=>new Promise<void>((yes,no)=>{resolve=yes;reject=no;})));
    await render();await copy();
    expect(copyButton().disabled).toBe(true);expect(status().textContent).toBe('正在复制…');
    await copy();expect(writeText).toHaveBeenCalledTimes(1);
    await render('changed');expect(copyButton().disabled).toBe(false);
    await act(async()=>{if(outcome==='resolve')resolve();else reject(new Error('denied'));});
    expect(status().textContent).toBe('');expect(document.activeElement).not.toBe(container.querySelector('textarea'));
  });

  it('resets feedback when changing lessons even if their code is identical',async()=>{
    clipboard();await render();await copy();await render(source,lessonById.linear);
    expect(status().textContent).toBe('');
  });

  it('disables copying an empty editor',async()=>{
    const writeText=clipboard();await render('');expect(copyButton().disabled).toBe(true);
    await copy();expect(writeText).not.toHaveBeenCalled();
  });
});
