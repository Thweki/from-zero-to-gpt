import {useEffect,useRef,useState} from 'react';
import {Link} from 'lucide-react';
import {buildLessonLink,type LessonLink} from '../lesson-share';
import './ShareLessonLink.css';

export function ShareLessonLink({lessonId,mode,heading}:LessonLink){
  const [status,setStatus]=useState(''),[manual,setManual]=useState<{url:string}|null>(null),[copying,setCopying]=useState(false);
  const input=useRef<HTMLInputElement>(null);
  const url=buildLessonLink(location.href,{lessonId,mode,heading});
  useEffect(()=>{if(manual){input.current?.focus();input.current?.select();}},[manual]);
  const copy=async()=>{
    if(!url){setStatus('请在浏览器中打开课程后复制链接。');return;}
    setCopying(true);setStatus('');
    try{await navigator.clipboard.writeText(url);setManual(null);setStatus('链接已复制');}
    catch{setStatus('无法自动复制，请复制下方链接。');setManual({url});}
    finally{setCopying(false);}
  };
  return <div className="lesson-share">
    <button className="text-button" type="button" disabled={copying} onClick={()=>void copy()} aria-label={heading?`复制小节链接：${heading}`:'复制本章链接'}><Link size={16} aria-hidden="true"/>{heading?'复制链接':'复制本章链接'}</button>
    <span className="lesson-share-status" role="status">{status}</span>
    {manual&&<input ref={input} aria-label="手动复制课程链接" readOnly value={manual.url} onFocus={event=>event.currentTarget.select()}/>}
  </div>;
}
