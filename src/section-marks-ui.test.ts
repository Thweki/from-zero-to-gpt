// @vitest-environment jsdom
import {act,createElement} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {LessonReader} from './components/LessonReader';
import {lessonById} from './data/lessons';
import {emptyProgress} from './storage';
import type {Lesson,LessonProgress} from './types';

vi.mock('./components/LessonLab',()=>({LessonLab:()=>null}));
vi.mock('./components/CodeLab',()=>({CodeLab:()=>null}));

let container:HTMLDivElement,root:Root;
beforeEach(()=>{
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
  vi.stubGlobal('ResizeObserver',class {observe(){} disconnect(){}});
  container=document.createElement('div');document.body.append(container);root=createRoot(container);
});
afterEach(async()=>{await act(()=>root.unmount());container.remove();vi.unstubAllGlobals();});

async function reader(lesson:Lesson=lessonById.functions,initial:LessonProgress=emptyProgress()){
  let progress=initial;
  const patch=vi.fn((value:Partial<LessonProgress>)=>{progress={...progress,...value};render();});
  function render(){root.render(createElement(LessonReader,{lesson,progress,stage:1,patch,navigate:vi.fn(),onCheckpoint:vi.fn(),onObserve:vi.fn()}));}
  await act(render);
  return {patch,progress:()=>progress};
}
const marks=()=>Array.from(container.querySelectorAll<HTMLButtonElement>('.section-understanding'));
async function click(button:HTMLButtonElement){await act(()=>button.click());}

describe('understanding sections in the reader',()=>{
  it('marks and unmarks in place, preserves focus and changes only section evidence',async()=>{
    const initial={...emptyProgress(),note:'keep',code:'print(1)',quizPassed:true,status:'mastered' as const};
    const view=await reader(lessonById.functions,initial);
    expect(marks()).toHaveLength(lessonById.functions.intuition.length);
    const button=marks()[0];button.focus();
    expect(button.getAttribute('aria-pressed')).toBe('false');
    await click(button);
    expect(button.getAttribute('aria-pressed')).toBe('true');
    expect(document.activeElement).toBe(button);
    expect(container.querySelector('.section-understanding-summary')?.textContent).toContain(`1 / ${marks().length}`);
    expect(Object.keys(view.patch.mock.calls[0][0])).toEqual(['understoodSections']);
    expect(view.progress()).toMatchObject(initial);
    await click(button);
    expect(button.getAttribute('aria-pressed')).toBe('false');
    expect(container.querySelector('.section-understanding-summary')?.textContent).toContain(`0 / ${marks().length}`);
  });

  it('keeps modes independent and restores marks on remount',async()=>{
    const section={title:'Same title',paragraphs:['A section.']};
    const lesson={...lessonById.functions,intuition:[section],math:[section],deep:[section]};
    const view=await reader(lesson);
    await click(marks()[0]);
    const tab=(mode:string)=>container.querySelector<HTMLButtonElement>(`#tab-${mode}`)!;
    for(const mode of ['math','deep']){
      await click(tab(mode));expect(marks()[0].getAttribute('aria-pressed')).toBe('false');
      await click(marks()[0]);
    }
    await click(tab('code'));expect(marks()).toHaveLength(0);
    await click(tab('intuition'));expect(marks()[0].getAttribute('aria-pressed')).toBe('true');
    const saved=JSON.parse(JSON.stringify(view.progress()));
    await act(()=>root.unmount());root=createRoot(container);
    await reader(lesson,saved);
    expect(marks()[0].getAttribute('aria-pressed')).toBe('true');
    await reader({...lesson,id:'linear'},emptyProgress());
    expect(marks()[0].getAttribute('aria-pressed')).toBe('false');
  });
});
