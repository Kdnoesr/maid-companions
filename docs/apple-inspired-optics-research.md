# Apple 风格光学：液态玻璃的折射、色散与高光 · 研究与落地边界

> 调研日期：2026-11-21　｜　目标仓库：`D:/dsh-src/maid-companions`　｜　受众：本仓库光学引擎（`lib/client.js` · `createLiquidGlass`）的下一次迭代
>
> 本文只做两件事：把五个指定来源与一手资料里的**光学事实**摊开，再把它们**逐条对回本仓库已经实测的参数**，说明哪些能用、哪些用不了、为什么用不了。所有结论都带出处；没有出处的说法一律标成"推测"。

---

## 0. 结论先行

1. **苹果自己从没公开过液态玻璃的着色器或渲染管线。** 官方文档里能拿到的只有材质分类、使用纪律、变体（regular / clear）、35% 压暗层这类**设计约束**，没有折射率、没有 Snell、没有位移公式。所以所有"精确复刻 iOS 26"的宣称都是逆向工程。([Adopting Liquid Glass](https://developer.apple.com/documentation/technologyoverviews/adopting-liquid-glass)、[HIG Materials](https://developer.apple.com/design/human-interface-guidelines/materials))
2. **网页上做一个"接近"的版本，可行路径只有两条**：SDF 位移贴图 + `feDisplacementMap`（Chromium 可用），或 WebGL/Canvas2D 自绘（全平台可用但必须自己抓背景）。两条路径的短板完全不同，见 §4。
3. **本仓库走的是第一条**（SDF→PNG→`feImage`→`feDisplacementMap`），并且已经踩过了社区方案最常见的两个坑：`scale` 与降采样比例耦合（v0.6.1 修）、网格编码不满量程导致"平顶 + 带外归零"（v0.7.0 修）。这两条在 kube.io 与 juejin 两篇文章里都没有提到——**它们是我们自己的增量**。
4. **真正还没用上的两项光学，都在物理上站得住、在实现上代价明确**：(a) 双界面折射（入/出两次）——kube.io 明说没做；(b) 色散方向与色散量随折射角变化——Cocos 那篇给的是常量 `dispersionStrength`。本仓库历史实验中的色散（0.07 → 最大通道差 50、426 px）已经落到"看得见"的区间，再叠角度变化前必须先解决性能与折返门限，见 §5。
5. **"更亮/更厚"不等于"更苹果"。** 苹果文档明确要求克制使用、内容层不用玻璃；本仓库 v0.5.0 定稿的 `g_edge 6.54 vs composer 6.50` 说明我们现在的边缘过渡已经和输入框对齐——**任何增强都必须先过这条回归线**，否则会重演"两块玻璃对缝"。

---

## 1. 五个指定来源，逐个定性

| # | 来源 | 性质 | 提供什么 | 不能提供什么 |
|---|---|---|---|---|
| 1 | [Cocos 论坛 · Shader 教程 #20](https://forum.cocos.org/t/topic/171941) | 社区教程（引擎内有可跑 demo） | **生成侧**：如何从法线贴图烘焙出位移向量场、如何编码、色散与轮廓光的 shader 写法与默认参数 | 浏览器端落地方式；性能数据无第二方验证；作者自承边缘光精度受限 |
| 2 | [kube.io · Liquid Glass in the Browser](https://kube.io/blog/liquid-glass-css-svg/)（2025-09-04） | 高质量工程博客 | **物理侧**：四种表面高度函数、光线追踪求位移、明确的 6 条限制清单 | 不支持 Safari/Firefox；单次折射；无动态尺寸 |
| 3 | [liquidglassdesign.com](https://liquidglassdesign.com/) | 展廊/营销页（约 1053 字符） | 名词与叙事（与 glassmorphism 的区别："per frame 模拟、会反应"） | 任何数值、任何实现 |
| 4 | [掘金 · Web 端液态玻璃实现对比](https://juejin.cn/post/7514618352829448244) | 中文实践总结 | **落地侧**：五种 SVG 滤镜方案的失败模式、`feDisplacementMap` 属性表、纯 CSS 路线的天花板 | 折射率/色散/性能；其自研方案自承"折射不足" |
| 5 | [Apple · Liquid Glass 技术总览](https://developer.apple.com/documentation/technologyoverviews/liquid-glass) | 官方概述（正文极薄） | 一句定义 + 指向 Adopting Liquid Glass / HIG | 任何实现细节 |

**第 3 与第 5 的价值只在于"引用"，不能当技术依据。** 后续所有涉及"苹果怎么做"的句子，要么出自 HIG/Adopting 文档的**行为描述**，要么明确标注为逆向推测。

---

## 2. 光学原理：从 Snell 到屏幕上的一个像素

### 2.1 折射本身

光从介质 1 进入介质 2：

```
n1 · sin θ1 = n2 · sin θ2          （Snell–Descartes）
θc = arcsin(n2 / n1)                （n1 > n2 时的全反射临界角）
```

Cocos 那篇把这两式原文列出，并补了两条常被忽略的推论：**垂直入射（θ1 = 0）时方向不变**——这正是玻璃正中央"几乎不扭曲"的原因；**只有从光密到光疏才可能全反射**，空气→玻璃（n 由 1 升到 1.5）永远不可能触发，所以"玻璃边缘把光全反射回去"在物理上是错的。[aemisdr 的证明清单](https://github.com/aemi-studio/aemisdr)里把这条明确列成 machine-checked property：**"snell-refraction（air→denser 不存在 TIR）"**，同清单还有 Schlick-Fresnel（透射率落在 [0, 1−F0]）与 Sellmeier 色散（正常色散 + 使用公开的真实折射率）。

一句话：**Fresnel 决定"有多少光被反射"，Snell 决定"剩余的光拐向哪里"，Sellmeier 决定"不同颜色拐得不一样多"。** 这三件事就是液态玻璃视觉的全部骨架。

### 2.2 色散

色散 = n 随波长变化。Sellmeier 形式：

```
n²(λ) = 1 + Σ_i  B_i λ² / (λ² − C_i)
```

对普通冕牌玻璃，可见光范围内 n 的变化只有 ~0.008（例如 ~1.504 @ 700nm vs ~1.512 @ 480nm），折射角差异在**零点几度**量级——肉眼看不出彩虹边。kube.io 的做法是直接把"色散"从物理模型里剔除，理由是"消色差玻璃本来就不该有色散"；页面上的彩虹边是**艺术夸张**，不是物理结果。

**对本仓库的推论**：色散（dispersion）是一个**风格参数**而非物理参数，不该去追求"真实"。历史实验中 0.07 的参数在黑白条纹上给出最大通道差 50、426 px 覆盖（见 `docs/liquid-glass.md`），已经属于**保守的夸张**；继续加大会开始出现"彩色描边"而不是"玻璃边缘"。

### 2.3 表面高度函数：决定"玻璃长什么样"的唯一自由函数

kube.io 给出四种 2D 剖面（x ∈ [0,1] 为归一化的"到边缘的距离"，y 为表面高度）：

| 剖面 | 高度函数 | 视觉**反推**效果 | 出处/用途 |
|---|---|---|---|
| Convex Circle | `y = sqrt(1 − (1 − x)²)` | 经典圆倒角，平→弯过渡突兀 | kube.io 基础款 |
| Convex Squircle | `y = (1 − (1 − x)⁴)^(1/4)` | 平→弯过渡更柔；**看起来倒角更薄** | kube.io 称为苹果的 squircle；与 Apple 的"控制件曲率呼应硬件形状"一致（[Adopting](https://developer.apple.com/documentation/technologyoverviews/adopting-liquid-glass)） |
| Concave | `y = 1 − Convex(x)` | 中心凹、边缘凸；光线向外偏 | kube.io 实测会**要求采样玻璃之外的背景**，避开；苹果只在 Switch 上用 |
| Lip | `y = mix(Convex, Concave, Smootherstep(x))` | 外圈隆起、中心浅洼；中心"缩进去"、边缘"折进来" | kube.io 用 Switch 举例，与我们"开关态用清透玻璃"的直觉吻合 |

**Corner case 值得单独记一笔**：kube.io 说 squircle 会让"倒角看起来更薄"。本仓库用 SDF 圆角矩形，等价于 Convex Circle 剖面；若换成 squircle 式缓坡，需要同时把 `bezelPx` 上调才能维持相同视觉厚度——**这不是免费的风格切换**。

### 2.4 从高度到场：位移怎么来

kube.io 做的是**真光线追踪**：在 2D 半剖面上射出 127 条光线（数量由 SVG 位移图分辨率决定），算出入射点、折射方向、出射点，再把"入射点 − 出射点"采样成位移向量。Cocos 那篇省掉了追踪，直接**烘焙一张法线图，再乘一个自写的高度剖面**。

两条路的差别正是本仓库的处境：**我们做的是 Cocos 那条**（解析式剖面 `m(u)` + SDF 梯度方向），成本是"不是真折射"，收益是"每帧零成本，只在尺寸变化时重建一次贴图"。

---

## 3. 编码与采样：位移贴图这一层的硬约束

这一节是"能不能用"的关键，四个来源分别贡献了一块拼图。

### 3.1 8-bit 通道决定量化精度，scale 决定位移范围

`feDisplacementMap` 的规范行为（掘金那篇把属性表抄全了）：

- `xChannelSelector` / `yChannelSelector` ∈ {R, G, B, A}，默认 **A**（这点常被忽略：不显式指定就等于用 alpha，而 alpha 通常恒为 255 ⇒ 无位移）
- `scale` 默认 0；位移 = `scale × (C/255 − 0.5)`，因此**单轴最大位移是 scale/2**
- 通道是 8-bit ⇒ kube.io 的说法是"位移被限制在 −128..127 px，128 是中性值"

**推论（本仓库 v0.7.0 的核心）**：编码不满量程会出两种病。旧式 `enc = maxD/2` 让峰值 `raw/enc = 1.0`，通道被 clamp 到 255 ⇒ **位移剖面变成平顶 + 带外立即归零**，观感"像贴了层透明膜"。改成 `enc = 2·maxD`（`raw/enc ∈ [−0.5, 0.5]`）、解码 `scale = 2·dTarget` 后，`d_peak = scale × 0.5 = dTarget`，**与尺寸、与降采样比例全部解耦**（`lib/client.js` L1909–1921 注释里记的"纯数学复核 10 个尺寸全部 10.000"）。

### 3.2 降采样比例与 scale 的耦合陷阱

kube.io 的"backdrop-filter 尺寸不会自动跟随元素尺寸"和本仓库注释里的 `shrink` 问题同源：贴图按 `MAP_MAX_EDGE=256` 降采样，但 `scale` 作用在**元素真实像素**上。若不先按元素尺度归一化，元素一大，位移就跟着缩水。这条在掘金与 kube.io 里都**没有被提到**——是我们自己踩出来并修掉的（v0.3.1 / v0.6.1）。

### 3.3 方向：SDF 梯度 vs 径向场

这是本仓库最有价值的一条经验，也解释了为什么"简单取指向中心的方向"会失败：

- 径向场在 640×132 的扁长输入框上，上边缘位移方向从 11° 扭到 90° 再扭到 169°，**幅度恒定 17.05 px**——于是视觉上"中间鼓出一个包"。
- 改用 SDF 梯度取负（= 指向最近边的内法线）后，同一条边方向恒为 90°，**幅度逐点不变**（17.05 / 角部 19.20 / 正中 0.00）。
- 结论：**方向由几何决定要解析式求，幅度由剖面决定可以调。** 这两件事必须解耦。

Cocos 那篇的 `vec2(1.0, -canvasScale)` 是另一种解耦：用 `canvasScale = 1280/720` 做**非等比拉伸补偿**，避免在非正方形画布上位移被压扁。Web 端等价物是"位移以 CSS px 计量、以元素宽高比校正斜向分量"，我们的 SDF 梯度天然满足，不需要额外补偿。

---

## 4. 网页实现的四条路线与各自的硬伤

### 4.1 路线 A — `backdrop-filter: url(#svg-filter)`（Chromium only）

**这是本仓库现在用的路线。** 硬伤来自 WebKit 侧：

- [WebKit bug 245510](https://bugs.webkit.org/show_bug.cgi?id=245510)：**至今 OPEN**（2022-09-21 Julius Tarng 报告，2026-06-12 Karl Dubost 复现并附三浏览器对比图）。标题即结论：`backdrop-filter: url(#some-svg-filter)` 不工作。
- 根因写在 [PR WebKit/WebKit#68614](https://github.com/WebKit/WebKit/pull/68614) 的说明里：**`RenderLayerBacking::updateBackdropFilters()` 无法把 reference filter 交给 Core Animation，而 `filter: url()` 有软件回退、backdrop 没有**——于是滤镜被静默丢弃。同目录的 #68613（加速路径前置）、#69566 也在推进中。
- 即便修复落地，作者自己列了三条**已知限制**：子框架内容抓不到；旋转或缩放的元素只采样轴对齐矩形；被加速动画移动的背景**只在元素重绘时才更新**。
- [WebKit bug 297770](https://bugs.webkit.org/show_bug.cgi?id=297770) 里 smfr（Simon Fraser）一句话总结："Accelerated filters (including backdrop-filter) can't use SVG filters, sadly."

**必须纠正的一个流行误读**：[Safari 26 beta 发布说明](https://webkit.org/blog/16993/)里**没有**提到液态玻璃或 `backdrop-filter: url()`。已有的相关条目只有两条：修 `will-change: view-transition-name` 使其建立 stacking context 与 backdrop root（146281670），以及 WebKit API 可以为**透明 webview** 背后的内容加 backdrop-filter。**不能据此宣称"Safari 26 支持"**，本仓库若要做跨端，必须保留 blur-only 降级路径。

### 4.2 路线 B — 在元素内容上做 `filter: url()`

[liquid-glass-js](https://github.com/amir-abushanab/liquid-glass-js) 的选择：把滤镜施加在**真实 DOM 上**而不是 backdrop 上，因此 Safari/Firefox 也能生效。代价是滤镜作用于"元素自己"，必须靠克隆/定位把背景内容搬到元素下方——它自己列的取舍：

- WebGL 只留给 SVG 滤镜弯不了的：没有实时 DOM 的 `<canvas>`，或 `<video>`（**WebKit 拒绝过滤 video**）
- Safari / Firefox "parse `backdrop-filter: url()` 但什么都不画"（即 245510）
- `mapScale 0.75` 只生成约 56% 像素，`0.5` 只有四分之一；"**变软的是边缘**：0.5 时 Retina 上沿轮廓会出现淡淡第二条边"
- 剖面 `erf`（柔和弯月面）vs `circle`（峰值正好压在边缘，对应 iOS 那种"压缩环"）
- `supersample` 只在 Chromium 有帮助；其他平台走软件路径，`G²` 像素等于把慢路径再慢四倍

**对我们的启示**：`mapScale` 这一档与我们的 `MAP_MAX_EDGE=256` 是同一个旋钮。我们已经量化过这张贴图的代价（800×800 → 563KB、512 → 230KB、256 → 58KB；`toDataURL` + `feImage` 解码 130ms），**再往上加分辨率买不到视觉收益，只买到重建卡顿**。

### 4.3 路线 C — 纯 CSS/SVG 参数化

掘金文章的五方案横评就是这条路的失败清单：

1. 方案 #1 / #2：整体折射，出现**拉丝/浑浊**（全局位移把整个面都拉伸了，文字跟着糊）
2. 方案 #3：边缘折射做得最好（作者最终倾向）
3. 方案 #4：**中间过糊**（模糊半径和位移半径没有分离）
4. 方案 #5：纯 React 库，不可移植
5. 作者自研：只用 5px 边带做位移、中间不动——结构对了，但"折射不够准确"

**这条清单和我们踩过的坑完全同构**：`docs/adaptation-20261113-liquid-glass-v2.md` 里记录的"位移量级与模糊量级不一致 ⇒ 边缘/中心出现接缝"，就是方案 #4 的病；而"折射区与内部模糊区割裂"是 quintic 剖面在带中部冒 4.7× 放大率凸包导致的（`M(u) = 1/(1 − c·|m'|)`，quintic 的 `max|m'| = 1.875`）。**换 quad2 剖面把最大值挪到外缘**，带均值 0.81 / 带最小 0.67（旧 0.67 / 0.28）——这就是"割裂消失"的数值依据。

掘金那篇自承"折射不够准确"，原因是它**没有剖面函数**，只有一段 5px 边带的线性过渡。kube.io 的价值就在于补上了剖面函数这一层。

### 4.4 路线 D — WebGL / Canvas2D 自绘

[html-in-canvas.dev](https://html-in-canvas.dev/liquid-glass-effect/) 把液态玻璃拆成五件事，并给了可直接照抄的数值：

```glsl
// 1. 穹顶权重：中心 1 → 边缘 0（注意参数顺序，radius 到 radius*0.08）
float dome = smoothstep(radius, radius * 0.08, dist);
vec2  refractOffset = -dir * 0.06 * dome;          // 折射位移
// 2. 有机扰动（噪声）+ 涟漪
uv += simplex * 0.012 + normalize(dir) * sin(dist*35.0 - time*2.5) * 0.003;
// 3. 色散：红向外、蓝向内，偏移量随 dome 与边缘增强
float aberr = 0.003 * dome + 0.007 * edge;
vec2 uvR = clamp(uv + offset*1.07 + dir*aberr, 0.0, 1.0);
vec2 uvB = clamp(uv + offset*0.93 - dir*aberr, 0.0, 1.0);
// 4. 高光：方向光 + 菲涅尔 + 细边环
float spec = pow(max(dot(dir, lightDir), 0.0), 28.0) * dome * 0.40;   // lightDir = normalize(vec2(0.6,-0.45))
float fres = pow(smoothstep(r*0.25, r, dist), 0.55) * dome * 0.10;
// 5. 冷色染色
vec3 tint = vec3(0.93, 0.96, 1.06);
```

这篇文章同时把 CSS 路线的天花板说清楚了，正好可以用来解释本仓库为什么"到此为止"：

- `url()` in `backdrop-filter` 仅 Chromium ⇒ 必须设计 blur-only 情形
- **形变是静态的**（`feTurbulence` 只给一个固定扭曲场）
- **做不出色散，也做不出物理可信的高光；页面上的高光通常是手放渐变，不是从镜面几何推出来的**

最后两句尤其重要：**我们现在的边缘高光（inset glow）本质就是"手放渐变"**。这不丢人——苹果以外没人做到真推——但要清楚它是风格，不是光学。

注意：html-in-canvas 的 `<canvas content="drawable">` 需要 **Chrome 157+**，本仓库宿主是固定版本的 DSH Desktop，这条路线等价于"重写渲染器"，不在本轮范围。

---

## 5. 与本仓库现状的逐条对照

| 光学要素 | 苹果/社区做法 | 本仓库现状 | 差距判断 |
|---|---|---|---|
| 折射 | 双界面（入+出），kube.io 明说只做一次 | 单界面，SDF 剖面位移 | **最大结构性差距**，但补第二次折射需要采样玻璃外背景，等于换渲染架构 |
| 剖面 | squircle / lip / concave 可切换 | 圆角矩形 SDF + 可选 quad2 / global / ramp 缓动 | 已够用；换 lip 需同时调 bezel |
| 位移幅度 | kube.io 127 条光线求得的实际偏移 | 当前峰值目标为 `min(10, 0.4545 × bezel)` CSS px | 与"折射可见性阈值 0/0.5/1 可见、2 硬、4 消失"的实测一致 |
| 折返（翻字） | kube.io 未讨论 | 门限 `K/bezel > 0.52(m²)` / `>0.667(lin)` / `>1.0(ramp)`；当前 `c = 0.25` vs 临界 `c* = 0.53`，**约 2× 余量** | **这是社区文章都没有的量化护栏，加位移前必须先对着它算** |
| 色散 | kube.io 主动剔除；Cocos 用常量 `dispersionStrength`；html-in-canvas 用逐像素 `dir*aberr` | 默认关闭；历史实验以 0.07 实测最大通道差 50、426 px | 已"可见但不刺眼"。要做角度相关的色散，得从"常量 UV 偏移"改成"沿折射方向的逐通道缩放"，成本是每通道一次采样 |
| 边缘高光 | Cocos：`normalLen < 1 − highlightStrength` 时才叠加（默认 0.1，上限 0.2）；html-in-canvas：`pow(dot(dir,light),28)*dome*0.40` 方向光 | inset glow 参数化（最终 20px / −5px / 0.20 → 边缘 +7.2、中心 +0.0） | 我们的是 **各向同性**；方向光会让高光随光源方位偏移，是"更像苹果"里性价比最高的一项 |
| 表面模糊 | 苹果：regular（模糊+调亮度，文字密集）；clear（高透，浮在媒体上） | blur 1–2.9px + saturate + brightness | 数值落在可见下界（≥2px 即"硬"），与"文字清晰优先"一致 |
| 压暗层 | HIG：背景过亮时加 35% 深色压暗层 | veil 从 `.5` 调到 `.22`（浅色 `.10`） | **与 HIG 恰好相反**——我们主动减薄遮罩，"遮罩太黑会把折射信号砍半"。这是有数据支撑的偏离，但要在文档里写明它是偏离 |
| 可访问性 | 用户可开"降低透明度/降低动态效果"；这些设置"会移除或修改某些效果" | 目前无对应开关 | **合规缺口**，比任何光学增强都优先 |

---

## 6. 边界与限制：明确不能做的事

1. **不能宣称复刻苹果。** 官方零 shader 公开；HIG 只说行为不说实现。任何"Apple-grade"表述都应改为"Apple-inspired"。
2. **不能宣称 Safari 支持。** [245510](https://bugs.webkit.org/show_bug.cgi?id=245510) 仍 OPEN；Safari 26 发布说明里根本没有相关条目。跨端必须走 blink-only 分支 + blur-only 降级。
3. **单界面折射无法产生真实的镜片"倒影翻转"。** kube.io 的 Concave 剖面能把光线推出玻璃体外，但那要求采样元素外的背景——在 CSS 里做不到，在 WebGL 里也只是把"越界采样"换成"读屏幕纹理"。
4. **色散不是物理。** 冕牌玻璃在可见光范围 n 变化 ~0.008，折角差零点几度。屏幕上能看见的虹边都是夸张。
5. **位移贴图分辨率有上限。** 8-bit 通道 + `MAP_MAX_EDGE=256` + 重建成本 130ms，三重约束下"更精细的折射"没有免费路。
6. **动态尺寸/形状代价高。** kube.io："除了动画 `<filter>` 属性（如 scale），几乎任何微调都要重建整张位移图"。我们的做法是按元素尺寸缓存（`mapCache` 上限 8），本质是同一个权衡。
7. **backdrop-filter 会让 Chromium 关闭 LCD 次像素抗锯齿**（见 `docs/overlay-surfaces.md`），文本变灰阶——这是所有玻璃层的固有成本，不是参数问题。

---

## 7. 如果要往前一步：三条候选与优先级

| 优先级 | 候选 | 物理依据 | 实现代价 | 前置条件 |
|---|---|---|---|---|
| P0 | 可访问性开关（降低透明度 / 降低动态），对齐 [Adopting Liquid Glass](https://developer.apple.com/documentation/technologyoverviews/adopting-liquid-glass) | 官方要求 | 低（CSS 变量 + media query） | 无 |
| P1 | **方向性边缘高光**：把各向同性 inset glow 换成"固定光向 × SDF 法线"的方向光项 | html-in-canvas `pow(dot(dir,light),28)*dome`；kube.io "高光强度随表面法线与固定光向夹角变化" | 中（需要把 SDF 梯度在 JS 侧导出成光晕贴图，或改成第二张 mask） | 必须先跑 `g_edge` 回归，确认 6.54 / 6.50 关系不被破坏 |
| P2 | **角度相关色散**：色散量随 `m'(u)`（剖面斜率）缩放，而不是全元素常量 | Snell：偏折角越大色散分裂越大 | 高（每通道独立采样） | 需要先证明 `c = 0.25 / c* = 0.53` 的余量在加入角度项后仍成立 |
| — | 双界面折射 | kube.io 明确未做 | 极高（换架构） | 不在本轮 |

**不做的事**：提高位移幅度、加厚 bezel、加深 tint。v0.5.0 的验收数据（设置窗顶边 out/band/int = 15.73/12.75/11.49，带·内 0.81、内·外 0.73）说明连续性已经 PASS 且与 composer 对齐；这三项都会往"两块玻璃对缝"的老路上推。

---

## 8. 参考链接（全部实际访问过）

**指定来源**
1. Cocos 论坛 · Shader 教程二十：https://forum.cocos.org/t/topic/171941
2. Liquid Glass in the Browser: Refraction with CSS and SVG（2025-09-04）：https://kube.io/blog/liquid-glass-css-svg/
3. Liquid Glass Design（展廊）：https://liquidglassdesign.com/
4. 掘金 · Web 端液态玻璃实现对比：https://juejin.cn/post/7514618352829448244
5. Apple · Liquid Glass（Technology Overviews）：https://developer.apple.com/documentation/technologyoverviews/liquid-glass

**一手资料**
6. Adopting Liquid Glass：https://developer.apple.com/documentation/technologyoverviews/adopting-liquid-glass
7. HIG · Materials：https://developer.apple.com/design/human-interface-guidelines/materials
8. WebKit · News from WWDC25（Safari 26 beta）：https://webkit.org/blog/16993/
9. WebKit bug 245510（backdrop-filter + SVG filter 不生效，OPEN）：https://bugs.webkit.org/show_bug.cgi?id=245510
10. WebKit bug 297770（accelerated filters 不能用 SVG filter）：https://bugs.webkit.org/show_bug.cgi?id=297770
11. liquid-glass-js（filter-on-DOM 方案）：https://github.com/amir-abushanab/liquid-glass-js
12. Liquid Glass Effect · HTML in Canvas：https://html-in-canvas.dev/liquid-glass-effect/
13. aemisdr · 光学与数学审查（machine-checked proofs）：https://github.com/aemi-studio/aemisdr/blob/main/docs/roadmap/0018-optical-and-mathematical-review-of-the-shaders.md

**仓库内证据**
14. `lib/client.js` · `createLiquidGlass` / `buildMap`（L1839–1928 折返门限、编码、方向）
15. `docs/liquid-glass.md`（色散与可见性实测）
16. `docs/liquid-glass-v050-final.md`（v0.5.0 定稿参数与验收）
17. `docs/adaptation-20261113-liquid-glass-v2.md`（根因复盘）
18. `docs/overlay-surfaces.md`（次像素抗锯齿代价）
