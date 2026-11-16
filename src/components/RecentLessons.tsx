import {ArrowUpRight} from 'lucide-react';
import {lessonById} from '../data/lessons';
import {recentLessons} from '../recent-lessons';
import type {LearningState} from '../types';
import './RecentLessons.css';

export function RecentLessons({progress}: {progress: LearningState['progress']}) {
  const recent = recentLessons(progress);
  if (!recent.length) return null;
  return <section className="recent-lessons" aria-labelledby="recent-lessons-title">
    <h2 id="recent-lessons-title">最近打开</h2>
    <p>按访问时间排列，最多显示 6 章。点击章节即可重新打开。</p>
    <ol>
      {recent.map(({id, lastVisited}) => <li key={id}>
        <a href={`#/lesson/${id}`}>
          <span><strong>{lessonById[id].title}</strong><small>{lessonById[id].number} · {lessonById[id].english}</small>
            <time dateTime={lastVisited}>上次打开：{new Date(lastVisited).toLocaleString('zh-CN', {year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'})}</time>
          </span>
          <ArrowUpRight size={16} aria-hidden="true"/>
        </a>
      </li>)}
    </ol>
  </section>;
}
