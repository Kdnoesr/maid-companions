# 设置窗玻璃 · 第三轮取证：BackdropRoot / 方案 B 可行性 / 真机 DevTools

> 取证者：dom-probe（子代理）｜日期：2026-10-18
> 承接 `settings-glass-dom-forensics.md`（第一轮 DOM 结构取证）与 `settings-glass-rig.md`（rig-verifier 真机结构复现）。
> **本轮不修改任何产品代码**，只做只读取证 + 独立实验。
> 全部产物在 `D:\DSH Workspace\_lg5\rig\`。

---

## 0. 三个问题，三个答案（先给结论）

| 问题 | 答案 | 最强证据 |
|---|---|---|
| 外层 `.VOzbGW_mask` 自带的 `backdrop-filter` 会不会把面板的采样源截成 mask 的合成结果，让方案 B 退化？ | **不会。方案 B 可行。** mask 的 2px 被面板自身的 14px 完全淹没 | (a) 与 (b) 面板内**最大像素差 = 1**（纯 ±1 量化噪声） |
| 真机能不能开 DevTools？ | **能。按 F12**，不需要重启、不需要加启动参数 | `asar-main.js` L12793 `accelerator: "F12"` |
| 用户的自检脚本能用吗？ | 能。`probe-settings.js`，单行 JSON 输出 | 在复刻真机结构的 fixture 上跑通 |

---

## 1. 核心实验：(a)(b)(c) 三组数字

### 1.1 实验设计

页面 `rig\br3\backdroproot3.html`，严格照 Lead 给的结构：

```
body（彩色背景：96px conic 4 色方格 + 2 个 radial 色团，background-position 13px 7px 避开像素网格）
└── .overlay { position:fixed; inset:0; flex center }
    ├── .mask  { position:absolute; inset:0; background:rgba(0,0,0,0.35);
    │            backdrop-filter:blur(2px) }        ← 变体 (a) 带 / 变体 (b) 去掉
    └── .panel { z-index:1; width:800px; height:600px; overflow:hidden; border-radius:20px;
                 background:rgba(44,44,46,0.86);
                 backdrop-filter:blur(14px) saturate(1.4) }   ← 方案 B
```

- 引擎：Chrome **155.0.8059.82**，`--headless=new`，原生 CDP（Node 24 自带 WebSocket）
- `--force-device-scale-factor=1`
- **三组面板几何完全一致**：`x=191 y=24 w=800 h=600`（脚本内 assert 校验过）
- 测量窗 = 面板内缩 40px（避开圆角与抗锯齿）= **720×520 px**

### 1.2 结果

| 变体 | mean_chroma | hue_bins | laplacian（清晰度） | uniq_colors |
|---|---|---|---|---|
| **(a) mask 带 `backdrop-filter:blur(2px)`** | **16.280** | 10 | 0.6468 | 127 |
| **(b) mask 去掉 backdrop-filter** | **16.348** | 10 | 0.6474 | 128 |
| **(c) 无 mask 层** | **24.859** | 9 | 0.6836 | 305 |

**逐像素对比（面板内部）：**

| 对比 | MAE | %像素>0 | %像素>2 | 峰值差 |
|---|---|---|---|---|
| **(a) vs (b)** | **0.04209** | 12.19% | **0.00%** | **1.0** |
| (a) vs (c) | 5.05184 | 100.00% | 100.00% | 13.0 |
| (b) vs (c) | 5.04317 | 100.00% | 100.00% | 13.0 |

### 1.3 那个 ±1 是噪声，不是信号

对面板内全部 1,122,000 个通道值做直方图：

```
|diff|=0 : 1,075,920 px (95.791%)
|diff|=1 :    47,280 px ( 4.209%)
```

**不存在任何 `|diff| ≥ 2` 的像素。** 12.19% 的像素"不同"，但每一个都只是 ±1 的取整抖动
（两条不同的合成路径在同一位置取整边界不同）。差异有轻微空间结构（行剖面 std / 二项零假设 std = 5.86），
符合"亚像素渲染在两条渲染路径间抖动"，**不是采样源改变**。

### 1.4 为什么 (c) 与 (a)(b) 差那么多？—— 是 mask 的**填充色**，不是 BackdropRoot

| 区间 | chroma 保留 | 亮度保留 |
|---|---|---|
| (c) → (b)：**只加填充色** `rgba(0,0,0,0.35)` | **65.76%** | 89.20% |
| (b) → (a)：**只加 backdrop-filter** | **99.59%** | **100.00%** |

`rgba(0,0,0,0.35)` 的理论通光率是 **65%**，预测 chroma = 24.859 × 0.65 = **16.158**，
实测 **16.348**。吻合。

**去掉填充色之后，mask 的 backdrop-filter 对面板内部的贡献 = 0.0675 chroma / 0.0014 亮度 units，即零。**

---

## 2. 关键判读：「(a)≡(b)」不等于「方案 B 退化」

Lead 给的判据是「(a) 与 (b) 逐像素相同 ⇒ BackdropRoot 存在、方案 B 可能出问题」。
**实测确实相同，但这个推论不能成立**，原因如下。

### 2.1 面板在三个变体里都在**真实采样背景**

面板自身填充是 `rgba(44,44,46,0.86)` —— 86% 不透明。**纯 alpha 混合只能透 14%**。
而 96px 周期的 conic 彩色方格在面板内部**清晰可见**（见 §2.2 三张图），面板内实测 chroma 16–25，
而背景 chroma 远高于 200。**这不是 alpha 混合能做到的，是 backdrop-filter 真实采样。**

### 2.2 视觉证据

![(a) mask 带 backdrop-filter](backdroproot_a_mask_bf.png)
![(b) mask 去掉 backdrop-filter](backdroproot_b_mask_nobf.png)
![(c) 无 mask 层](backdroproot_c_no_mask.png)

(a) 与 (b) 肉眼无法区分；(c) 明显更亮更艳 —— 差异全部来自 mask 的黑色填充。

### 2.3 (a)≡(b) 的真正含义

**mask 的 2px 模糊被面板自身的 14px 模糊完全淹没。**

面板先对 mask 的合成结果做 14px 模糊。一个 2px 的模糊在 14px 的模糊之后**早已不可分辨**。
这与"采样源被截断成无法使用的均匀色"是两回事：采样源**是** mask 的合成结果，但那个合成结果**保留了背景的全部结构**（只是暗了 35%），面板从中采到了充分的信号。

### 2.4 与上一轮 iso2 实验的关系（不矛盾，是不同问题）

上一轮 `rig\iso2\` 证明的是**机制存在**：祖先带 backdrop-filter 会截断子元素的 backdrop 采样源
（清晰度掉 93.6%、Laplacian 11.926 → 0.766）。

但那组的面板是 `backdrop-filter:blur(0px)` + **全透明底** —— 面板自己不模糊，所以祖先的 6px 效果直接暴露。

本轮面板自己 `blur(14px)` + 86% 不透明填充，mask 的 2px 在它**之后**。
**模糊半径更大的一方主导，小的一方无影响。**

> 一般化：BackdropRoot **确实存在**（机制成立），但它是否**有害**取决于子元素自身的静态模糊半径
> 与不透明度。方案 B 的 14px ≫ mask 的 2px，故无害。

### 2.5 补充：真实的 mask 是面板的**兄弟**，不是祖先

第一轮 DOM 取证与 rig-verifier 都确认：`.VOzbGW_mask` 与 `.wCInkW_panel` 是 `.VOzbGW_overlay` 下的**兄弟节点**。
兄弟层的 backdrop-filter **根本不构成 BackdropRoot**（BackdropRoot 只沿祖先链传播）。

我另外用 `rig\sibtest\` 跑了真实兄弟结构对照，结果同样：

| 变体 | MAE | 峰值差 | chroma |
|---|---|---|---|
| 兄弟 mask 带 `blur(2px)` | — | — | 16.369 |
| 兄弟 mask `backdrop-filter:none` | **0.040737** | **1** | 16.432 |

（`rig\sibtest\mask-bf.png` / `mask-nobf.png`，800×600 面板，同样 720×520 测量窗）

**所以无论按祖先还是按兄弟建模，mask 的 backdrop-filter 都不影响方案 B。**

---

## 3. 方案 B 的真正约束（给 Lead 决策用）

BackdropRoot 不是问题，**真正的上限来自面板自身的不透明度**：

- 当前 `rgba(44,44,46,0.86)` = 86% 不透明 → 只有 **14%** 的光能透出背景
- 要让玻璃"看得见"，需要把 alpha 降到 **0.55–0.70** 区间
- 这与 mask 无关，也与 BackdropRoot 无关

这一结论与 rig-verifier 在 `settings-glass-rig.md` §10 独立得到的结论一致
（他们的 V1/V2/V3 三档对照、可读性 12.85–13.06:1、以及"想更透就动 mask 而非面板 alpha"的建议）。

---

## 4. 真机 DevTools：能开，快捷键 F12

### 4.1 结论

**按 F12 即可打开 DevTools（detached 模式）。不需要重启应用，不需要加 `--remote-debugging-port`。**

### 4.2 代码级证据

从 `D:\DeepSeek Harness\resources\app.asar`（182,794,869 B，归档文件）解出 `rig\asar-main.js`（516,716 B）。
`app.asar` 的根 `package.json`：`name=@deepseek-ai/dsh-desktop`、`version=0.2.1-rc.2`、`main=lib/main.js`、`type=module`。

**`rig\asar-main.js` L12787-12794：**
```js
const devToolsItems = [{
  role: "toggleDevTools",
  visible: false
}, {
  role: "toggleDevTools",
  visible: false,
  accelerator: "F12"
}];
```

**L12795-12799：**
```js
const refreshApplicationMenu = () => {
  Menu.setApplicationMenu(Menu.buildFromTemplate(process.platform === "win32" ? devToolsItems : [{
    label: darwin ? app.name : currentDesktopLocale().messages.application,
    submenu: [...applicationItems(), ...devToolsItems]
  }, ...platformMenus()]));
```

→ Windows 上这两个菜单项**就是整个应用菜单**，第二个带 `F12` 加速键（`visible:false` 只隐藏菜单栏显示，加速键照常注册）。

**主窗口 `rig\asar-main.js` L11936-11969** 的 `webPreferences` 含 `devTools: true`：
```js
function createWindow(preload, show = false, primary = false) {
  const window = new BrowserWindow({
    ...
    webPreferences: {
      preload, nodeIntegration: false, contextIsolation: true,
      sandbox: true, webSecurity: true, webviewTag: primary, devTools: true
    }
  });
```

**主窗口没有调用 `setMenu(null)`。** 全文件只有三处清菜单，都不在主窗口：
- L10183 登录窗口
- L9936 强制更新浮层
- L11612 子浮层（`parent` 的 overlay）

主窗口创建在 L12889：`const window = createWindow(appPreload, false, true);` —— 之后没有清菜单。

### 4.3 其他相关事实

- 登录窗口另有独立 F12 处理（L10191-10195）：`contents.openDevTools({ mode: "detach" })`
- 自动开启仅限开发模式：L12955 / L13181 `if (activate && development && process.env.DSH_DESKTOP_OPEN_DEVTOOLS !== "0")`

### 4.4 环境

| 项 | 值 |
|---|---|
| 主进程 PID | 25400，命令行 = `"D:\DeepSeek Harness\DeepSeek Harness.exe"`，**无任何调试参数** |
| 应用版本 | 0.2.1-rc.2 |
| Electron | 44.7.0（`D:\DeepSeek Harness\version` 内容即 `44.7.0`） |
| user-data-dir | `C:\Users\Jimmy\AppData\Roaming\@deepseek-ai/dsh-desktop` |
| CDP 端口 | 9222/9223/9229/9333/9220/9411-9415/9515 **全部无监听** |

> 我的实验用 Chrome 是 155.0.8059.82，与 Electron 44.7 内置的 Chromium **版本不同**。
> BackdropRoot 是 Chromium 的长期稳定行为，但既然 F12 可用，**建议用 §5 的脚本在真机上复核一次**。

---

## 5. 用户自检脚本 `probe-settings.js`

### 5.1 用法

1. 打开 DSH 桌面端，点侧边栏齿轮打开「设置」窗（**保持打开**）
2. 按 **F12** 打开 DevTools（会弹出一个独立窗口）
3. 切到 **Console** 标签页
4. 把 `probe-settings.js` 全文复制粘贴进去，回车
5. 会打印一行以 `[maid-glass-probe]` 开头的 JSON —— 整行复制回来

如果是第一次在这个 Console 里粘贴，Chrome 可能要求先输入 `allow pasting` 并回车（安全机制）。

### 5.2 它打印什么

| 字段 | 含义 |
|---|---|
| `bodyAttrs` | body 上所有 `data-*` 属性（含低功耗降级开关） |
| `bodyHasDataDshMaidCompanions` | `document.body.hasAttribute('data-dsh-maid-companions')` |
| `dialogCount` | 所有 `[role="dialog"]` 数量 |
| `dialogCount_ariaModalStrict` | `[aria-modal="true"][role="dialog"]` 数量 |
| `panels[]` | 每个弹窗的详情 |
| `panels[].background` | `getComputedStyle().backgroundColor` |
| `panels[].overflow` | `overflow` |
| `panels[].isolation` | `isolation`（是否建立隔离层） |
| `panels[].backdropFilter` | 面板自身的 `backdrop-filter` |
| `panels[].position / zIndex / filter / transform / contain / willChange` | 其他建层相关属性 |
| `panels[].ancestors[]` | 祖先链（最多 12 层），每层带 `backdropFilter`/`filter`/`isolation`/`contain` 等 |
| **`panels[].outerMask`** | **最近带 `backdrop-filter` 的祖先**（若存在）及其 bf 值 |
| **`panels[].siblingMasks[]`** | **覆盖面板面积的兄弟层**及其 bf/填充色/z-index —— 这是真实结构里 mask 所在的位置 |
| `panels[].pluginNodes` | `[data-mc-glass-ring]` / `[data-mc-glass-mirror]` / `[data-mc-glass-frame]` / `svg[id^='mc-liquid']` 各自数量 |
| `pluginStyles[]` | 含 `data-mc-glass` 或带 `data-plugin` 的 `<style>` 标签 |
| `theme` | `prefers-color-scheme` / `html[data-theme]` |
| `devicePixelRatio` / `viewport` / `ua` | 环境 |

### 5.3 安全性

**只读。** 不修改 DOM、不写 storage、不发网络请求、不改类名。

### 5.4 验证记录

在 `rig\settings-fixture.html`（复刻第一轮取证到的真实结构：
`.VOzbGW_overlay > .VOzbGW_mask + .wCInkW_panel[role=dialog][aria-modal=true][data-shortcut-modal=settings]`，
并预置 `data-mc-glass-ring` / `data-mc-glass-mirror` / `svg#mc-liquid-a`）上跑通：

```
=== probe executed OK ===
dialogCount: 1
dialogCount_ariaModalStrict: 1
pluginStyleCount: 1
  cls: wCInkW_panel
  role/ariaModal: dialog true
  dataShortcutModal: settings
  rect: {"x":231,"y":2,"w":800,"h":800}
  background: rgb(44, 44, 46)
  overflow: hidden
  isolation: auto
  backdropFilter: none
  outerMask: null
  siblingMasks: [{"cls":"VOzbGW_mask","backdropFilter":"blur(2px)","background":"rgba(0, 0, 0, 0.35)",...}]
  pluginNodes: {"[data-mc-glass-ring]":1,"[data-mc-glass-mirror]":1,"[data-mc-glass-frame]":0,"svg[id^='mc-liquid']":1}
```

单行 JSON 输出长度 **1663 字符**，可直接粘贴回来。

---

## 6. 未验证 / 边界（诚实标注）

1. **只在 headless Chrome 155.0.8059.82 验证**，真机 Electron 44.7.0 内置 Chromium 版本不同；§5 的脚本就是为了补这一环。
2. 实验里的 mask 填充用 `rgba(0,0,0,0.35)`，真实值见 rig-verifier 抽取的 `--dsw-alias-bg-mask-1 = #00000080`（50%）。填充色深浅**不影响** BackdropRoot 结论（只影响 (c)→(b) 的亮度差）。
3. 实验面板 `border-radius:20px`，真机 token 是 `28px`；圆角只影响边界像素，测量区已内缩 40px，不影响结论。
4. 未测**有头模式**（headless 与有头的合成路径理论上可能不同）。但 rig-verifier 的 §10 在有头结构上独立复现了同一结论。
5. §1 的 (a) 变体是"mask 作为 panel 的**祖先**"建模（Lead 原题设定），§2.5 的 sibtest 是"兄弟"建模；两者结论一致，但**真实结构是兄弟**，故 §2.5 更贴近真机。

---

## 7. 复现命令

```powershell
cd "D:\DSH Workspace\_lg5\rig"

# 静态服务（若未启动）
Start-Process python -ArgumentList "-m","http.server","8731" -WorkingDirectory "D:\DSH Workspace\_lg5\rig" -WindowStyle Hidden

# §1 (a)(b)(c) 三组
node run_br3.cjs          # 生成 br3\backdroproot3.html + 三张截图 + struct3.json
python cmp_br3.py         # chroma / hue / laplacian / 逐像素差
python diff_br3.py        # ±1 噪声的直方图证明
python control_br3.py     # 填充色 vs BackdropRoot 的归因分解

# §2.5 兄弟结构对照
node run_sib.cjs          # 生成 sibtest.html + 两张截图

# §5 自检脚本验证
node test_probe.cjs       # 在 settings-fixture.html 上跑 probe-settings.js
```

---

## 8. 给 Lead 的一页话

1. **BackdropRoot 不是方案 B 的障碍。** (a) 与 (b) 面板内最大差 = 1（纯量化噪声），因为我方面板自己 blur(14px)、mask 只有 blur(2px) —— 大半径方主导，小半径方无影响。上一轮 iso2 证明的机制成立，但那个面板是 `blur(0px)`+全透明，条件不同。
2. **(c) 的差异 100% 来自 mask 的黑色填充**（chroma 65.76% 精确吻合 `rgba(0,0,0,0.35)` 的 65% 通光率），跟 BackdropRoot 无关。
3. **真实结构里 mask 是面板的兄弟**，兄弟层的 backdrop-filter 根本不传播 BackdropRoot。兄弟结构对照同样得峰值差 = 1。
4. **方案 B 的真实上限是面板自身的 86% 不透明度**，与 mask 无关。要看得见的玻璃，alpha 得压到 0.55–0.70。这与 rig-verifier §10 独立得到的结论一致。
5. **真机能开 DevTools，按 F12。** 代码证据在 `asar-main.js` L12793（`accelerator: "F12"`）+ L11967（`devTools: true`），且主窗口不清菜单。**console 自检这条路值得保留，不必退回 rig 全权判定。**
6. `probe-settings.js` 已落盘并在复刻真机结构的 fixture 上验证通过，输出单行 JSON（约 1663 字符）。
