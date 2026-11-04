# Tauri 桌面与 Android 应用

项目使用 Tauri 2 包装现有 React / Vite 前端。浏览器、Node 导师代理和 Cloudflare Worker 入口保持不变。生产应用直接加载 `dist/` 中的课程、字体、KaTeX、实验、工程 ZIP 与 Pyodide，不需要启动本地 HTTP 服务。

官方依据：[手动接入现有前端](https://v2.tauri.app/start/create-project/)、[平台先决条件](https://v2.tauri.app/start/prerequisites/)、[CSP 与 WebAssembly](https://v2.tauri.app/security/csp/)、[GitHub 构建](https://v2.tauri.app/distribute/pipelines/github/)、[Android 打包](https://v2.tauri.app/distribute/google-play/)。

## 本地运行与构建

先完成浏览器项目的 `npm ci`。桌面还需要 stable Rust；安装后重开终端，或按 rustup 提供的方式把 `$HOME/.cargo/bin` 加入 `PATH`。macOS 桌面可使用 Xcode Command Line Tools，Windows 需要 Microsoft C++ Build Tools 与 WebView2，Linux 需要 WebKitGTK 4.1 等官方依赖。

```bash
npm run desktop:dev       # 开发窗口；仅此处使用 Vite 开发地址
npm run desktop:build     # 当前桌面平台的默认产物
npm run test:tauri        # 配置、版本与 CI 边界检查
```

macOS 本次验证命令：

```bash
npm run desktop:build -- --bundles app,dmg
```

产物位于 `src-tauri/target/release/bundle/macos/` 和 `dmg/`。`src-tauri/target/` 与 `gen/` 是本地生成目录，不提交。

Android 先按官方文档安装 Java、Android Studio / SDK、Platform-Tools、Build-Tools 与 NDK，并设置 `ANDROID_HOME`、`ANDROID_HOME/ndk/<版本>` 对应的 `NDK_HOME`。然后：

```bash
rustup target add aarch64-linux-android armv7-linux-androideabi i686-linux-android x86_64-linux-android
npm run android:init
npm run android:build
```

APK 位于 `src-tauri/gen/android/app/build/outputs/apk/` 下。最低 Android API 24。`android:init` 生成平台工程；无需把构建输出提交到仓库。

## 本地数据与离线边界

- 进度、笔记、代码、实验参数和导师对话继续使用 IndexedDB。数据由当前操作系统的 WebView 持久化，不需要 Tauri Rust 文件 API。
- 浏览器、独立应用、不同应用标识或不同浏览器地址是不同的数据空间，不自动同步或迁移。切换前使用现有「导出全部学习数据」；在另一处通过导入恢复。卸载应用或清除 WebView 数据可能删除记录。
- `public/python.worker.js` 与完整 `public/python/` 被复制到 `dist/`。CSP 明确包含 `wasm-unsafe-eval` 和 Worker 来源，Pyodide 在应用内运行，不访问 Python CDN。
- 课程、公式、字体、实验和工程下载均来自应用内资源。模型训练仍区分浏览器缩小实验与需要本地 Python/PyTorch 的独立工程。

## 原生窗口材质与 CSS fallback

导航材质使用 Tauri 官方 [`window-vibrancy`](https://github.com/tauri-apps/window-vibrancy)，不是用网页渐变冒充原生效果。原生材质位于整个窗口的 WebView 后方，但不透明正文会遮住它，因此只在侧栏、顶部和按需工具区域显现。

| 平台 | 实际策略 |
| --- | --- |
| macOS 10.10+ | `apply_vibrancy` 创建真正的 `NSVisualEffectView`，使用 Sidebar 材质；`None` 外观跟随系统深浅色 |
| Windows 11 | 优先 Mica，失败时尝试 Acrylic |
| 旧 Windows | 使用 Acrylic；不声称支持 Mica |
| Linux | 官方 crate 明确不支持，效果由系统 compositor 决定；保留 CSS fallback |
| Android / 浏览器 | 不调用桌面窗口接口，使用 CSS fallback |

Tauri 的 `native_material_status` 命令返回真实启用结果。只有成功时才移除 CSS 环境背景并降低网页遮罩；调用失败或平台不支持时继续使用现有 CSS。窗口缩放仍由系统材质和 WebView 自动处理；Windows Acrylic 的官方 crate 已注明部分版本在拖动／缩放时有性能限制，本项目不声称消除了这些系统限制。

`prefers-reduced-transparency` 下，网页导航、根背景和工具面板恢复不透明，因此不会透过它们显示原生材质。正文始终不透明。macOS 透明 WebView 需要 `transparent: true`、`macOSPrivateApi: true` 和对应 Tauri feature；这属于构建能力说明，不代表 Apple 签名、公证或 App Store 审核。

macOS 另使用 `titleBarStyle: Overlay` 与 `hiddenTitle: true`，让原生交通灯和 56px 应用工具栏位于同一行，不再保留独立系统标题行。顶栏左侧预留交通灯空间，`data-tauri-drag-region` 与明确的窗口拖动／最大化权限保留窗口操作；`NSWindowCollectionBehaviorFullScreenPrimary` 显式保留原生全屏。窄窗口使用 88px 最小留白并隐藏重复首页链接，避免与搜索和控件重叠。Windows、Linux 和 Android 不启用该 macOS 标题栏样式。

## 可选 AI 导师

未配置模型服务时，课程和练习可离线使用。桌面应用的「模型服务」面板支持保存多个 OpenAI 兼容接口并切换当前服务；非秘密配置保存在应用配置目录，API key 使用系统凭据存储，原生 Rust 客户端负责模型请求。Linux 使用 Secret Service，需要桌面环境提供并解锁凭据服务。GitHub Copilot 选项尚未提供完整登录流程，不应视为已完成订阅认证支持。

浏览器使用同源 `/api/tutor/*` 与 Node 服务端配置。若自行构建并设置 `VITE_TUTOR_API_ORIGIN=https://tutor.example.com`，应用可改用外部 HTTPS 导师代理；该地址不能含秘密。代理需设置 `TUTOR_ALLOW_TAURI_ORIGIN=1`，公网部署同时配置 `TUTOR_ACCESS_TOKEN`。详见 [架构说明](ARCHITECTURE.md)。

## GitHub Actions 与签名边界

[tauri.yml](../.github/workflows/tauri.yml) 在 main、Pull Request 和手动触发时构建桌面应用，也供发布工作流复用。Android APK 是手动 `build_android` 选项，不属于桌面 Release。

| 平台 | 产物 |
| --- | --- |
| macOS（Apple Silicon + Intel） | Universal DMG，使用 `--target universal-apple-darwin` |
| Windows x64 | NSIS `.exe` |
| Linux x86_64（Ubuntu 24.04 构建） | AppImage 与 DEB |

[release.yml](../.github/workflows/release.yml) 在推送 `vX.Y.Z` 标签时校验 npm、Tauri、Cargo 与标签版本一致，复用完整 CI 和桌面构建。只有全部成功，才汇集同次运行的四个安装包，检查文件格式，生成 SHA-256 与源码清单，上传到草稿再公开 Release。构建只有 `contents: read`，仅最终发布 job 有 `contents: write`。已公开的版本不能被工作流覆盖。操作步骤见 [CI / CD](GITHUB_CICD.md)。

产物未配置 Apple Developer ID 签名、公证或 Windows 代码签名，不能据此声称已通过应用商店审核。Linux 最低兼容环境以 Ubuntu 24.04 和系统 WebKitGTK 依赖为基线；AppImage 仍需满足宿主运行库与 FUSE 条件。

本机已实际完成 macOS ARM64 的 `.app` 与 DMG 构建并打开原生应用。窗口截图确认了真实 Sidebar 原生材质、透明导航与不透明正文；通过系统事件将窗口从 1280×900 调整为 1100×760，并以 Cmd+K 搜索和键盘确认实际进入「函数是什么」。截图保存在忽略的 `artifacts/tauri/native-material*.png`。原生暗色切换未形成可靠独立验收，不把共享前端暗色测试冒充原生暗色实测。

另以生产包的 `tauri.localhost` 源实际验证本地资源、默认零导师请求、IndexedDB 刷新恢复、真实 Pyodide 验收和 390px 布局；这验证了共享前端与运行时分支，但不替代所有 WKWebView 场景。上述为历史本机验收；当前 Windows、Linux、macOS 云端构建结果以对应版本的 [Release 工作流](https://github.com/Thweki/from-zero-to-gpt/actions/workflows/release.yml) 为准。Android 真实设备、不同 WebView 版本和签名安装仍需相应环境验收。
