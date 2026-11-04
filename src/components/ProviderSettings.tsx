import {useEffect,useState} from 'react';
import {Check,KeyRound,Pencil,Plus,ShieldCheck,Trash2} from 'lucide-react';
import type {ProviderServiceDraft,ProviderServiceSnapshot,ServiceAuthMethod} from '../provider-services';
import {activateProviderService,providerServicesSnapshot,removeProviderService,saveProviderService} from '../provider-manager';
import {isTauriRuntime} from '../runtime';
import {useTutorConnection} from '../tutor-connection';
import './ProviderSettings.css';

const blank=():ProviderServiceDraft=>({name:'',baseUrl:'',model:'',authMethod:'api-key',allowLocalHttp:false});
const authLabels:Record<ServiceAuthMethod,string>={'api-key':'API key','github-copilot':'GitHub Copilot 订阅 · OAuth 设备登录','none':'无需凭据（仅限你信任的服务）'};

export function ProviderSettings(){
  const {refresh}=useTutorConnection();
  const [snapshot,setSnapshot]=useState<ProviderServiceSnapshot|null>(null);
  const [draft,setDraft]=useState<ProviderServiceDraft>(blank);
  const [secret,setSecret]=useState('');
  const [message,setMessage]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
  const selected=snapshot?.services.find(service=>service.id===draft.id);
  const load=async()=>{
    try{const next=await providerServicesSnapshot();setSnapshot(next);const current=next.services.find(service=>service.id===next.activeId)??next.services[0];if(current)setDraft({...current});setMessage('');}
    catch(error){setMessage(error instanceof Error?error.message:'无法读取服务配置。');}
    finally{setLoading(false);}
  };
  useEffect(()=>{void load();},[]);
  const update=(patch:Partial<ProviderServiceDraft>)=>setDraft(current=>({...current,...patch}));
  const publish=(next:ProviderServiceSnapshot,text:string)=>{
    setSnapshot(next);setSecret('');setMessage(text);const current=next.services.find(service=>service.id===next.activeId)??next.services[0];if(current)setDraft({...current});else setDraft(blank());void refresh();
  };
  const save=async()=>{
    setBusy(true);setMessage('');
    try{publish(await saveProviderService(draft,secret?secret:undefined),'服务配置已保存。');}
    catch(error){setMessage(error instanceof Error?error.message:'保存失败。');}
    finally{setBusy(false);}
  };
  const activate=async(id:string)=>{
    setBusy(true);setMessage('');
    try{publish(await activateProviderService(id),'已切换当前模型服务。');}
    catch(error){setMessage(error instanceof Error?error.message:'切换失败。');}
    finally{setBusy(false);}
  };
  const remove=async(id:string)=>{
    if(!window.confirm('删除此模型服务及其凭据？课程、笔记和学习记录不会受影响。'))return;
    setBusy(true);setMessage('');
    try{publish(await removeProviderService(id),'服务已删除；学习数据未改变。');}
    catch(error){setMessage(error instanceof Error?error.message:'删除失败。');}
    finally{setBusy(false);}
  };
  return <div className="provider-settings">
    <div className="section-title"><h2>模型服务</h2><button className="text-button" onClick={()=>{setDraft(blank());setSecret('');setMessage('');}}><Plus size={14}/>新增服务</button></div>
    <p className="provider-intro">地址、模型和当前选择保存在本地配置中；凭据单独保存，不进入学习数据或导出备份。</p>
    {loading?<p role="status">正在读取本地服务配置…</p>:snapshot&&<>
      <div className="provider-list" aria-label="已保存的模型服务">
        {snapshot.services.map(service=><div className={`provider-service ${snapshot.activeId===service.id?'active':''}`} key={service.id}>
          <div><strong>{service.name}</strong><span>{service.model}</span><small>{service.baseUrl}</small></div>
          <span className={`credential-state ${service.hasCredential?'ready':''}`}>{service.hasCredential?<Check size={12}/>:<KeyRound size={12}/>} {service.hasCredential?'已配置':'待连接'}</span>
          <div className="provider-service-actions"><button className="text-button" disabled={busy||snapshot.activeId===service.id} onClick={()=>void activate(service.id)}>{snapshot.activeId===service.id?'当前使用':'使用'}</button><button className="icon-button" aria-label={`编辑服务：${service.name}`} onClick={()=>{setDraft({...service});setSecret('');setMessage('');}}><Pencil size={15}/></button><button className="icon-button" aria-label={`删除服务：${service.name}`} disabled={busy} onClick={()=>void remove(service.id)}><Trash2 size={15}/></button></div>
        </div>)}
      </div>
      <div className="provider-editor" aria-label="服务编辑器">
        <div className="provider-form-grid">
          <label>服务名称<input aria-label="服务名称" required maxLength={60} value={draft.name} onChange={event=>update({name:event.target.value})} placeholder="例如：本地 Ollama"/></label>
          <label>模型 ID<input aria-label="模型 ID" required maxLength={160} value={draft.model} onChange={event=>update({model:event.target.value})} placeholder="服务实际提供的模型 ID"/></label>
          <label className="provider-url">接口地址<input aria-label="接口地址" required type="url" value={draft.baseUrl} onChange={event=>update({baseUrl:event.target.value})} placeholder="https://provider.example/v1" spellCheck={false}/></label>
          <label>认证方式<select aria-label="认证方式" value={draft.authMethod} onChange={event=>update({authMethod:event.target.value as ServiceAuthMethod})}>{Object.entries(authLabels).map(([id,label])=><option value={id} key={id}>{label}</option>)}</select></label>
          <label className="provider-local"><input type="checkbox" checked={draft.allowLocalHttp===true} onChange={event=>update({allowLocalHttp:event.target.checked})}/>明确允许 localhost / 127.0.0.1 的 HTTP</label>
        </div>
        {draft.authMethod==='api-key'&&<label className="provider-secret">API key<input type="password" aria-label="API key" autoComplete="off" value={secret} onChange={event=>setSecret(event.target.value)} placeholder={selected?.hasCredential?'留空以保留已保存密钥':'仅提交到本地服务或系统凭据存储'}/></label>}
        {draft.authMethod==='github-copilot'&&<p className="provider-auth-note">GitHub Copilot 设备登录尚未实现；本版请使用 API key 或无需凭据的本地服务。</p>}
        <div className="provider-storage-note"><ShieldCheck size={14}/><span>{isTauriRuntime?'独立应用：使用平台安全凭据能力；原生代理发送请求。':'本地浏览器：由本地 Node 服务保存到仓库外的私有配置目录；这不是系统钥匙串。'}</span></div>
        <div className="provider-editor-actions"><button className="button primary compact" disabled={busy||!draft.name.trim()||!draft.baseUrl.trim()||!draft.model.trim()} onClick={()=>void save()}>{busy?'正在处理…':'保存并使用此服务'}</button><span>支持 OpenAI 兼容 Chat Completions；OAuth 服务使用其专属流程。</span></div>
      </div>
    </>}
    {message&&<p className="provider-message" role="status">{message}</p>}
  </div>;
}
