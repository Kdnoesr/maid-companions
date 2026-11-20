//! 31-material-constants：玻璃材质参数表（唯一调参入口）。
//! 内容：const LIQUID（strength 0.8/bezelPx 24/blurPx 1/saturate 1/brightness 1.05…）、
//!       const MAT（卡片/浮层底色与 tint 百分比）、LIQUID_FILTER_ID、
//!       LIQUID_SELECTOR/MAX_AREA/PIXEL_BUDGET/RING_MIN_AREA/RING_WIDTH 闸门常量。
//! 依赖：无运行时依赖；被 32-material-engine-core 全量读取。
//! 铁律：改数值必须同步 docs 与 v06/contract，否则输入框材质会跑偏。
		// 自动回落成 CSS 里既有的毛玻璃，绝不会影响插件其它功能、更不会报错崩溃。
		// ── 参数对齐 D:\下载\index.html 控制面板的实测取值 ──────────────────────
		// 该 demo 的面板（#panel）把四个全局参数暴露为滑块，用户指定的目标值：
		//   折射强度 0.60 / 模糊 2px / 饱和度 100% / 色调浓度 0.00
		// 源码对应关系（index.html L661-665）：
		//   s-strength → global.strength（在 buildMap 里作为 k 的乘数）
		//   s-blur     → global.blur（拼进 backdrop-filter 的 blur()）
		//   s-sat      → global.sat（拼进 saturate()）
		//   s-tint     → documentElement 的 --tint-a（玻璃底色 alpha，0 = 不填色）
		// 另：demo 里普通玻璃的 zoom 是 0（只有可拖动放大镜 #lens 用 data-zoom="0.22"），
		//     故这里一并归零 —— 中心不再整体放大，只保留物理上正确的边缘折射
		//     （光线正交入射时不偏折，教程 2.2 节明确写了"中心位移向量长度归零"）。
		const LIQUID = {
			strength: 0.8,   // 边缘位移上限系数。
			//   峰值位移 = strength × bezelPx —— 收窄/放宽边缘带时用它保持"折射强度不变"。
			//   演进（全程保持峰值位移 ≈19.2px，只改带宽）：
			//     0.6 × 33 = 19.8  →  0.8 × 24 = 19.2  →  1.2 × 16 = 19.2  →  0.8 × 24 = 19.2（本轮回到 24）
			//   用户反馈"调回之前的折射宽度，现在的液态玻璃质感没那么高了"——
			//   玻璃的**厚度感**主要由带宽决定（带越宽，边缘"厚边"越明显），
			//   故把 bezelPx 放回 24，同时把 strength 降回 0.8 让峰值位移保持不变
			//   （只找回厚度感，不让折射变烈）。这也是最初被认可的一版组合。
			bezelPx: 24,     // 边缘过渡带宽度(px)。33 → 24 → 16 → **回到 24**
			zoom: 0,         // 全局透镜归零。
			//   曾为"找回旧观感"恢复成 0.03，但实测它**加剧**了端点与中部的落差
			//   （端点 19.2→28.7，中部 17.1→18.9，落差 2.1→9.8），
			//   反而让"上下中间凸"更显眼。与"中间不要凸"的目标冲突，故归零。
			dispersion: 0,   // 色散关闭（用户："不要彩色光晕，太花哨"）
			blurPx: 1,       // 模糊 2 → 1：更"通透"。
			//   清晰度是"通透感"的第一来源——背后内容越能看清、玻璃越像一块纯净的玉玻璃。
			//   2px 仍偏雾；1px 既保留一点柔化，又明显更透。
			saturate: 1,     // 饱和度 100% = 不增强（对齐 demo 面板 100%）
			brightness: 1.05, // 玉的"透光感"：透过玻璃的内容整体提亮 5%。
			//   玉的特征是**透光**——光穿透材质时带着一点内在亮度，而不是灰蒙蒙的。
			//   注意这**不是边框高光**（那种用户已否掉"泛白"），而是作用于整个玻璃面
			//   的材质属性，因此不会在边缘形成白线。想完全去掉就设回 1。
		};
		// ═══ v0.3.0 · 统一材质契约 ═══════════════════════════════════════════════
		// 目标：所有浮层/面板只有一套材质语言，与输入卡同源 —— 透明/低底色的玻璃体
		// + 单一连续位移场 + 冷色内辉 + .5px 描边 + 顶部亮线。
		// 【输入卡冻结】composer 档直接引用 LIQUID 原值，任何调参都不会波及它。
		// 【其它面】glass 档：bezel 随尺寸按比例缩放（0.22 × 短边，夹在 16~34），
		//   这样 260×144 的菜单和 800×800 的面板在视觉上是同一个"厚度"。
		//   模糊量 1px → 2.5px：1px 只让边缘位移显得孤立（割裂感来源之一），
		//   2.5px 让内部与边缘处在同一条"柔化"基线上，位移才读成折射而非错位。
		const MAT = {
			composer: { blurPx: LIQUID.blurPx, saturate: LIQUID.saturate, brightness: LIQUID.brightness, bezelPx: LIQUID.bezelPx, fixed: true },
			// ── v0.6.0 · 统一材质契约 ────────────────────────────────────────
			// 除输入框外的一切玻璃面（菜单/面板/弹窗/气泡/工具条）直接复用输入框的
			// **四个数字 + 一条位移曲线**，不再按面积/主题/语义分档：
			//   blur 1px · saturate 1 · brightness 1.05 · bezel 24 · 峰值位移 10px
			//   实测输入框 feDisplacementMap scale=37.09 → 净位移 9.95 CSS px。
			// 历史教训：面板用 2.4~2.9px 模糊换可读性 → 内芯被擦成死面，与边缘位移带
			// 形成两套模糊基线，就是用户反复说的「折射区与内部模糊区割裂」。
			// ── v0.11.0 · 非输入框面：真模糊 + 略窄的折射带 ──────────────────
			// 实测根因（本轮抓帧）：blur(1px) 在**文字背景**上等于没有模糊 —— 面板/菜单
			// 背后正文原样透出（"字叠字"、"+ 弹层只有透明"）。输入卡之所以好看，是因为
			// 它背后是空的页面底；换成有正文的区域，1px 就露馅。
			// 故非输入框面统一 8px：与输入卡同一套 tint/bezel/内辉/位移曲线，只把
			// "内部柔化"提到可读档（Apple 浮层材质也是 8~12px 量级）。
			// 模糊值按"面有多大"分两档（真机 A/B 8/16/24 判读）：浮层 12px、面板 20px。
			// 小浮层给 12 是因为它盖住的内容少、要留住"周围环境"的语境；面板 20 才压得住
			// 大段正文（8px 时正文仍可读，16/24 才是"雾面"）。其余参数（tint/bezel/内辉/
			// 位移曲线/发丝）全部相同 —— 这就是"同一材质、不同厚度"。
			// ── v0.12.0 · 清边 + 羽化磨砂芯 ──────────────────────────────────
			// 上一版把整个面提到 12/20px，于是"边缘折射带"和"内部雾面"成了两种
			// 模糊基线 —— 用户反复说的"四周折射区与内部模糊区割裂"就是它。
			// 现在把主体退回输入框同参（blur 1），雾面交给 ::after 的羽化磨砂芯
			// （见 22-css-floating.js 的 v0.12.0 段），两者共用同一条 bezel/位移/内辉。
			// ── v0.14.0 · 单层均匀模糊（去掉"清边 + 雾芯"两段结构）────────────
			// 真机实验（shots/v13o-isolate.png、v13p-overflow.png）：
			//   带 backdrop-filter 的元素一旦被**祖先 overflow:hidden/clip** 裁切，
			//   它自己的 mask-image 会被 Chromium **整体忽略**（羽化完全不生效，
			//   alpha 在 1px 内从 0 跳到满值 → 正是用户说的"四周折射区与内部模糊区割裂"）。
			//   同一祖先下，**没有 bf 的普通层** mask 完全正常（Y1 段实测 21→55→98→140→218）。
			// 结论：能把"羽化"用在体色上，但不能用在 bf 层上 —— 于是不再用 mask 去羽化模糊，
			//   机器改成：**全场一层均匀模糊**（与输入框同构：同一层 bf 里同时挂位移 + blur），
			//   体色单独一层带 mask 羽化输出 ⇒ 没有"边缘 vs 内部"两种模糊基线，割裂从结构上消失。
			// 数值：浮层 8px（关掉字叠字、仍留环境语境）、面板 10px（压得住大段正文）。
			glass: { blurPx: LIQUID.blurPx, saturate: LIQUID.saturate, brightness: LIQUID.brightness, bezelPx: 17 },
			panel: { blurPx: LIQUID.blurPx, saturate: LIQUID.saturate, brightness: LIQUID.brightness, bezelPx: 17 },
			/** 羽化磨砂芯参数：blur 决定"雾"的厚度，feather 决定"清边→雾面"的过渡宽度。 */
			frost: { blurPx: 14, minFeatherPx: 8, maxFeatherPx: 36, featherRatio: 0.14, smallBlurPx: 9, minSideForFrost: 96 },
			/** 面板底色 alpha。只给令牌 alpha，深浅色由 --dsw-alias-bg-layer-* 自动反相。 */
			panelTint: "45%",
			/** 浮层底色 alpha（菜单/气泡/列表）。a05/a06 实测：菜单背后是会话列表白色标题，
		 *  26% 时 ghost 仍清晰可读；45% 才把 lapE 压到 26.6（−11%）。 */
			floatTintPct: 45,
			/** 所有面的净位移目标（CSS px）。输入框实测 9.95，故统一 10。 */
			dispTarget: 10,
			// v0.7.0（a05 真机 2×2 实测）：遮罩不再自造 44% 混合，直接用宿主自己的 modal mask
		// token（dark #00000080 / light #0000003d）。a05 数据：压 ghost 的其实是 scrim，
		// tint 在浅色几乎无效（白底叠白不遮深字）——"只调 tint 不改 scrim"注定失败。
		maskTint: "var(--dsw-alias-bg-mask-1)",
		/** 面板 tint 改为令牌档：dark 18% / light 45%（a05 实测：深色 bg-overlay 是中性灰，
		 *  45% 反而给白字提亮背景、拉低对比；18% + 50% scrim 时标题 CR 10.01→15.0）。 */
		panelTint: "var(--mc-tint-panel, 45%)"
		};
		const LIQUID_FILTER_ID = "dsh-maid-companion-liquid-glass";
		// ── 液态玻璃的适用范围 ────────────────────────────────────────────────
		// 用户要求：设置 / 会话统计 / 本轮用量 / Token 用量 / 权限气泡 / 模型气泡
		// 都要与输入框同款的液态玻璃质感。故这里列出的选择器与 STAGE_CSS 里
		// 浮层段（第 216 行起）**保持同一批**，避免"CSS 改了玻璃、JS 忘了给它折射"。
		// 每个元素尺寸不同 → 各自独立的位移贴图与 <filter>（id 唯一）。
		// ⚠️ 2026-10-16 v0.2.11 关键修复 —— 为什么必须【排除大尺寸页面级对话框】
		//   用户反馈(第二次，附 DOM)：「点开 bili 设置后，整个设置区域都是模糊的」。
		//   从【真实前端产物】取证的渲染代码
		//   (app.asar → @deepseek-ai/dsh-client-ui-sidebar-documentpreview/lib/client.excel.js，
		//    其中内联了 dsh-client-ui-settings-general 的 SettingsPanel)：
		//      createPortal(
		//        <div className="wCInkW_overlay" role="presentation">
		//          <div className="wCInkW_mask" aria-hidden />
		//          <div ref={panel} tabIndex={-1}
		//               data-shortcut-modal="settings"
		//               className="wCInkW_panel"
		//               role="dialog"              <-- ★ 就命中原来的 [role='dialog']
		//               aria-modal="true">
		//   而 .wCInkW_panel 的 CSS 尺寸是 **width:800px; height:min(800px,...)** ——
		//   整块全尺寸面板。它带着 role="dialog"，因此被本数组的 [role='dialog'] 捞中，
		//   于是本插件把 url(#...feDisplacementMap...) blur(Npx) 作为 **backdrop-filter**
		//   挂到整块面板上 → backdrop-filter 会把该元素【背后的所有内容】糊掉，
		//   表现为「整个设置区域变模糊」；再把 blurPx 叠上去就更糊。
		//
		//   ⚠️ 教训：上一轮我只从本数组删掉了字面量 ".wCInkW_panel"，**完全无效** ——
		//   同一个元素被 [role='dialog'] 这个属性选择器照样命中。删类名 ≠ 排除元素，
		//   必须检查**所有**可能命中它的选择器（属性选择器往往是漏网的那条）。
		//
		//   正确做法：给液态玻璃加一条【尺寸闸门】——只对小浮层生效。
		//   大尺寸（页面级）对话框既不透明也不该折射，这与用户"其他区域没问题"一致：
		//   其他浮层都是菜单/气泡这类小面板，同样的模糊量在它们身上只柔化边缘、观感更好。
		// ── 尺寸闸门（v0.2.12 重定）──────────────────────────────────────
		//   历史：v0.2.11 用 260000（≈510×510）一刀切把设置窗 800×800=640K 排除。
		//   代价是设置窗彻底没有玻璃，用户反馈"液态玻璃质感没有了"。
		//   实测（Node 复刻 buildMap）：峰值位移与面板尺寸几乎无关 ——
		//     输入框 640×132 → 18.9px；菜单 264×180 → 19.1px；
		//     设置窗 800×800 → 18.7px；大面板 1100×760 → 18.3px。
		//   即"大面板天然没有质感"是错的，质感来自同一套 SDF，天然统一。
		//   真正的问题是**整块面板**加 backdrop-filter 会把中间也糊掉。
		//   解法不是排除，而是【环带遮罩】：只让边缘一圈参与玻璃，中间挖空。
		//   因此上限放宽到能容纳 900×800 级别的设置窗，冗余留到 ~1M。
		//   ✅ 全尺寸（> LIQUID_RING_MIN_AREA）的面板自动走环带分支，见 applyTo。
		const LIQUID_MAX_AREA = 1100000;   // ≈ 1048×1048；设置窗 800×800=640K 现在通过
		const LIQUID_SELECTOR = [
			"[data-composer-card]",                 // 输入框（主对象）
			"[role='menu']", "[role='listbox']", "[role='tooltip']",
			"[data-menu-material]",               // 浮层根：覆盖 role=menu / role=group / listbox
			"[data-context-menu][data-menu-material='translucent']",
			"[data-trigger-menu][data-menu-material='translucent']",
			"[data-document-zoom-controls]",
			"div:has(> [data-quote-popover])",
			// ❌ 不再直接收 [role='dialog'] / [role='alertdialog']：
			//    它们既包含小弹窗也包含设置窗这种全尺寸页面，必须靠尺寸闸门区分。
			//    这里保留选择器、由 collectTargets() 的尺寸判定做过滤。
			"[role='dialog']", "[role='alertdialog']",
			"._list_4ub78_7", ".wq12jW_menu",       // primitives.Menu / 模型菜单真实类名（0.2 实测）
			".bRhRbq_panel", ".mufS8W_card", ".JObwrW_panel", ".Nqubda_panel",
			"._3e4SsG_menu", ".QsffPG_menu", "._7KE1Ra_menu", ".ZKlsPq_menu",
			"._7rgC5q_popover", "._7rgC5q_dialog",
			// ❌ 已移除 ".wCInkW_panel"（设置窗整块面板）——但仅删它没用，见上方教训；
			//    真正的拦截在 collectTargets() 的 LIQUID_MAX_AREA 尺寸闸门。
			"[data-testid='todo-panel']", ".lXshSW_root",            // 任务面板（对话框上方）
			// v0.7.0：底部面板（drawer，宿主给它实心 rgb(35,35,36) + r0）此前完全没被接管，
			// 是 a01 普查里的 P0：全站唯一"实心无圆角"的 A 类面。
			"[data-dsh-bottom-panel='true']",
			"[data-dsh-panel='true'][data-dsh-bottom-panel]",
		].join(",");
		// 并发预算：多个大浮层同时做位移滤镜会显著加重渲染。
		// 语义 = **额外**浮层的像素上限（输入框与"最大的那个浮层"永远无条件纳入）。
		// 参考尺寸：输入框 640×132≈84K；各类菜单 200~264 宽≈24~50K。
		// v0.2.12：设置窗（800×800≈640K）重新纳入，故预算同步放宽，
		//   否则它会在"额外浮层"阶段被预算挤掉，表现为"开了设置窗玻璃也没了"。
		const LIQUID_PIXEL_BUDGET = 2000000;
		// ── 边缘玻璃条（v0.2.12）─────────────────────────────────────────
		//   超过这个面积的面板视为"页面级"，不在面板本体上挂 backdrop-filter，
		//   改为在四边各放一根独立玻璃条 —— 边缘有玻璃、中间完全清晰。