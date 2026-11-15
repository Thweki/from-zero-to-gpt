import type {Lesson,LessonProgress} from '../types';
import {MathText} from './Formula';
import './LessonChecklist.css';

export function LessonChecklist({lesson,progress,patch}:{lesson:Lesson;progress:LessonProgress;patch:(p:Partial<LessonProgress>)=>void}){
  // Store the goal text, so reordered or replaced curriculum goals cannot inherit a tick.
  const completed=new Set(progress.completedGoals);
  const count=lesson.goals.filter(goal=>completed.has(goal)).length;
  return <details className="lesson-checklist">
    <summary>本章完成清单（自记）<span role="status">已勾选 {count} / {lesson.goals.length}</span></summary>
    <p id={`checklist-help-${lesson.id}`}>能用自己的话解释时，勾选对应目标；随时可以取消。清单仅供自记，不改变自测、代码验收或掌握自评。</p>
    <fieldset aria-describedby={`checklist-help-${lesson.id}`}>
      <legend>你应该能够解释</legend>
      {lesson.goals.map(goal=><label key={goal}>
        <input type="checkbox" checked={completed.has(goal)} onChange={event=>{
          const next=new Set(completed);
          if(event.target.checked)next.add(goal);else next.delete(goal);
          patch({completedGoals:lesson.goals.filter(item=>next.has(item))});
        }}/>
        <span><MathText>{goal}</MathText></span>
      </label>)}
    </fieldset>
    <small>随学习数据保存在本地，并包含在 JSON 备份中。</small>
  </details>;
}
