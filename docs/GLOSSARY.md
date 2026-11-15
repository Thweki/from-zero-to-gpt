# 课内术语表

在章节的模式栏点击「术语」，即可查阅中文名称、英文名称、定义与例子。
下拉框优先列出本章相关术语，也可选择其他课程术语。当前收录 33 个条目，
通过显式关联覆盖全部 83 章；不会改动教材正文、课程顺序或学习验收。
面板随模式栏保持可用，支持四种阅读模式、窄屏与深浅外观。
在面板内按 Esc 或点击关闭按钮可收起，并将焦点还给「术语」按钮。

每章独立保存 `progress[lessonId].glossary = {open, termId}`，默认关闭。
使用现有 IndexedDB 自动保存与 JSON 导入／导出流程；旧的 version-1 备份仍可导入，
无需迁移。导入校验要求布尔开关与有效术语 ID。条目 ID 应保持稳定。
查阅只更新该字段，不修改笔记、代码、实验参数或学习证据，也不调用导师服务。

条目及章节关联维护在 `src/data/glossary.ts`。术语表是简短参考，不代替教材的完整推导。

## 本地验证（2026-11-15）

- `npx vitest run src/glossary.test.ts src/glossary-ui.test.ts`：20 项通过。
  包括全部章节覆盖、关联与 ID 校验、旧备份兼容、IndexedDB 与 JSON 往返、
  损坏数据拒绝、四种模式、独立章节选择、学习证据保留及关闭后焦点恢复。
- 回归敏感性：临时移除 LessonReader 与导入校验中的集成后，20 项中 17 项失败；
  恢复集成后全部通过。
- `npm run check`：通过；`npx vite build`：通过（现有大块体积提示仍存在）。
- `npm test`：679 项中 641 项通过，38 项失败均为 `spawnSync python3 EPERM`。
  涉及未修改的 neural（11）、transformer（16）、modern-llm（11）测试。
  Python 3.13.5 已安装，失败来自本环境对子进程的权限限制。
- `npm run build` 与 `npm run validate:course`：尝试运行，Python 探测受上述限制而中止。
  前端构建已单独验证，完整打包未完成。
- `npx playwright test tests/glossary.spec.ts --project=desktop`：尝试运行，
  开发服务在 Python 打包准备阶段中止。单独启动 Vite 也报本地端口监听 `EPERM`，
  因此浏览器执行与视觉检查未完成。`--list` 成功发现 390px、1440px 两项回归测试。
- 未运行 Tauri／原生构建及完整浏览器套件；本次未修改原生代码。

在允许 Python 子进程与本地服务的环境中，继续运行完整构建、课程验证及上述 Playwright 测试。
