import type {Lesson} from './types';

/** Export only this editor and its public lesson checks, never learning state. */
export function createExerciseExport(lesson:Pick<Lesson,'id'|'number'|'title'|'exercise'|'pythonTests'>,code:string){
  const filename=`${lesson.id}-exercise.py`;
  const comment=(text:string)=>text.split(/\r\n|\r|\n/).map(line=>`# ${line}`).join('\n');
  const tests=lesson.pythonTests.trim();
  const source=[
    '# -*- coding: utf-8 -*-',
    comment(`From Zero to GPT · ${lesson.number} ${lesson.title}`),
    comment(lesson.exercise),
    `# 运行：python3 ${filename}（Python 3.10+）`,
    '# 修改下方代码后重新运行；本地结果不会自动同步到网页。',
    '# --- 当前编辑器代码 ---',
    code,
    '',
    '# --- 本章验收测试：直接运行文件时执行 ---',
    'if __name__ == "__main__":',
    '    if not __debug__:',
    '        raise RuntimeError("请勿使用 -O：本章验收需要启用 assert。")',
    tests?tests.split('\n').map(line=>`    ${line}`).join('\n'):'    pass',
    tests?'    print("✓ 本章单元测试通过")':'    print("本章没有验收测试；代码已执行。")',
    '',
  ].join('\n');
  return {filename,source};
}

export function downloadExercise(lesson:Parameters<typeof createExerciseExport>[0],code:string){
  const {filename,source}=createExerciseExport(lesson,code);
  const url=URL.createObjectURL(new Blob([source],{type:'text/x-python;charset=utf-8'}));
  const link=document.createElement('a');
  link.href=url;link.download=filename;
  document.body.append(link);
  try{link.click();}
  finally{
    link.remove();
    // Give the browser time to start consuming the download before releasing it.
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
}
