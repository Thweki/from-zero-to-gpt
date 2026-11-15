import type {LessonId,ViewMode} from './types';

export interface ReadingPosition {anchor:string;fraction:number;}
const key=(lesson:LessonId,mode:ViewMode)=>`from-zero-to-gpt:reading:v1:${lesson}:${mode}`;

export function readReadingPosition(lesson:LessonId,mode:ViewMode):ReadingPosition|null{
  try{
    const value=JSON.parse(localStorage.getItem(key(lesson,mode))||'null');
    if(value&&typeof value.anchor==='string'&&/^(top|panel|section-\d{1,3}|experiment|quiz|code|end)$/.test(value.anchor)&&
      typeof value.fraction==='number'&&Number.isFinite(value.fraction)&&value.fraction>=0&&value.fraction<=1){
      return {anchor:value.anchor,fraction:value.fraction};
    }
  }catch{/* Reading remains available if storage is blocked or corrupt. */}
  return null;
}

export function writeReadingPosition(lesson:LessonId,mode:ViewMode,position:ReadingPosition){
  try{localStorage.setItem(key(lesson,mode),JSON.stringify(position));}catch{/* Best-effort, device-local convenience. */}
}

function readingLine(article:HTMLElement){
  const panel=article.querySelector<HTMLElement>('#lesson-mode-panel');
  return panel?parseFloat(getComputedStyle(panel).scrollMarginTop)||0:0;
}

export function captureReadingPosition(article:HTMLElement):ReadingPosition{
  const line=readingLine(article);
  let position:ReadingPosition={anchor:'top',fraction:0};
  if(window.scrollY<=0)return position;
  for(const element of article.querySelectorAll<HTMLElement>('[data-reading-anchor]')){
    const rect=element.getBoundingClientRect();
    if(rect.height>0&&rect.top<=line){
      position={anchor:element.dataset.readingAnchor!,fraction:Math.min(1,Math.max(0,(line-rect.top)/rect.height))};
    }
  }
  return position;
}

export function restoreReadingPosition(article:HTMLElement,position:ReadingPosition){
  if(position.anchor==='top'){window.scrollTo({top:0,behavior:'instant'});return;}
  const target=Array.from(article.querySelectorAll<HTMLElement>('[data-reading-anchor]')).find(element=>element.dataset.readingAnchor===position.anchor);
  // A removed section is harmless; never jump to unrelated content.
  if(!target)return;
  const rect=target.getBoundingClientRect();
  window.scrollTo({top:Math.max(0,window.scrollY+rect.top+rect.height*position.fraction-readingLine(article)),behavior:'instant'});
}
