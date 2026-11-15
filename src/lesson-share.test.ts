import {describe,expect,it} from 'vitest';
import {lessons} from './data/lessons';
import {buildLessonLink,lessonHeadingId,parseLessonLink} from './lesson-share';

describe('shareable lesson URLs',()=>{
  it('keeps the deployment path, but excludes credentials, queries and unrelated fragments',()=>{
    expect(buildLessonLink('https://user:example@example.org/course/?draft=private#/notes',{lessonId:'functions',mode:'math'}))
      .toBe('https://example.org/course/#/lesson/functions/math');
  });
  it('encodes heading punctuation and Unicode without changing the route',()=>{
    const link={lessonId:'functions',mode:'deep',heading:'中文 / Q & K? # %'} as const;
    const url=buildLessonLink('http://localhost:5173/',link)!;
    expect(parseLessonLink(new URL(url).hash)).toEqual(link);
    expect(new URL(url).search).toBe('');
  });
  it.each(['tauri://localhost/','http://tauri.localhost/','https://tauri.localhost/','file:///app/index.html'])('does not share native-only addresses: %s',address=>{
    expect(buildLessonLink(address,{lessonId:'functions',mode:'intuition'})).toBeNull();
  });
  it.each(['#/lesson/functions','#/map','#/lesson/missing/math','#/lesson/functions/unknown','#/notes/functions/math'])('leaves legacy or invalid routes alone: %s',hash=>{
    expect(parseLessonLink(hash)).toBeNull();
  });
  it('preserves a valid lesson mode when heading encoding is malformed',()=>{
    expect(parseLessonLink('#/lesson/functions/math/%E0%A4%A')).toEqual({lessonId:'functions',mode:'math',heading:undefined});
  });
  it('round-trips every curriculum heading and gives each mode unique anchors',()=>{
    for(const lesson of lessons){
      const ids:string[]=[];
      for(const mode of ['intuition','math','deep'] as const)for(const {title:heading} of lesson[mode]){
        const link={lessonId:lesson.id,mode,heading};
        expect(parseLessonLink(new URL(buildLessonLink('https://example.org/course/',link)!).hash)).toEqual(link);
        ids.push(lessonHeadingId(mode,heading));
      }
      expect(new Set(ids).size).toBe(ids.length);
    }
  });
});
