import {useEffect,useState} from 'react';
import {Check,KeyRound,Pencil,Plus,RefreshCw,ShieldCheck,Trash2} from 'lucide-react';
import type {ProviderServiceDraft,ProviderServiceSnapshot,ServiceAuthMethod} from '../provider-services';
import {activateProviderService,providerServicesSnapshot,removeProviderService,saveProviderService} from '../provider-manager';
import {useTutorConnection} from '../tutor-connection';
import './ProviderSettings.css';
import {ProviderConnect,ManagedServiceEditor} from './ProviderConnect';

const blank=():ProviderServiceDraft=>({name:'',baseUrl:'',model:'',authMethod:'api-key',allowLocalHttp:false});
const authLabels={'api-key':'API key','github-copilot':'GitHub Copilot（旧配置，需重新连接）','none':'无需凭据（仅限你信任的服务）'};

export function ProviderSettings(){
  const {refresh,checking,status,error:connectionError}=useTutorConnection();
  const [snapshot,setSnapshot]=useState<ProviderServiceSnapshot|null>(null);
  const [draft,setDraft]=useState<ProviderServiceDraft>(blank);
  const [secret,setSecret]=useState('');
  const [editor,setEditor]=useState<'connect'|'custom'|'managed'>('connect');
  const [messageKind,setMessageKind]=useState<'success'|'error'>('success');
  const [message,setMessage]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
  const selected=snapshot?.services.find(service=>service.id===draft.id);
  const load=async()=>{
    try{const next=await providerServicesSnapshot();setSnapshot(next);const current=next.services.find(service=>service.id===next.activeId)??next.services[0];if(current){setDraft({...current});if(current.authMethod==='managed')setEditor('managed');}setMessage('');}
    catch(error){setMessageKind('error');setMessage(error instanceof Error?error.message:'无法读取服务配置。');}
    finally{setLoading(false);}
  };
  useEffect(()=>{void load();},[]);
  const update=(patch:Partial<ProviderServiceDraft>)=>setDraft(current=>({...current,...patch}));
  const publish=(next:ProviderServiceSnapshot,text:string)=>{
    setSnapshot(next);setSecret('');setMessageKind('success');setMessage(text);const current=next.services.find(service=>service.id===next.activeId)??next.services[0];if(current){setDraft({...current});setEditor(current.authMethod==='managed'?'managed':'custom');}else{setDraft(blank());setEditor('connect');}void refresh();
  };
  const save=async()=>{
    setBusy(true);setMessage('');
    try{publish(await saveProviderService(draft,secret?secret:undefined),'服务配置已保存。');}
    catch(error){setMessageKind('error');setMessage(error instanceof Error?error.message:'保存失败。');}
    finally{setBusy(false);}
  };
  const activate=async(id:string)=>{
    setBusy(true);setMessage('');
    try{publish(await activateProviderService(id),'已切换当前模型服务。');}
    catch(error){setMessageKind('error');setMessage(error instanceof Error?error.message:'切换失败。');}
    finally{setBusy(false);}
  };
  const remove=async(id:string)=>{
    if(!window.confirm('删除此模型服务及其凭据？课程、笔记和学习记录不会受影响。'))return;
    setBusy(true);setMessage('');
    try{publish(await removeProviderService(id),'服务已删除；学习数据未改变。');}
    catch(error){setMessageKind('error');setMessage(error instanceof Error?error.message:'删除失败。');}
    finally{setBusy(false);}
  };
  return <div className="provider-settings">
    <div className="section-title provider-heading"><div><h2>模型服务</h2><p>为 AI 导师选择模型，课程与实验可独立使用。</p></div><button className="button secondary compact" disabled={busy||loading||!snapshot} onClick={()=>{setDraft(blank());setEditor('connect');setSecret('');setMessage('');}}><Plus size={16}/>新增服务</button></div>
    <div className={`provider-connection ${checking?'checking':status?.configured?'ready':'unavailable'}`} role="status">
      <div><strong>{checking?'正在检测连接':status?.configured?'当前服务已配置':'模型服务未就绪'}</strong><p>{checking?'正在读取当前服务状态…':status?.configured?`${status.provider} · ${status.model}`:connectionError}</p></div>
      <button className="text-button" disabled={checking||busy} onClick={()=>refresh()}><RefreshCw size={14}/>重新检查</button>
    </div>
    {loading?<p role="status">正在读取本地服务配置…</p>:snapshot&&<>
      <section className="provider-saved" aria-label="已保存的模型服务">
        <div className="provider-section-heading"><h3>已保存服务</h3><span>{snapshot.services.length} 个服务</span></div>
        {snapshot.services.length===0?<div className="provider-empty"><KeyRound size={20}/><div><strong>添加第一个模型服务</strong><p>选择服务商，粘贴 Key 或登录已有订阅。</p></div></div>:<div className="provider-list">
          {snapshot.services.map(service=><div className={`provider-service ${snapshot.activeId===service.id?'active':''}`} key={service.id}>
            <div className="provider-service-info"><div className="provider-service-name"><strong>{service.name}</strong>{snapshot.activeId===service.id&&<span className="provider-current"><Check size={12}/>当前使用</span>}</div><span className="provider-model">{service.model}</span>{service.authMethod!=='managed'&&<small>{service.baseUrl}</small>}</div>
            <span className={`credential-state ${service.hasCredential||service.authMethod==='none'?'ready':''}`}>{service.hasCredential||service.authMethod==='none'?<Check size={13}/>:<KeyRound size={13}/>} {service.authMethod==='none'?'无需密钥':service.hasCredential?'凭据已保存':'缺少凭据'}</span>
            <div className="provider-service-actions">{snapshot.activeId!==service.id&&<button className="text-button" disabled={busy} onClick={()=>void activate(service.id)}>使用此服务</button>}<button className="icon-button" disabled={busy} aria-label={`编辑服务：${service.name}`} onClick={()=>{setDraft({...service});setEditor(service.authMethod==='managed'?'managed':'custom');setSecret('');setMessage('');}}><Pencil size={16}/></button><button className="icon-button provider-delete" aria-label={`删除服务：${service.name}`} disabled={busy} onClick={()=>void remove(service.id)}><Trash2 size={16}/></button></div>
          </div>)}
        </div>}
      </section>
      {editor==='connect'&&<ProviderConnect onConnected={next=>publish(next,'凭据已保存，请选择模型。')} onCustom={()=>{setDraft(blank());setEditor('custom');setSecret('');}}/>}
      {editor==='managed'&&<ManagedServiceEditor key={draft.id} draft={draft} onChange={update} onSave={()=>void save()} busy={busy}/>}
      {editor==='custom'&&<form className="provider-editor" aria-label="服务编辑器" onSubmit={event=>{event.preventDefault();if(!busy&&draft.authMethod!=='github-copilot')void save();}}>
        <div className="provider-section-heading"><h3>{draft.id?'编辑服务':'新增服务'}</h3><span>{draft.id?draft.name:'支持 OpenAI 兼容接口'}</span></div>
        <fieldset disabled={busy}>
          <div className="provider-form-grid">
            <label>服务名称<input aria-label="服务名称" required maxLength={60} value={draft.name} onChange={event=>update({name:event.target.value})} placeholder="例如：本地 Ollama"/></label>
            <label>模型 ID<input className="provider-code-input" aria-label="模型 ID" required maxLength={160} value={draft.model} onChange={event=>update({model:event.target.value})} placeholder="填写服务提供的模型 ID" spellCheck={false} autoCapitalize="none"/></label>
            <label className="provider-url">接口地址<input className="provider-code-input" aria-label="接口地址" required type="url" value={draft.baseUrl} onChange={event=>update({baseUrl:event.target.value})} placeholder="https://provider.example/v1" spellCheck={false} autoCapitalize="none" aria-describedby="provider-url-help"/><small id="provider-url-help">填写 API 基础地址，无需追加 /chat/completions。</small></label>
            <label className="provider-auth">认证方式<select aria-label="认证方式" value={draft.authMethod} onChange={event=>update({authMethod:event.target.value as ServiceAuthMethod})}>{Object.entries(authLabels).map(([id,label])=><option value={id} key={id} disabled={id==='github-copilot'}>{label}</option>)}</select></label>
            {draft.authMethod==='api-key'&&<label className="provider-secret">API key<input type="password" aria-label="API key" autoComplete="off" value={secret} onChange={event=>setSecret(event.target.value)} placeholder={selected?.hasCredential?'留空以保留已保存密钥':'输入 API key'}/><small>密钥不进入学习数据或导出备份。</small></label>}
            <label className="provider-local"><input type="checkbox" checked={draft.allowLocalHttp===true} onChange={event=>update({allowLocalHttp:event.target.checked})}/><span>允许本机 HTTP 连接<small>仅用于 localhost / 127.0.0.1，例如本地 Ollama。</small></span></label>
          </div>
          {draft.authMethod==='github-copilot'&&<p className="provider-auth-note">此旧配置不包含登录凭据。请点击「新增服务」，选择 GitHub Copilot 并登录。</p>}
          <div className="provider-editor-actions"><button type="submit" className="button primary" disabled={busy||draft.authMethod==='github-copilot'||!draft.name.trim()||!draft.baseUrl.trim()||!draft.model.trim()}>{busy?'正在处理…':'保存并使用此服务'}</button><span>保存后，AI 导师将使用此配置。</span></div>
        </fieldset>
      </form>}
    </>}
    {message&&<p className={`provider-message ${messageKind}`} role={messageKind==='error'?'alert':'status'}>{message}</p>}
    <div className="provider-storage-note"><ShieldCheck size={15}/><span>配置保存在本机，凭据单独保存，不随学习数据导出。</span></div>
  </div>;
}
