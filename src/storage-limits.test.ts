import 'fake-indexeddb/auto';
import {beforeEach,describe,expect,it} from 'vitest';
import {deleteDB,openDB} from 'idb';
import {emptyProgress,initialState,readState,SavedStateError,validateImport,writeState} from './storage';
import type {LearningState} from './types';
import {learningLimits} from './learning-limits';

beforeEach(async()=>{await deleteDB('from-zero-to-gpt');});
const source=():LearningState=>({...initialState(),progress:{functions:{...emptyProgress(),note:'keep this'},linear:{...emptyProgress(),note:'another chapter'}}});

describe('save/reload length contract',()=>{
  it.each(['note','code','lastRun'] as const)('round-trips %s at the limit and rejects oversized writes without replacing the saved record',async field=>{
    const state=source();state.progress.functions![field]='😀'.repeat(learningLimits.text/2);
    await writeState(state);expect(await readState()).toEqual(state);
    state.progress.functions![field]+='x';
    await expect(writeState(state)).rejects.toThrow(/100,000/);
    expect((await readState()).progress.functions?.[field]).toHaveLength(learningLimits.text);
  });
  it.each(['question','next','code','runResult'] as const)('validates checkpoint %s before writing',async field=>{
    const state={...source(),checkpoint:{lessonId:'functions' as const,savedAt:new Date().toISOString(),question:'',next:'',code:'',runResult:''}};
    state.checkpoint[field]='x'.repeat(learningLimits.text);await writeState(state);
    state.checkpoint[field]+='x';await expect(writeState(state)).rejects.toThrow();
    expect((await readState()).checkpoint?.[field]).toHaveLength(learningLimits.text);
  });
  it.each(['observationDraft','observationSnapshot','tutorDraft'] as const)('applies the shared %s limit to writes',async field=>{
    const state=source();state.progress.functions={...state.progress.functions!,[field]:'x'.repeat(learningLimits[field])};
    await writeState(state);expect(await readState()).toEqual(state);
    state.progress.functions![field]+='x';await expect(writeState(state)).rejects.toThrow();
  });
});

describe('existing invalid records',()=>{
  it('preserves full raw export and every chapter, permits repair, and never overwrites on a failed repair',async()=>{
    const state=source();state.progress.functions!.code='x'.repeat(learningLimits.text+1);
    const db=await openDB('from-zero-to-gpt',1,{upgrade(db){db.createObjectStore('learning');}});
    await db.put('learning',state,'state');db.close();
    const error=await readState().catch(error=>error) as SavedStateError;
    expect(error).toBeInstanceOf(SavedStateError);
    expect(JSON.parse(JSON.stringify(error.raw))).toEqual(state);
    expect(error.recovered).toEqual(state);
    await expect(writeState(error.recovered!)).rejects.toThrow();
    expect((await readState().catch(error=>error)).raw).toEqual(state);
    error.recovered!.progress.functions!.code='repaired explicitly';
    await writeState(error.recovered!);expect(await readState()).toEqual(error.recovered);
    expect(()=>validateImport(state)).toThrow();
  });
  it('offers the original record even when structural corruption prevents recovery rendering',async()=>{
    const raw={...source(),theme:'invalid'};
    const db=await openDB('from-zero-to-gpt',1,{upgrade(db){db.createObjectStore('learning');}});
    await db.put('learning',raw,'state');db.close();
    const error=await readState().catch(error=>error) as SavedStateError;
    expect(error.raw).toEqual(raw);expect(error.recovered).toBeUndefined();
  });
});
