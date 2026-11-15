import 'fake-indexeddb/auto';
import {describe, expect, it} from 'vitest';
import {bookmarkFromRoute, bookmarkHref, bookmarkSectionId, validateBookmarks} from './bookmarks';
import {emptyProgress, initialState, readState, validateImport, writeState} from './storage';
import {lessons, lessonById} from './data/lessons';
import type {SectionBookmark} from './types';

const bookmark:SectionBookmark = {mode:'math', title:lessonById.functions.math[0].title};
describe('section bookmarks', () => {
  it('preserves bookmarks through IndexedDB and JSON backup without changing other learning data', async () => {
    const state = initialState();
    state.progress.functions = {...emptyProgress(), bookmarks:[bookmark], note:'my note', code:'x = 2', review:true, quizPassed:true};
    state.progress.linear = {...emptyProgress(), bookmarks:[{mode:'intuition', title:lessonById.linear.intuition[0].title}]};
    await writeState(state);
    expect(await readState()).toEqual(state);
    expect(validateImport(JSON.parse(JSON.stringify(state)))).toEqual(state);
    state.progress.functions.bookmarks = [];
    await writeState(state);
    expect(await readState()).toEqual(state);
  });

  it('accepts old backups with no bookmarks', () => {
    const state = initialState();
    state.progress.functions = emptyProgress();
    expect(validateImport(state)).toEqual(state);
  });

  it.each([null, {}, 'math', [null], [[]], [{mode:'code', title:'task'}], [{mode:['math'], title:'title'}], [{mode:'math', title:1}], [{mode:'math', title:' '}], [{mode:'math', title:'x'.repeat(1001)}], Array(101).fill(bookmark)])('rejects malformed bookmark data: %j', value => {
    const state = initialState();
    state.progress.functions = {...emptyProgress(), bookmarks:value} as never;
    expect(() => validateImport(state)).toThrow('章节书签格式无效');
  });

  it('deduplicates identical bookmarks and strips unknown fields while preserving different modes', () => {
    expect(validateBookmarks([{...bookmark, extra:'ignored'}, bookmark, {...bookmark, mode:'deep'}])).toEqual([bookmark, {...bookmark, mode:'deep'}]);
  });

  it('round-trips titles with reserved URL characters, and ignores invalid links', () => {
    const special:SectionBookmark = {mode:'intuition', title:'为什么 / x # y? 100%'};
    const parts = bookmarkHref('functions', special).split('/');
    expect(bookmarkFromRoute(parts[3], parts[4])).toEqual(special);
    expect(bookmarkFromRoute('math', '%broken')).toBeUndefined();
    expect(bookmarkFromRoute('code', 'title')).toBeUndefined();
    expect(bookmarkFromRoute()).toBeUndefined();
  });

  it('locates sections by title after reordering and falls back for removed sections', () => {
    const lesson = lessonById.functions;
    expect(bookmarkSectionId(lesson, bookmark)).toBe('reading-math-0');
    expect(bookmarkSectionId({...lesson, math:[{title:'inserted', paragraphs:[]}, ...lesson.math]}, bookmark)).toBe('reading-math-1');
    expect(bookmarkSectionId({...lesson, math:[]}, bookmark)).toBeUndefined();
  });

  it('can uniquely bookmark every current reading section within the backup limits', () => {
    for (const lesson of lessons) {
      const bookmarks = (['intuition','math','deep'] as const).flatMap(mode => lesson[mode].map(section => ({mode, title:section.title})));
      expect(validateBookmarks(bookmarks)).toEqual(bookmarks);
      expect(new Set(bookmarks.map(item => bookmarkSectionId(lesson, item))).size).toBe(bookmarks.length);
    }
  });
});
