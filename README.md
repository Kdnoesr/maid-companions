# 左右鲸鱼娘女仆（maid-companions）

一个 [DeepSeek Harness](https://github.com/deepseek-ai)（DSH）Web 插件：在对话区左右显示两位鲸鱼娘女仆立绘，
并给对话输入框与各类浮层加上**液态玻璃（Liquid Glass）**质感。

- **纯客户端插件**，不改动 DSH 本体、不写任何数据、不发任何网络请求
- **只在插件启用时生效**；在「设置 → 通用」里关闭开关，界面**完全恢复原版**
- 立绘亮度恒定，不随会话激活或暗色主题衰减
- 兼容 DSH Desktop **0.2.x**（`engines.dsh` 声明为 `>=0.2.0-rc.2 <0.3.0`）

---

## 安装

### 方式一：从 npm 安装（推荐）

在 DSH 侧栏「插件」→「添加插件」里填入包名：

```text
@kdnoesr/maid-companions
```

或命令行：

```bash
dsh plugin --profile desktop add '@kdnoesr/maid-companions'
```

> npm 包不需要构建授权，装的就是仓库里已构建好的 `lib/client.js`。
> 如果 npm 上还没有这个版本，请用下面的 GitHub 方式安装。

### 方式二：从 GitHub 安装（备用）

在同一个「添加插件」框里填入（只填地址，不加 `dsh plugin add`）：

```text
github:Kdnoesr/maid-companions#main
```

> 仓库里已经提交了构建好的 `lib/client.js`，所以从 GitHub 装也不需要构建授权。

### 方式三：本地开发

```bash
git clone https://github.com/kdnoesr/maid-companions.git
dsh plugin --profile desktop add link:/path/to/maid-companions
```

### 装完之后

1. **重启一次 DSH**。客户端 bundle 由宿主按内容哈希分发，新装的插件要等宿主重启后才会被纳入分发图。
2. 进入 **设置 → 通用 → 左右鲸鱼娘女仆**，用开关控制启用/停用。

> **不要**把它和 `@linxin666/dsh-web-all` 里的皮肤中心版 `maid-atelier` 装在同一个 profile 里 ——
> 两者的样式契约不同，叠装会让界面显示错乱。

---

## 功能

### 1. 女仆立绘

在对话列左右各显示一位鲸鱼娘立绘。

- 空会话（hero）时放大到 96% / 92%；进入会话后缩小到 64% / 62%
- 缩小用 `transform: scale()` 而非 `height` —— **布局属性动画会每帧触发布局与重绘**，
  而本插件用的是约 2MP 的大图，用 `height` 动画会明显卡顿
- 锚点：左立绘贴左+贴底，右立绘贴右+贴底（`transform-origin`）

### 2. 功能页分层与半透明

DSH 的功能页（技能中心 / 任务看板 / 上下文洞察等）挂在 `main` 槽位里，而这个槽位的宿主元素是
`display: contents` —— **它不生成盒子**，所以子元素会被"提升"成 `centerCol` 的直接 flex 子项，
从而落在立绘**之下**。

插件据此把页根抬到立绘之上，并把页面底色（`--dsw-alias-bg-base`）置透明、
把内容板块底色（`--dsw-alias-bg-layer-1/2/3`）按比例降 alpha，
做出"立绘从内容板块缝隙里透出来"的效果：

| 区域 | layer-1 / 2 / 3 |
| --- | --- |
| 功能页内容板块 | 82% / 78% / 74% |
| 轨迹 · 对话 | 34% / 40% / 46% |

技能中心的整页**只有 `bg-base`**、没有 layer 卡片兜底，文字会直压立绘，
因此单独按 42% 铺一层底色，其余面板不动。

> 这套规则是按 `[data-slot]` **结构边界**写的，不是按类名。
> 所以**以后新装的功能页插件会自动跟着变透明**，不需要再手工加名单。

### 3. 液态玻璃

给以下元素加**实时背景折射 + 毛玻璃**：

| 区域 | 说明 |
| --- | --- |
| 对话输入框 | 主对象 |
| 菜单 / 气泡 | 权限选择、模型选择、上下文用量、@ 提及、斜杠命令等 |
| 居中弹窗 / 工具提示 | `[role=dialog]` / `[role=tooltip]` 等，**限小尺寸** |

**原理**：把圆角矩形算成有符号距离场，边缘生成"指向中心"的位移向量场，
编码为位图（`R→X`、`G→Y`、`128` 为零位移），再由
`<feImage>` + `<feDisplacementMap>` 做实时扭曲，最后通过
`backdrop-filter: url(#id) blur() saturate() brightness()` 生效。
这是 Apple Liquid Glass 的**透镜折射**，而不是单纯的模糊。

**尺寸闸门**：`backdrop-filter` 会把它**背后**的内容全部糊掉。DSH 的设置窗
（`.wCInkW_panel`，800×800，带 `role="dialog"`）会被 `[role=dialog]` 命中，
一旦挂上滤镜，整个设置界面就会糊成一片。因此插件设了
`LIQUID_MAX_AREA = 260000`（≈510×510）的面积闸门 ——
**大面板一律不发玻璃，小浮层照常**：

| 元素 | 尺寸 | 结果 |
| --- | --- | --- |
| 设置窗 `.wCInkW_panel` | 640000 px | 排除（保持锐利） |
| 任务面板 | 104000 px | 玻璃 |
| 权限气泡 | 47520 px | 玻璃 |
| 模型菜单 | 66000 px | 玻璃 |

完整技术文档（原理、参数实测数据、踩坑清单）见 `docs/liquid-glass.md`。

---

## 兼容性与降级

插件会**自动检测**运行环境，任何不满足的情况都**静默降级**，不会报错、不会影响 DSH 其他功能：

| 情况 | 表现 |
| --- | --- |
| 浏览器不支持 `backdrop-filter: url()`（如 Safari / Firefox） | 只保留毛玻璃，无折射 |
| 软件渲染 / 无 WebGL 加速 | 完全不启用折射（位移滤镜在软渲下极慢） |
| 浮层类名因 DSH 升级而变化 | 该浮层退回原版外观（不崩） |
| DSH 版本低于 `0.2.0-rc.2` | 由 `dsh.engines.dsh` 拦截，不加载 |

> 折射效果需要 **Chromium 内核的新版 Chrome / Edge**。DSH Desktop 自带内核，满足条件。

### 性能说明

- 位移贴图只在元素**尺寸变化**时重建（120ms 去抖），不是每帧
- 同时存在的浮层受**像素预算**（`LIQUID_PIXEL_BUDGET = 900000`）限制；输入框与当前最大的浮层始终优先
- 立绘动画走合成器（`transform` + `will-change`），不触发布局

---

## 已知副作用

1. **文本抗锯齿变化**：只要用了 `backdrop-filter`，Chromium 会关闭该区域的
   LCD 亚像素抗锯齿，文字改为灰度抗锯齿。仅影响抗锯齿方式，无颜色/布局改变。
2. **大面板刻意不加效果**：见上文尺寸闸门。

---

## 调参

所有可调项集中在 `lib/client.js`：

```js
// 液态玻璃参数
const LIQUID = {
  strength: 0.8,    // 边缘折射强度
  bezelPx: 24,      // 边缘透镜带宽度（越大，折射区域越宽）
  zoom: 0,          // 全局放大率（0 = 仅边缘透镜，物理上更正确）
  dispersion: 0,    // 色散强度（0 = 关闭；0.05~0.12 可开启边缘分光）
  blurPx: 1,        // 磨砂强度（越大越糊，折射越不明显）
  saturate: 1,      // 饱和度
  brightness: 1.05, // 透光感
};

const LIQUID_MAX_AREA   = 260000;  // 超过这个面积的元素不发玻璃
const LIQUID_PIXEL_BUDGET = 900000; // 同屏玻璃像素总预算
```

毛玻璃 / 透明度在 `STAGE_CSS` 里，每个选择器都有注释说明取值理由。

> ⚠️ **注意**：`lib/client.js` 是**唯一的实现**，`src/` 下是旧的桩代码。
> 改完直接改 `lib/client.js` 即可生效（dev link 方式下刷新页面就行）。
> **不要运行 `scripts/build.sh`** —— 它会用 `src/` 的桩覆盖掉 `lib/client.js`。

---

## 目录结构

```
lib/index.js           宿主半边（本插件无宿主行为，空实现）
lib/client.js          客户端半边（立绘 + 液态玻璃），唯一实现
cordis.patch.yml       bundle patch：把宿主条目插入 web 插件名册
docs/liquid-glass.md   液态玻璃技术文档
docs/overlay-surfaces.md  浮层覆盖面与"DSH 升级后如何重新发现类名"
scripts/               开发期校验脚本（不随包发布）
src/                   旧桩代码（见上文警告）
```

---

## 许可

本插件的**代码**与**美术资源**适用**不同**许可：

| 部分 | 许可 |
| --- | --- |
| 代码（`lib/` 中的 JS/CSS、`src/`、`cordis.patch.yml`、`scripts/`、`docs/`） | **BSD-3-Clause** |
| 鲸鱼娘女仆立绘（内嵌于 `lib/client.js`） | **CC BY-NC-SA 4.0** |

### ⚠️ 美术资源：禁止商业性使用

立绘来自 [dsh-deep-whale](https://github.com/Small-tailqwq/dsh-deep-whale) 的
`maid-atelier` 皮肤，适用 **CC BY-NC-SA 4.0**（署名—**非商业性使用**—相同方式共享）。
**不得将本插件的立绘用于任何商业用途。**

即使美术资源被内嵌进源码、CSS、data URL 或 `lib/`，其许可**不改变**。

### 署名链（必须完整保留）

1. **上善** —— 鲸鱼娘角色形象原作者
   · [Pixiv](https://www.pixiv.net/users/62155430) · [Bilibili](https://b23.tv/8h5L4xz)
2. **ZipZipPipe** —— 加入 DeepSeek 元素的女仆鲸鱼娘二次设计（GPT Image 2）
   · [Pixiv](https://www.pixiv.net/users/18604994) · [Bilibili](https://b23.tv/Pnw6nG8)
3. **Small-tailqwq** —— [dsh-deep-whale](https://github.com/Small-tailqwq/dsh-deep-whale) / maid-atelier 皮肤

许可正文见 [LICENSE](LICENSE)（代码）与 [LICENSE-ARTWORK](LICENSE-ARTWORK)（美术），
完整署名链与复用要求见 [NOTICE](NOTICE)。

> 反馈与问题请在本仓库的 issue 中提出，**不要**去联系上面两位老师。

---

本插件为**非官方**第三方插件，与 DeepSeek / DeepSeek Harness 官方无关。
