import {describe,expect,it} from 'vitest';
import {lessons,lessonById} from './data/lessons';
import {prerequisitePath} from './prerequisite-path';
import {emptyProgress} from './storage';
import type {LearningState,LessonId} from './types';

describe('targeted prerequisite study path',()=>{
  it('orders a shared foundation before both branches, without including the target',()=>{
    expect(prerequisitePath('dot-product',{})).toEqual([
      {id:'functions',title:lessonById.functions.title,number:'01.01',direct:false,status:'new'},
      {id:'linear',title:lessonById.linear.title,number:'01.02',direct:true,status:'new'},
      {id:'vectors',title:lessonById.vectors.title,number:'01.04',direct:true,status:'new'},
    ]);
  });

  it('has no prerequisite steps for a foundation lesson',()=>{
    expect(prerequisitePath('functions',{})).toEqual([]);
  });

  it('uses self-assessment independently of exercise evidence and never prunes ancestors of mastered lessons',()=>{
    const progress:LearningState['progress']={
      functions:{...emptyProgress(),status:'learning',quizPassed:true,codePassed:true,readCompleted:true},
      linear:{...emptyProgress(),status:'mastered',note:'keep my work'},
    };
    const before=structuredClone(progress);
    expect(prerequisitePath('dot-product',progress).map(({id,status})=>({id,status}))).toEqual([
      {id:'functions',status:'learning'},{id:'linear',status:'mastered'},{id:'vectors',status:'new'},
    ]);
    expect(progress).toEqual(before);
  });

  it('covers exactly the transitive prerequisites in dependency order for every course lesson',()=>{
    for(const lesson of lessons){
      // Compute the closure breadth-first, independently of the planner's DFS.
      const expected=new Set<LessonId>();
      const queue=[...lesson.prerequisites];
      for(let i=0;i<queue.length;i++){
        const id=queue[i];
        if(expected.has(id))continue;
        expected.add(id);
        queue.push(...lessonById[id].prerequisites);
      }
      const steps=prerequisitePath(lesson.id,{});
      const ids=steps.map(step=>step.id);
      expect(new Set(ids)).toEqual(expected);
      expect(ids.length).toBe(expected.size);
      expect(ids).not.toContain(lesson.id);
      steps.forEach((step,index)=>{
        expect(step.direct).toBe(lesson.prerequisites.includes(step.id));
        for(const dependency of lessonById[step.id].prerequisites){
          expect(ids.indexOf(dependency)).toBeGreaterThanOrEqual(0);
          expect(ids.indexOf(dependency)).toBeLessThan(index);
        }
      });
    }
  });
});
