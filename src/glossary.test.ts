import 'fake-indexeddb/auto';
import {describe, expect, it} from 'vitest';
import {glossary, glossaryForLesson, isGlossaryTermId} from './data/glossary';
import {lessonIds} from './data/lesson-ids';
import {emptyProgress, initialState, readState, validateImport, writeState} from './storage';

describe('course glossary', () => {
  it('provides a relevant reference for every chapter, with valid unique associations', () => {
    expect(new Set(glossary.map(term => term.id)).size).toBe(glossary.length);
    for (const term of glossary) {
      expect(term.id).toMatch(/^[a-z]+(?:-[a-z]+)*$/);
      for (const field of [term.name, term.english, term.definition, term.example]) expect(field.trim().length).toBeGreaterThan(1);
      expect(new Set(term.lessons).size).toBe(term.lessons.length);
      for (const id of term.lessons) expect(lessonIds).toContain(id);
    }
    for (const id of lessonIds) expect(glossaryForLesson(id).length, id).toBeGreaterThan(0);
  });

  it('uses explicit chapter associations instead of accidental substring matches', () => {
    expect(glossaryForLesson('functions').map(term => term.id)).toEqual(['function']);
    expect(glossaryForLesson('qkv').map(term => term.id)).toEqual(['dot-product', 'attention']);
    expect(glossaryForLesson('kv-cache').map(term => term.id)).toEqual(['kv-cache']);
    expect(isGlossaryTermId('attention')).toBe(true);
    for (const invalid of ['toString', '__proto__', 'unknown', ['attention'], null]) expect(isGlossaryTermId(invalid)).toBe(false);
  });
});

describe('glossary persistence and backups', () => {
  it('keeps old version-1 backups valid without inventing glossary preferences', () => {
    const state = initialState();
    state.progress.functions = emptyProgress();
    expect(validateImport(state)).toEqual(state);
    expect(validateImport(state).progress.functions).not.toHaveProperty('glossary');
  });

  it('round-trips independent chapter choices through JSON and IndexedDB, preserving learning evidence', async () => {
    const state = initialState();
    state.progress.functions = {...emptyProgress(), mode:'code', code:'my_draft = 42', note:'my note', labValues:{x:2}, quizPassed:true, readCompleted:true, glossary:{open:true, termId:'attention'}};
    state.progress.linear = {...emptyProgress(), glossary:{open:false, termId:'parameter'}};
    const imported = validateImport(JSON.parse(JSON.stringify(state)));
    expect(imported).toEqual(state);
    await writeState(imported);
    expect(await readState()).toEqual(state);
  });

  it.each([null, [], true, {}, {open:true}, {open:'true',termId:'function'}, {open:1,termId:'function'}, {open:[],termId:'function'}, {open:true,termId:['function']}, {open:true,termId:'unknown'}, {open:true,termId:'__proto__'}, {open:true,termId:'x'.repeat(100000)}])('rejects malformed glossary state %#', glossary => {
    const state = initialState();
    state.progress.functions = {...emptyProgress(), glossary} as never;
    expect(() => validateImport(state)).toThrow('术语表状态无效');
  });

  it('copies only supported glossary fields', () => {
    const state = initialState();
    state.progress.functions = {...emptyProgress(), glossary:{open:true, termId:'function', extra:'ignored'}} as never;
    expect(validateImport(state).progress.functions?.glossary).toEqual({open:true, termId:'function'});
  });
});
