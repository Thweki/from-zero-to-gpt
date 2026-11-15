import 'fake-indexeddb/auto';
import {describe,expect,it} from 'vitest';
import {emptyProgress,initialState,readState,validateImport,writeState} from './storage';
import {lessons,lessonById} from './data/lessons';

describe('lesson completion checklist persistence',()=>{
  it('keeps old version-1 backups valid without inventing completion',()=>{
    const state=initialState();state.progress.functions=emptyProgress();
    expect(validateImport(state)).toEqual(state);
    expect(validateImport(state).progress.functions?.completedGoals).toBeUndefined();
  });

  it('round-trips checked and unchecked goals, independently by chapter, through backups and IndexedDB',async()=>{
    const state=initialState();
    state.progress.functions={...emptyProgress(),completedGoals:[lessonById.functions.goals[0]],review:true,note:'Keep my notes',quizPassed:false,codePassed:true};
    state.progress.linear={...emptyProgress(),status:'mastered',completedGoals:[]};
    const imported=validateImport(JSON.parse(JSON.stringify(state)));
    expect(imported).toEqual(state);
    await writeState(imported);
    expect(await readState()).toEqual(state);
    state.progress.functions.completedGoals=[];
    await writeState(state);
    expect(await readState()).toEqual(state);
  });

  it.each([null,true,'done',{},[1],[''],['  '],['same','same'],['x'.repeat(1001)],Array.from({length:101},(_,i)=>String(i))])('rejects malformed or oversized checklists: %j',completedGoals=>{
    const state=initialState();
    state.progress.functions={...emptyProgress(),completedGoals} as never;
    expect(()=>validateImport(state)).toThrow();
  });

  it('supports every current lesson goal without changing the curriculum',()=>{
    for(const lesson of lessons){
      const state=initialState();state.progress[lesson.id]={...emptyProgress(),completedGoals:lesson.goals};
      expect(validateImport(state).progress[lesson.id]?.completedGoals).toEqual(lesson.goals);
    }
  });
});
