# 液态玻璃 v0.14.0 · 单层均匀模糊（割裂从结构上消失）

日期：2026-11-13 14:1x ｜ 版本 `__mcVer = "0.14.0"` ｜ lib/client.js sha256 f66377c8…（会随每次构建变化，以 `node scripts/assemble-client.mjs --check` 输出为准）

## 1. 这一版解决了什么

用户反复报的核心毛病：

> 「很多其他地方的折射都是有问题的，就是像之前设置的类似问题，就是四周的折射区与内部的模糊区是有点割裂的」
> 「最好的是现在输入的对话框，你尽量将其他区域…对齐输入框的样子」

v0.12/v0.13 的做法是「清边（blur 1）+ 羽化磨砂芯（blur 14，mask 羽化）」，本意是让边缘像输入框一样清、内部像雾面一样压住正文。真机实验证明这条路在 Chromium 上**根本不可能做到无台阶**（见下），于是 v0.14 换成更简单、也更接近输入框的结构：

**每个玻璃面 = 一层均匀 backdrop-filter（位移 + blur）+ 一层带羽化的体色层。**

没有"边缘一种模糊、内部另一种模糊"，割裂在结构上就不存在了。

## 2. 为什么"羽化磨砂芯"不可行（根因，别再试）

真机合成实验（`_lg27/shots/v13o-isolate.png`、`v13p-overflow.png`、`v13j-maskbf2.png`、`v13n-composite.png`）：

| 结构 | mask 羽化 | 结论 |
|---|---|---|
| 普通 div + mask | ✅ 生效（21→55→98→140→218） | 自绘内容永远被 mask 裁 |
| div + backdrop-filter + mask（无 overflow 祖先） | ✅ mask 生效，但 **bf 的输出不被裁**（模糊结果铺满整幅） | mask 只裁元素自己的绘制 |
| **bf 元素 + 祖先 `overflow:hidden`/`clip`** + mask | ❌ **mask 被整体忽略**，alpha 在 1px 内跳满 | 玻璃宿主几乎都带 overflow 圆角裁切 ⇒ 这条路死了 |
| mask 祖先 + 子元素 bf | ❌ 子层 bf 整层空转（锐度 4.54 ≈ 未模糊） | mask 祖先会建 backdrop root |

所以：**羽化只能用在不挂 bf 的普通层上**（体色可以羽化），模糊本身只能整面均匀。

## 3. 现在的结构

```
宿主元素（bf:none, isolation:isolate, position:relative）
├─ [data-mc-glass-rim]   z-index:-2   bf = url(#位移) blur(8|10px) saturate(1) brightness(1.05)
│                                      + inset 内辉 17/−4.25/.20（与输入框同一套语言）
└─ [data-mc-frost]       z-index:-1   background = 体色（无 bf！）
                                       两条 linear-gradient mask 交集，羽化 36px（短边×0.14，夹 8~36）
内容…
```

- 菜单族（宿主带 `[data-menu-material]`）不新增 rim 层：宿主自己的 material 子层就是 rim（z-index −2），frost 插在它后面。
- 设置窗：veil（宿主 overlay 的兄弟层）就是 rim（blur 10 / bezel 17），frost 是 panel 的首个子层。
- 输入框：**完全不动**（bf 直接挂元素本身、单层采样、blur 1 / bezel 24 / 内辉 20 −5 .20）。
- 小面的 host 若是 `position:static`，先改成 relative，否则绝对定位的并列层会以更远祖先为包含块（实测气泡层被撑成 922×1782）。

## 4. 参数（唯一调参入口 `src/client/parts/31-material-constants.js`）

| 参数 | 输入框（冻结） | 浮层/菜单/气泡 | 面板（设置/确认/团队） |
|---|---|---|---|
| blur | 1px | 8px | 10px |
| bezel | 24 | 17 | 17 |
| saturate / brightness | 1 / 1.05 | 1 / 1.05 | 1 / 1.05 |
| 位移峰值 | 10 | min(10, .4545·17)=7.73 | 7.73 |
| 可见折射带 | ≈16.6 CSS | ≈11.7 CSS | ≈11.7 CSS |
| 体色 | 无（透明） | `#06070b 14%`（深）/ 白系 45%（浅） | 白 7%（深）/ bg-overlay 45%（浅） |
| 羽化 feather | — | 短边×0.14，夹 8~36 | 同 |
| 内辉 | inset 0 0 20px −5px rgba(212,232,255,.20) | 17/−4.25/.20 | 17/−4.25/.20 |

用户要求"折射带稍微调窄一点"：bezel 20 → 17（可见带 13.8 → 11.7 CSS）。

## 5. 已知取舍

- 均匀 blur 8/10 意味着**边缘折射带也被模糊**，不再有"清边"。这是为了消除割裂必须付的代价，也更接近输入框（输入框本来就没有"清边"）。
- 体色羽化只能靠 frost 层 alpha 渐变；设成 0 就完全无体色（背后正文会"字叠字"，不可读）。
- 浅色主题尚未真机验收（切法：同一 eval 内 `body.removeAttribute('data-ds-dark-theme')` + `html[data-ds-theme-source]='light'`，100ms 生效）。

## 6. 回滚

本轮改动全部集中在 `src/client/parts/31-material-constants.js`（blur/bezel）、`22-css-floating.js`（frost 去掉 bf、isolation 选择器）、`33-engine-rim-apply.js`（static host → relative）、`00-preamble.js`（版本号）。
回滚点：`D:/dsh-src/maid-companions-backups/` 下最新 LG27-CHECKPOINT-v013* 目录。
