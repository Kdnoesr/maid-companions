# 液态玻璃 v0.16.0（对齐输入框 · 单层均匀模糊 · 面板体色/亮环定档）

> 生成：2026-11-13 · 基线 v0.15.0（未提交工作树）· 产物 lib/client.js
> 关键约束：输入框 [data-composer-card] 参数**未改**（blur1 / saturate1 / brightness1.05 / bezel24 / 内辉 0 0 20px -5px rgba(212,232,255,.20) / r28）。

## 1. 本版改了什么（只有 4 个令牌）
文件：`src/client/parts/22-css-floating.js`

| 令牌 | v0.15 | v0.16 | 为什么 |
|---|---|---|---|
| 深色 `--mc-fill-panel` | #fff 7% | **#fff 3%** | 面板内部原先比环境亮 +17~28 L，与输入框「内部≈背景」相反；3% 落到 +5 L 档 |
| 深色 `--mc-panel-ring` | rgba(212,232,255,.19) | **.12** | .19 是 1 物理 px、+19 L 的硬亮线（a02 实测），.12 与输入框发丝同 alpha |
| 浅色 `--mc-panel-ring` | transparent | **rgba(20,24,33,.14)** | 浅色面板原本没有任何轮廓（ring=transparent），白纸上白板 |
| 浅色 `--mc-fill-panel` | 78% 白 | **68% 白** | 78% 时面板 L95.5 贴死白页面 L98，卡片纯白反而看不见 |

其余全部沿用 v0.14/v0.15：**单层均匀模糊**（同一元素一条 backdrop-filter = url(#disp) blur(N) saturate(1) brightness(1.05)），玻璃体色由无 backdrop-filter 的普通层（`[data-mc-frost]`）+ mask 羽化承担，内辉 20/-5/.20 与输入框同档。

## 2. 为什么不再「四周折射区与内部模糊区割裂」
- v0.14 起所有玻璃面只有**一条** blur 基线，不再有「rim blur1 + core blur14」双层结构；实测跨 bezel 内边界纹理能量比 1.0（a03），不存在硬直线。
- 割裂的历史成因是**两层不同 blur 并置** + **面板 tint 的 alpha 硬边**，两者本版都已消除。
- 面板边缘残留的只有：0.5px 发丝（外）+ 0.5px 内亮环（.12）+ 20px 内辉，与输入框同一配方。

## 3. 参数总表（暗色）
| 面 | blur | bezel | 体色 | 亮环 | 备注 |
|---|---|---|---|---|---|
| 输入框（冻结） | 1px | 24 | transparent | — | 内辉 20/-5/.20，r28 |
| 设置面板 veil | 10px | 17 | #fff 3% | .12 | 单层兄弟 veil，面板自身 bf:none |
| 浮层/菜单材质层 | 8px | 17 | #06070b 14% | .12 | 「+」面板 954×400 同档 |
| 气泡 rim | 8px | 17 | 透明+宿主底 | — | 首行行高 23 < 带 14，建议后续按行高收 bezel |

## 4. 验收（真机 PrintWindow 2560×1390，CSS×1.25）
- 暗色设置窗：边缘剖面 外 9.1 L → 环峰 42.6 L → 内部 ~20 L；环是 1 物理 px 尖峰（与输入框发丝同性质），2 CSS 内无 >10 L 硬台阶（v0.15 时 28.7~34.6 L）。
- 浅色设置窗：面板 68% 白 + 环 rgba(20,24,33,.14)，与页面拉开约 4~5 L，卡片与面板可分辨。
- 「+」浮层：材质层 bf = url(#…-N) blur(8px) saturate(1) brightness(1.05)，背后正文不可读（ghost std ≤1.8 L）。
- 截图：`D:/DSH Workspace/_lg27/shots/fin-dark-set.png`、`fin-light-set.png`、`fin-final.png`；变体矩阵 `v15s-grid.png`（fill 0/3/6 + ring 0/.07/.12/.19）。


## 4b. a04-seam 定量复核（v0.16 帧，物理像素）
- 缝隙位置在**面板外边界**，不在 bezel 内边界：bezel 24 CSS 处四边 |dL/ds| ≤ 0.15 L/CSS，平直无峰；内部纹理对比度 27→15→8 L 单调衰减 ⇒ 模糊连续（判据 3/4/6 PASS）。
- 面板边缘是一条 **0.5px 硬亮线**（不是模糊）：外侧 9.1 L → rim 峰 34.7~38.0 → 2 CSS 内跌回 −27.2 L。
- 拟合 rim−肩 = 9.7 + 37×alpha：ring .12 → +14.1 L；composer 自身边缘高光 = +12.7 L ⇒ **面板与输入框已是同量级**，故 v0.16 保留 .12（不归零），也不删 inset 声明（它是 composer 内辉的同类项）。
- 若下一轮还想再压：R3 发丝 `0 0 0 0.5px` → `0 0 1.5px 0.5px`（把 1 设备 px 硬线散开），代价是边缘略软。

## 5. 已知缺口（下一轮）
1. 用户气泡首行仍被折射带压到墨迹（几何问题：带 14 CSS > 行盒 10.8 CSS）；建议 bezel = clamp(8, .45*行高, 20)。
2. 确认框（480×184）仍 blur8/黑 14%/无 scrim，与面板族不同源；团队 popover blur6/浅灰 30% 未对齐。
3. 底部面板内层宿主 `nArs4W_pane` 不透明，rim 被盖死（引擎侧无解，需宿主内容层透明）。
4. tooltip 内辉挂在 root 且用 20/-5 档（菜单用 17/-4.25），亮环外扩 3px。
5. 静态检查器两处真违规未落地：23/24 的 legacy 块仍需 body 作用域化（a08 已给 V2 原型，零像素变化）。

## 6. 回滚
```
# 整包回滚（v0.15.0 检查点）
copy D:\dsh-src\maid-companions-backups\LG27-CHECKPOINT-v015-20261113\client.js D:\dsh-src\maid-companions\lib\client.js
# 或 parts 级回滚：编辑 src/client/parts/22-css-floating.js 的 4 个令牌 → node scripts/rebuild-parts.mjs
```
重建后**必须** `node 'D:/DSH Workspace/_lg27/bridge/attach-harness.mjs'` 再 rebuild，否则开发桥脚本被冲掉。