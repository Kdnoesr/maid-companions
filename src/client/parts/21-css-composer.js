//! 21-css-composer：STAGE_CSS 第 2 块 —— 输入框（composer）区域样式。
//! 内容：[data-composer-card] 动效/遮罩/环形焦点/占位符等几何与排版。
//! 依赖：同一模板字符串中段，不得自行闭合。
//! 说明：composer 的材质（backdrop-filter/位移贴图/内辉）由 JS 运行时注入，
//!       本块只负责几何，不要在 CSS 里另加玻璃。
body[${GLASS_ATTR}][data-dsh-maid-companion-motion] [data-composer-card] {
	will-change: transform, opacity;
}
@keyframes maidCompanionCardDock {
	from { opacity: 0.94; transform: translateY(clamp(-240px, -26vh, -150px)); }
	to { opacity: 1; transform: none; }
}
@keyframes maidCompanionCardRise {
	from { opacity: 0.94; transform: translateY(clamp(150px, 26vh, 240px)); }
	to { opacity: 1; transform: none; }
}
/* ═══ 对话区毛玻璃（半透明化）· 仅插件启用时生效 ═══════════════════════════
   整块作用域限定在 body[${GLASS_ATTR}]（由本插件设置/移除），所以关闭插件即整块
   失效、100% 回到原版 UI。

   设计依据（第一性原理 + 对抗式审查，2026-09-13）：
   ① 谁在遮挡立绘？立绘是对话列 centerCol 的直接子元素、z-index:0；对话视图
      wSkVaW_root 的背景早已被本插件转透明。真正还压住立绘的不透明面只有
      composer 输入卡（--dsw-specific-input-major，暗色 #2c2c2e）与其 seat 渐变。
   ② 因此毛玻璃只做在“确实盖住立绘”的那一层（输入卡）。不给整列加
      backdrop-filter 的原因有二：其一，立绘是同列子元素，给列加模糊会把立绘
      本体一起糊掉；其二，backdrop-filter 会成为绝对定位后代的包含块，而舞台
      正是 position:absolute;inset:0 —— 会把立绘 % 高度的计算基准从 frame 改成
      列，带来尺寸抖动风险。
   ③ 背景层只做极淡提亮、不加 blur：立绘保持锐利，近黑 #151517 读起来像玻璃
      而不是实心黑（v1 实测 #151517 → #1E1E20 Δ=+9；v2 调为 Δ=+16）。
   ④ 不做嵌套 blur：seat 与 card 都加会双重采样背景，发灰发脏。沿用官方
      skin-center 的既有结论——seat 全中和（见上 [data-composer-seat] 规则）、
      blur 只落在卡上。
   ⑤ 只作用于 centerCol 之内，不碰 sidebarCol / rightbarCol（实测 sidebar
      #1B1B1C 前后完全一致）。
   ⑥ 卡为半透明后，卡内文字对比度实测基本无损（v1 72%：#2C2C2E → #28282A Δ=-4；
      v2 60% 更透，Δ 略增但仍远不足以影响正文可读性）。
   ⑦ 提亮必须落在与舞台同一个宿主上（故用 ${ROOT_SELECTOR}，与上面 stage 的
      findRoot 完全一致）：一旦两者选中不同元素，玻璃层就会跑到立绘之上或之外。 */
/* 调参 / 修复记录 2026-09-13：
   v1 列 Δ+9  / 卡 72% / blur 14px
   v2 列 Δ+16 / 卡 60% / blur 8px
   v3 列 Δ+21 / 卡 52% / blur 6px   ← 错误版本
   v4（当前）：**彻底移除「整列提亮」**，只保留输入卡的毛玻璃。

   ❌ 已废弃做法：给 ${ROOT_SELECTOR} 加 background 提亮。
      ① 作用域是整个对话列 → 正文/工具栏/大留白一起被抬亮成灰，
         用户反馈“整个对话区域变灰了，不只是文字输入区域”，明确不要；
      ② 它与卡片半透明互相收敛：列底色被抬到 #2A2A2C，而卡片色本身是
         #2c2c2e，两者几乎相等 → 卡片填充对比被压到 Δ1，卡片“溶”进背景。
      结论：这条规则既多余（用户没要整片变灰）又自相矛盾（把要突出的卡片抹平）。

   ✅ 保留做法：只有 [data-composer-card] 这一层做半透明 + 毛玻璃。
      它是唯一真正盖住立绘的面；列底色保持 --dsw-alias-bg-base 原样，
      因此对话区背景与「未启用插件」时逐像素一致（见 README 验收口径）。 */
body[${GLASS_ATTR}] [data-composer-card] {
	/* 输入卡 = 用户说的"对话框、输入文字的地方"。
	   色调浓度对齐 demo 面板的 0.00（其 s-tint → --tint-a，0 = 玻璃不填色）：
	   于是卡片**不再有任何底色**，纯靠背后的折射 + 模糊成形 —— 这就是 demo 里
	   那种"一块纯玻璃"的观感。文字可读性靠 DSH 深色底与文字自身的对比度承担。
	   （原先为 color-mix(... --dsw-specific-input-major 48%, transparent)。） */
	background: transparent;
	/* 模糊 1px + 轻微提亮：与液态玻璃生效时保持一致（见 LIQUID.blurPx / brightness 的说明）。 */
	-webkit-backdrop-filter: blur(1px) brightness(1.05);
	backdrop-filter: blur(1px) brightness(1.05);
	/* 玉的「莹润」：柔散内辉（**不是**边框白线）。
	   与之前被否掉的那版本质不同——那版是 6 层 1px 硬线（最高 20% 白）→ 读成"边框泛白"。
	   这版：大模糊 + 负扩散，边界柔和无硬边，且实测**只作用于边缘、中心零影响**。

	   参数是扫出来的，不是拍的（同一 harness，唯一变量=这行 inset；测横向平均亮度）：
	     inset 0 0 20px -5px rgba(212,232,255,0.20)
	       边缘 +2px 处 +7.2 ｜ +8px 处 +0.9 ｜ **卡片中心 +0.0**
	     对比：48px/−24px 那版会把**整张卡均匀抬亮 ~10 级**（泛雾，已废弃）；
	           16px/−11px 那版边缘只有 +0.8（弱到看不见，也已废弃）。
	   ⚠️ box-shadow 是整体替换，必须写回 --dsw-elevation-soft，否则丢卡片自身描边。
	   ⚠️ 纯 CSS，零渲染开销。若仍觉得泛白，删掉这一行 inset 即可。 */
	box-shadow:
		var(--dsw-elevation-soft, 0 0 0 .5px rgba(255, 255, 255, 0.12)),
		inset 0 0 20px -5px rgba(212, 232, 255, 0.20);
}

/* ═══ 浮层 / 气泡 / 窗口 · 与对话区同款「半透明 + 毛玻璃」════════════════════
   仅插件启用时生效（作用域 body[${GLASS_ATTR}]），关闭插件即整块失效。

   ── 第一性原理①：为什么必须同时降不透明度，而不是只加模糊 ──────────────
   用户要的是"以对话区的模糊透明效果为准"，而对话区输入卡就是
   「52% 卡色 + blur(4px)」。只加 backdrop-filter 不降不透明度 = 实心玻璃，
   看着还是死板；只降不透明度不加模糊 = 文字直接穿透（上一版的坏味道）。
   所以两者必须成对出现，且**各自保留自己的底色 token**（只降 alpha，不换色相）——
   换色相就会"整体变灰"，这正是之前被否掉的做法。

   ── 第一性原理②：双层模糊叠化（用户明确点出的现象）────────────────────
   当浮层盖在**输入卡**之上时（如权限气泡从输入卡弹出），两块毛玻璃会在屏幕上
   嵌套：浮层的 backdrop 采样到的，已经是输入卡被 blur 过的结果，于是
   "模糊之上再模糊"，局部会明显更糊、更闷 —— 这就是"叠化"。
   对策（而非放任）：
     · 浮层自身的 blur 取**更小**的值（3px < 输入卡的 4px）。因为它的背板本来
       就已被模糊过一次，再用同等剂量必然过糊。
     · 用 saturate 轻微回补，抵消双层模糊带来的发灰发闷。
     · 两者都在**同一个合成层树**里，Chromium 会各自采样一次 backdrop，
       不会出现"双重采样同一层"的脏边（我们没有把 filter 套在会包含浮层的祖先上）。
   实践校准值：浮层 blur 3px。若你把输入卡 blur 调大，浮层这个值也应同步略降。

   ── 为什么深色主题下这样是安全的 ─────────────────────────────────────
   各浮层保留自己的高不透明度（菜单 88% / 窗口 84%），而降不透明度只释放
   12%~16% 的背景透出 —— 足够"玻璃感"，又不足以让正文穿透。对比度实测
   仍在可读区间（见 README 验收口径）。

   ⚠️ 不纳入 [role=tabpanel]：对话/轨迹等就是主内容区，染色 = "整片变灰"。
   ⚠️ 浮层只允许改 background-color 的**alpha**，且必须基于它自己的 token；
      不得出现"凭空指定一个颜色"的写法 —— 由 check-no-area-tint.mjs 强制。 */

