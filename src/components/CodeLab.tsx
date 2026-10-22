import { useEffect, useRef, useState } from 'react';
import { Play, RotateCcw, Square, Check, Copy, Code2 } from 'lucide-react';
import type { Lesson } from '../types';
type Props={lesson:Lesson; code:string; lastRun?:string; onCode:(code:string)=>void; onResult:(result:string)=>void};
export function CodeLab({lesson,code,lastRun,onCode,onResult}:Props){
  const worker=useRef<Worker|null>(null),timer=useRef<ReturnType<typeof setTimeout>|null>(null);
  const [running,setRunning]=useState(false),[status,setStatus]=useState(''),[reference,setReference]=useState(false),[copied,setCopied]=useState(false);
  function stop(){worker.current?.terminate();worker.current=null;if(timer.current)clearTimeout(timer.current);setRunning(false);}
  useEffect(()=>()=>{worker.current?.terminate();if(timer.current)clearTimeout(timer.current);},[]);
  const run=()=>{
    stop();setRunning(true);setStatus('正在启动独立 Python 运行环境…');
    const current=new Worker('/python.worker.js');worker.current=current;
    const limit=()=>{stop();onResult('运行已停止：超过 30 秒限制。可以检查循环后重新运行。');setStatus('已超时');};
    timer.current=setTimeout(limit,30000);
    current.onmessage=({data})=>{
      if(data.type==='loading'){setStatus('首次加载本地 Pyodide 资源，可能需要片刻…');return;}
      const result=(data.type==='error'?'运行错误\n':data.passed?'✓ 本章单元测试通过\n':'')+data.output;
      onResult(result);setStatus(data.type==='error'?'请根据错误继续调试':'执行完成');stop();
    };
    current.onerror=()=>{onResult('Python 环境加载失败。请检查静态资源 /python/ 是否部署完整，再重试。');setStatus('加载失败');stop();};
    current.postMessage({code,tests:lesson.pythonTests});
  };
  return <section className="code-lab" aria-label="Python 代码实验室"><div className="code-toolbar"><span><Code2 size={16}/> experiment.py <small>Python 3 · Pyodide</small></span><div><button className="text-button" onClick={()=>setReference(!reference)}>{reference?'隐藏参考':'对照参考'}</button><button className="icon-button" aria-label="重置代码" onClick={()=>{onCode(lesson.starter);onResult('');}}><RotateCcw size={15}/></button></div></div><p className="code-description">{lesson.codeExplanation}</p><div className="editor-wrap"><div className="line-numbers" aria-hidden="true">{code.split('\n').map((_,i)=><div key={i}>{i+1}</div>)}</div><textarea className="code-editor" aria-label="Python 代码编辑器" spellCheck={false} value={code} onChange={e=>onCode(e.target.value)} onKeyDown={e=>{if((e.ctrlKey||e.metaKey)&&e.key===']'){e.preventDefault();const target=e.currentTarget,start=target.selectionStart;onCode(code.slice(0,start)+'    '+code.slice(target.selectionEnd));requestAnimationFrame(()=>{target.selectionStart=target.selectionEnd=start+4;});}if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){e.preventDefault();if(!running)run();}}}/></div><div className="code-actions"><span>{running?status:'Tab 切换焦点 · Ctrl/⌘ + ] 插入缩进'}</span>{running?<button className="button secondary" onClick={()=>{stop();onResult('已手动停止运行。代码已保留。');}}><Square size={14}/>停止</button>:<button className="button primary compact" onClick={run}><Play size={14}/>运行并测试 <kbd>⌘/Ctrl ↵</kbd></button>}</div>{lastRun&&<div className={`code-output ${lastRun.startsWith('✓')?'success':''}`} role="status"><small>运行结果</small><pre>{lastRun}</pre></div>}
    {reference&&<div className="reference-code"><div><strong>参考实现</strong><button className="text-button" onClick={()=>{void navigator.clipboard?.writeText(lesson.reference).then(()=>{setCopied(true);setTimeout(()=>setCopied(false),2000);});}}>{copied?<Check size={14}/>:<Copy size={14}/>}复制</button></div><p>建议先保存自己的尝试，逐行比较哪里不同。</p><pre>{lesson.reference}</pre></div>}<details className="test-source"><summary>查看实际运行的验收测试</summary><pre>{lesson.pythonTests}</pre></details></section>;
}
