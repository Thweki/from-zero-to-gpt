import {useEffect,useRef,useState} from 'react';
import {BookOpen,Code2,FlaskConical,CheckCheck} from 'lucide-react';
import type {OutlineEntry} from '../lesson-outline';
export type LessonSection='reading'|'experiment'|'code'|'quiz';
export function LessonNavigation({onGo,outline,onHeading}:{onGo:(section:LessonSection)=>void;outline:OutlineEntry[];onHeading:(id:string)=>void}){
  const menu=useRef<HTMLDetailsElement>(null);
  const [active,setActive]=useState<string|null>(null);
  useEffect(()=>{
    const element=menu.current!;
    const toolbar=element.closest('.lesson-sticky-tools')!;
    const article=element.closest('article')!;
    const headings=outline.map(entry=>document.getElementById(entry.id)).filter((heading):heading is HTMLElement=>Boolean(heading));
    let frame=0;
    const update=()=>{
      frame=0;
      element.style.setProperty('--lesson-menu-space',`${Math.max(80,innerHeight-element.getBoundingClientRect().bottom-16)}px`);
      const readingLine=toolbar.getBoundingClientRect().bottom+13;
      let current:string|null=null;
      for(const heading of headings){
        if(heading.getBoundingClientRect().top>readingLine)break;
        current=heading.id;
      }
      // Do not mark a reading heading while the learner is in the lab or quiz.
      const lastSection=headings.at(-1)?.parentElement;
      if(lastSection&&lastSection.getBoundingClientRect().bottom<readingLine)current=null;
      setActive(current);
    };
    const schedule=()=>{if(!frame)frame=requestAnimationFrame(update);};
    update();
    window.addEventListener('scroll',schedule,{passive:true});
    window.addEventListener('resize',schedule);
    element.addEventListener('toggle',schedule);
    const observer=new ResizeObserver(schedule);observer.observe(article);observer.observe(toolbar);
    return()=>{
      cancelAnimationFrame(frame);observer.disconnect();
      window.removeEventListener('scroll',schedule);window.removeEventListener('resize',schedule);
      element.removeEventListener('toggle',schedule);
    };
  },[outline]);
  const go=(section:LessonSection)=>{if(menu.current)menu.current.open=false;onGo(section);};
  return <details ref={menu} className="lesson-location" onKeyDown={e=>{if(e.key==='Escape'){e.stopPropagation();e.currentTarget.open=false;e.currentTarget.querySelector('summary')?.focus();}}}><summary>本章定位</summary><nav className="lesson-jump-nav" aria-label="本章内容定位">
    {outline.length>0&&<div className="lesson-outline" role="group" aria-label="当前模式小节">
      <p className="mini-label">当前模式小节</p>
      <ol>{outline.map((entry,index)=><li key={entry.id}><button aria-current={active===entry.id?'location':undefined} aria-controls={entry.id} onClick={()=>{if(menu.current)menu.current.open=false;onHeading(entry.id);}}><span aria-hidden="true">{String(index+1).padStart(2,'0')}</span><span>{entry.title}</span></button></li>)}</ol>
    </div>}
    <button onClick={()=>go('reading')} aria-label="跳到本章正文"><BookOpen size={14} aria-hidden="true"/>正文</button>
    <button onClick={()=>go('experiment')} aria-label="跳到交互实验"><FlaskConical size={14} aria-hidden="true"/>交互实验</button>
    <button onClick={()=>go('code')} aria-label="跳到 Python 代码"><Code2 size={14} aria-hidden="true"/>Python 代码</button>
    <button onClick={()=>go('quiz')} aria-label="跳到自测练习"><CheckCheck size={14} aria-hidden="true"/>自测</button>
  </nav></details>;
}
