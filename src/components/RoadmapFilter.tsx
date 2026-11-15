import {useState, type ReactNode} from 'react';
import {ArrowUpRight} from 'lucide-react';
import {lessons, lessonById} from '../data/lessons';
import type {LearningState, LessonId} from '../types';
import './RoadmapFilter.css';

const filters = [
  {value:'all', label:'全部章节'},
  {value:'learning', label:'学习中'},
  {value:'new', label:'未开始'},
  {value:'mastered', label:'自评掌握'},
  {value:'review', label:'稍后复习'},
] as const;
type Filter = typeof filters[number]['value'];
const statusLabels = {new:'未开始', learning:'学习中', mastered:'自评掌握'};

export function RoadmapFilter({progress, navigate, showDependencies, children}:{
  progress:LearningState['progress'];
  navigate:(id:LessonId)=>void;
  showDependencies?:boolean;
  children:ReactNode;
}){
  const [filter, setFilter] = useState<Filter>('all');
  const matches = lessons.filter(lesson=>{
    const record = progress[lesson.id];
    return filter==='all'||(filter==='review'?record?.review:(record?.status||'new')===filter);
  });
  return <>
    <div className="roadmap-filter">
      <label htmlFor="roadmap-filter">按学习记录筛选</label>
      <select id="roadmap-filter" value={filter} aria-describedby="roadmap-filter-help" onChange={event=>setFilter(event.target.value as Filter)}>
        {filters.map(item=><option key={item.value} value={item.value}>{item.label}</option>)}
      </select>
      <p role="status">{filters.find(item=>item.value===filter)!.label} · {matches.length} / {lessons.length} 章</p>
      <p id="roadmap-filter-help">按课程顺序显示所有阶段的匹配章节。掌握仅指自评，与阅读、自测和代码验收分别记录。</p>
    </div>
    {filter==='all'?children:<section className="chapter-list" aria-label="筛选章节">
      {matches.length?matches.map(lesson=>{
        const status = progress[lesson.id]?.status||'new';
        return <button className="chapter-row" key={lesson.id} onClick={()=>navigate(lesson.id)}>
          <span className="chapter-index">{lesson.number}</span>
          <span className="chapter-title">{lesson.title}<small>{lesson.english}</small>{showDependencies&&<span className="dependency-text">先修：{lesson.prerequisites.map(id=>lessonById[id].title).join('、')||'无'}</span>}</span>
          <span className={`chapter-badge ${status}`}>{statusLabels[status]}</span>
          <ArrowUpRight size={15}/>
        </button>;
      }):<p className="empty-result">没有符合此筛选的章节。可以选择「全部章节」继续探索。</p>}
    </section>}
  </>;
}
