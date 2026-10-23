import {useEffect,useState,type RefObject} from 'react';
import {Expand,Minimize2} from 'lucide-react';

export function FullscreenButton({target,label}:{target:RefObject<HTMLElement|null>;label:string}){
  const [active,setActive]=useState(false),[error,setError]=useState('');
  const supported=typeof document!=='undefined'&&document.fullscreenEnabled&&typeof document.documentElement.requestFullscreen==='function';
  useEffect(()=>{
    const update=()=>setActive(document.fullscreenElement===target.current);
    update();document.addEventListener('fullscreenchange',update);
    return()=>document.removeEventListener('fullscreenchange',update);
  },[target]);
  const name=active?'退出全屏':label;
  async function toggle(){
    setError('');
    try{
      if(document.fullscreenElement===target.current)await document.exitFullscreen();
      else await target.current?.requestFullscreen();
    }catch{setError('浏览器未能切换全屏，可以继续在页面中操作。');}
  }
  return <span className="fullscreen-control"><button type="button" className="fullscreen-button" disabled={!supported} aria-label={supported?name:'当前浏览器不支持全屏'} aria-pressed={active} title={supported?name:'当前浏览器不支持全屏'} onClick={()=>void toggle()}>{active?<Minimize2 size={15}/>:<Expand size={15}/>}<span>{!supported?'全屏不可用':active?'退出全屏':'全屏'}</span></button>{error&&<small className="fullscreen-error" role="status">{error}</small>}</span>;
}
