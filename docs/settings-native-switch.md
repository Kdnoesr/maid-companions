# 设置行与开关 · 对齐宿主（v0.2.35）

> 单一事实源：本插件在 DSH 设置页里渲染的那一行（标题 + 开关 + 说明）**逐条对齐宿主**，
> 颜色 100% 走宿主 token，因此浅色/深色自动跟随，不写死任何色值。
> 以后宿主改版，只需照着本文第 1 节的出处重新取一次值。

---

## 1. 出处（app.asar 原文）

宿主样式来自：

```
D:\DeepSeek Harness\resources\app.asar
  └─ /dsh/node_modules/@deepseek-ai/dsh-web-frontend/dist/assets/index-BNyAYEM7.css
```

| 用途 | 宿主类（CSS Modules 哈希） | 关键声明 |
|---|---|---|
| 行容器 | `._field_bjqpo_3` | `display:flex;flex-direction:column;gap:6px;padding:12px 0` |
| 行分隔线 | `._field_bjqpo_3` | `border-top:.5px solid var(--dsw-alias-border-l2)` |
| 标题行 | `._head_bjqpo_14` | `display:flex;align-items:center;gap:8px` |
| 标题 | `._label_bjqpo_20` | `flex:1;min-width:0;font-size:13px;font-weight:500;line-height:1.5;color:var(--dsw-alias-label-primary)` |
| 说明 | `._help_bjqpo_41` | `padding:10px 0 0;font-size:12px;line-height:1.6;color:var(--dsw-alias-label-secondary)` |
| 开关 | `._switch_1ik0f_5` | `box-sizing:border-box;position:relative;flex:0 0 auto;width:36px;height:20px;padding:2px;border:0;border-radius:999px;corner-shape:round;background:var(--dsw-alias-border-l3);cursor:pointer` |
| 开关·开 | `._switch_1ik0f_5[aria-checked=true]` | `background:var(--dsw-alias-brand-primary)` |
| 开关·禁用 | `._switch_1ik0f_5:disabled` | `cursor:default;opacity:.5` |
| 开关·焦点 | `._switch_1ik0f_5:focus-visible` | `outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:2px` |
| 圆钮 | `._thumb_1ik0f_33` | `display:block;width:16px;height:16px;border-radius:50%;corner-shape:round;background:var(--dsw-alias-label-primary-foreground);transition:transform .12s ease` |
| 圆钮·关 | `._switch_1ik0f_5[aria-checked=false] ._thumb_1ik0f_33` | `background:var(--dsw-alias-switch-thumb)` |
| 圆钮·开 | `._switch_1ik0f_5[aria-checked=true] ._thumb_1ik0f_33` | `transform:translate(16px)` |

宿主组件签名（asar 偏移 105468719，`function KD(...)`）：

```js
<button type="button" role="switch" aria-checked={checked} aria-label={label}
        disabled={disabled} className={he(styles.switch, className)}>
  <span className={styles.thumb} />
</button>
```

要点：**状态只由 `aria-checked` 驱动**，没有 `.is-on` 之类的类名，也没有「启用/停用」文字。

## 2. 主题 token 是怎么算出颜色的

token 定义在 `/dsh/node_modules/@deepseek-ai/dsh-client-ui-theme/lib/client.js`：

| token | 浅色 | 深色 |
|---|---|---|
| `--dsw-alias-brand-primary` | `neutral-bluish-1000` = `#0f1115` | `neutral-bluish-50` = `#f9fafb` |
| `--dsw-alias-switch-thumb` | `neutral-bluish-00` = `#fff` | `neutral-bluish-400` = `#adb2b8` |
| `--dsw-alias-label-primary-foreground` | `neutral-bluish-00` = `#fff` | `neutral-bluish-1000` = `#0f1115` |
| `--dsw-alias-border-l3` | `#0000001f` | `#ffffff29` |

于是开关的四种外观**自动**变成：

| | 浅色 | 深色 |
|---|---|---|
| 开 | 黑轨道 + 白钮 | 白轨道 + 黑钮 |
| 关 | 黑 12% 轨道 + 白钮 | 白 16% 轨道 + 中灰钮 |

这正是用户截图里「白色胶囊」的样子 —— 旧版本写死 `#4f73ff`/`#fff`，所以一直是蓝色胶囊。

## 3. 本插件的对应写法

`lib/client.js` 的 `SETTINGS_CSS`（名字从前缀 `mc-setting-`）：

| 宿主 | 本插件 |
|---|---|
| `._field_bjqpo_3` | `.mc-setting-field` |
| `._head_bjqpo_14` | `.mc-setting-head` |
| `._label_bjqpo_20` | `.mc-setting-label` |
| `._help_bjqpo_41` | `.mc-setting-help` |
| `._switch_1ik0f_5` | `.mc-setting-switch` |
| `._thumb_1ik0f_33` | `.mc-setting-switch-thumb` |

每个 `var()` 都带同语义兜底值（例如 `var(--dsw-alias-border-l3,rgba(0,0,0,.12))`），
token 缺失时外观仍然正确，不会退化成透明或黑块。

**已删除**：`.mc-setting-row / -copy / -title / -description / -control / -state`、
`.is-on` 类、`hover{filter:brightness(.97)}`、写死的 `#4f73ff` 与 `#fff`。

## 4. 验证方法（可复现）

对照 rig：`D:\DSH Workspace\_rim\v35\rig.cjs`（开关级）、`row_rig.cjs`（整行级）。
做法：把宿主 CSS 的 switch/thumb/field 规则**原样**从 asar 解出来的 `index.css` 里抠出来，
再把本插件 `client.js` 里的 `SETTINGS_CSS` 原文抠出来，两侧并排渲染，
用两套 token 值分别模拟浅色/深色，然后比较 `getBoundingClientRect` + 计算样式 + 像素差。

实测（dpr 2，`transform:scale(3)` 放大 3 倍后）：

| 状态 | 轨道尺寸 | 轨道色 | 圆钮尺寸 | 圆钮色 | 像素差（>8） |
|---|---|---|---|---|---|
| 深色·开 | 108×60 ≡ 36×20 | `rgb(249,250,251)` | 48×48 ≡ 16×16 | `rgb(15,17,21)` | 52/25920 = 0.20% |
| 深色·关 | 同上 | `rgba(255,255,255,.16)` | 同上 | `rgb(173,178,184)` | 4/25920 = 0.02% |
| 浅色·开 | 同上 | `rgb(15,17,21)` | 同上 | `rgb(255,255,255)` | 52/25920 = 0.20% |
| 浅色·关 | 同上 | `rgba(0,0,0,.12)` | 同上 | `rgb(255,255,255)` | **0/25920 = 0%** |

残余的 0.2% 只出现在圆角圆弧的几个像素上（3 倍放大下的抗锯齿差异，max 48/255），
1 倍实际尺寸下不可见；整行截图见 `docs/v035-row-dark.png` / `docs/v035-row-light.png`。

## 5. 回退

- 想回到旧观感：`GOOD-20261102-2340-v0.2.34-narrow-band`（v0.2.34 备份）。
- 只想改开关尺寸：`width/height/padding` 与 `translate()` 必须**成组**改 ——
  `translate = width - 2×padding - thumb`（36 − 4 − 16 = 16）。
