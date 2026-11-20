# 设置面板液态玻璃 · 定稿规格（v0.2.34）

> 这份文档是**最终形态**的单一事实源。以后要改观感，只动这里列出的两个旋钮；
> 结构（单层整块 veil）不要动 —— 它花了两周、六种失败方案才定下来。

---

## 1. 现在的样子（用户验收口径）

- 设置窗（`role=dialog` + `aria-modal`、父级 `role=presentation`）整块是**一片连续的玻璃**：
  内部是均匀磨砂，四周是同一片玻璃被面板形状「折」出来的边缘折射。
- **内部与边缘是同一个元素、同一次滤波**，所以不存在"过渡"——物理上没有两样东西。
- 面板自己的正文、按钮、bili 的 iframe **一个像素都不糊**。
- 与输入框（`[data-composer-card]`）观感同族：同一条 `feDisplacementMap` 通路，只是尺寸不同。

图片证据（rig，真插件源码 + 真 DSH token）：

- 整体：`D:\DSH Workspace\_rim\v29\final.png`
- 右下角 4×（圆弧连续、条纹沿弧弯折、无扇形缝）：`D:\DSH Workspace\_rim\v29\z_br.png`
- 左上角 4×：`D:\DSH Workspace\_rim\v29\z_tl.png`
- 开/关对照：`D:\DSH Workspace\_rim\v29\ab_on.png` / `ab_off.png`

---

## 2. 参数（唯一允许调的两个旋钮）

| 参数 | 位置 | 值 | 作用 |
|---|---|---|---|
| `RIM_BLUR` | `lib/client.js` 常量区 | **1** | 整块面板的模糊半径（px）。1 = 与输入框同档，最清晰那一档 |
| `VEIL_BEZEL` | 常量区 | **32** | 折射带宽度（px）。与对话框 `LIQUID.bezelPx=24` 同量级（面板 620px 高时占 5.2%，对话框 132px 高时占 18%） |
| `RIM_DISP_SCALE` | 常量区 | **0.6875** | 位移放大系数（输入框为 1）。峰值位移 = `0.8 × 32 × 0.6875 ≈ 17.6px` = 0.55×带宽 |
| 缓动 `ease` | `buildMap` 第 7 参 | **`"lin"`** | smoothstep（两端斜率归零）。输入框/菜单不传（= `m²`），行为逐字节不变 |
| 面板底色 alpha | `applyTo()` 面积分流里的内联 `backgroundColor` | **35%** | 面板不透明度（"灰不灰"的主旋钮） |
| `VEIL_SATURATE` | 常量区 | **1.06** | 略提饱和，抵消中性灰的压色 |
| `VEIL_BRIGHTNESS` | 常量区 | **1.0** | 面板**不提亮**（输入框是 1.05，但 +5% 摊到 800×800 就是一层雾） |

两者是一对：**想更清晰 → 降 `RIM_BLUR`，同时升 alpha；想更雾 → 反之。**
只调一个会得到两种坏结果之一（"只是透明、没玻璃感" 或 "整块糊成毛玻璃"）。

其它常量（一般不要动）：

| 常量 | 值 | 说明 |
|---|---|---|
| `LIQUID.strength` | 0.8 | 位移强度，峰值位移 = strength × bezelPx |
| `LIQUID.bezelPx` | 24 | 折射带宽度；越大越"厚"、越夸张 |
| `LIQUID.saturate` / `brightness` | 1 / 1.05 | 与输入框一致，别单独改 |
| `RIM_DISP_SCALE` | 1.6 | 面板比输入框大一个量级，等比放大峰值位移 |
| `MAP_MAX_EDGE` | 256 | 位移贴图降采样上限（性能） |

**历史参数**（供回退参考）：

| 版本 | 结构 | blur | 底色 | 用户评价 |
|---|---|---|---|---|
| v0.2.25~27 | 四根条子（角部有扇形缝） | 3~4px | 42% | "四周不错，里面割裂" |
| v0.2.28 | 单层 veil | 4px | 42% | "一致性很高，但有点太模糊" |
| v0.2.29 | 单层 veil | 2px | 55% | "不错不错，就是有点过于灰" |
| v0.2.30 | 单层 veil | 2px | 40% | 同上 |
| v0.2.31 | 单层 veil | 2px | 35% | 「四周折射一般般 / 有点过糊」 |
| v0.2.32 | 单层 veil | 1px | 35% | 带 36px / 位移 2.4×（**折返 → 底部镜像**，已废） |
| v0.2.33 | 单层 veil + ramp | 1px | 35% | 带 52px / 位移 0.875×（**带太宽、内缘有折线**，已废） |
| **v0.2.34** | **单层 veil + smoothstep** | **1px** | **35%** | **当前**（带 32px / 位移 0.6875×） |

---

## 3. 结构（为什么必须是"一整块"）

```
.overlay[role=presentation]        ← 宿主，position:fixed; inset:0
├─ .mask[aria-hidden]              ← 宿主自己的暗遮罩（backdrop-filter: var(--dsw-mask-blur)）
├─ div[data-mc-glass-veil]         ← ★ 我们插的玻璃层（宿主相对绝对定位，铺满面板）
└─ div.panel[role=dialog]          ← 宿主面板：底色 55% 半透明（JS 内联）
   ├─ nav
   └─ .content > (.header + .options)
```

三个不变量，破一个就翻车：

1. **veil 必须是面板的兄弟，且 DOM 顺序在面板之前**（= 画在面板下面）。
   - 在面板**内部**：backdrop 采到的是面板自己的底色，糊平色=无效（v0.2.24）。
   - 在面板**之后**：会盖住正文并把它糊掉。
2. **整块一个元素、一张位移贴图**。SDF 在整个圆角矩形内连续，边和角才是同一个场。
   - 拆成四根条子（v0.2.25~27）：每根各算一套 SDF → **角上必然出现扇形接缝**。
3. **veil 用 `position:absolute` + 相对宿主坐标**，不能用 `fixed`。
   - `fixed` 会被祖先的 transform/filter 劫持成"相对那个祖先"，面板缩放淡入时整体错位（实测 top 差 208px）。

---

## 4. 已证伪的做法（不要再试）

| 做法 | 结果 | 原因 |
|---|---|---|
| 面板内部贴玻璃条 | 完全看不见 | backdrop 只能采到面板自己的底色 |
| `mask-image` 打洞只留边框 | 整个 backdrop-filter 失效 | mask 裁的是元素自身绘制，把模糊结果一起裁掉 |
| 镜像墙（面板外翻一层再折射） | 被 `overflow:hidden` 全裁 + 本身是不动点 | 均匀色位移后仍是均匀色 |
| 面板内部装饰色斑（假背景） | 像"假边框" | 装饰层画在 backdrop 结果之上，不属于"背后" |
| 面板本体挂 `backdrop-filter` | bili 设置页整屏发糊（翻车 3 次） | 跨源 iframe 是独立合成层，整块 backdrop 每帧重算 |
| `inset:` 简写定位伪元素 | 伪元素完全不绘制 | 必须写 top/left/right/bottom 四条长属性 |
| `color-mix(bg-base N%)` 做底色 | 全透明 | 页面级面板上 `--dsw-alias-bg-base` 已被置 transparent |

---

## 5. 验证方法（改完必须跑）

```powershell
# 1) 语法 + 模板字符串 + 常量检查
cd "D:\DSH Workspace\_lg5"; node check.cjs

# 2) 顶层 const 定义顺序（TDZ）
node tdz-check.js "D:\dsh-src\maid-companions\lib\client.js"

# 3) 渲染（真插件源码 + 真 token）
cd "D:\DSH Workspace\_rim\v24"; node run.cjs        # 截图
node composer.cjs                                    # 输入框回归：必须仍只有自己的 url(#…-0) blur(1px)

# 4) 参数扫描 / 开对照
cd "D:\DSH Workspace\_rim\v29"; node sweep.cjs       # 改 blur/alpha 各出一张
node abveil.cjs                                      # 开/关 veil，量化每边贡献
```

**通过判据**：

- DOM：`data-mc-glass-veil` = 1，`data-mc-glass-rim-bar` = 0，`data-mc-glass-bed` = 0。
- 沿面板内一条横线扫亮度：≥8 级的跳变**只能出现在文字笔画处**，不得有几何接缝。
- 四条边 24px 带的 `mean|Δ|` ≥ 10（当前实测 11.5 / 11.6 / 20.9 / 13.3）。
- 输入框 `backdrop-filter` 仍为 `url(#…-0) blur(1px) saturate(1) brightness(1.05)`。

---

## 6. 硬约束（用户明确要求）

- **不许改对话框/输入框的代码**（`[data-composer-card]` 那条规则一个字都不能动）。
- **不许让 bili 设置页整屏发糊**（所以面板本体永远不挂 backdrop-filter）。
- 面板内正文/分割线必须始终锐利（veil 在面板之下，天然满足）。
- CSS Module 哈希（`AnXs9G_*`、旧版 `VOzbGW_*`）每版构建都会变，**不许写进选择器**；
  只用 `role` / `aria-*` / 结构关系定位。

---

## 7. 版本与回退

| 版本 | 状态 | 备份 |
|---|---|---|
| **0.2.34** | **当前**：单层 veil + smoothstep + blur 1 + 带 32 + 位移 0.6875× | `GOOD-20261102-2340-v0.2.34-narrow-band` |
| 0.2.33 | 上一版：带 52 + ramp（内缘有折线） | `GOOD-20261030-0005-v0.2.33-no-mirror` |
| 0.2.32 | 上一版：带 36 + 位移 2.4×（底部会镜像） | `GOOD-20261029-2305-v0.2.32-rim-bolder` |
| 0.2.31 | 上一版：blur 2 / 带 24 / 位移 1.6× / 底色 35% | `GOOD-20261027-0055-v0.2.31-airy35` |
| 0.2.30 | 上一版：底色 40% | `GOOD-20261027-0115-v0.2.30-airy` |

备份目录 `D:\dsh-src\maid-companions-backups` 保留**两份**（当前 + 上一版，约 1MB/份）。
用户 2026-10-27 曾要求「备份新版即删旧版」，后改为滚动两份：体积可忽略，回退成本≈0。
回退靠"改两个数字"，不靠备份：

- 回到 v0.2.31 观感（折射弱、更糊）：`RIM_BLUR 1 → 2`、`VEIL_BEZEL 36 → 24`、`RIM_DISP_SCALE 2.4 → 1.6`。
- 想**更强**的折射（不镜像）：加宽 `VEIL_BEZEL`（32 → 44），`RIM_DISP_SCALE` 同比保持 0.6875；
  或单独把 `K/bezel` 提到 0.6（`RIM_DISP_SCALE 0.6875 → 0.75`），但**不要超过 0.667**。
  一旦让 `0.8 × RIM_DISP_SCALE` 超过 **0.667**（即 `RIM_DISP_SCALE > 0.833`），采样深度就会非单调 —— 画面被翻转。
  这就是 v0.2.32 的 2.4× 为什么会出现「底部字反过来」。
- 回到 v0.2.30 观感：面板 alpha `35% → 40%`。
- 回到 v0.2.29 观感：面板 alpha `→ 55%`，`VEIL_BRIGHTNESS 1.0 → 1.05`，`VEIL_SATURATE 1.06 → 1.0`。
- 回到 v0.2.28 观感：再叠加 `RIM_BLUR 2 → 4`、alpha `→ 42%`。

回退一步：

```powershell
$src = "D:\dsh-src\maid-companions"
$bk  = "D:\dsh-src\maid-companions-backups\GOOD-20261027-0030-v0.2.28-single-veil"
Copy-Item -LiteralPath "$bk\client.js"    -Destination "$src\lib\client.js"  -Force
Copy-Item -LiteralPath "$bk\package.json" -Destination "$src\package.json"   -Force
# 回滚后必须重新算哈希确认（Copy-Item 曾经静默失败过）
(Get-FileHash "$src\lib\client.js" -Algorithm SHA256).Hash.Substring(0,16)
# 当前版 v0.2.31：89427C49AD103A23
```

⚠️ 插件客户端 JS **只在 DSH 启动时加载**，改完必须重启桌面程序才生效。

---

## 8. 装机契约（改包名/换目录时才需要看）

四处身份必须同时一致：

1. `package.json` 的 `name`
2. `cordis.patch.yml` 的 `name`
3. `lib/client.js` 的 `const PLUGIN_ID` 与模块 `id:`
4. `lib/index.js` 的 `export const name`

两个 profile 三处一致：

1. `package.json` 的 `dependencies` 键
2. `package.json` 的 `dsh.profile.bundles`
3. `node_modules/<name>` 的 junction 指向 `D:\dsh-src\maid-companions`

profile 路径：`D:\DeepSeek-Harness\dsh\profiles\{web,desktop}`。

## 折射为什么不能「折返」（v0.2.33 的物理依据）

位移场是 `amp(s) = K · m(s)`，`s` = 到边缘的深度。实际采样深度

    sampleDepth(s) = s + amp(s)

**只要 `d(sampleDepth)/ds ≤ 0`，画面就被翻转**（即用户看到的「字反过来」）。两种缓动的最大斜率：

| 缓动 | max\|dm/ds\| | 折返门限 | 备注 |
|---|---|---|---|
| `m²`（输入框/菜单） | ≈ 1.9 / bezel | `K/bezel > 0.52` | 输入框背后是柔和聊天区，折叠看不出来 |
| `ramp`（设置面板） | 1.0 / bezel | `K/bezel > 1.0` | 线性锥面，只要 K < bezel 就永远不折返 |

因为 `K = strength × bezel × kScale = 0.8 × bezel × kScale`：

- 想不折返 ⇒ `kScale < 0.833`（ramp）
- v0.2.32 的 `kScale = 2.4` ⇒ `K/bezel = 1.92` ⇒ **必然翻转**，且 v0.2.32 的 `m²` 让它在带中间就翻过去，所以底部那一整条都成了「倒影」。

实测（`D:\DSH Workspace\_rim\v33_field.cjs`，bezel 56 / 面板 800×620）：

| 参数 | 采样深度 0→24px 段 | 单调 | 视觉 |
|---|---|---|---|
| kScale 2.4 / bezel 36 | 69 → 28 | ✗ | 整条带是倒影（v0.2.32） |
| kScale 0.75 / bezel 56（m²） | 33.6 → 37.6 → 35.8 | ✗ | 仍有局部折返 |
| **ramp 0.7 / bezel 52（当前）** | 单调递增 | ✓ | 单向压缩 ≈3.3 倍，只有「拉长/压扁」 |

**纪律：面板的折射强度只能靠「加宽带宽」提升，不能靠「加大位移倍数」。**

## 折射带的「宽度」与「突兀感」是两件事（v0.2.34）

用户原话（m09346）：「设置的四周的折射带太大了，看起来有点突兀」—— 这里有**两个**独立成因：

| 成因 | 表现 | 修法 |
|---|---|---|
| 带宽过大 | 先看到「一圈厚边」，再看才看出折射 | `VEIL_BEZEL 52 → 32` |
| 缓动内缘有折线 | 带子内侧一条看不见的硬线，像贴了边框 | 缓动 `ramp → "lin"`（smoothstep，两端斜率归零） |

`ramp`（线性锥面）在 `s = bezel` 处一阶导数从 0.3 突降到 0，几何上就是一条折痕；
`smoothstep` 在两端导数都是 0，带内外连续。**所以「带窄」和「过渡软」必须同时做。**

三档缓动的取舍（`buildMap` 第 7 参）：

| `ease` | 最大斜率 | 张返门限 `K/bezel` | 两端过渡 | 适用 |
|---|---|---|---|---|
| 不传（`m²`） | ≈1.9/bezel | 0.52 | 平滑 | 输入框 / 菜单 / 气泡 |
| `"lin"` | 1.5/bezel | 0.667 | 平滑 | **设置面板（当前）** |
| `"ramp"` | 1.0/bezel | 1.0 | **内缘有折线** | 已弃用，仅作对照 |
