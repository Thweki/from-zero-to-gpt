use serde::Serialize;
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::Manager;

mod services;
mod tutor;

static NATIVE_MATERIAL_ACTIVE: AtomicBool = AtomicBool::new(false);

#[cfg(target_os = "macos")]
const MATERIAL_KIND: &str = "NSVisualEffectView/Sidebar";
#[cfg(target_os = "windows")]
const MATERIAL_KIND: &str = "Mica/Acrylic";
#[cfg(not(any(target_os = "macos", target_os = "windows")))]
const MATERIAL_KIND: &str = "css-fallback";

#[derive(Serialize)]
struct NativeMaterialStatus {
  kind: &'static str,
  active: bool,
}

#[tauri::command]
fn native_material_status() -> NativeMaterialStatus {
  NativeMaterialStatus {
    kind: MATERIAL_KIND,
    active: NATIVE_MATERIAL_ACTIVE.load(Ordering::Relaxed),
  }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![
      native_material_status,
      services::provider_services_snapshot,
      services::provider_service_save,
      services::provider_service_activate,
      services::provider_service_remove,
      tutor::native_tutor_status,
      tutor::native_tutor_chat,
      tutor::native_tutor_cancel
    ])
    .setup(|app| {
      services::register(app)?;
      tutor::register(app)?;
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }

      #[cfg(target_os = "macos")]
      {
        use window_vibrancy::{apply_vibrancy, NSVisualEffectMaterial};
        use objc2_app_kit::{NSWindow, NSWindowCollectionBehavior};
        let window = app.get_webview_window("main").expect("main window exists");
        let ns_window = unsafe { &*window.ns_window().expect("NSWindow exists").cast::<NSWindow>() };
        ns_window.setCollectionBehavior(ns_window.collectionBehavior() | NSWindowCollectionBehavior::FullScreenPrimary);
        let result = apply_vibrancy(&window, NSVisualEffectMaterial::Sidebar, None, None);
        NATIVE_MATERIAL_ACTIVE.store(result.is_ok(), Ordering::Relaxed);
        if let Err(error) = result {
          eprintln!("Native macOS vibrancy unavailable; using CSS fallback: {error}");
        }
      }

      #[cfg(target_os = "windows")]
      {
        use window_vibrancy::{apply_acrylic, apply_mica};
        let window = app.get_webview_window("main").expect("main window exists");
        let version = windows_version::OsVersion::current();
        let windows_11 = version.major > 10 || (version.major == 10 && version.build >= 22000);
        let result = if windows_11 {
          apply_mica(&window, None).or_else(|_| apply_acrylic(&window, Some((32, 35, 31, 150))))
        } else {
          apply_acrylic(&window, Some((32, 35, 31, 150)))
        };
        NATIVE_MATERIAL_ACTIVE.store(result.is_ok(), Ordering::Relaxed);
        if let Err(error) = result {
          eprintln!("Native Windows material unavailable; using CSS fallback: {error}");
        }
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while building tauri application");
}

#[cfg(target_os = "android")]
#[allow(non_snake_case)]
#[unsafe(no_mangle)]
pub extern "system" fn Java_org_fromzerotogpt_learning_MainActivity_initializeNdkContext(
  env: jni::JNIEnv,
  _class: jni::objects::JObject,
  context: jni::objects::JObject,
) {
  use std::{ffi::c_void, sync::OnceLock};
  use jni::objects::GlobalRef;
  static CONTEXT: OnceLock<Option<GlobalRef>> = OnceLock::new();
  CONTEXT.get_or_init(|| match env.new_global_ref(&context) {
    Ok(reference) => {
      let vm = env.get_java_vm().expect("Java VM").get_java_vm_pointer() as *mut c_void;
      unsafe { ndk_context::initialize_android_context(vm, reference.as_obj().as_raw() as _) };
      Some(reference)
    }
    Err(error) => {
      eprintln!("Unable to retain Android application context: {error}");
      None
    }
  });
}
