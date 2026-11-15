import {useEffect, useRef, useState} from 'react';
import {Bookmark} from 'lucide-react';
import type {Lesson, ViewMode} from '../types';
import {bookmarkModeLabels, currentHeading, headingId, MAX_BOOKMARK_NAME, MAX_HEADING_BOOKMARKS, readingHeadings, type HeadingBookmark, type HeadingTarget} from '../heading-bookmarks';
import './HeadingBookmarks.css';

type Props = {lesson:Lesson; mode:ViewMode; bookmarks:HeadingBookmark[]; onChange:(bookmarks:HeadingBookmark[])=>void; onGo:(bookmark:HeadingBookmark)=>void};

export function HeadingBookmarks({lesson, mode, bookmarks, onChange, onGo}:Props) {
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<HeadingTarget>();
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const existing = target && bookmarks.find(bookmark => headingId(bookmark) === headingId(target));
  const full = bookmarks.length >= MAX_HEADING_BOOKMARKS && !existing;
  useEffect(() => {setOpen(false);}, [mode]);
  useEffect(() => {
    if (!open) return;
    input.current?.focus({preventScroll:true});
    const dismiss = (event:PointerEvent) => {if (!root.current?.contains(event.target as Node)) setOpen(false);};
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, [open]);
  const close = () => {setOpen(false); trigger.current?.focus({preventScroll:true});};
  const toggle = () => {
    if (open) {close(); return;}
    const tools = root.current?.closest('.lesson-sticky-tools');
    const heading = currentHeading(readingHeadings(lesson, mode), id => document.getElementById(id)?.getBoundingClientRect().top, (tools?.getBoundingClientRect().bottom ?? 114) + 12);
    setTarget(heading);
    setName(bookmarks.find(bookmark => heading && headingId(bookmark) === headingId(heading))?.name ?? heading?.heading.slice(0, MAX_BOOKMARK_NAME) ?? '');
    setMessage('');
    setOpen(true);
  };
  return <div className="heading-bookmarks" ref={root} onKeyDown={event => {
    if (event.key === 'Escape' && open) {event.stopPropagation(); close();}
  }}>
    <button className="icon-button" ref={trigger} aria-label={`段落书签（${bookmarks.length}）`} title="段落书签" aria-expanded={open} aria-controls="heading-bookmark-panel" onClick={toggle}><Bookmark size={18} aria-hidden="true"/></button>
    {open && <section id="heading-bookmark-panel" className="heading-bookmark-panel" aria-label="本章段落书签">
      <strong>段落书签 · 本章 {bookmarks.length}/{MAX_HEADING_BOOKMARKS}</strong>
      <p>为当前阅读标题命名，下次可回到这里。</p>
      {target && <form onSubmit={event => {
        event.preventDefault();
        if (!name.trim() || full) return;
        const bookmark = {...target, name:name.trim()};
        onChange(existing ? bookmarks.map(item => headingId(item) === headingId(target) ? bookmark : item) : [...bookmarks, bookmark]);
        setMessage('已记录书签，将随学习数据保存。');
      }}>
        <p className="heading-bookmark-target">{bookmarkModeLabels[target.mode]} · {target.heading}</p>
        <label>书签名称<input ref={input} value={name} maxLength={MAX_BOOKMARK_NAME} onChange={event => setName(event.target.value)} /></label>
        <button className="button secondary compact" disabled={!name.trim() || full}>{existing ? '更新书签名称' : '保存当前位置'}</button>
        {full && <p>本章最多保存 {MAX_HEADING_BOOKMARKS} 个书签，请先删除一个。</p>}
      </form>}
      <p role="status">{message}</p>
      {bookmarks.length === 0 ? <p>还没有段落书签。</p> : <ul>{bookmarks.map(bookmark => {
        const available = readingHeadings(lesson, bookmark.mode).some(heading => headingId(heading) === headingId(bookmark));
        return <li key={headingId(bookmark)}>
          <button className="heading-bookmark-jump" disabled={!available} onClick={() => {setOpen(false); onGo(bookmark);}} aria-label={`跳到书签：${bookmark.name}`}>
            <span>{bookmark.name}</span><small>{bookmarkModeLabels[bookmark.mode]} · {bookmark.heading}{!available && '（标题已变更，无法定位）'}</small>
          </button>
          <button className="heading-bookmark-delete" aria-label={`删除书签：${bookmark.name}`} onClick={() => {
            onChange(bookmarks.filter(item => headingId(item) !== headingId(bookmark)));
            setMessage(`已删除书签：${bookmark.name}`);
            input.current?.focus({preventScroll:true});
          }}>删除</button>
        </li>;
      })}</ul>}
      <button className="text-button" onClick={close}>关闭书签</button>
    </section>}
  </div>;
}
