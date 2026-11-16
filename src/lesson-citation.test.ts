import {describe,expect,it} from 'vitest';
import {lessonCitation} from './lesson-citation';
import {lessons} from './data/lessons';

describe('lesson citation',()=>{
  it('formats a reusable source citation with the exact heading and a clean chapter link',()=>{
    expect(lessonCitation({id:'functions',number:'01.1',title:'函数'},'math','从 x 到 f(x)','https://reader:fixture@example.org/course/?access=fixture#/lesson/linear/old'))
      .toBe('从零到 GPT · 01.1 函数 — 数学推导 / 从 x 到 f(x)\nhttps://example.org/course/#/lesson/functions');
  });
  it.each(['http://localhost:5173/','tauri://localhost/','http://tauri.localhost/'])('preserves the real installation address %s',base=>{
    expect(lessonCitation(lessons[0],'code','本章编程任务',`${base}?theme=dark#/map`)).toBe(`从零到 GPT · ${lessons[0].number} ${lessons[0].title} — 代码实现 / 本章编程任务\n${base}#/lesson/${lessons[0].id}`);
  });
  it('cites every reading section in the curriculum without modifying its title or inventing metadata',()=>{
    for(const lesson of lessons)for(const mode of ['intuition','math','deep'] as const)for(const section of lesson[mode]){
      const citation=lessonCitation(lesson,mode,section.title,'https://example.org/#/map');
      expect(citation).toContain(`${lesson.number} ${lesson.title}`);
      expect(citation).toContain(` / ${section.title}\n`);
      expect(citation.split('\n').at(-1)).toBe(`https://example.org/#/lesson/${lesson.id}`);
    }
  });
});
