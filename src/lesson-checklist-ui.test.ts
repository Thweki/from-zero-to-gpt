// @vitest-environment jsdom
import {act,createElement} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {LessonChecklist} from './components/LessonChecklist';
import {LessonReader} from './components/LessonReader';
import {emptyProgress} from './storage';
import {lessonById} from './data/lessons';
import type {LessonProgress,ViewMode} from './types';

vi.mock('./components/LessonLab',()=>({LessonLab:()=>null}));
vi.mock('./components/CodeLab',()=>({CodeLab:()=>null}));
let container:HTMLDivElement,root:Root;
beforeEach(()=>{
  Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
  vi.stubGlobal('ResizeObserver',class{observe(){}disconnect(){}});
  container=document.createElement('div');document.body.append(container);root=createRoot(container);
});
afterEach(async()=>{await act(async()=>root.unmount());container.remove();vi.unstubAllGlobals();});
const boxes=()=>Array.from(container.querySelectorAll<HTMLInputElement>('.lesson-checklist input'));

describe('lesson goal checklist',()=>{
  it('ticks and unticks every goal without granting mastery or overwriting other evidence',async()=>{
    const lesson=lessonById.functions;
    const original:LessonProgress={...emptyProgress(),code:'my code',note:'my note',review:true,quizPassed:false,codePassed:true,readCompleted:true};
    let progress=original;
    const patch=vi.fn((change:Partial<LessonProgress>)=>{progress={...progress,...change};render();});
    const render=()=>root.render(createElement(LessonChecklist,{lesson,progress,patch}));
    await act(async()=>render());
    expect(boxes()).toHaveLength(lesson.goals.length);
    expect(boxes().every(box=>!box.checked)).toBe(true);
    for(const box of boxes())await act(async()=>box.click());
    expect(container.querySelector('[role="status"]')?.textContent).toBe(`已勾选 ${lesson.goals.length} / ${lesson.goals.length}`);
    expect(progress).toEqual({...original,completedGoals:lesson.goals});
    expect(patch.mock.calls.every(([change])=>Object.keys(change).join()==='completedGoals')).toBe(true);
    for(const box of boxes())await act(async()=>box.click());
    expect(progress).toEqual({...original,completedGoals:[]});
  });

  it('matches goal text after reordering and leaves changed goals unchecked',async()=>{
    const original=lessonById.functions;
    const lesson={...original,goals:[original.goals[1],original.goals[0],'A new goal']};
    await act(async()=>root.render(createElement(LessonChecklist,{lesson,progress:{...emptyProgress(),completedGoals:[original.goals[0],'A retired goal']},patch:vi.fn()})));
    expect(boxes().map(box=>box.checked)).toEqual([false,true,false]);
    expect(container.querySelector('[role="status"]')?.textContent).toBe('已勾选 1 / 3');
    expect(boxes().map(box=>box.closest('label')?.textContent)).toEqual(lesson.goals);
  });

  it.each<ViewMode>(['intuition','math','code','deep'])('integrates the checklist into the %s reading view',async mode=>{
    const lesson=lessonById.functions;
    await act(async()=>root.render(createElement(LessonReader,{lesson,progress:{...emptyProgress(),mode,completedGoals:[lesson.goals[0]]},stage:1,patch:vi.fn(),navigate:vi.fn(),onCheckpoint:vi.fn(),onObserve:vi.fn()})));
    expect(boxes()).toHaveLength(lesson.goals.length);
    expect(boxes()[0].checked).toBe(true);
    expect(container.querySelectorAll('.lesson-checklist')).toHaveLength(1);
  });
});
