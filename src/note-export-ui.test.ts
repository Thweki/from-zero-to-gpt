// @vitest-environment jsdom
import {act,createElement} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import App from './App';
import {emptyProgress,initialState,readState,writeState} from './storage';
import {downloadNote} from './note-export';

vi.mock('./storage',async importOriginal=>({
  ...await importOriginal<typeof import('./storage')>(),readState:vi.fn(),writeState:vi.fn(),
}));
vi.mock('./note-export',()=>({downloadNote:vi.fn(()=>true)}));
vi.mock('./components/TutorPanel',()=>({TutorPanel:()=>null}));

let root:Root,container:HTMLDivElement;
const button=(label:string,parent:ParentNode=container)=>{
  const found=Array.from(parent.querySelectorAll('button')).find(element=>element.textContent===label);
  expect(found,`button: ${label}`).toBeDefined();
  return found!;
};
async function edit(input:HTMLTextAreaElement,value:string){
  await act(async()=>{
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value')!.set!.call(input,value);
    input.dispatchEvent(new Event('input',{bubbles:true}));
  });
}
async function mount(){await act(async()=>{root.render(createElement(App));});}

beforeEach(()=>{
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
  vi.stubGlobal('matchMedia',()=>({matches:false,addEventListener:vi.fn(),removeEventListener:vi.fn()}));
  vi.stubGlobal('ResizeObserver',class{observe(){} unobserve(){} disconnect(){}});
  vi.spyOn(window,'scrollTo').mockImplementation(()=>{});
  history.replaceState(null,'','/#/notes');
  const state=initialState();
  state.progress.functions={...emptyProgress(),note:'函数笔记',code:'private code',tutorDraft:'private draft'};
  vi.mocked(readState).mockResolvedValue(state);
  vi.mocked(writeState).mockResolvedValue();
  vi.mocked(downloadNote).mockReturnValue(true);
  container=document.createElement('div');document.body.append(container);root=createRoot(container);
});
afterEach(async()=>{
  await act(async()=>{root.unmount();});container.remove();
  vi.restoreAllMocks();vi.unstubAllGlobals();vi.clearAllMocks();
});

describe('note export controls',()=>{
  it('exports the edited card even when a different chapter is selected, without saving again',async()=>{
    await mount();
    const first=container.querySelector('.note-card')!;
    const picker=container.querySelector<HTMLSelectElement>('[aria-label="选择笔记章节"]')!;
    await act(async()=>{picker.value='linear';picker.dispatchEvent(new Event('change',{bubbles:true}));});
    expect(container.querySelectorAll('.note-card')).toHaveLength(2);
    const second=container.querySelectorAll('.note-card')[1]!;
    expect(button('导出笔记 Markdown',second).disabled).toBe(true);
    await edit(first.querySelector('textarea')!,'最新的函数笔记');
    const writes=vi.mocked(writeState).mock.calls.length;
    await act(async()=>{button('导出笔记 Markdown',first).click();});
    expect(downloadNote).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({id:'functions'}),'最新的函数笔记');
    expect(writeState).toHaveBeenCalledTimes(writes);
    expect(first.querySelector('textarea')!.value).toBe('最新的函数笔记');
  });
  it('disables export after clearing the note or replacing it with whitespace',async()=>{
    await mount();
    const card=container.querySelector('.note-card')!;
    for(const value of ['',' \n\t']){
      await edit(card.querySelector('textarea')!,value);
      expect(button('导出笔记 Markdown',card).disabled).toBe(true);
      await act(async()=>{button('导出笔记 Markdown',card).click();});
    }
    expect(downloadNote).not.toHaveBeenCalled();
  });
  it('exports current in-memory text after a storage failure and reports download failures',async()=>{
    vi.mocked(writeState).mockRejectedValue(new Error('storage unavailable'));
    await mount();
    const card=container.querySelector('.note-card')!;
    await edit(card.querySelector('textarea')!,'未保存的思路');
    expect(container.querySelector('[role="alert"]')!.textContent).toContain('自动保存失败');
    await act(async()=>{button('导出笔记 Markdown',card).click();});
    expect(downloadNote).toHaveBeenLastCalledWith(expect.objectContaining({id:'functions'}),'未保存的思路');
    expect(container.querySelector('.toast')!.textContent).toContain('下载已开始');
    vi.mocked(downloadNote).mockImplementationOnce(()=>{throw new Error('download failed');});
    await act(async()=>{button('导出笔记 Markdown',card).click();});
    expect(container.querySelector('.toast')!.textContent).toContain('笔记导出失败');
    expect(card.querySelector('textarea')!.value).toBe('未保存的思路');
  });
  it('exports the selected chapter from the notebook panel',async()=>{
    await mount();
    const picker=container.querySelector<HTMLSelectElement>('[aria-label="选择笔记章节"]')!;
    await act(async()=>{picker.value='linear';picker.dispatchEvent(new Event('change',{bubbles:true}));});
    await act(async()=>{container.querySelector<HTMLButtonElement>('.context-toggle')!.click();});
    await act(async()=>{button('思考笔记').click();});
    const panel=container.querySelector('.context-panel')!;
    expect(button('导出笔记 Markdown',panel).disabled).toBe(true);
    await edit(panel.querySelector('.scratchpad')!,'线性笔记');
    await act(async()=>{button('导出笔记 Markdown',panel).click();});
    expect(downloadNote).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({id:'linear'}),'线性笔记');
  });
});
