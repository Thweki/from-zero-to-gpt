import {useLayoutEffect,useRef,type RefObject} from 'react';
import type {LessonId,ViewMode} from './types';
import {captureReadingPosition,readReadingPosition,restoreReadingPosition,writeReadingPosition,type ReadingPosition} from './reading-position';

export function useReadingPosition(articleRef:RefObject<HTMLElement|null>,lesson:LessonId,mode:ViewMode,explicitNavigation:boolean){
  const restart=useRef(()=>{});
  useLayoutEffect(()=>{
    const article=articleRef.current;
    if(!article)return;
    const saved=readReadingPosition(lesson,mode);
    const previousRestoration=history.scrollRestoration;
    history.scrollRestoration='manual';
    let disposed=false,interrupted=explicitNavigation,ready=false,fontsReady=false,frame=0;
    let pending:ReadingPosition|undefined,timer:ReturnType<typeof setTimeout>|undefined;
    const onLesson=()=>location.hash===`#/lesson/${lesson}`;
    const flush=()=>{
      clearTimeout(timer);
      if(pending){writeReadingPosition(lesson,mode,pending);pending=undefined;}
    };
    const capture=()=>{
      if(!ready||!onLesson()||document.fullscreenElement)return;
      pending=captureReadingPosition(article);
      clearTimeout(timer);timer=setTimeout(flush,200);
    };
    // Flush the cached position, not the DOM after React replaces a lesson/mode.
    const leave=()=>{capture();flush();};
    const hide=()=>{if(document.visibilityState==='hidden')leave();};
    const interrupt=()=>{interrupted=true;ready=true;};
    const align=()=>{
      if(disposed||!fontsReady||article.querySelector('.lab-loading'))return;
      observer.disconnect();cancelAnimationFrame(frame);
      frame=requestAnimationFrame(()=>{
        if(disposed)return;
        if(!interrupted&&onLesson()&&saved)restoreReadingPosition(article,saved);
        ready=true;
      });
    };
    const observer=new MutationObserver(align);
    observer.observe(article,{childList:true,subtree:true});
    void document.fonts.ready.then(()=>{fontsReady=true;align();});
    window.addEventListener('scroll',capture,{passive:true});
    window.addEventListener('pagehide',leave);
    document.addEventListener('visibilitychange',hide);
    const inputs=['pointerdown','wheel','touchstart','keydown'] as const;
    for(const event of inputs)window.addEventListener(event,interrupt,{passive:true});
    restart.current=()=>{
      interrupt();pending={anchor:'top',fraction:0};flush();
      window.scrollTo({top:0,behavior:'instant'});
      article.querySelector<HTMLElement>('h1')?.focus({preventScroll:true});
    };
    return()=>{
      disposed=true;flush();observer.disconnect();cancelAnimationFrame(frame);
      window.removeEventListener('scroll',capture);
      window.removeEventListener('pagehide',leave);
      document.removeEventListener('visibilitychange',hide);
      for(const event of inputs)window.removeEventListener(event,interrupt);
      history.scrollRestoration=previousRestoration;
    };
    // Explicit jumps suppress restoration only when entering a different mode.
    // Including their transient state would re-run restoration after every jump.
  },[articleRef,lesson,mode]);
  return ()=>restart.current();
}
