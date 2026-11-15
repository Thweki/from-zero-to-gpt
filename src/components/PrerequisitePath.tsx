import {useState} from 'react';
import {prerequisitePath} from '../prerequisite-path';
import type {LearningState,LessonId} from '../types';
import './PrerequisitePath.css';

const statusLabels={new:'未开始',learning:'学习中',mastered:'自评已掌握'};

export function PrerequisitePath({lessonId,progress,navigate}:{lessonId:LessonId;progress:LearningState['progress'];navigate:(id:LessonId)=>void}){
  const [hideMastered,setHideMastered]=useState(false);
  const steps=prerequisitePath(lessonId,progress);
  const remaining=steps.filter(step=>step.status!=='mastered');
  const visible=hideMastered?remaining:steps;
  return <details className="prerequisite-path">
    <summary>先修学习路线 <span>{steps.length?`${remaining.length} / ${steps.length} 节尚未自评掌握`:'无需先修'}</span></summary>
    <p>按先修顺序，从基础走到本章。包含直接先修与它们的前置知识，共用基础只列一次；可自由跳转，掌握状态由你自评。</p>
    {steps.length>0?<>
      <label className="prerequisite-filter"><input type="checkbox" checked={hideMastered} onChange={event=>setHideMastered(event.target.checked)}/>隐藏自评已掌握的章节</label>
      {visible.length>0?<ol aria-label="建议先修顺序">{visible.map(step=><li key={step.id}>
        <button onClick={()=>navigate(step.id)} aria-label={`学习先修：${step.title}`}>
          <span><small>{step.number} · {step.direct?'直接先修':'前置基础'}</small><strong>{step.title}</strong></span>
          <span className="prerequisite-status">{statusLabels[step.status]}</span>
        </button>
      </li>)}</ol>:<p role="status">这些先修章节均已自评掌握，可以继续本章；取消隐藏可随时回顾。</p>}
    </>:<p>可以直接从本章开始。</p>}
  </details>;
}
