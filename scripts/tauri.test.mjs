import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

const config=JSON.parse(readFileSync('src-tauri/tauri.conf.json','utf8'));
const manifest=JSON.parse(readFileSync('package.json','utf8'));
const workflow=readFileSync('.github/workflows/tauri.yml','utf8');
const nativeSource=readFileSync('src-tauri/src/lib.rs','utf8');
const cargo=readFileSync('src-tauri/Cargo.toml','utf8');

test('Tauri uses the existing production frontend and matching public version',()=>{
  assert.equal(config.version,manifest.version);
  assert.equal(config.build.frontendDist,'../dist');
  assert.equal(config.build.beforeBuildCommand,'npm run build');
  assert.equal(config.identifier,'org.fromzerotogpt.learning');
  assert.match(config.app.security.csp,/wasm-unsafe-eval/);
  assert.match(config.app.security.csp,/worker-src 'self' blob:/);
});

test('all requested platform build and artifact paths retain local builds and optional update signing',()=>{
  for(const value of ['macos-15','windows-2025','ubuntu-24.04','npm run android:build','actions/upload-artifact'])assert.ok(workflow.includes(value),value);
  for(const value of ['tauri-action','contents: write','tagName:','releaseDraft:','gh release','APPLE_CERTIFICATE','ANDROID_KEYSTORE'])assert.ok(!workflow.includes(value),value);
  assert.equal(manifest.scripts['desktop:build'],'node scripts/desktop-build.mjs');
  assert.match(readFileSync('scripts/desktop-build.mjs','utf8'),/createUpdaterArtifacts:Boolean\(process.env.TAURI_SIGNING_PRIVATE_KEY\)/);
  assert.match(manifest.scripts['android:build'],/--apk/);
});

test('native materials use real OS calls, report activation and retain cross-platform fallbacks',()=>{
  assert.equal(config.app.windows[0].transparent,true);
  assert.equal(config.app.macOSPrivateApi,true);
  assert.match(config.app.security.csp,/ipc: http:\/\/ipc\.localhost/);
  assert.match(nativeSource,/NSVisualEffectMaterial::Sidebar/);
  assert.match(nativeSource,/NSWindowCollectionBehavior::FullScreenPrimary/);
  assert.match(nativeSource,/apply_vibrancy/);
  assert.match(nativeSource,/apply_mica/);
  assert.match(nativeSource,/apply_acrylic/);
  assert.match(nativeSource,/native_material_status/);
  assert.match(nativeSource,/css-fallback/);
  assert.match(cargo,/cfg\(target_os = "macos"\)/);
  assert.match(cargo,/cfg\(target_os = "windows"\)/);
  const androidDependencies=cargo.split(`[target.'cfg(target_os = "android")'.dependencies]`)[1];
  assert.ok(androidDependencies);
  assert.doesNotMatch(androidDependencies,/window-vibrancy|objc2-app-kit|windows-version/);
  assert.equal(config.app.windows[0].titleBarStyle,'Overlay');
  assert.equal(config.app.windows[0].hiddenTitle,true);
  const capabilities=JSON.parse(readFileSync('src-tauri/capabilities/default.json','utf8'));
  assert.ok(capabilities.permissions.includes('core:window:allow-start-dragging'));
  assert.ok(capabilities.permissions.includes('core:window:allow-internal-toggle-maximize'));
});
