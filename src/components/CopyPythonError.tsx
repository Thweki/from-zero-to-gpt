import {useEffect,useRef,useState} from 'react';
import {Copy} from 'lucide-react';

export function CopyPythonError({report}:{report:string}){
  const [status,setStatus]=useState<'idle'|'copying'|'copied'|'failed'>('idle');
  const active=useRef(true);
  useEffect(()=>{active.current=true;return()=>{active.current=false;};},[]);
  async function copy(){
    setStatus('copying');
    try{
      await navigator.clipboard.writeText(report);
      if(active.current)setStatus('copied');
    }catch{
      if(active.current)setStatus('failed');
    }
  }
  return <div className="python-error-copy">
    <button type="button" className="text-button" disabled={status==='copying'} onClick={()=>void copy()}><Copy size={14}/>复制错误信息</button>
    <span role="status">{status==='copying'?'正在复制…':status==='copied'?'错误信息已复制':status==='failed'?'无法访问剪贴板，请选择下方文本手动复制。':''}</span>
    {status==='failed'&&<textarea aria-label="可手动复制的错误信息" readOnly value={report} rows={5} onFocus={event=>event.currentTarget.select()}/>}
  </div>;
}
