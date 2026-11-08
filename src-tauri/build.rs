use std::{path::PathBuf, process::Command};

fn main() {
  let output = PathBuf::from(std::env::var("OUT_DIR").expect("OUT_DIR")).join("lessons.json");
  let status = Command::new("node")
    .current_dir("..")
    .args([
      "node_modules/vite-node/vite-node.mjs",
      "scripts/native-content.ts",
      output.to_string_lossy().as_ref(),
    ])
    .status()
    .expect("node must generate native course content");
  assert!(status.success(), "native course generation failed");
  println!("cargo:rerun-if-changed=../src/data");
  println!("cargo:rerun-if-changed=../scripts/native-content.ts");
  if std::env::var("CARGO_CFG_TARGET_OS").as_deref() != Ok("android") {
    let target = std::env::var("TARGET").expect("TARGET");
    let status = Command::new("node").current_dir("..").env("TAURI_ENV_TARGET_TRIPLE", target)
      .arg("scripts/build-provider-engine.mjs").status().expect("provider engine build");
    assert!(status.success(), "provider engine build failed");
  }
  println!("cargo:rerun-if-changed=../server/provider-engine.ts");
  println!("cargo:rerun-if-changed=../server/provider-worker.ts");
  println!("cargo:rerun-if-changed=../scripts/build-provider-engine.mjs");
  println!("cargo:rerun-if-changed=../package-lock.json");
  tauri_build::build()
}
