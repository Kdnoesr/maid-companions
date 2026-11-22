//! 32-material-engine-core：createLiquidGlass 闭包前半 —— 数学、贴图、生命周期。
//! 内容：SVGNS/clamp/smoothStep/glassParams/surfaceKind/roundedRectSDF、MAP_MAX_EDGE、
//!       mapCache、buildMap（feImage 位移贴图）、instances/ro/timer/uid/themeObs、
//!       collectTargets、writeStyle/restoreStyle、mount/removeRing、RIM_*/VEIL_* 常量、
//!       applyToRef、CARD_MIN_AREA/alphaOf、decorateCards/undecorateCards、installRim、
//!       removeRim/clearMaterial/hasBeforeGlass/muteBefore/restoreBefore、unmount。
//! 依赖：31 的 LIQUID/MAT/LIQUID_FILTER_ID；本块是闭包内原样切片，外层仍是
//!       function createLiquidGlass() {，本轮不做语义重构（TODO 见 parts/README.md）。
		//   取值 = 原 v0.2.11 的闸门值 260000（≈510×510）：
		//   菜单/气泡/输入框/任务面板都远小于此，行为**完全不变**。
		const LIQUID_RING_MIN_AREA = 260000;
		//   v0.2.18：大型面板此前靠"环带玻璃"分支处理（installRing 建四根条子）。
		//   但真机 rig 已证明条子的 backdrop-filter 在本结构下退化为恒等：
		//   条内注入量是平坦常数、与背后场景相关性 r=0.000。留着只会多 4 个节点
		//   + 4 份滤镜合成开销而毫无观感，故条子改为**不创建**。
		//   常量保留，供后续"面板半透明"方案复用同一套几何。
		//   玻璃条宽度(px)：与 LIQUID.bezelPx=24 对齐，覆盖位移场主要衰减区。
		//   实测（棋盘对照）：环带内标准差 0.0（糊）、环带外与中心 127.5（清晰）。
		const LIQUID_RING_WIDTH = 28;
		// v0.2.18：MIRROR_BLUR / MIRROR_OUT 随「镜像墙」一并废弃（见 installRing 注释）。
		function createLiquidGlass() {
			const SVGNS = "http://www.w3.org/2000/svg";
			const clamp = (v, a, b) => Math.min(Math.max(v, a), b);
			const smoothStep = (a, b, t) => { t = clamp((t - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
			/** v0.4.6 是否浅色主题（宿主用 body[data-ds-dark-theme] 标记深色）。 */
			const isLightTheme = () => !document.body.hasAttribute("data-ds-dark-theme");
			/** v0.3.0：按盒子尺寸给出统一的玻璃参数（bezel 随短边缩放，模糊/饱和/亮度全局一致）。 */
			const glassParams = (w, h, isComposer, isPanel) => {
				if (isComposer) return MAT.composer;
				// 开发期 A/B 覆盖：window.__mcGlass = {blurPx,saturate,brightness,bezelRatio,bezelMin,bezelMax}
				// 只在调参时用（改完关窗重开即生效，无需重载插件）。
				const base = isPanel && MAT.panel ? MAT.panel : MAT.glass;
				const G = Object.assign({}, base, globalThis.__mcGlass || {});
				const short = Math.min(w, h);
				// v0.6.0：bezel 固定 24（= 输入框），不再按短边缩放；也不再按主题加模糊。
				return {
					blurPx: G.blurPx, saturate: G.saturate, brightness: G.brightness,
					bezelPx: Math.max(2, Math.min(G.bezelPx, Math.round(short / 2) - 1)),
					disp: MAT.dispTarget,
				};
			};
			/** v0.3.1：面类型判定 —— 决定参数与"direct/veil"分支，**不再按面积猜**。
			 *  原因（a01 实测）：面积阈值会把同语义的面分到不同材质（954×400 的
			 *  候选列表走 resetModern 完全没有折射，260×144 的账号菜单却走 direct），
			 *  用户看到的就是"同样是菜单，一个有玻璃一个没有"。
			 *  kind: "composer" 冻结；"float" 菜单/树/列表/气泡（direct）；
			 *        "auto" 其余（按面积决定 veil 还是 direct）。 */
			const surfaceKind = (el) => {
				if (el.hasAttribute("data-composer-card")) return "composer";
				if (el.hasAttribute("data-message-bubble")) return "float";
				const role = el.getAttribute("role");
				if (role === "menu" || role === "tree" || role === "listbox" || role === "tooltip") return "float";
				if (el.hasAttribute("data-menu-material") || el.hasAttribute("data-trigger-menu")) return "float";
				if (el.hasAttribute("data-document-zoom-controls")) return "float";
				if (el.hasAttribute("data-dsh-bottom-panel")) return "float";
				if (el.hasAttribute("data-mc-portal")) return "float";
				if (el.matches?.("div:has(> [data-changes-hover-preview='true'])")) return "float";
				// 宿主新版菜单：material 背板是第一个 aria-hidden 子层（老逻辑已覆盖），
				// 这里再兜住"父级才是 menu"的列表类浮层。
				const p = el.parentElement;
				if (p && (p.getAttribute("role") === "menu" || p.hasAttribute("data-menu-material"))) return "float";
				return "auto";
			};
			/** v0.3.6：浮层底色随面积递增。
			 *  原因（真机）：954×400 的命令菜单按 30% 铺在代码 diff 上时，
			 *  背后文字从玻璃里透出来与菜单项重叠，读不清 —— 输入框能 30% 是因为
			 *  它背后通常是空聊天区。菜单越大越盖住正文，底色就该越实。
			 *  三档之间用面积线性插值，避免不同菜单底色突变。 */
			const floatTint = () => MAT.floatTintPct;
			/** v0.6.0：不再按主题加底 —— 底色 token 自己会随主题反相。 */
			const floatTintFor = () => MAT.floatTintPct;
			/** 圆角矩形有符号距离场：内部为负，边界为 0。 */
			const roundedRectSDF = (x, y, hw, hh, r) => {
				const qx = Math.abs(x) - hw + r, qy = Math.abs(y) - hh + r;
				return Math.min(Math.max(qx, qy), 0) + Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) - r;
			};
			/** 生成位移贴图（canvas → dataURL）与 feDisplacementMap 所需的 scale。
			 *  ⚠️ 性能：贴图分辨率**不需要**等于元素尺寸。位移场是一条平滑渐变
			 *  （由 SDF + smoothStep 生成，没有高频细节），所以降采样后由 feImage
			 *  拉伸回来，视觉上等价，但计算量与编码量按面积平方级下降。
			 *  实测（Node 同算法）：800×800 要 18.25ms，而 ≤512 边长只要几毫秒 ——
			 *  设置窗打开时那"闪一下"主要就是这段同步计算造成的。
			 *  MAP_MAX_EDGE 取 256：位移场没有高频细节（纯 SDF 平滑渐变），
			 *  256 边长经 feImage 拉伸后与原分辨率**视觉等价**，但数据量骤降：
			 *    800×800 → PNG 约 563KB
			 *    512×512 → PNG 约 230KB
			 *    256×256 → PNG 约  58KB   ← 采用
			 *  实测时序（插桩）：挂载本身 < 1ms，而 applyTo 里的
			 *  toDataURL 编码 + feImage 解码要 130ms —— "打开设置闪一下"的
			 *  主要成本就在这里，降到 256 约省 4 倍。 */
			const MAP_MAX_EDGE = 256;
			/** 生成位移贴图。
			 *  @param elW,elH  输出贴图的真实像素尺寸
			 *  @param radius   圆角
			 *  @param bezel    边缘带广度
			 *  @param area     可选：整块面板的尺寸 {w,h,r}。给了就按「整块面板」算 SDF，
			 *                  只取 (0,0)-(elW,elH) 这块窗口 —— 环带条子用得到（见下）。
			 *
			 *  ⚠️ v0.2.23 · 为什么必须能按「整块」算、只取局部的窗口：
			 *  环带是四条细条带（800×28 / 28×700 这种）。如果直接拿条带自己的
			 *  尺寸去算圆角矩形 SDF，条带边缘的每一处都会算成"面板边界"，
			 *  于是整条带都被当成边缘、位移方向全部指向条带内侧 —— 视觉上
			 *  不是"玻璃边缘被推弯"，而是"一条糊掉的带子"。
			 *  正确做法：SDF 永远按面板真实盒子算，条子只截取自己那一块窗口。
			 *  这与当年 installRing 里"每根条子各配一套 filter"是同一个教训的
			 *  两个不同层面：那次解决的是 feImage 的坐标系对齐，这次是 SDF 的
			 *  参考盒子 —— 两个都不能错。 */
			const mapCache = new Map();
			const buildMap = (elW, elH, radius, bezel, area, kScale, ease, dTarget) => {
				const key = JSON.stringify([elW, elH, radius, bezel, area, kScale, ease, dTarget || 0, LIQUID.strength, LIQUID.zoom]);
				if (mapCache.has(key)) { const cached = mapCache.get(key); mapCache.delete(key); mapCache.set(key, cached); return cached; }
				// 按最长边限制降采样；等比缩放，保持几何关系与位移方向不变
				const longest = Math.max(elW, elH);
				const shrink = longest > MAP_MAX_EDGE ? MAP_MAX_EDGE / longest : 1;
				const w = Math.max(2, Math.round(elW * shrink));
				const h = Math.max(2, Math.round(elH * shrink));
				// 位移量与元素尺寸成正比：贴图变小了，位移(px)也要按同比例缩，
				// 再由 feDisplacementMap 的 scale 换算回原尺寸下的像素值。
				const dispScale = shrink;
				const sRad = radius * shrink, sBezel = Math.max(0.5, bezel * shrink);
				// 「整块面板」参考盒子：没给 area 就是自己（输入框/菜单的老行为，完全不变）。
				//   给了 area 时，SDF 用面板的 hw/hh/半径，但采样点仍从 (0,0) 起算 ——
				//   也就是"这条子贴在面板的哪个位置，就取面板场的那一块"。
				const aw = area ? Math.max(2, Math.round(area.w * shrink)) : w;
				const ah = area ? Math.max(2, Math.round(area.h * shrink)) : h;
				const aRad = area ? area.r * shrink : sRad;
				const cv = document.createElement("canvas");
				cv.width = w; cv.height = h;
				const ctx2d = cv.getContext("2d");
				if (ctx2d === null) return null;
				const img = ctx2d.createImageData(w, h);
				const raw = new Float32Array(w * h * 2);
				const hw = aw / 2, hh = ah / 2;
				// kScale：环带专用放大系数（垫层已磨砂，边缘补一点强度才看得出弯折）。
				// 输入框/菜单不传 → 恒为 1，行为与旧版逐字节一致。
				const k = LIQUID.strength * (kScale || 1);
				let maxD = 0.0001;
				for (let y = 0; y < h; y++) {
					for (let x = 0; x < w; x++) {
						// v0.2.23 \u4fee\uff1a\u73af\u5e26\u6761\u5b50\u53ea\u662f\u9762\u677f\u7684\u4e00\u4e2a\u7a97\u53e3\uff0c\u91c7\u6837\u70b9\u5fc5\u987b\u5148\u52a0\u4e0a\u5b83\u5728\u9762\u677f\u91cc\u7684\u504f\u79fb\uff0c
						//   \u5426\u5219\u4e0b\u6761/\u53f3\u6761\u4f1a\u7b97\u6210\u548c\u4e0a\u6761/\u5de6\u6761\u5b8c\u5168\u76f8\u540c\u7684\u533a\u57df\u3002
						const sOffX = area ? (area.ox || 0) : 0;
						const sOffY = area ? (area.oy || 0) : 0;
						const px = x + 0.5 - hw + sOffX, py = y + 0.5 - hh + sOffY;
						// d<0 在内部；m: 0=深处 → 1=边缘，平方后中心几乎无形变
						const sd = roundedRectSDF(px, py, hw, hh, aw === w ? sRad : aRad);
						let m = smoothStep(-sBezel, 0, sd);
						// 缓动三选一（不传 = m²，输入框/菜单走这条，行为逐字节不变）：
						//   m²     最大斜率 ≈1.9/bezel，折返门限 K/bezel > 0.52；两端平滑
						//   "lin"  = smoothstep，最大斜率 1.5/bezel，门限 > 0.667；两端平滑 ← 面板
						//   "ramp" = 线性锥面，斜率恒 1.0，门限 > 1.0；但内缘有折线（v0.2.33 已弃）
						// 位移越过门限后「采样深度」非单调，画面就被翻转 —— 用户看到的「字反过来」。
						// v0.3.8 · "global"：全域缓弯（a03 物理实验方案 B）
						//   Δ(u) = D(1 - u/b)^2，b = 短边/2，u = 到最近边的深度。
						//   位移量在**整个面**上单调衰减到 0，没有"边缘带/内部"的分界，
						//   放大率 M(u)=1/(1-c|m'|) 不再出现极大值 —— 这是"折射区与内部
						//   模糊区割裂"的结构性解药（实测 R=0.95，bezel 型只有 0.31）。
						//   峰值仍在边上（= 原 bezel 型的峰值），所以"厚度感"不丢。
						// v0.4.0 · "quad2"：m(t)=(1-t)^2，t=u/B（u=到边深度，B=bezel）。
						//   a03 公平对照（同背景噪声、σ=2.5）：quintic 的放大率在带中部冒出
						//   一圈 4.7× 的凸包（"里面糊了一圈"），quad2 的极大值挪到物理外缘
						//   u≈7（被 0.5px 高光边盖住）—— 带均值 0.81 / 带最小 0.67，
						//   对现状 0.67 / 0.28。这就是"折射区与内部不再割裂"的数值依据。
						if (ease === "quad2") {
							const t = Math.min(1, Math.max(0, -sd / sBezel));
							m = (1 - t) * (1 - t);
						} else if (ease === "global") {
							const bMap = Math.max(2, Math.min(elW, elH) / 2 * shrink);
							const u = Math.max(0, -sd);
							const t = 1 - Math.min(1, u / bMap);
							m = t * t;
						} else if (ease === "ramp") {
							// 真正线性锥面：m = 1 - 深度/带宽。位移沿整条带均匀增长，
							//   采样深度 = s + K(1-s/bezel) 是斜率恒定的直线 ⇒ 整条带
							//   是「均匀压缩」，不会出现边缘附近被压成一片糊的饱和区。
							m = Math.min(1, Math.max(0, 1 - (-sd) / sBezel));
						} else if (ease !== "lin") m = m * m;
						// ── 位移方向：垂直于**最近的边**、指向内侧 ──────────────────
						// 用户要求："上下的中间不要凸" —— 即上边缘整条都要向上、下边缘整条
						// 都要向下，不要在正中冒出一个孤立的突起。
						//
						// 为什么"指向中心"做不到这一点（实测数据，640×132 输入框、bezel=24）：
						//   沿上边缘 y=3 从左到右，位移**方向**为
						//     11° → 15° → 21° → 38° → **90°** → 142° → 159° → 165° → 169°
						//   幅度却恒定 17.05px。也就是说：整条边幅度一样，**只有方向在扭转**，
						//   正中间那点恰好扭成"纯垂直 17px"-> 视觉上就成了"中间凸出来"。
						//   根因：这是扁长矩形，径向场方向在窄边中段严重偏离真实边界法线。
						//
						// SDF 梯度（取负）天然就是"到最近边界的内法线"：
						//   改用后上边缘变成 90°/90°/90°/90°/90°（整条一致向上），
						//   且**幅度逐点与原来完全相同**（实测：上边中点/上边1/4/左边中点
						//   均为 17.05，角部 19.20，正中 0.00）—— 所以"质感/强度"不会变，
						//   只是把"中间凸"这一点消除。这正是用户想要的效果。
						const eps = 0.5;
						const gx = roundedRectSDF(px + eps, py, hw, hh, aw === w ? sRad : aRad) - roundedRectSDF(px - eps, py, hw, hh, aw === w ? sRad : aRad);
						const gy = roundedRectSDF(px, py + eps, hw, hh, aw === w ? sRad : aRad) - roundedRectSDF(px, py - eps, hw, hh, aw === w ? sRad : aRad);
						const glen = Math.hypot(gx, gy) || 1;
						const nx = -gx / glen, ny = -gy / glen;   // 梯度指外，取负 = 指向内侧
						const amp = m * k * sBezel;
						const dx = nx * amp - px * LIQUID.zoom;
						const dy = ny * amp - py * LIQUID.zoom;
						const i = (y * w + x) * 2;
						raw[i] = dx; raw[i + 1] = dy;
						const ad = Math.max(Math.abs(dx), Math.abs(dy));
						if (ad > maxD) maxD = ad;
					}
				}
				// ⚠️ 贴图是降采样过的（边长 shrink 倍），而 feDisplacementMap 的 scale
				//    作用在**元素真实像素**上。所以先按元素原始像素尺度归一化，
				//    再把 scale 换算回真实像素 —— 否则元素的位移量会随降采样比例一起缩小。
				// v0.3.1 · 位移上限（a02 外推实验）：净位移 d_css = scale × shrink
				//   = scale × 256/max(w,h)，而 scale 只由 bezel 决定 ⇒ 小面因 bezel
				//   被 clamp 顶住，d 反而暴涨（260×320 菜单实测 43px，占宽 17%）。
				//   这里按"目标净位移"反解 scale 上限：scale ≤ D_target×max(w,h)/256。
				//   composer 不传 dTarget ⇒ 完全不参与钳制（黄金标准零改动）。
				// v0.6.1（a03-physics）：峰值净位移必须与尺寸无关。
				//   旧式 scale=dTarget*max(w,h)/256 只在大面成立；小面（max<512）峰值退化为
				//   dTarget*max/512（144x110 菜单实测 2.70px），于是小浮层的折射带几乎消失、
				//   只剩内辉 → "平"。这里改成：编码固定 ±maxD/2，scale 固定 2*dTarget，
				//   于是 disp_peak = scale*0.5 = dTarget（CSS px），与降采样 shrink 完全解耦。
				//   composer（dTarget=0）保持旧的 rawScale 路径，数值逐位不变（黄金标准零改动）。
				// v0.7.0（a02 PATCH A，纯数学复核 10 个尺寸全部 10.000）：
				//   解码式 d_css = scale × (C/255 − 0.5)，与 shrink 无关。
				//   旧式 enc=maxD/2 让 raw/enc 峰值 = 1.0 → C 被 clamp 到满量程，
				//   位移剖面变成"平顶 + 带外立即归零"（气泡 503 高实测 9.82、618 高 12.07、
				//   144×110 菜单只有 5.0）—— 这就是"像贴了层透明膜、没有透镜渐变"的根因。
				//   满量程编码：enc=2·maxD ⇒ raw/enc ∈ [−0.5,0.5]，C 刚好占满 0..255 不饱和；
				//   解码 scale=2·dTarget ⇒ d_peak = scale×0.5 = dTarget，任何尺寸恒等。
				const enc = dTarget ? 2 * maxD : maxD / dispScale;
				const scale = dTarget ? 2 * dTarget : enc * 2, data = img.data;
				for (let i = 0, p = 0; i < raw.length; i += 2, p += 4) {
					data[p] = clamp(raw[i] / enc + 0.5, 0, 1) * 255;       // R → X
					data[p + 1] = clamp(raw[i + 1] / enc + 0.5, 0, 1) * 255; // G → Y
					data[p + 2] = 128; data[p + 3] = 255;
				}
				ctx2d.putImageData(img, 0, 0);
				const result = { url: cv.toDataURL(), scale };
				mapCache.set(key, result);
				if (mapCache.size > 8) mapCache.delete(mapCache.keys().next().value);
				return result;
			};

			// ── 多目标管理：输入框 + 各类浮层（设置窗 / 菜单 / 工具提示）都变液态玻璃 ──
			// 每个元素尺寸不同 → 各自的位移贴图与 <filter>（id 唯一）。
			const instances = new Map();   // element -> { svg, filter, feImage, disps }
			let ro = null, timer = null, uid = 0, themeObs = null;
			let installed = false;

			/**
			 * 目标选择器：与 CSS 浮层规则保持同一批（见 STAGE_CSS 的浮层段）。
			 * ⚠️ 真正开着的浮层通常只有一两个，但选择器会同时匹配到隐藏/未挂载的节点，
			 *    所以还要靠 collectTargets 过滤可见性。
			 */
			const collectTargets = () => {
				let list = [];
				try {
					list = Array.prototype.slice.call(document.querySelectorAll(LIQUID_SELECTOR));
				} catch { return []; }
				// ── v0.8.1 · 结构兜底：宿主 portal 浮层（子智能体树 / 无锚点弹层）──────
				// 事故（a07 v08）：子智能体树 div.rezYhW_menu（336×536, r16, bg 透明, bf none）
				//   既不带 role=menu 也不带 data-menu-material，LIQUID_SELECTOR 与装帧 CSS
				//   都不命中 —— 它是 body 的**直系子节点**，只靠 inline top/left 定位。
				// 判据只用结构（不写任何 CSS Module 哈希）：body 直系 + 内联坐标 +
				//   absolute/fixed + 圆角 8~32 + 尺寸 180~1100 × 80~1000。
				// 命中后打 data-mc-portal，供 surfaceKind/装帧 CSS 复用同一条配方。
				try {
					for (const el of Array.from(document.body.children)) {
						if (!el || el.nodeType !== 1) continue;
						if (el.hasAttribute("data-composer-card")) continue;
						let cs = null;
						try { cs = getComputedStyle(el); } catch { continue; }
						if (cs.position !== "fixed" && cs.position !== "absolute") continue;
						const st = el.getAttribute("style") || "";
						if (!/(^|;)\s*(top|left|right|bottom|inset|transform)\s*:/.test(st)) continue;
						const pw = el.offsetWidth, ph = el.offsetHeight;
						if (pw < 180 || ph < 80 || pw > 1100 || ph > 1000) continue;
						const prad = parseFloat(cs.borderTopLeftRadius) || 0;
						if (prad < 8 || prad > 32) continue;
						try { el.setAttribute("data-mc-portal", ""); } catch { /* 忽略 */ }
						list.push(el);
					}
				} catch { /* 忽略 */ }
				// 只保留"真实可见且有尺寸"的元素
				const areaByElement = new Map();
				const live = list.filter((el) => {
					try {
						if (!el.isConnected) return false;
						const width = el.offsetWidth, height = el.offsetHeight;
						if (width === 0 || height === 0) return false;
						areaByElement.set(el, width * height);
						const cs = getComputedStyle(el);
						return cs.visibility !== "hidden" && cs.display !== "none";
					} catch { return false; }
				});
				// 输入框永远优先（它是最主要的玻璃）。
				// ⚠️ 其余**不截断个数**——之前用 slice(0, 6) 且 [role=dialog] 排在最后，
				//    导致同时存在多个面板时，"上下文已用"气泡（.JObwrW_panel + role=dialog）
				//    被截掉、永远挂不上液态玻璃（用户反馈"上下文使用还没有用上液态玻璃效果"）。
				const card = live.filter((el) => el.hasAttribute("data-composer-card"));
				// ── 尺寸闸门（v0.2.11）──────────────────────────────────────────
				// ⚠️ 必须在这里过滤，而不是靠选择器：设置窗（.wCInkW_panel，
				//    width:800px/height:800px）带 role="dialog"，会被 [role='dialog']
				//    命中；整块面板加 backdrop-filter → 其背后全部内容被糊掉，
				//    即用户看到的「整个设置区域模糊」。
				//    液态玻璃只适用于**小浮层**（菜单/气泡/提示）：这类元素的面板本身
				//    就是玻璃主体，折射与模糊发生在它的边缘，观感正确；
				//    而全尺寸页面级面板应该保持清晰可读，不该做背景折射。
				// ⚠️ 不要试图用"排除 .wCInkW_panel"来修：同一元素还会被属性选择器
				//    （role="dialog"）命中，删类名无效 —— 已实际踩过。属性选择器必须
				//    配合属性/尺寸判定，选择器本身无法表达"尺寸小"。
				// v0.3.2：面积闸门只对"非浮层"生效。浮层（菜单/候选列表/树/工具条）
				// 无论多大都必须进候选 —— 否则像输入框上方 953×400 的候选下拉
				// （>260000）会被这里静默丢掉，表现为"有的菜单有玻璃、有的没有"。
				const nestedInSurface = (el) => {
					let p = el.parentElement;
					while (p !== null) {
						// ⚠️ 只按"母浮层"排除：输入框内部也会挂自己的候选菜单
						//（slash 菜单就是 card 的后代），它必须作为独立面被接管。
						if (p.hasAttribute && p.hasAttribute("data-menu-material")) return true;
						p = p.parentElement;
					}
					return false;
				};
				const rest = live.filter((el) =>
					!el.hasAttribute("data-composer-card") &&
					!nestedInSurface(el) &&
					(surfaceKind(el) === "float" || areaByElement.get(el) <= LIQUID_RING_MIN_AREA));
				// ── 页面级面板（v0.2.24 修正）─────────────────────────────────
				// ⚠️⚠️ 这里曾经是整个功能"改了等于没改"的真因：
				//    上面那条闸门把面积 > 260000 的元素**整体排除在候选之外**，
				//    于是设置窗（800×800=640000）从来就不是 target →
				//    mount() 不会调用 → applyTo() 不会执行 →
				//    installRim() **一次都没跑过**。
				//    结果就是"代码全写好了、重启后画面完全没变"，而且没有任何报错。
				//
				// 现在的语义是分工，不是排除：
				//   小浮层 / 输入框 → 走 backdrop-filter（玻璃主体=自己）
				//   页面级面板     → 走 installRim（filter + 背景副本，绝不碰 backdrop）
				//    由 applyTo 里的面积分流决定，两边互斥。
				//
				// 这里用**结构判据**认面板，不写任何 CSS Module 哈希
				//（哈希每版都变：VOzbGW_* → AnXs9G_*），也不写尺寸阈值：
				//   宿主设置窗 = div.overlay[role=presentation] > div.panel[role=dialog][aria-modal]
				// 这样既认得出设置窗，又不会把输入卡/菜单/普通浮层卷进来。
				const isPagePanel = (el) => {
					try {
						if (!el.hasAttribute("aria-modal")) return false;
						if ((el.getAttribute("role") || "") !== "dialog") return false;
						const p = el.parentElement;
						if (p === null) return false;
						return (p.getAttribute("role") || "") === "presentation";
					} catch { return false; }
				};
				const panels = live.filter((el) =>
					!el.hasAttribute("data-composer-card") &&
					areaByElement.get(el) > LIQUID_RING_MIN_AREA &&
					isPagePanel(el));
				// 按面积降序：保证"最大的那个浮层"排在第一位。
				rest.sort((a, b) => areaByElement.get(b) - areaByElement.get(a));
				const picked = card.slice(0, 1);
				// 页面级面板一律纳入（同一时刻通常只有一个），且不占用小浮层的预算。
				for (const el of panels) picked.push(el);
				// ⚠️ 预算只用于限制**额外**的浮层，且必须保证最大的那个一定进来。
				//    早期版本把预算当"总额"卡死：设置窗是 800×800=640,000 px，超过 600,000 预算
				//    → 被整体跳过 → 用户反馈"设置的液态玻璃效果消失了"。
				//    正确语义：先无条件纳入最大的浮层（用户当下正在看的那个），
				//    再用预算决定还能不能再叠加更多 —— 这样"同时开一堆大面板"仍受控。
				// ⚠️ v0.2.11：设置窗已被上面的尺寸闸门排除，不再是候选，
				//    因此这里"无条件纳入最大者"不会再误伤它；闸门是唯一的尺寸判据。
				let budget = LIQUID_PIXEL_BUDGET;
				for (let i = 0; i < rest.length; i++) {
					const el = rest[i];
					const px = areaByElement.get(el);
					if (i === 0 || px <= budget) {           // 首个（最大）无条件纳入
						picked.push(el);
						budget -= px;
					}
				}
				return picked;
			};

			// Track CSSOM-serialized values and priorities; a host write supersedes our ownership.
			const writeStyle = (records, el, prop, value, priority = "") => {
				const style = el.style, current = { value: style.getPropertyValue(prop), priority: style.getPropertyPriority(prop) };
				let record = records[prop];
				if (!record || current.value !== record.last.value || current.priority !== record.last.priority) record = records[prop] = { original: current };
				style.setProperty(prop, value, priority);
				record.last = { value: style.getPropertyValue(prop), priority: style.getPropertyPriority(prop) };
			};
			const restoreStyle = (records, el, prop) => {
				const record = records[prop];
				if (!record) return;
				if (!record.last) { delete records[prop]; return; }
				const style = el.style;
				if (style.getPropertyValue(prop) === record.last.value && style.getPropertyPriority(prop) === record.last.priority) {
					if (record.original.value) style.setProperty(prop, record.original.value, record.original.priority);
					else style.removeProperty(prop);
				}
				delete records[prop];
			};

			/** 为一个元素建一套 SVG 滤镜。色散关闭时只建最简的一条（省掉两次采样与三次合成）。 */
			const mount = (el) => {
				const id = LIQUID_FILTER_ID + "-" + (uid++);
				const svg = document.createElementNS(SVGNS, "svg");
				svg.setAttribute("data-mc-glass-svg", "");
				svg.setAttribute("width", "0");
				svg.setAttribute("height", "0");
				svg.setAttribute("aria-hidden", "true");
				svg.style.position = "absolute";
				const filter = document.createElementNS(SVGNS, "filter");
				filter.setAttribute("id", id);
				filter.setAttribute("filterUnits", "userSpaceOnUse");
				filter.setAttribute("color-interpolation-filters", "sRGB");
				const feImage = document.createElementNS(SVGNS, "feImage");
				feImage.setAttribute("result", "map");
				feImage.setAttribute("preserveAspectRatio", "none");
				const mkDisp = (result) => {
					const d = document.createElementNS(SVGNS, "feDisplacementMap");
					d.setAttribute("in", "SourceGraphic");
					d.setAttribute("in2", "map");
					d.setAttribute("xChannelSelector", "R");
					d.setAttribute("yChannelSelector", "G");
					if (result !== undefined) d.setAttribute("result", result);
					return d;
				};
				let disps = null;
				if (LIQUID.dispersion > 0) {
					// ── 色散（chromatic aberration）──────────────────────────────
					// 物理：不同色光折射率不同 → R/B 位移相反，边缘分光（教程原码）：
					//   rC = tex(baseUV + offsetUV*d); bC = tex(baseUV - offsetUV*d)
					// 实现：同一张贴图做三次 feDisplacementMap（scale 不同），
					//       再用 feColorMatrix 各取一通道，最后 feBlend screen 相加。
					// 已实测：黑白背景下"卡内通道差≥25 的像素"从 0 → 426（分光确实发生）。
					const CHANNEL_MATRIX = [
						"1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0", // 只留 R
						"0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0", // 只留 G
						"0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0", // 只留 B
					];
					const keepChannel = (input, ch, result) => {
						const m = document.createElementNS(SVGNS, "feColorMatrix");
						m.setAttribute("in", input);
						m.setAttribute("type", "matrix");
						m.setAttribute("values", CHANNEL_MATRIX[ch]);
						m.setAttribute("result", result);
						return m;
					};
					const dG = mkDisp("dispG"), dR = mkDisp("dispR"), dB = mkDisp("dispB");
					const mR = keepChannel("dispR", 0, "onlyR");
					const mG = keepChannel("dispG", 1, "onlyG");
					const mB = keepChannel("dispB", 2, "onlyB");
					const bRG = document.createElementNS(SVGNS, "feBlend");
					bRG.setAttribute("in", "onlyR");
					bRG.setAttribute("in2", "onlyG");
					bRG.setAttribute("mode", "screen");   // 通道互不重叠 → 等价相加且不过曝
					bRG.setAttribute("result", "rg");
					const bB = document.createElementNS(SVGNS, "feBlend");
					bB.setAttribute("in", "rg");
					bB.setAttribute("in2", "onlyB");
					bB.setAttribute("mode", "screen");
					filter.append(feImage, dG, dR, dB, mR, mG, mB, bRG, bB);
					disps = { g: dG, r: dR, b: dB };
				} else {
					// 无色散：只要一次位移，成本约为三分支版的 1/3
					const dG = mkDisp();
					filter.append(feImage, dG);
					disps = { g: dG, r: null, b: null };
				}
				svg.appendChild(filter);
				document.body.appendChild(svg);
				const inst = { svg, filter, feImage, disps, id, el, ring: null, ringFilters: null, mirrors: null, ringTouchedPos: false, rimTouchedIso: false, rimRaised: null, styles: {} };
				instances.set(el, inst);
				if (ro !== null) ro.observe(el);
				return inst;
			};

			const removeRing = (inst) => {
				if (inst.mirrors && inst.mirrors.length) {
					for (const mi of inst.mirrors) { try { mi.remove(); } catch { /* 忽略 */ } }
					inst.mirrors = null;
				}
				if (inst.ringFilters && inst.ringFilters.length) {
					for (const rf of inst.ringFilters) { try { rf.filter.remove(); } catch { /* 忽略 */ } }
					inst.ringFilters = null;
				}
				if (inst.ring === null || !inst.ring.length) return;
				for (const bar of inst.ring) { try { bar.remove(); } catch { /* 忽略 */ } }
				inst.ring = [];
				if (inst.ringTouchedPos) {
					try { restoreStyle(inst.styles, inst.el, "position"); } catch { /* 忽略 */ }
					inst.ringTouchedPos = false;
				}
			};
			const RIM_ATTR = "data-mc-glass-rim";
			/** v0.2.28：整块玻璃层（面板的兄弟、DOM 在面板之前 = 之下）。 */
			const VEIL_ATTR = "data-mc-glass-veil";
			/** v0.2.25~27 遗留：四根条子与磨砂垫层。保留常量只为清理旧 DOM。 */
			const RIM_BAR_ATTR = "data-mc-glass-rim-bar";
			const BED_ATTR = "data-mc-glass-bed";
			/** 整块面板的模糊半径（px）。v0.2.29 定为 2。
			 *  - 4（v0.2.28）：用户反馈「一致性很高了，但是现在有点太模糊了」→ 磨砂偏重；
			 *  - 2：结构仍在、雾感刚好，背后条纹还能辨出走向，边缘折射也不被糊掉；
			 *  - 1 及以下：接近「只是透明」，会被误认为没做玻璃（v0.2.25 的教训）；
			 *  - 8 以上：整块糊匀，边缘折射彻底看不见。
			 *  与面板底色 alpha 是一对旋钮：想更清就降 blur、同时升 alpha，反之亦然。 */
			const RIM_BLUR = 1;
			/** 位移强度的额外倍数。1 = 与输入框完全同参（峰值 = strength × bezelPx ≈ 19px）。
			 *  面板比输入框大一个量级，同参看上去会偏弱，所以放大一点；角部连续性由贴图保证，
			 *  与倍数无关。 */
			const RIM_DISP_SCALE = 0.6875;
			/** veil 自己的 saturate / brightness（**故意与输入框不同**）。
			 *  输入框是 640×132 的小卡片，brightness 1.05 是提亮；同样 +5% 摊到 800×800 的
			 *  整块面板上，就变成一层均匀的雾 —— 用户原话「有点过于灰了」。
			 *  所以面板改成【不提亮、略提饱和】：灰是失去彩度的结果，不是亮度不够。 */
			const VEIL_SATURATE = 1.06;
			/** 面板折射带宽度（px）。**与输入框的 LIQUID.bezelPx 解耦**：
			 *  输入框只有 132px 高，24px 带已经很抢眼；800px 的面板上 24px 只是一圈细边，
			 *  看上去「折射一般般」。面板需要更宽的带才读得出来。 */
			// v0.2.34 · 为什么是 32px + smoothstep + 0.55：
			//   ① 带宽 52 → 32：52px 在 800×620 的面板上占了 8%，肉眼先看到"一圈厚边"，
			//      再看才看出是折射 —— 用户反馈「太大了、有点突兀」。32px 和对话框
			//      （24px / 132px 高）是同一量级的占比。
			//   ② 缓动从线性锥面改回 smoothstep（"lin"）：线性锥面在**内缘**一阶导数突变，
			//      等于沿着 24px 处画了一条看不见的折线 —— 这是"突兀"的另一半来源。
			//      smoothstep 两端斜率都归零，带内到带外是连续过渡。
			//   ③ K/bezel 0.7 → 0.55：smoothstep 最大斜率 1.5/bezel，折返门限
			//      K/bezel > 0.667；0.55 留 17% 余量，边缘压缩 ≈1.8 倍。
			//      峰值位移 = 0.8 × 0.6875 × 32 ≈ 17.6px（与对话框 19.2px 同量级）。
			const VEIL_BEZEL = 32;

			const VEIL_BRIGHTNESS = 1.0;
						// 延迟重建时要用到 applyTo，但它定义在后面 —— 用可变引用绕开先后顺序，
			// 既避免静态 TDZ，也避免万一真在初始化前触发。
			let applyToRef = null;
			// ── v0.2.23~25 · 边缘折射环带（rim refraction）───────────────────
			// 目标：让设置窗这类**页面级大面板**有和输入框同款的液态玻璃边缘。
			//
			// 走过的弯路（别再重复）：
			//  ① 在面板内部贴玻璃条 → 条子的 backdrop 只能是面板自己的底色，
			//     而底色是平的，模糊平色/位移平色仍是平色 → 什么都看不见。
			//  ② 给整块面板挂 backdrop-filter → bili 设置页（跨源 iframe）
			//     整屏发糊，翻车三次。
			//  ③ 面板内自绘渐变再用 filter 位移 → 是"假边框"，不是折射。
			//
			// v0.2.25 的正解：把四条 28px 条子做成**面板的兄弟**、插在面板之前，
			// 让它们的 backdrop 直接是页面真内容，再叠加 feDisplacementMap 位移。
			// 面板底色降到 42%，折射透过它看得见；条子自己完全透明，不留边。
			// ══════════════════════════════════════════════════════════════════
			// v0.2.28 · 设置面板玻璃 = 一整块（取代 v0.2.25~27 的四根条子）
			// ══════════════════════════════════════════════════════════════════
			// 【为什么推倒四根条子】用户一眼看穿：四条边是四个**独立的** backdrop-filter，
			//   每根各算一套 SDF 位移场，四个角上两块各自为政 —— 于是「交汇处出现扇形区域」，
			//   而且边上和内部的模糊量一不一致就出现硬接缝。这是结构问题，调参永远修不掉。
			// 【输入框为什么好看】它**整块就是一个元素、一张位移贴图**：SDF 在整个圆角矩形
			//   内连续，边与角天然接得上；中心 m→0，所以内部只有模糊、没有位移。
			// 【现在照抄】一个 data-mc-glass-veil：铺满面板、同圆角、同一次滤波。
			//   内部与边缘是**同一个东西**，物理上不存在「两层」和「过渡」。
			// 【仍然不用 backdrop-filter 糊面板本体】veil 是面板的兄弟、DOM 在面板之前，
			//   所以面板自己的正文与 bili iframe 一个像素都不糊（这是 bili 整屏发糊的解药）。
			// ═══ v0.4.8 · 面板内「实心贴片」→「同语言的厚玻璃」 ═══════════════════════
			// 宿主在设置面板里放了一批**不透明**卡片（dark #2c2c2e / light #fff，radius 20，
			// 无阴影）。它们贴在 34% 的面板玻璃上，读起来就是「塑料片贴玻璃」。
			// 这里按**计算样式的结构特征**识别它们并打 data-mc-card（样式在 STAGE_CSS：
			// color-mix 底色 + 发丝边 + 顶线 + 内辉），刻意不用 CSS Module 哈希类名
			// —— 宿主升版哈希就变，结构判据才活得久。
			// 判据：底色 alpha ≥ 0.9 + 圆角 ≥ 8 + 面积 ≥ 6000 + 无背景图 + 无滤镜 + 非滚动容器。
			const CARD_MIN_AREA = 6000;
			const alphaOf = (value) => {
				if (!value) return 0;
				if (value === "transparent") return 0;
				const slash = value.match(/\/\s*([\d.]+)\s*\)/);
				if (slash) return parseFloat(slash[1]);
				const m = value.match(/rgba?\(([^)]+)\)/i);
				if (!m) return 1;
				const parts = m[1].split(/[,\/]/).map((s) => s.trim()).filter(Boolean);
				return parts.length >= 4 ? parseFloat(parts[3]) : 1;
			};
			const decorateCards = (panel, inst) => {
				if (!inst.cards) inst.cards = new Set();
				let nodes;
				try { nodes = panel.querySelectorAll("div,section,li,article"); } catch { return; }
				const marks = [];
				for (const node of nodes) {
					if (!(node instanceof HTMLElement)) continue;
					if (node.hasAttribute("data-mc-card") || node.hasAttribute("data-mc-glass-veil")) continue;
					if (node.offsetWidth * node.offsetHeight < CARD_MIN_AREA) continue;
					const ns = getComputedStyle(node);
					if (ns.backgroundImage !== "none") continue;
					if (ns.backdropFilter && ns.backdropFilter !== "none") continue;
					if (ns.overflowY === "auto" || ns.overflowY === "scroll") continue;
					if (alphaOf(ns.backgroundColor) < 0.9) continue;
					if ((parseFloat(ns.borderTopLeftRadius) || 0) < 8) continue;
					marks.push(node);
				}
				for (const node of marks) {
					try { node.setAttribute("data-mc-card", ""); inst.cards.add(node); } catch { /* 忽略 */ }
				}
			};
			const undecorateCards = (inst) => {
				if (!inst.cards) return;
				for (const node of inst.cards) {
					try { node.removeAttribute("data-mc-card"); } catch { /* 忽略 */ }
				}
				inst.cards.clear();
			};
			const installRim = (el, inst, w, h) => {
				try {
					const cs = getComputedStyle(el);
					const radius = Math.min(parseFloat(cs.borderTopLeftRadius) || 0, w / 2, h / 2);
					const host = el.parentElement || document.body;
					// 面板自身若没有定位，veil 的 fixed 坐标语义会漂，补一个 relative。
					if (cs.position === "static") { writeStyle(inst.styles, el, "position", "relative"); inst.ringTouchedPos = true; }
					if (cs.isolation !== "isolate") { writeStyle(inst.styles, el, "isolation", "isolate"); inst.rimTouchedIso = true; }
					
					// ── 玻璃层：一个元素，铺满面板 ────────────────────────────────────
					let veil = inst.veil;
					if (!veil || !veil.isConnected) {
						veil = document.createElement("div");
						veil.setAttribute(VEIL_ATTR, "");
						veil.setAttribute(RIM_ATTR, "");
						host.insertBefore(veil, el);
						inst.veil = veil;
					} else if (veil.parentNode !== host) {
						host.insertBefore(veil, el);
					}
					
					const rect = el.getBoundingClientRect();
					const W = Math.max(2, Math.round(rect.width));
					const H = Math.max(2, Math.round(rect.height));
					// ⚠️ 位置必须相对【宿主】算，用 position:absolute，不要用 fixed。
					//    fixed 会被祖先的 transform / filter 劫持成「相对那个祖先」，
					//    在带缩放动画的宿主里会让玻璃层整体错位（实测 top 差 208px）。
					const hr = host.getBoundingClientRect();
					const ox2 = Math.round(rect.left - hr.left);
					const oy2 = Math.round(rect.top - hr.top);
					
					// ── 一整张位移贴图（与输入框同一套算法、同一组参数）─────────────────
					//   不给 area：SDF 就按这个盒子本身算，四条边与四个角是同一个连续场，
					//   角上不会再有「两块各算各的」的扇形缝。
					// v0.3.0：veil 与所有小浮层共用 glassParams（bezel 随短边缩放），
					//   不再用固定的 VEIL_BEZEL=32 —— 统一"厚度"，面板/菜单同一材质。
					const GP = glassParams(W, H, false, true);
					// 面板类净位移上限 16px（800×800 设置窗原为 17.4，几乎不变；
				// 小面板会被拉到 16 以内，避免"整块内容被拽动"）
				// v0.11.0：补上 0.4545·bezel 钳制（原来只有 applyTo 里有，veil 没钳制）。
				// 斜率 |d'|max = 1.98·D/B，D>0.505B 就折返 ⇒ 窄带必须同步降峰值。
				const map = buildMap(W, H, radius, GP.bezelPx, null, 1, null, Math.min(MAT.dispTarget, 0.4545 * GP.bezelPx));
					if (!map) throw new Error("Glass veil map unavailable");
					if (!inst.veilFilter) {
						const vf = document.createElementNS(SVGNS, "filter");
						vf.setAttribute("id", inst.id + "-v");
						vf.setAttribute("filterUnits", "userSpaceOnUse");
						vf.setAttribute("color-interpolation-filters", "sRGB");
						const fi = document.createElementNS(SVGNS, "feImage");
						fi.setAttribute("result", "map");
						fi.setAttribute("preserveAspectRatio", "none");
						const dm = document.createElementNS(SVGNS, "feDisplacementMap");
						dm.setAttribute("in", "SourceGraphic");
						dm.setAttribute("in2", "map");
						dm.setAttribute("xChannelSelector", "R");
						dm.setAttribute("yChannelSelector", "G");
						vf.append(fi, dm);
						inst.svg.appendChild(vf);
						inst.veilFilter = vf; inst.veilFeImage = fi; inst.veilDisp = dm;
					}
					const vb = "url(#" + inst.id + "-v) blur(" + GP.blurPx + "px) saturate(" + GP.saturate + ") brightness(" + GP.brightness + ")";
					veil.style.cssText =
						"position:absolute;pointer-events:none;z-index:0;box-sizing:border-box;" +
						"left:" + ox2 + "px;top:" + oy2 + "px;" +
						"width:" + W + "px;height:" + H + "px;border-radius:" + radius + "px;background:transparent;" +
						"-webkit-backdrop-filter:" + vb + ";backdrop-filter:" + vb + ";";
					// v0.12.0：veil 只负责"清边"（bf 现在与输入框同参 blur 1 + 位移），
					// 雾面与体色交给它的 ::after 羽化磨砂芯。参数按盒子尺寸递过去，
					// 与浮层走同一个 frostVars 口径（这里内联，避免跨块依赖）。
					{
						const F = MAT.frost;
						const minSide = Math.min(W, H);
						veil.style.setProperty("--mc-frost-tint", "var(--mc-fill-panel, color-mix(in srgb, var(--dsw-alias-bg-overlay) 45%, transparent))", "important");
						veil.style.setProperty("--mc-frost-blur", (minSide >= F.minSideForFrost ? F.blurPx : F.smallBlurPx) + "px", "important");
						veil.style.setProperty("--mc-frost-feather", clamp(F.minFeatherPx, minSide * F.featherRatio, F.maxFeatherPx) + "px", "important");
					}
					if (map) {
						inst.veilFilter.setAttribute("x", "0");
						inst.veilFilter.setAttribute("y", "0");
						inst.veilFilter.setAttribute("width", String(W));
						inst.veilFilter.setAttribute("height", String(H));
						inst.veilFeImage.setAttribute("x", "0");
						inst.veilFeImage.setAttribute("y", "0");
						inst.veilFeImage.setAttribute("width", String(W));
						inst.veilFeImage.setAttribute("height", String(H));
						inst.veilFeImage.setAttributeNS("http://www.w3.org/1999/xlink", "xlink:href", map.url);
						inst.veilFeImage.setAttribute("href", map.url);
						inst.veilDisp.setAttribute("scale", String(map.scale));
					}
					
					// ── 侧栏分隔玻璃（保持原样：极淡冷色渐变，给 nav / content 一个分界）──
					// v0.5.0：对话框里的导航列不是页面侧栏，刷渐变只会在 nav 列顶部留一条横向硬边
					// （面板本身已经是单块玻璃，不需要分界）。对话框一律跳过。
					const isDialogSurface = el.getAttribute('role') === 'dialog' || el.getAttribute('role') === 'alertdialog' || el.getAttribute('aria-modal') === 'true';
					const kids = isDialogSurface ? [] : Array.prototype.slice.call(el.children);
					for (const kid of kids) {
						if (kid.hasAttribute(RIM_ATTR) || kid.hasAttribute(RIM_BAR_ATTR)) continue;
						const kcs = getComputedStyle(kid);
						const kwidth = kid.offsetWidth;
						if (!kcs.display.includes("flex") && kcs.display !== "block") continue;
						if (kwidth <= 0 || kwidth > w * 0.42) continue;
						// v0.5.0：本意是页面级面板的侧栏分界列，但设置窗里 188×54 的 navTitle 也满足宽度条件
						// → 左上角刷出一条冷色渐变带（a07 连续 3 轮上报）。真正的分隔列必然占满高度。
						if (kid.offsetHeight < h * 0.5) continue;
						if (kid === inst.navi) break;
						if (inst.navi) { inst.navi.removeAttribute("data-mc-navi"); restoreStyle(inst.naviStyles, inst.navi, "background-image"); }
						inst.navi = kid; inst.naviStyles = {};
						kid.setAttribute("data-mc-navi", "1");
						writeStyle(inst.naviStyles, kid, "background-image", "linear-gradient(90deg, rgba(212,232,255,0.055) 0%, rgba(212,232,255,0.02) 78%, rgba(212,232,255,0.00) 100%)");
						break;
					}
					
					// ── 全屏遮罩调参（v0.3.0）────────────────────────────────────
					//  遮罩是 veil 的采样源上方唯一的一层压暗：宿主 .5 会把折射信号砍半。
					//  这里降到 .22/.12，让玻璃采到"真页面"（与输入卡语义一致：玻璃后面
					//  就是页面本身，不是被压暗的页面）。只改 alpha，不改色相。
					try {
						const sibs = el.parentElement ? Array.prototype.slice.call(el.parentElement.children) : [];
						for (const sib of sibs) {
							if (sib === el || sib === veil) continue;
							if (!sib.hasAttribute("aria-hidden")) continue;
							const scs = getComputedStyle(sib);
							if (!/^rgba?\(/.test(scs.backgroundColor) || scs.backdropFilter !== "none") continue;
								if (!inst.maskStyles) inst.maskStyles = {};
							const MT = globalThis.__mcMaskTint || MAT.maskTint;
							writeStyle(inst.maskStyles, sib, "background-color", MT);
							inst.mask = sib;
						}
					} catch { /* 忽略 */ }
					el.removeAttribute("data-mc-rim-error");
					if (!inst.rimOnResize) {
						inst.rimOnResize = () => { try { if (applyToRef && el.isConnected) applyToRef(el, inst); } catch {} };
						window.addEventListener("resize", inst.rimOnResize);
					}
					// 开窗动画（淡入 + 轻微缩放）期间量到的矩形是中途值 → 过几百毫秒再对一次位。
					// 闸门用 rimTimers 数组本身：全部跑完才解除，期间重入不重新排期（否则会自我链式触发）。
					if (!inst.rimTimers || inst.rimTimers.length === 0) {
						inst.rimTimers = [];
						for (const delay of [60, 180, 420]) {
							const id = setTimeout(() => {
								try {
									if (applyToRef && inst.el && inst.el.isConnected) applyToRef(el, inst);
								} catch { /* 忽略 */ }
								try {
									if (inst.rimTimers) {
										inst.rimTimers = inst.rimTimers.filter((x) => x !== id);
										if (inst.rimTimers.length === 0) inst.rimTimers = null;
									}
								} catch { /* 忽略 */ }
							}, delay);
							inst.rimTimers.push(id);
						}
					}
				} catch (err) {
					// 失败即无玻璃，面板保持原样；但必须留痕，否则界面表现为「什么都没变」。
					try { removeRim(inst); } catch {}
					for (const prop of ["backdrop-filter", "-webkit-backdrop-filter", "background-color"]) { try { restoreStyle(inst.styles, el, prop); } catch {} }
					if (!inst.rimOnResize) {
						inst.rimOnResize = () => { try { if (applyToRef && el.isConnected) applyToRef(el, inst); } catch {} };
						window.addEventListener("resize", inst.rimOnResize);
					}
					try { el.setAttribute("data-mc-rim-error", String((err && err.message) || err).slice(0, 160)); } catch { /* 忽略 */ }
					try { console.warn("[maid-glass] installRim failed:", err); } catch { /* 忽略 */ }
				}
			};
			const removeRim = (inst) => {
				undecorateCards(inst);
				// v0.13.0：并列层（rim/frost）必须跟着卸载，否则宿主换层后留下孤儿玻璃。
				if (inst.frost) { try { inst.frost.remove(); } catch { /* 忽略 */ } }
				if (inst.rimLayer) { try { inst.rimLayer.remove(); } catch { /* 忽略 */ } }
				inst.frost = null; inst.frostStyles = null; inst.rimLayer = null; inst.rimLayerStyles = null;
				try { if (inst.el) inst.el.removeAttribute("data-mc-glass-layered"); } catch { /* 忽略 */ }
				if (inst.rimTimers) { for (const t of inst.rimTimers) { try { clearTimeout(t); } catch { /* 忽略 */ } } inst.rimTimers = null; }
				if (inst.rimOnResize) { try { window.removeEventListener("resize", inst.rimOnResize); } catch { /* 忽略 */ } inst.rimOnResize = null; }
				// v0.3.0：先把遮罩 alpha 还原，再拆 veil
				if (inst.mask) { try { restoreStyle(inst.maskStyles || {}, inst.mask, "background-color"); } catch { /* 忽略 */ } inst.mask = null; inst.maskStyles = null; }
				// v0.2.28：单层 veil + 它自己那套 filter
				if (inst.veil) { try { inst.veil.remove(); } catch { /* 忽略 */ } inst.veil = null; }
				if (inst.veilFilter) { try { inst.veilFilter.remove(); } catch { /* 忽略 */ } }
				inst.veilFilter = null; inst.veilFeImage = null; inst.veilDisp = null;
				// v0.2.25~27 遗留：四根条子 / 磨砂垫层（升级后首次清理旧 DOM）
				if (inst.ring && inst.ring.bed) { try { inst.ring.bed.remove(); } catch { /* 忽略 */ } }
				if (inst.ring && inst.ring.length) { for (const bar of inst.ring) { try { bar.remove(); } catch { /* 忽略 */ } } }
				inst.ring = [];
				if (inst.ringFilters && inst.ringFilters.length) { for (const rf of inst.ringFilters) { try { rf.filter.remove(); } catch { /* 忽略 */ } } }
				inst.ringFilters = null;
				if (inst.ringTouchedPos) { try { restoreStyle(inst.styles, inst.el, "position"); } catch { /* 忽略 */ } inst.ringTouchedPos = false; }
				if (inst.rimTouchedIso) {
					try { restoreStyle(inst.styles, inst.el, "isolation"); } catch { /* 忽略 */ }
					inst.rimTouchedIso = false;
				}
				try {
					const navi = inst.navi;
					if (navi) { navi.removeAttribute("data-mc-navi"); restoreStyle(inst.naviStyles, navi, "background-image"); inst.navi = null; }
				} catch { /* 忽略 */ }
			};
			const clearMaterial = (inst) => {
				// v0.13.0：先把并列层拆掉（它们依赖 material 的 z-index 次序），
				// 再还原 material 自身被我们改过的样式。
				if (inst.frost) { try { inst.frost.remove(); } catch { /* 忽略 */ } inst.frost = null; inst.frostStyles = null; }
				if (inst.rimLayer) { try { inst.rimLayer.remove(); } catch { /* 忽略 */ } inst.rimLayer = null; inst.rimLayerStyles = null; }
				try { if (inst.el) inst.el.removeAttribute("data-mc-glass-layered"); } catch { /* 忽略 */ }
				if (!inst.material) return;
				restoreStyle(inst.materialStyles, inst.material, "backdrop-filter");
				restoreStyle(inst.materialStyles, inst.material, "-webkit-backdrop-filter");
				restoreStyle(inst.materialStyles, inst.material, "background-color");
				restoreStyle(inst.materialStyles, inst.material, "z-index");
				restoreStyle(inst.materialStyles, inst.material, "position");
				try { if (ro !== null) ro.unobserve(inst.material); } catch {}
				inst.material = null;
			};
			// ── v0.3.7：宿主把玻璃画在 ::before 的面 ────────────────────────
			// 子智能体树(.rezYhW_menu)、团队面板(.VBK9GG_panel)、插件详情等 5 个面
			// 把 64% 底 + blur(40px) 画在 ::before 里。引擎再给元素自身挂 direct
			// backdrop-filter 就变成「两层玻璃叠一起」：底色合成过实、宿主 40px
			// 模糊在位移场里留下鬼影 —— 这正是"折射区和内部模糊区割裂"的一类成因。
			// 不改宿主 DOM，只挂 data-mc-glass-before + 两个自定义属性，由 STAGE_CSS
			// 里一条静态规则把 ::before 的底与滤镜清零（自定义属性会继承进伪元素）。
			const hasBeforeGlass = (el) => {
				try {
					const cs = getComputedStyle(el, "::before");
					if (cs === null || cs.content === "none") return false;
					const bf = cs.backdropFilter || "none";
					if (bf !== "none") return true;
					const m = /rgba?\(([^)]+)\)/.exec(cs.backgroundColor || "");
					if (m === null) return false;
					const parts = m[1].split(",");
					const a = parts.length >= 4 ? parseFloat(parts[3]) : 1;
					return a > 0.05;
				} catch (err) { return false; }
			};
			const muteBefore = (el, inst) => {
				if (!hasBeforeGlass(el)) return;
				if (!inst.beforeStyles) inst.beforeStyles = {};
				inst.before = el;
				el.setAttribute("data-mc-glass-before", "");
				writeStyle(inst.beforeStyles, el, "--mc-before-fill", "transparent", "important");
				writeStyle(inst.beforeStyles, el, "--mc-before-bf", "none", "important");
			};
			const restoreBefore = (inst) => {
				if (!inst.before) return;
				restoreStyle(inst.beforeStyles, inst.before, "--mc-before-fill");
				restoreStyle(inst.beforeStyles, inst.before, "--mc-before-bf");
				try { inst.before.removeAttribute("data-mc-glass-before"); } catch {}
				inst.before = null;
			};
			const unmount = (el) => {
				const inst = instances.get(el);
				if (inst === undefined) return;
				try { el.removeAttribute("data-mc-rim-error"); el.removeAttribute("data-mc-glass-error"); el.removeAttribute("data-mc-glass"); } catch {}
				try {
					clearMaterial(inst);
					restoreBefore(inst);
					restoreStyle(inst.styles, el, "--mc-composer-filter");
					restoreStyle(inst.styles, el, "backdrop-filter");
					restoreStyle(inst.styles, el, "-webkit-backdrop-filter");
					restoreStyle(inst.styles, el, "background-color");
					// v0.2.12：页面级面板的四根玻璃条必须一并移除，
					// 否则卸载后条子会残留成"一圈糊边"。
					removeRing(inst);
					removeRim(inst);
