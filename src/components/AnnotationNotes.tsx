import type {LessonAnnotation} from '../types';
import {annotationModeLabels, annotationTextLimit, maxAnnotations} from '../annotations';
import './AnnotationNotes.css';

export function AnnotationNotes({annotations,onChange,saveStatus}:{annotations:LessonAnnotation[];onChange:(value:LessonAnnotation[])=>void;saveStatus:string}) {
  if (!annotations.length) return null;
  return <section className="annotation-notes" aria-label="教材批注">
    <h3>教材批注 <small>{annotations.length} / {maxAnnotations}</small></h3>
    <p className="annotation-help">引用保留记录时的文字。批注只在本地保存，不会自动发送给导师。</p>
    {annotations.map((annotation,index) => <div className="annotation-card" key={annotation.id}>
      <div className="annotation-heading"><strong>{annotationModeLabels[annotation.mode]} · 批注 {index+1}</strong><button type="button" className="text-button" aria-label={`删除批注 ${index+1}`} onClick={()=>onChange(annotations.filter(item=>item.id!==annotation.id))}>删除</button></div>
      <blockquote>{annotation.quote}</blockquote>
      <label>我的批注<textarea data-annotation-id={annotation.id} aria-label={`批注 ${index+1} 的想法`} maxLength={annotationTextLimit} placeholder="用自己的话解释，或留下一个问题…" value={annotation.text} onChange={event=>onChange(annotations.map(item=>item.id===annotation.id?{...item,text:event.target.value}:item))}/></label>
    </div>)}
    <span role="status" className="autosave">{saveStatus==='saving'?'批注保存中':saveStatus==='saved'?'批注已本地保存':'批注保存失败，请导出备份'}</span>
  </section>;
}
