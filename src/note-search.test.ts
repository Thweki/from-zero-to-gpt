import { describe, expect, it } from 'vitest';
import { searchNotes } from './note-search';
import { emptyProgress } from './storage';
import type { LearningState } from './types';

describe('personal note search', () => {
  it('finds Chinese and mixed-case phrases across lessons in course order', () => {
    const progress: LearningState['progress'] = {
      vectors: { ...emptyProgress(), note: '用 Attention 理解向量' },
      functions: { ...emptyProgress(), note: '我的 ATTENTION 笔记：理解输入' },
    };
    expect(searchNotes(progress, '  attention  ').map(r => r.lesson.id)).toEqual(['functions', 'vectors']);
    expect(searchNotes(progress, '理解').map(r => r.match)).toEqual(['理解', '理解']);
    expect(searchNotes(progress, 'attention 理解').map(r => r.lesson.id)).toEqual(['vectors']);
  });

  it('does not search titles, code, tutor messages, review marks or observation drafts', () => {
    const progress: LearningState['progress'] = {
      functions: { ...emptyProgress(), code: 'needle', review: true, observationDraft: 'needle',
        tutorMessages: [{ role: 'user', content: 'needle', createdAt: new Date().toISOString() }] },
      vectors: { ...emptyProgress(), note: ' \n ' },
    };
    for (const query of ['', '  \n ', 'needle', '函数', '向量']) expect(searchNotes(progress, query)).toEqual([]);
    expect(searchNotes({}, 'anything')).toEqual([]);
  });

  it('matches punctuation literally instead of executing a regular expression', () => {
    const progress = { functions: { ...emptyProgress(), note: '公式 [x] + (a.*b)? $ \\ 完整记录' } };
    for (const query of ['[x]', '(a.*b)?', '$', '\\']) expect(searchNotes(progress, query)[0].match).toBe(query);
    expect(searchNotes(progress, 'a.+b')).toEqual([]);
  });

  it('returns a bounded excerpt around a late match and original selection offsets', () => {
    const note = '前'.repeat(50000) + 'TARGET' + '后'.repeat(49994);
    const result = searchNotes({ functions: { ...emptyProgress(), note } }, 'target')[0];
    expect(result.start).toBe(50000);
    expect(result.end).toBe(50006);
    expect(note.slice(result.start, result.end)).toBe('TARGET');
    expect(result.before).toBe('…' + '前'.repeat(64));
    expect(result.after).toBe('后'.repeat(64) + '…');
  });

  it('keeps offsets correct after Unicode lowercase expansions and emoji', () => {
    const note = 'İ🧠 TARGET';
    const result = searchNotes({ functions: { ...emptyProgress(), note } }, 'target')[0];
    expect(note.slice(result.start, result.end)).toBe('TARGET');
    expect(result.before).toBe('İ🧠 ');
    expect(result.after).toBe('');
  });

  it('returns one result per note and reflects edits without mutating progress', () => {
    const progress = { functions: { ...emptyProgress(), note: '想法 想法' } };
    const original = structuredClone(progress);
    expect(searchNotes(progress, '想法')).toHaveLength(1);
    expect(progress).toEqual(original);
    progress.functions.note = '更新后的理解';
    expect(searchNotes(progress, '想法')).toEqual([]);
    expect(searchNotes(progress, '理解')).toHaveLength(1);
    progress.functions.note = '';
    expect(searchNotes(progress, '理解')).toEqual([]);
  });
});
