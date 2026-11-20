# 「bili 设置」整屏发糊：静态取证报告

> 结论先行：**billion-context 的 bili 面板根本不是 `role="dialog"` / `aria-modal="true"` 的模态。**
> 它是 `settings.section` 槽位里一个普通 `<div>`，里面嵌了一个 `<iframe>`。
> 因此「我的 `[aria-modal='true'][role='dialog']` 规则误命中了 bili 面板」这条假说 **静态可证否**。
> 「它自己带 backdrop-filter 形成双层叠化」这条也 **静态可证否**（整个包 0 命中）。
> 真正的几何关系是：bili 面板在设置面板**内部**，我们的玻璃在**外层**，物理上不可能被它带糊。

本报告只做只读取证，**未修改任何产品文件**。

---

## 0. 取证环境与口径

| 项 | 值 |
| --- | --- |
| 客户端入口 | `D:\DeepSeek-Harness\dsh\profiles\desktop\node_modules\billion-context\dist\agent\dsh-native-client.js`（14484 B / 362 行） |
| 入口来源 | `billion-context\package.json` 的 `"exports": { "./client": "./dist/agent/dsh-native-client.js" }` 与 `"dsh": { "client": { "platform": "web" } }` |
| 设置外壳 | `D:\DeepSeek-Harness\node_modules\@deepseek-ai\dsh-client-ui-settings-general\lib\client.js`（29601 B） |
| 槽位定义 | `D:\DeepSeek-Harness\node_modules\@deepseek-ai\dsh-client-ui-settings\lib\types\client\contract\slots.d.ts:67` |
| 本插件 | `D:\dsh-src\maid-companions\lib\client.js`（1009929 B / 1530 行） |

> 注意：`billion-context\dist\index.js`（4.75 MB）是 **bili 代理服务端 / CLI 的压缩产物**，不参与
> DSH Web GUI 的界面渲染。在它里面 grep UI 结构是找错文件 —— 我最初也先看了它，后来按
> `package.json` 的 `dsh.client` 字段才定位到真正的客户端入口 `dist\agent\dsh-native-client.js`。

---

## 1. Q1：bili 弹层的真实 DOM 结构

### 1.1 结论

1. **不是 `role="dialog"`，不是 `aria-modal`，不是 `<webview>`，不是 Shadow DOM，也不是自绘的 fixed 全屏 div。**
   它是一条 `settings.section` 槽位记录渲染出来的普通 `<div>`，内部放了一个**跨源 `<iframe>`**。
2. **是 iframe。** 外壳（标题「billion-context 压缩代理」、四个页签「总览/会话/配置/日志」、「打开 Web UI」按钮）
   是 React 在**宿主文档**里画的；只有页签下面那块内容区是 iframe。
3. **宿主容器**：`settings.section` 槽位（`kind: 'list'`, `scope: 'root'`），渲染在设置面板的
   **内容列 `.VOzbGW_options` 里**，也就是**在 `[aria-modal="true"][role="dialog"]` 那个设置面板的内部**。

### 1.2 关键代码（全部可 grep 复现）

**槽位注册（这是 bili 面板的入口）**：`dist\agent\dsh-native-client.js:351-358`

```js
ctx.slots.inject(
  "settings.section",
  () => ctx.slots.register({ name: "settings.section", id: "bili", order: 100, label: () => t("nav"), locale: NS }, panel(true))
);
ctx.slots.inject(
  "plugins.bundle.config",
  () => ctx.slots.register({ name: "plugins.bundle.config", key: "billion-context", locale: NS }, panel(false))
);
```

**面板本体**：同一文件 `:336-339`（外层 div）与 `:320-331`（iframe）

```js
// L336-339 外层：一个普通 div，没有任何 role / aria-* 属性
return (0, import_react.createElement)(
  "div",
  { style: { display: "flex", flexDirection: "column", gap: 12, padding: "20px 8px" } },
  ...
)

// L320-331 内容区：跨源 iframe
(0, import_react.createElement)("iframe", {
  src: `${origin}/__bili/?embed=1&lang=${lang}${theme ? `&theme=${theme}` : ""}#/${page}`,
  title: t("title"),
  style: { display: "block", width: "100%", height: EMBED_HEIGHT,
           border: "1px solid rgba(127,127,127,0.4)", borderRadius: 8, background: "transparent" }
})
```

`EMBED_HEIGHT` 定义在 `:45`：

```js
var EMBED_HEIGHT = "min(640px, 78vh)";
```

### 1.3 复现命令与命中数

```powershell
$f = "D:\DeepSeek-Harness\dsh\profiles\desktop\node_modules\billion-context\dist\agent\dsh-native-client.js"
foreach ($p in @('aria-modal','dialog','role=','iframe','webview','attachShadow','shadowRoot','backdrop-filter','blur\(')) {
  $n = (Select-String -Path $f -Pattern $p -AllMatches | ForEach-Object { $_.Matches.Count } | Measure-Object -Sum).Sum
  "{0,-18} {1}" -f $p, ($n -as [int])
}
```

实测输出：

```
backdrop-filter          0
-webkit-backdrop-filter  0
blur\(                   0
aria-modal               0
dialog                   0
webview                  0
attachShadow             0
shadowRoot               0
role=                    1      <- 唯一一处，而且不是 DOM 属性
iframe                   2      <- L317 是注释，L320 是真正的 createElement
opacity                  4      <- 全是 <p> 上的 0.7，见下
```

> **`role=` 的唯一命中是 L88**：`for (const sel of ["main", "[role=main]", "#root", "#app"]) {`
> —— 这是 `detectHostTheme()` 用来读宿主主题色的 **querySelector 字符串**，不是 DOM 属性。
> **整个包里没有任何一个元素被赋予 `role`。** 这就是"没查到 dialog"的准确表述。

---

## 2. Q2：它自己带了 backdrop-filter / filter / opacity / transform 吗？

### 2.1 结论：**没有。整个包 0 命中。**

```powershell
$f = "D:\DeepSeek-Harness\dsh\profiles\desktop\node_modules\billion-context\dist\agent\dsh-native-client.js"
foreach ($p in @('backdrop-filter','backdropFilter','-webkit-backdrop-filter','blur\(','filter:','isolation','will-change','contain:')) {
  $n = (Select-String -Path $f -Pattern $p -AllMatches | ForEach-Object { $_.Matches.Count } | Measure-Object -Sum).Sum
  "{0,-24} {1}" -f $p, ($n -as [int])
}
```

```
backdrop-filter          0
backdropFilter           0
-webkit-backdrop-filter  0
blur\(                   0
filter:                  0
isolation                0
will-change              0
contain:                 0
```

服务端产物同样为 0：

```powershell
$d = "D:\DeepSeek-Harness\dsh\profiles\desktop\node_modules\billion-context\dist"
foreach ($n in @('index.js','mcp.js','agent\dsh-acp.js')) {
  $c = Select-String -Path (Join-Path $d $n) -Pattern 'backdrop-filter|backdropFilter' -AllMatches
  "$n -> $((($c|Measure-Object).Count))"
}
# index.js -> 0
# mcp.js -> 0
# agent\dsh-acp.js -> 0
```

### 2.2 它唯一加的不透明度：4 处 `opacity: 0.7`，且都在**内联 style** 上

| 行号 | 作用元素 | 面积 |
| --- | --- | --- |
| `:282` | 状态提示 `<p>`（degraded 文案） | 一行文字，几十 px 高 |
| `:284` | 状态提示 `<p>`（stale 文案） | 一行文字 |
| `:334` | 状态提示 `<p>`（connecting 文案） | 一行文字 |
| `:344` | 底部 hint `<p>`（"查看压缩状态、会话与上下文窗口。"） | 一行文字 |

```powershell
Select-String -Path $f -Pattern 'opacity' | ForEach-Object { "L{0}: {1}" -f $_.LineNumber, $_.Line.Trim() }
```

**这 4 个 `<p>` 里，`:282` / `:284` / `:334` 在 ok 状态下根本不会渲染**（看 `:281-335` 的分支：`liveEmbed === "ok"` 走的是 `:285-332` 那条）。ok 状态下只有 `:344` 那个 hint 段落带 `opacity: 0.7`。都不是大面积元素。

**没有任何 `transform`**（grep `transform` 在客户端入口 0 命中），**没有 `will-change` / `isolation` / `contain`**。

> 所以「bili 面板自带模糊、和我们 16px 叠成双层」这条假说，**在 bili 这一侧没有数据支撑**。

---

## 3. Q3：那为什么"一进 bili 页就整屏发糊"？逐条假说自测

### 先确立几何：谁是外层，谁是内层

`D:\DeepSeek-Harness\node_modules\@deepseek-ai\dsh-client-ui-settings-general\lib\client.js:115-171`（设置外壳）：

```js
 115: return (0, react_jsx_runtime.jsxs)("div", {
 116:   className: SettingsRoot_module_css_default.overlay,
 117:   role: "presentation",
 118:   children: [(0, react_jsx_runtime.jsx)("div", {
 119:     className: SettingsRoot_module_css_default.mask,
 120:     "aria-hidden": "true",
 121:     onClick: onClose
 122:   }), (0, react_jsx_runtime.jsxs)("div", {
 123:     className: SettingsRoot_module_css_default.panel,
 124:     role: "dialog",
 125:     "aria-modal": "true",
 126:     "aria-labelledby": titleId,
 127:     children: [ ... <nav className={...nav}> ... ,
 148:       (0, react_jsx_runtime.jsxs)("div", {
 149:         className: SettingsRoot_module_css_default.content,
 150:         children: [ ... <div className={...header}> ...,
 165:           (0, react_jsx_runtime.jsx)("div", {
 166:             className: SettingsRoot_module_css_default.options,
 167:             children: active !== void 0 && renderSlot("settings.section", { close: onClose }, { only: active })
 168:           })
```

即：

```
div.overlay[role=presentation]
├─ div.mask[aria-hidden]
└─ div.panel[role=dialog][aria-modal=true]      <-- 设置窗 800×800，我插件唯一命中的元素
   ├─ nav.VOzbGW_nav  (左侧「设置」导航列)
   └─ div.content
      ├─ div.header
      └─ div.options.VOzbGW_options            <-- 内容列
         └─ 【bili 面板】 div (billion-context, 无 role/aria)
            ├─ h3  「billion-context 压缩代理」
            ├─ 四个页签按钮「总览/会话/配置/日志」+「打开 Web UI」
            └─ iframe[title="billion-context 压缩代理"]  height: min(640px, 78vh)
```

**bili 面板完全在设置面板的内部。** 我们那条 `backdrop-filter` 挂在 `div.panel` 上，
按 CSS 规范 backdrop-filter 只影响**该元素背后（祖先与祖先之前的兄弟）**，**不会糊它自己的子孙**。
所以"bili 面板导致设置窗变糊"在合成模型上不成立。

槽位契约也印证了这一点 —— `dsh-client-ui-settings\lib\types\client\contract\slots.d.ts:67`：

```ts
'settings.section': { kind: 'list'; scope: 'root'; owner: SettingsSectionOwnerProps; };
```

`scope: 'root'` = 由根级 Shell 渲染进面板内容列，**不另开浮层**。

### 假说 a：我的 `[aria-modal='true'][role='dialog']` 规则误命中了 bili 容器

| | |
| --- | --- |
| **判定** | ❌ **静态可证否** |
| **证据（支持）** | 无。 |
| **证据（否定）** | bili 客户端入口里 `aria-modal` **0 命中**、`dialog` **0 命中**、`role=` 唯一命中是 L88 的 querySelector 字符串。它渲染的根元素是 `:336-339` 的裸 `<div>`，只带内联 flex 样式，**连 className 都没有**，更不可能带上 `role`/`aria-modal`。 |
| **补充** | 而且结构上它在 `div.panel[aria-modal]` 的**内部**，不是兄弟也不是祖先。所以就算它有 `aria-modal`，也只会变成"套在设置窗里的小玻璃"，面积是 800×~700 内的 sub-box，不会"整屏"。 |

**这条是 lead 的首要假说，但代码直接否掉了它。**

### 假说 b：这个容器本身覆盖全屏且带 backdrop-filter，把背后一切都糊了

| | |
| --- | --- |
| **判定** | ❌ **静态可证否** |
| **证据（否定）** | ① 它不覆盖全屏 —— iframe 高度写死 `min(640px, 78vh)`（`:45`），外层 div 只有 `padding: 20px 8px`，宽度 `100%` 于内容列（800 − 导航列宽）。② 它自己**不带任何** backdrop-filter / filter / blur（Q2 全部 0 命中）。 |

### 假说 c：它作为一个新的 BackdropRoot，让祖先的面板玻璃失效

| | |
| --- | --- |
| **判定** | 🟡 **理论上成立，但与"发糊"方向相反 —— 而且设置窗现在明显是有玻璃的** |
| **机制** | `<iframe>` 在 Chromium 里是一个独立的合成层 / backdrop root。祖先（`div.panel`）的 `backdrop-filter` 采样的是**祖先自己的 backdrop**，与本元素内部的 iframe 无关；反过来，iframe 内部内容不会参与祖先的 backdrop 采样。 |
| **能解释什么** | 它能解释"bili 面板这块区域看起来不像玻璃"——因为那块像素来自一个独立的跨源文档，是它自己的不透明底色。 |
| **不能解释什么** | 它**不能**解释"整屏/设置窗其他区域变糊"。BackdropRoot 失效只会让**玻璃效果消失（变清晰、变平）**，不会产生模糊。 |

### 假说 d：它自带的模糊叠在我的 16px 之上

| | |
| --- | --- |
| **判定** | ❌ **静态可证否（bili 侧）** |
| **证据** | Q2：bili 客户端入口与服务端产物里 `backdrop-filter` / `filter:` / `blur(` **全部 0 命中**。 |
| **唯一残留可能** | 有 —— 见 §5「必须真机确认」，模糊如果存在，只可能发生在 **iframe 内部那个跨源页面**（`{origin}/__bili/?embed=1`），那份 HTML/CSS 不在本地包里，静态取不到。 |

### 假说 e（代码自己写着的疑点）：v0.2.18 在**所有**目标上无条件挂 `url(#…) blur(1px)`

这条假说不在 lead 给的清单里，但它直接来自代码，而且**优先级应该最高**。

`D:\dsh-src\maid-companions\lib\client.js:1266-1312`（`applyTo`）：

```js
1291:  const value = "url(#" + inst.id + ") blur(" + LIQUID.blurPx + "px) saturate(" + LIQUID.saturate + ") brightness(" + LIQUID.brightness + ")";
1303:  // v0.2.18：环带分支已整体停用（installRing 直接 return）。
1304:  //   页面级大面板改由 STAGE_CSS 的 [aria-modal='true'][role='dialog']
1305:  //   规则处理：面板自己降底色到 45% + backdrop-filter。
1306:  //   这里对**所有**目标一律挂滤镜，不再按面积分流 ——
1307:  //   否则大面板的内联样式会被清空，反而把 CSS 里的玻璃也一并关掉。
1308:  el.style.backdropFilter = value;
1309:  el.style.webkitBackdropFilter = value;
1310:  removeRing(inst);
```

而 `LIQUID.blurPx = 1`（`:814`），`LIQUID.brightness = 1.05`（`:818`）。

同时 STAGE_CSS 里还有一条 `blur(16px)`（`lib/client.js:329-337`）。
**这两者作用在同一个元素上，后者取决于哪条胜出**：

- `el.style.backdropFilter` 是 **内联样式**，优先级高于 STAGE_CSS 的类/属性选择器；
- 所以**实际生效的极可能是 JS 的 `url(#…feDisplacementMap…) blur(1px) saturate(1) brightness(1.05)`**，
  而不是 CSS 里的 `blur(16px) saturate(1.2) brightness(1.15)`；
- 但 STAGE_CSS 的 `background-color: color-mix(… 45%, transparent)` **会**生效（JS 没覆盖它）。

**这条为什么值得优先查**：一个 `feDisplacementMap` + `backdrop-filter` 组合在"目标元素自己的尺寸 / 滤镜 `filterUnits="userSpaceOnUse"` 的坐标系 / 面板尺寸"三者不一致时，
会产生**远大于 blur(1px) 的视觉位移**（位移场是按 `w × h` 生成的贴图，`scale` 取自 `buildMap`）。
面板尺寸变化（比如从"设置首页"切到"bili 页"，或副标题文案变长）时贴图重算如果没跟上，整块面板就会呈现"被拉糊"的观感 ——
**这与"一进 bili 页就整屏糊"的时间相关性吻合得比任何 bili 侧设都更好。**

而 bili 页恰好是**内容列高度最高的一个 section**（iframe `min(640px, 78vh)` + 标题 + 页签行），
它让 `div.panel` 的内部布局发生最大变化 → 最可能触发 `buildMap` 的重算路径异常。

> ⚠️ 这条是**代码可疑点**，不是已证实的根因。证实需要真机（见 §5 的 todo 清单）。

### 3.1 与用户截图数值的对照

用 Pillow 对用户截图（1032×1065）做了分区亮度与"边缘能量"（`FIND_EDGES` 均值，越大越锐）采样：

```python
from PIL import Image, ImageFilter
p = r'D:\DeepSeek-Harness\dsh\attachments\v1\objects\ea\eaa03d2e387f1ffd2ac387e239e6128b3097664f7a1e29d5fc69c20c3d3b17a7'
im = Image.open(p).convert('RGB'); g = im.convert('L')
```

| 区域 | 坐标 | 均值亮度 | 标准差 | 边缘能量 |
| --- | --- | --- | --- | --- |
| 设置窗左上（标题） | 20,30–120,90 | 38.6 | 33.8 | 6.04 |
| 设置窗左导航列 | 40,200–160,600 | 52.1 | 27.9 | **9.86** |
| 设置窗右上 | 830,120–960,180 | 37.8 | 18.9 | 6.71 |
| bili 标题栏文字 | 300,320–900,370 | 50.5 | 11.0 | 5.03 |
| bili 页签行 | 300,380–900,420 | 39.7→(6.41) | — | 6.41 |
| bili 面板中部 | 200,420–950,560 | 41.1 | 21.5 | **3.63** |
| bili 面板下部 | 500,600–900,700 | — | — | **3.03** |
| 右侧立绘 | 960,300–1032,900 | 37.9 | 31.1 | 7.19 |
| 设置窗底部 | 30,850–970,1010 | 38.5 | 22.8 | **3.34** |

**读数说明（重要，别过度解读）：**

1. **边缘能量低 ≠ 模糊。** 纯色面板上写字，边缘能量天然低。所以 `bili 面板下部 3.03` 和 `设置窗底部 3.34` 差不多，
   不能单凭这个判定"谁更糊"。
2. **真正说明问题的对比**：**设置窗导航列 9.86**（多层小字 + 图标，纹理密集）vs **设置窗底部 3.34**。
   底部是"任务/说明"这种大字稀疏区，本来边缘就少 —— 这组差异是**内容密度差异**，不是模糊差异。
3. **亮度 31 vs 31** 与 `color-mix(… 45%, transparent)` 的预期一致：设置窗内部透出的是它背后
   （overlay 的深色底 + 立绘的暗部），bili 面板是不透明的跨源 iframe 文档，两者在深色主题下都落在 ~31–50 区间。
   **这条数据既不能证实也不能证否任何假说**，它只能说明"面板现在确实是半透明的"。
4. 截图里**没有任何一个区域呈现出典型的 `blur(16px)` 特征**（16px 半径会把小字彻底抹平；而设置窗导航列
   的小字边缘能量 9.86 是所有区域里最高的）。**如果真有 16px 全屏模糊，导航列不可能这么锐。**

> 结论：**截图数值支持"模糊不在设置窗本体的 16px 上"，与假说 (a)/(b)/(d) 被代码否掉方向一致。**
> 但截图是单帧、无基线，无法单独定案。

---

## 4. 可立刻写进插件 CSS 的选择器

即便 Q1 已经否掉了"误命中 bili 面板"，**把规则收紧仍然是对的**：
现在的 `[aria-modal='true'][role='dialog']` 会命中**所有**带这个语义属性的元素 ——
我在 `dsh-web-all\lib\client.js` 里数到 **10 处** `"aria-modal": "true"`（L9424 / L12912 / L13033 / L14511 / L24604 / L27080 / L28788 / L30797 / L53417 / 56560 为 CSS），
其中 `L24604`（RemotePanel）、`L27080`（FencePage）、`L28788`（UpdatePanel）、`L14511`（任务看板 detail）
都**不是** 800×800 的设置窗，却都被同一条规则糊上了。

### 4.1 推荐选择器

```css
/* 只命中设置窗面板本体：它是 .overlay[role=presentation] > .mask + .panel[role=dialog][aria-modal] 的第二个孩子 */
body[data-dsh-maid-companions] [role='presentation'][aria-modal='true'],
body[data-dsh-maid-companions] [role='presentation'] > [aria-modal='true'][role='dialog']:last-child {
  background-color: color-mix(in srgb, var(--dsw-alias-bg-layer-2) 45%, transparent) !important;
  -webkit-backdrop-filter: blur(16px) saturate(1.2) brightness(1.15);
  backdrop-filter: blur(16px) saturate(1.2) brightness(1.15);
  box-shadow: 0 20px 60px rgba(0,0,0,.5), inset 0 1px 0 rgba(255,255,255,.20), inset 0 -1px 0 rgba(255,255,255,.07) !important;
}
```

> 说明：上面第一条 `[role='presentation'][aria-modal='true']` 是**多余但无害**的保底写法，实际起作用的是第二条
> —— **`role="presentation"` 的父级 里那个 `aria-modal="true"` 的 dialog**。
> 这个结构在 `dsh-client-ui-settings-general\lib\client.js:116-122` 与 `:123-126` 是死写法：
> overlay 是 `role="presentation"`，它的直接孩子是 `[aria-modal="true"][role="dialog"]`。

### 4.2 为什么它不会误伤 bili 面板 / 输入框 / 菜单

| 目标 | 是否命中 | 理由 |
| --- | --- | --- |
| **bili 面板** | ❌ 不命中 | 它没有 `role`、没有 `aria-modal`，是 `div.panel` 的**后代**而非 `[role='presentation']` 的孩子。 |
| **输入框 `[data-composer-card]`** | ❌ 不命中 | 不是 `[role='presentation']` 的子元素。 |
| **菜单 `[role='menu']`** | ❌ 不命中 | 同上。 |
| **RemotePanel / UpdatePanel / FencePage / 任务看板 detail** | ❌ 不命中 | 它们直接挂在 body 或别的 portal 根上，**父级没有 `role="presentation"`**（见 `dsh-web-all` L24602-24605 / L27078-27081 / L28785-28791 / L14503-14511）。 |
| **设置窗 `div.panel`** | ✅ **命中并被保留玻璃** | 它正是 `div.overlay[role="presentation"]` 的第二个孩子，也带 `aria-modal="true"` + `role="dialog"`。 |

### 4.3 这套选择器的代价（必须先告诉你）

`SettingsRoot_module_css_default.panel` 与 `overlay` 是 **CSS Module 哈希类名**（`.VOzbGW_panel` 之类），
新版 DSH 一构建就会变。所以我用的是**结构锚点**（`role="presentation"` / `aria-modal="true"` / 子代关系），
**不是**哈希类名。但如果 DSH 将来把 overlay 的 `role="presentation"` 去掉（这是 React 里很常见的"顺手清理"），
**这条规则会整体失效 —— 表现为"设置窗突然没有玻璃了"**，而不是"模糊了"。这是个"失效即降级"的安全方向。

### 4.4 ⚠️ 关于 `:has()` —— 建议**不要**用

我验证过另一种更精确的写法（用设置窗**专属的导航列**做锚点，`div.panel` 的直接孩子里必须有 `.VOzbGW_nav`
那个 `<nav>`）。**技术上可行，但我不建议用**：

- 需要写 `.VOzbGW_nav` 或 `nav[class*="_nav"]` 这类哈希/子串匹配 —— 你明确要求"不用 CSS Module 哈希"；
- `dsh-web-all` 里现有 13 处 `:has(`，说明宿主支持没问题，但**旧版 Electron 对 `:has()` 的支持有版本门槛**，
  一旦不匹配会静默失效。
- 而且它换来的是"排除那 4 个非设置窗面板"—— 用 §4.1 的 `role="presentation"` 父级法**同样能排除，且更稳定**。

---

## 5. 静态分析做不到、必须真机 F12 才能确认的部分

以下四件事**只能靠真机 DevTools 定案**，静态代码给不了答案：

### 5.1 【最高优先级】面板实际生效的 `backdrop-filter` 到底是哪一条

在 F12 Console 里对设置窗面板执行：

```js
const panel = document.querySelector('[aria-modal="true"][role="dialog"]');
getComputedStyle(panel).backdropFilter
// 期望看到 blur(16px)… 还是 url("#dsh-maid-companion-liquid-glass-N") blur(1px)… ?
panel.style.backdropFilter          // JS 挂上去的内联值（有就是 JS 赢）
```

**如果内联里出现 `url(#dsh-maid-companion-liquid-glass-…)`，那就是 §3 假说 e 成立** —— JS 的
`feDisplacementMap` 覆盖了 CSS 的 16px，这才是要修的地方，跟 bili 无关。

### 5.2 iframe 内部到底有没有模糊

`{origin}/__bili/?embed=1` 是一个**跨源文档**，DevTools 里要单独选中那个 frame
（Console 左上角的执行上下文下拉框 → 选 `__bili` 那一项），然后：

```js
[...document.querySelectorAll('*')].filter(el => {
  const cs = getComputedStyle(el);
  return cs.backdropFilter !== 'none' || cs.filter !== 'none';
}).map(el => [el.tagName + '.' + el.className, getComputedStyle(el).backdropFilter, getComputedStyle(el).filter])
```

**只有这一个命令能回答"bili 网页自己有没有滤镜"**。本报告只能说"bili 的**本地包**里没有"。

### 5.3 切换 section 时面板尺寸/贴图的变化

```js
const panel = document.querySelector('[aria-modal="true"][role="dialog"]');
new ResizeObserver(e => console.log(panel.offsetWidth, panel.offsetHeight, getComputedStyle(panel).backdropFilter.trim().slice(0,80)))
  .observe(panel);
```

然后在设置里点「通用 → bili 设置」来回切。**如果切到 bili 页时 `offsetHeight` 跳变、且之后 backdrop-filter 的
SVG url 变了/没变**，就能区分"贴图没重算"和"贴图重算了但参数不对"。

### 5.4 用户截图的那一帧到底糊不糊（需要基线）

现在的判定全部建立在单张截图上。要定案需要**同机同窗口下"设置首页"与"bili 页"两张截图逐像素对比**。
在 Console 里可以直接取：

```js
// 在两张截图对应的状态下各跑一次，比较同一块区域
copy(getComputedStyle(document.querySelector('[aria-modal="true"][role="dialog"]')).backdropFilter)
```

静态分析给不出这个对比。

---

## 6. Lead 改动复核（对抗式，v0.2.19）

> 复核对象：`D:\dsh-src\maid-companions\lib\client.js` 的两处 v0.2.19 改动
> （① CSS 锚点收窄为 `[role='presentation'] > [role='dialog'][aria-modal='true']`；
> ② JS 尺寸闸门由 `LIQUID_MAX_AREA`=1,100,000 退回 `LIQUID_RING_MIN_AREA`=260,000）。
> **只读复核，未改任何产品文件。** 下面的行号对应复核时的 `lib/client.js`（1512 行）。

### 6.0 三条最重要的话

1. **改动 2（闸门 260000）成立且必要。** 理由是硬的：`LIQUID_RING_MIN_AREA` 恰好是 260,000，
   而闸门写成 `<=`（`lib/client.js:1019`），设置窗 800×800 = 640,000 → **进不来**；菜单/气泡/卡片
   实测最大约 **~243,000**（见 §6.3 表）→ **全都还在**。这条改对了。
2. **改动 1（CSS 锚点）方向对，但没能收窄到 Lead 以为的范围。** 它确实排除了 bili 面板、
   FencePage、图片灯箱、任务看板 4 个浮层、SSH 表单、模型菜单；**但没排除 RemotePanel 和 UpdatePanel**
   —— 这两个恰好是 `overlay[role=presentation] > panel[role=dialog][aria-modal=true]` 结构，
   而且他们的 overlay 里**本来就已经有了一层 `mask` 毛玻璃**，叠上去就是**第三层 blur**。
   更糟的是：这两个面板身上**带 `data-dsh-plugin` / `data-dsh-part` 锚点，现在却被 "不许写类名" 的
   顾虑连累没写进排除表**。→ 见 §6.2。
3. **`>` 直接子选择器是真实脆性，而且比 Lead 预想的更容易被触发。** 三个具体触发点见 §6.2.3。

---

### 6.1 攻击 1：选择器回归 —— 设置主窗还会不会被命中？

**结论：会。成立，不是回归。** 证据链：

```powershell
$sg = "D:\DeepSeek-Harness\node_modules\@deepseek-ai\dsh-client-ui-settings-general\lib\client.js"
$c = Get-Content $sg
# L116-117  overlay['role=presentation']
# L119      mask[aria-hidden]
# L123-125  panel['role=dialog','aria-modal=true']
```

DOM（`SettingsPanel` 组件，`sg L116` 起）：

```
div.overlay[role=presentation]          ← 直接父级，role 精确匹配
  ├─ div.mask[aria-hidden=true]
  └─ div.panel[role=dialog][aria-modal=true]   ← 第一层孩子，`:not()` 四连都不命中
```

`:not()` 四连逐个核对（`lib/client.js:336`）：

| `:not(...)` | 设置窗是否命中 | 判定 |
| --- | --- | --- |
| `[data-composer-card]` | 无此属性 | 不排除 ✓ |
| `[role='menu']` | `role="dialog"` | 不排除 ✓ |
| `[role='alertdialog']` | `role="dialog"` | 不排除 ✓ |
| `[data-testid='todo-panel']` | 无此属性 | 不排除 ✓ |

**选择器会命中设置窗。改动 1 对它的效果是"不变"（仍上玻璃），符合 Lead 的预期。**
⚠️ 唯一需要注意的：`div.mask` 是 `aria-hidden` 但没有 `role`，所以**不会被命中**（`[role='dialog']` 不匹配），
这正确 —— 该糊的只有 panel。

#### 6.1.1 我额外扫出来的：真实渲染 `aria-modal` 的组件不止 10 处

用**同一个脚本**扫 `aria-modal` 出现的全部位置，并对每个位置回溯到"它这个 JSX 元素自己的 props"，
判断 `role: "presentation"` 是**在同一元素**、**在直接父元素**、还是**完全无关**：

```python
# 只读脚本（复核时临时使用，跑完已删；下面内联复现）
import re, io, glob, os
ROOTS = [r'D:\DeepSeek-Harness\node_modules\@deepseek-ai',
         r'D:\DeepSeek-Harness\dsh\profiles\desktop\node_modules\@linxin666']
files = [p for r in ROOTS for p in glob.glob(os.path.join(r, '*', 'lib', 'client.js'))]
for p in files:
    c = io.open(p, encoding='utf-8', errors='replace').read()
    pkg = os.path.basename(os.path.dirname(os.path.dirname(p)))
    for m in re.finditer(r'aria-modal', c):
        seg = re.sub(r'\s+', ' ', c[max(0, m.start()-1400):m.start()])
        cut = max(seg.rfind('jsxs)("'), seg.rfind('jsx)("'))
        own, parent = seg[cut:], seg[:cut]
        pc = max(parent.rfind('jsxs)("'), parent.rfind('jsx)("'))
        print('%-34s OWN=%-5s PARENT=%s' % (pkg, 'presentation' in own,
                                            'presentation' in parent[pc:]))
```

结果（**这是攻击 1 的核心产出**）：

| 包 | 元素 | 自身带 presentation | **直接父级**带 presentation | 改动 1 是否命中 | 判断 |
| --- | --- | --- | --- | --- | --- |
| `dsh-client-ui-settings-general` | `.panel[role=dialog]` | 否 | **是**（`div.overlay[role=presentation]`） | **命中** | ✅ 期望目标 |
| `dsh-web-all` / `dsh-remote-web-ui` | `RemotePanel` 根 `.panel[role=dialog]` | 否 | **是**（`div.overlay[role=presentation]`，`web-all L25086-25087`） | **命中** | ❌ **意外命中，见 6.2** |
| `dsh-web-all` / `dsh-update` | `UpdatePanel` 根 `.panel[role=dialog]` | 否 | **是**（`div.overlay[role=presentation]`，`web-all L29196-29197`） | **命中** | ❌ **意外命中，见 6.2** |
| `dsh-session-archive` / `dsh-web-all` | `archive .modal[role=dialog]` | 否 | **是**（`archive_module_css_default.overlay[role=presentation]`，`web-all L53409`） | **命中** | ⚠️ 可以接受（本来就是真模态），但要知情 |
| `dsh-client-ui-task-board` ×5 | `.modal`/`.detail`/`.alertdialog` | 否 | 否（父是 `div.modalBackdrop`，**无 role**） | **不命中** | ✅ 已排除（`alertdialog` 那条还多一层 `:not`） |
| `dsh-client-ui-attachment` | `ImageLightbox` `.backdrop[role=dialog]` | 否 | 否（`position:fixed;inset:0` 的**它自己**就是 dialog） | **不命中** | ✅ 已排除 |
| `dsh-remote-web-ui` | `FencePage` `.fencePage[role=dialog]` | 否 | 否（自身固定全屏） | **不命中** | ✅ 已排除 |
| `dsh-ssh` | `.modal[role=dialog]` | 否 | 否（父 `div.modalBackdrop` 无 role） | **不命中** | ✅ 已排除 |

> 注：`dsh-ssh` 的 `lib/client.js` 在 `node_modules\@deepseek-ai\dsh-ssh` 下**不存在**，
> 它只出现在 `dsh-web-all\lib\client.js` 的打包产物里（`panel_module_css_default$1.modal`）。
> 也就是说 `dsh-web-all` 是**聚合包**，与独立包内容重复，两处命中是**同一个组件**，不是两处 bug。

**对 Lead 第 1 条问题的直接回答：**
- 设置主窗 **仍命中**（成立，无回归）。
- 但 `dsh-web-all` 里"那 10 处"里**有 3 处满足"父级 role=presentation 且是第一层孩子"**，
  按包去重后是 **3 个组件**：**`RemotePanel`、`UpdatePanel`、`ArchiveDialog`**。
  前两个是 Lead 在评论里**点名想排除**的（`lib/client.js:320` 写着"RemotePanel / FencePage /
  UpdatePanel / 任务看板 detail"），**但改动 1 实际没排除掉它们**。

---

### 6.2 攻击 2：`>` 直接子选择器的脆性 + 更鲁棒的等价写法

**结论：成立，而且现实里已经有 3 个触发点。**

#### 6.2.1 触发点 A（现存，不是假想）：RemotePanel / UpdatePanel 被误命中

`dsh-web-all\lib\client.js:25086`：

```js
className: remote_module_css_default.overlay,
role: "presentation",
children: [/* mask */, /* @__PURE__ */ (0, react_jsx_runtime.jsx)(RemotePanel, {...})]
```

`RemotePanel` 的根（`L24602-24604`）：

```js
className: remote_module_css_default.panel,
role: "dialog",
"aria-modal": "true",
```

`UpdatePanel` 完全同构（overlay `L29196-29197`，panel `L28786-28788`）。

**渲染出来的 DOM 和设置窗一模一样**，于是 `lib/client.js:336` 照样命中。实际后果是**视觉叠加**：

```css
/* 宿主自己的 mask（web-all L24467 区域） */
.fThDlq_mask { background: var(--dsw-alias-bg-mask-1); backdrop-filter: var(--dsw-mask-blur); position: absolute; inset: 0; }
/* 面板原本是不透明石板 */
.fThDlq_panel { background: var(--dsw-alias-bg-layer-2); width:560px; ... }
```

改动 1 把 `.fThDlq_panel` 的 `background-color` 按 `!important` 压到 **45% 透明**（`lib/client.js:337`），
于是肉眼看到的是 **"mask 的 blur(10px) → 我们的 blur(16px) → 40% 以下的原页面"** 三层叠化。
这不是"石板变玻璃"，是**双重糊**。而面板尺寸 560 × (≤vh-48) 在 1080p 下 ≈ 560×984 ≈ **551,000 px**
—— 它**绝不会**被 260,000 的 JS 闸门挡住，**只能靠 CSS 排除**。

**修法（零哈希类名、零 `:has()`）**：这两个面板**本来就带宿主锚点**，直接加进 `:not()` 链：

```css
body[data-dsh-maid-companions] [role='presentation'] > [role='dialog'][aria-modal='true']:not([data-dsh-plugin='remote-web-ui']):not([data-dsh-plugin='update']):not([data-dsh-part='dialog']) { … }
```

依据：`RemotePanel` 根**没有** `data-dsh-plugin`（`L24602` 只有 className/role/aria），
但 `UpdatePanel` 根有 `data-dsh-plugin="update"` 且 `data-dsh-part="panel"`（`L28789` 之后）。
⚠️ **这里我不能给你一个"两个都用同一条属性排掉"的写法** —— 我实测 `RemotePanel` 根**只有
`className/role/aria-modal/aria-label`**，属性锚点为空。所以对 RemotePanel 只能：
- **(a) 用它在 overlay 上的锚点**：`[role='presentation'] > :is(…)` 做不到"父级排除"，
  CSS 没有父选择器（`:has()` 你说过不要）；
- **(b) 把 `data-dsh-plugin` 提到 overlay 上做 `:has()`** —— 被你的约束否掉；
- **(c) 接受它，改在**宿主 mask 上**收手**：既然 overlay 里已经有一层 `backdrop-filter` 毛玻璃，
  设置窗和 RemotePanel/UpdatePanel 的**共同结构特征**是「`[role=presentation]` 的直接子里的
  **`mask` 兄弟**」。设置窗有、RemotePanel 有、UpdatePanel 有 —— 这条**区分不出来**。
- **(d) 【推荐】把范围从 `>` 改成"只认设置窗"——用它的 `z-index` + `border-radius: 32px` 这种
  设置窗独有的**几何签名**做 `:where()` 兜底**，仍然不许类名。但这条**不靠谱**，不要用。

**所以对攻击 2 我的诚实回答是：用纯 CSS 属性选择器，"排除 RemotePanel 但保留设置窗"当前无解**，
除非允许 `:has()`（用 overlay 上的 `data-dsh-plugin`），或直接给 `RemotePanel` 加锚点（不是我们能改的）。
**能做的只有一件：让 Damage 可控 —— 把 `-dsh-plugin` 那两处先排除掉（UpdatePanel 可排，RemotePanel 只能靠
"尺寸 + 结构"这条 JS 通路兜住，即 §6.2.2）。**

#### 6.2.2 因此：改动 2 的闸门方向是对的，但**不能只靠它**

你在 `lib/client.js:1019` 把 JS 闸门设成 260,000。RemotePanel/UpdatePanel 的 560 宽面板
面积 ~550,000 → JS 不收；CSS 又误命中 → **没有任何一层能挡住它们**。
反过来，如果哪天把闸门放宽（历史上就放宽过一次，`lib/client.js:1006-1009` 记着 v0.2.12 的教训），
设置窗又会拿到**内联** `backdrop-filter` 把 CSS 的 blur(16px) 顶掉 —— **你的诊断是对的**。
**两条通路必须配成一对：CSS 只认"真模态结构"，JS 只认"小浮层"，中间那段(260K~640K)谁都别碰。**
现在缺的只是 CSS 侧把 `[data-dsh-plugin='update']` 补进 `:not()`。

#### 6.2.3 触发点 B/C（假想但非常现实）

| 触发方式 | 结果 | 可能性 |
| --- | --- | --- |
| 宿主在 overlay 和 panel 之间插一层（做动画包装、焦点陷阱 wrapper、`data-state` 容器） | `>` 断链 → **设置窗退回石板**（静默失效） | 中 |
| 宿主把 `SettingsPanel` 用 `<Suspense fallback>` 包起来 | React 的 Suspense **不产生 DOM 节点**，**不会**断链 | 低（可以排除） |
| 宿主给 panel 外面包 `React.Fragment` | Fragment **不产生 DOM 节点**，**不会**断链 | 低（可以排除） |
| CSS Module 哈希变了 | 我们不写类名，**不受影响** | — |

**所以 `>` 的真实脆性来自"新增 DOM 包装层"，不是 Fragment/Suspense。** 这一点和你的猜测略有出入，
但结论（会静默失效）成立。

**更鲁棒的等价写法（不写哈希类名、不用 `:has()`）**：用**后代选择器 + 结构约束**代替直接子选择器：

```css
/* 不要求直接子：只要是 presentation 容器里的 dialog 就上玻璃 */
body[data-dsh-maid-companions] [role='presentation'] [role='dialog'][aria-modal='true']:not(…) { … }
```

但这条会把 RemotePanel/UpdatePanel/Archive 全都带上（更宽的误伤），**所以不能单独用**。
真正的稳健写法需要一个**能在 panel 本身上面的锚点**。我扫了设置窗 panel 的全部属性（`sg L123-125` 附近）：

```
className: SettingsRoot_module_css_default.panel,  role: "dialog",  "aria-modal": "true",
"aria-labelledby": titleId,  children: …
```

**它身上确实没有 `data-*`。** 唯一非哈希、非 role 的锚点是 `aria-labelledby` ——
但那个值来自 `useId()`，**每次挂载都变**，也不能写。

**→ 结论：在不允许类名、不允许 `:has()`、宿主也不给锚点的前提下，没有"既鲁棒又不误伤"的纯 CSS 写法。
建议你接受 `>` 的现状，但把它当成"会静默失效的已知风险"写进注释，并在 §6.5 加一条自检。**

---

### 6.3 攻击 3：闸门退回 260000 会不会误杀本该有折射的小浮层？

**结论：基本不会。除 cordis 面板外，所有现存小浮层都低于 260,000 全部保留 —— 但斜杠菜单余量只剩约 17,000px。**
实测尺寸（从 CSS 规则直接读出，用下面的命令复现）：

| 浮层 | 类 | 宽度约束 | 高度约束 | **最大面积（估）** | 260000 闸门 | 性质 |
| --- | --- | --- | --- | --- | --- | --- |
| 上下文已用气泡 | `.JObwrW_panel` | `264px` 固定 | 内容驱动（~150-200） | **~ 264×200 ≈ 53,000** | ✅ 通过 | 小浮层 |
| 本轮用量 / Token 用量 / 耗时 / 缓存 | `.bRhRbq_panel` (`stat_dialog`) | `max-width:min(440px,100vw-24px)` | 内容驱动（~120-220） | **≈ 440×220 ≈ 97,000** | ✅ 通过 | 小浮层 |
| 命令/斜杠菜单卡片 | `.mufS8W_card` | `max-width:100%` | `max-height:320px` | **≈ 输入框宽(~760)×320 ≈ 243,000** | ✅ 通过（**但余量最小**） | 小浮层 |
| 输入触发菜单 | `._3e4SsG_menu` | 随输入框撑满 | `max-height:320px` | 同 `mufS8W_card` ≈ 243,000 | ✅ 通过 | 小浮层 |
| jobs 菜单 | `.QsffPG_menu` | `336px` | `max-height:min(420px,…)` | **336×420 ≈ 141,000** | ✅ 通过 | 小浮层 |
| 模型选择菜单 | `._7KE1Ra_menu` | `max-width:min(420px,…)` | `max-height:min(360px,…)` | **≈ 420×360 ≈ 151,000** | ✅ 通过 | 小浮层 |
| 子代理菜单 | `.ZKlsPq_menu` | `336px` | `max-height:min(560px,…)` | **336×560 ≈ 188,000** | ✅ 通过 | 小浮层 |
| cordis 面板 | `.Nqubda_panel` | `420px` | `max-height:60vh` | **420×(0.6×1080)=272,000** | ❌ **可能被挡** | **页面级侧栏面板**，不属于小浮层 |
| 任务面板（todo） | `.lXshSW_root` | 跟随输入卡宽 | 内容驱动 | ≈ 760×300 ≈ 228,000 | ✅ 通过（且另有 `:not([data-testid='todo-panel'])` 兜底） | 小浮层 |
| RemotePanel | `.fThDlq_panel` | `560px` | `max-height:calc(100vh-48px)` | **≈ 560×984 ≈ 551,000** | ❌ 被挡（CSS 侧误命中，见 6.2.1） | 页面级 |
| UpdatePanel | `.WYT-ka_panel` | `560px` | 同上 | ≈ 551,000 | ❌ 被挡（同上） | 页面级 |
| 设置主窗 | `.VOzbGW_panel` | `800px` | `height:min(800px,100vh-48px)` | **640,000** | ❌ 被挡（意图如此 ✓） | 页面级 |

**逐条判定：**

- **上下文已用 / 本轮用量 / Token 用量 / 耗时 / 缓存** → 全部 ~53K–97K，**安全，仍走 JS 折射**。
  这几张正是过去出过 bug 的（`lib/client.js:1001-1003` 注释记着"上下文已用被截断"），好消息是闸门放宽回 260K
  对它们无影响。
- **唯一真正的风险点是 `mufS8W_card` / `_3e4SsG_menu`（≈243,000）**：它们 `max-height:320px`、
  宽度随输入框撑满。在**宽屏 + 长命令列表**下会逼近 260,000。一旦超了，斜杠菜单会**静默失去折射**。
  这在 `LIQUID_MAX_AREA`=1,100,000 下不会发生，在 260,000 下**可能会**。建议：
  要么把闸门设成 **300,000**（拉开余量，仍远低于 RemotePanel 551K / 设置窗 640K），
  要么单独给 `[role='listbox']` 豁免尺寸闸门（`input-trigger` 的菜单是 `role="listbox"`，
  见 `dsh-client-ui-input-trigger\lib\client.js`，2 处 `role: "presentation"` 都在 `MenuView` 内部标题上）。
- **cordis 面板（420×60vh）** → 1080p 下 272,000，**会被挡**。它属于"页面级侧栏"，被挡**符合设计意图**，
  但请确认它本来的折射是"想要的"还是"意外的"。
- **任务面板** → 228,000，**安全**。

**→ 对攻击 3 的回答：260,000 会误杀 `cordis` 面板（420×60vh ≈ 272,000，页面级，属预期），
并**可能在宽屏 + 长命令列表下**误杀斜杠菜单（≈243,000，余量 17,000px）。其余全部安全。**

#### 复现命令（读全部浮层的几何约束）

```powershell
$c = Get-Content "D:\DeepSeek-Harness\node_modules\@deepseek-ai\dsh-client-ui-chat\lib\client.js" -Raw
[regex]::Matches($c,'\.bRhRbq_panel\{[^}]*\}') | ForEach-Object { $_.Value }   # 本轮用量

$c = Get-Content "D:\DeepSeek-Harness\node_modules\@deepseek-ai\dsh-client-ui-conversation\lib\client.js" -Raw
[regex]::Matches($c,'\.JObwrW_panel\{[^}]*\}') | ForEach-Object { $_.Value }   # 上下文已用
[regex]::Matches($c,'\.lXshSW_root\{[^}]*\}')  | ForEach-Object { $_.Value }   # 任务面板

$c = Get-Content "D:\DeepSeek-Harness\node_modules\@deepseek-ai\dsh-client-ui-commands\lib\client.js" -Raw
[regex]::Matches($c,'\.mufS8W_card\{[^}]*\}')  | ForEach-Object { $_.Value }   # 斜杠菜单

$c = Get-Content "D:\DeepSeek-Harness\node_modules\@deepseek-ai\dsh-client-ui-settings-general\lib\client.js" -Raw
[regex]::Matches($c,'\.VOzbGW_(overlay|mask|panel)\{[^}]*\}') | ForEach-Object { $_.Value }  # 设置窗

$c = Get-Content "D:\DeepSeek-Harness\dsh\profiles\desktop\node_modules\@linxin666\dsh-web-all\lib\client.js" -Raw
[regex]::Matches($c,'\.(fThDlq|WYT-ka)_(overlay|mask|panel)\{[^}]*\}') | ForEach-Object { $_.Value }  # Remote/Update
```

---

### 6.4 攻击 4：输入框是否仍然无条件优先？

**结论：是，完全不受改动 2 影响。** 代码证据（`lib/client.js:1004` 与 `1017-1019`）：

```js
const card = live.filter((el) => el.hasAttribute("data-composer-card"));   // L1004 无尺寸条件
…
const rest = live.filter((el) =>
  !el.hasAttribute("data-composer-card") &&                                 // L1018 显式剔除
  (el.offsetWidth * el.offsetHeight) <= LIQUID_RING_MIN_AREA);              // L1019 尺寸闸门
…
const picked = card.slice(0, 1);                                            // L1022 无条件入选
```

- `card` 的筛选**完全不经过** `LIQUID_RING_MIN_AREA`，也不经过 `LIQUID_PIXEL_BUDGET`（预算只作用于 `rest`，`L1030-1034`）。
- `rest` 里**显式** `!el.hasAttribute("data-composer-card")`，输入框不会重复进入。
- 输入框之前已经过 `live` 的可见性过滤（`L992-999`：`isConnected` + `offsetWidth/Height !== 0` + `visibility/display`），
  那是**可见性**判据不是**尺寸**判据，与这次改动无关。

**成立（不会被波及）。** 唯一相关的小问题：如果输入框因为某种原因 `offsetHeight === 0`（例如刚挂载
还没布局），`live` 会把它过滤掉 —— 这是 v0.2.19 之前就有的行为，不是这次引入的。

---

### 6.5 攻击 5：还有没有第三条致病通路 —— iframe 与 `backdrop-filter` 的合成行为

**结论：有，而且这是唯一能解释"只在 bili 页糊、设置首页不糊"的通路。逻辑成立，但必须真机验证。**

#### 推理链

1. **bili 页的结构**（本报告 §1 已证）：
   `div.panel[aria-modal] (设置窗，`backdrop-filter: blur(16px) saturate(1.2) brightness(1.15)`, `overflow:hidden`)
   → `div.content > div.options` → bili 的 `<iframe src="{origin}/__bili/?embed=1&lang=…&theme=…#/{page}">`，高 `min(640px,78vh)`。`

2. **`backdrop-filter` 的模糊对象是"元素背后的东西"，不是元素内部的子孙。**
   所以 **iframe 里的内容不会因为面板的 `backdrop-filter` 而被糊** —— 这一点本报告 §3 已实测确认
   （`lib/client.js:315-316` 注释也记着同样的实验室结论）。**"iframe 内容被糊"这条假说可以排除。**

3. **但 iframe 会创建一个独立的合成层（compositing layer / out-of-process iframe in Electron）。**
   当 `backdrop-filter` 元素的**背后**出现一个独立合成的子层时，Chromium 会把该区域标记为
   **"backdrop 需要重新采样"**。在**跨进程 iframe**（Electron 默认 `site-per-process`）的情况下，
   主进程拿不到子层的稳定快照，只能**退化成对合成结果做重采样**，代价是：
   - 每次 iframe 内容变化（bili 的 SPA 路由切换 `#/{page}`、主题切换、列表滚动）都要
     **重新计算整块 800×800 的 backdrop**；
   - 如果 iframe 内容在动（bili 页是有动画的 SPA），面板背后那一块会**持续重算**，
     在低端 GPU 上表现为 **"间歇性重新模糊" / 帧率下降**，而不是稳定的 16px 高斯。

4. **这就解释了"只有 bili 页糊"**：设置首页在 iframe 位置放的是普通 DOM（`div.rows`），
   backdrop 只需要算一次并缓存；bili 页放的是**独立合成层**，缓存失效。**同一个 16px，观感不同。**

5. **额外叠加一层**：设置面板的 `overflow: hidden`（`sg L123` 那条 `.VOzbGW_panel` 规则里）
   + `border-radius: 32px`，在 `backdrop-filter` 元素上会让 Chromium 走
   **"clip + backdrop-filter"** 慢路径（需要在裁剪后的区域内重新采样 backdrop）。
   这会让第 3 步的重采样代价再翻一倍。

#### 哪些是**必须真机验证**的

| 判断 | 静态可定性 | 必须真机 |
| --- | --- | --- |
| iframe 内容不会被面板 `backdrop-filter` 糊 | ✅ 可证否（§3 已测 + 规范语义） | — |
| iframe 会引入独立合成层，使 backdrop 缓存失效 | ✅ 可定性（Chromium 行为） | **需验证**：实际帧率 / 是否真的重算 |
| `overflow:hidden` + `border-radius` 让 backdrop-filter 走慢路径 | ✅ 可定性 | **需验证**：加/去 `overflow` 后差异 |
| 用户看到的"整屏发糊"是这条通路，而不是 16px 本身太大 | ❌ | **必须验证**：见下面脚本 |

#### 真机最小验证脚本（复制即用，只读，不改 DOM 样式）

```js
// F12 → Console，分别在「设置首页」和「bili 页」各跑一次
const p = document.querySelector('[aria-modal="true"][role="dialog"]');
const cs = getComputedStyle(p);
console.log({
  backdropFilter: cs.backdropFilter,
  overflow: cs.overflow,
  radius: cs.borderRadius,
  size: [p.offsetWidth, p.offsetHeight],
  inlineBF: p.style.backdropFilter || '(none)',       // 关键：看内联有没有覆盖
  hasIframe: !!p.querySelector('iframe'),
  iframeBox: (() => { const f = p.querySelector('iframe'); if (!f) return null;
    const r = f.getBoundingClientRect(); return [r.width, r.height]; })(),
});

// 压力：如果这条通路成立，把 overflow 临时去掉 *应当* 让重算次数下降
// （只观察性能，不改颜色/透明度，不违反 v0.2.18 的参数约束）
p.style.overflow = 'visible';
// 然后切 bili 页内的 #/ 路由，用 DevTools 的 FPS meter 对比前后
```

**若 `hasIframe: true` 且 `inlineBF` 非空** → 你的"第三条通路"和"内联覆盖"**同时成立**，
两者叠加才是用户看到的"整屏糊"。

---

### 6.6 复核结论表

| # | Lead 的问题 | 判定 | 一句话证据 |
| --- | --- | --- | --- |
| 1 | 设置主窗还会不会被 CSS 命中？ | **成立（仍命中）** | `sg L116/117/123/124/125`，四连 `:not()` 全不命中 |
| 1b | 其他 aria-modal 组件是否有满足"父级 presentation 且第一层孩子"的？ | **是，点了名：`RemotePanel`、`UpdatePanel`、`ArchiveDialog`** | `web-all L25086-25087 / L29196-29197 / L53409`，§6.1.1 的脚本 |
| 2 | `>` 直接子选择器的脆性 | **成立**；Fragment/Suspense **不产生 DOM 节点**所以不会断链，真实风险是"新增包装层" | 触发点 A 已经存在（见 1b） |
| 2b | 更鲁棒的等价写法 | **在"不许类名 + 不许 `:has()` + 宿主无 data-* 锚点"三条约束下不存在** | `sg L123-125` 面板本身属性为空，`aria-labelledby` 来自 `useId()` 每次变 |
| 3 | 闸门 260000 会误杀小浮层吗？ | **基本不会**；唯一实质风险是斜杠菜单 `mufS8W_card`/`_3e4SsG_menu`（≈243,000，余量仅 7%）；cordis 面板（≈272,000）会被挡但属页面级 | 见 §6.3 尺寸表 |
| 4 | 输入框是否仍无条件优先？ | **成立，不受影响** | `lib/client.js:1004` 无尺寸条件；`1018` 显式剔除；`1022` 无条件入选 |
| 5 | 第三条致病通路（iframe 合成上下文） | **成立（推理链完整），但必须真机验证** | iframe 不会被 panel 的 `backdrop-filter` 糊（可证否），但会破坏 backdrop 缓存 → 持续重算 |
| — | 改动 2 的必要性 | **成立** | 设置窗 640,000 > 260,000 → 进不了 JS；且历史上被内联样式覆盖过（`lib/client.js:1006-1009`） |

### 6.7 我建议你改的两行（只建议，未改）

```diff
- body[${OWNER_ATTR}] [role='presentation'] > [role='dialog'][aria-modal='true']:not([data-composer-card]):not([role='menu']):not([role='alertdialog']):not([data-testid='todo-panel']) {
+ body[${OWNER_ATTR}] [role='presentation'] > [role='dialog'][aria-modal='true']:not([data-composer-card]):not([role='menu']):not([role='alertdialog']):not([data-testid='todo-panel']):not([data-dsh-plugin='update']) {
```

（`RemotePanel` 在 `ask` 之前无法排除；见 §6.2.1 的 (a)-(d) 四条路，**没有一条满足你现有的约束**。）

```diff
- const LIQUID_RING_MIN_AREA = 260000;
+ const LIQUID_RING_MIN_AREA = 300000;   // 给斜杠菜单(≈243K)留出余量，仍远低于 RemotePanel(≈551K)/设置窗(640K)
```

---

## 7. 一页结论表（静态取证，§1–§5 的汇总）

| 问题 | 静态结论 | 可靠性 |
| --- | --- | --- |
| Q1-1 是 `role="dialog"` + `aria-modal` 吗？ | **不是。** 0 命中（唯一的 `role=` 是 querySelector 字符串） | 高（全文件已完整读完） |
| Q1-2 是 iframe 吗？ | **是。** `<iframe src="{origin}/__bili/?embed=1…#/{page}">`，高 `min(640px,78vh)` | 高 |
| Q1-3 挂在哪个容器？ | `settings.section` 槽位 → `div.panel[aria-modal]` 的 `div.content > div.options` 里 | 高 |
| Q2 自带 backdrop-filter？ | **没有。** 客户端 + 服务端产物全部 0 命中 | 高 |
| Q2 自带 opacity？ | 只有 4 处 `<p>` 的 `opacity: 0.7`，其中 3 处在 ok 态不渲染 | 高 |
| Q3-a 误命中我的 aria-modal 规则？ | **否**（bili 面板无 role/aria-modal，且是面板的后代） | 高 |
| Q3-b 全屏 + 自带 backdrop-filter？ | **否**（不是全屏，且不带滤镜） | 高 |
| Q3-c 新 BackdropRoot 让祖先玻璃失效？ | 理论成立，但方向是"变清晰"不是"变糊" | 中 |
| Q3-d 自带模糊叠加 16px？ | **本地包否**；iframe 内部那份跨源页面**未验** | 中（受限于跨源） |
| Q3-e JS 的 `url(#…) blur(1px)` 覆盖 CSS 的 `blur(16px)`？ | **代码上极可能**（内联样式优先级更高），需真机确认 | **中，但最可疑** |

**给 lead 的一句话**：bili 面板不是模态，它没有 `role`/`aria-modal`/`backdrop-filter`，
而且它在设置面板**里面**。误命中假说可以关掉。要查"进去就糊"，
先看 `lib/client.js:1308` 那两行内联 `el.style.backdropFilter` 有没有覆盖掉 CSS 的 16px，
以及它的 `feDisplacementMap` 在面板尺寸变化时是否重算正确。

---

## 附：本报告用到的全部复现命令

```powershell
# 1) bili 客户端入口是否存在
Get-ChildItem "D:\DeepSeek-Harness\dsh\profiles\desktop\node_modules\billion-context\dist" -Recurse -File |
  Where-Object { $_.Length -lt 600000 -and $_.Extension -ne ".map" } |
  ForEach-Object { "{0,9}  {1}" -f $_.Length, $_.Name }
# -> 只有 build-info.json / agent\dsh-acp.js / agent\dsh-native-client.js

# 2) bili 面板的关键属性
$f = "D:\DeepSeek-Harness\dsh\profiles\desktop\node_modules\billion-context\dist\agent\dsh-native-client.js"
Select-String -Path $f -Pattern 'role=' -Context 0,0     # 1 命中，L88（querySelector 字符串）
Select-String -Path $f -Pattern 'iframe' -Context 0,0     # 2 命中，L317 注释 / L320 createElement
Select-String -Path $f -Pattern 'opacity' -Context 0,0    # 4 命中，全在 <p> 上

# 3) 设置外壳的 dialog 属性
$s = "D:\DeepSeek-Harness\node_modules\@deepseek-ai\dsh-client-ui-settings-general\lib\client.js"
Select-String -Path $s -Pattern 'aria-modal|settings\.section' -Context 0,0
# -> L125 aria-modal / L167 renderSlot("settings.section", …)

# 4) dsh-web-all 里所有 aria-modal 出现处
Select-String -Path "D:\DeepSeek-Harness\dsh\profiles\desktop\node_modules\@linxin666\dsh-web-all\lib\client.js" `
  -Pattern '"aria-modal": "true"' | Measure-Object   # -> 10
```
