// @vitest-environment jsdom
import {act,createElement} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {ChapterRestore} from './components/ChapterRestore';
import {emptyProgress,initialState} from './storage';

let host:HTMLDivElement,root:Root;
beforeEach(()=>{
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
  host=document.createElement('div');document.body.append(host);root=createRoot(host);
});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();vi.unstubAllGlobals();});
const backup=()=>({...initialState(),progress:{functions:{...emptyProgress(),note:'restored'},vectors:{...emptyProgress(),code:'print(1)'}}});
const button=(text:string)=>[...host.querySelectorAll('button')].find(el=>el.textContent?.includes(text))!;
const click=async(element:HTMLElement)=>{await act(async()=>element.click());};
async function upload(value:unknown,size=100){
  const input=host.querySelector<HTMLInputElement>('input[type=file]')!;
  Object.defineProperty(input,'files',{configurable:true,value:[{size,text:async()=>JSON.stringify(value)}]});
  await act(async()=>{input.dispatchEvent(new Event('change',{bubbles:true}));});
}

describe('chapter restore preview',()=>{
  it('previews backup records without restoring, then submits only checked chapters',async()=>{
    const onRestore=vi.fn(async()=>{}),current=initialState();current.progress.functions=emptyProgress();
    await act(async()=>root.render(createElement(ChapterRestore,{current,onRestore})));
    await upload(backup());
    expect(host.textContent).toContain('替换现有记录');expect(host.textContent).toContain('新增记录');
    expect(host.querySelectorAll('input[type=checkbox]:checked')).toHaveLength(0);
    expect(button('恢复所选章节').disabled).toBe(true);expect(onRestore).not.toHaveBeenCalled();
    await click(host.querySelector<HTMLInputElement>('input[type=checkbox]')!);
    await click(button('恢复所选章节'));
    expect(onRestore).toHaveBeenCalledWith(expect.objectContaining({progress:backup().progress}),['functions']);
    expect(host.textContent).toContain('已恢复 1 个章节');
    expect(host.querySelector('[aria-label="章节恢复预览"]')).toBeNull();
    expect(document.activeElement).toBe(button('选择章节备份'));
  });

  it('supports select all, clear, cancel and loading another backup with no stale selections',async()=>{
    const onRestore=vi.fn(async()=>{});
    await act(async()=>root.render(createElement(ChapterRestore,{current:initialState(),onRestore})));
    await upload(backup());await click(button('全选章节'));
    expect(host.querySelectorAll('input:checked')).toHaveLength(2);
    await click(button('清空选择'));expect(button('恢复所选章节').disabled).toBe(true);
    await click(button('全选章节'));await click(button('取消恢复'));
    expect(onRestore).not.toHaveBeenCalled();expect(document.activeElement).toBe(button('选择章节备份'));
    await upload(backup());expect(host.querySelectorAll('input:checked')).toHaveLength(0);
  });

  it('retains the selection on write failure and allows retry without duplicate pending submissions',async()=>{
    let rejectSave:(error:Error)=>void=()=>{};
    const onRestore=vi.fn(()=>new Promise<void>((_,reject)=>{rejectSave=reject;}));
    await act(async()=>root.render(createElement(ChapterRestore,{current:initialState(),onRestore})));
    await upload(backup());await click(button('全选章节'));await click(button('恢复所选章节'));
    expect(button('恢复所选章节').disabled).toBe(true);expect(button('取消恢复').disabled).toBe(true);
    await click(button('恢复所选章节'));expect(onRestore).toHaveBeenCalledTimes(1);
    await act(async()=>rejectSave(new Error('disk full')));
    expect(host.querySelector('[role=alert]')?.textContent).toContain('恢复失败');
    expect(host.querySelectorAll('input:checked')).toHaveLength(2);
    onRestore.mockResolvedValueOnce();await click(button('恢复所选章节'));
    expect(onRestore).toHaveBeenCalledTimes(2);expect(host.textContent).toContain('已恢复 2 个章节');
  });

  it('handles empty, malformed and oversized backups without offering a restore',async()=>{
    const onRestore=vi.fn(async()=>{});
    await act(async()=>root.render(createElement(ChapterRestore,{current:initialState(),onRestore})));
    await upload(initialState());expect(host.textContent).toContain('没有可恢复的章节');
    expect(button('恢复所选章节').disabled).toBe(true);
    await upload({version:99});expect(host.querySelector('[role=alert]')?.textContent).toContain('不支持');
    expect(host.querySelector('[aria-label="章节恢复预览"]')).toBeNull();
    await upload(backup(),67108865);expect(host.querySelector('[role=alert]')?.textContent).toContain('64 MB');
    expect(onRestore).not.toHaveBeenCalled();
  });
});
