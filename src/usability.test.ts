import {describe,it,expect} from 'vitest';
import {functionPlotScale,axisTicks} from './math-viewport';
import {analyzePythonFailure} from './python-errors';

describe('函数视口覆盖有效参数',()=>{
  it('修复 (-3,9)，并让移动输入时的比例保持稳定',()=>{
    expect(155-9*26).toBeLessThan(5); // Recorded defect in the former fixed viewport.
    const fn=(x:number)=>x*x;
    const unit=functionPlotScale(fn,-3);
    expect(155-9*unit).toBeGreaterThanOrEqual(15);
    expect(functionPlotScale(fn,3)).toBe(unit);
    expect(functionPlotScale(fn,0)).toBe(unit);
  });
  it('所有函数种类与线性参数端点均保持目标圆点在裁剪区域内',()=>{
    const functions=[(x:number)=>x*x,(x:number)=>Math.abs(x)];
    for(const k of [-3,-2,0,1,3])for(const b of [-4,0,4])functions.push((x:number)=>k*x+b);
    for(const fn of functions)for(let i=-30;i<=30;i++){
      const x=i/10,unit=functionPlotScale(fn,x),cx=320+x*unit,cy=155-fn(x)*unit;
      expect(cx).toBeGreaterThan(12);expect(cx).toBeLessThan(625);
      expect(cy).toBeGreaterThan(11);expect(cy).toBeLessThan(299);
    }
  });
  it('动态刻度有限、单调、无重复且不越出视口',()=>{
    for(const unit of [26,130/9,10,.001])for(const half of [130,285]){
      const ticks=axisTicks(half,unit);
      expect(ticks.length).toBeGreaterThan(0);expect(ticks.length).toBeLessThanOrEqual(10);
      expect(new Set(ticks).size).toBe(ticks.length);
      for(const tick of ticks)expect(Math.abs(tick*unit)).toBeLessThanOrEqual(half);
      expect(ticks).toEqual([...ticks].sort((a,b)=>a-b));
    }
  });
});

describe('Python 错误定位与旧记录',()=>{
  it('先定位最内层用户帧，不让无源码的相邻帧被误吞',()=>{
    const raw='运行错误\n打印结果\nTraceback (most recent call last):\n  File "/lib/pyodide/_base.py", line 597\n  File "acceptance_tests.py", line 4\n  File "experiment.py", line 7, in divide\n    return 1 / x\nZeroDivisionError: division by zero\n';
    const e=analyzePythonFailure(raw)!;
    expect(e.line).toBe(7);expect(e.type).toBe('ZeroDivisionError');
    expect(e.location).toContain('用户代码');expect(e.source).toBe('return 1 / x');
    expect(e.stdout).toBe('打印结果');expect(e.explanation).toContain('除数为零');
    expect(e.raw).toContain('/lib/pyodide/_base.py');
  });
  it('语法错误也使用真正的用户行号',()=>{
    const e=analyzePythonFailure('运行错误\n  File "experiment.py", line 2\n    def square(x)\n                 ^\nSyntaxError: expected colon')!;
    expect(e.line).toBe(2);expect(e.type).toBe('SyntaxError');expect(e.source).toBe('def square(x)');
  });
  it('验收断言不是用户代码行号',()=>{
    const e=analyzePythonFailure('运行错误\nTraceback (most recent call last):\n  File "acceptance_tests.py", line 3\n    assert square(2) == 4\nAssertionError')!;
    expect(e.location).toContain('不是用户代码');expect(e.explanation).toContain('验收');expect(e.line).toBe(3);
  });
  it('旧 <exec> 堆栈可展开但不捏造其所属代码',()=>{
    const e=analyzePythonFailure('运行错误\nTraceback (most recent call last):\n  File "<exec>", line 9\nNameError: name nope is not defined')!;
    expect(e.line).toBeUndefined();expect(e.type).toBe('NameError');expect(e.location).toContain('没有可确认');
  });
  it('不把正常结果、手动停止或超时当作 Python 异常',()=>{
    for(const result of ['✓ 本章单元测试通过','已手动停止运行。','运行已停止：超过 30 秒限制。'])expect(analyzePythonFailure(result)).toBeNull();
  });
});
