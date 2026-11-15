import {useEffect,useState,type RefObject} from 'react';

// Measure the prose against the viewport below the sticky lesson controls.
// Reaching the end means it is visible, not that the learner has mastered it.
export function readingPercent(top:number,height:number,viewportHeight:number,coveredTop:number){
  const available=viewportHeight-Math.max(0,coveredTop);
  if(height<=0||available<=0)return 0;
  if(height<=available)return top+height<=viewportHeight?100:0;
  return Math.round(Math.min(1,Math.max(0,(coveredTop-top)/(height-available)))*100);
}

type Props={contentRef:RefObject<HTMLDivElement|null>;toolsRef:RefObject<HTMLDivElement|null>;modeLabel:string};

export function ReadingProgress({contentRef,toolsRef,modeLabel}:Props){
  const [percent,setPercent]=useState(0);
  useEffect(()=>{
    const content=contentRef.current,tools=toolsRef.current;
    if(!content||!tools)return;
    let frame:number|null=null;
    const measure=()=>{
      frame=null;
      const rect=content.getBoundingClientRect();
      setPercent(readingPercent(rect.top,rect.height,window.innerHeight,Math.max(0,tools.getBoundingClientRect().bottom)));
    };
    const schedule=()=>{if(frame===null)frame=requestAnimationFrame(measure);};
    measure();
    const observer=new ResizeObserver(schedule);
    observer.observe(content);
    observer.observe(tools);
    const article=content.closest('article');
    if(article)observer.observe(article);
    window.addEventListener('scroll',schedule,{passive:true});
    window.addEventListener('resize',schedule);
    return()=>{
      observer.disconnect();
      window.removeEventListener('scroll',schedule);
      window.removeEventListener('resize',schedule);
      if(frame!==null)cancelAnimationFrame(frame);
    };
  },[contentRef,toolsRef,modeLabel]);

  return <div className="reading-progress" role="progressbar" aria-label={`${modeLabel}阅读位置`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-valuetext={`${percent}% · 仅表示滚动位置`} title={`${modeLabel}阅读位置 ${percent}%（不代表已读或掌握）`}>
    <span style={{transform:`scaleX(${percent/100})`}}/>
  </div>;
}
