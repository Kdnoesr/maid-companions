//! 22-css-floating：STAGE_CSS 第 3 块 —— 浮层/菜单/弹窗/气泡/面板样式。
//! 内容：浮层与气泡同款半透明、主内容区面板透明、v0.3.0 统一材质层、
//!       v0.8.0 模态遮罩（scrim）、v0.4.8 实心贴片，直到 v0.4.9 控件段之前。
//! 依赖：同一模板字符串中段；常被 installRim/veil 分支命中，改样式前先读
//!       LIQUID_RING_MIN_AREA=260000 闸门说明（31-material-constants.js）。
body[${GLASS_ATTR}] :is(
	[role='menu'], [role='listbox'], [role='tooltip'],
	[role='dialog'], [role='alertdialog'],
	.bRhRbq_panel, .mufS8W_card, .JObwrW_panel, .Nqubda_panel,
	._3e4SsG_menu, .QsffPG_menu, ._7KE1Ra_menu, .ZKlsPq_menu,
	._7rgC5q_popover, ._7rgC5q_dialog,
	/* ⚠️ 权限气泡 / 通用下拉菜单的真实类名（实证，来自【运行时构建产物】
	   dsh-web-frontend/dist/assets/index-BKQ_L1z6.js，而非 node_modules 下的源码或
	   dshmarket 里的 @deepseek-ai.bak 旧副本 —— 后者类名映射为空 {}，我因此误判过）：
	     primitives.Menu 编译后 list=._list_1nxmc_8, submenu=._submenu_1nxmc_9
	   原规则用分组选择器上色：
	     ._list_1nxmc_8, ._submenu_1nxmc_9 { background: var(--dsw-specific-menu); ... }
	   必须精确列出这两个类，不能用 [class*='_1nxmc_'] —— 那个通配会连
	   _root/_item/_viewport 一起捞进来，导致每个菜单项各自叠加一层半透明+模糊，
	   层层嵌套糊成一团（已实际踩过，用户要求回滚）。 */
	._list_4ub78_7, .wq12jW_menu,
	/* 任务面板（对话框上方的「任务 / N 已完成」清单）——用户指出它也是漏网之鱼。
	   实证：由 dsh-client-ui-conversation 的 TodoPanel 渲染，
	   类名 .lXshSW_root（CSS Module 哈希），并带**语义更稳定**的
	   data-testid="todo-panel"（优先用后者，DSH 升级改名也不易失效）。
	   它用**另一个 token** 上色，故下面单独一条规则按它自己的 token 降 alpha：
	     .lXshSW_root { background: var(--dsw-specific-tip); border-radius: 12px } */
	[data-testid='todo-panel'], .lXshSW_root
):not([data-shortcut-modal]):not([aria-modal='true']):not([data-menu-material='translucent']):not([data-menu-material='translucent'] *) {
	background-color: color-mix(in srgb, var(--dsw-specific-menu, #353638) 40%, transparent);
	-webkit-backdrop-filter: blur(1px) saturate(1) brightness(1.05);
	backdrop-filter: blur(1px) saturate(1) brightness(1.05);
}

/* Turn navigator preview: direct sampling, no added tint/frost plane. */
body[${GLASS_ATTR}] [role='tooltip'][style*='--turn-preview-center'] {
 background-color: transparent !important;
 box-shadow: 0 0 0 0.5px var(--mc-hairline), var(--dsw-elevation-panel, 0 8px 24px rgba(0,0,0,.28)), inset 0 0 20px -5px rgba(212,232,255,.20) !important;
}
body[${GLASS_ATTR}] [role='tooltip'][style*='--turn-preview-center']:not([data-mc-glass]) {
 -webkit-backdrop-filter: blur(1px) saturate(1) brightness(1.05);
 backdrop-filter: blur(1px) saturate(1) brightness(1.05);
}
/* Quote preview owns the direct parent surface; its text and bridge stay untouched. */
body[${GLASS_ATTR}] div:has(> [data-quote-popover]):not([data-menu-material='translucent'] *) {
	background-color: color-mix(in srgb, var(--dsw-specific-menu, #353638) 40%, transparent);
	-webkit-backdrop-filter: blur(1px) saturate(1) brightness(1.05);
	backdrop-filter: blur(1px) saturate(1) brightness(1.05);
}

/* The document zoom toolbar is a floating surface with its own layer token. */
body[${GLASS_ATTR}] [data-document-zoom-controls]:not([data-menu-material='translucent'] *) {
	background-color: color-mix(in srgb, var(--dsw-alias-bg-layer-1) 40%, transparent);
	-webkit-backdrop-filter: blur(1px) saturate(1) brightness(1.05);
	backdrop-filter: blur(1px) saturate(1) brightness(1.05);
}

/* 任务面板：它用**自己的** token --dsw-specific-tip 上色，不是 specific-menu。
   铁则：只降 alpha、保留原 token 的色相，绝不换成别的 token（换 token 就会变色）。
   放在上面那条之后，同特异度下后者生效，覆盖掉 specific-menu 的底色。 */
body[${GLASS_ATTR}] :is([data-testid='todo-panel'], .lXshSW_root):not([data-menu-material='translucent'] *) {
	background-color: color-mix(in srgb, var(--dsw-specific-tip, #353638) 40%, transparent);
	-webkit-backdrop-filter: blur(1px) saturate(1) brightness(1.05);
	backdrop-filter: blur(1px) saturate(1) brightness(1.05);
}

/* 浮层的「莹润内辉」—— 比输入框**更小**，因为尺寸差很多。
	   ⚠️ 关键教训：输入框那组是 20px / −5px / 0.20，是按 **640×132** 的卡扫出来的；
	   浮层小得多（菜单约 220×150、工具提示更小），同样 20px 的辉光带**占比大幅上升**
	   → 整片泛白（用户反馈"偏白偏灰"）。故按尺寸把参数减半：10px / −3px / 0.12，
	   使其在浮层尺度上仍是"贴边一圈"而非"铺满一片"。
   ⚠️ box-shadow 是整体替换，必须写回各自原有的 elevation —— 这批浮层原本都是
      box-shadow: var(--dsw-elevation-prominent)，不写回会把它们的投影与描边抹掉。
   注：._7rgC5q_dialog 不在列（它用的是另一套 0 12px 32px 投影，不擅自改）。 */
body[${GLASS_ATTR}] :is(
	[role='menu'], [role='listbox'], [role='tooltip'],
	.bRhRbq_panel, .mufS8W_card, .JObwrW_panel, .Nqubda_panel,
	._3e4SsG_menu, .QsffPG_menu, ._7KE1Ra_menu, .ZKlsPq_menu,
	._7rgC5q_popover, ._list_4ub78_7, .wq12jW_menu,
	[data-testid='todo-panel'], .lXshSW_root
):not(:is(
	[data-menu-material], [role='dialog'][aria-modal='true'], [role='alertdialog'],
	[data-testid='todo-panel'], [data-team-panel='true']
) *) {
	box-shadow:
		var(--dsw-elevation-prominent, 0 8px 24px rgba(0, 0, 0, 0.35));
}

/* ── 页面级面板的「边框玻璃」（v0.2.12，v0.2.17 修好）──────────────────
   背景：设置窗 800×800 整块挂 backdrop-filter 会把正文一起糊掉（用户最初的
   报障），所以改成"只在最外一圈做真玻璃"——四根 28px 的条子，每根各自带
   一套与输入框同源同参的液态玻璃（url(#id) blur(1px) saturate(1) brightness(1.05)）。

   ⚠️ 为什么条子必须 z-index:-1：条子是面板的子元素，用 0 或正数会和面板
   内容同层、按 DOM 顺序压在文字和按钮上面 —— 表现为"发送按钮也在折射"。
   退到负层后，边缘照样折射，但永远不会盖住任何内容。

   ⚠️ 面板上不需要任何别的改动：条子挂在面板内部，采样的是"条子背后"的
   东西；面板本体若是不透明实色，背后就是那片实色，模糊均匀实色仍是均匀
   实色，条子在视觉上等于不存在（v0.2.12 实测）。要让边缘玻璃透出后面的
   场景，面板本身必须是半透明或透明的 —— 这一条由宿主皮肤负责，本插件
   不擅自清空别人面板的背景（清空会连带毁掉正文对比度）。 */
body[${GLASS_ATTR}] [data-mc-glass-ring] {
	box-sizing: border-box;
}
/* ❌ 已删除：.wCInkW_panel（设置窗）的玻璃规则。
   用户反馈："点开 bili设置按钮后整个设置区域就会变得模糊，其他区域没问题"。

   原因（实证）：.wCInkW_panel 是**设置窗整块面板**（由用户提供的真实 DOM 确认：
   该窗内的导航项是 .wCInkW_navCell / .wCInkW_navIcon / .wCInkW_navLabel）。
   给一整块全尺寸设置面板加 backdrop-filter: blur()，会把**它背后的一切**
   全糊掉 —— 表现为"整个设置区域变模糊"，而不是像小浮层那样只柔化边缘。
   同时 30% 半透明底色让整块面板发灰、文字对比度下降。

   ⚠️ 本文件是模板字符串（反引号）内的 CSS，注释里**绝不能出现反引号**，
      否则会提前终止字符串导致插件加载失败。此处已踩坑两次。

   结论：backdrop-filter 只适用于**小型浮层**（菜单 / 气泡 / 提示），
   不适用于全尺寸页面级面板。设置窗应保持自身不透明底色与锐利文字。

   v0.2.18 补正：上面这条"不适用于全尺寸面板"的说法**只对了一半**。
   真正的问题不是面板太大，而是当时的做法是"面板保持不透明、只在它内部
   贴一圈玻璃条" —— 条子的采样源只能是面板自己的底色，所以永远是恒等变换。
   只要让【面板自己】半透明，它背后就是真正的页面背景，全尺寸面板一样可以有玻璃。
   见下方 [aria-modal='true'][role='dialog'] 规则。 */
body[${GLASS_ATTR}] :is(._7rgC5q_dialog) {
	/* 该弹窗自己的底色就是 --dsw-alias-bg-overlay（暗色 #61666b），保持原 token 不变。
	   透明度 78% → 48%，与大方向一致（更通透）。 */
	background-color: color-mix(in srgb, var(--dsw-alias-bg-overlay, #61666b) 48%, transparent);
	-webkit-backdrop-filter: blur(1px) saturate(1) brightness(1.05);
	backdrop-filter: blur(1px) saturate(1) brightness(1.05);
}

/* ═══ 主内容区面板（上下文 / 轨迹 / 记忆 / 统计 …）· 面板卡片变透明 ═════════
   做法照搬官方皮肤 maid-atelier（用户指出的正确范例），但**不硬编码颜色**。

   皮肤为什么能让上下文面板透出女仆（实证 maid-atelier.module.css）：
     · 皮肤把「层」token 重绑成带 alpha 的 rgba：
         --dsw-alias-bg-base:    transparent
         --dsw-alias-bg-layer-1: rgba(18, 31, 67, 0.9)
         --dsw-alias-bg-layer-2: rgba(24, 40, 80, 0.92)
         --dsw-alias-bg-layer-3: rgba(32, 49, 91, 0.94)
     · 而上下文面板的卡片正是用这些 token 上色的：
         .lc-card { background: var(--dsw-alias-bg-layer-1) }
         .lc-stat { background: var(--dsw-alias-bg-layer-2) }
       token 一变半透明，整片面板就透出后面的立绘 —— 无需逐个类名去改。

   我照这个机制做，但避开皮肤"硬编码调色板"那部分（那正是"整体变灰"的根源）：
     ① 先在 viewArea 元素上把**原始** token 捕获到别名 --mc-bg-layer-N；
        此时 viewArea 自己的 layer token 没有被改，故不存在自定义属性循环引用。
     ② 再在 viewArea 的**子树**上重定义 layer token =
        color-mix(原始色 N%, transparent)。子元素继承的是别名（原始色），
        因此 color-mix 拿到的是**同一个颜色**，只降 alpha —— 色相完全不变。

   ⚠️ 作用范围仅限 viewArea 子树（面板卡片、消息卡片等）。
      立绘在 centerCol 里、是 viewArea 的**兄弟**，完全不受影响：
      既不会被糊（无 backdrop-filter），也不会变色（色相守恒）。
   ⚠️ 这里不写 backdrop-filter（会糊立绘），也不写 background（会整片染色）。 */
body[${GLASS_ATTR}] [class*='Dc7zOa_viewArea'] {
	/* ① 捕获原始层色（不改本元素的 layer token，避免循环引用） */
	--mc-bg-layer-1: var(--dsw-alias-bg-layer-1);
	--mc-bg-layer-2: var(--dsw-alias-bg-layer-2);
	--mc-bg-layer-3: var(--dsw-alias-bg-layer-3);
}
body[${GLASS_ATTR}] [class*='Dc7zOa_viewArea'] > * {
	/* ② 子树降 alpha：同一颜色 + 更多透明 = 面板变透，色相不变。
	   2026-10-16 调参记录（用户逐轮反馈「轨迹再透一点」）：
	     初版 72 / 78 / 82  →  一档 52 / 58 / 64  →  **当前 34 / 40 / 46**
	   数值 = 保留原色的百分比（越小越透）。三档保持递增，维持
	   「越深的卡片越实」的层级观感。
	   ⚠️ 只降 alpha，色相与光照不变；轨迹行文字为浅色，在深色立绘上
	      对比度仍充足，但继续下调的空间已不多（再低会开始影响长文本阅读）。 */
	--dsw-alias-bg-layer-1: color-mix(in srgb, var(--mc-bg-layer-1) 34%, transparent);
	--dsw-alias-bg-layer-2: color-mix(in srgb, var(--mc-bg-layer-2) 40%, transparent);
	--dsw-alias-bg-layer-3: color-mix(in srgb, var(--mc-bg-layer-3) 46%, transparent);
}

/* ❌ 已删除：给 [class*='Dc7zOa_viewArea'] 加毛玻璃。
   那一条命中的是**整个对话内容区**（conversation.view 的宿主），
   结果把左右女仆立绘也一起糊掉了。用户明确纠正：
   "我说的不是整个对话区，是这个对话框，输入文字的地方"。
   教训：毛玻璃的对象必须是**具体的框**（输入卡 / 浮层），
   绝不能落在承载主内容的容器上 —— 那既糊了立绘，又等价于"整片改观感"。
   上下文/轨迹等面板属于主内容区，如需效果应由其自身实现，不由本插件染指。 */

/* ═══ v0.3.0 · 统一材质层（对齐输入卡）══════════════════════════════════════
   一套变量 + 一条装帧规则 = 所有浮层/面板同一材质语言。
   要整体调观感只改这里；不要再往各个面加各自手调的 box-shadow。
   ── 为什么这样才不"割裂" ──────────────────────────────────────────────
   输入卡之所以好看，是三个量级被绑在一起：透明体（无底色）+ 连续位移场
   + 只贴边不进中心的冷色内辉（20px / −5px / 0.20）。内辉把"被推弯的边缘"
   和"清晰的内部"缝成一块，眼睛读到的是"一块厚玻璃的边缘"，而不是"一圈
   折射 + 一块暗板"。所以内辉不是装饰，是**接缝消除器**，必须每个面都有。
   ── 变量语义 ──────────────────────────────────────────────────────────
   --mc-tint        浮层底色：底色 token 的保留百分比（越小越透）
   --mc-glow-blur   内辉模糊半径（px）
   --mc-glow-spread 内辉扩散（负值 = 只贴边、中心零影响）
   --mc-glow-alpha  内辉强度
   --mc-hairline    .5px 描边色（深色白 20% / 浅色黑 16%）
   --mc-topline     顶部 1px 亮线（模拟"器皿上沿受光"） */
body[${GLASS_ATTR}] {
	--mc-tint: 30%;
	/* v0.11.0：非输入框面 bezel 24→20 ⇒ 内辉半宽跟着 ×0.85（11.8→10），
	   否则辉光尾会伸出折射带外，读成被禁的"四周发光边"。 */
	/* v0.12.0：内辉直接抄输入框的 20 / −5 / .20（此前是 17/−4.25 的"缩小版"，
	   用户口径是"复用或直接复刻输入框"，参数逐位对齐后才谈得上视觉统一）。 */
	--mc-glow-blur: 20px;
	--mc-glow-spread: -5px;
	/* v0.15.0（a05 浅色审计）：令牌基值改为**浅色安全值**，深色值全部搬进
	   body[data-ds-dark-theme] 块 —— 浅色不再靠"写死白/冷白"碰运气。
	   浅色玻璃的内缘是「内阴影」（0,0,0 低 alpha），深色才是「冷白内辉」。 */
	--mc-glow-alpha: 0.05;
	--mc-glow-rgb: 0, 0, 0;
	/* v0.15.0：面板多一条 0.5px 内亮环（a02 定量：input ring/body 11.89 vs 面板 0.48）。
	   浅色下透明，深色 212,232,255/.19 —— 只在深色玻璃上补"玻璃边"的读感。 */
	--mc-panel-ring: rgba(20, 24, 33, 0.14);
	/* v0.9.1（a05 浅色真机）：发丝色不再写死白 12%。输入框的发丝走宿主
	   --dsw-elevation-soft（深 rgba(255,255,255,.12) / 浅 rgba(0,0,0,.10)），
	   这里改用 border-l2（深 #ffffff1f / 浅 #0000001a）—— 同一语义、两主题同源。*/
	--mc-hairline: var(--dsw-alias-border-l2, rgba(255, 255, 255, 0.12));
	--mc-topline: transparent;
	/* v0.15.0：阴影改用宿主语义令牌（浅色下 28%/42% 黑会成黑晕，a05 实测浅色下沿 −27L）。 */
	--mc-shadow-float: var(--dsw-elevation-soft, 0 8px 24px rgba(0, 0, 0, 0.12));
	--mc-shadow-panel: var(--dsw-elevation-prominent, 0 24px 48px rgba(0, 0, 0, 0.16));
	/* v0.9.0（a03 定量）：内辉半宽 11.8px = bezel/2 是 σ=blur/2 的必然结果，
	   20/−5/.20 与 bezel24 自洽（尾部 u=24 只剩 +0.26 L*，无接缝）。
	   面板与浮层用同一档 —— 不再有"面板单独收窄"的历史包袱。 */
	--mc-glow-panel-blur: 20px;
	--mc-glow-panel-spread: -5px;
	--mc-glow-panel-alpha: 0.06;
	/* v0.9.0 · 统一底色「一块玻璃 = 一个 fill 令牌」
	   事故复盘：输入框的观感 = 内部≈背景（a04 实测台阶 −9.2L）+ 边缘冷白内辉，
	   而 bg-overlay 45% 是 +36L 的浅灰板（18% 也是 +14.8L）——台阶**方向相反**，
	   眼睛必然读成两种材质（用户原话「折射区与内部模糊区割裂」「像贴膜」）。
	   深色改用「烟熏黑」38%（净 −8L，与输入框同向同量级）；浅色保持白系。
	   这样所有玻璃面的「体色」由同一个令牌决定，任何面都不再单独调 alpha。 */
	/* v0.9.1（a05 浅色真机定量）：浅色下 bg-overlay 45% 是一块「白板」——面板比背景
	   亮 +21.8L，与输入框的「内部≈背景」相反；而 tint 对 ghost 无效（只靠 blur）。
	   所以浅色走同一条「透明底 + 高频模糊」路线：面板/浮层只留 10% 体色（仅用于
	   把面板和背景区分开 2~3L），卡片保留 80% 白（承载文字的厚处，保证次文 CR）。*/
	--mc-fill-float: color-mix(in srgb, var(--dsw-alias-bg-overlay) 45%, transparent);
	/* v0.11.0：面板不再用 10% 薄底（浅色下几乎等于没有底，面板和遮罩区糊成一片），
	   改回 45% 白系体色 —— 面板要"比环境亮一档"才读得出是一块玻璃。 */
	/* v0.15.0（a05）：浅色面板体色 = 近白 78%（L*96.1，比宿主设置页 L*100 低 3.9L），
	   不再用 bg-overlay 45%（冷灰 L*82.3 —— 用户读作「设置整体变暗」的根因）。 */
	--mc-fill-panel: color-mix(in srgb, var(--mc-panel-base, var(--dsw-alias-bg-base, #ffffff)) 68%, transparent);
	--mc-fill-card: var(--mc-panel-base, var(--dsw-alias-bg-base, #ffffff));
}
/* 浮层统一装帧：菜单 / 气泡 / 工具提示 / 列表 / 任务面板 / 缩放工具条
   ⚠️ v0.4.4：只认"表面根"，且排除嵌在玻璃面内部的元素。
   事故：模型选择弹层 root 是 div[role=group][data-menu-material]，内层 scroll
   容器 div[role=menu] 也被旧规则命中 → 在圆角玻璃里画出一个方形发丝环。
   根锚点用 [data-menu-material]（覆盖 role=menu / role=group / listbox 三种形态），
   再整体排除"玻璃根的后代"（:not(:is(...) *)）。 */
body[${GLASS_ATTR}] :is(
	[data-menu-material],
	[role='tooltip'],
	[role='dialog'][aria-modal='true']:not([data-composer-card]),
	[role='alertdialog'],
	[data-testid='todo-panel'], .lXshSW_root,
	[data-document-zoom-controls],
	[data-team-panel='true'],
	[data-mc-portal],
	div:has(> [data-quote-popover])
):not(:is(
	[data-menu-material],
	[role='dialog'][aria-modal='true'],
	[role='alertdialog'],
	[data-testid='todo-panel'],
	[data-team-panel='true']
) *) {
	box-shadow:
		0 0 0 0.5px var(--mc-hairline),
		var(--mc-shadow-float),
		inset 0 0 var(--mc-glow-blur) var(--mc-glow-spread) rgba(var(--mc-glow-rgb), var(--mc-glow-alpha)) !important;
}
/* ═══ v0.8.0 · 模态遮罩（scrim）：把压暗从玻璃内部挪到环境 ════════════════
   为什么必须有：输入框好看的前提是"背后就是页面背景"，而宿主把模态遮罩设成
   全透明（[role='presentation'] bg rgba(0,0,0,0)），大面板 18% 底 + 1px 模糊
   就等于一块干净玻璃直接盖在正文上 —— 字叠字、无"墙感"，用户读作"贴膜"。
   Apple 的做法是玻璃只负责折射，压暗由 scrim 负责。这里补回 scrim：
   只压 modal 的 overlay，不碰 composer / 非模态浮层。 */
body[${GLASS_ATTR}] {
	/* v0.11.0：**撤回自造 scrim**。宿主已经有一层 .mask rgba(0,0,0,.5)，
	   我们再叠 .34 后透射率只剩 0.33 —— 面板内实测亮度 3,3,4，比它周围的遮罩区
	   7,7,7 还暗，用户读作"整体变暗"。压暗交给宿主那一层就够了。 */
	--mc-scrim: rgba(0, 0, 0, 0);
	--mc-scrim-blur: 0px;
}
/* v0.15.0（a05）：删掉浅色自造 scrim .12 —— 宿主 mask-1 浅色 alpha .239 已经够，
   再叠一层会把环境从 69.9L 压到 78.5L 以下（面板与背景分不开）。 */
/* ⚠️ v0.11.0 重大修复：这里原来无条件写 backdrop-filter:
   blur(var(--mc-scrim-blur))，而 --mc-scrim-blur 是 0px ⇒ 计算值 blur(0px)。
   **只要祖先的 backdrop-filter 不是 none，Chromium 就会把它变成"背景根"**，
   于是它内部所有子元素的 backdrop-filter 只能采样这个根（空的）——
   veil 的位移+模糊彻底空转（实测 display:none 前后像素差 = 0.0），
   面板就退化成"一层 7% 白膜盖在清晰正文上"，这正是用户看到的
   "只有透明、没有折射带、没有模糊" 和 "字叠字"。
   修法：没有遮罩模糊需求时**完全不输出 backdrop-filter**（不能写 blur(0px)）。 */
body[${GLASS_ATTR}] [role='presentation']:has([role='dialog'][aria-modal='true']:not([data-composer-card])):not(:has(> [data-composer-card])) {
	background-color: var(--mc-scrim) !important;
	backdrop-filter: none !important;
	-webkit-backdrop-filter: none !important;
	transition: background-color .22s ease;
}
/* 设置窗（页面级面板）：同一套语言，只把外投影换成更大的落地阴影 */
/* v0.7.0（a05 真机 2×2）：面板 tint 不写死 45%。深色 bg-overlay 是中性灰，45% 反而
   给白字"提亮背景"、拉低对比（标题 CR 10.01）；18% + 宿主 scrim 才让标题 CR 升到 15.0，
   且左缘那道 1px 硬阶跃从 ΔY 3.55 降到 0.2~0.3 —— 用户说的"折射区和内部模糊区割裂"
   在面板上就是这条 tint 阶跃。浅色几乎相反：bg-overlay 近白，tint 再高也遮不住深字，
   真正压 ghost 的是 scrim，所以浅色保留 45%。 */
body[${GLASS_ATTR}] {
	--mc-tint-panel: 45%;
}
body[data-ds-dark-theme][${GLASS_ATTR}] {
	--mc-tint-panel: 18%;
	/* a03 v0.9 定量：近黑底上任何白填 1% 就 +8.14 L*（JND=2.5），所以暗色玻璃**不存在
	   "轻微白底"这一档** —— 要么 0（composer），要么走压暗。Apple HIG 也是「背景亮时加
	   35% 暗压层」。定档：12% 起步（文字密集面 14%），亮图/浅文档最多 35%。 */
	--mc-fill-float: color-mix(in srgb, #06070b 14%, transparent);
	/* v0.11.0 真机 A/B（PrintWindow 物理像素，采样 CSS(700,700)）：
	     现状 scrim.34 + #06070b 14% → 3,3,4（比周围遮罩区 7,7,7 更暗 ⇒ "整体变暗"）
	     scrim 0   + #06070b 14% → 5,5,7
	     scrim 0   + white 8%    → 25,25,25   ← 与页面底 rgb(21,21,23) 同档
	     scrim 0   + white 14%   → 40,40,41  （偏奶白）
	   输入框"内部≈背景"的物理契约要求面板内部落在页面底色同一亮度档，故走白 7%。
	   a03 旧结论"暗色不存在轻微白底档"只在近黑底(3~7)上成立；撤掉自造 scrim 后
	   底已抬到 10~11，白 7% 正好落到 22 档，不会糊成灰板。 */
	--mc-fill-panel: color-mix(in srgb, #ffffff 3%, transparent);
	--mc-fill-card: color-mix(in srgb, #06070b 14%, transparent);
	/* v0.15.0：深色专属的冷白内辉 / 内亮环 / 落地阴影（浅色基值是内阴影 + 宿主 elevation）。 */
	--mc-glow-rgb: 212, 232, 255;
	--mc-glow-alpha: 0.20;
	--mc-glow-panel-alpha: 0.20;
	--mc-panel-ring: rgba(212, 232, 255, 0.12);
	--mc-shadow-float: 0 8px 24px rgba(0, 0, 0, 0.28);
	--mc-shadow-panel: 0 20px 60px rgba(0, 0, 0, 0.42);
}
/* 底部面板：宿主给 r0 + 实心底。改成与全站同语言的圆角玻璃（tint/发丝由 JS 挂）。 */
body[${GLASS_ATTR}] [data-dsh-bottom-panel='true'] {
	border-radius: 24px 24px 0 0 !important;
	box-shadow:
		0 0 0 0.5px var(--mc-hairline),
		var(--mc-shadow-float),
		inset 0 0 var(--mc-glow-blur) var(--mc-glow-spread) rgba(var(--mc-glow-rgb), var(--mc-glow-alpha)) !important;
}
body[${GLASS_ATTR}] [role='dialog'][aria-modal='true'][data-shortcut-modal='settings'] {
	box-shadow:
		0 0 0 0.5px var(--mc-hairline),
		var(--mc-shadow-panel),
		inset 0 0 var(--mc-glow-panel-blur) var(--mc-glow-panel-spread) rgba(var(--mc-glow-rgb), var(--mc-glow-panel-alpha)) !important;
}
/* v0.4.9：菜单/弹层里的**内层滚动容器**（radius 0）常被宿主画上 0.5px 方形发丝 +
   外投影；那会在圆角玻璃内部切出一个方角（用户报的「方形怪框」残影）。
   玻璃根的直系 role=menu 子层只负责滚动，不该自带装帧。 */
body[${GLASS_ATTR}] :is([data-menu-material], [role='group']) > [role='menu'],
body[${GLASS_ATTR}] :is([data-menu-material], [role='group']) > [role='menu'] > div:first-child {
	box-shadow: none !important;
	background-color: transparent !important;
}
/* 菜单背板：宿主 64% 太实（折射被底色吃掉）→ 与其它浮层同一低底色。
   ⚠️ 只改 material 背板层，不动 root 与菜单项，宿主 hover/active 语义不变。 */
body[${GLASS_ATTR}] [data-menu-material] > div:first-child {
	/* v0.12.0：体色不再画在元素底上（那是 1px 硬阶跃的来源），改由 ::after 磨砂芯
	   带羽化 mask 输出；元素底保持透明，折射带才能像输入框一样"清"。 */
	background-color: transparent !important;
}
/* ═══ v0.12.0 · 清边 + 羽化磨砂芯（全站非输入框面统一样式） ═══════════════════
   输入框为什么好看：整面只有一条模糊基线（blur 1px）+ 位移场 + 冷白内辉，
   背后就是页面底，所以"边"和"内"是同一块材料。
   其它面背后是正文，1px 挡不住 → 旧方案把整面提到 12/20px，边缘折射带与内部
   雾面成了两种材质（用户反复报的"四周折射与内部模糊割裂"）。
   新方案两层，但仍是"一块玻璃"：
     · 主体层（JS 挂 backdrop-filter）：与输入框**同参** —— url(#位移) blur(1)
       saturate(1) brightness(1.05) + bezel 20 + 内辉 20/−5/.20 + 0.5px 发丝；
     · 磨砂芯（本规则，::after）：blur 14px 承担真正的"雾"，用两条 linear-gradient
       做 mask-composite 交集，把芯子的边界羽化成 8~36px 的渐变 ——
       清边到雾面之间没有 1px 台阶，只有连续过渡。
   z-index:-1 让它待在内容之下、元素底之上；元素底一律透明（体色由芯子带 mask 输出）。 */
/* v0.13.0：磨砂芯从 ::after 改成**真实并列子元素**（真机 A/B：shots/nest-bf.png）。
   backdrop-filter 元素是它后代的 backdrop root，后代的 bf 会 100% 失效 ⇒ 旧 ::after 只是空壳。
   新结构：父 bf:none + 两个并列层（rim 清边/折射带，frost 雾面），各自直接采真实页面。 */
/* v0.14.1：JS 打在元素上的标记是 data-mc-glass-layered（旧规则只写了 data-mc-layered，
   命中率为 0 —— isolation 一直靠 JS 内联兜住）。两个都收，避免以后靠内联才能生效。 */
body[${GLASS_ATTR}] :is([data-mc-layered], [data-mc-glass-layered]) { isolation: isolate; }
body[${GLASS_ATTR}] :is([data-mc-glass-rim], [data-mc-frost]) {
	position: absolute;
	inset: 0;
	box-sizing: border-box;
	border-radius: inherit;
	pointer-events: none;
}
body[${GLASS_ATTR}] [data-mc-glass-rim] { z-index: -2; }
/* v0.14.0：本层降级为**纯体色 + 羽化**（不再挂 backdrop-filter）。
   原因见 31-material-constants.js 的 v0.14.0 段：bf 元素被 overflow 祖先裁切时
   它的 mask 会被 Chromium 忽略，羽化失效 ⇒ 体色 alpha 在边缘仍是 1px 硬台阶。
   现在模糊由 rim 层一层均匀承担（无 mask、无台阶），本层只负责"越往中间越浓"的体色。 */
body[${GLASS_ATTR}] [data-mc-frost] {
	z-index: -1;
	background-color: var(--mc-frost-tint, transparent);
	-webkit-mask-image:
		linear-gradient(to right, transparent 0, #000 var(--mc-frost-feather, 32px), #000 calc(100% - var(--mc-frost-feather, 32px)), transparent 100%),
		linear-gradient(to bottom, transparent 0, #000 var(--mc-frost-feather, 32px), #000 calc(100% - var(--mc-frost-feather, 32px)), transparent 100%);
	mask-image:
		linear-gradient(to right, transparent 0, #000 var(--mc-frost-feather, 32px), #000 calc(100% - var(--mc-frost-feather, 32px)), transparent 100%),
		linear-gradient(to bottom, transparent 0, #000 var(--mc-frost-feather, 32px), #000 calc(100% - var(--mc-frost-feather, 32px)), transparent 100%);
	-webkit-mask-composite: source-in;
	mask-composite: intersect;
}
/* ═══ v0.4.8 · 面板内"实心贴片"统一为更厚的同语言玻璃 ══════════════════
   问题（用户）：设置窗里卡片是 host 的不透明贴片（dark #2c2c2e / light #fff），
   像"贴在玻璃上的塑料片"，与面板自身的低 alpha 玻璃不是一种材料。
   做法：JS 用**结构判据**（不透明底色 + 圆角 + 面积 + 无背景图 + 无滤镜）
   给候选元素打 data-mc-card，再由这里统一样式 —— 不依赖 CSS Module 哈希类名。
