// @vitest-environment jsdom
import {act,createElement} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {LessonReader} from './components/LessonReader';
import {lessonById} from './data/lessons';
import {emptyProgress} from './storage';
import type {Lesson,ViewMode} from './types';

vi.mock('./components/LessonLab',()=>({LessonLab:()=>null}));
vi.mock('./components/CodeLab',()=>({CodeLab:()=>null}));
vi.mock('./components/ProjectDownload',()=>({ProjectDownload:()=>null}));

let container:HTMLDivElement,root:Root;
const patch=vi.fn();
function render(mode:ViewMode='intuition',lesson:Lesson=lessonById.functions){
  act(()=>root.render(createElement(LessonReader,{key:lesson.id,lesson,progress:{...emptyProgress(),mode},stage:1,patch,navigate:vi.fn(),onCheckpoint:vi.fn(),onObserve:vi.fn(),readerFont:{size:'standard',saveError:false,changeSize:vi.fn()}})));
}
function buttons(){return [...container.querySelectorAll<HTMLButtonElement>('button[aria-label^="复制引用："]')];}
async function click(button=buttons()[0]){await act(async()=>button.click());}
beforeEach(()=>{
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
  vi.stubGlobal('ResizeObserver',class {observe(){}disconnect(){}});
  container=document.createElement('div');document.body.append(container);root=createRoot(container);
  history.replaceState(null,'','/?private=fixture#/lesson/functions');
  patch.mockClear();
});
afterEach(()=>{
  act(()=>root.unmount());container.remove();vi.unstubAllGlobals();vi.restoreAllMocks();
});
function clipboard(writeText:ReturnType<typeof vi.fn>|undefined){
  Object.defineProperty(navigator,'clipboard',{configurable:true,value:writeText?{writeText}:undefined});
}

describe('citation controls in the lesson reader',()=>{
  it.each(['intuition','math','deep','code'] as const)('copies the chosen %s heading, without changing progress or the URL',async mode=>{
    const writeText=vi.fn().mockResolvedValue(undefined);clipboard(writeText);render(mode);
    const headings=mode==='code'?['本章编程任务']:lessonById.functions[mode].map(section=>section.title);
    expect(buttons()).toHaveLength(headings.length);
    const href=location.href;
    for(let index=0;index<headings.length;index++){
      await click(buttons()[index]);
      const copied=writeText.mock.calls.at(-1)![0] as string;
      expect(copied).toContain(`从零到 GPT · ${lessonById.functions.number} ${lessonById.functions.title} — `);
      expect(copied).toContain(` / ${headings[index]}\n`);
      expect(copied).toMatch(/\/#\/lesson\/functions$/);
      expect(copied).not.toContain('private');
      expect(buttons()[index].parentElement?.textContent).toContain('引用已复制');
    }
    expect(patch).not.toHaveBeenCalled();expect(location.href).toBe(href);
  });
  it.each(['missing','denied','throws'])('selects a manual citation when clipboard is %s and allows retry',async failure=>{
    const writeText=vi.fn();
    if(failure==='denied')writeText.mockRejectedValue(new Error('denied'));
    else writeText.mockImplementation(()=>{throw new Error('unavailable');});
    clipboard(failure==='missing'?undefined:writeText);render();await click();
    const field=container.querySelector('textarea')!;
    expect(field.readOnly).toBe(true);expect(document.activeElement).toBe(field);
    expect(field.selectionStart).toBe(0);expect(field.selectionEnd).toBe(field.value.length);
    expect(field.value).toContain(` / ${lessonById.functions.intuition[0].title}\n`);
    expect(container.querySelector('.lesson-citation [role="status"]')?.textContent).toContain('无法自动复制');
    clipboard(writeText.mockResolvedValue(undefined));await click();
    expect(writeText).toHaveBeenLastCalledWith(field.value);
    expect(container.querySelector('.lesson-citation textarea')).toBeNull();
    expect(container.querySelector('.lesson-citation [role="status"]')?.textContent).toBe('引用已复制');
  });
  it('disables duplicate writes while pending and clears feedback on mode and lesson changes',async()=>{
    let finish!:()=>void;
    const writeText=vi.fn(()=>new Promise<void>(resolve=>{finish=resolve;}));clipboard(writeText);render();
    await click();expect(buttons()[0].disabled).toBe(true);await click();expect(writeText).toHaveBeenCalledTimes(1);
    render('math');expect(container.textContent).not.toContain('正在复制');
    await act(async()=>finish());expect(container.textContent).not.toContain('引用已复制');
    clipboard(vi.fn().mockResolvedValue(undefined));await click();expect(container.textContent).toContain('引用已复制');
    render('math',lessonById.linear);expect(container.textContent).not.toContain('引用已复制');
  });
});
