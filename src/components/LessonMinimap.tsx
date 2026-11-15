import {useEffect,useState,type RefObject} from 'react';
import {readingMap} from '../lesson-minimap';
import './LessonMinimap.css';

export function readingHeadingId(lessonId:string,mode:string,index:number){
  return `reading-${lessonId}-${mode}-${index}`;
}

export function LessonMinimap({lessonId,mode,sections,toolsRef}:{
  lessonId:string;mode:string;sections:{title:string}[];toolsRef:RefObject<HTMLDivElement|null>;
}){
  const [map,setMap]=useState<ReturnType<typeof readingMap>>(null);
  useEffect(()=>{
    const tools=toolsRef.current;
    const headings=sections.map((_,i)=>document.getElementById(readingHeadingId(lessonId,mode,i)));
    if(!tools||headings.some(heading=>!heading))return;
    let frame=0;
    const measure=()=>{
      frame=0;
      const top=(parseFloat(getComputedStyle(tools).top)||0)+tools.getBoundingClientRect().height+12;
      setMap(readingMap(headings.map(heading=>{
        const rect=heading!.parentElement!.getBoundingClientRect();
        return {top:heading!.getBoundingClientRect().top,bottom:rect.bottom};
      }),{top,bottom:window.innerHeight}));
    };
    const schedule=()=>{if(!frame)frame=requestAnimationFrame(measure);};
    const observer=new ResizeObserver(schedule);
    observer.observe(tools);
    const article=tools.closest('article');
    if(article)observer.observe(article);
    headings.forEach(heading=>observer.observe(heading!.parentElement!));
    window.addEventListener('scroll',schedule,{passive:true});
    window.addEventListener('resize',schedule);
    measure();
    return()=>{cancelAnimationFrame(frame);observer.disconnect();window.removeEventListener('scroll',schedule);window.removeEventListener('resize',schedule);};
  },[lessonId,mode,sections,toolsRef]);

  const go=(index:number)=>{
    const heading=document.getElementById(readingHeadingId(lessonId,mode,index)),tools=toolsRef.current;
    if(!heading||!tools)return;
    const inset=(parseFloat(getComputedStyle(tools).top)||0)+tools.getBoundingClientRect().height+12;
    heading.focus({preventScroll:true});
    window.scrollTo({top:Math.ceil(window.scrollY+heading.getBoundingClientRect().top-inset),behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
  };

  return <nav className="lesson-minimap" aria-label="正文视窗缩略图">
    <span className="lesson-minimap-label" title="条段长度对应正文篇幅，框内为当前可见范围；不代表学习完成度。">正文视窗</span>
    <div className="lesson-minimap-track">
      {sections.map((section,i)=>{
        const segment=map?.sections[i]??{start:i/sections.length,end:(i+1)/sections.length};
        return <button key={i} type="button" style={{left:`${segment.start*100}%`,width:`${(segment.end-segment.start)*100}%`}}
          aria-label={`定位正文第 ${i+1} 节：${section.title}`} title={section.title}
          aria-current={map?.current===i?'location':undefined} onClick={()=>go(i)}>{i+1}</button>;
      })}
      {map?.visible&&<span className="lesson-minimap-viewport" aria-hidden="true" style={{left:`${map.visible.start*100}%`,width:`${(map.visible.end-map.visible.start)*100}%`}}/>}
    </div>
  </nav>;
}
