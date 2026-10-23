import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import katex from 'katex';
import { stage1Lessons } from './data/stage1';
import { AdvancedMathLab, apply2, multiply2, binomialProbabilities, weightedMoments, descentPath, classifyCriticalPoint } from './components/labs/AdvancedMathLab';

describe('阶段一：数学实验的实际计算', () => {
  it('矩阵组合符合先右后左，且非交换', () => {
    const a: [[number,number],[number,number]] = [[1,2],[0,1]];
    const b: [[number,number],[number,number]] = [[2,0],[3,1]];
    const v: [number,number] = [-1,3];
    expect(multiply2(a,b)).toEqual([[8,2],[3,1]]);
    expect(multiply2(b,a)).toEqual([[2,4],[3,7]]);
    expect(apply2(multiply2(a,b),v)).toEqual(apply2(a,apply2(b,v)));
    expect(apply2([[0,-1],[1,0]],[2,1])).toEqual([-1,2]);
  });
  it('二项概率覆盖边界、归一化、均值和方差', () => {
    expect(binomialProbabilities(3,0.5)).toEqual([0.125,0.375,0.375,0.125]);
    expect(binomialProbabilities(0,0.7)).toEqual([1]);
    expect(binomialProbabilities(3,0)).toEqual([1,0,0,0]);
    expect(binomialProbabilities(3,1)).toEqual([0,0,0,1]);
    const ps=binomialProbabilities(12,0.3), xs=ps.map((_,i)=>i);
    expect(ps.reduce((a,b)=>a+b,0)).toBeCloseTo(1,12);
    const moments=weightedMoments(xs,ps)!;
    expect(moments.mean).toBeCloseTo(3.6,12);
    expect(moments.variance).toBeCloseTo(2.52,12);
    expect(()=>binomialProbabilities(-1,0.5)).toThrow();
  });
  it('权重缩放不改变概率，平移与缩放符合方差规则', () => {
    expect(weightedMoments([-2,6],[1,3])?.mean).toBe(4);
    expect(weightedMoments([-2,6],[10,30])).toEqual(weightedMoments([-2,6],[1,3]));
    expect(weightedMoments([0,2],[1,1])).toMatchObject({mean:1,variance:1,std:1});
    expect(weightedMoments([10,12],[1,1])).toMatchObject({mean:11,variance:1,std:1});
    expect(weightedMoments([0,-6],[1,1])).toMatchObject({mean:-3,variance:9,std:3});
    expect(weightedMoments([1,2],[0,0])).toBeNull();
    expect(()=>weightedMoments([1,2],[1,-1])).toThrow();
  });
  it('梯度下降保留独立历史并暴露振荡与发散', () => {
    const initial:[number,number]=[3,2];
    const path=descentPath(initial,0.1,20);
    expect(path).toHaveLength(21);
    expect(path[1][0]).toBeCloseTo(2.6);
    expect(path[1][1]).toBeCloseTo(0.8);
    expect(initial).toEqual([3,2]);
    expect(path[0]).not.toBe(path[1]);
    const loss=([x,y]:[number,number])=>(x-1)**2+2*(y+1)**2;
    expect(loss(path.at(-1)!)).toBeLessThan(0.001);
    const oscillating=descentPath(initial,0.45,4);
    expect(oscillating[1][1]+1).toBeLessThan(0);
    expect(Math.abs(oscillating[2][1]+1)).toBeLessThan(Math.abs(oscillating[1][1]+1));
    const unstable=descentPath(initial,0.6,8);
    expect(loss(unstable.at(-1)!)).toBeGreaterThan(loss(initial));
    expect(descentPath(initial,0.1,0)).toEqual([[3,2]]);
  });
  it('二阶检验保留驻点和零曲率的区别', () => {
    expect(classifyCriticalPoint(0,8)).toBe('严格局部最小');
    expect(classifyCriticalPoint(0,-4)).toBe('严格局部最大');
    expect(classifyCriticalPoint(0,0)).toBe('二阶检验无法决定');
    expect(classifyCriticalPoint(1,8)).toBe('非驻点');
  });
});

describe('阶段一：完整教材与可渲染实验', () => {
  it('18章及54个公式完整且能严格渲染', () => {
    expect(stage1Lessons).toHaveLength(18);
    for(const lesson of stage1Lessons) {
      expect(lesson.math).toHaveLength(2);
      for(const formula of [lesson.formula,...lesson.math.map(section=>section.formula!)]) {
        expect(()=>katex.renderToString(formula,{throwOnError:true,strict:'error'})).not.toThrow();
      }
    }
  });
  it.each(stage1Lessons)('$id 的默认实验没有NaN或Infinity坐标', lesson => {
    const html=renderToStaticMarkup(createElement(AdvancedMathLab,{lesson,values:{},onChange:()=>{}}));
    expect(html).toContain(lesson.labTask);
    expect(html).toContain('type="range"');
    expect(html).not.toMatch(/NaN|Infinity/);
  });
  it('退化方程、空条件事件、零总权重与不可导点被明确显示', () => {
    const render=(id:string,values:Record<string,number>)=>renderToStaticMarkup(createElement(AdvancedMathLab,{lesson:stage1Lessons.find(l=>l.id===id)!,values,onChange:()=>{}}));
    const no=render('algebra',{a:0,b:2,c:3}),many=render('algebra',{a:0,b:2,c:2});
    expect(no).toContain('无解'); expect(many).toContain('无穷多解');
    expect(no+many).not.toMatch(/NaN|Infinity/);
    expect(render('probability',{prior:0,falsepositive:0})).toContain('阳性概率为0');
    expect(render('variance',{w1:0,w2:0,w3:0})).toContain('无法归一化');
    expect(render('logarithms',{base:1})).toContain('对数未定义');
    expect(render('derivatives',{kind:2,point:0})).toContain('左右导数不同');
    expect(render('limits',{h:0})).toContain('不能除以0');
  });
});
