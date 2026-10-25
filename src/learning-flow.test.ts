// @vitest-environment jsdom
import {afterEach,describe,it,expect,vi} from 'vitest';
import {createTutorConnection} from './tutor-connection';
import {initialState,emptyProgress,validateImport} from './storage';
import {experimentContext} from './experiment-context';
import {lessonById} from './data/lessons';
const metadata={configured:true,provider:'fixture',model:'fixture',baseURL:'https://fixture.invalid'};
afterEach(()=>vi.useRealTimers());
describe('shared mentor connection state',()=>{
 it('deduplicates checks and shares one pending/final state without guessing unconfigured',async()=>{
  let resolve!:(value:Response)=>void;
  const fetcher=vi.fn(()=>new Promise<Response>(done=>{resolve=done;}));
  const connection=createTutorConnection(fetcher);
  const a=connection.check(),b=connection.check(true);
  expect(a).toBe(b);expect(connection.getSnapshot()).toMatchObject({phase:'checking',status:null,error:''});
  await Promise.resolve();expect(fetcher).toHaveBeenCalledTimes(1);
  resolve(new Response(JSON.stringify(metadata)));await a;
  expect(connection.getSnapshot()).toMatchObject({phase:'ready',status:metadata});
  await connection.check();expect(fetcher).toHaveBeenCalledTimes(1);
 });
 it('keeps a truthful unavailable reason until an explicit successful retry',async()=>{
  const fetcher=vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({...metadata,configured:false}))).mockResolvedValueOnce(new Response(JSON.stringify(metadata)));
  const connection=createTutorConnection(fetcher);await connection.check();
  expect(connection.getSnapshot()).toMatchObject({phase:'unavailable'});expect(connection.getSnapshot().error).toContain('尚未配置');
  await connection.check();expect(fetcher).toHaveBeenCalledTimes(1);
  await connection.check(true);expect(connection.getSnapshot().phase).toBe('ready');
 });
 it('refreshes stale metadata after 60 seconds, and a synchronous fetch failure remains retryable',async()=>{
  vi.useFakeTimers();const fetcher=vi.fn().mockImplementationOnce(()=>{throw new Error('private upstream detail');}).mockResolvedValue(new Response(JSON.stringify(metadata)));
  const connection=createTutorConnection(fetcher);await connection.check();expect(connection.getSnapshot().phase).toBe('error');expect(connection.getSnapshot().error).not.toContain('private');
  await vi.advanceTimersByTimeAsync(60001);await connection.check();expect(connection.getSnapshot().phase).toBe('ready');expect(fetcher).toHaveBeenCalledTimes(2);
 });
 it('times out a stalled check after eight seconds and never calls it a missing key',async()=>{
  vi.useFakeTimers();const connection=createTutorConnection(vi.fn((_url,options)=>new Promise<Response>((_resolve,reject)=>options?.signal?.addEventListener('abort',()=>reject(new Error('abort'))))));
  const check=connection.check();await vi.advanceTimersByTimeAsync(8001);await check;
  expect(connection.getSnapshot().phase).toBe('error');expect(connection.getSnapshot().error).not.toContain('尚未配置');
 });
});
describe('independent learning evidence and observation ownership',()=>{
 it('round-trips optional evidence and unfinished observation without migrating old backups',()=>{
  const old=initialState();old.progress.functions=emptyProgress();expect(validateImport(old)).toEqual(old);
  old.progress.functions={...emptyProgress(),readCompleted:true,experimented:true,codePassed:false,lastVisited:new Date().toISOString(),observationDraft:'−2 和 2 都得到 4',observationSnapshot:'f(x)=x²；x=−2'};
  expect(validateImport(JSON.parse(JSON.stringify(old)))).toEqual(old);
 });
 it.each([{readCompleted:'yes'},{experimented:1},{codePassed:'passed'},{lastVisited:'yesterday'},{observationDraft:'a'.repeat(4001)},{observationSnapshot:'a'.repeat(3001)}])('rejects corrupt activity fields %j',patch=>{
  const state=initialState();state.progress.functions={...emptyProgress(),...patch} as never;expect(()=>validateImport(state)).toThrow();
 });
 it('freezes the real function and output but excludes unrelated controls and private notes',()=>{
  const root=document.createElement('section');root.innerHTML='<div class="plot-equation">f(x) = x²</div><div class="live-result">f(-3) = 9</div><textarea>private note</textarea>';
  const snapshot=experimentContext(lessonById.functions,root,{x:-3,kind:0,k:1,b:0,ax:3,ay:2});
  expect(snapshot).toContain('f(-3) = 9');expect(snapshot).toContain('"x":-3');expect(snapshot).not.toContain('"ax"');expect(snapshot).not.toContain('"k"');expect(snapshot).not.toContain('private note');
 });
 it('includes visible default controls even before the learner changes a parameter',()=>{
  const root=document.createElement('section');root.innerHTML='<input type="range" aria-label="步数" value="3"><input type="password" value="not-captured"><textarea>private code</textarea>';
  const snapshot=experimentContext(lessonById.algebra,root,{});expect(snapshot).toContain('步数=3');expect(snapshot).not.toContain('not-captured');expect(snapshot).not.toContain('private code');
 });
});
