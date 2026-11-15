import {lessons} from './data/lessons';
import type {Lesson,ViewMode} from './types';

export const searchModeLabels:Record<ViewMode,string>={intuition:'直觉理解',math:'数学推导',code:'代码实现',deep:'深入研究'};
type Passage={mode:ViewMode;heading:string;text:string;searchText:string};
export type CourseSearchResult={lesson:Lesson;mode?:ViewMode;heading?:string;snippet:string};
const normalize=(text:string)=>text.toLowerCase().replace(/\s+/g,' ').trim();

// Only authored course text is indexed; learner notes, code and tutor history stay out.
const index=lessons.map(lesson=>{
  const passages:Passage[]=[];
  const add=(mode:ViewMode,heading:string,text:string)=>passages.push({mode,heading,text,searchText:normalize(`${heading} ${text}`)});
  add('intuition','这个概念解决什么问题？',lesson.problem);
  for(const mode of ['intuition','math','deep'] as const){
    for(const section of lesson[mode])add(mode,section.title,section.paragraphs.join(' '));
  }
  add('math','公式说明',lesson.formulaCaption);
  add('code','本章编程任务',lesson.exercise);
  add('code','代码说明',lesson.codeExplanation);
  return {lesson,title:normalize(lesson.title),metadata:normalize(`${lesson.title} ${lesson.english} ${lesson.id} ${lesson.number} ${lesson.subtitle}`),passages};
});

function excerpt(text:string,words:string[]){
  const plain=text.replace(/\s+/g,' ').trim();
  const positions=words.map(word=>plain.toLowerCase().indexOf(word)).filter(position=>position>=0);
  const start=Math.max(0,(positions.length?Math.min(...positions):0)-30);
  const end=Math.min(plain.length,start+140);
  return `${start?'…':''}${plain.slice(start,end)}${end<plain.length?'…':''}`;
}

export function searchCourse(query:string):CourseSearchResult[]{
  const words=normalize(query).split(' ').filter(Boolean);
  const matches=(text:string)=>words.every(word=>text.includes(word));
  const results:{rank:number;result:CourseSearchResult}[]=[];
  for(const entry of index){
    if(matches(entry.metadata)){
      results.push({rank:matches(entry.title)?0:1,result:{lesson:entry.lesson,snippet:entry.lesson.subtitle}});
      continue;
    }
    const passage=entry.passages.find(item=>matches(`${entry.metadata} ${item.searchText}`));
    if(passage)results.push({rank:2,result:{lesson:entry.lesson,mode:passage.mode,heading:passage.heading,snippet:excerpt(passage.text,words)}});
  }
  // Stable sorting retains curriculum order within each rank, with one result per chapter.
  return results.sort((a,b)=>a.rank-b.rank).map(({result})=>result);
}
