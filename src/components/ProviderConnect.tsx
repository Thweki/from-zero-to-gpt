import {useEffect,useRef,useState} from 'react';
import {ExternalLink,KeyRound,LogIn,X} from 'lucide-react';
import {openProviderUrl,providerEngineRequest} from '../provider-manager';
import type {ProviderCatalogEntry,ProviderLoginState,ProviderModelOption} from '../provider-engine-types';
import type {ProviderServiceDraft,ProviderServiceSnapshot} from '../provider-services';

export function ProviderConnect({onConnected,onCustom}:{onConnected:(snapshot:ProviderServiceSnapshot)=>void;onCustom:()=>void}){
 const [providers,setProviders]=useState<ProviderCatalogEntry[]>([]),[providerId,setProviderId]=useState('openai');
 const [session,setSession]=useState(''),[login,setLogin]=useState<ProviderLoginState|null>(null),[input,setInput]=useState('');
 const [error,setError]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
 const connected=useRef(onConnected);connected.current=onConnected;
 const mounted=useRef(true);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 useEffect(()=>{let live=true;void providerEngineRequest<{providers:ProviderCatalogEntry[]}>('catalog').then(data=>{if(live)setProviders(data.providers);}).catch(e=>{if(live)setError(e.message);}).finally(()=>{if(live)setLoading(false);});return()=>{live=false;};},[]);
 useEffect(()=>{
  if(!session)return;
  let live=true,timer:ReturnType<typeof setTimeout>;
  const poll=async()=>{
   try{
    const state=await providerEngineRequest<ProviderLoginState>('loginPoll',{sessionId:session});if(!live)return;
    setLogin(state);
    if(state.state==='complete'&&state.snapshot){setSession('');setBusy(false);connected.current(state.snapshot);return;}
    if(state.state==='error'){setError(state.error||'登录未完成。');setBusy(false);return;}
    timer=setTimeout(()=>void poll(),1000);
   }catch(e){if(live){setError(e instanceof Error?e.message:'无法读取登录状态。');setBusy(false);}}
  };void poll();
  return()=>{live=false;clearTimeout(timer);void providerEngineRequest('loginCancel',{sessionId:session}).catch(()=>{});};
 },[session]);
 const provider=providers.find(p=>p.id===providerId);
 const start=async(method:string)=>{
  setError('');setInput('');setLogin(null);setBusy(true);
  try{const result=await providerEngineRequest<{sessionId:string}>('loginStart',{providerId,method});if(!mounted.current){void providerEngineRequest('loginCancel',{sessionId:result.sessionId}).catch(()=>{});return;}setSession(result.sessionId);}catch(e){if(mounted.current){setError(e instanceof Error?e.message:'连接失败。');setBusy(false);}}
 };
 const submit=async()=>{
  if(!login?.prompt)return;const promptId=login.prompt.id;setBusy(true);setError('');
  try{await providerEngineRequest('loginInput',{sessionId:session,promptId,value:input});setInput('');setLogin(current=>current?{...current,prompt:undefined}:current);}catch(e){setError(e instanceof Error?e.message:'提交失败。');setBusy(false);}
 };
 const url=login?.event?.type==='device_code'?login.event.verificationUri:login?.event?.url;
 const safeUrl=url?.startsWith('https:')?url:undefined;
 return <section className="provider-connect" aria-label="连接模型服务">
  <div className="provider-section-heading"><h3>连接你的模型服务</h3><span>选择服务 → 登录 → 选择模型</span></div>
  <label className="provider-picker">服务商<select aria-label="服务商" disabled={!!session||loading} value={providerId} onChange={e=>setProviderId(e.target.value)}>{providers.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
  {loading&&<p role="status">正在加载服务商…</p>}
  {!session&&provider&&<><p className="provider-connect-help">{provider.methods.some(m=>m.id==='oauth')?'使用已有订阅登录，或选择此服务支持的 Key 方式。':'粘贴此服务提供的 API Key，接口地址会自动配置。'}</p><div className="provider-methods">{provider.methods.map(method=><button className={`button ${method.id==='oauth'?'primary':'secondary'}`} key={method.id} disabled={busy} onClick={()=>void start(method.id)}>{method.id==='oauth'?<LogIn size={16}/>:<KeyRound size={16}/>} {method.name}</button>)}</div></>}
  {session&&<div className="provider-login" aria-live="polite">
   <div className="provider-section-heading"><strong>{provider?.name} · 正在连接</strong><button className="icon-button" aria-label="取消连接" onClick={()=>{setSession('');setLogin(null);setInput('');setBusy(false);}}><X size={16}/></button></div>
   {login?.notice?.message&&<p>{login.notice.message}</p>}
   {login?.notice?.links?.filter(link=>link.url.startsWith('https:')).map(link=><button type="button" className="text-button" key={link.url} onClick={()=>void openProviderUrl(link.url).catch(e=>setError(e.message))}>{link.label||'打开服务说明'}</button>)}
   {login?.event?.message&&<p>{login.event.message}</p>}
   {login?.event?.instructions&&<p>{login.event.instructions}</p>}
   {login?.event?.userCode&&<div className="provider-device-code"><span>在授权页面输入</span><code>{login.event.userCode}</code></div>}
   {safeUrl&&<button className="button secondary" onClick={()=>void openProviderUrl(safeUrl).catch(e=>setError(e.message))}><ExternalLink size={16}/>打开浏览器授权</button>}
   {login?.prompt?<form className="provider-login-prompt" key={login.prompt.id} onSubmit={e=>{e.preventDefault();void submit();}}><label>{login.prompt.type==='secret'?'粘贴 API Key':login.prompt.type==='manual_code'?'完成授权后，粘贴回调地址或授权码':login.prompt.message}
    {login.prompt.type==='select'?<select aria-label="授权选项" value={input} onChange={e=>setInput(e.target.value)} required><option value="">请选择</option>{login.prompt.options?.map(o=><option value={o.id} key={o.id}>{o.label}</option>)}</select>:<input autoFocus aria-label={login.prompt.type==='secret'?'API Key':'授权输入'} type={login.prompt.type==='secret'?'password':'text'} value={input} autoComplete="off" spellCheck={false} onChange={e=>setInput(e.target.value)} placeholder={login.prompt.placeholder}/>}
    {login.prompt.type==='secret'&&<small>{login.prompt.message}</small>}
    </label><button type="submit" className="button primary">继续</button></form>:<p className="provider-login-wait">{error?'连接暂停，请重试或取消。':'等待授权完成…'}</p>}
  </div>}
  {error&&<p className="provider-message error" role="alert">{error}</p>}
  {!session&&<button className="text-button provider-custom" onClick={onCustom}>高级：本地模型或自定义接口</button>}
 </section>;
}

export function ManagedServiceEditor({draft,onChange,onSave,busy}:{draft:ProviderServiceDraft;onChange:(patch:Partial<ProviderServiceDraft>)=>void;onSave:()=>void;busy:boolean}){
 const [models,setModels]=useState<ProviderModelOption[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[revision,setRevision]=useState(0);
 useEffect(()=>{let live=true;setLoading(true);setError('');void providerEngineRequest<{models:ProviderModelOption[];catalogOnly?:boolean}>('models',{id:draft.id}).then(data=>{if(live){setModels(data.models);if(data.catalogOnly)setError('暂时无法刷新，当前显示内置模型目录。');}}).catch(e=>{if(live)setError(e.message);}).finally(()=>{if(live)setLoading(false);});return()=>{live=false;};},[draft.id,revision]);
 return <section className="provider-editor" aria-label="已连接服务设置"><div className="provider-section-heading"><h3>选择导师使用的模型</h3><button className="text-button" disabled={loading||busy} onClick={()=>setRevision(v=>v+1)}>刷新模型</button></div><div className="provider-form-grid"><label>显示名称<input aria-label="服务名称" value={draft.name} disabled={busy} maxLength={60} onChange={e=>onChange({name:e.target.value})}/></label><label>模型<select aria-label="模型" value={draft.model} disabled={loading||busy} onChange={e=>onChange({model:e.target.value})}>{!models.some(m=>m.id===draft.model)&&<option value={draft.model}>{draft.model}</option>}{models.map(m=><option value={m.id} key={m.id}>{m.name} · {m.id}</option>)}</select></label></div>{loading&&<p role="status">正在读取模型目录…</p>}{error&&<p role="status">{error}</p>}<div className="provider-editor-actions"><button className="button primary" disabled={busy||loading||!draft.name.trim()||!draft.model} onClick={onSave}>保存并使用此模型</button><span>模型可用性以账号权限和实际请求结果为准。</span></div></section>;
}
