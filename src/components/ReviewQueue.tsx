import { useEffect, useRef, useState } from 'react';
import { lessonById } from '../data/lessons';
import { hasSeenLesson, reviewQueue, scheduleReview, type ReviewRating } from '../review-queue';
import type { LearningState, Lesson, LessonId, ReviewSchedule } from '../types';
import { MathContent } from './Formula';

export function ReviewQueue({ state, onReview, navigate }: {
  state: LearningState;
  onReview: (id: LessonId, schedule: ReviewSchedule) => void;
  navigate: (id: LessonId) => void;
}) {
  const [now, setNow] = useState(Date.now);
  const [notice, setNotice] = useState('');
  useEffect(() => {
    const refresh = () => setNow(Date.now());
    const timer = window.setInterval(refresh, 30_000);
    window.addEventListener('focus', refresh);
    return () => { clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, []);
  const queue = reviewQueue(state, now);
  const current = queue[0];
  const nextDue = Object.values(state.progress).filter(p => hasSeenLesson(p) && p?.reviewSchedule)
    .map(p => Date.parse(p!.reviewSchedule!.dueAt)).filter(due => due > now).sort((a, b) => a - b)[0];
  return <div className="page-content">
    <div className="eyebrow">EXPERIMENTAL · 实验性功能</div>
    <h1>间隔复习</h1>
    <p className="page-description">先回想，再查看答案。根据自己的记忆安排下一次复习，不改变章节自测或掌握状态。</p>
    <p role="status">{notice || `待复习：${queue.length} 章`}</p>
    {current ? <RecallCard key={`${current.id}:${current.due}`} lesson={lessonById[current.id]} remaining={queue.length} navigate={navigate} onRate={rating => {
      const time = Date.now();
      const schedule = scheduleReview(state.progress[current.id]?.reviewSchedule, rating, time);
      onReview(current.id, schedule);
      setNow(time);
      setNotice(`已安排「${lessonById[current.id].title}」下次复习：${new Date(schedule.dueAt).toLocaleString('zh-CN')}`);
    }}/> : <section className="settings-card"><h2>当前没有待复习章节</h2>
      <p>{nextDue ? `下次复习：${new Date(nextDue).toLocaleString('zh-CN')}` : '先打开一章学习，回来后即可回顾。已学习的旧章节也会自动进入队列。'}</p>
      <a className="button secondary" href="#/map">回到学习路线</a>
    </section>}
  </div>;
}

function RecallCard({ lesson, remaining, onRate, navigate }: {
  lesson: Lesson; remaining: number; onRate: (rating: ReviewRating) => void; navigate: (id: LessonId) => void;
}) {
  const [revealed, setRevealed] = useState(false);
  const submitted = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, []);
  return <MathContent><section className="settings-card" aria-label="复习卡片">
    <h2 ref={heading} tabIndex={-1}>{lesson.number} · {lesson.title}</h2>
    <p>待复习：{remaining} 章 · 试着先在心里或纸上回答</p>
    <p>{lesson.quiz.question}</p>
    <ol type="A">{lesson.quiz.options.map(option => <li key={option}>{option}</li>)}</ol>
    {!revealed ? <button className="button primary" onClick={() => setRevealed(true)}>显示答案与解释</button> : <>
      <div role="region" aria-label="复习答案"><p><strong>答案：{String.fromCharCode(65 + lesson.quiz.correct)} · {lesson.quiz.options[lesson.quiz.correct]}</strong></p><p>{lesson.quiz.explanation}</p></div>
      <div className="button-row">{(['again', 'remembered'] as const).map(rating => <button key={rating} className="button secondary" onClick={() => {
        if (submitted.current) return;
        submitted.current = true;
        onRate(rating);
      }}>{rating === 'again' ? '还没记住 · 10 分钟后重试' : '记住了 · 延长间隔'}</button>)}</div>
    </>}
    <p><button className="text-button" onClick={() => navigate(lesson.id)}>回到本章学习</button>（不会计为完成复习）</p>
  </section></MathContent>;
}
