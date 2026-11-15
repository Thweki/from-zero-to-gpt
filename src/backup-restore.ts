import {validateImport} from './storage';
import type {LearningState,LessonId} from './types';

/** Replace complete chapter records, keeping the current workspace and other chapters. */
export function restoreChapters(current:LearningState,backup:LearningState,selected:readonly LessonId[]):LearningState{
  const source=validateImport(backup);
  if(!selected.length)throw new Error('请先选择要恢复的章节');
  const progress={...current.progress};
  for(const id of new Set(selected)){
    if(!source.progress[id])throw new Error('备份中没有所选章节的记录');
    progress[id]=source.progress[id];
  }
  return {...current,progress,updatedAt:new Date().toISOString()};
}
