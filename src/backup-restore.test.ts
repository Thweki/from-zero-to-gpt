import {describe,expect,it} from 'vitest';
import {restoreChapters} from './backup-restore';
import {emptyProgress,initialState,validateImport} from './storage';

describe('selective chapter restore',()=>{
  it('replaces the whole selected record while preserving unselected chapters and workspace metadata',()=>{
    const current=initialState();
    current.theme='dark';current.lastLesson='vectors';
    current.checkpoint={lessonId:'functions',question:'keep question',next:'keep next',savedAt:current.updatedAt,code:'current code',runResult:'current result'};
    current.progress.functions={...emptyProgress(),note:'current',review:true,quizPassed:true,tutorDraft:'old draft'};
    current.progress.vectors={...emptyProgress(),note:'untouched'};
    const backup=initialState();
    backup.progress.functions={...emptyProgress(),note:'restored',code:'print(42)',labValues:{x:2},tutorMessages:[{role:'user',content:'why?',createdAt:backup.updatedAt}]};
    backup.progress.vectors={...emptyProgress(),note:'do not restore'};
    const before=JSON.stringify({current,backup});
    const restored=restoreChapters(current,backup,['functions']);
    expect(restored.progress.functions).toEqual(backup.progress.functions);
    expect(restored.progress.functions).not.toHaveProperty('quizPassed');
    expect(restored.progress.functions).not.toHaveProperty('tutorDraft');
    expect(restored.progress.vectors).toEqual(current.progress.vectors);
    expect(restored).toMatchObject({theme:'dark',lastLesson:'vectors',checkpoint:current.checkpoint});
    expect(JSON.stringify({current,backup})).toBe(before);
    expect(validateImport(JSON.parse(JSON.stringify(restored)))).toEqual(restored);
  });

  it('adds selected chapters absent from the current workspace and deduplicates selections',()=>{
    const backup=initialState();backup.progress.functions={...emptyProgress(),note:'recovered'};
    const result=restoreChapters(initialState(),backup,['functions','functions']);
    expect(Object.keys(result.progress)).toEqual(['functions']);
    result.progress.functions!.note='edited';
    expect(backup.progress.functions!.note).toBe('recovered');
  });

  it('rejects empty selections, absent chapters, and invalid backup data without changing current data',()=>{
    const current=initialState(),backup=initialState(),before=JSON.stringify(current);
    expect(()=>restoreChapters(current,backup,[])).toThrow('请先选择');
    expect(()=>restoreChapters(current,backup,['functions'])).toThrow('没有所选章节');
    backup.progress.functions={...emptyProgress(),note:'x'.repeat(100001)};
    expect(()=>restoreChapters(current,backup,['functions'])).toThrow('文字格式');
    expect(JSON.stringify(current)).toBe(before);
  });
});
