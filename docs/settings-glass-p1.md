# 设置窗液态玻璃 · 第一性原理方案（P1 · p1-designer）

> 回答 `settings-glass-brief.md` 的 **Q3**：既然面板内部采样不到面板外（F3），
> 「边缘有折射」在**合成层面**还剩哪些路？哪些能做出来？哪些只是感觉能做出来？
>
> 本文的每一条断言后面都标了实验编号与产物路径（`D:\DSH Workspace\_p1\`）。
> 没做到实验、只有推理的，一律标「**推理，未验证**」。
> 插件源码只读，未修改。实验脚本：`e9d / e10 / e12 / e12b–e12e / e13 / e14 / e14b / e15b / e17 / e19 / e20 / e21 / e22 / e23 / e24.cjs`。

---

## 0. 一句话结论（先看这个）

**能做出来的唯一路径是：把面板自己的背景变透明，让「面板背后的真实画面」成为
某个带 `backdrop-filter` 的元素的 backdrop；同时用一块独立的、不透明的内层垫底，
保证中间文字清晰。**
但这条路径撞上一个**硬限制**：能让 backdrop 采到面板外画面的那套结构（透明面板 + 子元素玻璃带），
会让 `backdrop-filter` **失效在圆角外侧的过渡区**（每条边的首尾各约 4.7px，四角各 16×16px），
那里会退回**父层纯色或硬边界画面**。这条限制与「面板圆角」不可兼得——见 §A/C3/C5/D1。

**在当前代码形态下唯一能立刻做、且不引入任何新失败模式的，是把 v0.2.17 的「镜像墙」换成
「面板透明 + 不透明核心垫底 + 四条玻璃带」**（§C.1，实测可见，见 `out/E27c_rich_rec.png`）。
它的视觉代价是圆角处有一小片锐利画面，需要人眼判断是否可接受。

> **⚠️ 本节结论已被 §E 修订（务必一起读）。** §E 承认：面板透明是**实现手段**不是验收目标；
> 中间能逐像素还原（`E25c` 0.00 %）但有两道硬前置（内容让开 28px、圆角可接受），
> 且**背后若是纯色遮罩则本方案收益为 0**。**交付顺序已改为：先做 §E.4 的 V2（纯 CSS，零风险），
> 玻璃带只作可开关的增强。**

---

## A. 约束清单（把问题归结成不可违背的硬约束）

**C1 — 采样守恒：backdrop 只对「元素背后、已绘制」的像素做运算，对均匀色做任何运算结果仍是该均匀色。**
- 因为面板是 800×800 不透明深色，它内部任何元素的 backdrop 都是那片深灰，所以**面板内部不可能产生可见玻璃**。
- 违反会怎样：条子/环带全装上、参数全对，画面**逐像素不变**（brief F3；本轮 `E17` V0：复刻镜像墙，
  带内亮度 SD 56.00 看着"有东西"，但那是 `blur(10px)` 糊出来的光晕，不是折射；与 `E1_base` 对照可见本质是死色）。
- 推论（C1 的正向用法）：**面板只有"自己先不画像素"，内部元素的 backdrop 才可能轮到页面。**

**C2 — 合成上下文剥离：backdrop 是「元素自身的合成上下文」在背景层被剥离后的结果。**
- 注意：这不是"把背景画一遍"。`E21`：面板 `background:transparent` 时，贴在面板边框环里的玻璃带
  **采到了面板背后的页面图案**（带内 SD 8.10，带外 SD 8.81，剖面 58,62,67,71,… 是圆点网格）；
  `E20`：覆盖层外扩到面板**之外** 16px，那 16px 环里是**纯色 30**，带里才是画面。
- 所以：**玻璃带必须落在面板自己的边框环内、面板背景必须透明**；把玻璃放到面板外扩的位置反而采不到东西。
- 违反会怎样：要么全白/全死色，要么四边各偏一块（`E20` cover：外环 SD 0.00）。

**C3 — 圆角剥离成本：面板自己的 `border-radius` 会把圆角外侧的 backdrop 剥成"父层纯色"。**
- `E9d`：直角处内带有内容、圆角处内角是**死的纯色**；`E10`：在面板轮廓外加 1–2px 实色描边环**盖不住**
  4.7px 宽的过渡楔形，而且描边环自己也露出在圆角外。
- 违反会怎样：圆角处出现 16×16 的"缺角"（`E12` L_full 角对角线 `69,70,70,71,72,37,30,30…`）。

**C4 — backdrop root：祖先链上一旦出现 `filter / transform / opacity<1 / will-change / backdrop-filter / contain`，backdrop 就重新锚定到那个祖先。**
- `E21` 的 `.panel{isolation:isolate}` 不构成破坏（A 组 SD 71.13/16.40），但 `.panel` 若被 React 加了
  `transform` 或 `filter`（动画/弹层进场很常见），panel 内所有子元素都会采到"transform 之后"的空底。
- 违反会怎样：玻璃**无声消失**，且 computed style 里看一切正常——这是最难 debug 的失败模式。

**C5 — 圆角只作用于"绘制"，不作用于"滤镜输出"。**
- 现象（`E9d`）：同一元素，直角处玻璃=原始图，加 `border-radius` 后玻璃在半径内被"回退成父层纯色"；
  再加 SVG 滤镜，回退区域变成"先取近邻、再位移"的**硬边界**（`round_f` vs `round_nf` 逐行不同）。
- 违反会怎样：圆角处出现**锐利但被位移拉歪的画面**：小半径（16px）看不出来，大半径会很难看。

**C6 — `mask-image` 与 backdrop-filter 互斥。**
- `E19`：带 mask 后带内 SD 0.00，与"全遮住"完全一致，即 mask 把 backdrop 结果一并裁掉（brief F5 复现）。
- 违反会怎样：想出"只让边缘可见"的 mask 方案，一律等于没有玻璃。

**C7 — 滤镜坐标系是「元素自己的盒子」，不是页面。**
- `E22`：四组（M1 共用一份 filter / M2 各自 offset / M3 单个边框盒 / M4 小贴图）**输出逐像素相同**，
  说明"userSpaceOnUse 让共用贴图错位"这个担心**在 Chromium 不成立**；反过来，**条子盒越窄，
  整面板位移贴图被塞进条子盒时被压缩/裁切得越狠**，观感只能靠"这一带贴图对应页面哪一段"来理解。
- 违反会怎样：右/下两条折射方向错、或四条观感不一致（已在源码注释里记录过一次）。

**C8 — 面板若必须是「全尺寸不透明底」，则 C1 直接判死边缘玻璃。**
- 这不是"较难"，是"不可能"。可选项只剩下：改面板底色形态（C1 允许）、或不用 backdrop（方案 4）。

---

## B. 候选方案（逐个做第一性分析）

### B1 面板背景半透明化 + 边缘环带（中间靠独立实色层兜底）

- **机制**：`.panel{background:transparent}`，内部放 4 条 28px 玻璃带（各自 `backdrop-filter:url(#fi) blur(1px)…`），
  再放一个 `inset:28px` 的不透明 `.core` 把中间垫死。数据流：玻璃带的 backdrop = 面板背后的页面（**不是**面板），
  因为面板自己不画像素（C2）；中间的 `.core` 不参与 backdrop，只负责不透明（C1 的"看不到"被它接管）。
- **如何满足"边缘有折射 / 中间清晰"**：边缘带里是**真实画面**被 SVG 位移贴图弯折（`E23_A.png`：左带 SD 71.13、
  上带 SD 16.40，剖面呈周期性弯曲；带下方青色竖条纹属于 `.core` 的干净底色）。中间由 `.core` 提供 100% 不透明底，
  文字像素与不透明版**完全一致**（`E2`：内容区与不透明参照 0 差异）。
- **失败条件**（全部实测过或在其他实验里出现过，按触发概率排序）：
  1. **面板 `border-radius` 存在时，圆角过渡区退回"父层纯色"或露出硬边界画面**（C3/C5）——实测 `E12`
     L_full / L_loc / L_nofilter 三组角对角线**完全相同**（`69,70,70,71,72,37,30,30…`），
     参数怎么调都一样（见 §D1，这是本方案最大的洞）。
  2. 面板祖先链被加了 `transform/filter/opacity`（C4）→ 全消失。
  3. 面板背景被 React 改回实色（DSH 升级、主题切换、动效 class）→ 立刻退回"没变化"。
  4. 玻璃带 `z-index` 被内容层压过、或面板 `overflow:hidden` 把带子裁在圆角外。
  5. `w*h < LIQUID_RING_MIN_AREA`（260000）走的是"整块面板挂 backdrop"分支（`client.js:1242`），要分叉。
  6. `.core` 尺寸算错（`inset` 简写、box-sizing）→ 中间露页背 → 文字不可读。历史上 v0.2.14 就栽在 `inset` 简写上。
- **对宿主 DOM 的侵入**：**低**。只改面板的 `background`（由 inline style 覆盖，宿主 CSS 不动）、
  插 5 个子元素（4 带 + 1 核）。**不新增祖先、不改祖先样式**，不影响页面其它区域，输入框一行不碰。
- **判定**：✅ 唯一"看得见"的方案。⚠️ 圆角过渡区是未解决的硬伤。

### B2 面板外部叠加层（兄弟节点）做边缘玻璃，不碰面板本身

- **机制**：在面板的父节点下插一个绝对定位兄弟 `cover`（与面板同 rect 或外扩 N px），它是唯一带
  `backdrop-filter` 的元素；面板本身只负责不透明底与布局。数据流：cover 的 backdrop = 面板**背后的页面**，
  因为 cover 与面板是兄弟，cover 背景不透明 → 面板在自己的合成上下文里被剥离。
- **如何满足"边缘/中间"**：靠 `mask` 或"中心透明"来只保留边缘（见失败条件）。
- **失败条件**：
  1. **外扩版直接失败**：`E20` 覆盖层外扩 16px，那 16px 环里 SD **0.00**（纯色 30）——外面什么都采不到。
  2. **同 rect 版必须打孔**：同 rect 且整块不透明 → 把面板整个盖住；打孔就得用 `mask` → C6 判死（`E19`）。
  3. **外扩版要"只保留环"**：靠 `background: linear-gradient(...)` 画环 + `mask` 二选一，两者都回到 C6。
  4. cover 与面板必须同属一个不含 transform 的定位层（C4）；面板若被包在 `transform` 进场的容器里，
     cover 进不去 → 采到空。
  5. 更高层（overlay 遮罩/backdrop 是 `oklch(.1 0 0/.8)` 这种）若本身就是合成层，cover 采到的是它（=死黑色）。
- **对宿主 DOM 的侵入**：**中**。要往**面板的父节点**插兄弟元素（需要找到稳定父节点，不能编类名）；
  面板尺寸/位置变化要同步 cover（ResizeObserver）。
- **判定**：❌ 作为主方案不成立（E20/E19 双重证伪）。**保留为"锚点即面板外"的备选**，
  仅当面板本身不能改动、且兄弟层确实在同一个无 transform 的容器里时，才值得再试一次（需 Q1 的真实 DOM 才能判断）。

### B3 用 `element()` / SVG `foreignObject` 把背后内容"复制"进滤镜

- **机制**：试图让滤镜自己去"画"一份背景（`backdrop-filter: element(#id)` 或 `feImage` 引用 SVG `<image>`），
  再把这份副本位移后当做边缘带的内容。
- **为什么不做**：
  1. `backdrop-filter: element(...)` 在 Chromium **从未实现**（`CSS.supports` 直接 false）；源码里
     `CSS.supports("backdrop-filter","url(#x)")` 的守卫只覆盖 `url(#filter)`（`client.js:1290`）。
  2. SVG `feImage` 不能引用活的 DOM；`foreignObject` 放进 `<defs>`/滤镜管线里**不渲染**（SVG 规范层面
     `foreignObject` 只能做渲染内容，不能做滤镜输入）。
  3. 退一步：用 `html2canvas` 之类把页面"拍照"再 `feImage` 引用——性能上每次滚动/动画都要重拍 1180×980，
     且拍不到 WebGL 画布与跨域图片；并且快照与真实背景一旦错位（滚动、动画、立绘呼吸）就会撕裂。
- **失败条件**：浏览器不支持（100%）；或快照滞后（动效场景必现）。
- **对宿主 DOM 的侵入**：高（要外包库、要拦截滚动）。
- **判定**：❌ 死路，且是**这一轮最容易被人"想到"的假解**（因为它听起来像"复制"）。

### B4 放弃 backdrop 折射，纯 CSS「边框高光 + 内侧渐变 + 轻微内阴影」

- **机制**：在面板边框环（`border:28px transparent` + `background-clip:border-box` 或 pseudo）里画
  conic/linear 渐变 + `inset` 高光与内阴影，做出"玻璃壳"的厚度感；**不采任何背景**。
- **如何满足"中间清晰"**：完全不碰中间（只看边框环），中间像素零损失（`E24` A/B/C 剖面里 x=28 之后都是 30）。
- **失败条件**：
  1. **它不是折射**：`E24` B 组剖面 `33,33,33…33,30`（一圈死色），C 组 `65,65…65,30`（一圈死色）。
     背景怎么变，它都是那个颜色 → 用户第一眼看到的就是"又一圈假边框"，v0.2.6~v0.2.9 已被否过。
  2. 面板底色一变（浅色主题），高光参数全部要重扫。
  3. 深色主题下对比度不够，会读成"发灰"。
- **对宿主 DOM 的侵入**：**最低**（只加一条伪元素/一条 box-shadow，甚至可以用 inline style）。
- **判定**：❌ 当主方案不够（不是用户要的东西）；✅ **当兜底**：在 B1 边缘带上再叠一层内高光/内阴影，
  让"透出来的画面"更像玻璃而不是"一块贴纸"（`.hl`，见 §C.1）。

### B5（推导出的）C1 反转：把"不透明"从面板移到**内层核心**，并把 `border-radius` 从面板移到核心

- **机制**：`.panel{background:transparent; border-radius:16px}` → 改为
  `.panel{background:transparent}` + `.core{inset:0; background:#1a1e26; border-radius:16px}`，
  玻璃带放在**核心之上**的 0..28px 环里。这样面板自己没有圆角遮罩，C3/C5 的"圆角剥离"只作用在 `.core`，
  而 `.core` 不采样，**它被剥成什么都不影响观感**。
- **为什么它比 B1 更接近正解**：C3 说"圆角会把 backdrop 剥成父层纯色"——那条约束只对**承载 backdrop 的元素自己**
  成立。把圆角交给**不带 backdrop 的垫底元素**，玻璃带就可以是**直角矩形**，圆角观感由 `.core` 提供。
- **失败条件**：
  1. 玻璃带是直角 → 面板四角在"带子覆盖区"内是方的，18px 外弧只能靠 `.core` 画，两者之间会有 **1–2px 的视觉错位**
     （`E24_A` 里就能看出：外弧=圆、内侧=圆，中间那条 28px 环是方的）——需要人眼定夺。
  2. 面板的 `overflow`/`clip-path`/`box-shadow` 若是宿主写的圆角裁剪，仍会把带子裁成圆角（退回 C5）。
  3. 宿主若用 `border` 画分隔线，`.core` 的圆角与宿主 box-shadow 会打架。
- **对宿主 DOM 的侵入**：**低**（同 B1，只是把 `border-radius` 的归属挪了一层）。
- **判定**：⚠️ 推理上有道理，但**没有做实验**就写进方案不负责——**推理，未验证**。这是我认为最值得先做的实验（§D1 的变体）。

---

## C. 收敛：推荐方案

### C.0 用约束逐条检验

（B4 一列全是 ✅ 但它"不是折射"，所以不能只看约束——最后一行才是决定性判据。）

| 约束 | B1（透明面板 + 玻璃带 + 内核） | B2（兄弟叠加层） | B3（复制背景） | B4（纯 CSS） | B5（圆角挪给核心） |
|---|---|---|---|---|---|
| C1 采样守恒 | ✅ 带子的 backdrop 是页面 | ✅ 但只在同 rect 时 | ✅ 理论上 | ✅ 不需要 | ✅ |
| C2 合成剥离 | ✅ **E21 实测采到页面图案** | ❌ **E20 实测 0.00** | — | ✅ 无风险 | ✅ |
| C3 圆角剥离 | ⚠️ 圆角过渡区露锐利画面 | ❌ 同类问题 + 打孔 | — | ✅ 无风险 | ⚠️ 需要实测（未验证） |
| C4 backdrop root | ⚠️ 依赖祖先干净 | ❌ 更易踩（兄弟层不在同一容器） | — | ✅ 无风险 | ⚠️ 同 B1 |
| C5 圆角只作用绘制 | ❌ 未解决（见 D1） | ❌ | — | ✅ | ⚠️ 可能解决 |
| C6 mask 互斥 | ✅ 不用 mask | ❌ 必须用 mask | — | ✅ | ✅ |
| C7 坐标系 | ✅ 沿用现有四套 offset 正确的 filter | ✅ | — | ✅ | ✅ |
| C8 不透明底 | ✅ 不透明底挪进 `.core` | ✅ 同 B1 | — | ✅ | ✅ |
| 侵入度 | 低 | 中 | 高 | 最低 | 低 |
| **能"看得见"吗** | ✅ **能**（E23_A） | ❌ 不能（E20） | ❌ 不能（无 API） | ❌ 不是折射 | ? 未验证 |

**推荐 B1（E23_A 形态）**，理由只有一条：在**所有实测能看见玻璃的方案**里，它是唯一同时满足 C1/C2/C6/C7/C8 的；
B2 被 E20 证伪、B3 被 API 现实证伪、B4 被用户观感证伪。B5 是 B1 的改进方向，但尚未验证，不能作为交付方案。

### C.1 可直接落地的 DOM 与 CSS

**目标态**（`client.js:installRing` 里替换掉"四根条 + 四块镜像墙"）。
⚠️ 下面 HTML 里的 `wCInkW_panel` **只是示意**——按 brief §4 第 4 条，写进真实代码前必须先在产物里 grep 到命中。
选择器一律用**属性锚点**（`data-mc-glass-*`）或"`[data-mc-glass-ring]` 的 parentElement"，不依赖 CSS Module 类名。

```html
<!-- 面板 = .panel（宿主节点）。我们只改它 3 个 inline 属性，不动宿主 CSS。 -->
<div class="wCInkW_panel" data-mc-glass="panel"
     style="position:relative; background:transparent; overflow:visible; isolation:isolate">

  <!-- ① 四条玻璃带：各自一套 offset 正确的 filter（现成的 inst.ringFilters[0..3]） -->
  <div data-mc-glass-ring="0" style="top:0;left:0;right:0;height:28px;border-radius:16px 16px 0 0;
       backdrop-filter:url(#<id>-b0) blur(1px) saturate(1) brightness(1.05)"></div>
  <div data-mc-glass-ring="1" style="bottom:0;left:0;right:0;height:28px;border-radius:0 0 16px 16px; …url(#<id>-b1)…"></div>
  <div data-mc-glass-ring="2" style="top:0;bottom:0;left:0;width:28px;border-radius:16px 0 0 16px; …url(#<id>-b2)…"></div>
  <div data-mc-glass-ring="3" style="top:0;bottom:0;right:0;width:28px;border-radius:0 16px 16px 0; …url(#<id>-b3)…"></div>

  <!-- ② 不透明核心：把"中间清晰"从面板身上接过来 -->
  <div data-mc-glass-core style="position:absolute;inset:28px;background:#1a1e26;
       border-radius:10px;z-index:2;pointer-events:none"></div>

  <!-- ③ 玻璃壳高光（纯 CSS，替代镜像墙承担"像玻璃"的那一半） -->
  <div data-mc-glass-hl style="position:absolute;inset:0;border-radius:16px;z-index:3;pointer-events:none;
       box-shadow: inset 0 1px 0 rgba(255,255,255,.10), inset 0 0 0 1px rgba(255,255,255,.06)"></div>

  <!-- ④ 宿主原来的内容原样保留在面板里（z-index 高于 core 即可见） -->
</div>
```

**关键 CSS（逐条对应约束）**：

```css
/* 约束 C2：面板必须自己不画像素，backdrop 才轮到页面 */
[data-mc-glass="panel"] {
  background: transparent !important;   /* ← 这条是"能不能看见"的唯一开关 */
  overflow: visible !important;         /* ← 否则 28px 带子被裁进圆角矩形 */
  position: relative;                   /* 带子需要定位祖先（宿主已是 static 时补） */
  isolation: isolate;                   /* 可选：E21 证明它不破坏 backdrop，只防内容层串层 */
}

/* 约束 C3/C5：**不给带子加 border-radius**。圆角交给 core。 */
[data-mc-glass-ring] {
  position: absolute;
  z-index: 1;
  pointer-events: none;
  -webkit-backdrop-filter: url(#<id>-b0) blur(1px) saturate(1) brightness(1.05);
  backdrop-filter: url(#<id>-b0) blur(1px) saturate(1) brightness(1.05);
}

/* 约束 C1：核心必须**完全不透明**且比带子低一层，否则带子采到核心 → 均匀色 → 不可见 */
[data-mc-glass-core] { background: #1a1e26; }

/* 唯一"像玻璃"的纯 CSS 增量：1px 内高光 + 极淡内阴影（B4 作为兜底视觉） */
[data-mc-glass-hl] { box-shadow: inset 0 1px 0 rgba(255,255,255,.10), inset 0 0 0 1px rgba(255,255,255,.06); }
```

**JS 侧的改动点（只改 `installRing` 尾部，filter 生成逻辑一行不动）**：
1. 删掉 `inst.mirrors` 四块（`client.js:1182-1201`）——**已证伪**：`E17` V0 镜像墙，带内 SD 56.00 但不是折射，是
   `blur(10px)` 糊出来的光晕；它采的仍是条子自己的 backdrop。
2. 新增 `.core`（`inset:28px`，不透明，z-index 2）。
3. 给 `el` 写 inline `background:transparent`（保存原值，`removeRing` 时还原）。
4. 四条带的几何、`border-radius`、filter 都保持现状不变（`E22` 证明它们**本来就对**）。

**取舍说明**：如果产品不接受"圆角过渡区露锐利画面"（§D1），那么**没有**任何 backdrop 方案能同时满足
"圆角 + 边缘折射"。此时应回退 B4，并把参数扫到"最像贴膜"的位置（`E24` C 组：`inset 0 0 18px -6px rgba(212,232,255,.30)` +
`linear-gradient(180deg, rgba(255,255,255,.10), transparent 40%, rgba(0,0,0,.12))`），并明确告知用户"这是模拟，不是折射"。

---

## D. 风险与证伪（最没把握的 3 个假设）

### D1 「圆角过渡区退回纯色/硬边界」我能修掉（把圆角从面板挪给 `.core`，见 §B5）
- **我的假设**：那是"面板自己的 border-radius 把 backdrop 剥离"造成的，只要承载 backdrop 的带子不再有圆角、
  圆角交给不带 backdrop 的 `.core`，角落就能恢复。
- **5 分钟最小实验**（headless Chrome 一个文件即可）：
  1. 复刻 `e12.cjs` 的 `localFrame()`，但把 `border-radius:16px` 从 `.panel` 挪到 `.core`（带子不设圆角）。
  2. 截图后读角部对角线：`for i in 0..12: lum(PL+i, PT+i)`。
  3. 判据：若出现 `…30,30,30`（纯色，同现在）则**假设被证伪**；若出现与 `x=PL+200, y=PT+i` 相同的原始图案
     列（即画面"穿到角上"），则假设成立但观感是"方角玻璃环"，仍需人眼定夺。
  4. 对照：`E12` 已知结果 `69,70,70,71,72,37,30,30,30…`；`E10` 已知"1–2px 实色描边环盖不住"。

### D2 「真机上设置面板的祖先链是干净的（无 transform/filter/opacity）」
- **我的假设**：面板是 overlay 里一个普通定位元素，祖先没有制造 backdrop root 的属性（C4）。
- **5 分钟最小实验**：
  1. `node e16.cjs`（真机探针，CDP 零依赖）→ 打开设置 → 落盘 `e16_probe_result.json`。
  2. 看 `ancestors[*].transform / filter / opacity / willChange / contain / backdropFilter` 是不是都是 `none`/`1`。
  3. ⚠️ 我实测跑了，但本机 headless 访问 `http://127.0.0.1:14311/` 时返回
     `dsh web authentication required; reopen the URL printed by dsh web.`（`e16_boot.json`）——
     **这条路需要带鉴权的 URL，或让 Lead 直接在真机 DOM 上跑 `e16.cjs` 里的 `E.probe` 表达式**。
  4. 判据：任何一项非 `none` → 推荐方案需要额外插入一个干净的定位层，否则会无声失效。

### D3 「玻璃带落在面板边框环内时，backdrop 真的采到面板背后的页面」
- **我的假设**：面板透明后，带子的 backdrop = overlay 背后的立绘/皮肤画面。`E21`/`E23_A` 已在 mock 上成立，
  但 **DSH 设置窗背后可能不是立绘**——整个 overlay 可能自带一层 `oklch(.1 0 0/.8)` 的实色遮罩，
  那样带子采到的就是遮罩（均匀 → 不可见），**与"面板内部"一模一样**。
- **5 分钟最小实验**：
  1. 在真机 DOM 上（Q1 拿到结构后）把面板 inline 设成 `background:rgb(255,0,0)`，截图确认面板确实在最上层；
     再设 `background:transparent`，看面板背后**露出的是立绘还是纯遮罩色**。
  2. 若背后是纯色遮罩：把 overlay 那层的 `background-color` 只降 alpha（不改色相）再测一次。
  3. 判据：带内亮度标准差 > 2 才算"采到了内容"；0 则 D3 被证伪，须回到 B4。

### 附：本轮被实验直接打死的旧假设（避免重复走）
- 「镜像墙能让条子采到面板外」——`E17` V0：带内是 `blur(10px)` 的光晕，不是折射；条子的 backdrop 仍是面板底色。
- 「mask 只保留边缘」——`E19`：mask 生效即等于没玻璃（SD 0.00 = 全遮住）。
- 「面板外扩一层再采」——`E20`：外扩环里 SD 0.00。
- 「共用一份 filter 会错位」——`E22`：M1/M2/M3/M4 逐像素相同，Chromium 的 userSpaceOnUse 不含这个坑；
  条子的 filter 几何**本来就是对的**，不需要重做。
- 「直角/圆角只是几何差异」——`E9d`：同一滤镜、直角处玻璃等于原始图，圆角处被剥离；且加不加 SVG 滤镜，
  角部剖面逐像素相同（`E12` 三组 L_*），说明**角部问题不在滤镜链**。

---

## E. 对抗追问（lead 2026-10-18 的反驳，逐条作答）

> **先承认 lead 的核心指控是对的。** "和对话框一样就行，对话框不要动了" 的**验收含义**是
> 「边缘观感同款 + 中间与改动前一样清晰」，**不是**「面板内部随便露什么」。§C 里我写"面板 background:transparent"
> 是**实现手段**，我在 §C 里没有把它和"中间会露出立绘"这个风险讲清楚——这是 §C 的缺陷，这里改正。
> 下文所有数字都是本轮新做的实验（`e25 / e25b / e25c / e26 / e27c.cjs`），判据可复现。

### E.1 中间能不能**逐像素**和改动前一致？——**能，条件是 `.core` 必须盖满带子没盖住的地方**

| 变体 | 中间区（inset 28+60，即玻璃带以外 60px 起）与"不透明面板参照"的差 |
|---|---|
| 推荐（透明面板 + 四条 28px 玻璃带 + `.core{inset:28px}` 不透明） | **max = 0，非零像素 0 / 389 376（0.00 %）** |
| 同上但关掉带子的 backdrop-filter（用来分离"带子自己的绘制"） | max = 0，非零 0.00 % |
| 同样的 `.core` 但内容层 `inset:0`（正文压在左侧带下面） | 正文被带子覆盖 → 差到 229 |

**结论**：`.core` 用 `inset:28px` + 面板底色**同一个不透明色**，中间区与改动前**逐像素相同**（`E25c` / `E27c`：三张背景 rich/plain/grain 全部 `核心区 max=0 非零=0.00%`）。
**但这不是免费的**：`E25` 第一次测出 1.376 % 非零像素（max 132），定位后发现是**宿主正文压在左侧 28px 带子上**——
正文第一行 `padding-left` 只有约 10px，落在带子里。**这一条必须同时改**：宿主内容要能缩进 ≥ 28px，
或者接受"正文左起 18px 会被玻璃带盖住"。**改不动宿主内容 = 这一方案直接不可用**（这是比圆角更硬的约束，
见 E.2 的判据）。

### E.2 边缘 28px 环是"谁在承担背景"？——**带子承担，且中间是一刀切的断层**

这不是"边缘透出、中间实色"的**渐变**，而是**28px 处一条 1px 宽的硬边**。`E25c` 实测剖面（面板底色 `rgb(26,30,38)` = 亮度 30）：

| 向面板内 | 0px | 4px | 8px | 16px | 24px | **28px** | 32px | 60px | 120px |
|---|---|---|---|---|---|---|---|---|---|
| 不透明参照（改动前） | 30 | 30 | 30 | 30 | 30 | 30 | 30 | 30 | 30 |
| 推荐（上边缘，x=面板中线） | 27 | 27 | 27 | 27 | 27 | **30** | 30 | 30 | 30 |
| 推荐（左边缘，y=面板中线） | 46 | 45 | 45 | 46 | 45 | **30** | 30 | 30 | 30 |

- **不透明参照**：`30,30,30…` 全平 —— 因为面板不透明，带子采到的就是面板底色（= C1，什么都不发生）。
- **推荐**：环内是**整块被采到的背景**（上 27 / 左 46），在 28px 处**一步跳回 30**。
  这是"边缘透出、中间实色"的**真实形态**：不是突兀渐变，而是**没有过渡的硬切**。
- 观感（`out/E27c_rich_rec.png`）：背景是蓝色柔光时，那圈玻璃就是一圈**蓝色内嵌边**；
  当背景是纯色遮罩时（下行），它等于没有。
- 所以答案是：**是的，会出现断层。** 它是否可接受取决于"环内有内容"这件事本身成立与否（见 E.3）。

### E.3 D3（背后是 `oklch(.1 0 0/.8)` 深色遮罩）——**风险很大，且一旦成立，推荐方案在真机上等于零收益**

三种背景，同一套结构（`E27c`，每张图都带背景自检）：

| 背景 | 推荐方案 · 上带 SD / 与不透明参照的最大差 | 纯 CSS 壳（V2）· 上带 SD / 最大差 |
|---|---|---|
| rich（立绘 + 横向彩色带） | **SD 20.82，最大差 63** | SD 1.03，最大差 8 |
| plain（`oklch(.10 0 0)` 均匀遮罩） | **SD 0.00，最大差 27** | SD 0.43，最大差 4 |
| grain（遮罩 + 1.5 % 噪点） | **SD 0.00（左 1.63 / 右 0.00），最大差 20** | SD 0.48，最大差 5 |

- "SD 0.00 但最大差 27" 的含义：环内是一块**完全平的颜色**，只是这块颜色和面板底色**不一样深**
  （背景比面板亮/暗 → 整圈变成一个同色环）。**这正是 lead 说的"又一圈假边框"。**
- **我的风险评估：D3 成立的概率 ≥ 60 %。** 依据：设置窗是一个 `role=dialog` 的 modal，
  这类弹层在 DSH 里带 `oklch(.1 0 0/.8)` 级别的遮罩是常规做法（`docs/overlay-surfaces.md` 记录设置窗族用
  `--dsw-alias-bg-layer-2` 84 % + blur 12px，也是同一类"把背后压成均匀深色"的手段）。**没有真机数据前，这条只能按"可能成立"设计。**
- **无法证实时的保守做法（推荐）**：
  1. **先做零风险的 V2**（见 E.3 下方），把"玻璃感"这一半拿到手；
  2. 玻璃带做成**开关**，默认关；只有在真机上确认"面板背后有可辨内容"（查 `getComputedStyle` 的
     overlay 祖先 + 截屏比对带内 SD > 2）时才打开；
  3. **不要**为了让它"看起来有玻璃"而给带子加半透明白/彩色渐变 —— 那是把假边框换个说法（C8）。

### E.4 删掉镜像墙、而 D3 成立时，推荐方案在真机上还剩什么？

- **镜像墙本身早就该删**：`E17` V0 的带内 SD 56.00 来自 `blur(10px)` 糊出来的**光晕**，
  它采的是条子自己的 backdrop（= 面板底色），**不是**面板外的画面。留着它 = 在面板边缘糊一圈雾，反而更脏。
- **删掉后、D3 成立时，推荐方案剩余效果 = 0**（`E27c` plain 行：SD 0.00）。这一点我不辩解。
- **此时应该退到 V2（纯 CSS 玻璃壳）**，它反而**有**可见效果，且**不依赖背景**：

| 向面板内 | 0px | 4px | 8px | 16px | 24px | 32px | 60px |
|---|---|---|---|---|---|---|---|
| V2 上边缘（`E26`，亮度剖面） | **88** | 40 | 36 | 31 | 32 | 32 | 32 |
| V2 左边缘 | **59** | 37 | 34 | 29 | 30 | 30 | 30 |

  即：1px 亮线（88）→ 8px 内衰减（40→36→31）→ 平。**这是"厚度感"，不是"折射"**，但它有方向、有衰减、
  背景怎么变都在，而且**中间必须完全不透明**（V2 的 84 % 多一道 16px 内阴影，峰值差 8——远小于玻璃环）。
  观感：`out/E27c_rich_css.png`（整页）、`out/E26_V2_TL.png`（左上角 4 倍：外 1px 亮边 + 内侧柔和衰减 + 圆角干净）。
- **V2 的落地 CSS（可直接用，不需要改宿主 DOM）**：

```css
/* 只改面板自身 2 个属性：background + box-shadow。不新增元素、不动 overflow、不动子内容。 */
[data-mc-glass="panel"]{
  background: linear-gradient(180deg, rgba(28,33,43,.96), rgba(22,26,34,.98)) !important;
  box-shadow:
    0 24px 70px rgba(0,0,0,.55),          /* 外层投影，拉开与背景的距离 */
    inset 0 1px 0 rgba(255,255,255,.14),  /* 贴边 1px 亮线：反射光 */
    inset 0 0 0 1px rgba(255,255,255,.07),/* 内描边：界定边缘 */
    inset 0 0 22px -6px rgba(212,232,255,.28) !important; /* 内辉（沿用 docs/liquid-glass.md 的参数量级） */
}
```
  ⚠️ `box-shadow` 会覆盖宿主 `--dsw-elevation-soft` 的投影——按 `docs/liquid-glass.md` 的教训，
  必须把宿主原值写回（`var(--dsw-elevation-soft)` 作为第一段），而不是直接整条替换。

### E.5 结论修订（改 §0 与 §C）

- **§0 的"唯一路径"改为**：**先把 V2 做对**（零风险、不依赖背景、不露立绘、可立即交付）；
  **玻璃带作为可开关的增强**，仅在真机确认"面板背后有内容"后启用。
- **§C.1 的推荐结构保留**，但补两条硬前置：
  (a) 宿主内容层必须能让开 28px（否则正文被带子盖住，`E25` 的 1.376 % 非零就是证据）；
  (b) 面板圆角处必须接受"过渡区退回纯色/硬边界"（`E9d/E12`，**至今无解**）——
  若这条不合格，玻璃带**不能上线**，只能留在 V2。
- 一句话：**能保证的是 V2；玻璃带是"条件成立时更接近对话框"的可选增强，条件不成立时必须能干净关掉。**

---

## F. 方案 B（面板自身半透明 + 整块 backdrop-filter）与降级 V3

> 回答 lead 2026-10-18 的要求：给方案 B 配一份**同构的 CSS 兜底**，B 一旦被证伪能立刻降级。
> 本节所有"真机常量"来自 `docs/settings-glass-adversarial.md` §1 与 `@deepseek-ai/dsh-client-ui-theme`
> 的 token 实际取值（暗色/亮色**各一组**）；本节所有数字来自 `e28.cjs`（1180×980，headless Chrome 155）。

### F.0 先说结论（必读，含一条反对意见）

1. **方案 B 的物理前提成立。** 面板的 backdrop = `.VOzbGW_mask` 之上合成出来的画面，
   而 mask 是 `rgba(0,0,0,.5)`，所以**背后的立绘/壁纸至少有 50% 穿透到面板的 backdrop 里**。
   再加面板自身 84% 的填充，净穿透 = `(1-0.84) × 0.5 = 8%`。
2. **但 8% 在深色主题下 = 同一色板内变暗约 2~5 个亮度级。** 它与"面板变暗一点"**在观感上是同一件事**，
   用户大概率会说"没变化"。`E28` 实测：`B_84` 与不透明基线在面板内的最大差 **14 / 255**，
   且**主要来自面板边框那一圈**（inset 描边/投影叠加），面板深处的差只有 2~3 级。
3. **要"看得出来"，唯一的杠杆是把面板的填充再降。** `B_60` 实测最大差 **35**，面板内 100px 处差 1，
   200px 处差 1 —— 因为立绘/壁纸在面板背后是**均匀的**，透视过去只变成"整体变暗/变亮"，
   形状全无。这与 `_adv` D1 的结论完全一致：**遮罩把一切压成近均匀色。**
4. ⇒ **仍然建议先上 B（它就是"对话框那套"），但把验收口径改成可测的数字**（见 F.2 的 M1/M2），
   而不是"看着像玻璃"。**B 一旦不达标，一条规则换成 F.3 即可，不动任何 DOM。**

### F.1 方案 B 的最终 CSS

```css
/* 只匹配"模态对话框面板"：设置窗、居中弹窗。绝不碰输入框/菜单/任务面板。 */
body[data-dsh-maid-companions] [aria-modal="true"][role="dialog"]:not([data-composer-card]) {
	/* 面板保留自己的底色 token，只降 alpha —— 色相不变，换主题自动跟随。 */
	background-color: color-mix(in srgb, var(--dsw-alias-bg-layer-2) 84%, transparent);
	-webkit-backdrop-filter: blur(1px) saturate(1) brightness(1.05);
	backdrop-filter: blur(1px) saturate(1) brightness(1.05);
}
```

每个数的出处：

| 值 | 出处 | 说明 |
|---|---|---|
| `var(--dsw-alias-bg-layer-2)` | `.VOzbGW_panel` 原本就用这个 token 上色（`SettingsRoot.module.css`，见 `_adv` §1 表）；暗色 = `--dsw-static-neutral-bluish-850` = `#2c2c2e`，亮色 = `#ffffff` | **不要写 rgb**，否则亮色主题直接崩 |
| `84%` | `docs/overlay-surfaces.md` 表里"② 设置窗浮层面板 = 84% / 12px" | 该文档记录的是**本插件浮层族**的既有参数，直接复用，不另起一套 |
| `blur(1px)` | `lib/client.js:430-431` 输入卡 `blur(1px) brightness(1.05)`；`LIQUID.blurPx = 1`（:721-740） | **不是 12px**：`overlay-surfaces.md` 的 12px 是窄浮层的；800×800 用 12px 会把正文底噪糊成一片（`E28` 的 `B_84_blur12` 与 `B_84` 差 1 级，但观感更闷）。1px 才是"透明度本身在起作用" |
| `saturate(1)` | `LIQUID.saturate = 1` | 中和 = 不改色；为将来分层采样留字段 |
| `brightness(1.05)` | `LIQUID.brightness = 1.05`、输入卡同参 | 抵消"半透明后整体变暗" |
| `:not([data-composer-card])` | 用户硬性要求：对话框不许碰 | 见 F.4 |

**为什么不加 `box-shadow`**：面板原本 `box-shadow: var(--dsw-elevation-prominent)`，不要覆盖；
`E28` 证明那圈投影正是 `B_84` 唯一能看出来的部分之一。

### F.2 方案 B 的失败模式清单（每条给一行 DevTools 判定）

先取面板：`const p = document.querySelector('[aria-modal="true"][role="dialog"]')`

| # | 失败模式 | 判定表达式（在 DevTools Console 里粘） | 期望值 / 结论 |
|---|---|---|---|
| **M1 规则没落地** | 选择器没命中，或特异度被宿主压过 | `getComputedStyle(p).backgroundColor` | 应为 `color(srgb 0.17 0.17 0.18 / 0.84)` 或 `rgba(44,44,46,0.84)`。若仍是 `rgb(44,44,46)`（alpha=1）→ **规则没生效** |
| **M2 backdrop 被 BackdropRoot 吃掉** | 某个祖先带 `backdrop-filter`（`.VOzbGW_mask` 就有 `blur(2px)`）——这是**设计预期，不是 bug**；真正的 bug 是祖先链上还有 `filter/transform/opacity/contain` | 逐级打印：`for(let e=p;e;e=e.parentElement){const s=getComputedStyle(e);if(s.filter!=='none'\|\|s.transform!=='none'\|\|s.opacity!=='1'\|\|s.contain!=='none'\|\|s.backdropFilter!=='none')console.log(e.className,s.filter,s.transform,s.opacity,s.contain,s.backdropFilter)}` | 期望**只有** `.VOzbGW_overlay` / `.VOzbGW_mask` 一行（`backdrop-filter: blur(2px)`）。多出别的 → 采样锚点上移，B 会退化成"看不出变化" |
| **M3 背后是近均匀色（真机上"看不出变化"的头号原因）** | 面板挡住的区域背后是什么，只能靠"关掉面板再看" | `p.style.visibility='hidden';` 然后肉眼 + 取像素：`const r=p.getBoundingClientRect(); document.elementFromPoint(r.left+r.width/2,r.top+r.height/2)` | 若命中 `.VOzbGW_mask`（几乎一定）→ 那就直接量 mask 之后的画面是否均匀：**把上面那句换成** `const m=p.parentElement.querySelector('[class*=mask]'); m.style.display='none';` 再看面板区域是否出现有形状的内容。**没有形状 → B 必然"看不出变化"** |
| **M4 中间文字对比度下降 / 发灰** | 8% 的立绘色带进正文底 | 对比度快速判定：`(()=>{const t=[...p.querySelectorAll('span,div')].find(e=>e.textContent.trim()==='设置'); const s=getComputedStyle(t);return [s.color, getComputedStyle(p).backgroundColor]})()` | 把这两个色值丢进任意 WCAG 计算器。**正文 14px 需 ≥ 4.5:1**。低于 4.5 → 把 84% 提到 90%，或直接降级 V3 |
| **M5 整面板被糊（用户最初的报障）** | `blur()` 值写大了 / 面板内还有子元素自带 backdrop | `getComputedStyle(p).backdropFilter` | 必须是 `blur(1px) saturate(1) brightness(1.05)`。出现 `blur(12px)` 及以上 → 立刻改回 1px |
| **M6 亮色主题下变成"一片白雾"** | 亮色 `--dsw-alias-bg-layer-2` = `#ffffff`，84% 白 + 背后深色 = 灰 | `document.body.hasAttribute('data-ds-dark-theme')` + `getComputedStyle(p).backgroundColor` | 亮色下若面板明显发灰，把亮色分支独立降透明度（见 F.3 的 `--mc-v3-fill` 覆盖写法） |

### F.3 降级路径 V3（= 参数化的 V2 纯 CSS 壳）

**一句话**：把 `background-color` 换成 `linear-gradient`（两端都是 token 推导），
`box-shadow` 在原 `--dsw-elevation-prominent` 后面追加四条 inset 高光。
**只改两条声明，撤掉 `backdrop-filter`**，其余一律不动 —— 因此在 STAGE_CSS 里与方案 B **二选一**，切回来只是删一行。

参数来源（全部 token 推导，无硬编码 rgb）：

| 槽位 | 值 | 怎么推出来的 |
|---|---|---|
| 渐变上端 | `color-mix(in srgb, var(--dsw-alias-bg-layer-2) 96%, transparent)` | = 比 84% 更实，只让 4% 背景透进来 → 顶光处"更亮更透"的错觉；4% 是 84% 与 100% 之间的中点偏移，不引入新比例 |
| 渐变下端 | `color-mix(in srgb, var(--dsw-alias-bg-layer-2) 98%, transparent)` | 底部更实 = 阴影侧；2% 的差在深色主题下约 1 个亮度级，肉眼只读成"有厚度" |
| 外投影 | `var(--dsw-elevation-prominent)` | **写回宿主原值**（`client.js` 里已踩过两次"整体替换丢描边"的坑，见 :441 与 :522） |
| inset 1 顶光 | `inset 0 1px 0 color-mix(in srgb, var(--dsw-alias-label-primary) 13%, transparent)` | 用**前景色**而不是写死 `#fff`：亮色主题下前景是近黑，顶光会自动变成"暗边"，不会糊成白边 |
| inset 2 内描边 | `inset 0 0 0 1px color-mix(in srgb, var(--dsw-alias-label-primary) 7%, transparent)` | 同上，比顶光弱一档（13% : 7% ≈ 2 : 1） |
| inset 3 内辉 | `inset 0 0 22px -6px rgba(212,232,255,.26)` | 来自 `docs/liquid-glass.md`（"边缘 +2px 处 +7.2 / +8px 处 +0.9 / 中心 +0.0"那条）与输入卡的 `inset 0 0 20px -5px rgba(212,232,255,.20)`；面板比卡片大得多，故 blur 22px / 扩散 −6px / alpha .26，保持"贴边一圈"而非铺满 |
| inset 4 底暗 | `inset 0 -1px 0 color-mix(in srgb, #000 28%, transparent)` | 底部一道暗线，与顶光形成上下"厚度"差 |

```css
body[data-dsh-maid-companions] [aria-modal="true"][role="dialog"]:not([data-composer-card]) {
	background: linear-gradient(180deg,
		color-mix(in srgb, var(--dsw-alias-bg-layer-2) 96%, transparent),
		color-mix(in srgb, var(--dsw-alias-bg-layer-2) 98%, transparent));
	box-shadow:
		var(--dsw-elevation-prominent, 0 0 0 .5px rgba(255,255,255,.12), 0 3px 8px 0 #0000000a, 0 0 20px 0 #0000000d),
		inset 0 1px 0 color-mix(in srgb, var(--dsw-alias-label-primary) 13%, transparent),
		inset 0 0 0 1px color-mix(in srgb, var(--dsw-alias-label-primary) 7%, transparent),
		inset 0 0 22px -6px rgba(212, 232, 255, .26),
		inset 0 -1px 0 color-mix(in srgb, #000 28%, transparent);
	-webkit-backdrop-filter: none;
	backdrop-filter: none;
}
```

实测（`E28`，真机结构 + 真机常量 + 真机 mask）：V3 与不透明基线的面板内最大差 **2 / 255**，
即**文字与内容区几乎完全不被动到**，而边缘那一圈顶光/内辉由 `box-shadow` 提供。
亮色主题的"白雾"问题在这里**天然不存在**（token 自动换色）。

### F.4 硬性提醒（选择器纪律）

**唯一允许作用的目标是 `[aria-modal="true"][role="dialog"]`。** 下面这些一律**不许碰**
（它们在真机上都没有 `aria-modal`，但为防将来加，仍显式排除）：

- `[data-composer-card]` —— 用户原话："对话框不要动了"。它是**已经做好**的那块玻璃，
  被这条规则选中会让它从 `transparent` 变成 84% 实色，**直接毁掉用户唯一满意的部分**。
- `[role="menu"]` / `[role="listbox"]` / `[role="tooltip"]` / `[role="alertdialog"]`
- `[data-testid="todo-panel"]`、`.lXshSW_root`
- `[role="tabpanel"]`、`[data-pane]`、`[data-phase]` —— 主内容区，给它们上色 = "整片变灰"事故的形态
  （由 `scripts/check-no-area-tint.mjs` 强制禁止）。

另：`.VOzbGW_panel` 是哈希类名，**不要写死**；`[aria-modal="true"][role="dialog"]` 才是稳定锚点
（`_adv` §1 已确认面板 JSX 只有 `role="dialog"` + `aria-modal="true"` + `aria-labelledby`）。

### F.5 可以直接贴进 STAGE_CSS 的成品（方案 B + V3，二选一）

> ⚠️ 下面两个代码块内的注释**已经过反引号检查**：全文没有 U+0060，可以整体粘进模板字符串。
> 贴完请照 `client.js:121-123` 跑 `new vm.Script(src)` + 反引号计数 = 0 + 花括号配平 = 0。

**A. 方案 B（默认启用）**

```css
/* ==== 设置窗 / 模态对话框：与输入框同源的半透明 + 毛玻璃 ====
   目标只有 [aria-modal="true"][role="dialog"]（面板 JSX 的稳定锚点），
   不碰输入卡、菜单、任务面板、主内容区。
   底色保留面板自己的 token，只降 alpha：换主题时色相自动跟随，
   不会出现硬编码 rgb 在亮色主题下变成一片白的问题。
   透明度 84% 沿用 docs/overlay-surfaces.md 浮层族「窗口 84%」的既有口径；
   blur 取 1px 而不是 12px：12px 会把 800x800 面板背后的纹理糊成一片，
   且真正起作用的本来就是「透明度」，模糊只是消除噪点。 */
body[data-dsh-maid-companions] [aria-modal="true"][role="dialog"]:not([data-composer-card]) {
	background-color: color-mix(in srgb, var(--dsw-alias-bg-layer-2) 84%, transparent);
	-webkit-backdrop-filter: blur(1px) saturate(1) brightness(1.05);
	backdrop-filter: blur(1px) saturate(1) brightness(1.05);
}
```

**B. 降级（V3 纯 CSS 壳）：方案 B 被证伪时，把上面整块换成这一块**

```css
/* ==== 降级态：同样的目标，但不用 backdrop-filter ====
   触发条件见 F.2 的 M2 / M3 / M4 任一不达标。
   四个颜色槽位全部由 token 推导，不写死 rgb：
     顶光 / 内描边用 --dsw-alias-label-primary（前景色）而非白色，
     亮色主题下会自动变成暗边，不会糊成白圈；
     底色两端用 --dsw-alias-bg-layer-2 的 96% 与 98%，
     只留 2~4% 的透出，既保留「有厚度」的错觉，又不动正文对比度。
   box-shadow 必须把宿主原有的 --dsw-elevation-prominent 写回第一段，
   否则面板的描边与投影会被整体替换掉（输入卡那次已踩过）。 */
body[data-dsh-maid-companions] [aria-modal="true"][role="dialog"]:not([data-composer-card]) {
	background: linear-gradient(180deg,
		color-mix(in srgb, var(--dsw-alias-bg-layer-2) 96%, transparent),
		color-mix(in srgb, var(--dsw-alias-bg-layer-2) 98%, transparent));
	box-shadow:
		var(--dsw-elevation-prominent, 0 0 0 .5px rgba(255, 255, 255, .12), 0 3px 8px 0 #0000000a, 0 0 20px 0 #0000000d),
		inset 0 1px 0 color-mix(in srgb, var(--dsw-alias-label-primary) 13%, transparent),
		inset 0 0 0 1px color-mix(in srgb, var(--dsw-alias-label-primary) 7%, transparent),
		inset 0 0 22px -6px rgba(212, 232, 255, .26),
		inset 0 -1px 0 color-mix(in srgb, #000 28%, transparent);
	-webkit-backdrop-filter: none;
	backdrop-filter: none;
}
```

### F.6 期望值速查（把验收变成可测的数字）

| 变体 | 面板内与"不透明基线"的最大差（`E28`） | 观感 |
|---|---|---|
| `B_84`（方案 B 默认） | **14 / 255** | 面板整体略暗、边框一带略亮；背后形状基本不可辨 |
| `B_84` + `blur(12px)` | 14 | 与上一行几乎同样，只是更闷 |
| `B_60`（更透，激进） | **35 / 255** | 正文字底开始带色，**需要重测 WCAG** |
| `V3`（降级） | **2 / 255** | 内容零打扰；玻璃感全部来自边缘四条 inset |

**验收建议**：`B_84` 上线前先跑 M3 —— 若背后确实没有形状，就**别用"像玻璃"作为验收词**，
改用"面板整体亮度变化 ≥ 3 级 且 正文对比度 ≥ 4.5:1"这类可测口径；否则一定会走入"看起来没变化"的循环。

---

## 附：产物索引（`D:\DSH Workspace\_p1\`）
- 决定"能不能看见"的结构对照：`out/E21_top_TL.png`（透明面板 + 面板内带子 → 采到图案）、
  `out/E20_cover_TL.png`（面板外扩 → 死色）、`out/E12_L_loc_TL.png`（玻璃带 + 圆角 → 角落露锐利画面）。
- 推荐方案的观感：`out/E27c_rich_rec.png`（整页，背景是立绘时）、`out/E27c_rich_rec_TL.png`（左上 4 倍）。
- **D3 成立时的对照**：`out/E27c_plain_rec_TL.png`（环内一片死色）vs `out/E27c_plain_css_TL.png`（V2 仍有亮边）。
- 纯 CSS 壳（V2）：`out/E27c_rich_css.png`（整页）、`out/E26_V2_TL.png`（左上 4 倍）、`out/E24_A/B/C_TL.png`。
- 现状（镜像墙）对照：`out/E26_V3_full.png`（带内 30/31，等于没有）。
- **方案 B 与 V3（真机结构 + 真机常量 + 真机 mask）**：`out/E28_B_0.png` / `out/E28_B_84.png` /
  `out/E28_B_60.png` / `out/E28_B_84_blur12.png` / `out/E28_V3.png`，各自 `_TL.png` 为左上角 4 倍。
- 真机探针：`e16.cjs` → `e16_boot.json` / `e16_probe_result.json`（当前因鉴权未跑通）。
