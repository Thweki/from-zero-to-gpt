# 字体与主题

0.3.4使用中性纸面浅色、石墨深色及蓝色交互强调。阶段图标保留六种区分色；错误、成功、警告各自有语义颜色。颜色集中在`src/theme.css`，字体、排版和各尺寸下的工作区节奏集中在`src/typography.css`，行为相关样式仍在`src/usability.css`。

## 字体交付

- 中文：[Noto Sans SC／思源黑体](https://github.com/notofonts/noto-cjk)，`@fontsource-variable/noto-sans-sc` 5.3.1。
- 英文与数字：[Inter](https://github.com/rsms/inter)，`@fontsource-variable/inter` 5.3.0。
- Python、命令与张量数字：[JetBrains Mono](https://github.com/JetBrains/JetBrainsMono)，`@fontsource-variable/jetbrains-mono` 5.3.0，代码禁用连字，行号与编辑器使用相同字号、字体和行高。

三个开源字体通过锁定的npm依赖引入，Vite输出带哈希的同源WOFF2资源，使用`font-display: swap`和按Unicode范围的字形子集。无需Google Fonts、外部字体CDN或模型接口。丢失字体资源时会回退到系统字体，课程与实验仍可操作。数学表达保留KaTeX自己的数学字体。

再分发许可随站点位于`public/fonts/LICENSE-*.txt`，均为SIL Open Font License 1.1；保留上游版权和完整许可。升级字体依赖时同步核对这些许可文件。

## 排版尺度

| 区域 | 桌面 | 窄屏 |
| --- | --- | --- |
| 正文 | 16px／1.95行高 | 16px／1.95行高 |
| 一级标题 | 34px，大屏38px | 28px |
| 小节标题 | 20px | 18px |
| 主导航 | 14px | 14px |
| 章节导航 | 13px | 13px |
| 代码／行号 | 14px／1.85行高 | 13px／1.85行高 |

正文控制行宽，长代码和张量表格在所属容器内滚动。学习进度、主题和断点沿用现有IndexedDB结构，没有数据迁移或清空。localStorage中的`from-zero-to-gpt:theme`只是首帧绘制提示，启动后始终服从IndexedDB里的主题；读取／写入异常不会阻止启动。HTML关键底色避免深色偏好的浅底闪烁，浏览器theme-color随实际主题同步。

## 验证边界

`tests/typography.spec.ts`检查真实字体加载、同源请求、代码行号一致、KaTeX字体、360／390／768px布局、浅深主题与笔记恢复，应用脚本未启动时的深色首帧，以及字体请求失败时仍能学习。原外观、原生全屏、Python错误、保存与触控模拟继续回归。截图位于忽略的`artifacts/typography-review/`，结果以TEST_REPORT、Actions和发布回执为准。

本轮浏览器为Linux Chromium及尺寸／触控模拟，不代表Safari、Windows字体渲染、iOS／Android实机或软键盘验收，也不是全站WCAG认证。
