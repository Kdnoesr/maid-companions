//! 23-css-controls：STAGE_CSS 第 4 块 —— v0.4.9 玻璃面控件材质。
//! 内容：菜单项/按钮/开关/标签页/滚动容器发丝等控件三态样式（合并自 a08 v2.1）。
//! 依赖：同一模板字符串中段；含 --mc-* 变量使用方（定义见 24 块与 30 块）。
//! 边界：结束于 v0.3.7「::before 玻璃静音」注释之前。
   ⚠️ 卡片比面板"更实"是刻意的：它是承载文字的贴片，需要更高对比度；
   但仍保留 12~38% 透光 + 同一条发丝边 + 同一支内辉，读起来是同一块玻璃的厚处。 */
body[${OWNER_ATTR}] {
	--mc-card-tint: 45%;
	--mc-card-glow-alpha: 0;
}
body[${OWNER_ATTR}] [data-mc-card] {
	background-color: var(--mc-fill-card) !important;
	box-shadow:
		0 0 0 0.5px var(--mc-hairline),
		0 1px 2px rgba(0, 0, 0, 0.06) !important;
}
/* ═══ v0.4.9 · 玻璃面控件材质（合并自 a08-controls v2.1，真机三态验证过）════
   原则：玻璃上的控件**不叠 blur**，层级只用 ①0.5px 发丝 ②冷白内辉 ③8%/14% 白薄涂；
   hover/active 一律用 background-image 叠色（改 background-color 会把实底控件擦透明）。*/
/* =====================================================================
   a08-controls · 玻璃面控件材质 / 交互态规范  v2 (2026-11-13, DSH 0.2.2-rc.1 dark)
   适用：材质引擎 direct 模式的玻璃面：composer 卡片 / 账号菜单 / 设置窗 / 弹层
   原则：玻璃上「控件不叠 blur」。层级只用
         ①0.5px 发丝描边(inset) ②冷白内辉(inset) ③8%/14% 白薄涂
         色温统一冷白 rgba(212,232,255)；主按钮保留品牌 #7aaaff。
   宿主观测（dark, body[data-ds-dark-theme]）：
     --dsw-alias-interactive-bg-hover #ffffff14 (8%)
     --dsw-alias-interactive-bg-active #ffffff24 (14%)
     label-primary #f9fafb / secondary #cfd3d6 / tertiary #adb2b8
     state-business-primary #7aaaff ; focus-ring-width 2px
     ⚠ 本版 --dsw-focus-ring-color 在 body 上"已定义但为空"，var() 回退不生效
       → --mc-ctl-focus 必须硬编码 #7aaaff，不能用双层 var 回退。
   分层策略：
     G 层（玻璃面内控件）= §1–§6，加发丝+内辉+薄涂；
     N 层（不透明面控件：侧栏行/顶部 tab/底部面板 tab）= 保持宿主 native，
        只补 §4b 的 hover 缺陷与 §7 的焦点环统一，不引入玻璃辉光。
   ===================================================================== */

/* v0.15.0（a05）：白色叠加在浅色主题=白底白、完全不可见 → 全部改成
   label-primary 的 color-mix（深色=白、浅色=黑，语义同源）。 */
:root{
  --mc-ctl-hover:      color-mix(in srgb, var(--dsw-alias-label-primary, #ffffff) 8%, transparent);
  --mc-ctl-active:     color-mix(in srgb, var(--dsw-alias-label-primary, #ffffff) 14%, transparent);
  --mc-ctl-fill:       color-mix(in srgb, var(--dsw-alias-label-primary, #ffffff) 10%, transparent);
  --mc-ctl-fill-hover: color-mix(in srgb, var(--dsw-alias-label-primary, #ffffff) 16%, transparent);
  --mc-ctl-hairline:   color-mix(in srgb, var(--dsw-alias-label-primary, #ffffff) 14%, transparent);
  --mc-ctl-hairline-2: color-mix(in srgb, var(--dsw-alias-label-primary, #ffffff) 22%, transparent);
  --mc-ctl-glow:       rgba(212, 232, 255, 0);
  --mc-ctl-glow-2:     rgba(212, 232, 255, 0);
  --mc-ctl-focus:      #7aaaff;                 /* 硬编码，见上注 */
  --mc-ctl-focus-halo: rgba(122,170,255,.26);
  --mc-ctl-ease:       background-color .12s ease, box-shadow .16s ease,
                       color .12s ease, border-color .12s ease;
}

/* ── 0. 铁律：玻璃面内的控件自身永不叠滤波（含伪元素） ─────────────── */
:is([data-mc-glass],[data-composer-card],[role="menu"],[role="dialog"][aria-modal="true"],[role="alertdialog"],[role="listbox"]) :is(button,[role="button"],[role="menuitem"],[role="tab"],[role="switch"],a),
:is([data-mc-glass],[data-composer-card],[role="menu"],[role="dialog"][aria-modal="true"],[role="alertdialog"],[role="listbox"]) :is(button,[role="button"],[role="menuitem"],[role="tab"],[role="switch"],a)::before,
:is([data-mc-glass],[data-composer-card],[role="menu"],[role="dialog"][aria-modal="true"],[role="alertdialog"],[role="listbox"]) :is(button,[role="button"],[role="menuitem"],[role="tab"],[role="switch"],a)::after{
  backdrop-filter:none; -webkit-backdrop-filter:none;
}

/* ── 1. 幽灵/图标/菜单项/下拉触发器：hover 叠白8%+发丝+内辉 ────────
   ⚠ 用 background-image 渐变叠色而不用 background-color：
     玻璃面上不少控件有实底（switch 白轨 #f9fafb、下拉 #353638、主题块），
     直接改 background-color 会把实底"擦掉"（实测：switch hover 变黑轨）。
     gradient overlay 只加一层白，不破坏原底色。                        */
:is([data-mc-glass],[data-composer-card],[role="menu"],[role="dialog"][aria-modal="true"],[role="alertdialog"],[role="listbox"]) :is(button[aria-label],[role="menuitem"],[role="tab"],[role="option"]):not([class*="primary"]):not([class*="send"]):not(:disabled):hover{
  background-image: linear-gradient(var(--mc-ctl-hover), var(--mc-ctl-hover));
  box-shadow: inset 0 0 0 .5px var(--mc-ctl-hairline),
              inset 0 0 12px -4px var(--mc-ctl-glow);
  transition: var(--mc-ctl-ease);
}
:is([data-mc-glass],[data-composer-card],[role="menu"],[role="dialog"][aria-modal="true"],[role="alertdialog"],[role="listbox"]) :is(button[aria-label],[role="menuitem"],[role="tab"],[role="option"]):not([class*="primary"]):not([class*="send"]):not(:disabled):active{
  background-image: linear-gradient(var(--mc-ctl-active), var(--mc-ctl-active));
  box-shadow: inset 0 0 0 .5px var(--mc-ctl-hairline-2),
              inset 0 0 16px -4px var(--mc-ctl-glow-2);
  transition-duration: .04s;
}

/* ── 2. 玻璃芯片（composer 的 + 号）：实底 layer-3 → 半透明玻璃芯片 ──── */
:is([data-composer-card],[data-mc-glass]) button[aria-haspopup="listbox"],
:is([data-composer-card],[data-mc-glass]) button[aria-label="添加文件或调用指令"]{
  background-color: var(--mc-ctl-fill);
  box-shadow: inset 0 0 0 .5px var(--mc-ctl-hairline),
              inset 0 0 14px -6px var(--mc-ctl-glow);
  border-radius: 999px;
  transition: var(--mc-ctl-ease);
}
:is([data-composer-card],[data-mc-glass]) button[aria-haspopup="listbox"]:hover,
:is([data-composer-card],[data-mc-glass]) button[aria-label="添加文件或调用指令"]:hover{
  background-color: var(--mc-ctl-fill-hover);
  box-shadow: inset 0 0 0 .5px var(--mc-ctl-hairline-2),
              inset 0 0 18px -6px var(--mc-ctl-glow-2),
              0 0 0 3px rgba(212, 232, 255, 0);
}
:is([data-composer-card],[data-mc-glass]) button[aria-haspopup="listbox"]:active,
:is([data-composer-card],[data-mc-glass]) button[aria-label="添加文件或调用指令"]:active{
  background-color: var(--mc-ctl-active);
  box-shadow: inset 0 0 0 .5px var(--mc-ctl-hairline-2),
              inset 0 0 16px -3px var(--mc-ctl-glow-2);
}

/* ── 3. 主按钮（发送/停止）：保留品牌色，只加冷白描边+品牌外辉 ────── */
/* 实测宿主 aria-label：空闲 ="发送消息"，生成中 ="停止生成"（不是"发送"！）*/
:is([data-composer-card],[data-mc-glass]) :is(button[aria-label^="发送"],button[aria-label="停止生成"]){
  /* v0.9.1 用户裁决：除输入框自身外一切自发光删除，主按钮只留 0.5px 冷白发丝 */
  box-shadow: inset 0 0 0 .5px rgba(255,255,255,.34);
  transition: var(--mc-ctl-ease);
}
:is([data-composer-card],[data-mc-glass]) :is(button[aria-label^="发送"],button[aria-label="停止生成"]):hover:not(:disabled){
  background-image: linear-gradient(rgba(255,255,255,.06), rgba(255,255,255,.06));
  box-shadow: inset 0 0 0 .5px rgba(255,255,255,.5);
}
:is([data-composer-card],[data-mc-glass]) :is(button[aria-label^="发送"],button[aria-label="停止生成"]):active:not(:disabled){
  background-image: linear-gradient(rgba(0,0,0,.10), rgba(0,0,0,.10));
  box-shadow: inset 0 0 0 .5px rgba(255,255,255,.5);
}

/* ── 4a. G 层标签页（弹层里的 tab）：补 hover ───────────────────────── */
:is([data-mc-glass],[role="dialog"][aria-modal="true"],[data-composer-card]) [role="tablist"] [role="tab"]{
  transition: var(--mc-ctl-ease);
}
:is([data-mc-glass],[role="dialog"][aria-modal="true"],[data-composer-card]) [role="tablist"] [role="tab"]:hover:not([aria-selected="true"]){
  color: var(--dsw-alias-label-primary);
  background-color: color-mix(in srgb, var(--dsw-alias-label-primary, #ffffff) 6%, transparent);
  box-shadow: inset 0 0 0 .5px color-mix(in srgb, var(--dsw-alias-label-primary, #ffffff) 10%, transparent);
}
:is([data-mc-glass],[role="dialog"][aria-modal="true"],[data-composer-card]) [role="tablist"] [role="tab"][aria-selected="true"]:hover{
  box-shadow: inset 0 0 0 .5px var(--mc-ctl-hairline),
              inset 0 -2px 0 0 var(--mc-ctl-focus);
}

/* ── 4b. N 层标签页（主视图 tab）：宿主实测 hover 完全无反馈 → 统一补 ── */
[role="tablist"] [role="tab"]{
  transition: background-color .12s ease, color .12s ease;
}
[role="tablist"] [role="tab"]:hover:not([aria-selected="true"]):not(:disabled){
  color: var(--dsw-alias-label-primary);
  background-color: rgba(255,255,255,.055);
}
[role="tablist"] [role="tab"][aria-selected="true"]:hover{
  color: var(--dsw-alias-label-primary);
}

/* ── 5. 开关 role=switch：几何不动（与宿主 36x20 逐项一致），只加玻璃态 ── */
:is([data-mc-glass],[role="dialog"][aria-modal="true"],[data-composer-card]) button[role="switch"]{
  box-shadow: inset 0 0 0 .5px rgba(255,255,255,.18),
              0 0 10px -4px rgba(212, 232, 255, 0);
  transition: background-color .14s ease, box-shadow .16s ease;
}
:is([data-mc-glass],[role="dialog"][aria-modal="true"],[data-composer-card]) button[role="switch"]:hover{
  box-shadow: inset 0 0 0 .5px rgba(255,255,255,.30),
              0 0 14px -3px rgba(212, 232, 255, 0);
}
:is([data-mc-glass],[role="dialog"][aria-modal="true"],[data-composer-card]) button[role="switch"][aria-checked="true"]{
  box-shadow: inset 0 0 0 .5px rgba(255,255,255,.34),
              0 0 14px -4px rgba(212, 232, 255, 0);
}

/* ── 6. 描边/次级按钮（设置窗「打开配置文件」等 outline/ghost） ────── */
:is([role="dialog"][aria-modal="true"],[data-mc-glass]) :is(button[class*="outline"],button[class*="ghost"]){
  background-color: rgba(255,255,255,.04);
  border-color: var(--mc-ctl-hairline);
  box-shadow: inset 0 0 10px -6px var(--mc-ctl-glow);
  transition: var(--mc-ctl-ease);
}
:is([role="dialog"][aria-modal="true"],[data-mc-glass]) :is(button[class*="outline"],button[class*="ghost"]):hover{
  background-color: var(--mc-ctl-hover);
  border-color: var(--mc-ctl-hairline-2);
}

/* ── 6b. 设置页下拉/步进器「玻璃芯片」（可选，默认关闭）──────────────
   宿主把下拉做成实底 #353638；在 26% 玻璃面板上它像贴纸。启用后改为
   半透明白 7% + 发丝 + 内辉，与面板同质，同时保留圆角描边作为可点提示。
   开启方式：document.documentElement.setAttribute('data-mc-ctl-chips','')  */
html[data-mc-ctl-chips] :is([role="dialog"][aria-modal="true"],[data-mc-glass]) :is(button[class*="_selector"],button[class*="_stepper"]){
  background-color: rgba(255,255,255,.07);
  box-shadow: inset 0 0 0 .5px rgba(255,255,255,.14),
              inset 0 0 12px -6px rgba(212, 232, 255, 0);
  border-color: transparent;
  transition: var(--mc-ctl-ease);
}
html[data-mc-ctl-chips] :is([role="dialog"][aria-modal="true"],[data-mc-glass]) :is(button[class*="_selector"],button[class*="_stepper"]):hover{
  background-image: linear-gradient(rgba(255,255,255,.06), rgba(255,255,255,.06));
  box-shadow: inset 0 0 0 .5px rgba(255,255,255,.22),
              inset 0 0 14px -6px rgba(212, 232, 255, 0);
}

/* ── 7. focus-visible 统一：2px 品牌环 + 26% 光环（宿主三套并存，收成一套） ── */
:is([data-mc-glass],[data-composer-card],[role="menu"],[role="dialog"][aria-modal="true"],[role="alertdialog"],[role="listbox"],[role="tablist"]) :is(button,[role="menuitem"],[role="tab"],[role="switch"],a):focus-visible{
  outline: 2px solid var(--mc-ctl-focus);
  outline-offset: 2px;
  /* v0.8.1：用户红线「除输入框外删尽自发光」→ 去掉 26% 品牌光环，只留 2px 品牌 outline */
  box-shadow: inset 0 0 0 .5px var(--mc-ctl-hairline);
}
/* 贴边/在 overflow 容器内的控件内缩，避免焦点环被裁 */
:is([role="menu"],[role="dialog"][aria-modal="true"]) :is([role="menuitem"],button[role="switch"]):focus-visible,
[role="tablist"] [role="tab"]:focus-visible{
  outline-offset: -2px;
}

/* ── 8. 禁用：只降透明度/改色，不叠 filter（玻璃下 filter 会翻车） ──── */
:is([data-mc-glass],[data-composer-card],[role="dialog"][aria-modal="true"]) :is(button,[role="menuitem"],[role="switch"]):disabled,
:is([data-mc-glass],[data-composer-card],[role="dialog"][aria-modal="true"]) :is(button,[role="menuitem"],[role="switch"])[aria-disabled="true"]{
  background-color: rgba(255,255,255,.03);
  color: var(--dsw-alias-label-tertiary);
  box-shadow: inset 0 0 0 .5px rgba(255,255,255,.08);
  filter:none;
}

/* ── 10. 输入框可读性兜底（可选，默认关闭；引擎决定是否接管）───────
   实测：composer 在立绘高亮区域上时 placeholder(#81858c) CR 中位 1.75:1、最差 1.0:1。
   实验数据：叠 38% 黑 → 仍 ~1.1–1.4（文字灰正好落在中间亮度，亮度换不来对比度）；
   叠 58% 黑 + placeholder 提亮到 #cfd3d6 → CR 中位 4.03、p10 2.19。
   因此若引擎不做「立绘避让 / 更强模糊」，建议开启本兜底。
