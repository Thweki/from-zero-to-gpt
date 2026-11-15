import type {Lesson, ViewMode} from './types';

export interface HeadingTarget { mode: ViewMode; heading: string; occurrence: number; }
export interface HeadingBookmark extends HeadingTarget { name: string; }
export const MAX_HEADING_BOOKMARKS = 30;
export const MAX_BOOKMARK_NAME = 80;
export const bookmarkModeLabels: Record<ViewMode, string> = {intuition:'直觉理解', math:'数学推导', code:'代码实现', deep:'深入研究'};

// Title + occurrence survives insertion/reordering of other headings. Never
// silently redirect a bookmark to a different section if its title disappears.
export function headingId(target: HeadingTarget): string {
  return `lesson-heading-${target.mode}-${encodeURIComponent(target.heading)}-${target.occurrence}`;
}

export function readingHeadings(lesson: Lesson, mode: ViewMode): HeadingTarget[] {
  return sectionHeadings(mode === 'code' ? [{title:'本章编程任务'}] : lesson[mode], mode);
}

export function sectionHeadings(sections: {title:string}[], mode: ViewMode): HeadingTarget[] {
  const counts = new Map<string, number>();
  return sections.map(({title}) => {
    const occurrence = counts.get(title) ?? 0;
    counts.set(title, occurrence + 1);
    return {mode, heading:title, occurrence};
  });
}

export function currentHeading(headings: HeadingTarget[], top: (id:string)=>number|undefined, readingTop: number): HeadingTarget|undefined {
  let current = headings[0];
  for (const heading of headings) {
    const y = top(headingId(heading));
    if (y !== undefined && y <= readingTop) current = heading;
  }
  return current;
}

export function validateHeadingBookmarks(value: unknown): HeadingBookmark[] {
  if (!Array.isArray(value) || value.length > MAX_HEADING_BOOKMARKS) throw new Error('段落书签数量无效');
  const seen = new Set<string>();
  return value.map(item => {
    if (!item || typeof item !== 'object' || Array.isArray(item)
      || !['intuition','math','code','deep'].includes(item.mode)
      || typeof item.heading !== 'string' || !item.heading.trim() || item.heading.length > 500
      || !Number.isInteger(item.occurrence) || item.occurrence < 0 || item.occurrence > 1000
      || typeof item.name !== 'string' || !item.name.trim() || item.name.length > MAX_BOOKMARK_NAME) throw new Error('段落书签格式无效');
    const bookmark: HeadingBookmark = {mode:item.mode, heading:item.heading, occurrence:item.occurrence, name:item.name.trim()};
    const id = headingId(bookmark);
    if (seen.has(id)) throw new Error('段落书签位置重复');
    seen.add(id);
    return bookmark;
  });
}
