import type {Lesson,LessonId} from '../types';
import graph from './knowledge-graph.json' with {type:'json'};
import {foundationLessons} from './foundations.ts';
import {stage1Lessons} from './stage1.ts';
import {stage2Lessons} from './stage2.ts';
import {stage3Lessons} from './stage3.ts';
import {stage4Lessons} from './stage4.ts';
import {stage5Lessons} from './stage5.ts';
import {stage6Lessons} from './stage6.ts';
const content=[...foundationLessons,...stage1Lessons,...stage2Lessons,...stage3Lessons,...stage4Lessons,...stage5Lessons,...stage6Lessons];
const authored=new Map(content.map(lesson=>[lesson.id,lesson]));
if(authored.size!==content.length)throw new Error('Duplicate course IDs');
export const lessons:Lesson[]=graph.nodes.map(node=>{
  const lesson=authored.get(node.id as LessonId);
  if(!lesson)throw new Error(`Missing course content: ${node.id}`);
  const ordinal=graph.nodes.filter(n=>n.stage===node.stage).findIndex(n=>n.id===node.id)+1;
  return {...lesson,title:node.title,number:`${String(node.stage).padStart(2,'0')}.${String(ordinal).padStart(2,'0')}`};
});
export const lessonById=Object.fromEntries(lessons.map(lesson=>[lesson.id,lesson])) as Record<LessonId,Lesson>;
