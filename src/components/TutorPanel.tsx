import {useEffect,useRef,useState} from 'react';
import {ArrowUpRight,Check,ChevronDown,LoaderCircle,Send,Sparkles,Square,Trash2,WifiOff,X} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import type {Lesson,TutorMessage,ViewMode} from '../types';
import {selectionSummary,type TutorSelection} from '../tutor-selection';
import './SelectionTutor.css';
import './TutorPanel.css';
type Status={configured:boolean;provider:string;model:string;baseURL:string;accessCodeRequired?:boolean;imagesSupported?:boolean;error?:string};
const modeOptions=[{id:'guide',label:'跟着问题讲解'},{id:'hint',label:'只给一个提示'},{id:'explain',label:'换个方式解释'},{id:'review',label:'复习先修知识'},{id:'solution',label:'完整解答（我已尝试）'}] as const;
type Mode=typeof modeOptions[number]['id'];
const readingLabels={intuition:'直觉理解',math:'数学推导',code:'代码实现',deep:'深入研究'};
type Props={lesson:Lesson;messages:TutorMessage[];onMessages:(messages:TutorMessage[])=>void;code?:string;note?:string;lastRun?:string;draft?:string;onDraft?:(draft:string)=>void;compact?:boolean;readingMode?:ViewMode;selection?:TutorSelection;onSelection?:(selection:TutorSelection|undefined)=>void};
function SelectionCard({selection,imagesSupported,onRemove}:{selection:TutorSelection;imagesSupported?:boolean;onRemove?:()=>void}){
  return <div className="tutor-selection-card" aria-label="所选内容">
    <header><strong>{selection.kind==='image'?'已选图表':'已选文字'} · {selection.title}</strong>{onRemove&&<button className="icon-button" aria-label="移除所选内容" onClick={onRemove}><X size={14}/></button>}</header>
    {selection.image&&<img src={selection.image} alt={`所选图表预览：${selection.title}`}/>}
    <details open={selection.kind==='text'}><summary>{selection.kind==='text'?'引用原文':'图表说明与选择时的参数'}</summary><blockquote>{selection.text}</blockquote></details>
    {selection.kind==='image'&&onRemove&&<p>{imagesSupported&&selection.image?'发送时会附上这张图片和图表说明。':selection.image?'当前模型仅接收图表文字与参数，预览不上传。':'此图片无法复制预览，将发送标题与图表说明。'}</p>}
  </div>;
}
function retainRecentImages(messages:TutorMessage[]){
  let images=0;
  return messages.slice().reverse().map(message=>{
    if(!message.selection?.image||++images<=4)return message;
    const {image:_,...selection}=message.selection;return {...message,selection};
  }).reverse();
}
export function TutorPanel({lesson,messages,onMessages,code='',note='',lastRun='',draft='',onDraft,compact=false,readingMode='intuition',selection,onSelection}:Props){
  const [status,setStatus]=useState<Status|null>(null),[input,setInput]=useState(draft),[mode,setMode]=useState<Mode>('guide');
  const [difficulty,setDifficulty]=useState('beginner'),[shareCode,setShareCode]=useState(false),[shareNote,setShareNote]=useState(false);
  const [pending,setPending]=useState(false),[error,setError]=useState(''),[accessCode,setAccessCode]=useState(''),[options,setOptions]=useState(false);
  const controller=useRef<AbortController|null>(null),bottom=useRef<HTMLDivElement>(null),composer=useRef<HTMLTextAreaElement>(null),current=useRef(messages);
  current.current=messages;
  const refresh=()=>{fetch('/api/tutor/status').then(async response=>{if(!response.ok)throw new Error();return response.json();}).then(setStatus).catch(()=>setStatus({configured:false,provider:'',model:'',baseURL:'',error:'暂时无法连接导师。可以先保留问题，再重新连接。'}));};
  useEffect(()=>{refresh();return()=>controller.current?.abort();},[]);
  useEffect(()=>{setInput(draft);},[draft]);
  useEffect(()=>{bottom.current?.scrollIntoView({block:'nearest',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});},[messages.length,pending]);
  const editDraft=(text:string)=>{setInput(text);onDraft?.(text);};
  const prepareQuestion=(text:string)=>{editDraft(text);composer.current?.focus();};
  const canSend=Boolean(status?.configured&&(!status.accessCodeRequired||accessCode.trim()));
  async function send(retry=false){
    if(pending||!canSend)return;
    const latest=current.current;
    const text=retry?latest.at(-1)?.content:input.trim();if(!text)return;
    const reference=retry?latest.at(-1)?.selection:selection;
    const transmittedReference=reference?{...reference,...(!status?.imagesSupported?{image:undefined}:{})}:undefined;
    const user:TutorMessage=retry?latest[latest.length-1]:{role:'user',content:text,createdAt:new Date().toISOString(),...(transmittedReference?{selection:transmittedReference}:{})};
    const history=retry?latest.slice(0,-1):latest;
    const combined=retainRecentImages([...history,user].slice(-80));
    onMessages(combined);if(!retry){editDraft('');onSelection?.(undefined);}setError('');setPending(true);
    const abort=new AbortController();controller.current=abort;
    try{
      const payload={lessonId:lesson.id,message:text,history:history.slice(-12).map(({role,content,selection})=>({role,content:`${content}${selection?`\n\n${selectionSummary(selection)}`:''}`.slice(0,8000)})),mode,difficulty,readingMode,shareCode,shareNote,...(transmittedReference?{selection:transmittedReference}:{}),...(shareCode?{code:code.slice(0,8000),error:lastRun.slice(0,3000)}:{}),...(shareNote?{note:note.slice(0,2000)}:{}),sessionId:`fz-gpt-${lesson.id}-${(combined[0]?.createdAt||user.createdAt).replace(/[^A-Za-z0-9]/g,'')}`};
      while(new TextEncoder().encode(JSON.stringify(payload)).length-(transmittedReference?.image?.length||0)>60000&&payload.history.length)payload.history.shift();
      const response=await fetch('/api/tutor/chat',{method:'POST',headers:{'Content-Type':'application/json',...(accessCode?{Authorization:`Bearer ${accessCode}`}:{})},signal:abort.signal,body:JSON.stringify(payload)});
      const result=await response.json().catch(()=>({error:'导师服务返回了无法读取的内容。'}));
      if(!response.ok)throw new Error(result.error||'导师服务暂时不可用。');
      if(typeof result.answer!=='string'||!result.answer.trim())throw new Error('导师没有返回内容，请重试。');
      if(!abort.signal.aborted)onMessages(retainRecentImages([...combined,{role:'assistant' as const,content:result.answer,createdAt:new Date().toISOString()}].slice(-80)));
    }catch(cause){if(!abort.signal.aborted||controller.current)setError(abort.signal.aborted?'已停止回复。问题已保留，可以重试。':cause instanceof Error?cause.message:'连接失败，可以稍后重试。');}
    finally{setPending(false);controller.current=null;}
  }
  const suggestions=readingMode==='math'?[
    {label:'这个公式怎么一步步得到？',question:`请逐步解释本章公式 $${lesson.formula}$，先说明每个符号的含义。`},
    {label:'用一个小例子算给我看',question:`请用一个不同于本章练习的小例子，说明「${lesson.title}」的计算过程。`},
  ]:readingMode==='code'?[
    {label:'帮我理解编程任务',question:`我正在实现「${lesson.title}」。请先解释任务要求，再给我一个排查或实现的小提示，不要直接给完整代码。`},
    {label:'怎样检查我的实现？',question:`实现「${lesson.title}」时，我应该先手算哪个小例子，检查哪些边界？`},
  ]:readingMode==='deep'?[
    {label:'这个方法有什么局限？',question:`「${lesson.title}」的假设和适用边界是什么？请区分教学简化和实际模型。`},
    {label:'下一步适合读什么？',question:`围绕「${lesson.title}」，请从本章引用中推荐一份下一步阅读材料，并给出一个阅读问题。`},
  ]:[
    {label:'换个例子解释这一节',question:`请用一个不同于本章练习的小例子，直观解释「${lesson.title}」。`},
    {label:'我需要先补什么？',question:`理解「${lesson.title}」需要哪些先修知识？先问我一个问题，帮我找到没理解的地方。`},
  ];
  const lastUser=messages.at(-1)?.role==='user';
  return <section className={`tutor-panel ${compact?'compact':''}`} aria-label="AI 导师对话">
    <details className={`tutor-model ${status?.configured?'online':''}`}><summary>{status?.configured?'已连接 · 查看模型':'连接状态'}</summary><span>{status?.configured?`${status.provider} · ${status.model}`:'导师连接未就绪'}</span><button className="text-button" onClick={refresh}>检查</button></details>
    {!status?.configured&&<div className="tutor-unavailable"><WifiOff size={17}/><p>{status?.error||'服务端尚未配置模型密钥。教材和数学实验仍可照常使用。'}</p><div className="button-row"><button className="text-button" onClick={refresh}>重新连接</button><a href="#/settings">查看模型连接说明<ArrowUpRight size={12}/></a></div></div>}
    <div className="tutor-scope"><strong>{lesson.title}</strong><span>正在看：{readingLabels[readingMode]}</span><p>已带上教材；代码和笔记由你选择附上。</p></div>
    <div className="tutor-messages" role="log" aria-label="导师对话记录" aria-live="polite">
      {messages.length===0?<div className="tutor-empty"><h3>哪一步没想通？</h3><p>直接提问就好。也可以先选一个问题，再按你的想法修改。</p><div className="tutor-quick">{suggestions.map(suggestion=><button disabled={pending} key={suggestion.label} onClick={()=>prepareQuestion(suggestion.question)}>{suggestion.label}<ArrowUpRight size={12}/></button>)}</div></div>:messages.map((message,i)=><article className={`tutor-message ${message.role}`} key={`${message.createdAt}-${i}`}><span className="tutor-speaker">{message.role==='user'?'你':'AI 导师'}</span>{message.selection&&<SelectionCard selection={message.selection}/>}<div className="tutor-markdown"><ReactMarkdown disallowedElements={['img']} remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{message.content}</ReactMarkdown></div></article>)}
      {pending&&<div className="tutor-pending"><LoaderCircle size={14}/>正在结合本章回答…</div>}<div ref={bottom}/>
    </div>
    {error&&<div className="tutor-error" role="alert">{error}</div>}
    {lastUser&&!pending&&<button className="tutor-retry" onClick={()=>void send(true)} disabled={!canSend}>重试上次问题</button>}
    <div className="tutor-composer">
      {selection&&<SelectionCard selection={selection} imagesSupported={status?.imagesSupported} onRemove={()=>onSelection?.(undefined)}/>}
      {mode==='solution'&&<p className="solution-note"><Check size={12}/>你已主动选择完整解答；导师会解释每一步。</p>}
      {(shareCode||shareNote)&&<div className="tutor-attachments">{shareCode&&<button onClick={()=>setShareCode(false)} aria-label="不再附上代码和错误">已附上代码和错误<X size={13}/></button>}{shareNote&&<button onClick={()=>setShareNote(false)} aria-label="不再附上笔记">已附上笔记<X size={13}/></button>}</div>}
      <textarea ref={composer} aria-label="向 AI 导师提问" placeholder="哪一句、哪个公式，或哪一步代码没想通？" maxLength={4000} value={input} onChange={event=>editDraft(event.target.value)} onKeyDown={event=>{
        if(event.key==='Enter'&&!event.shiftKey&&!event.nativeEvent.isComposing&&event.keyCode!==229){event.preventDefault();if(input.trim())void send();}
      }}/>
      {readingMode==='code'&&!shareCode&&<button className="text-button tutor-attach-code" onClick={()=>setShareCode(true)}>附上当前代码{lastRun?'和最近运行结果':''}</button>}
      {status?.accessCodeRequired&&<label className="tutor-access">导师访问码<input type="password" aria-label="导师访问码" autoComplete="off" value={accessCode} onChange={event=>setAccessCode(event.target.value)}/></label>}
      <div className="tutor-compose-actions"><button className="text-button" onClick={()=>setOptions(!options)} aria-expanded={options}><ChevronDown size={13}/>讲解与分享设置</button>{pending?<button className="button secondary compact" onClick={()=>controller.current?.abort()}><Square size={13}/>停止</button>:<button className="button primary compact" disabled={!input.trim()||!canSend} onClick={()=>void send()}><Send size={13}/>发送</button>}</div>
      {options&&<div className="tutor-options">
        <label>讲解方式<select aria-label="导师回答方式" value={mode} onChange={event=>setMode(event.target.value as Mode)}>{modeOptions.map(option=><option key={option.id} value={option.id}>{option.label}</option>)}</select></label>
        <label>解释深度<select aria-label="导师解释难度" value={difficulty} onChange={event=>setDifficulty(event.target.value)}><option value="beginner">从直觉开始</option><option value="standard">连接公式与代码</option><option value="deep">推导与边界</option></select></label>
        <label className="checkbox"><input type="checkbox" checked={shareCode} onChange={event=>setShareCode(event.target.checked)}/>分享当前代码和最近错误</label>
        <label className="checkbox"><input type="checkbox" checked={shareNote} onChange={event=>setShareNote(event.target.checked)}/>分享当前章节笔记</label>
        <p>选中的内容会发送至所示模型提供商。访问码仅保留在当前页面内存，不是模型 API 密钥。</p>
      </div>}
    </div>
    <div className="tutor-footnote"><span>Enter 发送 · Shift+Enter 换行<br/>回答可能出错，请用实验验证。</span><button className="icon-button" aria-label="清空本章导师对话" disabled={pending||!messages.length} onClick={()=>{if(window.confirm('清空本章导师对话？笔记和代码会保留。'))onMessages([]);}}><Trash2 size={13}/></button></div>
  </section>;
}
export function TutorConnection(){
  const [status,setStatus]=useState<Status|null>(null);
  useEffect(()=>{fetch('/api/tutor/status').then(r=>r.ok?r.json():Promise.reject()).then(setStatus).catch(()=>setStatus({configured:false,provider:'',model:'',baseURL:'',error:'当前部署尚未提供导师后端。'}));},[]);
  return <><div className="section-title"><h2>AI 导师连接</h2><span className={`badge ${status?.configured?'':'neutral'}`}>{status?.configured?'已配置服务端连接':'未连接'}</span></div>{status?.configured?<dl className="tutor-config"><div><dt>提供商</dt><dd>{status.provider}</dd></div><div><dt>模型</dt><dd>{status.model}</dd></div><div><dt>接口</dt><dd>{status.baseURL}</dd></div><div><dt>密钥</dt><dd>仅在服务端 · 浏览器不可读取</dd></div></dl>:<p>{status?.error||'设置服务端环境变量后，刷新即可连接。没有密钥时，全部教材和实验仍可使用。'}</p>}<a className="button secondary compact" href="#/tutor"><Sparkles size={14}/>打开 AI 导师<ArrowUpRight size={14}/></a><details className="tutor-config-help"><summary>更换提供商或自部署模型</summary><p>在服务器或托管平台设置以下变量后重启／重新部署。支持 OpenAI 兼容 Chat Completions；地址和模型由服务端决定，浏览器不能修改上游地址或读取密钥。</p><pre>{`TUTOR_PROVIDER=OpenCode Go\nTUTOR_BASE_URL=https://opencode.ai/inference/go/openai/v1\nTUTOR_MODEL=deepseek-v4.1-flash\nTUTOR_API_KEY=<仅在服务端填写>\n# 公网自部署可加独立访问码：\nTUTOR_ACCESS_TOKEN=<访问码>`}</pre><p>本地可复制 .env.example 为 .env，再使用 npm run dev 或构建后 npm start。自建本地 HTTP 模型还需显式设置 TUTOR_ALLOW_LOCAL_HTTP=1。不要把密钥放在 VITE_ 变量、源码或学习数据中。</p><a href="https://opencode.ai/docs/go/" target="_blank" rel="noreferrer" className="text-button">OpenCode Go 官方接口说明<ArrowUpRight size={12}/></a></details></>;
}
