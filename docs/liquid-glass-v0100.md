# 液态玻璃 v0.10.0 —— 全表面统一收口

日期：2026-11-13
产物：`lib/client.js` MC_VER = "0.10.0"，1,112,762 B
SHA256：`8129C79BAEE96CB216F183432C84914C27F032AB48BD549E3A6F3BCC74295BBA`
回滚点：`D:/dsh-src/maid-companions-backups/LG27-CHECKPOINT-v0100-20261113`

---

## 1. 这一版到底统一了什么

目标（用户原话）：**除输入框外删尽自发光；所有玻璃面的折射/模糊/透明度严格对齐输入框。**

最终形态：所有玻璃面共用同一套「材质四件套」，逐字相同。

| 组成 | 值 | 说明 |
|---|---|---|
| 采样链 | `backdrop-filter: url(#<SVG滤镜>) blur(1px) saturate(1) brightness(1.05)` | 与输入框完全一致 |
| 位移场 | 峰值恒 **10 CSS px**，bezel 24，ease 归一 | 与小面尺寸无关 |
| 发丝 | `0 0 0 0.5px var(--mc-hairline)`（深 #ffffff1f / 浅 #0000001a） | 与输入框同令牌 |
| 内辉 | `inset 0 0 20px -5px rgba(212,232,255,.20)` | 唯一保留的「光」，就是输入框那圈边缘光 |
| 填充 | `--mc-fill-float/panel/card`：暗 `#06070b 14%` / 浅 `bg-overlay 45%` | 暗色不用白填（见 §4） |
| 圆角 | 输入框/气泡/面板 r28；菜单 r16 | 对齐宿主 |

**已删除的全部自发光**：主按钮品牌外辉（3 组）、焦点光环 halo、浮层/面板/卡片顶线（topline）、发送键泛光、navi 渐变。全文 `122,170,255` 只剩一个未使用变量。

## 2. 关键修复：小浮层折射归零

旧公式 `peak = 10 × min(1, max(w,h)/512)` ⇒ 144×110 的账号菜单峰值只有 2.7px，视觉上「完全没有折射带」，是「平、像塑料」的主因。

新做法（`buildMap`）：`scale = dTarget / dispScale`，非输入框面 `dTarget = min(10, 0.4545 × bezel) = 10`，于是净位移 `d = scale × shrink ≡ 10px` 与面尺寸无关；输入框（dTarget=0）走原黄金路径，数值零改动。

实测：气泡 373×503 → scale 19.65（=10/0.509）、第二气泡 scale 24.14 → 峰值都 = 10.00；composer scale 38.05 不变。

## 3. 决定性像素证据（物理像素坐标，PNG 2560×1390 = CSS 2048×1112 ×1.25）

| 面 | 位置 | 剖面（外 → 边 → 内） | 读数 |
|---|---|---|---|
| 输入框（黄金） | y=1000 | 46 → 61/62/64 → 41 | rim +16，半衰约 6 CSS |
| 用户气泡 | y=420 | 21 → 34/35/33 → 平台 22 | rim +13，半衰约 6 CSS |
| 账号菜单 | y=1250 | 0 → 26 → **41/43** → 25 | rim +15~17，同形 |
| 设置面板 | y=695 | 6 → 20 → 3/4 | 内比外暗（tint 14% + 遮罩压暗），rim +14 |

四者 rim 幅度 13~17、半衰 6 CSS 内，形与量级一致。`inset 0 0 20px -5px` 的亮度峰天然落在「边界内 ~6 CSS」（负 spread -5 + blur 20 的必然），这不是 bug 而是参数的正确输出。

**内辉渲染几何验证**：给气泡写 `inset 0 0 0 8px rgba(255,0,0,.55)` → 红环精确出现在可见边沿内侧、宽 8 CSS，证明阴影起点在可见边沿、层级正确。

> 说明：此前多轮「气泡没有内辉 / 菜单没有 rim」的读图结论，事后被证实是 **/shot 拿到陈旧帧**（同一 sha256 重复多帧）。v0.10.0 的所有判定都以「同帧 DOM dump + 同帧截图」为准。

## 4. 暗色为什么不能加白底（a03 定量结论）

近黑底 L*≈4.25 时，**1% 白填就 +8.14 L\***（JND=2.5）——暗色里不存在「轻微白底」档，任何白填都会立刻变成灰塑料。反向证明：`#06070b 38%` 在文字密集背景只 −4.81 L*。

因此暗色统一用**烟熏黑填充** `#06070b 14%`；浅色保留白 45%（45% 白叠在 #f2f4f7 上仅 +1.78 L*，肉眼不可见，安全）。对比度全过 AA：α=.14 时标题 15.7:1、次文字 7.6:1。

## 5. 模态遮罩

`[role=presentation]:has([role=dialog][aria-modal=true]) { background-color: rgba(0,0,0,.34) }`，浅色 12%。
与 Apple HIG「背景亮时加 35% 暗压层」同构。**遮罩自身不加 backdrop-filter**（会让面板 veil 二次采样）。

## 6. 源码结构

单文件 1.1 MB → `src/client/parts/` 14 个 part（每段 4–21 KB 代码，两个 base64 资产单独成文件）：

```
node scripts/resync-parts.mjs              # 改完 lib/client.js 后重切 parts
node scripts/assemble-client.mjs --check   # 校验拼装与产物字节一致
```

当前校验：`RESULT: byte-identical — 1112762 B, sha256 8129c79b…95bba`。

**纪律：每次改完 `lib/client.js` 必须跑一次 `resync-parts.mjs`**，否则 parts 与产物不同步。

## 7. 已知未解决 / 待用户裁决

1. **纯色背景上折射物理不可见**。位移场对均匀背景恒等输出，所以聊天区（背后只有接近纯黑的面板）里的玻璃只剩「发丝 + 内辉 + brightness」。这是物理限制，不是参数问题。可选方案：把聊天区底板设为透明，让皮肤立绘成为折射源（截图对比 `shots/f2-transparent.png`）。**未落地**，默认行为不变。
2. **ghost 残影**：长消息滚到输入框背后时，输入框的 backdrop-filter 会把那段文字再渲染一份（放大 ~1.05×、下移）。已隔离证明 100% 由输入框自身产生；输入框按用户要求不可动 ⇒ 不修。
3. **模态面板「隔离感」**：面板透过率 .216、文字对比度 6.5，a07 建议模态 fill 提到 40–50% 或 veil blur 6–10px。会牺牲玻璃感，未落地。
4. **浅色主题**：令牌已改，未做真机验收（运行时切主题会被宿主改回，需浅色配置启动，会杀当前会话）。
5. 引用预览（`div:has(> [data-quote-popover])`）与权限弹窗无法在当前环境触发，只做了模拟 DOM 验证。

## 8. 回滚

```
D:/dsh-src/maid-companions-backups/LG27-CHECKPOINT-v0100-20261113   ← 本版
LG27-CHECKPOINT-v091 / v090 / v081 / v050 / v043 / v045 / LG27-PRE-20261112162145
```

回滚 = 把备份里的 `client.js` 覆盖回 `lib/client.js`，再 `node scripts/resync-parts.mjs`。HMR 会在大约 4 秒内把旧版热重载进渲染器，无需重启 DSH。

## 9. 验证脚本

```
node --check lib/client.js                 # 语法
node scripts/assemble-client.mjs --check   # parts 同步
team/a08-controls/v09/qa.mjs               # 黑盒断言（base / --menu / --dialog 三套）
```
