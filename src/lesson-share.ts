import {lessonIds} from './data/lesson-ids';
import type {LessonId,ViewMode} from './types';

export type LessonLink={lessonId:LessonId;mode:ViewMode;heading?:string};
const modes:readonly string[]=['intuition','math','code','deep'];

// Keep the existing #/lesson/:id route; optional segments describe public content only.
export function parseLessonLink(hash:string):LessonLink|null{
  const parts=hash.split('/');
  if(parts[0]!=='#'||parts[1]!=='lesson'||!lessonIds.includes(parts[2] as LessonId)||!modes.includes(parts[3]))return null;
  let heading:string|undefined;
  try{heading=parts[4]?decodeURIComponent(parts[4]):undefined;}catch{/* An old or malformed heading still opens the lesson mode. */}
  return {lessonId:parts[2] as LessonId,mode:parts[3] as ViewMode,heading};
}

export function lessonHeadingId(mode:ViewMode,title:string){return `lesson-${mode}-${encodeURIComponent(title)}`;}

export function buildLessonLink(address:string,link:LessonLink):string|null{
  const url=new URL(address);
  if(!['http:','https:'].includes(url.protocol)||url.hostname==='tauri.localhost')return null;
  // Do not forward credentials, query parameters, or the current hash's unrelated state.
  url.username='';url.password='';url.search='';
  url.hash=`/lesson/${link.lessonId}/${link.mode}${link.heading?`/${encodeURIComponent(link.heading)}`:''}`;
  return url.href;
}
