import type {Lesson, ViewMode} from './types';
import {splitMathText} from './math-format';

export type HighlightMode = Exclude<ViewMode, 'code'>;
export interface LessonHighlight {
  id: string;
  mode: HighlightMode;
  section: number;
  paragraph: number;
  source: string;
  start: number;
  end: number;
}
export type HighlightAnchor = Omit<LessonHighlight, 'id'>;
export const highlightLimit = 50;
export const highlightSourceLimit = 10000;
export const highlightText = (text:string) => splitMathText(text).map(part=>part.value).join('');
export const samePassage = (a:HighlightAnchor,b:HighlightAnchor) => a.mode===b.mode && a.section===b.section && a.paragraph===b.paragraph && a.source===b.source;
export function highlightAvailable(lesson:Lesson, highlight:HighlightAnchor) {
  const source=lesson[highlight.mode][highlight.section]?.paragraphs[highlight.paragraph];
  return source!==undefined && highlightText(source)===highlight.source;
}

export function validateHighlights(value:unknown):LessonHighlight[] {
  if(!Array.isArray(value)||value.length>highlightLimit)throw new Error('本章高亮数量无效');
  const ids=new Set<string>();
  return value.map(item=>{
    if(!item||typeof item!=='object'||Array.isArray(item))throw new Error('高亮格式无效');
    const {id,mode,section,paragraph,source,start,end}=item;
    if(typeof id!=='string'||!/^[a-zA-Z0-9-]{1,80}$/.test(id)||ids.has(id)||
      typeof mode!=='string'||!['intuition','math','deep'].includes(mode)||
      !Number.isSafeInteger(section)||section<0||section>1000||!Number.isSafeInteger(paragraph)||paragraph<0||paragraph>1000||
      typeof source!=='string'||source.length>highlightSourceLimit||
      !Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||end<=start||end>source.length||!source.slice(start,end).trim())throw new Error('高亮格式无效');
    ids.add(id);
    return {id,mode:mode as HighlightMode,section,paragraph,source,start,end};
  });
}

// Merge touching selections, so repeated highlighting never creates duplicate entries.
export function addHighlight(existing:LessonHighlight[], anchor:HighlightAnchor, id:string):LessonHighlight[] {
  let start=anchor.start,end=anchor.end;
  const remaining=[...existing];
  let merged=true;
  while(merged){
    merged=false;
    for(let i=remaining.length-1;i>=0;i--){
      const item=remaining[i];
      if(samePassage(item,anchor)&&item.start<=end&&item.end>=start){
        start=Math.min(start,item.start);end=Math.max(end,item.end);remaining.splice(i,1);merged=true;
      }
    }
  }
  return validateHighlights([...remaining,{...anchor,id,start,end}]);
}

// Each rendered math part is an atomic selection unit. Its accessible and visual
// KaTeX trees map to the same source, never to duplicated DOM text offsets.
export function captureHighlight(range:Range):HighlightAnchor|null {
  const parent=(node:Node)=>node instanceof Element?node:node.parentElement;
  const paragraph=parent(range.startContainer)?.closest<HTMLElement>('[data-highlight-paragraph]');
  if(!paragraph||!paragraph.closest('.lesson-page')||!paragraph.contains(range.endContainer)||range.collapsed)return null;
  const source=paragraph.dataset.highlightSource!;
  if(source.length>highlightSourceLimit)return null;
  let start=Infinity,end=-1;
  for(const part of paragraph.querySelectorAll<HTMLElement>('[data-highlight-part]')){
    const content=document.createRange();content.selectNodeContents(part);
    const clipped=range.cloneRange();
    if(clipped.compareBoundaryPoints(Range.START_TO_START,content)<0)clipped.setStart(content.startContainer,content.startOffset);
    if(clipped.compareBoundaryPoints(Range.END_TO_END,content)>0)clipped.setEnd(content.endContainer,content.endOffset);
    if(!range.intersectsNode(part)||clipped.collapsed||!clipped.toString())continue;
    const base=Number(part.dataset.start);
    if(part.dataset.math==='true'){
      start=Math.min(start,base);end=Math.max(end,Number(part.dataset.end));
    }else{
      const prefix=content.cloneRange();prefix.setEnd(clipped.startContainer,clipped.startOffset);
      const from=base+prefix.toString().length;
      start=Math.min(start,from);end=Math.max(end,from+clipped.toString().length);
    }
  }
  if(end<=start||!source.slice(start,end).trim())return null;
  return {mode:paragraph.dataset.mode as HighlightMode,section:Number(paragraph.dataset.section),paragraph:Number(paragraph.dataset.highlightParagraph),source,start,end};
}
