# 液态玻璃 v0.5.0 定稿记录 · 2026-11-13

> 接续 `docs/adaptation-20261113-liquid-glass-v2.md`（v0.4.3 之前的过程/根因）。
> 本文件只记 v0.4.4 → v0.5.0 的**参数决策、修复项与验收数据**。
> 代码：`D:/dsh-src/maid-companions/lib/client.js`，`MC_VER = "0.5.0"`（渲染器 `globalThis.__mcVer` 可查）。
> 宿主：DSH Desktop 0.2.2-rc.1。热重载：改 client.js 后 0.5–1s 自动生效；不生效就 touch package.json。
> **不要重启 DSH Desktop**（会杀掉正在跑的会话）。

---

## 1. 一句话结论

把"边缘位移 + 内部模糊"从两套数值合成一套语言：**内芯用 2.9px 模糊、边缘位移压到 7px 级**，
并删掉那条造成"两块玻璃对缝"观感的 1px 顶部白线；所有浮层走同一套结构锚点，不再依赖哈希类名。

---

## 2. 引擎最终参数（`MAT`，client.js 约 L1101）

| 档 | 使用者 | blurPx | saturate | brightness | bezel | 位移上限 D |
|---|---|---|---|---|---|---|
| composer（**冻结**） | `[data-composer-card]` | 1 | 1.00 | 1.05 | 24 | 10 |
| glass（浮层） | 菜单/listbox/tooltip/小 popover | 2 (+浅色 0.8) | 1.08 | 1.05 | 14~16 | 7 |
| panel（页面级面板） | 设置窗/大对话框（走兄弟 veil） | 2.9 (+浅色 1.0) | 1.08 | 1.05 | 14~16 | 7 |

- 位移贴图：`buildMap(w,h,r,bezel,area,kScale,'quad2',dTarget)`，`scale = min(rawScale, dTarget*max(w,h)/256)`
  —— 这一条钳制是"小面板不再出现荒诞位移"的关键（旧公式 d ∝ bezel/max(w,h)，260×320 菜单会算出 51px）。
- 底色：浮层 `--mc-tint` 30%（浅色 66%）；面板 `MAT.panelTint` 31%；面板内实体卡片 74%（浅色 92%）。
- 装帧：`0 0 0 .5px --mc-hairline(白 .10) + 浮层/面板投影 + inset 0 1px 0 --mc-topline(.04) + inset 0 0 Npx -Xpx 冷白内辉`。
  设置窗单独用 `--mc-glow-panel-*`（16px / -7px / .10）。
- 遮罩：安装 veil 时把同层 `aria-hidden` 遮罩从 `rgba(0,0,0,.5)` 调到 `.22`（浅色 `.10`）—— 遮罩太黑会把折射信号砍半。

---

## 3. v0.4.4 → v0.5.0 修了什么

| 版本 | 修复/改动 | 为什么 |
|---|---|---|
| 0.4.4 | 装帧选择器只认"表面根"并排除根的后代（`:not(:is(根 *) )`） | 旧 `[role='menu']` 命中模型弹层内层滚动容器 → 圆角玻璃里画了个方形 0.5px 发丝+外阴影（用户点名的"正方形怪框"） |
| 0.4.4 | `[data-menu-material]` 进 LIQUID_SELECTOR；菜单背板 tint 泛化到所有 `data-menu-material` | 模型弹层 root 是 `div[role=group][data-menu-material]`，之前完全没被接管 |
| 0.4.6 | 主题自适应：MutationObserver 监听 `data-ds-dark-theme` → 浅色 blur +0.8/+1.0、tint 抬到 66%/84% | 浅色下低 alpha 玻璃在纯白底上等于隐形 |
| 0.4.7 | 面板 blur 1.8 / tint 34%，面板内辉独立变量 | a02 定量：带/内 0.46、内/外 0.95 → 连续性首次 PASS |
| 0.4.8 | 卡片材质 `[data-mc-card]`（结构判据，不用类名） | 设置窗里的"账号余额"卡是不透明深块，与玻璃面板割裂 |
| 0.4.9 | **删掉设置窗 `inset 0 1px 0` 顶部白线**；内辉改读 `--mc-glow-panel-*`（此前被高特异性规则压死从未生效） | a03/a04 双证：这条 1px 白 +2~3px 暗缝 = 用户说的"上面一条细线"、g_edge 28.7→13.9 L/px |
| 0.4.9 | 内层 `[role='menu']`（在 `data-menu-material` 里）box-shadow/背景清空 | 方框残余的最后一半 |
| 0.4.9 | 合并 a08 控件材质 §1–§10（hover 用 background-image 叠色、发送键品牌色、focus 硬编码 #7aaaff） | 玻璃面内控件不能再叠 filter；改 background-color 会擦掉实底 |
| 0.5.0 | **修 newSession 选择器误伤**：`button[aria-keyshortcuts='Control+N']:not(:has([data-slot='sidebar.brand.mark']))` | 旧选择器同时命中 `button.wtg9ga_brand`(264×24) → 侧栏顶部一条比底色亮 +10 的悬浮暗条 |
| 0.5.0 | newSession 暗色改 layer-3 48% / 发丝 .22 / 顶高光 .11 / 内辉 18px -6px .34；浅色改 52% 白 + 深发丝 rgba(15,20,30,.13) + 冷灰内辉 | 浅色 72% 白 + 白内辉在纯白侧栏上 idle/hover 只差 1.1/255（等于没有 hover） |
| 0.5.0 | 设置行对齐"当前运行宿主"：label 14px/400/lh20、padding 16px 0、border-bottom | 插件设置页原来按 asar 里 `_field_bjqpo`(13/500、padding12、border-top) 写，但 rc.1 实渲染是 `uYSObG_row` 族 |

---

## 4. 验收数据（深色，真机 PrintWindow 2560×1390）

**设置窗**（DOM 624,156 800×800 → 物理 rect 789,204,1788,1203，grid cell 14）
- panel: `background color(srgb .1725 .1725 .1804 / .31)`、`backdrop-filter none`、
  `box-shadow = 白.1 0 0 0 .5px + 黑.45 0 20px 60px + rgba(212,232,255,.1) 0 0 16px -7px inset`（顶线已消失）
- veil: `url(#…-3-v) blur(2.9px) saturate(1.08) brightness(1.05)`，rect 与 panel 逐像素一致（无错位）
- measure2：顶 out/band/int = 15.73/12.75/11.49（带·内 0.81、内·外 0.73）；左 31.17/15.15/14.33（0.49/0.46）；
  底 0.84/1.19；glow 峰 12.19（composer 基准 11.9，1.02 倍）⇒ **连续性 PASS**

**模型选择弹层**（`div[role=group][data-menu-material]` 240×360 @1331,677）
- root: 0.5px 白 .1 发丝 + 黑 .28 8/24 投影；material 子层 tint 26% + `url(#…) blur(2px) saturate(1.08) brightness(1.05)`
- 内层 `[role='menu']._9r0rkG_groups`: `box-shadow none`、`background transparent` ⇒ 方形怪框消失（2× 截图确认）

**账号菜单**（144×110 @12,944）：root 发丝+投影，material 层 tint 30% + `url(#…-8) blur(2px)`，
菜单项 34px 高、hover 叠白 8%。

**新会话按钮**（256×38 @12,92）：`color(srgb .2078 .2118 .2196 / .48)` + 渐变 .06/.015 + 白 .22 发丝；
品牌条已恢复 `bg rgba(0,0,0,0)`、`shadow none`。

**受控背景观察**：`window.__lg27.pattern({kind:'grid',cell:14})` 下，设置窗边缘 24px 带内网格可见弯折、内部成雾且字形锐利
—— 这是"折射区与模糊区连续"的直接证据（人工 4× 判读 + measure2 数值双证）。

### 4.1 最终回归（a04-seamline，v0.5.0 原子会话）

| 判据 | 设置窗 | composer 基准 | 结论 |
|---|---|---|---|
| 顶边 glow（B=40，设备 px） | **−5.93**（负=无亮线） | +12.79 | PASS |
| 左边 glow / g_edge | +1.79 / 8.07 L·px⁻¹ | — / 6.50 | PASS |
| 底/右 glow | 0 / 0 | — | PASS |
| 顶边剖面 o=−4…+28 | 23.1 ‖ 35.1 36.1 35.9 35.1 34.8 … 平台 33.0 | 单调 | PASS（无 local max、无暗缝） |
| 面板透射率（grid12） | 0.162–0.173（≈28%） | 0.575–0.58（100%） | 面板更"实"，属 tint 31%+blur 2.9 的预期量级 |

修复前同一位置是 `28.1 | 51.1 [79.8] 69.0 68.0`（尖峰 → 暗缝 → 内辉），即用户看到的"两块玻璃对缝"。
g_edge 6.54 与 composer 6.50 几乎相同 —— 这是"面板边缘与输入框边缘同一种过渡"的量化证据。

---

## 5. 浅色主题（部分验收）

- 已实拍：浅色设置窗（panel `color(srgb 1 1 1 / .84)`、veil blur 2.8px）、浅色账号菜单（material 白 66% + blur 2.8px）、
  浅色 newSession（按钮 216.1 vs 侧栏 221.7，靠深发丝立边界，可辨）。
- 浅色面板剖面（a04 实测）：本来就**没有** topline，是黑发丝 0.5px + 内辉，剖面单调 bump −1.0
  ⇒ 用户报告的细线是**深色专属**问题，v2 文档里「浅色收益 8.5×」的推理由此作废。
- ⚠️ **运行时切主题不稳定**：宿主会在若干秒后把 `data-ds-dark-theme` 按自身配置改回去，
  所以截图窗口很窄、且偶发"浅色变量 + 深色页面"混态。**完整的浅色验收需要重启 Desktop 用浅色配置启动**，
  本轮未做（重启会杀会话）。浅色分支全部走 token，代码层面无硬编码深色值。

---

## 6. 回滚

| 备份 | 位置 | 说明 |
|---|---|---|
| 本轮前原始态 | `D:/dsh-src/maid-companions-backups/LG27-PRE-20261112162145` | 上一轮结束 |
| v0.3.0 / v0.4.0 / v0.4.2 / v0.4.3 | `.../LG27-CHECKPOINT-v0xx-20261113` | 见 v2 文档 |
| v0.4.5 | `.../LG27-CHECKPOINT-v045-20261113` | SHA256 AA652FB7… |
| **v0.5.0（本次定稿）** | `.../LG27-CHECKPOINT-v050-20261113` | 交付版（已剥离调试注入） |

回滚 = 覆盖 `lib/client.js` + `package.json` + `cordis.patch.yml`，再 touch package.json 触发重载。

---

## 7. 仍未做 / 已知风险

1. **浅色主题完整真机验收**（需重启 Desktop）——见 §5。
2. **a07 列的少数表面**（引用预览父卡片、alertdialog/权限弹窗、tooltip、子智能体树 popover）
   靠结构锚点自动接管，但没有全部逐个真机开过；漏的表面排查手法：`globalThis.__mcDebug()` 看 found/wanted/mounted。
3. 宿主升级会换构建、改 DOM 结构：引擎已全部改用 `role/aria-*/data-*`，但**新表面若没有任何结构属性会漏**。
4. composer（输入框）参数全程冻结未动；任何"让输入框更玻璃"的改动都被禁止（用户明令）。

---

## 8. 交付状态（2026-11-13 02:19 最终复核）

- **交付文件**：`lib/client.js`，长度 1,044,205 字符（1,095,339 字节 UTF-8），
  SHA256 `2CD7183A08D33B801D1D9124035F42EDC22369489CC04256B4F38B8B3711D6DE`，
  `MC_VER = "0.5.0"`，`package.json version = 0.3.0`。
- **调试注入已剥离**：`LG27-HARNESS` / `window.__lg27` 均不存在（grep 只剩 base64 立绘里一处巧合的 "LG27" 字串）。
  保留的只有 `globalThis.__mcVer`（版本戳）与 `globalThis.__mcDebug`（表面探测，供以后排查）。
- **剥离后复核**：`node --check` 退出码 0；touch package.json 后 HMR 重挂，
  截图 `_lg27/shots/v050-shipped.png` 确认侧栏品牌条干净、新会话按钮玻璃、用户气泡玻璃、输入框不变。
- **剥离前最后一轮真机状态**（同一份逻辑，仅多了 harness）：
  - 设置窗：panel `rect 624,156,800,800` / `bg color(srgb .1725 .1725 .1804 / .31)` / `bf none` / `r 28`；
    veil 同 rect、`bf url(#…-2-v) blur(2.9px) saturate(1.08) brightness(1.05)`；
    shadow = `白 .10 0 0 0 .5px, 黑 .45 0 20 60, 冷白 .10 0 0 16`（无 topline ⇒ 细线已消失）。
    `shots/v050-final-set.png` / `v050-final-set-crop.png` / `v050-final-set-edge4x.png`。
  - 模型选择弹层：root `mc=true`、内层 `[role=menu]` `box-shadow none / bg transparent` ⇒ 方形怪框确认消失；
    `shots/v049-picker.png` / `v050-picker-3x.png`。
  - 账号菜单：material `bg … / 0.26` + `bf url(#…-4) blur(2px)`，菜单项 34px；
    `shots/v050-final-menu.png` / `v050-final-menu-4x.png`。
- **备份（权威回滚点）**：`D:/dsh-src/maid-companions-backups/LG27-CHECKPOINT-v050-20261113`
  （client.js 与交付版字节一致，SHA256 见该目录 SHA256.txt）。
  回滚 = 把该目录三个文件覆盖回 `D:/dsh-src/maid-companions/`，再 touch package.json 触发重载（**勿重启 Desktop**）。
- **截图归档**：`docs/img-lg2/`（v050-overview.png、v050-overview-full.png、v050-sidebar-newbtn-3x.png、
  v044-modelpopup.png、v044-model-2x.png、v046-light-settings.png 等）。
