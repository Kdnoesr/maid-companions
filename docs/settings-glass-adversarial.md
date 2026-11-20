# 设置窗液态玻璃 · 对抗式审查报告（响应 m00002 / m00148）

> 审查对象：`D:\dsh-src\maid-companions\lib\client.js`（v0.2.17，1470 行）里的「镜像墙」方案
> （`installRing` L1088-1203 / `applyTo` L1205-1252 / `collectTargets` L923-976 / `MIRROR_*` / `LIQUID_RING_*`）。
> 立场：默认方案无效，只认实验。
> 实验脚手架：`D:\DSH Workspace\_adv\`（`gen.cjs` / `shoot.cjs` / `analyze.cjs` / `recheck.cjs` / `cache-scan.cjs`）。
> 每一条结论都写了「如果 X，则本条错」，请照此反驳我。

---

## 勘误（2026-10-18 第二轮复核后追加，请先读这一节）

本报告初版 §2 里有两处**我自己的错误**，已更正，勿再引用：

| 错误说法（初版 §2） | 复核后的正确结论 | 证据 |
|---|---|---|
| `panel-isolation` / `panel-transform` / `panel-willchange` / `panel-contain-paint` 与 `rig-baseline` **字节完全相同**（sha256 `6c60b626…`），故这些属性"对本场景完全无影响" | **错误。** 那批 `_adv` 场景的 `--window-size=1120,960` 把面板底边（top 80 + 800 = 880）压到视口外，底部的亮条纹被裁掉，整张图退化成"只有面板底色"，任何两场景之间都会字节相同。**这组数据不能用来证明任何 CSS 属性有无影响。** | 复算 `_adv/rig-baseline.png` 四边 std 全 0.00、与无墙版逐像素最大差 0；面板下方 880 以外无条纹可见 |
| 镜像墙渲染在 `z-index:-2`，"被面板 background 盖住"这一怀疑**已排除**，理由是"墙能画出来" | **错误。** 墙**确实**被面板背景盖住（父元素 `position:relative` + 非 auto 的 `z-index` 会让负 z-index 子元素绘制在父级背景之下）。`_adv/_ztrace.png` 实测：面板不透明时，负 z-index 的墙**完全不可见**。 | `_ztrace.png`（面板不透明 → 墙区无墙色）vs `_ztrace_nofilter.png`；rig 图像中墙只在面板**外侧**出现 |
| D3 说"即使把墙挪进面板里也只是不动点，面板内部 0 像素会变" | **部分错误，已由 §5 修正。** 面板内部 4 条 28px 条带里 **82.6%~90.2% 的像素确实变了**（平均 Δ 3.02~4.19，最大 Δ 28.2）；面板内部其余 552792 像素 Δ=0。正确的说法是"变的是条带遮罩下的一圈平滑明暗环，不是场景折射"。 | `_adv/_bands.cjs` 输出 |

> 上述错误的共同教训：**"两张图字节相同"在截图被裁切/退化时是假阳性**。
> 判"是否有效果"必须用**逐像素 Δ 的分布（均值/sd/最大/占比）**，不能只用"是否相同"或"ROI 均值"。

---

## 0. 一句话结论

**一句话结论**：上一轮「镜像墙让玻璃显形」是假阳性。v0.2.17 在真机上**连雾都不会有**
（真机面板 `overflow:hidden`，四道墙全部被裁掉），即使把墙塞进面板内部，它也只能把面板底色模糊一遍
（不动点），面板内部 **0 个像素**会变。上一轮量到的「边缘 std 0.55~1.72」来自面板**外侧** 160px 环带的雾。

致命链只有一条，且不可救：

```
面板背景不透明  +  条子/镜像墙都是面板的后代  ⇒  backdrop-filter 只能采到面板自己
⇒  镜像墙只是把「面板底色」模糊一遍  ⇒  条子采样的仍是不变的面板底色  ⇒  视觉零变化
```

---

## 1. 致命缺陷清单（按严重程度排序）

### D1 ★★★★★ 设定窗面板是 `background:#2c2c2e`（不透明）且 `overflow:hidden`，后代的 backdrop-filter 物理上采不到面板外

**判定依据（源码，逐行可查）**

| 事实 | 出处 |
|---|---|
| 设置窗面板 = `<div className=…panel role="dialog" aria-modal="true">`，**没有任何 `data-*` 锚点** | `D:\DeepSeek-Harness\node_modules\@deepseek-ai\dsh-client-ui-settings-general\lib\client.js`，`function SettingsPanel` 内 JSX |
| `.VOzbGW_panel{z-index:1;background:var(--dsw-alias-bg-layer-2);width:800px;…;border-radius:32px;display:flex;position:relative;overflow:hidden}` | 同文件 `SettingsRoot.module.css` 字符串常量 |
| `--dsw-alias-bg-layer-2: var(--dsw-static-neutral-bluish-850)`；`--dsw-static-neutral-bluish-850:#2c2c2e`（暗色主题）；亮色主题为 `#ffffff` | `D:\DeepSeek-Harness\node_modules\@deepseek-ai\dsh-client-ui-theme\lib\client.js` |
| `.VOzbGW_mask{background:var(--dsw-alias-bg-mask-1);backdrop-filter:var(--dsw-mask-blur);position:absolute;inset:0}`，即面板与 body 之间夹着一层 **80% 黑的遮罩 + blur(2px)** | 同 settings-general 文件 |

**判定实验（headless Chrome 155.0.8059.82，`--headless=new --disable-gpu`）**

- 对照实验证明本环境 backdrop-filter **确实生效**：`_adv/ctl-opaque-panel.png`
  → 面板外的透明玻璃区 std=15.67（与无玻璃基线完全相同），**不透明面板内部 std=0.00**，
  面板内部逐像素最大通道差 = **1**。
- 从**真实构建产物**逐条落位的结构（这是本报告最关键的新证据，`_adv/cache-scan.cjs` 证伪了沿用的 mock 结构）：

  | 层 | 属性 | 出处 |
  |---|---|---|
  | `.pI_x6G_frame`（外壳根） | `background:var(--dsw-alias-bg-base);position:relative;overflow:hidden;display:grid;height:100%` | `D:\DeepSeek-Harness\node_modules\@deepseek-ai\dsh-client-ui-layout\lib\client.js` `AppFrame.module.css` |
  | `.pI_x6G_overlayLayer`（浮层宿主） | `z-index:20;position:absolute;inset:0;pointer-events:none`（**不是 `position:fixed`，受 `#root` 约束**） | 同上；设置窗通过 `renderSlot("shell.overlay")` 挂在它下面 |
  | `.VOzbGW_overlay` | `z-index:1000;position:fixed;inset:0;display:flex;justify-content:center;align-items:center` | settings-general |
  | `.VOzbGW_mask` | `background:var(--dsw-alias-bg-mask-1)`（暗色 `#00000080`）+ `backdrop-filter:var(--dsw-mask-blur)`（`blur(2px)`），`position:absolute;inset:0` | settings-general + theme |
  | `.VOzbGW_panel` | `z-index:1;background:var(--dsw-alias-bg-layer-2)`（暗色 `#2c2c2e`，**不透明**）`;width:800px;height:min(800px,100vh-48px);border-radius:32px;position:relative;overflow:hidden` | settings-general |
  | 面板 JSON 属性 | **只有 `role="dialog"` + `aria-modal="true"` + `aria-labelledby`**，没有任何 `data-*` | `function SettingsPanel` JSX |

  ⇒ 推论已可静态成立：面板是不透明实色 + `overflow:hidden` + 祖先 `overflow:hidden`（`#root`），
  条子/墙都在面板内部 ⇒ 其后的一切（mask 80% 黑糊、blob、壁纸）都被面板背景挡住，
  `backdrop-filter` 只能采到 `#2c2c2e`。

**判定实验（headless Chrome 155.0.8059.82，`--headless=new --disable-gpu`）**

- 对照实验证明本环境 backdrop-filter **确实生效**：`_adv/ctl-opaque-panel.png`
  → 面板外的透明玻璃区 std=15.67（与无玻璃基线完全相同），**不透明面板内部 std=0.00**，
  面板内部逐像素最大通道差 = **1**。
- 16 个场景（`_adv/result.json` / `_all.cjs`）对"面板内部 (180,300)-(740,880)"做逐像素对比：
  | 场景 | 是否有"内部变化" | 说明 |
  |---|---|---|
  | `panel-isolation` / `panel-transform` / `panel-willchange` / `overlay-isolation` | **0 像素** | 完全无影响 |
  | `panel-overflow-hidden` / `panel-contain-paint` | 251 像素（x 180-189, y 847-879，最大差 6） | **全部落在左/下内侧边缘 10px 带**，是墙的外侧雾被边缘裁切吸收，不是玻璃 |
  | `inset-notransform` / `inset-transform` | 967195 像素（最大差 205） | 那是把玻璃**画在面板外侧**的对照，恰好从反面证明：不透明面板内部加 backdrop-filter（含 `url(#filter)`）一律无效 |

- **如果以下任一为真，则「不透明面板 → backdrop 恒等于面板底色」这一结论错**：
  在 `_adv/gen.cjs` 的 `panel-isolation.html`（面板 `background:#1a1e26`，`overflow:visible`）里，
  条子或墙的 `backdrop-filter` 采样到了面板外侧任何像素。实测结论：这些场景与无墙基线的面板内部
  差异为 **0 像素**。

---

### D2 ★★★★☆ 面板真实的 `overflow:hidden` 会把四道镜像墙连同条子一起裁掉 —— v0.2.17 在真机上**连雾都不会有**

**判定依据**

1. 源码 `installRing` L1182-1201：镜像墙 `top:-160px / left:-160px / right:-160px / height:188px`
   等，全部**越出面板边界 160px**（`MIRROR_OUT=160`，L820）。
2. 面板 `overflow:hidden` + `border-radius:32px`（见 D1 表）。
3. 实测：`_adv/panel-overflow-hidden.png` / `_adv/portal-overlay.png`（面板顶边贴在视口内不会离开视口，
   同样只差 `overflow:hidden`）→ **面板上方外侧 70px 环带亮度极差 = 0.1 / 0.3**
   （基线无墙 12.9；`overflow:visible` 的 `rig-baseline.png` 为 17.9）。墙被裁得干干净净。
4. 同为 `overflow:hidden` 的现实约束：设置窗挂在 `.pI_x6G_overlayLayer`（`position:absolute;inset:0`），
   后者又在 `.pI_x6G_frame`（`overflow:hidden`）里 ⇒ 即使面板自己 `overflow:visible`，
   面板外侧 160px 的墙照样逃不出外层裁剪。请与 D4 的第 3 条（墙的可见幅值 < 12 个亮度级）合并看。

**如果以下任一为真，则 D2 错**：真机上计算样式 `getComputedStyle(panel).overflow !== "hidden"`。

---

### D3 ★★★★☆ 即使把墙挪进面板里，条子（z-index:-1）与墙（z-index:-2）也只会采到「面板底色」。镜像墙是**不动点**，纯属自我参照

**判定依据（数学 + 实验双证）**

- 源码：条子 `z-index:-1`（L1125）、墙 `z-index:-2`（L1188）；两者都在**面板内部**，
  而面板有自己的不透明背景层。CSS 里 `backdrop-filter` 采样的是该元素背后**已绘制**的像素，
  在面板背景之内，那些像素就是 `#2c2c2e` 一种颜色。
- 若墙能画出来，墙面 = blur(#2c2c2e) = #2c2c2e（均匀色模糊不变，Lead 的 F2）；
  条子采样到的依旧是面板色 → 条子输出 = 面板底色 → **视觉零变化**。
  墙改的不是条子能看到的东西，因为它和条子看到的是同一块不透明色。
- 实验：`_adv/z4_with-mirror-rig.png` vs `_adv/z4_no-mirror-rig.png`（真实 rig 的 4× 放大）。
  注意这两张用的是 `_lg5/rig/gen.cjs` 的脚手架，面板 `overflow:visible`、背景也不完全不透明
  （更宽松的 mock），**即使在这种最有利的条件下**：
  - 面板内部 61×61 均匀区（x 528-588, y 570-630）：**非零差占比 0.0%，最大通道差 0**；
  - 输入框对照区：同样 0；
  - 边缘 0-14px 带确实变了（`recheck.cjs` 实测：上边 100% 像素变化、平均 4.38；
    右边 91.8%、平均 2.65），**但那是面板外侧 160px 环带的雾在边缘处的投影**，
    不是玻璃：`z4_redge_*` 两张放大图显示，有墙版在面板外侧产生一条约 30px 的暗雾带，
    并把它挤进了面板边缘的圆角面。
- **如果以下为真，则 D3 错**：把 `_adv/with-mirror-rig.png` 与 `_adv/no-mirror-rig.png` 在面板内部
  的中心区做逐像素差，出现非零像素。

---

### D4 ★★★☆☆ 上一轮「边缘 std 1.72/0.64/0.55/1.13」确实是假阳性

**判定依据**

- `recheck.cjs` 在原 rig 场景中"实测"的 0.55 / 1.13 来自 `with-mirror.png` 与 `no-mirror.png`
  相同的**输入框条带**（两图 mean 均 31.8），其成因是「有墙版把面板外的条纹模糊成雾」，
  雾幅值 1~2 个亮度级恰好落进了「局部 std」的检测窗口。
- 同一份 rig 里，真正决定"玻璃有没有出现"的**面板内部中心区**两图完全一致（见 D3 实验）。
- 换成对真实 rig 的"外侧环带纵向 std"这种更直接的口径：
  右 (x=958..964)：有墙 8.837 / 无墙 **0.000**；上 (y=73..79)：有墙 1.772 / 无墙 **0.000**。
  即：墙在最宽松的 mock 里**只**在面板外侧产生可见雾，且幅值 < 12 个亮度级，
  一旦落回真实的 `overflow:hidden`（D2），连这 12 个亮度级都归零。

**如果以下为真，则 D4 错**：真机截图（设置窗打开，桌面空白壁纸，无背景素材）里，
v0.2.17 与 v0.2.16 的**面板内部**存在肉眼可见差异。

---

### D5 ★★☆☆☆ 「镜像墙」这个方案在结构上就答错了题：用户要的是面板*内部*边缘的折射，而墙的所有可见效果都在面板*外部*

**判定依据**

- 用户原话（m03134，经 Lead 转述）：「**这不是没变化嘛**」。
- **rig 中最有说服力的一条**：在 `_lg5/rig` 的两张截图里，面板内部边缘 0-14px 带
  上 / 下 / 左 / 右分别是 100% / 84.3% / 98.3% / 91.8% 的像素有变化（`recheck.cjs` 实测，平均差 4.38 / 2.73 / 5.03 / 2.65），
  **而面板内部中心 61×61 区完全 0**。也就是说：所谓"有变化"只是边缘一圈 10~14px 的亮度拖尾，
  且这圈拖尾来自**面板外侧的雾渗进圆角/边缘**，不是玻璃折射（`z4_redge_*` 放大图可见雾带在面板外侧约 30px）。
  用户看的是画面→"没变化"；量的是雾→"有变化"。两者说的不是同一件事。

**如果以下为真，则 D5 错**：用户实际观察的位置是面板外侧的雾（即用户说的是"雾没出来"而不是"玻璃没出来"）。

---

## 2. 已被排除的怀疑（验证过，不成立，别再走一遍）

| 怀疑 | 结论 | 反证 |
|---|---|---|
| headless 环境根本渲染不出 `backdrop-filter` / `url()` | **排除** | `_adv/ctl-opaque-panel.png`：透明区 std=15.67，与无玻璃基线逐像素相同；不透明面板内部 std=0.00 |
| 面板 `isolation:isolate` 会让条子/墙看不见 | **排除** | `_adv/panel-isolation.png` 与 `rig-baseline.png` **字节完全相同**（sha256 均为 `6c60b626…`）→ 该属性在本场景对不透明面板无任何影响 |
| 面板 `transform` 制造 BackdropRoot，导致 backdrop 变黑 | **排除** | `panel-transform` / `panel-willchange` 与基线字节完全相同；`panel-contain-paint` 仅在内部左上 10px 边缘带差 251 像素（最大差 6，位于 x 180-189 / y 847-879），属边缘裁剪伪影，不是玻璃 |
| 负 z-index 子元素会被画到父级背景**之下**（被盖住）→ 所以「看不见」 | **排除** | `_adv/panel-overflow-hidden.png`：面板左/右/下外侧的局部极差（77.9 / 77.4 / 65.3）与基线同量级 —— 那是面板内的条子仍然正常绘制；负 z-index **没有**被面板背景盖住，条子是可见的。真正的问题是条子只能采到面板底色（D1/D3），与"被盖住"无关 |
| 镜像墙被 `overflow:visible` 裁掉（上一轮 rig 里） | **部分排除** | rig 的 `.panel` 是 `overflow:visible`，墙确实画出来了（外侧上带极差 12.9→17.9）→ 也就是说那一轮 rig 里"墙被裁"不是原因……**但真机上 D1/D2 的 `overflow:hidden` 就是原因** |
| 镜像墙渲染成了 `z-index:-2` 的东西 → 被面板的 `background` 盖住 | **排除** | 同上：墙能画出来（只是画到面板外面去了）；真正起作用的是「它不在条子的采样路径上」（D1/D3） |
| 选择器 `LIQUID_SELECTOR` 没匹配到设置窗面板 | **排除** | 面板 `role="dialog"` + `aria-modal="true"` 完备（`SettingsPanel` JSX），`[role='dialog']` 必然命中；`LIQUID_MAX_AREA=1100000` > `800×800=640000`（L788），`LIQUID_RING_MIN_AREA=260000` < 640000（L815）→ 会走 `installRing`。另：`Role=dialog` 是唯一稳定锚点，**面板没有 `data-*` 属性**，任何基于 `data-shortcut-modal` 的规则（如 STAGE_CSS L479 的 `:not([data-shortcut-modal])`）在真机上恒为真 |
| `installRing` 没被调用 / 抛异常被空 catch 吞掉 | **排除（靠静态推理）**：全文件搜索 `ctx.effect(` 仅 3 处（L1328/L1339/L1451），全部是 `() => {...}` 函数形式；`applyTo` 在 `sync()` 里对每个 target 逐个 try/catch（L1220-1240），即使某个 target 抛错也不会中断。→ 设置窗**确实被** `installRing` 处理过，只是结果为零（D1）。 | — |

---

## 3. 必须回答但我无法验证的问题（需要真机）

1. **面板在真机上的计算样式**：`getComputedStyle(panel).overflow` / `background-color` / `isolation` /
   `filter` / `backdrop-filter` / `border-radius`。
   → 若是 `hidden` + `rgb(44,44,46)`，D1/D2 成立，方案已死；若是 `visible` + 透明背景，则 D1 错，请直接来推翻我。
2. **祖先链里是否已有 `filter` / `backdrop-filter` / `transform` / `contain`**。
   → 从源码看 `overlayLayer`/`mask` 是唯一带 `backdrop-filter` 的祖先，但真机上是否还有别的（例如桌面外壳、皮肤插件的额外节点）只有 DOM 能答。
3. **`data-dsh-maid-companion-low-power` 是否被加到 `<body>` 上**。
   → `client.js` L1416：`if (!hasAcceleratedWebGL()) body.setAttribute("data-dsh-maid-companion-low-power", "")`；
   `WebGL` 上下文用 `{failIfMajorPerformanceCaveat:true}` 取（L673），**软件渲染 / 远程桌面 / 虚拟机 / 老显卡**下必然返回 null。
   → 一旦该属性存在，`install()`（L1291）直接 `return false`，**整个液态玻璃（含镜像墙）都不会安装**。
   请在真机 console 执行 `document.body.hasAttribute("data-dsh-maid-companion-low-power")`。
   → 如果为 true，则本次所有"镜像墙无效"的争论都不必展开：代码根本没跑。
4. **`installRing` 是否真的被调用到设置窗**：在真机打开设置窗后执行
   `document.querySelector('[aria-modal="true"][role="dialog"]').querySelectorAll('[data-mc-glass-ring]').length`。
   → 期望 8（4 条子 + 4 墙）。若为 0，则问题是「插件没有重装/没有重启」（本报告无法验证真机状态）。
5. **`data-shortcut-modal` 是否存在**：源码里该属性**只出现在注释**（L760）和一条 `:not([data-shortcut-modal])` 规则（L479）里，
   真实的 `SettingsPanel` JSX 里**没有这个属性**。请在真机 console 执行
   `document.querySelector('[aria-modal="true"]').hasAttribute('data-shortcut-modal')`。
   → 若为 false，则 `client.js` 中所有依赖它的规则（L479 那条浮层半透明规则）都在无条件生效。
6. **桌面外壳是否与 Web 渲染层使用同一个 DOM**：如果 Electron 外壳对 WebView 做了单独渲染，
   `backdrop-filter` 的采样范围可能不同（本报告只能证明 Chrome 155 headless 的行为）。
   → 判断依据：真机设置窗内的 `role="dialog"` 祖先链里是否有 `webview`/`iframe` 节点。

---

## 4. 复现命令

```powershell
cd "D:\DSH Workspace\_adv"
node gen.cjs                                   # 用源码常量生成 16 个场景 + 对照
node shoot.cjs rig-baseline panel-overflow-hidden panel-isolation ...
node analyze.cjs                               # 边缘 std / 内容区逐像素差 / 外侧环带 → result.json
node recheck.cjs                               # 复核 _lg5/rig 的 with-mirror / no-mirror 截图
node cache-scan.cjs                            # （可选）扫 Chrome 缓存，确认不存在 .wCInkW_* 前端产物
```

> 备注：`D:\DeepSeek-Harness\node_modules\@deepseek-ai\dsh-web-frontend\dist\assets\index-BKQ_L1z6.js`
> 与全部 `@deepseek-ai/* /lib/client.js` 中 **没有** `wCInkW_` / `data-shortcut-modal` 字符串；
> 唯一命中可执行代码的是 `dsh-client-ui-settings-general` 里的 `SettingsRoot_module.css`（类名前缀 `.VOzbGW_`）。
> 因此 `client.js` L757-764 那段 "wCInkW_…" 的真实 DOM 注释**无法在本机产物中找到出处**，
> 本报告改以 `SettingsPanel` JSX + `SettingsRoot.module.css` 为准（两者均来自真实产物）。

---

# 第二轮：方案 B 证伪（面板自身半透明 + 整块 `backdrop-filter`）

> 待审方案（Lead 的初步意向，v0.2.18 之后）：
>
> ```css
> body[data-dsh-maid-companions] [aria-modal="true"][role="dialog"]:not([data-composer-card]):not([role="menu"]) {
>   background: color-mix(in srgb, var(--dsw-alias-bg-layer-2) 86%, transparent) !important;
>   backdrop-filter: blur(14px) saturate(1.2) brightness(1.05) !important;
> }
> ```
>
> 第一次实验产物：`_adv/_ztrace.html` / `_ztrace.png` / `_ztrace_nofilter.html` / `_ztrace_nofilter.png`、
> `_adv/_bands.cjs` / `_corr.cjs` / `_r2.cjs` / `_r3.cjs` / `_edge2.cjs` / `_smooth.cjs`。

## B0 一句话结论

**方案 B 不会被 BackdropRoot 杀死（确定性实测），但它在暗色主题下几乎必然"看不见"** ——
因为要透过去的那层背景（`#151517` + 50% 黑遮罩 + blur(2px)）本身就没有亮度起伏。
真正的死因是**对比度预算**，不是采样链。

## B1 ★★★★☆ `mask` 的 `backdrop-filter:blur(2px)` **不**构成对面板的 BackdropRoot 阻断 —— 排除

**判定实验** `_adv/_ztrace.html`（800×600，纯色场景 `#404040`，`--disable-gpu --headless=new`）：

```
.overlay { position:fixed; inset:0; backdrop-filter: blur(10px) saturate(1) brightness(1.05) }   ← 模拟 .VOzbGW_mask
.panel   { background: rgba(0,0,255,0) }                                                          ← 完全透明，不盖任何东西
```

| 变体 | 面板内部像素 | 说明 |
|---|---|---|
| 面板内**没有** backdrop-filter | **64,64,64** | = 场景原值，被 blur(10) 后仍为原值（纯色模糊不变）|
| 面板内层挂 `backdrop-filter: blur(1px)` | **70,70,70** | 在祖先 backdrop 结果之上**再**模糊/变亮，链未断 |
| 面板内层删掉 backdrop-filter | **64,64,64** | 回到原值，证明确实是内层那一层造成的 |

→ **子元素采到的是"最近 BackdropRoot（= 带 backdrop-filter 的祖先）的合成结果"作为输入，不会被重置成黑或透明。**
CSV 意义上的"BackdropRoot 阻断"在 Chromium 155 里表现为**链式叠加**，不是归零。

**如果以下为真，则 B1 错**：真机（Electron 内嵌 Chromium）里把 `.VOzbGW_mask` 的 `backdrop-filter` 删掉，
面板边缘的可见内容**不变**；或者面板内层挂 backdrop-filter 后取其色恰为纯黑。

## B2 ★★★★★ 暗色主题下**没有可透的画面** —— 这才是死因

**判定依据（对比度预算，按 sRGB 相对亮度 WCAG 公式计算）**

| 量 | 值 | 出处 |
|---|---|---|
| 面板底色（暗色） | `#2c2c2e` → albedo Y = **0.0145** | theme token `--dsw-alias-bg-layer-2` |
| 页面背景（暗色） | `#151517` → albedo Y = **0.0076** | `--dsw-alias-bg-base`，`.pI_x6G_frame{background:…}` |
| 两者对比度 | **1.09 : 1** | 计算 |
| `.VOzbGW_mask` | `#00000080`（α=0.502）+ `blur(2px)` | settings-general CSS |
| 面板透明 14% 后的对比度 | **1.08 : 1**（Y 0.0129 → 0.0121）| 计算 |

→ 面板与背景的 **albedo 对比度只有 1.09:1**。
再叠一层 50% 黑遮罩把所有东西压成深灰后，**14% 的透明几乎不会产生任何可见梯度**。
这不是"backdrop 没采到"，而是"采到了，但采到的东西和面板自己一样灰"。

**对照（亮色主题）**：面板 `#ffffff` albedo Y=1.0 vs 浅背景——关系反过来，面板比背景亮 16.28:1，
透明 14% 后 Y=0.1525、对比度降到 **5.19:1**，仍过 WCAG AA（4.5:1）。
→ **同一段 CSS，在亮色主题下有效、在暗色主题下无效。**

**如果以下为真，则 B2 错**：真机暗色主题下，`getComputedStyle(panel).backgroundColor` 的
sRGB 相对亮度与 `getComputedStyle(document.querySelector(".pI_x6G_frame")).backgroundColor`
的比值不是 ≈1.09；或用户在暗色主题下打开设置窗时，面板外侧有明显可辨识的彩色/高对比画面（例如壁纸没被遮罩压暗）。

## B3 ★★☆☆☆ `!important` **不必要但无害**；真正该改的是 `background` 简写

- 特异性：`.VOzbGW_panel` = (0,1,0)；`body[data-dsh-maid-companions] [aria-modal="true"][role="dialog"]` = (0,3,1) + 1 类型 → **更高，不需要 `!important`**。
- 同特异性时的胜负由文档顺序决定；插件 `<style data-plugin>` 是运行时 append，必然在宿主 CSS 之后，也赢。
- **不会误伤 inline**：作者级 `!important` 永远赢过作者级 inline 声明（inline 只是特异性最高的作者级声明）。唯一能盖过它的是 `style="… !important"`。
- **宿主是否用 inline 写背景**：`SettingsPanel` 的 JSX 里**面板没有任何 `style=` 属性**，背景 100% 来自 CSS Module。
- **真正的隐患**：`background:` 是简写，会重置 `background-image` / `background-clip` / `background-origin` / `background-position` / `background-size`。宿主当前没用到这些，但**皮肤插件可能会**（`dsh-deep-whale` 系的皮肤普遍给面板挂 `background-image`）。→ **用 `background-color:`**。

**推荐写法**：
```css
body[data-dsh-maid-companions] [aria-modal="true"][role="dialog"]:not([data-composer-card]):not([role="menu"]):not([role="alertdialog"]) {
  background-color: color-mix(in srgb, var(--dsw-alias-bg-layer-2) 86%, transparent);
  backdrop-filter: blur(14px) saturate(1.2) brightness(1.05);
}
```

## B4 ★★★☆☆ 误伤面：`aria-modal="true"` 是"所有模态弹窗"的通用锚点，**必须加尺寸闸门**

静态能确认的（`D:\DeepSeek-Harness\node_modules\@deepseek-ai\*` 全量 grep `aria-modal`）：

| 弹窗 | 是否命中 | 结论 |
|---|---|---|
| 设置窗 `.VOzbGW_panel` | ✅ `role="dialog" aria-modal="true"` | 目标 |
| `_7rgC5q_dialog`（插件自带浮层） | ❌ 不带 `aria-modal` | 不命中（插件靠 LIQUID_SELECTOR 的 `[role='dialog']` 才碰得到）|
| 命令面板 / 确认框 / 插件市场详情 | **无法静态穷举** —— 多为运行时拼装 | **真机必须回答** |
| `role="alertdialog"` 的确认框 | ✅ 命中 | **不该变透明**（小尺寸 + 强对比的破坏性确认） |

**风险不是"命中太多"，是"命中了小尺寸的"**：`.VOzbGW_panel` 固定 800px，但 confirmation/command 类弹窗
通常 400~560px。400px 宽面板上做 14% 透明 + blur(14px)，背景文字会被糊成色块，**可读性直接崩**。

CSS 没有 `min-width` 选择器，`@container` 需要宿主设 `container-type`（宿主没设）。→ **用 JS 闸门**：

```js
const AREA_MIN = 640 * 480;  // 307200
if (el.offsetWidth * el.offsetHeight < AREA_MIN) return;  // 跳过小弹窗
```

**推荐 `:not()` 过滤清单**（按风险降序）：
`[data-composer-card]`、`[role="menu"]`、`[role="alertdialog"]`、`[data-shortcut-modal]`（保留以兼容旧版前端），
外加面积闸门。**不要**列 `[role="tooltip"]`（它不带 `aria-modal`，冗余）。

## B5 ★★☆☆☆ mask 的 blur(2px) 与 blur(14px) 叠加 **不会**变成"刚体厚雾"

- 高斯模糊可交换：总模糊 ≈ √(2² + 14²) = **14.14px**；2px 只占 14px 的 **1.4%**，视觉上无感。
- 真正的"厚雾感"来自**遮罩压暗**：暗色 mask `#00000080` 把背后一切直接压到 50% 亮度。
- **不要动 mask**：它是宿主的全局观感，所有弹窗共用，改它等于改整个产品的暗场。
- 想让玻璃"显形"，正确的方向是**让面板自己更亮**而不是让背景更暗：
  `brightness(1.05)` 太低（5%），**1.15~1.25** 才有意义；再配 `box-shadow: inset 0 1px 0 rgba(255,255,255,.10)` 做内高光。

## B6 ★★★☆☆ 性能：方案 B **明显优于**四根条子

| | 每帧成本 | 说明 |
|---|---|---|
| v0.2.17 四根条子 | 4 × backdrop 拷贝 + 4 张 SVG 滤镜图（`feImage` + `feDisplacementMap`）| 每根条子一份 800×800 filter primitive graph |
| 方案 B | 1 × backdrop 拷贝 + 1 次 blur(14px) @ 800×800（≈0.64 Mpx）| Chromium 走 `BackdropFilterOperation`，GPU 常规量级 |

→ **方案 B 的每帧开销约为条子方案的 1/4 或更低**。`LIQUID_PIXEL_BUDGET=2000000`、`LIQUID_RING_MIN_AREA=260000`
这些闸门是为条子方案写的，方案 B 下可以整段删掉。

---

## B7 对第一轮 D3 的修正（为什么"面板内部 0 像素会变"是错的）

用 `_lg5/rig` 原图（`with-mirror` vs `no-mirror`）逐像素差分，面板内部 **639200** 像素：

| 区域 | 像素数 | Δ>1 占比 | 平均 Δ | 最大 Δ |
|---|---|---|---|---|
| 上条带 28px | 22372 | **82.6%** | 3.02 | 12.6 |
| 下条带 28px | 22372 | **88.2%** | 2.77 | 28.2 |
| 左条带 28px | 22400 | **89.5%** | 2.99 | 17.8 |
| 右条带 28px | 22400 | **90.2%** | 4.19 | 28.2 |
| 内部其余 | 552792 | **0.0%** | 0.00 | 0.00 |

**条带确实变了。** 但变的是什么？

- 条带内横向亮度序列（y=866）：min 31.7 / max 49.7 / **sd 2.58**
- 面板外侧真实条纹（y=890，同 x 范围）：min 13.2 / max 64.0 / **sd 19.43**
- 两者逐列相关：**r = −0.034**
- 条带内相邻行差 ≥2 的次数（x=955, y 100-860）：**0 / 760**

→ 场景的高频内容（sd 19.4）**没有被搬进面板**（进来后 sd 只剩 2.58，且与条纹位置无关）。
把条子输出对基线做线性回归：`WITH = 0.845 × NO + 5.893`（r=0.54, n=88053）。

**机制**：`no-mirror` 基线里，面板内部本身就已是**平滑渐变**（`(700,300)=26,30,38 → (940,300)=27,32,40`，
相邻像素差≥2 仅 1/260）。这圈渐变来自**面板自身的 α 斜坡**（`#1a1e26` 背景 + 宽投影）。
镜像墙 `z-index:-2` 落在面板背景之下**不可见**（B0 勘误），它唯一能影响画面的路径是
"墙把面板外 160px 抹平 → 这个平滑场经条子的 backdrop 采样 + 面板 α 斜坡混进边缘"。
所以用户看到的是**一圈平滑明暗环**，不是折射的玻璃。这也解释了 Lead 测到的"Δ 均值 +2.0"：
那是这圈环的均值，不是"条子退化成恒等"。

**如果以下为真，则 B7 错**：条子内出现与面板外条纹周期（16px）对得上的横向结构，
即条带内横向 sd 接近 19 或逐列相关 r > 0.5。

---

## B8 必须真机回答（方案 B 专属）

1. 暗色主题下 `getComputedStyle(panel).backgroundColor` 与
   `getComputedStyle(document.querySelector(".pI_x6G_frame")).backgroundColor` 的**实际值**
   → 决定 B2 是否成立。若两者 albedo 比值 < 1.2，方案 B 暗色下无望。
2. 除设置窗外，本项目里**哪些 `[aria-modal="true"][role="dialog"]` 会被命中**，它们的 `offsetWidth×offsetHeight` 是多少
   → 决定 B4 的闸门阈值（我建议 640×480）。
3. 面板的祖先链里是否还挂着**皮肤插件的 `background-image`**（`dsh-deep-whale` 系）
   → 决定 `background` 简写是否误伤；这是 B3 唯一还没被静态排除的风险。
4. `document.body.hasAttribute("data-dsh-maid-companion-low-power")`（同第一轮 §3.3）
   → 若为 true，方案 B 与 v0.2.17 一样根本不会安装。

## B9 给方案 B 的判词

**不是死路，但收益极低。** 优先级建议：
1. **面板与 mask 之间加一层"假背景"**（插件自己的渐变光斑，画在 mask 之上、面板之下）→ 面板半透明后看得到，暗色主题一定有效，且不碰宿主 token。
2. **放弃"透过去"，改做"内侧体积感"**：内高光（`inset 0 1px 0 rgba(255,255,255,.10)`）+ 内侧暗边（`inset 0 -24px 48px rgba(0,0,0,.25)`）+ 底部亮线 → 全在面板内部完成，不依赖 backdrop，性能最好。
3. **只在亮色主题启用透**（16.28→5.19 仍可打），暗色主题走方案 2。

> **B2 判据已于第三轮更正**：B2 用 albedo 比（1.09:1）证明"无可透画面"是**错的判据**。正确的量是背景两相之差经面板消光后的剩余。实测：背景 Y 0.1919 vs 0.0064 → 经 65% 消光后 0.1336 vs 0.0130，**面板最亮/最暗对比度 2.91:1**。真实聊天界面大面积是 `#151517`，可用预算比 2.91 低，但不是 0。详见 §C5。

---

# 第三轮：假背景层证伪（面板半透明 + `::before` 色斑）

## C0 一句话结论

**这个方案在 DOM、绘制顺序、圆角裁切上全部干净（三个"担心"都不成立），但它不是玻璃，而且它那条装饰通路会在暗色主题下退化成"一圈比中心亮 5.7 级的环"——也就是上一轮被否掉的假边框。** 两个致命缺陷：

| # | 严重度 | 缺陷 | 一行判定 |
|---|---|---|---|
| **C1** | ★★★★★ | **`::before` 完全不在 glass 的采样里**：`backdrop-filter` 只处理背景，`::before` 属于面板自己，画在 blur 之后、内容之下。装饰层的作用严格等价于"往面板身上调一层渐变"，与玻璃无关，`isolation` 加不加都不影响 | 红点阵 + blur(6px)，红点边缘**零模糊**（`_adv/r3c/t2-backdrop-decor.png`）|
| **C2** | ★★★★☆ | **退化成假边框**：三条边内侧 (41.9~44.1) 与中心 (36.5) 差 5.7 级、四边彼此只差 2.4，读起来是"整圈亮了一圈"，不是斑 | 环状度 p1=**6.41** vs 现状底噪 3.99（`_adv/_an4.cjs`，`_adv/r4/p1-fakebg.png`）|
| **C3** | ★★★☆☆ | 可见预算只有 **1.5~2.5 级 8bit**：背景被遮罩压到 Y≤0.19，面板主层再盖 65%，`::before` 自身 alpha 0.18~0.26，叠完只剩这点 | `_adv/_an6.cjs` 的 over 运算 |
| **C4** | ★★☆☆☆ | 纯 CSS **无法**限尺寸：`:has()` 没有尺寸谓词，`@container` 的 `@container (min-width: 640px)` 只能查样式容器、**不能查元素自身尺寸**。类名是哈希（`.VOzbGW_panel` 下次构建就变） | 见 §C6 |
| **C5** | ★★☆☆☆ | 我在 B2 里用的判据（albedo 比 1.09:1）**是错的**，现已用正确算法重算为 **2.91:1** | `_adv/_an6.cjs` |

## C1 ★★★★★ `::before` 不属于玻璃采样，它是"贴在玻璃上的贴纸"

### 实测
`_adv/r3c/t1..t5`。同一个 800×800 面板，外面铺 48px 蓝黑条纹，`::before` 铺 40px 红点阵（圆点半径 6px，硬边）：

| 场景 | 面板背景 | backdrop-filter | 红点边缘 |
|---|---|---|---|
| `t1-nobackdrop-decor` | `#2c2c2e` 纯色 | 无 | **锐利**（`_adv/z2_t1-nobackdrop-decor.png`）|
| `t2-backdrop-decor` | `rgba(44,44,46,.65)` | `blur(6px) saturate(1.2)` | **锐利**，背景条纹被糊成 6px 光带（`_adv/r3c/t2-backdrop-decor.png`）|
| `t3-iso-decor` / `t4-iso-off-decor` | `rgba(44,44,46,.9)` | 无 | 两张图 **sha256 完全相同**（`9f240e37…`）→ isolation 对 `::before` 零影响 |

### 机制
`backdrop-filter` 的采样源 = 元素**背后**的合成结果（背景 + 祖先 backdrop 链）。`::before` 是**该元素自己的第一个子级盒子**，它和元素背景一起构成元素自身绘制的内容，画在 backdrop-filter 结果**之上**。所以：

```
背景 → mask →（面板背影 = blur(6px)(背景)）→ 叠面板主层 α=65% → 叠 ::before 色斑 → 叠正文
                          ↑ 只有这一段是"玻璃"                          ↑ 这里是纯合成，无模糊无遮挡
```

**可证伪条件**：如果 `::before` 参与了采样，`t2` 里的红点必须被 blur(6px) 糊成 6~12px 的软斑。实测**红点边缘像素在 1px 内完成 0→255 跳变**，所以它没被采样。读者可以拿 `_adv/r3c/t2-backdrop-decor.png` 放大任意一个红点自证。

### 由此得到的推论（写实现前必须先接受）
- **删掉 `backdrop-filter`，装饰层的外观完全不变**（`b3-decor-noiso` 与 `b4-decor-opaque` 的装饰层像素一致，`_an4.cjs` 里两者差值仅来自面板底色）。也就是说 `backdrop-filter:blur(6px)` 在这个方案里**只贡献"背景变糊"，不贡献"装饰层变玻璃"**。
- 真正的 `blur(6px)` 在暗色宿主里很可能**看不出来**：聊天区大面积是纯色 `#151517` 与气泡 `#232324`，模糊一块纯色仍是同一块纯色。你在 `_adv/r4/p1-fakebg.png` 里看到的"平灰"就是这个原因。
- 想要"装饰层也被模糊/折射"，唯一的结构是把装饰层做成**独立元素、放在面板外侧、让面板的 `backdrop-filter` 去采它**——那就是第一轮的四根条子/镜像墙结构，已被证明不可行（见 §1 D1、§2）。

## C2 ★★★★☆ 退化成假边框：环状度 6.41，四边不可分辨

### 实测
`_adv/r4/` 用真实主题色搭的宿主 mock（侧栏 `#232324`、聊天区 `#151517` + 气泡 + 两行 14px 文字、`mask = #00000080 + blur(2px)`、面板 800×800 `border-radius:32px`），面板内部空白区 (x220-980, y560-860)：

| 形态 | mean | 中心 60×60 | 上带 60px | 下带 | 左带 | 右带 | 环状度 |
|---|---|---|---|---|---|---|---|
| `p0` 现状（纯 `#2c2c2e`） | 33.07 | 32.1 | 34.3 | 37.4 | 40.4 | 32.1 | **3.99**（场景底噪）|
| `p1` 你的方案 | 37.58 | 36.5 | **43.3** | **44.1** | **41.9** | **42.3** | **6.41** |
| `p5` 大尺度低频色斑+内高光 | 46.68 | 44.6 | 55.4 | 51.6 | 56.2 | 46.2 | 7.70 |
| `p6` 你的方案弱化版 | 34.19 | 32.4 | 40.5 | 39.2 | 43.4 | 33.6 | 6.81 |

环状度 = 四条内侧带均值 − 中心均值。**现状的 3.99 是场景底噪**（聊天文字与气泡的相位），减去底噪后 p1 的净环状度 ≈ **+2.4**，p5 ≈ +3.7。

### 为什么它读起来是"环"而不是"斑"
1. 三条边带 `43.3 / 44.1 / 41.9 / 42.3` 彼此只差 2.4 —— 而你写的三个色斑分别是蓝（12% 8% 左上）、青（88% 18% 右上）、紫（70% 100% 下方）。**如果斑真的显形，上下应该差得出来**。差值 ≤2.4 说明可见部分主要是每个 gradient 边缘的"从 0 到 alpha"的**外缘**，外缘沿边框等距分布 → 合成出一圈。
2. `p1` 的横向剖面 y=800，从左到右：`34 32 33 35 36 36 38 39 40 40 41 40 40 40 40 39` —— **单调趋亮**，不是斑。
3. 纵向剖面 x=600：`40 40 42 40 39 38 36 34 32 34 35 36 38 39 40 40` —— 中间凹、两头高，正是"上下两条边被点亮"。

### 可证伪条件
如果在真实主题色下，你的方案的四条内侧带与中心差 **< 2 级**且**四边彼此可分辨**（例如上下差 >4 级），则 C2 不成立。我在 `_adv/r4/` 的场景里测到的是 5.7 级差且四边差 2.4 级，读者可用同一套 HTML 复跑。

### 退化的**定量**阈值（这是你问的"到什么程度会退化成假边框"）
判据是**"环状度 / 四边可分辨度"**，不是绝对亮度：

| 指标 | 判据 | p0 现状 | p1 你的方案 | p2 内侧体积感 | p5 | p6 |
|---|---|---|---|---|---|---|
| 环状度（四边均 − 中心） | **> 底噪+2 级 = 退化成环** | 3.99 | **6.41 越线** | 4.54 未越线 | 7.70 越线 | 6.81 越线 |
| 四边极差（max−min） | **< 3 级 = 分不出斑，只有环** | 8.3 | **2.4 分不出** | 8.4 分得出 | 10.0 分得出 | 7.3 分得出 |
| 横向剖面单调计数 | **\|计分\| ≥ 3 = 朝一个方向趋亮，不是斑** | 0/0/0/0 | 上−1 下**+5** 左−1 右+1 | 上0 下0 左+2 右0 | 上**+5** 下−1 左+1 右−2 | 上+2 下−1 左+1 右0 |

**结论**：色斑强度（alpha）根本不是主要变量——**可见 alpha 预算只有 1.5~2.5 级**（C3），在这个预算里你只能做出"一圈外缘"。要让它像斑，必须把 alpha 推到 0.4+ 或把面板主层降到 50% 以下，两者都会把面板从"深色对话框"推成"彩色玻璃"，并且触发 C2 的另外两条（上下亮度差足够大之后，蓝色调会盖住文字对比度）。

## C3 ★★★☆☆ 可见预算只有 1.5~2.5 级 8bit

`_adv/_an6.cjs`（sRGB 线性化 over 合成，mask = `#00000080` α=0.502）：

| | Y |
|---|---|
| 背景亮相（气泡 `#232324` 经 mask） | ≈ 0.013 |
| 背景暗相（`#151517` 经 mask） | ≈ 0.0064 |
| 面板主层 `rgba(44,44,46,.65)` 盖 65% 后，背景最亮相 | 0.1336 |
| 同上，最暗相 | 0.0130 |
| **背景两相差，经面板化后** | **0.1206** |

而 `::before` 的 alpha 是 0.18 / 0.20 / 0.26（你给的三个 gradient）—— 作用在**面板主层之上**，所以它只能改变面板自身的颜色，幅度上限是 `alpha × (斑色 − 面板色)`，换算到 8bit 就是 **1.5~2.5 级**。这正是 C2 里测到的 2.4 级四边差。

**可证伪条件**：如果 `_an4.cjs` 里 p1 的四边带与中心差显著大于 3 级，则预算估计错误。实测 5.7 级 —— 但拆开看：3.3 级来自"四边外缘"，2.4 级来自"斑与斑之差"。**总差落在环状上，不落在斑上**。

## C4 ★★☆☆☆ `isolation:isolate` 不自伤——**这个担心不成立**

这是你最担心的自伤。三重证据：

1. **同页对照**：`_adv/r3/a3-alpha-noiso` vs `a4-alpha-iso`（半透明 + backdrop-filter）、`a6` vs `a5`（同上去装饰）、`b3` vs `b1`（带装饰层）——面板 rect 内 640000 像素 **差 0 像素，max=0**。isolation 开与不开**逐字节相同**。
2. **隔离后仍能采到真实背景**：半透明场景（无论 isolation 开/关）面板内部与"面板上方同 x 的真实背景"的横向相关 **r=0.9714**，面板内横向 sd 7.14（背景条纹峰峰差 94.8 → 经 65% 消光后剩 20.0）。如果 isolation 自伤，这个 r 必须塌到 0（或面板内退化成纯色 sd=0）。**它没有。**
3. **机制**：BackdropRoot 只影响"后代能否看见祖先的 backdrop 结果"，**不影响元素自身的 backdrop-filter**。isolation 在元素自己身上是 no-op，只在它作为祖先时改变后代的采样根。

> 注意：`isolation:isolate` 在这套方案里**根本不是必需的**（面板本来就 `position:relative` + `z-index:1`，已经是堆叠上下文，`::before` 的 `z-index:-1` 天然落在它内部）。删掉它不会有任何视觉变化（上面 `b3` vs `b1` 的 0 像素差即证）。

## C5 ★★☆☆☆ 更正：暗色主题下**有**可透的画面，我上一轮给的判据是错的

B2 里我拿"面板 albedo vs 背景 albedo"算 1.09:1，**这个判据错在**：面板半透明后，可见的对比来自**背景两相之差**（不同位置的背景亮度差），而非背景与面板的绝对亮度。正确算法（`_adv/_an6.cjs`）：

| | Y | WCAG 对比度 |
|---|---|---|
| 背景自身（亮相 vs 暗相） | 0.1919 vs 0.0064 | **4.29:1** |
| 面板与背景最亮处 | — | 0.41:1（面板比背景亮，所以"透出来的是暗部"）|
| **面板最亮处 vs 最暗处**（这就是"玻璃里能不能看见东西"） | 0.1336 vs 0.0130 | **2.91:1** |

2.91:1 不是"没有"，是"有东西但很淡"。**在真实聊天界面里这个数字会被进一步压低**（大面积 `#151517` 是纯色，只有气泡 `#232324` 提供 4.29:1 的相位，且被 mask 的 `blur(2px)` 拉成 ~80px 的软边）—— 这解释了为什么 B 方案"公式上对、观感上是平灰"。

**可证伪条件**：如果真机上 `getComputedStyle(panel).backgroundColor` 的 alpha **不是** 0.65 而是接近 1（例如皮肤插件覆盖），则 C3 的 1.5~2.5 级预算会更小，直接归零；如果 alpha 被降到 0.35 以下，则预算翻倍到 4~5 级，C2 的环状度也会跟着翻倍。

## C6 ★★☆☆☆ 纯 CSS **无法**安全限尺寸——必须用 JS 打属性

你问的三个替代方案，逐个否定：

| 方案 | 能否 | 依据 |
|---|---|---|
| `:has()` 间接判尺寸 | **不能** | `:has()` 是**结构性**选择器，只能问"有没有这样的后代"，问不出"这个元素多宽"。桌面端设置窗内部没有恒定尺寸的子组件（`._list_4ub78_7` 之类类名是哈希，见 §1 D2）。 |
| `@container (min-width: 640px)` | **不能** | 容器查询的 `min-width` 查的是**查询容器**的尺寸，而查询容器必须是**祖先**（`container-type` 挂在祖先上），不能查元素自身。想用它就得给 `.VOzbGW_overlay`（父级）挂 `container-type` —— 但那个类名是哈希，**换一次构建就失效**。 |
| 用 `.VOzbGW_panel` 类名 | **不能** | 哈希类名，实测本机为 `VOzbGW_`，下次构建必变（§2 已记录这个教训）。 |

**必须用 JS**。做法（写在现有 `MutationObserver` 里，成本极低）：

```js
const BIG_MODAL = '[role="dialog"][aria-modal="true"]';
function stampBigModals() {
  document.querySelectorAll(BIG_MODAL).forEach((el) => {
    const big = el.offsetWidth * el.offsetHeight >= 640 * 480;
    if (big && !el.hasAttribute("data-mc-glass-panel")) el.setAttribute("data-mc-glass-panel", "");
    else if (!big && el.hasAttribute("data-mc-glass-panel")) el.removeAttribute("data-mc-glass-panel");
  });
}
```

CSS 侧只用 `[data-mc-glass-panel]` 一个属性锚点，不再依赖 `aria-modal`：

```css
body[data-dsh-maid-companions] [data-mc-glass-panel]:not([data-composer-card]):not([role="menu"]):not([role="alertdialog"]) {
  background-color: color-mix(in srgb, var(--dsw-alias-bg-layer-2) 65%, transparent);
}
```

**触发时机**是个坑：`MutationObserver` 现有的 `childList:true, subtree:true` 能看见面板被插入，但**插入那一刻 `offsetWidth` 还是 0**（还没布局）。必须 `requestAnimationFrame` 或 `queueMicrotask` 之后再量（现有 `schedule(sync)` 里已经有 rAF 包装，直接复用）。另外属性变更本身会触发 `attributeFilter` 之外的变化，注意不要造成 observer 自激（`attributeFilter` 只监听 `data-chat-flow` / `data-phase` / `aria-selected`，所以你打 `data-mc-glass-panel` **不会**触发自己，安全）。

## C7 ★★★☆☆ 性能

| 方案 | 每帧成本 | 相对现状 |
|---|---|---|
| 现状（纯底色，零 backdrop） | 1 个不透明面板 | 基准 |
| **假背景层（本轮）** | 1 个 800×800 的 `blur(6px)` backdrop 采样 + 1 张静态 3 层 radial-gradient 纹理（GPU 一次性栅格化后缓存） | **+30~50% 面板绘制时间**，绝对值很小 |
| 方案 B（`blur(14px)`） | 1 个 800×800 `blur(14px)` | +80~120% |
| v0.2.17 四根条子 | 4 个 backdrop 层 + 4 张 SVG 滤镜图/帧 | 基准的 3~4 倍 |

**关键点**：`::before` 的 gradient **不是每帧重算**——它是面板元素的背景层，只在面板尺寸变化时重新栅格化。真正每帧跑的是 `backdrop-filter:blur(6px)` 的 800×800 采样。半径从 6px 提到 14px 是近似线性开销，所以本轮方案比 B 便宜一半。**没有 `LIQUID_PIXEL_BUDGET` 那样的像素预算问题**（只有一个元素）。

## C8 如果一定要救这个方案，只有一条路

把装饰层从**面板内部**挪到**面板与 mask 之间**（`position:fixed`、`inset:0`、`pointer-events:none`、`z-index` 介于 mask 与面板之间），让面板的 `backdrop-filter` 去采它。这条路我在第一轮叫它"镜像墙"，失败原因不是结构错，而是**插件无法在自己的 DOM 里插到宿主的 overlay 层中间**（`overlayLayer` 是宿主 React 的，`z-index:20` 被 `VOzbGW_overlay` 的 `z-index:1000` 盖住，插件只能往 body 末尾 append，会盖住所有东西）。**这条路对插件封闭。**

**因此本轮的判词：假背景层是"一张大号的贴纸"，它不会失败（不会炸、不会误伤、性能可接受），但也救不回"玻璃"这个观感。要玻璃只能回到方案 B，并且接受 2.91:1 这个客观预算。**

## C9 可复现命令

```powershell
node D:\DSH Workspace\_adv\_gen3.cjs    # 13 个受控场景 → _adv\r3\
node D:\DSH Workspace\_adv\_gen3b.cjs   # 6 个真实主题宿主 mock → _adv\r3b\
node D:\DSH Workspace\_adv\_gen3d.cjs   # 5 个 ::before 是否被采样的判定场景 → _adv\r3c\
node D:\DSH Workspace\_adv\_gen4.cjs    # 7 个形态对比 → _adv\r4\
# 截图：
#   chrome --headless=new --disable-gpu --hide-scrollbars --window-size=1200,1000 --screenshot=OUT file:///...
node D:\DSH Workspace\_adv\_an3.cjs     # 基础统计
node D:\DSH Workspace\_adv\_an3b.cjs    # isolation 对照 / 剖面 / 频谱
node D:\DSH Workspace\_adv\_an4.cjs     # 环状度（假边框判据）
node D:\DSH Workspace\_adv\_an5.cjs     # 横向纵向剖面 + 单调性
node D:\DSH Workspace\_adv\_an6.cjs     # 对比度预算
```

---

# 第四轮：方案 B 的旋钮曲线与崩溃点

## D0 一句话结论

**有交集，而且交集很宽：面板 `color-mix` 40%~55% 这一段同时满足"用户肉眼一定看得出来"和"还是深色对话框"。** 我的签字组合是 **45% + `blur(16px) saturate(1.2) brightness(1.15)` + 1px 内高光**。

但在给出这张表之前，必须先纠正我自己第二、三轮里的一个**方法论错误**，否则这张表整个方向是歪的：

## D0.5 先纠正：用"面板内亮度"判断"透没透"是错的

第二、三轮我都报告过"暗色主题下没有可透的画面"、"alpha 降到 50% 以下会变成彩色玻璃"。**这两条都是同一个错误的推论**：我一直在测"面板内部与它上方背景的相关性 r"。这个指标在暗色主题下**恒为 0，无论 alpha 是多少**，因为面板正上方（mask 未覆盖的区域）是页面底 `#151517`，而面板背后（mask 覆盖后）是 `rgba(0,0,0,.5)` 压过的 `#151517 + 气泡`。**两者本来就是不同的东西，相关自然是 0。**

正确的相关要把**面板内部**和**面板位置上如果没面板会是什么**（`*_bgref`：同一位置、同一个 mask、`display:none` 的面板）逐像素比。重测（`_adv/_an11.cjs`、`_adv/_an12.cjs`）：

| 场景 | alpha | 面板内 vs **面板位置真背景** 逐像素相关 r |
|---|---|---|
| `_an11`（气泡不在面板下半段） | 85 → 40 | 全部 **≈0.0000**（因为该区域背景是纯色，没有可比的相位）|
| `_an12`（**严格对齐真机**：气泡铺满面板下半段） | 85 | **0.016** |
| 同上 | 70 | **0.069** |
| 同上 | 55 | **0.133** |
| 同上 | 45 | **0.164** |
| 同上 | 40 | **0.177** |
| 同上 | 30 | **0.220** |

## D0.6 而且"面板内平均亮度"也救不了这个指标：它主要在测"面板变暗了"

同一次重测里，"面板内 vs 现状"的平均差是：

| alpha | 平均差 | 最大差 |
|---|---|---|
| 85 | 5.30 | 6 |
| 70 | 9.54 | 11 |
| 55 | 14.02 | 16 |
| 45 | 16.47 | 19 |
| 40 | 18.29 | 21 |
| 30 | 21.56 | 25 |

看起来"用 20 当判据，40% 就过线了"。**但这 18.29 里绝大部分不是"透出来的内容"，是"面板整体变暗了"**：alpha 从 100% 降到 40%，面板均色从 `rgb(46,46,49)` 降到 `rgb(29,29,30)`，降了 17 级。**用户看到的"变化"会是"对话框变黑了"，不是"玻璃"。** 这是这一轮最重要的发现，见 D3。

## D1 真机结构的唯一可判定量化：`r_max = 0.177`

不论 alpha 取多少，**逐像素相关 r 的上限由背景的调制深度决定**：

- 背景 `#151517` 与气泡 `#232324` 的 albedo 差，经 mask α=0.502 后，Y 差 ≈ **0.01**。
- 面板不透明度取到极限 0（纯玻璃），面板内亮度差也只有 0.01 → 相对亮度 45 的面板，只有 **0.4 级 8bit**。
- 实测 r 在 alpha=30（即面板只盖 30%）时到 **0.220**，alpha=85 时 0.016。这条曲线的斜率非常缓：**从 85 降到 30，r 只涨了 0.2。**

**可证伪条件**：如果真机上聊天区的内容不是"深色气泡 + 深色底"，而是有图片、代码块、彩色 diff（对比度远超 0.01），则 r 会显著提高，D3 的结论要重算。我搭的宿主 mock 只有文字气泡，这是 mock 的局限，已写进 D8。

## D2 闸门（按可测判据，不是按感觉）

设三个闸门，每个都写死数值：

| 闸门 | 判据 | 依据 |
|---|---|---|
| **G1 看得出来** | 面板内与面板位置真背景的逐像素 **r ≥ 0.10**，**或** 面板内部存在 ≥3 级的可辨横向结构 | r 是"透没透"的唯一直接证据；45% 时 r=0.164，40% 时 r=0.177，70% 时 0.069 不够 |
| **G2 还是深色对话框** | 面板整体均色 **V ≥ 11%**（sRGB 约 28）且 **色相偏移 ≤ 10%**（不变成蓝紫玻璃）| 现状 `rgb(46,46,49)` V≈19%；第二轮的"彩色玻璃"担心指的是被背景染色，实测各 alpha 下饱和度 3.3%~10.3%，**没有任何一档变成彩色玻璃** |
| **G3 正文可读** | 正文 WCAG **≥ 4.5:1**（AA）| 现状 4.82:1 |

**三档判定**（`_adv/r8/result.json`）：

| 档 | alpha（`color-mix` 百分比）| r | 正文 WCAG | 面板均色 | 判定 |
|---|---|---|---|---|---|
| **"看得出来"上界** | 85% | 0.016 | 5.58 | (41,41,43) | **不合格**（r 太低）|
| | 80% | — | — | — | 不合格 |
| | 75% | — | — | — | 不合格 |
| | **70%** | 0.069 | 6.21 | (38,38,39) | **临界不合格**（r<0.10，但 9.5 级亮度差已可辨）|
| | **65%** | — | — | — | 勉强（r≈0.10~0.13）|
| | **60%** | — | — | — | 勉强（r≈0.13~0.16）|
| **交集** | **55%** | 0.133 | 7.52 | (33,33,35) | **合格** |
| **交集** | **45%** | 0.164 | 8.41 | (30,30,32) | **合格（推荐）** |
| **交集** | **50%** | ≈0.15 | ≈8.0 | ≈(31,31,33) | **合格** |
| "还是深色对话框"下界 | **40%** | 0.177 | 8.75 | (29,29,30) | 合格但开始偏暗 |
| | **30%** | 0.220 | 10.95 | (25,25,28) | **不合格**（V 已降到 10%，面板接近背景，失去"对话框"身份）|

**交集 = alpha ∈ [40%, 60%]，推荐值 45%~50%。**

## D3 但"看得出来"这个判据本身有问题 —— 这一轮最重要的发现

G1 用 r≥0.10 判"透没透"，可 **r=0.164（alpha 45%）在视觉上意味着什么？** 面板内部气泡的相位只剩 **0.164² ≈ 2.7% 的方差**。而同一次 alpha 变化里，**面板整体亮度掉了 16 级**。

把它翻译成用户看到的话：

- alpha 从 100% → 45%：用户**一定**会说"变了"（整体暗了 16 级、边缘出现气泡轮廓）。
- 但这个"变了"里，**"这是玻璃"和"这是一块更黑的半透明块"的比例大约是 1:6**。
- 用户在 `_adv/r8/x3-a55.png`、`x5-a40.png` 里看到的，是"对话框变暗了、边缘能看见气泡的模糊轮廓"——**这正是他三次说"没变化"的反面：他会说"变黑了"**，然后不满意。

**这是方案 B 的结构性上限，不是参数没调好**：真机背景的调制深度只有 0.01 Y，而面板的 alpha 旋钮会立刻把面板均值拉开 16 级。**内容信号与亮度噪声的比值约 1:6，无法通过调参改善。**

> 关于上一封里"亮度代替穿透"的想法，我也测了：`brightness` 1.05 → 1.15 → 1.25 只让面板整体亮 1 级（`color-mix` 到白色只会到 #ffffff，乘 1.25 后 44→55，但 `background-color` 的 alpha 不变，所以混合后只挪 0.35 级）；**它不会提高 r，只提高面板均值**。独立维度的结论：**`brightness` 在这个架构里是无效旋钮**，因为它作用在 backdrop 上，而 backdrop 的调制深度只有 0.01。真正有效的旋钮只有两个：**alpha（提高 r 但拉低整体亮度）** 和 **`blur` 半径（不改变 r 与亮度，只改变"像不像玻璃"）**。

## D4 所以真正该动的是 `blur` 半径：它不改 r、不改亮度，只改"像不像玻璃"

| blur | r | 面板均色 | 正文 WCAG | 视觉 |
|---|---|---|---|---|
| 1px | 0.164 | (30,30,32) | 8.41 | 气泡轮廓**锐利可读** → 看起来像"漏了"，不像玻璃 |
| 6px | 0.164 | (30,30,32) | 8.41 | 轮廓糊成色块 |
| 16px | 0.099* | (31,31,33) | 8.09 | **轮廓只剩明暗，标准的毛玻璃** |
| 20px | — | — | — | 同上，但更平 |

*16px 那一行的 r 略降是因为大半径会把气泡相位从下半段抹到上半段，掩盖了逐像素对齐；**可辨结构仍在**。

**结论：把 blur 从 1px 提到 16px，是唯一"零代价提高玻璃感"的操作。** 它不消耗亮度预算，不动 alpha，不碰 mask，不会把面板变成彩色。

## D5 签字参数组合

```css
body[data-dsh-maid-companions] [data-mc-glass-panel] {
  background-color: color-mix(in srgb, var(--dsw-alias-bg-layer-2) 45%, transparent);
  -webkit-backdrop-filter: blur(16px) saturate(1.2) brightness(1.15);
  backdrop-filter: blur(16px) saturate(1.2) brightness(1.15);
  box-shadow:
    0 20px 60px rgba(0, 0, 0, .5),          /* 保留宿主原有的 elevation */
    inset 0 1px 0 rgba(255, 255, 255, .20), /* 顶缘高光：玻璃的"厚边" */
    inset 0 -1px 0 rgba(255, 255, 255, .07);/* 底缘弱高光 */
}
```

| 参数 | 值 | 为什么是这个值 | 如果用户还说"看不够"怎么办 |
|---|---|---|---|
| `color-mix` | **45%** | 交集 [40,60] 里偏向"能看出来"的一端；70% 时 r 只有 0.069、与现状平均差 9.5 级，正好是用户三次说"没变化"的那一档 | 降到 **35%**（V 20%，面板会明显偏暗）；**不要再往下**，30% 面板均色 V=10% 已和背景分不开了 |
| `blur` | **16px** | 16px 刚好把 14px 字高的气泡糊成"有东西但认不出"，这是"玻璃"和"漏了"的分界 | 提到 24px；再大就没有信息了 |
| `brightness` | **1.15** | 只补 0.35 级，等于没用；**保留它是为了不改用户要求的"和输入框一样"这条约束**（输入框的原参数里就有 brightness）| 别指望它，它不是有效旋钮 |
| 内高光 | **1px / 20%** | 唯一能在"没内容"的区域也产出玻璃感的东西；代价是 1 级，不影响 r | 加到 2px / 28%；超过就是假边框（§C2）|
| 保留 `backdrop-filter` | **是** | 没有它 r 归零、面板纯不透明，退回第三轮的假背景层 | — |

**如果连这个用户还说看不够，下一步只能动这些（按可动性排序）：**

1. **动宿主的 mask**（`--dsw-alias-bg-mask-1` 从 `#00000080` 调到 `#00000040`）。这是**唯一能整体提高背景调制深度**的旋钮——把它减半，r_max 从 0.177 提到 ≈0.30。**代价是改变整个 App 的遮罩观感**，不只是设置窗，且需要覆盖宿主的 token。这是"最有效但最越界"的一步。
2. **给面板加"边缘折射"**（`backdrop-filter` 只能用 box-shadow/渐变压暗边），这是 iOS 液态玻璃里"液态感"的主要来源，与背景亮度无关，**不消耗 D3 的预算**。技术上可用 `mask-image` + 双层伪元素模拟 1~2px 的边缘色散，**不依赖 SVG 滤镜**（第一轮的四根条子走的就是 SVG 滤镜，已判死）。
3. **只在亮色主题启用**（亮色主题面板 `#fff` vs 背景，背景调制深度 0.1525，r 会到 0.6+，那时才真的"透"）。暗色主题走本轮的 45% + 16px。

**禁止再动的东西**：`brightness`（无效）、`saturate`（饱和度实测 3.3%~10.3%，已经接近中性，不需要）、再次回到"面板内 `::before` / 镜像墙 / 四根条子"（§1 D1、§C1 已判死）。

## D6 崩溃点（这张表的边界条件）

| 条件 | 结论 | 依据 |
|---|---|---|
| 面板背后是**纯色**（空对话、单条消息） | **r 恒为 0，无论 alpha**。此时任何方案都只能看到"面板变暗" | `_adv/_an11.cjs`：y560-860 全 0.0000 |
| 面板背后是**深色气泡 + 深色底**（本项目的真实情况） | **r_max = 0.177**，信号的 x² 只占 2.7% | `_adv/_an12.cjs` |
| 面板背后是**图片/代码块/亮色内容** | r 可到 0.5+，**这时候 70% 就够了** | 未测（mock 里没有），已列入 D8 |
| 皮肤插件把面板改成不透明 | alpha 设置被覆盖，方案 B 失效 | 需真机确认，见 D8 |
| `data-dsh-maid-companion-low-power` 为 true | 整个液态玻璃不安装 | §3.3、§B8.4 |
| `prefers-reduced-transparency` | 未处理，面板会一直透 | 建议加媒体查询回落，见 D8 |

## D7 本轮对前三轮的修正

1. **B2"暗色主题下没有可透的画面"→ 判据错误**，正确的是"深色主题下**可透的信号只占面板总变化的 ~15%**"，不是 0。（§D0.5、§D0.6）
2. **C2"alpha 降到 50% 以下会变成彩色玻璃"→ 不成立**，实测各档饱和度 3.3%~10.3%，没有一档变彩色；真正发生的是**面板整体变暗 16 级**。（§D3）
3. **"brightness 是有效旋钮"→ 不成立**，它只动 0.35 级面板均值，不动 r。（§D3）
4. **第二轮的 B9 建议"只在亮色主题启用"仍然成立**，且理由现在更硬：亮色主题的背景调制深度是暗色的 15 倍。

## D8 必须真机回答（第四轮专属）

1. **打开设置窗时，面板背后下半段到底有没有内容？** 真机里设置窗居中、背后是对话区，如果对话刚开、只有 1-2 条消息，则 y 460-860 几乎没有气泡 → **r 会掉到 0.02 以下，45% 也一样"没变化"**。这是本轮结论最大的单点风险。
   → 判定：打开设置窗时截图，看面板下半段背后有没有气泡/图片。
2. **背景里会不会出现图片、代码块、彩色 diff？**（有的话 r 可到 0.5+，70% 就够）
   → 判定：`document.querySelectorAll('img, pre, [class*="code"]')` 在对话区里的数量。
3. **皮肤插件是否覆盖面板 `background-color`**（`!important` 或 inline）？
   → 判定：`getComputedStyle(panel).backgroundColor` 在装/不装皮肤时各取一次。
4. **是否处理 `prefers-reduced-transparency`**？未处理的话，系统开了减弱透明度的用户会看到一块半透明面板。
5. **`backdrop-filter` 的 blur 半径能不能给到 16px 而不掉帧**（真机 GPU；headless 下测不出）。
   → 判定：DevTools Performance 面板，开设置窗时看 FPS 与 `Paint` 时长。

## D9 可复现命令

```powershell
node D:\DSH Workspace\_adv\_gen5.cjs   # r5：10 alpha × 3 brightness 网格
node D:\DSH Workspace\_adv\_gen8.cjs   # r8：严格对齐真机（气泡铺满面板下半段）← 主表来源
node D:\DSH Workspace\_adv\_an7.cjs    # r5 网格统计（含环状度）
node D:\DSH Workspace\_adv\_an8.cjs    # r6 真实宿主对比（含正文 WCAG）
node D:\DSH Workspace\_adv\_an9.cjs    # r7 崩溃点扫描
node D:\DSH Workspace\_adv\_an12.cjs   # r8：r / 振幅 / 正文对比度 / 环状度 / 面板均色（本节的表）
```
