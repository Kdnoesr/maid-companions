# 液态玻璃 v2 适配记录 · 2026-11-13

> 接手对象：DSH Desktop **0.2.2-rc.1**（宿主前端构建 hash `index-lh_YM6sT.css` / `index-BgUyXZcc.js`）。
> 代码：`D:/dsh-src/maid-companions/lib/client.js`。**本文件记录到 v0.4.3；v0.4.4 → v0.5.0 的定稿参数见 [liquid-glass-v050-final.md](liquid-glass-v050-final.md)。**
> 热重载：改 client.js 后 0.5–1s 自动进渲染器（HMR 默认开启）；不触发时把 `package.json` 的 LastWriteTime 改成当前时间再来一次。**不要重启 DSH Desktop**（会杀会话）。

---

## 1. 这次要解决的事

用户原话（2026-11-13）：很多地方的折射是坏的，**四周折射区与内部模糊区割裂**；最完善的是输入框和设置面板，
「尽量把其它区域对齐输入框的样子」；并且**把所有按钮/视窗/弹窗都适配液态玻璃**。

上一轮（GPT-6.1 Terra）只做了模拟 DOM 测试，没有真机视觉验收。本轮补齐了：

1. **真实桌面截图链路**（PrintWindow + 可控图案背板），不再靠模拟。
2. 找到并修掉"改了大量代码但界面没变"的根因。
3. 用输入框当基准，把浮层/面板拆成两套材质，统一位移场与装帧。

---

## 2. 根因（按重要性排序）

### 2.1 18 个哈希类选择器全失效 —— "改了等于没改"
宿主 0.2.2-rc.1 换构建后，CSS module 类名整体变了。插件里按类名写的规则**一条都没命中**：

```
.JObwrW_panel .Jh0q7G_card .Nqubda_panel .QsffPG_menu .VOzbGW_panel .ZKlsPq_menu
.bRhRbq_panel .lXshSW_root .mufS8W_card .ptK59a_panel .wCInkW_navCell .wCInkW_navIcon
.wCInkW_navLabel .wCInkW_panel .wq12jW_menu [class*='Dc7zOa_root'] [class*='_1nxmc_']
```

真实 DOM 里逐个 `querySelectorAll` → 只有 `[class*='centerCol']` 命中 1 个，其余 17 个全 0。
修法：全部改用**稳定结构锚点**：`role`/`aria-*`/`data-*`（`data-menu-material`、`data-composer-card`、
`data-team-panel`、`data-shortcut-modal`、`data-dockkit-*`、`data-sidebar-right-*`、`data-dsh-bottom-panel`、
`data-composer-stat`、`data-windows-menu`、`data-context-menu-trigger`）。**以后禁止再用哈希类名做选择器。**

### 2.2 位移与模糊量级错配（"割裂"的直接原因）
- 旧参数：bezel 32、位移峰值 ≈17.6px，而**内部 backdrop blur 只有 1px**。
- 输入框（黄金标准）：bezel 24、位移峰值 ≈10px，blur 1px、底色完全透明。
- 于是面板边缘是"被推弯的清晰内容"，内部是"清晰内容"，视觉上读成两个材质拼接。
- 更隐蔽的一层：设置窗的父 overlay 里有一层 `mask`（`rgba(0,0,0,.5)`），把 veil 的**采样源整体压暗 50%**，
  折射信号再砍一半 —— 所以"看不出折射"。

### 2.3 宿主自己的玻璃与插件玻璃叠加
宿主有 5 个面把 64% 底色 + `blur(40px)` 画在 `::before`（子智能体树 `.rezYhW_menu`、团队面板、
`.F07MqG_panel`、`.Fu0XRq_panel`、`.Gc24Bq_bar`）。插件再挂一层 direct 玻璃 ⇒ 两层玻璃叠着，
合成覆盖 ~73%，带 40px 鬼影。已做 `::before` 静音（见 §3.3）。

### 2.4 静态 CSS 玻璃与 JS 引擎各写一套
`:564/:594/:601/:610` 那几条 `background-color + blur(1px)` 的静态规则会和引擎参数打架，
表现为"同一个菜单有的地方有折射、有的没有"。已给这些规则加 `:not([data-menu-material='translucent'] *)` 收口。

---

## 3. 现在的实现

### 3.1 材质分档（`MAT` 常量，createLiquidGlass 内）
```js
composer: { blurPx: 1,   saturate: 1,    brightness: 1.05, bezelPx: 24 }   // 冻结，一个像素都不动
glass:    { blurPx: 2,   saturate: 1.08, brightness: 1.05, bezelRatio: 0.03, bezelMin/Max: 24 }  // 浮层
panel:    { blurPx: 3.5, saturate: 1.12, brightness: 1.05, bezelRatio: 0.03, bezelMin/Max: 24 }  // 页面级面板
panelTint: "38%"   // 面板底色（color-mix 到 bg-layer-2）
floatTint(w,h): 面积 ≤120k → 26%，≥420k → 46%，中间线性   // 浮层底色：越大越实
panelDisp: 12  floatDisp: 8   // 位移目标上限（CSS px）
maskTint.dark: "rgba(0,0,0,0.22)"  // 宿主 overlay 遮罩，从 .5 降到 .22
```

**为什么面板和浮层要分开**：真机 A/B 实测，面板用 16% 底 + 1.2px 模糊时，背后正文和面板文字叠成
"字叠字"（插件列表直接被背景代码文字穿透）；浮层用 5px 模糊则像毛玻璃，与输入框"清晰玻璃"不符。
结论：**大面必须比浮层更磨砂**；模糊是**全字段均匀**的，所以不会重新制造边缘/内部割裂。

### 3.1b 面板参数的第三次迭代（0.4.3 定稿）
- 0.4.1：面板 blur 1.2 / tint 16% —— 最"像输入框"，但 800×800 面板背后正文与面板文字**叠成字叠字**，读不清。
- 0.4.2：面板 blur 5 / tint 32% —— 可读，但背景全糊，折射几乎看不见。
- **0.4.3（定稿）：面板 blur 3.5 / tint 38%** —— 4× 边角放大可见网格在带内被压缩弯折（折射在），
  背后正文降到"可辨认但读不了"的雾状，面板文字锐利。`shots/f2-edge4x.png` 为证。
> 注：a07 的自动判据报"dJ=0.00px、折射带不存在"，是**测量口径问题**（在 3.5–5px 模糊下按亮度峰/线间距取样，
> 位移信号被模糊吃掉）。人工 4× 放大对照图能直接看到边缘带内的网格弯折。

### 3.2 位移剖面 `quad2`
`buildMap(...)` 的 `ease` 参数：
- 不传：输入框/旧路径，`m = smoothstep²`（黄金标准，不动）
- `"quad2"`：`t = clamp(-sd/bezel)`，`m = (1-t)²` —— 浮层与面板都用它
- `"ramp"`（线性锥面）、`"global"`（全域缓弯）已证伪：前者在内缘出折线，后者整块变鱼眼（网格出现同心圆环）

物理依据（a03 数值实验）：割裂来自**放大率凸包** `M(u)=1/(1-c|m'|)`。quintic 的 `max|m'|=1.875`，
c=0.42 时 M 峰值 4.7 且落在 bezel 中部 → 那里看起来"悬空一圈"。quad2 把极大值挪到物理外缘（被 0.5px
高光边盖住），带均值 0.81 / 带最小 0.67（旧方案 0.67/0.28），折返临界 c*=0.53，当前 c=0.25 有两倍余量。

位移钳制（防小面板荒诞位移）：`scale = min(rawScale, dTarget * max(w,h) / 256)`，
因为净位移 `d = scale * 256/max(w,h)`，不钳制时 260×320 的菜单会算到 51px（宽度的 20%）。

### 3.3 `::before` 玻璃静音
`hasBeforeGlass(el)` 读 `getComputedStyle(el,'::before')` 的 backdrop-filter / background alpha；
命中则挂 `data-mc-glass-before` 并写 `--mc-before-fill:transparent` / `--mc-before-bf:none`，
由静态 CSS `body[OWNER] [data-mc-glass-before]::before {... !important}` 生效，卸载时还原。

### 3.4 统一装帧（STAGE_CSS 末尾）
一层规则套所有玻璃面：`0 0 0 .5px hairline + float shadow + inset 0 1px 0 topline + inset 0 0 20px -5px 冷白内辉`，
设置窗单列更深的 `0 20px 60px` 阴影。变量在 `body` 上（`--mc-hairline`、`--mc-topline`、`--mc-glow-*`），
浅色主题单独覆盖。
⚠️ **特异性陷阱**：`:354` 那条旧设置面板规则是 (0,9,1)，会压过末尾同属性规则 —— 改面板装帧必须改那一条
或提升特异性，否则看到的一直是旧阴影。

### 3.5 控件材质（按钮/开关/tab/输入类）
见 `docs/controls-glass.md`（a08 规格）与 STAGE_CSS 末尾「控件材质」段：
- 玻璃面内控件一律 `backdrop-filter:none`（不在玻璃上再叠玻璃）
- hover/active 用 `background-image: linear-gradient(...)` 叠白 —— **不能改 background-color**（会擦掉实底，实测开关白轨变黑）
- focus 统一 `outline: 2px #7aaaff`（宿主的 `--dsw-focus-ring-color` 本版为空，var 回退无效）
- 输入框区域 `[data-composer-card]` 明确排除

---

## 4. 验证方法与当前结论

| 项 | 方法 | 结果 |
|---|---|---|
| 真实截图 | PrintWindow(`PW_RENDERFULLCONTENT`) | 2560×1390，窗口被挡/无焦点也能截 |
| 折射可观察 | `window.__lg27.pattern({kind:'grid'|'checker'|'text'})` 注入受控背板 | 网格在边缘可见弯折，内部保持锐利 |
| 设置窗 | 真机截图 + 探针 | panel bg 38%、veil = `url(#…-v) blur(3.5px) saturate(1.12) brightness(1.05)`、bezel 24 |
| 账号菜单 | 真机截图 | material 层 26–46% 底 + `blur(2px)`，统一装帧已生效 |
| slash 命令菜单 | 真机截图 | 954×400 走 direct 玻璃（之前完全没接管） |
| 面板面内均匀性 | Sobel 梯度剖面 | ring/inner 12.72 / 13.95 ⇒ 模糊均匀，无边界突变 |

关键截图（已复制进仓库 `docs/img-lg2/`）：`overview4.png`（总览）、`f2-settings-crop.png`（设置窗叠 24px 网格）、
`f2-edge4x.png`（设置窗左边缘 4×，可见网格在带内弯折）、`f-menu-crop.png`（账号菜单）、
`v24-composer-corner.png`（输入框 3× 基准）、`v18-slash-crop.png`（slash 菜单）。原始文件在 `D:/DSH Workspace/_lg27/shots/`：`v19-settings-crop.png`（设置窗叠网格）、
`v19-set-tl.png`（左上角 2×）、`v22-menu-crop.png`（账号菜单叠棋盘）、`v21-composer-2x.png`（输入框基准）、
`v18-slash-crop.png`（slash 菜单）。

---

## 5. 回滚

| 备份 | 位置 | 说明 |
|---|---|---|
| 本轮前原始态 | `D:/dsh-src/maid-companions-backups/LG27-PRE-20261112162145` | 上一轮结束时点 |
| v0.3.0 首版 | `.../LG27-CHECKPOINT-v030-20261113` | 统一材质引擎首次落地 |
| v0.4.0 | `.../LG27-CHECKPOINT-v040-20261113` | 位移剖面 quad2 / ::before 静音 |
| v0.4.2 | `.../LG27-CHECKPOINT-v042-20261113` | 面板/浮层材质分流 |
| v0.4.3（本次） | `.../LG27-CHECKPOINT-v043-20261113` | 面板 blur 3.5 / tint 38 定稿 |

回滚 = 覆盖 `lib/client.js` + `package.json` + `cordis.patch.yml`，然后 touch package.json 触发重载。

---

## 6. 未完成 / 已知风险

1. **引号预览、子智能体树 popover、底部 compact 菜单、tooltip** 只在模拟 DOM 里验证过选择器，
   真机没逐个开一遍（需要特定交互路径）。
2. **浅色主题** 全部规则都写了，但只在深色下截图验收。
3. **面板 38% 底 + 3.5px 模糊** 是"可读性 vs 通透度"的折中；若用户想要更透，改
   `MAT.panel.blurPx` / `MAT.panelTint` 两个数即可（渲染器里也能用 `globalThis.__mcGlass`、`__mcPanelTint` 热调）。
4. 宿主每次升级换构建都可能新增表面；引擎靠结构锚点自动发现，但**新表面若没有 role/data 属性会漏**。
   排查手法：`globalThis.__mcDebug()` 看 found/wanted/mounted。
