import {ArrowLeft,ArrowRight} from 'lucide-react';
import {lessons} from '../data/lessons';
import type {LessonId} from '../types';
import './AdjacentLessons.css';

export function AdjacentLessons({lessonId,position,onNavigate}:{lessonId:LessonId;position:'顶部'|'底部';onNavigate:(id:LessonId)=>void}){
  const index=lessons.findIndex(lesson=>lesson.id===lessonId);
  const previous=lessons[index-1],next=lessons[index+1];
  return <nav className="adjacent-lessons" aria-label={`课程顺序 · ${position}`}>
    {previous?<button type="button" onClick={()=>onNavigate(previous.id)} aria-label={`上一章 · ${previous.number} ${previous.title}`}>
      <ArrowLeft size={16} aria-hidden="true"/><span><small>上一章 · {previous.number}</small><strong>{previous.title}</strong></span>
    </button>:<span className="sequence-boundary">已是第一章</span>}
    {next?<button type="button" onClick={()=>onNavigate(next.id)} aria-label={`下一章 · ${next.number} ${next.title}`}>
      <span><small>下一章 · {next.number}</small><strong>{next.title}</strong></span><ArrowRight size={16} aria-hidden="true"/>
    </button>:<a href="#/map">回到学习路线<ArrowRight size={16} aria-hidden="true"/></a>}
  </nav>;
}
