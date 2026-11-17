import type {Lesson,ViewMode} from './types';

export type OutlineEntry={id:string;title:string};

export function lessonOutline(lesson:Lesson,mode:ViewMode):OutlineEntry[]{
  if(mode==='code')return [];
  return lesson[mode].map((section,index)=>({
    id:`lesson-${lesson.id}-${mode}-section-${index+1}`,
    title:section.title,
  }));
}
