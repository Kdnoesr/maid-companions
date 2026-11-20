//! 24-css-tokens-legacy：STAGE_CSS 第 5 块 —— 静音规则、页面级玻璃、模板收尾。
//! 内容：v0.3.7 ::before 玻璃静音、v0.3.7 玻璃面内控件材质、v0.6.0 页面级玻璃
//!       控件（新会话按钮/用户气泡），直到模板字符串闭合（第 1246 行）之前。
//! 依赖：本块是 STAGE_CSS 最后一段，必须与 20-23 顺序拼接。
   开启方式：document.documentElement.setAttribute('data-mc-ctl-legible','')  */
html[data-mc-ctl-legible] [data-composer-card]{
  background-image: linear-gradient(rgba(8,10,14,.58), rgba(8,10,14,.58));
}
html[data-mc-ctl-legible] [data-composer-card] [class*="placeholder"]{
  color: #cfd3d6;
}

/* ── 9. 可访问性兜底：prefers-reduced-transparency 时玻璃退回近实底 ── */
@media (prefers-reduced-transparency: reduce){
  /* v0.15.0：加 body 作用域（关插件不再残留）+ 主题感知（浅色不再变黑板）。 */
  body[${GLASS_ATTR}] :is([data-mc-glass],[data-composer-card],[role="menu"],[role="dialog"][aria-modal="true"]){
    background-color: color-mix(in srgb, var(--dsw-alias-bg-base, #2c2c2e) 92%, transparent);
  }
}
/* ═══ v0.3.7 · ::before 玻璃静音 ═══════════════════════════════════════
   宿主有 5 个面把 64% 底 + blur(40px) 画在 ::before 里（子智能体树、团队面板、
   插件详情、状态条…）。引擎给这类面挂 direct 玻璃时必须同时把 ::before 归零，
   否则两层玻璃叠加：底色合成过实 + 40px 宿主模糊 → 边缘位移与内部模糊脱节。 */
body[${GLASS_ATTR}] [data-mc-glass-before]::before {
	background-color: var(--mc-before-fill, transparent) !important;
	backdrop-filter: var(--mc-before-bf, none) !important;
	-webkit-backdrop-filter: var(--mc-before-bf, none) !important;
}
/* ═══ v0.3.7 · 玻璃面内的控件材质（a08 规格节选）═════════════════════════
   原则：玻璃上的控件**不叠 blur**，层级只用 0.5px 发丝 + 冷白内辉 + 8%/14% 薄涂。
   ⚠️ 刻意排除 [data-composer-card]：输入框是黄金标准，一个像素都不动。
   ⚠️ hover 用 background-image 叠白而不是 background-color —— 后者会擦掉实底
      （实测：开关白轨 hover 会变黑）。 */
body[${GLASS_ATTR}] {
	--mc-ctl-hover: color-mix(in srgb, var(--dsw-alias-label-primary, #ffffff) 8%, transparent);
	--mc-ctl-active: color-mix(in srgb, var(--dsw-alias-label-primary, #ffffff) 14%, transparent);
	--mc-ctl-hairline: color-mix(in srgb, var(--dsw-alias-label-primary, #ffffff) 14%, transparent);
	--mc-ctl-hairline-2: color-mix(in srgb, var(--dsw-alias-label-primary, #ffffff) 22%, transparent);
	--mc-ctl-glow: rgba(212, 232, 255, 0);
	--mc-ctl-glow-2: rgba(212, 232, 255, 0);
	--mc-ctl-focus: var(--dsw-alias-state-business-primary, #7aaaff);
	--mc-ctl-focus-halo: color-mix(in srgb, var(--dsw-alias-state-business-primary, #7aaaff) 26%, transparent);
}
/* 铁律：玻璃面内控件自身（含伪元素）永不叠滤波 */
body[${GLASS_ATTR}] :is([data-mc-glass], [role='menu'], [role='dialog'][aria-modal='true'], [role='alertdialog'], [role='listbox'], [data-team-panel='true']) :is(button, [role='button'], [role='menuitem'], [role='tab'], [role='switch'], a),
body[${GLASS_ATTR}] :is([data-mc-glass], [role='menu'], [role='dialog'][aria-modal='true'], [role='alertdialog'], [role='listbox'], [data-team-panel='true']) :is(button, [role='button'], [role='menuitem'], [role='tab'], [role='switch'], a)::before,
body[${GLASS_ATTR}] :is([data-mc-glass], [role='menu'], [role='dialog'][aria-modal='true'], [role='alertdialog'], [role='listbox'], [data-team-panel='true']) :is(button, [role='button'], [role='menuitem'], [role='tab'], [role='switch'], a)::after {
	backdrop-filter: none !important;
	-webkit-backdrop-filter: none !important;
}
/* 1. 菜单项 / 图标按钮 / tab：hover 叠白 + 发丝 + 冷白内辉 */
body[${GLASS_ATTR}] :is([data-mc-glass], [role='menu'], [role='dialog'][aria-modal='true'], [role='alertdialog'], [role='listbox'], [data-team-panel='true']) :is(button[aria-label], [role='menuitem'], [role='tab'], [role='option']):not(:disabled):not([aria-disabled='true']) {
	transition: background-color .12s ease, box-shadow .16s ease, color .12s ease;
}
body[${GLASS_ATTR}] :is([data-mc-glass], [role='menu'], [role='dialog'][aria-modal='true'], [role='alertdialog'], [role='listbox'], [data-team-panel='true']) :is(button[aria-label], [role='menuitem'], [role='tab'], [role='option']):not(:disabled):hover {
	background-image: linear-gradient(var(--mc-ctl-hover), var(--mc-ctl-hover));
	box-shadow:
		inset 0 0 0 0.5px var(--mc-ctl-hairline),
		inset 0 0 12px -4px var(--mc-ctl-glow);
}
body[${GLASS_ATTR}] :is([data-mc-glass], [role='menu'], [role='dialog'][aria-modal='true'], [role='alertdialog'], [role='listbox'], [data-team-panel='true']) :is(button[aria-label], [role='menuitem'], [role='tab'], [role='option']):not(:disabled):active {
	background-image: linear-gradient(var(--mc-ctl-active), var(--mc-ctl-active));
	box-shadow:
		inset 0 0 0 0.5px var(--mc-ctl-hairline-2),
		inset 0 0 16px -4px var(--mc-ctl-glow-2);
}
/* 3. 主按钮（非 composer）：保留品牌底，只加冷白描边 + 品牌外辉 */
body[${GLASS_ATTR}] :is([role='dialog'][aria-modal='true'], [role='alertdialog'], [data-mc-glass], [data-team-panel='true']) :is(button[class*='primary'], button[class*='Primary']) {
	box-shadow:
		inset 0 0 0 0.5px rgba(255, 255, 255, .34);
	transition: background-color .12s ease, box-shadow .16s ease;
}
body[${GLASS_ATTR}] :is([role='dialog'][aria-modal='true'], [role='alertdialog'], [data-mc-glass], [data-team-panel='true']) :is(button[class*='primary'], button[class*='Primary']):hover:not(:disabled) {
	box-shadow:
		inset 0 0 0 0.5px rgba(255, 255, 255, .5);
}
/* 4a. 弹层内 tab 的 hover（宿主缺） */
body[${GLASS_ATTR}] :is([role='dialog'][aria-modal='true'], [data-mc-glass]) [role='tablist'] [role='tab'] {
	transition: background-color .12s ease, color .12s ease, box-shadow .16s ease;
}
body[${GLASS_ATTR}] :is([role='dialog'][aria-modal='true'], [data-mc-glass]) [role='tablist'] [role='tab']:hover:not([aria-selected='true']) {
	color: var(--dsw-alias-label-primary);
	background-color: rgba(255, 255, 255, .06);
	box-shadow: inset 0 0 0 0.5px rgba(255, 255, 255, .1);
}
/* 4b. 主视图 tab（N 层，不透明面）：宿主 hover 完全无反馈 → 只补动效 */
body[${GLASS_ATTR}] [role='tablist'] [role='tab'] {
	transition: background-color .12s ease, color .12s ease;
}
body[${GLASS_ATTR}] [role='tablist'] [role='tab']:hover:not([aria-selected='true']):not(:disabled) {
	color: var(--dsw-alias-label-primary);
	background-color: rgba(255, 255, 255, .055);
}
body[${GLASS_ATTR}] [role='tablist'] [role='tab'][aria-selected='true']:hover {
	color: var(--dsw-alias-label-primary);
}
/* 5. 开关：几何保持宿主 36×20，只加玻璃态描边/辉光 */
body[${GLASS_ATTR}] :is([role='dialog'][aria-modal='true'], [data-mc-glass], [data-team-panel='true']) button[role='switch'] {
	box-shadow:
		inset 0 0 0 0.5px rgba(255, 255, 255, .18),
		0 0 10px -4px rgba(212, 232, 255, 0);
	transition: background-color .14s ease, box-shadow .16s ease;
}
body[${GLASS_ATTR}] :is([role='dialog'][aria-modal='true'], [data-mc-glass], [data-team-panel='true']) button[role='switch']:hover {
	box-shadow:
		inset 0 0 0 0.5px rgba(255, 255, 255, .3),
		0 0 14px -3px rgba(212, 232, 255, 0);
}
body[${GLASS_ATTR}] :is([role='dialog'][aria-modal='true'], [data-mc-glass], [data-team-panel='true']) button[role='switch'][aria-checked='true'] {
	box-shadow:
		inset 0 0 0 0.5px rgba(255, 255, 255, .34),
		0 0 14px -4px rgba(212, 232, 255, 0);
}
/* 7. 焦点环：宿主三套并存（且 --dsw-focus-ring-color 为空）→ 收成一套 */
body[${GLASS_ATTR}] :is([data-mc-glass], [role='menu'], [role='dialog'][aria-modal='true'], [role='alertdialog'], [role='listbox'], [role='tablist'], [data-team-panel='true']) :is(button, [role='menuitem'], [role='tab'], [role='switch'], a):focus-visible {
	outline: 2px solid var(--mc-ctl-focus);
	outline-offset: 2px;
}
body[${GLASS_ATTR}] :is([role='menu'], [role='dialog'][aria-modal='true']) :is([role='menuitem'], button[role='switch']):focus-visible,
body[${GLASS_ATTR}] [role='tablist'] [role='tab']:focus-visible {
	outline-offset: -2px;
}
/* 8. 禁用：只降不透明度/改色，不叠 filter */
body[${GLASS_ATTR}] :is([data-mc-glass], [role='dialog'][aria-modal='true'], [data-team-panel='true']) :is(button, [role='menuitem'], [role='switch']):disabled,
body[${GLASS_ATTR}] :is([data-mc-glass], [role='dialog'][aria-modal='true'], [data-team-panel='true']) :is(button, [role='menuitem'], [role='switch'])[aria-disabled='true'] {
	background-color: color-mix(in srgb, var(--dsw-alias-label-primary, #ffffff) 3%, transparent);
	color: var(--dsw-alias-label-tertiary);
	box-shadow: inset 0 0 0 0.5px color-mix(in srgb, var(--dsw-alias-label-primary, #ffffff) 8%, transparent);
	filter: none;
}
/* ═══ v0.6.0 · 页面级玻璃控件（新会话按钮 / 用户消息气泡）══════════════
   对齐输入框的做法：**同一份配方**，不再自发光、不再分主题写死颜色。
     透明体（0 底色）+ 同一模糊量 blur(1px) saturate(1) brightness(1.05)
     + 0.5px 发丝边（token 混色，深浅自动）+ 落地阴影
   位移折射由 JS 的 direct 分支挂同一套 SVG 场（[data-message-bubble] 已进入
   LIQUID_SELECTOR，kind=float）。用户原话：「除了文字输入框可以保留，
   其他的发光效果都删掉，只留液态玻璃效果」——本段即该要求的落点。 */
body[${GLASS_ATTR}] button[aria-keyshortcuts='Control+N']:not(:has([data-slot='sidebar.brand.mark'])) {
	background-color: var(--mc-fill-float) !important;
	background-image: none !important;
	border-color: transparent !important;
	backdrop-filter: blur(1px) saturate(1) brightness(1.05) !important;
	-webkit-backdrop-filter: blur(1px) saturate(1) brightness(1.05) !important;
	box-shadow:
		0 0 0 0.5px var(--mc-hairline),
		0 4px 16px rgba(0, 0, 0, 0.16) !important;
	transition: background-color .14s ease, box-shadow .18s ease;
}
body[${GLASS_ATTR}] button[aria-keyshortcuts='Control+N']:not(:has([data-slot='sidebar.brand.mark'])):hover {
	background-color: color-mix(in srgb, var(--dsw-alias-bg-overlay) 34%, transparent) !important;
	background-image: none !important;
	box-shadow:
		0 0 0 0.5px var(--mc-hairline),
		0 6px 18px rgba(0, 0, 0, 0.22) !important;
}
/* 用户消息气泡：宿主实底 rgb(44,44,46) → 透明体，折射/模糊由 JS 滤镜提供。
   ⚠️ 这里**不写**内辉：那是"自发光"，已被用户点名删除；玻璃感只来自位移折射。 */
body[${GLASS_ATTR}] [data-message-bubble]:has([data-slot='conversation.user.text.node']) {
