// @vitest-environment jsdom
import {act, createElement} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {RoadmapFilter} from './components/RoadmapFilter';
import {lessons} from './data/lessons';
import graph from './data/knowledge-graph.json';
import {emptyProgress} from './storage';
import type {LearningState, LessonId} from './types';

Object.assign(globalThis, {IS_REACT_ACT_ENVIRONMENT:true});
let container:HTMLDivElement, root:Root;
const navigate = vi.fn();
beforeEach(()=>{
  navigate.mockClear();
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async()=>{await act(async()=>root.unmount());container.remove();});
async function render(progress:LearningState['progress']={}, showDependencies=false){
  await act(async()=>root.render(createElement(RoadmapFilter, {
    progress, navigate, showDependencies, children:createElement('div', {'data-testid':'stages'}, '阶段目录'),
  })));
}
async function select(value:string){
  await act(async()=>{
    const select = container.querySelector('select')!;
    select.value = value;
    select.dispatchEvent(new Event('change', {bubbles:true}));
  });
}
const rows = ()=>[...container.querySelectorAll<HTMLButtonElement>('.chapter-row')];
const count = ()=>container.querySelector('[role="status"]')!.textContent;

describe('roadmap learning-record navigation',()=>{
  it('keeps the stage directory by default and restores it after an empty filter',async()=>{
    await render();
    expect(container.querySelector('[data-testid="stages"]')).not.toBeNull();
    expect(count()).toBe(`全部章节 · ${lessons.length} / ${lessons.length} 章`);
    await select('review');
    expect(container.querySelector('[data-testid="stages"]')).toBeNull();
    expect(rows()).toHaveLength(0);
    expect(count()).toBe(`稍后复习 · 0 / ${lessons.length} 章`);
    expect(container.textContent).toContain('没有符合此筛选的章节');
    await select('all');
    expect(container.querySelector('[data-testid="stages"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="筛选章节"]')).toBeNull();
  });

  it('includes missing and explicitly new records without inferring mastery from evidence',async()=>{
    await render({
      functions:{...emptyProgress(), status:'learning', quizPassed:true, codePassed:true, readCompleted:true},
      linear:{...emptyProgress(), note:'A note alone does not change the stored status.'},
      vectors:{...emptyProgress(), status:'mastered'},
    });
    await select('new');
    expect(rows()).toHaveLength(lessons.length-2);
    expect(rows().some(row=>row.textContent?.includes('线性函数与参数'))).toBe(true);
    expect(rows().some(row=>row.textContent?.includes('函数是什么'))).toBe(false);
    await select('mastered');
    expect(rows()).toHaveLength(1);
    expect(rows()[0].textContent).toContain('向量的基本概念');
    await select('learning');
    expect(rows()).toHaveLength(1);
    expect(rows()[0].textContent).toContain('函数是什么');
  });

  it('finds learning chapters across all six stages in course order, including hidden foundations',async()=>{
    const ids = [graph.nodes.filter(node=>node.stage===1).at(-1)!.id,
      ...[2,3,4,5,6].map(stage=>graph.nodes.find(node=>node.stage===stage)!.id)] as LessonId[];
    const progress:LearningState['progress'] = {};
    for(const id of [...ids].reverse())progress[id] = {...emptyProgress(), status:'learning'};
    const original = JSON.stringify(progress);
    await render(progress);
    await select('learning');
    expect(rows().map(row=>row.querySelector('.chapter-index')!.textContent))
      .toEqual(lessons.filter(lesson=>ids.includes(lesson.id)).map(lesson=>lesson.number));
    expect(count()).toBe(`学习中 · 6 / ${lessons.length} 章`);
    await act(async()=>rows().at(-1)!.click());
    expect(navigate).toHaveBeenCalledExactlyOnceWith(ids.at(-1));
    expect(JSON.stringify(progress)).toBe(original);
  });

  it('treats review bookmarks independently of new, learning, and mastered status',async()=>{
    await render({
      functions:{...emptyProgress(), review:true},
      linear:{...emptyProgress(), status:'learning', review:true},
      vectors:{...emptyProgress(), status:'mastered', review:true},
      python:{...emptyProgress(), status:'learning', note:'Not bookmarked'},
    });
    await select('review');
    expect(rows()).toHaveLength(3);
    expect(rows().map(row=>row.querySelector('.chapter-badge')!.textContent))
      .toEqual(['未开始','学习中','自评掌握']);
  });

  it('updates active results when records are replaced or a bookmark is removed',async()=>{
    await render({functions:{...emptyProgress(), review:true}});
    await select('review');
    expect(rows()).toHaveLength(1);
    await render({linear:{...emptyProgress(), review:true}});
    expect(rows()).toHaveLength(1);
    expect(rows()[0].textContent).toContain('线性函数与参数');
    await render({linear:{...emptyProgress(), review:false}});
    expect(rows()).toHaveLength(0);
    expect(container.querySelector('select')!.value).toBe('review');
  });

  it('preserves the dependency view while filtering chapters',async()=>{
    const progress = {functions:{...emptyProgress(), review:true}, linear:{...emptyProgress(), review:true}};
    await render(progress);
    await select('review');
    expect(container.querySelector('.dependency-text')).toBeNull();
    await render(progress, true);
    expect(rows().map(row=>row.querySelector('.dependency-text')!.textContent))
      .toEqual(['先修：无','先修：函数是什么']);
  });
});
