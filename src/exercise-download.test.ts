// @vitest-environment jsdom
import {act,createElement} from 'react';
import {createRoot} from 'react-dom/client';
import {afterEach,expect,it,vi} from 'vitest';
import {CodeLab} from './components/CodeLab';
import {lessonById} from './data/lessons';
import {createExerciseExport,downloadExercise} from './exercise-export';

afterEach(()=>{vi.useRealTimers();vi.restoreAllMocks();vi.unstubAllGlobals();document.body.replaceChildren();});

it('downloads the latest editor contents without running code or changing learning results',async()=>{
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
  vi.useFakeTimers();
  const createObjectURL=vi.fn((_blob:Blob)=> 'blob:exercise'),revokeObjectURL=vi.fn();
  vi.stubGlobal('URL',{createObjectURL,revokeObjectURL});
  const click=vi.spyOn(HTMLAnchorElement.prototype,'click').mockImplementation(function(this:HTMLAnchorElement){
    expect(this.isConnected).toBe(true);
    expect(this.download).toBe('functions-exercise.py');
  });
  const Worker=vi.fn();vi.stubGlobal('Worker',Worker);
  const onCode=vi.fn(),onResult=vi.fn();
  const host=document.createElement('div');document.body.append(host);
  const root=createRoot(host),lesson=lessonById.functions;
  const props={lesson,onCode,onResult,lastRun:'之前的运行结果'};
  try{
    await act(async()=>root.render(createElement(CodeLab,{...props,code:lesson.starter})));
    const code='# 最新尝试\ndef square(x):\n    return x + 9';
    await act(async()=>root.render(createElement(CodeLab,{...props,code})));
    await act(async()=>host.querySelector<HTMLButtonElement>('[aria-label="下载当前练习（含测试）"]')!.click());
    expect(click).toHaveBeenCalledOnce();
    expect(Worker).not.toHaveBeenCalled();
    expect(onCode).not.toHaveBeenCalled();
    expect(onResult).not.toHaveBeenCalled();
    expect(host.querySelector('textarea')?.value).toBe(code);
    expect(host.querySelector('.code-output')?.textContent).toContain('之前的运行结果');
    expect(document.querySelector('a[download]')).toBeNull();
    expect(revokeObjectURL).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1000);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:exercise');
    vi.useRealTimers();
    const blob=createObjectURL.mock.calls[0][0] as Blob;
    expect(blob.type).toBe('text/x-python;charset=utf-8');
    const source=await new Promise<string>((resolve,reject)=>{
      const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=reject;reader.readAsText(blob);
    });
    expect(source).toBe(createExerciseExport(lesson,code).source);
  }finally{await act(async()=>root.unmount());}
});

it('releases the temporary link and URL even when starting the download fails',()=>{
  vi.useFakeTimers();
  const revokeObjectURL=vi.fn();
  vi.stubGlobal('URL',{createObjectURL:()=> 'blob:failed',revokeObjectURL});
  vi.spyOn(HTMLAnchorElement.prototype,'click').mockImplementation(()=>{throw new Error('download unavailable');});
  expect(()=>downloadExercise(lessonById.functions,'pass')).toThrow('download unavailable');
  expect(document.querySelector('a[download]')).toBeNull();
  vi.runAllTimers();
  expect(revokeObjectURL).toHaveBeenCalledWith('blob:failed');
});
