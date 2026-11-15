import {Bookmark, X} from 'lucide-react';
import {lessons} from '../data/lessons';
import {bookmarkHref, bookmarkModeLabels, bookmarkSectionId, maxSectionBookmarks, sameBookmark} from '../bookmarks';
import type {LearningState, LessonId, SectionBookmark} from '../types';
import './SectionBookmarks.css';

export function SectionBookmarks({progress, onRemove}:{progress:LearningState['progress']; onRemove:(id:LessonId, bookmark:SectionBookmark)=>void}) {
  const saved = lessons.flatMap(lesson => (progress[lesson.id]?.bookmarks || []).map(bookmark => ({lesson, bookmark})));
  return <section className="section-bookmarks" aria-labelledby="section-bookmarks-title">
    <h2 id="section-bookmarks-title"><Bookmark size={18} aria-hidden="true"/>小节书签</h2>
    {saved.length ? <ul>{saved.map(({lesson, bookmark}) => <li key={JSON.stringify([lesson.id, bookmark.mode, bookmark.title])}>
      <a href={bookmarkSectionId(lesson, bookmark) ? bookmarkHref(lesson.id, bookmark) : `#/lesson/${lesson.id}`}>
        <span>{bookmark.title}</span><small>{lesson.title} · {bookmarkModeLabels[bookmark.mode]}</small>
      </a>
      <button type="button" className="icon-button" aria-label={`移除书签：${lesson.title} · ${bookmarkModeLabels[bookmark.mode]} · ${bookmark.title}`} onClick={()=>onRemove(lesson.id, bookmark)}><X size={16} aria-hidden="true"/></button>
    </li>)}</ul> : <p>在正文小节标题旁添加书签，下次从这里回到原处。</p>}
  </section>;
}

export function SectionBookmarkButton({bookmark, bookmarks, onChange}:{bookmark:SectionBookmark; bookmarks:SectionBookmark[]; onChange:(bookmarks:SectionBookmark[])=>void}) {
  const saved = bookmarks.some(item => sameBookmark(item, bookmark));
  const full = !saved && bookmarks.length >= maxSectionBookmarks;
  return <button type="button" className={`icon-button section-bookmark-button ${saved?'bookmarked':''}`} aria-pressed={saved}
    disabled={full} title={full?'本章书签已满，请先在「我的笔记」中移除书签':undefined}
    aria-label={`${saved?'移除':'添加'}小节书签：${bookmark.title}`}
    onClick={()=>onChange(saved ? bookmarks.filter(item=>!sameBookmark(item, bookmark)) : [...bookmarks, bookmark])}>
    <Bookmark size={18} aria-hidden="true"/>
  </button>;
}
