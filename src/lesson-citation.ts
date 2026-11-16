import type {Lesson,ViewMode} from './types';

const modeLabels:Record<ViewMode,string>={intuition:'直觉理解',math:'数学推导',code:'代码实现',deep:'深入研究'};

// Link to the existing chapter route. The mode and heading remain explicit in
// the citation text; no unsupported heading fragment or private query is copied.
export function lessonCitation(lesson:Pick<Lesson,'id'|'number'|'title'>,mode:ViewMode,heading:string,href:string):string{
  const url=new URL(href);
  url.username='';url.password='';url.search='';url.hash=`/lesson/${lesson.id}`;
  return `从零到 GPT · ${lesson.number} ${lesson.title} — ${modeLabels[mode]} / ${heading}\n${url.href}`;
}
