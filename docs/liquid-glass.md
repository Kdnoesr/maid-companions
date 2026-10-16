# 液态玻璃（Liquid Glass）技术文档

本文记录 maid-companions 里「输入框液态玻璃」的**原理、实现、参数演进与实测数据**。
目的：日后（含发布给别人用）能看懂**为什么这么写**、以及每个数字**是怎么定出来的**。

---

## 一、学习来源

| 来源 | 用途 |
| --- | --- |
| `D:\下载\index.html`（本地，674 行，纯 CSS+SVG 无依赖） | **主实现参考**：SDF 位移贴图 + feImage/feDisplacementMap + `backdrop-filter: url()` |
| <https://liunian.js.org/posts/liquid-glass/> | 印证关键限制：用了 `backdrop-filter` svg，仅 PC 新版 Chrome/Edge 可用 |
| <https://forum.cocos.org/t/topic/171941> | **原理最完整**：斯涅尔定律、位移向量场、色散、轮廓光的着色器实现 |
| <https://github.com/rdev/liquid-glass-react>（经 jsDelivr 读 README） | 特性清单：色差、elasticity、`overLight`、`mode: standard/polar/prominent/shader` |
| <https://developer.apple.com/documentation/technologyoverviews/liquid-glass> | 官方定性（见下） |

> ⚠️ 本机 hosts 把 github.com / raw.githubusercontent.com 等全部指向 127.0.0.1，
> 读 GitHub 仓库需改用 **jsDelivr**：`https://cdn.jsdelivr.net/gh/<owner>/<repo>/<path>`。
> Apple 文档是 JS 渲染的，`web_fetch` 只能拿到标题；改用它的 JSON API：
> `https://developer.apple.com/tutorials/data/documentation/<path>.json`。

### Apple 官方定性（原文）

- *"a new dynamic material called Liquid Glass, which **combines the optical properties of glass with a sense of fluidity**"*
- HIG 图示注解明确出现 **"lensing effect"**（透镜效应）
- 设计准则：*"Be judicious with your use of color … so they stay legible and **allow your content to infuse them and shine through**"*

---

## 二、原理：三根支柱

| # | 支柱 | 物理依据 | 本插件 |
| --- | --- | --- | --- |
| ① | **折射** | 斯涅尔定律：边缘入射角大→偏折大；**中心正交入射→位移归零** | ✅ 采用 |
| ② | **色散** | 不同色光折射率不同→R/B 通道反向偏移 | ⛔ 已关闭（用户："不要彩色光晕，太花哨"） |
| ③ | **轮廓高光** | 由位移场梯度推出的方向性镜面 | ⛔ 硬线版已弃（用户："不要边框泛白"）；改用**柔散内辉** |
| ④ | *弹性 elasticity* | 玻璃随指针形变，Apple 的"liquid"感 | ⛔ 未实现（需每帧重算，与性能诉求冲突） |

### ②色散的正确做法（教程原码）

```glsl
rC = texture(bgRT, baseUV + offsetUV * dispersionStrength);
bC = texture(bgRT, baseUV - offsetUV * dispersionStrength);
return vec4(rC.r, gC.g, bC.b, 1.0);   // R 与 B 反向偏移
```

本项目在 SVG 侧等价实现：同一张位移贴图做三次 `feDisplacementMap`（R/B/G 三个 scale），
`feColorMatrix` 各取一通道，再 `feBlend mode="screen"` 相加。
**实测**（黑白条纹背景，只有色散能造成 R≠B）：

| | 卡内最大通道差 | 色差≥25 的像素数 |
| --- | --- | --- |
| 色散关闭 | 2（纯抗锯齿） | 0 |
| 色散 0.07 | **50** | **426** |

代码保留，`LIQUID.dispersion` 设为 `0.05~0.12` 即可重启。

---

## 三、实现链路

```
圆角矩形 SDF(有符号距离场)
      ↓  边缘像素生成"指向中心"的位移（透镜边缘压缩）
位移贴图 canvas（R→X 位移, G→Y 位移, 128=零位移, scale = maxD*2）
      ↓  toDataURL()
<svg><filter filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
  <feImage result="map" preserveAspectRatio="none" href="data:...">
  <feDisplacementMap in="SourceGraphic" in2="map"
                     xChannelSelector="R" yChannelSelector="G" scale="...">
      ↓
element.style.backdropFilter = url(#id) blur(Npx) saturate(M) brightness(B)
```

关键数值关系：**峰值位移 = strength × bezelPx**，
`feDisplacementMap` 的 `scale` 应取 `2 × maxD`（贴图按 maxD 归一化过）。

---

## 四、参数演进（实测数据）

### 4.1 磨砂强度（blur）—— 用真文字压在玻璃后测

用户反馈"文字与聊天框交接了却没有折射"。根因**不是没算折射**，而是模糊把文字糊掉了：

| blur | 文字折射可见度 |
| --- | --- |
| 0 / 0.5 / 1px | **弯折清晰可见** |
| 2px | 发糊，难辨 |
| 4px | 糊成一片，**完全看不出** |

→ 从 4px 降到 1px。

### 4.2 莹润内辉（inset glow）—— 参数扫描

目标：**只抬亮边缘、中心不动**（否则就是"泛雾"）。

| 写法 | 边缘 +2px | 边缘 +8px | **卡片中心** | 结论 |
| --- | --- | --- | --- | --- |
| 48px / −24px / 0.09+0.05 | — | — | **+11.0** | ❌ 整卡均匀抬亮＝泛雾 |
| 16px / −11px / 0.13 | +0.8 | — | +0.0 | ❌ 弱到看不见 |
| **20px / −5px / 0.20** | **+7.2** | +0.9 | **+0.0** | ✅ 采用 |
| 20px / −5px / 0.28 | +10.6 | +2.0 | +0.0 | 可选（更强） |

**洞察**：负扩散要"适度"——铺太宽会均匀泛雾，收太狠会把辉光吃光。

### 4.3 折射区域（bezelPx）

用户要求"折射区域缩小一点点"。注意 **峰值位移 = strength × bezelPx**，
所以只收窄会让折射同步变弱；用户要的是"区域小"而非"折射弱"，故同步补偿：

| | bezelPx | strength | 峰值位移 |
| --- | --- | --- | --- |
| 改前 | 33 | 0.6 | 19.8px |
| 改后 | **24** | **0.8** | **19.2px**（基本持平，更集中） |

---

## 五、版本记录

### v「通透玉玻璃（**无内辉**）」—— sha256 前缀 `730FC82C`

> 用户认可的一版。**这是"上一版"**，按用户要求保留在此。

```js
const LIQUID = {
  strength: 0.8,    // 边缘折射强度
  bezelPx: 24,      // 边缘带宽度
  zoom: 0,          // 无全局放大（对齐 demo 普通玻璃）
  dispersion: 0,    // 无色散
  blurPx: 1,        // 清晰（通透）
  saturate: 1,      // 饱和度不增强
  brightness: 1.05, // 玉的透光感
};
```
```css
[data-composer-card]{
  background: transparent;                          /* 色调浓度 0 */
  backdrop-filter: blur(1px) brightness(1.05);
  /* 无任何 inset 高光 */
}
```
备份：`backups/20260914-010750-pre-jade-glow/client.js.bak`

### v「通透玉玻璃 + 莹润内辉」—— 当前

在上面基础上**只加一行**：

```css
box-shadow:
  var(--dsw-elevation-soft, 0 0 0 .5px rgba(255,255,255,0.12)),
  inset 0 0 20px -5px rgba(212, 232, 255, 0.20);
```

⚠️ `box-shadow` 是**整体替换**，必须写回 `--dsw-elevation-soft`，否则丢卡片自身描边。

### 参数对齐 demo 面板（`D:\下载\index.html` L661-665）

| demo 滑块 | 范围 | 对应 |
| --- | --- | --- |
| 折射强度 | 0~2.5 | `global.strength`（`buildMap` 里作为 k 的乘数） |
| 模糊 | 0~20px | 拼进 `backdrop-filter` 的 `blur()` |
| 饱和度 | 80~300% | 拼进 `saturate()` |
| 色调浓度 | 0~0.6 | `--tint-a`（玻璃底色 alpha，0=不填色） |

demo 里普通玻璃 `zoom = 0`，只有可拖动放大镜 `#lens` 用 `data-zoom="0.22"`。

---

## 六、性能与正确性修复记录

### 6.1 女仆尺寸动画卡顿（改 `height` → `transform`）

原实现 `transition: height/bottom`（**布局属性**），每帧主线程 layout+paint，
并对 1122×2019 / 1077×2048（各约 2MP）立绘**每帧重新降采样**、
**每帧按变化的剪影重算 `drop-shadow`**。

改为**布局高度固定为最大值**（96%/92%），缩小用 `transform: scale()`：

| 状态 | OLD | NEW | 差 |
| --- | --- | --- | --- |
| hero 左 | w=307.19 h=768 | w=307.19 h=768 | 0 |
| active 左 | w=204.8 h=512 | w=204.8 h=512 | ≤0.01px |
| active 右 | w=198.39 h=496 | w=198.39 h=496 | 0 |

锚点：左 `transform-origin: bottom left`、右 `bottom right`（等价于原 left/right 固定 + bottom:0）。
`will-change: transform` 把栅格固定在**布局尺寸**，scale 恒 ≤1 → 放大方向也不会糊。

### 6.2 前端 bundle 永久缓存（rev 冻结）

`dev_reload_package` 重载 host fiber 但**前端 bundle 的 rev 不变**时，浏览器拿到的是
`max-age=31536000, immutable` 的旧包 —— 表现为"改了代码但界面毫无变化"。

根因：插件**不在 `clientModules.table`** 里，`cm.rebuilt(id)` 直接 `return void 0`。
修复：用 `dev_install_package` 走**标准 profile 装配**（写 `dependencies` + `bundles`），
与 `maid-atelier` 同一条路。验证方式：内容改一下，rev 应从 `ba582bd1ebf3` 变为新值。
（改注入器只能修本机，插件要发布就必须走标准路径。）

---

## 七、踩坑清单

1. **读错源码**：`dshmarket/node_modules/@deepseek-ai.bak/...` 是**旧副本**，
   其 primitives 类名映射为空 `{}`，据此推出"菜单没有类名"是错的。
   真实运行的是 `dsh-web-frontend/dist/assets/` 里的构建产物。
   → **先确认哪份代码在跑，再读它**。
2. **过宽选择器**：`[class*='_1nxmc_']` 会连 `_root/_item/_viewport` 一起捞进，
   导致每个菜单项各自叠加一层半透明+模糊，糊成一团。**只列精确类名**。
3. **无效对照**：A/B 对比时两张图必须来自**同一 harness**。曾用旧 harness 的产物当参照，
   得出的 +10 亮度差其实是"卡片底色不同"造成的假象。
4. **STAGE_CSS 里出现反引号**：它是 JS 模板字符串，注释里再写反引号会截断模板、
   整个 bundle 语法错误（本项目炸过 5 次）。守卫 I 专门检查这条。
5. **`box-shadow` 整体替换**：追加 inset 时必须写回原有 `--dsw-elevation-*`。
6. **文字没折射 ≠ 没算折射**：先看模糊是不是把文字糊掉了；再确认文字**是否真的
   延伸到卡片背后** —— 若滚动区裁切边界正好在卡片上缘（只是"相接"而非"重叠"），
   卡片背后本就没有内容可折射，那是**布局问题**，调参数无解。

---

## 八、验收口径（可复现）

```bash
# 1) 静态守卫（8 项不变量，exit 1 = 违反）
node scripts/check-no-area-tint.mjs

# 2) 用插件真实代码渲染 + 读回真实参数（不是 demo）
node "../../DSH Workspace/downloads/make-lg-test.mjs"
#    → 生成 lg-plugin-test.html / lg-plugin-noglow.html（仅差内辉那一行）
#    用 headless Chrome 渲染并读 title 里的 JSON：
#      installed / hasFilter / scale / inlineBF / boxShadow

# 3) 实测验收线
#    对比列背景必须与「未启用插件」逐像素一致（只有输入卡与浮层可不同）
#    内辉：边缘 +2px 应 ≈ +7，卡片中心应 ≈ 0
#    文字折射：blur 1px 时应能看见上边缘的弯折
```
