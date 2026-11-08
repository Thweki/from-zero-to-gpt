use atomicwrites::{AtomicFile, OverwriteBehavior};
use serde::{Deserialize, Serialize};
use std::{fs, io::Write, path::PathBuf, sync::Mutex};
use tauri::{App, Manager, State};
use url::Url;

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderService {
  #[serde(default, skip_serializing_if = "Option::is_none")]
  pub provider_id: Option<String>,
  pub id: String,
  pub name: String,
  pub base_url: String,
  pub model: String,
  pub auth_method: String,
  #[serde(default)]
  pub allow_local_http: bool,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ServiceDraft {
  #[serde(default)]
  pub provider_id: Option<String>,
  pub id: Option<String>,
  pub name: String,
  pub base_url: String,
  pub model: String,
  pub auth_method: String,
  #[serde(default)]
  pub allow_local_http: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ServiceStatus {
  pub provider_id: Option<String>,
  pub id: String,
  pub name: String,
  pub base_url: String,
  pub model: String,
  pub auth_method: String,
  pub allow_local_http: bool,
  pub has_credential: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ServiceSnapshot {
  pub services: Vec<ServiceStatus>,
  pub active_id: Option<String>,
}

pub struct ServicesState {
  directory: PathBuf,
  services: Vec<ProviderService>,
  active_id: Option<String>,
  read_only: bool,
}

impl ServicesState {
  fn load(app: &App) -> Self {
    let directory = app.path().app_config_dir().unwrap_or_else(|_| PathBuf::from("."));
    Self::load_directory(directory)
  }

  fn load_directory(directory: PathBuf) -> Self {
    let services_path = directory.join("services.json");
    let active_path = directory.join("active-service.json");
    let services = fs::read(&services_path)
      .ok()
      .and_then(|bytes| serde_json::from_slice::<Vec<ProviderService>>(&bytes).ok());
    let active_id = fs::read(active_path).ok().and_then(|bytes| serde_json::from_slice::<Option<String>>(&bytes).ok()).flatten();
    match services {
      Some(services) if services.iter().map(|s| &s.id).collect::<std::collections::HashSet<_>>().len() == services.len() => Self {
        directory,
        active_id: active_id.filter(|id| services.iter().any(|service| &service.id == id)).or_else(|| services.first().map(|s| s.id.clone())),
        services,
        read_only: false,
      },
      Some(_) => Self { directory, services: vec![], active_id: None, read_only: true },
      None if services_path.exists() => Self { directory, services: vec![], active_id: None, read_only: true },
      None => Self { directory, services: vec![], active_id: None, read_only: false },
    }
  }

  fn writable(&self) -> Result<(), String> {
    if self.read_only { Err("服务配置需要修复；为避免覆盖，当前保持只读。".into()) } else { Ok(()) }
  }

  fn write(&self) -> Result<(), String> {
    self.writable()?;
    fs::create_dir_all(&self.directory).map_err(|_| "无法创建应用配置目录。")?;
    for (name, value) in [
      ("services.json", serde_json::to_vec(&self.services).map_err(|_| "无法序列化服务配置。")?),
      ("active-service.json", serde_json::to_vec(&self.active_id).map_err(|_| "无法保存当前服务。")?),
    ] {
      let path = self.directory.join(name);
      AtomicFile::new(&path, OverwriteBehavior::AllowOverwrite)
        .write(|file| file.write_all(&value))
        .map_err(|_| "无法原子写入服务配置。")?;
    }
    Ok(())
  }

  fn snapshot(&self) -> Result<ServiceSnapshot, String> {
    let services = self.services.iter().map(|service| {
      Ok(ServiceStatus {
        provider_id: service.provider_id.clone(), id: service.id.clone(), name: service.name.clone(), base_url: service.base_url.clone(), model: service.model.clone(),
        auth_method: service.auth_method.clone(), allow_local_http: service.allow_local_http,
        has_credential: service.auth_method == "none" || credential(service.id.as_str())?.is_some(),
      })
    }).collect::<Result<Vec<_>, String>>()?;
    Ok(ServiceSnapshot { services, active_id: self.active_id.clone() })
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn restart_restores_selected_service_instead_of_first_service() {
    let directory = std::env::temp_dir().join(format!("from-zero-services-{}", uuid::Uuid::new_v4()));
    let services = ["first", "second"].into_iter().map(|id| ProviderService {
      provider_id: None, id: id.into(), name: id.into(), base_url: "https://example.com/v1".into(),
      model: "test".into(), auth_method: "none".into(), allow_local_http: false,
    }).collect();
    let state = ServicesState { directory: directory.clone(), services, active_id: Some("second".into()), read_only: false };
    state.write().unwrap();
    let restored = ServicesState::load_directory(directory.clone());
    assert_eq!(restored.active_id.as_deref(), Some("second"));
    assert_eq!(restored.services.len(), 2);
    fs::remove_dir_all(directory).unwrap();
  }
}

fn validate(draft: ServiceDraft) -> Result<ProviderService, String> {
  let id = draft.id.unwrap_or_else(|| format!("service-{}", uuid::Uuid::new_v4()));
  if !id.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-') || id.is_empty() || id.len() > 49 {
    return Err("服务 ID 格式无效。".into());
  }
  let name = draft.name.trim().to_string();
  let model = draft.model.trim().to_string();
  if name.is_empty() || name.len() > 60 || model.is_empty() || model.len() > 160 {
    return Err("服务名称或模型格式无效。".into());
  }
  if !["api-key", "github-copilot", "none", "managed"].contains(&draft.auth_method.as_str()) {
    return Err("认证方式无效。".into());
  }
  let url = Url::parse(draft.base_url.trim()).map_err(|_| "服务地址无效。")?;
  let local = ["localhost", "127.0.0.1", "[::1]"].contains(&url.host_str().unwrap_or(""));
  if !url.username().is_empty() || url.password().is_some() || url.query().is_some() || url.fragment().is_some()
    || (url.scheme() != "https" && !(draft.allow_local_http && local && url.scheme() == "http")) {
    return Err("服务地址必须使用 HTTPS；本地 HTTP 需要单独允许。".into());
  }
  Ok(ProviderService {
    provider_id: draft.provider_id, id, name, model, auth_method: draft.auth_method, allow_local_http: draft.allow_local_http,
    base_url: url.to_string().trim_end_matches('/').to_string(),
  })
}

fn credential(id: &str) -> Result<Option<String>, String> {
  let entry = keyring::Entry::new("org.fromzerotogpt.learning", id).map_err(|_| "无法访问系统凭据存储。")?;
  match entry.get_password() {
    Ok(secret) => Ok(Some(secret)),
    Err(keyring::Error::NoEntry) => Ok(None),
    Err(_) => Err("无法读取系统凭据。".into()),
  }
}

fn save_credential(id: &str, secret: Option<String>) -> Result<(), String> {
  let entry = keyring::Entry::new("org.fromzerotogpt.learning", id).map_err(|_| "无法访问系统凭据存储。")?;
  if let Some(secret) = secret {
    if secret.trim().is_empty() || secret.len() > 16_000 { return Err("API key 为空或过长。".into()); }
    entry.set_password(secret.trim()).map_err(|_| "无法保存到系统凭据存储。".to_string())
  } else {
    match entry.delete_credential() {
      Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
      Err(_) => Err("无法删除系统凭据。".into()),
    }
  }
}

#[tauri::command]
pub fn provider_services_snapshot(state: State<'_, Mutex<ServicesState>>) -> Result<ServiceSnapshot, String> {
  state.lock().map_err(|_| "服务状态不可用。")?.snapshot()
}

#[tauri::command]
pub fn provider_service_save(state: State<'_, Mutex<ServicesState>>, service: ServiceDraft, secret: Option<String>) -> Result<ServiceSnapshot, String> {
  let mut state = state.lock().map_err(|_| "服务状态不可用。")?;
  state.writable()?;
  if service.auth_method == "managed" {
    let old = state.services.iter().find(|s| Some(&s.id) == service.id.as_ref());
    if !old.is_some_and(|s| s.auth_method == "managed" && s.provider_id == service.provider_id) || secret.is_some() {
      return Err("请使用服务商登录流程。".into());
    }
  }
  let service = validate(service)?;
  if secret.is_some() && service.auth_method != "api-key" { return Err("此认证方式不接受 API key。".into()); }
  if secret.is_some() { save_credential(&service.id, secret)?; }
  if service.auth_method == "none" { save_credential(&service.id, None)?; }
  let mut services = state.services.clone();
  if let Some(index) = services.iter().position(|item| item.id == service.id) { services[index] = service.clone(); } else { services.push(service.clone()); }
  let previous = state.services.clone();
  let previous_active = state.active_id.clone();
  state.services = services;
  state.active_id = Some(service.id);
  if let Err(error) = state.write() {
    state.services = previous;
    state.active_id = previous_active;
    return Err(error);
  }
  state.snapshot()
}

#[tauri::command]
pub fn provider_service_activate(state: State<'_, Mutex<ServicesState>>, id: String) -> Result<ServiceSnapshot, String> {
  let mut state = state.lock().map_err(|_| "服务状态不可用。")?;
  state.writable()?;
  if !state.services.iter().any(|service| service.id == id) { return Err("服务不存在。".into()); }
  let previous = state.active_id.clone();
  state.active_id = Some(id);
  if let Err(error) = state.write() { state.active_id = previous; return Err(error); }
  state.snapshot()
}

#[tauri::command]
pub fn provider_service_remove(state: State<'_, Mutex<ServicesState>>, id: String) -> Result<ServiceSnapshot, String> {
  let mut state = state.lock().map_err(|_| "服务状态不可用。")?;
  state.writable()?;
  save_credential(&id, None)?;
  let previous = state.services.clone();
  let previous_active = state.active_id.clone();
  state.services.retain(|service| service.id != id);
  if state.active_id.as_deref() == Some(id.as_str()) { state.active_id = state.services.first().map(|service| service.id.clone()); }
  if let Err(error) = state.write() {
    state.services = previous;
    state.active_id = previous_active;
    return Err(error);
  }
  state.snapshot()
}

pub fn active_service(state: &State<'_, Mutex<ServicesState>>) -> Result<(ProviderService, Option<String>), String> {
  let state = state.lock().map_err(|_| "服务状态不可用。")?;
  let service = state.services.iter().find(|service| Some(&service.id) == state.active_id.as_ref())
    .cloned().ok_or("尚未选择模型服务。")?;
  let secret = if service.auth_method == "none" { None } else { credential(&service.id)? };
  Ok((service, secret))
}

pub fn register(app: &mut App) -> Result<(), Box<dyn std::error::Error>> {
  app.manage(Mutex::new(ServicesState::load(app)));
  Ok(())
}

// These helpers never return credentials to the WebView.
pub fn managed_service(state: &State<'_, Mutex<ServicesState>>, id: &str) -> Result<(ProviderService, String), String> {
  let state = state.lock().map_err(|_| "服务状态不可用。")?;
  let service = state.services.iter().find(|s| s.id == id && s.auth_method == "managed").cloned().ok_or("请先连接服务商。")?;
  let secret = credential(id)?.ok_or("登录已失效，请重新连接。")?;
  Ok((service, secret))
}
pub fn persist_managed_credential(state: &State<'_, Mutex<ServicesState>>, id: &str, value: &serde_json::Value) -> Result<(), String> {
  let state = state.lock().map_err(|_| "服务状态不可用。")?;
  if state.services.iter().any(|s| s.id == id) { save_credential(id, Some(value.to_string()))?; }
  Ok(())
}
pub fn store_managed_login(state: &State<'_, Mutex<ServicesState>>, result: &serde_json::Value, model: &str, credential: &serde_json::Value) -> Result<ServiceSnapshot, String> {
  let mut state = state.lock().map_err(|_| "服务状态不可用。")?;state.writable()?;
  let service = validate(ServiceDraft { id: result["serviceId"].as_str().map(String::from), name: result["name"].as_str().unwrap_or("模型服务").into(), provider_id: result["providerId"].as_str().map(String::from), base_url: "https://managed.invalid".into(), model:model.into(), auth_method:"managed".into(), allow_local_http:false })?;
  save_credential(&service.id, Some(credential.to_string()))?;
  let previous = state.services.clone();let active = state.active_id.clone();
  state.services.retain(|s| s.id != service.id);state.services.push(service.clone());state.active_id=Some(service.id);
  if let Err(error)=state.write(){state.services=previous;state.active_id=active;return Err(error);}
  state.snapshot()
}
pub fn managed_host_id(state: &State<'_, Mutex<ServicesState>>) -> Result<String, String> {
  let state=state.lock().map_err(|_| "服务状态不可用。")?;
  let path=state.directory.join("host-id.json");
  if let Ok(bytes)=fs::read(&path){if let Ok(value)=serde_json::from_slice::<String>(&bytes){return Ok(value);}}
  fs::create_dir_all(&state.directory).map_err(|_| "无法创建配置目录。")?;
  let value=format!("urn:uuid:{}",uuid::Uuid::new_v4());
  let bytes=serde_json::to_vec(&value).map_err(|_| "无法生成设备标识。")?;
  AtomicFile::new(path, OverwriteBehavior::AllowOverwrite).write(|f|f.write_all(&bytes)).map_err(|_| "无法保存设备标识。")?;
  Ok(value)
}
