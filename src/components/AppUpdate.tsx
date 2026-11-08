import {useEffect,useState} from 'react';
import {ArrowUpCircle,Download,RefreshCw,X} from 'lucide-react';
import packageInfo from '../../package.json';
import {appUpdater,releaseUrl,updaterSupported,useAppUpdate} from '../app-updater';
import {openProviderUrl} from '../provider-manager';
import './AppUpdate.css';
export function AppUpdateNotice(){
 const state=useAppUpdate(),[dismissed,setDismissed]=useState('');
 useEffect(()=>{if(!updaterSupported)return;const timer=setTimeout(()=>{if(appUpdater.getSnapshot().phase==='idle')void appUpdater.check();},4000);return()=>clearTimeout(timer);},[]);
 if(!updaterSupported||!['available','ready'].includes(state.phase)||dismissed===state.version)return null;
 return <div className="app-update-notice" role="status"><ArrowUpCircle size={18}/><span>新版本 {state.version} {state.phase==='ready'?'已下载':'可用'}</span><a className="text-button" href="#/settings">查看更新</a><button className="icon-button" aria-label="稍后更新" onClick={()=>setDismissed(state.version||'')}><X size={15}/></button></div>;
}
export function AppUpdateSettings(){
 const state=useAppUpdate();
 const busy=['checking','downloading','installing'].includes(state.phase);
 const status={idle:'可从 GitHub 获取稳定版更新。',checking:'正在检查 GitHub 最新版本…',latest:'当前已是最新版本。',available:`发现新版本 ${state.version}`,downloading:'正在下载更新包…',ready:'更新包已下载并通过签名校验，可安装重启。',installing:'正在安装更新，请稍候…',installed:'更新已安装，请重启应用。',error:state.error};
 return <section className="settings-card app-update-settings"><div className="section-title"><h2>应用更新</h2><span>当前版本 v{packageInfo.version}</span></div><p role="status">{updaterSupported?status[state.phase]:'浏览器版随网站更新。桌面安装包可从 GitHub 获取。'}</p>
 {state.phase==='downloading'&&<div className="update-progress"><progress aria-label="更新下载进度" value={state.total?state.received:undefined} max={state.total||1}/><span>{(state.received/1024/1024).toFixed(1)} MB{state.total?` / ${(state.total/1024/1024).toFixed(1)} MB`:''}</span></div>}
 {state.notes&&['available','ready'].includes(state.phase)&&<details className="update-notes" open><summary>更新说明</summary><pre>{state.notes}</pre></details>}
 <div className="button-row">{updaterSupported&&<><button className="button secondary" disabled={busy||state.phase==='ready'||state.phase==='installed'} onClick={()=>void appUpdater.check()}><RefreshCw size={16}/>检查更新</button>{state.phase==='available'&&<button className="button primary" onClick={()=>void appUpdater.download()}><Download size={16}/>下载更新</button>}{state.phase==='ready'&&<button className="button primary" onClick={()=>void appUpdater.install()}>安装并重启</button>}</>}<a className="text-button" href={releaseUrl} target="_blank" rel="noreferrer" onClick={e=>{if(updaterSupported){e.preventDefault();void openProviderUrl(releaseUrl);}}}>查看 GitHub 发布页</a></div>
 {state.phase==='installed'&&state.error&&<p role="alert">{state.error}</p>}
 {updaterSupported&&<p className="small-note">启动时检查新版本。下载与安装由你决定，安装时应用会重启。</p>}
 </section>;
}
