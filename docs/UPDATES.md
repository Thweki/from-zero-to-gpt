# GitHub 桌面自更新

Windows、macOS 与 Linux 桌面版启动后检查 GitHub 稳定版。发现新版本会显示提示，也可从「设置 → 应用更新」手动检查。用户点击下载后，Tauri 校验更新包签名；成功后才提供「安装并重启」。检查、下载和安装错误分别显示，不把网络失败当作已是最新版本。

更新源为 `https://github.com/Thweki/from-zero-to-gpt/releases/latest/download/latest.json`，公钥固定在 `src-tauri/tauri.conf.json`。元数据中的下载地址固定到对应版本标签，覆盖 Windows x64 NSIS、Linux x86_64 AppImage 和 macOS Intel / Apple Silicon Universal 应用。DEB 用户应通过发布页安装新 DEB；Android 和浏览器版不使用桌面更新器。

## 首次启用发布

1. 把与仓库公钥配对的私钥内容保存为 GitHub Actions Secret `TAURI_SIGNING_PRIVATE_KEY`。如使用带密码私钥，再设置 `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`。
2. 按现有发布步骤同步 npm、Tauri、Cargo 版本，增加 `docs/releases/vX.Y.Z.md`，让同一提交通过 main 上的完整 CI 和三个桌面构建。
3. 推送对应版本标签，现有 Release 工作流收集安装包、更新归档和签名，生成 `latest.json`，一起发布。缺少任何平台的签名更新包时，发布校验失败。

本次生成的配对私钥仅保存在开发机 `~/.config/from-zero-to-gpt/release/updater.key`（目录 `0700`，文件 `0600`），未写入仓库；2026-11-08 已将配对私钥配置为本仓库的加密 Actions Secret。请安全备份；丢失私钥后不能为已发布客户端签发更新，不要随意重新生成并替换公钥。发布构建使用 `TAURI_SIGNING_PRIVATE_KEY`，私钥不进入源码或发布附件。

没有签名 Secret 时，Pull Request 和普通本地构建仍可生成安装包，但不产生可发布的自动更新归档。首次升级到含更新器的应用仍需手动安装；旧版本没有更新器时无法自动发现这项功能。

## 构建与签名边界

`npm run desktop:build` 在存在 `TAURI_SIGNING_PRIVATE_KEY` 时启用 `createUpdaterArtifacts`。`scripts/release-assets.mjs` 保留原有四个安装包，还收集 macOS `.app.tar.gz` 及 macOS / Windows / Linux 的 `.sig`，将同一 Universal 归档映射到两种 Mac 架构。

更新签名用于验证包的来源与完整性，不等同于 Apple Developer ID 公证或 Windows Authenticode。该项目尚未配置这两种操作系统签名。

实现使用 [Tauri Updater](https://v2.tauri.app/plugin/updater/) 和 [Process](https://v2.tauri.app/plugin/process/) 插件。`src/app-updater.test.ts` 验证检查、下载、显式安装及失败状态；`scripts/updater.test.mjs` 验证平台映射、归档要求和固定更新源。真实 GitHub 升级验收需要发布比已安装版本更新的签名版本，并在各目标系统运行，不能用模拟测试代替。
