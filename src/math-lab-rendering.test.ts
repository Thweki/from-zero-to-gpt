// @vitest-environment jsdom
import {act,createElement} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {MathLab} from './components/MathLab';
import {lessonById} from './data/lessons';
import type {LessonId} from './types';

Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});

describe('function plot sampling',()=>{
  let container:HTMLDivElement,root:Root;
  beforeEach(()=>{
    container=document.createElement('div');
    document.body.append(container);
    root=createRoot(container);
  });
  afterEach(()=>{
    act(()=>root.unmount());
    container.remove();
    vi.restoreAllMocks();
  });
  function render(id:LessonId,values:Record<string,number>){
    act(()=>root.render(createElement(MathLab,{lesson:lessonById[id],values,onChange:()=>{}})));
  }
  const points=()=>container.querySelector('polyline')?.getAttribute('points');
  const marker=()=>container.querySelector('[data-testid="function-target"]');

  it('reuses the sampled curve across parent renders and input-marker moves',()=>{
    const from=vi.spyOn(Array,'from');
    // Count full curve sampling passes, rather than relying on noisy timings.
    const samplingPasses=()=>from.mock.calls.filter(([source])=>typeof source==='object'&&'length' in source&&source.length===241).length;
    render('functions',{kind:2,x:2});
    const curve=points(),initialX=marker()!.getAttribute('cx');
    expect(samplingPasses()).toBe(1);
    expect(curve!.split(' ')).toHaveLength(241);

    render('functions',{kind:2,x:2});
    render('functions',{kind:2,x:-1});
    expect(samplingPasses()).toBe(1);
    expect(points()).toBe(curve);
    expect(marker()!.getAttribute('cx')).not.toBe(initialX);
    expect(marker()!.getAttribute('cy')).toBe('223');
    expect(container.querySelector('[data-testid="function-projection"]')!.getAttribute('d')).toBe('M268 275V223H320');
  });

  it('resamples when the selected function or viewport changes',()=>{
    render('functions',{kind:0,x:2});
    const square=points();
    render('functions',{kind:2,x:2});
    const absolute=points();
    expect(absolute).not.toBe(square);
    expect(marker()!.getAttribute('cy')).toBe('171');
    // Restored values outside the slider interval can change the fitted viewport.
    render('functions',{kind:2,x:10});
    expect(points()).not.toBe(absolute);
    expect(marker()!.getAttribute('cx')).toBe('580');
    expect(marker()!.getAttribute('cy')).toBe('15');
  });

  it('updates the curve for slope, intercept, and lesson changes',()=>{
    render('linear',{k:1,b:0});
    const original=points();
    render('linear',{k:2,b:0});
    const steeper=points();
    expect(steeper).not.toBe(original);
    render('linear',{k:2,b:1});
    const shifted=points();
    expect(shifted).not.toBe(steeper);
    render('functions',{k:2,b:1});
    expect(points()).not.toBe(shifted);
  });

  it.each(['vectors','dot-product'] as const)('does not sample an unused function curve in %s',id=>{
    const from=vi.spyOn(Array,'from');
    render(id,{});
    expect(container.querySelector('svg[role="img"]')!.getAttribute('aria-label')).toBe('二维向量坐标图');
    expect(points()).toBeUndefined();
    expect(from.mock.calls.filter(([source])=>typeof source==='object'&&'length' in source&&source.length===241)).toHaveLength(0);
    render('functions',{});
    expect(points()!.split(' ')).toHaveLength(241);
  });
});
