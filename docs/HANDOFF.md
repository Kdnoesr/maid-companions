# 交接文档 · 新会话从这里读起

> 最后更新：2026-11-18 · 产物版本 **v0.16.0+**（`MC_VER = "0.16.0"`，package.json 0.6.0）
> 面向：接手「左右鲸鱼娘插件 + 液态玻璃」的新会话。读完这一页即可继续。

---

## 0. 三十秒看懂

| 项 | 值 |
|---|---|
| 源码唯一位置 | `D:\dsh-src\maid-companions` |
| 构建产物 | `lib/client.js`，**1,132,744 B**，sha256 `10F0636E69ACF951DB1A16D88376F3455752420F633850F595D86EEA1806368A` |
| 源码形态 | `src/client/parts/` 14 段 + `manifest.json`（单文件不再膨胀） |
| 安装形态 | `D:\DeepSeek-Harness\dsh\profiles\desktop\node_modules\@kdnoesr\maid-companions` → **junction 指向源码**（web profile 目前没有这个插件） |
| 热重载 | 保存 `lib/client.js` 后 0.5–4s 自动生效；不生效就 touch `package.json`。**禁止重启 Desktop / F5**（会杀掉会话） |
| 代码状态 | 构建、语法、装配一致性、材质契约回归**全绿**；检查器仍有历史遗留告警（见 §7） |
| 视觉状态 | 结构已改完；**最近两次改动（非输入框 1px 回归、右侧轮次预览卡）还没有真机截图验收** |

---

## 1. 这是什么

DSH Desktop 客户端插件 `@kdnoesr/maid-companions`：界面下方左右两位鲸鱼娘女仆立绘，外加一套「液态玻璃」材质系统。

- `lib/client.js`：全部逻辑 + 注入的 CSS（由 14 段拼接生成，不要手改）
- `src/client/parts/`：真正要改的源码（`00-preamble` … `90-dev-harness`）
- `cordis.patch.yml`、`package.json`
- `docs/`：技术文档（见 §9）
- `scripts/`：构建与检查脚本（见 §6）

---

## 2. 立即上手：构建 / 热重载 / 回滚

### 2.1 改完必跑（顺序不能反）

```powershell
cd 'D:/dsh-src/maid-companions'
node scripts/rebuild-parts.mjs          # 写：parts → lib/client.js（同时重算 manifest）
node --check lib/client.js               # 语法
node scripts/assemble-client.mjs --check # 只读校验：字节一致
node 'D:/DSH Workspace/_lg27/check-recipe-regression.cjs'   # 材质契约回归
```

最后一步断言：`MAT.glass` / `MAT.panel` 的 `blurPx / saturate / brightness` 必须与 `LIQUID` 完全相等，且 `LIQUID.blurPx === 1`。
这是「所有非输入框面必须复用输入框材质」的机器化守卫——**改参数前先跑一次确认它是绿的**。

> ⚠️ `rebuild-parts.mjs` 会把 `90-dev-harness.js` 恢复成仓库里的版本。如果要用调试桥，先
> `node 'D:/DSH Workspace/_lg27/bridge/attach-harness.mjs'` 再 rebuild。

### 2.2 生效与回滚

- 生效：HMR 轮询 `lib/client.js` 的 mtime/size，保存即热重载（会 dispose 并重挂插件，UI 闪一下属正常）。
  验证：页面里 `globalThis.__mcVer`。
- 回滚：直接把备份里的 `client.js` 覆盖回 `lib/client.js`，等热重载即可（无需重启）。
- 最近的回滚点（新 → 旧）：
  - `D:/dsh-src/maid-companions-backups/LG27-CHECKPOINT-turn-preview-20261115`（当前产物 + package + yml + 本轮文档）
  - `.../PRE-TURN-PREVIEW-20261115`（打轮次预览补丁之前的 src + lib）
  - `.../PRE-RESTORE-COMPOSER-20261114`（把 blur 从 8/10 改回 1 之前的 src + lib）
  - `.../LG27-CHECKPOINT-v016-20261113`、`…-v015`、`…-v014`、`…-v0100`、`…-v050` 等历代检查点

---

## 3. 当前液态玻璃架构（唯一事实源）

### 3.1 黄金标准：输入框（冻结，不要动）

`[data-composer-card]`：

```
backdrop-filter: url(#dsh-maid-companion-liquid-glass-N) blur(1px) saturate(1) brightness(1.05)
background-color: transparent          /* 玻璃感来自页面本身 + 边缘内辉，不靠滤镜上色 */
border-radius: 28px
bezel: 24px，峰值位移 ≈ 9.95 CSS px
box-shadow: 0 0 0 0.5px rgba(255,255,255,.12), inset 0 0 20px -5px rgba(212,232,255,.20)
```

用户多次原话要求：**所有面都对齐输入框**。历史上任何「面板单独用更大 blur 换可读性」都会被否（8px/10px 那一版就被明确否掉）。

### 3.2 三种面结构（按宿主 DOM 形态选择）

1. **direct（单层）**：元素自身挂 bf。用于输入框、右侧轮次预览卡。
2. **material 族（菜单 / 「+」面板）**：
   - root：`bf:none` + `0 0 0 0.5px var(--mc-hairline)` + 浮影
   - 材质子层 `div[aria-hidden]`：唯一滤镜层，`z-index:-2`，挂 `url(#…) blur(1px) saturate(1) brightness(1.05)`
   - frost 子层：**无 bf**，只输出体色 + mask 羽化，`z-index:-1`
   - 内容在其上
3. **非 material 浮层（气泡 / 确认框 / 团队面板 / 子智能体树 / 引用预览）**：
   - 宿主元素：`bf:none`、`background:transparent`、`isolation` 由 CSS 的 `[data-mc-glass-layered]` 提供
   - 插入并列 `[data-mc-glass-rim]`（挂 bf）与 `[data-mc-frost]`（体色 + 羽化）
   - 若宿主是 `position:static`，必须先写 `position:relative`，否则绝对定位子层会以更远祖先为包含块（曾把气泡层撑成 922×1782）
4. **页面级面板（设置窗）**：dialog 本体 `bf:none !important`，真滤镜在**兄弟 veil** 上（`[data-mc-glass-veil]`），tint 由 frost 层输出。

### 3.3 参数表

| 面 | blur | bezel | 体色（暗 / 浅） | 备注 |
|---|---|---|---|---|
| 输入框（冻结） | 1px | 24 | transparent | 内辉 20/-5/.20 |
| 浮层 / 菜单 / 气泡 | 1px | 17 | `--mc-fill-float`：暗 `#06070b 14%` / 浅 bg-overlay 45% | 材质层内辉 17/-4.25/.20 |
| 设置面板 | 1px | 17 | `--mc-fill-panel`：暗 `#fff 3%` / 浅 68% 白 | 亮环 `--mc-panel-ring`：暗 `rgba(212,232,255,.12)` / 浅 `rgba(20,24,33,.14)` |
| 右侧轮次预览卡 | 1px | 17 | transparent + 20/-5/.20 内辉 | 直接采样，不叠 frost |

关键令牌都在 `src/client/parts/22-css-floating.js` 的 `:root` / 暗色块里；数值入口在 `31-material-constants.js`。

### 3.4 稳定选择器（禁止哈希类名）

| 面 | 用这个 |
|---|---|
| 输入框 | `[data-composer-card]` |
| 设置窗 | `[role='dialog'][aria-modal='true'][data-shortcut-modal='settings']` |
| 菜单族 | `[data-menu-material='translucent']`；「+」面板 `[data-trigger-menu][data-menu-material='translucent']` |
| 用户气泡 | `[data-message-bubble]` |
| 任务面板 | `[data-testid='todo-panel']` |
| 底部面板 | `[data-dsh-bottom-panel='true']` |
| **右侧轮次预览卡** | `[role='tooltip'][style*='--turn-preview-center']`（宿主 inline 自定义属性，稳定；子节点 `[class*='previewPrompt']` / `[class*='previewResponse']`） |

**禁用**：CSS Module 哈希类名（`SNx2jG_preview`、`AnXs9G_panel` 每版都变）、`url(#…-序号)` 里的序号（每次渲染重排）。

---

## 4. 本轮（2026-11-13 ～ 11-18）修了什么

| 版本 | 问题 | 根因 | 处理 |
|---|---|---|---|
| v0.14 | 「四周折射区与内部模糊区割裂」 | 玻璃面同时存在两条 blur 基线（清边 1px / 内芯 12–20px）；且 tint 的 alpha 硬边形成 1–2px 亮阶 | 改为**单层均匀模糊**：一个元素一条 bf；体色交给无 bf 的 frost 层 + mask 羽化 |
| v0.15 | 设置页整体变暗 | 我们自造 scrim 叠在宿主 mask 上；面板底色又是近黑 | scrim 归零、面板底色改令牌；面板亮环 `.12`（与输入框边缘高光同量级） |
| v0.16 | 面板比周围亮/白 | 面板底 7% 白 + 环 .19（1 物理 px 亮线） | 暗色 3% 白、环 .12；浅色 68% 白 + 深色环 |
| 11-14 | **用户否掉 v0.16 的浮层 8px / 面板 10px**：「还不如上一版」「要按照对话框的标准来」 | 上一轮把「可读性」当成理由擅自提高 blur | `MAT.glass` / `MAT.panel` 的 `blurPx` 直接引用 `LIQUID.blurPx`（=1）；保留略窄 bezel 17；大面板 host 明确 `bf:none !important` |
| 11-15 | 最右侧刻度悬停的「本轮摘要」卡仍是宿主实心底 | 该卡是独立组件（TurnNavigatorRail），未进玻璃选择器 | 用 `--turn-preview-center` 定位，按 **direct** 结构挂 1px 玻璃 + 同源内辉，不叠 frost |

### 4.1 必须记住的四个 Chromium 事实

1. **mask 会失效**：带 `backdrop-filter` 的元素，只要祖先有 `overflow:hidden/clip`，它自己的 `mask-image` 会被整体忽略（羽化在 1px 内跳满）。
   ⇒ 羽化只能放在**没有 bf 的层**上。
2. **bf 建 backdrop root**：一个元素有 bf，其后代的 bf **整层空转**。
   ⇒ 永远不要嵌套 bf。
3. **祖先 `blur(0px)` 也是 bf≠none**，同样建 root 并让 veil 失效。
   ⇒ 要清掉就写 `backdrop-filter: none !important`，不要写 `blur(0px)`。
4. **mask 祖先也会杀死后代 bf**（被 mask 的父容器里的 bf 子元素会空转）。

---

## 5. 真机验证方法（没有它就不要说"修好了"）

- DSH Desktop 是 Electron，**窗口被遮挡/最小化时渲染器会停 rAF**，所有页面探针会挂住。
- 截图用 PrintWindow（`PW_RENDERFULLCONTENT`）：`powershell -NoProfile -ExecutionPolicy Bypass -File 'D:/DSH Workspace/_lg27/shot.ps1' <绝对路径.png>`，输出 **2560×1390 物理像素**（CSS 2048×1112，dpr 1.25）。尺寸不对就是抓错窗口，重抓。
- 抓 top-layer（popover/dialog）必须**同一段探针内**完成「打开 → 强制重绘（body opacity 0.999↔1 + getBoundingClientRect）→ 等 ≥1.2s → 截图」，否则会拿到旧帧。
- **禁止在页面 eval 里 await `/shot`**：桥是串行循环，一个 action 挂住全队排队。
- 调试桥：`D:/DSH Workspace/_lg27/bridge/`（`server.mjs` 监听 8791，`lg27.mjs jsf <abs probe.js>`，探针是 async 函数体、必须自己 `return`）。
  当前该桥**未运行**，且上次启动后渲染器没有响应；用之前先确认 `globalThis.__mcVer` 能读到。
- 页面里不要留测试节点/内联变量：`#__pstyle`、`#__dbgcss`、`#__lg27_gridhost`、`#__a04bd` 等，以及 body/html 上的 `--mc-*` 覆盖（曾把 html 背景写成棋盘渐变，污染了整轮测量）。

---

## 6. 检查脚本现状（诚实记录）

| 脚本 | 状态 |
|---|---|
| `rebuild-parts.mjs` / `--check`（assemble） | ✅ 字节一致 |
| `node --check lib/client.js` | ✅ |
| `D:/DSH Workspace/_lg27/check-recipe-regression.cjs` | ✅ PASS |
| `scripts/check-no-area-tint.mjs` | ❌ 仍有 [D] 未作用域化规则 + [F] 硬编码 rgba（历史遗留 `23/24-css-*` 段） |
| `scripts/check-glass-css-comments.mjs` | ❌ 直接抛错：`STAGE_CSS line 914` 选择器里写了中文 `aria-label="添加文件或调用指令"`（换语言即失效） |

这两项不是运行时回归，但属于"下一轮应该收掉"的债（见 §7）。

---

## 7. 已知缺口 / 下一步（按优先级）

1. **真机验收缺失**：最近两次改动（1px 回归、轮次预览卡）只有静态验证；需要用户或下一会话实拍确认。
2. **用户气泡首行被折射带压到墨迹**：带 13.9 CSS > 首行行盒 10.8 CSS，纯几何问题；
   建议 `bezel = clamp(8, 0.45 * 行高, 20)`（会牺牲一点"全站同参数"）。
3. **确认框（480×184）/ 团队 popover** 仍是各自的模糊与底色，没有并入面板族。
4. **底部面板**：宿主内层 `nArs4W_pane` 不透明，会把 rim 盖死，引擎侧无解。
5. **tooltip 内辉档位不一致**：tooltip 用 20/-5，菜单用 17/-4.25，小面上亮环外扩约 3px。
6. **浅色主题**只做过局部切换验证（同 eval 内改 `data-ds-dark-theme`），没有真正以浅色启动 Desktop 验收。
7. **静态检查器两条债**：`23/24` 段 legacy 规则加 `body[owner]` 作用域；中文选择器改稳定属性（`button[aria-haspopup="listbox"]`）。
8. **web profile 没有安装插件**（只有 desktop junction）；若用户要求两个 profile 一致，需要补 junction。

---

## 8. 硬禁令（违反会立刻翻车）

1. 不碰输入框参数（blur/bezel/内辉/圆角）。
2. 不给玻璃面叠加第二条 blur（嵌套 bf 一定空转）。
3. 不给 bf 层打 mask 做羽化。
4. 不用 `blur(0px)` 清滤镜，用 `none`。
5. 不靠哈希类名 / url 序号做选择器。
6. 不重启 Desktop、不按 F5（会话会死）。
7. 不在页面 eval 里做长等待/await 截图。
8. 不用"读图感觉差不多"替代像素剖面；改完必须留可复现命令。

---

## 9. 文档地图

| 文档（`docs/`） | 内容 |
|---|---|
| `HANDOFF.md`（本文） | 交接入口 |
| `liquid-glass-v014.md` | 单层模糊 + mask×bf 根因实验记录 |
| `liquid-glass-v015.md` | 令牌分层、特异性陷阱 |
| `liquid-glass-v016.md` | 面板体色/亮环定档 + 验收数字 |
| `composer-blur-repair-20261114.md` | 8/10px → 1px 回归的修复与范围 |
| `turn-preview-repair-20261115.md` | 右侧轮次预览卡适配 |
| `accepted-look.md` | 版本演进史 + 用户每次原话（改之前先读） |
| `settings-glass-adversarial.md` | 已证伪方案黑名单（环带条/镜像墙/mask 打洞…） |
| `overlay-surfaces.md` | 浮层玻璃分族 |
| `adaptation-20261112-wip.md` | 上一轮 DSH 0.2.2 适配记录 |

---

## 10. 环境坑

- Shell 是 **PowerShell**；heredoc 会吃反斜杠 → 含反斜杠/中文的脚本用 write 工具写文件再执行。
- Node：`D:/Program Files/nodejs/node.exe`（v24）。
- Python（含 Pillow）：`D:/DeepSeek-Harness/dsh/dsh-runtimes/dsh-primary-runtime/dependencies/python/python.exe`。
- 从 `app.asar` 抽宿主源码：`D:/DSH Workspace/_lg27/asar_extract.py`（asar = 16B 头 + JSON 树，条目有 offset/size）。
- 宿主版本：Desktop `0.2.2-rc.1`（打包在 `D:\DeepSeek Harness\resources\app.asar`）；前端哈希每版变化，选择器只能靠结构/aria/data-*。
