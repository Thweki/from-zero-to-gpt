import {useRef,useState} from 'react';
import {Search} from 'lucide-react';
import {lessons,lessonById} from '../data/lessons';
import graph from '../data/knowledge-graph.json';
import type {LearningState,LessonId} from '../types';
const titles=['数学基础','机器学习','神经网络','Transformer','手写 GPT','现代 LLM'];
const stageFor=(id:LessonId)=>graph.nodes.find(node=>node.id===id)!.stage;
export function ChapterPicker({value,onChange,label,progress}:{value:LessonId;onChange:(id:LessonId)=>void;label:string;progress:LearningState['progress']}){
  const [query,setQuery]=useState('');
  const menu=useRef<HTMLDetailsElement>(null),origin=useRef(value);
  const stage=stageFor(value);
  const recent=Object.entries(progress).filter(([,p])=>p?.lastVisited).sort(([,a],[,b])=>Date.parse(b!.lastVisited!)-Date.parse(a!.lastVisited!)).slice(0,4).map(([id])=>id as LessonId);
  const words=query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const matches=words.length?lessons.filter(lesson=>words.every(word=>`${lesson.title} ${lesson.english} ${lesson.number} ${titles[stageFor(lesson.id)-1]}`.toLowerCase().includes(word))):[];
  const choose=(id:LessonId)=>{onChange(id);setQuery('');if(menu.current)menu.current.open=false;};
  return <fieldset className="chapter-picker"><legend>{label==='导师关联章节'?'当前章节':label==='选择笔记章节'?'为章节添加笔记':'选择实验'}</legend>
    <div className="chapter-picker-levels">
      <label>阶段<select aria-label={`${label}：阶段`} value={stage} onChange={event=>choose(lessons.find(lesson=>stageFor(lesson.id)===Number(event.target.value))!.id)}>{titles.map((title,i)=><option key={title} value={i+1}>0{i+1} · {title}</option>)}</select></label>
      <label>章节<select aria-label={label} value={value} onChange={event=>choose(event.target.value as LessonId)}>{lessons.filter(lesson=>stageFor(lesson.id)===stage).map(lesson=><option key={lesson.id} value={lesson.id}>{lesson.title}</option>)}</select></label>
    </div>
    <details ref={menu} className="chapter-picker-search"><summary><Search size={14}/>搜索与最近学习</summary>
      <label>搜索全课程<input type="search" aria-label={`${label}：搜索`} placeholder="输入知识点名称或关键词" value={query} onChange={event=>setQuery(event.target.value)}/></label>
      {query.trim()?<div className="chapter-search-results" role="group" aria-label="章节搜索结果">
        <p role="status">{matches.length?`找到 ${matches.length} 章${matches.length>12?'，先显示前 12 章，可继续输入缩小范围':''}`:'没有匹配章节，可以试试“向量”或“Attention”。'}</p>
        {titles.map((title,i)=>{const items=matches.slice(0,12).filter(lesson=>stageFor(lesson.id)===i+1);return items.length?<div key={title}><strong>{title}</strong>{items.map(lesson=><button type="button" key={lesson.id} aria-label={`选择章节：${lesson.title}`} onClick={()=>choose(lesson.id)}>{lesson.title}</button>)}</div>:null;})}
      </div>:<div className="chapter-recent"><p>最近学习</p>{(recent.length?recent:[origin.current]).map(id=><button type="button" key={id} onClick={()=>choose(id)}>{lessonById[id].title}{id===value&&<span>当前</span>}</button>)}</div>}
      {value!==origin.current&&<button type="button" className="text-button" onClick={()=>choose(origin.current)}>返回进入本页时的章节 · {lessonById[origin.current].title}</button>}
    </details>
  </fieldset>;
}
