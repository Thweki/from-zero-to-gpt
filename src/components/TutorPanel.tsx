import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Check, ChevronDown, Lightbulb, LoaderCircle, Send, Sparkles, Square, Trash2, WifiOff } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import type { Lesson, TutorMessage } from '../types';
import './TutorPanel.css';
type Status={configured:boolean;provider:string;model:string;baseURL:string;accessCodeRequired?:boolean;error?:string};
const modeOptions=[{id:'hint',label:'给我提示'},{id:'explain',label:'解释概念'},{id:'review',label:'复习先修'},{id:'solution',label:'完整解答'}] as const;
type Mode=typeof modeOptions[number]['id'];
export function TutorPanel({lesson,messages,onMessages,code='',note='',lastRun='',draft='',onDraft,compact=false}:{lesson:Lesson;messages:TutorMessage[];onMessages:(messages:TutorMessage[])=>void;code?:string;note?:string;lastRun?:string;draft?:string;onDraft?:(draft:string)=>void;compact?:boolean}){
  const [status,setStatus]=useState<Status|null>(null),[input,setInput]=useState(draft),[mode,setMode]=useState<Mode>('hint'),[difficulty,setDifficulty]=useState('standard'),[shareCode,setShareCode]=useState(false),[shareNote,setShareNote]=useState(false),[pending,setPending]=useState(false),[error,setError]=useState(''),[accessCode,setAccessCode]=useState(''),[options,setOptions]=useState(false);
  const controller=useRef<AbortController|null>(null),bottom=useRef<HTMLDivElement>(null),current=useRef(messages);current.current=messages;
  const refresh=()=>{fetch('/api/tutor/status').then(async r=>{if(!r.ok)throw new Error();return r.json();}).then(setStatus).catch(()=>setStatus({configured:false,provider:'',model:'',baseURL:'',error:'无法连接导师后端。纯静态部署时，请按设置页说明启动本地服务或部署 Worker。'}));};
  useEffect(()=>{refresh();return()=>controller.current?.abort();},[]);
  useEffect(()=>{bottom.current?.scrollIntoView({block:'nearest',behavior:'smooth'});},[messages.length,pending]);
  async function send(retry=false,quick?:string){
    if(pending)return;
    const latest=current.current;
    const text=retry?latest.at(-1)?.content:quick||input.trim();if(!text)return;
    const user:TutorMessage=retry?latest[latest.length-1]:{role:'user',content:text,createdAt:new Date().toISOString()};
    const history=retry?latest.slice(0,-1):latest;
    const combined=[...history,user].slice(-80);
    onMessages(combined);if(!retry&&!quick){setInput('');onDraft?.('');}setError('');setPending(true);
    const abort=new AbortController();controller.current=abort;
    try{
      const payload={lessonId:lesson.id,message:text,history:history.slice(-12).map(({role,content})=>({role,content:content.slice(0,8000)})),mode,difficulty,shareCode,shareNote,...(shareCode?{code:code.slice(0,8000),error:lastRun.slice(0,3000)}:{}),...(shareNote?{note:note.slice(0,2000)}:{}),sessionId:`fz-gpt-${lesson.id}-${(combined[0]?.createdAt||user.createdAt).replace(/[^A-Za-z0-9]/g,'')}`};
      while(new TextEncoder().encode(JSON.stringify(payload)).length>60000&&payload.history.length)payload.history.shift();
      const response=await fetch('/api/tutor/chat',{method:'POST',headers:{'Content-Type':'application/json',...(accessCode?{Authorization:`Bearer ${accessCode}`}:{})},signal:abort.signal,body:JSON.stringify(payload)});
      const result=await response.json().catch(()=>({error:'导师服务返回了无法读取的内容。'}));
      if(!response.ok)throw new Error(result.error||'导师服务暂时不可用。');
      if(typeof result.answer!=='string'||!result.answer.trim())throw new Error('导师没有返回内容，请重试。');
      if(!abort.signal.aborted)onMessages([...combined,{role:'assistant' as const,content:result.answer,createdAt:new Date().toISOString()}].slice(-80));
    }catch(e){if(!abort.signal.aborted||controller.current)setError(abort.signal.aborted?'已停止回复。问题已保留，可以重试。':e instanceof Error?e.message:'连接失败，可以稍后重试。');}
    finally{setPending(false);controller.current=null;}
  }
  const lastUser=messages.at(-1)?.role==='user';
  return <section className={`tutor-panel ${compact?'compact':''}`} aria-label="AI 导师对话"><div className="tutor-heading"><span><Sparkles size={17}/>理解的伙伴</span>{compact?<a className="icon-button" href="#/tutor" aria-label="在主栏打开 AI 导师"><ArrowUpRight size={15}/></a>:<span className="badge"><Lightbulb size={12}/>提示优先</span>}</div><div className={`tutor-model ${status?.configured?'online':''}`}><span className="online-dot"/>{status?.configured?`${status.provider} · ${status.model}`:'导师连接未就绪'}<button className="text-button" onClick={refresh}>检查</button></div>
  {!status?.configured&&<div className="tutor-unavailable"><WifiOff size={17}/><p>{status?.error||'服务端尚未配置模型密钥。教材和数学实验仍可照常使用。'}</p><a href="#/settings">查看模型连接说明<ArrowUpRight size={12}/></a></div>}
  <div className="tutor-scope"><span>当前上下文</span><strong>{lesson.title}</strong><p>默认只发送本章教材与对话。代码和笔记由你选择分享。</p></div>
  <div className="tutor-messages" role="log" aria-label="导师对话记录" aria-live="polite">{messages.length===0?<div className="tutor-empty"><Lightbulb size={25}/><h3>把没想通的那一步，说出来。</h3><p>导师会先给提示和引导问题。你仍然掌握着思考的方向。</p><div className="tutor-quick">{['用直觉解释这个概念','问我一个引导性问题','我需要复习哪些先修知识？'].map(q=><button disabled={!status?.configured||pending} key={q} onClick={()=>void send(false,q)}>{q}<ArrowUpRight size={12}/></button>)}</div></div>:messages.map((m,i)=><article className={`tutor-message ${m.role}`} key={`${m.createdAt}-${i}`}><span className="tutor-speaker">{m.role==='user'?'我的问题':'AI 导师'}</span><div className="tutor-markdown"><ReactMarkdown disallowedElements={['img']} remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{m.content}</ReactMarkdown></div></article>)}{pending&&<div className="tutor-pending"><LoaderCircle size={14}/>导师正在结合本章思考…</div>}<div ref={bottom}/></div>
  {error&&<div className="tutor-error" role="alert">{error}</div>}{lastUser&&!pending&&<button className="tutor-retry" onClick={()=>void send(true)} disabled={!status?.configured}>重试上次问题</button>}
  <div className="tutor-composer"><div className="tutor-modes" role="group" aria-label="导师回答方式">{modeOptions.map(m=><button className={mode===m.id?'selected':''} aria-pressed={mode===m.id} key={m.id} onClick={()=>setMode(m.id)}>{m.label}</button>)}</div>{mode==='solution'&&<p className="solution-note"><Check size={12}/>你已主动选择完整解答；导师会解释每一步。</p>}<textarea aria-label="向 AI 导师提问" placeholder="我理解了……但还不明白……" maxLength={4000} value={input} onChange={e=>{setInput(e.target.value);onDraft?.(e.target.value);}} onKeyDown={e=>{if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){e.preventDefault();if(input.trim()&&status?.configured)void send();}}}/><div className="tutor-compose-actions"><button className="text-button" onClick={()=>setOptions(!options)} aria-expanded={options}><ChevronDown size={13}/>上下文与难度</button>{pending?<button className="button secondary compact" onClick={()=>controller.current?.abort()}><Square size={13}/>停止</button>:<button className="button primary compact" disabled={!input.trim()||!status?.configured} onClick={()=>void send()}><Send size={13}/>发送</button>}</div>{options&&<div className="tutor-options"><label>解释难度<select aria-label="导师解释难度" value={difficulty} onChange={e=>setDifficulty(e.target.value)}><option value="beginner">从基础直觉开始</option><option value="standard">连接公式与代码</option><option value="deep">严格推导与边界</option></select></label><label className="checkbox"><input type="checkbox" checked={shareCode} onChange={e=>setShareCode(e.target.checked)}/>分享当前代码和最近错误</label><label className="checkbox"><input type="checkbox" checked={shareNote} onChange={e=>setShareNote(e.target.checked)}/>分享当前章节笔记</label>{status?.accessCodeRequired&&<label>自部署访问码<input type="password" aria-label="导师访问码" autoComplete="off" value={accessCode} onChange={e=>setAccessCode(e.target.value)}/></label>}<p>选中的内容会发送至所示模型提供商。访问码仅保留在当前页面内存，不是模型 API 密钥。</p></div>}</div><div className="tutor-footnote"><span>回答可能出错，请用教材与实验验证。</span><button className="icon-button" aria-label="清空本章导师对话" disabled={pending||!messages.length} onClick={()=>{if(window.confirm('清空本章导师对话？笔记和代码会保留。'))onMessages([]);}}><Trash2 size={13}/></button></div></section>;
}
export function TutorConnection(){
  const [status,setStatus]=useState<Status|null>(null);
  useEffect(()=>{fetch('/api/tutor/status').then(r=>r.ok?r.json():Promise.reject()).then(setStatus).catch(()=>setStatus({configured:false,provider:'',model:'',baseURL:'',error:'当前部署尚未提供导师后端。'}));},[]);
  return <><div className="section-title"><h2>AI 导师连接</h2><span className={`badge ${status?.configured?'':'neutral'}`}>{status?.configured?'已配置服务端连接':'未连接'}</span></div>{status?.configured?<dl className="tutor-config"><div><dt>提供商</dt><dd>{status.provider}</dd></div><div><dt>模型</dt><dd>{status.model}</dd></div><div><dt>接口</dt><dd>{status.baseURL}</dd></div><div><dt>密钥</dt><dd>仅在服务端 · 浏览器不可读取</dd></div></dl>:<p>{status?.error||'设置服务端环境变量后，刷新即可连接。没有密钥时，全部教材和实验仍可使用。'}</p>}<a className="button secondary compact" href="#/tutor"><Sparkles size={14}/>打开 AI 导师<ArrowUpRight size={14}/></a><details className="tutor-config-help"><summary>更换提供商或自部署模型</summary><p>在服务器或托管平台设置以下变量后重启／重新部署。支持 OpenAI 兼容 Chat Completions；地址和模型由服务端决定，浏览器不能修改上游地址或读取密钥。</p><pre>{`TUTOR_PROVIDER=OpenCode Go\nTUTOR_BASE_URL=https://opencode.ai/inference/go/openai/v1\nTUTOR_MODEL=deepseek-v4.1-flash\nTUTOR_API_KEY=<仅在服务端填写>\n# 公网自部署可加独立访问码：\nTUTOR_ACCESS_TOKEN=<访问码>`}</pre><p>本地可复制 .env.example 为 .env，再使用 npm run dev 或构建后 npm start。自建本地 HTTP 模型还需显式设置 TUTOR_ALLOW_LOCAL_HTTP=1。不要把密钥放在 VITE_ 变量、源码或学习数据中。</p><a href="https://opencode.ai/docs/go/" target="_blank" rel="noreferrer" className="text-button">OpenCode Go 官方接口说明<ArrowUpRight size={12}/></a></details></>;
}
