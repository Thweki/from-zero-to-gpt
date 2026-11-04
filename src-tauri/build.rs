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
  tauri_build::build()
}
