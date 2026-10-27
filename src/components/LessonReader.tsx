import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {ArrowRight,Bookmark,BookOpen,Check,CheckCheck,Code2,ExternalLink,GitBranch,HelpCircle,Lightbulb,Pause,RotateCcw} from 'lucide-react';
import type {Lesson,LessonId,LessonProgress,ViewMode} from '../types';
import {lessons,lessonById} from '../data/lessons';
import {LessonLab} from './LessonLab';
import {CodeLab} from './CodeLab';
import {Formula} from './Formula';
import {ProjectDownload} from './ProjectDownload';
import {LessonNavigation,type LessonSection} from './LessonNavigation';

const modes=[
  {id:'intuition',label:'直觉理解',icon:Lightbulb},
  {id:'math',label:'数学推导',icon:GitBranch},
  {id:'code',label:'代码实现',icon:Code2},
  {id:'deep',label:'深入研究',icon:BookOpen},
] as const;
type Props={lesson:Lesson;progress:LessonProgress;stage:number;patch:(p:Partial<LessonProgress>)=>void;navigate:(id:LessonId)=>void;onCheckpoint:()=>void;onObserve:(origin:HTMLElement)=>void};

function ReadingSections({sections,formulaCaption,mainFormula}:{sections:Lesson['math'];formulaCaption?:string;mainFormula?:string}){
  const shown=new Set<string>();
  return <>{sections.map((section,i)=>{
    const formula=section.formula?.trim();
    const showFormula=Boolean(formula&&!shown.has(formula));
    if(formula)shown.add(formula);
    return <section className="prose-section" key={section.title}>
      <h2><span>{String(i+1).padStart(2,'0')}</span>{section.title}</h2>
      {section.paragraphs.map((paragraph,j)=><p key={j}>{paragraph}</p>)}
      {showFormula&&<div className="formula-card"><Formula>{formula!}</Formula>{formula===mainFormula?.trim()&&<p>{formulaCaption}</p>}</div>}
    </section>;
  })}{mainFormula&&!shown.has(mainFormula.trim())&&<div className="main-formula"><Formula>{mainFormula}</Formula><p>{formulaCaption}</p></div>}</>;
}

export function LessonReader({lesson,progress,stage,patch,navigate,onCheckpoint,onObserve}:Props){
  const [answer,setAnswer]=useState<number|undefined>(progress.quizAnswer);
  const currentCode=useRef(progress.code);currentCode.current=progress.code;
  const [feedback,setFeedback]=useState(false),[hint,setHint]=useState(false);
  const [pendingSection,setPendingSection]=useState<LessonSection|null>(null);
  const toolsRef=useRef<HTMLDivElement>(null);
  useLayoutEffect(()=>{
    const tools=toolsRef.current;
    if(!tools)return;
    const measure=()=>tools.parentElement?.style.setProperty('--lesson-tools-height',`${tools.getBoundingClientRect().height}px`);
    measure();
    const observer=new ResizeObserver(measure);observer.observe(tools);
    return()=>observer.disconnect();
  },[]);
  const goToSection=(section:LessonSection)=>{
    if(section==='code')patch({mode:'code'});
    else if(section==='experiment'||section==='quiz')patch({mode:'intuition'});
    setPendingSection(section);
  };
  useEffect(()=>{
    if(!pendingSection)return;
    const id={reading:'lesson-mode-panel',experiment:'lesson-experiment',code:'lesson-code',quiz:'lesson-quiz'}[pendingSection];
    const target=document.getElementById(id);
    if(!target)return;
    const article=target.closest('article')!;
    let frame=0,cancelled=false;
    // A lazy experiment can change both the destination and the available scroll
    // range. Navigate after its content and the reading fonts have laid out.
    const align=()=>{
      if(article.querySelector('.lab-loading'))return;
      observer.disconnect();
      void document.fonts.ready.then(()=>{
        if(cancelled)return;
        frame=requestAnimationFrame(()=>{
          target.focus({preventScroll:true});
          target.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
          setPendingSection(null);
        });
      });
    };
    const observer=new MutationObserver(align);
    observer.observe(article,{childList:true,subtree:true});
    align();
    return()=>{cancelled=true;cancelAnimationFrame(frame);observer.disconnect();};
  },[pendingSection,progress.mode]);
  const next=lessons[lessons.indexOf(lesson)+1];
  const changeMode=(mode:ViewMode)=>{setPendingSection(null);patch({mode});};
  const hintVisible=hint||(feedback&&answer!==lesson.quiz.correct);
  const pathDone=progress.readCompleted&&progress.experimented&&progress.quizPassed;
  const estimate={intuition:'参考 8–15 分钟',math:'可选扩展 · 参考 10–20 分钟',code:`可选扩展 · 参考 ${lesson.runtime==='local-python'?'30–60':'15–30'} 分钟`,deep:'可选扩展 · 参考 10–20 分钟'}[progress.mode];
  return <article className="page-content lesson-page">
    <div className="lesson-title-row"><h1>{lesson.title}</h1><button className={`icon-button bookmark-title ${progress.review?'bookmarked':''}`} aria-label="稍后复习本章" onClick={()=>patch({review:!progress.review})}><Bookmark size={20}/></button></div>
    <p className="lesson-subtitle">{lesson.subtitle}</p>
    <section className="recommended-path" aria-label="新手推荐路径">
      <strong>{pathDone?'推荐的这一小轮，已经完成。':'先走一条小路径就够了。'}</strong>
      <ol><li><button onClick={()=>{changeMode('intuition');setPendingSection('reading');}}>{progress.readCompleted&&<Check size={13}/>}1 · 读懂直觉</button></li><li><button onClick={()=>goToSection('experiment')}>{progress.experimented&&<Check size={13}/>}2 · 动手实验</button></li><li><button onClick={()=>goToSection('quiz')}>{progress.quizPassed&&<Check size={13}/>}3 · 自测理解</button></li></ol>
      <p>{pathDone?'现在可以停下，也可以选一项扩展继续探索。':'数学推导、代码实现和深入研究是可选扩展，随时可以跳转。'}用时仅作参考，不计时、不设期限。</p>
    </section>
    <div className="lesson-sticky-tools" ref={toolsRef}>
      <div className="mode-tabs" role="tablist" aria-label="解释模式" onKeyDown={event=>{
        const i=modes.findIndex(mode=>mode.id===progress.mode);let n=i;
        if(event.key==='ArrowRight')n=(i+1)%modes.length;
        else if(event.key==='ArrowLeft')n=(i+modes.length-1)%modes.length;
        else if(event.key==='Home')n=0;
        else if(event.key==='End')n=modes.length-1;
        else return;
        event.preventDefault();changeMode(modes[n].id);document.getElementById(`tab-${modes[n].id}`)?.focus();
      }}>{modes.map(mode=><button role="tab" tabIndex={progress.mode===mode.id?0:-1} aria-selected={progress.mode===mode.id} aria-controls="lesson-mode-panel" id={`tab-${mode.id}`} key={mode.id} onClick={()=>changeMode(mode.id)}><mode.icon size={15}/>{mode.label}</button>)}</div>
      <LessonNavigation onGo={goToSection}/>
    </div>
    <p className="mode-estimate">{progress.mode==='intuition'?'推荐路径 · ':''}{estimate}</p>
    <div id="lesson-mode-panel" tabIndex={-1} role="tabpanel" aria-labelledby={`tab-${progress.mode}`} data-mode={progress.mode}>
      {progress.mode==='intuition'&&<>
        <div className="problem-callout"><span className="mini-label">这个概念解决什么问题？</span><p>{lesson.problem}</p></div>
        <ReadingSections sections={lesson.intuition}/>
        <div className="reading-next"><button className="text-button" onClick={()=>{patch({readCompleted:true});goToSection('experiment');}}>{progress.readCompleted?'已记录阅读，继续实验':'我已读完，去做实验'}<ArrowRight size={14}/></button></div>
        <div id="lesson-experiment" tabIndex={-1}><LessonLab lesson={lesson} values={progress.labValues||{}} onChange={labValues=>patch({labValues,experimented:true})} onObserve={onObserve}/></div>
        <details className="reading-disclosure"><summary>学习目标与容易混淆的地方</summary>
          <section className="goals-section"><h2><CheckCheck size={19}/>你应该能够解释</h2><ul>{lesson.goals.map(goal=><li key={goal}>{goal}</li>)}</ul></section>
          <section className="misconceptions"><h3><HelpCircle size={17}/>容易混淆的地方</h3>{lesson.misconceptions.map(misconception=><p key={misconception}>{misconception}</p>)}</section>
        </details>
        <section className="quiz-card" id="lesson-quiz" tabIndex={-1}>
          <div className="section-title"><span className="mini-label">理解检查 · 不是考试</span>{progress.quizPassed&&<span className="badge"><Check size={12}/>已验证</span>}</div>
          <h3>{lesson.quiz.question}</h3>
          <div className="quiz-options">{lesson.quiz.options.map((option,i)=><label key={option} className={answer===i?'chosen':''}><input type="radio" name={`quiz-${lesson.id}`} value={i} checked={answer===i} onChange={()=>{setAnswer(i);setFeedback(false);}}/><span className="option-letter">{String.fromCharCode(65+i)}</span>{option}</label>)}</div>
          <div className="button-row"><button className="button primary compact" disabled={answer===undefined} onClick={()=>{setFeedback(true);setHint(answer!==lesson.quiz.correct);patch({quizAnswer:answer,quizPassed:answer===lesson.quiz.correct});}}>检查我的理解<ArrowRight size={14}/></button><button className="text-button" onClick={()=>{if(hintVisible){setHint(false);if(feedback&&answer!==lesson.quiz.correct)setFeedback(false);}else setHint(true);}}><Lightbulb size={14}/>{hintVisible?'收起提示':'给我一个提示'}</button></div>
          {(feedback||hintVisible)&&<div className={`quiz-feedback ${feedback&&answer===lesson.quiz.correct?'correct':''}`} role="status">{feedback&&<strong>{answer===lesson.quiz.correct?'理解正确。':'再想一想，试着用上面的实验验证。'}</strong>}{feedback&&answer===lesson.quiz.correct&&<p>{lesson.quiz.explanation}</p>}{hintVisible&&<p className="quiz-hint">{lesson.quiz.hint}</p>}</div>}
        </section>
      </>}
      {progress.mode==='math'&&<ReadingSections sections={lesson.math} mainFormula={lesson.formula} formulaCaption={lesson.formulaCaption}/>}
      {progress.mode==='code'&&<>
        <section className="exercise-section"><h2>本章编程任务</h2><p>{lesson.exercise}</p></section>
        {!progress.codePassed&&progress.lastRun?.startsWith('✓')&&<p className="mode-estimate">已保留先前的运行结果；请重新运行，验证当前编辑器中的代码。</p>}
        <div id="lesson-code" tabIndex={-1}><CodeLab lesson={lesson} code={progress.code} lastRun={progress.lastRun} onCode={code=>patch({code,codePassed:false})} onResult={(lastRun,source)=>patch({lastRun,codePassed:lastRun.startsWith('✓')&&source===currentCode.current})}/></div>
      </>}
      {progress.mode==='deep'&&<>
        <ReadingSections sections={lesson.deep}/>
        <section className="related-section"><h2>先修知识与延伸阅读</h2>
          {lesson.prerequisites.length>0&&<div className="prerequisite-list">{lesson.prerequisites.map(id=><button className="button secondary compact" key={id} onClick={()=>navigate(id)}><RotateCcw size={13}/>{lessonById[id].title}</button>)}</div>}
          <div className="references">{lesson.references.map(reference=><a key={reference.url} href={reference.url} target="_blank" rel="noreferrer"><span>{reference.title}<small>{reference.note}</small></span><ExternalLink size={14}/></a>)}</div>
        </section>
        <ProjectDownload stage={stage} lessonId={lesson.id}/>
      </>}
    </div>
    <section className="learning-evidence" aria-label="本章学习记录"><p>这些记录相互独立，不是必须做完的清单。</p><dl><div><dt>阅读（自记）</dt><dd>{progress.readCompleted?'已阅读':'未记录'}</dd></div><div><dt>自测</dt><dd>{progress.quizPassed?'已验证':'待验证'}</dd></div><div><dt>当前代码</dt><dd>{progress.codePassed?'验收通过':'未验证'}</dd></div><div><dt>掌握（自评）</dt><dd>{progress.status==='mastered'?'自评已掌握':'尚未自评'}</dd></div></dl></section>
    <div className="lesson-completion"><div><strong>{progress.status==='mastered'?'你已将本章自评为掌握。':'能用自己的话解释了吗？'}</strong><p>这是你的判断，不代表系统认证；无需完成所有扩展。</p></div><button className="button secondary" onClick={()=>patch({status:progress.status==='mastered'?'learning':'mastered'})}><Check size={16}/>{progress.status==='mastered'?'取消掌握自评':'自评为已掌握'}</button></div>
    <div className="lesson-pagination"><button className="text-button" onClick={onCheckpoint}><Pause size={14}/>保存思路，今天到这里</button>{next?<button className="text-button next-lesson" onClick={()=>navigate(next.id)}>下一步 · {next.title}<ArrowRight size={16}/></button>:<a className="text-button" href="#/map">回到学习路线<ArrowRight size={16}/></a>}</div>
  </article>;
}
