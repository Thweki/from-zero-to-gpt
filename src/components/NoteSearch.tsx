import { useMemo, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { searchNotes, type NoteMatch } from '../note-search';
import type { LearningState } from '../types';
import './note-search.css';

export function NoteSearch({ progress, onOpen }: {
  progress: LearningState['progress'];
  onOpen: (match: NoteMatch) => void;
}) {
  const [query, setQuery] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const results = useMemo(() => searchNotes(progress, query), [progress, query]);
  const clear = () => { setQuery(''); input.current?.focus(); };
  return <section className="note-search" role="search" aria-label="个人笔记搜索">
    <label htmlFor="personal-note-query">搜索我的笔记</label>
    <div className="note-search-controls">
      <Search size={17} aria-hidden="true"/>
      <input id="personal-note-query" ref={input} type="search" maxLength={200}
        placeholder="输入记过的一句话或关键词…" value={query}
        aria-describedby="note-search-status" aria-controls="note-search-results"
        onChange={event => setQuery(event.target.value)}
        onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); clear(); } }}/>
      {query && <button className="text-button" onClick={clear}>清除笔记搜索</button>}
    </div>
    <p id="note-search-status" role="status">{query.trim()
      ? results.length ? `找到 ${results.length} 篇笔记` : '没有找到匹配的笔记，试试其他词句。'
      : '在所有章节的个人笔记正文中查找，不区分大小写；搜索仅在本地进行。'}</p>
    <ul id="note-search-results" className="note-search-results">
      {results.map(result => <li key={result.lesson.id}>
        <div className="note-search-heading"><span>{result.lesson.number} · {result.lesson.title}</span>
          <button className="text-button" aria-label={`编辑匹配笔记：${result.lesson.title}`} onClick={() => onOpen(result)}>编辑匹配笔记</button>
        </div>
        <p>{result.before}<mark>{result.match}</mark>{result.after}</p>
      </li>)}
    </ul>
  </section>;
}
