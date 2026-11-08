# GitHub CI、交付与现有 Sites 的边界

更新：2026-11-04。项目源码仓库为 [Thweki/from-zero-to-gpt](https://github.com/Thweki/from-zero-to-gpt)，默认分支为 `main`，当前本地 `origin` 指向此 GitHub 仓库。应用、原创教材和独立工程从本次版本起采用 GPL-2.0-only；完整历史保留，第三方声明见 [THIRD_PARTY_NOTICES](../THIRD_PARTY_NOTICES.md)。仓库公开状态以 GitHub 页面为准。

`.openai/hosting.json` 记录的是既有站点的绑定，不是可供其他贡献者复用的部署身份。开源源码与站点生产部署是独立操作；自行部署应使用自己的站点及凭证，不应把运行时密钥写入仓库或 Actions 日志。

## 已实现的工作流

`.github/workflows/ci.yml` 是完整工作流，使用 Node 24、Python 3.12、Ubuntu 24.04。Actions 依赖固定到已通过官方仓库解析的完整40位提交；所有job默认只有 `contents: read`，checkout不保留Git凭证，不引用外部模型密钥。

触发：推送 `main`、任何PR、在Actions界面的手动 `workflow_dispatch`。同一分支新提交取消旧运行。

| Job | 实际执行 |
| --- | --- |
| repository-safety | 检查追踪文件、最大5MiB文件限制和完整可达Git历史的常见凭证格式；排除环境文件、依赖、缓存、权重、个人学习备份等 |
| web | `npm ci`、严格类型、Vitest、交付校验测试、全部83章CPython参考/TODO验收、真实生产构建、Sites格式打包 |
| browser | 安装Chromium及系统依赖，分成两个分片执行全部 Playwright 用例（当前 299 项）；包括83章页面、83个独立浏览器Python参考验收、导师模拟、学习恢复、深色外观、全屏、窄屏和触控模拟；job预算30分钟，各章结果断言30秒 |
| python | 分别运行标准库regression、micrograd及独立tiny-gpt全部unittest；只有tiny-gpt安装CPU PyTorch |
| launcher | Ubuntu24.04、Windows2025、macOS15实际调用平台入口，从无依赖源码安装／启动，核对HTTP资源、重复保护、停止与再次启动 |
| delivery | 仅main上的非PR事件、上述所有job（含三个启动平台）成功后，下载同一次运行的候选产物，复核源码提交、SHA-256、Site身份与必需运行时，再上传 `verified-site-<commit>` |

失败会阻止最终交付。PR可以生成候选包以检查构建，但不会生成main的verified产物，更不会部署生产。导师浏览器测试使用模拟HTTP；CI无需付费模型API，也不访问学习者的真实数据。

工作流配置和本地命令验证不等于真实GitHub Actions验收。首次接入推送会触发main上的真实运行，必须检查各job、产物及日志；实际推送SHA、Actions运行URL和结果以工作区GitHub交接回执为准，不能因只读权限信息就声称运行通过。

本轮本地已通过严格类型、509项Vitest、7项交付校验测试、83章CPython验收、完整127项浏览器测试（0失败／跳过／flaky，约8.2分钟）、三个Python工程6/10/23项测试及生产构建。完整浏览器输出为 `artifacts/playwright-results.json`，详细说明见 [TEST_REPORT](TEST_REPORT.md)。归档与最终源码提交以工作区GitHub准备回执为准；这些本地结果不冒充真实Actions。

0.3.4增加5项字体交付／排版／回退验收，最新共214项。上述127项为拆分前的历史批次。0.3.3将同一测试中的83份浏览器Python程序拆为83个独立用例，最新总数为209；断言及运行位置保留，分别记录章节超时和trace。此前超时批次和新批次真实结果以TEST_REPORT及Actions为准。

## 构建产物与本地复现

### 推送前的本地 CI

推送前运行 `npm run ci:local`。要求与 Actions 一致的 Node 24、Python 3.12，另需 Rust、当前系统的 Tauri 构建依赖、`actionlint` 和 `shellcheck`；macOS 还需安装 `x86_64-apple-darwin` Rust target，以构建 Universal 应用。可通过 `FROM_ZERO_PYTHON` 指定 Python 解释器。

macOS Homebrew 环境示例：

```bash
PATH="/opt/homebrew/opt/node@24/bin:/opt/homebrew/opt/rustup/bin:$PATH" \
FROM_ZERO_PYTHON=/opt/homebrew/bin/python3.12 npm run ci:local
```

预检将已追踪的改动和未忽略的新文件复制到临时 Git 快照，包含删除，不复制 `.env`、个人凭据或原有依赖。不会提交原工作区或推送临时提交。随后执行干净 `npm ci`、历史安全检查、工作流/脚本检查、类型与单元测试、全部课程验收、生产与交付打包、三个 Python 工程、干净安装/热启动、两个完整浏览器分片、Rust 测试、当前系统桌面打包与独立模型运行时检查。浏览器使用独立端口，不复用正在开发的页面。

日志与结果保存在 `artifacts/local-ci/`。失败即停止并保留快照以便排查；成功记录源码 Git tree。通过 `git config core.hooksPath .githooks` 启用本仓库的 `pre-push` 检查后，只有待推送提交的源码树与通过预检的版本一致才允许推送；修改源码后需重新预检。检查不会自动提交、推送、发布或关闭 GitHub CI。

本地桌面和启动测试只代表当前主机系统：macOS 无法替代 Windows NSIS 或 Linux AppImage/DEB 的原生构建与安装。Android 是另行选择的工作流，不在这项桌面预检中。报告保留这些边界，不能把本地通过表述成三平台 Actions 已通过。

```bash
npm ci
npm run check:repository -- --history
npm run check
npm test
npm run test:delivery
npm run validate:course
npm run build
# 源码须已提交，不能把未提交改动冒充一个Git提交的产物
npm run package:delivery
```

`artifacts/ci-release/` 只包含明确列出的三个文件：

- `site-worker.tar.gz`：现有Sites支持的 `.openai/hosting.json`、`dist/server/index.js` 和 `dist/client/`，含字体、Pyodide及项目ZIP。
- `release-manifest.json`：源码SHA、应用版本、现有Site ID、归档SHA-256／字节数与可选Actions运行ID；明确 `automatic: false`。
- `SHA256SUMS`：归档校验值。

交付脚本要求工作区干净，CI中的checkout与GITHUB_SHA一致。校验拒绝被修改的归档、错误提交、路径逃逸、错误Site身份和缺失运行文件。直接运行 `node scripts/verify-delivery.mjs <产物目录>` 可重新核对。产物是构建输出，不包含环境变量、Git配置、API密钥、node_modules、虚拟环境、训练权重或学习备份。

Actions上传的候选产物保留7天，verified产物14天；浏览器结果保留7天。它们沿用仓库的访问控制，仓库公开后工作流、日志和产物也可能公开；不要在其中保存私人数据或凭证。`ci.yml` 不创建 GitHub Release、GitHub Pages 或新站点；桌面发布由下述独立工作流负责。

## CD实际范围

网站部分是**通过CI门槛后的自动产物交付**；桌面安装包通过下述 Release 流程自动公开发布。既有Sites流程要求使用站点自己的源仓库与身份，保存匹配源码及归档的版本，再部署返回的版本ID。当前本地 `origin` 是GitHub仓库，不能把它视为Sites源仓库。这里没有配置可供GitHub Actions使用的Sites持续部署身份，不能把短时源仓库凭证当作持久CD凭证。

贡献时从当前 `main` 建分支并提交PR；维护者推送前应核对目标remote、远程分支及待推送提交，使用普通push，不强推覆盖他人内容。推送GitHub不会自动修改Sites源仓库或现有生产部署。分发构建产物时保留GPL与第三方声明，并提供与清单提交一致的相应源码和构建文件。

如需真正自动上线，需平台提供受支持的GitHub持续部署集成或可授权给Actions的正式部署身份，并确认既有项目绑定及权限范围；目前没有这些能力。不能在本项目中通过保存用户聊天密钥、抓取连接令牌或另建托管来补足。

## 仓库接入与权限边界

发布前核对owner、visibility、Git分支及源码写入权限，扫描待公开文件、完整可达历史以及将公开的工作流日志和产物。使用普通push，不force，不覆盖别人的内容；远程实际写入或Actions访问若被拒绝，则停止相应操作并记录准确错误，不换接口绕过。

推送到main后触发工作流，等待真实Actions完成并检查各job、浏览器结果及verified artifact；本地测试不等同于Actions通过。首次接入时曾发生建仓权限拒绝，其历史记录见 [TEST_REPORT](TEST_REPORT.md)，不代表当前仓库不存在或当前所有操作权限均可用。

## 检查边界

`check-repository.mjs` 是仓库文件策略及常见提供商凭证格式检查，不是对所有秘密或个人信息的完备识别。不得靠忽略整个tests目录或把匹配行打印到日志来处理发现；需要逐项核对，真实泄漏必须先处理再推送。本轮仅记录命中规则／路径和扫描统计，不输出凭证。

浏览器手机参数和触控仍是Chromium模拟，不能声称完成iOS／Android实机或软键盘验收。完整CI的真实GitHub托管环境结果以实际运行及回执为准，本地测试不代替该结果。

## 桌面 Release

`tauri.yml` 对 main / PR 构建 Linux x86_64（AppImage、DEB）、macOS Universal（Apple Silicon + Intel DMG）、Windows x64（NSIS）。每个平台先运行 Rust 测试，构建使用 Cargo 锁文件，产物保留 14 天。Android 仅在手动运行时选择 `build_android`；不阻塞桌面发行。

`release.yml` 的 `v*` 标签触发发布，手动重试也必须选择版本标签。流程先检查 `package.json`、npm 锁文件、Tauri 配置、Cargo 清单及锁文件的版本，再通过 GitHub API 核验该标签源码 SHA 在 main 的 push 事件上已有成功的 `ci.yml` 与 `tauri.yml` 运行。拒绝其他提交、PR、其他工作流或未成功的运行。发布 job 只下载已验证桌面运行 ID 的四个安装包，严格检查文件集合及格式，生成 `SHA256SUMS` 和源码清单，附上许可证及第三方说明，先上传草稿再公开。只有发布 job 申请 `contents: write`，使用当前运行的 `GITHUB_TOKEN`，无需个人发布令牌。已公开版本拒绝覆盖，失败的草稿可重试。

发布步骤：

1. 同步上述五处版本，更新 README 和 `docs/releases/vX.Y.Z.md`。
2. 运行 `npm run check`、`npm test`、`npm run test:tauri`、`npm run test:release`、`npm run validate:course` 和 `npm run build`，检查工作流语法。
3. 提交并推送源码，等待 main 的完整 CI 和三平台构建全部成功，再创建同版本标签：`git tag -a vX.Y.Z -m "Release vX.Y.Z"`，`git push origin vX.Y.Z`。
4. 标签必须指向已通过验收的同一提交；失败或产物过期时需先重跑对应 main 工作流。等待 [Desktop release](https://github.com/Thweki/from-zero-to-gpt/actions/workflows/release.yml) 完成，核对 Release 的四个安装包、源码 SHA 与 SHA-256。

安装包不包含正式 Apple / Windows 发布签名。CI 证明构建、测试和文件校验成功，不代表三平台全部用户界面、系统版本及安装环境均已实机验收。桌面 Release 不修改网站生产部署。
