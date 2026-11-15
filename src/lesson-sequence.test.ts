// @vitest-environment jsdom
import {act,createElement,useState} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {AdjacentLessons} from './components/AdjacentLessons';
import {LessonReader} from './components/LessonReader';
import {lessons} from './data/lessons';
import {emptyProgress} from './storage';
import graph from './data/knowledge-graph.json';
import type {LessonId} from './types';

let container:HTMLDivElement,root:Root;
beforeEach(()=>{
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
  container=document.createElement('div');document.body.append(container);
  root=createRoot(container);
});
afterEach(async()=>{await act(()=>root.unmount());container.remove();vi.unstubAllGlobals();});
const button=(direction:'上一章'|'下一章')=>container.querySelector<HTMLButtonElement>(`button[aria-label^="${direction}"]`);

describe('adjacent lesson navigation',()=>{
  it('lets learners traverse the entire curriculum in both directions, including every stage boundary',async()=>{
    const visited:LessonId[]=[];
    function Reader(){
      const [lessonId,setLessonId]=useState<LessonId>(lessons[0].id);
      return createElement(AdjacentLessons,{lessonId,position:'顶部',onNavigate:id=>{visited.push(id);setLessonId(id);}});
    }
    await act(()=>root.render(createElement(Reader)));
    expect(container.querySelector('nav')?.getAttribute('aria-label')).toBe('课程顺序 · 顶部');
    expect(container.textContent).toContain('已是第一章');
    expect(button('上一章')).toBeNull();
    for(const lesson of lessons.slice(1)){
      expect(button('下一章')?.getAttribute('aria-label')).toBe(`下一章 · ${lesson.number} ${lesson.title}`);
      await act(()=>button('下一章')!.click());
    }
    expect(visited).toEqual(graph.nodes.slice(1).map(node=>node.id));
    expect(button('下一章')).toBeNull();
    expect(container.querySelector('a')?.getAttribute('href')).toBe('#/map');
    expect(container.querySelector('a')?.textContent).toContain('回到学习路线');
    visited.length=0;
    for(const lesson of lessons.slice(0,-1).reverse()){
      expect(button('上一章')?.getAttribute('aria-label')).toBe(`上一章 · ${lesson.number} ${lesson.title}`);
      await act(()=>button('上一章')!.click());
    }
    expect(visited).toEqual(graph.nodes.slice(0,-1).reverse().map(node=>node.id));
    expect(button('上一章')).toBeNull();
  });

  it('uses the current lesson after an external selection and navigates only on explicit activation',async()=>{
    const onNavigate=vi.fn();
    await act(()=>root.render(createElement(AdjacentLessons,{lessonId:'functions',position:'底部',onNavigate})));
    await act(()=>root.render(createElement(AdjacentLessons,{lessonId:'linear',position:'底部',onNavigate})));
    expect(onNavigate).not.toHaveBeenCalled();
    expect(container.querySelector('nav')?.getAttribute('aria-label')).toBe('课程顺序 · 底部');
    await act(()=>button('上一章')!.click());
    expect(onNavigate).toHaveBeenCalledExactlyOnceWith('functions');
    onNavigate.mockClear();
    await act(()=>button('下一章')!.click());
    expect(onNavigate).toHaveBeenCalledExactlyOnceWith('python');
  });

  it.each(['intuition','math','code','deep'] as const)('offers both controls in %s mode without marking learning evidence or resetting work',async mode=>{
    vi.stubGlobal('ResizeObserver',class{observe(){}disconnect(){}});
    const lesson=lessons[1],navigate=vi.fn(),patch=vi.fn();
    const progress={...emptyProgress(),mode,code:'draft = 42',note:'Keep this thought',labValues:{k:2}};
    await act(()=>root.render(createElement(LessonReader,{lesson,progress,stage:1,patch,navigate,onCheckpoint:vi.fn(),onObserve:vi.fn()})));
    expect(container.querySelector('h1')?.tabIndex).toBe(-1);
    for(const position of ['顶部','底部']){
      const nav=container.querySelector(`nav[aria-label="课程顺序 · ${position}"]`)!;
      expect(nav).not.toBeNull();
      const controls=nav.querySelectorAll('button');
      expect(controls).toHaveLength(2);
      await act(()=>controls[0].click());
      expect(navigate).toHaveBeenLastCalledWith('functions',true);
      await act(()=>controls[1].click());
      expect(navigate).toHaveBeenLastCalledWith('python',true);
    }
    expect(patch).not.toHaveBeenCalled();
    expect(container.querySelector('[role="tabpanel"]')?.getAttribute('data-mode')).toBe(mode);
    if(mode==='code')expect(container.querySelector('textarea')?.value).toBe('draft = 42');
  });
});
