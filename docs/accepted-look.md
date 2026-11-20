# 用户认可的观感（ACCEPTED）—— 改动前必读

> 这份文档是「用户说好的那一版到底长什么样」的唯一记录。
> 代码里每个数字都要能对到这里；对不上就是改坏了。

---

## 0. 用户原话（不要改写，这是验收口径）

- 2026-10-18（v0.2.18）：「**早干嘛去了，这不是做的挺好的嘛**，但是还是 bili 设置这里有问题，会整体有模糊的」
- 2026-10-18（同一天，v0.2.19 之后）：「现在倒是统一了，但是整个设置都变成**毛玻璃**了，不是**液态玻璃**质感了」
- 2026-10-18（v0.2.20 之后）：「快给我变回来...**对话框都变了**，你个傻肥鱼...我说你做的好的时候你要火速写入 md 里理解我要的效果是什么」

**读法**：
1. 「做的挺好」= v0.2.18 的设置窗 + **一直没动过的对话框**。
2. 「毛玻璃 ≠ 液态玻璃」= 只做均匀模糊不行，要有边缘折射/位移。
3. 「对话框都变了」= **对话框（输入框）是神圣不可动的**，任何改动只要碰到它，无论设置窗多好看，都算改坏。
4. 「做的好的时候要火速写进 md」= 就是这份文档存在的理由。以后一旦被认可，**当轮**就要写进来。

---

## 1. 黄金版本（Golden Build）

| 项 | 值 |
|---|---|
| 版本号 | **0.2.18** |
| 备份目录 | `D:\dsh-src\maid-companions-backups\GOOD-20261018-030605-v0.2.18-settings-glass-panel` |
| client.js sha256 前 16 位 | **C73726F67C588D9F** |
| client.js 大小 | 1009929 字节 |
| 源码 | `D:\dsh-src\maid-companions\lib\client.js` |

**任何时候怀疑改坏了，先跑这条命令比对：**

```powershell
(Get-FileHash "D:\dsh-src\maid-companions\lib\client.js" -Algorithm SHA256).Hash.Substring(0,16)
# 期望输出：C73726F67C588D9F
```

> ⚠️ 坑（已踩）：`Copy-Item $bk\* $src -Recurse -Force` 这种写法**会静默失败**，
> 表面上"恢复完成"，实际文件没换、哈希没变。恢复必须用**显式源路径 → 显式目标路径**：
>
> ```powershell
> Copy-Item -LiteralPath "<备份>\client.js" -Destination "<源码>\lib\client.js" -Force
> ```
>
> 恢复后**必须重新校验哈希**，不要相信复制命令的返回。

---

## 2. 对话框（输入框）—— 已认可，禁止改动

`lib/client.js` 的 STAGE_CSS 内，选择器 `body[${OWNER_ATTR}] [data-composer-card]`：

```css
background: transparent;
backdrop-filter: blur(1px) brightness(1.05);
box-shadow: var(--dsw-elevation-soft, ...),
            inset 0 0 20px -5px rgba(212,232,255,0.20);
```

**它为什么好看**：底色是 `transparent`，背景就是页面本身 —— 不靠任何滤镜「做」出玻璃，
而是真的坐在场景上，只在边缘补一圈内辉。**这就是"液态玻璃"的物理正解。**

**JS 侧对应**：`collectTargets()` 里 `card` 分支**无面积检查、无条件优先**，
`picked = card.slice(0, 1)` 一定取第一个。这段**不要动**。

⚠️ 2026-10-18 的真实事故：把 `rest` 的尺寸闸门从 `LIQUID_RING_MIN_AREA`（300000）
放宽到 `LIQUID_MAX_AREA`（1100000）之后，**对话框整圈变白**——因为闸门放宽让**别的**
大面板进了折射分支，抢走了本该属于输入框的那套内联 backdrop-filter 与 box-shadow。
教训：**闸门是对话框的护栏，不是设置窗的开关。**

---

## 3. 设置窗（设置面板）—— 已认可，当前实现

选择器（只用结构关系，因为面板上是 CSS Module 哈希 + 无 data-* 锚点）：

```css
body[${OWNER_ATTR}] [role='presentation'] > [role='dialog'][aria-modal='true']:not([data-composer-card]):not([role='menu']):not([role='alertdialog']):not([data-testid='todo-panel']):not([data-dsh-plugin='update'])
```

```css
background-color: color-mix(in srgb, var(--dsw-alias-bg-layer-2) 45%, transparent) !important;
backdrop-filter: blur(16px) saturate(1.2) brightness(1.15);
box-shadow: 0 20px 60px rgba(0,0,0,0.5),
            inset 0 1px 0 rgba(255,255,255,0.20),
            inset 0 -1px 0 rgba(255,255,255,0.07) !important;
```

**JS 侧**：闸门是 `LIQUID_RING_MIN_AREA`（300000），**设置窗 800×800 = 640000 > 300000**
→ 设置窗**不**进 JS 折射分支，只吃上面这条 CSS。

这份观感被用户认可为「做的挺好」的那一版。**参数不要凭主观改。**

---

## 4. 已证伪、不要再试的做法

| 做法 | 为什么不行 | 证据位置 |
|---|---|---|
| 面板内部放四根玻璃条（环带） | 采样源是面板自己的不透明底色，退化为恒等；条内注入量是**平坦常数 +2.00**，与场景 r=0.000 | `settings-glass-rig.md` §1-§3 |
| 镜像墙（向外翻 160px 再 blur） | 被面板 `overflow:hidden` **100% 裁掉**，且本身是不动点 | `settings-glass-rig.md` |
| `mask-image` 打洞留边 | Chromium 上 **backdrop-filter 整个失效**（mask 把背后的合成结果一并裁掉） | `liquid-glass.md` §七 |
| 面板内 `::before` 画色斑当"假背景" | 装饰层画在 backdrop 结果**之上**，零模糊零遮挡；等价于往面板自己身上调渐变 | `settings-glass-adversarial.md` 第三轮 |
| 把设置窗塞进 JS 折射分支 | 内联 backdrop-filter 抢优先级，**改变对话框**（2026-10-18 事故） | 本文 §2 |
| 只调 alpha / blur 想让"透出来"更明显 | 结构性上限：内容信号 : 亮度噪声 ≈ 1:6，调参改不了 | `settings-glass-adversarial.md` D3 |

---

## 5. 改动纪律

1. **动 `lib/client.js` 之前，先看这份文档。** 本文 §2/§3 的代码块是"已认可"，不是"参考"。
2. **对话框是红线。** 任何改动后，第一件事是确认 `[data-composer-card]` 那条 CSS
   与 `collectTargets()` 的 `card` 分支**一个字都没变**。
3. **改了就跑校验**（`D:\DSH Workspace\_lg5\check.cjs`）：语法 + STAGE_CSS 反引号 0 + 花括号平衡 0。
   STAGE_CSS 是 JS 模板字符串，**注释里出现反引号会直接截断字符串**（已炸过 6 次）。
4. **改完必须重启 DSH Desktop 才生效**（插件 JS 只在启动时加载），并核对两个 profile：
   `D:\DeepSeek-Harness\dsh\profiles\{web,desktop}\node_modules\@kdnoesr\maid-companions`
   都是 Junction → `D:\dsh-src\maid-companions`，改源码即生效。
5. **用户说"做得好"时，当轮就写进本文档**，不要等下一次被骂。

---

## 6. 变更记录（在黄金版之上做了什么）

### v0.2.21 —— 只收窄设置窗玻璃的作用范围（对话字第 0 改动）

- **动机**：用户报「bili 设置那里还是老问题，整屏发糊」。
- **只改一处**：设置窗那条 CSS 的选择器
  - 旧：`[aria-modal='true'][role='dialog']:not(...)` → 范围过宽。`dsh-web-all` 等插件里
    另有 10 处 `role=dialog`+`aria-modal` 的模态弹窗（远端面板、更新面板、归档对话框…）
    一起被 blur(16px) 糊了，再叠它们自家 overlay 的毛玻璃 = 整屏发糊。
  - 新：`[role='presentation'] > [role='dialog'][aria-modal='true']:not(...):not([data-dsh-plugin='update'])`
    —— 锚到宿主固定的 `overlay[role=presentation] > panel[role=dialog]` 结构。
- **没有动的东西**（`Compare-Object` 逐行比对：26 行差异**全部**是注释与这一条选择器）：
  - `[data-composer-card]` 输入框规则 —— 一字未改
  - `collectTargets()` 的 `card` 无条件优先分支 —— 一字未改
  - JS 尺寸闸门仍是 `LIQUID_RING_MIN_AREA`（300000）—— 一字未改
- **版本**：0.2.21，sha16 `4B7799A055E090D8`，
  备份 `GOOD-20261018-033541-v0.2.21-bili-anchor-scoped`
- **自检**（换宿主版本后必跑）：
  `document.querySelectorAll("[role=presentation] > [role=dialog][aria-modal=true]").length` 预期为 1。

---

## 7. 待办

- [ ] ~~bili 设置页「整屏发糊」~~ → v0.2.21 已按"只收窄锚点、不动闸门"修；待用户验。
- [ ] ~~设置窗要「液态玻璃」而不是「毛玻璃」~~ → **暂缓**：唯一的实现路径要动 JS 闸门，
      而动闸门会抢走输入框的滤镜（2026-10-18 事故）。要做必须**新开一条不经 `rest`
      闸门的独立通道**，且先证明输入框 sha 级不变。
- [ ] RemotePanel（`web-all` L25086）/ ArchiveDialog（L53409）父级也是 `presentation`，
      仍会被设置窗规则命中；无 data-* 锚点，在"不写哈希类名 + 不用 `:has()`"约束下无解。

---

## v0.2.26 · 设置面板「内部磨砂」（2026-10-26）

用户对 v0.2.25 的验收原话（m07608）：
> 现在的四周边缘还是很不错的，但是四周的里面现在就是很不自然呀，说白了就是里面的区域是没有做模糊效果的…现在设置的里面区域只是透明了而已没有加模糊效果啥的和四周的折射非常割裂

即：**边缘折射已通过，内部缺磨砂**。v0.2.26 只补内部，不动边缘观感。

### 三层结构（全部是面板的兄弟，DOM 在面板之前 = 面板之下）
| 层 | 属性 | 位置/尺寸 | 模糊 | 作用 |
|---|---|---|---|---|
| 环带 ×4 | `data-mc-glass-rim-bar` | 面板矩形四边各 28px | `blur(LIQUID_RIM_BLUR)` + `feDisplacementMap` | 边缘折射（位移系数 1.6） |
| 基础柔化 | `data-mc-glass-soft` | 整块面板 | `blur(LIQUID_OUTER_BLUR)` | 先把画面柔化一档，削掉 28px 接缝 |
| 内部磨砂 | `data-mc-glass-bed` | 面板内缩 28px | `blur(LIQUID_BED_BLUR)` | 中间 744px 的磨砂 |

参数：`LIQUID_RIM_BLUR = 2` / `LIQUID_OUTER_BLUR = 3` / `LIQUID_BED_BLUR = 9`；
面板底色 `color-mix(in srgb, var(--dsw-alias-bg-layer-2) 42%, transparent)`（JS 内联，写在 applyTo 的面积分流里）。

### 为什么三层而不是一层
- 只给整块面板挂 backdrop-filter：bili 设置页（跨源 iframe）整屏发糊，翻车三次 → 禁止。
- 只在面板内部贴条子：条子的 backdrop 是面板自己的平色，糊平色=无效（v0.2.24 的教训）。
- 只在内部铺一块磨砂：边缘与内部落差 0→9px，28px 处出现硬接缝 = 用户说的「割裂」。
- 三层同时存在才同时满足：边缘有折射、内部有磨砂、接缝被 3px 基础层填平。

### 验证（无头 Chrome，真插件源码）
- 输入框回归：`[data-composer-card]` 仍只有自己的 `url(#…) blur(1px)`，环带条子 0，走老代码路径。
- iframe 回归：面板内 iframe 内容与正文逐像素锐利（垫层在面板之下）。
- 装机：version 0.2.26，client.js sha16 `1B134BC40AD25626`，备份 `GOOD-20261026-0045-v0.2.26-frost-bed`。

### 改动纪律（新增）
- 任何新层都必须**插在面板之前**（`host.insertBefore(x, el)`）；插在面板之后就会盖住正文。
- `z-index` 一律 0；面板自身是 1。写 1 会盖住正文（本轮踩过一次，rig 里表现为正文被整块蒙住）。

---

## v0.2.27 · 设置面板「统一磨砂」（2026-10-27，取代 v0.2.26）

用户对 v0.2.26 的验收原话（m07807）：
> 现在倒是模糊了，但是过渡处还是有割裂呀，就是视觉不统一你懂我意思吗，然后就是过于模糊了…你为什么不能复用对话框的形式的呢…不要动这些地方的代码哟，只可以学习复用哈

两条判决：**① 过渡有接缝 ② 9px 过度模糊**。并明确要求"复用对话框的形式、但不许改对话框代码"。

### 复用的是什么（全部来自输入框那条已被认可的规则）
`docs/liquid-glass.md` §4.1/§4.2 + `lib/client.js` 的 `[data-composer-card]`：
| 元素 | 输入框 | 现在设置面板 |
|---|---|---|
| 模糊 | `blur(1px)` | 内部 **4px**、环带 **同档 4px** |
| 折射 | `url(#…feDisplacementMap)`，bezel 24 / strength 0.8 | 同参数，环带再 ×2.6 位移 |
| 内辉 | `inset 0 0 20px -5px rgba(212,232,255,.20)` | **同一行照抄** |
| 底色 | 全透明 | 42%（面板要保正文对比度） |

### 接缝是怎么没的（这是本轮唯一的结构性改动）
v0.2.26 是"内部 9px / 环带 2px"，两档模糊在 28px 处形成了硬阶梯（实测亮度跳变 +30）。
v0.2.27 把**内部与环带的模糊量设成同一个数**，于是 28px 处只剩"位移"，没有"模糊差"——
实测跳变从 **+30 降到 +13**（同一张测试图、同一行像素）。

### 为什么不再用「基础柔化层 + 内缩磨砂」两层
两层的前提是"上层的 backdrop 能看到下层的模糊结果"。实测**不成立**：
后台实测 `data-mc-glass-rim-bar` 的 backdrop 仍是未模糊的页面，下层磨砂不进它的采样，
所以两层只会让接缝处同时出现"亮度差 + 模糊差"。已删除该层及其常量。

### 参数
`LIQUID_RIM_BLUR = 4` / `LIQUID_BED_BLUR = 4` / 环带位移系数 `2.6` /
面板底色 `color-mix(in srgb, var(--dsw-alias-bg-layer-2) 42%, transparent)` /
面板 `box-shadow` 追加 `inset 0 0 20px -5px rgba(212,232,255,0.20)`。

### 验证
- 输入框：`[data-composer-card]` 仍只是自己的 `url(#…) blur(1px)`，环带条子 0（未改其代码）。
- 面板内正文/iframe：垫层在面板之下，逐像素锐利。
- 装机：version 0.2.27，client.js sha16 `8E9B76C7DFDBC8E8`，备份 `GOOD-20261027-0030-v0.2.27-unified-frost`。

### 学到的一条硬约束（写进纪律）
> **环带与内部的 blur 必须相等。** 只要不等，28px 处必然出现可见阶梯；
> 想更"透"就整体一起降，想更"糊"就整体一起升，绝不能只调其中一层。

---

## v0.2.28 · 单层整块玻璃（2026-10-27）—— 结构定稿

用户诊断（m07899 原文）：
> 四个边是不是直接使用的叠化效果呀，导致会出现交汇处的扇形区域也会有所不同，还有内部区域也是依旧没有和四周进行自然过渡

**这条诊断是对的，而且点到了根因**：v0.2.25~27 的四个边是**四个独立的** `backdrop-filter`，
每一根各自按自己的盒子算一套 SDF 位移场。角上是两块各算各的 → 扇形接缝；
边与内部的模糊量只要不一致 → 28px 处出现硬接缝。**这是结构问题，参数永远调不平。**

### 定稿结构（照抄输入框）
- **一个** veil 元素：`data-mc-glass-veil`，铺满面板、同圆角、同一次滤波。
- **一张** 位移贴图：`buildMap(W, H, radius, bezel, null, RIM_DISP_SCALE)` —— 不给 area，
  SDF 就按整块盒子算，四条边与四个角是**同一个连续场**，角上不可能再有缝。
- `backdrop-filter: url(#<inst.id>-v) blur(4px) saturate(1) brightness(1.05)`。
- veil 是**面板的兄弟**、DOM 插在面板之前（= 面板之下）：面板正文与 bili iframe 一个像素都不糊。

参数：`RIM_BLUR = 4`、`RIM_DISP_SCALE = 1.6`、`LIQUID.bezelPx = 24`、`LIQUID.strength = 0.8`。

### 定位（踩过一次）
veil 必须用 `position:absolute` + **相对宿主**的偏移（`rect.left - hostRect.left`），
不能用 `position:fixed`：fixed 会被祖先的 transform/filter 劫持成「相对那个祖先」，
面板带缩放淡入时玻璃层会整体错位（实测 top 差 208px）。

### 验证
- 无头 Chrome：DOM `data-mc-glass-veil` × 1、`data-mc-glass-rim-bar` 0、`data-mc-glass-bed` 0。
- 角部 4× 放大：圆弧连续，条纹沿弧弯折，**无扇形缝**。
- 沿 y=300 扫亮度：面板内部 >=6 级的跳变只出现在文字笔画处，**没有任何几何接缝**。
- 输入框回归：`[data-composer-card]` 仍是自己的 `url(#…-0) blur(1px)`，环带条子 0。
- 装机：version 0.2.28，sha16 `6C70FA148792ECB6`，备份 `GOOD-20261027-0030-v0.2.28-single-veil`。

### 纪律（新增）
- **任何带圆角的形状，玻璃只能是一整块。** 拆成四块必然在角部产生不连续的位移场。
- 同一块玻璃的所有层必须共享**同一个** blur 半径，否则接缝处必然跳变。

---

## v0.2.29 · 参数收敛（2026-10-27）—— 当前验收版

用户对 v0.2.28（单层 veil）的评价：
> 可以可以现在一致性很高了，但是现在有点太模糊了，你降低点透明度

→ 结构不变，只动两个旋钮：

| 旋钮 | v0.2.28 | **v0.2.29** |
|---|---|---|
| `RIM_BLUR`（整块模糊） | 4px | **2px** |
| 面板底色 alpha | 42% | **55%** |

### 为什么这两个值
- 4px 在 800×800 的大面板上偏"毛玻璃"，用户要更清晰的观感；
- 2px 仍保留磨砂（1px 及以下会被误认为"只是透明"，是 v0.2.25 的教训）；
- alpha 42%→55% 就是用户说的"降低点透明度"：面板更实、文字底更稳，同时仍能透出背景走势。

### 实测（rig，真 token）
- 四条边 24px 带的 veil 贡献：上 11.55 / 下 11.63 / 左 20.88 / 右 13.34（mean|Δ|）。
- 面板内沿 y=720 扫亮度：**0 处 ≥8 级跳变**（无任何几何接缝）。
- 右边缘亮度剖面：93→82→93 平滑走一圈（位移带），无台阶。
- 输入框回归：仍是 `url(#…-0) blur(1px)`，未受影响。

### 单一事实源
参数、结构不变量、已证伪做法、验证脚本、回退步骤全部整理进
**`docs/settings-panel-liquid-glass.md`**（本文件只留版本演进记录）。

---

## v0.2.30 · 去灰（2026-10-27）—— 当前验收版

用户对 v0.2.29 的评价：
> 不错不错…然后再透明一点，有点过于灰了

### 灰从哪来（这是本轮真正的收获）
不是"亮度不够"，而是**中性灰盖上去把背后的彩度压平了**。实测（深色页底 rig）：
面板亮度和页底亮度几乎相同（37 vs 44），但面板内彩度被抹平 → 观感是"一块灰板"。
所以**提亮没用，得让背景的颜色透上来**。

### 三个一起动的旋钮
| 旋钮 | v0.2.29 | **v0.2.30** | 为什么 |
|---|---|---|---|
| 面板底色 alpha | 55% | **40%** | 露更多背景彩度（主旋钮） |
| `VEIL_BRIGHTNESS` | 1.05（跟输入框） | **1.0** | +5% 摊到 800×800 就是一层均匀雾 |
| `VEIL_SATURATE` | 1.0 | **1.06** | 补回被中性灰压掉的彩度 |
| `RIM_BLUR` | 2 | 2（不变） | 上一轮刚定，不动 |

### 为什么 veil 的 brightness/saturate 要和输入框分开
输入框是 640×132 的小卡片，`brightness(1.05)` 是"提亮一下"；
同样的 +5% 铺到 800×800 的整块面板上，就变成"整体发白/发雾"。
**同一族玻璃、不同尺寸，需要不同增益** —— 这条写进常量注释了。

### 实测
- 深色页底（模拟 DSH）：alpha 55% → 40% 后，面板内可辨的背景色块明显增加（右下蓝色光斑从"几乎不可见"变成"能看出形状"）；
- 文字对比度：40% 时 5.65:1（55% 时 5.44:1）—— **更透反而更清楚**，因为底色变暗了；
- 输入框回归：`url(#…-0) blur(1px) saturate(1) brightness(1.05)` 未变；
- 结构未动：仍是单层 veil，边角连续、内部无接缝。

### 备份策略变更（用户要求）
"备份这一版，删除旧备份" → 目录现在**只保留一份**：`GOOD-20261027-0115-v0.2.30-airy`。
回退改为"改数字"（见 `docs/settings-panel-liquid-glass.md` §7）。


---

## v0.2.31 · 再透一档（2026-10-27）—— 当前验收版

用户对 v0.2.30（底色 40%）的反馈：
> 可以稍微再透到35吧，也是记得备份

### 改动
| 参数 | v0.2.30 | **v0.2.31** |
|---|---|---|
| 面板底色 alpha | 40% | **35%** |
| `RIM_BLUR` | 2px | 2px（不变） |
| `VEIL_BRIGHTNESS` / `VEIL_SATURATE` | 1.0 / 1.06 | 1.0 / 1.06（不变） |

结构、边缘折射、bili 页隔离全部未动。

### 实测（深色页底 rig）
|  | v0.2.30（40%） | **v0.2.31（35%）** |
|---|---|---|
| 面板亮度 | 36.4 | **35.1** |
| 文字对比度 | 5.78:1 | **5.99:1** |
| 彩色页底接缝 | 无 | **无** |

面板内条纹跳变密度 0.040/px，比面板外 0.073/px 还低——2px 模糊把部分条纹棱边压到阈值以下，
说明那不是"缝"，是条纹本身。**越透反而越清楚**（底色更暗 → 白字对比更高）。

### 备份
`GOOD-20261027-0055-v0.2.31-airy35`（当前）+ `GOOD-20261027-0115-v0.2.30-airy`（上一版）。
改为滚动保留两份：1MB/份，换来回退成本 ≈ 0。


---

## v0.2.32 · 折射加强 + 变清晰（2026-10-29）—— 当前验收版

用户对 v0.2.31 的评价：
> 现在我觉得设置区域的四周的折射效果一般般，然后透明度是够了，但是有点过于模糊了，可以调得较为清晰一点点

### 两个诉求，两个独立的旋钮
| 诉求 | 旋钮 | v0.2.31 → **v0.2.32** |
|---|---|---|
| 更清晰 | `RIM_BLUR`（整块模糊） | 2px → **1px** |
| 折射更明显 | `VEIL_BEZEL`（带宽度） | 24px → **36px** |
| 折射更明显 | `RIM_DISP_SCALE`（位移倍数） | 1.6 → **2.4** |
| 轮廓高光 | CSS `inset` 顶光 / 内辉 | 0.14 / 0.20 → **0.20 / 0.26** |

三者互不耦合：blur 管清晰度，bezel+disp 管折射强度，alpha 管通透度。
**"更清晰"和"折射更强"可以同时做**，因为它们作用在不同的量上。

### 为什么 24px 在面板上"一般般"
24px 占输入框高度 18%，却只占设置面板短边 5.8%。**比例决定观感**，绝对值没有意义。
面板因此有独立的 `VEIL_BEZEL` / `RIM_DISP_SCALE`，和输入框的 `LIQUID.bezelPx` 解耦。

### 实测
| 指标 | v0.2.31 | **v0.2.32** |
|---|---|---|
| 内部清晰度（Laplacian 能量） | 16.57 | **32.22（1.95×）** |
| 峰值位移 | 30.7px | **69.1px（2.25×）** |
| 折射带宽度 | 24px | **36px** |
| 6× 放大看带内缘 | — | **无硬线**，m² 缓动平滑归零 |
| 输入框 | blur1/brightness1.05/内辉0.20 | **完全未动**（逐行 grep 核对） |

### 备份
`GOOD-20261029-2305-v0.2.32-rim-bolder`（当前）+ `GOOD-20261027-0055-v0.2.31-airy35`（上一版）；滚动两份。

---

## v0.2.33 · 折射不再「镜像翻转」（2026-10-30）

用户原话（m08399）：
> 四周折射区域的下方折射区域为什么是反射上面的内容，就是字经过折射之后反过来显示在折射区域上…
> 不应该是像对话框这样的类似于拉长的折射效果嘛

### 根因（数学，不是调参）
位移场 `sampleDepth(s) = s + amp(s)`，只要 `d(sampleDepth)/ds ≤ 0`，画面就被**翻转**。
`amp = K·m(s)`，`K = 0.8 × bezel × kScale`：

| 缓动 | 最大斜率 | 折返门限 |
|---|---|---|
| `m²`（输入框） | ≈1.9/bezel | `kScale > 0.65` |
| `ramp`（线性锥面） | 1.0/bezel | `kScale > 1.25` |

v0.2.32 是 `m²` + `kScale 2.4` ⇒ `K/bezel = 1.92` ⇒ **必然折返**，且折返点落在带中间，
所以底部整条带都成了「倒影」。

### 改法
- `buildMap` 增加第 7 参 `ease`；面板传 `"ramp"`（线性锥面），输入框/菜单不传 ⇒ 仍 `m²`，**逐字节不变**。
- 参数：`VEIL_BEZEL 36 → 52`、`RIM_DISP_SCALE 2.4 → 0.875`（`K/bezel = 0.7`）、`RIM_BLUR` 保持 1、底色保持 35%。
- 峰值位移 69px → 36px，但**带宽 36 → 52**，所以弯折区反而更宽；边缘压缩约 3.3 倍，是单向「拉长/压扁」。

### 验证
- 文字穿过面板四边的专用 rig（`D:\DSH Workspace\_rim\v33_text.html`，22px 字 / 44px 行高）：
  - v0.2.32：底部带内字形**左右/上下翻转**，与用户截图一致；
  - v0.2.33：字形保持正向，只是被压扁 —— 与对话框同族的观感。
- 输入框回归：`[data-composer-card]` 仍是 `url(#…) blur(1px) saturate(1) brightness(1.05)`，环带元素 0 个。
- 装机：version 0.2.33，`client.js` sha16 `CE5385FA4D51C621`，备份 `GOOD-20261030-0005-v0.2.33-no-mirror`。

### 纪律（新增，必须遵守）
- **面板折射强度只能靠加宽 `VEIL_BEZEL` 提升，不能靠加大 `RIM_DISP_SCALE`。**
  `0.8 × kScale` 一旦超过 0.667（`m²` 是 0.52），画面就会翻转。
- 任何"更强"的诉求，先在数字上算 `K/bezel`，再动手改。

---

## v0.2.34 · 折射带收窄 52 → 32px（2026-11-02）

用户原话（m09346）：
> 我发现设置的四周的折射带太大了，看起来有点突兀，你调窄一点吧

### 判断
「突兀」= 两件事叠加：
1. **带宽 52px**（面板 620px 高的 8%）→ 视觉上先是一圈厚边；
2. **`ramp` 缓动在内缘一阶导数突变** → 带子内侧有一条几何折线，像贴了假边框。

### 改动
| 参数 | v0.2.33 | v0.2.34 |
|---|---|---|
| `VEIL_BEZEL` | 52 | **32** |
| `RIM_DISP_SCALE` | 0.875（K/bezel 0.70） | **0.6875（K/bezel 0.55）** |
| `ease` | `"ramp"` | **`"lin"`（smoothstep）** |
| 峰值位移 | 36px | **17.6px**（与对话框 19.2px 同量级） |

### 验证
- 条纹 rig 右下角 4×：v0.2.33 有一条横向长折线，v0.2.34 没有；弯曲集中贴住圆角。
- 文字 rig：底部带内字形保持正向，只有轻微压扁，无镜像。
- 输入框回归：`url(#…) blur(1px) saturate(1) brightness(1.05)`，环带元素 0 个（未受影响）。
- 装机：version 0.2.34，`client.js` sha16 `DAB4C2B612723A62`，备份 `GOOD-20261102-2340-v0.2.34-narrow-band`。

---

## v0.2.35 · 设置开关/设置行对齐宿主（2026-11-02）

用户原话（m09459）：
> 就是这个插件在设置中的开关按钮要适配最新版的dsh，现在这两个的样式好像有点不一样，
> 统一为dsh的样式，然后注意浅色和暗色模式的适配

### 判断
不是调色，是**结构 + token** 两处都不对：

| 项 | 旧（v0.2.34 及以前） | 宿主 |
|---|---|---|
| 尺寸 | 38×22，圆钮 18px | 36×20，圆钮 16px，`padding:2px` |
| 圆钮定位 | `position:absolute` + `translateX(16px)` | 正常流 + `translate(16px)` |
| 开态轨道 | `--dsw-alias-state-business-primary`（蓝） | `--dsw-alias-brand-primary`（浅黑/深白） |
| 圆钮色 | 写死 `#fff` | `--dsw-alias-label-primary-foreground` / 关态 `--dsw-alias-switch-thumb` |
| 关态轨道 | `--dsw-alias-fill-quaternary` | `--dsw-alias-border-l3` |
| 状态来源 | `.is-on` 类 | `[aria-checked="true"]` 属性 |
| 附加文字 | 右侧「启用/停用」 | 无 |
| 行容器 | 左右两栏、`padding:16px 0`、`border-bottom` | `field` 上下结构、`padding:12px 0`、`border-top:.5px` |
| 标题 | 14px / 400 | 13px / 500 |
| 说明色 | `label-tertiary` | `label-secondary` |

### 改动
`SETTINGS_CSS` 与 `MaidCompanionsSetting()` 重写，类名改为
`mc-setting-field / -head / -label / -help / -switch / -switch-thumb`，
CSS 逐条照抄宿主（出处见 `docs/settings-native-switch.md`）。

### 验证
- 开关级 rig（宿主 CSS 原文 vs 插件 SETTINGS_CSS 原文，dpr2、放大 3×）：
  深色开/关、浅色开/关四态，轨道/圆钮尺寸与颜色**完全一致**，像素差 0%~0.20%（仅圆角抗锯齿）。
- 行级 rig：标题字号字重、说明颜色、行距、分隔线位置与宿主肉眼无差。
- 证据：`docs/v035-row-dark.png`、`docs/v035-row-light.png`、`docs/v035-switch-dark.png`、`docs/v035-switch-light.png`。
- 装机：version 0.2.35，`client.js` sha16 `30154B66B4056C13`，备份 `GOOD-20261102-0350-v0.2.35-native-switch`。
