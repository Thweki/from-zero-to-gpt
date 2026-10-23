# Windows、Linux、macOS 一键启动

## 使用

先安装Node.js 22.18+（推荐24 LTS，包含npm）与Python3.10+（推荐3.12），再解压或clone仓库。启动脚本可从任意工作目录调用，支持项目路径含空格。

| 系统 | 入口 |
| --- | --- |
| Windows | 双击 `start-windows.bat`；也可在cmd运行 `start-windows.bat --no-open --port 5180` |
| Linux | `./start-linux.sh` 或 `sh start-linux.sh` |
| macOS | 双击 `start-macos.command` 或 `sh start-macos.command` |
| 通用 | `npm run launch` 或 `node scripts/launch.mjs` |

默认打开 `http://localhost:5173`，服务只监听本机IPv4回环地址。首次依赖安装需要网络，不下载或运行远程安装脚本，不需要管理员权限。启动器只在本项目内安装依赖和生成运行文件；Node／Python本身需先装好。没有AI配置也能学习全部核心内容。

流程为：检查Node／npm／Python → 获取单实例启动锁 → 检查端口 → 必要时 `npm ci` → 准备Pyodide与项目ZIP → 启动Vite及现有导师开发代理 → HTTP确认就绪 → 打开系统默认浏览器。依赖指纹包含package.json、锁文件、操作系统、架构和Node ABI，依赖未变时跳过安装；资源被删除时会重新生成。

`.env`、模型密钥、学习数据不被启动器创建、覆盖或上传。开发者原来的 `npm run dev`、生产 `npm start` 与Sites发布方式继续保留；本脚本启动本地学习／开发服务，不是系统后台服务或生产部署工具。

## 可选参数

```bash
node scripts/launch.mjs --check
node scripts/launch.mjs --no-open
node scripts/launch.mjs --port 5180
node scripts/launch.mjs --help
```

`--check`仅检查依赖，不安装或启动；`--no-open`适合无桌面／CI；端口需在1024–65535之间。也可设置 `FROM_ZERO_PORT`。默认端口占用时会报错，避免静默更换地址让学习记录看似丢失。

学习记录保存在对应浏览器的IndexedDB，localhost与127.0.0.1、不同端口属于不同站点。已有用户继续使用原地址；更换前可在设置导出备份。启动器不会迁移或删除这些记录。

## 依赖和常见问题

- Windows优先探测 `py -3`，再试 `python`、`python3`；跳过无法执行或版本过旧的命令。Windows应用商店别名不等于已安装Python。
- Linux／macOS先试python3再试python。macOS仅在找不到node时补查Apple Silicon及Intel的常见Homebrew路径，保留已有nvm／Node选择。
- 可用 `FROM_ZERO_PYTHON` 指定Python解释器完整路径，路径可含空格，变量只放可执行文件路径，不放额外命令或参数。
- 缺少Node或npm：安装包含npm的Node24 LTS，重新打开终端。缺少Python：安装Python3.10+，使其在PATH中可用，或设置上述变量。脚本给出错误原因，不自动安装系统软件。
- 安装失败：保留窗口中npm的具体错误，检查网络／npm镜像后重试。指纹只在成功安装后写入；失败后下次会重新安装。
- 端口被占用：关闭原来的学习窗口，或显式选择另一个端口；不会终止其他程序。
- macOS或Linux不直接运行下载脚本：在终端使用 `sh` 入口；从Git获取时已保留可执行位。不会移除系统安全标记或修改系统执行策略。
- Windows出错时保留窗口；自动化可设置 `FROM_ZERO_NO_PAUSE=1`。CI环境自动跳过暂停。

按Ctrl+C正常关闭。启动锁位于忽略跟踪的 `artifacts/launcher/lock.json`，异常结束留下的、确认进程已消失的旧锁会自动清理；不会强杀已有进程。锁损坏时会明确提示，确认旧启动程序结束后才手动删除锁文件。

## 验证方式与边界

`npm run test:launcher`运行Node内置测试；`npm run test:launcher:smoke`从当前Git追踪源码复制到含空格的临时目录，不复制依赖、环境配置或学习记录，再实际调用本机平台入口。

GitHub CI新增Ubuntu24.04、Windows2025与macOS15三个原生runner。每个平台都运行10项守卫与1项smoke，从没有node_modules的源码开始，执行真实安装／启动，核对HTTP、WASM、三个下载ZIP及导师状态接口，检查重复启动保护、停止和复用依赖的再次启动；退出时只清理测试自己创建的进程和临时目录。最终交付依赖三平台全部通过。

自动化使用 `--no-open`，验证的是原生OS里的脚本、进程与本地HTTP服务，不把它称为实际Finder／文件管理器双击、系统浏览器关联、桌面权限弹窗或真实用户终端Ctrl+C的完整GUI验收。实际CI状态以Actions运行与交接回执为准。
