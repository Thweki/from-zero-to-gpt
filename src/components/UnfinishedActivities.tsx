import {useState} from 'react';
import {ArrowRight} from 'lucide-react';
import type {LearningState} from '../types';
import type {LessonSection} from './LessonNavigation';
import {activityLabels, unfinishedActivities} from '../unfinished-activities';
import './UnfinishedActivities.css';

export function UnfinishedActivities({progress}: {progress: LearningState['progress']}) {
  const [filter, setFilter] = useState<LessonSection | 'all'>('all');
  const entries = unfinishedActivities(progress);
  const visible = entries.map(entry => ({...entry, sections: entry.sections.filter(section => filter === 'all' || section === filter)}))
    .filter(entry => entry.sections.length);
  const count = visible.reduce((sum, entry) => sum + entry.sections.length, 0);
  return <div className="page-content unfinished-page">
    <div className="eyebrow">PICK UP AN UNFINISHED THREAD</div>
    <h1>未完事项<span className="title-dot">.</span></h1>
    <p className="page-description">把已开始章节中尚未记录的活动放在一起，选一件接着探索。</p>
    <p>这里按课程顺序显示已有记录中的空缺，不设截止时间，也不要求全部完成。自评掌握不会隐藏空缺，代码是可选扩展。</p>
    <label className="unfinished-filter">筛选活动 <select value={filter} onChange={event => setFilter(event.target.value as LessonSection | 'all')}>
      <option value="all">全部活动</option>
      {Object.entries(activityLabels).map(([section, label]) => <option key={section} value={section}>{label}</option>)}
    </select></label>
    <p role="status">{visible.length} 个章节 · {count} 项未完事项</p>
    {visible.length ? <div className="unfinished-list">{visible.map(({lesson, sections}) => <section className="unfinished-card" key={lesson.id} aria-labelledby={`unfinished-${lesson.id}`}>
      <h2 id={`unfinished-${lesson.id}`}><span className="mono">{lesson.number}</span> {lesson.title}</h2>
      <ul>{sections.map(section => <li key={section}><a href={`#/lesson/${lesson.id}/${section}`}>
        {activityLabels[section]}<ArrowRight size={16} aria-hidden="true"/>
      </a></li>)}</ul>
    </section>)}</div> : <div className="unfinished-empty">
      <h2>{entries.length ? '此类活动暂无未完事项' : '暂无未完事项'}</h2>
      <p>{entries.length ? '可以选择其他活动，或回到学习路线自由探索。' : '已开始章节的活动记录没有空缺，或你还没有开始章节。完成活动后，这里会自动更新。'}</p>
      <a className="button secondary" href="#/map">回到学习路线<ArrowRight size={16}/></a>
    </div>}
  </div>;
}
