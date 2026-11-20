# 液态玻璃 v0.15.0 — 浅色令牌、面板内亮环、可回滚隔离

日期：2026-11-13　构建：`lib/client.js` 1,132,047 B　sha256 `d9c25dbce0558e4acba4e63a18b40057617440173ccac7d740f16da2b7375611`
备份：`D:/dsh-src/maid-companions-backups/LG27-CHECKPOINT-v015-20261113/`

## 1. 本版解决的问题

| # | 现象（用户口径） | 根因 | 处置 |
|---|---|---|---|
| 1 | 浅色主题下面板/控件「发灰、发暗、看不见」 | 令牌基值是深色写死的白叠加（`rgba(255,255,255,.08)` 等），浅色=白底白；`--mc-fill-panel` 用 `bg-overlay 45%`（浅色 L*82.3）；阴影写死 28%/42% 黑（浅色下沿 −27L 黑晕） | 基值整体改成**浅色安全值**（内阴影 + label-primary 混色 + 宿主 elevation 令牌），深色值全部搬进 `body[data-ds-dark-theme]`，两套显式并存 |
| 2 | 面板缺少「玻璃边」读感（ring/body 0.48，输入框 11.89） | 面板体色比背景亮 9.5L，20px 冷白内辉被自己的底洗掉，只剩一条淡线 | 设置面板 box-shadow 增加 `inset 0 0 0 0.5px var(--mc-panel-ring)`（深色 `rgba(212,232,255,.19)`、浅色 `transparent`） |
| 3 | 关插件/换材质后残留 stacking context | `33-engine-rim-apply.js` 三处内联 `isolation:isolate` 无回滚路径 | 删除内联写入，改由 CSS `[data-mc-glass-layered]` 规则承担 |
| 4 | reduced-transparency 下浅色变黑板 | `rgba(44,44,46,.92)` 写死 | 加 `body[OWNER]` 作用域 + `color-mix(in srgb, var(--dsw-alias-bg-base) 92%, transparent)` |

## 2. 关键实现点

- **令牌分层**：`22-css-floating.js` 的 `:root` 现在是「浅色基值」，`body[data-ds-dark-theme]` 块显式覆盖 `--mc-glow-rgb/alpha`、`--mc-glow-panel-alpha`、`--mc-panel-ring`、`--mc-shadow-float/-panel`。
- **体色**：浅色 `--mc-fill-panel: color-mix(in srgb, var(--mc-panel-base, var(--dsw-alias-bg-base, #fff)) 78%, transparent)`（L*96.1）；深色保持 `#ffffff 7%`。
- **阴影**：浅色走 `var(--dsw-elevation-soft/--dsw-elevation-prominent)`，深色保留原黑值。
- **⚠️ 特异性陷阱**：`20-css-stage-base.js:219` 的 `[role='presentation'] > [role='dialog']…` 规则特异性 (0,9,1) + `!important`，会压过末尾统一材质层块。**面板装帧（含新内亮环）必须写在这条规则里**，写在 22-css-floating.js 的同名规则里会被静默压掉（本轮已实测复现）。

## 3. 验收口径（仍未全部通过）

- 深色：设置窗内 22.9L vs 外部 9.1L（不再变暗）；内亮环在剖面里 +29.6L@边缘。
- 浅色：`--mc-fill-panel`→`#fff 78%`、`--mc-glow-alpha`→0.05、`--mc-glow-rgb`→`0,0,0`、`--mc-panel-ring`→transparent，computed 全部生效。
- 待办：ghost（透字）定量、菜单/对话框族复测、性能、浅色全表面验收。

## 4. 回滚

```powershell
Copy-Item 'D:/dsh-src/maid-companions-backups/LG27-CHECKPOINT-v015-20261113/*' 'D:/dsh-src/maid-companions/' -Force
cd 'D:/dsh-src/maid-companions'; node scripts/rebuild-parts.mjs; node 'D:/DSH Workspace/_lg27/bridge/attach-harness.mjs'
```
（HMR 约 2–4 秒生效，无需重启 DSH Desktop。）
