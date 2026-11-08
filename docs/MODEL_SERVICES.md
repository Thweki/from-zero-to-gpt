# 模型服务与订阅登录

桌面版与本地 Node 版在「设置 → 模型服务 → 新增服务」中，按 **选择服务商 → 粘贴 Key 或登录 → 选择模型** 接入。普通流程不要求填写 `base_url`、请求协议或认证请求头。模型目录可以刷新；目录中出现某模型不代表当前账号具有额度或权限，最终以请求结果为准。

## 实现依据与覆盖范围

调研了 [pi 的模型与认证实现](https://github.com/earendil-works/pi/tree/v1.5.0/packages/ai) 和 [OpenCode 的服务商连接方式](https://github.com/anomalyco/opencode/blob/dev/services/site/src/docs/content/providers.mdx)。采用 pi 的实际运行时 `@earendil-works/pi-ai@1.5.0`，复用服务目录、认证、Token 刷新与各服务协议；界面借鉴 OpenCode 的先连接服务、再选择模型流程。没有将所有服务强行转换成 OpenAI Chat Completions。

当前目录包含 41 个可对话的服务入口。纯分类服务 TypeSafe 不显示。

| 方式 | 服务入口 |
| --- | --- |
| Key 与 OAuth | OpenAI / ChatGPT、Anthropic / Claude、GitHub Copilot、OpenRouter、Kimi Coding、Meta、xAI、Radius |
| OAuth | 旧版 ChatGPT / Codex 登录 |
| Key / 服务专用配置 | Google Gemini、Google Vertex、Amazon Bedrock、Azure、DeepSeek、OpenCode Go、OpenCode Zen、阿里 Qwen Token Plan 三个区域/个人版入口、Moonshot 两个区域入口、MiniMax 两个区域入口、Z.ai / 智谱 Coding、Xiaomi 与三个 Token Plan 区域入口、Cloudflare AI Gateway / Workers AI、Ant Ling、Baseten、Cerebras、Fireworks、Groq、Hugging Face、Mistral、NVIDIA、Together、Vercel AI Gateway |

Google Gemini 在所固定的运行时中只有 Key 接入，没有 Gemini 个人订阅 OAuth，因此界面不会显示一个无法工作的订阅登录按钮。Azure、Bedrock 等云服务可能还需要区域、资源或项目标识，按服务提示填写。OAuth 登录不意味着任意商业订阅都可调用第三方客户端；是否授予访问取决于服务商和账号。OpenAI 采用上游提供的 [Sign in with ChatGPT](https://developers.openai.com/siwc/token-sharing-open-source) 流程。

「高级：本地模型或自定义接口」保留 OpenAI 兼容 API、Ollama 等入口，只有这里需要手动填写地址和模型 ID。已有自定义服务继续可用。旧版尚未完成的 Copilot 配置需通过新增服务重新登录。

## 凭据与运行边界

- 桌面包附带独立 `provider-engine` 进程，用户无需安装 Node 或 Bun。Rust 宿主通过私有 stdin/stdout 协议调用它；API Key、Access Token 和 Refresh Token 保存到系统凭据库，不通过前端状态或学习备份返回。
- Node 版将凭据保存在本机数据目录下独立的 `credentials.json`，文件权限设为 `0600`；不属于学习导出。应在信任的个人本机使用账号管理。
- 登录可以取消，十分钟过期会清理。模型查询与推理串行处理凭据刷新，防止并发使用已轮换的 Refresh Token；推理失败或取消也保存已轮换的凭据。
- 不自动读取 pi、OpenCode 或其他程序的凭据。环境变量导师配置仍走原有兼容 API 入口。
- Android 包尚未包含这个桌面运行时，仍使用自定义兼容 API。静态网站与 Cloudflare Worker 不支持管理私人订阅账号；使用桌面版或本地 Node 版。

## 开发与验证

`npm ci` 安装固定版本依赖。`npm run build:provider-engine` 编译当前平台独立进程；桌面构建会自动调用，Windows x64 使用 baseline 目标，macOS Universal 同时合并两种架构。

`src/provider-engine.test.ts` 验证真实 pi Key 提示、凭据持久化与隔离，并用模拟网络响应验证真实 SDK 的接口选择、认证头、流式回答解析、即时取消和失败后的 Token 轮换保存。`tests/provider-settings.spec.ts` 验证连接、取消、模型选择和窄屏布局。三平台 CI 还运行 `scripts/provider-engine-smoke.mjs`，直接检查编译后的进程、服务目录和 Key 提示。测试不会使用个人 Key 或真实订阅，也不代表各服务商的真实账号登录已验收。
