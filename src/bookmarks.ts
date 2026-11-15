import type {Lesson, LessonId, SectionBookmark} from './types';

export const bookmarkModeLabels = {intuition:'直觉理解', math:'数学推导', deep:'深入研究'};
export const maxSectionBookmarks = 100;
export const sameBookmark = (a:SectionBookmark, b:SectionBookmark) => a.mode === b.mode && a.title === b.title;
export const bookmarkSectionId = (lesson:Lesson, bookmark:SectionBookmark) => {
  const index = lesson[bookmark.mode].findIndex(section => section.title === bookmark.title);
  return index < 0 ? undefined : `reading-${bookmark.mode}-${index}`;
};
export const bookmarkHref = (lessonId:LessonId, bookmark:SectionBookmark) =>
  `#/lesson/${lessonId}/${bookmark.mode}/${encodeURIComponent(bookmark.title)}`;

export function bookmarkFromRoute(mode?:string, title?:string):SectionBookmark|undefined {
  if (!['intuition','math','deep'].includes(mode || '') || !title) return;
  try {return {mode:mode as SectionBookmark['mode'], title:decodeURIComponent(title)};} catch {return;}
}

export function validateBookmarks(value:unknown):SectionBookmark[] {
  if (!Array.isArray(value) || value.length > maxSectionBookmarks) throw new Error('章节书签格式无效');
  const result:SectionBookmark[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object' || Array.isArray(item) ||
      typeof item.mode !== 'string' || !['intuition','math','deep'].includes(item.mode) ||
      typeof item.title !== 'string' || !item.title.trim() || item.title.length > 1000) throw new Error('章节书签格式无效');
    const bookmark:SectionBookmark = {mode:item.mode, title:item.title};
    if (!result.some(existing => sameBookmark(existing, bookmark))) result.push(bookmark);
  }
  return result;
}
