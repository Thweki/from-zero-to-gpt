# From Zero to GPT

从一个函数，到亲手实现语言模型。面向有系统工程经验、想重新建立数学直觉的自学开发者。

这是可运行的里程碑 A MVP，包含五章完整中文教材、真实 SVG 数学实验、浏览器 Python 运行、学习数据保存与断点恢复。其余 78 个知识点是有依赖关系的课程规划，未伪装成已交付教材。项目使用 MIT 许可证；没有账号、签到、学习期限或付费 API 要求。

## 启动

需要 Node.js **22.18 或以上**，推荐 Node 24 LTS；课程验证另需 Python 3。

```bash
cd /workspace/sites/from-zero-to-gpt
npm ci
npm run dev
```

打开终端打印的地址，通常为 `http://localhost:5173`。远程开发机需要通过其端口转发访问。安装脚本会从锁定的 Pyodide npm 包复制约 14 MB 的运行时；不需要 Python CDN，页面运行也不需要联网调用模型。

## 当前可以做什么

- 在六阶段路线图上打开首五章，搜索全部 83 个知识点，查看先修关系。
- 学习「函数是什么」「线性函数与参数」「用 Python 表示函数」「向量的基本概念」「向量点积」。每章含概念解释、推导、代码、误区、练习、自测、来源和下一步。
- 切换直觉、数学、代码、深入研究模式，共享同一份进度、笔记和实验参数。
- 操作函数输入、斜率与截距、向量分量和点积；查看实时图像与数值。两轴使用相同单位比例；全屏按钮需浏览器支持 Fullscreen API。
- 编辑并运行 Python，在专用 Worker 中实际执行本章断言。支持参考代码、错误输出、重置、手动停止和 30 秒超时。编辑器是可访问的原生文本域，尚未引入 Monaco。
- 自动保存进度、代码、最近结果、参数和笔记；标记复习、切换浅色／深色。
- 点击顶部暂停按钮或「保存思路，立即结束」，留下当前问题与下一步。首页显示恢复摘要及代码快照。
- 在设置中导出、校验并导入全部学习 JSON，无需登录。**导入会替换本地数据，请先导出备份。**

## 验证

```bash
npm run check
npm test
npm run validate:course
npm run build
npx playwright install chromium
npm run test:e2e
```

已有系统 Chromium 时可省去下载：

```bash
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e
```

Vitest 覆盖课程结构、公式、数学计算、DAG 和 IndexedDB；CPython 验证五份参考实现；Playwright 实际运行浏览器 Python 并检查桌面／移动交互。结果与限制见 [测试报告](docs/TEST_REPORT.md)。GitHub Actions 中提供可复现的验证流程。

## 构建与自行部署

```bash
npm ci
npm run build
npm run preview
```

将 **整个 `dist/`** 部署到支持 HTTPS 的静态站点托管服务；含 `python/`、Worker 和 KaTeX 字体。本站使用 hash 路由，通常不需要服务端路由回退。当前资源路径以域名根目录 `/` 为基础；部署到子路径需要同时调整 Vite base 和 Worker／Python 路径。开发工具不要直接作为公网生产服务器。

也可以用自己的本地 HTTP 服务查看构建产物：

```bash
python3 -m http.server 8080 --directory dist
```

请勿通过 `file://` 打开 `index.html`；浏览器 Worker、WASM 与 IndexedDB 需要正常的站点来源。静态服务器应正确返回 `.wasm`（`application/wasm`）与 `.js` 类型，不要把缺失运行时请求回退成 HTML。

`.openai/hosting.json` 记录此交付的 Sites 身份。将代码部署到自己的 Sites 项目时，使用自己的项目身份；普通静态托管不需要该文件。

## 数据与运行边界

学习记录只存在当前浏览器的 IndexedDB；切换域名、浏览器或设备不会自动同步。清除站点数据可能删除记录，导出是独立备份。遇到存储错误时页面会提示，可导出当前内存中的记录。

网站服务端不执行用户 Python，也不保管 API 密钥。Worker 用于隔离计算、避免阻塞界面，并不是面向恶意代码的安全容器；Python 可以访问浏览器允许的同源能力。只运行自己理解或信任的代码。当前实现每次运行创建新 Worker 并在结束时释放。

PyTorch、GPU 训练、自动微分及 Transformer 实验属于后续课程，将提供明确的独立本地环境。当前**没有 AI 导师连接、远程执行服务、完整六阶段教材或微型 GPT 成品**。界面中的 AI 导师说明清楚标注为里程碑 B，核心学习不受影响。

## 项目结构与接手入口

```text
src/
  App.tsx                    路线、教材、笔记、设置与恢复流程
  components/                公式、实时数学实验、Python 实验
  data/lessons.ts             已交付教材、练习、参考代码、验收断言
  data/knowledge-graph.json   83 个知识点及其先修关系
  math.ts                    可测试的纯计算
  storage.ts                 IndexedDB 与导入边界校验
  types.ts                   课程和学习状态契约
public/python.worker.js      Python 专用 Worker
scripts/                     运行时复制与课程验证
tests/                       真实浏览器验收
docs/                        产品、架构、课程、进度、交接与验收
```

后续开发从 [PROGRESS](docs/PROGRESS.md) 与 [DEVELOPMENT_PLAN](docs/DEVELOPMENT_PLAN.md) 开始，再阅读 [ARCHITECTURE](docs/ARCHITECTURE.md)。新增课程应先定义依赖与验收，再完成教材和真实实验，最后将 `available` 改为 `true`。不要通过批量添加空页面提高完成数量。

参考资料逐章标注，包含 Python 官方教程、OpenStax、Mathematics for Machine Learning 与 Dive into Deep Learning 等。本项目提供原创中文教学说明，不复制受版权保护的整章教材。依赖遵循各自许可证；构建中包含的 Pyodide／CPython 和 KaTeX 版权信息见 [THIRD_PARTY_NOTICES](THIRD_PARTY_NOTICES.md)。
