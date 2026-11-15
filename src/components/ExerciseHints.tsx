import {useId, useState} from 'react';
import type {LessonId} from '../types';
import {exerciseHints, type ExerciseHints as HintContent} from '../data/exercise-hints';

export function ExerciseHints({lessonId}: {lessonId: LessonId}) {
  const hints = exerciseHints[lessonId];
  return hints ? <HintLadder key={lessonId} hints={hints}/> : null;
}

function HintLadder({hints}: {hints: HintContent}) {
  const [revealed, setRevealed] = useState(0);
  const id = useId();
  const steps = [
    {title: '找准概念', text: hints.concept},
    {title: '拆成小步', text: hints.plan},
    {title: '自己验证', text: hints.check},
  ];
  return <div role="group" aria-labelledby={`${id}-title`}>
    <h3 id={`${id}-title`}>编程提示 · 实验性</h3>
    <p>先试着写，再按需逐步展开。提示不会修改代码或记录完成；离开代码视图后重新收起。</p>
    <div id={`${id}-steps`} aria-live="polite" aria-relevant="additions text">
      {revealed > 0 && <ol>{steps.slice(0, revealed).map((step, index) => <li key={step.title}>
        <strong>{step.title}</strong><p>{step.text}</p>
        {index === 2 && <pre><code>{hints.checkCode}</code></pre>}
      </li>)}</ol>}
    </div>
    <div className="button-row">
      <button type="button" className="button secondary compact" aria-controls={`${id}-steps`} disabled={revealed === steps.length} onClick={() => setRevealed(count => Math.min(count + 1, steps.length))}>
        {revealed === steps.length ? '提示已全部展开' : `展开第 ${revealed + 1} 条提示`}
      </button>
      <button type="button" className="text-button" disabled={revealed === 0} onClick={() => setRevealed(0)}>收起全部提示</button>
    </div>
  </div>;
}
