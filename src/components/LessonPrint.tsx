import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import type {Lesson} from '../types';
import {lessonById} from '../data/lessons';
import {Formula,MathContent} from './Formula';
import './LessonPrint.css';

function Sections({sections}:{sections:Lesson['math']}){
  return <MathContent>{sections.map((section,i)=><section key={i}>
    <h3>{section.title}</h3>
    {section.paragraphs.map((paragraph,j)=><p key={j}>{paragraph}</p>)}
    {section.formula&&<Formula>{section.formula}</Formula>}
  </section>)}</MathContent>;
}

// Only curriculum data enters the handout; learner state is neither read nor written.
export function LessonHandout({lesson,stage,answers=false}:{lesson:Lesson;stage:number;answers?:boolean}){
  return <MathContent><article className="lesson-handout" aria-label="章节讲义">
    <header><p>从零到 GPT · 阶段 {stage} · {lesson.number} · {lesson.id}</p><h1>{lesson.title}</h1><p>{lesson.english}</p><p>{lesson.subtitle}</p></header>
    <section><h2>学习目标</h2><ul>{lesson.goals.map(goal=><li key={goal}>{goal}</li>)}</ul><p>{lesson.problem}</p></section>
    <section><h2>直觉理解</h2><Sections sections={lesson.intuition}/></section>
    <section><h2>数学推导</h2><Sections sections={lesson.math}/>
      {!lesson.math.some(section=>section.formula?.trim()===lesson.formula.trim())&&<Formula>{lesson.formula}</Formula>}
      <p>{lesson.formulaCaption}</p>
    </section>
    <section><h2>实验与编程任务</h2><h3>回到应用后动手验证</h3><p>{lesson.labTask}</p><h3>编程练习</h3><p>{lesson.exercise}</p><p>{lesson.codeExplanation}</p><h3>起始代码</h3><pre><code>{lesson.starter}</code></pre></section>
    <section><h2>容易混淆的地方</h2><ul>{lesson.misconceptions.map(item=><li key={item}>{item}</li>)}</ul></section>
    <section><h2>理解检查</h2><p>{lesson.quiz.question}</p><ol type="A">{lesson.quiz.options.map((option,i)=><li key={i}>{option}</li>)}</ol><p>我的解释：</p><div className="handout-writing-space"/></section>
    <section><h2>深入研究</h2><Sections sections={lesson.deep}/></section>
    <section><h2>先修知识与延伸阅读</h2>
      {lesson.prerequisites.length>0&&<p>先修知识：{lesson.prerequisites.map(id=>lessonById[id].title).join('、')}</p>}
      <ul>{lesson.references.map(reference=><li key={reference.url}><a href={reference.url}>{reference.title}</a><p>{reference.note}</p><code className="handout-url">{reference.url}</code></li>)}</ul>
    </section>
    {answers&&<section className="handout-answers"><h2>自测答案与解析</h2><p>答案：{String.fromCharCode(65+lesson.quiz.correct)}</p><p>{lesson.quiz.explanation}</p><p>提示：{lesson.quiz.hint}</p></section>}
  </article></MathContent>;
}

export function LessonPrint({lesson,stage,onClose}:{lesson:Lesson;stage:number;onClose:()=>void}){
  const dialog=useRef<HTMLDialogElement>(null);
  const [answers,setAnswers]=useState(false),[fontsReady,setFontsReady]=useState(false),[error,setError]=useState('');
  useEffect(()=>{
    const element=dialog.current!;
    const origin=document.activeElement instanceof HTMLElement?document.activeElement:null;
    let active=true;
    element.showModal();
    element.querySelector('button')?.focus();
    document.body.classList.add('lesson-print-open');
    void document.fonts.ready.then(()=>{if(active)setFontsReady(true);});
    return()=>{
      active=false;
      element.close();
      document.body.classList.remove('lesson-print-open');
      origin?.focus({preventScroll:true});
    };
  },[]);
  return createPortal(<dialog ref={dialog} className="lesson-print-dialog" aria-label="打印本章" onCancel={event=>{event.preventDefault();onClose();}}>
    <div className="lesson-print-controls">
      <button type="button" onClick={onClose}>返回学习</button>
      <label><input type="checkbox" checked={answers} onChange={event=>setAnswers(event.target.checked)}/>附上自测答案与解析</label>
      <button type="button" disabled={!fontsReady} onClick={()=>{
        try{window.print();setError('');}catch{setError('当前环境无法打开打印窗口，请在浏览器中打开本章后重试。');}
      }}>{fontsReady?'打印 / 保存为 PDF':'正在准备字体…'}</button>
      <p>整章只读讲义，含四种阅读内容和起始代码；不包含个人笔记、编辑器代码或导师对话。可在浏览器打印窗口选择「另存为 PDF」。</p>
      {error&&<p role="alert">{error}</p>}
    </div>
    <LessonHandout lesson={lesson} stage={stage} answers={answers}/>
  </dialog>,document.body);
}
