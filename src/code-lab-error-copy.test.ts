// @vitest-environment jsdom
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {act,createElement} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {CodeLab} from './components/CodeLab';
import {lessonById} from './data/lessons';

const failure='运行错误\nTraceback (most recent call last):\n  File "experiment.py", line 2\n    missing_name\nNameError: name missing_name is not defined';
const expected='章节：函数是什么 (functions)\n位置：experiment.py:2（用户代码）\n错误：NameError: name missing_name is not defined\n源码：missing_name';
let container:HTMLDivElement,root:Root;
beforeEach(()=>{
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
  container=document.createElement('div');document.body.append(container);root=createRoot(container);
});
afterEach(async()=>{
  await act(async()=>root.unmount());container.remove();
  Reflect.deleteProperty(navigator,'clipboard');vi.unstubAllGlobals();
});
async function render(lastRun=failure,code='print("edited after failure")'){
  await act(async()=>root.render(createElement(CodeLab,{lesson:lessonById.functions,code,lastRun,onCode:()=>{},onResult:()=>{}})));
}
function clipboard(value:unknown){Object.defineProperty(navigator,'clipboard',{configurable:true,value});}
function button(){return [...container.querySelectorAll('button')].find(element=>element.textContent==='复制错误信息')!;}
const status=()=>container.querySelector('.python-error-copy [role="status"]')?.textContent;
const click=async()=>{await act(async()=>button().click());};

describe('lab error copy interaction',()=>{
  it('copies the saved error rather than edited code and resets feedback for another result',async()=>{
    const writeText=vi.fn().mockResolvedValue(undefined);clipboard({writeText});
    await render();await click();
    expect(writeText).toHaveBeenCalledExactlyOnceWith(expected);
    expect(status()).toBe('错误信息已复制');
    await render(failure.replace('missing_name','another_name'));
    expect(status()).toBe('');
    for(const result of ['', '✓ 本章单元测试通过', '已手动停止运行。', '运行已停止：超过 30 秒限制。']){
      await render(result);expect(button()).toBeUndefined();
    }
  });
  it.each(['unavailable','denied'])('provides selectable fallback when clipboard is %s and permits retry',async(mode)=>{
    clipboard(mode==='unavailable'?undefined:{writeText:vi.fn().mockRejectedValue(new Error('denied'))});
    await render();await click();
    expect(status()).toContain('请选择下方文本手动复制');
    const manual=container.querySelector<HTMLTextAreaElement>('[aria-label="可手动复制的错误信息"]')!;
    expect(manual.readOnly).toBe(true);expect(manual.value).toBe(expected);
    manual.focus();expect(manual.value.slice(manual.selectionStart,manual.selectionEnd)).toBe(expected);
    clipboard({writeText:vi.fn().mockResolvedValue(undefined)});await click();
    expect(status()).toBe('错误信息已复制');expect(container.contains(manual)).toBe(false);
  });
  it('waits for clipboard completion and ignores completion from an earlier result',async()=>{
    let finish!:()=>void;
    clipboard({writeText:()=>new Promise<void>(resolve=>{finish=resolve;})});
    await render();await click();
    expect(button().disabled).toBe(true);expect(status()).toBe('正在复制…');
    await render(failure.replace('NameError','ValueError'));
    await act(async()=>finish());
    expect(button().disabled).toBe(false);expect(status()).toBe('');
  });
});
