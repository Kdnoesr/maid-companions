//! 20-css-stage-base：STAGE_CSS 第 1 块 —— 舞台/容器/主面板基础样式 + 对话区毛玻璃。
//! 内容：空行与 STAGE_CSS 注释头、舞台根/座位/滚动体骨架、v0.2.18 设置窗玻璃、
//!       「对话区毛玻璃」段（到 459 行 composer 段之前）。
//! 依赖：同一模板字符串，被 21-24 块续写，禁止单独闭合反引号。
//! 边界：结束于舞台底/对话区段末，下一块从 [data-composer-card] 开始。


		// 角色舞台样式（作用域限定在 body[data-dsh-maid-companions]，不影响正常 UI）。
		// 舞台放在对话视图根内；z-index:5 使其在不透明背景之上可见。
		const GLASS_ATTR = "data-dsh-maid-companion-glass";
		const STAGE_CSS = `
body[${OWNER_ATTR}] [data-dsh-maid-companion-stage] {
	position: absolute;
	inset: 0;
	z-index: 0;
	overflow: hidden;
	pointer-events: none;
	contain: strict;
}
/* 舞台放在「持久对话列 centerCol」；对话列本身透明，但其子级对话视图根
   wSkVaW_root 自带不透明 bg-base 背景，会把舞台盖住 —— 故同样把该根背景转透明，
   AppFrame（.frame）在更外层铺同一 bg-base 底色，观感不变，立绘得以透出。 */
body[${OWNER_ATTR}] ${ROOT_SELECTOR} {
	position: relative;
}
body[${OWNER_ATTR}] :is([class*='Dc7zOa_root'], [data-slot='main.conversation'] > [data-phase]) {
	/* 2026-10-09 DSH Desktop 0.2 适配：0.1.x 的 wSkVaW_root 已随 ui-chat 重编译改哈希
	   （现为 Dc7zOa_root）；同时保留结构锚 [data-slot='main.conversation'] > [data-phase]，
	   不依赖哈希、跨版本更稳。 */
	background: transparent !important;
}
/* 把对话列内容（wSkVaW_root 及其后阶段内容）抬到舞台之上：立绘 z-index:0 垫底、
   内容 DOM 顺序在后 → 信息完整可见、立绘从两侧底部露出。 */
body[${OWNER_ATTR}] ${ROOT_SELECTOR} :is([data-phase='hero'], [data-phase='active'], [data-phase='settling']) {
	position: relative;
	z-index: 1;
}
/* ═══ 2026-10-15 修复：功能页（技能中心 / 任务看板 / 上下文洞察 …）被立绘穿透 ═══
   现象：点开左侧栏的功能入口后，立绘压在面板之上，面板内容被挡。

   根因（无头 Chromium 复刻真实结构后实测，非推断）——
   量到的四个盒子：
     #col             982x604  pos=relative z=auto     display=flex
     stage            982x604  pos=absolute z=0        display=block
     div[data-slot]     0x0    pos=relative z=1        display=contents ← 规则无效
     #panel           982x604  pos=static   z=auto     display=flex     ← 没拿到 z-index

   链条：
     ① shell 的槽宿主 div[data-slot="main"] 用的是 **display: contents**
        （见 slot 组件的 ANCHOR_STYLE = { display: "contents" }）。
        display:contents 的元素**不生成任何盒子** → 它自己的 position/z-index/flex
        全部被浏览器忽略；它的子元素被**提升**到父级（centerCol）参与布局。
     ② 于是功能页（如 [data-dsh-taskboard-view]）实际上是 centerCol 的
        **直接 flex 子项**，但它拿到的是 position:static + z-index:auto。
     ③ 立绘舞台是 position:absolute + z-index:0 —— 定位元素会画在
        z-index:auto 的静态流内容**之上**，所以立绘盖住了面板。
     ④ 之前那版规则错在**选错了元素**：给 display:contents 的槽宿主写
        position/z-index/flex 等于什么也没写（它不生成盒子）。

   修复（必须打到被提升的那一层）：
     把 centerCol 里「除舞台之外」的**定位内容**抬到舞台之上。分两支：
       · 直接子级（对话视图 Dc7zOa_root 就走这支）→ > *:not(stage)
       · 槽宿主的子级（被 display:contents 提升上来的功能页）→ > [data-slot] > *
     两支都只做「同层相对次序」修正，不进入面板内部。

   安全性（为什么不会弄坏对话视图）：
     · 对话视根本来就是 z-index:1（既有 [data-phase] 规则），再加一次是幂等的；
       这里补的 flex:1 1 auto 对自带 height:100% 的对话根同样幂等。
     · 只作用于 centerCol 的两层直接结构，不碰侧栏 / details 栏 / 面板内部。 */
body[${OWNER_ATTR}] ${ROOT_SELECTOR} > *:not([data-dsh-maid-companion-stage]) {
	position: relative;
	z-index: 1;
	flex: 1 1 auto;
	min-height: 0;
}
/* 槽宿主是 display:contents（不生成盒子），其子级被提升到 centerCol —— 必须单独抬一次，
   否则功能页仍是 z-index:auto，被 z-index:0 的舞台盖住。这就是本次真正的修复点。

   选择器说明：
     · > [data-slot] > * 命中被提升上来的功能页根（技能中心 /.ptK59a_panel、
       任务看板 /[data-dsh-taskboard-view]、上下文洞察等）。
     · 只取「槽宿主 → 页根」两层，不进入页根内部，避免影响面板自身布局。
     · 不写 flex:1 —— 页根自带 height:100%，实测已铺满整列（982x604），无需干预。 */
body[${OWNER_ATTR}] ${ROOT_SELECTOR} > [data-slot] > * {
	position: relative;
	z-index: 1;
	/* ═══ 让功能页的「内容板块」也变透明一点（用户诉求：学顶部栏的上下文/轨迹）═══
	   问题演进：
     ① 只把 bg-base 置透明时，页根（.ptK59a_panel / [data-dsh-taskboard-view]）
        确实透了，但**内容板块自己另有底色**：
          任务看板：._7D6uKa_column 用 bg-layer-2，.Jh0q7G_card 用 bg-layer-3
          上下文洞察：.lc-card 用 bg-layer-1，.lc-stat 用 bg-layer-2
        这些 layer token 仍是暗色不透明 → 整片内容区看起来「没有变透」。
     ② 用户要求「学顶部栏的上下文/轨迹」——那两个页签之所以透，
        是因为它们的容器直接用 bg-base，而 bg-base 我们已置透明。

	   做法（与 maid-atelier 完全同构，只降 alpha、不换色相）：
	     · 复用本插件既有的「捕获原值 → color-mix 降 alpha」两段式，
	       避免自定义属性循环引用；
	     · 在页根捕获原始 layer 色到 --mc-page-layer-N；
	     · 在页根**子树**把 layer token 重绑为 color-mix(原色 N%, transparent)，
	       于是卡片/列/统计块一起变半透明，色相不变、文字仍可读。

	   透明度取值（比对话区保守，因为面板信息密度高）：
	     layer-1 82% ｜ layer-2 78% ｜ layer-3 74%
	   ——数值越大越不透；面板要「透出立绘但仍清晰可读」，故留得比对话区多。 */
	--mc-page-layer-1: var(--dsw-alias-bg-layer-1);
	--mc-page-layer-2: var(--dsw-alias-bg-layer-2);
	--mc-page-layer-3: var(--dsw-alias-bg-layer-3);
	--dsw-alias-bg-base: transparent;
}
/* ═══ 2026-10-16 可读性回补：技能中心 ═══════════════════════════════════════
   用户反馈「技能中心可读性有点差」，其余页面保持不动。

   原因（实证 dsh-client-ui-skill-explorer 的 CSS）：
     该页根的底色是 background: var(--dsw-alias-bg-base)，而上面把它置为
     **完全透明** 了；并且它**一个 bg-layer-\* 都没用**——
        --dsw-alias-bg-layer-1/2/3 在该插件里出现次数均为 0。
     对比之下，任务看板/上下文洞察都有 bg-layer-* 的卡片做「底」，
     文字始终落在半透明卡片上；技能中心是**整页直接把文字铺在立绘上**，
     所以只有它可读性明显变差。

   做法：只给技能中心这一处把「页底」还回来一点，用该面板自己的输入框同款
   底色 token（--dsw-specific-input-major）按 alpha 铺一层，
   既压住立绘保证文字可读，又保留透出感（而不是回到完全不透）。

   2026-10-16 调参记录（用户反馈「有点过于灰了，再透一点」）：
     62% → **42%**（数值 = 保留原色的百分比，越小越透）
   42% 仍能把文字从立绘上「托」起来（文字是浅灰/白，底是中性偏蓝的黑），
   但立绘透出感明显回来了；再往下（<35%）技能描述那种长英文行会开始吃力。

   ⚠️ 选择器用 [data-dsh-skill-explorer-view]（该插件自带的语义锚），
      不依赖 CSS Module 哈希；只作用于这一个页面，其它面板完全不受影响。
   ⚠️ 必须连**子级** .ptK59a_panel 一起兜底：真正画底的是它（它写的是
      background: var(--dsw-alias-bg-base)），而 bg-base 已在页根被置透明；
      只给页根铺底没用 —— 子级仍是不透明→透明，文字照旧压在立绘上。
      用 > * 覆盖「页根 → 面板」这一层，不进入更深的列表行。
   ⚠️ 只对该页生效，不改任何 layer token、不碰其它插件。 */
body[${OWNER_ATTR}] ${ROOT_SELECTOR} > [data-slot] > [data-dsh-skill-explorer-view],
body[${OWNER_ATTR}] ${ROOT_SELECTOR} > [data-slot] > [data-dsh-skill-explorer-view] > * {
	background: color-mix(in srgb, var(--dsw-specific-input-major) 42%, transparent);
}
/* 页根子树：layer token 降 alpha（同一颜色 + 更多透明 = 变透，色相不变） */
body[${OWNER_ATTR}] ${ROOT_SELECTOR} > [data-slot] > * > * {
	--dsw-alias-bg-layer-1: color-mix(in srgb, var(--mc-page-layer-1) 82%, transparent);
	--dsw-alias-bg-layer-2: color-mix(in srgb, var(--mc-page-layer-2) 78%, transparent);
	--dsw-alias-bg-layer-3: color-mix(in srgb, var(--mc-page-layer-3) 74%, transparent);
}
/* ⚠️ 只作用于「槽宿主 → 页根 → 页根子树」两层，不碰对话区、侧栏、details 栏。
   浮层（菜单/弹窗/气泡）挂在这些板内时同样是子树，会一起变透；
   但它们自带 backdrop-filter 毛玻璃（见上方浮层段），观感一致、不会发脏。 */
/* 底部「渐变/作曲区」锁定条（composerSeat，z-index:7, sticky bottom:0）的不透明
   渐变背景会盖住立绘脚部。用户要求修改渐变区域：把它的背景改为透明，让
   z-index:0 的立绘脚部从渐变区透出（composer 输入卡片本身是子元素，不受影响）。 */
body[${GLASS_ATTR}] [data-composer-seat] {
	background: transparent !important;
}

/* ═══ v0.2.18 · 设置窗（模态面板）终于有了玻璃 ════════════════════════════════
   用户原话："和对话框一样就行，对话框不要动了"。此前四轮做法全部失败，
   根因已在 docs/settings-glass-adversarial.md 与 docs/settings-glass-rig.md 里
   逐条实测记录，这里只留结论：

   ── 为什么以前的边缘玻璃条 / 镜像墙全都等于没做 ────────────────────────────
   面板真实 CSS 是 background: var(--dsw-alias-bg-layer-2)（= #2c2c2e，不透明），
   而条子是面板的子元素 —— backdrop-filter 采样的是元素【背后】，
   于是它采到的永远只是面板自己的底色。均匀色再模糊还是均匀色，
   所以调 blurPx / strength 一点观感都不会变（实测：条内注入量是平坦常数 +2）。

   ── 为什么现在能成 ────────────────────────────────────────────────────────
   直接改【面板本身】：把底色降到 45%，并挂上 backdrop-filter。
   面板自己半透明之后，它背后就是页面背景（立绘 / 聊天流），
   与输入框 [data-composer-card] 走的是同一条物理通路。

   ── 参数是扫出来的（rig 实测，12 档全过 WCAG AAA）────────────────────────
     alpha 45%   ：面板内起伏通过率 0.901（输入框 1.027，现网不透明面板 0.000）
                   与背景相关性 r = 0.983（输入框 0.973）
                   正文对比度 15.91:1（输入框 17.02:1）—— 看齐输入框
     blur 16px   ：只影响"看得出内容 vs 只剩明暗"，不改亮度、不改对比度。
                   blur 再加大反而变差（45% 下 16→32→64，r 0.983→0.973→0.927），
                   因为越糊越接近平均色，与背景的逐块对应关系越弱。
     saturate 1.2 / brightness 1.15：brightness 在本架构里几乎挪不动均值，
                   保留只为守住"和输入框同一套"的观感取向。
     ⚠️ 面板的 backdrop-filter 不会模糊它的子孙（实测 1px 发丝线在 blur 0/16/40
        下纵剖面完全相同），所以卡片、分割线、文字都保持锐利。

   ── 为什么只用 aria-modal 这一个锚点 ──────────────────────────────────────
   设置窗面板的类名 VOzbGW_* 是 CSS Module 哈希，每次构建都会变；
   它身上【没有任何 data-* 锚点】，唯一的稳定特征是 role="dialog" + aria-modal="true"。
   为免误伤，按名字排除输入卡、菜单、警报框；其余模态弹窗（确认框等）
    尺寸小于阈值会被下方 :is(:not(...)) 之外的门禁跳过 —— 见 applyModalGlass()。

   ── v0.2.20 · 范围收窄到「设置窗」这一种弹窗 ─────────────────────────────
    上面那句"只用 aria-modal 这一个锚点"范围**太宽**了：dsh-web-all 与其它插件里
    另有多个模态弹窗（远端面板、更新面板、归档对话框等）也带 role=dialog +
    aria-modal=true。它们内容是表格/列表/游戏界面，给它们上 blur(16px)、再叠上
    它们自家 overlay 的毛玻璃，就是用户报的「点开 bili 设置后整屏发糊」。
    宿主设置窗的真实结构（@deepseek-ai/dsh-client-ui-settings-general L114-125）是：
      div.overlay[role=presentation]
        ├─ div.mask[aria-hidden]
        └─ div.panel[role=dialog][aria-modal=true]   ← 只给这一层上玻璃
    改成这条结构关系后，bili 设置那种「无 role 的普通 div + iframe」以及其余浮层
    都不再被命中。类名 VOzbGW_* 是 CSS Module 哈希、每次构建都会变，且面板上
    没有任何 data-* 锚点 —— 所以刻意只写结构关系，不写类名。

    ⚠️ 已知未覆盖：RemotePanel（web-all L25086 一带）与 ArchiveDialog（L53409 一带）
       父级也是 presentation，仍会被命中。它们根节点只有 className / role /
       aria-modal / aria-label，没有 data-* 锚点；在"不许 CSS Module 哈希 +
       不许 :has()"的约束下没有纯 CSS 的排除写法。属已知风险。
    ⚠️ 已知脆性：这里用直接子选择器 >。Fragment / Suspense 不产生 DOM 节点，
       不会断链；但宿主若在 overlay 与 panel 之间插一层 wrapper，本规则会**静默失效**
       （设置窗退回石板）。改宿主版本后跑一次自检：
         document.querySelectorAll("[role=presentation] > [role=dialog][aria-modal=true]").length
       预期恒为 1。
   ── 为什么 box-shadow 要写全 ─────────────────────────────────────────────
   box-shadow 是整体替换：必须把宿主原有的立体感用同一条规则表达出来，
   否则面板会从"浮在页面上"变成"贴在页面上"。这里用外投影 + 上高光 + 下描边
   重建"玻璃器皿"的厚度，不写回宿主 token 是刻意的 —— 宿主用的是 elevation
   系列，混进来会把内高光覆盖掉（输入卡那次已经踩过）。 */
body[${GLASS_ATTR}] [role='presentation'] > [role='dialog'][aria-modal='true']:not([data-composer-card]):not([role='menu']):not([role='alertdialog']):not([data-testid='todo-panel']):not([data-dsh-plugin='update']) {
	/* ── v0.2.23 · 设置窗（页面级面板）─────────────────────────────────
	   锚点用结构关系（overlay 的直接子 dialog），不写任何 CSS Module 哈希 ——
	   哈希每次构建都会变（旧版 VOzbGW_*，新版 AnXs9G_*），写死必然静默失效。
	   底色 62%：够透，能让背后立绘/内容透出；又够实，正文对比度仍在 AA 以上。
	   ⚠️ v0.2.24：底色**不在这里写**，改由 JS 在 applyTo 里设内联样式。
	      原因：CSS 版若因选择器失效（宿主改了直接子关系）会静默退回不透明石板，
	      而 JS 侧的判据是"面积 > 260000"，不依赖任何类名/子关系，更难静默失效。
	      本规则只留 box-shadow 这类纯装帧属性，失效了也不影响玻璃本身。
	   ⛔ 这里**绝不写 backdrop-filter**：会让 bili 设置那页整屏发糊。
	      边缘折射由 JS 的 installRim 用 filter + 背景副本实现。 */
	/* ⚠️ v0.3.1：本规则特异性 (0,9,1) 极高，会压过后面所有同属性规则 ——
	   所以装帧数值必须**在这里跟着统一材质层走**，不能只写在末尾的
	   「统一材质层」块里（那样会被本条静默压掉，实测：面板仍是旧阴影）。 */
	/* v0.4.9：① 去掉 inset 顶线 —— a04 逐像素实测证明它就是那条"上部分细线"
	   （1 设备 px 加白贴在外边界第一行，后面跟 2~3px 暗缝 → 读成两块玻璃对缝，
	   顶边梯度 28.7 → 13.9 L/px）。输入框本来就没有顶线，删掉才是对齐。
	   ② 面板内辉改读 --mc-glow-panel-*（此前被本条特异性压掉，从未生效）。 */
	box-shadow:
		0 0 0 0.5px var(--mc-hairline),
		/* v0.15.0（a02 R1）：面板补一条 0.5px 内亮环。输入框 ring/body=11.89，面板只有 0.48，
		   因为面板体色比背景亮 9.5L，20px 内辉被自己的底洗掉了 → 用贴边细环把"玻璃边"读回来。
		   ⚠️ 这条规则特异性 (0,9,1) 会压过末尾统一材质层块，所以环必须写在这里。 */
		inset 0 0 0 0.5px var(--mc-panel-ring),
		var(--mc-shadow-panel),
		inset 0 0 var(--mc-glow-panel-blur, 16px) var(--mc-glow-panel-spread, -7px) rgba(var(--mc-glow-rgb), var(--mc-glow-panel-alpha, 0.10)) !important;
}
body[${OWNER_ATTR}] [data-dsh-maid-companion-character] {
	position: absolute;
	display: block;
	z-index: 1;
	width: auto;
	max-width: none;
	object-fit: contain;
	object-position: center bottom;
	filter: drop-shadow(0 20px 24px rgba(27, 44, 91, 0.14));
	/* ── 性能修复：不再过渡 height/bottom（布局属性），改过渡 transform（合成器属性）──
	   原实现 transition 了 height + bottom：布局属性无法走合成器，必须每帧在主线程
	   layout + paint，并且对约 2MP 的立绘（1122x2019 / 1077x2048）每帧重新降采样，
	   还要每帧按变化后的剪影重算 drop-shadow —— 这就是"立绘放大时卡顿"的根因。
	   现在：**布局高度固定不变**（见下面 left/right 的 height），缩小改用
	   transform: scale()，缩放比 = 目标高 / 布局高（如 64/96 = .6667）。
	   几何完全等价（等比：height 变则 width:auto 的宽度按同一比例变；锚点见
	   transform-origin，left 贴左、right 贴右、两者都贴底），但动画全程只在合成器上做。
	   另：translate/bottom 从未被赋值，把它们留在过渡列表里纯属无用开销，一并移除。 */
	transition: transform 620ms cubic-bezier(0.22, 0.78, 0.2, 1), opacity 420ms ease;
	/* 把图层栅格固定在**布局尺寸**（= 最大尺寸）：scale 始终 <= 1，纹素永远够用，
	   因此放大方向也不会变糊（若无此行，浏览器可能按缩小后的尺寸栅格化，
	   再放大就会糊）。 */
	will-change: transform;
}
/* 布局高度恒为最大尺寸（96%/92%）；"缩小"由 transform 表达。 */
body[${OWNER_ATTR}] [data-dsh-maid-companion-character='left'] {
	bottom: 0;
	left: clamp(8px, 1.5%, 24px);
	height: 96%;
	transform-origin: bottom left;   /* 锚定左边缘 + 底边（与原 left 固定 + bottom:0 等价） */
	transform: scale(1);
}
body[${OWNER_ATTR}] [data-dsh-maid-companion-character='right'] {
	right: clamp(8px, 1.5%, 24px);
	bottom: 0;
	height: 92%;
	transform-origin: bottom right;  /* 锚定右边缘 + 底边（与原 right 固定 + bottom:0 等价） */
	transform: scale(1);
}
/* 暗色主题下原为 brightness(0.84) saturate(0.92)——整体压暗 16%，与"保持亮度不变"
   的诉求冲突，故只保留投影（投影提供与深色背景的分离感，不改变立绘本体亮度）。 */
body[${OWNER_ATTR}][data-ds-dark-theme] [data-dsh-maid-companion-character] {
	filter: drop-shadow(0 22px 28px rgba(0, 0, 0, 0.3));
}
/* 会话激活（立绘缩小）时只改缩放，不动透明度：用户要求「开始对话后亮度保持不变」。
   此前此处带 opacity: 0.9，进入会话即整体变暗 10%，是"开始对话后亮度降低"的根因。
   缩放比 = 目标高 / 布局高：64/96 = .6667，62/92 = .6739（与原 height 等价比）。 */
body[${OWNER_ATTR}][data-dsh-maid-companion-chat-active] [data-dsh-maid-companion-character='left'] {
	transform: scale(0.666667);
}
body[${OWNER_ATTR}][data-dsh-maid-companion-chat-active] [data-dsh-maid-companion-character='right'] {
	transform: scale(0.673913);
}
@media (max-width: 1080px) {
	body[${OWNER_ATTR}] [data-dsh-maid-companion-character] { opacity: 0.74; }
}
@media (max-width: 700px) {
	/* 46/96 = .4792，44/92 = .4783（与原 height 等价比） */
	body[${OWNER_ATTR}][data-dsh-maid-companion-chat-active] [data-dsh-maid-companion-character='left'] { transform: scale(0.479167); }
	body[${OWNER_ATTR}][data-dsh-maid-companion-chat-active] [data-dsh-maid-companion-character='right'] { transform: scale(0.478261); }
}
body[${OWNER_ATTR}][data-dsh-maid-companion-resizing] [data-dsh-maid-companion-character] {
	transition: none;
	filter: none;
}
body[${OWNER_ATTR}][data-dsh-maid-companion-low-power] [data-dsh-maid-companion-character] {
	filter: none;
	/* 低功耗/软件渲染仍保留 transform 快速过渡：否则缩放变化瞬间跳变、
	   尺寸动效永远不播（治 low-power 扼杀尺寸过渡的问题）。 */
	transition: transform 260ms ease, opacity 180ms ease;
}
/* 会话切换动效（照搬 maid-atelier 皮肤的 composer dock/rise）：进入会话(dock)时
   输入卡自上落下归位，新会话/空态(rise)时输入卡自下升起归位；620ms 立绘高度过渡
   与之同步。marker 由 JS 按 data-phase hero↔active 翻转时置 body，560ms 后清除。 */
body[${GLASS_ATTR}][data-dsh-maid-companion-motion='dock']
	[data-phase='active'] [data-composer-card] {
	animation: maidCompanionCardDock 520ms cubic-bezier(0.22, 0.78, 0.2, 1) both;
}
body[${GLASS_ATTR}][data-dsh-maid-companion-motion='rise']
	[data-phase='hero'] [data-composer-card] {
	animation: maidCompanionCardRise 520ms cubic-bezier(0.22, 0.78, 0.2, 1) both;
}
