// @vitest-environment jsdom
import {act,createElement} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {PrerequisitePath} from './components/PrerequisitePath';
import {emptyProgress} from './storage';
import type {LearningState,LessonId} from './types';

let container:HTMLDivElement,root:Root;
beforeEach(()=>{
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
  container=document.createElement('div');document.body.append(container);
  root=createRoot(container);
});
afterEach(()=>{act(()=>root.unmount());container.remove();vi.unstubAllGlobals();});

function render(lessonId:LessonId,progress:LearningState['progress']={},navigate=vi.fn()){
  act(()=>root.render(createElement(PrerequisitePath,{lessonId,progress,navigate})));
  return navigate;
}
const titles=()=>Array.from(container.querySelectorAll('li strong'),element=>element.textContent);

describe('prerequisite path controls',()=>{
  it('starts collapsed, labels direct and indirect dependencies, and opens the chosen lesson',()=>{
    const navigate=render('dot-product');
    expect(container.querySelector('details')!.open).toBe(false);
    expect(titles()).toEqual(['函数是什么','线性函数与参数','向量的基本概念']);
    expect(container.querySelector('li small')!.textContent).toContain('前置基础');
    expect(container.querySelectorAll('li small')[1].textContent).toContain('直接先修');
    act(()=>container.querySelectorAll('button')[1].click());
    expect(navigate).toHaveBeenCalledExactlyOnceWith('linear');
  });

  it('filters only mastered steps and updates from new progress without changing learner data',()=>{
    const progress:LearningState['progress']={linear:{...emptyProgress(),status:'mastered'},functions:{...emptyProgress(),status:'learning'}};
    const before=structuredClone(progress);
    render('dot-product',progress);
    expect(container.querySelector('summary')!.textContent).toContain('2 / 3');
    expect(container.textContent).toContain('学习中');
    act(()=>container.querySelector('input')!.click());
    expect(titles()).toEqual(['函数是什么','向量的基本概念']);
    expect(progress).toEqual(before);
    render('dot-product',{...progress,vectors:{...emptyProgress(),status:'mastered'},functions:{...emptyProgress(),status:'mastered'}});
    expect(titles()).toEqual([]);
    expect(container.querySelector('[role="status"]')!.textContent).toContain('均已自评掌握');
    expect(container.querySelector('summary')!.textContent).toContain('0 / 3');
    act(()=>container.querySelector('input')!.click());
    expect(titles()).toHaveLength(3);
  });

  it('explains foundation lessons and replaces the path when the target changes',()=>{
    render('dot-product');
    render('functions');
    expect(container.textContent).toContain('无需先修');
    expect(container.textContent).toContain('可以直接从本章开始');
    expect(container.querySelector('input')).toBeNull();
    expect(titles()).toEqual([]);
  });
});
