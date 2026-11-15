import {lessonById} from './data/lessons';
import type {LearningState,LessonId,LessonStatus} from './types';

export interface PrerequisiteStep {
  id: LessonId;
  title: string;
  number: string;
  direct: boolean;
  status: LessonStatus;
}

// Course validation guarantees a DAG. Postorder keeps every prerequisite before
// its dependents; the visited set shares foundations across converging branches.
export function prerequisitePath(target:LessonId,progress:LearningState['progress']):PrerequisiteStep[]{
  const direct=new Set(lessonById[target].prerequisites);
  const visited=new Set<LessonId>([target]);
  const steps:PrerequisiteStep[]=[];
  const visit=(id:LessonId)=>{
    if(visited.has(id))return;
    visited.add(id);
    const lesson=lessonById[id];
    lesson.prerequisites.forEach(visit);
    steps.push({id,title:lesson.title,number:lesson.number,direct:direct.has(id),status:progress[id]?.status??'new'});
  };
  direct.forEach(visit);
  return steps;
}
