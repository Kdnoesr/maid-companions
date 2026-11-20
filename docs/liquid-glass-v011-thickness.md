# 液态玻璃 v0.11 —— "厚度"模型（非输入框面统一到输入框观感）

> 2026-11-13。本轮解决三件事：①设置页"整体变暗" ②「+」浮层"只有透明、没有模糊" ③所有折射带略收窄。
> 输入框（composer）参数全程冻结：blur 1px / bezel 24 / 内辉 `inset 0 0 20px -5px rgba(212,232,255,.20)`。

## 1. 根因一：祖先 `backdrop-filter: blur(0px)` 建立 backdrop root，后代玻璃全部"空转"

**现象**：设置面板的 veil（`[data-mc-glass-veil]`）计算值看起来完全正常
（`url("#dsh-maid-companion-liquid-…-v") blur(1px) saturate(1) brightness(1.05)`），
但把 veil 设成 `display:none` 前后截同一屏，整块面板 **meanabs = 0.0 / max = 0** —— 它一个像素都没画。

**证伪链**（同一区域、同一时刻）：
| 造法 | 边缘锐度（越小越糊） |
|---|---|
| 普通 div + `backdrop-filter: blur(16px)` | 1.01 → **0.11** ✅ 区域本身具备采样能力 |
| 合成 div + `url(#…-17) blur(10px)` | 0.61 ✅ `url()` 滤镜没被忽略 |
| `backdrop-filter: none` | 4.68（原图） |

**真因**：插件给遮罩层写过
`[role='presentation']:has([role='dialog'][aria-modal]) { backdrop-filter: blur(var(--mc-scrim-blur)) !important }`，
而 `--mc-scrim-blur: 0px`。**blur(0px) ≠ none**：只要祖先的 backdrop-filter 不是 none，Chromium 就为它建立
backdrop root，其内部所有后代 `backdrop-filter` 只能采到"这个空根"，位移+模糊一律退化成 identity。

**修复**：该规则改为 `backdrop-filter: none !important`。复测 veil on/off → **meanabs 5.22 / max 78**。

> 纪律：任何祖先/容器**永远不要**写 `blur(0px)`、`brightness(1)` 这类"恒等滤镜"来占位；
> 要关就写 `none`。面板自己不要挂 backdrop-filter，滤镜只挂在 veil（兄弟节点）上。

## 2. 根因二：1px 模糊在文字背景上等于没模糊

用户说的「只有透明、没有折射带、没有模糊」，是因为非输入框面沿用了 composer 的 `blur(1px)`。
composer 背后是均匀暗色聊天底，1px 模糊看不出来也无需看出来；菜单/面板背后是正文，1px 完全压不住字。

真机 A/B（改源码常量 + HMR，因为引擎每 ~120ms 会重写 inline 样式，直接改 inline 拿不到结果）：

| 非输入框面 blur | 判读 |
|---|---|
| 8px | 正文仍然可读 → 「字叠字」 |
| **12px** | 明显雾化，仍保留背景色彩倾向 → 浮层 |
| **20px** | 大段正文变成柔光洗面，接近 Apple 厚材质 → 大面板 |
| 24px | 与 20 差別很小，帧代价更高 |

**定档**（`MAT`）：
```js
glass: { blurPx: 12, saturate: 1, brightness: 1.05, bezelPx: 20 }  // 菜单/气泡/浮层/工具条
panel: { blurPx: 20, saturate: 1, brightness: 1.05, bezelPx: 20 }  // 设置窗等大面板
```
除 blur 与 bezel 外的所有参数（tint、内辉、发丝、位移曲线）完全相同 —— 这就是"同一材质、不同厚度"。

## 3. 设置页"整体变暗"的定量修复

双层压暗叠加：自作聪明给遮罩加了 `--mc-scrim: rgba(0,0,0,.34)`，叠在宿主 `rgba(0,0,0,.5)` 上
⇒ 透射率 0.33；面板填充又是近黑 `#06070b 14%`，于是**面板内部比遮罩区还暗**。

物理像素采样（CSS(700,700)，深色）：

| 组合 | RGB |
|---|---|
| scrim .34 + #06070b 14% | 3,3,4（坏） |
| scrim 0 + #06070b 14% | 5,5,7 |
| scrim 0 + white 8% | 25,25,25 |
| scrim 0 + white 14% | 40,40,41 |

**最终**：`--mc-scrim: rgba(0,0,0,0)`（压暗交还宿主 mask），深色 `--mc-fill-panel: color-mix(in srgb, #ffffff 7%, transparent)`，
浅色仍 `bg-overlay 45%`。复测：panelNav 50,50,51 / panelBody 44,44,46 / 遮罩区 10,10,11 / 页面底 11,11,12
→ 面板比环境亮一档，读作"蒙了一层磨砂玻璃"，而不是"被压暗"。

## 4. 折射带收窄（用户："所有的折射带有点太宽了"）

非输入框面 `bezelPx: 24 → 20`：可见带 16.7px → 13.7px（−18%）。
同时补上 `installRim` 缺失的钳制，保证位移场最大斜率 `1.98·D/B ≤ 0.9` 不折返：

```js
buildMap(W, H, radius, GP.bezelPx, null, 1, null, Math.min(MAT.dispTarget, 0.4545 * GP.bezelPx))
```

内辉随 bezel 等比缩：`--mc-glow-blur 20px → 17px`、`--mc-glow-spread -5px → -4.25px`
（JS 材质内辉串同步为 `inset 0 0 17px -4.25px rgba(212,232,255,0.20)`）。
**composer 不动**（bezel 24 / 内辉 20-5），它仍是黄金标准。

## 5. 验收口径（不变）

- 同一面内：折射带与内部模糊必须**同一层、同一次滤波**（一层采样），带宽与模糊尺度同量级才不会"割裂"。
- 除 composer 那一条内辉外，不允许任何自发光：彩色外辉、焦点光环、`inset 0 1px 0` 顶亮边全部删。
- 测量判据：同 bf 尾巴 + 峰值位移 ≈ 9.95–10.00px（scale 随面尺寸变，不能断言同一 scale 值）。
