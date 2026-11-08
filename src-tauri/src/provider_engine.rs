use crate::services::{self, ServicesState};
use serde_json::{json,Value};
use std::{collections::HashMap, io::{BufRead,BufReader,Write}, process::{Child,ChildStdin,Command,Stdio}, sync::{Arc,Mutex}, time::Duration};
use tauri::{AppHandle,Manager,State};
use tokio::sync::oneshot;

type Pending=Arc<Mutex<HashMap<String,oneshot::Sender<Result<Value,String>>>>>;
struct Process {child:Mutex<Child>,stdin:Mutex<ChildStdin>,pending:Pending}
impl Drop for Process {fn drop(&mut self){if let Ok(child)=self.child.get_mut(){let _=child.kill();let _=child.wait();}}}
impl Process {
 fn start(app:&AppHandle)->Result<Arc<Self>,String>{
  #[cfg(target_os="android")]
  return Err("此版本的 Android 暂不包含订阅登录运行时，请使用自定义 API 服务。".into());
  #[allow(unreachable_code)]
  {
   let name=if cfg!(target_os="windows"){"provider-engine.exe"}else{"provider-engine"};
   let path=if cfg!(debug_assertions){std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("binaries").join(name)}else{std::env::current_exe().map_err(|_|"无法定位应用。")?.parent().ok_or("无法定位运行时。")?.join(name)};
   let mut command=Command::new(path);command.stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::null());
   #[cfg(target_os="windows")]
   {use std::os::windows::process::CommandExt;command.creation_flags(0x08000000);}
   let mut child=command.spawn().map_err(|_|"模型运行时无法启动，请重新安装完整桌面版本。")?;
   let stdin=child.stdin.take().ok_or("无法连接模型运行时。")?;let stdout=child.stdout.take().ok_or("无法读取模型运行时。")?;
   let pending:Pending=Arc::new(Mutex::new(HashMap::new()));let reader_pending=pending.clone();
   std::thread::spawn(move||{
    for line in BufReader::new(stdout).lines(){
     let Ok(line)=line else{break};if line.len()>4_000_000{break;}
     let Ok(value)=serde_json::from_str::<Value>(&line)else{continue};let Some(id)=value["id"].as_str()else{continue};
     if let Ok(mut pending)=reader_pending.lock(){if let Some(tx)=pending.remove(id){let _=tx.send(if value.get("error").is_some(){Err("模型服务操作失败，请检查连接或重新登录。".into())}else{Ok(value["result"].clone())});}}
    }
    if let Ok(mut pending)=reader_pending.lock(){for (_,tx) in pending.drain(){let _=tx.send(Err("模型运行时已退出，请重新启动应用。".into()));}}
   });
   let _=app;
   Ok(Arc::new(Self{child:Mutex::new(child),stdin:Mutex::new(stdin),pending}))
  }
 }
 async fn call(&self,action:&str,data:Value)->Result<Value,String>{
  let id=uuid::Uuid::new_v4().to_string();let (tx,rx)=oneshot::channel();
  self.pending.lock().map_err(|_|"运行时繁忙。")?.insert(id.clone(),tx);
  let encoded=json!({"id":id,"action":action,"data":data}).to_string();
  let written=(||{let mut stdin=self.stdin.lock().map_err(|_|"运行时繁忙。")?;writeln!(stdin,"{encoded}").and_then(|_|stdin.flush()).map_err(|_|"模型运行时连接中断。")})();
  if let Err(e)=written{if let Ok(mut p)=self.pending.lock(){p.remove(&id);}return Err(e.into());}
  let result=tokio::time::timeout(Duration::from_secs(135),rx).await.map_err(|_|"模型服务请求超时。".to_string()).and_then(|r|r.map_err(|_|"运行时连接已关闭。".to_string())).and_then(|r|r);
  if let Ok(mut p)=self.pending.lock(){p.remove(&id);}result
 }
}
#[derive(Default)]
pub struct EngineState {process:Mutex<Option<Arc<Process>>>,pub gate:tokio::sync::Mutex<()>,completed:Mutex<HashMap<String,Value>>}
impl EngineState {
 pub async fn call(&self,app:&AppHandle,action:&str,data:Value)->Result<Value,String>{
  let process={let mut slot=self.process.lock().map_err(|_|"运行时繁忙。")?;if slot.is_none(){*slot=Some(Process::start(app)?);}slot.as_ref().unwrap().clone()};
  process.call(action,data).await
 }
}
#[tauri::command]
pub async fn provider_engine_request(app:AppHandle,engine:State<'_,EngineState>,state:State<'_,Mutex<ServicesState>>,action:String,data:Value)->Result<Value,String>{
 match action.as_str(){
  "catalog"=>engine.call(&app,"catalog",json!({})).await,
  "loginStart"=>engine.call(&app,"loginStart",json!({"providerId":data["providerId"],"method":data["method"],"hostId":services::managed_host_id(&state)?})).await,
  "loginInput"|"loginCancel"=>engine.call(&app,&action,json!({"sessionId":data["sessionId"],"promptId":data["promptId"],"value":data["value"]})).await,
  "loginPoll"=>{
   let _guard=engine.gate.lock().await;
   let id=data["sessionId"].as_str().ok_or("会话无效。")?;
   if let Some(value)=engine.completed.lock().map_err(|_|"会话不可用。")?.get(id).cloned(){return Ok(value);}
   let result=engine.call(&app,"loginPoll",json!({"sessionId":id})).await?;
   if result["state"]!="complete"{return Ok(result);}
   let models=engine.call(&app,"models",json!({"providerId":result["providerId"],"credential":result["credential"]})).await?;
   let model=models["models"][0]["id"].as_str().ok_or("此账号暂无可用模型。")?;
   let credential=models.get("credential").filter(|v|!v.is_null()).unwrap_or(&result["credential"]);
   let snapshot=services::store_managed_login(&state,&result,model,credential)?;
   let response=json!({"sessionId":id,"providerId":result["providerId"],"state":"complete","snapshot":snapshot});
   {let mut cache=engine.completed.lock().map_err(|_|"会话不可用。")?;if cache.len()>=8{cache.clear();}cache.insert(id.into(),response.clone());}
   let _=engine.call(&app,"loginForget",json!({"sessionId":id})).await;
   Ok(response)
  },
  "models"=>{
   let _guard=engine.gate.lock().await;
   let (service,secret)=services::managed_service(&state,data["id"].as_str().ok_or("服务无效。")?)?;
   let result=engine.call(&app,"models",json!({"providerId":service.provider_id,"credential":serde_json::from_str::<Value>(&secret).map_err(|_|"凭据格式无效。")?})).await?;
   if let Some(credential)=result.get("credential").filter(|v|!v.is_null()){services::persist_managed_credential(&state,&service.id,credential)?;}
   Ok(json!({"models":result["models"],"catalogOnly":result["catalogOnly"]}))
  },
  _=>Err("不支持的服务操作。".into())
 }
}
#[tauri::command]
pub fn open_provider_url(url:String)->Result<(),String>{
 let parsed=url::Url::parse(&url).map_err(|_|"登录地址无效。")?;
 if parsed.scheme()!="https"||!parsed.username().is_empty()||parsed.password().is_some(){return Err("只允许 HTTPS 登录地址。".into());}
 #[cfg(target_os="windows")]
 let result=Command::new("rundll32.exe").args(["url.dll,FileProtocolHandler",&url]).spawn();
 #[cfg(target_os="macos")]
 let result=Command::new("open").arg(&url).spawn();
 #[cfg(target_os="linux")]
 let result=Command::new("xdg-open").arg(&url).spawn();
 #[cfg(not(any(target_os="windows",target_os="macos",target_os="linux")))]
 return Err("请复制登录地址并在浏览器中打开。".into());
 #[cfg(any(target_os="windows",target_os="macos",target_os="linux"))]
 result.map(|_|()).map_err(|_|"无法打开浏览器，请复制登录地址。".into())
}
pub fn register(app:&mut tauri::App){app.manage(EngineState::default());}
