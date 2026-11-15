import {describe,expect,it} from 'vitest';
import {lessons} from './data/lessons';
import {searchCourse} from './course-search';

describe('course text search',()=>{
  it('returns every chapter in curriculum order for an empty or whitespace query',()=>{
    for(const query of ['', ' \n\t '])expect(searchCourse(query).map(result=>result.lesson.id)).toEqual(lessons.map(lesson=>lesson.id));
  });
  it('finds a body-only concept and identifies its reading mode and passage',()=>{
    const result=searchCourse('陪域').find(result=>result.lesson.id==='functions');
    expect(result).toMatchObject({mode:'math',heading:'定义域、陪域与对应规则'});
    expect(result?.snippet).toContain('B 是陪域');
  });
  it('searches section headings, deep reading and code explanations',()=>{
    expect(searchCourse('不是所有函数都有一条简单公式').find(result=>result.lesson.id==='functions')).toMatchObject({mode:'deep'});
    expect(searchCourse('仿射映射').find(result=>result.lesson.id==='linear')).toMatchObject({mode:'deep'});
    expect(searchCourse('隐式乘法').find(result=>result.lesson.id==='linear')).toMatchObject({mode:'code',heading:'代码说明'});
  });
  it('matches English case-insensitively and combines title and body keywords',()=>{
    expect(searchCourse('  THINKING\tIN functions  ')[0].lesson.id).toBe('functions');
    expect(searchCourse('线性函数\n仿射映射').map(result=>result.lesson.id)).toEqual(['linear']);
    expect(searchCourse('陪域 不存在的搜索词')).toEqual([]);
  });
  it('ranks a chapter title before mentions in other chapters and deduplicates results',()=>{
    const results=searchCourse('向量');
    expect(results[0].lesson.title).toContain('向量');
    expect(results.findIndex(result=>result.lesson.id==='functions')).toBeGreaterThan(0);
    expect(new Set(results.map(result=>result.lesson.id)).size).toBe(results.length);
    expect(searchCourse('函数是什么')[0].mode).toBeUndefined();
  });
  it('keeps chapter ID and number lookup',()=>{
    expect(searchCourse('functions')[0].lesson.id).toBe('functions');
    expect(searchCourse('01.01')[0].lesson.id).toBe('functions');
  });
  it('treats punctuation literally, without regular expression syntax',()=>{
    expect(searchCourse('.*')).toEqual([]);
    expect(searchCourse('[不存在')).toEqual([]);
    expect(searchCourse('f(x+h)').find(result=>result.lesson.id==='linear')).toMatchObject({mode:'math'});
  });
  it('bounds passage previews and includes the matching text even late in a paragraph',()=>{
    const result=searchCourse('仿射映射').find(result=>result.lesson.id==='linear')!;
    expect(result.snippet).toContain('仿射映射');
    expect(result.snippet.length).toBeLessThanOrEqual(142);
    expect(result.snippet.startsWith('…')).toBe(true);
  });
});
