# 字体与主题

当前界面使用中性纸面浅色、低亮石墨深色及森林绿交互强调。暗色正文为柔和暖灰而非亮白。阶段图标保留六种低饱和区分色；错误、成功、警告各自有语义颜色。颜色集中在 `src/theme.css`，字体、排版和阅读／实验尺度集中在 `src/typography.css`，响应式框架位于 `src/focus.css`，行为相关样式仍在 `src/usability.css`。

## 字体交付

- 中文：[Noto Sans SC／思源黑体](https://github.com/notofonts/noto-cjk)，`@fontsource-variable/noto-sans-sc` 5.3.1。
- 英文与数字：[Inter](https://github.com/rsms/inter)，`@fontsource-variable/inter` 5.3.0。
- Python、命令与张量数字：[JetBrains Mono](https://github.com/JetBrains/JetBrainsMono)，`@fontsource-variable/jetbrains-mono` 5.3.0，代码禁用连字，行号与编辑器使用相同字号、字体和行高。

三个开源字体通过锁定的 npm 依赖引入，Vite 输出带哈希的同源 WOFF2 资源，使用 `font-display: swap` 和按 Unicode 范围的字形子集。无需 Google Fonts、外部字体 CDN 或模型接口。丢失字体资源时会回退到系统字体，课程与实验仍可操作。数学表达保留 KaTeX 自己的数学字体。

再分发许可随站点位于 `public/fonts/LICENSE-*.txt`，均为 SIL Open Font License 1.1；保留上游版权和完整许可。升级字体依赖时同步核对这些许可文件。

## 排版尺度

| 区域 | 桌面 | 窄屏 |
| --- | --- | --- |
| 正文 | 17px／2.05 行高 | 16px／2 行高 |
| 课程一级标题 | 44px | 34px |
| 小节标题 | 21px | 19px |
| 主导航 | 13px | 13px |
| 章节导航 | 12px | 12px |
| 代码／行号 | 13px／1.9 行高 | 12px／1.9 行高 |

正文控制行宽，长代码和张量表格在所属容器内滚动。学习进度、主题和断点沿用现有 IndexedDB 结构，没有数据迁移或清空。localStorage 中的 `from-zero-to-gpt:theme` 只是首帧绘制提示，启动后始终服从 IndexedDB 里的主题；读取／写入异常不会阻止启动。HTML 关键底色避免深色偏好的浅底闪烁，浏览器 theme-color 随实际主题同步。

## 验证边界

`tests/typography.spec.ts` 检查真实字体加载、同源请求、代码行号一致、KaTeX 字体、360／390／768px 布局、浅深主题与笔记恢复，应用脚本未启动时的深色首帧，以及字体请求失败时仍能学习。`tests/mobile.spec.ts` 额外覆盖 320px 与 1440px 的顶部控件、四模式和双主题。原外观、原生全屏、Python 错误、保存与触控模拟继续回归。截图位于忽略的 `artifacts/` 子目录，结果以 TEST_REPORT、Actions 和发布回执为准。

本轮浏览器为 Chromium 及尺寸／触控模拟，不代表 Safari、Windows 字体渲染、iOS／Android 实机或软键盘验收，也不是全站 WCAG 认证。
