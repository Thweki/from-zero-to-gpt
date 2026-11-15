import {useEffect,useRef,useState} from 'react';
import type {Lesson,LessonId} from '../types';
import {gradePractice,practiceLessons,practiceReport,type PracticeAnswers,type PracticeResult} from '../practice-quiz';
import {MathText} from './Formula';
import './PracticeQuiz.css';

export function PracticeQuiz({lesson,navigate}:{lesson:Lesson;navigate:(id:LessonId)=>void}) {
  // Key the session here too, so a new lesson cannot inherit another lesson's answers.
  return <PracticeSession key={lesson.id} lesson={lesson} navigate={navigate}/>;
}

function PracticeSession({lesson,navigate}:{lesson:Lesson;navigate:(id:LessonId)=>void}) {
  const [questions,setQuestions]=useState<Lesson[]>([]);
  const [answers,setAnswers]=useState<PracticeAnswers>({});
  const [results,setResults]=useState<PracticeResult[]|null>(null);
  const [completedAt,setCompletedAt]=useState('');
  const [downloadStatus,setDownloadStatus]=useState('');
  const heading=useRef<HTMLHeadingElement>(null),start=useRef<HTMLButtonElement>(null);
  const active=questions.length>0;
  useEffect(()=>{if(active)heading.current?.focus();},[active,questions,results]);
  const begin=(next:Lesson[])=>{
    setQuestions(next);setAnswers({});setResults(null);setCompletedAt('');setDownloadStatus('');
  };
  const download=()=>{
    if(!results)return;
    try {
      const blob=new Blob([JSON.stringify(practiceReport(lesson,results,completedAt),null,2)],{type:'application/json'});
      const url=URL.createObjectURL(blob),link=document.createElement('a');
      link.href=url;link.download=`practice-${lesson.id}.json`;
      document.body.append(link);
      try {link.click();} finally {link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
      setDownloadStatus('已请求下载本轮结果；此文件用于查看，不是学习数据备份。');
    } catch {setDownloadStatus('无法下载结果，请重试。当前结果仍保留在这里。');}
  };
  return <section className="practice-quiz" aria-label="随堂小测">
    <h2 ref={heading} tabIndex={-1}>{results?'本轮结果':'随堂小测'}</h2>
    <p>用本章与最多三个直接先修章节的已有题目做一轮小测，全部作答后查看解析。仅在本次页面中保留；离开章节或刷新即清除，不写入自测成绩或掌握记录。需要留存时，可下载本轮结果。</p>
    {!active?<button ref={start} className="button secondary compact" onClick={()=>begin(practiceLessons(lesson))}>开始小测 · {practiceLessons(lesson).length} 题</button>:<>
      {results?<>
        <p role="status">本轮答对 {results.filter(result=>result.correct).length} / {results.length} 题。这是练习反馈，不代表掌握认证。</p>
        {results.map(({lesson:source,answer,correct},index)=><div className="practice-result" key={source.id}>
          <h3>{index+1}. {source.title} · {correct?'正确':'待巩固'}</h3>
          <p><MathText>{source.quiz.question}</MathText></p>
          <p>你的答案：<MathText>{source.quiz.options[answer]}</MathText></p>
          {!correct&&<p>参考答案：<MathText>{source.quiz.options[source.quiz.correct]}</MathText></p>}
          <p><MathText>{source.quiz.explanation}</MathText></p>
          {source.id!==lesson.id&&<button className="text-button" onClick={()=>navigate(source.id)}>回看 {source.title}（离开本轮）</button>}
        </div>)}
        <div className="button-row">
          {results.some(result=>!result.correct)&&<button className="button secondary compact" onClick={()=>begin(results.filter(result=>!result.correct).map(result=>result.lesson))}>只重做错题</button>}
          <button className="button secondary compact" onClick={()=>begin(practiceLessons(lesson))}>重新开始全部题目</button>
          <button className="text-button" onClick={download}>下载本轮结果（JSON）</button>
        </div>
        {downloadStatus&&<p role="status">{downloadStatus}</p>}
      </>:<form onSubmit={event=>{
        event.preventDefault();
        const graded=gradePractice(questions,answers);
        if(graded){setResults(graded);setCompletedAt(new Date().toISOString());}
      }}>
        <p>已作答 {Object.keys(answers).length} / {questions.length} 题</p>
        {questions.map((source,index)=><fieldset key={source.id}>
          <legend>{index+1}. {source.title}：<MathText>{source.quiz.question}</MathText></legend>
          <div className="practice-options">{source.quiz.options.map((option,i)=><label key={i}>
            <input type="radio" name={`practice-${source.id}`} value={i} checked={answers[source.id]===i} onChange={()=>setAnswers(previous=>({...previous,[source.id]:i}))}/>
            <span><MathText>{option}</MathText></span>
          </label>)}</div>
        </fieldset>)}
        <button className="button primary compact" type="submit" disabled={!gradePractice(questions,answers)}>提交本轮小测</button>
      </form>}
      <button className="text-button practice-exit" onClick={()=>{
        begin([]);requestAnimationFrame(()=>start.current?.focus());
      }}>结束并清除本轮</button>
    </>}
  </section>;
}
