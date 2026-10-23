# From Zero to GPT

从一个函数，到自己实现的语言模型。为有 Linux／编程经验、希望重新建立数学直觉的自学开发者而建。中文优先、本地优先、MIT 开源，没有签到、截止日期或学习时长 KPI。

当前版本 **0.3.0**：六阶段 83 章完整首版教材、真实交互实验、浏览器 Python、可选 AI 导师，以及三个可下载并独立运行的工程。路线中的 83 个节点均有实质内容、练习与验收；后续仍会持续补充深度和真实任务案例。

## 本地启动

需要 Node **22.18+**（推荐 Node 24 LTS）和 Python **3.10+**。Python 用于项目 ZIP 打包与课程验收，网站服务进程不会执行用户 Python。

```bash
npm ci
npm run dev
```

在本工作区项目位于 `/workspace/sites/from-zero-to-gpt`。开发地址通常是 `http://localhost:5173`；远程机器请使用端口转发。安装／构建会从锁定 npm 包复制约 14 MB 的 Pyodide，运行基础练习无需外部 Python CDN。

## 可以学习和操作什么

| 阶段 | 章节 | 实际内容与作品 |
| --- | ---: | --- |
| 数学基础 | 23 | 代数、函数、幂对数、矩阵、概率、导数、梯度与优化 |
| 机器学习 | 9 | 数据划分、损失、真实梯度更新、泛化与逻辑回归；无框架回归工程 |
| 神经网络 | 11 | 神经元、计算图、反传、优化器；标准库自动微分引擎与 XOR 网络 |
| NLP / Transformer | 16 | 文本到 Token、可编辑 Embedding/QKV、注意力热图、mask、归一化与张量数据流 |
| 手写 GPT | 13 | Tokenizer、Block、交叉熵、训练、保存与采样；真实本地微型 GPT |
| 现代 LLM | 11 | SFT/DPO、缓存、量化、LoRA、资源估算、评估与论文阅读 |

每章有问题动机、直觉、数学推导、代码、深入解释、误区、实验、练习、自测提示与来源。四种阅读模式共享上下文。知识图明确先修但不强制锁课。

交互实验响应真实计算：修改矩阵会改变注意力权重；因果 mask 产生严格零；梯度与有限差分可以对照；回归训练／验证损失独立计算；缓存与完整计算可核对。缩小模型、固定概率表、经验假设和资源估算均明确标注。

Python 在独立浏览器 Worker 中执行，支持代码保存、参考实现、真实断言／错误、重置、停止、30 秒超时。Tab／Shift+Tab 切换焦点，Ctrl/⌘ + ] 插入缩进，Ctrl/⌘ + Enter 运行。浏览器没有被声称可以运行完整 PyTorch 训练。

## AI 导师

支持 OpenAI 兼容 Chat Completions。当前测试提供商为 OpenCode Go，模型 `deepseek-v4.1-flash`；接口取自 [OpenCode 官方说明](https://opencode.ai/docs/go/)，并已进行真实请求与网页验证。

导师有提示、概念解释、先修复习、主动完整解答四种模式和三档难度。默认提示优先；完整实现仅在学习者主动选择「完整解答」时提供给模型上下文。策略由系统提示和资料最小化实现，不能保证模型永远不犯错。

默认只发送本章规范教材、问题和最近对话；代码／运行错误、笔记分别由默认关闭的复选框控制。对话与提问草稿按章节保存在 IndexedDB。模型输出不会自动执行，外部 Markdown 图片被禁用以避免未经点击的第三方请求。

密钥只在服务端配置：

```bash
cp .env.example .env
# 用本地编辑器在 .env 填写 TUTOR_API_KEY；不要提交这个文件。
npm run dev
```

```dotenv
TUTOR_PROVIDER=OpenCode Go
TUTOR_BASE_URL=https://opencode.ai/inference/go/openai/v1
TUTOR_MODEL=deepseek-v4.1-flash
TUTOR_API_KEY=<仅在服务端设置>
```

可更换提供商、模型和密钥。浏览器不能指定任意上游地址，状态接口不会返回密钥；不使用 `VITE_*` 保存秘密。HTTPS 是默认协议；自建回环 HTTP 模型需显式 `TUTOR_ALLOW_LOCAL_HTTP=1`。公网自部署可设置独立 `TUTOR_ACCESS_TOKEN` 并在导师的上下文选项中填写访问码；访问码只保留在页面内存。

没有模型配置、提供商断线或限流时，全部课程、实验和代码功能仍可使用。接口对请求／响应大小和时间设限，支持取消，过滤原始上游错误；内存速率限制是单进程／isolate 的尽力限制，公开服务应使用可信网关的认证与持久化配额。

若开发环境要求通过 `HTTP_PROXY`／`HTTPS_PROXY` 联网，推荐在 Node 24 中使用 `NODE_USE_ENV_PROXY=1 NODE_USE_SYSTEM_CA=1 npm run dev`，保留环境提供的代理和 CA 信任，不要关闭 TLS 检查。

## 学习保存与恢复

进度、主题、笔记、代码、数值参数、复习标记、最近运行结果、导师对话及草稿自动保存在当前浏览器的 IndexedDB。保留原版本 1 的兼容导入；已有首五章记录可以继续使用。

顶部暂停按钮／「保存思路，立即结束」保存当前问题、下一步、代码快照与运行结果。首页给出恢复摘要，不要求为了记住上下文而持续工作。

设置页可以导出和导入全部学习 JSON；导入会替换当前记录，操作前请先导出备份，最大文件 64 MB。切换浏览器、域名或设备不会自动同步；清除站点数据可能删除记录。保存失败会提示，当前内存记录仍可导出。

## 三个真正独立的工程

课程页提供 ZIP 下载，源码保留在仓库中：

- [projects/regression](projects/regression/README.md)：纯标准库训练、评估、保存／加载回归模型。
- [projects/micrograd](projects/micrograd/README.md)：标量自动微分、共享节点梯度、数值梯度检查与带种子 XOR MLP。
- [projects/tiny-gpt](projects/tiny-gpt/README.md)：显式因果多头注意力、LayerNorm、MLP、训练／验证、检查点续训与自回归采样；使用本地 CPU PyTorch，无 `nn.Transformer`、预训练权重或远程模型 API。

微型 GPT 默认 62,592 参数、两层三头、上下文 48，使用原创 CC0 英文模板语料。它已经真实训练，但输出仍会有错误与重复，不能作为聊天助手。KV Cache、LoRA 适配训练／合并、逐通道 int8 存储已经整合进同一个模型；第六阶段相关课页提供命令和完整源码下载，详见 [整合实验](projects/tiny-gpt/EFFICIENCY.md)。量化前向仍用浮点计算，模型滑窗后重建缓存，不宣称整数内核加速或无限记忆。默认 250 步实测与失败生成例子见 [VALIDATION](projects/tiny-gpt/VALIDATION.md)。验证集与训练集来自相近模板，不能据此声称通用语言能力。网页概率表演示与这个 Transformer 是不同模型。

## 验证

```bash
npm run check
npm test
npm run validate:course
npm run build
npx playwright install chromium
npm run test:e2e
```

有系统 Chromium 时：

```bash
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e
```

另在各项目目录运行 Python 单元测试；tiny GPT 按其 README 安装 CPU PyTorch。GitHub Actions 提供网站验证与独立 tiny-GPT CPU 测试。测试明确区分模拟提供商的协议测试、真实外部调用与本地训练，详见 [TEST_REPORT](docs/TEST_REPORT.md)。

## 生产部署

完整应用含导师代理：

```bash
npm ci
npm run build
npm start
```

默认监听 `127.0.0.1:8787`，可用 `HOST`、`PORT` 配置。对外部署使用 HTTPS 反向代理，并设置 `TUTOR_PUBLIC_ORIGIN=https://你的域名`，保持浏览器与代理同源。服务端只负责静态资源和模型请求，不运行用户代码。

Cloudflare Workers 可用根目录 `wrangler.json`：入口 `dist-server/worker.js`，静态资源绑定 `ASSETS` 指向 `dist/`，`/api/*` 优先交给 Worker。在平台密钥存储中设置 API 密钥，在普通环境变量中设置模型及地址。当前 Sites 身份保留在 `.openai/hosting.json`；自行创建 Sites 时应使用自己的项目身份。

Sites 部署运行 `npm run package:site`，生成忽略跟踪的 `.openai/site-deploy.tar.gz`（需要系统 `tar`）。打包脚本把 Worker 放入平台支持的 `dist/server/index.js`，静态资源放入 `dist/client/`，并附带项目身份文件；不包含任何运行时密钥。先推送对应源码提交，再以该提交与此归档保存／发布版本，保持现有访问权限。

仅核心课程的静态部署：上传整个 `dist/`，包括 Python、字体和下载 ZIP。hash 路由通常不需要服务器回退；资源以域名根 `/` 为基础，部署到子路径需要同时调整 Vite、Worker 和 Python 路径。纯静态站点和 `vite preview` 不含导师 API。不要通过 `file://` 打开，服务端需正确提供 `.wasm` 的 `application/wasm` 类型。

## 接手与扩展

先阅读 [PROGRESS](docs/PROGRESS.md)、[ARCHITECTURE](docs/ARCHITECTURE.md) 与 [DEVELOPMENT_PLAN](docs/DEVELOPMENT_PLAN.md)。课程和先修见 [CURRICULUM](docs/CURRICULUM.md)／[KNOWLEDGE_GRAPH](docs/KNOWLEDGE_GRAPH.md)。

`src/data/stage*.ts` 保存教材，`LessonLab.tsx` 懒加载实验，`storage.ts` 验证数据，`server/tutor.ts` 处理导师策略与上游连接。新增内容须同时更新稳定 ID、依赖、课程、实验、验收和导入边界。

当前尚无完整 i18n、Monaco、可拖拽缩放的全图编辑器、跨设备同步／多窗口冲突解决或 PWA。生产级多租户身份、全局配额、GPU／分布式训练、大规模模型质量均不在当前交付范围。浏览器 Worker 是响应性边界，不是运行恶意第三方代码的安全容器。

依赖与运行时许可见 [THIRD_PARTY_NOTICES](THIRD_PARTY_NOTICES.md)。教材为原创中文讲解，逐章引用官方文档与论文，不复制受版权保护的整章教材。
