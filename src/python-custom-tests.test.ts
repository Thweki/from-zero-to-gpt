import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {describe,expect,it,vi} from 'vitest';
import {emptyProgress,initialState,validateImport} from './storage';
import {analyzePythonFailure} from './python-errors';

const workerSource=readFileSync(new URL('../public/python.worker.js',import.meta.url),'utf8');
async function runWorker(customTests?:string,failAt?:string){
  const messages:Record<string,unknown>[]=[];
  const globals={destroy:vi.fn()};
  const runPythonAsync=vi.fn(async(_source:string,options:{filename:string})=>{
    if(options.filename===failAt)throw new Error(`File "${failAt}", line 1\nAssertionError`);
  });
  const self={postMessage:(message:Record<string,unknown>)=>messages.push(message),onmessage:null as unknown as (event:unknown)=>Promise<void>};
  runInNewContext(workerSource,{self,importScripts:vi.fn(),loadPyodide:async()=>({setStdout:vi.fn(),setStderr:vi.fn(),toPy:()=>globals,runPythonAsync})});
  await self.onmessage({data:{code:'def square(x): return x*x',tests:'assert square(2)==4',customTests}});
  return {messages,runPythonAsync,globals};
}

describe('personal Python tests',()=>{
  it('runs personal assertions after official checks in the same globals with their own filename',async()=>{
    const result=await runWorker('assert square(-3)==9');
    expect(result.runPythonAsync.mock.calls.map(([source,options])=>[source,options.filename])).toEqual([
      ['def square(x): return x*x','experiment.py'],['assert square(2)==4','acceptance_tests.py'],['assert square(-3)==9','custom_tests.py'],
    ]);
    for(const [,options] of result.runPythonAsync.mock.calls)expect(options).toMatchObject({globals:result.globals});
    expect(result.messages.at(-1)).toMatchObject({type:'done',passed:true,customTestsPassed:true});
    expect(result.globals.destroy).toHaveBeenCalledOnce();
  });
  it.each([undefined,'',' \n '])('skips absent or blank personal tests: %j',async tests=>{
    const result=await runWorker(tests);
    expect(result.runPythonAsync).toHaveBeenCalledTimes(2);
    expect(result.messages.at(-1)).toMatchObject({type:'done',passed:true,customTestsPassed:false});
  });
  it.each(['experiment.py','acceptance_tests.py','custom_tests.py'])('does not report success after a failure in %s',async filename=>{
    const result=await runWorker('assert False',filename);
    expect(result.messages.at(-1)).toMatchObject({type:'error'});
    expect(result.messages.some(message=>message.type==='done')).toBe(false);
    expect(result.runPythonAsync.mock.calls.at(-1)?.[1].filename).toBe(filename);
    expect(result.globals.destroy).toHaveBeenCalledOnce();
  });
  it('round-trips chapter-specific tests in backups and accepts older data',()=>{
    const state=initialState();state.progress.functions=emptyProgress();
    expect(validateImport(state)).toEqual(state);
    state.progress.functions.customTests='assert square(-3) == 9';
    state.progress.linear={...emptyProgress(),customTests:'# a separate chapter'};
    expect(validateImport(JSON.parse(JSON.stringify(state)))).toEqual(state);
    for(const customTests of ['', 'x'.repeat(10000)]){
      state.progress.functions.customTests=customTests;
      expect(validateImport(state).progress.functions?.customTests).toBe(customTests);
    }
  });
  it.each([null,42,[],{},'x'.repeat(10001)])('rejects malformed or oversized personal tests (%#)',customTests=>{
    const state=initialState();state.progress.functions={...emptyProgress(),customTests:customTests as string};
    expect(()=>validateImport(state)).toThrow('文字格式无效或过长');
  });
  it('identifies personal assertion locations and preserves their stdout',()=>{
    const failure=analyzePythonFailure('运行错误\nchecking negative inputs\nTraceback (most recent call last):\n  File "custom_tests.py", line 2\n    assert square(-3) == -9\nAssertionError')!;
    expect(failure).toMatchObject({filename:'custom_tests.py',line:2,source:'assert square(-3) == -9',stdout:'checking negative inputs'});
    expect(failure.location).toContain('个人测试');expect(failure.explanation).toContain('期望值');
  });
  it('locates personal-test syntax errors and prefers user function frames for runtime failures',()=>{
    expect(analyzePythonFailure('运行错误\n  File "custom_tests.py", line 1\n    assert (\nSyntaxError: unexpected EOF')).toMatchObject({filename:'custom_tests.py',line:1,stdout:''});
    expect(analyzePythonFailure('运行错误\nTraceback (most recent call last):\n  File "custom_tests.py", line 3\n  File "experiment.py", line 2\n    return 1 / x\nZeroDivisionError: division by zero')).toMatchObject({filename:'experiment.py',line:2});
  });
});
