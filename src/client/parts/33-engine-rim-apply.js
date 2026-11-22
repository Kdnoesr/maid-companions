//! Per-element liquid glass material application.
//! Uses the geometry, map cache, and rim helpers from part 32.
//! Shares the createLiquidGlass closure with part 34.
					restoreStyle(inst.styles, el, "position");
					inst.ringTouchedPos = false;
				} catch { /* 忽略 */ }
				try { if (ro !== null) ro.unobserve(el); } catch { /* 忽略 */ }
				try { inst.svg.remove(); } catch { /* 忽略 */ }
				instances.delete(el);
			};

			/** 为一个元素重新生成位移贴图并把内联 backdrop-filter 挂回去。 */
			// ── 边缘玻璃条（v0.2.12）─────────────────────────────────────────
			// 给页面级面板装四根独立的玻璃条；面板本身不挂 backdrop-filter。
			// 每根条子各自是普通元素，各自带同一套液态玻璃 —— 与输入框/菜单**同源同参**，
			// 因此设计取向天然统一（这是用户明确要求的："不要和对话框太不一样"）。
			const installRing = (el, inst, w, h) => {
				try {
					const R = Math.min(LIQUID_RING_WIDTH, Math.floor(Math.min(w, h) / 2) - 1);
					if (R < 4) { removeRing(inst); return; }
					// v0.2.18：面板不透明底色 + 条子在面板内部 = 采样源是面板底色本身。
					//   在写清楚"面板参与背景"的方案之前，这条分支整体停用（直接返回）。
					return;
					if (inst.ring === null || !inst.ring.length) {
						// v0.2.18：**不再创建条子**。真机 rig 证明它们在"不透明面板内部"
						//   这个结构下 backdrop-filter 退化为恒等（见文件头 v0.2.18 段）。
						//   保留分支结构，便于后续方案接回。
						inst.ring = [];
					}
					// 面板自身若没有定位，条子的 absolute 会跑到别处，这里补 relative。
					const pos = getComputedStyle(el).position;
					if (pos === "static") { writeStyle(inst.styles, el, "position", "relative"); inst.ringTouchedPos = true; }
					const radius = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0;
					// ⚠️ 每根条子必须用【自己的】filter。
					//   SVG 滤镜 userSpaceOnUse 的坐标系是「元素自己的边框盒」：
					//   四根条子尺寸各不相同，共用一份按整块面板生成的贴图时，
					//   上条取到贴图顶带、左条取到左带是对的，但下条也取顶带、
					//   右条也取左带 —— 即下/右两条的折射方向是错的。
					//   故每条各配一套 filter + feImage + feDisplacementMap。
					const bw = [w, w, R, R];   // 上/下/左/右 各自的盒子尺寸
					const bh = [R, R, h, h];
					const ox = [0, 0, 0, -(w - R)];  // 只有"右条"需要在 X 上左移；上/下/左三条都从整图左上角开始
					const oy = [0, -(h - R), 0, 0];  // 下条要沿 Y 上移，取整图最下一带；其余三条对齐顶部
					const geom = [
						"top:0;left:0;right:0;height:" + R + "px;",
						"bottom:0;left:0;right:0;height:" + R + "px;",
						"top:0;bottom:0;left:0;width:" + R + "px;",
						"top:0;bottom:0;right:0;width:" + R + "px;",
					];
					for (let i = 0; i < 4; i++) {
						const bar = inst.ring[i];
						bar.style.cssText = "position:absolute;pointer-events:none;z-index:-1;" + geom[i]
							+ "border-radius:" + (i < 2 ? radius + "px " + radius + "px 0 0" : "0 0 " + radius + "px " + radius + "px") + ";";
						const rid = inst.id + "-b" + i;
						bar.style.backdropFilter = "url(#" + rid + ") blur(" + LIQUID.blurPx + "px) saturate(" + LIQUID.saturate + ") brightness(" + LIQUID.brightness + ")";
						bar.style.webkitBackdropFilter = "url(#" + rid + ") blur(" + LIQUID.blurPx + "px) saturate(" + LIQUID.saturate + ") brightness(" + LIQUID.brightness + ")";
					}
					// 把四套滤镜真正建到 <defs> 里（每个条子一幅 feImage + 一个 feDisplacementMap）。
					if (!inst.ringFilters || inst.ringFilters.length !== 4) {
						if (inst.ringFilters) { for (const f of inst.ringFilters) { try { f.filter.remove(); } catch { /* 忽略 */ } } }
						inst.ringFilters = [];
						for (let i = 0; i < 4; i++) {
							const f = document.createElementNS(SVGNS, "filter");
							f.setAttribute("id", inst.id + "-b" + i);
							f.setAttribute("filterUnits", "userSpaceOnUse");
							f.setAttribute("x", "0"); f.setAttribute("y", "0");
							f.setAttribute("width", String(bw[i])); f.setAttribute("height", String(bh[i]));
							f.setAttribute("color-interpolation-filters", "sRGB");
							const fi = document.createElementNS(SVGNS, "feImage");
							fi.setAttribute("result", "map");
							fi.setAttribute("preserveAspectRatio", "none");
							// 负偏移：让整块面板的贴图对齐到"该条在面板中的真实位置"
							fi.setAttribute("x", String(ox[i])); fi.setAttribute("y", String(oy[i]));
							fi.setAttribute("width", String(w)); fi.setAttribute("height", String(h));
							fi.setAttributeNS("http://www.w3.org/1999/xlink", "xlink:href", map.url);
							const dd = document.createElementNS(SVGNS, "feDisplacementMap");
							dd.setAttribute("in", "SourceGraphic"); dd.setAttribute("in2", "map");
							dd.setAttribute("xChannelSelector", "R"); dd.setAttribute("yChannelSelector", "G");
							dd.setAttribute("scale", String(map.scale));
							f.append(fi, dd);
							inst.svg.appendChild(f);
							inst.ringFilters.push({ filter: f, feImage: fi, disp: dd });
						}
					} else {
						for (const rf of inst.ringFilters) { rf.feImage.setAttributeNS("http://www.w3.org/1999/xlink", "xlink:href", map.url); rf.disp.setAttribute("scale", String(map.scale)); }
					}
					for (let i = 0; i < 4; i++) {
						const rf = inst.ringFilters[i];
						if (!rf) continue;
						rf.filter.setAttribute("width", String(bw[i]));
						rf.filter.setAttribute("height", String(bh[i]));
						// 贴图是"这一条带自己"的位移场，直接铺满条带盒子
						rf.feImage.setAttribute("x", "0");
						rf.feImage.setAttribute("y", "0");
						rf.feImage.setAttribute("width", String(bw[i]));
						rf.feImage.setAttribute("height", String(bh[i]));
					}
					// ── 2026-10-18 · v0.2.18 · 删掉「镜像墙」（已被证伪，纯开销）──
					// 镜像墙（向外翻 160px 再 backdrop-filter）在真机结构下 **100% 被裁掉**：
					//   面板 .VOzbGW_panel 真实 CSS 带 overflow:hidden，外层 .pI_x6G_frame
					//   也是 overflow:hidden —— 实验测到面板外 60px 内 max|Δ| = 0.0。
					// 更根本的是它属于"不动点"：均匀底色 blur 后仍是均匀底色，
					// 对挂在面板内部的条子采样值没有任何贡献。
					// 真机结构 rig 实测现行 v0.2.17：条子内注入量是平坦常数 +2.00（四条一样、
					//   方差 0），与背后场景相关性 r = 0.000；去掉 backdrop-filter 的版本
					//   与无玻璃基线逐像素相同 —— 也就是说这圈"折射"从来就不存在。
					// 结论：设置窗要像对话框，靠的不是调参数，而是"盒子坐在哪一层"。
					//   输入框好看是因为它 background:transparent 且背后就是页面背景；
					//   而面板背后是不透明底色，任何滤镜都退化成恒等。
					// 故此处不再创建任何元素：条子仅保留 DOM 结构以便后续方案复用。
				} catch { /* 失败即无边缘玻璃，面板保持原样 */ }
			};

			// v0.12.0：把"羽化磨砂芯"的三个自定义属性写到真正承担材质的那一层。
			// 芯子本体是 CSS 的 ::after（见 22-css-floating.js v0.12.0 段），这里只递参数：
			//   tint   —— 体色（与旧版 background-color 同一令牌，只是改由带 mask 的芯子输出）
			//   blur   —— 雾的厚度：短边 ≥96 用 14px，小面用 9px（否则薄条被糊成色块）
			//   feather—— 清边→雾面的过渡宽度：短边×0.14，夹在 8~36（小面自动变窄）
			const frostVars = (node, styles, w, h, tint) => {
				const F = MAT.frost;
				const minSide = Math.min(w, h);
				const blur = minSide >= F.minSideForFrost ? F.blurPx : F.smallBlurPx;
				const feather = clamp(F.minFeatherPx, minSide * F.featherRatio, F.maxFeatherPx);
				writeStyle(styles, node, "--mc-frost-tint", tint, "important");
				writeStyle(styles, node, "--mc-frost-blur", blur + "px", "important");
				writeStyle(styles, node, "--mc-frost-feather", feather + "px", "important");
			};
			// ═══ v0.13.0 · 并列层（rim / frost）═══════════════════════════════════
			// 真机 A/B 结论（shots/nest-bf.png）：backdrop-filter 元素会成为它后代的
			// backdrop root，后代再挂 backdrop-filter 会 **整层空转**（不是被 mask 打洞，
			// 是计算完直接丢弃）。所以"主体层 + 同元素/子元素磨砂芯"这条路根本不通。
			// 正确结构：宿主 bf:none，rim（清边/折射带）与 frost（雾面）是**并列兄弟**，
			// 都直接采真实页面 → 两层各自成立，边缘与内芯是同一块材料的两段。
			const layerStyles = (inst, key) => {
				if (!inst[key + "Styles"]) inst[key + "Styles"] = {};
				return inst[key + "Styles"];
			};
			/** 在 host 里保证有一个 [attr] 层；ref 给定时插在 ref 之后（保证绘制顺序）。 */
			const ensureLayer = (host, inst, key, attr, ref, radius) => {
				let node = inst[key];
				const wantRef = ref || null;
				if (node && (!node.isConnected || node.parentNode !== host || node.__mcRef !== wantRef)) {
					try { node.remove(); } catch { /* 忽略 */ }
					node = null;
				}
				if (!node) {
					node = document.createElement("div");
					node.setAttribute(attr, "");
					node.__mcRef = wantRef;
					if (wantRef && wantRef.parentNode === host) host.insertBefore(node, wantRef.nextSibling);
					else host.appendChild(node);
					inst[key] = node;
					inst[key + "Styles"] = {};
				}
				const st = layerStyles(inst, key);
				writeStyle(st, node, "border-radius", (radius > 0 ? radius : 0) + "px", "important");
				return node;
			};
			const dropLayer = (inst, key) => {
				const node = inst[key];
				if (node) { try { node.remove(); } catch { /* 忽略 */ } }
				inst[key] = null;
				inst[key + "Styles"] = null;
			};
			/** 清掉所有并列层（卸载/降级时调用，避免留孤儿 DOM）。 */
			const dropLayers = (inst) => {
				dropLayer(inst, "frost");
				dropLayer(inst, "rimLayer");
				try { if (inst.el) inst.el.removeAttribute("data-mc-glass-layered"); } catch { /* 忽略 */ }
			};
			const applyTo = (el, inst) => {
				try {
					const modernMenu = el.getAttribute("data-menu-material") === "translucent";
					// v0.3.2：背板识别放宽。宿主不同菜单的背板层不总带 aria-hidden
					//（输入框候选下拉就没有），旧判据会让整块浮层直接 return —— 玻璃缺席。
					const findMaterial = (root) => {
						const kids = root.children;
						for (let i = 0; i < kids.length; i++) {
							const c = kids[i];
							if ((c.localName || c.tag) !== "div") continue;
							if (c.getAttribute("aria-hidden") === "true") return c;
							const cn = typeof c.className === "string" ? c.className : "";
							if (/_material_/.test(cn)) return c;
							try { const bf = getComputedStyle(c).backdropFilter; if (bf && bf !== "none") return c; } catch { /* ignore */ }
						}
						return null;
					};
					const material = modernMenu ? findMaterial(el) : null;
					if (inst.material && inst.material !== material) clearMaterial(inst);
					if (modernMenu && !material) {
						restoreStyle(inst.styles, el, "backdrop-filter");
						restoreStyle(inst.styles, el, "-webkit-backdrop-filter");
						return;
					}
					const target = material || el;
					const w = Math.round(target.offsetWidth), h = Math.round(target.offsetHeight);
					const resetModern = () => {
						if (!modernMenu) return;
						clearMaterial(inst);
						restoreStyle(inst.styles, el, "backdrop-filter");
						restoreStyle(inst.styles, el, "-webkit-backdrop-filter");
					};
					if (w === 0 || h === 0) { resetModern(); return; }
					let radius = parseFloat(getComputedStyle(target).borderTopLeftRadius) || 0;
					radius = Math.min(radius, w / 2, h / 2);
					// v0.3.0：composer 冻结、其它面统一走 glassParams（bezel 随短边缩放）
					const isComposer = el.hasAttribute("data-composer-card");
					const kind = surfaceKind(el);
					const isFloat = kind === "float";
					const GP = glassParams(w, h, isComposer);
					const bezel = Math.min(GP.bezelPx, Math.min(w, h) / 2 - 1);
					// v0.3.1：浮层（菜单/树/候选列表）**不再受面积闸门限制** —— 大菜单
					// 也要有折射；位移量已由 buildMap 的 dTarget 统一钳住，不会失控。
					if (bezel <= 1) { resetModern(); return; }
					// ── 面积分流要放在最前面（v0.2.24）────────────────────────
					// 页面级面板由 installRim 自己生成一整张**整块尺寸**的位移贴图（v0.2.28 起单层 veil），
					// 不需要这里再算一张 800×800 的整块贴图（纯浪费，且 256×256
					// 的 canvas 每帧重算会拖慢打开设置的那一下）。
					// A tall draft still uses the composer’s own glass layer.
					if (!isComposer && !isFloat && w * h > LIQUID_RING_MIN_AREA) {
						writeStyle(inst.styles, el, "backdrop-filter", "none", "important");
						writeStyle(inst.styles, el, "-webkit-backdrop-filter", "none", "important");
						// 半透明底由 JS 设成内联样式（比 STAGE_CSS 更难静默失效：
						// 判据是面积，不依赖类名或 overlay→panel 的直接子关系）。
						// ── 面板底色 alpha 是「灰不灰」的主旋钮（55% → 40% → 35%，v0.2.31）──
						// 用户原话：「再透明一点，有点过于灰了」。灰的来源不是亮度不够，
						// 而是 #2c2c2e 这种中性灰按 alpha 盖上来之后，把背后的彩度一起压平了。
						// 所以降 alpha（露出更多背景彩度）+ veil 不提亮（brightness 1.0）
						// + 略提饱和（1.06）三者一起做，才是「不发灰」的组合。
						// v0.3.0：35% → 26%（更透，背后内容参与折射；与菜单/气泡低底色一致）
						// v0.4.6：浅色主题面板必须更实（80%），否则背后正文"字叠字"。
						// v0.9.0：面板底色与浮层共用 fill 令牌（深色烟熏黑 / 浅色白系），
						// 不再各自切 alpha —— 只保留 __mcPanelTint 作为调试逃生口。
						// v0.12.0：面板本体**不再有底色** —— 任何平铺 alpha 都会在圆角处留
						// 一条 1px 亮/暗阶跃（a04 定量：设置窗 ΔL +25 里有 +13 来自它）。
						// 体色与雾面统一交给 veil 的羽化磨砂芯（mask 渐变 ⇒ 边界连续）。
						writeStyle(inst.styles, el, "background-color", "transparent", "important");
						removeRing(inst);
						try { el.setAttribute("data-mc-glass", ""); } catch { /* 忽略 */ }
						installRim(el, inst, w, h);
						// v0.13.0：雾面/体色改由**并列**的 frost 子层承担（venil 是 rim）。
						//   不能挂在 veil 或 panel 的伪元素上 —— 它们是 bf 元素/其后代，会空转。
						//   挂在 panel 自身的第一子节点位置 + z-index:-1：绘制在面板底之上、
						//   内容之下，且 panel 是 z-index:1 的独立层，采样源仍是页面。
						{
							const panelTint = globalThis.__mcPanelTint == null
								? "var(--mc-fill-panel, color-mix(in srgb, var(--dsw-alias-bg-overlay) 45%, transparent))"
								: "color-mix(in srgb, var(--dsw-alias-bg-overlay) " + Math.round(globalThis.__mcPanelTint) + "%, transparent)";
							const frost = ensureLayer(el, inst, "frost", "data-mc-frost", null, radius);
							// v0.15.0：isolation 交给 CSS（22-css-floating.js 的 [data-mc-glass-layered] 规则），
							// 不再写内联 —— 内联没有回滚路径，换 material/关插件时会残留 stacking context。
							try { el.setAttribute("data-mc-glass-layered", ""); } catch { /* 忽略 */ }
							frostVars(frost, layerStyles(inst, "frost"), w, h, panelTint);
						}
						decorateCards(el, inst);
						return;
					}
					// Leave page-panel mode before attempting the smaller map, even if it fails.
					removeRim(inst);
					restoreStyle(inst.styles, el, "background-color");
					restoreBefore(inst);
					// v0.6.1（a03）：小面 bezel 被 clamp 后 24px 带占满短边会折返（fold=D*1.98/bezel>1），
					//   按 dEff=min(dTarget, 0.4545*bezel) 钳制；峰位移恒等于 dEff 后带/模糊=bezel/1px 仍 ≥8。
					// v0.7.0（a02 PATCH B）：输入框也吃 dTarget=10 —— 黄金标准此前随宽度漂移
					//   （953.6 宽 10.31 / 702 宽 14.00 / 486.8 宽 19.02），这才是"每处折射不统一"
					//   的源头：同一个输入框在不同窗口宽度下折射强度差 2×。统一到 10 后，
					//   默认布局只差 −3%（不可见），窄布局收回 2× 过冲，全站同一强度。
					const dTargetEff = Math.min(MAT.dispTarget, 0.4545 * bezel);
					const usePhysicalGlass = !el.hasAttribute("data-message-bubble") && LIQUID.dispersion === 0;
					const profile = usePhysicalGlass ? "physical" : null;
					const map = buildMap(w, h, radius, bezel, null, 1, profile, usePhysicalGlass || dTargetEff >= 2 ? dTargetEff : 0);
					if (map === null) {
						resetModern();
						if (!modernMenu) { restoreStyle(inst.styles, el, "backdrop-filter"); restoreStyle(inst.styles, el, "-webkit-backdrop-filter"); }
						return;
					}
					inst.filter.setAttribute("width", String(w));
					inst.filter.setAttribute("height", String(h));
					inst.filter.setAttribute("x", "0");
					inst.filter.setAttribute("y", "0");
					inst.feImage.setAttribute("width", String(w));
					inst.feImage.setAttribute("height", String(h));
					inst.feImage.setAttribute("href", map.url);
					if (usePhysicalGlass && !inst.reflection) {
						inst.reflection = appendReflection(inst.filter, inst.disps.g);
					} else if (!usePhysicalGlass && inst.reflection) {
						for (const node of inst.reflection) node.remove();
						inst.reflection = null;
						inst.disps.g.removeAttribute("result");
					}
					const d = LIQUID.dispersion, s = map.scale;
					if (inst.disps.r !== null && inst.disps.b !== null && d > 0) {
						inst.disps.g.setAttribute("scale", s.toFixed(2));
						inst.disps.r.setAttribute("scale", (s * (1 + d)).toFixed(2));
						inst.disps.b.setAttribute("scale", (s * (1 - d)).toFixed(2));
					} else {
						inst.disps.g.setAttribute("scale", s.toFixed(2));
					}
					const value = "url(#" + inst.id + ") blur(" + GP.blurPx + "px) saturate(" + GP.saturate + ") brightness(" + GP.brightness + ")";
					// ⚠️ 走到这里说明是「小浮层 / 输入框」：先清掉可能残留的环带与内联底色，
					//    再挂 backdrop-filter。两者互斥 —— 同时存在时 backdrop 会采到
					//    环带的绘制结果，整块浮层被模糊两次。
					removeRim(inst);
					restoreStyle(inst.styles, el, "background-color");
					// 底色：面积越大越实（见 floatTint 注释）。写在内联样式上，
					// 这样 CSS 侧的兜底规则不会与 JS 档位打架。
					// 有 ::before 玻璃的面先把它静音，再挂引擎玻璃（否则两层叠加）。
					// v0.8.1（a08 A08/A18）：**标记必须落在真正挂 bf 的那一层**。
					// 菜单/弹层族的结构是 root(_surface) + 子层(_material)，bf 只挂在子层；
					// 若把 data-mc-glass 打在 root 上，外部审计/QA 会在 root 上读到 bf:none，
					// 误判"玻璃没生效"，且 ::before 静音、控件配方等也会选错层级。
					// 所以这里先按 material 决定标记归属，下面 material 分支再补挂。
					try { el.removeAttribute("data-mc-glass"); } catch { /* 忽略 */ }
					if (!isComposer) muteBefore(el, inst);
					// v0.9.0：浮层同样走 fill 令牌；__mcTint 仅作调试覆盖（百分比口径）。
					const tintValue = globalThis.__mcTint == null
						? "var(--mc-fill-float, color-mix(in srgb, var(--dsw-alias-bg-overlay) 45%, transparent))"
						: "color-mix(in srgb, var(--dsw-alias-bg-overlay) " + Math.round(globalThis.__mcTint) + "%, transparent)";
					if (material) {
						try { material.setAttribute("data-mc-glass", ""); } catch { /* 忽略 */ }
						// v0.8.1（a08 A15/A16）：内辉必须和 bf/tint 落在**同一层**。
						//   菜单族结构 = root(_surface) + 子层(_material)，bf 只挂子层；
						//   若内辉留在 root，视觉上会被子层遮住（等于没有），审计也会判"面缺内辉"。
						writeStyle(inst.styles, el, "box-shadow", "0 0 0 0.5px var(--mc-hairline), var(--mc-shadow-float)", "important");
						writeStyle(inst.materialStyles || (inst.materialStyles = {}), material, "box-shadow", RIM_LIGHT, "important");
						if (!inst.material) { inst.material = material; if (ro !== null) ro.observe(material); }
						writeStyle(inst.styles, el, "backdrop-filter", "none", "important");
						writeStyle(inst.styles, el, "-webkit-backdrop-filter", "none", "important");
						writeStyle(inst.materialStyles, material, "backdrop-filter", value, "important");
						writeStyle(inst.materialStyles, material, "-webkit-backdrop-filter", value, "important");
						// v0.13.0：材质层底透明（体色/雾面由并列 frost 层输出）。
						writeStyle(inst.materialStyles, material, "background-color", "transparent", "important");
						// 绘制顺序：material(rim) 必须在 frost 之下 —— 两者同属 root，
						// 用 z-index 显式压住（宿主 material 有时是 z-index:auto 的普通子层，
						// 那样负 z 的 frost 反而会被它盖住，雾面直接看不见）。
						try {
							if (getComputedStyle(material).position === "static") writeStyle(inst.materialStyles, material, "position", "relative", "important");
						} catch { /* 忽略 */ }
						writeStyle(inst.materialStyles, material, "z-index", "-2", "important");
						// v0.15.0：isolation 交 CSS（同 panel 分支），去掉无回滚路径的内联写入。
						try { el.setAttribute("data-mc-glass-layered", ""); } catch { /* 忽略 */ }
						{
							const frost = ensureLayer(el, inst, "frost", "data-mc-frost", material, radius);
							frostVars(frost, layerStyles(inst, "frost"), w, h, tintValue);
						}
					} else if (el.hasAttribute("data-composer-card") || el.matches("[role='tooltip'][style*='--turn-preview-center']")) {
						// ★ 输入框：黄金标准，结构一层不动（bf 直接挂元素本身、单层采样）。
						try { el.setAttribute("data-mc-glass", ""); } catch { /* 忽略 */ }
						writeStyle(inst.styles, el, "backdrop-filter", value);
						writeStyle(inst.styles, el, "-webkit-backdrop-filter", value);
						writeStyle(inst.styles, el, "background-color", "transparent", "important");
						dropLayers(inst);
					} else {
						// v0.13.0：非 material 面（用户气泡/确认框/团队面板/子智能体树/引用预览…）
						// 旧做法把 bf 挂在元素自身，再挂磨砂芯 → 芯子是 bf 的后代 ⇒ 空转。
						// 现在：元素自身 bf 归零，bf 移到并列的 rim 子层，frost 紧随其后。
						try { el.setAttribute("data-mc-glass", ""); el.setAttribute("data-mc-glass-layered", ""); } catch { /* 忽略 */ }
						writeStyle(inst.styles, el, "backdrop-filter", "none", "important");
						writeStyle(inst.styles, el, "-webkit-backdrop-filter", "none", "important");
						writeStyle(inst.styles, el, "background-color", "transparent", "important");
						// v0.15.0：isolation 交 CSS（同 panel 分支）。
						// v0.14.1：host 若是 position:static，绝对定位的并列层会以更远的祖先为
						// 包含块 —— 实测气泡层的 rim/frost 被撑成 922×1782（整列尺寸），
						// 位移/模糊采样范围完全错位。先把 host 变成定位元素再插层。
						try {
							if (getComputedStyle(el).position === "static") writeStyle(inst.styles, el, "position", "relative", "important");
						} catch { /* 忽略 */ }
						const rim = ensureLayer(el, inst, "rimLayer", "data-mc-glass-rim", null, radius);
						const rimSt = layerStyles(inst, "rimLayer");
						if (usePhysicalGlass) writeStyle(rimSt, rim, "box-shadow", RIM_LIGHT, "important");
						else restoreStyle(rimSt, rim, "box-shadow");
						writeStyle(rimSt, rim, "backdrop-filter", value, "important");
						writeStyle(rimSt, rim, "-webkit-backdrop-filter", value, "important");
						const frost = ensureLayer(el, inst, "frost", "data-mc-frost", rim, radius);
						frostVars(frost, layerStyles(inst, "frost"), w, h, tintValue);
					}
					removeRing(inst);
				} catch (err) {
					try {
						clearMaterial(inst);
						restoreStyle(inst.styles, el, "backdrop-filter");
						restoreStyle(inst.styles, el, "-webkit-backdrop-filter");
					} catch {}
					// 失败即无折射，保留 CSS 侧的观感。
					// 留痕：这类异常被静默吞掉时，界面表现是「改了等于没改」，
					// 这一轮就是因为查不到任何错误而多绕了很久。
					try { el.setAttribute("data-mc-glass-error", String((err && err.message) || err).slice(0, 160)); } catch { /* 忽略 */ }
					try { console.warn("[maid-glass] applyTo failed:", err); } catch { /* 忽略 */ }
				}
			};

			/** 只处理"新出现的"目标：浮层刚插入时立刻挂上，不等去抖。
			 *  这是消除"打开设置闪一下"的关键——见下方 refresh() 的说明。 */
			applyToRef = applyTo;
