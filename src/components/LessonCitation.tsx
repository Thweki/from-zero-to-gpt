import {useEffect,useId,useRef,useState} from 'react';
import {Quote} from 'lucide-react';
import type {Lesson,ViewMode} from '../types';
import {lessonCitation} from '../lesson-citation';
import './LessonCitation.css';

export function LessonCitation({lesson,mode,heading}:{lesson:Lesson;mode:ViewMode;heading:string}){
  const [status,setStatus]=useState<'idle'|'copying'|'copied'|'manual'>('idle');
  const [text,setText]=useState('');
  const field=useRef<HTMLTextAreaElement>(null);
  const statusId=useId();
  useEffect(()=>{
    if(status==='manual'){field.current?.focus();field.current?.select();}
  },[status]);
  const copy=async()=>{
    const citation=lessonCitation(lesson,mode,heading,window.location.href);
    setText(citation);setStatus('copying');
    try{
      await navigator.clipboard.writeText(citation);
      setStatus('copied');
    }catch{
      setStatus('manual');
    }
  };
  return <div className="lesson-citation">
    <button className="text-button" aria-label={`复制引用：${heading}`} aria-describedby={statusId} disabled={status==='copying'} onClick={()=>void copy()}><Quote size={14} aria-hidden="true"/>复制引用</button>
    <span id={statusId} role="status">{status==='copied'?'引用已复制':status==='copying'?'正在复制…':status==='manual'?'无法自动复制，请复制下方引用。':''}</span>
    {status==='manual'&&<textarea ref={field} readOnly rows={4} aria-label={`引用文本：${heading}`} value={text} onFocus={event=>event.currentTarget.select()}/>}
  </div>;
}
