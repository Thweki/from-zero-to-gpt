import {spawnSync} from 'node:child_process';
import {describe,expect,it} from 'vitest';
import {lessons,lessonById} from './data/lessons';
import {createExerciseExport} from './exercise-export';

it('exports the current attempt verbatim with the matching task and checks',()=>{
  const code='# 我的尝试\r\ndef square(x):\r\n    return x * x';
  const {filename,source}=createExerciseExport(lessonById.functions,code);
  expect(filename).toBe('functions-exercise.py');
  expect(source).toContain(code);
  expect(source).toContain(lessonById.functions.title);
  expect(source).toContain(lessonById.functions.exercise);
  expect(source).not.toContain(lessonById.functions.reference);
  expect(source).toContain('python3 functions-exercise.py');
  expect(source).toContain(lessonById.functions.pythonTests.trim().split('\n').map(line=>`    ${line}`).join('\n'));
  expect(createExerciseExport(lessonById.functions,'').source).not.toContain(lessonById.functions.starter);
});

it('keeps every line of task metadata in comments',()=>{
  const {source}=createExerciseExport({...lessonById.functions,title:'标题\nprint("title")',exercise:'第一行\r\nprint("task")\r末行'},'pass');
  expect(source).toContain('# From Zero to GPT · 01.01 标题');
  expect(source).toContain('\n# print("title")');
  expect(source).toContain('\n# print("task")\n# 末行');
});

const python=process.env.FROM_ZERO_PYTHON||(process.platform==='win32'?'python':'python3');
const available=spawnSync(python,['--version'],{encoding:'utf8'}).status===0;
const run=(source:string,args:string[]=[])=>spawnSync(python,['-I',...args,'-c',source],{encoding:'utf8',timeout:10000});

describe.skipIf(!available)('downloaded scripts run with local Python (set FROM_ZERO_PYTHON to override)',()=>{
  it.each(lessons)('$id: the reference passes the actual exported chapter checks',lesson=>{
    const result=run(createExerciseExport(lesson,lesson.reference).source);
    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('✓ 本章单元测试通过');
  });

  it('fails an incorrect current attempt instead of exporting the reference answer',()=>{
    const result=run(createExerciseExport(lessonById.functions,'def square(x):\n    return x').source);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('AssertionError');
    expect(result.stdout).not.toContain('✓ 本章单元测试通过');
  });

  it('preserves Unicode, future imports and code without a trailing newline',()=>{
    const code='from __future__ import annotations\n标签 = "平方 🌱"\ndef square(x: MissingType):\n    return x * x\nprint(标签)';
    const result=run(createExerciseExport(lessonById.functions,code).source);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('平方 🌱');
  });

  it('never reports passing checks when Python disables assertions',()=>{
    const result=run(createExerciseExport(lessonById.functions,lessonById.functions.reference).source,['-O']);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('请勿使用 -O');
    expect(result.stdout).not.toContain('✓ 本章单元测试通过');
  });

  it('does not claim acceptance when a lesson has no checks',()=>{
    const result=run(createExerciseExport({...lessonById.functions,pythonTests:''},'print("我的代码")').source);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('我的代码');
    expect(result.stdout).toContain('本章没有验收测试');
    expect(result.stdout).not.toContain('✓ 本章单元测试通过');
  });
});
