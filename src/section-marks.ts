import type {Lesson,ViewMode} from './types';

export const readingModes=['intuition','math','deep'] as const;
type ReadingMode=Exclude<ViewMode,'code'>;
const maxMarks=128;

// Titles keep marks attached when unrelated sections are inserted or reordered.
// An occurrence number distinguishes repeated headings within the same mode.
export function sectionKeys(mode:ReadingMode,sections:Lesson['math']):string[]{
  const occurrences=new Map<string,number>();
  return sections.map(({title})=>{
    const occurrence=occurrences.get(title)??0;
    occurrences.set(title,occurrence+1);
    return JSON.stringify([mode,title,occurrence]);
  });
}

export function toggleSectionMark(lesson:Lesson,marks:readonly string[]|undefined,key:string):string[]{
  const valid=new Set(readingModes.flatMap(mode=>sectionKeys(mode,lesson[mode])));
  const next=new Set((marks??[]).filter(mark=>valid.has(mark)));
  if(next.has(key))next.delete(key);
  else if(valid.has(key)&&next.size<maxMarks)next.add(key);
  return [...next];
}

export function validateSectionMarks(value:unknown):string[]{
  const invalid=()=>new Error('小节理解记录格式无效');
  if(!Array.isArray(value)||value.length>maxMarks)throw invalid();
  const marks=value.map(key=>{
    if(typeof key!=='string'||key.length>512)throw invalid();
    let parts:unknown;
    try{parts=JSON.parse(key);}catch{throw invalid();}
    if(!Array.isArray(parts)||parts.length!==3||!readingModes.includes(parts[0])||typeof parts[1]!=='string'||!parts[1].trim()||!Number.isInteger(parts[2])||parts[2]<0||parts[2]>=maxMarks)throw invalid();
    return JSON.stringify(parts);
  });
  return [...new Set(marks)];
}
