import {useId, useRef} from 'react';
import {BookOpen, X} from 'lucide-react';
import {glossary, glossaryForLesson} from '../data/glossary';
import type {LessonId, LessonProgress} from '../types';
import './LessonGlossary.css';

export function LessonGlossary({lessonId, value, onChange}: {
  lessonId: LessonId;
  value: LessonProgress['glossary'];
  onChange: (value: NonNullable<LessonProgress['glossary']>) => void;
}) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const relevant = glossaryForLesson(lessonId);
  const term = glossary.find(entry => entry.id === value?.termId) ?? relevant[0] ?? glossary[0];
  const open = value?.open ?? false;
  const close = () => {
    onChange({open:false, termId:term.id});
    trigger.current?.focus({preventScroll:true});
  };

  return <div className="lesson-glossary" onKeyDown={event => {
    if (open && event.key === 'Escape') {event.stopPropagation(); close();}
  }}>
    <button ref={trigger} className="glossary-toggle" aria-label="术语表" aria-expanded={open} aria-controls={id}
      onClick={() => onChange({open:!open, termId:term.id})}><BookOpen size={14} aria-hidden="true"/><span>术语</span></button>
    {open && <section id={id} className="glossary-panel" aria-label="本章术语参考">
      <div className="glossary-heading"><strong>术语表</strong><button className="icon-button" aria-label="关闭术语表" onClick={close}><X size={18}/></button></div>
      <label htmlFor={`${id}-term`}>选择术语 · 优先显示本章相关</label>
      <select id={`${id}-term`} value={term.id} onChange={event => onChange({open:true, termId:event.target.value})}>
        <optgroup label="本章相关">{relevant.map(entry => <option key={entry.id} value={entry.id}>{entry.name} · {entry.english}</option>)}</optgroup>
        <optgroup label="其他课程术语">{glossary.filter(entry => !relevant.includes(entry)).map(entry => <option key={entry.id} value={entry.id}>{entry.name} · {entry.english}</option>)}</optgroup>
      </select>
      <div aria-live="polite" aria-atomic="true">
        <h2>{term.name}<small lang="en">{term.english}</small></h2>
        <p>{term.definition}</p>
        <p className="glossary-example"><b>例子</b>{term.example}</p>
      </div>
      <p className="glossary-footnote">随时查阅，不改变学习进度。开关与所选术语随本章自动保存。</p>
    </section>}
  </div>;
}
