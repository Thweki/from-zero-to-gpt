import {Fragment} from 'react';
import type {Lesson} from '../types';
import {mathPartToLatex,splitMathText} from '../math-format';
import {highlightAvailable,highlightText,samePassage,type HighlightMode,type LessonHighlight} from '../lesson-highlights';
import {Formula} from './Formula';
import './LessonHighlights.css';

export function HighlightParagraph({text,mode,section,paragraph,highlights}:{text:string;mode:HighlightMode;section:number;paragraph:number;highlights:LessonHighlight[]}) {
  const source=highlightText(text);
  const matches=highlights.filter(item=>samePassage(item,{mode,section,paragraph,source,start:0,end:0}));
  let offset=0;
  return <p data-highlight-paragraph={paragraph} data-section={section} data-mode={mode} data-highlight-source={source} tabIndex={-1}>
    {splitMathText(text).map((part,index)=>{
      const start=offset,end=start+part.value.length;offset=end;
      const active=matches.filter(item=>item.start<end&&item.end>start);
      const cuts=[...new Set([start,end,...active.flatMap(item=>[Math.max(start,item.start),Math.min(end,item.end)])])].sort((a,b)=>a-b);
      return <span key={index} data-highlight-part="" data-start={start} data-end={end} data-math={part.type==='math'}>
        {part.type==='math'?(active.length?<mark className="lesson-highlight" tabIndex={-1} data-highlight-ids={active.map(item=>item.id).join(' ')}><Formula block={false} label={part.value}>{mathPartToLatex(part)}</Formula></mark>:<Formula block={false} label={part.value}>{mathPartToLatex(part)}</Formula>):cuts.slice(0,-1).map((from,i)=>{
          const value=part.value.slice(from-start,cuts[i+1]-start);
          return active.some(item=>item.start<=from&&item.end>=cuts[i+1])?<mark className="lesson-highlight" tabIndex={-1} data-highlight-ids={active.filter(item=>item.start<=from&&item.end>=cuts[i+1]).map(item=>item.id).join(' ')} key={from}>{value}</mark>:<Fragment key={from}>{value}</Fragment>;
        })}
      </span>;
    })}
  </p>;
}

const labels={intuition:'直觉理解',math:'数学推导',deep:'深入研究'};
export function LessonHighlights({lesson,highlights,onJump,onRemove}:{lesson:Lesson;highlights:LessonHighlight[];onJump:(item:LessonHighlight)=>void;onRemove:(id:string)=>void}) {
  return <details className="lesson-highlights">
    <summary>本章高亮 · {highlights.length}</summary>
    <p>选中正文同一段内的文字，点击「高亮」。公式按整体标记；也可选中后按 Alt+Enter，再用 Tab 选择高亮。每章最多 50 条，随学习数据备份。</p>
    {highlights.length===0?<p>还没有高亮。把想再读一遍的原文留在这里。</p>:<ul>{highlights.map(item=>{
      const available=highlightAvailable(lesson,item);
      return <li key={item.id}>
        <button className="highlight-jump" disabled={!available} onClick={()=>onJump(item)}>
          <small>{labels[item.mode]} · {available?lesson[item.mode][item.section].title:'原文已变更，无法定位'}</small>
          <span>{item.source.slice(item.start,item.end)}</span>
          {available&&<small>跳到原文</small>}
        </button>
        <button className="highlight-remove" aria-label={`删除高亮：${item.source.slice(item.start,item.end)}`} onClick={()=>onRemove(item.id)}>删除</button>
      </li>;
    })}</ul>}
  </details>;
}
