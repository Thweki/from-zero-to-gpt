import 'fake-indexeddb/auto';
import {describe,expect,it} from 'vitest';
import {emptyProgress,initialState,readState,validateImport,writeState} from './storage';
import {lessons,lessonById} from './data/lessons';
import {readingModes,sectionKeys,toggleSectionMark,validateSectionMarks} from './section-marks';

describe('section understanding records',()=>{
  it('preserves marks through JSON backups and IndexedDB without changing other evidence',async()=>{
    const state=initialState();
    state.progress.functions={...emptyProgress(),note:'my explanation',understoodSections:['["intuition","输入与输出",0]']};
    expect(validateImport(JSON.parse(JSON.stringify(state)))).toEqual(state);
    await writeState(state);
    expect(await readState()).toEqual(state);
  });

  it('keeps old backups without section records compatible',()=>{
    const state=initialState();state.progress.functions=emptyProgress();
    expect(validateImport(state)).toEqual(state);
  });

  it('keeps marks attached to titles after unrelated sections move or are inserted',()=>{
    const sections=[{title:'A',paragraphs:[]},{title:'B',paragraphs:[]}];
    const before=sectionKeys('math',sections);
    const after=sectionKeys('math',[sections[1],{title:'New',paragraphs:[]},sections[0]]);
    expect(after[0]).toBe(before[1]);expect(after[2]).toBe(before[0]);
    expect(sectionKeys('deep',sections)[0]).not.toBe(before[0]);
    expect(new Set(sectionKeys('math',[sections[0],sections[0]])).size).toBe(2);
  });

  it('toggles one section while retaining other modes and pruning obsolete headings',()=>{
    const lesson=lessonById.functions;
    const first=sectionKeys('intuition',lesson.intuition)[0];
    const math=sectionKeys('math',lesson.math)[0];
    const initial=[math,'["intuition","removed heading",0]'];
    const marked=toggleSectionMark(lesson,initial,first);
    expect(marked).toEqual([math,first]);
    expect(toggleSectionMark(lesson,marked,first)).toEqual([math]);
    expect(toggleSectionMark(lesson,marked,'unknown')).toEqual(marked);
    expect(initial).toHaveLength(2);
  });

  it('canonicalizes and deduplicates imported keys',()=>{
    expect(validateSectionMarks(['[ "math", "title", 0 ]','["math","title",0]'])).toEqual(['["math","title",0]']);
  });

  it('can save every current curriculum section within the storage bounds',()=>{
    for(const lesson of lessons){
      const keys=readingModes.flatMap(mode=>sectionKeys(mode,lesson[mode]));
      expect(new Set(keys).size).toBe(keys.length);
      expect(validateSectionMarks(keys)).toEqual(keys);
      let marks:string[]=[];
      for(const key of keys)marks=toggleSectionMark(lesson,marks,key);
      expect(marks).toEqual(keys);
    }
  });

  it.each([null,{},true,['bad'],[12],['["code","title",0]'],['["math","",0]'],['["math","title",-1]'],['["math","title",0.5]'],['["math","title",0,"extra"]'],[JSON.stringify(['deep','x'.repeat(513),0])],Array(129).fill('["math","title",0]')].map(understoodSections=>({understoodSections})))('rejects malformed or unbounded marks: $understoodSections',({understoodSections})=>{
    const state=initialState();state.progress.functions={...emptyProgress(),understoodSections} as never;
    expect(()=>validateImport(state)).toThrow();
  });
});
