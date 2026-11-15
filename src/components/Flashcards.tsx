import {useRef, useState} from 'react';
import {lessonById} from '../data/lessons';
import {buildFlashcards} from '../flashcards';
import type {LessonId} from '../types';
import {MathContent} from './Formula';
import './flashcards.css';

export function Flashcards({lessonIds, onRemove}: {lessonIds: LessonId[]; onRemove: (id: LessonId) => void}) {
  const [filter, setFilter] = useState<LessonId | ''>('');
  const activeFilter = filter && lessonIds.includes(filter) ? filter : '';
  const ids = activeFilter ? [activeFilter] : lessonIds;
  return <div className="page-content flashcards-page">
    <div className="eyebrow">RECALL IN YOUR OWN WORDS</div>
    <h1>我的闪卡<span className="title-dot">.</span></h1>
    <p className="page-description">先用自己的话解释，再翻看教材原文。随时练习，不计分、不影响章节进度。</p>
    {!lessonIds.length ? <section className="flashcard-panel">
      <h2>还没有闪卡</h2><p>打开任意章节，点击「将本章加入闪卡」，把直觉理解的每个小节变成一张卡。</p>
      <a className="button primary" href="#/map">去选择章节</a>
    </section> : <>
      <label className="flashcard-filter">复习范围<select value={activeFilter} onChange={event => setFilter(event.target.value as LessonId | '')}>
        <option value="">全部闪卡章节</option>
        {lessonIds.map(id => <option key={id} value={id}>{lessonById[id].title}</option>)}
      </select></label>
      <CardReview key={ids.join(',')} cards={buildFlashcards(ids)}/>
      <details className="flashcard-panel"><summary>管理闪卡章节（{lessonIds.length}）</summary>
        <p>移除只改变闪卡集合；以后可以从章节重新加入。集合随学习数据一起导出和导入。</p>
        <ul className="flashcard-chapters">{lessonIds.map(id => <li key={id}>
          <a href={`#/lesson/${id}`}>{lessonById[id].title}</a>
          <button className="button secondary compact" aria-label={`移除闪卡章节：${lessonById[id].title}`} onClick={() => onRemove(id)}>移除</button>
        </li>)}</ul>
      </details>
    </>}
  </div>;
}

function CardReview({cards}: {cards: ReturnType<typeof buildFlashcards>}) {
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const card = cards[index];
  if (!card) return null;
  const move = (next: number) => {
    setIndex(next);
    setRevealed(false);
    heading.current?.focus();
  };
  return <MathContent><section className="flashcard-panel" aria-label="闪卡练习">
    <p role="status">第 {index + 1} / {cards.length} 张 · {lessonById[card.lessonId].title}</p>
    <p className="mini-label">试着解释这个知识点，并举一个例子</p>
    <h2 ref={heading} tabIndex={-1}>{card.title}</h2>
    <button className="button primary" aria-expanded={revealed} aria-controls="flashcard-answer" onClick={() => setRevealed(!revealed)}>{revealed ? '收起答案' : '显示答案'}</button>
    <div id="flashcard-answer" hidden={!revealed} className="flashcard-answer">
      <h3>教材原文 · 直觉理解</h3>
      {revealed && card.paragraphs.map((paragraph, i) => <p key={i}>{paragraph}</p>)}
    </div>
    <div className="flashcard-controls">
      <button className="button secondary" disabled={index === 0} onClick={() => move(index - 1)}>上一张</button>
      {index < cards.length - 1 ? <button className="button secondary" onClick={() => move(index + 1)}>下一张</button> : <button className="button secondary" onClick={() => move(0)}>从头再练</button>}
      <a className="text-button" href={`#/lesson/${card.lessonId}`}>回到来源章节</a>
    </div>
  </section></MathContent>;
}
