# 浮层 / 气泡 / 窗口 毛玻璃 —— 覆盖面与发现方法

本文件记录 `lib/client.js` 里「浮层毛玻璃」那三条规则的**依据**，以及 DSH 升级后如何重新发现。

## 为什么按 token 分族，而不是按组件名

DSH 的浮层用 **CSS Modules 哈希类名**（如 `._7KE1Ra_menu`），随构建变化；但每个浮层
**用什么设计 token 上色**是稳定的。所以规则按"原本的底色 token"分三族，用 `color-mix`
把同一个 token 降不透明度 —— 每个表面保留自己的色相，只变透明度，不会串色。

| 族 | 底色 token | 落地选择器（本次构建实测） | 不透明度 | blur |
| --- | --- | --- | --- | --- |
| ① 菜单/气泡 | `--dsw-specific-menu` | `[role=menu]` `[role=listbox]` `[role=tooltip]` + `bRhRbq_panel` `mufS8W_card` `JObwrW_panel` `Nqubda_panel` `_3e4SsG_menu` `QsffPG_menu` `_7KE1Ra_menu` `ZKlsPq_menu` `_7rgC5q_popover` | 78% | 12px |
| ② 设置窗/浮层面板 | `--dsw-alias-bg-layer-2` | `VOzbGW_panel` | 84% | 12px |
| ③ 居中弹窗 | `--dsw-alias-bg-overlay` | `[role=dialog]` `[role=alertdialog]` `_7rgC5q_dialog` | 84% | 12px |

`bRhRbq_panel` 等类名来自 `@deepseek-ai` 的核心客户端包；`_7rgC5q_*` 来自 `@linxin666/dsh-web-all`。
`_7KE1Ra_menu` = 模型选择气泡（已逐行读源码确认：`createPortal` 到 body 的 `<div role="menu">`）。

## 刻意**不**纳入的面（重要）

- **`[role=tabpanel]` / 主内容区**：对话、轨迹、上下文等 tabpanel 就是主内容区本身。
  给它上色 = 2026-09-13 那次「整个对话区域变灰 + 卡片溶进背景」事故的形态。
  由 `scripts/check-no-area-tint.mjs` 的 E 检查强制禁止。
- **`fV0t5q_root`（轨迹工具栏）**：它是 `position:sticky` 的**工具条**，不是浮层窗口，
  且位于主内容区内。给它加毛玻璃会让内容从工具条下透出，观感不对，故不加。
- **`dsh-context`**：扫描未发现它自己的浮层表面类（其 UI 应落在主内容区/侧栏），同理不加。
- 编辑器内部的 `.xxx_selectPopup`（`--dsw-alias-bg-layer-3`）：属于编辑器内联控件，非"窗口气泡栏"。

## DSH 升级后如何重新发现

哈希类名会随构建变化。失效时的表现是**安全的**：那条选择器匹配不到，该浮层退回原版外观，
不会报错、不会崩。重新发现：

```bash
node scripts/discover-overlay-surfaces.mjs
```

它会扫描所有客户端 bundle，按"背景 token"归组并列出所有 `position:fixed` 的浮层根，
把新的类名填回上表的选择器即可。

## 已知副作用（非本文档能消除）

只要用了 `backdrop-filter`，Chromium 会关闭受影响合成层的 **LCD 亚像素文本抗锯齿**，
文本改为灰度抗锯齿。实测这会让主内容区文字边缘的像素发生变化（y=2..28 / 170..221 等文本行），
**但只是抗锯齿方式变化，没有颜色/布局/几何改变**。这是 `backdrop-filter` 的固有代价，
在 v1（仅输入卡毛玻璃）时就已经存在。
