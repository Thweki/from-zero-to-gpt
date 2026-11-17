import {describe,expect,it} from 'vitest';
import {analyzePythonFailure,formatPythonFailure} from './python-errors';

const lesson={id:'functions',title:'函数是什么'};
const report=(result:string)=>formatPythonFailure(lesson,analyzePythonFailure(result)!);

describe('copyable Python error report',()=>{
  it('includes the chapter and innermost user location without output or runtime frames',()=>{
    expect(report('运行错误\nprinted output\nTraceback (most recent call last):\n  File "/lib/pyodide/_base.py", line 597\n  File "acceptance_tests.py", line 4\n  File "experiment.py", line 7, in divide\n    return 1 / x\nZeroDivisionError: division by zero\n')).toBe(
      '章节：函数是什么 (functions)\n位置：experiment.py:7（用户代码）\n错误：ZeroDivisionError: division by zero\n源码：return 1 / x',
    );
  });
  it('labels acceptance-test locations and handles a message-less exception',()=>{
    expect(report('运行错误\nTraceback (most recent call last):\n  File "acceptance_tests.py", line 3\n    assert square(2) == 4\nAssertionError')).toBe(
      '章节：函数是什么 (functions)\n位置：acceptance_tests.py:3（验收测试，不是用户代码）\n错误：AssertionError\n源码：assert square(2) == 4',
    );
  });
  it('includes syntax errors without requiring a traceback header',()=>{
    expect(report('运行错误\n  File "experiment.py", line 2\n    def square(x)\n                 ^\nSyntaxError: expected colon')).toContain(
      '位置：experiment.py:2（用户代码）\n错误：SyntaxError: expected colon\n源码：def square(x)',
    );
  });
  it('does not invent a file, line or source for legacy traces',()=>{
    expect(report('运行错误\nTraceback (most recent call last):\n  File "<exec>", line 9\nNameError: name nope is not defined')).toBe(
      '章节：函数是什么 (functions)\n位置：没有可确认的用户代码行号\n错误：NameError: name nope is not defined',
    );
  });
});
