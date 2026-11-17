import {useState} from 'react';
import {Download} from 'lucide-react';
import type {Lesson} from '../types';
import {createLessonDownload,saveLessonDownload} from '../lesson-download';
import './LessonDownload.css';

export function LessonDownload({lesson,note}:{lesson:Lesson;note:string}){
  const [includeNote,setIncludeNote]=useState(false);
  const [status,setStatus]=useState('');
  return <details className="lesson-download">
    <summary>下载本章</summary>
    <p>保存四种阅读模式、公式、练习与参考答案为 Markdown 文件。交互实验需在应用中运行。</p>
    <label><input type="checkbox" checked={includeNote} onChange={event=>{setIncludeNote(event.target.checked);setStatus('');}}/>附上本章笔记{!note.trim()?'（当前为空）':''}</label>
    <button type="button" className="button secondary compact" onClick={()=>{
      try{
        saveLessonDownload(createLessonDownload(lesson,includeNote?note:undefined));
        setStatus('已发起下载，请查看浏览器或系统下载列表。');
      }catch{
        setStatus('下载未能开始，请重试或换用浏览器下载。');
      }
    }}><Download size={15}/>下载 Markdown</button>
    <span role="status">{status}</span>
  </details>;
}
