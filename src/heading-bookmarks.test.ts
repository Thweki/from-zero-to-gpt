import {describe, expect, it} from 'vitest';
import {currentHeading, headingId, MAX_HEADING_BOOKMARKS, readingHeadings, sectionHeadings, validateHeadingBookmarks, type HeadingBookmark} from './heading-bookmarks';
import {emptyProgress, initialState, validateImport} from './storage';
import {lessons} from './data/lessons';

const bookmark:HeadingBookmark = {mode:'math', heading:'输入与输出', occurrence:0, name:'重新推导这个公式'};

describe('named heading bookmarks', () => {
  it('round-trips with learning data without changing old backups or review state', () => {
    const state = initialState();
    state.progress.functions = {...emptyProgress(), review:true, note:'独立笔记'};
    expect(validateImport(state)).toEqual(state);
    state.progress.functions.headingBookmarks = [bookmark];
    expect(validateImport(JSON.parse(JSON.stringify(state)))).toEqual(state);
    expect(validateImport(state).progress.functions?.headingBookmarks).not.toBe(state.progress.functions.headingBookmarks);
  });

  it('uses the last heading at or above the reading edge, falling back to the first', () => {
    const headings = sectionHeadings([{title:'一'}, {title:'二'}, {title:'三'}], 'intuition');
    const positions = new Map(headings.map((heading, index) => [headingId(heading), index * 300]));
    const top = (id:string) => positions.get(id);
    expect(currentHeading(headings, top, -20)).toEqual(headings[0]);
    expect(currentHeading(headings, top, 299)).toEqual(headings[0]);
    expect(currentHeading(headings, top, 300)).toEqual(headings[1]);
    expect(currentHeading(headings, top, 599)).toEqual(headings[1]);
    expect(currentHeading(headings, top, 900)).toEqual(headings[2]);
    expect(currentHeading([], top, 0)).toBeUndefined();
  });

  it('keeps targets stable when unrelated titles are inserted or reordered and distinguishes duplicates and modes', () => {
    const before = sectionHeadings([{title:'一'}, {title:'输入与输出'}, {title:'一'}], 'math');
    const after = sectionHeadings([{title:'新段落'}, {title:'输入与输出'}, {title:'一'}], 'math');
    expect(headingId(before[1])).toBe(headingId(after[1]));
    expect(headingId(before[0])).not.toBe(headingId(before[2]));
    expect(headingId(bookmark)).not.toBe(headingId({...bookmark, mode:'deep'}));
    expect(headingId({...bookmark, heading:'a/b " c#中文'})).not.toContain(' ');
  });

  it('supports every course heading within import limits', () => {
    for (const lesson of lessons) for (const mode of ['intuition','math','code','deep'] as const) {
      const headings = readingHeadings(lesson, mode);
      expect(headings.length).toBeGreaterThan(0);
      expect(new Set(headings.map(headingId)).size).toBe(headings.length);
      for (const target of headings) expect(validateHeadingBookmarks([{...target, name:'书签'}])).toEqual([{...target, name:'书签'}]);
    }
  });

  it('preserves stale titles for explicit unavailable feedback, trims names, and strips extra fields', () => {
    expect(validateHeadingBookmarks([{...bookmark, heading:'旧版本标题', name:'  我的书签  ', extra:'ignored'}])).toEqual([{...bookmark, heading:'旧版本标题', name:'我的书签'}]);
    expect(validateHeadingBookmarks([])).toEqual([]);
    expect(validateHeadingBookmarks(Array.from({length:MAX_HEADING_BOOKMARKS}, (_, occurrence) => ({...bookmark, occurrence})))).toHaveLength(MAX_HEADING_BOOKMARKS);
  });

  it.each([
    null, {}, [null], [1], [{...bookmark, mode:'other'}], [{...bookmark, name:''}], [{...bookmark, name:'   '}],
    [{...bookmark, name:'x'.repeat(81)}], [{...bookmark, name:1}], [{...bookmark, heading:''}],
    [{...bookmark, heading:'x'.repeat(501)}], [{...bookmark, occurrence:-1}], [{...bookmark, occurrence:0.5}],
    [{...bookmark, occurrence:1001}], [{...bookmark, occurrence:'0'}], [bookmark, bookmark],
    Array.from({length:MAX_HEADING_BOOKMARKS+1}, (_, occurrence) => ({...bookmark, occurrence})),
  ].map(value => ({value})))('rejects malformed bookmark data through the real importer (%#)', ({value}) => {
    const state = initialState();
    state.progress.functions = {...emptyProgress(), headingBookmarks:value} as never;
    expect(() => validateImport(state)).toThrow(/书签/);
  });
});
