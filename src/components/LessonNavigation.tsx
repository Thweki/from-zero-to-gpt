import {useRef} from 'react';
import {BookOpen,Code2,FlaskConical,CheckCheck} from 'lucide-react';
export type LessonSection='reading'|'experiment'|'code'|'quiz';
export function LessonNavigation({onGo}:{onGo:(section:LessonSection)=>void}){
  const menu=useRef<HTMLDetailsElement>(null);
  const go=(section:LessonSection)=>{if(menu.current)menu.current.open=false;onGo(section);};
  return <details ref={menu} className="lesson-location" onKeyDown={e=>{if(e.key==='Escape'){e.stopPropagation();e.currentTarget.open=false;e.currentTarget.querySelector('summary')?.focus();}}}><summary>本章定位</summary><nav className="lesson-jump-nav" aria-label="本章内容定位">
    <button onClick={()=>go('reading')} aria-label="跳到本章正文"><BookOpen size={14}/>正文</button>
    <button onClick={()=>go('experiment')} aria-label="跳到交互实验"><FlaskConical size={14}/>交互实验</button>
    <button onClick={()=>go('code')} aria-label="跳到 Python 代码"><Code2 size={14}/>Python 代码</button>
    <button onClick={()=>go('quiz')} aria-label="跳到自测练习"><CheckCheck size={14}/>自测</button>
  </nav></details>;
}
